// Security headers for a static site, written at build to dist/_headers (Cloudflare Workers static assets and Vercel
// read that file). production-security-checklist.md item 11. Why a plugin and not a hand-written file: the CSP has to
// allow the built pages' own inline scripts, and it does that by sha256 hash, worked out here from the built HTML,
// so editing an inline script can never leave a stale hash behind.
//
//   import security from './vite.security.js';   plugins: [..., security()]
//   security({ csp: { 'frame-src': ['https://www.google.com'] } })   // a Google Maps embed
//   security({ csp: { 'style-src': ['https://fonts.googleapis.com'], 'font-src': ['https://fonts.gstatic.com'] } })
//
// Every source a page loads from another origin must be listed here, or the browser blocks it. Headers the site
// already sets under `/*` in public/_headers win over these; other paths in that file are kept as they are.
// Limit: inline event handlers (onclick="...") are blocked by the CSP: use addEventListener.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEFAULT_CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"], // the inline-script hashes are added at build
  'style-src': ["'self'", "'unsafe-inline'"], // style="" attributes set by the page and its effects
  'img-src': ["'self'", 'data:', 'blob:'],
  'media-src': ["'self'", 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

const htmlFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? htmlFiles(p) : e.name.endsWith('.html') ? [p] : [];
  });

export function buildCsp(extra = {}, hashes = []) {
  const csp = Object.fromEntries(Object.entries(DEFAULT_CSP).map(([k, v]) => [k, [...v]]));
  for (const [k, v] of Object.entries(extra)) csp[k] = [...new Set([...(csp[k] ?? []), ...v])];
  csp['script-src'].push(...hashes);
  return [...Object.entries(csp).map(([k, v]) => `${k} ${v.join(' ')}`), 'upgrade-insecure-requests'].join('; ');
}

export function inlineScriptHashes(html) {
  const out = [];
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=|type=["']?application\/(ld\+)?json/.test(attrs)) continue; // external, or data a browser never runs
    out.push(`'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`);
  }
  return out;
}

// Adds our headers to the `/*` block of an existing _headers text, skipping any header the site already sets there.
export function mergeHeaders(existing, ours) {
  const lines = existing.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === '/*');
  const have = new Set();
  let at = lines.length;
  if (start >= 0) {
    at = start + 1;
    while (at < lines.length && (/^\s+\S/.test(lines[at]) || lines[at].trim() === '')) {
      const name = lines[at].trim().split(':')[0].toLowerCase();
      if (name) have.add(name);
      at++;
    }
  }
  const mine = Object.entries(ours).filter(([k]) => !have.has(k.toLowerCase())).map(([k, v]) => `  ${k}: ${v}`);
  if (start >= 0) {
    // insert after the last header line of the existing block, not after its trailing blank lines
    let end = at;
    while (end > start + 1 && lines[end - 1].trim() === '') end--;
    lines.splice(end, 0, ...mine);
    return lines.join('\n').replace(/\n*$/, '\n');
  }
  const rest = lines.join('\n').trim();
  return `${rest}${rest ? '\n\n' : ''}/*\n${mine.join('\n')}\n`;
}

export default function security(options = {}) {
  let dist;
  return {
    name: 'security-headers',
    apply: 'build',
    configResolved(config) {
      dist = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!fs.existsSync(dist)) return;
      const hashes = [...new Set(htmlFiles(dist).flatMap((f) => inlineScriptHashes(fs.readFileSync(f, 'utf8'))))];
      const ours = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': buildCsp(options.csp, hashes),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
      };
      const file = path.join(dist, '_headers'); // Vite has already copied public/_headers here, if the site has one
      fs.writeFileSync(file, mergeHeaders(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', ours));
    },
  };
}

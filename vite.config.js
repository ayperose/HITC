import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import security from './vite.security.js';
import seo from './vite.seo.js';

// The address the site will live at, for example 'https://www.example.ph' (no slash at the end). Empty until the domain is
// known; when it is set, the build adds sitemap.xml, canonical links, og:url and the share image address. Can also be
// given at build time: SITE_URL=https://www.example.ph npm run build
const SITE_URL = process.env.SITE_URL || '';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// HITC ships 12 static pages, each a build input (the 404 page is public/404.html, copied as it is). The old dev pages (logo-compare, logo-preview,
// logo-variations, nav-test) are left out on purpose: they must never ship.
// If port 5173 is taken Vite moves to the next free one, so always use the URL it prints.
const pages = ['index', 'services', 'about', 'attendance', 'careers', 'contact', 'ebroadcasting', 'ecash', 'iask', 'sfms', 'turnstile', 'privacy'];

export default defineConfig({
  plugins: [
    security({
      csp: {
        // YouTube videos (attendance, turnstile) and the contact map, whose src js/pages.js sets from data-geo
        'frame-src': ['https://www.youtube.com', 'https://www.google.com'],
        // the contact form posts to Web3Forms with fetch
        'connect-src': ['https://api.web3forms.com'],
      },
    }),
    seo({ siteUrl: SITE_URL }),
    tailwindcss(),
    react(),
  ],
  server: { port: 5173 },
  build: {
    target: 'es2020',
    // the home page's hero chunk (three.js) is one big module by design
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      input: Object.fromEntries(pages.map((p) => [p, here(`./${p}.html`)])),
    },
  },
});

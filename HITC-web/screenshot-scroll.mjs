import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/miles/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer');
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIR = join(ROOT, 'temporary screenshots');
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const section = process.argv[2] || '#services';
const offset = parseInt(process.argv[3] || '400');
const label = process.argv[4] || 'scroll';

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 });

// Trigger all observers
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
let sy = 0;
while (sy < pageHeight) { sy += 600; await page.evaluate(y => window.scrollTo(0, y), sy); await new Promise(r => setTimeout(r, 100)); }

await page.evaluate((sel, off) => {
  const el = document.querySelector(sel);
  if (el) window.scrollTo(0, el.offsetTop + off);
}, section, offset);
await new Promise(r => setTimeout(r, 1500));

const nums = readdirSync(DIR).filter(f => /^screenshot-\d+/.test(f)).map(f => parseInt(f.match(/screenshot-(\d+)/)[1]));
const n = nums.length ? Math.max(...nums) + 1 : 1;
const file = join(DIR, `screenshot-${n}-${label}.png`);
await page.screenshot({ path: file, fullPage: false });
await browser.close();
console.log(`temporary screenshots/screenshot-${n}-${label}.png`);

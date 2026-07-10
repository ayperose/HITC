import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/miles/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer');
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIR = join(ROOT, 'temporary screenshots');
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

const nums = readdirSync(DIR)
  .filter(f => /^screenshot-\d+/.test(f))
  .map(f => parseInt(f.match(/screenshot-(\d+)/)[1]));
const n = nums.length ? Math.max(...nums) + 1 : 1;
const file = join(DIR, label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`);

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--enable-webgl',
    '--use-gl=swiftshader',
    '--ignore-gpu-blacklist',
    '--enable-gpu-rasterization',
    '--disable-software-rasterizer',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, 3500));
await page.screenshot({ path: file, fullPage: false });
await browser.close();
console.log(`temporary screenshots/${label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`}`);

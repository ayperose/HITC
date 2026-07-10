import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/miles/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer');
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIR = join(ROOT, 'temporary screenshots');
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));

// Scroll through the page to trigger IntersectionObserver
const pageHeight = await page.evaluate(() => document.body.scrollHeight);
let scrollY = 0;
while (scrollY < pageHeight) {
  scrollY += 600;
  await page.evaluate(y => window.scrollTo(0, y), scrollY);
  await new Promise(r => setTimeout(r, 150));
}
// Scroll back to top
await page.evaluate(() => window.scrollTo(0, 0));
await new Promise(r => setTimeout(r, 1000));

await page.screenshot({ path: join(DIR, 'screenshot-full.png'), fullPage: true });
await browser.close();
console.log('temporary screenshots/screenshot-full.png');

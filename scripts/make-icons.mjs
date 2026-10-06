// Renders design/app-icon.svg (Figma "Logo/App icon", 40:3) into the PNGs iOS and the manifest need.
// iOS masks the corners itself, so the source is a full-bleed white square.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../design/app-icon.svg', import.meta.url), 'utf8');
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
for (const [file, size, pad] of [
  ['apple-touch-icon.png', 180, 0],
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.1], // extra margin keeps the ring inside Android's safe zone
]) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<body style="margin:0;background:#fff;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('width="180" height="180"', `width="${inner}" height="${inner}"`)}</body>`,
  );
  await page.screenshot({ path: out(file), omitBackground: false });
  console.log('icon', file);
}
await browser.close();

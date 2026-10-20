import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
const svg = await readFile('apps/extension/public/icon.svg', 'utf8');
await mkdir('apps/extension/public/icons', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: `apps/extension/public/icons/${size}.png`, omitBackground: true });
  }
} finally { await browser.close(); }
console.log('Extension icons generated from public/icon.svg');

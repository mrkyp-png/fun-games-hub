const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8844;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/mole/index.html`, { waitUntil: 'load' });

    await page.evaluate(() => window.__debugStartGame('easy', 2));
    await new Promise((r) => setTimeout(r, 500));

    const before = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(before, 'none', 'board not transformed before swap');

    await page.evaluate(() => window.__debugSwapBoardPositions(true));
    await new Promise((r) => setTimeout(r, 700));
    const afterBoard = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform !== 'none');
    const afterBar = await page.evaluate(() => getComputedStyle(document.getElementById('lane-button-bar')).transform !== 'none');
    assert.strictEqual(afterBoard, true, 'board transformed after swap(true)');
    assert.strictEqual(afterBar, true, 'button bar transformed after swap(true)');

    await page.evaluate(() => window.__debugSwapBoardPositions(false));
    await new Promise((r) => setTimeout(r, 700));
    const reverted = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(reverted, 'none', 'board back to no transform after swap(false)');

    console.log('verify-fever-swap.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

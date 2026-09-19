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
    // .dialpad(컨테이너)를 옮긴다 — #lane-button-bar 를 직접 옮기면 .dialpad 의
    // contain:paint 에 밖으로 나간 부분이 잘려서(실기기 화면녹화로 확인된 실제 버그) 안
    // 보였다. 그래서 여기서는 .dialpad 쪽 transform 을 확인한다.
    const afterDialpad = await page.evaluate(() => getComputedStyle(document.querySelector('.dialpad')).transform !== 'none');
    assert.strictEqual(afterBoard, true, 'board transformed after swap(true)');
    assert.strictEqual(afterDialpad, true, '.dialpad container transformed after swap(true)');

    await page.evaluate(() => window.__debugSwapBoardPositions(false));
    await new Promise((r) => setTimeout(r, 700));
    const reverted = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(reverted, 'none', 'board back to no transform after swap(false)');

    console.log('verify-fever-swap.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

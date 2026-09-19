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

    // #mole-board 자신은 절대 안 옮긴다(배경이미지+transform 안드로이드 흰화면 버그 회피) —
    // 배경이미지 없는 #fever-board-wrap 껍데기만 옮긴다.
    const before = await page.evaluate(() => getComputedStyle(document.getElementById('fever-board-wrap')).transform);
    assert.strictEqual(before, 'none', 'board wrap not transformed before swap');
    const boardNeverTransforms1 = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(boardNeverTransforms1, 'none', 'mole-board itself never gets a transform');

    await page.evaluate(() => window.__debugSwapBoardPositions(true));
    await new Promise((r) => setTimeout(r, 700));
    const afterWrap = await page.evaluate(() => getComputedStyle(document.getElementById('fever-board-wrap')).transform !== 'none');
    // .dialpad(컨테이너)를 옮긴다 — #lane-button-bar 를 직접 옮기면 .dialpad 의
    // contain:paint 에 밖으로 나간 부분이 잘려서(실기기 화면녹화로 확인된 실제 버그) 안
    // 보였다. 그래서 여기서는 .dialpad 쪽 transform 을 확인한다.
    const afterDialpad = await page.evaluate(() => getComputedStyle(document.querySelector('.dialpad')).transform !== 'none');
    assert.strictEqual(afterWrap, true, 'board wrap transformed after swap(true)');
    assert.strictEqual(afterDialpad, true, '.dialpad container transformed after swap(true)');
    const boardNeverTransforms2 = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(boardNeverTransforms2, 'none', 'mole-board itself still has no transform even while wrap is swapped');

    await page.evaluate(() => window.__debugSwapBoardPositions(false));
    await new Promise((r) => setTimeout(r, 700));
    const reverted = await page.evaluate(() => getComputedStyle(document.getElementById('fever-board-wrap')).transform);
    assert.strictEqual(reverted, 'none', 'board wrap back to no transform after swap(false)');

    console.log('verify-fever-swap.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

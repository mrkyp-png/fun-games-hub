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

    // #mole-board(배경이미지 있음)는 transform 대신 top 으로 옮긴다(안드로이드 흰화면 버그
    // 회피) — transform 은 절대 걸리면 안 된다.
    const boardNeverTransforms1 = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(boardNeverTransforms1, 'none', 'mole-board itself never gets a transform');
    const topBefore = await page.evaluate(() => document.getElementById('mole-board').style.top);
    assert.strictEqual(topBefore, '', 'board top not set before swap');

    await page.evaluate(() => window.__debugSwapBoardPositions(true));
    await new Promise((r) => setTimeout(r, 700));
    const topAfter = await page.evaluate(() => document.getElementById('mole-board').style.top);
    assert.notStrictEqual(topAfter, '', 'board top set after swap(true)');
    // .dialpad(컨테이너)를 옮긴다 — #lane-button-bar 를 직접 옮기면 .dialpad 의
    // contain:paint 에 밖으로 나간 부분이 잘려서(실기기 화면녹화로 확인된 실제 버그) 안
    // 보였다. 그래서 여기서는 .dialpad 쪽 transform 을 확인한다.
    const afterDialpad = await page.evaluate(() => getComputedStyle(document.querySelector('.dialpad')).transform !== 'none');
    assert.strictEqual(afterDialpad, true, '.dialpad container transformed after swap(true)');
    const boardNeverTransforms2 = await page.evaluate(() => getComputedStyle(document.getElementById('mole-board')).transform);
    assert.strictEqual(boardNeverTransforms2, 'none', 'mole-board itself still has no transform even while top-swapped');

    await page.evaluate(() => window.__debugSwapBoardPositions(false));
    await new Promise((r) => setTimeout(r, 700));
    const topReverted = await page.evaluate(() => document.getElementById('mole-board').style.top);
    assert.strictEqual(topReverted, '0px', 'board top back to 0 after swap(false)');

    console.log('verify-fever-swap.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

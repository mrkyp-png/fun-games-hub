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

    const before = await page.evaluate(() => document.getElementById('fever-scoreboard').hidden);
    assert.strictEqual(before, true, 'scoreboard hidden by default');

    await page.evaluate(() => window.__debugSpinBoardBlank(true));
    await new Promise((r) => setTimeout(r, 3800)); // 회전 7s의 절반(3.5s) 시점에 얼굴 전환
    const after = await page.evaluate(() => document.getElementById('fever-scoreboard').hidden);
    assert.strictEqual(after, false, 'scoreboard shown after spinBoardBlank(true)');

    const buttonHidden = await page.evaluate(() => {
      const b = document.querySelector('#lane-button-bar .lane-button');
      return b ? getComputedStyle(b).visibility : 'no-button-found';
    });
    assert.strictEqual(buttonHidden, 'hidden', 'digit buttons hidden while scoreboard shown');

    await page.evaluate(() => window.__debugSetFeverScoreboard(123, 7.4));
    const combo = await page.evaluate(() => document.getElementById('fever-sb-combo').textContent);
    const time = await page.evaluate(() => document.getElementById('fever-sb-time').textContent);
    assert.strictEqual(combo, '123', 'combo number rendered');
    assert.strictEqual(time, '8', 'time rounds up');

    await page.evaluate(() => window.__debugSpinBoardBlank(false));
    await new Promise((r) => setTimeout(r, 3800));
    const afterRestore = await page.evaluate(() => document.getElementById('fever-scoreboard').hidden);
    assert.strictEqual(afterRestore, true, 'scoreboard hidden again after spinBoardBlank(false)');

    console.log('verify-fever-scoreboard.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

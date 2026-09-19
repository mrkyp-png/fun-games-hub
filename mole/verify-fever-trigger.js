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
    await page.evaluate(() => localStorage.clear());

    // 라운드2 시작 후 콤보를 100까지 강제 주입 — checkComboLifeBonus() 를 통해
    // checkFeverEventTrigger() 도 같이 호출된다(game.js 수정 참고).
    const before = await page.evaluate(() => window.__debugGetFeverState());
    assert.strictEqual(before, null, 'fever state null before any round started');

    await page.evaluate(() => window.__debugStartGame('easy', 2));
    await new Promise((r) => setTimeout(r, 500));

    const afterPump = await page.evaluate(() => {
      window.__debugPumpCombo(100);
      return window.__debugGetFeverState();
    });
    assert.strictEqual(afterPump.active, true, 'fever event active after combo 100 on round 2');
    assert.strictEqual(afterPump.paused, true, 'round timer paused during fever');

    const timeBefore = afterPump.timeRemaining;
    await new Promise((r) => setTimeout(r, 800));
    const afterWait = await page.evaluate(() => window.__debugGetFeverState());
    assert.strictEqual(afterWait.timeRemaining, timeBefore, 'timeRemaining frozen while pausedByFever');

    console.log('verify-fever-trigger.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

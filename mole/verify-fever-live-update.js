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
    for (let i = 0; i < 40; i++) {
      const introActive = await page.evaluate(() => window.__debugIntroActive());
      if (!introActive) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    await page.evaluate(() => window.__debugPumpCombo(100));
    // 진입 연출(퇴장정리 0.65s + 회전 5s + 스왑 5s ≈ 10.65s)이 끝나야 20초 카운트다운이
    // 실제로 시작된다.
    await new Promise((r) => setTimeout(r, 11200));

    const feverState = await page.evaluate(() => window.__debugGetFeverState());
    assert.strictEqual(feverState.active, true, 'fever active after combo 100');

    const comboText = await page.evaluate(() => document.getElementById('fever-sb-combo').textContent);
    const timeText = await page.evaluate(() => document.getElementById('fever-sb-time').textContent);
    assert.strictEqual(comboText, '100', 'scoreboard combo shows current combo (100)');
    const timeNum = Number(timeText);
    assert.ok(timeNum >= 18 && timeNum <= 20, `scoreboard countdown near 20s (got ${timeText})`);

    console.log('verify-fever-live-update.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

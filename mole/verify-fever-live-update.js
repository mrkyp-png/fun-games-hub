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
    // 메인루프(rAF)가 몇 프레임 돌면서 updateHUD()가 자연히 전광판을 갱신해야 한다.
    await new Promise((r) => setTimeout(r, 300));

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

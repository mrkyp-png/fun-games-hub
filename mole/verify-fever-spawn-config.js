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

    const before = await page.evaluate(() => window.__debugGetConfig());
    assert.strictEqual(before.multiHit, true, 'round2 normally allows multiHit');

    await page.evaluate(() => window.__debugPumpCombo(100));
    await new Promise((r) => setTimeout(r, 300)); // 다음 rAF 프레임에서 오버라이드 적용

    const during = await page.evaluate(() => window.__debugGetConfig());
    assert.strictEqual(during.multiHit, false, 'multiHit forced off during fever event');
    assert.strictEqual(during.maxConcurrentMoles, 8, 'up to 8 concurrent moles during fever event');

    console.log('verify-fever-spawn-config.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

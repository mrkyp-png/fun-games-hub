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

    // 전환(14초) 동안엔 스폰 자체가 완전히 멈춰야 한다(사용자 지정: "전환타임에는
    // 두더지가 안나오는거야").
    const duringTransition = await page.evaluate(() => window.__debugGetConfig());
    assert.strictEqual(duringTransition.maxConcurrentMoles, 0, 'no mole spawns during the 14s transition');
    assert.strictEqual(duringTransition.maxConcurrentAnimals, 0, 'no animal spawns during the 14s transition');

    // 전환이 끝나 터치캐치가 시작되면 전신(1타) 두더지 최대 8마리 동시출현으로 전환.
    await new Promise((r) => setTimeout(r, 16300));
    const during = await page.evaluate(() => window.__debugGetConfig());
    assert.strictEqual(during.multiHit, false, 'multiHit forced off once touch-catch begins');
    assert.strictEqual(during.maxConcurrentMoles, 8, 'up to 8 concurrent moles once touch-catch begins');

    console.log('verify-fever-spawn-config.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

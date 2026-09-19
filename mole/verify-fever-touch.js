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
    // handleCell()은 state.introActive 동안 전부 무시하므로, Ready→GO! 카운트다운이
    // 끝날 때까지 기다린다.
    for (let i = 0; i < 40; i++) {
      const introActive = await page.evaluate(() => window.__debugIntroActive());
      if (!introActive) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    // 좌표 역산 단위 검증 — 4x4 그리드에서 regionId0(col0,row0) 중심은 (0.125, 0.27).
    const region = await page.evaluate(() => window.__debugRegionFromPoint(0.125, 0.27));
    assert.strictEqual(region, 0, 'top-left board point maps to regionId 0');

    // regionId0에 1타 두더지(poseIndex 사용 안 함 — hitsRequired 는 스케줄러가 랜덤 결정하므로
    // hitsTaken 증가 여부로 "명중 처리됐는지"를 판정한다, dying 은 다타 두더지면 1타로 안 바뀜).
    await page.evaluate(() => window.__debugForceMole(0, 0));
    const popsBefore = await page.evaluate(() => window.__debugGetActivePops());
    const before0 = popsBefore.find((p) => p.regionId === 0);
    assert.ok(before0, 'mole present at regionId 0 before touch');
    assert.strictEqual(before0.hitsTaken, 0, 'mole at regionId 0 has 0 hits before any touch');

    // 피버 비활성 상태에서 보드 터치 → 무시(hitsTaken 그대로).
    await page.evaluate(() => window.__debugSetFeverActive(false));
    await page.evaluate(() => {
      const el = document.getElementById('mole-board');
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.125, clientY: r.top + r.height * 0.27, bubbles: true
      }));
    });
    const popsAfterInactive = await page.evaluate(() => window.__debugGetActivePops());
    const afterInactive0 = popsAfterInactive.find((p) => p.regionId === 0);
    assert.strictEqual(afterInactive0.hitsTaken, 0, 'touch ignored when fever not active (hitsTaken unchanged)');

    // 피버 활성 상태에서 같은 위치 터치 → handleCell 경유로 명중 처리(hitsTaken 증가).
    await page.evaluate(() => window.__debugSetFeverActive(true));
    await page.evaluate(() => {
      const el = document.getElementById('mole-board');
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.125, clientY: r.top + r.height * 0.27, bubbles: true
      }));
    });
    const popsAfterActive = await page.evaluate(() => window.__debugGetActivePops());
    const afterActive0 = popsAfterActive.find((p) => p.regionId === 0);
    assert.ok(!afterActive0 || afterActive0.hitsTaken > 0, 'touch during fever registers a hit at regionId 0');

    console.log('verify-fever-touch.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

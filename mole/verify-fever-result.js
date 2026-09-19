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

    const before = await page.evaluate(() => document.getElementById('fever-result-overlay').hidden);
    assert.strictEqual(before, true, 'result overlay hidden by default');

    // 20초/10초 실제 대기 없이 결과창 표시 로직만 직접 확인.
    await page.evaluate(() => { window.__debugSetFeverActive(true); window.__debugShowFeverResult(); });
    const shown = await page.evaluate(() => document.getElementById('fever-result-overlay').hidden);
    assert.strictEqual(shown, false, 'result overlay shown after showFeverResult()');

    // 결과창이 떠 있는 동안엔 보드 터치가 무시돼야 한다(사용자 지정: "점수확인하고 해야하니").
    await page.evaluate(() => window.__debugForceMole(0, 0));
    const popsBefore = await page.evaluate(() => window.__debugGetActivePops());
    const hitsBefore = popsBefore.find((p) => p.regionId === 0).hitsTaken;
    await page.evaluate(() => {
      const el = document.getElementById('mole-board');
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.125, clientY: r.top + r.height * 0.27, bubbles: true
      }));
    });
    const popsAfter = await page.evaluate(() => window.__debugGetActivePops());
    const afterPop = popsAfter.find((p) => p.regionId === 0);
    assert.strictEqual(afterPop ? afterPop.hitsTaken : hitsBefore, hitsBefore, 'board touch ignored while result overlay shown');

    // "게임복귀" 버튼 클릭 → 결과창은 바로 닫히지만, 복귀 연출(스왑+역회전, 14초)이 완전히
    // 끝나기 전까지는 게임이 재개되면 안 된다(사용자 지정: "버튼보드 회전이 종료되면,
    // 진행되던 게임이 진행되어야함").
    await page.evaluate(() => document.getElementById('fever-result-btn').click());
    const rightAfterClick = await page.evaluate(() => ({
      overlayHidden: document.getElementById('fever-result-overlay').hidden,
      fever: window.__debugGetFeverState()
    }));
    assert.strictEqual(rightAfterClick.overlayHidden, true, 'result overlay hidden right after clicking 게임복귀');
    assert.strictEqual(rightAfterClick.fever.paused, true, 'pausedByFever still true while exit animation plays');

    await new Promise((r) => setTimeout(r, 14300)); // 스왑(7s) + 역회전(7s)
    const afterAnim = await page.evaluate(() => window.__debugGetFeverState());
    assert.strictEqual(afterAnim.active, false, 'feverEventActive false once exit animation fully ends');
    assert.strictEqual(afterAnim.paused, false, 'pausedByFever false once exit animation fully ends (timer resumes)');

    console.log('verify-fever-result.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

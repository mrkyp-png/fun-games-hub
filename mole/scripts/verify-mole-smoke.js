// 두더지 게임 통합 스모크 테스트 — snake/scripts/verify-snake-smoke.js와 동일 패턴
// (디버그 훅으로 실제 UI 흐름을 헤드리스로 재현). scripts/serve.js가 8845 포트에 떠 있어야 한다.
// 8845를 쓰는 이유: scripts/serve.js의 기본 포트는 8844이지만, 이 게임을 개발하는 동안
// 8844는 무관한 외부 서버가 이미 점유하고 있어 충돌을 피하려고 이 테스트만 8845를 하드코딩함.
// 실행 전에 반드시 `PORT=8845 node scripts/serve.js`로 별도 서버를 띄워둘 것 —
// 안 띄우면 ECONNREFUSED로 실패한다.
const puppeteer = require('puppeteer-core');
const assert = require('assert');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto('http://localhost:8845/mole/index.html', { waitUntil: 'load' });

    // 1) 레벨 선택 화면에 10개 카드가 뜨고, Level 1만 해금 상태인가
    const levelCardCount = await page.evaluate(() => document.querySelectorAll('.level-card').length);
    assert.strictEqual(levelCardCount, 10, 'level select must show exactly 10 cards');
    const lvl1Locked = await page.evaluate(() => document.querySelector('.level-card').dataset.locked);
    assert.strictEqual(lvl1Locked, 'false', 'Level 1 must be unlocked by default');

    // 2) Level 1 진입 → HUD/보드가 렌더되는가
    await page.evaluate(() => window.__debugStartLevel(1));
    await new Promise((r) => setTimeout(r, 500)); // 마스크 추출(비동기) + 첫 프레임 대기
    const afterStart = await page.evaluate(() => ({
      gameScreenHidden: document.getElementById('game-screen').hidden,
      hudLevel: document.getElementById('hud-level').textContent,
      hudRegionCount: document.getElementById('hud-region-count').textContent
    }));
    assert.strictEqual(afterStart.gameScreenHidden, false, 'game screen must become visible');
    assert.strictEqual(afterStart.hudLevel, 'Level 1', 'HUD must show the current level');
    assert.strictEqual(afterStart.hudRegionCount, '0 / 9', 'HUD must show initial region progress (Level 1 = 9 regions)');

    // 3) 두더지가 실제로 화면에 나타나는가 (최대 3초 대기)
    let sawPop = false;
    for (let i = 0; i < 30 && !sawPop; i++) {
      await new Promise((r) => setTimeout(r, 100));
      sawPop = await page.evaluate(() => document.querySelectorAll('.mole-pop').length > 0);
    }
    assert.ok(sawPop, 'at least one mole/animal/bomb pop must appear within 3 seconds');

    // 4) 모든 영역 강제 완성 → 클리어 오버레이 등장 + localStorage 진행 저장
    // §14: 반짝임 연출(0.6s) 후에 오버레이가 뜨도록 game.js가 ~650ms 지연시키므로 그만큼 대기.
    await page.evaluate(() => window.__debugClearAllRegions());
    await new Promise((r) => setTimeout(r, 800));
    const afterClear = await page.evaluate(() => ({
      clearOverlayHidden: document.getElementById('clear-overlay').hidden,
      progress: JSON.parse(localStorage.getItem('moleGameProgress') || '{}')
    }));
    assert.strictEqual(afterClear.clearOverlayHidden, false, 'clear overlay must show after all regions complete');
    assert.ok(afterClear.progress['1'] && afterClear.progress['1'].cleared, 'level 1 must be marked cleared in localStorage');
    assert.ok(afterClear.progress['1'].stars >= 1, 'a cleared level must have at least 1 star');

    // 5) 레벨 선택으로 복귀 → Level 2가 해금됐는가
    await page.click('#clear-select-btn');
    await new Promise((r) => setTimeout(r, 200));
    const lvl2Locked = await page.evaluate(() => document.querySelectorAll('.level-card')[1].dataset.locked);
    assert.strictEqual(lvl2Locked, 'false', 'Level 2 must unlock after clearing Level 1');

    // 6) GAME OVER 경로 — 목숨 0 → 오버레이 표시
    await page.evaluate(() => window.__debugStartLevel(2));
    await new Promise((r) => setTimeout(r, 500));
    await page.evaluate(() => window.__debugForceGameOver());
    await new Promise((r) => setTimeout(r, 200));
    const afterGameOver = await page.evaluate(() => ({
      overlayHidden: document.getElementById('gameover-overlay').hidden,
      levelText: document.getElementById('gameover-level').textContent,
      reasonText: document.getElementById('gameover-reason').textContent
    }));
    assert.strictEqual(afterGameOver.overlayHidden, false, 'game over overlay must show when lives reach 0');
    assert.strictEqual(afterGameOver.levelText, 'Level 2', 'game over overlay must show the current level');
    assert.strictEqual(afterGameOver.reasonText, '목숨 소진', 'game over overlay must show the reason text for the lives-exhausted case');

    console.log('verify-mole-smoke.js: all assertions passed');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

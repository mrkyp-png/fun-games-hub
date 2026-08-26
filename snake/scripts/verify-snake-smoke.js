// 지렁이 게임 통합 스모크 테스트 — 색칠앱 verify-full-clear.js와 같은 패턴(디버그 훅으로
// 실제 UI 흐름을 헤드리스로 재현). fun-games-hub/scripts/serve.js가 8844 포트에 떠 있어야 한다.
const puppeteer = require('puppeteer-core');
const path = require('path');
const assert = require('assert');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780 });
  await page.goto('http://localhost:8844/snake/index.html', { waitUntil: 'load' });

  // 1) 레벨 선택 화면에 10개 카드가 뜨고, Level 1만 해금 상태인가
  const levelCardCount = await page.evaluate(() => document.querySelectorAll('.level-card').length);
  assert.strictEqual(levelCardCount, 10, 'level select must show exactly 10 cards');
  const lvl1Locked = await page.evaluate(() => document.querySelector('.level-card').dataset.locked);
  assert.strictEqual(lvl1Locked, 'false', 'Level 1 must be unlocked by default');

  // 2) Level 1 진입 → HUD/미니맵/emoji-progress가 렌더되는가
  await page.evaluate(() => window.__debugStartLevel(1));
  await new Promise((r) => setTimeout(r, 300)); // 첫 프레임 렌더 대기
  const afterStart = await page.evaluate(() => ({
    gameScreenHidden: document.getElementById('game-screen').hidden,
    hudLevel: document.getElementById('hud-level').textContent,
    hudFood: document.getElementById('hud-food-count').textContent,
    minimapHasPixels: (() => {
      const c = document.getElementById('minimap-canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return data.some((v, i) => i % 4 !== 3 && v !== 0); // alpha 채널 제외하고 0 아닌 픽셀 존재
    })()
  }));
  assert.strictEqual(afterStart.gameScreenHidden, false, 'game screen must become visible');
  assert.strictEqual(afterStart.hudLevel, 'Level 1', 'HUD must show the current level');
  assert.strictEqual(afterStart.hudFood, '0 / 20', 'HUD must show initial food progress');
  assert.ok(afterStart.minimapHasPixels, 'minimap canvas must have drawn something');

  // 3) 먹이 20개를 전부 흡수 → 클리어 오버레이 등장 + emoji 10칸 전부 revealed + localStorage 진행 저장
  await page.evaluate(() => window.__debugCollectAllFood());
  await new Promise((r) => setTimeout(r, 300));
  const afterClear = await page.evaluate(() => ({
    clearOverlayHidden: document.getElementById('clear-overlay').hidden,
    revealedCells: document.querySelectorAll('#emoji-progress-grid .cover-cell.revealed').length,
    progress: JSON.parse(localStorage.getItem('snakeGameProgress') || '{}')
  }));
  assert.strictEqual(afterClear.clearOverlayHidden, false, 'clear overlay must show after collecting all food');
  assert.strictEqual(afterClear.revealedCells, 10, 'all 10 emoji regions must be revealed on clear');
  assert.ok(afterClear.progress['1'] && afterClear.progress['1'].cleared, 'level 1 must be marked cleared in localStorage');
  assert.ok(afterClear.progress['1'].stars >= 1, 'a cleared level must have at least 1 star');

  // 4) 레벨 선택으로 복귀 → Level 2가 해금됐는가
  await page.click('#clear-select-btn');
  await new Promise((r) => setTimeout(r, 200));
  const lvl2Locked = await page.evaluate(() =>
    document.querySelectorAll('.level-card')[1].dataset.locked
  );
  assert.strictEqual(lvl2Locked, 'false', 'Level 2 must unlock after clearing Level 1');

  // 5) GAME OVER 경로 — 생명 0 → 오버레이 표시 + 필수 항목(Level/먹이 수) 노출
  await page.evaluate(() => window.__debugStartLevel(1));
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => window.__debugForceGameOver());
  await new Promise((r) => setTimeout(r, 200));
  const afterGameOver = await page.evaluate(() => ({
    overlayHidden: document.getElementById('gameover-overlay').hidden,
    levelText: document.getElementById('gameover-level').textContent,
    foodText: document.getElementById('gameover-food-count').textContent
  }));
  assert.strictEqual(afterGameOver.overlayHidden, false, 'gameover overlay must show when hearts reach 0');
  assert.strictEqual(afterGameOver.levelText, 'Level 1', 'gameover overlay must show the current level (spec §24)');
  assert.ok(/^먹이 \d+ \/ 20$/.test(afterGameOver.foodText), 'gameover overlay must show food collected count (spec §24)');

  console.log('verify-snake-smoke.js: all checks passed');
  await browser.close();
})().catch((e) => {
  console.error('SMOKE TEST FAILED:', e.message);
  process.exit(1);
});

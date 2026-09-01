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

    // 라운드 시작마다 "라운드 N / 3·2·1·시작!" 카운트다운이 재생된다 — 끝날 때까지 대기.
    async function waitIntroDone() {
      for (let i = 0; i < 60; i++) {
        if (!(await page.evaluate(() => window.__debugIntroActive()))) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('round intro never finished');
    }

    // 1) 라운드 선택 화면에 10개 카드가 뜨고, 라운드 1만 해금 상태인가
    const levelCardCount = await page.evaluate(() => document.querySelectorAll('.level-card').length);
    assert.strictEqual(levelCardCount, 10, 'round select must show exactly 10 cards');
    const lvl1Locked = await page.evaluate(() => document.querySelector('.level-card').dataset.locked);
    assert.strictEqual(lvl1Locked, 'false', 'Round 1 must be unlocked by default');

    // 2) 라운드 1 진입 → 카운트다운 → HUD/보드가 렌더되는가
    await page.evaluate(() => window.__debugStartLevel(1));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300)); // 마스크 추출(비동기) + 첫 프레임 대기
    const afterStart = await page.evaluate(() => ({
      gameScreenHidden: document.getElementById('game-screen').hidden,
      hudLevel: document.getElementById('hud-level').textContent,
      hudRegionCount: document.getElementById('hud-region-count').textContent
    }));
    assert.strictEqual(afterStart.gameScreenHidden, false, 'game screen must become visible');
    assert.strictEqual(afterStart.hudLevel, '라운드 1', 'HUD must show the current round');
    assert.strictEqual(afterStart.hudRegionCount, '0 / 16', 'HUD must show initial region progress (fixed 4x4 grid = 16 cells)');

    // 3) 두더지가 실제로 화면에 나타나는가 (최대 3초 대기)
    let sawPop = false;
    for (let i = 0; i < 30 && !sawPop; i++) {
      await new Promise((r) => setTimeout(r, 100));
      sawPop = await page.evaluate(() => document.querySelectorAll('.mole-pop').length > 0);
    }
    assert.ok(sawPop, 'at least one mole/animal/bomb pop must appear within 3 seconds');

    // 3b) 구멍이 모든 출현 지점에 상시 배치돼 있는가
    const holeCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-layer .mole-hole').length);
    assert.strictEqual(holeCount, 16, 'a fixed 4x4 grid of 16 holes is placed from the start');
    const holeFrontCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-front-layer .mole-hole-front').length);
    assert.strictEqual(holeFrontCount, 16, 'a matching front-rim overlay is placed above the pop layer for every hole');

    // 3c) 두더지가 이모지 글리프가 아니라 실제 스프라이트 이미지로 렌더되는가 (□ 회귀 방지).
    //     두더지가 한 마리 이상 뜰 때까지 최대 3초 더 기다렸다가 확인.
    let moleImg = null;
    for (let i = 0; i < 30 && !moleImg; i++) {
      await new Promise((r) => setTimeout(r, 100));
      moleImg = await page.evaluate(() => {
        const img = document.querySelector('.mole-pop--mole .mole-pop-img');
        return img ? { src: img.getAttribute('src'), visible: img.style.visibility !== 'hidden' } : null;
      });
    }
    assert.ok(moleImg, 'a mole must render as <img class="mole-pop-img">');
    assert.ok(/assets\/moles\/.+\.png$/.test(moleImg.src), `mole image src must point at a sprite (got ${moleImg.src})`);

    // 3d) 구멍 버튼 16개가 렌더된다 (기획서 v1.5 — 4x4 패드)
    const laneButtonCount = await page.evaluate(() => document.querySelectorAll('#lane-button-bar .lane-button').length);
    assert.strictEqual(laneButtonCount, 16, 'exactly 16 hole buttons render (4x4)');

    // 3e) 두더지를 직접 터치해도 아무 일이 없다 (회귀 방지)
    const beforeDirect = await page.evaluate(() => document.getElementById('hud-region-count').textContent);
    await page.evaluate(() => {
      const el = document.querySelector('.mole-pop--mole');
      if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    const afterDirect = await page.evaluate(() => document.getElementById('hud-region-count').textContent);
    assert.strictEqual(afterDirect, beforeDirect, 'tapping a mole directly must do nothing');

    // 헬퍼: 살아있는(dying 아님) 두더지의 regionId 를 알아낸다. left/top % 로 col/row 계산.
    const liveMoleRegion = () => page.evaluate(() => {
      for (const el of document.querySelectorAll('.mole-pop--mole')) {
        const img = el.querySelector('.mole-pop-img');
        const ty = img ? new DOMMatrix(getComputedStyle(img).transform).m42 : 0;
        if (Math.abs(ty) < 8 && img && img.style.visibility !== 'hidden') {
          const col = Math.round(parseFloat(el.style.left) / 100 * 4 - 0.5);
          const holeY = parseFloat(el.style.top) / 100;
          // top% 는 spawnPoint.y = 0.27 + row*vStep, vStep = (0.88-0.27)/3
          const row = Math.round((holeY - 0.27) / ((0.88 - 0.27) / 3));
          return Math.max(0, Math.min(15, row * 4 + col));
        }
      }
      return null;
    });
    const regionCount = () => page.evaluate(() =>
      +document.getElementById('hud-region-count').textContent.split('/')[0]);

    // 3f) 두더지가 뜬 구멍의 버튼을 누르면 그 영역이 완성된다 + 망치가 움직인다
    let hitOk = false;
    let sawHammerMove = false;
    for (let i = 0; i < 60 && !hitOk; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const region = await liveMoleRegion();
      if (region === null) continue;
      const before = await regionCount();
      const left0 = await page.evaluate(() => {
        const h = document.querySelector('.lane-hammer');
        return h ? h.style.left : null;
      });
      await page.evaluate((id) => {
        document.querySelector(`#lane-button-bar .lane-button[data-region="${id}"]`)
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      }, region);
      await new Promise((r) => setTimeout(r, 120));
      const left1 = await page.evaluate(() => {
        const h = document.querySelector('.lane-hammer');
        return h ? h.style.left : null;
      });
      if (left1 && left1 !== left0) sawHammerMove = true;
      await new Promise((r) => setTimeout(r, 400));
      if ((await regionCount()) > before) hitOk = true;
    }
    assert.ok(hitOk, 'pressing the hole button of a live mole completes its region');
    assert.ok(sawHammerMove, 'the hammer moves toward the pressed hole');

    // 3g) 키보드 격자(1234/qwer/asdf/zxcv)로도 구멍을 칠 수 있다
    await page.evaluate(() => window.__debugStartLevel(1));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    const KEYS = '1234qwerasdfzxcv';
    let kbOk = false;
    for (let i = 0; i < 60 && !kbOk; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const region = await liveMoleRegion();
      if (region === null) continue;
      const before = await regionCount();
      await page.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), KEYS[region]);
      await new Promise((r) => setTimeout(r, 450));
      if ((await regionCount()) > before) kbOk = true;
    }
    assert.ok(kbOk, 'keyboard 1-4 completes a region');

    // 4) 모든 영역 강제 완성 → 성공 오버레이 등장 + localStorage 진행 저장.
    // §14: 반짝임 연출(0.6s) 후에 오버레이가 뜨도록 game.js가 ~650ms 지연시키므로 그만큼 대기.
    await page.evaluate(() => window.__debugClearAllRegions());
    await new Promise((r) => setTimeout(r, 800));
    const afterClear = await page.evaluate(() => ({
      clearOverlayHidden: document.getElementById('clear-overlay').hidden,
      finalActionsHidden: document.getElementById('clear-final-actions').hidden,
      progress: JSON.parse(localStorage.getItem('moleGameProgress') || '{}')
    }));
    assert.strictEqual(afterClear.clearOverlayHidden, false, 'clear overlay must show after all regions complete');
    assert.strictEqual(afterClear.finalActionsHidden, true, 'round 1 (not the last) must NOT show manual buttons — it auto-advances');
    assert.ok(afterClear.progress['1'] && afterClear.progress['1'].cleared, 'round 1 must be marked cleared in localStorage');
    assert.ok(afterClear.progress['1'].stars >= 1, 'a cleared round must have at least 1 star');

    // 5) 라운드 1이 마지막이 아니므로 자동으로 라운드 2로 진행된다 (오버레이 자동 닫힘 + 카운트다운 + 시작)
    await new Promise((r) => setTimeout(r, 1400)); // 자동진행 지연(1.2s)
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    const afterAutoAdvance = await page.evaluate(() => ({
      clearOverlayHidden: document.getElementById('clear-overlay').hidden,
      gameScreenHidden: document.getElementById('game-screen').hidden,
      hudLevel: document.getElementById('hud-level').textContent
    }));
    assert.strictEqual(afterAutoAdvance.clearOverlayHidden, true, 'clear overlay must auto-close');
    assert.strictEqual(afterAutoAdvance.gameScreenHidden, false, 'game screen stays visible through the auto-advance');
    assert.strictEqual(afterAutoAdvance.hudLevel, '라운드 2', 'must have auto-advanced into round 2 without any button click');

    // 5b) 뒤로가기로 라운드 선택 복귀 → 라운드 2가 해금됐는가
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 200));
    const lvl2Locked = await page.evaluate(() => document.querySelectorAll('.level-card')[1].dataset.locked);
    assert.strictEqual(lvl2Locked, 'false', 'Round 2 must unlock after clearing Round 1');

    // 6) 실패 경로 — 목숨 0 → 오버레이 표시
    await page.evaluate(() => window.__debugStartLevel(2));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => window.__debugForceGameOver());
    await new Promise((r) => setTimeout(r, 200));
    const afterGameOver = await page.evaluate(() => ({
      overlayHidden: document.getElementById('gameover-overlay').hidden,
      levelText: document.getElementById('gameover-level').textContent,
      reasonText: document.getElementById('gameover-reason').textContent
    }));
    assert.strictEqual(afterGameOver.overlayHidden, false, 'game over overlay must show when lives reach 0');
    assert.strictEqual(afterGameOver.levelText, '라운드 2', 'game over overlay must show the current round');
    assert.strictEqual(afterGameOver.reasonText, '목숨 소진', 'game over overlay must show the reason text for the lives-exhausted case');

    console.log('verify-mole-smoke.js: all assertions passed');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

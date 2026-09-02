// 두더지 게임 통합 스모크 — 디버그 훅으로 실제 UI 흐름을 헤드리스로 재현.
// 실행 전 repo 루트에서 `SMOKE_PORT=8846 node scripts/serve.js` 로 서버를 띄워둘 것.
// (사용자의 미리보기 서버가 8844/8845 를 쓰므로 이 테스트만 8846 을 기본으로 함.)
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

// 128x128 빨강 PNG (테스트용 사진)
const FACE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAOklEQVR4nO3BAQ0AAADCoPdPbQ8H' +
  'FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwGxNwAAF3nQ3EAAAAAElFTkSuQmCC';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/mole/index.html`, { waitUntil: 'load' });

    async function waitIntroDone() {
      for (let i = 0; i < 60; i++) {
        if (!(await page.evaluate(() => window.__debugIntroActive()))) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('round intro never finished');
    }
    const score = () => page.evaluate(() =>
      parseInt(document.getElementById('hud-score').textContent.replace(/[^0-9]/g, ''), 10) || 0);
    const liveMoleRegion = () => page.evaluate(() => window.__debugHittableMoleRegion());

    // 테스트용 얼굴 하나 만들고 온보딩 스킵
    async function seedFace() {
      await page.evaluate(() => window.__debugSkipOnboarding());
      await page.evaluate(() => window.__debugAddFace());
      await page.waitForFunction(() => !!window.MoleGame.FaceStore.getActiveId(), { timeout: 4000 });
    }

    // 1) 부팅: 홈 화면 컨테이너 존재, 다이얼러 16버튼
    assert.ok(await page.$('#home-screen'), '#home-screen exists');
    const laneButtonCount = await page.evaluate(() => document.querySelectorAll('#lane-button-bar .lane-button').length);
    assert.strictEqual(laneButtonCount, 16, 'exactly 16 hole buttons (4x4)');

    // 2) __debugStartGame → 카운트다운 → 플레이
    await seedFace();
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    const afterStart = await page.evaluate(() => ({
      isStart: document.getElementById('game-screen').classList.contains('is-start'),
      diffEasy: document.getElementById('game-screen').classList.contains('diff-easy'),
      boardStartHidden: document.getElementById('board-start').hidden
    }));
    assert.strictEqual(afterStart.isStart, false, 'is-start removed during play');
    assert.strictEqual(afterStart.diffEasy, true, 'diff-easy class applied');
    assert.strictEqual(afterStart.boardStartHidden, true, 'board-start hidden during play');
    assert.strictEqual(await score(), 0, 'score starts at 0');

    // 3) 두더지 스프라이트 + 구멍 + 얼굴 레이어
    let moleImg = null;
    for (let i = 0; i < 30 && !moleImg; i++) {
      await new Promise((r) => setTimeout(r, 100));
      moleImg = await page.evaluate(() => {
        const img = document.querySelector('.mole-pop--mole .mole-pop-img');
        return img ? img.getAttribute('src') : null;
      });
    }
    assert.ok(moleImg && /assets\/moles\/.+\.png$/.test(moleImg), `mole renders as sprite <img> (got ${moleImg})`);
    const holeCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-layer .mole-hole').length);
    assert.strictEqual(holeCount, 16, '16 holes');
    const frontCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-front-layer .mole-hole-front').length);
    assert.strictEqual(frontCount, 16, '16 front rims');
    const hasFace = await page.evaluate(() => !!document.querySelector('.mole-pop--mole .mole-face'));
    assert.ok(hasFace, '활성 얼굴 있으면 두더지에 .mole-face 레이어');

    // 4) 직접 터치 무효
    const beforeDirect = await score();
    await page.evaluate(() => {
      const el = document.querySelector('.mole-pop--mole');
      if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await score(), beforeDirect, 'tapping a mole directly does nothing');

    // 5) 버튼 누르면 점수 오르고 망치가 움직인다
    let hitOk = false, sawHammerMove = false;
    for (let i = 0; i < 80 && !hitOk; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const region = await liveMoleRegion();
      if (region === null) continue;
      const before = await score();
      const left0 = await page.evaluate(() => { const h = document.querySelector('.lane-hammer'); return h ? h.style.left : null; });
      await page.evaluate((id) => document.querySelector(`#lane-button-bar .lane-button[data-region="${id}"]`)
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), region);
      await new Promise((r) => setTimeout(r, 120));
      const left1 = await page.evaluate(() => { const h = document.querySelector('.lane-hammer'); return h ? h.style.left : null; });
      if (left1 && left1 !== left0) sawHammerMove = true;
      await new Promise((r) => setTimeout(r, 400));
      if ((await score()) > before) hitOk = true;
    }
    assert.ok(hitOk, 'pressing a live mole button raises the score');
    assert.ok(sawHammerMove, 'the hammer moves toward the pressed hole');

    // 6) 키보드 격자
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    const KEYS = '1234qwerasdfzxcv';
    let kbOk = false;
    for (let i = 0; i < 80 && !kbOk; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const region = await liveMoleRegion();
      if (region === null) continue;
      const before = await score();
      await page.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k })), KEYS[region]);
      await new Promise((r) => setTimeout(r, 450));
      if ((await score()) > before) kbOk = true;
    }
    assert.ok(kbOk, 'keyboard grid raises the score');

    // 7) 라운드 종료 → 라운드 사이 안내 → 다음 라운드 (점수 누적)
    const scoreBeforeEnd = await score();
    await page.evaluate(() => window.__debugEndRound());
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => document.getElementById('round-done-overlay').hidden), false, 'round-done overlay shows');
    await new Promise((r) => setTimeout(r, 1500));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => document.querySelector('#hud-ticker .tk-lv').textContent), '라운드 2', 'auto-advanced into round 2');
    assert.ok((await score()) >= scoreBeforeEnd, 'cumulative score carried into round 2');

    // 8) 목숨 소진 → 최종 결과 + mole.best.easy 저장 + 코인 지급 시도
    await page.evaluate(() => { localStorage.setItem('mole.coins', '0'); localStorage.removeItem('mole.best.easy'); });
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    // 점수 좀 확보
    for (let i = 0; i < 20; i++) {
      const region = await liveMoleRegion();
      if (region !== null) await page.evaluate((id) => document.querySelector(`#lane-button-bar .lane-button[data-region="${id}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), region);
      await new Promise((r) => setTimeout(r, 120));
    }
    const finalScore = await score();
    await page.evaluate(() => window.__debugForceGameOver());
    await new Promise((r) => setTimeout(r, 300));
    const afterLives = await page.evaluate(() => ({
      overlayHidden: document.getElementById('gameover-overlay').hidden,
      reason: document.getElementById('gameover-reason').textContent,
      best: parseInt(localStorage.getItem('mole.best.easy'), 10)
    }));
    assert.strictEqual(afterLives.overlayHidden, false, 'result overlay shows when lives reach 0');
    assert.strictEqual(afterLives.reason, '목숨 소진!', 'result overlay states lives-exhausted');
    assert.strictEqual(afterLives.best, finalScore, 'total score persisted to mole.best.easy');

    // 9) 결과 → "나가기" → 홈 복귀
    await page.click('#gameover-select-btn');
    await new Promise((r) => setTimeout(r, 200));
    const backHome = await page.evaluate(() => ({
      boardStartHidden: document.getElementById('board-start').hidden,
      isStart: document.getElementById('game-screen').classList.contains('is-start'),
      homeShown: !document.getElementById('home-screen').hidden,
      overlayHidden: document.getElementById('gameover-overlay').hidden
    }));
    assert.strictEqual(backHome.boardStartHidden, false, 'leaving result shows the in-board panel');
    assert.strictEqual(backHome.isStart, true, 'is-start back on');
    assert.strictEqual(backHome.homeShown, true, 'home screen shown');
    assert.strictEqual(backHome.overlayHidden, true, 'result overlay dismissed');

    // 10) moleBestScore 마이그레이션
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('moleBestScore', '4321'); });
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    const migrated = await page.evaluate(() => localStorage.getItem('mole.best.easy'));
    assert.strictEqual(migrated, '4321', 'moleBestScore → mole.best.easy migration');

    // 11) BGM
    await page.evaluate(() => localStorage.setItem('musicOn', '1'));
    await seedFace();
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), false, 'bgm plays after start when musicOn=1');
    await page.evaluate(() => window.FGH.Settings.set('music', false));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm pauses when music off');
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm stops on returning home');
    await page.evaluate(() => localStorage.removeItem('musicOn'));

    console.log('verify-mole-smoke.js: all assertions passed');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

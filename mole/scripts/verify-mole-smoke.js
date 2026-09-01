// 두더지 게임 통합 스모크 테스트 — snake/scripts/verify-snake-smoke.js와 동일 패턴
// (디버그 훅으로 실제 UI 흐름을 헤드리스로 재현). scripts/serve.js가 8845 포트에 떠 있어야 한다.
// 8845를 쓰는 이유: scripts/serve.js의 기본 포트는 8844이지만, 이 게임을 개발하는 동안
// 8844는 무관한 외부 서버가 이미 점유하고 있어 충돌을 피하려고 이 테스트만 8845를 하드코딩함.
// 실행 전에 반드시 repo 루트에서 `PORT=8845 node scripts/serve.js`로 별도 서버를 띄워둘 것 —
// 안 띄우면 ECONNREFUSED로 실패한다.
const puppeteer = require('puppeteer-core');
const assert = require('assert');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8845;

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

    // 1) 시작 화면 — 레벨 카드가 아니라 시작 버튼 하나만 있다
    const cardCount = await page.evaluate(() => document.querySelectorAll('.level-card').length);
    assert.strictEqual(cardCount, 0, 'no level-select cards in score-attack mode');
    const startBtn = await page.evaluate(() => !!document.getElementById('start-btn'));
    assert.ok(startBtn, 'a single start button is shown');

    // 1b) appLang=en 이면 시작 버튼이 영어
    await page.evaluate(() => localStorage.setItem('appLang', 'en'));
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    const startLabel = await page.evaluate(() => document.getElementById('start-btn').textContent.trim());
    assert.strictEqual(startLabel, 'Start', 'start button localized to en when appLang=en');
    await page.evaluate(() => localStorage.removeItem('appLang'));
    await page.reload({ waitUntil: 'load' });

    // 2) 시작 → 카운트다운 → 게임 화면/HUD 렌더
    await page.evaluate(() => window.__debugStartGame());
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    const afterStart = await page.evaluate(() => ({
      gameScreenHidden: document.getElementById('game-screen').hidden,
      startScreenHidden: document.getElementById('start-screen').hidden,
      hudTime: document.querySelector('#hud-ticker .tk-t').textContent
    }));
    assert.strictEqual(afterStart.gameScreenHidden, false, 'game screen must become visible');
    assert.strictEqual(afterStart.startScreenHidden, true, 'start screen must hide');
    assert.ok(/\d+초/.test(afterStart.hudTime), 'HUD ticker shows the remaining time');
    assert.strictEqual(await score(), 0, 'score starts at 0');

    // 3) 두더지가 실제로 화면에 나타나는가 (최대 3초 대기)
    let sawPop = false;
    for (let i = 0; i < 30 && !sawPop; i++) {
      await new Promise((r) => setTimeout(r, 100));
      sawPop = await page.evaluate(() => document.querySelectorAll('.mole-pop').length > 0);
    }
    assert.ok(sawPop, 'at least one pop must appear within 3 seconds');

    // 3b) 16개 구멍 + 앞테두리 오버레이가 상시 배치돼 있는가
    const holeCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-layer .mole-hole').length);
    assert.strictEqual(holeCount, 16, 'a fixed 4x4 grid of 16 holes');
    const holeFrontCount = await page.evaluate(() => document.querySelectorAll('#mole-hole-front-layer .mole-hole-front').length);
    assert.strictEqual(holeFrontCount, 16, 'a matching front-rim overlay for every hole');

    // 3c) 두더지가 이모지 글리프가 아니라 실제 스프라이트 이미지로 렌더되는가 (□ 회귀 방지)
    let moleImg = null;
    for (let i = 0; i < 30 && !moleImg; i++) {
      await new Promise((r) => setTimeout(r, 100));
      moleImg = await page.evaluate(() => {
        const img = document.querySelector('.mole-pop--mole .mole-pop-img');
        return img ? { src: img.getAttribute('src') } : null;
      });
    }
    assert.ok(moleImg, 'a mole must render as <img class="mole-pop-img">');
    assert.ok(/assets\/moles\/.+\.png$/.test(moleImg.src), `mole image src must point at a sprite (got ${moleImg.src})`);

    // 3d) 구멍 버튼 16개
    const laneButtonCount = await page.evaluate(() => document.querySelectorAll('#lane-button-bar .lane-button').length);
    assert.strictEqual(laneButtonCount, 16, 'exactly 16 hole buttons (4x4)');

    // 3h) BGM: <audio> 존재 + 트랙 경로
    const audioSrc = await page.evaluate(() => {
      const a = document.getElementById('bgm');
      return a ? a.getAttribute('src') : null;
    });
    assert.ok(audioSrc && /audio\/bgm-boss-battle\.mp3$/.test(audioSrc), `bgm audio src points at the track (got ${audioSrc})`);

    // 3i) 효과음 게이팅 훅 — soundOn=0 이면 sfxEnabled() false
    const sfxGated = await page.evaluate(() => {
      localStorage.setItem('soundOn', '0');
      return window.FGH.Settings.sfxEnabled();
    });
    assert.strictEqual(sfxGated, false, 'sfxEnabled() reflects soundOn=0');
    await page.evaluate(() => localStorage.setItem('soundOn', '1'));

    // 3e) 두더지를 직접 터치해도 아무 일이 없다 (회귀 방지)
    const beforeDirect = await score();
    await page.evaluate(() => {
      const el = document.querySelector('.mole-pop--mole');
      if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await score(), beforeDirect, 'tapping a mole directly must do nothing');

    // 헬퍼: 살아있는(dying 아님) 두더지의 regionId 를 left/top % 로 계산
    const liveMoleRegion = () => page.evaluate(() => {
      for (const el of document.querySelectorAll('.mole-pop--mole')) {
        const img = el.querySelector('.mole-pop-img');
        const ty = img ? new DOMMatrix(getComputedStyle(img).transform).m42 : 0;
        if (Math.abs(ty) < 8 && img && img.style.visibility !== 'hidden') {
          const col = Math.round(parseFloat(el.style.left) / 100 * 4 - 0.5);
          const holeY = parseFloat(el.style.top) / 100;
          const row = Math.round((holeY - 0.27) / ((0.88 - 0.27) / 3));
          return Math.max(0, Math.min(15, row * 4 + col));
        }
      }
      return null;
    });

    // 3f) 두더지가 뜬 구멍의 버튼을 누르면 점수가 오른다 + 망치가 움직인다
    let hitOk = false;
    let sawHammerMove = false;
    for (let i = 0; i < 80 && !hitOk; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const region = await liveMoleRegion();
      if (region === null) continue;
      const before = await score();
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
      if ((await score()) > before) hitOk = true;
    }
    assert.ok(hitOk, 'pressing the hole button of a live mole raises the score');
    assert.ok(sawHammerMove, 'the hammer moves toward the pressed hole');

    // 3g) 키보드 격자(1234/qwer/asdf/zxcv)로도 두더지를 잡을 수 있다
    await page.evaluate(() => window.__debugStartGame());
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

    // 4) 시간 종료 → 결과 오버레이 (점수 + 최고 기록 저장)
    const endScore = await score();
    await page.evaluate(() => window.__debugEndRound());
    await new Promise((r) => setTimeout(r, 200));
    const afterEnd = await page.evaluate(() => ({
      overlayHidden: document.getElementById('gameover-overlay').hidden,
      reason: document.getElementById('gameover-reason').textContent,
      scoreText: document.getElementById('gameover-score').textContent,
      best: parseInt(localStorage.getItem('moleBestScore'), 10)
    }));
    assert.strictEqual(afterEnd.overlayHidden, false, 'result overlay shows when time runs out');
    assert.strictEqual(afterEnd.reason, '시간 종료!', 'result overlay states the time-up reason');
    assert.ok(/\d+점/.test(afterEnd.scoreText), 'result overlay shows the final score');
    assert.strictEqual(afterEnd.best, endScore, 'best score is persisted to localStorage');

    // 5) 목숨 소진 경로 — 새 게임에서 목숨 0 → 결과 오버레이
    await page.evaluate(() => window.__debugStartGame());
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    await page.evaluate(() => window.__debugForceGameOver());
    await new Promise((r) => setTimeout(r, 200));
    const afterLives = await page.evaluate(() => ({
      overlayHidden: document.getElementById('gameover-overlay').hidden,
      reason: document.getElementById('gameover-reason').textContent
    }));
    assert.strictEqual(afterLives.overlayHidden, false, 'result overlay shows when lives reach 0');
    assert.strictEqual(afterLives.reason, '목숨 소진!', 'result overlay states the lives-exhausted reason');

    // 6) 결과 화면에서 "나가기" → 시작 화면 복귀
    await page.click('#gameover-select-btn');
    await new Promise((r) => setTimeout(r, 200));
    const backToStart = await page.evaluate(() => document.getElementById('start-screen').hidden);
    assert.strictEqual(backToStart, false, 'leaving the result screen returns to the start screen');

    // 7) musicOn=1 로 새 게임 → bgm 재생, 설정에서 끄면 정지, 허브로 나가면 정지
    await page.evaluate(() => localStorage.setItem('musicOn', '1'));
    await page.evaluate(() => window.__debugStartGame());
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), false, 'bgm plays after start when musicOn=1');
    await page.evaluate(() => window.FGH.Settings.set('music', false));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm pauses when music turned off');
    await page.evaluate(() => window.FGH.Settings.set('music', true));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), false, 'bgm resumes when music turned back on mid-round');
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm stops when returning to the start screen');
    await page.evaluate(() => localStorage.removeItem('musicOn'));

    console.log('verify-mole-smoke.js: all assertions passed');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

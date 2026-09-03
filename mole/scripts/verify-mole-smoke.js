// 두더지 게임 통합 스모크 — 디버그 훅으로 실제 UI 흐름을 헤드리스로 재현.
// 실행 전 repo 루트에서 `SMOKE_PORT=8846 node scripts/serve.js` 로 서버를 띄워둘 것.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;
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

    // ---- 0) 첫 실행 온보딩: 대화 앞에 메이커 강제 ----
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 300));
    // 첫 실행 = 바로 대화 화면 (온보딩 강제 없음)
    assert.strictEqual(await page.evaluate(() => document.getElementById('board-start').hidden), false,
      'first run goes straight to the chat start screen');
    assert.strictEqual(await page.evaluate(() => document.getElementById('face-maker').hidden), true,
      'the maker does NOT force open on first run');
    assert.ok(await page.evaluate(() => !!document.getElementById('start-btn')), 'chat has a start button');

    // ---- 1) 더보기 메뉴: ⊞ 아이콘 뒤 → 메이커도 여기서 ----
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), false, 'more-menu opens');

    // 메이커: 더보기 메뉴 [만들기] → 사진 주입 → 크롭 → 저장
    await page.click('#more-menu [data-mm-make]');
    await page.waitForSelector('#face-maker [data-fm-stage="pick"]:not([hidden])');
    assert.ok(await page.evaluate(() => !!document.querySelector('#face-maker [data-fm-cancel]:not([hidden])')),
      'maker from the menu shows a cancel button');
    const tmp = path.join(os.tmpdir(), 'smokeface_' + Date.now() + '.png');
    fs.writeFileSync(tmp, Buffer.from(FACE_PNG_B64, 'base64'));
    await (await page.$('#face-maker [data-fm-file]')).uploadFile(tmp);
    await page.waitForSelector('#face-maker [data-fm-stage="crop"]:not([hidden])', { timeout: 4000 });
    await page.click('#face-maker [data-fm-next]');
    await page.waitForSelector('#face-maker [data-fm-stage="preview"]:not([hidden])');
    await page.click('#face-maker [data-fm-save]');
    await page.waitForFunction(() => !!window.MoleGame.FaceStore.getActiveId(), { timeout: 4000 });
    fs.unlinkSync(tmp);
    assert.strictEqual(await page.evaluate(() => window.MoleGame.FaceStore.count()), 1, 'maker saved one face');
    // 저장 후 더보기 메뉴로 복귀
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), false, 'back to more-menu after save');
    const pills = await page.evaluate(() => document.querySelectorAll('#more-menu [data-mm-diff]').length);
    assert.strictEqual(pills, 3, '3 difficulty pills');
    const gridItems = await page.evaluate(() => document.querySelectorAll('#more-menu [data-mm-nav]').length);
    assert.strictEqual(gridItems, 8, '8 grid items');
    assert.ok(await page.evaluate(() => /\d/.test(document.querySelector('#more-menu [data-mm-hearts] b').textContent)), 'hearts count shown');
    // 닫기 → 대화 화면
    await page.click('#more-menu [data-mm-close]');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), true, 'more-menu closes');

    // ---- 2) __debugStartGame → 플레이 ----
    await page.evaluate(() => { window.__debugSetHearts(5); });
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

    // ---- 3) 스프라이트 + 구멍 + 얼굴 레이어 ----
    let moleImg = null;
    for (let i = 0; i < 30 && !moleImg; i++) {
      await new Promise((r) => setTimeout(r, 100));
      moleImg = await page.evaluate(() => {
        const img = document.querySelector('.mole-pop--mole .mole-pop-img');
        return img ? img.getAttribute('src') : null;
      });
    }
    assert.ok(moleImg && /assets\/moles\/.+\.png$/.test(moleImg), `mole renders as sprite <img> (got ${moleImg})`);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mole-hole-layer .mole-hole').length), 16, '16 holes');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mole-hole-front-layer .mole-hole-front').length), 16, '16 front rims');
    assert.ok(await page.evaluate(() => !!document.querySelector('.mole-pop--mole .mole-face')), '활성 얼굴 → 두더지에 .mole-face');

    // ---- 4) 직접 터치 무효 ----
    const beforeDirect = await score();
    await page.evaluate(() => {
      const el = document.querySelector('.mole-pop--mole');
      if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await score(), beforeDirect, 'tapping a mole directly does nothing');

    // ---- 5) 버튼 → 점수 + 망치 이동 ----
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

    // ---- 6) 키보드 격자 ----
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

    // ---- 7) 난이도 ----
    // 전설: 동물 섞임 (레벨표상 라운드 1은 동물 0 → 라운드 4에서 확인)
    await page.evaluate(() => window.__debugStartGame('legend'));
    await waitIntroDone();
    assert.ok(/diff-legend/.test(await page.evaluate(() => document.getElementById('game-screen').className)), 'diff-legend class');
    await page.evaluate(() => window.__debugStartRound(4));
    await waitIntroDone();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('#mole-pop-layer .mole-pop'))
      .some((p) => /mole-pop--(animal|bomb)/.test(p.className)), { timeout: 15000 });
    // 고수: 동물 없음 (라운드 4에서도)
    await page.evaluate(() => window.__debugStartGame('mid'));
    await waitIntroDone();
    await page.evaluate(() => window.__debugStartRound(4));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 3000));
    assert.strictEqual(await page.evaluate(() => Array.from(document.querySelectorAll('#mole-pop-layer .mole-pop'))
      .some((p) => /mole-pop--(animal|bomb)/.test(p.className))), false, 'mid 난이도는 라운드 4에서도 동물 없음');

    // ---- 8) 라운드 진행 (점수 누적) ----
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    const scoreBeforeEnd = await score();
    await page.evaluate(() => window.__debugEndRound());
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => document.getElementById('round-done-overlay').hidden), false, 'round-done overlay shows');
    await new Promise((r) => setTimeout(r, 1500));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => document.querySelector('#hud-ticker .tk-lv').textContent), '라운드 2', 'auto-advanced to round 2');
    assert.ok((await score()) >= scoreBeforeEnd, 'cumulative score carried');

    // ---- 9) 목숨 소진 → 결과 + mole.best.easy + 코인 ----
    await page.evaluate(() => { localStorage.setItem('mole.coins', '0'); localStorage.removeItem('mole.best.easy'); });
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 200));
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
    assert.strictEqual(afterLives.overlayHidden, false, 'result overlay shows on 0 lives');
    assert.strictEqual(afterLives.reason, '목숨 소진!', 'result states lives-exhausted');
    assert.strictEqual(afterLives.best, finalScore, 'total persisted to mole.best.easy');

    // ---- 10) 결과 → 나가기 → 대화 화면 (재방문 대화) ----
    await page.click('#gameover-select-btn');
    await new Promise((r) => setTimeout(r, 200));
    const back = await page.evaluate(() => ({
      boardStartHidden: document.getElementById('board-start').hidden,
      isStart: document.getElementById('game-screen').classList.contains('is-start'),
      chatReturn: !document.getElementById('chat-return').hidden
    }));
    assert.strictEqual(back.boardStartHidden, false, 'chat start screen shows');
    assert.strictEqual(back.isStart, true, 'is-start back on');
    assert.strictEqual(back.chatReturn, true, 'return chat thread shown (visits > 0)');

    // ---- 11) moleBestScore 마이그레이션 ----
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('moleBestScore', '4321'); });
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('mole.best.easy')), '4321', 'moleBestScore → mole.best.easy');

    // ---- 12) BGM ----
    await page.evaluate(() => { localStorage.setItem('musicOn', '1'); });
    await page.evaluate(() => window.__debugAddFace());
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), false, 'bgm plays when musicOn=1');
    await page.evaluate(() => window.FGH.Settings.set('music', false));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm pauses when music off');
    await page.evaluate(() => localStorage.removeItem('musicOn'));

    console.log('verify-mole-smoke.js: all assertions passed');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

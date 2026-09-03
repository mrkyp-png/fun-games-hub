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
      // 1) 인트로가 뜰 때까지 (startRound 가 얼굴 합성 빌드 후에 도는 경우 대비)
      let appeared = false;
      for (let i = 0; i < 120 && !appeared; i++) {
        appeared = await page.evaluate(() => window.__debugIntroActive());
        if (!appeared) await new Promise((r) => setTimeout(r, 100));
      }
      if (!appeared) throw new Error('round intro never appeared');
      // 2) 인트로가 끝날 때까지
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

    // 크롭 저장 → 꾸미기 화면 → [합성] → 짜잔 카드 → [저장]
    await page.waitForSelector('#costume-screen:not([hidden])', { timeout: 4000 });
    const rows = await page.evaluate(() => document.querySelectorAll('#costume-screen .cs-row').length);
    assert.ok(rows >= 4, '꾸미기 4줄 (모자/얼굴/몸/안경)');
    await page.click('#costume-screen [data-cs-compose]');
    await page.waitForSelector('#costume-screen [data-cs-result]:not([hidden])', { timeout: 8000 });
    assert.ok(await page.evaluate(() => /^blob:/.test(document.querySelector('#costume-screen [data-cs-card]').src)), '합성 결과 카드');
    await page.click('#costume-screen [data-cs-save]');
    await new Promise((r) => setTimeout(r, 400));
    assert.strictEqual(await page.evaluate(() => document.getElementById('costume-screen').hidden), true, '저장 후 꾸미기 닫힘');

    // 이후 섹션 위해 더보기 메뉴 다시 열기
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), false, 'more-menu re-opens');

    // 프로필 사진: 아바타 탭 → 메이커(프로필 모드) → 저장 → mole.profilePic
    await page.click('#more-menu [data-mm-avatar]');
    await page.waitForSelector('#face-maker [data-fm-stage="pick"]:not([hidden])');
    assert.strictEqual(await page.evaluate(() => document.querySelector('#face-maker [data-fm-name]').hidden), true, 'profile mode hides the name field');
    const tmp2 = path.join(os.tmpdir(), 'smokepfp_' + Date.now() + '.png');
    fs.writeFileSync(tmp2, Buffer.from(FACE_PNG_B64, 'base64'));
    await (await page.$('#face-maker [data-fm-file]')).uploadFile(tmp2);
    await page.waitForSelector('#face-maker [data-fm-stage="crop"]:not([hidden])', { timeout: 4000 });
    await page.click('#face-maker [data-fm-next]');
    await page.waitForSelector('#face-maker [data-fm-stage="preview"]:not([hidden])');
    await page.click('#face-maker [data-fm-save]');
    await page.waitForFunction(() => !!localStorage.getItem('mole.profilePic'), { timeout: 4000 });
    fs.unlinkSync(tmp2);
    assert.ok(await page.evaluate(() => /data:image/.test(document.querySelector('#more-menu [data-mm-avatar]').style.backgroundImage)), 'avatar shows the new profile pic');
    const pills = await page.evaluate(() => document.querySelectorAll('#more-menu [data-mm-diff]').length);
    assert.strictEqual(pills, 3, '3 difficulty pills');
    // 라이트 모드 pill = 설정만 (화면 이동 없음)
    await page.evaluate(() => document.querySelector('#more-menu [data-mm-diff="legend"]').click());
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('mole.difficulty')), 'legend', 'pill sets mole.difficulty');
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), false, 'pill does NOT navigate away — stays on the menu');
    assert.ok(await page.evaluate(() => document.querySelector('#more-menu [data-mm-diff="legend"]').classList.contains('mm-pill--on')), 'selected pill highlighted');
    await page.evaluate(() => document.querySelector('#more-menu [data-mm-diff="easy"]').click());
    const gridItems = await page.evaluate(() => document.querySelectorAll('#more-menu [data-mm-nav]').length);
    assert.strictEqual(gridItems, 8, '8 grid items');
    assert.ok(await page.evaluate(() => /\d/.test(document.querySelector('#more-menu [data-mm-hearts] b').textContent)), 'hearts count shown');
    // 설정 화면: BGM/소리/진동 토글이 실제로 동작
    await page.click('#more-menu [data-mm-nav="settings"]');
    await page.waitForSelector('#settings-screen:not([hidden])');
    const toggles = await page.evaluate(() => document.querySelectorAll('#settings-screen .set-toggle').length);
    assert.strictEqual(toggles, 3, '3 toggles (BGM/SFX/vibration)');
    await page.evaluate(() => window.FGH.Settings.set('music', true));
    await page.evaluate(() => { document.querySelector('#settings-screen .set-toggle').click(); }); // first row = music
    assert.strictEqual(await page.evaluate(() => window.FGH.Settings.get('music')), false, 'toggling BGM row flips the setting');
    await page.click('#settings-screen [data-back="settings"]');
    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), false, 'back from settings → more-menu');

    // 닫기 → 대화 화면
    await page.click('#more-menu [data-mm-close]');
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), true, 'more-menu closes');

    // 더보기 "시작" 버튼(통화 자리) → 더보기 닫고 대화 화면으로 (게임은 대화의 시작 버튼에서)
    await page.click('#btn-back-to-hub');
    await new Promise((r) => setTimeout(r, 150));
    await page.click('#more-menu [data-mm-start]');
    await new Promise((r) => setTimeout(r, 200));
    assert.strictEqual(await page.evaluate(() => document.getElementById('more-menu').hidden), true, 'more-menu closed after 시작');
    assert.strictEqual(await page.evaluate(() => document.getElementById('board-start').hidden), false, '더보기 시작 → 대화 화면');
    assert.strictEqual(await page.evaluate(() => document.getElementById('game-screen').classList.contains('is-start')), true, 'is-start on (대화 화면)');

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

    // ---- 3) 두더지 = 하나의 합성 이미지 (원본 사진/레이어 없음) ----
    let moleImg = null;
    for (let i = 0; i < 30 && !moleImg; i++) {
      await new Promise((r) => setTimeout(r, 100));
      moleImg = await page.evaluate(() => {
        const img = document.querySelector('.mole-pop--mole .mole-pop-img');
        return img ? img.getAttribute('src') : null;
      });
    }
    // 활성 얼굴이 있으므로 두더지 이미지는 합성본(blob:) 이어야 한다
    assert.ok(moleImg && /^blob:/.test(moleImg), `mole renders as ONE composited image (got ${moleImg})`);
    // 별도 얼굴 레이어(.mole-face)나 원본 사진 img 가 없어야 한다
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mole-pop-layer .mole-face, #mole-pop-layer img:not(.mole-pop-img)').length), 0,
      'no separate face/photo layer — only the composited .mole-pop-img');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.mole-pop--mole .mole-pop-img').length),
      await page.evaluate(() => document.querySelectorAll('.mole-pop--mole').length), 'one image per mole pop');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mole-hole-layer .mole-hole').length), 16, '16 holes');
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#mole-hole-front-layer .mole-hole-front').length), 16, '16 front rims');
    // 얼굴 없는 게임은 기본 스프라이트
    await page.evaluate(() => { window.MoleGame.FaceStore.clearActive(); });
    await page.evaluate(() => window.__debugStartGame('easy'));
    await waitIntroDone();
    await page.waitForFunction(() => {
      const img = document.querySelector('.mole-pop--mole .mole-pop-img');
      return img && /assets\/moles\//.test(img.src);
    }, { timeout: 8000 });

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

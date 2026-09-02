(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const START_LIVES = 3;      // 스펙 §11
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const ROUND_SECONDS = 30;   // 라운드마다 30초 점수 어택
  const FINAL_ROUND = 10;     // 라운드 1~10
  // 처치 순간 게임 시간을 잠깐 멈춘다 (히트스톱) — 타격감. 콤보가 쌓일수록 조금 더 길게.
  const HITSTOP_BASE_MS = 90;
  const HITSTOP_MAX_MS = 150;

  // 라운드별 난이도는 MG.LEVELS 표(동시 두더지 1→5, 유지시간 2.5→1.0s, 방해물 증가)를 쓴다.
  // 16칸 클리어 개념은 없다 — 두더지는 16칸 아무 데나 랜덤 반복 등장, 60초가 끝나면 다음 라운드.

  let state = null;   // 현재 라운드 상태 (홈 화면일 땐 null)
  // 10라운드를 통틀어 유지되는 것: 콤보·점수(1라운드부터 누적)와 목숨.
  let run = null;     // { combo: ComboScore, lives, comboMilestone }
  const COMBO_LIFE_STEP = 100; // 콤보가 이 배수를 넘길 때마다 목숨 +1
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성
  let sharedLaneControls = null; // 다이얼러 버튼 — 홈 화면에도 (비활성으로) 계속 보여야 하므로 세션당 한 번만 생성
  let sessionGen = 0; // startRound/showHome 호출마다 +1 — 카운트다운·자동진행 타이머 취소 토큰

  // 화면/메타 모듈 인스턴스 (DOMContentLoaded 에서 생성).
  let screenNav = null;
  let homeScreen = null;
  let faceMaker = null;
  let faceLocker = null;
  let shop = null;
  let daily = null;
  let scoreScreen = null;

  let currentDiff = 'easy';        // 현재 판 난이도 ('easy'|'mid'|'legend')
  let activeFaceUrl = null;        // 활성 사람두더지 얼굴 objectURL
  let pendingOnboardStart = false; // 온보딩 첫 저장 뒤 하수 게임 자동 시작 대기

  const DIFFS = ['easy', 'mid', 'legend'];
  function currentDifficulty() {
    const d = localStorage.getItem('mole.difficulty');
    return DIFFS.indexOf(d) > -1 ? d : 'easy';
  }
  function bestFor(diff) {
    const v = parseInt(localStorage.getItem('mole.best.' + diff), 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBestFor(diff, score) {
    localStorage.setItem('mole.best.' + diff, String(score));
  }
  // 구 단일 키(moleBestScore) → mole.best.easy 마이그레이션 (1회).
  function migrateBest() {
    const old = localStorage.getItem('moleBestScore');
    if (old != null && localStorage.getItem('mole.best.easy') == null) {
      localStorage.setItem('mole.best.easy', old);
      localStorage.removeItem('moleBestScore');
    }
  }

  // 활성 사람두더지 얼굴 blob → objectURL (게임 시작 전 호출).
  function loadActiveFace() {
    const id = MG.FaceStore.getActiveId();
    if (activeFaceUrl) { URL.revokeObjectURL(activeFaceUrl); activeFaceUrl = null; }
    if (!id) return Promise.resolve(null);
    return MG.FaceStore.getFace(id).then((rec) => {
      activeFaceUrl = rec ? URL.createObjectURL(rec.blob) : null;
      return activeFaceUrl;
    });
  }

  let bgm = null; // <audio id="bgm">
  function syncBgm(playIntent) {
    if (!bgm) return;
    if (window.FGH.Settings.get('music') && playIntent) {
      bgm.play().catch(() => { /* 자동재생 차단 — 다음 제스처/토글에 재시도 */ });
    } else {
      bgm.pause();
    }
  }

  // ---------- 홈 화면 ----------
  function showHome() {
    sessionGen++; // 진행 중이던 카운트다운/자동진행 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    state = null;
    run = null;
    setPauseUI(false);
    syncBgm(false); // 홈으로 나오면 BGM 정지
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('round-intro-overlay').hidden = true;
    document.getElementById('board-start').hidden = false;
    document.getElementById('game-screen').classList.add('is-start');
    if (screenNav) screenNav.show('home-screen');
    if (homeScreen) homeScreen.refresh();
    retriggerBestSms();
  }

  // 최고 기록 문자 알림 — 홈 열 때마다 위에서 툭↓ 리트리거. 현재 난이도 최고점.
  function retriggerBestSms() {
    const b = bestFor(currentDifficulty());
    const sms = document.getElementById('start-best');
    if (!sms) return;
    sms.querySelector('.chat-sms-txt').textContent =
      b > 0 ? I18N.t('mole.start.best', { n: b.toLocaleString() }) : '';
    sms.classList.toggle('is-empty', b <= 0);
    sms.classList.remove('sms-anim');
    void sms.offsetWidth;
    sms.classList.add('sms-anim');
  }

  // ---------- 게임 시작 (홈 난이도 pill / 다시하기) ----------
  function startGame(difficulty) {
    const diff = DIFFS.indexOf(difficulty) > -1 ? difficulty : 'easy';

    // 첫 실행 온보딩: 사람두더지 만들기 강제 → 저장 후 하수 게임(하트 무료).
    if (!localStorage.getItem('mole.onboarded')) {
      pendingOnboardStart = true;
      screenNav.show('face-maker');
      faceMaker.open({ forced: true });
      return;
    }
    if (!MG.FaceStore.getActiveId()) {
      alert(I18N.t('mole.home.needFace'));
      screenNav.show('face-maker');
      faceMaker.open({});
      return;
    }
    if (!MG.Economy.spendHeart()) {
      showNoHeartModal();
      return;
    }

    localStorage.setItem('mole.difficulty', diff);
    applyDiffClass(diff);
    loadActiveFace().then(() => {
      currentDiff = diff;
      startRound(1, { fresh: true });
    });
  }

  function applyDiffClass(diff) {
    const gs = document.getElementById('game-screen');
    DIFFS.forEach((d) => gs.classList.remove('diff-' + d));
    gs.classList.add('diff-' + diff);
  }

  function showNoHeartModal() {
    const v = document.createElement('div');
    v.className = 'ad-overlay';
    v.innerHTML = '<div class="ad-overlay-card">' +
      '<div class="nh-title">' + I18N.t('mole.home.noHearts') + '</div>' +
      '<div class="nh-btns">' +
        '<button type="button" data-nh="ad">' + I18N.t('mole.shop.watchHeart') + '</button>' +
        '<button type="button" data-nh="shop">' + I18N.t('mole.home.shop') + '</button>' +
        '<button type="button" data-nh="close">' + I18N.t('mole.common.close') + '</button>' +
      '</div></div>';
    document.body.appendChild(v);
    v.querySelector('[data-nh="ad"]').addEventListener('click', () => {
      v.remove();
      MG.Ads.rewarded().then((ok) => { if (ok) { MG.Economy.addHearts(1); if (homeScreen) homeScreen.refresh(); } });
    });
    v.querySelector('[data-nh="shop"]').addEventListener('click', () => {
      v.remove();
      screenNav.show('shop');
      if (shop) shop.show();
    });
    v.querySelector('[data-nh="close"]').addEventListener('click', () => v.remove());
  }

  // ---------- 라운드 시작 ----------
  // opts.fresh: true면 콤보·점수·목숨을 리셋 (시작 버튼/다시하기).
  //             없으면 자동 다음 라운드로 보고 그대로 이어간다.
  function startRound(roundNum, opts) {
    sessionGen++;
    const myGen = sessionGen;
    // fresh(시작/다시하기)면 콤보·점수·목숨 전부 리셋. 자동 다음 라운드면 그대로 이어간다.
    if (opts && opts.fresh) {
      run = { combo: MG.ComboScore.create(), lives: START_LIVES, comboMilestone: 0 };
    }
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();

    const levelData = MG.LEVELS[roundNum - 1];

    document.getElementById('board-start').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('game-screen').classList.remove('is-start');
    syncBgm(true); // 시작 버튼(사용자 제스처) 이후 — 설정에서 켜져 있으면 재생
    MG.HitFx.warmup(); // 오디오 컨텍스트 + 타격음 파일 프리로드 (카운트다운 동안)

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + roundNum + '-' + Date.now())) };
    const { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: GRID_SIZE });

    const config = {
      maxConcurrentMoles: levelData.maxConcurrentMoles,
      maxConcurrentAnimals: levelData.maxConcurrentAnimals,
      maxConcurrentBombs: levelData.maxConcurrentBombs,
      popDuration: levelData.moleDuration,
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: currentDiff === 'legend' // 하수·고수는 두더지만, 전설만 동물
    };

    const scheduler = MG.SpawnScheduler.create({ regions, spawnPoints, config, rng });

    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onEmerge: (x, y, type) => {
          if (type === 'mole') MG.HitFx.emerge(document.getElementById('mole-board'), x, y);
        }
      });
    }
    sharedPopElements.clear();
    if (sharedPopElements.setFaceUrl) sharedPopElements.setFaceUrl(activeFaceUrl);

    const holeLayer = MG.HoleLayer.create({
      container: document.getElementById('mole-hole-layer'),
      frontContainer: document.getElementById('mole-hole-front-layer'),
      spawnPoints
    });

    const laneHammer = MG.LaneHammer.create({
      layer: document.getElementById('mole-hammer-layer')
    });

    state = {
      round: roundNum, levelData, regions, spawnPoints, scheduler, holeLayer, laneHammer,
      timeRemaining: ROUND_SECONDS,
      hitstopUntil: 0,
      ended: false,
      paused: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };
    setPauseUI(false);

    updateHUD();
    playRoundIntro(roundNum, () => {
      if (myGen !== sessionGen || !state) return; // 그 사이 나가버림 — 이 콜백 무효
      state.introActive = false;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    });
  }

  // "라운드 N" → 3·2·1·시작! 카운트다운을 보여주고 onDone 호출.
  function playRoundIntro(roundNum, onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const title = document.getElementById('round-intro-title');
    const count = document.getElementById('round-intro-count');
    title.textContent = I18N.t('mole.round', { n: roundNum });
    overlay.hidden = false;
    const STEPS = ['3', '2', '1', I18N.t('mole.count.go')];
    let i = 0;
    function tick() {
      if (myGen !== sessionGen) return; // 도중에 나가버림
      count.textContent = STEPS[i];
      count.classList.remove('pop');
      void count.offsetWidth;
      count.classList.add('pop');
      i++;
      if (i < STEPS.length) {
        setTimeout(tick, 650);
      } else {
        setTimeout(() => {
          if (myGen !== sessionGen) return;
          overlay.hidden = true;
          onDone();
        }, 450);
      }
    }
    tick();
  }

  // ---------- 메인 루프 ----------
  function loop(now) {
    if (!state || state.ended) return;
    if (state.paused) { lastTime = now; rafId = requestAnimationFrame(loop); return; } // 일시정지: 시간·스폰 정지, 루프만 유지
    const rawDt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    // 히트스톱: 성공타 직후 잠깐 게임 시간을 멈춘다 (루프는 계속 돈다).
    const dt = (now < state.hitstopUntil) ? 0 : rawDt;

    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      roundComplete();
      return;
    }

    state.scheduler.tick(dt);
    state.laneHammer.update(rawDt); // 망치는 히트스톱과 무관하게 부드럽게
    syncPops();

    // 구멍별 버튼 hot: 그 구멍에 두더지(방해물 아님)가 떠 있으면 빛낸다 (스펙 §2.3).
    const moleRegions = new Set();
    state.scheduler.getActivePops().forEach((p) => {
      if (p.type === 'mole' && !p.dying) moleRegions.add(p.regionId);
    });
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) {
      sharedLaneControls.setCellHot(id, moleRegions.has(id));
    }

    updateHUD();
    rafId = requestAnimationFrame(loop);
  }

  function updateHUD() {
    MG.HUD.update({
      round: state.round,
      lives: run.lives,
      timeRemaining: state.timeRemaining,
      combo: run.combo.combo,
      isMaxCombo: run.combo.isMaxCombo(),
      score: run.combo.score // 1라운드부터 누적 (콤보·점수 한 통)
    });
  }

  function syncPops() {
    sharedPopElements.sync(state.scheduler.getActivePops());
  }

  // 모든 구멍 버튼의 hot 하이라이트를 끈다 (라운드 시작/시작 화면 복귀 시).
  function resetHot() {
    if (!sharedLaneControls) return;
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) sharedLaneControls.setCellHot(id, false);
  }

  // ---------- 구멍 버튼 입력 → 그 구멍 타격 ----------
  function handleCell(regionId) {
    if (!state || state.ended || state.introActive || state.paused) return;
    const results = state.scheduler.resolveRegion(regionId);
    const sp = state.spawnPoints[regionId];

    const primary = results[0] || null;
    const targetX = primary ? primary.xFrac : sp.x;
    const targetY = primary ? primary.yFrac : sp.y;

    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, targetY, results));
  }

  function onHammerImpact(hitXFrac, hitYFrac, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;

    results.forEach((r) => {
      if (r.type === 'mole') {
        if (r.done) {
          run.combo.onMoleHit();   // 스펙 §12 — 마리당 1콤보
          checkComboLifeBonus();   // 콤보 100단위 넘기면 목숨 +1
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          MG.HitFx.moleTap(board, r.xFrac, r.yFrac);
        }
      } else if (r.type === 'animal') {
        run.lives -= 1;                 // 스펙 §8/§11 — 목숨은 10라운드 통틀어 3개
        run.combo.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
        flashHud('hud-hearts');
      } else if (r.type === 'bomb') {
        state.timeRemaining = Math.max(0, state.timeRemaining - 3); // 스펙 §8
        run.combo.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'bomb');
        flashHud('hud-ticker'); // 시간 −3 — 티커 전체를 잠깐 번쩍
      }
    });

    if (results.length === 0) {
      MG.HitFx.whiff(board, hitXFrac, hitYFrac); // 빈 구멍 헛스윙
    }
    if (moleHits > 0) {
      state.hitstopUntil = performance.now() +
        Math.min(HITSTOP_MAX_MS, HITSTOP_BASE_MS + run.combo.combo * 10);
    }

    syncPops();
    updateHUD();
    if (run.lives <= 0) {
      finish('lives');
    }
  }

  // 콤보가 100·200·300… 을 새로 넘겼으면 목숨 1개 보너스.
  function checkComboLifeBonus() {
    const step = Math.floor(run.combo.combo / COMBO_LIFE_STEP);
    if (step > run.comboMilestone) {
      run.lives += (step - run.comboMilestone);
      run.comboMilestone = step;
      flashHud('hud-hearts');
      const h = document.getElementById('hud-hearts');
      if (h) { h.classList.remove('life-bonus'); void h.offsetWidth; h.classList.add('life-bonus'); }
    }
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
  }

  // ---------- 일시정지 ----------
  // 아이콘: 플레이 중 = ▶ / 일시정지 = ⏸ (사용자 요청 — 현재 상태 표시).
  function setPauseUI(paused) {
    const btn = document.getElementById('btn-pause');
    if (btn) btn.classList.toggle('is-paused', paused);
    document.getElementById('game-screen').classList.toggle('is-paused', paused);
  }
  function togglePause() {
    if (!state || state.ended || state.introActive) return;
    state.paused = !state.paused;
    setPauseUI(state.paused);
    if (!state.paused) lastTime = performance.now(); // 재개 시 시간 점프 방지
  }

  // ---------- 라운드 종료 → 다음 라운드 or 최종 결과 ----------
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
    const myGen = sessionGen;
    const finishedRound = state.round;
    if (rafId) cancelAnimationFrame(rafId);
    sharedPopElements.clear();
    resetHot();

    if (finishedRound >= FINAL_ROUND) {
      finishFromRound('done');
      return;
    }

    // 라운드 사이 짧은 안내 후 자동으로 다음 라운드.
    document.getElementById('round-done-title').textContent =
      I18N.t('mole.roundDone', { n: finishedRound });
    document.getElementById('round-done-total').textContent =
      I18N.t('mole.cumulative', { n: run.combo.score.toLocaleString() });
    document.getElementById('round-done-overlay').hidden = false;

    setTimeout(() => {
      if (myGen !== sessionGen) return; // 그 사이 나가버림
      document.getElementById('round-done-overlay').hidden = true;
      startRound(finishedRound + 1); // fresh 아님 → 누적 유지
    }, 1400);
  }

  // 목숨 소진(라운드 도중) — 지금까지 친 점수까지 반영하고 최종 결과.
  function finish(reason) {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    sharedPopElements.clear();
    resetHot();
    finishFromRound(reason);
  }

  // 최종 결과 화면 (10라운드 완주 or 목숨 소진).
  function finishFromRound(reason) {
    const total = run.combo.score;
    const diff = currentDiff;
    const best = bestFor(diff);
    const isNewBest = total > best;
    if (isNewBest) saveBestFor(diff, total);

    const coins = Math.floor(total / 200);
    if (coins > 0) MG.Economy.addCoins(coins);

    // 기록 보관 (100판 이상도 문제없음, 개당 수십 바이트).
    try {
      localStorage.setItem('mole.lastPlayed', String(Date.now()));
      localStorage.setItem('mole.lastWasBest', isNewBest ? '1' : '0');
      localStorage.setItem('mole.lastWasBad', reason === 'lives' ? '1' : '0');
      const hist = JSON.parse(localStorage.getItem('mole.history') || '[]');
      hist.push({ t: Date.now(), score: total, best: isNewBest, reason: reason, diff: diff });
      if (hist.length > 500) hist.splice(0, hist.length - 500); // 안전 상한
      localStorage.setItem('mole.history', JSON.stringify(hist));
    } catch (e) { /* localStorage 불가 환경 무시 */ }

    document.getElementById('gameover-reason').textContent =
      I18N.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.allClear');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.score', { n: total.toLocaleString() });
    let line = isNewBest
      ? I18N.t('mole.result.newBest', { n: total.toLocaleString() })
      : I18N.t('mole.result.best', { n: Math.max(best, total).toLocaleString() });
    if (coins > 0) line += '   +' + coins + '🪙';
    document.getElementById('gameover-best').textContent = line;
    document.getElementById('gameover-overlay').hidden = false;
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgm = document.getElementById('bgm');
    bgm.volume = 0.35;
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') syncBgm(state && !state.ended);
    });

    // 두더지/방해물/구멍/망치 스프라이트를 지금 미리 디코드.
    // 안 하면 첫 라운드에서 두더지가 올라오며 프레임 바꿀 때 디코드 hitch 로 끊긴다.
    MG.MoleSprites.preloadAll();

    // 다이얼러 버튼은 홈 화면에도 계속 보인다 (폰 컨셉) — 세션당 한 번만 생성.
    // 홈/화면 패널/카운트다운 동안엔 handleCell 이 앞에서 막으므로 눌러도 아무 일 없다.
    sharedLaneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: GRID_SIZE,
      onCell: handleCell
    });

    migrateBest();

    screenNav = MG.ScreenNav.create({
      screens: ['home-screen', 'face-maker', 'face-locker', 'shop', 'daily',
                'score-screen', 'help-screen', 'privacy-screen']
    });

    wireScreenModules();

    // 첫 진입: 온보딩 여부에 따라.
    if (!localStorage.getItem('mole.onboarded') && faceMaker) {
      document.getElementById('game-screen').classList.add('is-start');
      document.getElementById('board-start').hidden = false;
      pendingOnboardStart = true;
      screenNav.show('face-maker');
      faceMaker.open({ forced: true });
    } else {
      showHome();
    }

    document.getElementById('btn-back-to-hub').addEventListener('click', () => {
      if (state) showHome();        // 플레이 중 → 홈 (판 버림)
      else screenNav.back();        // 화면 스택에서 뒤로 (홈이면 그대로)
    });
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startGame(currentDifficulty()));
    document.getElementById('gameover-select-btn').addEventListener('click', () => showHome());
    document.getElementById('btn-pause').addEventListener('click', togglePause);

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = (diff) => {
      localStorage.setItem('mole.onboarded', '1');
      loadActiveFace().then(() => {
        currentDiff = DIFFS.indexOf(diff) > -1 ? diff : 'easy';
        localStorage.setItem('mole.difficulty', currentDiff);
        applyDiffClass(currentDiff);
        startRound(1, { fresh: true });
      });
    };
    window.__debugStartRound = (n) => startRound(n, { fresh: true });
    window.__debugEndRound = function () {
      if (state && !state.ended) { state.timeRemaining = 0; roundComplete(); }
    };
    window.__debugForceGameOver = function () {
      if (!state || !run) return;
      run.lives = 0;
      finish('lives');
    };
    window.__debugHitCell = function (regionId) {
      if (state) handleCell(regionId);
    };
    // 콤보 강제 주입 — 100단위 목숨 보너스 테스트용.
    window.__debugPumpCombo = function (n) {
      if (!run) return null;
      for (let i = 0; i < n; i++) { run.combo.onMoleHit(); checkComboLifeBonus(); }
      updateHUD();
      return { combo: run.combo.combo, lives: run.lives };
    };
    window.__debugIntroActive = function () {
      return !!(state && state.introActive);
    };
    // 지금 실제로 때릴 수 있는(살아있고 아직 안 맞은) 두더지의 regionId — 없으면 null.
    // sinkIn(타격 후 침몰 대기) 창에는 두더지가 아직 서 있어 보이지만 이미 처치된 상태라 제외한다.
    window.__debugHittableMoleRegion = function () {
      if (!state || state.ended) return null;
      const p = state.scheduler.getActivePops().find((m) =>
        m.type === 'mole' && !m.dying && !m.sinkIn && (m.hitCooldown || 0) <= 0);
      return p ? p.regionId : null;
    };
    window.__debugShowHome = () => showHome();
    window.__debugSkipOnboarding = () => localStorage.setItem('mole.onboarded', '1');
    window.__debugSetHearts = function (n) {
      localStorage.setItem('mole.hearts', String(n));
      localStorage.setItem('mole.heartsAt', String(Date.now()));
      if (homeScreen) homeScreen.refresh();
    };
    window.__debugSetCoins = function (n) {
      localStorage.setItem('mole.coins', String(n));
      if (homeScreen) homeScreen.refresh();
    };
    window.__debugAddFace = function () {
      // 1x1 투명 PNG blob → 저장 + 활성
      return fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
        .then((r) => r.blob())
        .then((b) => MG.FaceStore.saveFace(b, '테스트'))
        .then((id) => { MG.FaceStore.setActive(id); if (homeScreen) homeScreen.refresh(); return id; });
    };
    window.__debugOpenMaker = () => { if (faceMaker) { screenNav.show('face-maker'); faceMaker.open({}); } };
    window.__debugOpenLocker = () => { if (faceLocker) { screenNav.show('face-locker'); faceLocker.show(); } };
  });

  // 화면/메타 모듈 인스턴스 생성 + 배선. 각 모듈 파일이 로드돼 있을 때만 생성한다
  // (Phase 1 태스크가 하나씩 추가 — 없으면 그 화면만 비활성).
  function wireScreenModules() {
    if (MG.FaceMaker) {
      faceMaker = MG.FaceMaker.create({
        root: document.getElementById('face-maker'),
        onDone: onFaceMade,
        onCancel: () => screenNav.back()
      });
    }
    if (MG.FaceLocker) {
      faceLocker = MG.FaceLocker.create({
        root: document.getElementById('face-locker'),
        onMake: () => { screenNav.show('face-maker'); faceMaker.open({}); },
        onPick: () => screenNav.back(),
        onClose: () => screenNav.back()
      });
    }
    if (MG.Shop) {
      shop = MG.Shop.create({
        root: document.getElementById('shop'),
        onClose: () => screenNav.back(),
        onChange: () => { if (homeScreen) homeScreen.refresh(); }
      });
    }
    if (MG.Daily) {
      daily = MG.Daily.create({
        root: document.getElementById('daily'),
        onClose: () => screenNav.back(),
        onChange: () => { if (homeScreen) homeScreen.refresh(); }
      });
    }
    if (MG.ScoreScreen) {
      scoreScreen = MG.ScoreScreen.create({
        root: document.getElementById('score-screen'),
        onClose: () => screenNav.back()
      });
    }
    ['help', 'privacy'].forEach((k) => {
      const b = document.querySelector('[data-back="' + k + '"]');
      if (b) b.addEventListener('click', () => screenNav.back());
    });
    if (MG.HomeScreen) {
      homeScreen = MG.HomeScreen.create({
        root: document.getElementById('home-screen'),
        on: {
          make: () => { screenNav.show('face-maker'); faceMaker.open({}); },
          locker: () => { screenNav.show('face-locker'); faceLocker.show(); },
          play: (diff) => startGame(diff),
          shop: () => { screenNav.show('shop'); shop.show(); },
          daily: () => { screenNav.show('daily'); daily.show(); },
          score: () => { screenNav.show('score-screen'); scoreScreen.show(); },
          help: () => screenNav.show('help-screen'),
          privacy: () => screenNav.show('privacy-screen'),
          contact: () => { window.location.href = 'mailto:mrkyp@hanmail.net'; },
          settings: () => { if (window.FGH.SettingsUI && window.FGH.SettingsUI.open) window.FGH.SettingsUI.open(); },
          editName: () => {
            const n = prompt(I18N.t('mole.home.nickPrompt'), localStorage.getItem('mole.nick') || '');
            if (n != null) { localStorage.setItem('mole.nick', n.trim().slice(0, 12)); homeScreen.refresh(); }
          }
        }
      });
    }
  }

  // 사람두더지 저장 완료 콜백. 온보딩 첫 저장이면 바로 하수 게임(하트 무료).
  function onFaceMade() {
    if (pendingOnboardStart || !localStorage.getItem('mole.onboarded')) {
      localStorage.setItem('mole.onboarded', '1');
      pendingOnboardStart = false;
      screenNav.show('home-screen');
      currentDiff = 'easy';
      localStorage.setItem('mole.difficulty', 'easy');
      applyDiffClass('easy');
      loadActiveFace().then(() => startRound(1, { fresh: true }));
    } else {
      screenNav.back();
      if (homeScreen) homeScreen.refresh();
    }
  }
})();

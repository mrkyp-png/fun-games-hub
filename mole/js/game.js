(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const BEST_KEY = 'moleBestScore';
  const START_LIVES = 3;      // 스펙 §11
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const ROUND_SECONDS = 30;   // 라운드마다 30초 점수 어택
  const FINAL_ROUND = 10;     // 라운드 1~10
  // 처치 순간 게임 시간을 잠깐 멈춘다 (히트스톱) — 타격감. 콤보가 쌓일수록 조금 더 길게.
  const HITSTOP_BASE_MS = 90;
  const HITSTOP_MAX_MS = 150;

  // 라운드별 난이도는 MG.LEVELS 표(동시 두더지 1→5, 유지시간 2.5→1.0s, 방해물 증가)를 쓴다.
  // 16칸 클리어 개념은 없다 — 두더지는 16칸 아무 데나 랜덤 반복 등장, 60초가 끝나면 다음 라운드.

  let state = null;   // 플레이 중인 라운드 상태 (시작 화면일 땐 null)
  let runBanked = 0;  // 지금 연속 도전에서 완료된 이전 라운드들의 점수 합계
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성
  let sharedLaneControls = null; // 다이얼러 버튼 — 시작 화면에도 (비활성으로) 계속 보여야 하므로 세션당 한 번만 생성
  let sessionGen = 0; // startRound/showStartScreen 호출마다 +1 — 카운트다운·자동진행 타이머 취소 토큰

  let bgm = null; // <audio id="bgm">
  function syncBgm(playIntent) {
    if (!bgm) return;
    if (window.FGH.Settings.get('music') && playIntent) {
      bgm.play().catch(() => { /* 자동재생 차단 — 다음 제스처/토글에 재시도 */ });
    } else {
      bgm.pause();
    }
  }

  function loadBest() {
    const v = parseInt(localStorage.getItem(BEST_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBest(score) {
    localStorage.setItem(BEST_KEY, String(score));
  }

  // ---------- 시작 화면 ----------
  function showStartScreen() {
    sessionGen++; // 진행 중이던 카운트다운/자동진행 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    state = null;
    runBanked = 0;
    syncBgm(false); // 허브 시작 화면으로 나오면 BGM 정지
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('round-intro-overlay').hidden = true;
    document.getElementById('board-start').hidden = false;
    document.getElementById('game-screen').classList.add('is-start');

    const best = loadBest();
    document.getElementById('start-best').textContent =
      best > 0 ? I18N.t('mole.start.best', { n: best.toLocaleString() }) : '';
  }

  // ---------- 라운드 시작 ----------
  // opts.fresh: true면 누적 점수(runBanked)를 0으로 리셋 (시작 버튼/다시하기).
  //             없으면 자동 다음 라운드로 보고 누적 유지.
  function startRound(roundNum, opts) {
    sessionGen++;
    const myGen = sessionGen;
    if (opts && opts.fresh) runBanked = 0;
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
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT
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
      comboScore: MG.ComboScore.create(),
      lives: START_LIVES,
      timeRemaining: ROUND_SECONDS,
      hitstopUntil: 0,
      ended: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };

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
      lives: state.lives,
      timeRemaining: state.timeRemaining,
      combo: state.comboScore.combo,
      isMaxCombo: state.comboScore.isMaxCombo(),
      score: runBanked + state.comboScore.score // 10라운드 누적
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
    if (!state || state.ended || state.introActive) return;
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
          state.comboScore.onMoleHit();   // 스펙 §12 — 마리당 1콤보
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          MG.HitFx.moleTap(board, r.xFrac, r.yFrac);
        }
      } else if (r.type === 'animal') {
        state.lives -= 1;                 // 스펙 §8/§11
        state.comboScore.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
        flashHud('hud-hearts');
      } else if (r.type === 'bomb') {
        state.timeRemaining = Math.max(0, state.timeRemaining - 3); // 스펙 §8
        state.comboScore.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'bomb');
        flashHud('hud-ticker'); // 시간 −3 — 티커 전체를 잠깐 번쩍
      }
    });

    if (results.length === 0) {
      MG.HitFx.whiff(board, hitXFrac, hitYFrac); // 빈 구멍 헛스윙
    }
    if (moleHits > 0) {
      state.hitstopUntil = performance.now() +
        Math.min(HITSTOP_MAX_MS, HITSTOP_BASE_MS + state.comboScore.combo * 10);
    }

    syncPops();
    updateHUD();
    if (state.lives <= 0) {
      finish('lives');
    }
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
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

    runBanked += state.comboScore.score;

    if (finishedRound >= FINAL_ROUND) {
      finishFromRound('done');
      return;
    }

    // 라운드 사이 짧은 안내 후 자동으로 다음 라운드.
    document.getElementById('round-done-title').textContent =
      I18N.t('mole.roundDone', { n: finishedRound });
    document.getElementById('round-done-total').textContent =
      I18N.t('mole.cumulative', { n: runBanked.toLocaleString() });
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
    runBanked += state.comboScore.score;
    finishFromRound(reason);
  }

  // 최종 결과 화면 (10라운드 완주 or 목숨 소진). runBanked 는 이미 확정된 상태.
  function finishFromRound(reason) {
    const total = runBanked;
    const best = loadBest();
    const isNewBest = total > best;
    if (isNewBest) saveBest(total);

    document.getElementById('gameover-reason').textContent =
      I18N.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.allClear');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.score', { n: total.toLocaleString() });
    document.getElementById('gameover-best').textContent = isNewBest
      ? I18N.t('mole.result.newBest', { n: total.toLocaleString() })
      : I18N.t('mole.result.best', { n: Math.max(best, total).toLocaleString() });
    document.getElementById('gameover-overlay').hidden = false;
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgm = document.getElementById('bgm');
    bgm.volume = 0.35;
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') syncBgm(state && !state.ended);
    });

    // 다이얼러 버튼은 시작 화면에도 계속 보인다 (폰 컨셉) — 세션당 한 번만 생성.
    // 시작 화면/카운트다운 동안엔 handleCell 이 앞에서 막으므로 눌러도 아무 일 없다.
    sharedLaneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: GRID_SIZE,
      onCell: handleCell
    });

    showStartScreen();

    document.getElementById('start-btn').addEventListener('click', () => startRound(1, { fresh: true }));
    // 시작 화면(state 없음)에선 허브로, 플레이 중엔 시작 화면으로.
    document.getElementById('btn-back-to-hub').addEventListener('click', () => {
      if (state) showStartScreen();
      else window.location.href = '../index.html';
    });
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startRound(1, { fresh: true }));
    document.getElementById('gameover-select-btn').addEventListener('click', showStartScreen);

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = () => startRound(1, { fresh: true });
    window.__debugStartRound = (n) => startRound(n, { fresh: true });
    window.__debugEndRound = function () {
      if (state && !state.ended) { state.timeRemaining = 0; roundComplete(); }
    };
    window.__debugForceGameOver = function () {
      if (!state) return;
      state.lives = 0;
      finish('lives');
    };
    window.__debugHitCell = function (regionId) {
      if (state) handleCell(regionId);
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
  });
})();

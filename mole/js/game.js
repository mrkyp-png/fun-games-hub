(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const BEST_KEY = 'moleBestScore';
  const START_LIVES = 3; // 스펙 §11
  const GRID_SIZE = 4;   // 4x4 = 16칸 고정 격자
  const ROUND_SECONDS = 60; // 점수 어택: 1분 한 판

  // 점수 어택 난이도 — 60초에 걸쳐 동시 두더지 수만 완만히 2→4로 올린다.
  // (레벨별 난이도 표 MG.LEVELS 는 나중에 스테이지/모드를 붙일 때 쓰려고 남겨둠.)
  const MOLES_START = 2;
  const MOLES_END = 4;
  const MOLE_DURATION = 1.5;
  const MAX_ANIMALS = 1;
  const MAX_BOMBS = 1;
  const BGM_VOLUME = 0.35;

  let bgm = null; // <audio id="bgm"> — DOMContentLoaded 에서 잡는다
  // playIntent=true 이고 설정에서 BGM 이 켜져 있을 때만 재생. 아니면 정지.
  function syncBgm(playIntent) {
    if (!bgm) return;
    if (window.FGH.Settings.get('music') && playIntent) {
      bgm.play().catch(() => { /* 자동재생 차단 — 다음 제스처/토글에 재시도 */ });
    } else {
      bgm.pause();
    }
  }

  let state = null; // 플레이 중인 게임 상태 (시작 화면일 땐 null)
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성
  let sessionGen = 0; // startGame/showStartScreen 호출마다 +1 — 카운트다운 타이머 취소 토큰

  function loadBest() {
    const v = parseInt(localStorage.getItem(BEST_KEY), 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBest(score) {
    localStorage.setItem(BEST_KEY, String(score));
  }

  // ---------- 시작 화면 ----------
  function showStartScreen() {
    sessionGen++; // 진행 중이던 카운트다운 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneControls) state.laneControls.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    state = null;
    syncBgm(false); // 허브 시작 화면으로 나오면 BGM 정지
    document.getElementById('game-screen').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-intro-overlay').hidden = true;
    document.getElementById('start-screen').hidden = false;

    const best = loadBest();
    document.getElementById('start-best').textContent =
      best > 0 ? I18N.t('mole.start.best', { n: best.toLocaleString() }) : '';
  }

  // ---------- 게임 시작 ----------
  function startGame() {
    sessionGen++;
    const myGen = sessionGen;
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneControls) state.laneControls.clear();
    if (state && state.laneHammer) state.laneHammer.clear();

    document.getElementById('start-screen').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').hidden = false;
    syncBgm(true); // 시작 버튼(사용자 제스처) 직후 — 설정에서 켜져 있으면 재생

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-' + Date.now())) };
    const { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: GRID_SIZE });

    // 동시 두더지 수(maxConcurrentMoles)는 매 프레임 loop()에서 갱신한다 —
    // 스케줄러는 이 config 객체를 즉석으로 읽으므로 참조만 넘겨두면 램프가 걸린다.
    const config = {
      maxConcurrentMoles: MOLES_START,
      maxConcurrentAnimals: MAX_ANIMALS,
      maxConcurrentBombs: MAX_BOMBS,
      popDuration: MOLE_DURATION,
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
    const laneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: GRID_SIZE,
      onCell: handleCell
    });

    state = {
      config, regions, spawnPoints, scheduler, holeLayer, laneHammer, laneControls,
      comboScore: MG.ComboScore.create(),
      lives: START_LIVES,
      timeRemaining: ROUND_SECONDS,
      hitstopUntil: 0,
      ended: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };

    updateHUD();
    playRoundIntro(() => {
      if (myGen !== sessionGen || !state) return; // 그 사이 나가버림 — 이 콜백 무효
      state.introActive = false;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    });
  }

  // 3·2·1·시작! 카운트다운을 보여주고 onDone 호출.
  function playRoundIntro(onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const count = document.getElementById('round-intro-count');
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
      endGame('time');
      return;
    }

    // 흐른 시간 비율로 동시 두더지 수를 MOLES_START → MOLES_END 로 끌어올린다.
    const elapsedFrac = 1 - state.timeRemaining / ROUND_SECONDS;
    state.config.maxConcurrentMoles =
      Math.round(MOLES_START + (MOLES_END - MOLES_START) * elapsedFrac);

    state.scheduler.tick(dt);
    state.laneHammer.update(rawDt); // 망치는 히트스톱과 무관하게 부드럽게
    syncPops();

    // 구멍별 버튼 hot: 그 구멍에 두더지(방해물 아님)가 떠 있으면 빛낸다 (스펙 §2.3).
    const moleRegions = new Set();
    state.scheduler.getActivePops().forEach((p) => {
      if (p.type === 'mole' && !p.dying) moleRegions.add(p.regionId);
    });
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) {
      state.laneControls.setCellHot(id, moleRegions.has(id));
    }

    updateHUD();
    rafId = requestAnimationFrame(loop);
  }

  function updateHUD() {
    MG.HUD.update({
      lives: state.lives,
      timeRemaining: state.timeRemaining,
      combo: state.comboScore.combo,
      isMaxCombo: state.comboScore.isMaxCombo(),
      score: state.comboScore.score
    });
  }

  function syncPops() {
    sharedPopElements.sync(state.scheduler.getActivePops());
  }

  // ---------- 구멍 버튼 입력 → 그 구멍 타격 ----------
  function handleCell(regionId) {
    if (!state || state.ended || state.introActive) return;
    const results = state.scheduler.resolveRegion(regionId);
    const sp = state.spawnPoints[regionId];

    // 망치 목표: 그 구멍의 pop 좌표(있으면), 없으면 그 구멍 위치.
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
          // 다타 두더지 빼꼼/모자 단계 타격 — 점수/콤보는 마지막 타격에만.
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
      state.hitstopUntil = performance.now() + Math.min(120, 70 + state.comboScore.combo * 10);
    }

    syncPops();
    updateHUD();
    if (state.lives <= 0) {
      endGame('lives');
    }
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
  }

  // ---------- 종료 → 결과 화면 ----------
  function endGame(reason) {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    sharedPopElements.clear();

    const score = state.comboScore.score;
    const best = loadBest();
    const isNewBest = score > best;
    if (isNewBest) saveBest(score);

    document.getElementById('gameover-reason').textContent =
      I18N.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.time');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.score', { n: score.toLocaleString() });
    document.getElementById('gameover-best').textContent = isNewBest
      ? I18N.t('mole.result.newBest', { n: score.toLocaleString() })
      : I18N.t('mole.result.best', { n: Math.max(best, score).toLocaleString() });
    document.getElementById('gameover-overlay').hidden = false;
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgm = document.getElementById('bgm');
    bgm.volume = BGM_VOLUME;
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') syncBgm(state && !state.ended);
    });

    showStartScreen();

    document.getElementById('start-btn').addEventListener('click', () => startGame());
    document.getElementById('btn-back-to-hub').addEventListener('click', showStartScreen);
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startGame());
    document.getElementById('gameover-select-btn').addEventListener('click', showStartScreen);

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = startGame;
    window.__debugEndRound = function () {
      if (state) endGame('time');
    };
    window.__debugForceGameOver = function () {
      if (!state) return;
      state.lives = 0;
      endGame('lives');
    };
    window.__debugHitCell = function (regionId) {
      if (state) handleCell(regionId);
    };
    window.__debugIntroActive = function () {
      return !!(state && state.introActive);
    };
  });
})();

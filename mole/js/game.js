(function () {
  'use strict';

  const MG = window.MoleGame;
  const PROGRESS_KEY = 'moleGameProgress';
  const START_LIVES = 3; // 스펙 §11
  const GRID_SIZE = 4; // 사용자 확정: 그림을 4x4 = 16칸 고정 격자로 분할

  let state = null; // 현재 플레이 중인 게임 상태 (레벨 선택 화면일 땐 null)
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성

  // ---------- 진행 상황 저장 (레벨 해금/별) ----------
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }
  function isLevelUnlocked(level, progress) {
    if (level === 1) return true;
    return !!(progress[level - 1] && progress[level - 1].cleared);
  }

  // ---------- 레벨 선택 화면 ----------
  function renderLevelSelect() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    const progress = loadProgress();
    MG.LEVELS.forEach((lv) => {
      const unlocked = isLevelUnlocked(lv.level, progress);
      const entry = progress[lv.level];
      const stars = entry ? entry.stars : 0;

      const btn = document.createElement('button');
      btn.className = 'level-card';
      btn.dataset.locked = String(!unlocked);
      btn.innerHTML =
        '<span class="level-num">' + (unlocked ? lv.level : '🔒') + '</span>' +
        '<span class="level-stars">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '</span>';
      if (unlocked) btn.addEventListener('click', () => startLevel(lv.level));
      grid.appendChild(btn);
    });
  }

  function backToSelect() {
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneControls) state.laneControls.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    state = null;
    document.getElementById('game-screen').hidden = true;
    document.getElementById('clear-overlay').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('level-select-screen').hidden = false;
    renderLevelSelect();
  }

  // ---------- 레벨 시작 ----------
  async function startLevel(levelNum) {
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneControls) state.laneControls.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    const levelData = MG.LEVELS[levelNum - 1];

    document.getElementById('level-select-screen').hidden = true;
    document.getElementById('clear-overlay').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').hidden = false;

    const emojiUrl = 'assets/emoji/' + levelData.emojiId + '.svg';
    document.getElementById('mole-emoji-img').src = emojiUrl;

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-level-' + levelNum + '-' + Date.now())) };

    const { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: GRID_SIZE });

    const scheduler = MG.SpawnScheduler.create({
      regions, spawnPoints,
      config: {
        maxConcurrentMoles: levelData.maxConcurrentMoles,
        maxConcurrentAnimals: levelData.maxConcurrentAnimals,
        maxConcurrentBombs: levelData.maxConcurrentBombs,
        popDuration: levelData.moleDuration,
        molePoseCount: MG.MoleSprites.POSE_COUNT,
        obstacleCount: MG.MoleSprites.OBSTACLE_COUNT
      },
      rng
    });

    const regionReveal = MG.RegionReveal.create({
      canvas: document.getElementById('mole-reveal-canvas')
    });
    regionReveal.reset();

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
      levelData, regions, spawnPoints, scheduler, regionReveal, holeLayer,
      laneHammer, laneControls,
      comboScore: MG.ComboScore.create(),
      lives: START_LIVES,
      timeRemaining: levelData.timeLimit,
      hitstopUntil: 0,
      ended: false
    };

    updateHUD();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
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
      gameOver('time');
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
      state.laneControls.setCellHot(id, moleRegions.has(id));
    }

    updateHUD();

    if (state.scheduler.isComplete() && !state.laneHammer.isBusy()) {
      levelClear();
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  function updateHUD() {
    MG.HUD.update({
      level: state.levelData.level,
      lives: state.lives,
      timeRemaining: state.timeRemaining,
      combo: state.comboScore.combo,
      isMaxCombo: state.comboScore.isMaxCombo(),
      score: state.comboScore.score,
      completedRegions: state.scheduler.completedRegionCount(),
      regionCount: state.levelData.regionCount
    });
  }

  function syncPops() {
    sharedPopElements.sync(state.scheduler.getActivePops());
  }

  // ---------- 구멍 버튼 입력 → 그 구멍 타격 (기획서 §4/§5 v1.5) ----------
  function handleCell(regionId) {
    if (!state || state.ended) return;
    const results = state.scheduler.resolveRegion(regionId);
    const sp = state.spawnPoints[regionId];

    // 망치 목표: 그 구멍의 pop 좌표(있으면), 없으면 그 구멍 위치.
    const primary = results[0] || null;
    const targetX = primary ? primary.xFrac : sp.x;
    const targetY = primary ? primary.yFrac : sp.y;

    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, results));
  }

  function onHammerImpact(hitXFrac, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;

    results.forEach((r) => {
      if (r.type === 'mole') {
        if (r.done) {
          state.comboScore.onMoleHit();   // 스펙 §12 — 마리당 1콤보
          state.regionReveal.lighten();   // 배경 실루엣 옅게 (스펙 §13)
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          // 다타 두더지 빼꼼/모자 단계 타격 — 점수/콤보/실루엣은 마지막 타격에만 (스펙 §12).
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
        flashHud('hud-time');
      }
    });

    if (results.length === 0) {
      MG.HitFx.whiff(board, hitXFrac); // 빈 구멍 헛스윙
    }
    if (moleHits > 0) {
      state.hitstopUntil = performance.now() + Math.min(120, 70 + state.comboScore.combo * 10);
    }

    syncPops();
    updateHUD();
    if (state.lives <= 0) {
      gameOver('lives');
    }
    // 레벨 완성 판정은 메인 루프가 망치 스윙이 끝난 뒤 처리한다 (loop 참고).
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
  }

  // ---------- 종료 처리 ----------
  function levelClear() {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);

    // 반짝임 연출 도중 완성 전 두더지/방해물 pop이 남아 보이지 않도록 먼저 정리한다.
    sharedPopElements.clear();

    const stars = MG.ComboScore.computeStars(state.lives, START_LIVES);
    const coins = Math.floor(state.comboScore.score / 50); // 코인 지급량은 스펙 미지정, Claude 결정치

    // 스펙 §14: 마지막 영역 완성은 일반 영역 완성보다 강한 연출 (반짝임 플래시) →
    // 그 다음 CLEAR 화면. 반짝임이 opaque한 clear-overlay(z-index 10)에 곧바로
    // 가려지지 않도록, mole-board-sparkle 애니메이션(0.6s) 재생 시간만큼 오버레이
    // 표시를 지연시킨다.
    const board = document.getElementById('mole-board');
    board.classList.add('sparkle');
    setTimeout(() => board.classList.remove('sparkle'), 700);

    const progress = loadProgress();
    const prevStars = (progress[state.levelData.level] && progress[state.levelData.level].stars) || 0;
    progress[state.levelData.level] = { cleared: true, stars: Math.max(stars, prevStars) };
    saveProgress(progress);

    setTimeout(() => {
      document.getElementById('clear-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      document.getElementById('clear-score').textContent = state.comboScore.score + '점';
      document.getElementById('clear-coins').textContent = '🪙 ' + coins;
      document.getElementById('clear-next-btn').hidden = state.levelData.level >= 10;
      document.getElementById('clear-overlay').hidden = false;
    }, 650);
  }

  function gameOver(reason) {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);

    document.getElementById('gameover-level').textContent = 'Level ' + state.levelData.level;
    document.getElementById('gameover-reason').textContent = reason === 'time' ? '시간 초과' : '목숨 소진';
    document.getElementById('gameover-overlay').hidden = false;
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    renderLevelSelect();

    document.getElementById('btn-back-to-hub').addEventListener('click', backToSelect);
    document.getElementById('clear-retry-btn').addEventListener('click', () => startLevel(state.levelData.level));
    document.getElementById('clear-select-btn').addEventListener('click', backToSelect);
    document.getElementById('clear-next-btn').addEventListener('click', () => startLevel(state.levelData.level + 1));
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startLevel(state.levelData.level));
    document.getElementById('gameover-select-btn').addEventListener('click', backToSelect);

    // 디버그 훅 — 지렁이 게임(__debugStartLevel 등)과 동일 컨벤션, 영구 보존.
    window.__debugStartLevel = startLevel;
    window.__debugClearAllRegions = function () {
      if (!state) return;
      state.scheduler.forceCompleteAll();
      syncPops();
      levelClear();
    };
    window.__debugForceGameOver = function () {
      if (!state) return;
      state.lives = 0;
      gameOver('lives');
    };
    window.__debugHitCell = function (regionId) {
      if (state) handleCell(regionId);
    };
  });
})();

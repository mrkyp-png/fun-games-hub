(function () {
  'use strict';

  const MG = window.MoleGame;
  const PROGRESS_KEY = 'moleGameProgress';
  const START_LIVES = 3; // 스펙 §11
  const MASK_SIZE = 96;

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
    const levelData = MG.LEVELS[levelNum - 1];

    document.getElementById('level-select-screen').hidden = true;
    document.getElementById('clear-overlay').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').hidden = false;

    const emojiUrl = 'assets/emoji/' + levelData.emojiId + '.svg';
    document.getElementById('mole-emoji-img').src = emojiUrl;

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-level-' + levelNum + '-' + Date.now())) };

    const mask = await MG.EmojiMask.loadMask(emojiUrl, MASK_SIZE);
    const { regions } = MG.RegionPartition.partition({
      width: mask.width, height: mask.height, points: mask.points,
      regionCount: levelData.regionCount, rng
    });
    const { spawnPoints } = MG.SpawnPlacement.place({ regions, width: mask.width, height: mask.height, rng });

    const scheduler = MG.SpawnScheduler.create({
      regions, spawnPoints,
      config: {
        maxConcurrentMoles: levelData.maxConcurrentMoles,
        maxConcurrentAnimals: levelData.maxConcurrentAnimals,
        maxConcurrentBombs: levelData.maxConcurrentBombs,
        popDuration: levelData.moleDuration
      },
      rng
    });

    const regionReveal = MG.RegionReveal.create({
      canvas: document.getElementById('mole-reveal-canvas'),
      width: mask.width, height: mask.height
    });
    regionReveal.reset();

    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onHit: handlePopHit
      });
    }
    sharedPopElements.clear();

    state = {
      levelData, regions, spawnPoints, scheduler, regionReveal,
      comboScore: MG.ComboScore.create(),
      lives: START_LIVES,
      timeRemaining: levelData.timeLimit,
      ended: false
    };

    updateHUD();
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  // ---------- 메인 루프 ----------
  function loop(now) {
    if (!state || state.ended) return;
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      gameOver('time');
      return;
    }

    state.scheduler.tick(dt);
    sharedPopElements.sync(state.scheduler.getActivePops());
    updateHUD();

    if (state.scheduler.isComplete()) {
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

  // ---------- 터치 처리 ----------
  function handlePopHit(popId, x, y) {
    if (!state || state.ended) return;
    const result = state.scheduler.resolveHit(popId);
    if (!result) return; // 이미 만료된 뒤 늦게 도착한 이벤트

    MG.HammerFx.trigger(document.getElementById('mole-pop-layer'), x, y);

    if (result.type === 'mole') {
      state.comboScore.onMoleHit(); // 스펙 §12
      state.regionReveal.revealRegion(state.regions[result.regionId]); // 스펙 §13
    } else if (result.type === 'animal') {
      state.comboScore.onObstacleHit();
      state.lives -= 1; // 스펙 §8/§11
      if (state.lives <= 0) {
        sharedPopElements.sync(state.scheduler.getActivePops());
        updateHUD();
        gameOver('lives');
        return;
      }
    } else if (result.type === 'bomb') {
      state.comboScore.onObstacleHit();
      state.timeRemaining = Math.max(0, state.timeRemaining - 3); // 스펙 §8
      MG.HammerFx.trigger(document.getElementById('mole-pop-layer'), x, y, '💥'); // §8 폭발 연출
    }

    sharedPopElements.sync(state.scheduler.getActivePops());
    updateHUD();

    if (state.scheduler.isComplete()) levelClear();
  }

  // ---------- 종료 처리 ----------
  function levelClear() {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);

    const stars = MG.ComboScore.computeStars(state.lives, START_LIVES);
    const coins = Math.floor(state.comboScore.score / 50); // 코인 지급량은 스펙 미지정, Claude 결정치

    // 스펙 §14: 마지막 영역 완성은 일반 영역 완성보다 강한 연출 (반짝임 플래시).
    const board = document.getElementById('mole-board');
    board.classList.add('sparkle');
    setTimeout(() => board.classList.remove('sparkle'), 700);

    const progress = loadProgress();
    const prevStars = (progress[state.levelData.level] && progress[state.levelData.level].stars) || 0;
    progress[state.levelData.level] = { cleared: true, stars: Math.max(stars, prevStars) };
    saveProgress(progress);

    document.getElementById('clear-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('clear-score').textContent = state.comboScore.score + '점';
    document.getElementById('clear-coins').textContent = '🪙 ' + coins;
    document.getElementById('clear-next-btn').hidden = state.levelData.level >= 10;
    document.getElementById('clear-overlay').hidden = false;
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
      sharedPopElements.sync(state.scheduler.getActivePops());
      levelClear();
    };
    window.__debugForceGameOver = function () {
      if (!state) return;
      state.lives = 0;
      gameOver('lives');
    };
  });
})();

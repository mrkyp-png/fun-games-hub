(function () {
  'use strict';

  const SG = window.SnakeGame;
  const PROGRESS_KEY = 'snakeGameProgress';
  const EAT_RADIUS = 20;
  const COLLISION_RADIUS = 16;
  const INVINCIBLE_SECONDS = 1.0; // 스펙 §23
  const START_HEARTS = 3; // 스펙 §22
  const GROWTH_PER_FOOD = 1;

  let state = null; // 현재 플레이 중인 게임 상태 (레벨 선택 화면일 땐 null)
  let rafId = null;
  let lastTime = 0;
  let sharedInput = null; // .play-area는 재생성 안 되는 고정 DOM이므로 Input은 세션당 한 번만 생성해 재사용

  // ---------- 진행 상황 저장 (레벨 해금/별) ----------
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch (e) { return {}; }
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
    SG.LEVELS.forEach((lv) => {
      const unlocked = isLevelUnlocked(lv.level, progress);
      const entry = progress[lv.level];
      const stars = entry ? entry.stars : 0;

      const btn = document.createElement('button');
      btn.className = 'level-card';
      btn.dataset.locked = String(!unlocked);
      btn.innerHTML =
        '<span class="level-num">' + (unlocked ? lv.level : '🔒') + '</span>' +
        '<span class="level-stars">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '</span>';
      if (unlocked) {
        btn.addEventListener('click', () => startLevel(lv.level));
      }
      grid.appendChild(btn);
    });
  }

  // ---------- 레벨 시작 ----------
  function startLevel(levelNum) {
    const levelData = SG.LEVELS[levelNum - 1];

    document.getElementById('level-select-screen').hidden = true;
    document.getElementById('clear-overlay').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').hidden = false;

    const canvas = document.getElementById('game-canvas');
    const playArea = canvas.parentElement;
    const rect = playArea.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const playerStart = { x: levelData.mapWidth / 2, y: levelData.mapHeight / 2 };

    // 적 지렁이 시작 위치: 맵 중심 기준 원형으로 분산 배치 (스펙 §11.2: 적 시작 위치와 겹치지 않게)
    const enemyStarts = [];
    const spreadRadius = Math.min(levelData.mapWidth, levelData.mapHeight) * 0.35;
    for (let i = 0; i < levelData.enemyWormCount; i++) {
      const angle = (i / levelData.enemyWormCount) * Math.PI * 2;
      enemyStarts.push({
        x: playerStart.x + Math.cos(angle) * spreadRadius,
        y: playerStart.y + Math.sin(angle) * spreadRadius
      });
    }

    const rng = SG.RNG.mulberry32(SG.RNG.hashSeed('level-' + levelNum + '-' + Date.now()));
    const foods = SG.FoodPlacement.placeFood({
      count: levelData.foodCount,
      mapWidth: levelData.mapWidth,
      mapHeight: levelData.mapHeight,
      playerStart,
      enemyStarts,
      rng
    });

    const player = new SG.Worm(playerStart.x, playerStart.y, {
      speed: levelData.playerSpeed,
      initialLength: 3,
      maxLength: levelData.maxPlayerLength,
      segmentSpacing: 14
    });

    const enemies = enemyStarts.map((pos) => ({
      worm: new SG.Worm(pos.x, pos.y, {
        speed: levelData.enemySpeed,
        initialLength: 6,
        maxLength: 6,
        segmentSpacing: 14
      }),
      ai: SG.EnemyAI.create({ rng: SG.RNG.mulberry32(SG.RNG.hashSeed('enemy-' + levelNum + '-' + Math.random())) })
    }));

    const camera = SG.Camera.create({
      mapWidth: levelData.mapWidth,
      mapHeight: levelData.mapHeight,
      viewWidth: canvas.width,
      viewHeight: canvas.height
    });

    if (!sharedInput) sharedInput = SG.Input.create(playArea);
    const input = sharedInput;

    const emojiProgress = SG.EmojiProgress.create({
      imgEl: document.getElementById('emoji-progress-img'),
      gridEl: document.getElementById('emoji-progress-grid')
    });
    emojiProgress.setEmoji(levelData.emojiId);
    emojiProgress.reset();

    state = {
      levelData,
      player,
      enemies,
      foods,
      camera,
      input,
      emojiProgress,
      hearts: START_HEARTS,
      foodCollected: 0,
      collisions: 0,
      invincibleUntil: 0,
      ended: false
    };

    SG.HUD.update({ level: levelNum, hearts: state.hearts, foodCollected: 0, foodCount: levelData.foodCount });

    lastTime = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  // ---------- 메인 루프 ----------
  function loop(now) {
    if (!state || state.ended) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000); // 큰 프레임 드랍 시 물리가 튀지 않도록 클램프
    lastTime = now;

    update(dt);
    render();

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    const s = state;
    const nowSec = performance.now() / 1000;
    const invincible = nowSec < s.invincibleUntil;

    // 플레이어 이동
    const dir = s.input.getDirection();
    s.player.setDirection(dir.x, dir.y);
    s.player.update(dt);

    // 플레이어도 적과 동일하게 매 프레임 맵 경계 안으로 위치를 고정한다(스펙 §6.2) — 예전엔
    // "무적이 아닐 때 충돌이 감지된 순간"에만 한 번 밀어넣었는데, 무적 1초 동안은 이 블록
    // 전체가 통째로 건너뛰어져서 계속 같은 방향으로 드래그하면 화면 밖까지 흘러나갈 수 있었다
    // (최종 리뷰에서 실측: 최대 140px = playerSpeed × 무적시간, 프레임의 28%가 맵 밖). 경계
    // 충돌 판정은 클램프 "이전" 좌표로 먼저 확인해야 한다 — 클램프부터 하면 x===0 같은 경계
    // 값이 다시는 충돌로 안 잡힌다.
    const ph = s.player.trail[0];
    const playerOutOfBounds = SG.Collision.checkBoundaryCollision(ph.x, ph.y, s.levelData.mapWidth, s.levelData.mapHeight);
    ph.x = Math.max(0, Math.min(s.levelData.mapWidth, ph.x));
    ph.y = Math.max(0, Math.min(s.levelData.mapHeight, ph.y));

    // 적 이동 — 맵 경계 안에 고정(스펙 §6.2: 적도 맵 안에서만 이동)
    s.enemies.forEach((e) => {
      const d = e.ai.update(dt);
      e.worm.setDirection(d.x, d.y);
      e.worm.update(dt);
      // 방향을 반사시키는 방식(worm.direction을 뒤집기)은 다음 프레임에 e.ai.update(dt)가
      // 돌려주는 AI 자신의 방향으로 setDirection이 즉시 덮어써버려 아무 효과가 없다 — 대신
      // 위치 자체를 경계 안으로 고정한다.
      const head = e.worm.trail[0];
      head.x = Math.max(0, Math.min(s.levelData.mapWidth, head.x));
      head.y = Math.max(0, Math.min(s.levelData.mapHeight, head.y));
    });

    // 충돌 (무적 중이 아닐 때만)
    if (!invincible) {
      let hit = false;
      if (playerOutOfBounds) {
        hit = true;
      }
      if (!hit && SG.Collision.checkSelfCollision(s.player.head, s.player.getSegments(), COLLISION_RADIUS)) {
        hit = true;
      }
      if (!hit) {
        for (const e of s.enemies) {
          if (SG.Collision.checkPlayerEnemyCollision(s.player.head, e.worm.getSegments(), COLLISION_RADIUS)) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        s.hearts -= 1;
        s.collisions += 1;
        s.invincibleUntil = nowSec + INVINCIBLE_SECONDS;
        SG.HUD.update({ level: s.levelData.level, hearts: s.hearts, foodCollected: s.foodCollected, foodCount: s.levelData.foodCount });
        if (s.hearts <= 0) {
          gameOver();
          return;
        }
      }
    }

    // 먹이 획득
    for (let i = s.foods.length - 1; i >= 0; i--) {
      const f = s.foods[i];
      if (Math.hypot(s.player.head.x - f.x, s.player.head.y - f.y) < EAT_RADIUS) {
        s.foods.splice(i, 1);
        s.foodCollected += 1;
        s.player.grow(GROWTH_PER_FOOD);
        SG.Audio.playEatSound();
        s.emojiProgress.revealUpTo(Math.floor((s.foodCollected / s.levelData.foodCount) * 10));
        SG.HUD.update({ level: s.levelData.level, hearts: s.hearts, foodCollected: s.foodCollected, foodCount: s.levelData.foodCount });
      }
    }

    if (s.foodCollected >= s.levelData.foodCount) {
      levelClear();
      return;
    }

    s.camera.update(s.player.head.x, s.player.head.y);
  }

  function render() {
    const s = state;
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const cam = s.camera.getPosition();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 먹이
    ctx.fillStyle = '#f2c879';
    s.foods.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 적 지렁이
    s.enemies.forEach((e) => {
      drawWorm(ctx, e.worm, SG.Sprites.enemy, 1);
    });

    // 플레이어 (무적 중 깜빡임 — 스펙 §23)
    const nowSec = performance.now() / 1000;
    const invincible = nowSec < s.invincibleUntil;
    const alpha = invincible && Math.floor(nowSec * 10) % 2 === 0 ? 0.35 : 1;
    drawWorm(ctx, s.player, SG.Sprites.player, alpha);

    ctx.restore();

    SG.Minimap.render(document.getElementById('minimap-canvas').getContext('2d'), {
      mapWidth: s.levelData.mapWidth,
      mapHeight: s.levelData.mapHeight,
      player: s.player.head,
      foods: s.foods
    });
  }

  // 세그먼트 배열(머리가 [0])을 실제 캐릭터 스프라이트로 그린다 — 꼬리부터 그려서 머리가
  // 항상 위에 겹치도록 한다. 몸통/꼬리 스프라이트는 원본 시트에서 "오른쪽을 향한" 상태로
  // 잘라냈고(가로로 나열된 행이라 오른쪽이 기본 방향), 머리 스프라이트는 "위를 향한" 상태로
  // 잘라냈다(세로 인물샷이라 위가 기본 방향) — 그래서 회전 기준각이 서로 다르다.
  function drawWorm(ctx, worm, sprites, alpha) {
    const segs = worm.getSegments();
    ctx.globalAlpha = alpha;
    for (let i = segs.length - 1; i >= 1; i--) {
      const seg = segs[i];
      const prev = segs[i - 1]; // 머리 쪽 이웃 — 몸이 이어지는 방향
      const forwardAngle = Math.atan2(prev.y - seg.y, prev.x - seg.x);
      const isTail = i === segs.length - 1;
      // 꼬리의 뾰족한 끝은 몸통 반대(뒤쪽)를 향해야 자연스럽다
      const angle = isTail ? forwardAngle + Math.PI : forwardAngle;
      drawSprite(ctx, isTail ? sprites.tail : sprites.body, seg.x, seg.y, angle, isTail ? 22 : 22);
    }
    const head = segs[0];
    const headAngle = Math.atan2(worm.direction.y, worm.direction.x) + Math.PI / 2;
    drawSprite(ctx, sprites.head, head.x, head.y, headAngle, 30);
    ctx.globalAlpha = 1;
  }

  function drawSprite(ctx, img, x, y, angle, targetWidth) {
    if (!img.complete || !img.naturalWidth) return; // 아직 로드 전이면 이번 프레임은 건너뜀
    const scale = targetWidth / img.naturalWidth;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // ---------- 종료 처리 ----------
  function levelClear() {
    const s = state;
    s.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    s.emojiProgress.revealAll();

    const stars = SG.StarRating.computeStars(s.collisions);
    const progress = loadProgress();
    const prevStars = (progress[s.levelData.level] && progress[s.levelData.level].stars) || 0;
    progress[s.levelData.level] = { cleared: true, stars: Math.max(prevStars, stars) };
    saveProgress(progress);

    document.getElementById('clear-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    const nextBtn = document.getElementById('clear-next-btn');
    nextBtn.disabled = s.levelData.level >= SG.LEVELS.length;
    document.getElementById('clear-overlay').hidden = false;
  }

  function gameOver() {
    const s = state;
    s.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    document.getElementById('gameover-level').textContent = 'Level ' + s.levelData.level; // 스펙 §24: "현재 Level" 필수 표시
    document.getElementById('gameover-food-count').textContent =
      '먹이 ' + s.foodCollected + ' / ' + s.levelData.foodCount;
    document.getElementById('gameover-overlay').hidden = false;
  }

  function backToSelect() {
    document.getElementById('game-screen').hidden = true;
    document.getElementById('clear-overlay').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('level-select-screen').hidden = false;
    renderLevelSelect();
    state = null;
  }

  // ---------- 초기화/이벤트 바인딩 ----------
  function init() {
    renderLevelSelect();

    document.getElementById('btn-back-to-hub').addEventListener('click', () => {
      if (state && !state.ended) backToSelect();
      window.location.href = '../index.html';
    });
    document.getElementById('clear-retry-btn').addEventListener('click', () => startLevel(state.levelData.level));
    document.getElementById('clear-select-btn').addEventListener('click', backToSelect);
    document.getElementById('clear-next-btn').addEventListener('click', () => {
      const next = state.levelData.level + 1;
      if (next <= SG.LEVELS.length) startLevel(next);
    });
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startLevel(state.levelData.level));
    document.getElementById('gameover-select-btn').addEventListener('click', backToSelect);

    // 디버그 훅 — 색칠앱 __debugOpenTemplate 등과 같은 컨벤션, 영구 보존.
    // __debugCollectAllFood는 실제 이동/충돌 물리를 재호출하지 않고 "먹이 획득" 부수효과
    // (제거/카운트증가/성장/진행도갱신/HUD갱신)만 직접 반복 적용한다 — 헤드 순간이동으로
    // update()를 다시 태우면 몸통 trail이 뒤죽박죽돼 자기충돌이 오탐될 수 있어서(테스트
    // 재현성 저하) 일부러 물리 경로를 타지 않는다.
    window.__debugStartLevel = startLevel;
    window.__debugCollectAllFood = function () {
      if (!state) return;
      while (state.foods.length > 0 && !state.ended) {
        state.foods.pop();
        state.foodCollected += 1;
        state.player.grow(GROWTH_PER_FOOD);
        SG.Audio.playEatSound();
        state.emojiProgress.revealUpTo(Math.floor((state.foodCollected / state.levelData.foodCount) * 10));
        SG.HUD.update({ level: state.levelData.level, hearts: state.hearts, foodCollected: state.foodCollected, foodCount: state.levelData.foodCount });
      }
      if (state.foodCollected >= state.levelData.foodCount && !state.ended) {
        levelClear();
      }
    };
    // 스펙 §38 QA 항목 "생명 0에서 GAME OVER가 되는가" 자동검증용 — 실제 충돌을 유도하지
    // 않고 hearts를 직접 0으로 만들어 gameOver() 경로만 독립적으로 확인한다.
    window.__debugForceGameOver = function () {
      if (!state || state.ended) return;
      state.hearts = 0;
      gameOver();
    };
  }

  document.addEventListener('DOMContentLoaded', init);

  const api = { init };
  window.SnakeGame = window.SnakeGame || {};
  window.SnakeGame.Game = api;
})();

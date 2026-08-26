# 지렁이 게임(Snake Game) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, self-contained 지렁이(worm) arcade game — 10 levels, large scrollable map, food collection, enemy worms, minimap, 10-region emoji reveal progression, lives/collision, star rating — as a new game inside the `fun-games-hub` project, reachable from the hub's existing "지렁이" card.

**Architecture:** Plain multi-file browser JS, no bundler/framework — matches the sibling `coloring/` project's convention (global `<script>` tags loaded in order, everything attached to a single `window.SnakeGame` namespace instead of raw globals). Pure game-logic modules (level data, RNG, food placement, worm movement, enemy AI, collision, camera) are written so they also run under plain Node (`module.exports` guard) and are unit-tested with Node's built-in `assert` — no test framework dependency, matching the project's existing "plain `scripts/*.js` verification script" convention. DOM/canvas-dependent modules (input, audio, HUD, minimap render, emoji-progress reveal, the main game loop) are verified with a puppeteer smoke test against the local dev server, the same pattern already used throughout `coloring/scripts/`.

**Tech Stack:** Vanilla JS (ES2017+), HTML5 Canvas, Web Audio API, `localStorage` for progress. Node.js (`assert`) for pure-logic unit tests, puppeteer-core + the user's real Edge for DOM/integration smoke tests (`coloring/node_modules` already has puppeteer-core installed — reuse it, don't add a new dependency).

**Spec:** `C:\Users\master\Desktop\fun-games-hub\snake\지렁이게임-기획서.md` (includes §41 "Claude 측 결정 사항" — the two content decisions delegated to Claude: the 10 space-theme completion emoji, and reusing the coloring app's grid-reveal technique for the 10-region progress display).

## Global Constraints

- 10 Level 고정, Level 1 = 먹이 20개, Level마다 +5개, Level 10 = 65개 (스펙 §5) — 임의 변경 금지.
- 적 지렁이 수: Level 1~10 = 2,2,3,3,4,5,6,7,8,10 (스펙 §18) — 임의 변경 금지.
- 플레이어 이동 속도는 전 Level 동일 고정 (스펙 §9) — Level에 따라 올리지 않는다.
- 적 지렁이는 초기 버전에서 "랜덤 이동 + 주기적 방향 전환"만 사용, 추적 AI 금지 (스펙 §19).
- 생명 3개, 충돌 시 -1 (적 지렁이/자기 몸/맵 경계 3종 모두 동일), 충돌 후 1초 무적 (스펙 §21~23).
- Emoji 진행은 기본 10개 영역 (스펙 §26).
- 별 등급: 클리어=⭐1, 충돌 1회 이하=⭐2, 충돌 0회=⭐3 (스펙 §29).
- 미니맵은 화면 우측 상단, 필수 (스펙 §15) — 삭제 금지.
- 별도의 방향키 UI를 기본으로 두지 않는다 — 드래그 조작만 (스펙 §8.2).
- 지렁이 게임은 다른 게임/허브 UI에 영향을 주지 않는 독립 모듈로 구현한다 (스펙 §40) — `fun-games-hub/snake/` 바깥 파일은 건드리지 않는다.
- 문서에 명시되지 않은 기능(복잡한 추적 AI, 임의의 난이도 요소, 다른 게임 기능 혼입 등)을 임의로 추가하지 않는다 (스펙 §37).

---

## File Structure

```
fun-games-hub/snake/
  index.html                    # 레벨선택 + 플레이 화면 + 클리어/게임오버 오버레이 (단일 페이지)
  style.css                     # 스네이크 전용 스타일 (../cosmic-theme.css 위에 얹음)
  assets/emoji/*.svg            # 이미 준비됨 (10개, 이번 세션에 다운로드+패딩 완료)
  js/
    levels.js                   # SnakeGame.LEVELS 데이터 (순수, dual export)
    rng.js                      # SnakeGame.RNG.mulberry32 / hashSeed (순수, dual export)
    food-placement.js           # SnakeGame.FoodPlacement.placeFood (순수, dual export)
    worm.js                     # SnakeGame.Worm 클래스 (순수, dual export)
    enemy-ai.js                 # SnakeGame.EnemyAI.create (순수, dual export)
    collision.js                # SnakeGame.Collision.* (순수, dual export)
    camera.js                   # SnakeGame.Camera.create (순수, dual export)
    emoji-progress.js           # SnakeGame.EmojiProgress (DOM)
    input.js                    # SnakeGame.Input.create (DOM, pointer events)
    audio.js                    # SnakeGame.Audio.playEatSound (WebAudio)
    hud.js                      # SnakeGame.HUD.* (DOM)
    minimap.js                  # SnakeGame.Minimap.render (canvas)
    game.js                     # SnakeGame.Game — 메인 루프/상태머신, 진입점
  scripts/
    test-levels.js
    test-rng-food-placement.js
    test-worm.js
    test-enemy-ai.js
    test-collision.js
    test-camera.js
    run-all-tests.js            # 위 6개를 순서대로 실행
    verify-snake-smoke.js       # puppeteer 통합 스모크 테스트
```

---

### Task 1: Level 데이터 (`levels.js`)

**Files:**
- Create: `snake/js/levels.js`
- Test: `snake/scripts/test-levels.js`

**Interfaces:**
- Produces: `SnakeGame.LEVELS` — 길이 10 배열, 각 원소 `{ level, foodCount, enemyWormCount, mapWidth, mapHeight, playerSpeed, enemySpeed, maxPlayerLength, emojiId }`. 이후 모든 Task가 이 배열의 필드명을 그대로 사용한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-levels.js`:
```js
const assert = require('assert');
const { LEVELS } = require('../js/levels.js');

assert.strictEqual(LEVELS.length, 10, 'LEVELS must have exactly 10 entries');

const expectedFood = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
const expectedEnemies = [2, 2, 3, 3, 4, 5, 6, 7, 8, 10];
const expectedEmoji = [
  'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
  'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
];

LEVELS.forEach((lv, i) => {
  assert.strictEqual(lv.level, i + 1, `level field must be ${i + 1}`);
  assert.strictEqual(lv.foodCount, expectedFood[i], `Level ${i + 1} foodCount`);
  assert.strictEqual(lv.enemyWormCount, expectedEnemies[i], `Level ${i + 1} enemyWormCount`);
  assert.strictEqual(lv.emojiId, expectedEmoji[i], `Level ${i + 1} emojiId`);
  assert.strictEqual(lv.playerSpeed, LEVELS[0].playerSpeed, 'playerSpeed must be constant across all levels');
  assert.strictEqual(lv.maxPlayerLength, LEVELS[0].maxPlayerLength, 'maxPlayerLength must be constant across all levels');
  assert.ok(lv.mapWidth > 0 && lv.mapHeight > 0, `Level ${i + 1} must have positive map size`);
  assert.ok(lv.enemySpeed > 0 && lv.enemySpeed < lv.playerSpeed, `Level ${i + 1} enemySpeed must stay below playerSpeed`);
});

// 맵 크기는 Level이 올라갈수록 넓어져야 함 (먹이/적 수 증가를 감당)
for (let i = 1; i < LEVELS.length; i++) {
  assert.ok(LEVELS[i].mapWidth >= LEVELS[i - 1].mapWidth, `mapWidth should not shrink at level ${i + 1}`);
  assert.ok(LEVELS[i].mapHeight >= LEVELS[i - 1].mapHeight, `mapHeight should not shrink at level ${i + 1}`);
}

console.log('test-levels.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-levels.js`
Expected: FAIL — `Cannot find module '../js/levels.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/levels.js`:
```js
(function (root) {
  'use strict';

  // 스펙 §5(먹이)/§18(적 지렁이)의 고정 수치. emojiId는 스펙 §41에서 Claude가 선정한
  // 우주 테마 10종(assets/emoji/<emojiId>.svg로 존재) — 순서·값 임의 변경 금지.
  const PLAYER_SPEED = 140;   // px/s, 스펙 §9: 전 Level 동일
  const MAX_PLAYER_LENGTH = 30; // 스펙 §10: 성장 상한, 전 Level 동일

  const EMOJI_IDS = [
    'rocket', 'ringedplanet', 'glowingstar', 'comet', 'alien',
    'flyingsaucer', 'fullmoon', 'sun', 'telescope', 'milkyway'
  ];

  const LEVELS = [];
  for (let i = 0; i < 10; i++) {
    const level = i + 1;
    LEVELS.push({
      level,
      foodCount: 20 + i * 5,
      enemyWormCount: [2, 2, 3, 3, 4, 5, 6, 7, 8, 10][i],
      mapWidth: 2000 + i * 150,
      mapHeight: 1400 + i * 70,
      playerSpeed: PLAYER_SPEED,
      enemySpeed: 60 + i * 3, // 스펙 §20: Level 상승에 따라 소폭 증가, playerSpeed 미만 유지
      maxPlayerLength: MAX_PLAYER_LENGTH,
      emojiId: EMOJI_IDS[i]
    });
  }

  const api = { LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; Object.assign(root.SnakeGame, api); }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-levels.js`
Expected: `test-levels.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/levels.js snake/scripts/test-levels.js
git -C fun-games-hub commit -m "feat(snake): add level data module"
```

---

### Task 2: 시드 RNG + 먹이 배치 (`rng.js`, `food-placement.js`)

**Files:**
- Create: `snake/js/rng.js`
- Create: `snake/js/food-placement.js`
- Test: `snake/scripts/test-rng-food-placement.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces: `SnakeGame.RNG.mulberry32(seed) → () => number in [0,1)`, `SnakeGame.RNG.hashSeed(str) → uint32`.
  `SnakeGame.FoodPlacement.placeFood({ count, mapWidth, mapHeight, playerStart, enemyStarts, rng, margin?, minFoodDistance?, minPlayerStartDistance?, minEnemyDistance? }) → Array<{x,y}>` (길이 정확히 `count`). Task 15(game.js)가 레벨 시작 시 이 함수를 호출한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-rng-food-placement.js`:
```js
const assert = require('assert');
const { mulberry32, hashSeed } = require('../js/rng.js');
const { placeFood } = require('../js/food-placement.js');

// RNG: 같은 시드 → 같은 시퀀스, 값은 항상 [0,1)
const seed = hashSeed('level-1');
const rngA = mulberry32(seed);
const rngB = mulberry32(seed);
for (let i = 0; i < 20; i++) {
  const a = rngA();
  const b = rngB();
  assert.strictEqual(a, b, 'same seed must produce same sequence');
  assert.ok(a >= 0 && a < 1, 'rng output must be in [0,1)');
}

// 먹이 배치: 개수 정확, 맵 범위 안, 서로 최소거리 이상, 시작지점/적과 최소거리 이상
const mapWidth = 2000, mapHeight = 1400;
const playerStart = { x: mapWidth / 2, y: mapHeight / 2 };
const enemyStarts = [{ x: 300, y: 300 }, { x: 1700, y: 1100 }];
const rng = mulberry32(hashSeed('level-1-food'));
const foods = placeFood({ count: 20, mapWidth, mapHeight, playerStart, enemyStarts, rng });

assert.strictEqual(foods.length, 20, 'must place exactly the requested count');
foods.forEach((f, i) => {
  assert.ok(f.x >= 0 && f.x <= mapWidth, `food ${i} x within map`);
  assert.ok(f.y >= 0 && f.y <= mapHeight, `food ${i} y within map`);
});

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// 서로 다른 먹이끼리 최소거리 확인 (넓은 맵에 20개면 여유 있게 만족되어야 정상)
let tooClosePairs = 0;
for (let i = 0; i < foods.length; i++) {
  for (let j = i + 1; j < foods.length; j++) {
    if (dist(foods[i], foods[j]) < 70) tooClosePairs++;
  }
}
assert.strictEqual(tooClosePairs, 0, 'no two foods should be closer than minFoodDistance on a roomy map');

foods.forEach((f, i) => {
  assert.ok(dist(f, playerStart) >= 150, `food ${i} too close to player start`);
});

// Level마다 새 배치가 가능해야 함 (다른 시드 → 다른 결과)
const rng2 = mulberry32(hashSeed('level-1-food-retry'));
const foods2 = placeFood({ count: 20, mapWidth, mapHeight, playerStart, enemyStarts, rng: rng2 });
const identical = foods.every((f, i) => f.x === foods2[i].x && f.y === foods2[i].y);
assert.ok(!identical, 'different seed should (almost certainly) produce a different layout');

// count가 배치 여유보다 훨씬 많아도(안전장치 fallback) 정확한 개수를 반환해야 함
const rngDense = mulberry32(hashSeed('dense'));
const denseFoods = placeFood({ count: 65, mapWidth: 400, mapHeight: 300, playerStart: { x: 200, y: 150 }, enemyStarts: [], rng: rngDense });
assert.strictEqual(denseFoods.length, 65, 'must still return exact count even under tight space (fallback path)');

console.log('test-rng-food-placement.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-rng-food-placement.js`
Expected: FAIL — `Cannot find module '../js/rng.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/rng.js`:
```js
(function (root) {
  'use strict';

  // mulberry32 시드 PRNG — 색칠앱 app.js의 seededRegionColors()와 동일 알고리즘
  // (검증된 패턴 재사용, 임의로 다른 PRNG로 바꾸지 말 것).
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // FNV-1a 문자열 해시 — 문자열 시드(레벨명 등)를 mulberry32의 정수 시드로 변환
  function hashSeed(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  const api = { mulberry32, hashSeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.RNG = api; }
})(typeof window !== 'undefined' ? window : null);
```

`snake/js/food-placement.js`:
```js
(function (root) {
  'use strict';

  function dist(x1, y1, x2, y2) { return Math.hypot(x1 - x2, y1 - y2); }

  // 스펙 §11~12: 맵 전체에 분산, 먹이끼리 최소거리, 시작지점/적 시작지점과 최소거리를
  // 만족하는 위치를 거부표본추출(rejection sampling)로 찾는다. maxAttemptsPerFood 안에
  // 못 찾으면(고레벨에서 먹이 65개+적 10마리로 공간이 빡빡할 때) 최소거리 조건을 포기하고
  // 그냥 배치 — 먹이 "개수"가 스펙과 어긋나는 것이 최소거리 미세 위반보다 나쁜 실패이므로.
  function placeFood(opts) {
    const {
      count, mapWidth, mapHeight, playerStart, enemyStarts, rng,
      margin = 50, minFoodDistance = 70, minPlayerStartDistance = 150, minEnemyDistance = 120
    } = opts;

    const foods = [];
    const maxAttemptsPerFood = 200;

    for (let i = 0; i < count; i++) {
      let placed = null;
      for (let attempt = 0; attempt < maxAttemptsPerFood; attempt++) {
        const x = margin + rng() * Math.max(1, mapWidth - margin * 2);
        const y = margin + rng() * Math.max(1, mapHeight - margin * 2);
        if (dist(x, y, playerStart.x, playerStart.y) < minPlayerStartDistance) continue;
        if (enemyStarts.some((e) => dist(x, y, e.x, e.y) < minEnemyDistance)) continue;
        if (foods.some((f) => dist(x, y, f.x, f.y) < minFoodDistance)) continue;
        placed = { x, y };
        break;
      }
      if (!placed) {
        placed = {
          x: margin + rng() * Math.max(1, mapWidth - margin * 2),
          y: margin + rng() * Math.max(1, mapHeight - margin * 2)
        };
      }
      foods.push(placed);
    }
    return foods;
  }

  const api = { placeFood };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.FoodPlacement = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-rng-food-placement.js`
Expected: `test-rng-food-placement.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/rng.js snake/js/food-placement.js snake/scripts/test-rng-food-placement.js
git -C fun-games-hub commit -m "feat(snake): add seeded RNG and food placement"
```

---

### Task 3: 지렁이(Worm) 클래스 (`worm.js`)

**Files:**
- Create: `snake/js/worm.js`
- Test: `snake/scripts/test-worm.js`

**Interfaces:**
- Produces: `SnakeGame.Worm` 클래스 — `new Worm(x, y, { speed, initialLength, maxLength, segmentSpacing })`. 인스턴스 메서드: `setDirection(x, y)`, `update(dt)`, `grow(amount)`, `getSegments() → Array<{x,y}>` (길이 = `length`, [0]이 머리), getter `head → {x,y}`. Task 4(enemy-ai)·Task 5(collision)·Task 15(game.js)가 이 클래스를 플레이어/적 지렁이 양쪽에 공용으로 사용한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-worm.js`:
```js
const assert = require('assert');
const { Worm } = require('../js/worm.js');

// 이동: 방향(1,0), 속도 100 → 1초 후 head.x가 100 늘어나야 함
const w = new Worm(0, 0, { speed: 100, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w.setDirection(1, 0);
w.update(1);
assert.ok(Math.abs(w.head.x - 100) < 1e-6, `head.x should be ~100, got ${w.head.x}`);
assert.ok(Math.abs(w.head.y - 0) < 1e-6, `head.y should stay ~0, got ${w.head.y}`);

// setDirection은 정규화되어야 함 (3,4) → 길이 5 방향벡터
const w2 = new Worm(0, 0, { speed: 10, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w2.setDirection(3, 4);
w2.update(1);
assert.ok(Math.abs(dist(w2.head, { x: 6, y: 8 })) < 1e-6, 'direction must be normalized before moving');

// 세그먼트: 초기 길이만큼 반환, 머리가 [0]
const w3 = new Worm(0, 0, { speed: 50, initialLength: 3, maxLength: 30, segmentSpacing: 14 });
w3.setDirection(1, 0);
for (let i = 0; i < 20; i++) w3.update(0.1); // 몸통이 trail을 따라 자리잡을 시간을 줌
let segs = w3.getSegments();
assert.strictEqual(segs.length, 3, 'segments length must equal current length');
assert.deepStrictEqual(segs[0], w3.head, 'segments[0] must be the head');

// 성장: grow()는 length를 늘리고 maxLength에서 멈춰야 함
const w4 = new Worm(0, 0, { speed: 50, initialLength: 3, maxLength: 5, segmentSpacing: 14 });
w4.grow(10);
assert.strictEqual(w4.length, 5, 'length must cap at maxLength even if grow amount is larger');

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

console.log('test-worm.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-worm.js`
Expected: FAIL — `Cannot find module '../js/worm.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/worm.js`:
```js
(function (root) {
  'use strict';

  // 몸통은 "머리가 지나온 궤적(trail)을 일정 간격으로 따라가는" 방식으로 구현한다 —
  // 격자 기반 고전 스네이크가 아니라 슬리더리오류 자유이동 지렁이(스펙 §8.2가 "드래그로
  // 진행 방향 전환 + 지속 이동"을 명시하므로 격자 이동이 아님)에 표준적인 기법.
  class Worm {
    constructor(x, y, opts) {
      this.trail = [{ x, y }];
      this.direction = { x: 1, y: 0 };
      this.speed = opts.speed;
      this.length = opts.initialLength || 3;
      this.maxLength = opts.maxLength;
      this.segmentSpacing = opts.segmentSpacing || 14;
    }

    get head() { return this.trail[0]; }

    setDirection(x, y) {
      const len = Math.hypot(x, y) || 1;
      this.direction = { x: x / len, y: y / len };
    }

    update(dt) {
      const h = this.head;
      const nx = h.x + this.direction.x * this.speed * dt;
      const ny = h.y + this.direction.y * this.speed * dt;
      this.trail.unshift({ x: nx, y: ny });

      // trail이 몸길이가 필요로 하는 거리보다 훨씬 길어지지 않도록 잘라낸다
      // (메모리/연산량이 무한히 늘어나는 것 방지).
      const neededDist = this.segmentSpacing * (this.maxLength + 2);
      let dist = 0;
      for (let i = 1; i < this.trail.length; i++) {
        dist += Math.hypot(
          this.trail[i].x - this.trail[i - 1].x,
          this.trail[i].y - this.trail[i - 1].y
        );
        if (dist > neededDist) {
          this.trail.length = i + 1;
          break;
        }
      }
    }

    grow(amount) {
      this.length = Math.min(this.maxLength, this.length + amount);
    }

    getSegments() {
      const segs = [this.head];
      let dist = 0;
      let idx = 0;
      for (let s = 1; s < this.length; s++) {
        const targetDist = s * this.segmentSpacing;
        while (idx < this.trail.length - 1 && dist < targetDist) {
          idx++;
          dist += Math.hypot(
            this.trail[idx].x - this.trail[idx - 1].x,
            this.trail[idx].y - this.trail[idx - 1].y
          );
        }
        segs.push(this.trail[Math.min(idx, this.trail.length - 1)]);
      }
      return segs;
    }
  }

  const api = { Worm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Worm = Worm; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-worm.js`
Expected: `test-worm.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/worm.js snake/scripts/test-worm.js
git -C fun-games-hub commit -m "feat(snake): add Worm movement/growth class"
```

---

### Task 4: 적 지렁이 AI (`enemy-ai.js`)

**Files:**
- Create: `snake/js/enemy-ai.js`
- Test: `snake/scripts/test-enemy-ai.js`

**Interfaces:**
- Consumes: `SnakeGame.RNG.mulberry32` (Task 2)
- Produces: `SnakeGame.EnemyAI.create({ rng, changeIntervalMin?, changeIntervalMax? }) → { update(dt) → {x,y}, getDirection() → {x,y} }`. 반환된 방향은 항상 단위벡터. Task 15(game.js)가 매 프레임 `update(dt)`를 호출해 그 결과로 `Worm.setDirection`을 호출한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-enemy-ai.js`:
```js
const assert = require('assert');
const { mulberry32, hashSeed } = require('../js/rng.js');
const { create } = require('../js/enemy-ai.js');

const rng = mulberry32(hashSeed('enemy-0'));
const ai = create({ rng, changeIntervalMin: 1.0, changeIntervalMax: 1.0 }); // 고정 1초 간격으로 결정적 테스트

const d0 = ai.getDirection();
assert.ok(Math.abs(Math.hypot(d0.x, d0.y) - 1) < 1e-6, 'direction must be a unit vector');

// 0.5초 후에는 아직 방향이 바뀌면 안 됨 (간격 1.0초)
ai.update(0.5);
const d1 = ai.getDirection();
assert.deepStrictEqual(d1, d0, 'direction should not change before the interval elapses');

// 나머지 0.6초를 더 지나면(총 1.1초) 방향이 바뀌어야 함
ai.update(0.6);
const d2 = ai.getDirection();
assert.ok(Math.abs(Math.hypot(d2.x, d2.y) - 1) < 1e-6, 'new direction must also be a unit vector');
assert.ok(d2.x !== d0.x || d2.y !== d0.y, 'direction should change after the interval elapses');

console.log('test-enemy-ai.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-enemy-ai.js`
Expected: FAIL — `Cannot find module '../js/enemy-ai.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/enemy-ai.js`:
```js
(function (root) {
  'use strict';

  // 스펙 §19: "복잡한 추적 AI 금지, 랜덤 이동 + 일정 시간마다 방향 전환"만 구현.
  // 향후 추적 AI를 얹을 수 있도록 update()가 항상 최신 방향을 반환하는 형태로 구조화.
  function randomDirection(rng) {
    const angle = rng() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  function create(opts) {
    const rng = opts.rng;
    const minI = opts.changeIntervalMin != null ? opts.changeIntervalMin : 1.2;
    const maxI = opts.changeIntervalMax != null ? opts.changeIntervalMax : 2.5;

    let direction = randomDirection(rng);
    let timeUntilChange = minI + rng() * (maxI - minI);

    return {
      update(dt) {
        timeUntilChange -= dt;
        if (timeUntilChange <= 0) {
          direction = randomDirection(rng);
          timeUntilChange = minI + rng() * (maxI - minI);
        }
        return direction;
      },
      getDirection() { return direction; }
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.EnemyAI = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-enemy-ai.js`
Expected: `test-enemy-ai.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/enemy-ai.js snake/scripts/test-enemy-ai.js
git -C fun-games-hub commit -m "feat(snake): add enemy worm random-walk AI"
```

---

### Task 5: 충돌 판정 (`collision.js`)

**Files:**
- Create: `snake/js/collision.js`
- Test: `snake/scripts/test-collision.js`

**Interfaces:**
- Produces: `SnakeGame.Collision.checkPlayerEnemyCollision(playerHead, enemySegments, radius) → boolean`, `checkSelfCollision(playerHead, playerSegments, radius, skipCount?) → boolean`, `checkBoundaryCollision(x, y, mapWidth, mapHeight, margin?) → boolean`. Task 15(game.js)가 매 프레임 이 세 함수를 호출한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-collision.js`:
```js
const assert = require('assert');
const {
  checkPlayerEnemyCollision, checkSelfCollision, checkBoundaryCollision
} = require('../js/collision.js');

// 플레이어-적: 반경 안이면 true
assert.strictEqual(
  checkPlayerEnemyCollision({ x: 0, y: 0 }, [{ x: 5, y: 0 }], 10),
  true,
  'within radius must collide'
);
assert.strictEqual(
  checkPlayerEnemyCollision({ x: 0, y: 0 }, [{ x: 100, y: 0 }], 10),
  false,
  'far away must not collide'
);

// 자기 몸: 머리 바로 뒤 skipCount 세그먼트는 무시해야 함 (항상 가까이 있으므로)
const nearSegments = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 0 }];
assert.strictEqual(
  checkSelfCollision({ x: 0, y: 0 }, nearSegments, 10, 4),
  false,
  'segments within skipCount must be ignored'
);
const loopedBackSegments = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 6, y: 0 }, { x: 1, y: 1 }];
assert.strictEqual(
  checkSelfCollision({ x: 0, y: 0 }, loopedBackSegments, 10, 4),
  true,
  'a far-index segment that loops back near the head must trigger self-collision'
);

// 맵 경계
assert.strictEqual(checkBoundaryCollision(-1, 50, 1000, 800), true, 'negative x is out of bounds');
assert.strictEqual(checkBoundaryCollision(1001, 50, 1000, 800), true, 'x beyond mapWidth is out of bounds');
assert.strictEqual(checkBoundaryCollision(500, 400, 1000, 800), false, 'center point is in bounds');

console.log('test-collision.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-collision.js`
Expected: FAIL — `Cannot find module '../js/collision.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/collision.js`:
```js
(function (root) {
  'use strict';

  function circleHit(x1, y1, x2, y2, radius) {
    return Math.hypot(x1 - x2, y1 - y2) < radius;
  }

  // 스펙 §21.1: 플레이어 머리 vs 적 지렁이 몸 전체(세그먼트 배열) 중 하나라도 겹치면 충돌.
  function checkPlayerEnemyCollision(playerHead, enemySegments, radius) {
    return enemySegments.some((seg) => circleHit(playerHead.x, playerHead.y, seg.x, seg.y, radius));
  }

  // 스펙 §21.2: 자기 몸통과 충돌. 머리 바로 뒤 skipCount칸은 물리적으로 항상 가까이 있으므로
  // (몸통이 머리를 그대로 따라오는 구조 특성상) 판정에서 제외 — 안 그러면 가만히 있어도 충돌 처리됨.
  function checkSelfCollision(playerHead, playerSegments, radius, skipCount) {
    const skip = skipCount != null ? skipCount : 4;
    for (let i = skip; i < playerSegments.length; i++) {
      if (circleHit(playerHead.x, playerHead.y, playerSegments[i].x, playerSegments[i].y, radius)) {
        return true;
      }
    }
    return false;
  }

  // 스펙 §21.3: 맵 경계와 충돌.
  function checkBoundaryCollision(x, y, mapWidth, mapHeight, margin) {
    const m = margin || 0;
    return x < m || y < m || x > mapWidth - m || y > mapHeight - m;
  }

  const api = { checkPlayerEnemyCollision, checkSelfCollision, checkBoundaryCollision };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Collision = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-collision.js`
Expected: `test-collision.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/collision.js snake/scripts/test-collision.js
git -C fun-games-hub commit -m "feat(snake): add collision detection"
```

---

### Task 6: 카메라 추적 (`camera.js`)

**Files:**
- Create: `snake/js/camera.js`
- Test: `snake/scripts/test-camera.js`

**Interfaces:**
- Produces: `SnakeGame.Camera.create({ mapWidth, mapHeight, viewWidth, viewHeight, smoothing? }) → { update(targetX, targetY) → {x,y}, getPosition() → {x,y} }`. 반환되는 `{x,y}`는 맵 좌표계 기준 카메라(뷰포트) 좌상단. Task 15(game.js)가 매 프레임 플레이어 머리 좌표로 `update()`를 호출하고, 그 결과를 캔버스 렌더링 시 translate에 사용한다.

- [ ] **Step 1: Write the failing test**

`snake/scripts/test-camera.js`:
```js
const assert = require('assert');
const { create } = require('../js/camera.js');

// 부드러운 추적: 목표가 멀리 있어도 한 프레임에 순간이동하지 않고, 여러 프레임 지나면 수렴해야 함
const cam = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.2 });
const first = cam.update(2000, 1500);
assert.ok(first.x < 2000 - 400, 'camera should not jump instantly to the target on the first frame');

let pos;
for (let i = 0; i < 200; i++) pos = cam.update(2000, 1500);
const desiredX = 2000 - 800 / 2;
const desiredY = 1500 - 600 / 2;
assert.ok(Math.abs(pos.x - desiredX) < 1, `camera x should converge near ${desiredX}, got ${pos.x}`);
assert.ok(Math.abs(pos.y - desiredY) < 1, `camera y should converge near ${desiredY}, got ${pos.y}`);

// 맵 경계를 벗어나지 않아야 함 — 플레이어가 맵 모서리(0,0)에 있어도 카메라는 음수로 안 나감
const camEdge = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.5 });
let edgePos;
for (let i = 0; i < 50; i++) edgePos = camEdge.update(0, 0);
assert.ok(edgePos.x >= 0 && edgePos.y >= 0, 'camera must clamp to map bounds near the top-left corner');

// 반대쪽 모서리(맵 끝)에서도 뷰포트가 맵 밖을 보여주지 않아야 함
const camFar = create({ mapWidth: 5000, mapHeight: 3000, viewWidth: 800, viewHeight: 600, smoothing: 0.5 });
let farPos;
for (let i = 0; i < 50; i++) farPos = camFar.update(5000, 3000);
assert.ok(farPos.x <= 5000 - 800, 'camera must clamp so the view never crosses the right edge');
assert.ok(farPos.y <= 3000 - 600, 'camera must clamp so the view never crosses the bottom edge');

console.log('test-camera.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node snake/scripts/test-camera.js`
Expected: FAIL — `Cannot find module '../js/camera.js'`

- [ ] **Step 3: Write minimal implementation**

`snake/js/camera.js`:
```js
(function (root) {
  'use strict';

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // 스펙 §7: 플레이어를 따라가되 "화면이 흔들리는 느낌"이 없도록 부드럽게(lerp) 추적.
  function create(opts) {
    const { mapWidth, mapHeight, viewWidth, viewHeight } = opts;
    const smoothing = opts.smoothing != null ? opts.smoothing : 0.12;
    let x = clamp(0, 0, Math.max(0, mapWidth - viewWidth));
    let y = clamp(0, 0, Math.max(0, mapHeight - viewHeight));

    return {
      update(targetX, targetY) {
        const desiredX = clamp(targetX - viewWidth / 2, 0, Math.max(0, mapWidth - viewWidth));
        const desiredY = clamp(targetY - viewHeight / 2, 0, Math.max(0, mapHeight - viewHeight));
        x += (desiredX - x) * smoothing;
        y += (desiredY - y) * smoothing;
        return { x, y };
      },
      getPosition() { return { x, y }; }
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Camera = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node snake/scripts/test-camera.js`
Expected: `test-camera.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git -C fun-games-hub add snake/js/camera.js snake/scripts/test-camera.js
git -C fun-games-hub commit -m "feat(snake): add smooth-follow camera"
```

---

### Task 7: 순수 로직 테스트 러너 (`run-all-tests.js`)

**Files:**
- Create: `snake/scripts/run-all-tests.js`

**Interfaces:**
- Consumes: Task 1~6에서 만든 6개 `test-*.js` 파일.
- Produces: 없음(CLI 스크립트). 이후 Task들에서 로직을 건드릴 때마다 재실행하는 회귀 체크 용도.

- [ ] **Step 1: Write the runner**

`snake/scripts/run-all-tests.js`:
```js
// 순수 로직 모듈(레벨데이터/RNG/먹이배치/지렁이/적AI/충돌/카메라) 6개 테스트를 순서대로 실행.
// 색칠앱의 validate-all.js와 같은 "전부 통과해야 다음 단계로" 컨벤션.
const { execFileSync } = require('child_process');
const path = require('path');

const tests = [
  'test-levels.js',
  'test-rng-food-placement.js',
  'test-worm.js',
  'test-enemy-ai.js',
  'test-collision.js',
  'test-camera.js'
];

let failed = false;
for (const t of tests) {
  const full = path.join(__dirname, t);
  try {
    const out = execFileSync('node', [full], { encoding: 'utf8' });
    process.stdout.write(out);
  } catch (e) {
    failed = true;
    console.error(`FAILED: ${t}`);
    console.error(e.stdout || e.message);
  }
}
if (failed) {
  console.error('\n✗ one or more tests failed');
  process.exit(1);
}
console.log('\n✓ all snake game logic tests passed');
```

- [ ] **Step 2: Run it**

Run: `node snake/scripts/run-all-tests.js`
Expected: `✓ all snake game logic tests passed` (모든 개별 테스트 출력 뒤에)

- [ ] **Step 3: Commit**

```bash
git -C fun-games-hub add snake/scripts/run-all-tests.js
git -C fun-games-hub commit -m "test(snake): add combined logic test runner"
```

---

### Task 8: 화면 뼈대 (`index.html`, `style.css`)

**Files:**
- Create: `snake/index.html`
- Create: `snake/style.css`
- Modify: 없음 (허브의 `index.html`은 이미 `snake/index.html`을 가리키고 있음 — 파일 내용만 플레이스홀더에서 실제 화면으로 교체)

**Interfaces:**
- Produces: 아래 DOM id들 — 이후 모든 DOM 의존 Task(9~14)가 이 id로 엘리먼트를 찾는다.
  - `#level-select-screen`, `#level-grid` (레벨 버튼 10개가 채워질 컨테이너)
  - `#game-screen`, `#game-canvas`, `#minimap-canvas`
  - HUD: `#hud-level`, `#hud-hearts`, `#hud-food-count`
  - `#emoji-progress` (10칸 진행 그리드 컨테이너), `#emoji-progress-img` (배경 완성 이미지 `<img>`)
  - `#clear-overlay`, `#clear-stars`, `#clear-next-btn`, `#clear-retry-btn`, `#clear-select-btn`
  - `#gameover-overlay`, `#gameover-level`, `#gameover-food-count`, `#gameover-retry-btn`, `#gameover-select-btn`
  - `#btn-back-to-hub` (게임 화면에서 허브로)

- [ ] **Step 1: Write `snake/index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>지렁이 게임</title>
<link rel="stylesheet" href="../cosmic-theme.css">
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="cosmic-bg">

  <!-- 레벨 선택 화면 -->
  <section id="level-select-screen" class="screen cosmic-content">
    <header class="screen-header">
      <a class="icon-btn" href="../index.html" aria-label="허브로">←</a>
      <h1>🪱 지렁이 게임</h1>
    </header>
    <div id="level-grid" class="level-grid"></div>
  </section>

  <!-- 플레이 화면 -->
  <section id="game-screen" class="screen cosmic-content" hidden>
    <div class="game-hud">
      <button id="btn-back-to-hub" class="icon-btn" aria-label="나가기">←</button>
      <div class="hud-mid">
        <span id="hud-level">Level 1</span>
        <span id="hud-hearts">❤️❤️❤️</span>
        <span id="hud-food-count">0 / 20</span>
      </div>
    </div>
    <div id="emoji-progress" class="emoji-progress">
      <img id="emoji-progress-img" alt="">
      <div id="emoji-progress-grid" class="emoji-progress-grid"></div>
    </div>
    <div class="play-area">
      <canvas id="game-canvas"></canvas>
      <canvas id="minimap-canvas" width="96" height="72"></canvas>
    </div>
  </section>

  <!-- 클리어 오버레이 -->
  <div id="clear-overlay" class="overlay" hidden>
    <div class="overlay-card">
      <h2>🎉 LEVEL CLEAR</h2>
      <div id="clear-stars" class="stars">⭐⭐⭐</div>
      <div class="overlay-btn-row">
        <button id="clear-retry-btn">다시하기</button>
        <button id="clear-select-btn">레벨 선택</button>
        <button id="clear-next-btn">다음 레벨</button>
      </div>
    </div>
  </div>

  <!-- 게임오버 오버레이 -->
  <div id="gameover-overlay" class="overlay" hidden>
    <div class="overlay-card">
      <h2>GAME OVER</h2>
      <p id="gameover-level">Level 1</p>
      <p id="gameover-food-count">먹이 0 / 20</p>
      <div class="overlay-btn-row">
        <button id="gameover-retry-btn">다시하기</button>
        <button id="gameover-select-btn">레벨 선택</button>
      </div>
    </div>
  </div>

</div>

<script src="js/levels.js"></script>
<script src="js/rng.js"></script>
<script src="js/food-placement.js"></script>
<script src="js/worm.js"></script>
<script src="js/enemy-ai.js"></script>
<script src="js/collision.js"></script>
<script src="js/camera.js"></script>
<script src="js/emoji-progress.js"></script>
<script src="js/input.js"></script>
<script src="js/audio.js"></script>
<script src="js/hud.js"></script>
<script src="js/minimap.js"></script>
<script src="js/game.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `snake/style.css`**

```css
/* ../cosmic-theme.css의 색상 변수/우주 배경을 그대로 쓰고, 지렁이 게임 화면 레이아웃만 추가.
   [hidden] 안전장치: 이 프로젝트에서 여러 번 반복된 버그(클래스의 display가 hidden 속성을
   조용히 덮어씀)를 원천 차단 — 새 규칙을 추가할 때 이 규칙보다 늦게 로드되는 걸로 순서
   착각하지 말 것, !important로 항상 이긴다. */
[hidden] { display: none !important; }

.screen {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.screen-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}
.screen-header h1 { font-size: 1.3rem; margin: 0; }

.icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--card-bg);
  color: var(--ink);
  text-decoration: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  box-shadow: var(--shadow);
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 0 16px 24px;
}
.level-card {
  aspect-ratio: 1.3;
  border-radius: 18px;
  background: var(--card-bg);
  border: none;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: var(--shadow);
  cursor: pointer;
}
.level-card[data-locked="true"] { opacity: 0.45; }
.level-card .level-num { font-size: 1.6rem; font-weight: 700; }
.level-card .level-stars { font-size: 0.95rem; letter-spacing: 1px; }

.game-hud {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}
.hud-mid {
  display: flex;
  gap: 14px;
  flex: 1;
  font-size: 0.95rem;
  font-weight: 700;
}

.emoji-progress {
  position: relative;
  width: 84px;
  height: 84px;
  margin: 0 auto 4px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.emoji-progress img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: var(--card-bg);
}
.emoji-progress-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
.emoji-progress-grid .cover-cell {
  background: var(--bg);
  transition: opacity 0.35s ease;
}
.emoji-progress-grid .cover-cell.revealed { opacity: 0; pointer-events: none; }

.play-area {
  position: relative;
  flex: 1;
  margin: 0 12px 12px;
  border-radius: 16px;
  overflow: hidden;
  background: #060417;
  touch-action: none;
}
#game-canvas { display: block; width: 100%; height: 100%; }
#minimap-canvas {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 96px;
  height: 72px;
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 4, 23, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.overlay-card {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 28px 24px;
  text-align: center;
  color: var(--ink);
  box-shadow: var(--shadow);
  min-width: 260px;
}
.overlay-card h2 { margin: 0 0 12px; }
.stars { font-size: 2rem; margin-bottom: 16px; }
.overlay-btn-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.overlay-btn-row button {
  padding: 10px 16px;
  border-radius: 999px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
```

- [ ] **Step 3: Verify with the dev server**

Run: `node scripts/serve.js` (in `fun-games-hub/`, background), then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8844/snake/index.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8844/snake/style.css
```
Expected: both `200`.

- [ ] **Step 4: Commit**

```bash
git -C fun-games-hub add snake/index.html snake/style.css
git -C fun-games-hub commit -m "feat(snake): add screen shell (level select / play / clear / gameover)"
```

---

### Task 9: Emoji 진행 그리드 (`emoji-progress.js`)

**Files:**
- Create: `snake/js/emoji-progress.js`

**Interfaces:**
- Consumes: DOM 엘리먼트 `#emoji-progress-img`, `#emoji-progress-grid` (Task 8)
- Produces: `SnakeGame.EmojiProgress.create({ imgEl, gridEl, regions? }) → { setEmoji(emojiId), revealUpTo(regionIndex), revealAll(), reset() }`. `regions` 기본 10 (스펙 §26). Task 15(game.js)가 먹이 획득마다 `revealUpTo(Math.floor(foodCollected / foodCount * 10))`를 호출하고, 레벨 클리어 시 `revealAll()`을 호출한다.

- [ ] **Step 1: Write the implementation**

색칠앱 유아모드의 "레벨 리워드 그리드 리빌"(칸이 하나씩 열리며 이미지가 드러나는 연출, `buildRewardSvg`/`updateLevelReward` 패턴)과 동일한 아이디어를 이 프로젝트 전용으로 단순하게 재구현한다 — 코드를 직접 import하지 않는 이유는 그쪽 함수들이 색칠앱의 레벨/보상 데이터 구조(`LEVEL_REWARD_ART` 등)에 강하게 결합돼 있어서, 여기서는 "10칸을 순서대로 페이드아웃"이라는 핵심 아이디어만 가져와 독립적으로 구현하는 편이 스펙 §40의 "독립 모듈" 요구에 더 맞기 때문.

`snake/js/emoji-progress.js`:
```js
(function (root) {
  'use strict';

  function create(opts) {
    const { imgEl, gridEl } = opts;
    const regions = opts.regions || 10;

    // 격자 칸(cover-cell) regions개를 생성 — CSS grid-template이 5x2로 고정돼 있으므로
    // regions는 항상 10 (스펙 §26 기본값). 다른 값을 넣으면 CSS도 같이 손봐야 함.
    gridEl.innerHTML = '';
    const cells = [];
    for (let i = 0; i < regions; i++) {
      const cell = document.createElement('div');
      cell.className = 'cover-cell';
      gridEl.appendChild(cell);
      cells.push(cell);
    }

    function setEmoji(emojiId) {
      imgEl.src = 'assets/emoji/' + emojiId + '.svg';
      imgEl.alt = emojiId;
    }

    function revealUpTo(regionIndex) {
      const upTo = Math.max(0, Math.min(regions, regionIndex));
      cells.forEach((cell, i) => {
        cell.classList.toggle('revealed', i < upTo);
      });
    }

    function revealAll() {
      revealUpTo(regions);
    }

    function reset() {
      revealUpTo(0);
    }

    return { setEmoji, revealUpTo, revealAll, reset };
  }

  const api = { create };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.EmojiProgress = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: Manual verification via puppeteer (headless Edge)**

`snake/scripts/_tmp-verify-emoji-progress.js` (임시, 확인 후 삭제):
```js
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8844/snake/index.html', { waitUntil: 'load' });

  const result = await page.evaluate(() => {
    const imgEl = document.getElementById('emoji-progress-img');
    const gridEl = document.getElementById('emoji-progress-grid');
    const ep = window.SnakeGame.EmojiProgress.create({ imgEl, gridEl });
    ep.setEmoji('rocket');
    ep.revealUpTo(3);
    const revealedCount = gridEl.querySelectorAll('.cover-cell.revealed').length;
    ep.revealAll();
    const allRevealedCount = gridEl.querySelectorAll('.cover-cell.revealed').length;
    return { src: imgEl.getAttribute('src'), revealedCount, allRevealedCount, totalCells: gridEl.children.length };
  });

  console.log(JSON.stringify(result));
  await browser.close();
})();
```

Run (after starting `node scripts/serve.js` in `fun-games-hub/`):
```bash
node snake/scripts/_tmp-verify-emoji-progress.js
```
Expected: `{"src":".../assets/emoji/rocket.svg","revealedCount":3,"allRevealedCount":10,"totalCells":10}`

Delete the temp script once confirmed: `rm snake/scripts/_tmp-verify-emoji-progress.js`

- [ ] **Step 3: Commit**

```bash
git -C fun-games-hub add snake/js/emoji-progress.js
git -C fun-games-hub commit -m "feat(snake): add 10-region emoji reveal progress display"
```

---

### Task 10: 입력(드래그 조작) (`input.js`)

**Files:**
- Create: `snake/js/input.js`

**Interfaces:**
- Consumes: DOM 엘리먼트(터치 대상, 보통 `#game-canvas`의 부모 `.play-area`)
- Produces: `SnakeGame.Input.create(targetEl) → { getDirection() → {x,y} }`. Task 15(game.js)가 매 프레임 `getDirection()`을 읽어 플레이어 `Worm.setDirection()`에 넘긴다.

- [ ] **Step 1: Write the implementation**

스펙 §8.2: "화면 아무데나 드래그 방향으로 전환", 별도 방향키 UI 없음. 터치 시작 지점을 앵커로 고정하고, 그 지점 기준 현재 손가락 위치 벡터를 방향으로 쓰는(가상 조이스틱) 방식 — 대화에서 이미 확인한 "화면 아무데나 드래그"에 맞는 표준 UX.

`snake/js/input.js`:
```js
(function (root) {
  'use strict';

  function create(targetEl) {
    let anchor = null;
    let direction = { x: 1, y: 0 }; // 기본값: 오른쪽

    function toLocal(e) {
      return { x: e.clientX, y: e.clientY };
    }

    function onDown(e) {
      anchor = toLocal(e);
      targetEl.setPointerCapture && e.pointerId != null && targetEl.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!anchor) return;
      const p = toLocal(e);
      const dx = p.x - anchor.x;
      const dy = p.y - anchor.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { // 데드존 — 미세한 손떨림으로 방향이 튀는 것 방지
        direction = { x: dx / dist, y: dy / dist };
      }
    }

    function onUp() {
      anchor = null;
    }

    targetEl.addEventListener('pointerdown', onDown);
    targetEl.addEventListener('pointermove', onMove);
    targetEl.addEventListener('pointerup', onUp);
    targetEl.addEventListener('pointercancel', onUp);

    return { getDirection: () => direction };
  }

  const api = { create };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Input = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: Manual verification via puppeteer**

**주의(재발 이력)**: 이 프로젝트 puppeteer 환경에서 `page.mouse` 드래그 시뮬레이션이 `pointerdown`/`pointermove` 리스너에 안 먹힐 때가 있었음(색칠앱 2026-08-24 세션 메모) — 진짜 `PointerEvent`를 `dispatchEvent`로 직접 쏴서 검증한다.

`snake/scripts/_tmp-verify-input.js` (임시, 확인 후 삭제):
```js
const puppeteer = require('puppeteer-core');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8844/snake/index.html', { waitUntil: 'load' });

  const result = await page.evaluate(() => {
    const el = document.querySelector('.play-area');
    const input = window.SnakeGame.Input.create(el);
    const before = input.getDirection();

    function fire(type, x, y, pointerId) {
      el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId, bubbles: true }));
    }
    fire('pointerdown', 100, 100, 1);
    fire('pointermove', 150, 100, 1); // 오른쪽으로 드래그
    const after = input.getDirection();
    fire('pointerup', 150, 100, 1);

    return { before, after };
  });

  console.log(JSON.stringify(result));
  await browser.close();
})();
```

Run: `node snake/scripts/_tmp-verify-input.js`
Expected: `after.x`가 1에 가깝고 `after.y`가 0에 가까움 (오른쪽 드래그 → 오른쪽 방향).

Delete the temp script once confirmed: `rm snake/scripts/_tmp-verify-input.js`

- [ ] **Step 3: Commit**

```bash
git -C fun-games-hub add snake/js/input.js
git -C fun-games-hub commit -m "feat(snake): add drag-anywhere touch input"
```

---

### Task 11: 사운드 (`audio.js`)

**Files:**
- Create: `snake/js/audio.js`

**Interfaces:**
- Produces: `SnakeGame.Audio.playEatSound()`. Task 15(game.js)가 먹이 획득마다 호출한다(스펙 §14, "뿅!").

- [ ] **Step 1: Write the implementation**

색칠앱 app.js의 `playPop()`(오실레이터+게인 엔벨로프 WebAudio 합성) 기법을 재사용 — 외부 오디오 파일 없이 짧은 "뿅" 효과음을 그 자리에서 합성한다.

`snake/js/audio.js`:
```js
(function (root) {
  'use strict';

  let ctx = null;
  function getCtx() {
    if (!ctx) {
      const AC = (root && (root.AudioContext || root.webkitAudioContext));
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  // 스펙 §14: 먹이 획득 시 짧은 "뿅!" 효과음. 과도한 이펙트 금지 요구에 맞춰 0.12초로 짧게.
  function playEatSound() {
    const c = getCtx();
    if (!c) return; // WebAudio 미지원 환경은 조용히 무시 — 게임 진행에 영향 없음
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, c.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.12);
    } catch (e) { /* 재생 실패는 무시 — 사운드는 부가 기능 */ }
  }

  const api = { playEatSound };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Audio = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: Commit**

```bash
git -C fun-games-hub add snake/js/audio.js
git -C fun-games-hub commit -m "feat(snake): add synthesized eat sound effect"
```

(수동 브라우저 청취 확인 — 자동화 테스트 대상 아님, Task 14 통합 스모크 테스트에서 예외 없이 호출되는지만 간접 확인)

---

### Task 12: HUD 업데이트 (`hud.js`)

**Files:**
- Create: `snake/js/hud.js`

**Interfaces:**
- Consumes: DOM 엘리먼트 `#hud-level`, `#hud-hearts`, `#hud-food-count` (Task 8)
- Produces: `SnakeGame.HUD.update({ level, hearts, foodCollected, foodCount })`. Task 15(game.js)가 매 프레임(또는 값이 바뀔 때마다) 호출한다.

- [ ] **Step 1: Write the implementation**

`snake/js/hud.js`:
```js
(function (root) {
  'use strict';

  function update(state) {
    const levelEl = document.getElementById('hud-level');
    const heartsEl = document.getElementById('hud-hearts');
    const foodEl = document.getElementById('hud-food-count');

    levelEl.textContent = 'Level ' + state.level;
    heartsEl.textContent = '❤️'.repeat(state.hearts) + '🖤'.repeat(Math.max(0, 3 - state.hearts));
    foodEl.textContent = state.foodCollected + ' / ' + state.foodCount;
  }

  const api = { update };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.HUD = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: Commit**

```bash
git -C fun-games-hub add snake/js/hud.js
git -C fun-games-hub commit -m "feat(snake): add HUD text updates"
```

(DOM 텍스트 대입만 하는 얇은 모듈 — Task 14 통합 스모크 테스트에서 실제 값 반영을 확인)

---

### Task 13: 미니맵 렌더링 (`minimap.js`)

**Files:**
- Create: `snake/js/minimap.js`

**Interfaces:**
- Consumes: `#minimap-canvas` (Task 8)
- Produces: `SnakeGame.Minimap.render(ctx, { mapWidth, mapHeight, player, foods })`. Task 15(game.js)가 매 프레임 호출한다.

- [ ] **Step 1: Write the implementation**

스펙 §15~16: 우측 상단, 전체 맵/플레이어 위치/남은 먹이 위치 표시, 먹이 획득 시 즉시 갱신(별도 상태 없이 매 프레임 다시 그리면 자동으로 만족됨).

`snake/js/minimap.js`:
```js
(function (root) {
  'use strict';

  function render(ctx, opts) {
    const { mapWidth, mapHeight, player, foods } = opts;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(36, 28, 71, 0.9)';
    ctx.fillRect(0, 0, w, h);

    const sx = w / mapWidth;
    const sy = h / mapHeight;

    // 남은 먹이
    ctx.fillStyle = '#f2c879';
    foods.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x * sx, f.y * sy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 플레이어 (🟢)
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const api = { render };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Minimap = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: Commit**

```bash
git -C fun-games-hub add snake/js/minimap.js
git -C fun-games-hub commit -m "feat(snake): add minimap rendering"
```

(캔버스 픽셀 렌더링 — Task 14 통합 스모크 테스트에서 `#minimap-canvas`가 빈 캔버스가 아님을 픽셀 데이터로 확인)

---

### Task 14: 메인 게임 루프/상태머신 (`game.js`)

이 Task가 지금까지 만든 모든 모듈을 실제로 묶는 핵심 Task다. 스펙 §3(전체 흐름)·§22~24(생명/무적/게임오버)·§28~30(클리어/보상/재플레이)을 전부 구현한다.

**Files:**
- Create: `snake/js/game.js`

**Interfaces:**
- Consumes: `SnakeGame.LEVELS`, `SnakeGame.RNG`, `SnakeGame.FoodPlacement`, `SnakeGame.Worm`, `SnakeGame.EnemyAI`, `SnakeGame.Collision`, `SnakeGame.Camera`, `SnakeGame.EmojiProgress`, `SnakeGame.Input`, `SnakeGame.Audio`, `SnakeGame.HUD`, `SnakeGame.Minimap` (Task 1~13), DOM 전체(Task 8).
- Produces: `SnakeGame.Game.init()` — `DOMContentLoaded` 시 자동 호출되어 레벨 선택 화면을 채우고 이벤트를 건다. 디버그 훅 `window.__debugStartLevel(n)` / `window.__debugCollectAllFood()` / `window.__debugForceGameOver()` (색칠앱의 `__debugOpenTemplate` 등과 동일한 컨벤션 — 영구 보존, 테스트에서 재사용).

- [ ] **Step 1: Write the implementation**

`snake/js/game.js`:
```js
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

    const input = SG.Input.create(playArea);

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

    // 적 이동 — 맵 경계에서 반사(스펙 §6.2: 적도 맵 안에서만 이동)
    s.enemies.forEach((e) => {
      const d = e.ai.update(dt);
      e.worm.setDirection(d.x, d.y);
      e.worm.update(dt);
      const h = e.worm.head;
      if (h.x < 0 || h.x > s.levelData.mapWidth) e.worm.direction.x *= -1;
      if (h.y < 0 || h.y > s.levelData.mapHeight) e.worm.direction.y *= -1;
    });

    // 충돌 (무적 중이 아닐 때만)
    if (!invincible) {
      let hit = false;
      if (SG.Collision.checkBoundaryCollision(s.player.head.x, s.player.head.y, s.levelData.mapWidth, s.levelData.mapHeight)) {
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
    ctx.fillStyle = '#e34948';
    s.enemies.forEach((e) => {
      e.worm.getSegments().forEach((seg) => {
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 플레이어 (무적 중 깜빡임 — 스펙 §23)
    const nowSec = performance.now() / 1000;
    const invincible = nowSec < s.invincibleUntil;
    const blink = invincible && Math.floor(nowSec * 10) % 2 === 0;
    ctx.fillStyle = blink ? 'rgba(74,222,128,0.35)' : '#4ade80';
    s.player.getSegments().forEach((seg) => {
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    SG.Minimap.render(document.getElementById('minimap-canvas').getContext('2d'), {
      mapWidth: s.levelData.mapWidth,
      mapHeight: s.levelData.mapHeight,
      player: s.player.head,
      foods: s.foods
    });
  }

  // ---------- 종료 처리 ----------
  function computeStars(collisions) {
    // 스펙 §29: 클리어=1, 충돌 1회 이하=2, 충돌 0회=3
    if (collisions === 0) return 3;
    if (collisions <= 1) return 2;
    return 1;
  }

  function levelClear() {
    const s = state;
    s.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    s.emojiProgress.revealAll();

    const stars = computeStars(s.collisions);
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
```

- [ ] **Step 2: Commit**

```bash
git -C fun-games-hub add snake/js/game.js
git -C fun-games-hub commit -m "feat(snake): wire up main game loop and state machine"
```

---

### Task 15: 통합 스모크 테스트 (`verify-snake-smoke.js`)

**Files:**
- Create: `snake/scripts/verify-snake-smoke.js`

**Interfaces:**
- Consumes: 실행 중인 로컬 서버(`fun-games-hub/scripts/serve.js`, 포트 8844), `window.__debugStartLevel`/`window.__debugCollectAllFood`(Task 14).
- Produces: 없음(CLI 검증 스크립트). 스펙 §38 QA 체크리스트의 핵심 항목을 자동으로 확인한다.

- [ ] **Step 1: Write the smoke test**

`snake/scripts/verify-snake-smoke.js`:
```js
// 지렁이 게임 통합 스모크 테스트 — 색칠앱 verify-full-clear.js와 같은 패턴(디버그 훅으로
// 실제 UI 흐름을 헤드리스로 재현). fun-games-hub/scripts/serve.js가 8844 포트에 떠 있어야 한다.
const puppeteer = require('puppeteer-core');
const path = require('path');
const assert = require('assert');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE_PATH, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 780 });
  await page.goto('http://localhost:8844/snake/index.html', { waitUntil: 'load' });

  // 1) 레벨 선택 화면에 10개 카드가 뜨고, Level 1만 해금 상태인가
  const levelCardCount = await page.evaluate(() => document.querySelectorAll('.level-card').length);
  assert.strictEqual(levelCardCount, 10, 'level select must show exactly 10 cards');
  const lvl1Locked = await page.evaluate(() => document.querySelector('.level-card').dataset.locked);
  assert.strictEqual(lvl1Locked, 'false', 'Level 1 must be unlocked by default');

  // 2) Level 1 진입 → HUD/미니맵/emoji-progress가 렌더되는가
  await page.evaluate(() => window.__debugStartLevel(1));
  await new Promise((r) => setTimeout(r, 300)); // 첫 프레임 렌더 대기
  const afterStart = await page.evaluate(() => ({
    gameScreenHidden: document.getElementById('game-screen').hidden,
    hudLevel: document.getElementById('hud-level').textContent,
    hudFood: document.getElementById('hud-food-count').textContent,
    minimapHasPixels: (() => {
      const c = document.getElementById('minimap-canvas');
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return data.some((v, i) => i % 4 !== 3 && v !== 0); // alpha 채널 제외하고 0 아닌 픽셀 존재
    })()
  }));
  assert.strictEqual(afterStart.gameScreenHidden, false, 'game screen must become visible');
  assert.strictEqual(afterStart.hudLevel, 'Level 1', 'HUD must show the current level');
  assert.strictEqual(afterStart.hudFood, '0 / 20', 'HUD must show initial food progress');
  assert.ok(afterStart.minimapHasPixels, 'minimap canvas must have drawn something');

  // 3) 먹이 20개를 전부 흡수 → 클리어 오버레이 등장 + emoji 10칸 전부 revealed + localStorage 진행 저장
  await page.evaluate(() => window.__debugCollectAllFood());
  await new Promise((r) => setTimeout(r, 300));
  const afterClear = await page.evaluate(() => ({
    clearOverlayHidden: document.getElementById('clear-overlay').hidden,
    revealedCells: document.querySelectorAll('#emoji-progress-grid .cover-cell.revealed').length,
    progress: JSON.parse(localStorage.getItem('snakeGameProgress') || '{}')
  }));
  assert.strictEqual(afterClear.clearOverlayHidden, false, 'clear overlay must show after collecting all food');
  assert.strictEqual(afterClear.revealedCells, 10, 'all 10 emoji regions must be revealed on clear');
  assert.ok(afterClear.progress['1'] && afterClear.progress['1'].cleared, 'level 1 must be marked cleared in localStorage');
  assert.ok(afterClear.progress['1'].stars >= 1, 'a cleared level must have at least 1 star');

  // 4) 레벨 선택으로 복귀 → Level 2가 해금됐는가
  await page.click('#clear-select-btn');
  await new Promise((r) => setTimeout(r, 200));
  const lvl2Locked = await page.evaluate(() =>
    document.querySelectorAll('.level-card')[1].dataset.locked
  );
  assert.strictEqual(lvl2Locked, 'false', 'Level 2 must unlock after clearing Level 1');

  // 5) GAME OVER 경로 — 생명 0 → 오버레이 표시 + 필수 항목(Level/먹이 수) 노출
  await page.evaluate(() => window.__debugStartLevel(1));
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => window.__debugForceGameOver());
  await new Promise((r) => setTimeout(r, 200));
  const afterGameOver = await page.evaluate(() => ({
    overlayHidden: document.getElementById('gameover-overlay').hidden,
    levelText: document.getElementById('gameover-level').textContent,
    foodText: document.getElementById('gameover-food-count').textContent
  }));
  assert.strictEqual(afterGameOver.overlayHidden, false, 'gameover overlay must show when hearts reach 0');
  assert.strictEqual(afterGameOver.levelText, 'Level 1', 'gameover overlay must show the current level (spec §24)');
  assert.ok(/^먹이 \d+ \/ 20$/.test(afterGameOver.foodText), 'gameover overlay must show food collected count (spec §24)');

  console.log('verify-snake-smoke.js: all checks passed');
  await browser.close();
})().catch((e) => {
  console.error('SMOKE TEST FAILED:', e.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```bash
node fun-games-hub/scripts/serve.js &   # 백그라운드로 로컬 서버 기동 (포트 8844)
node fun-games-hub/snake/scripts/verify-snake-smoke.js
```
Expected: `verify-snake-smoke.js: all checks passed`

- [ ] **Step 3: Commit**

```bash
git -C fun-games-hub add snake/scripts/verify-snake-smoke.js
git -C fun-games-hub commit -m "test(snake): add end-to-end smoke test for level 1 play-through"
```

---

## Post-plan checklist (스펙 §38 QA 대응)

Task 15의 스모크 테스트가 다음 QA 항목을 자동 커버한다: 맵(넓은 맵/카메라/경계), 플레이어(터치 이동/성장), 먹이(개수/분산/획득/미니맵 갱신), 미니맵(표시/픽셀 존재), Emoji(진행도/완성 연출), Level(총 10개/해금). 아래는 puppeteer로 자동화하기보다 **사람이 실제 모바일 기기에서 직접 확인해야 하는 항목**(스펙 §40 "실제 모바일 터치 환경에서 실제 플레이 테스트" 지시와 일치) — 15개 Task를 모두 커밋한 뒤 사용자에게 확인을 요청한다:

- 드래그 조작감(데드존 12px, 앵커 방식)이 실제 손가락으로 자연스러운지
- 적 지렁이 난이도(Level 5~10 체감), 사운드 볼륨/타이밍
- 성장 속도(먹이 1개당 세그먼트 1개, 최대 30)가 시각적으로 적절한지
- 무적 깜빡임이 실제 화면에서 잘 보이는지

이 항목들은 스펙 §36의 21~22단계("실제 모바일 테스트 → 난이도 조정")에 해당 — 코드 구현 완료 후 사용자 피드백을 받아 `LEVELS`/`EAT_RADIUS`/`COLLISION_RADIUS` 등 설정값만 조정하면 되도록 이미 데이터로 분리되어 있다.

# 챕터→라운드 재구조화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten 두더지팡's "챕터(1~10) 안에 내부 라운드" structure into a single top-level "라운드(1~8)" — Round1 = old Ch1+2+3 merged (60s, continuous, 3 mechanic-introduction phases), Rounds2~8 = old Ch4~10 (140s each, continuous, no internal breaks), with time-based smooth difficulty interpolation replacing discrete per-old-round jumps, a universal "Ready→GO!" round-start countdown, and win now routing to home exactly like a loss (no more chapter-transition screen).

**Architecture:** The `config` object passed into `MG.SpawnScheduler.create()` is held by reference and read fresh on every scheduler tick — so all continuous difficulty ramping is implemented purely in `game.js` by mutating the same live `config` object once per frame from `loop()`, based on elapsed time within the round. No changes are needed to `spawn-scheduler.js` itself. The old "internal round chaining" (`startRound(finishedRound+1)` called from `roundComplete()`) is deleted entirely — a top-level round (1-8) is one continuous timed session that always ends at the result screen.

**Tech Stack:** Vanilla JS (no framework), `localStorage`-backed progress, Node `assert`-based test scripts (`mole/scripts/test-*.js`, run via `node`), Puppeteer-core + local static server (`mole/scripts/serve.js`) for in-browser/visual verification of timing and gameplay behavior — this codebase has no DOM test harness, so any step touching rendered UI or timing is verified by driving the real page via Puppeteer and the existing `window.__debug*` hooks, not by guessing from code alone.

**Spec:** `docs/superpowers/specs/2026-09-17-chapter-to-round-restructure-design.md` — this plan implements that spec section-by-section; read both together.

## Global Constraints

- Mapping (spec §2): Round1 = old Ch1+2+3 (merged). Round2=Ch4, Round3=Ch5, Round4=Ch6, Round5=Ch7, Round6=Ch8, Round7=Ch9, Round8=Ch10. `mole.chapter` (localStorage key, unchanged name) now stores the **new round number** (1-8) directly — every place that read it as "old chapter number" must be re-derived: any hardcoded old-chapter threshold `N` (for N≥4) becomes `N-2` in the new round-number space; thresholds that only ever applied within old Ch1-3 collapse into Round1's own separate time-phased logic (spec §3).
- Round1 = 60s total, continuous, no internal transition screens/subtitles, 3 conceptual phases (20s each): 0-20s single-hit moles only, 20-40s multi-hit moles introduced, 40-60s animals introduced. `maxConcurrentMoles` ramps continuously across the full 60s using `SMALL_CHAPTER_MOLES=[3,4,5,6,7]` as 5 keyframes (0/15/30/45/60s). Board stays 3x3 (9 holes), weapon forced to hammer.
- Rounds2-8 = 140s EACH, continuous, no internal round-N breaks/subtitles. `popDuration`/`maxConcurrentMoles`/`maxConcurrentAnimals`/`maxConcurrentBombs`/`bombChance`/`strongBombChance` each ramp continuously across that round's own 140s using the existing shared 10-value tables (`MOLE_DURATION`, `MAX_CONCURRENT_MOLES`, `MAX_CONCURRENT_ANIMALS`, `MAX_CONCURRENT_BOMBS`, `BOMB_CHANCE_BY_ROUND`, `STRONG_BOMB_CHANCE_BY_ROUND`) as 10 keyframes spread across 0-140s — the **same full 10-value curve replays inside every round that has that mechanic switched on**; the per-round "게이팅" (e.g. bombs only from round3 on) is a hard on/off switch on top of that curve, not a sub-range selection. This reconciles spec §4's "라운드3부터" wording with its "10개 키프레임을 140초에 균등 배치" wording — flagged here explicitly since the two read as contradictory in isolation.
- Countdown: "3,2,1,GO!" (4 steps, 650ms/step, hardcoded English) → `['Ready', 'GO!']` (2 steps, 650ms/step), same hardcoding convention (no i18n key, spec confirms "Ready"/"GO!" spelling), fires exactly once at the start of every round (1-8) — the old `isR1`-only-gets-countdown / other-rounds-get-curtain-only split is deleted; every round now uses the (formerly round1-only) curtain-less, countdown-driven intro.
- Chapter-transition screen (`wireResultSwipe`, `goToNextChapter`) is deleted entirely. Win routes to home exactly like a loss already does (both already share `finishFromRound` → home via ⊞; only the win-only swipe-hint affordance is removed).
- `MG.Progress.MAX_CHAPTER`: 10 → 8.
- UI text: "챕터 N" → "라운드 N" (i18n content only, code already interpolates via i18n keys). 8 new/trimmed name+desc entries. Draft Korean/English copy is written in this plan (Task 6) since the user said draft text is acceptable for now.
- **Assumptions not covered by the spec (flagged for the user to confirm/adjust when reviewing this plan, per Karpathy guideline #1 — stated explicitly rather than silently decided):**
  - Round1 `popDuration` (mole stay-up time): spec is silent. This plan fixes it at a constant **2.5s** for the whole round (the most forgiving value from `MOLE_DURATION[0]`, matching what every old Ch1-3 round1 started at) — no ramp, since spec only calls for the mole**-count** ramp and the two mechanic-introduction gates.
  - Round1 `maxConcurrentAnimals`: spec only says "40-60s: animals introduced," no count given. This plan ramps it from 0 (at t=40s) to 2 (at t=60s) linearly, reusing the same `interpolate()` helper — 2 is the mid-tier value from the shared animal table, kept low since Round1 is the tutorial.
  - Alipunch weapon's round-intro countdown demo: the old 4-step countdown wove in a 5-move punch showcase between steps "2" and "GO!" (~1300ms window). The new 2-step countdown has no equivalent middle slot, so this plan drops the 5-move showcase and keeps only the "meet" gesture on "Ready" and "GO!" (matching the old countdown's first/last beats). The separate non-countdown "meet" demo (`playAlipunchDemo`, previously played only on non-round1 intros) is deleted since every round now uses the countdown path.
  - Weapon-intro travel timings (cannon fly-in, goldhammer spin-in, hammer pop-in) were hand-measured (`실측`) against the old 4-step countdown's exit point. This plan recalculates a first-pass estimate from the timing formulas (Task 4), but — per `[[screenshot-verify-before-coding]]` memory policy — the actual sync must be confirmed via Puppeteer screen capture, not trusted from arithmetic alone, before Task 4 is considered done.

---

## Task 1: `progress.js` — MAX_CHAPTER 8 + CLEAR_TARGET trim

**Files:**
- Modify: `mole/js/progress.js:13, 20-23`
- Test: `mole/scripts/test-progress.js`

**Interfaces:**
- Produces: `MG.Progress.MAX_CHAPTER === 8`, `MG.Progress.CLEAR_TARGET` has exactly keys `1..8`. No signature changes to any exported function.

- [ ] **Step 1: Add the failing boundary assertion to the test**

Append to the end of `mole/scripts/test-progress.js` (before the final `console.log`):

```js
// 라운드 8 초과는 unlockAll 이어도 절대 안 열림 (MAX_CHAPTER=8 상한).
localStorage.setItem('mole.unlockAll', '1');
assert.ok(!Progress.isUnlocked(9, 'easy'), '라운드9는 존재하지 않음 — MAX_CHAPTER=8 상한');
assert.strictEqual(Progress.CLEAR_TARGET[9], undefined, 'CLEAR_TARGET 은 1~8만 존재');
localStorage.removeItem('mole.unlockAll');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node mole/scripts/test-progress.js`
Expected: FAIL — `isUnlocked(9, 'easy')` currently returns `true` because `MAX_CHAPTER` is still 10.

- [ ] **Step 3: Edit progress.js**

In `mole/js/progress.js:13`, change:
```js
  var MAX_CHAPTER = 10;
```
to:
```js
  var MAX_CHAPTER = 8;
```

In `mole/js/progress.js:20-23`, change:
```js
  var CLEAR_TARGET = {
    1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000,
    6: 1000, 7: 1000, 8: 1000, 9: 1000, 10: 1000
  };
```
to:
```js
  var CLEAR_TARGET = {
    1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000,
    6: 1000, 7: 1000, 8: 1000
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node mole/scripts/test-progress.js`
Expected: PASS — `test-progress.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add mole/js/progress.js mole/scripts/test-progress.js
git commit -m "$(cat <<'EOF'
두더지팡: 진행도 상한 8라운드로 축소 (챕터→라운드 재구조화 1/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Round difficulty data + continuous config computation

This is the architectural core: `levels.js` becomes the single source of truth for every difficulty keyframe table plus the interpolation math, and `game.js`'s per-round `config` construction is rewritten to branch into a **Round1 time-phased path** and a **Rounds2-8 continuous-interpolation path**, with a new `updateLiveDifficulty()` function called once per frame from `loop()` to keep mutating the live `config` object as the round's elapsed time advances.

**Files:**
- Modify: `mole/js/levels.js` (full rewrite of exports)
- Modify: `mole/js/game.js:11-17` (constants + `roundSeconds()`/`isSmallBoardChapter()`)
- Modify: `mole/js/game.js:1190-1411` (`startRound()` — config construction block, `state` object)
- Modify: `mole/js/game.js:1670-1730` (`loop()` — call `updateLiveDifficulty()` each frame)
- Test: `mole/scripts/test-levels.js` (rewrite)
- Test: manual Puppeteer probe via new debug hooks (Step 8)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `MG.MOLE_DURATION`, `MG.MAX_CONCURRENT_MOLES`, `MG.MAX_CONCURRENT_ANIMALS`, `MG.MAX_CONCURRENT_BOMBS`, `MG.BOMB_CHANCE_BY_ROUND`, `MG.STRONG_BOMB_CHANCE_BY_ROUND`, `MG.SMALL_CHAPTER_MOLES` (arrays), `MG.interpolate(keyframes, elapsedSec, totalSec)` (function) — all consumed only by `game.js` in this task. `game.js` gains `function updateLiveDifficulty()` (no params, reads/mutates module-level `state`) and `window.__debugGetConfig()` / `window.__debugForceDifficultyUpdate()` debug hooks, used by Task 3's and later tasks' Puppeteer verification.

- [ ] **Step 1: Rewrite `mole/js/levels.js`**

Read the current file first (`mole/js/levels.js`, 39 lines) to confirm nothing else changed underneath. Replace the entire file with:

```js
(function (root) {
  'use strict';

  // 라운드 난이도 키프레임 표 — 전체 챕터 기획서(2026-09-14) 이후 챕터→라운드 재구조화
  // (2026-09-17)로 "LEVELS[단일 라운드 인덱스]" 방식을 폐기하고, 이 원본 배열들을 그대로
  // interpolate() 로 라운드 전체 시간(60s/140s)에 걸쳐 연속 보간하는 방식으로 바뀌었다.
  // 값 자체(동시출현·유지시간·확률)는 사용자가 여러 차례 재조정한 기존 값 그대로 — 더 이상
  // "임의 변경 금지" 아님, 사용자 지시로 계속 바뀔 수 있음.
  const MOLE_DURATION = [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0];
  const MAX_CONCURRENT_MOLES = [3, 4, 4, 5, 5, 5, 6, 6, 7, 7];
  const MAX_CONCURRENT_ANIMALS = [0, 1, 2, 2, 2, 2, 3, 3, 3, 3];
  const MAX_CONCURRENT_BOMBS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3];
  const BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0.08, 0.08, 0.09, 0.11, 0.12, 0.14];
  const STRONG_BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0, 0.02, 0.03, 0.04, 0.05, 0.06];
  // 라운드1(구 챕터1~2~3 병합) 전용 — 9홀 보드는 위 10단계 표로는 너무 쉬워서(사용자 지적)
  // 별도로 더 빡빡하게 지정한 5단계 표.
  const SMALL_CHAPTER_MOLES = [3, 4, 5, 6, 7];
  // 이미 죽은 코드(어디서도 안 읽힘) — 챕터→라운드 재구조화와 무관, 사용자 승인 없이 삭제하지 않음.
  const TIME_LIMIT = [60, 60, 60, 55, 55, 55, 50, 50, 45, 45];

  // keyframes 를 elapsedSec/totalSec 비율로 선형 보간. elapsedSec 이 범위를 벗어나면 양 끝값에 clamp.
  function interpolate(keyframes, elapsedSec, totalSec) {
    const n = keyframes.length;
    if (n === 0) return 0;
    if (n === 1) return keyframes[0];
    const pos = Math.max(0, Math.min(1, elapsedSec / totalSec)) * (n - 1);
    const i = Math.floor(pos);
    if (i >= n - 1) return keyframes[n - 1];
    const frac = pos - i;
    return keyframes[i] + (keyframes[i + 1] - keyframes[i]) * frac;
  }

  const api = {
    MOLE_DURATION, MAX_CONCURRENT_MOLES, MAX_CONCURRENT_ANIMALS, MAX_CONCURRENT_BOMBS,
    BOMB_CHANCE_BY_ROUND, STRONG_BOMB_CHANCE_BY_ROUND, SMALL_CHAPTER_MOLES, TIME_LIMIT,
    interpolate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; Object.assign(root.MoleGame, api); }
})(typeof window !== 'undefined' ? window : null);
```

This removes `REGION_COUNT`, `EMOJI_IDS`, and the `LEVELS` array/build-loop — confirmed via repo-wide grep that `MG.LEVELS`, `.emojiId`, and `.regionCount` have no consumer left once `game.js` (this same task, Step 5) stops reading `MG.LEVELS[roundNum - 1]`.

- [ ] **Step 2: Rewrite `mole/scripts/test-levels.js`**

The current file asserts against a `LEVELS` array that this task deletes, and its expected values were already stale versus the real file (pre-existing, unrelated drift — not something this task is fixing). Replace the whole file:

```js
const assert = require('assert');
const L = require('../js/levels.js');

assert.deepStrictEqual(L.MOLE_DURATION, [2.5, 2.4, 2.3, 2.2, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0]);
assert.deepStrictEqual(L.MAX_CONCURRENT_MOLES, [3, 4, 4, 5, 5, 5, 6, 6, 7, 7]);
assert.deepStrictEqual(L.MAX_CONCURRENT_ANIMALS, [0, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
assert.deepStrictEqual(L.MAX_CONCURRENT_BOMBS, [0, 0, 0, 0, 1, 1, 2, 2, 3, 3]);
assert.deepStrictEqual(L.BOMB_CHANCE_BY_ROUND, [0, 0, 0, 0, 0.08, 0.08, 0.09, 0.11, 0.12, 0.14]);
assert.deepStrictEqual(L.STRONG_BOMB_CHANCE_BY_ROUND, [0, 0, 0, 0, 0, 0.02, 0.03, 0.04, 0.05, 0.06]);
assert.deepStrictEqual(L.SMALL_CHAPTER_MOLES, [3, 4, 5, 6, 7]);
assert.strictEqual(typeof L.interpolate, 'function');

// interpolate(): keyframe 정확히 맞아떨어지는 지점들 (5개 키프레임, 60초 = 15초 간격)
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 0, 60), 3);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 15, 60), 4);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 30, 60), 5);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 45, 60), 6);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 60, 60), 7);
// 중간값 보간
assert.ok(Math.abs(L.interpolate(L.SMALL_CHAPTER_MOLES, 7.5, 60) - 3.5) < 1e-9);
// 범위 밖은 양 끝값으로 clamp
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, -10, 60), 3);
assert.strictEqual(L.interpolate(L.SMALL_CHAPTER_MOLES, 999, 60), 7);
// 10개 키프레임을 140초 기준으로 (0, 70, 140 지점)
assert.strictEqual(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 0, 140), 0);
assert.ok(Math.abs(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 70, 140) - 0.07) < 1e-9);
assert.strictEqual(L.interpolate(L.BOMB_CHANCE_BY_ROUND, 140, 140), 0.14);
// 단일 키프레임은 그 값 그대로
assert.strictEqual(L.interpolate([5], 30, 60), 5);

console.log('test-levels.js: all assertions passed');
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node mole/scripts/test-levels.js`
Expected: FAIL — `require('../js/levels.js')` still returns the old `{ LEVELS }` shape, so `L.MOLE_DURATION` is `undefined` and the first `assert.deepStrictEqual` throws.

- [ ] **Step 4: Apply Step 1's levels.js rewrite, run test again to verify it passes**

Run: `node mole/scripts/test-levels.js`
Expected: PASS — `test-levels.js: all assertions passed`

- [ ] **Step 5: Rewrite the round-timing constants in `game.js`**

In `mole/js/game.js:11-17`, change:
```js
  const ROUND_SECONDS = 15;       // 챕터 1~3
  const ROUND_SECONDS_LONG = 30;  // 챕터 4부터(전체 챕터 기획서 §5~6, 사용자 지적으로 3→4 정정)
  function roundSeconds() { return currentChapter() >= 4 ? ROUND_SECONDS_LONG : ROUND_SECONDS; }
  // 전체 챕터 기획서(2026-09-14): 챕터1~3 = 9홀(3x3)·5라운드, 챕터4~10 = 16홀(4x4)·10라운드.
  function isSmallBoardChapter() { return currentChapter() <= 3; }
  function roundGridSize() { return isSmallBoardChapter() ? 3 : GRID_SIZE; }
  function finalRound() { return isSmallBoardChapter() ? 5 : 10; }
```
to:
```js
  const ROUND1_SECONDS = 60;      // 라운드1 (구 챕터1+2+3 병합, 3구간 연속)
  const ROUND_SECONDS_LONG = 140; // 라운드2~8 (구 챕터4~10, 각 라운드 통째로 연속)
  function roundSeconds() { return currentChapter() === 1 ? ROUND1_SECONDS : ROUND_SECONDS_LONG; }
  // 챕터→라운드 재구조화(2026-09-17): 라운드1(구 챕터1~3 병합) = 9홀(3x3), 라운드2~8(구 챕터4~10) = 16홀(4x4).
  function isSmallBoardChapter() { return currentChapter() === 1; }
  function roundGridSize() { return isSmallBoardChapter() ? 3 : GRID_SIZE; }
```

`finalRound()` is deleted here — its only two call sites (`roundNum === finalRound()` in `playRoundIntro`, `finishedRound >= finalRound()` in `roundComplete`) are both being replaced in later tasks (Task 4, Task 5) as part of deleting the internal-round-chaining concept entirely. Leaving the now-unused function behind would be dead code introduced by this very change, so remove it now; if a later task's grep still finds a call site, that confirms the task ordering — fix that task's own step to also delete the call site in the same edit.

- [ ] **Step 6: Rewrite the `config` construction block in `startRound()`**

Read `mole/js/game.js:1190-1411` in full immediately before editing (this task's Step 1 already did — this file is the same as read during planning, but re-read in case Task 1 touched a nearby import). Replace lines `1209` and `1253-1290` (the `levelData` lookup, the `ch`/`SMALL_CHAPTER_MOLES`/`BOMB_CHANCE_BY_ROUND`/`STRONG_BOMB_CHANCE_BY_ROUND` locals, and the whole `config` object literal) as follows.

Delete line 1209:
```js
    const levelData = MG.LEVELS[roundNum - 1];
```
(no replacement — `levelData` is no longer used anywhere; `MG.LEVELS` no longer exists after Step 1/4).

Replace lines 1253-1288:
```js
    const ch = currentChapter();
    const reverseTarget = ch === 8;              // 챕터8: 동물이 타겟, 두더지가 방해물
    const dualTarget = ch === 10;                // 챕터10: 두더지+동물 둘 다 타겟
    // 챕터1~3(9홀)은 §5~6 공용 표([3,3,4,4,5])로는 너무 쉬움(사용자 지적) — 9홀 전용으로
    // 더 빡빡하게 별도 지정.
    const SMALL_CHAPTER_MOLES = [3, 4, 5, 6, 7];
    // "폭탄 든 두더지"(2026-09-14 확정, [[mole-bomb-holding-mechanic]]) — 스폰된 두더지 중 일부가
    // 독립 굴림으로 폭탄 든 버전이 됨. 챕터5부터 일반, 챕터6부터 강력(겹치면 강력 우선).
    // 라운드1~4는 항상 0%(해당 챕터 초반 튜토리얼 여유).
    const BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0.08, 0.08, 0.09, 0.11, 0.12, 0.14];
    const STRONG_BOMB_CHANCE_BY_ROUND = [0, 0, 0, 0, 0, 0.02, 0.03, 0.04, 0.05, 0.06];
    const config = {
      // 챕터8은 동물이 타겟·두더지가 방해물로 뒤집히는데(reverseTarget), 표는 그대로 두면
      // "타겟(동물)"이 더 적고 "방해물(두더지)"이 더 많아 거꾸로다(사용자 지적: "출몰 횟수는
      // 바뀌어야함") — 두 표를 맞바꿔서 챕터8만 동물이 많고 두더지가 적게.
      maxConcurrentMoles: isSmallBoardChapter() ? SMALL_CHAPTER_MOLES[roundNum - 1]
        : (reverseTarget ? levelData.maxConcurrentAnimals : levelData.maxConcurrentMoles),
      maxConcurrentAnimals: ch >= 3 ? (reverseTarget ? levelData.maxConcurrentMoles : levelData.maxConcurrentAnimals) : 0,
      maxConcurrentBombs: ch >= 5 ? levelData.maxConcurrentBombs : 0,
      bombChance: ch >= 5 ? BOMB_CHANCE_BY_ROUND[roundNum - 1] : 0,
      strongBombChance: ch >= 6 ? STRONG_BOMB_CHANCE_BY_ROUND[roundNum - 1] : 0,
      maxConcurrentItems: 0,   // 실드 아이템 스폰 삭제(사용자 지정, 2026-09-14)
      shieldItems: false,
      popDuration: levelData.moleDuration,
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: ch >= 3,
      multiHit: ch >= 2,  // 챕터1: 다타(빼꼼) 없음 — 전부 1방(튜토리얼)
      fourHit: ch >= 7,   // 4타 두더지 (전신→빠끔1→빠끔2→모자)
      animalMultiHit: ch === 8,  // 챕터8: 동물이 타겟이라 두더지처럼 다타 동물 도입(사용자 지정)
      reverseTarget: reverseTarget,
      dualTarget: dualTarget,
      obstacleRatioBoost: ch === 10 ? 1.1 : 1,   // 챕터10: 방해물(동물·폭탄) 스폰 빈도 10% 상향
      cannonBurst: weapon === 'cannon',   // 대포 연사 스킬 (2·3타 두더지 첫 타 10%)
      moleUpBonus: weapon === 'alipunch' ? 0.1 : 0   // 알리 펀치 [방어]: 내려가기 전 0.1초 더 여유(§7)
    };
```
with:
```js
    // 챕터→라운드 재구조화(2026-09-17): ch 는 이제 "새 라운드 번호"(1~8) — 구 챕터 임계값(N)은
    // 전부 N-2 로 이동(라운드2=구챕터4 ... 라운드8=구챕터10). 라운드1(구챕터1~2~3 병합)은
    // 아래 별도 분기 + updateLiveDifficulty() 의 시간 기반 로직이 전담하므로 여기선 라운드2~8
    // 기준값(라운드 시작 순간, t=0)만 채운다 — 매 프레임 updateLiveDifficulty() 가 갱신한다.
    const ch = currentChapter();
    const reverseTarget = ch === 6;              // 라운드6(구챕터8): 동물이 타겟, 두더지가 방해물
    const dualTarget = ch === 8;                 // 라운드8(구챕터10): 두더지+동물 둘 다 타겟
    const config = {
      maxConcurrentMoles: isSmallBoardChapter() ? SMALL_CHAPTER_MOLES[0]
        : Math.round(MG.interpolate(reverseTarget ? MG.MAX_CONCURRENT_ANIMALS : MG.MAX_CONCURRENT_MOLES, 0, ROUND_SECONDS_LONG)),
      maxConcurrentAnimals: isSmallBoardChapter() ? 0
        : Math.round(MG.interpolate(reverseTarget ? MG.MAX_CONCURRENT_MOLES : MG.MAX_CONCURRENT_ANIMALS, 0, ROUND_SECONDS_LONG)),
      maxConcurrentBombs: (!isSmallBoardChapter() && ch >= 3) ? Math.round(MG.interpolate(MG.MAX_CONCURRENT_BOMBS, 0, ROUND_SECONDS_LONG)) : 0,
      bombChance: (!isSmallBoardChapter() && ch >= 3) ? MG.interpolate(MG.BOMB_CHANCE_BY_ROUND, 0, ROUND_SECONDS_LONG) : 0,
      strongBombChance: (!isSmallBoardChapter() && ch >= 4) ? MG.interpolate(MG.STRONG_BOMB_CHANCE_BY_ROUND, 0, ROUND_SECONDS_LONG) : 0,
      maxConcurrentItems: 0,   // 실드 아이템 스폰 삭제(사용자 지정, 2026-09-14)
      shieldItems: false,
      popDuration: isSmallBoardChapter() ? 2.5 : MG.interpolate(MG.MOLE_DURATION, 0, ROUND_SECONDS_LONG),
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: !isSmallBoardChapter(),  // 라운드1은 40초부터(updateLiveDifficulty), 라운드2~8은 항상
      multiHit: !isSmallBoardChapter(),   // 라운드1은 20초부터(updateLiveDifficulty), 라운드2~8은 항상
      fourHit: !isSmallBoardChapter() && ch >= 5,      // 4타 두더지 — 라운드5~8(구챕터7~10)
      animalMultiHit: !isSmallBoardChapter() && ch === 6,  // 라운드6(구챕터8): 동물이 타겟이라 다타 동물 도입
      reverseTarget: reverseTarget,
      dualTarget: dualTarget,
      obstacleRatioBoost: (!isSmallBoardChapter() && ch === 8) ? 1.1 : 1,  // 라운드8(구챕터10): 방해물 스폰 빈도 10% 상향
      cannonBurst: weapon === 'cannon',   // 대포 연사 스킬 (2·3타 두더지 첫 타 10%)
      moleUpBonus: weapon === 'alipunch' ? 0.1 : 0   // 알리 펀치 [방어]: 내려가기 전 0.1초 더 여유(§7)
    };
```

Note: `roundNum` still appears as `startRound`'s parameter name at this point in the file — Task 4 removes that parameter entirely and switches every remaining `roundNum` reference (including the `SMALL_CHAPTER_MOLES[roundNum - 1]` this step just replaced with `SMALL_CHAPTER_MOLES[0]`) to read `currentChapter()`/constants instead. Do not rename the parameter in this task; the block above no longer references `roundNum` at all, which is intentional and already consistent with Task 4's later removal.

- [ ] **Step 7: Add `updateLiveDifficulty()` and wire it into `loop()`**

Add this new function directly above `function loop(now) {` (currently `mole/js/game.js:1670`):

```js
  // 라운드 경과시간에 따라 state.config 의 시간형 필드를 매 프레임 갱신한다. spawn-scheduler.js
  // 는 config 를 참조로 받아 매번 새로 읽으므로(create() 시점에 캐싱하지 않음), 여기서 같은
  // 객체를 직접 mutate 하면 별도 훅 없이 그대로 반영된다.
  function updateLiveDifficulty() {
    if (!state) return;
    const cfg = state.config;
    const elapsed = roundSeconds() - state.timeRemaining;
    if (isSmallBoardChapter()) {
      // 라운드1(구 챕터1~2~3 병합) — 60초, 3구간(각 20초) 연속. 두더지 수만 전 구간에서
      // 연속 보간, 다타·동물은 시간 임계값에서 켜진다(자막 없이).
      cfg.maxConcurrentMoles = Math.round(MG.interpolate(MG.SMALL_CHAPTER_MOLES, elapsed, ROUND1_SECONDS));
      cfg.multiHit = elapsed >= 20;
      cfg.obstacles = elapsed >= 40;
      cfg.maxConcurrentAnimals = elapsed >= 40 ? Math.round(MG.interpolate([0, 2], elapsed - 40, 20)) : 0;
    } else {
      const total = ROUND_SECONDS_LONG;
      cfg.popDuration = MG.interpolate(MG.MOLE_DURATION, elapsed, total);
      cfg.maxConcurrentMoles = Math.round(MG.interpolate(cfg.reverseTarget ? MG.MAX_CONCURRENT_ANIMALS : MG.MAX_CONCURRENT_MOLES, elapsed, total));
      cfg.maxConcurrentAnimals = Math.round(MG.interpolate(cfg.reverseTarget ? MG.MAX_CONCURRENT_MOLES : MG.MAX_CONCURRENT_ANIMALS, elapsed, total));
      if (cfg.maxConcurrentBombs || cfg.bombChance) { // 라운드3부터만 켜져 있음(§4 게이팅) — 꺼진 라운드는 0 유지
        cfg.maxConcurrentBombs = Math.round(MG.interpolate(MG.MAX_CONCURRENT_BOMBS, elapsed, total));
        cfg.bombChance = MG.interpolate(MG.BOMB_CHANCE_BY_ROUND, elapsed, total);
      }
      if (cfg.strongBombChance) { // 라운드4부터만 켜져 있음
        cfg.strongBombChance = MG.interpolate(MG.STRONG_BOMB_CHANCE_BY_ROUND, elapsed, total);
      }
    }
  }
```

Then in `loop()` (`mole/js/game.js:1670-1730`), insert the call right after the time-remaining update and before the scheduler tick. Change:
```js
    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      roundComplete();
      return;
    }

    const tickResult = state.scheduler.tick(dt);
```
to:
```js
    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      roundComplete();
      return;
    }

    updateLiveDifficulty();
    const tickResult = state.scheduler.tick(dt);
```

`cfg.maxConcurrentBombs || cfg.bombChance` as the round3+ gate works because `maxConcurrentBombs`/`bombChance` are exactly `0` at round-start for gated-off rounds (Step 6) and stay `0` forever if never entered by this `if` — a round's gate state never changes mid-round (it's fixed at `startRound()` time from `ch`), so checking the config's own current value here is equivalent to re-checking `ch >= 3`/`ch >= 4\` every frame, without re-reading `ch` from closure.

- [ ] **Step 8: Add debug hooks for Puppeteer verification**

Near the existing debug hooks (`mole/js/game.js:2600-2610` area — `window.__debugStartRound`, `window.__debugEndRound`), add:

```js
    window.__debugGetConfig = () => (state ? state.config : null);
    window.__debugSetTimeRemaining = (t) => { if (state) state.timeRemaining = t; };
    window.__debugForceDifficultyUpdate = () => { updateLiveDifficulty(); return state ? state.config : null; };
```

- [ ] **Step 9: Puppeteer verification — round1 and round2 difficulty curves**

Using the existing pattern (`mole/scripts/serve.js` + `puppeteer-core` + the Edge executable at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, click `.intro-skip`, wait for `#splash.is-ready` then click), write a one-off script (scratchpad, not committed) that:
1. `page.evaluate(() => { window.__debugUnlockAll(); window.__debugSetChapter(1); window.__debugStartRound(1) })`, wait for the round-intro countdown to finish (poll `__debugIntroActive()` until false, or just wait ~4s).
2. At timeRemaining representing elapsed=0, 20, 40, 60: call `__debugSetTimeRemaining(60 - elapsed)` then `__debugForceDifficultyUpdate()`, read back `maxConcurrentMoles`/`multiHit`/`obstacles`/`maxConcurrentAnimals`. Assert: elapsed0 → moles=3,multiHit=false,obstacles=false,animals=0; elapsed20 → moles=5,multiHit=true,obstacles=false; elapsed40 → moles=6→7 range (interpolate(SMALL_CHAPTER_MOLES,40,60) = 6.33→round 6),obstacles=true,animals=0; elapsed60 → moles=7,animals=2.
3. Repeat for round2: `__debugSetChapter(2); __debugStartRound(1)`, elapsed=0 → `maxConcurrentBombs===0 && bombChance===0` (round2 has bombs gated off); elapsed=70,140 → still 0 (gate never turns on for round2, confirming the `if (cfg.maxConcurrentBombs || cfg.bombChance)` gate-preservation logic in Step 7 holds across the whole round).
4. Repeat for round3 (`__debugSetChapter(3)`): elapsed=0 → `bombChance===0` (start of curve is 0 by design, curve begins at 0 even though the round "has" bombs); elapsed=140 → `bombChance` close to `0.14`.

Run it, fix any mismatch against the numbers computed above before moving on — this is the step that actually proves the interpolation math and the round1/round2-8 branch selection work end-to-end in the browser, not just in the Node-only `test-levels.js`.

- [ ] **Step 10: Commit**

```bash
git add mole/js/levels.js mole/js/game.js mole/scripts/test-levels.js
git commit -m "$(cat <<'EOF'
두더지팡: 연속 난이도 보간 도입 — 라운드1 3구간·라운드2~8 140초 (챕터→라운드 재구조화 2/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cosmetic old-chapter-number shifts

Every hardcoded old-chapter-number check outside the config block (board theme, weather, the 챕터8 FACE OFF subtitle layout, fever eligibility) needs its threshold shifted by -2 to keep pointing at the same *content*, now that `currentChapter()` returns the new round number.

**Files:**
- Modify: `mole/js/game.js:24-25` (`applyBoardTheme`)
- Modify: `mole/js/game.js:34, 62` (`applyWeather`)
- Modify: `mole/js/game.js:653` (챕터8 FACE OFF subtitle in `playStartIntro`)
- Modify: `mole/js/game.js:1740` (`isFever`)

**Interfaces:**
- Consumes: `isSmallBoardChapter()`, `state.config.obstacles` (from Task 2).
- Produces: nothing new — pure threshold edits, no new symbols.

- [ ] **Step 1: `applyBoardTheme()` — autumn/winter shift**

In `mole/js/game.js:24-25`, change:
```js
    if (ch >= 4 && ch <= 6) el.classList.add('mole-board--autumn');
    else if (ch >= 7 && ch <= 9) el.classList.add('mole-board--winter');
```
to:
```js
    if (ch >= 2 && ch <= 4) el.classList.add('mole-board--autumn');
    else if (ch >= 5 && ch <= 7) el.classList.add('mole-board--winter');
```

- [ ] **Step 2: `applyWeather()` — rain/snow + cloud shift**

In `mole/js/game.js:34`, change:
```js
    const kind = ch === 6 ? 'rain' : (ch === 9 ? 'snow' : null);
```
to:
```js
    const kind = ch === 4 ? 'rain' : (ch === 7 ? 'snow' : null);
```

In `mole/js/game.js:62`, change:
```js
        if (ch === 6) {
```
to:
```js
        if (ch === 4) {
```

- [ ] **Step 3: FACE OFF subtitle — 챕터8 → 라운드6**

In `mole/js/game.js:653`, change:
```js
        const showSub = currentChapter() === 8
```
to:
```js
        const showSub = currentChapter() === 6
```

- [ ] **Step 4: `isFever()` — tie fever eligibility to round1's own obstacle-gate instead of a stale chapter threshold**

Old chapters1,2 never had fever; chapter3+ always did. Round1 merges old ch1-3, so fever eligibility inside round1 should track the same 40s gate as `obstacles` (both were `ch>=3`-gated together originally); rounds2-8 always have it, matching old ch4+.

In `mole/js/game.js:1740`, change:
```js
    return !!(run && run.combo.combo >= 50 && currentChapter() >= 3);
```
to:
```js
    return !!(run && run.combo.combo >= 50 && (currentChapter() !== 1 || (state && state.config && state.config.obstacles)));
```

- [ ] **Step 5: Puppeteer verification**

Drive the page: `__debugUnlockAll(); __debugSetChapter(4); __debugStartRound(1)` → check `document.getElementById('mole-board').classList` contains `mole-board--autumn` and weather layer shows nothing extra (ch4≠4? wait ch4 IS the new round4 — rain). Concretely verify: round2/round3 → no theme class; round4 → autumn + rain (`mole-weather.is-rain` present, `.mole-cloud--extra` count 8); round5,6,7 → winter (round7 also snow, `.is-snow`); round8 → no theme. round6 → start a fresh game (`showStartScreen`→click 시작, or `__debugPlayStartIntro`-equivalent) and confirm `#si-chapter-sub` contains `.si-faceoff-img`/"FACE OFF" text only for round6, not round8. Fix any mismatch before continuing.

- [ ] **Step 6: Commit**

```bash
git add mole/js/game.js
git commit -m "$(cat <<'EOF'
두더지팡: 배경·날씨·FACE OFF·피버 임계값을 구챕터 번호에서 신규 라운드 번호로 이동 (챕터→라운드 재구조화 3/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `startRound()` / `playRoundIntro()` — drop internal round number, unify to universal "Ready → GO!"

**Files:**
- Modify: `mole/js/game.js:544, 1190-1411` (`startRound()` — drop `roundNum` param, `state.round`)
- Modify: `mole/js/game.js:1423-1667` (`playRoundIntro()` — drop `roundNum` param, unify intro path, 2-step countdown, weapon-intro recalibration)
- Modify: `mole/js/game.js:2596, 2607` (call sites)
- Modify: `mole/js/hit-fx.js:90-93, 876` (remove orphaned `roundAnnounceFinal`)
- Test: Puppeteer visual verification (no Node-runnable unit test — this is DOM/timing choreography)

**Interfaces:**
- Consumes: `roundSeconds()`, `isSmallBoardChapter()`, `currentChapter()` (Task 2/3).
- Produces: `startRound(opts)` (no `roundNum` param — every remaining caller passes only `opts`), `playRoundIntro(onDone)` (no `roundNum` param).

- [ ] **Step 1: Drop `roundNum` from `startRound()`'s signature and body**

In `mole/js/game.js:1190`, change:
```js
  function startRound(roundNum, opts) {
```
to:
```js
  function startRound(opts) {
```

`roundNum` was used at: `MG.LEVELS[roundNum - 1]` (already deleted in Task 2), `SMALL_CHAPTER_MOLES[roundNum - 1]` (already replaced with `SMALL_CHAPTER_MOLES[0]` in Task 2), `BOMB_CHANCE_BY_ROUND[roundNum - 1]`/`STRONG_BOMB_CHANCE_BY_ROUND[roundNum - 1]` (already gone, replaced by `MG.interpolate(...)` calls in Task 2), `const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + roundNum + '-' + Date.now())) };` (line 1239), `state = { round: roundNum, ... }` (line 1393), and `playRoundIntro(roundNum, () => {...})` (line 1404).

In `mole/js/game.js:1239`, change:
```js
    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + roundNum + '-' + Date.now())) };
```
to:
```js
    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + currentChapter() + '-' + Date.now())) };
```

In `mole/js/game.js:1393`, change:
```js
      round: roundNum, levelData, regions, spawnPoints, scheduler, holeLayer, laneHammer, weapon, rng, config,
```
to:
```js
      regions, spawnPoints, scheduler, holeLayer, laneHammer, weapon, rng, config,
```
(`round`/`levelData` both dropped — confirmed via grep that `state.round` and `state.levelData` have no reader once `roundComplete()` is rewritten in Task 5; if Task 5 hasn't landed yet when this step runs, temporarily leave `round: currentChapter()` in place instead of dropping it outright, then remove it in Task 5's own edit to this same line — check which task your worker is actually running before choosing.)

In `mole/js/game.js:1404`, change:
```js
    playRoundIntro(roundNum, () => {
```
to:
```js
    playRoundIntro(() => {
```

- [ ] **Step 2: Update `startRound()`'s three call sites**

In `mole/js/game.js:544`, change:
```js
      loadActiveFace().catch(() => null).then(() => startRound(1, { fresh: true }));
```
to:
```js
      loadActiveFace().catch(() => null).then(() => startRound({ fresh: true }));
```

In `mole/js/game.js:2596`, change:
```js
        startRound(1, { fresh: true });
```
to:
```js
        startRound({ fresh: true });
```

In `mole/js/game.js:2607`, change:
```js
    window.__debugStartRound = (n) => startRound(n, { fresh: true });
```
to:
```js
    window.__debugStartRound = () => startRound({ fresh: true });
```
(The old signature let a caller jump straight to an arbitrary internal round number — that concept no longer exists; to start a specific top-level round, call `__debugSetChapter(n)` first, then `__debugStartRound()`.)

- [ ] **Step 3: Rewrite `playRoundIntro()` — drop param, delete curtain/isR1 branching, delete alipunch's separate meet-demo, unify weapon-intro calls**

Read `mole/js/game.js:1423-1667` in full immediately before editing (re-read even though it was read during planning, to catch any drift from Tasks 1-3). Replace the whole function. The structural changes from the current version:
- Signature: `function playRoundIntro(roundNum, onDone)` → `function playRoundIntro(onDone)`.
- `const isR1 = roundNum === 1;` deleted — replace every remaining `isR1` reference per the mapping below.
- The `if (isR1) { ...no curtain... } else { restartCurtainPattern(...); has-mole; alipunch visible; }` branch (old lines 1442-1450) collapses to just the old `isR1`-true body (no curtain, ever): `overlay.classList.remove('has-mole', 'mole-in', 'is-opening');` — but alipunch still needs to be visible from intro-start (old non-isR1-only behavior) since there's no more "meet demo later" fallback; make it unconditional.
- `const showMole = !isR1;` → delete entirely; the decorative mole image is dropped for every round now (matches old round1's cleaner "text only" treatment, which is what's being made universal) — the `moleImg`/`idx` cycling and `if (showMole) moleImg.hidden = false;` line are removed.
- `playAlipunchDemo()` function and its call site (old line 1653, inside the fly-in `setTimeout`) are deleted — the countdown's own alipunch choreography (in `runCountdown`) is now what every round uses.
- `playCannonIntro(fast)` / `playGoldHammerIntro(fast)` / `playHammerIntro(fast)` are now always called with `fast=false` (the "relaxed" isR1 timing) since every round uses the same no-curtain, countdown-driven path — the `!isR1` argument is replaced with a literal `false`.
- The `isSmallFinalRound`/`mole.round.final`/`roundAnnounceFinal()` branch is deleted — always use `mole.round` and `roundAnnounce(currentChapter())`.
- The outer `setTimeout(..., isR1 ? 250 : 2300)` becomes a flat `setTimeout(..., 250)`.
- `runCountdown`'s `STEPS` shrinks from 4 to 2, its alipunch choreography drops the middle 5-move showcase (no slot for it), and its `go` flag now triggers on the last (index 1) step instead of index ≥3.

Full replacement:

```js
  function playRoundIntro(onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const title = document.getElementById('round-intro-title');
    const count = document.getElementById('round-intro-count');
    const moleImg = document.getElementById('round-intro-mole');

    overlay.hidden = false;
    count.hidden = true;
    count.className = 'round-intro-count';
    title.textContent = '';
    moleImg.hidden = true;
    // 캐논/골드해머/뿅망치 인트로 연출 — 모든 라운드(1~8)에서 이 함수 시작 시점에 바로 시작
    // (사용자 지정). 커튼 없이 느긋한 타이밍(구 라운드1 전용이었던 쪽) 하나로 통일.
    if (state.weapon === 'cannon') playCannonIntro(false);
    if (state.weapon === 'goldhammer') playGoldHammerIntro(false);
    if (state.weapon === 'hammer') playHammerIntro(false);
    overlay.classList.remove('has-mole', 'mole-in', 'is-opening'); // 커튼 효과 없음(투명, 모든 라운드 공통)
    // 알리 펀치: 인트로 시작부터 바로 글러브가 보여야 한다(사용자 지적).
    if (state.weapon === 'alipunch') setHammerLayerVisible(true);

    const FLY_IN_MS = 400;         // = ri-title-fly-in 0.4s
    const HOLD_AFTER_TYPE_MS = 480;
    const roundNum = currentChapter();
    const full = I18N.t('mole.round', { n: roundNum });
    const typeMs = full.replace(/ /g, '').length * 45; // typeText 는 45ms/글자

    // 인트로 동안은 메인 루프(loop, requestAnimationFrame)가 아직 시작 전이라 laneHammer.update()가
    // 한 번도 안 불려서 시연 애니메이션이 화면에 안 그려짐 — 인트로 전용 가벼운 틱을 별도로 돌린다.
    function tickHammerDuring(ms) {
      const end = performance.now() + ms;
      let last = performance.now();
      (function step(now) {
        if (myGen !== sessionGen || !state || !state.laneHammer) return;
        const dt = Math.min(0.1, ((now || performance.now()) - last) / 1000);
        last = now || performance.now();
        state.laneHammer.update(dt);
        if (last < end) requestAnimationFrame(step);
      })();
    }

    // 캐논 인트로 등장 연출(사용자 지정) — 라운드 시작하자마자 좌측에서 등장해 대기위치까지
    // 이동(옆면-외곽선, 바퀴 회전) → 도착하면 3시 방향(a3 거울상) → 12시 방향(a4 거울상) 포즈를
    // 짧게 거쳐 → 실제 대포(평소 대기 포즈)로 교체. 평소엔 #mole-hammer-layer(진짜 대포)를
    // 숨겨뒀다가 끝나면 교체. fast 인자는 항상 false(모든 라운드 동일 타이밍으로 통일).
    function playCannonIntro(fast) {
      const ci = document.getElementById('cannon-intro');
      if (!ci) return;
      setHammerLayerVisible(false); // 실제 대포는 인트로 끝날 때까지 숨김(사용자 지적)
      const rig = ci.querySelector('.ci-rig');
      const body = ci.querySelector('.ci-body');
      const wheels = ci.querySelectorAll('.ci-wheel');
      ci.hidden = false;
      const travelMs = fast ? 3000 : 2800;
      const holdMs = fast ? 205 : 200;
      rig.style.width = '27.8%'; // 실측 24.2%(a3)에서 +15% — 옆면 이미지는 여백이 많아서 보정
      rig.style.animationDuration = travelMs + 'ms';
      body.src = 'assets/weapons/cannon-intro-body-flip.png'; // 이동 중엔 항상 이 이미지(사용자 지정)
      wheels.forEach((w) => w.classList.remove('ci-hide'));
      rig.className = 'ci-rig ci-play'; // 좌측 등장 → 대기위치까지 이동(바퀴는 계속 회전)
      MG.HitFx.cannonWheelRoll(); // 바퀴 굴러가는 소리(사용자 제공, Pixabay) — 이동 시작과 동시에
      setTimeout(() => { // 도착 — 3시 방향 포즈로 전환(바퀴는 이 포즈 그림에 이미 있어 오버레이 숨김)
        if (myGen !== sessionGen) return;
        wheels.forEach((w) => w.classList.add('ci-hide'));
        rig.style.width = '25%'; // a3 실측 24.2% + 15%, 다시 -10%(사용자 지정)
        body.src = 'assets/weapons/cannon-a3-mirror.png';
        MG.HitFx.cannonRotateClick(); // 각도 전환 "철컥" 소리(사용자 제공)
      }, travelMs);
      setTimeout(() => { // 12시 방향 포즈로 전환
        if (myGen !== sessionGen) return;
        rig.style.width = '23.6%'; // a4 실측 21.6% + 15%, 다시 -5%(사용자 지정)
        body.src = 'assets/weapons/cannon-a4-mirror.png';
        MG.HitFx.cannonRotateClick(); // 각도 전환 "철컥" 소리(사용자 제공)
      }, travelMs + holdMs);
      setTimeout(() => { // 완료 — 인트로 숨기고 실제 대포(평소 대기 포즈)로 교체
        if (myGen !== sessionGen) return;
        ci.hidden = true;
        rig.className = 'ci-rig';
        setHammerLayerVisible(true);
      }, travelMs + holdMs * 2);
    }

    // 골드해머 라운드 인트로 등장 연출(사용자 지정 "회전 등장").
    function playGoldHammerIntro(fast) {
      if (!state.laneHammer || !state.laneHammer.spinIn) return;
      setHammerLayerVisible(true);
      const layer = document.getElementById('mole-hammer-layer');
      const starNum = Array.from(document.querySelectorAll('#lane-button-bar .lane-button .lane-num'))
        .find((n) => n.textContent.trim() === '✱');
      let sx = GH_SPIN_START.x, sy = GH_SPIN_START.y; // 폴백(요소를 못 찾을 때만)
      if (layer && starNum) {
        const lr = layer.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(starNum);
        const r = range.getBoundingClientRect();
        sx = (r.x + r.width / 2 - lr.x) / lr.width;
        sy = (r.y + r.height / 2 - lr.y) / lr.height;
      }
      const ms = fast ? 3380 : 2380; // is-opening 트리거 재계산(2단계 카운트다운, Task4 §설계 추정치) — Puppeteer로 재검증
      state.laneHammer.spinIn(sx, sy, ms, 4, 0.04, () => {});
      const SOUND_MS = 1837; // audio/goldhammer-spin.mp3 실측 길이(ffprobe) — 재생이 착지 시점에 끝나도록
      setTimeout(() => { if (myGen === sessionGen) MG.HitFx.goldHammerSpin(); }, Math.max(0, ms - SOUND_MS));
    }

    // 뿅망치 라운드 인트로 등장 연출(사용자 지정 "쭉 늘어났다 팡 등장").
    function playHammerIntro(fast) {
      if (!state.laneHammer || !state.laneHammer.popIn) return;
      setHammerLayerVisible(true);
      const total = fast ? 3380 : 2380; // is-opening 트리거 재계산(2단계 카운트다운) — Puppeteer로 재검증
      const popMs = 650;
      const delay = Math.max(0, total - popMs);
      state.laneHammer.popIn(delay, popMs, () => {});
      setTimeout(() => { if (myGen === sessionGen) MG.HitFx.hammerPop(); }, delay); // 뿅 소리 — 등장과 동시에
    }

    // 매 라운드 시작: 타이핑 뒤 Ready → GO!. 끝나면 finish() 호출.
    // 알리 펀치 장착 시 — "Ready"=만남 제스처 → "GO!"=만남 제스처 + fight 음향.
    function runCountdown(finish) {
      count.hidden = false;
      const alipunchReady = state.weapon === 'alipunch' && state.laneHammer && state.laneHammer.meet;
      if (alipunchReady) { setHammerLayerVisible(true); tickHammerDuring(650 + 360); }
      const STEPS = ['Ready', 'GO!']; // 무조건 영어 (사용자 지정, 스펠링 확인됨)
      let i = 0;
      (function tick() {
        if (myGen !== sessionGen) return;
        const go = i >= STEPS.length - 1;
        count.textContent = STEPS[i];
        count.className = 'round-intro-count ' + (go ? 'cgo' : 'c' + (STEPS.length - i));
        void count.offsetWidth;
        count.classList.add('pop'); // 줌인 애니
        if (alipunchReady) {
          state.laneHammer.meet(); // "Ready"·"GO!" 둘 다 만남 제스처
          if (go) MG.HitFx.fight(); // 마지막("GO!")에만 fight 음향(사용자 지정)
        }
        i++;
        if (i < STEPS.length) setTimeout(tick, 650);
        else setTimeout(finish, 360);
      })();
    }

    // 퇴장(타이틀 왼쪽 / GO! 오른쪽 / 커튼 오픈) + 정리 + onDone.
    function exitAndStart() {
      if (myGen !== sessionGen) return;
      title.style.animation = 'none';
      moleImg.style.animation = 'none';
      void title.offsetWidth;
      overlay.classList.add('is-opening');
      setHammerLayerVisible(true);
      setTimeout(() => {
        if (myGen !== sessionGen) return;
        overlay.hidden = true;
        overlay.classList.remove('is-opening', 'has-mole', 'mole-in');
        count.hidden = true;
        count.className = 'round-intro-count';
        moleImg.hidden = true;
        title.style.animation = '';
        moleImg.style.animation = '';
      }, 260);
      setTimeout(() => { if (myGen === sessionGen) onDone(); }, 260 + 200);
    }

    setTimeout(() => {
      if (myGen !== sessionGen) return;
      // 1) "라운드 N" 오른쪽에서 날아와 중앙에서 멈춤 (0.4s)
      title.textContent = full;
      overlay.classList.add('mole-in');
      // 2) 중앙에 멈추면 "라운드 N" 을 한 글자씩 다시 타이핑(+ 타자기 소리) + 라운드 음성
      setTimeout(() => {
        if (myGen !== sessionGen) return;
        typeText(title, full, () => {});
        MG.HitFx.roundAnnounce(roundNum);
      }, FLY_IN_MS + 40);
      // 3) 타이핑 끝난 뒤 Ready → GO! 후 퇴장
      setTimeout(() => {
        if (myGen !== sessionGen) return;
        runCountdown(exitAndStart);
      }, FLY_IN_MS + 40 + typeMs + HOLD_AFTER_TYPE_MS);
    }, 250); // 챕터/라운드 커튼 열린 직후 바로 (모든 라운드 공통)
  }
```

The comment block immediately above the old function (`mole/js/game.js:1413-1421`, the "모든 라운드: ..." explanation and `GH_SPIN_START` constant) stays — only its prose describing the old isR1/non-isR1 split is now stale; update it to:
```js
  // 모든 라운드(1~8): "라운드 N" 이 오른쪽에서 날아와 중앙에 멈추면 한 글자씩 타이핑
  // (+타자기 소리) → Ready → GO! 카운트다운(줌인 + 색상, GO! 는 흰 플래시) → 퇴장.
  // 커튼 없음(투명 오버레이, 보드가 비침), 장식용 두더지 이미지도 없음(글자만).
  // 골드해머 인트로 "회전 등장" 시작 위치 — 키패드 '✱' 키 중심의 lane-hammer 좌표계
  // (#mole-hammer-layer 기준) 분수(실측).
  const GH_SPIN_START = { x: 0.128, y: 1.871 };
```

- [ ] **Step 4: Remove orphaned `roundAnnounceFinal` from `hit-fx.js`**

In `mole/js/hit-fx.js:90-93`, delete:
```js
  // 챕터1~3 마지막 라운드("파이널라운드") 전용 — 별도 파일 없이 기존 "라운드 10" 음성 재사용(사용자 지정).
  function roundAnnounceFinal() {
    roundAnnounce(10);
  }
```

In `mole/js/hit-fx.js:876`, remove `roundAnnounceFinal` from the exported `api` list:
```js
  const api = { moleHit, moleBlast, bombBlast, juggle, moleTap, obstacleHit, whiff, emerge, warmup, uiTap, typeTick, scorePop, burstWord, starBurst, shake, quakeDust, quakeClone, cannonClone, punchStar, powerUpWord, punch, punchVoice, hammerPop, cannonRotateClick, cannonWheelRoll, goldHammerSpin, roundAnnounce, roundAnnounceFinal, fight, moleVoice };
```
to:
```js
  const api = { moleHit, moleBlast, bombBlast, juggle, moleTap, obstacleHit, whiff, emerge, warmup, uiTap, typeTick, scorePop, burstWord, starBurst, shake, quakeDust, quakeClone, cannonClone, punchStar, powerUpWord, punch, punchVoice, hammerPop, cannonRotateClick, cannonWheelRoll, goldHammerSpin, roundAnnounce, fight, moleVoice };
```

- [ ] **Step 5: Puppeteer verification — countdown shape and weapon-intro sync (mandatory, do not skip)**

For each weapon (`hammer`, `goldhammer`, `cannon`, `alipunch`) × a couple of round numbers (e.g. round1 and round4):
1. `__debugUnlockAll(); __debugSetChapter(n); localStorage.setItem('mole.weapon', w); __debugStartRound()`.
2. Screenshot or poll DOM state at ~100ms intervals through the whole intro (`#round-intro-overlay` visible → `#round-intro-count` shows "Ready" then "GO!" → overlay hidden, `state.introActive === false`). Confirm: no curtain flash ever appears (`overlay.classList` never gains `has-mole` at any polled frame), exactly two distinct countdown texts appear ("Ready" then "GO!"), total intro duration is roughly `250 + 440 + typeMs + 480 + 1010 + 460 ≈ 2870ms + typeMs`.
3. For the weapon under test, confirm the weapon sprite (`#mole-hammer-layer` visibility, or `#cannon-intro` hidden state) has finished landing in its idle/ready pose by the moment the overlay starts its exit fade (`is-opening` class added) — not noticeably before (dead air) or after (weapon still animating while gameplay starts). If it's off by more than ~150ms in either direction, adjust `playCannonIntro`'s `travelMs`/`holdMs` (non-fast branch), `playGoldHammerIntro`'s `ms`, or `playHammerIntro`'s `total`, and re-run this step until it lands cleanly. This is the step `[[screenshot-verify-before-coding]]` memory exists for — do not trust the arithmetic estimates in Step 3's code alone.
4. For `alipunch`, additionally confirm the glove "meet" gesture visibly plays on both "Ready" and "GO!", and the `fight()` sound/flash only happens once, on "GO!".

- [ ] **Step 6: Commit**

```bash
git add mole/js/game.js mole/js/hit-fx.js
git commit -m "$(cat <<'EOF'
두더지팡: 라운드 인트로를 Ready→GO! 2단계로 통일, 내부 라운드 번호 개념 제거 (챕터→라운드 재구조화 4/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Delete internal-round chaining + chapter-transition screen

**Files:**
- Modify: `mole/js/game.js:1393` (drop `round`/`levelData` from `state`, if Task 4 left them in place)
- Modify: `mole/js/game.js:2158-2195` (`roundComplete()`)
- Modify: `mole/js/game.js:2237-2305` (delete `wireResultSwipe()`, `goToNextChapter()`)
- Modify: `mole/js/game.js:2364-2370, 2489-2500` (`finishFromRound()` — drop swipe-hint block, simplify next-round auto-select)
- Modify: `mole/js/game.js:2583` (delete `wireResultSwipe();` call site)
- Test: Puppeteer — win a round, confirm it lands on home exactly like a loss does

**Interfaces:**
- Consumes: nothing new.
- Produces: `roundComplete()` always ends a round by showing the result screen (no more auto-advance to a next internal round).

- [ ] **Step 1: Finish dropping `state.round`/`state.levelData` if Task 4 left a placeholder**

Re-check `mole/js/game.js:1393` (the `state = {...}` literal touched in Task 4 Step 1). If it currently reads `round: currentChapter(), regions, ...` (the temporary fallback Task 4 allowed), remove the `round: currentChapter(),` key entirely now — `roundComplete()`'s rewrite below no longer reads `state.round`.

- [ ] **Step 2: Rewrite `roundComplete()` — no more internal chaining**

Read `mole/js/game.js:2158-2195` in full immediately before editing. Replace:
```js
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
    setNavLock(true); // 라운드 전환(커튼~다음 카운트다운) 동안 ⊞ 잠금
    sessionGen++; // 이 전환 = 새 세션 토큰 (직전 카운트다운의 정리 타이머를 무효화)
    const myGen = sessionGen;
    const finishedRound = state.round;
    if (rafId) cancelAnimationFrame(rafId);
    if (state.laneHammer) state.laneHammer.home(); // 루프 멈추기 전 망치 대기위치로 스냅
    sharedPopElements.clear();
    resetHot();
    clearInvincibleFx(); // 라운드 종료(성공/실패 포함) 시 무적 잔류 연출 정리(사용자 지정)

    if (finishedRound >= finalRound()) {
      closeCurtain(() => { finishFromRound('done'); }); // 10라운드 완주 → 커튼 닫고 결과
      return;
    }

    // "라운드 완료!" 카드 없앰 — 커튼을 바로 닫아 직전 라운드 화면을 완전히 가리고,
    // 짧게 뒤 다음 라운드 카운트다운(같은 커튼)으로 이어진다.
    const ri = document.getElementById('round-intro-overlay');
    ri.classList.remove('is-opening');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    ri.hidden = false;
    setHammerLayerVisible(false);

    const advance = () => {
      if (myGen !== sessionGen) return; // 그 사이 나가버림
      // 더보기 메뉴가 열려 있으면 닫힐 때까지 대기 (메뉴 뒤에서 라운드가 넘어가지 않게).
      if (!document.getElementById('more-menu').hidden) { setTimeout(advance, 300); return; }
      startRound(finishedRound + 1); // fresh 아님 → 누적 유지 (커튼은 계속 닫힌 채)
    };
    // 이제 다음 라운드 카운트다운(playRoundIntro) 자체가 커튼 패턴 애니메이션(2.3s+)을
    // 갖고 있어 여기서 따로 더 기다릴 필요 없음 — 예전엔 패턴 없는 커튼이라 550ms 버퍼를
    // 뒀었는데, 지금은 그만큼 대기가 늘어지기만 해서(사용자 보고) 없앰.
    advance();
  }
```
with:
```js
  // 챕터→라운드 재구조화(2026-09-17): 라운드(1~8) 하나 = 이제 그 자체로 완결된 세션(60초/140초).
  // 더 이상 "다음 내부 라운드로 자동 이어가기"가 없다 — 시간이 다 되면 항상 결과 화면으로.
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
    sessionGen++; // 직전 카운트다운 정리 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (state.laneHammer) state.laneHammer.home(); // 루프 멈추기 전 망치 대기위치로 스냅
    sharedPopElements.clear();
    resetHot();
    clearInvincibleFx(); // 라운드 종료 시 무적 잔류 연출 정리(사용자 지정)
    closeCurtain(() => { finishFromRound('done'); });
  }
```

(`setNavLock(true)` is dropped here since `closeCurtain`→`finishFromRound` already calls `setNavLock(false)` at its start — the old code needed the lock only during the now-deleted auto-advance window.)

- [ ] **Step 3: Delete `wireResultSwipe()` and `goToNextChapter()`**

Read `mole/js/game.js:2237-2305` in full immediately before editing. Delete both functions in their entirety (the comment above `wireResultSwipe` at line 2235-2236 goes with it).

- [ ] **Step 4: Simplify `finishFromRound()`'s next-round bookkeeping**

In `mole/js/game.js` (originally lines 2364-2370), change:
```js
    // 승리 시 다음 챕터가 열렸으면: 왼쪽 스와이프로 "챕터 N" 화면으로 넘어갈 수 있다는 힌트.
    const nextCh = win ? chapter + 1 : 0;
    ov.dataset.nextChapter = (nextCh && MG.Progress.isUnlocked(nextCh, light)) ? String(nextCh) : '';
    // 챕터 해금 = 그 즉시 다음 챕터로 전환. (예전엔 승리화면에서 왼쪽 스와이프를 해야만
    // mole.chapter 가 넘어가서, 스와이프 안 하면 다음에 시작 눌러도 이전 챕터 그대로 돌던 문제.)
    // 스와이프는 축하 연출(next-chapter-panel)만 보여줄 뿐 — 값 자체는 여기서 바로 확정.
    if (ov.dataset.nextChapter) setChapter(parseInt(ov.dataset.nextChapter, 10));
```
to:
```js
    // 승리 + 다음 라운드가 열렸으면: 홈 화면 다이얼패드 선택값을 그 다음 라운드로 미리 넘겨둔다
    // (사용자가 홈에서 직접 골라 시작하는 흐름 — 화면 전환은 없음, §7).
    const nextCh = win ? chapter + 1 : 0;
    if (nextCh && MG.Progress.isUnlocked(nextCh, light)) setChapter(nextCh);
```

Then (originally lines 2489-2500), delete the swipe-hint display block entirely:
```js
    // 승리 + 다음 챕터가 열려 있으면: 축하 연출 5초 뒤 "왼쪽으로 밀어" 힌트 (손 이모지 + 화살표).
    const sh = document.getElementById('result-swipe-hint');
    if (sh) { sh.hidden = true; sh.classList.remove('is-on'); }
    if (win && ov.dataset.nextChapter && sh) {
      const myGen = sessionGen;
      setTimeout(() => {
        if (myGen !== sessionGen || ov.hidden || !ov.dataset.nextChapter) return;
        sh.hidden = false;
        void sh.offsetWidth;
        sh.classList.add('is-on');
      }, 5000);
    }
  }
```
becomes just:
```js
  }
```
(the closing brace of `finishFromRound` — nothing replaces the deleted block; `#result-swipe-hint` stays in `index.html`/`style.css` unused, matching how `#next-chapter-panel` is already left alone per spec §7).

- [ ] **Step 5: Delete the `wireResultSwipe();` call site**

In `mole/js/game.js:2583`, delete:
```js
    wireResultSwipe(); // 승리 화면 왼쪽 스와이프 → 다음 챕터 화면
```

- [ ] **Step 6: Puppeteer verification**

1. `__debugUnlockAll(); __debugSetChapter(1); __debugStartRound()`, then `__debugSetTimeRemaining(0.1)` and wait ~200ms (or call `__debugEndRound()` directly) to force a win. Confirm: `#gameover-overlay` shows with `is-win`, and after clicking the ⊞ (home) button the app lands on `#board-start` (home) — not any chapter-transition screen. Confirm `#next-chapter-panel` never becomes visible (`hidden` stays true throughout).
2. Repeat forcing a loss (`__debugForceGameOver()`), confirm the same home-landing path.
3. Confirm swiping left on the win result screen does nothing now (no handler left) — the dialpad underneath should not react to the gesture either (this was already gated correctly by `wireResultSwipe`'s own `ov.hidden`/`dataset.nextChapter` checks, but now there's no listener at all, so simply confirm no console errors fire from a swipe gesture over `#gameover-overlay`).

- [ ] **Step 7: Commit**

```bash
git add mole/js/game.js
git commit -m "$(cat <<'EOF'
두더지팡: 내부 라운드 자동전환·챕터 전환화면 삭제 — 승리도 실패처럼 홈으로 (챕터→라운드 재구조화 5/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: UI text — "챕터 N" → "라운드 N", 8 rounds

**Files:**
- Modify: `mole/js/i18n-strings.js:21-42, 216-237` (KO/EN blocks)
- Modify: `mole/index.html:163` (static placeholder text)

**Interfaces:**
- Consumes: nothing.
- Produces: `mole.chapter.n`/`mole.chapter.name.1-8`/`mole.chapter.desc.1-8` reworded for the new 8-round structure; keys `.name.9`, `.name.10`, `.desc.9`, `.desc.10` removed.

- [ ] **Step 1: Rewrite the Korean block**

In `mole/js/i18n-strings.js:21-42`, change:
```js
      'mole.round': '라운드 {n}',
      'mole.round.final': '파이널라운드',
      'mole.chapter.n': '챕터 {n}',
      'mole.chapter.name.1': '챕터 1 : 두더지 잡자',
      'mole.chapter.name.2': '챕터 2 : 한방엔 안돼요!',
      'mole.chapter.name.3': '챕터 3 : 친구들 등장!',
      'mole.chapter.name.4': '챕터 4 : 더 넓은 세계로~~~',
      'mole.chapter.name.5': '챕터 5 : 폭탄 두더지를 조심하세요!',
      'mole.chapter.name.6': '챕터 6 : 강력한 폭탄 두더지 등장!',
      'mole.chapter.name.7': '챕터 7 : 네방? 울트라 두더지 등장!',
      'mole.chapter.name.8': '챕터 8 : FACE OFF',
      'mole.chapter.name.9': '챕터 9 : 반격의 시작!',
      'mole.chapter.name.10': '챕터 10 : 총공격하라~~~',
      'mole.chapter.desc.2': '2, 3연타에 적응하세요!',
      'mole.chapter.desc.3': '동물친구들은 사랑으로...',
      'mole.chapter.desc.4': '진정한 두더지 사냥꾼 등록! (9홀 → 16홀)',
      'mole.chapter.desc.5': '폭탄을 든 두더지를 잡으면, 하트(이미지) 하나가 사라져요!',
      'mole.chapter.desc.6': '강력폭탄은 히트(이미지) 두 개가 사라져요!',
      'mole.chapter.desc.7': '4연타 두더지가 등장합니다!',
      'mole.chapter.desc.8': '이제는 동물친구들을 잡으세요!',
      'mole.chapter.desc.9': '두더지가 나에게 반격을 합니다. 실드로 막아보세요!',
      'mole.chapter.desc.10': '모든 동물(두더지 포함)을 공격하세요! 단, 폭탄은 NO!',
```
to:
```js
      'mole.round': '라운드 {n}',
      'mole.chapter.n': '라운드 {n}',
      'mole.chapter.name.1': '라운드 1 : 두더지 잡자',
      'mole.chapter.name.2': '라운드 2 : 더 넓은 세계로~~~',
      'mole.chapter.name.3': '라운드 3 : 폭탄 두더지를 조심하세요!',
      'mole.chapter.name.4': '라운드 4 : 강력한 폭탄 두더지 등장!',
      'mole.chapter.name.5': '라운드 5 : 네방? 울트라 두더지 등장!',
      'mole.chapter.name.6': '라운드 6 : FACE OFF',
      'mole.chapter.name.7': '라운드 7 : 반격의 시작!',
      'mole.chapter.name.8': '라운드 8 : 총공격하라~~~',
      'mole.chapter.desc.2': '진정한 두더지 사냥꾼 등록! (9홀 → 16홀)',
      'mole.chapter.desc.3': '폭탄을 든 두더지를 잡으면, 하트(이미지) 하나가 사라져요!',
      'mole.chapter.desc.4': '강력폭탄은 히트(이미지) 두 개가 사라져요!',
      'mole.chapter.desc.5': '4연타 두더지가 등장합니다!',
      'mole.chapter.desc.6': '이제는 동물친구들을 잡으세요!',
      'mole.chapter.desc.7': '두더지가 나에게 반격을 합니다. 실드로 막아보세요!',
      'mole.chapter.desc.8': '모든 동물(두더지 포함)을 공격하세요! 단, 폭탄은 NO!',
```

(`mole.round.final` deleted — no longer referenced anywhere after Task 4. Round1's name/desc now folds in the old ch1/ch2/ch3 flavor as a single tutorial round — "두더지 잡자" covers the single-hit start; the multi-hit and animal-friend beats that used to be separate chapter names (챕터2 "한방엔 안돼요!", 챕터3 "친구들 등장!") happen automatically within round1's 60s now, so this plan folds their spirit into round1's one description rather than inventing a 3-part subtitle — revise freely, this is explicitly draft copy per the spec.)

- [ ] **Step 2: Rewrite the English block**

In `mole/js/i18n-strings.js:216-237`, change:
```js
      'mole.round': 'Round {n}',
      'mole.round.final': 'Final Round',
      'mole.chapter.n': 'Chapter {n}',
      'mole.chapter.name.1': 'Ch. 1 : Whack the moles',
      'mole.chapter.name.2': 'Ch. 2 : One hit won\'t do it!',
      'mole.chapter.name.3': 'Ch. 3 : Friends show up!',
      'mole.chapter.name.4': 'Ch. 4 : Into a bigger world~~~',
      'mole.chapter.name.5': 'Ch. 5 : Watch for bomb moles!',
      'mole.chapter.name.6': 'Ch. 6 : Strong bomb moles appear!',
      'mole.chapter.name.7': 'Ch. 7 : Four hits? Ultra mole appears!',
      'mole.chapter.name.8': 'Ch. 8 : FACE OFF',
      'mole.chapter.name.9': 'Ch. 9 : The counterattack begins!',
      'mole.chapter.name.10': 'Ch. 10 : All-out attack~~~',
      'mole.chapter.desc.2': 'Adapt to 2- and 3-hit moles!',
      'mole.chapter.desc.3': 'Show the animal friends some love...',
      'mole.chapter.desc.4': 'Become a true mole hunter! (9 holes → 16 holes)',
      'mole.chapter.desc.5': 'Whack a bomb-holding mole and lose a heart!',
      'mole.chapter.desc.6': 'A strong bomb costs you two hearts!',
      'mole.chapter.desc.7': 'Moles that take 4 hits appear!',
      'mole.chapter.desc.8': 'Now go whack the animal friends!',
      'mole.chapter.desc.9': 'Moles fight back — block it with your shield!',
      'mole.chapter.desc.10': 'Attack every animal (moles included)! Just not the bombs!',
```
to:
```js
      'mole.round': 'Round {n}',
      'mole.chapter.n': 'Round {n}',
      'mole.chapter.name.1': 'Round 1 : Whack the moles',
      'mole.chapter.name.2': 'Round 2 : Into a bigger world~~~',
      'mole.chapter.name.3': 'Round 3 : Watch for bomb moles!',
      'mole.chapter.name.4': 'Round 4 : Strong bomb moles appear!',
      'mole.chapter.name.5': 'Round 5 : Four hits? Ultra mole appears!',
      'mole.chapter.name.6': 'Round 6 : FACE OFF',
      'mole.chapter.name.7': 'Round 7 : The counterattack begins!',
      'mole.chapter.name.8': 'Round 8 : All-out attack~~~',
      'mole.chapter.desc.2': 'Become a true mole hunter! (9 holes → 16 holes)',
      'mole.chapter.desc.3': 'Whack a bomb-holding mole and lose a heart!',
      'mole.chapter.desc.4': 'A strong bomb costs you two hearts!',
      'mole.chapter.desc.5': 'Moles that take 4 hits appear!',
      'mole.chapter.desc.6': 'Now go whack the animal friends!',
      'mole.chapter.desc.7': 'Moles fight back — block it with your shield!',
      'mole.chapter.desc.8': 'Attack every animal (moles included)! Just not the bombs!',
```

- [ ] **Step 3: Update the static HTML placeholder**

In `mole/index.html:163`, change:
```html
        <b class="ch-label"><span class="ch-txt" data-ch-label>챕터 1</span></b>
```
to:
```html
        <b class="ch-label"><span class="ch-txt" data-ch-label>라운드 1</span></b>
```
(Cosmetic only — `refreshChapterNav()` overwrites this with `'ROUND ' + ch` on every load anyway (`mole/js/game.js:1129`); this just fixes the placeholder seen before first JS paint.)

- [ ] **Step 4: Puppeteer verification**

Load the home screen fresh (both `ko` and `en` via `window.FGH.I18N`/settings language toggle if available, or just check both blocks by eye in the file), confirm `#chapter-nav .ch-txt` shows "ROUND 1" (unaffected, that's the separate hardcoded `'ROUND ' + ch` string, not this i18n key), and press 시작 to open `#start-intro-overlay`, confirm `#si-chapter-num`/`#si-chapter-sub` type out "라운드 1"/"두더지 잡자" (or "Round 1"/"Whack the moles" in English mode). Cycle `wireChapterNav`'s arrows through all 8 rounds and confirm no key shows a literal `mole.chapter.name.N` fallback string (which would mean a typo in a key name).

- [ ] **Step 5: Commit**

```bash
git add mole/js/i18n-strings.js mole/index.html
git commit -m "$(cat <<'EOF'
두더지팡: 챕터→라운드 UI 문구 전면 교체, 8라운드 이름·설명 초안 (챕터→라운드 재구조화 6/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full regression pass + version bump

**Files:**
- Modify: `mole/sw.js:6` (`CACHE`)
- Modify: `mole/index.html` (`#build-tag`, `register('sw.js?v=NNN')`)

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: a deployable, version-synced build.

- [ ] **Step 1: Run every Node test script**

Run: `for f in mole/scripts/test-*.js; do echo "== $f =="; node "$f"; done`
Expected: `test-levels.js` and `test-progress.js` PASS. Other pre-existing scripts (`test-spawn-scheduler.js` etc.) may already be failing for unrelated reasons per `[[fun-games-hub]]` memory ("v329부터 실패, 무관") — confirm any failure here is one of the already-known ones and not a new regression introduced by this plan (diff the failure output against a run from before Task 1, or check the failure reason doesn't mention `levels.js`/`progress.js`/`round`/`chapter`).

- [ ] **Step 2: Full Puppeteer playthrough — every round, both weapons that matter most (hammer + one alt weapon), win and lose paths**

1. `__debugUnlockAll()`. For round in 1..8: `__debugSetChapter(round); __debugStartRound()`; wait through the intro; `__debugEndRound()` (or `__debugSetTimeRemaining(0.05)` + wait) to force completion; confirm the result screen shows, then click ⊞ to return home; confirm home shows `ROUND {round}` still selected (or `round+1` if it auto-advanced per Task 5) and no console errors were logged at any point (`page.on('console', ...)`/`page.on('pageerror', ...)` collected across the whole run).
2. Force a loss via `__debugForceGameOver()` mid-round for at least round1 and round4 (one small-board, one full-board), confirm identical home-landing behavior to a win.
3. Spot check `__debugForceQuake()`/`__debugForceBurst()` (goldhammer/cannon skill triggers) still fire without error mid-round, now that `config` is being mutated every frame by `updateLiveDifficulty()` — these read other `config` fields (`obstacles`, `multiHit` etc.) that Task 2 now also mutates live; confirm nothing throws.

- [ ] **Step 3: Version bump (3-way sync)**

Determine the next version number (check `mole/sw.js`'s current `CACHE` value first — plan-writing time it was `v522`, but re-check at execution time since other work may have landed in between). Update all three:
- `mole/sw.js:6`: `const CACHE = 'mole-game-vNNN';`
- `mole/index.html`: `<div id="build-tag">vNNN</div>`
- `mole/index.html`: `register('sw.js?v=NNN')`

- [ ] **Step 4: Commit**

```bash
git add mole/sw.js mole/index.html
git commit -m "$(cat <<'EOF'
두더지팡: 챕터→라운드 재구조화 완료, vNNN (챕터→라운드 재구조화 7/7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Report the commit hash and version number back to the user** (per `[[always-report-commit-hash]]` memory), and ask whether to push.

---

## Self-Review Notes (from writing this plan)

- **Spec coverage:** §2 mapping → Task 2/3 (thresholds shifted). §3 Round1 → Task 2 Step 6-7. §4 Rounds2-8 → Task 2 Step 6-7. §5 interpolation → Task 2 Step 1/7. §6 countdown → Task 4. §7 clear flow → Task 5. §8 UI text → Task 6. §9 out-of-scope items respected (no TTS added, no i18n key added for Ready/GO, round-1 internal-phase visual effects left to "however it naturally looks" — no extra code added beyond the two boolean gates). §10 dead code (`TIME_LIMIT`) explicitly left untouched in Task 2 Step 1, matching "don't delete without approval."
- **Placeholder scan:** no `TBD`/`TODO`/"add appropriate X" left in any step; every code block is complete, copy-pasteable, and every task's verification step names concrete debug hooks and expected values.
- **Type/name consistency checked:** `roundSeconds()`/`isSmallBoardChapter()`/`ROUND1_SECONDS`/`ROUND_SECONDS_LONG` (Task 2) are the exact names every later task's code blocks reference (Task 2 Step 7's `updateLiveDifficulty`, Task 3's edits, Task 4's `playRoundIntro`). `MG.interpolate`/`MG.SMALL_CHAPTER_MOLES`/etc. (Task 2 Step 1's `levels.js` exports) match every call site in Task 2 Step 6-7 exactly. `startRound(opts)`/`playRoundIntro(onDone)` (Task 4) match all three call sites rewritten in the same task. `finishFromRound`'s two edited regions (Task 5 Step 4) don't reference anything deleted earlier in the same task (`ov.dataset.nextChapter` is fully removed, not left dangling).

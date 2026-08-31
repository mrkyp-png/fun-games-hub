# 두더지 게임 레인 버튼 조작 + 대각 망치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두더지를 직접 터치하는 조작을 없애고, 하단 열 버튼 4개 + 우측 하단에서 대각선으로 스윙하는 망치로 바꾼다. 판정은 열 전체.

**Architecture:** 순수 로직(`spawn-scheduler.resolveColumn`, `grid-partition` 의 col/row)과 순수 비주얼(`lane-hammer`, `hit-fx`, `lane-controls`)을 분리한다. `game.js` 가 오케스트레이터: 입력 → 열 판정 + 망치 스윙 → 망치가 착지하는 순간(impact 콜백)에 점수·목숨·시간·연출·히트스톱을 적용한다.

**Tech Stack:** 바닐라 JS (`<script>` 태그, 번들러 없음, `window.MoleGame` 네임스페이스), 순수 로직 모듈은 Node+브라우저 이중 export + `node assert` 단위 테스트, DOM 은 puppeteer-core(헤드리스 Edge)로 스모크. Python/PIL 슬라이스 스크립트는 이번 범위 밖.

**Spec:** `docs/superpowers/specs/2026-08-31-mole-lane-hammer-controls-design.md`

## Global Constraints

- 그리드는 전 레벨 **4×4 = 16칸 고정** (`GRID_SIZE = 4`). `regionId === row * 4 + col`.
- 콤보 점수표(`combo-score.js` `comboToPoints`), 별 등급(`computeStars`), 다타 확률(5/15/80), 유지시간 배수(`DURATION_MULT`), 레벨 파라미터(`levels.js`) — **변경 금지**.
- 다타 두더지 연타 쿨다운 `HIT_COOLDOWN = 0.12s`, 퇴장 연출 시간 `RETREAT_SEC = 0.6s` — 유지.
- 순수 로직 모듈은 `if (typeof module !== 'undefined' && module.exports) module.exports = api;` 와 `if (root) { root.MoleGame = ...; }` 두 줄을 모두 갖는다. 비주얼 모듈은 `root` 줄만.
- 새 단위 테스트 파일은 반드시 `scripts/run-all-tests.js` 에 등록한다.
- 스모크 서버는 **리포지토리 루트**에서 `PORT=8845 node scripts/serve.js` 로 띄운다 (`mole/scripts/` 아님).
- 커밋 메시지: `feat(mole): ...` / `test(mole): ...` / `docs(mole): ...` 형식. 훅 스킵 금지.
- 브랜치: 현재 작업 트리에 미커밋 변경이 많다. 이 계획은 그 위에 이어서 커밋한다 (사용자 지시). 별도 브랜치 만들지 않는다.

---

## File Structure

**신규:**
- `mole/js/lane-controls.js` — 하단 버튼 4개 + 포인터/키보드 입력. 열 인덱스만 콜백. 게임 상태 모름.
- `mole/js/lane-hammer.js` — 망치 하나의 상태 기계 + 트랜스폼. `strike(col, y, onImpact)` / `update(dt)` / `isBusy()` / `clear()`. 순수 비주얼.
- `mole/js/hit-fx.js` — 타격 연출 스포너(별/"쾅!"/흙먼지/모자튕김/쉐이크/햅틱/합성음). `hammer-fx.js` 대체. 순수 비주얼.
- `mole/scripts/test-lane-resolve.js` — `resolveColumn` 단위 테스트 (또는 `test-spawn-scheduler.js` 확장 — 아래 Task 2에서 확장 방식 채택).

**수정:**
- `mole/js/grid-partition.js` — 각 spawnPoint 에 `col`, `row` 추가.
- `mole/js/spawn-scheduler.js` — `resolveOne(pop)` 헬퍼 추출, `resolveColumn(col)` 추가, `resolveHit` 는 `resolveOne` 위임으로 유지, `trySpawn` 이 `pop.col = sp.col` 복사.
- `mole/js/pop-elements.js` — `create({ container })` (onHit 제거), pop 별 `pointerdown` 리스너 제거, `flash(popId)` 추가.
- `mole/js/game.js` — `handlePopHit` → `handleColumn` + `onHammerImpact`, `laneControls`/`laneHammer` 생성·정리, 루프에 `laneHammer.update(dt)` + 히트스톱 + 버튼 hot 갱신 + `levelClear` 를 `!laneHammer.isBusy()` 로 게이트, `__debugHitColumn` 훅 추가.
- `mole/index.html` — `#mole-board` 안에 `#mole-hammer-layer`, `#game-screen` 에 `#lane-button-bar`, 새 스크립트 로드, `hammer-fx.js` 스크립트 제거.
- `mole/style.css` — `.lane-button-bar` / `.lane-button` / `.lane-button--hot` / `#mole-hammer-layer` / `.lane-hammer` / 보드 사이징 / `.mole-pop { pointer-events: none }` / 쉐이크·플래시·별·"쾅!"·흙먼지 키프레임.
- `mole/scripts/verify-mole-smoke.js` — 두더지 직접 터치 검사 → 레인 버튼/키보드/열 판정/망치 스윙 검사로 교체.
- `mole/scripts/run-all-tests.js` — 새 테스트 등록 (Task 2에서 `test-spawn-scheduler.js` 확장이면 불필요, 확인만).
- `mole/두더지게임-기획서.md` — §4/§5 재작성, §8/§11/§12 보강.

**삭제:**
- `mole/js/hammer-fx.js` (Task 6에서 `hit-fx.js` 로 대체 후 삭제).

---

## Task 1: grid-partition — 각 spawnPoint 에 col / row

**Files:**
- Modify: `mole/js/grid-partition.js:13-31`
- Test: `mole/scripts/test-grid-partition.js`

**Interfaces:**
- Consumes: 없음
- Produces: `MG.GridPartition.partition({ gridSize })` → `{ regions: [{id}], spawnPoints: [{ id, regionId, x, y, col, row }] }`. `col` 은 `0..gridSize-1`, `row` 는 `0..gridSize-1`, `regionId === row * gridSize + col`.

- [ ] **Step 1: 실패하는 테스트 추가**

`mole/scripts/test-grid-partition.js` 의 `console.log('test-grid-partition.js: all assertions passed');` 바로 위에 추가:

```javascript
// 5) 각 출현 지점에 col(0..3), row(0..3) 가 붙고 regionId = row*4 + col
{
  const { spawnPoints } = partition({ gridSize: 4 });
  assert.strictEqual(spawnPoints.length, 16);
  spawnPoints.forEach((sp) => {
    assert.ok(Number.isInteger(sp.col) && sp.col >= 0 && sp.col < 4, `col in range (got ${sp.col})`);
    assert.ok(Number.isInteger(sp.row) && sp.row >= 0 && sp.row < 4, `row in range (got ${sp.row})`);
    assert.strictEqual(sp.regionId, sp.row * 4 + sp.col, 'regionId must equal row*4 + col');
  });
  // 첫 행은 col 0..3, row 0
  assert.deepStrictEqual(spawnPoints.slice(0, 4).map((s) => s.col), [0, 1, 2, 3]);
  assert.deepStrictEqual(spawnPoints.slice(0, 4).map((s) => s.row), [0, 0, 0, 0]);
  // 마지막 지점은 col 3, row 3
  assert.strictEqual(spawnPoints[15].col, 3);
  assert.strictEqual(spawnPoints[15].row, 3);
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd mole && node scripts/test-grid-partition.js`
Expected: FAIL — `AssertionError: col in range (got undefined)`

- [ ] **Step 3: 구현**

`mole/js/grid-partition.js` 의 `spawnPoints.push({ ... })` 를 다음으로 교체:

```javascript
        spawnPoints.push({
          id,
          regionId: id,
          col,
          row,
          x: (col + 0.5) / gridSize,
          y: V_TOP + row * vStep
        });
```

- [ ] **Step 4: 통과 확인**

Run: `cd mole && node scripts/test-grid-partition.js`
Expected: `test-grid-partition.js: all assertions passed`

- [ ] **Step 5: 커밋**

```bash
git add mole/js/grid-partition.js mole/scripts/test-grid-partition.js
git commit -m "feat(mole): add col/row to grid-partition spawn points"
```

---

## Task 2: spawn-scheduler — resolveColumn(col)

**Files:**
- Modify: `mole/js/spawn-scheduler.js:63-82` (trySpawn), `:120-139` (resolveHit → resolveOne + resolveColumn), `:157` (export)
- Test: `mole/scripts/test-spawn-scheduler.js` (기존 `makeSpawnPoints` 확장 + 신규 케이스 11~14)

**Interfaces:**
- Consumes: Task 1 의 spawnPoint `.col`
- Produces:
  - `pop.col` (스폰 시 `sp.col` 복사)
  - `scheduler.resolveColumn(col)` → `Array<{ type: 'mole'|'animal'|'bomb', regionId: number, done: boolean, xFrac: number, yFrac: number, hitsTaken?: number, hitsRequired?: number }>` — 그 열의 활성·비-dying pop 을 전부 판정. 두더지 처치(`done:true`)면 `completedRegions` 에 즉시 추가하고 `pop.dying = true`, `pop.remaining = RETREAT_SEC`. 다타 미완이면 `done:false` + `hitsTaken` 증가 + `HIT_COOLDOWN`. 쿨다운 중이거나 이미 dying 인 pop 은 결과에서 빠진다.
  - `scheduler.resolveHit(popId)` — 시그니처·동작 유지(단일 pop 을 `resolveOne` 으로 처리), 반환 객체에 `xFrac`/`yFrac` 추가됨.

- [ ] **Step 1: 실패하는 테스트 추가**

`mole/scripts/test-spawn-scheduler.js` 의 `makeSpawnPoints` 를 교체 (col 지원, 기존 호출은 col=0 유지):

```javascript
function makeSpawnPoints(regionIds, cols) {
  return regionIds.map((regionId, i) => ({
    id: i, regionId, x: i / regionIds.length, y: 0.5,
    col: cols ? cols[i] : 0
  }));
}
```

`console.log('test-spawn-scheduler.js: all assertions passed');` 바로 위에 추가:

```javascript
// 11) resolveColumn: 그 열의 두더지 1마리 → 결과 1개 done:true, 영역 완성
{
  const regions = [{ id: 0 }, { id: 1 }];
  const spawnPoints = makeSpawnPoints([0, 1], [0, 1]); // region 0 -> col 0, region 1 -> col 1
  const config = { maxConcurrentMoles: 2, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(21) });
  let mole;
  for (let t = 0; t < 50 && !mole; t++) {
    const { spawned } = scheduler.tick(0.1);
    mole = spawned.find((p) => p.type === 'mole');
  }
  assert.ok(mole, 'a mole spawned');
  const res = scheduler.resolveColumn(mole.col);
  assert.strictEqual(res.length, 1, 'one result for one mole in the column');
  assert.strictEqual(res[0].type, 'mole');
  assert.strictEqual(res[0].done, true);
  assert.strictEqual(typeof res[0].xFrac, 'number');
  assert.strictEqual(typeof res[0].yFrac, 'number');
  // 그 열이 아닌 다른 열을 치면 아무것도 안 맞음
  assert.strictEqual(scheduler.resolveColumn(mole.col === 0 ? 1 : 0).length, 0);
}

// 12) resolveColumn: 빈 열 → 빈 배열
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0], [2]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 30 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(22) });
  scheduler.tick(0.1);
  assert.deepStrictEqual(scheduler.resolveColumn(0), []);
  assert.deepStrictEqual(scheduler.resolveColumn(3), []);
}

// 13) resolveColumn: 두더지 + 동물이 같은 열 → 결과 2개, 영역 완성 + 동물 결과 존재
{
  const regions = [{ id: 0 }, { id: 1 }];
  // 두 스폰 지점 모두 col 0, 서로 다른 region (두더지는 region당 1마리 제한 회피)
  const spawnPoints = makeSpawnPoints([0, 1], [0, 0]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 1, maxConcurrentBombs: 0, popDuration: 30, molePoseCount: 8 };
  const scheduler = create({ regions, spawnPoints, config, rng: makeRng(23) });
  let haveMole = false, haveAnimal = false;
  for (let t = 0; t < 200 && !(haveMole && haveAnimal); t++) {
    scheduler.tick(0.1);
    const pops = scheduler.getActivePops();
    haveMole = pops.some((p) => p.type === 'mole' && p.col === 0);
    haveAnimal = pops.some((p) => p.type === 'animal' && p.col === 0);
  }
  assert.ok(haveMole && haveAnimal, 'a mole and an animal are both up in column 0');
  const res = scheduler.resolveColumn(0);
  assert.strictEqual(res.length, 2, 'both pops resolved');
  assert.ok(res.some((r) => r.type === 'mole' && r.done), 'mole finished');
  assert.ok(res.some((r) => r.type === 'animal'), 'animal hit reported');
}

// 14) resolveColumn: 2히트 두더지는 열 강타 2번에 처치
{
  const regions = [{ id: 0 }];
  const spawnPoints = makeSpawnPoints([0], [1]);
  const config = { maxConcurrentMoles: 1, maxConcurrentAnimals: 0, maxConcurrentBombs: 0, popDuration: 60, molePoseCount: 8 };
  let scheduler, mole;
  for (let seed = 1; seed < 400 && !mole; seed++) {
    scheduler = create({ regions, spawnPoints, config, rng: makeRng(seed) });
    for (let t = 0; t < 40 && !mole; t++) {
      const m = scheduler.tick(0.1).spawned.find((p) => p.type === 'mole' && p.hitsRequired === 2);
      if (m) mole = m;
    }
  }
  assert.ok(mole, 'found a 2-hit mole');
  const r1 = scheduler.resolveColumn(1);
  assert.strictEqual(r1[0].done, false, 'first column smash knocks it down');
  assert.ok(!scheduler.isComplete());
  scheduler.tick(0.2); // 쿨다운 해제
  const r2 = scheduler.resolveColumn(1);
  assert.strictEqual(r2[0].done, true, 'second column smash finishes it');
  assert.ok(scheduler.isComplete());
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd mole && node scripts/test-spawn-scheduler.js`
Expected: FAIL — `TypeError: scheduler.resolveColumn is not a function`

- [ ] **Step 3: 구현**

`mole/js/spawn-scheduler.js` `trySpawn` 에서 pop 생성 줄에 `col` 추가:

```javascript
      const pop = { id: nextPopId++, type, spawnPointId: sp.id, regionId: sp.regionId, col: sp.col, x: sp.x, y: sp.y, remaining: config.popDuration };
```

기존 `function resolveHit(popId) { ... }` 블록 전체(약 120~139행)를 다음으로 교체:

```javascript
    function resolveOne(pop) {
      if (pop.dying) return null;

      if (pop.type === 'mole' && pop.hitsRequired > 1) {
        if (pop.hitCooldown > 0) return null; // 연타 무시
        pop.hitsTaken += 1;
        if (pop.hitsTaken < pop.hitsRequired) {
          pop.hitCooldown = HIT_COOLDOWN;
          return { type: 'mole', regionId: pop.regionId, done: false, xFrac: pop.x, yFrac: pop.y, hitsTaken: pop.hitsTaken, hitsRequired: pop.hitsRequired };
        }
      }

      // 최종 타격 — 두더지든 방해물이든 땅속으로 물러나는 연출을 위해 잠깐 남겨둔다.
      if (pop.type === 'mole') completedRegions.add(pop.regionId);
      pop.dying = true;
      pop.remaining = RETREAT_SEC;
      return { type: pop.type, regionId: pop.regionId, done: true, xFrac: pop.x, yFrac: pop.y };
    }

    function resolveHit(popId) {
      const pop = active.get(popId);
      return pop ? resolveOne(pop) : null;
    }

    // 열 강타: 그 열의 활성 pop 을 전부 판정한다 (기획서 v1.4 조작).
    function resolveColumn(col) {
      const out = [];
      active.forEach((pop) => {
        if (pop.col !== col) return;
        const r = resolveOne(pop);
        if (r) out.push(r);
      });
      return out;
    }
```

`return { tick, resolveHit, isComplete, completedRegionCount, getActivePops, forceCompleteAll };` 를 다음으로:

```javascript
    return { tick, resolveHit, resolveColumn, isComplete, completedRegionCount, getActivePops, forceCompleteAll };
```

- [ ] **Step 4: 통과 확인**

Run: `cd mole && node scripts/test-spawn-scheduler.js`
Expected: `test-spawn-scheduler.js: all assertions passed`

- [ ] **Step 5: 전체 단위 테스트 확인**

Run: `cd mole && node scripts/run-all-tests.js`
Expected: `✓ all mole game logic tests passed` (기존 test-grid-partition, test-mole-sprites 등 전부 통과)

- [ ] **Step 6: 커밋**

```bash
git add mole/js/spawn-scheduler.js mole/scripts/test-spawn-scheduler.js
git commit -m "feat(mole): add resolveColumn(col) to spawn scheduler"
```

---

## Task 3: lane-hammer.js — 대각 스윙 망치

**Files:**
- Create: `mole/js/lane-hammer.js`
- (테스트 없음 — 순수 비주얼, Task 6 스모크에서 검증)

**Interfaces:**
- Consumes: `assets/hammer.png`
- Produces: `MG.LaneHammer.create({ layer, gridSize })` → `{ strike(col, targetYFrac, onImpact), update(dt), isBusy(), clear() }`
  - `strike(col, targetYFrac, onImpact)`: 그 열로 스윙 시작. 착지 프레임에 `onImpact()` 1회 호출.
  - `update(dt)`: 매 프레임 호출. 상태 기계 전진 + 트랜스폼 페인트.
  - `isBusy()`: 스윙/복귀 중이면 `true` (idle 이면 `false`).
  - `clear()`: idle 로 리셋.

- [ ] **Step 1: 파일 생성**

`mole/js/lane-hammer.js`:

```javascript
(function (root) {
  'use strict';

  // 우측 하단 축에서 대각선으로 스윙하는 망치 하나 (기획서 §5, v1.4).
  // 회전 각도가 어느 열을 때리는지 결정. 이동 시간은 예비동작(wind) 안에 숨긴다.
  // 순수 비주얼 — 게임 상태를 전혀 모른다. update(dt) 를 메인 루프가 매 프레임 호출.

  const WIND_SEC = 0.07;    // 예비: 어깨 뒤로 젖힘 (이동도 이 동안)
  const SWING_SEC = 0.06;   // 타격: 대각선으로 내리침
  const RECOVER_SEC = 0.14; // 복귀 (중단 가능)
  const IDLE_DEG = -18;     // 대기 자세
  const WIND_DEG = -82;     // 예비 자세
  const HIT_DEG = 10;       // 타격 끝 자세

  function lerp(a, b, k) { return a + (b - a) * k; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function create({ layer, gridSize }) {
    const el = document.createElement('div');
    el.className = 'lane-hammer';
    const img = document.createElement('img');
    img.src = 'assets/hammer.png';
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);

    let phase = 'idle';        // 'idle' | 'wind' | 'swing' | 'recover'
    let t = 0;                 // 현재 phase 경과 시간(초)
    let fromCol = gridSize - 1;
    let toCol = gridSize - 1;
    let curCol = gridSize - 1; // 화면상 현재 열 (보간값)
    let targetY = 0.5;         // 목표 정수리 yFrac
    let impactCb = null;
    let fired = false;

    function colXFrac(col) { return (col + 0.5) / gridSize; }

    function strike(col, targetYFrac, onImpact) {
      fromCol = curCol;
      toCol = col;
      targetY = (typeof targetYFrac === 'number') ? targetYFrac : 0.5;
      impactCb = onImpact || null;
      fired = false;
      phase = 'wind';
      t = 0;
    }

    function update(dt) {
      if (phase === 'idle') { paint(); return; }
      t += dt;

      if (phase === 'wind') {
        curCol = lerp(fromCol, toCol, clamp01(t / WIND_SEC) * 0.35);
        if (t >= WIND_SEC) { phase = 'swing'; t = 0; }
      } else if (phase === 'swing') {
        curCol = lerp(fromCol + (toCol - fromCol) * 0.35, toCol, clamp01(t / SWING_SEC));
        if (!fired && t >= SWING_SEC) {
          fired = true;
          if (impactCb) { const cb = impactCb; impactCb = null; cb(); }
          phase = 'recover'; t = 0;
        }
      } else if (phase === 'recover') {
        curCol = toCol;
        if (t >= RECOVER_SEC) { phase = 'idle'; t = 0; }
      }
      paint();
    }

    function paint() {
      let deg = IDLE_DEG;
      let lunge = 0;
      if (phase === 'wind') {
        deg = lerp(IDLE_DEG, WIND_DEG, clamp01(t / WIND_SEC));
      } else if (phase === 'swing') {
        const k = clamp01(t / SWING_SEC);
        deg = lerp(WIND_DEG, HIT_DEG, k);
        lunge = Math.sin(k * Math.PI) * 7;
      } else if (phase === 'recover') {
        deg = lerp(HIT_DEG, IDLE_DEG, clamp01(t / RECOVER_SEC));
      }
      el.style.left = (colXFrac(curCol) * 100) + '%';
      el.style.top = ((phase === 'idle' ? 0.5 : targetY) * 100 - lunge) + '%';
      el.style.transform = 'translate(-50%, -100%) rotate(' + deg.toFixed(1) + 'deg)';
    }

    function isBusy() { return phase !== 'idle'; }

    function clear() {
      phase = 'idle'; t = 0; curCol = gridSize - 1; targetY = 0.5; impactCb = null; fired = false;
      paint();
    }

    paint();
    return { strike, update, isBusy, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneHammer = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: 문법 확인**

Run: `node --check mole/js/lane-hammer.js`
Expected: (출력 없음, exit 0)

- [ ] **Step 3: 커밋**

```bash
git add mole/js/lane-hammer.js
git commit -m "feat(mole): add lane-hammer diagonal swing module"
```

---

## Task 4: hit-fx.js — 타격 연출 스포너

**Files:**
- Create: `mole/js/hit-fx.js`
- (테스트 없음 — 순수 비주얼, Task 6 스모크에서 검증)

**Interfaces:**
- Consumes: `assets/helmet.png`
- Produces: `MG.HitFx` → `{ moleHit(boardEl, xFrac, yFrac), obstacleHit(boardEl, xFrac, yFrac, kind), whiff(boardEl, xFrac) }`. 모두 fire-and-forget. 좌표는 `#mole-board` 기준 분수.

- [ ] **Step 1: 파일 생성**

`mole/js/hit-fx.js`:

```javascript
(function (root) {
  'use strict';

  // 타격 연출 스포너 (기획서 §5 v1.4). 전부 fire-and-forget.
  // 좌표는 #mole-board 기준 분수(0~1). hammer-fx.js 를 대체한다.

  let audioCtx = null;

  function spawnAt(boardEl, cls, xFrac, yFrac, html) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.left = (xFrac * 100) + '%';
    d.style.top = (yFrac * 100) + '%';
    if (html) d.innerHTML = html;
    boardEl.appendChild(d);
    d.addEventListener('animationend', () => d.remove(), { once: true });
    // 애니메이션이 안 도는 환경 대비 안전 제거
    setTimeout(() => d.remove(), 1200);
    return d;
  }

  function shake(boardEl) {
    boardEl.classList.remove('mole-board--shake');
    void boardEl.offsetWidth; // reflow 로 애니메이션 재시작
    boardEl.classList.add('mole-board--shake');
  }

  function tone(freq, type) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq * (0.92 + Math.random() * 0.16);
      g.gain.setValueAtTime(0.14, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + 0.13);
    } catch (e) { /* 오디오 불가 환경 무시 */ }
  }

  function vibrate(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* noop */ } }
  }

  function moleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>쾅!</span>');
    spawnAt(boardEl, 'hit-fx-helmet', xFrac, yFrac);
    for (let i = 0; i < 5; i++) spawnAt(boardEl, 'hit-fx-dust', xFrac, yFrac);
    vibrate(15);
    tone(320);
  }

  function obstacleHit(boardEl, xFrac, yFrac /*, kind */) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-clang', xFrac, yFrac, '<span>깡!</span>');
    vibrate([10, 25, 10]);
    tone(140, 'sawtooth');
  }

  function whiff(boardEl, xFrac) {
    for (let i = 0; i < 3; i++) spawnAt(boardEl, 'hit-fx-dust', xFrac, 0.9);
    tone(90, 'sine');
  }

  const api = { moleHit, obstacleHit, whiff };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HitFx = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: 문법 확인**

Run: `node --check mole/js/hit-fx.js`
Expected: (출력 없음, exit 0)

- [ ] **Step 3: 커밋**

```bash
git add mole/js/hit-fx.js
git commit -m "feat(mole): add hit-fx juice spawner module"
```

---

## Task 5: lane-controls.js — 하단 버튼 + 입력

**Files:**
- Create: `mole/js/lane-controls.js`
- (테스트 없음 — DOM 입력, Task 6 스모크에서 검증)

**Interfaces:**
- Consumes: 없음
- Produces: `MG.LaneControls.create({ buttonBar, gridSize, onColumn })` → `{ setColumnHot(col, hot), clear() }`
  - 생성 시 `buttonBar` 안에 `<button class="lane-button" data-col="N">N+1</button>` 를 `gridSize` 개 만든다.
  - 버튼 `pointerdown` 또는 키보드 `1`/`2`/`3`/`4` → `onColumn(col)` (col 은 0-index).
  - `setColumnHot(col, hot)`: 해당 버튼에 `.lane-button--hot` 토글.
  - `clear()`: 버튼 제거 + `keydown` 리스너 해제.

- [ ] **Step 1: 파일 생성**

`mole/js/lane-controls.js`:

```javascript
(function (root) {
  'use strict';

  // 하단 레인 버튼 (기획서 §4 v1.4). 각 버튼 = 격자 한 열. 열 인덱스만 콜백으로 내보낸다.
  // 게임 상태를 전혀 모른다.

  const KEY_COL = { '1': 0, '2': 1, '3': 2, '4': 3 };

  function create({ buttonBar, gridSize, onColumn }) {
    const buttons = [];

    for (let col = 0; col < gridSize; col++) {
      const b = document.createElement('button');
      b.className = 'lane-button';
      b.type = 'button';
      b.dataset.col = String(col);
      b.textContent = String(col + 1);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onColumn(col);
      });
      buttonBar.appendChild(b);
      buttons.push(b);
    }

    function onKey(e) {
      if (e.repeat) return;
      const col = KEY_COL[e.key];
      if (col !== undefined && col < gridSize) onColumn(col);
    }
    window.addEventListener('keydown', onKey);

    function setColumnHot(col, hot) {
      if (buttons[col]) buttons[col].classList.toggle('lane-button--hot', !!hot);
    }

    function clear() {
      window.removeEventListener('keydown', onKey);
      buttons.forEach((b) => b.remove());
      buttons.length = 0;
    }

    return { setColumnHot, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: 문법 확인**

Run: `node --check mole/js/lane-controls.js`
Expected: (출력 없음, exit 0)

- [ ] **Step 3: 커밋**

```bash
git add mole/js/lane-controls.js
git commit -m "feat(mole): add lane-controls button/input module"
```

---

## Task 6: 통합 — pop-elements / game.js / index.html / style.css + 스모크 재작성

**Files:**
- Modify: `mole/js/pop-elements.js` (onHit 제거, flash 추가)
- Modify: `mole/js/game.js` (handleColumn, 배선, 루프, 디버그 훅)
- Modify: `mole/index.html` (레이어, 버튼 바, 스크립트)
- Modify: `mole/style.css` (버튼 바, 망치, 보드 사이징, 키프레임)
- Delete: `mole/js/hammer-fx.js`
- Modify: `mole/scripts/verify-mole-smoke.js` (레인 조작 검증으로 교체)

**Interfaces:**
- Consumes: Task 1 `spawnPoint.col/row`, Task 2 `scheduler.resolveColumn`, Task 3 `MG.LaneHammer`, Task 4 `MG.HitFx`, Task 5 `MG.LaneControls`
- Produces:
  - `MG.PopElements.create({ container })` → `{ sync, clear, flash(popId) }` (onHit 파라미터 제거)
  - `window.__debugHitColumn(col)` — 레벨 진행 중 해당 열을 강타 (스모크용, 영구 훅)

- [ ] **Step 1: pop-elements 에서 직접 터치 제거 + flash 추가**

`mole/js/pop-elements.js`:

`function create({ container, onHit }) {` → `function create({ container }) {`

`el.addEventListener('pointerdown', () => onHit(pop.id, pop.x, pop.y));` 줄 **삭제**.

`clear` 함수 정의 다음, `return { sync, clear };` 앞에 추가:

```javascript
    // 타격 순간 흰 플래시 (transform 을 건드리지 않아 sink 애니메이션과 충돌 없음).
    function flash(popId) {
      const m = pops.get(popId);
      if (m) {
        m.img.classList.remove('mole-pop-img--hit');
        void m.img.offsetWidth;
        m.img.classList.add('mole-pop-img--hit');
      }
    }
```

`return { sync, clear };` → `return { sync, clear, flash };`

- [ ] **Step 2: index.html 배선**

`mole/index.html`:

`<div id="mole-pop-layer" class="mole-board-layer"></div>` 와 `<div id="mole-hole-front-layer" ...>` 사이는 그대로. `#mole-hole-front-layer` 다음 줄에 추가:

```html
      <div id="mole-hammer-layer" class="mole-board-layer"></div>
```

`</section>` (game-screen 닫기, `<div id="mole-board">` 를 감싼) 바로 앞, `</div>` (`#mole-board` 닫기) 다음에 추가:

```html
    <div id="lane-button-bar"></div>
```

스크립트 영역: `<script src="js/hammer-fx.js"></script>` 줄을 삭제하고, 그 자리에 다음 3줄 추가 (`js/pop-elements.js` 다음, `js/region-reveal.js` 앞 순서 무관하지만 `js/game.js` 보다는 앞):

```html
<script src="js/hit-fx.js"></script>
<script src="js/lane-hammer.js"></script>
<script src="js/lane-controls.js"></script>
```

- [ ] **Step 3: hammer-fx.js 삭제**

```bash
git rm mole/js/hammer-fx.js
```

- [ ] **Step 4: game.js — 배선 + handleColumn + 루프 + 디버그 훅**

`mole/js/game.js`:

**(a)** `startLevel` 안, `sharedPopElements` 생성 블록을 교체:

```javascript
    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer')
      });
    }
    sharedPopElements.clear();

    const laneHammer = MG.LaneHammer.create({
      layer: document.getElementById('mole-hammer-layer'),
      gridSize: GRID_SIZE
    });
    const laneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: GRID_SIZE,
      onColumn: handleColumn
    });
```

**(b)** `state = { ... }` 객체에 필드 추가:

```javascript
    state = {
      levelData, regions, spawnPoints, scheduler, regionReveal, holeLayer,
      laneHammer, laneControls,
      comboScore: MG.ComboScore.create(),
      lives: START_LIVES,
      timeRemaining: levelData.timeLimit,
      hitstopUntil: 0,
      ended: false
    };
```

**(c)** `backToSelect` 에 정리 추가 (`sharedPopElements.clear();` 다음):

```javascript
    if (state && state.laneControls) state.laneControls.clear();
```
그리고 `startLevel` 시작부의 `if (rafId) cancelAnimationFrame(rafId);` 다음 줄에:
```javascript
    if (state && state.laneControls) state.laneControls.clear();
```

**(d)** `handlePopHit` 함수 전체를 삭제하고 다음으로 교체:

```javascript
  // ---------- 레인 버튼 입력 → 열 강타 ----------
  function handleColumn(col) {
    if (!state || state.ended) return;
    const results = state.scheduler.resolveColumn(col);

    // 망치 목표 정수리: 그 열 결과 중 done 인 두더지 우선, 없으면 첫 결과, 없으면 열 중앙.
    const primary =
      results.find((r) => r.type === 'mole' && r.done) ||
      results[0] || null;
    const targetY = primary ? primary.yFrac : 0.5;

    state.laneHammer.strike(col, targetY, () => onHammerImpact(col, results));
  }

  function onHammerImpact(col, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;

    results.forEach((r) => {
      if (r.type === 'mole') {
        if (r.done) {
          state.comboScore.onMoleHit();
          state.regionReveal.lighten();
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        }
      } else if (r.type === 'animal') {
        state.lives -= 1;
        state.comboScore.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
        flashHud('hud-hearts');
      } else if (r.type === 'bomb') {
        state.timeRemaining = Math.max(0, state.timeRemaining - 3);
        state.comboScore.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'bomb');
        flashHud('hud-time');
      }
    });

    if (results.length === 0) {
      MG.HitFx.whiff(board, (col + 0.5) / GRID_SIZE);
    }
    if (moleHits > 0) {
      const ms = Math.min(120, 70 + state.comboScore.combo * 10);
      state.hitstopUntil = performance.now() + ms;
      // flash 는 done 두더지 pop 에 걸고 싶지만 pop id 가 결과에 없다 → 다음 sync 의 dying 슬라이드로 충분.
    }

    updateHUD();
    if (state.lives <= 0) {
      syncPops();
      updateHUD();
      gameOver('lives');
    }
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
  }
```

**(e)** `loop` 함수 교체:

```javascript
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

    // 열별 버튼 hot: 그 열에 두더지(방해물 아님)가 떠 있으면 빛낸다.
    const moleCols = new Set();
    state.scheduler.getActivePops().forEach((p) => {
      if (p.type === 'mole' && !p.dying) moleCols.add(p.col);
    });
    for (let c = 0; c < GRID_SIZE; c++) state.laneControls.setColumnHot(c, moleCols.has(c));

    updateHUD();

    if (state.scheduler.isComplete() && !state.laneHammer.isBusy()) {
      levelClear();
      return;
    }

    rafId = requestAnimationFrame(loop);
  }
```

**(f)** 디버그 훅 블록에 추가 (`window.__debugForceGameOver = ...` 다음):

```javascript
    window.__debugHitColumn = function (col) {
      if (state) handleColumn(col);
    };
```

- [ ] **Step 5: style.css — 버튼 바 / 망치 / 보드 / 키프레임**

`mole/style.css`:

**(a)** `.mole-board` 의 `width` 줄 교체 (버튼 바 자리 확보):

```css
  width: min(calc(100% - 24px), calc(100dvh - 260px));
```

**(b)** `#mole-pop-layer` 블록 교체 (직접 터치 완전 비활성):

```css
#mole-pop-layer { pointer-events: none; }
#mole-pop-layer .mole-pop { pointer-events: none; }
```

**(c)** 파일 끝에 추가:

```css
/* ---- 레인 버튼 바 (기획서 §4 v1.4) ---- */
#lane-button-bar {
  display: flex;
  gap: 8px;
  padding: 0 12px 16px;
  flex: 0 0 auto;
}
.lane-button {
  flex: 1;
  height: 76px;
  border: none;
  border-radius: 16px;
  background: var(--card-bg);
  color: var(--ink);
  font-size: 1.4rem;
  font-weight: 800;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.06s, box-shadow 0.12s, background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.lane-button:active { transform: translateY(3px) scale(0.97); }
.lane-button--hot {
  background: #6d5bd0;
  box-shadow: 0 0 14px 2px rgba(150, 130, 255, 0.7);
}

/* ---- 망치 ---- */
#mole-hammer-layer { pointer-events: none; overflow: visible; }
.lane-hammer {
  position: absolute;
  width: 34%;
  transform-origin: 100% 100%;
  will-change: transform, left, top;
}
.lane-hammer img { display: block; width: 100%; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.45)); }

/* ---- 타격 연출 ---- */
.mole-board--shake { animation: mole-shake 0.2s ease-out; }
@keyframes mole-shake {
  0% { transform: translate(0, 0); }
  25% { transform: translate(-4px, 3px); }
  50% { transform: translate(3px, -2px); }
  75% { transform: translate(-2px, 2px); }
  100% { transform: translate(0, 0); }
}
.hit-fx-burst, .hit-fx-clang {
  position: absolute;
  transform: translate(-50%, -60%);
  font-weight: 900;
  font-size: 1.8rem;
  color: #ffe14d;
  text-shadow: 0 2px 0 #b26a00, 0 0 10px rgba(255,225,77,0.8);
  pointer-events: none;
  animation: hit-pop 0.4s ease-out forwards;
}
.hit-fx-clang { color: #cfd8ff; text-shadow: 0 2px 0 #445, 0 0 10px rgba(200,210,255,0.8); }
@keyframes hit-pop {
  0% { transform: translate(-50%, -60%) scale(0.4); opacity: 0; }
  30% { transform: translate(-50%, -75%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -95%) scale(1); opacity: 0; }
}
.hit-fx-helmet {
  position: absolute;
  width: 12%;
  height: 12%;
  background: no-repeat center/contain url('assets/moles/helmet.png');
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: hit-helmet 0.5s ease-in forwards;
}
@keyframes hit-helmet {
  0% { transform: translate(-50%, -50%) rotate(0) scale(1); opacity: 1; }
  100% { transform: translate(-120%, 40%) rotate(-140deg) scale(0.7); opacity: 0; }
}
.hit-fx-dust {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7a5230;
  pointer-events: none;
  animation: hit-dust 0.45s ease-out forwards;
}
@keyframes hit-dust {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.9; }
  100% { transform: translate(calc(-50% + var(--dx, 20px)), calc(-50% - 30px)) scale(0.2); opacity: 0; }
}
.mole-pop-img--hit { animation: mole-pop-hit 0.15s ease-out; }
@keyframes mole-pop-hit {
  0%, 100% { filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)); }
  40% { filter: brightness(2.6) drop-shadow(0 0 10px #fff); }
}
.hud-flash { animation: hud-flash 0.3s ease-out; }
@keyframes hud-flash {
  0%, 100% { color: inherit; }
  40% { color: #ff5a5a; text-shadow: 0 0 8px rgba(255,90,90,0.9); }
}
```

> 참고: `.hit-fx-dust` 의 `--dx` 는 지금 고정값(20px)만 쓰인다. 여러 방향으로 튀게 하려면 이후 `hit-fx.js` 에서 인라인으로 `d.style.setProperty('--dx', ...)` 를 넣어 튜닝한다 (범위 밖, 사용자와 조정).

- [ ] **Step 6: verify-mole-smoke.js — 레인 조작 검증으로 교체**

`mole/scripts/verify-mole-smoke.js` 에서 **기존 3c 블록**(`// 3c) 두더지가 이모지 글리프가 아니라...` 부터 `assert.ok(/assets\/moles\/.+\.png$/.test(moleImg.src), ...)` 까지)은 유지하고, 그 **다음에** 아래 블록을 삽입 (`// 4) 모든 영역 강제 완성` 앞):

```javascript
    // 3d) 레인 버튼 4개가 렌더된다
    const laneButtonCount = await page.evaluate(() => document.querySelectorAll('#lane-button-bar .lane-button').length);
    assert.strictEqual(laneButtonCount, 4, 'exactly 4 lane buttons render');

    // 3e) 두더지가 직접 터치로는 안 잡힌다 (회귀 방지)
    const beforeDirect = await page.evaluate(() => document.getElementById('hud-region-count').textContent);
    await page.evaluate(() => {
      const el = document.querySelector('.mole-pop--mole');
      if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 150));
    const afterDirect = await page.evaluate(() => document.getElementById('hud-region-count').textContent);
    assert.strictEqual(afterDirect, beforeDirect, 'tapping a mole directly must do nothing');

    // 3f) 두더지가 뜬 열의 레인 버튼을 누르면 그 영역이 완성된다
    let hitDone = false;
    for (let i = 0; i < 40 && !hitDone; i++) {
      await new Promise((r) => setTimeout(r, 100));
      hitDone = await page.evaluate(() => {
        const el = document.querySelector('.mole-pop--mole');
        if (!el) return false;
        const before = +document.getElementById('hud-region-count').textContent.split('/')[0];
        const col = Math.floor(parseFloat(el.style.left) / 100 * 4);
        const btn = document.querySelector(`#lane-button-bar .lane-button[data-col="${col}"]`);
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        window.__smokeBefore = before;
        return true;
      });
    }
    assert.ok(hitDone, 'a mole appeared and its lane button was pressed');
    await new Promise((r) => setTimeout(r, 400)); // 스윙 + impact + sync
    const afterLane = await page.evaluate(() => ({
      after: +document.getElementById('hud-region-count').textContent.split('/')[0],
      before: window.__smokeBefore,
      hammerXform: getComputedStyle(document.querySelector('.lane-hammer')).transform
    }));
    assert.ok(afterLane.after > afterLane.before, 'pressing the lane button completed a region');
    assert.ok(afterLane.hammerXform && afterLane.hammerXform !== 'none', 'the hammer element has a transform (it swung)');

    // 3g) 키보드로도 열을 칠 수 있다 (__debugHitColumn 은 안 쓰고 실제 keydown)
    await page.evaluate(() => window.__debugStartLevel(1)); // 깨끗한 상태로 리셋
    await new Promise((r) => setTimeout(r, 300));
    let kbDone = false;
    for (let i = 0; i < 40 && !kbDone; i++) {
      await new Promise((r) => setTimeout(r, 100));
      kbDone = await page.evaluate(() => {
        const el = document.querySelector('.mole-pop--mole');
        if (!el) return false;
        const col = Math.floor(parseFloat(el.style.left) / 100 * 4);
        window.__kbBefore = +document.getElementById('hud-region-count').textContent.split('/')[0];
        window.dispatchEvent(new KeyboardEvent('keydown', { key: String(col + 1) }));
        return true;
      });
    }
    assert.ok(kbDone, 'a mole appeared for the keyboard test');
    await new Promise((r) => setTimeout(r, 400));
    const kbAfter = await page.evaluate(() => ({
      after: +document.getElementById('hud-region-count').textContent.split('/')[0],
      before: window.__kbBefore
    }));
    assert.ok(kbAfter.after > kbAfter.before, 'keyboard 1-4 completes a region');
```

**기존 4) 블록**은 그대로 두되, 그 앞에 레벨 재시작이 이미 있으므로 문제 없음. 만약 3g 의 `__debugStartLevel(1)` 로 상태가 바뀌어 4) 가 실패하면, 4) 블록 맨 앞에 `await page.evaluate(() => window.__debugStartLevel(1)); await new Promise((r) => setTimeout(r, 300));` 를 추가한다.

- [ ] **Step 7: 스모크 서버 띄우고 실행**

```bash
# 리포지토리 루트에서
PORT=8845 node scripts/serve.js &
sleep 2
node mole/scripts/run-all-tests.js
node mole/scripts/verify-mole-smoke.js
# 끝나면 서버 종료
```
Expected:
- `✓ all mole game logic tests passed`
- `verify-mole-smoke.js: all assertions passed`

- [ ] **Step 8: 브라우저 콘솔 에러 없음 확인 + 스크린샷**

`mole/scripts/` 에 임시 스크립트 없이, 아래를 리포지토리 루트에서 (서버 떠 있는 상태):

```bash
node -e "const p=require('puppeteer-core');(async()=>{const b=await p.launch({executablePath:'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',headless:true});const pg=await b.newPage();const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push(String(e)));await pg.goto('http://localhost:8845/mole/index.html',{waitUntil:'load'});await pg.evaluate(()=>window.__debugStartLevel(3));await new Promise(r=>setTimeout(r,1500));await pg.evaluate(()=>window.__debugHitColumn(0));await pg.evaluate(()=>window.__debugHitColumn(1));await new Promise(r=>setTimeout(r,600));await pg.screenshot({path:'C:/Users/master/AppData/Local/Temp/mole-lane-check.png'});console.log('console errors:',errs.length,errs);await b.close();})()"
```
Expected: `console errors: 0 []`. 스크린샷에 버튼 4개 + 망치가 보여야 한다 (검토자가 눈으로 확인).

- [ ] **Step 9: 커밋**

```bash
git add mole/js/pop-elements.js mole/js/game.js mole/index.html mole/style.css mole/scripts/verify-mole-smoke.js
git rm mole/js/hammer-fx.js
git commit -m "feat(mole): lane-button controls replace direct mole tap"
```

---

## Task 7: 기획서 갱신

**Files:**
- Modify: `mole/두더지게임-기획서.md` (§4 두더지 출현 끝, §5 전체, §8/§11/§12 보강)

**Interfaces:**
- Consumes: 없음 (문서)
- Produces: 없음

- [ ] **Step 1: §5 "두더지 터치 방식" 재작성**

`## 5.` 섹션 제목을 `## 5. 조작 — 레인 버튼 + 대각 망치 (v1.4, 사용자 확정)` 로 바꾸고, 그 아래 본문(터치 판정 설명 ~ "실제 판정은 두더지 터치 영역으로 처리한다." 까지, `### 아트 / 애니메이션` 앞까지)을 다음으로 교체:

```markdown
두더지를 직접 터치하지 않는다. 화면 하단의 **레인 버튼 4개**로 조작한다.
각 버튼은 4×4 격자의 한 **열**에 대응한다 (1번 버튼 = 1번 열).

버튼을 누르면:

→ 망치가 우측 하단 축에서 그 열로 대각선 스윙
  (이동 시간은 스윙 예비동작 안에 숨겨 체감 지연 ≈ 0)
→ 망치머리가 그 열 두더지의 **모자 정수리**에 착지
→ "쾅!" 타격 연출 (모자 정수리 기준: 히트스톱 · 화면 쉐이크 · 모자 튕김 ·
   별 · 흙먼지 · 진동 · 타격음)
→ 그 **열 전체** 판정 (아래 표)

| 열에 있던 대상 | 결과 |
|---|---|
| 두더지 (1히트) | 처치 — 영역 완성 + 콤보 + 점수 |
| 두더지 (다타, 미완) | 한 단계 내려감 (영역/콤보/점수 없음) |
| 두더지 (다타, 최종타) | 처치 |
| 다른 동물 (일반 얼굴) | 목숨 -1, 콤보 0 |
| 고글 낀 동물 | 시간 -3초, 콤보 0 |

- 한 번에 두더지 2마리를 잡으면 콤보가 2 오른다.
- **동물이 있는 열을 치면 손해.** 레인을 보고 눌러야 한다.
- 빈 열을 누르면 헛스윙만. 페널티도 잠금도 없다.
- 다타 두더지 연타 쿨다운(0.12초)은 열 강타에도 적용된다.

### 버튼 표시

- 그 열에 **두더지**가 떠 있으면 버튼이 은은하게 빛난다 (초보 가이드).
- **동물 / 고글 동물**은 버튼을 빛나게 하지 않는다 — 직접 격자를 보고 피해야 한다.

### 입력

- 모바일: 버튼 탭.
- PC: 버튼 클릭 + 키보드 `1` `2` `3` `4`.
```

- [ ] **Step 2: §4 마지막 문장 수정**

§4 의 `플레이어가 터치하면 성공 처리한다.` 를 `플레이어가 그 열의 레인 버튼을 누르면 성공 처리한다 (§5).` 로 바꾼다. `### 중첩 방지` 아래 "터치 판정 영역도 서로 겹치지 않도록" 문장은 `열 강타는 위치와 무관하므로 터치 판정 겹침 문제는 없다. 스폰 지점만 겹치지 않으면 된다.` 로 바꾼다.

- [ ] **Step 3: §8 / §11 / §12 보강**

- §8 `### 다른 동물` 의 `터치하면:` → `그 동물이 있는 열을 강타하면:`
- §8 `### 고글 낀 동물` 의 `터치하면:` → `그 동물이 있는 열을 강타하면:`
- §11 `다른 동물 터치:` → `동물이 있는 열 강타:`
- §12 `다른 동물 또는 폭탄을 터치하면 콤보를 0으로 초기화한다.` → `동물 또는 고글 동물이 있는 열을 강타하면 콤보를 0으로 초기화한다.`

- [ ] **Step 4: 문서 상단 버전 표기**

파일 첫 줄 `# 🦫 두더지 게임 기획서 v1.0` 아래 어딘가 v 이력이 있으면 `v1.4: 조작을 직접 터치 → 레인 버튼 4개 + 대각 망치 열 강타로 변경` 를 추가. 없으면 §5 제목의 `(v1.4, 사용자 확정)` 로 충분하니 생략.

- [ ] **Step 5: 커밋**

```bash
git add "mole/두더지게임-기획서.md"
git commit -m "docs(mole): update spec for lane-button controls (v1.4)"
```

---

## Task 8: 전체 검증

**Files:**
- (변경 없음 — 검증만)

**Interfaces:**
- Consumes: 전체
- Produces: 없음

- [ ] **Step 1: 단위 테스트 전체**

Run: `cd mole && node scripts/run-all-tests.js`
Expected: `✓ all mole game logic tests passed`

- [ ] **Step 2: 스모크**

```bash
# 리포지토리 루트, 서버 띄운 상태
node mole/scripts/verify-mole-smoke.js
```
Expected: `verify-mole-smoke.js: all assertions passed`

- [ ] **Step 3: 게임 내 육안 확인 (puppeteer 스크린샷 3장)**

리포지토리 루트, 서버 띄운 상태에서 레벨 3/6/9 를 각각 시작해 1.5초 후 스크린샷:

```bash
node -e "const p=require('puppeteer-core');(async()=>{const b=await p.launch({executablePath:'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',headless:true});for(const lv of [3,6,9]){const pg=await b.newPage();await pg.setViewport({width:390,height:844,deviceScaleFactor:2});await pg.goto('http://localhost:8845/mole/index.html',{waitUntil:'load'});await pg.evaluate(l=>window.__debugStartLevel(l),lv);await new Promise(r=>setTimeout(r,1400));await pg.evaluate(()=>window.__debugHitColumn(1));await new Promise(r=>setTimeout(r,250));await pg.screenshot({path:'C:/Users/master/AppData/Local/Temp/mole-lv'+lv+'.png'});await pg.close();}await b.close();console.log('shots done');})()"
```
검토자 확인 항목:
- 하단에 버튼 4개, 격자 열과 정렬
- 보드가 버튼 바 위에 온전히 들어감 (잘림 없음)
- 망치가 대각선으로 걸쳐 있음 (우측 하단 축)
- 열 강타 직후 별/"쾅!"/쉐이크 흔적
- HUD 위 그대로

- [ ] **Step 4: 메모리 갱신**

`C:\Users\master\.claude\projects\C--Users-master-Desktop\memory\fun-games-hub.md` 에 이번 조작 개편 한 단락 추가 (레인 버튼 + resolveColumn + lane-hammer/hit-fx/lane-controls 신규, hammer-fx.js 삭제, 기획서 v1.4). `MEMORY.md` 포인터는 그대로.

- [ ] **Step 5: 최종 커밋 (있으면)**

```bash
git add -A
git commit -m "chore(mole): finalize lane-button control rework"
```
(변경 없으면 생략)

---

## Self-Review

**1. Spec coverage:**

| 스펙 항목 | 구현 태스크 |
|---|---|
| §2.1 레인 버튼 4개 | Task 5 (모듈), Task 6 (index.html/css/배선) |
| §2.2 `resolveColumn` 판정표 | Task 2 |
| §2.2 콤보 마리당 +1 | Task 6 (d) `onHammerImpact` — `results.forEach` 로 done 두더지마다 `onMoleHit()` |
| §2.2 빈 열 헛스윙 | Task 6 (d) `if (results.length === 0) HitFx.whiff` |
| §2.2 다타 쿨다운 유지 | Task 2 `resolveOne` 이 `HIT_COOLDOWN` 그대로 |
| §2.3 버튼 hot = 두더지만 | Task 6 (e) 루프의 `moleCols` 계산 |
| §3 망치 대각 스윙 + wind/swing/recover + 재조준 + isBusy | Task 3 |
| §3 lunge + 축 슬라이드 조합 | Task 3 `paint()` 의 `lunge` + `curCol` 보간 (튜닝은 이후) |
| §4 juice 스택 | Task 4 (hit-fx), Task 6 CSS 키프레임 |
| §4 히트스톱 70~120ms | Task 6 (d) `hitstopUntil`, (e) 루프 `dt = 0` |
| §4 헛스윙/동물타격 변형 | Task 4 `whiff`/`obstacleHit` |
| §5 레이아웃 (버튼 바 + 보드 축소) | Task 6 Step 5 (a)(c) |
| §5 키보드 1234 | Task 5 `KEY_COL` |
| §6 코드 구조 (신규 3모듈, resolveColumn, pop-elements onHit 제거, game 재배선) | Task 3/4/5/2/6 |
| §7 데이터 흐름 (impact 콜백에서 적용) | Task 6 (d) |
| §8 확정 결정 (빈 열/2마리/글로우/키보드/사운드/히트스톱) | Task 4/6 |
| §9 단위 테스트 6종 | Task 1 (col/row), Task 2 (11~14 — 3번 "동물+두더지" = 스펙 2번, 6번 "열 귀속" = 11번 마지막 assert) |
| §9 스모크 (버튼 4개, 열 클릭→완성, 키보드, 직접터치 무효, 망치 요소) | Task 6 Step 6 |
| §9 전체 재검 + 스크린샷 | Task 8 |
| §10 범위 밖 (HUD/레벨선택/이모지/경계검정) | 건드리지 않음 — 확인 완료 |

**갭:** 스펙 §3 "한 열 두더지 2마리 → 빠른 2연타 chop" 은 Task 3 망치가 단일 스윙만 한다. → **의도적 축소**: v1 은 1스윙으로 둘 다 판정(로직은 맞음), chop 연출은 이후 튜닝. Task 3 코드 주석과 이 리뷰에 명시. 스펙 §8 에도 "뒤집을 수 있음" 으로 되어 있어 허용 범위.

**2. Placeholder scan:** `hit-fx-dust` 의 `--dx` 고정값은 Step 5 주석에 "이후 튜닝(범위 밖)" 으로 명시됨 — 동작은 함(한 방향으로 튐). 그 외 "TBD/TODO/적절히" 없음. 모든 코드 스텝에 실제 코드 있음.

**3. Type consistency:**
- `resolveColumn` 반환 요소: `{ type, regionId, done, xFrac, yFrac, hitsTaken?, hitsRequired? }` — Task 2 정의, Task 6 (d) 소비(`r.type`, `r.done`, `r.xFrac`, `r.yFrac`) 일치.
- `MG.LaneHammer.create(...).strike(col, targetYFrac, onImpact)` — Task 3 정의, Task 6 (d) 호출 `state.laneHammer.strike(col, targetY, () => onHammerImpact(...))` 일치.
- `laneHammer.update(dt)` / `isBusy()` / `clear()` — Task 3 정의, Task 6 (e) 루프 + backToSelect 소비 일치.
- `MG.LaneControls.create({ buttonBar, gridSize, onColumn })` → `{ setColumnHot, clear }` — Task 5 정의, Task 6 (a) 생성 + (c) `clear()` + (e) `setColumnHot(c, bool)` 일치.
- `MG.HitFx.moleHit/obstacleHit/whiff` 시그니처 — Task 4 정의, Task 6 (d) 호출 일치.
- `MG.PopElements.create({ container })` → `{ sync, clear, flash }` — Task 6 Step 1 정의. `flash` 는 (d) 에서 "안 쓴다" 고 주석 — 실제로 반환만 하고 미사용. **정리:** `flash` 를 굳이 노출할 필요 없으면 Step 1 에서 빼도 됨. 남겨도 무해(미래 대비). 실행자 판단.
- `window.__debugHitColumn(col)` — Task 6 (f) 정의, Task 8 Step 3 사용 일치.
- `flashHud(id)` — Task 6 (d) 에서 정의+사용, `.hud-flash` CSS Step 5 (c) 일치.

일치 문제 없음. `flash` 미사용만 실행자 재량으로 정리.

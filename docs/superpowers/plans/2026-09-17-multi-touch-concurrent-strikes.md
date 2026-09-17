# 두더지팡 동시 멀티터치 다중 타격 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다이얼패드 버튼 2~5개를 동시에 눌렀을 때 (1) 멀티터치 자체가 안 씹히게 하고,
(2) 누른 개수만큼 무기 이미지가 동시에 등장해 각자 타격하며, 콤보/점수가 각각 반영되게 한다.
뿅망치/골드해머/캐논/알리펀치 4종 전부 대상.

**Architecture:** `mole/index.html` 뷰포트 메타와 `.dialpad` 터치 설정을 고쳐 멀티터치 입력
자체가 브라우저에 씹히지 않게 한 뒤, 무기 애니메이션 모듈(`lane-hammer.js`/`lane-cannon.js`/
`lane-boxing.js`) 위에 인스턴스 풀 래퍼(`weapon-pool.js`)를 얹는다. 풀은 세 모듈의 공통 인터페이스
(`strike/update/isBusy/home/clear`)를 그대로 노출하므로 `game.js`는 인스턴스 생성 한 줄만 바꾼다.

**Tech Stack:** 순수 JS(IIFE + `window.MoleGame` 네임스페이스), Node `assert` 기반 단위 테스트
(`scripts/run-all-tests.js`), 정적 파일 배포(GitHub Pages).

**Spec:** `docs/superpowers/specs/2026-09-17-multi-touch-concurrent-strikes-design.md`

## Global Constraints

- 무기 모듈 3개(`lane-hammer.js`/`lane-cannon.js`/`lane-boxing.js`) 내부 로직은 수정하지 않는다 —
  풀은 이 모듈들이 이미 노출하는 인터페이스만 사용한다.
- `game.js`의 기존 `state.laneHammer.*` 호출부(~15곳)는 인스턴스 생성 줄 1개를 제외하고
  전혀 수정하지 않는다.
- 최대 동시 인스턴스 수 기본값 5, 여분 인스턴스 정리(pruning) 기본 지연 1500ms — 둘 다 풀
  생성 시 옵션으로 오버라이드 가능해야 한다(테스트에서 결정론적으로 검증하기 위함).
- 이 프로젝트의 버전은 3곳에서 동기화한다: `index.html`의 `#build-tag`, `sw.js`의
  `CACHE` 상수, `index.html`의 `register('sw.js?v=N')` — 배포 전 반드시 셋 다 같은 번호로 맞춘다.
  현재 최신은 v503, 이번 작업은 **v504**.

---

## Task 1: 멀티터치 입력이 씹히지 않게 뷰포트/터치 설정 수정

**Files:**
- Modify: `mole/index.html:5` (뷰포트 메타)
- Modify: `mole/style.css:1420` (`.dialpad`)

**Interfaces:** 없음(순수 설정 변경, 이후 태스크와 의존관계 없음).

- [ ] **Step 1: 뷰포트 메타에 핀치줌 비활성화 추가**

`mole/index.html` 5번째 줄, 현재:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
다음으로 교체:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

- [ ] **Step 2: `.dialpad` 컨테이너에 touch-action 명시**

`mole/style.css`에서 `.dialpad { position: relative; flex: 0 0 auto; }` (약 1420번째 줄)를
다음으로 교체:
```css
.dialpad { position: relative; flex: 0 0 auto; touch-action: manipulation; }
```

- [ ] **Step 3: 확인**

Run: `grep -n "maximum-scale" mole/index.html && grep -n "touch-action: manipulation" mole/style.css`
Expected: 두 줄 다 출력됨 (뷰포트 메타 1건 + `.lane-button`·`.dialpad` 합쳐 2건 이상).

이 태스크는 정적 설정 변경이라 자동 테스트가 없다 — 실기기 검증은 Task 4에서 배포 후 함께 확인한다.

- [ ] **Step 4: Commit**

```bash
cd mole
git add index.html style.css
git commit -m "두더지팡: 다이얼패드 멀티터치 씹힘 방지 (뷰포트 핀치줌 비활성화 + touch-action)"
```

---

## Task 2: 무기 인스턴스 풀 모듈 (`weapon-pool.js`) + 단위 테스트

**Files:**
- Create: `mole/js/weapon-pool.js`
- Create: `mole/scripts/test-weapon-pool.js`
- Modify: `mole/scripts/run-all-tests.js` (테스트 목록에 추가)

**Interfaces:**
- Produces: `window.MoleGame.WeaponPool.create(WeaponMod, opts, poolOpts)` →
  `{ strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId), update(dt), isBusy(), home(), clear(), meet(...args), demo(...args), spinIn(...args), popIn(...args) }`.
  `WeaponMod`는 `{ create(opts) → { strike, update, isBusy, home, clear, [meet], [demo], [spinIn], [popIn] } }` 형태
  (기존 `lane-hammer.js`/`lane-cannon.js`/`lane-boxing.js`의 `api.create`와 동일 규약).
  `poolOpts` = `{ maxConcurrent = 5, pruneAfterMs = 1500, now = Date.now }` (전부 선택적).
- Consumes: 없음(순수 모듈, DOM/게임 상태 모름 — 무기 모듈이 반환하는 객체만 다룬다).

- [ ] **Step 1: 실패하는 단위 테스트 작성**

`mole/scripts/test-weapon-pool.js` 새로 작성:

```js
const assert = require('assert');
const WeaponPool = require('../js/weapon-pool.js');

// 게임 상태·DOM 없이 WeaponPool 만 검증하는 목(mock) 무기 모듈.
function makeMockWeaponMod() {
  const instances = [];
  function create() {
    const inst = {
      busy: false,
      cleared: false,
      strikes: 0,
      updates: 0,
      lastTarget: null,
      strike(tx, ty, onImpact, frameKey, regionId) {
        inst.busy = true;
        inst.strikes++;
        inst.lastTarget = { tx, ty, regionId };
      },
      update() { inst.updates++; },
      isBusy() { return inst.busy; },
      home() { inst.busy = false; },
      clear() { inst.cleared = true; }
    };
    instances.push(inst);
    return inst;
  }
  return { create, instances };
}

// 1) 여유 인스턴스가 없으면 strike() 마다 새 인스턴스를 만든다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0.2, 0.3, () => {}, null, 1);          // 기존 instances[0] 사용
  assert.strictEqual(mock.instances.length, 1);
  pool.strike(0.6, 0.7, () => {}, null, 2);          // instances[0] 이 busy → 새로 생성
  assert.strictEqual(mock.instances.length, 2);
  assert.strictEqual(mock.instances[1].lastTarget.regionId, 2);
}

// 2) update(dt) 가 모든 인스턴스에 전파된다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.update(16);
  assert.strictEqual(mock.instances[0].updates, 1);
  assert.strictEqual(mock.instances[1].updates, 1);
}

// 3) 안 바쁜 여분 인스턴스는 pruneAfterMs 가 지나야 정리된다(그 전엔 유지).
{
  const mock = makeMockWeaponMod();
  let clock = 0;
  const pool = WeaponPool.create(mock, {}, { pruneAfterMs: 100, now: () => clock });
  pool.strike(0, 0, () => {});           // instances[0], lastStrikeAt=0
  clock = 10;
  pool.strike(0.5, 0.5, () => {});       // instances[1] 생성, lastStrikeAt=10
  mock.instances[1].busy = false;        // 스윙 끝나고 대기 위치 복귀했다고 가정
  clock = 50;                            // 경과 40ms < 100ms
  pool.update(16);
  assert.strictEqual(mock.instances[1].cleared, false, '아직 정리되면 안 됨');
  clock = 200;                           // 경과 190ms > 100ms
  pool.update(16);
  assert.strictEqual(mock.instances[1].cleared, true, '정리돼야 함');
}

// 4) maxConcurrent 를 넘으면 새 인스턴스 대신 가장 오래된 걸 리다이렉트한다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { maxConcurrent: 2, now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.strike(0.9, 0.9, () => {});       // 캡(2) 초과 → 새로 안 만들고 instances[0] 재사용
  assert.strictEqual(mock.instances.length, 2);
  assert.strictEqual(mock.instances[0].strikes, 2);
}

// 5) home()/clear() 후 인스턴스가 1개/0개로 수렴한다.
{
  const mock = makeMockWeaponMod();
  const pool = WeaponPool.create(mock, {}, { now: () => 0 });
  pool.strike(0, 0, () => {});
  pool.strike(0.5, 0.5, () => {});
  pool.home();
  assert.strictEqual(mock.instances[1].cleared, true, '여분 인스턴스는 home() 에서 정리');
  assert.strictEqual(mock.instances[0].cleared, false, '기본 인스턴스는 유지');
  pool.clear();
  assert.strictEqual(mock.instances[0].cleared, true, 'clear() 는 기본 인스턴스도 정리');
}

console.log('test-weapon-pool.js: all assertions passed');
```

- [ ] **Step 2: 테스트가 실패하는지 확인 (모듈이 아직 없음)**

Run: `node mole/scripts/test-weapon-pool.js`
Expected: `Error: Cannot find module '../js/weapon-pool.js'`

- [ ] **Step 3: `weapon-pool.js` 구현**

`mole/js/weapon-pool.js` 새로 작성:

```js
(function (root) {
  'use strict';

  // 무기(뿅망치/골드해머/캐논/알리펀치) 애니메이션 모듈은 전부 같은 인터페이스를 쓴다
  // (create(opts) → { strike, update, isBusy, home, clear, [meet], [demo], [spinIn], [popIn] }).
  // 동시에 여러 구멍이 눌리면(멀티터치) 그 모듈을 여러 개 생성해 각자 독립적으로 스윙시킨다.
  // 무기 모듈 내부(스윙 좌표·타이밍)는 건드리지 않고, 이 파일이 인스턴스 배열만 관리한다.

  const DEFAULT_MAX_CONCURRENT = 5;
  const DEFAULT_PRUNE_AFTER_MS = 1500;

  function create(WeaponMod, opts, poolOpts) {
    const maxConcurrent = (poolOpts && poolOpts.maxConcurrent) || DEFAULT_MAX_CONCURRENT;
    const pruneAfterMs = (poolOpts && poolOpts.pruneAfterMs != null) ? poolOpts.pruneAfterMs : DEFAULT_PRUNE_AFTER_MS;
    const now = (poolOpts && poolOpts.now) || Date.now;

    function makeEntry() {
      return { inst: WeaponMod.create(opts), lastStrikeAt: now() };
    }

    const entries = [makeEntry()]; // entries[0] = 기본 인스턴스, 절대 제거 안 함

    function findFree() {
      for (let i = 0; i < entries.length; i++) {
        if (!entries[i].inst.isBusy()) return entries[i];
      }
      return null;
    }

    function strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId) {
      let entry = findFree();
      if (!entry) {
        if (entries.length < maxConcurrent) {
          entry = makeEntry();
          entries.push(entry);
        } else {
          entry = entries[0]; // 캡 초과 — 가장 오래된 인스턴스를 새 목표로 리다이렉트(기존 단일 인스턴스 동작과 동일)
        }
      }
      entry.lastStrikeAt = now();
      entry.inst.strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId);
    }

    function update(dt) {
      entries.forEach((e) => e.inst.update(dt));
      const t = now();
      for (let i = entries.length - 1; i >= 1; i--) {
        const e = entries[i];
        if (!e.inst.isBusy() && (t - e.lastStrikeAt) > pruneAfterMs) {
          e.inst.clear();
          entries.splice(i, 1);
        }
      }
    }

    function isBusy() { return entries.some((e) => e.inst.isBusy()); }

    function home() {
      entries.forEach((e) => e.inst.home());
      for (let i = entries.length - 1; i >= 1; i--) {
        entries[i].inst.clear();
        entries.splice(i, 1);
      }
    }

    function clear() {
      entries.forEach((e) => e.inst.clear());
      entries.length = 0;
    }

    function delegateToPrimary(name) {
      return function () {
        const primary = entries[0] && entries[0].inst;
        if (primary && typeof primary[name] === 'function') return primary[name].apply(primary, arguments);
      };
    }

    return {
      strike, update, isBusy, home, clear,
      meet: delegateToPrimary('meet'),
      demo: delegateToPrimary('demo'),
      spinIn: delegateToPrimary('spinIn'),
      popIn: delegateToPrimary('popIn')
    };
  }

  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.WeaponPool = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node mole/scripts/test-weapon-pool.js`
Expected: `test-weapon-pool.js: all assertions passed` 출력, 종료 코드 0.

- [ ] **Step 5: 전체 테스트 목록에 추가**

`mole/scripts/run-all-tests.js`의 `tests` 배열에 `'test-weapon-pool.js'`를 추가
(다른 항목과 같은 형식, 순서는 아무 데나 무방 — 예: `'test-grid-partition.js'` 다음 줄):

```js
const tests = [
  'test-levels.js',
  'test-progress.js',
  'test-rng.js',
  'test-combo-score.js',
  'test-grid-partition.js',
  'test-weapon-pool.js',
  'test-spawn-scheduler.js',
  'test-mole-sprites.js',
  'test-economy.js',
  'test-face-store.js'
];
```

- [ ] **Step 6: 전체 테스트 스위트 실행**

Run: `node mole/scripts/run-all-tests.js`
Expected: 모든 테스트 통과(마지막 줄에 실패 메시지 없음, 종료 코드 0).

- [ ] **Step 7: Commit**

```bash
cd mole
git add js/weapon-pool.js scripts/test-weapon-pool.js scripts/run-all-tests.js
git commit -m "두더지팡: 무기 인스턴스 풀(weapon-pool.js) 추가 — 동시 멀티타격 지원"
```

---

## Task 3: `game.js`에 풀 연결 + 스크립트 로드 + 버전 업

**Files:**
- Modify: `mole/index.html:522-523` (스크립트 태그 추가), `#build-tag`, `register('sw.js?v=...')`
- Modify: `mole/js/game.js:1342` (인스턴스 생성 교체)
- Modify: `mole/sw.js:6` (`CACHE` 버전)

**Interfaces:**
- Consumes: `window.MoleGame.WeaponPool.create(WeaponMod, opts)` (Task 2의 산출물, 3번째 `poolOpts`
  인자는 생략 — 기본값 사용).
- Produces: 없음(최종 연결 지점).

- [ ] **Step 1: `index.html`에 스크립트 태그 추가**

`mole/index.html`의 `<script src="js/lane-boxing.js"></script>` 다음 줄(522번째 근처)에 추가:

```html
<script src="js/weapon-pool.js"></script>
```

(`lane-controls.js` 로드보다 먼저, `game.js`보다는 당연히 먼저 — 기존 다른 `js/lane-*.js`와 같은 구간에 배치)

- [ ] **Step 2: `game.js`에서 인스턴스 생성을 풀 생성으로 교체**

`mole/js/game.js` 1342번째 줄, 현재:
```js
    const laneHammer = WeaponMod.create(hammerOpts);
```
다음으로 교체:
```js
    const laneHammer = MG.WeaponPool.create(WeaponMod, hammerOpts);
```

(`MG`는 이 파일 상단에서 이미 `const MG = window.MoleGame;` 형태로 정의돼 있음 — 다른 `MG.LaneCannon`/`MG.LaneBoxing` 참조와 같은 방식이니 새 alias 불필요. 파일 상단에 `MG` 정의가 없다면 `grep -n "^\s*const MG" mole/js/game.js`로 실제 변수명을 확인하고 그 이름으로 맞춘다.)

- [ ] **Step 3: 버전 3곳을 v504로 동기화**

`mole/sw.js` 6번째 줄:
```js
const CACHE = 'mole-game-v504';
```

`mole/index.html`의 `#build-tag`:
```html
<div id="build-tag" aria-hidden="true">v504</div>
```

`mole/index.html`의 서비스워커 등록:
```js
navigator.serviceWorker.register('sw.js?v=504').catch(function () {});
```

- [ ] **Step 4: 회귀 확인 — 전체 단위 테스트 재실행**

Run: `node mole/scripts/run-all-tests.js`
Expected: 여전히 전부 통과(이번 태스크는 `game.js`/`index.html`/`sw.js`만 바꿨으므로 Task 2 테스트
결과에 영향 없어야 함).

- [ ] **Step 5: 정적 검증 — 스크립트 순서·치환 위치 확인**

Run:
```bash
grep -n "weapon-pool.js" mole/index.html
grep -n "MG.WeaponPool.create" mole/js/game.js
grep -n "v504" mole/sw.js mole/index.html
```
Expected: 각각 최소 1줄 이상 출력. `MG.WeaponPool.create`가 `game.js`에 정확히 한 번 나타남.

- [ ] **Step 6: Commit**

```bash
cd mole
git add index.html js/game.js sw.js
git commit -m "두더지팡 v504: 무기 인스턴스 풀 연결 (동시 멀티터치 다중 타격)"
```

---

## Task 4: 실기기 검증 + 배포

**Files:** 없음(코드 변경 없음 — 검증 및 배포만).

**Interfaces:** 없음.

- [ ] **Step 1: origin과 동기화 확인 후 push**

```bash
cd /c/Users/master/Desktop/fun-games-hub
git fetch origin master
git log origin/master -1 --oneline
git push origin master
git fetch origin master && git log origin/master -1 --oneline
```
Expected: 마지막 `git log origin/master -1`이 Task 3의 커밋(v504)과 같은 해시를 가리킴 —
push가 실제로 반영됐는지 확인.

- [ ] **Step 2: GitHub Pages 반영 대기 후 실기기 체크리스트 안내**

GitHub Pages는 보통 1~2분 내 반영된다. 사용자에게 아래 체크리스트로 실기기 확인을 요청.

(스펙 §5는 puppeteer 합성 멀티터치 스모크 테스트도 언급하지만, 합성 멀티터치 이벤트는
플랫폼마다 재현이 불안정하고 이 기능은 애초에 "손가락 감촉/타이밍"이 핵심이라 실기기 확인이
더 신뢰도 높은 검증이라 판단해 이 계획에서는 제외했다 — Task 2의 단위 테스트 + 아래 실기기
체크리스트로 대체한다.)

- [ ] 다이얼패드에서 2개 손가락 동시 탭 → 무기 이미지 2개가 각자 다른 구멍에 동시에 스윙하는지
- [ ] 3개, 4개 동시 탭도 마찬가지로 각자 이미지가 뜨는지
- [ ] 동시타격마다 콤보 카운트/점수가 개별적으로 올라가는지 (2개 동시 명중 시 콤보 +2)
- [ ] 뿅망치/골드해머/캐논/알리펀치 4개 무기 전부 확인
- [ ] 동시타격 후 잠깐 뒤 화면에 무기 이미지가 여러 개 안 남고 하나(대기 위치)로 정리되는지

문제가 있으면 여기서 다음 세션/태스크로 넘긴다 — 이 계획의 범위는 여기까지.

---

## 범위 밖 (스펙에도 명시됨, 재확인)

- "리듬팡" 신규 게임 자체.
- 동시 타격 시 대기위치 분산 배치(부채꼴 출발 연출 개선).
- 동시 타격 전용 콤보 보너스 연출.

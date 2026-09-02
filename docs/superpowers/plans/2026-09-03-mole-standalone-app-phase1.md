# 두더지 게임 독립 앱 Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두더지 게임을 fun-games-hub에서 떼어내, 카톡 "더보기" 스타일 다크 홈화면 + 사람두더지 메이커(사진→얼굴→두더지 합성) + 하수/고수/전설 난이도 + 하트·코인·광고 스텁 메타를 갖춘 독립 앱(Phase 1: 웹)으로 만든다.

**Architecture:** 순수 로직 모듈(economy, face-store)은 Node `assert`로 TDD, DOM 모듈은 puppeteer 스모크로 검증. 사람 얼굴은 잘린 원형 PNG 1장으로 IndexedDB에 저장하고 게임 중 `.mole-pop` 클립박스 안에 `<img>` 레이어로 두더지 머리 앵커 위치에 실시간 합성(캔버스 아님). 캐릭터/카톡 대화 인트로는 제거하고 그 자리에 홈화면·화면 패널 스택을 넣는다. 모든 화면은 `#mole-board`(폰 화면) 안에서 뜬다.

**Tech Stack:** 바닐라 JS(번들러 없음, `<script>` 태그, `window.MoleGame`/`window.FGH` 네임스페이스), 순수 로직 모듈은 Node+브라우저 이중 export. IndexedDB(+ `fake-indexeddb` devDep for tests), localStorage, `<input type="file">`, Canvas(크롭 결과 추출 전용). 테스트: `node assert` + `puppeteer-core` + Edge headless.

**Spec:** `docs/superpowers/specs/2026-09-03-mole-standalone-app-design.md`

## Global Constraints

- **레포:** `C:\Users\master\Desktop\fun-games-hub` — `git branch --show-current` = `master`, GitHub Pages(Deploy from branch → master → /root). 커밋만, 푸시는 사용자가 요청할 때만. 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01G4r7JhYRZRkXEYJXQp8Pk4`.
- **바닐라 JS만.** 번들러·프레임워크·npm 런타임 의존성 추가 금지. 새 devDep은 `fake-indexeddb` 하나만 허용(Task 2).
- **순수 로직 모듈** (`economy.js`, `face-store.js`)은 파일 끝에서 `if (typeof module !== 'undefined' && module.exports) module.exports = api;` + `if (root) { root.MoleGame = ... }` 이중 export (기존 `levels.js`/`combo-score.js` 패턴 그대로).
- **DOM 모듈**은 `(function (root) { ... })(typeof window !== 'undefined' ? window : null)` IIFE, `root.MoleGame.<Name> = { create }` 로 노출 (기존 `pop-elements.js`/`hole-layer.js` 패턴).
- **사진 원본은 저장·전송 절대 금지.** `<input>`으로 받은 원본 이미지는 메모리에서만 쓰고, 저장물은 잘린 얼굴 원형 PNG(256×256, 원 밖 투명) 1장뿐. IndexedDB(기기 로컬)에만.
- **사용자 문구**는 `mole/js/i18n-strings.js`의 `ko`/`en` 블록에 키 추가 + `data-i18n` 속성으로 연결 (기존 패턴). 새 화면도 동일. 의성어·다이얼러 위장 버튼 라벨 번역 규칙은 기존 그대로.
- **게임 박스(`.mole-board` / `--sq`) 크기 건드리지 말 것** (사용자 명시).
- **일시정지 아이콘 = 현재 상태 표시** (플레이 중 ▶ / 일시정지 ⏸) — 관례와 반대, 그대로 유지.
- **이모지 금지 리스크:** 인라인 SVG 우선. 이모지는 아주 옛날 것만(🦫 tofu 전례). 새 아이콘은 전부 인라인 SVG.
- **로컬 미리보기:** `mole/index.html`은 localhost/192.168.* 에서 서비스워커를 등록하지 않고 해제한다 — 이 로직 유지. 스모크는 배포 URL이 아닌 `node scripts/serve.js`(레포 루트) 로컬 서버 대상.
- **서버 정리:** puppeteer 테스트용 `node scripts/serve.js` 프로세스는 끝나면 반드시 kill (포트 8843–8848). 사용자의 `미리보기.bat` 서버(8844/8845)를 죽이지 말 것 — 스모크는 별도 포트(`SMOKE_PORT`, 기본 8845 충돌 시 8846)로.
- **스프라이트/타격/사운드/타이밍 로직**(`hit-fx.js`, `lane-hammer.js`, `combo-score.js`, `MG.LEVELS`, `ROUND_SECONDS=30`, `FINAL_ROUND=10`, `START_LIVES=3`): 이 계획에서 **변경 없음**.
- **디버그 훅**은 영구 보존(지렁이 컨벤션). 기존 훅 유지 + 이 계획에서 추가하는 훅.
- **레포 물리적 분리**(snake/coloring 삭제, 루트 승격)는 **마지막 Task**이며, 실행 전 사용자 확인 필요.

---

## 파일 구조

### 새 파일

| 파일 | 책임 |
|---|---|
| `mole/js/economy.js` | 하트(시간 충전 계산) + 코인. 순수 함수 `regen()` + localStorage 접근자. |
| `mole/js/face-store.js` | IndexedDB 얼굴 CRUD + 활성 얼굴 id(localStorage). |
| `mole/js/face-maker.js` | 사진 선택 `<input>` + 원형 크롭 UI + 미리보기 + 저장. `#face-maker` 패널. |
| `mole/js/face-locker.js` | 보관함 목록 화면. `#face-locker` 패널. |
| `mole/js/home-screen.js` | 카톡 더보기 스타일 다크 홈. `#home-screen` 패널. 탭 → 콜백. |
| `mole/js/ads.js` | 광고 스텁 3종 (`banner`/`interstitial`/`rewarded`). Phase 2에서 본문만 교체. |
| `mole/js/shop.js` | 상점 화면 (하트/코인 교환, 스킨 1개). `#shop` 패널. |
| `mole/js/daily.js` | 7일 출석 화면. `#daily` 패널. |
| `mole/js/screen-nav.js` | 패널 스택 show/hide 유틸 (`showScreen(id)`, 뒤로가기). |
| `mole/scripts/measure-head-anchor.py` | 최종 두더지 스프라이트에서 빨간 헬멧 blob → 얼굴 원 앵커 산출, JS 객체 출력. |
| `mole/scripts/test-economy.js` | `economy.js` 단위 테스트. |
| `mole/scripts/test-face-store.js` | `face-store.js` 단위 테스트 (`fake-indexeddb`). |

### 수정 파일

| 파일 | 변경 |
|---|---|
| `mole/js/game.js` | 카톡 대화 코드·상수·헬퍼 삭제. `showHome()` / `startGame(difficulty)` 진입점. 온보딩 분기. 난이도 클래스·obstacles 토글. 결과 화면 코인 지급 + `mole.best.<diff>` + 마이그레이션. `#btn-back-to-hub` → `showHome()`. `#start-best` 리타깃. 홈/화면 모듈 인스턴스 생성·배선. 새 디버그 훅. |
| `mole/js/spawn-scheduler.js` | `create({ config })` 의 `config.obstacles === false` 면 `animal`/`bomb` 스폰 스킵. |
| `mole/js/pop-elements.js` | 활성 얼굴 URL 있으면 `.mole-pop` 안에 `<img class="mole-face">` 레이어 — 포즈별 `HEAD_ANCHOR` 위치, depth/pose 따라 갱신. 동물엔 안 붙임. |
| `mole/js/mole-sprites.js` | `HEAD_ANCHOR` 상수(측정값 baked) + `headAnchor(spriteFile)` 헬퍼 + api export. |
| `mole/js/i18n-strings.js` | 새 화면 문구 ko/en 키 추가. |
| `mole/index.html` | `#board-start`(카톡) 삭제 → `#home-screen` + `#face-maker`/`#face-locker`/`#shop`/`#daily`/`#score`/`#help`/`#privacy` 패널. `#start-best` 유지. 새 `<script>` 로드. `<title>`/메타 정리. |
| `mole/style.css` | `.chat-*` 삭제. `.home-*`/상단바/pill/그리드, `.face-maker`/`.face-locker`/`.shop`/`.daily`, `.mole-face`, `#game-screen.diff-mid .lane-button--hot`/`.diff-legend` 무력화. |
| `mole/sw.js` | SHELL: `avatar-mole.png`/`avatar-hippo.png` 제거, 새 js 추가. `CACHE` 버전업. |
| `mole/manifest.json` | 이름/설명/아이콘/`theme_color` 독립 앱용. |
| `mole/scripts/verify-mole-smoke.js` | 홈화면·하트 소모·메이커·난이도·얼굴 레이어·마이그레이션·온보딩 검사로 확장. |
| `package.json` | `fake-indexeddb` devDependencies 추가. |

### 삭제 파일

- `mole/assets/avatar-mole.png`
- `mole/assets/avatar-hippo.png`

---

## 태스크 개요 (클러스터)

- **A. 기반 로직** — Task 1(economy), Task 2(face-store), Task 3(ads), Task 4(obstacles 토글), Task 5(HEAD_ANCHOR)
- **B. 사람두더지 메이커** — Task 6(카톡 코드 제거 + screen-nav + 홈 스텁), Task 7(face-maker), Task 8(face-locker), Task 9(pop-elements 얼굴 레이어)
- **C. 홈 + 메타 + 통합** — Task 10(home-screen), Task 11(game.js 오케스트레이션 + 난이도), Task 12(shop), Task 13(daily), Task 14(정적 화면: 스코어/설명서/개인정보/설정)
- **D. 마감** — Task 15(sw/manifest/i18n 정리 + 스모크 전면 개편), Task 16(전체 재검), Task 17(레포 분리 — 사용자 확인 후)

각 클러스터 경계에서 멈춰 검토 가능. B 클러스터까지 하면 "사진으로 두더지 만들어서 게임" 이 동작한다.

---

### Task 1: economy.js — 하트 충전 계산 + 코인

**Files:**
- Create: `mole/js/economy.js`
- Create: `mole/scripts/test-economy.js`
- Modify: `mole/scripts/run-all-tests.js` (새 테스트 등록)

**Interfaces:**
- Consumes: 없음 (순수)
- Produces:
  - `MG.Economy.regen(stored, at, now, opts?)` → `{ hearts, at }` — 순수. `opts.max`(기본 5), `opts.regenMs`(기본 1200000).
  - `MG.Economy.HEART_MAX` = 5, `MG.Economy.REGEN_MS` = 20*60*1000
  - `MG.Economy.getHearts()` → number (localStorage 읽어 regen 적용 후 저장, 현재값 반환)
  - `MG.Economy.canPlay()` → boolean (`getHearts() > 0`)
  - `MG.Economy.spendHeart()` → boolean (성공 시 true, 0이면 false)
  - `MG.Economy.addHearts(n)` → number (새 하트값, 상한 클램프)
  - `MG.Economy.nextHeartMs()` → number (다음 1개까지 남은 ms, 만땅이면 0)
  - `MG.Economy.getCoins()` / `addCoins(n)` / `spendCoins(n)` → number / number / boolean
  - localStorage 키: `mole.hearts`, `mole.heartsAt`, `mole.coins`

- [ ] **Step 1: 실패하는 테스트 작성** — `mole/scripts/test-economy.js`

```js
'use strict';
const assert = require('assert');
const { Economy } = require('../js/economy.js');

const MIN = 60 * 1000;

// regen: 경과 시간만큼 충전, 상한 클램프
(function testRegenBasic() {
  const r = Economy.regen(2, 0, 41 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 4, '2 + floor(41/20) = 4');
  assert.strictEqual(r.at, 40 * MIN, 'at 은 소비된 충전분만큼만 전진 (2*20)');
})();

(function testRegenClamp() {
  const r = Economy.regen(4, 0, 999 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 5, '상한 5');
  assert.strictEqual(r.at, 999 * MIN, '만땅이면 at = now');
})();

(function testRegenNoTime() {
  const r = Economy.regen(3, 1000, 1000 + 5 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 3, '20분 안 지남 → 그대로');
  assert.strictEqual(r.at, 1000, 'at 유지');
})();

(function testRegenAlreadyFull() {
  const r = Economy.regen(5, 0, 100 * MIN, { max: 5, regenMs: 20 * MIN });
  assert.strictEqual(r.hearts, 5);
  assert.strictEqual(r.at, 100 * MIN, '만땅에서 시간 지나도 at=now (충전 타이머 리셋)');
})();

console.log('test-economy: OK');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node mole/scripts/test-economy.js`
Expected: FAIL — `Cannot find module '../js/economy.js'`

- [ ] **Step 3: economy.js 구현**

```js
(function (root) {
  'use strict';
  var HEART_MAX = 5;
  var REGEN_MS = 20 * 60 * 1000;
  var K = { hearts: 'mole.hearts', heartsAt: 'mole.heartsAt', coins: 'mole.coins' };

  // 순수: 저장된 하트/타임스탬프 + 현재시각 → 충전 반영한 새 상태.
  function regen(stored, at, now, opts) {
    var max = (opts && opts.max) || HEART_MAX;
    var step = (opts && opts.regenMs) || REGEN_MS;
    stored = Math.max(0, Math.min(max, stored | 0));
    at = at | 0;
    if (stored >= max) return { hearts: max, at: now };
    var elapsed = Math.max(0, now - at);
    var gained = Math.floor(elapsed / step);
    if (gained <= 0) return { hearts: stored, at: at };
    var hearts = Math.min(max, stored + gained);
    var newAt = hearts >= max ? now : at + gained * step;
    return { hearts: hearts, at: newAt };
  }

  function ls() { return (typeof localStorage !== 'undefined') ? localStorage : null; }
  function readInt(key, dflt) {
    var s = ls() && ls().getItem(key);
    var v = parseInt(s, 10);
    return Number.isFinite(v) ? v : dflt;
  }

  function _syncHearts() {
    var now = Date.now();
    var stored = readInt(K.hearts, HEART_MAX);
    var at = readInt(K.heartsAt, now);
    var r = regen(stored, at, now);
    if (ls()) { ls().setItem(K.hearts, String(r.hearts)); ls().setItem(K.heartsAt, String(r.at)); }
    return r;
  }
  function getHearts() { return _syncHearts().hearts; }
  function canPlay() { return getHearts() > 0; }
  function spendHeart() {
    var r = _syncHearts();
    if (r.hearts <= 0) return false;
    var now = Date.now();
    // 만땅에서 처음 소비하면 그때부터 충전 타이머 시작.
    var at = r.hearts >= HEART_MAX ? now : readInt(K.heartsAt, now);
    if (ls()) { ls().setItem(K.hearts, String(r.hearts - 1)); ls().setItem(K.heartsAt, String(at)); }
    return true;
  }
  function addHearts(n) {
    var r = _syncHearts();
    var hearts = Math.min(HEART_MAX, r.hearts + (n | 0));
    if (ls()) ls().setItem(K.hearts, String(hearts));
    return hearts;
  }
  function nextHeartMs() {
    var now = Date.now();
    var stored = readInt(K.hearts, HEART_MAX);
    if (stored >= HEART_MAX) return 0;
    var at = readInt(K.heartsAt, now);
    var into = (now - at) % REGEN_MS;
    return Math.max(0, REGEN_MS - into);
  }

  function getCoins() { return Math.max(0, readInt(K.coins, 0)); }
  function addCoins(n) {
    var v = getCoins() + Math.max(0, n | 0);
    if (ls()) ls().setItem(K.coins, String(v));
    return v;
  }
  function spendCoins(n) {
    n = Math.max(0, n | 0);
    var v = getCoins();
    if (v < n) return false;
    if (ls()) ls().setItem(K.coins, String(v - n));
    return true;
  }

  var api = {
    HEART_MAX: HEART_MAX, REGEN_MS: REGEN_MS,
    regen: regen, getHearts: getHearts, canPlay: canPlay, spendHeart: spendHeart,
    addHearts: addHearts, nextHeartMs: nextHeartMs,
    getCoins: getCoins, addCoins: addCoins, spendCoins: spendCoins
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Economy = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node mole/scripts/test-economy.js`
Expected: `test-economy: OK`

- [ ] **Step 5: run-all-tests.js 에 등록**

`mole/scripts/run-all-tests.js` 를 열어 기존 `require('./test-*.js')` 목록에 같은 형식으로 `require('./test-economy.js');` 한 줄 추가 (기존 파일의 배열/목록 스타일 그대로 따를 것).

Run: `node mole/scripts/run-all-tests.js`
Expected: 전부 통과, economy 포함.

- [ ] **Step 6: 커밋**

```bash
git add mole/js/economy.js mole/scripts/test-economy.js mole/scripts/run-all-tests.js
git commit -m "feat(mole): 하트 충전·코인 economy 모듈"
```

---

### Task 2: face-store.js — IndexedDB 얼굴 저장소

**Files:**
- Create: `mole/js/face-store.js`
- Create: `mole/scripts/test-face-store.js`
- Modify: `package.json` (`fake-indexeddb` devDep)
- Modify: `mole/scripts/run-all-tests.js`

**Interfaces:**
- Consumes: 없음
- Produces (모두 Promise 반환, `getActiveId`/`setActive` 제외):
  - `MG.FaceStore.saveFace(blob, name)` → `Promise<string id>` — 21번째면 `reject(new Error('full'))`
  - `MG.FaceStore.listFaces()` → `Promise<Array<{id,name,blob,createdAt}>>` (createdAt 내림차순)
  - `MG.FaceStore.getFace(id)` → `Promise<{id,name,blob,createdAt}|null>`
  - `MG.FaceStore.deleteFace(id)` → `Promise<void>` (활성이었으면 활성 해제)
  - `MG.FaceStore.renameFace(id, name)` → `Promise<void>`
  - `MG.FaceStore.count()` → `Promise<number>`
  - `MG.FaceStore.getActiveId()` → `string|null` (localStorage `mole.activeFaceId`, 동기)
  - `MG.FaceStore.setActive(id)` → void (동기)
  - `MG.FaceStore.MAX` = 20
- DB: name `moleFaces`, version 1, objectStore `faces` (keyPath `id`), index `createdAt`.

- [ ] **Step 1: 실패하는 테스트 작성** — `mole/scripts/test-face-store.js`

```js
'use strict';
const assert = require('assert');
require('fake-indexeddb/auto');
const { FaceStore } = require('../js/face-store.js');

// 최소 localStorage 폴리필 (Node)
if (typeof localStorage === 'undefined') {
  const mem = {};
  global.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; }
  };
}

function fakeBlob(tag) {
  return new Blob([tag], { type: 'image/png' });
}

(async function run() {
  const id1 = await FaceStore.saveFace(fakeBlob('a'), '엄마');
  await new Promise((r) => setTimeout(r, 5));
  const id2 = await FaceStore.saveFace(fakeBlob('b'), '아빠');
  assert.notStrictEqual(id1, id2, 'id 유일');

  const list = await FaceStore.listFaces();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, id2, '최신이 먼저 (createdAt desc)');
  assert.strictEqual(list[0].name, '아빠');

  FaceStore.setActive(id1);
  assert.strictEqual(FaceStore.getActiveId(), id1);

  await FaceStore.renameFace(id1, '어머니');
  assert.strictEqual((await FaceStore.getFace(id1)).name, '어머니');

  await FaceStore.deleteFace(id1);
  assert.strictEqual(await FaceStore.getFace(id1), null);
  assert.strictEqual(FaceStore.getActiveId(), null, '활성 얼굴 삭제 시 활성 해제');
  assert.strictEqual((await FaceStore.listFaces()).length, 1);

  // 20개 상한
  for (let i = 0; i < 19; i++) await FaceStore.saveFace(fakeBlob('x' + i), 'f' + i);
  assert.strictEqual(await FaceStore.count(), 20);
  await assert.rejects(FaceStore.saveFace(fakeBlob('over'), 'over'), /full/, '21번째 거부');

  console.log('test-face-store: OK');
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node mole/scripts/test-face-store.js`
Expected: FAIL — `Cannot find module 'fake-indexeddb/auto'` (또는 face-store 모듈 없음)

- [ ] **Step 3: fake-indexeddb 설치**

```bash
cd C:/Users/master/Desktop/fun-games-hub && npm install --save-dev fake-indexeddb
```

`package.json` 에 `"devDependencies": { "fake-indexeddb": "^6.x" }` 가 생겼는지 확인. `package-lock.json` 도 스테이징 대상.

- [ ] **Step 4: face-store.js 구현**

```js
(function (root) {
  'use strict';
  var DB_NAME = 'moleFaces';
  var STORE = 'faces';
  var MAX = 20;
  var ACTIVE_KEY = 'mole.activeFaceId';

  function idb() {
    return (typeof indexedDB !== 'undefined') ? indexedDB : (root && root.indexedDB);
  }
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = idb().open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  function count() {
    return tx('readonly', function (s) { return s.count(); }).then(reqValue);
  }
  function reqValue(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function saveFace(blob, name) {
    return count().then(function (n) {
      if (n >= MAX) throw new Error('full');
      var rec = { id: 'f' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
                  name: name || '', blob: blob, createdAt: Date.now() };
      return tx('readwrite', function (s) { s.add(rec); }).then(function () { return rec.id; });
    });
  }
  function listFaces() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var t = db.transaction(STORE, 'readonly');
        var cur = t.objectStore(STORE).index('createdAt').openCursor(null, 'prev');
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { out.push(c.value); c.continue(); }
        };
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }
  function getFace(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }
  function renameFace(id, name) {
    return getFace(id).then(function (rec) {
      if (!rec) return;
      rec.name = name || '';
      return tx('readwrite', function (s) { s.put(rec); });
    });
  }
  function deleteFace(id) {
    return tx('readwrite', function (s) { s.delete(id); }).then(function () {
      if (getActiveId() === id) clearActive();
    });
  }

  function lsGet(k) { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : null; }
  function getActiveId() { return lsGet(ACTIVE_KEY) || null; }
  function setActive(id) { if (typeof localStorage !== 'undefined') localStorage.setItem(ACTIVE_KEY, id); }
  function clearActive() { if (typeof localStorage !== 'undefined') localStorage.removeItem(ACTIVE_KEY); }

  var api = {
    MAX: MAX,
    saveFace: saveFace, listFaces: listFaces, getFace: getFace,
    renameFace: renameFace, deleteFace: deleteFace, count: count,
    getActiveId: getActiveId, setActive: setActive, clearActive: clearActive
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceStore = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node mole/scripts/test-face-store.js`
Expected: `test-face-store: OK`

> `count()` 의 반환이 `s.count()` IDBRequest 라 `tx` 헬퍼가 그대로 못 넘긴다. `count()` 구현이 위처럼 `reqValue` 로 감싸는지 확인하고, 안 되면 `count` 를 `openDb().then(db => new Promise(...))` 직접 형태로 재작성 (list/get 과 동일 패턴). 테스트가 진실.

- [ ] **Step 6: run-all-tests.js 등록 + 커밋**

`run-all-tests.js` 에 `require('./test-face-store.js')` 추가. (이 파일은 `async` IIFE 라 다른 순수 테스트와 실행 방식이 다를 수 있음 — `run-all-tests.js` 가 각 파일을 `require` 만 하는 구조면 자체 실행되므로 OK. child_process 로 도는 구조면 그 목록에 추가.)

```bash
git add mole/js/face-store.js mole/scripts/test-face-store.js mole/scripts/run-all-tests.js package.json package-lock.json
git commit -m "feat(mole): IndexedDB 얼굴 저장소 face-store"
```

---

### Task 3: ads.js — 광고 스텁 3종

**Files:**
- Create: `mole/js/ads.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MG.Ads.banner(el)` → void — `el` 안에 "광고" 플레이스홀더 채움
  - `MG.Ads.interstitial()` → `Promise<void>` — ~1.6초 가짜 오버레이 후 resolve
  - `MG.Ads.rewarded()` → `Promise<boolean>` — ~1.6초 가짜 오버레이 후 `resolve(true)` (보상 지급), 닫기 누르면 `resolve(false)`
  - Phase 2에서 이 3개 본문만 Capacitor AdMob 호출로 교체 (호출부 불변)

- [ ] **Step 1: ads.js 구현** (스텁이라 TDD 대신 스모크에서 검증 — Task 15)

```js
(function (root) {
  'use strict';
  function banner(el) {
    if (!el) return;
    el.classList.add('ad-banner');
    el.textContent = '광고';
    el.setAttribute('aria-hidden', 'true');
  }

  // 가짜 전면/리워드 오버레이. rewardMode=true 면 resolve 값이 boolean.
  function fakeAd(rewardMode) {
    return new Promise(function (resolve) {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card">' +
        '<div class="ad-overlay-tag">광고</div>' +
        '<div class="ad-overlay-bar"><i></i></div>' +
        '<button type="button" class="ad-overlay-x" aria-label="닫기">✕</button></div>';
      document.body.appendChild(v);
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        v.remove();
        resolve(val);
      }
      v.querySelector('.ad-overlay-x').addEventListener('click', function () {
        finish(rewardMode ? false : undefined);
      });
      setTimeout(function () { finish(rewardMode ? true : undefined); }, 1600);
    });
  }
  function interstitial() { return fakeAd(false); }
  function rewarded() { return fakeAd(true); }

  var api = { banner: banner, interstitial: interstitial, rewarded: rewarded };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Ads = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: 최소 CSS** — `mole/style.css` 끝에 추가

```css
.ad-banner { display: flex; align-items: center; justify-content: center;
  min-height: 48px; background: #1b1c22; color: #6b6d78; font-size: 0.8rem;
  letter-spacing: 0.1em; border-radius: 8px; }
.ad-overlay { position: fixed; inset: 0; z-index: 50; display: flex;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.72); }
.ad-overlay-card { position: relative; width: 78%; max-width: 320px; padding: 28px 18px;
  background: #202129; border-radius: 14px; text-align: center; color: #cfd0d8; }
.ad-overlay-tag { font-size: 0.75rem; letter-spacing: 0.2em; color: #7c7e8a; }
.ad-overlay-bar { margin-top: 14px; height: 4px; background: #33343e; border-radius: 2px; overflow: hidden; }
.ad-overlay-bar i { display: block; height: 100%; width: 0; background: #57d977; animation: ad-fill 1.6s linear forwards; }
@keyframes ad-fill { to { width: 100%; } }
.ad-overlay-x { position: absolute; top: 8px; right: 10px; background: none; border: none;
  color: #8a8c98; font-size: 1rem; cursor: pointer; }
```

- [ ] **Step 3: 커밋**

```bash
git add mole/js/ads.js mole/style.css
git commit -m "feat(mole): 광고 스텁 모듈 ads.js (Phase 2에서 AdMob 교체)"
```

---

### Task 4: spawn-scheduler — 난이도별 방해물 토글

**Files:**
- Modify: `mole/js/spawn-scheduler.js:69-89` (`trySpawn`), `:120-127` (spawn 루프)
- Modify: `mole/scripts/test-spawn-scheduler.js` (테스트 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `MG.SpawnScheduler.create({ regions, spawnPoints, config, rng })` 의 `config.obstacles === false` 면 `animal`/`bomb` 을 스폰하지 않음 (`config.obstacles` 미지정/`true` = 기존 동작).

- [ ] **Step 1: 실패하는 테스트 추가** — `mole/scripts/test-spawn-scheduler.js` 끝의 테스트 목록에 (기존 test16 다음, 번호는 파일 스타일 따라):

```js
// Test 17: config.obstacles=false → 동물/폭탄 안 나옴
(function testObstaclesOff() {
  const rng = { next: mulberry32(12345) };
  const scheduler = SpawnScheduler.create({
    regions: mkRegions(16), spawnPoints: mkSpawnPoints(16),
    config: { maxConcurrentMoles: 5, maxConcurrentAnimals: 3, maxConcurrentBombs: 3,
              popDuration: 1.5, molePoseCount: 8, obstacleCount: 5, obstacles: false },
    rng
  });
  let sawObstacle = false;
  for (let i = 0; i < 4000; i++) {
    const { spawned } = scheduler.tick(0.05);
    spawned.forEach((p) => { if (p.type === 'animal' || p.type === 'bomb') sawObstacle = true; });
  }
  assert.strictEqual(sawObstacle, false, 'obstacles:false → 방해물 스폰 없음');
})();

// Test 18: config.obstacles 미지정 → 기존대로 방해물 나옴
(function testObstaclesDefault() {
  const rng = { next: mulberry32(777) };
  const scheduler = SpawnScheduler.create({
    regions: mkRegions(16), spawnPoints: mkSpawnPoints(16),
    config: { maxConcurrentMoles: 3, maxConcurrentAnimals: 2, maxConcurrentBombs: 2,
              popDuration: 1.5, molePoseCount: 8, obstacleCount: 5 },
    rng
  });
  let sawObstacle = false;
  for (let i = 0; i < 4000; i++) {
    const { spawned } = scheduler.tick(0.05);
    spawned.forEach((p) => { if (p.type === 'animal' || p.type === 'bomb') sawObstacle = true; });
  }
  assert.strictEqual(sawObstacle, true, '기본값 → 방해물 나옴');
})();
```

> `mulberry32`/`mkRegions`/`mkSpawnPoints` 헬퍼가 이 테스트 파일에 이미 있는지 확인하고 이름을 맞출 것. 없으면 파일 상단 기존 헬퍼 정의를 그대로 사용.

- [ ] **Step 2: 테스트 실패 확인**

Run: `node mole/scripts/test-spawn-scheduler.js`
Expected: Test 17 FAIL (방해물이 스폰됨)

- [ ] **Step 3: spawn-scheduler.js 수정**

`tick(dt)` 안의 스폰 루프 (`['mole', 'animal', 'bomb'].forEach(...)`) 를 다음으로 교체:

```js
      var spawnTypes = (config.obstacles === false) ? ['mole'] : ['mole', 'animal', 'bomb'];
      spawnTypes.forEach((type) => {
        cooldown[type] -= dt;
        if (cooldown[type] <= 0) {
          const pop = trySpawn(type);
          if (pop) spawned.push(pop);
          cooldown[type] = randomGap();
        }
      });
```

(`cooldown` 객체는 3종 다 초기화돼 있어도 무해 — 'animal'/'bomb' 를 그냥 안 돌릴 뿐.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `node mole/scripts/test-spawn-scheduler.js`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add mole/js/spawn-scheduler.js mole/scripts/test-spawn-scheduler.js
git commit -m "feat(mole): 난이도별 방해물 스폰 토글 (config.obstacles)"
```

---

### Task 5: mole-sprites — HEAD_ANCHOR (얼굴 앵커)

**Files:**
- Create: `mole/scripts/measure-head-anchor.py`
- Modify: `mole/js/mole-sprites.js`
- Modify: `mole/scripts/test-mole-sprites.js`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MG.MoleSprites.HEAD_ANCHOR` — `{ mole1: {cx,cy,r}, ... mole8, peek1, peek2, helmet }` (스프라이트 470×548 박스 대비 비율 0~1)
  - `MG.MoleSprites.headAnchor(spriteFile)` → `{cx,cy,r}` (없으면 `mole1` 값 폴백)

- [ ] **Step 1: 측정 스크립트 작성** — `mole/scripts/measure-head-anchor.py`

```python
"""최종 두더지 스프라이트에서 빨간 헬멧 blob 을 찾아 얼굴 원 앵커를 산출한다.
출력: mole-sprites.js 에 붙일 HEAD_ANCHOR JS 객체.
얼굴 원 = 헬멧 바로 아래. 상수 3개(FACE_DROP, FACE_R_MULT, R_MIN)로 튜닝."""
import os, sys, json
from PIL import Image

HERE = os.path.dirname(__file__)
SPRITES = os.path.join(HERE, '..', 'assets', 'moles')
FILES = ['mole1','mole2','mole3','mole4','mole5','mole6','mole7','mole8','peek1','peek2','helmet']

FACE_DROP = 0.55     # 헬멧 높이의 이 배수만큼 아래로 = 얼굴 중심 y
FACE_R_MULT = 0.60   # 얼굴 반지름 = 헬멧 폭 * 이 값
R_MIN = 0.05         # 최소 반지름(비율) — 헬멧 검출 실패 대비

def red_bbox(im):
    """가장 큰 빨강(헬멧) 연결요소의 bbox (x0,y0,x1,y1) in px, 없으면 None."""
    px = im.convert('RGBA').load()
    w, h = im.size
    mask = [[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 40 and r > 120 and r > g * 1.5 and r > b * 1.4:
                mask[y][x] = True
    best = None; best_area = 0
    seen = [[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not mask[y][x]:
                continue
            stack = [(x, y)]; seen[y][x] = True
            x0=x1=x; y0=y1=y; area=0
            while stack:
                cx, cy = stack.pop(); area += 1
                x0=min(x0,cx); x1=max(x1,cx); y0=min(y0,cy); y1=max(y1,cy)
                for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0<=nx<w and 0<=ny<h and not seen[ny][nx] and mask[ny][nx]:
                        seen[ny][nx]=True; stack.append((nx,ny))
            if area > best_area:
                best_area = area; best = (x0, y0, x1, y1)
    return best

def anchor(im):
    w, h = im.size
    bb = red_bbox(im)
    if not bb:
        return {'cx': 0.5, 'cy': 0.32, 'r': 0.22}
    x0, y0, x1, y1 = bb
    hw = x1 - x0; hh = y1 - y0
    cx = ((x0 + x1) / 2) / w
    cy = (y1 + FACE_DROP * hh) / h
    r = max(R_MIN, (FACE_R_MULT * hw) / w)
    return {'cx': round(cx, 4), 'cy': round(cy, 4), 'r': round(r, 4)}

def main():
    out = {}
    for f in FILES:
        p = os.path.join(SPRITES, f + '.png')
        if not os.path.exists(p):
            print(f'  (missing {f}.png)', file=sys.stderr); continue
        out[f] = anchor(Image.open(p))
    print('  HEAD_ANCHOR: ' + json.dumps(out, ensure_ascii=False).replace('"', '') + ',')
    for k, v in out.items():
        print(f'  // {k}: cx={v["cx"]} cy={v["cy"]} r={v["r"]}', file=sys.stderr)

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: 측정 실행**

Run: `python mole/scripts/measure-head-anchor.py`
Expected: stdout 에 `HEAD_ANCHOR: {mole1:{cx:...,cy:...,r:...}, ...},` 한 줄. 11개 키(mole1~8, peek1, peek2, helmet) 모두. stderr 에 값 로그.

각 값이 `cx` 0.3~0.7, `cy` 0.15~0.6, `r` 0.1~0.4 범위인지 눈으로 확인. 범위를 벗어나면 헬멧 검출 문제 — `red_bbox` 의 임계값을 `slice-mole-sprites.py` 의 `helmet_region` 과 맞춰 조정.

- [ ] **Step 3: 실패하는 테스트 작성** — `mole/scripts/test-mole-sprites.js` 에 추가:

```js
// HEAD_ANCHOR: 11개 포즈, 각 값이 정상 범위
(function testHeadAnchor() {
  const A = MoleSprites.HEAD_ANCHOR;
  const keys = ['mole1','mole2','mole3','mole4','mole5','mole6','mole7','mole8','peek1','peek2','helmet'];
  keys.forEach((k) => {
    assert.ok(A[k], k + ' 앵커 존재');
    assert.ok(A[k].cx > 0.2 && A[k].cx < 0.8, k + ' cx 범위');
    assert.ok(A[k].cy > 0.05 && A[k].cy < 0.7, k + ' cy 범위');
    assert.ok(A[k].r > 0.05 && A[k].r < 0.45, k + ' r 범위');
  });
  assert.deepStrictEqual(MoleSprites.headAnchor('mole3'), A.mole3);
  assert.deepStrictEqual(MoleSprites.headAnchor('nonesuch'), A.mole1, '미지 파일 → mole1 폴백');
})();
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `node mole/scripts/test-mole-sprites.js`
Expected: FAIL — `HEAD_ANCHOR` undefined

- [ ] **Step 5: mole-sprites.js 수정**

`DEPTH_SINK` 선언 아래에 Step 2 의 출력을 그대로 붙여넣기 (아래는 형식 예시 — **실제 값은 measure 스크립트 출력으로 대체**):

```js
  // measure-head-anchor.py 산출값. 얼굴 원(사람두더지 합성) 위치·크기 = 스프라이트 박스 대비 비율.
  // 재측정: python scripts/measure-head-anchor.py
  const HEAD_ANCHOR = {
    mole1: { cx: 0.50, cy: 0.30, r: 0.24 },
    mole2: { cx: 0.50, cy: 0.30, r: 0.24 },
    mole3: { cx: 0.49, cy: 0.30, r: 0.24 },
    mole4: { cx: 0.50, cy: 0.31, r: 0.24 },
    mole5: { cx: 0.50, cy: 0.30, r: 0.24 },
    mole6: { cx: 0.50, cy: 0.30, r: 0.24 },
    mole7: { cx: 0.50, cy: 0.30, r: 0.24 },
    mole8: { cx: 0.50, cy: 0.30, r: 0.24 },
    peek1: { cx: 0.50, cy: 0.42, r: 0.22 },
    peek2: { cx: 0.50, cy: 0.45, r: 0.22 },
    helmet: { cx: 0.50, cy: 0.52, r: 0.20 }
  };

  function headAnchor(spriteFile) {
    return HEAD_ANCHOR[spriteFile] || HEAD_ANCHOR.mole1;
  }
```

`api` 객체에 `HEAD_ANCHOR, headAnchor` 추가.

- [ ] **Step 6: 테스트 통과 확인**

Run: `node mole/scripts/test-mole-sprites.js`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add mole/js/mole-sprites.js mole/scripts/measure-head-anchor.py mole/scripts/test-mole-sprites.js
git commit -m "feat(mole): 두더지 포즈별 얼굴 앵커 HEAD_ANCHOR"
```

---

### Task 6: 카톡 대화 코드 제거 + screen-nav + 홈 스텁

이 태스크 뒤 게임은 `__debugStartGame()` 로만 시작 가능하고 캐릭터/대화 코드는 전부 사라진다. 홈화면 실물은 Task 10.

**Files:**
- Create: `mole/js/screen-nav.js`
- Modify: `mole/js/game.js` (대화 코드 대량 삭제, `showStartScreen`→`showHome` 스텁)
- Modify: `mole/index.html` (`#chat-first`/`#chat-return` 삭제, `#home-screen` 빈 패널 추가, screen-nav 로드)
- Modify: `mole/style.css` (`.chat-*` 삭제)
- Delete: `mole/assets/avatar-mole.png`, `mole/assets/avatar-hippo.png`
- Modify: `mole/scripts/verify-mole-smoke.js` (`#board-start`/chat 어서션 → `#home-screen` 존재 + `__debugStartGame` 로 플레이)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MG.ScreenNav.create({ screens: [id...], onShow?(id) })` → `{ show(id), back(), current() }` — `screens` 의 id 를 가진 요소들을 서로 배타적으로 표시(`hidden` 토글). `show` 는 히스토리 스택 push, `back` 은 pop.
  - `game.js`: `showHome()` (구 `showStartScreen`), `startRound(n, {fresh})` 유지, `__debugStartGame` 유지.

- [ ] **Step 1: screen-nav.js 작성**

```js
(function (root) {
  'use strict';
  function create(opts) {
    var ids = opts.screens.slice();
    var onShow = opts.onShow || function () {};
    var stack = [];

    function render() {
      var top = stack[stack.length - 1];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = (id !== top);
      });
      if (top) onShow(top);
    }
    function show(id) {
      if (ids.indexOf(id) === -1) return;
      if (stack[stack.length - 1] === id) return;
      stack.push(id);
      render();
    }
    function back() {
      if (stack.length > 1) stack.pop();
      render();
    }
    function current() { return stack[stack.length - 1] || null; }
    return { show: show, back: back, current: current };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScreenNav = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 2: game.js — 대화 코드 삭제**

`game.js` 에서 아래를 **전부 제거**:
- 상수: `RETURN_PHRASES`, `HIPPO_REPLIES`, `CELEBRATE_EMOJI`, `RETRY_TEXT`, `HIPPO_MOODS`
- 함수: `pick`, `avatarEl`, `bubbleRow`, `emojiRow`, `makeStartBtn`, `buildReturnChat`, `revealThread`
- `showStartScreen` 내부의 대화 관련 로직 (visits/firstVisit/chat-first/chat-return/buildReturnChat/revealThread 호출)
- DOMContentLoaded 안: `#start-btn` 리스너, `#board-start` 건너뛰기-탭 리스너
- `__debugSetVisits`, `__debugResetIntro` (대화 전용)
- `pick` 이 다른 곳에서 안 쓰이면 삭제 (검색해서 확인)

`showStartScreen(opts)` → `showHome()` 로 개명(호출부 전부 치환: `showStartScreen()` 5곳, `showStartScreen({retry:true})` 1곳 → 전부 `showHome()`). 새 본문:

```js
  function showHome() {
    sessionGen++;
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    state = null;
    run = null;
    setPauseUI(false);
    syncBgm(false);
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('round-intro-overlay').hidden = true;
    document.getElementById('game-screen').classList.add('is-start');
    screenNav.show('home-screen');
    if (homeScreen) homeScreen.refresh();
    retriggerBestSms();
  }

  // 최고 기록 문자 알림 — 홈 열 때마다 위에서 툭↓ 리트리거.
  function retriggerBestSms() {
    var best = loadBest();
    var sms = document.getElementById('start-best');
    var diff = localStorage.getItem('mole.difficulty') || 'easy';
    var b = bestFor(diff);
    sms.querySelector('.chat-sms-txt').textContent =
      b > 0 ? I18N.t('mole.start.best', { n: b.toLocaleString() }) : '';
    sms.classList.toggle('is-empty', b <= 0);
    sms.classList.remove('sms-anim');
    void sms.offsetWidth;
    sms.classList.add('sms-anim');
  }
```

> `screenNav`, `homeScreen`, `bestFor` 는 이 태스크에서 스텁으로 둔다 (아래 Step 3·4). 실제 `homeScreen` 은 Task 10, `bestFor`/난이도 저장은 Task 11 에서 채운다. 이 태스크에선:
> - `let screenNav = null; let homeScreen = null;`
> - `function bestFor() { return loadBest(); }` (임시 — Task 11 에서 난이도별로)

DOMContentLoaded 안에 screenNav 생성 추가 (sharedLaneControls 생성 근처):

```js
    screenNav = MG.ScreenNav.create({
      screens: ['home-screen', 'face-maker', 'face-locker', 'shop', 'daily',
                'score-screen', 'help-screen', 'privacy-screen'],
      onShow: function (id) {
        // 게임 오버레이는 screenNav 밖 — 홈 계열 화면일 때만 board-start 컨테이너 노출
      }
    });
    showHome();
```

`#btn-back-to-hub` 리스너를 교체:

```js
    document.getElementById('btn-back-to-hub').addEventListener('click', () => {
      if (state) showHome();          // 플레이 중 → 홈 (판 버림)
      else screenNav.back();          // 화면 스택에서 뒤로 (홈이면 그대로)
    });
```

`gameover-retry-btn` / `gameover-select-btn`:

```js
    document.getElementById('gameover-retry-btn').addEventListener('click', () => startGame(currentDifficulty()));
    document.getElementById('gameover-select-btn').addEventListener('click', () => showHome());
```

> `startGame`/`currentDifficulty` 는 Task 11. 이 태스크에선 임시로 `gameover-retry-btn` → `startRound(1, { fresh: true })`, `gameover-select-btn` → `showHome()`.

- [ ] **Step 3: index.html — DOM 교체**

`#board-start` 안의 `#chat-first` 와 `#chat-return` 을 삭제. `#start-best` 는 그대로 둔다. `#board-start` 를 다음 구조로:

```html
      <div id="board-start" class="board-panel board-start">
        <div id="start-best" class="chat-sms" aria-hidden="true"> ... 기존 그대로 ... </div>

        <div class="board-screen" id="home-screen" hidden data-i18n-skip>
          <!-- Task 10 에서 채움 -->
        </div>
        <div class="board-screen" id="face-maker" hidden></div>
        <div class="board-screen" id="face-locker" hidden></div>
        <div class="board-screen" id="shop" hidden></div>
        <div class="board-screen" id="daily" hidden></div>
        <div class="board-screen" id="score-screen" hidden></div>
        <div class="board-screen" id="help-screen" hidden></div>
        <div class="board-screen" id="privacy-screen" hidden></div>
      </div>
```

`<script>` 로드 목록에 추가 (game.js 앞):

```html
<script src="js/screen-nav.js"></script>
<script src="js/economy.js"></script>
<script src="js/face-store.js"></script>
<script src="js/ads.js"></script>
```

- [ ] **Step 4: style.css — `.chat-*` 삭제 + `.board-screen` 추가**

`.chat-thread`, `.chat-row`, `.chat-avatar*`, `.chat-bubble*`, `.chat-start-btn`, `.chat-row--emoji`, `.chat-emoji`, `.chat-burst*`, `@keyframes chat-in`, `@keyframes chat-burst-pop`, 그리고 `@media (prefers-color-scheme: dark)` 블록 안의 `.chat-bubble--them`/`.chat-bubble--me`/`.chat-start-btn` 규칙을 삭제.

`.chat-sms`, `.chat-sms-*`, `@keyframes sms-*` 는 **유지** (최고기록 문자 알림). `.chat-emoji` 를 `forced-color-adjust` 규칙(라인 24)에서 제거.

`.board-start` 규칙 아래에 추가:

```css
.board-screen { position: absolute; inset: 0; display: flex; flex-direction: column;
  background: #0b0b0d; color: #e8e8ea; overflow-y: auto; scrollbar-width: none; }
.board-screen::-webkit-scrollbar { display: none; }
```

- [ ] **Step 5: 아바타 PNG 삭제**

```bash
git rm mole/assets/avatar-mole.png mole/assets/avatar-hippo.png
```

- [ ] **Step 6: 스모크 최소 수정**

`mole/scripts/verify-mole-smoke.js` 에서 `#chat-first`/`#chat-return`/`#board-start` 대화 관련 어서션을 제거하고, 대신:
- `#home-screen` 요소가 존재하는지 (`page.$('#home-screen')` non-null)
- `await page.evaluate(() => window.__debugStartGame())` 로 게임 시작 → 기존 플레이/결과 어서션은 유지

`is-start` 클래스 체크는 유지 가능.

- [ ] **Step 7: 로직 테스트 + 스모크**

```bash
node mole/scripts/run-all-tests.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

Expected: 로직 전부 green. 스모크 green (게임이 `__debugStartGame` 으로 시작·플레이·결과까지).
스모크용 `node scripts/serve.js` 는 끝나고 kill.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor(mole): 카톡 대화·캐릭터 인트로 제거, screen-nav 도입"
```

---

### Task 7: face-maker — 사진 선택 + 원형 크롭 + 저장

**Files:**
- Create: `mole/js/face-maker.js`
- Modify: `mole/index.html` (`#face-maker` 패널 내용 + script 로드)
- Modify: `mole/style.css` (`.face-maker*`)
- Modify: `mole/js/i18n-strings.js` (메이커 문구)
- Modify: `mole/scripts/verify-mole-smoke.js` (메이커 플로우)

**Interfaces:**
- Consumes: `MG.FaceStore.saveFace`, `MG.FaceStore.setActive`, `MG.ScreenNav`
- Produces:
  - `MG.FaceMaker.create({ root, onDone(faceId), onCancel })` → `{ open({ forced }) }`
    - `open` 은 `#face-maker` 를 초기 상태(사진 선택 대기)로 리셋. `forced === true` 면 취소/뒤로 버튼 숨김(온보딩).
    - 저장 완료 시 `FaceStore.setActive(id)` 후 `onDone(id)`.
  - 저장물: 256×256 PNG, 원형 마스크(원 밖 투명).

- [ ] **Step 1: index.html — `#face-maker` 내용**

```html
        <div class="board-screen face-maker" id="face-maker" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-fm-cancel aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.fm.title">사람두더지 만들기</span>
          </div>

          <div class="fm-stage" data-fm-stage="pick">
            <p class="fm-hint" data-i18n="mole.fm.pickHint">사진을 골라주세요</p>
            <label class="fm-pick-btn">
              <span data-i18n="mole.fm.pick">사진 선택</span>
              <input type="file" accept="image/*" data-fm-file hidden>
            </label>
          </div>

          <div class="fm-stage" data-fm-stage="crop" hidden>
            <p class="fm-hint" data-i18n="mole.fm.cropHint">얼굴을 원 안에 맞춰주세요</p>
            <div class="fm-crop" data-fm-crop>
              <img class="fm-crop-img" data-fm-img alt="">
              <div class="fm-crop-ring" aria-hidden="true"></div>
            </div>
            <button type="button" class="fm-next" data-fm-next data-i18n="mole.fm.next">다음</button>
          </div>

          <div class="fm-stage" data-fm-stage="preview" hidden>
            <p class="fm-hint" data-i18n="mole.fm.previewHint">이 두더지로 할까요?</p>
            <div class="fm-preview" data-fm-preview></div>
            <input type="text" class="fm-name" data-fm-name maxlength="12"
                   placeholder="이름 (선택)" data-i18n-placeholder="mole.fm.namePh">
            <div class="fm-preview-btns">
              <button type="button" class="fm-redo" data-fm-redo data-i18n="mole.fm.redo">다시</button>
              <button type="button" class="fm-save" data-fm-save data-i18n="mole.fm.save">저장</button>
            </div>
          </div>

          <p class="fm-priv" data-i18n="mole.fm.priv">사진은 이 기기에서만 처리돼요. 업로드하지 않아요.</p>
        </div>
```

script 로드에 `<script src="js/face-maker.js"></script>` 추가 (game.js 앞).

- [ ] **Step 2: i18n 키 추가** — `mole/js/i18n-strings.js` `ko`/`en` 에:

```
'mole.fm.title': '사람두더지 만들기' / 'Make a Face Mole',
'mole.fm.pickHint': '사진을 골라주세요' / 'Pick a photo',
'mole.fm.pick': '사진 선택' / 'Choose photo',
'mole.fm.cropHint': '얼굴을 원 안에 맞춰주세요' / 'Fit the face in the circle',
'mole.fm.next': '다음' / 'Next',
'mole.fm.previewHint': '이 두더지로 할까요?' / 'Use this mole?',
'mole.fm.namePh': '이름 (선택)' / 'Name (optional)',
'mole.fm.redo': '다시' / 'Redo',
'mole.fm.save': '저장' / 'Save',
'mole.fm.priv': '사진은 이 기기에서만 처리돼요. 업로드하지 않아요.' / 'Photos stay on this device. Never uploaded.',
'mole.fm.full': '보관함이 가득 찼어요 (20개). 오래된 것을 지워주세요.' / 'Locker full (20). Delete an old one.'
```

- [ ] **Step 3: face-maker.js 작성**

```js
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var OUT = 256;                 // 저장 PNG 한 변
  var MOLE_BODY = 'assets/moles/mole1.png';  // 미리보기용 두더지 몸

  function create(opts) {
    var el = opts.root;
    var onDone = opts.onDone || function () {};
    var onCancel = opts.onCancel || function () {};

    var fileInput = el.querySelector('[data-fm-file]');
    var cropImg = el.querySelector('[data-fm-img]');
    var cropBox = el.querySelector('[data-fm-crop]');
    var previewBox = el.querySelector('[data-fm-preview]');
    var nameInput = el.querySelector('[data-fm-name]');

    var view = { scale: 1, x: 0, y: 0 };   // 이미지 transform (박스 중앙 기준 %)
    var natural = { w: 0, h: 0 };
    var pointers = new Map();
    var pinchStart = null;
    var lastCropDataUrl = null;
    var forced = false;

    function stage(name) {
      el.querySelectorAll('[data-fm-stage]').forEach(function (s) {
        s.hidden = (s.getAttribute('data-fm-stage') !== name);
      });
    }

    function open(o) {
      forced = !!(o && o.forced);
      el.querySelectorAll('[data-fm-cancel]').forEach(function (b) { b.hidden = forced; });
      fileInput.value = '';
      nameInput.value = '';
      lastCropDataUrl = null;
      stage('pick');
    }

    // --- 사진 선택 ---
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        cropImg.onload = function () {
          natural.w = cropImg.naturalWidth;
          natural.h = cropImg.naturalHeight;
          resetView();
          stage('crop');
          applyView();
        };
        cropImg.src = reader.result;   // dataURL — 메모리에만
      };
      reader.readAsDataURL(f);
    });

    function resetView() {
      // 원(박스)에 이미지 짧은 변이 꽉 차도록 초기 스케일.
      var box = cropBox.getBoundingClientRect();
      var cover = Math.max(box.width / natural.w, box.height / natural.h);
      view.scale = cover;
      view.x = 0; view.y = 0;
      clampView();
    }
    function clampView() {
      var box = cropBox.getBoundingClientRect();
      var dispW = natural.w * view.scale;
      var dispH = natural.h * view.scale;
      var maxX = Math.max(0, (dispW - box.width) / 2);
      var maxY = Math.max(0, (dispH - box.height) / 2);
      view.x = Math.max(-maxX, Math.min(maxX, view.x));
      view.y = Math.max(-maxY, Math.min(maxY, view.y));
      var minScale = Math.max(box.width / natural.w, box.height / natural.h);
      if (view.scale < minScale) view.scale = minScale;
    }
    function applyView() {
      cropImg.style.transform =
        'translate(-50%,-50%) translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.scale + ')';
    }

    // --- 드래그 / 핀치 ---
    cropBox.addEventListener('pointerdown', function (e) {
      cropBox.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinchStart = { dist: dist(pts[0], pts[1]), scale: view.scale };
      }
    });
    cropBox.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        view.x += (e.clientX - prev.x);
        view.y += (e.clientY - prev.y);
      } else if (pointers.size === 2 && pinchStart) {
        var pts = Array.from(pointers.values());
        view.scale = pinchStart.scale * (dist(pts[0], pts[1]) / pinchStart.dist);
      }
      clampView();
      applyView();
    });
    function endPointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart = null;
    }
    cropBox.addEventListener('pointerup', endPointer);
    cropBox.addEventListener('pointercancel', endPointer);
    cropBox.addEventListener('wheel', function (e) {
      e.preventDefault();
      view.scale *= (e.deltaY < 0 ? 1.08 : 0.93);
      clampView();
      applyView();
    }, { passive: false });
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    // --- 크롭 → 원형 PNG dataURL ---
    function renderCrop() {
      var box = cropBox.getBoundingClientRect();
      // 박스(원 지름 = box.width, 정사각형)에서 이미지의 어느 영역이 보이는지 역산.
      var dispW = natural.w * view.scale;
      var srcX = (dispW / 2 - view.x - box.width / 2) / view.scale;
      var dispH = natural.h * view.scale;
      var srcY = (dispH / 2 - view.y - box.height / 2) / view.scale;
      var srcSize = box.width / view.scale;

      var c = document.createElement('canvas');
      c.width = OUT; c.height = OUT;
      var ctx = c.getContext('2d');
      ctx.drawImage(cropImg, srcX, srcY, srcSize, srcSize, 0, 0, OUT, OUT);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
      ctx.fill();
      return c.toDataURL('image/png');
    }

    el.querySelector('[data-fm-next]').addEventListener('click', function () {
      lastCropDataUrl = renderCrop();
      previewBox.innerHTML =
        '<div class="fm-preview-mole">' +
        '<img class="fm-preview-body" src="' + MOLE_BODY + '" alt="">' +
        '<img class="fm-preview-face" src="' + lastCropDataUrl + '" alt="">' +
        '</div>';
      // 얼굴 위치 = mole1 앵커
      var a = MG.MoleSprites.headAnchor('mole1');
      var face = previewBox.querySelector('.fm-preview-face');
      face.style.left = (a.cx * 100) + '%';
      face.style.top = (a.cy * 100) + '%';
      face.style.width = (a.r * 2 * 100) + '%';
      stage('preview');
    });

    el.querySelector('[data-fm-redo]').addEventListener('click', function () { stage('crop'); });

    el.querySelector('[data-fm-save]').addEventListener('click', function () {
      dataUrlToBlob(lastCropDataUrl).then(function (blob) {
        return MG.FaceStore.saveFace(blob, nameInput.value.trim());
      }).then(function (id) {
        MG.FaceStore.setActive(id);
        onDone(id);
      }).catch(function (err) {
        alert(root.FGH.I18N.t(err && err.message === 'full' ? 'mole.fm.full' : 'mole.fm.priv'));
      });
    });

    el.querySelectorAll('[data-fm-cancel]').forEach(function (b) {
      b.addEventListener('click', function () { onCancel(); });
    });

    function dataUrlToBlob(url) {
      return fetch(url).then(function (r) { return r.blob(); });
    }

    return { open: open };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceMaker = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css — `.face-maker`**

```css
.board-screen-bar { display: flex; align-items: center; gap: 6px; padding: 10px 12px;
  font-weight: 700; border-bottom: 1px solid #1e1e22; }
.bs-back { background: none; border: none; color: #e8e8ea; font-size: 1.4rem; line-height: 1; cursor: pointer; }
.bs-title { font-size: 0.95rem; }

.face-maker { align-items: center; padding-bottom: 12px; }
.fm-stage { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px 14px; }
.fm-hint { font-size: 0.9rem; color: #b9b9c0; margin: 0; }
.fm-pick-btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 10px;
  background: linear-gradient(180deg, #57d977, #2fb457); color: #fff; font-weight: 800; cursor: pointer; }
.fm-crop { position: relative; width: 74%; aspect-ratio: 1; border-radius: 50%; overflow: hidden;
  background: #000; touch-action: none; }
.fm-crop-img { position: absolute; left: 50%; top: 50%; transform-origin: center; will-change: transform; max-width: none; }
.fm-crop-ring { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 2px rgba(255,255,255,0.6) inset; pointer-events: none; }
.fm-next, .fm-save, .fm-redo { padding: 9px 22px; border: none; border-radius: 9px; font-weight: 800; cursor: pointer; }
.fm-next, .fm-save { background: linear-gradient(180deg, #57d977, #2fb457); color: #fff; }
.fm-redo { background: #33343e; color: #d0d0d6; }
.fm-preview-btns { display: flex; gap: 10px; }
.fm-name { width: 70%; padding: 8px 10px; border-radius: 8px; border: 1px solid #33343e;
  background: #17181d; color: #e8e8ea; text-align: center; }
.fm-preview-mole { position: relative; width: 46%; margin: 0 auto; aspect-ratio: 470/548; }
.fm-preview-body { position: absolute; inset: 0; width: 100%; }
.fm-preview-face { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; aspect-ratio: 1; }
.fm-priv { margin-top: auto; padding: 8px 14px 0; font-size: 0.72rem; color: #6d6d76; text-align: center; }
```

- [ ] **Step 5: 스모크 — 메이커 플로우**

`verify-mole-smoke.js` 에 헬퍼 추가: 데이터 URL 로 만든 가짜 파일을 `#face-maker input[type=file]` 에 주입.

```js
async function makeFace(page) {
  await page.evaluate(() => window.__debugOpenMaker());
  const input = await page.$('#face-maker [data-fm-file]');
  // 128x128 빨강 PNG dataURL 을 파일로
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const tmp = require('path').join(require('os').tmpdir(), 'smokeface.png');
  require('fs').writeFileSync(tmp, buf);
  await input.uploadFile(tmp);
  await page.waitForSelector('#face-maker [data-fm-stage="crop"]:not([hidden])');
  await page.click('#face-maker [data-fm-next]');
  await page.waitForSelector('#face-maker [data-fm-stage="preview"]:not([hidden])');
  await page.click('#face-maker [data-fm-save]');
  await page.waitForFunction(() => !!window.MoleGame.FaceStore.getActiveId());
}
```

> `__debugOpenMaker` 훅은 Task 11 에서 추가되지만, 이 태스크에서 먼저 최소 형태로 game.js 에 넣어도 됨: `window.__debugOpenMaker = () => faceMaker.open({});` — `faceMaker` 인스턴스 생성도 이 태스크에서 (아래 Step 6).

- [ ] **Step 6: game.js — faceMaker 인스턴스 생성 (임시 배선)**

DOMContentLoaded, screenNav 생성 뒤:

```js
    faceMaker = MG.FaceMaker.create({
      root: document.getElementById('face-maker'),
      onDone: function () { screenNav.back(); },
      onCancel: function () { screenNav.back(); }
    });
    window.__debugOpenMaker = function () { screenNav.show('face-maker'); faceMaker.open({}); };
```

`let faceMaker = null;` 모듈 변수 추가.

- [ ] **Step 7: 테스트 + 스모크**

```bash
node mole/scripts/run-all-tests.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

Expected: green. 스모크가 `makeFace` 로 얼굴 1개 저장 + 활성 지정 확인.
스크린샷 확인: `#face-maker` 크롭 화면 / 미리보기(두더지에 빨간 원 얼굴 얹힘). 얼굴 원이 두더지 머리에 대충 맞는지 육안 확인 — 많이 어긋나면 Task 5 의 `FACE_DROP`/`FACE_R_MULT` 조정 후 재측정.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "feat(mole): 사람두더지 메이커 (사진 선택·원형 크롭·저장)"
```

---

### Task 8: face-locker — 보관함 화면

**Files:**
- Create: `mole/js/face-locker.js`
- Modify: `mole/index.html` (`#face-locker` 내용 + script)
- Modify: `mole/style.css` (`.face-locker*`)
- Modify: `mole/js/i18n-strings.js`
- Modify: `mole/js/game.js` (인스턴스 배선)

**Interfaces:**
- Consumes: `MG.FaceStore.*`, `MG.MoleSprites.headAnchor`
- Produces:
  - `MG.FaceLocker.create({ root, onMake, onPick(id), onClose })` → `{ show() }`
    - `show()` 는 목록을 다시 그린다. 각 항목: 두더지에 얼굴 얹은 썸네일 + 이름 + [활성] 표시 + [이름변경]/[삭제].
    - "새로 만들기" → `onMake()`. 항목 탭 = 활성 지정 후 `onPick(id)`.

- [ ] **Step 1: index.html**

```html
        <div class="board-screen face-locker" id="face-locker" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-fl-close aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.fl.title">내 사람두더지</span>
            <button type="button" class="fl-new" data-fl-new data-i18n="mole.fl.new">+ 만들기</button>
          </div>
          <div class="fl-grid" data-fl-grid></div>
          <p class="fl-empty" data-fl-empty hidden data-i18n="mole.fl.empty">아직 없어요. 사진으로 만들어보세요.</p>
        </div>
```

- [ ] **Step 2: i18n**

```
'mole.fl.title': '내 사람두더지' / 'My Face Moles',
'mole.fl.new': '+ 만들기' / '+ New',
'mole.fl.empty': '아직 없어요. 사진으로 만들어보세요.' / 'None yet. Make one from a photo.',
'mole.fl.active': '사용 중' / 'In use',
'mole.fl.use': '이걸로 하기' / 'Use this',
'mole.fl.rename': '이름' / 'Rename',
'mole.fl.del': '삭제' / 'Delete',
'mole.fl.delConfirm': '삭제할까요?' / 'Delete this?'
```

- [ ] **Step 3: face-locker.js**

```js
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k) { return root.FGH.I18N.t(k); };

  function create(opts) {
    var el = opts.root;
    var grid = el.querySelector('[data-fl-grid]');
    var empty = el.querySelector('[data-fl-empty]');

    el.querySelector('[data-fl-close]').addEventListener('click', function () { opts.onClose(); });
    el.querySelector('[data-fl-new]').addEventListener('click', function () { opts.onMake(); });

    function show() {
      grid.innerHTML = '';
      MG.FaceStore.listFaces().then(function (faces) {
        empty.hidden = faces.length > 0;
        var activeId = MG.FaceStore.getActiveId();
        var a = MG.MoleSprites.headAnchor('mole1');
        faces.forEach(function (f) {
          var url = URL.createObjectURL(f.blob);
          var card = document.createElement('div');
          card.className = 'fl-card' + (f.id === activeId ? ' fl-card--active' : '');
          card.innerHTML =
            '<div class="fl-thumb">' +
              '<img class="fl-thumb-body" src="assets/moles/mole1.png" alt="">' +
              '<img class="fl-thumb-face" alt="">' +
            '</div>' +
            '<div class="fl-name"></div>' +
            '<div class="fl-actions">' +
              '<button type="button" data-act="use">' + T('mole.fl.use') + '</button>' +
              '<button type="button" data-act="rename">' + T('mole.fl.rename') + '</button>' +
              '<button type="button" data-act="del">' + T('mole.fl.del') + '</button>' +
            '</div>';
          var face = card.querySelector('.fl-thumb-face');
          face.src = url;
          face.style.left = (a.cx * 100) + '%';
          face.style.top = (a.cy * 100) + '%';
          face.style.width = (a.r * 2 * 100) + '%';
          card.querySelector('.fl-name').textContent =
            f.name || (f.id === activeId ? T('mole.fl.active') : '');
          card.querySelector('[data-act="use"]').addEventListener('click', function () {
            MG.FaceStore.setActive(f.id); opts.onPick(f.id);
          });
          card.querySelector('[data-act="rename"]').addEventListener('click', function () {
            var name = prompt(T('mole.fl.rename'), f.name || '');
            if (name != null) MG.FaceStore.renameFace(f.id, name.trim().slice(0, 12)).then(show);
          });
          card.querySelector('[data-act="del"]').addEventListener('click', function () {
            if (confirm(T('mole.fl.delConfirm'))) MG.FaceStore.deleteFace(f.id).then(show);
          });
          grid.appendChild(card);
        });
      });
    }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.FaceLocker = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css**

```css
.face-locker .fl-new { margin-left: auto; background: none; border: none; color: #57d977; font-weight: 800; cursor: pointer; }
.fl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px; }
.fl-card { background: #16171c; border-radius: 12px; padding: 10px; text-align: center;
  border: 2px solid transparent; }
.fl-card--active { border-color: #57d977; }
.fl-thumb { position: relative; width: 68%; margin: 0 auto; aspect-ratio: 470/548; }
.fl-thumb-body { position: absolute; inset: 0; width: 100%; }
.fl-thumb-face { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; aspect-ratio: 1; }
.fl-name { margin-top: 4px; font-size: 0.8rem; color: #c8c8ce; min-height: 1em; }
.fl-actions { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.fl-actions button { padding: 5px 0; border: none; border-radius: 6px; background: #2a2b33; color: #d8d8de;
  font-size: 0.72rem; cursor: pointer; }
.fl-empty { padding: 24px; text-align: center; color: #6d6d76; }
```

- [ ] **Step 5: game.js 배선 (임시)**

```js
    faceLocker = MG.FaceLocker.create({
      root: document.getElementById('face-locker'),
      onMake: function () { screenNav.show('face-maker'); faceMaker.open({}); },
      onPick: function () { screenNav.back(); },
      onClose: function () { screenNav.back(); }
    });
    window.__debugOpenLocker = function () { screenNav.show('face-locker'); faceLocker.show(); };
```

`let faceLocker = null;`

- [ ] **Step 6: 스모크 + 커밋**

스모크에 짧게: `makeFace` 후 `__debugOpenLocker()` → `.fl-card` 1개 이상, `.fl-card--active` 존재.

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
git add -A && git commit -m "feat(mole): 사람두더지 보관함 화면"
```

---

### Task 9: pop-elements — 게임 중 얼굴 레이어

**Files:**
- Modify: `mole/js/pop-elements.js`
- Modify: `mole/style.css` (`.mole-face`)
- Modify: `mole/js/game.js` (활성 얼굴 URL 을 pop-elements 로 전달)
- Modify: `mole/scripts/verify-mole-smoke.js`

**Interfaces:**
- Consumes: `MG.MoleSprites.headAnchor`
- Produces:
  - `MG.PopElements.create({ container, onEmerge, faceUrl })` — `faceUrl` 이 truthy 면 두더지 pop(`kind === 'mole'`)에만 `.mole-face` `<img>` 를 얹고, 현재 표시 중인 프레임의 `headAnchor` 위치·크기로 배치. 동물/폭탄엔 안 얹음.
  - `setFaceUrl(url)` — 런타임에 얼굴 교체/해제(null 이면 제거). (게임 시작 시 game.js 가 호출.)

- [ ] **Step 1: 스모크 어서션 먼저** — `verify-mole-smoke.js` 에:

```js
// 활성 얼굴 있으면 두더지에 .mole-face 레이어가 붙는다
async function assertFaceLayer(page) {
  await makeFace(page);                     // 활성 얼굴 1개
  await page.evaluate(() => window.__debugStartGame('easy'));
  await page.waitForFunction(() => {
    const pops = document.querySelectorAll('#mole-pop-layer .mole-pop--mole');
    return pops.length > 0;
  }, { timeout: 8000 });
  const hasFace = await page.evaluate(() =>
    !!document.querySelector('#mole-pop-layer .mole-pop--mole .mole-face'));
  if (!hasFace) throw new Error('두더지에 .mole-face 레이어 없음');
  // 동물엔 안 붙음
  const animalHasFace = await page.evaluate(() =>
    !!document.querySelector('#mole-pop-layer .mole-pop--animal .mole-face'));
  if (animalHasFace) throw new Error('동물에 얼굴이 붙었음');
}
```

> `__debugStartGame('easy')` 시그니처는 Task 11 확정. 이 태스크에선 `__debugStartGame` 무인자로도 동작해야 하므로 game.js 배선에서 활성 얼굴을 pop-elements 에 넘기도록 먼저 처리 (Step 3).

- [ ] **Step 2: pop-elements.js 수정**

`create({ container, onEmerge, faceUrl })` 로 시그니처 확장. 내부:

```js
  function create({ container, onEmerge, faceUrl }) {
    const pops = new Map();
    let lastNow = 0;
    let face = faceUrl || null;

    function setFaceUrl(url) {
      face = url || null;
      pops.forEach((m) => {
        if (m.kind !== 'mole') return;
        if (face && !m.faceImg) attachFace(m);
        if (!face && m.faceImg) { m.faceImg.remove(); m.faceImg = null; }
        if (m.faceImg) positionFace(m);
      });
    }

    function attachFace(m) {
      const fi = document.createElement('img');
      fi.className = 'mole-face';
      fi.alt = '';
      fi.src = face;
      m.el.appendChild(fi);
      m.faceImg = fi;
    }

    function positionFace(m) {
      if (!m.faceImg) return;
      const a = MS.headAnchor(m.shownFile || ('mole' + (m.poseIndex + 1)));
      const sink = m.dying ? (m.shownDepth / GONE_DEPTH) * 130 : MS.sinkForDepth(m.shownDepth);
      m.faceImg.style.left = (a.cx * 100) + '%';
      m.faceImg.style.top = (a.cy * 100) + '%';
      m.faceImg.style.width = (a.r * 2 * 100) + '%';
      // 스프라이트와 같은 sink 이동을 따라간다 (translate 로 클립박스 기준).
      m.faceImg.style.transform = 'translate(-50%, calc(-50% + ' + sink + '%))';
    }
```

`makePop` 끝(=`render(m)` 뒤)에서: `if (face && m.kind === 'mole') { attachFace(m); positionFace(m); }`

`render(m)` 끝에서: `if (m.faceImg) positionFace(m);`

`clear()` 는 `m.el.remove()` 가 자식 `faceImg` 도 지우므로 그대로.

`return { sync, clear, flash, setFaceUrl };`

- [ ] **Step 3: style.css**

```css
.mole-face {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  aspect-ratio: 1;
  pointer-events: none;
  /* .mole-pop-img 위, 클립박스 overflow 를 함께 받는다 */
  z-index: 1;
}
```

- [ ] **Step 4: game.js — 얼굴 URL 전달**

`startRound` 안 `sharedPopElements` 생성부:

```js
    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onEmerge: (x, y, type) => { if (type === 'mole') MG.HitFx.emerge(document.getElementById('mole-board'), x, y); }
      });
    }
    sharedPopElements.clear();
    sharedPopElements.setFaceUrl(activeFaceUrl);   // ← 아래 Step 5
```

- [ ] **Step 5: game.js — 활성 얼굴 blob → objectURL**

모듈 변수 `let activeFaceUrl = null;`. 헬퍼:

```js
  function loadActiveFace() {
    var id = MG.FaceStore.getActiveId();
    if (activeFaceUrl) { URL.revokeObjectURL(activeFaceUrl); activeFaceUrl = null; }
    if (!id) return Promise.resolve(null);
    return MG.FaceStore.getFace(id).then(function (rec) {
      activeFaceUrl = rec ? URL.createObjectURL(rec.blob) : null;
      return activeFaceUrl;
    });
  }
```

`__debugStartGame` 를 얼굴 로드 후 시작하도록:

```js
    window.__debugStartGame = function (diff) {
      loadActiveFace().then(function () { startRound(1, { fresh: true }); });
    };
```

(정식 진입점 `startGame` 은 Task 11 에서 `loadActiveFace` 를 포함.)

- [ ] **Step 6: 테스트 + 스모크 + 스크린샷**

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

스크린샷: 게임 중 두더지 여러 마리에 얼굴이 얹혀 있고, 두더지가 구멍으로 내려갈 때 얼굴도 같이 내려가 클립되는지. 빠끔/모자 프레임에서 얼굴이 리마운드 rim 아래로 적절히 가려지는지. 어긋나면 `HEAD_ANCHOR` 의 peek1/peek2/helmet 값을 조정.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "feat(mole): 게임 중 두더지 머리에 사람 얼굴 실시간 합성"
```

---

### Task 10: home-screen — 카톡 더보기 스타일 다크 홈

**Files:**
- Create: `mole/js/home-screen.js`
- Modify: `mole/index.html` (`#home-screen` 내용 + script)
- Modify: `mole/style.css` (`.home-*`)
- Modify: `mole/js/i18n-strings.js`

**Interfaces:**
- Consumes: `MG.Economy.*`, `MG.FaceStore.*`, `MG.Ads.banner`, `MG.MoleSprites.headAnchor`
- Produces:
  - `MG.HomeScreen.create({ root, on })` → `{ show(), refresh() }`
    - `on` = `{ make, locker, play(difficulty), shop, daily, score, settings, help, privacy, editName }`
    - `refresh()` 는 하트/코인/최근 얼굴 썸네일/난이도 하이라이트/프로필 최고점 갱신.

- [ ] **Step 1: index.html — `#home-screen`**

```html
        <div class="board-screen home-screen" id="home-screen" hidden>
          <div class="home-topbar">
            <span class="home-more" data-i18n="mole.home.more">더보기</span>
            <span class="home-stat home-hearts" data-h-hearts><svg viewBox="0 0 24 24" class="ic"><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.4 1.2 4 2.3.6-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"/></svg><b>5</b></span>
            <span class="home-stat home-coins" data-h-coins><svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/></svg><b>0</b></span>
            <button type="button" class="home-gear" data-h-settings aria-label="설정"><svg viewBox="0 0 24 24" class="ic"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8 4l2-1.5-2-3.5-2.5 1a6 6 0 00-1.5-.9L15 5H9l-.5 2.6a6 6 0 00-1.5.9L4.5 7.5l-2 3.5L4.5 12l-2 1.5 2 3.5 2.5-1c.5.4 1 .7 1.5.9L9 19h6l.5-2.6c.5-.2 1-.5 1.5-.9l2.5 1 2-3.5L20 12z"/></svg></button>
          </div>

          <button type="button" class="home-profile" data-h-name>
            <span class="home-avatar" aria-hidden="true"></span>
            <span class="home-profile-txt">
              <b data-h-nick>두더지</b>
              <i data-h-sub></i>
            </span>
          </button>

          <div class="home-send" data-h-make>
            <div class="home-send-faces" data-h-faces></div>
            <span class="home-send-txt" data-i18n="mole.home.make">사진으로 사람두더지 만들기</span>
            <span class="home-send-btn" data-i18n="mole.home.makeBtn">만들기</span>
          </div>
          <button type="button" class="home-locker" data-h-locker>
            <span data-i18n="mole.home.locker">내 사람두더지</span>
            <span class="home-locker-thumbs" data-h-lthumbs></span>
            <span class="home-chev">›</span>
          </button>

          <div class="home-pills">
            <button type="button" class="home-pill" data-h-play="easy" data-i18n="mole.diff.easy">하수</button>
            <button type="button" class="home-pill" data-h-play="mid" data-i18n="mole.diff.mid">고수</button>
            <button type="button" class="home-pill" data-h-play="legend" data-i18n="mole.diff.legend">전설</button>
          </div>

          <div class="home-grid">
            <button type="button" data-h-nav="score"><span class="ic-wrap">📊</span><i data-i18n="mole.home.score">스코어</i></button>
            <button type="button" data-h-nav="daily"><span class="ic-wrap">📅</span><i data-i18n="mole.home.daily">일일</i></button>
            <button type="button" data-h-nav="shop"><span class="ic-wrap">🛒</span><i data-i18n="mole.home.shop">상점</i></button>
            <button type="button" data-h-nav="locker2"><span class="ic-wrap">🗂</span><i data-i18n="mole.home.photos">사진보관</i></button>
            <button type="button" data-h-nav="help"><span class="ic-wrap">📖</span><i data-i18n="mole.home.help">게임설명서</i></button>
            <button type="button" data-h-nav="privacy"><span class="ic-wrap">📜</span><i data-i18n="mole.home.privacy">개인정보·라이센스</i></button>
            <button type="button" data-h-nav="contact"><span class="ic-wrap">✉️</span><i data-i18n="mole.home.contact">문의하기</i></button>
            <button type="button" data-h-nav="settings"><span class="ic-wrap">⚙️</span><i data-i18n="mole.home.settings">설정</i></button>
          </div>

          <div class="home-ad" data-h-ad></div>
        </div>
```

> 그리드 아이콘은 임시로 이모지(안전한 옛날 것만: 📊📅🛒🗂📖📜✉️⚙️). 스모크에서 tofu 감지되면 인라인 SVG 로 교체 (별도 후속). `data-i18n-skip` 은 제거하고 실제 키 연결.

- [ ] **Step 2: i18n**

```
'mole.home.more': '더보기' / 'More',
'mole.home.make': '사진으로 사람두더지 만들기' / 'Make a face mole from a photo',
'mole.home.makeBtn': '만들기' / 'Make',
'mole.home.locker': '내 사람두더지' / 'My face moles',
'mole.diff.easy': '하수' / 'Rookie',
'mole.diff.mid': '고수' / 'Pro',
'mole.diff.legend': '전설' / 'Legend',
'mole.home.score': '스코어' / 'Scores',
'mole.home.daily': '일일' / 'Daily',
'mole.home.shop': '상점' / 'Shop',
'mole.home.photos': '사진보관' / 'Face locker',
'mole.home.help': '게임설명서' / 'How to play',
'mole.home.privacy': '개인정보·라이센스' / 'Privacy & licenses',
'mole.home.contact': '문의하기' / 'Contact',
'mole.home.settings': '설정' / 'Settings',
'mole.home.profileSub': '{d} · 최고 {n}점' / '{d} · Best {n}',
'mole.home.profileSubNone': '아직 기록 없음' / 'No record yet',
'mole.home.nickPrompt': '닉네임' / 'Nickname',
'mole.home.noHearts': '하트가 없어요' / 'Out of hearts',
'mole.home.needFace': '먼저 사람두더지를 만들어주세요' / 'Make a face mole first'
```

- [ ] **Step 3: home-screen.js**

```js
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var DIFF_LABEL = { easy: 'mole.diff.easy', mid: 'mole.diff.mid', legend: 'mole.diff.legend' };

  function create(opts) {
    var el = opts.root;
    var on = opts.on;

    el.querySelector('[data-h-make]').addEventListener('click', on.make);
    el.querySelector('[data-h-locker]').addEventListener('click', on.locker);
    el.querySelector('[data-h-settings]').addEventListener('click', on.settings);
    el.querySelector('[data-h-name]').addEventListener('click', on.editName);
    el.querySelectorAll('[data-h-play]').forEach(function (b) {
      b.addEventListener('click', function () { on.play(b.getAttribute('data-h-play')); });
    });
    var NAV = { score: on.score, daily: on.daily, shop: on.shop, locker2: on.locker,
               help: on.help, privacy: on.privacy, contact: on.contact, settings: on.settings };
    el.querySelectorAll('[data-h-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var fn = NAV[b.getAttribute('data-h-nav')];
        if (fn) fn();
      });
    });

    var faceUrls = [];
    function revokeFaces() { faceUrls.forEach(URL.revokeObjectURL); faceUrls = []; }

    function refresh() {
      el.querySelector('[data-h-hearts] b').textContent = String(MG.Economy.getHearts());
      el.querySelector('[data-h-coins] b').textContent = MG.Economy.getCoins().toLocaleString();

      var nick = localStorage.getItem('mole.nick') || T('mole.diff.easy');
      el.querySelector('[data-h-nick]').textContent = localStorage.getItem('mole.nick') || '두더지';
      var diff = localStorage.getItem('mole.difficulty') || 'easy';
      var best = parseInt(localStorage.getItem('mole.best.' + diff), 10) || 0;
      el.querySelector('[data-h-sub]').textContent = best > 0
        ? T('mole.home.profileSub', { d: T(DIFF_LABEL[diff]), n: best.toLocaleString() })
        : T('mole.home.profileSubNone');

      el.querySelectorAll('[data-h-play]').forEach(function (b) {
        b.classList.toggle('home-pill--on', b.getAttribute('data-h-play') === diff);
      });

      MG.Ads.banner(el.querySelector('[data-h-ad]'));

      revokeFaces();
      MG.FaceStore.listFaces().then(function (faces) {
        var a = MG.MoleSprites.headAnchor('mole1');
        var box = el.querySelector('[data-h-faces]');
        var strip = el.querySelector('[data-h-lthumbs]');
        box.innerHTML = ''; strip.innerHTML = '';
        faces.slice(0, 4).forEach(function (f) {
          var url = URL.createObjectURL(f.blob); faceUrls.push(url);
          box.appendChild(miniMole(url, a));
          strip.appendChild(miniMole(url, a));
        });
      });
    }

    function miniMole(url, a) {
      var d = document.createElement('span');
      d.className = 'home-mini-mole';
      d.innerHTML = '<img class="home-mini-body" src="assets/moles/mole1.png" alt="">' +
                    '<img class="home-mini-face" alt="">';
      var face = d.querySelector('.home-mini-face');
      face.src = url;
      face.style.left = (a.cx * 100) + '%';
      face.style.top = (a.cy * 100) + '%';
      face.style.width = (a.r * 2 * 100) + '%';
      return d;
    }

    return { show: refresh, refresh: refresh };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HomeScreen = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css — `.home-*`** (다크. 모든 색 명시 — 뷰어 강제다크 회피 목적이라 라이트 대비 블록 불필요, 단색 커밋)

```css
.home-screen { background: #0b0b0d; color: #e8e8ea; gap: 0; padding-bottom: 8px; }
.home-topbar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #17171b; }
.home-more { font-weight: 800; font-size: 0.95rem; }
.home-stat { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; font-size: 0.82rem; color: #cfcfd4; }
.home-stat + .home-stat { margin-left: 6px; }
.home-stat .ic { width: 15px; height: 15px; fill: #e05a6e; }
.home-coins .ic { fill: #f2c14e; }
.home-gear { background: none; border: none; padding: 0; cursor: pointer; }
.home-gear .ic { width: 19px; height: 19px; fill: #b8b8be; }

.home-profile { display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 14px;
  background: none; border: none; color: inherit; text-align: left; cursor: pointer; border-bottom: 1px solid #17171b; }
.home-avatar { width: 40px; height: 40px; border-radius: 14px; background: #2a2b33 url('assets/moles/mole1.png') center/150% no-repeat; }
.home-profile-txt b { display: block; font-size: 0.95rem; }
.home-profile-txt i { font-style: normal; font-size: 0.78rem; color: #8a8a92; }

.home-send { position: relative; display: flex; align-items: center; gap: 8px; margin: 12px 14px 8px;
  padding: 12px 12px; background: #16171d; border-radius: 12px; cursor: pointer; }
.home-send-faces { display: flex; }
.home-send-txt { flex: 1; font-size: 0.86rem; }
.home-send-btn { padding: 6px 14px; border-radius: 8px; background: linear-gradient(180deg,#57d977,#2fb457);
  color: #fff; font-weight: 800; font-size: 0.82rem; }

.home-locker { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 16px 14px;
  background: none; border: none; color: #c8c8ce; font-size: 0.82rem; cursor: pointer; border-bottom: 1px solid #17171b; }
.home-locker-thumbs { display: flex; margin-left: auto; }
.home-chev { color: #6d6d76; }

.home-mini-mole, .home-locker-thumbs .home-mini-mole { position: relative; width: 26px; aspect-ratio: 470/548; margin-left: -4px; }
.home-mini-body { position: absolute; inset: 0; width: 100%; }
.home-mini-face { position: absolute; transform: translate(-50%,-50%); border-radius: 50%; aspect-ratio: 1; }

.home-pills { display: flex; gap: 8px; padding: 14px; }
.home-pill { flex: 1; padding: 12px 0; border: none; border-radius: 10px; background: #1c1d24;
  color: #b8b8c0; font-weight: 800; font-size: 0.9rem; cursor: pointer; }
.home-pill--on { background: linear-gradient(180deg,#3ac06a,#2a9c54); color: #fff; }

.home-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 0; padding: 6px 6px 10px; }
.home-grid button { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 2px;
  background: none; border: none; color: #cfcfd4; font-size: 0.7rem; cursor: pointer; }
.home-grid .ic-wrap { font-size: 1.3rem; line-height: 1; }
.home-grid i { font-style: normal; text-align: center; }

.home-ad { margin: auto 14px 4px; }
```

- [ ] **Step 5: game.js — HomeScreen 인스턴스 (임시 배선, Task 11 에서 완성)**

```js
    homeScreen = MG.HomeScreen.create({
      root: document.getElementById('home-screen'),
      on: {
        make: function () { screenNav.show('face-maker'); faceMaker.open({}); },
        locker: function () { screenNav.show('face-locker'); faceLocker.show(); },
        play: function (diff) { startGame(diff); },
        shop: function () { screenNav.show('shop'); },
        daily: function () { screenNav.show('daily'); },
        score: function () { screenNav.show('score-screen'); },
        help: function () { screenNav.show('help-screen'); },
        privacy: function () { screenNav.show('privacy-screen'); },
        contact: function () { location.href = 'mailto:mrkyp@hanmail.net'; },
        settings: function () { if (window.FGH.SettingsUI) window.FGH.SettingsUI.open && window.FGH.SettingsUI.open(); },
        editName: function () {
          var n = prompt(root.FGH.I18N.t('mole.home.nickPrompt'), localStorage.getItem('mole.nick') || '');
          if (n != null) { localStorage.setItem('mole.nick', n.trim().slice(0, 12)); homeScreen.refresh(); }
        }
      }
    });
```

`let homeScreen = null;` + script 로드 `<script src="js/home-screen.js"></script>`.

> `startGame` 은 Task 11. 이 태스크에서 임시 `function startGame(diff){ localStorage.setItem('mole.difficulty', diff||'easy'); window.__debugStartGame(); }`.

- [ ] **Step 6: 스모크 + 스크린샷 + 커밋**

스모크: `#home-screen` 표시 상태에서 `[data-h-hearts] b` 텍스트가 숫자, `.home-pill` 3개, `.home-grid button` 8개. tofu 체크 — `.ic-wrap` 이 □ 로 렌더되면 로그.

스크린샷: 홈 전체. 다크. 카톡 더보기 느낌.

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
git add -A && git commit -m "feat(mole): 카톡 더보기 스타일 다크 홈화면"
```

---

### Task 11: game.js — 진입 오케스트레이션 + 난이도

**Files:**
- Modify: `mole/js/game.js`
- Modify: `mole/style.css` (`.diff-*` hot-glow 무력화)
- Modify: `mole/scripts/verify-mole-smoke.js`

**Interfaces:**
- Consumes: `MG.Economy`, `MG.FaceStore`, `MG.FaceMaker`, `MG.Ads`, home/locker/screenNav 인스턴스
- Produces:
  - `startGame(difficulty)` — 하트 1 소모(0 이면 모달 후 중단) → 활성 얼굴 로드 → 활성 얼굴 없으면 메이커로 유도 → `mole.difficulty` 저장 → `#game-screen` 에 `diff-<x>` 클래스 → `startRound(1, {fresh:true})` (`spawn-scheduler` 에 `obstacles: difficulty === 'legend'`)
  - `currentDifficulty()` → `'easy'|'mid'|'legend'` (localStorage, 기본 easy)
  - `bestFor(diff)` → number (`mole.best.<diff>`)
  - 온보딩: `mole.onboarded` 없으면 첫 진입에서 메이커 강제 → 저장 후 `startGame('easy')` 이되 **하트 소모 없음**
  - 결과: `finishFromRound` 가 `MG.Economy.addCoins(floor(total/200))` + `mole.best.<diff>` 갱신
  - 디버그: `__debugStartGame(diff)` (무인자=easy), `__debugSetHearts(n)`, `__debugSetCoins(n)`, `__debugAddFace()`, `__debugSkipOnboarding()`, `__debugShowHome()`

- [ ] **Step 1: 스모크 어서션 먼저**

```js
// 난이도 클래스 + hot-glow
async function assertDifficulty(page) {
  await makeFace(page);
  await page.evaluate(() => window.__debugSkipOnboarding());
  await page.evaluate(() => { window.__debugSetHearts(5); });

  await page.evaluate(() => window.__debugStartGame('easy'));
  let cls = await page.evaluate(() => document.getElementById('game-screen').className);
  if (!/diff-easy/.test(cls)) throw new Error('diff-easy 클래스 없음');
  // 하수: hot-glow 살아있음 (CSS 규칙이 .lane-button--hot 를 죽이지 않음)

  await page.evaluate(() => window.__debugShowHome());
  await page.evaluate(() => window.__debugStartGame('legend'));
  cls = await page.evaluate(() => document.getElementById('game-screen').className);
  if (!/diff-legend/.test(cls)) throw new Error('diff-legend 클래스 없음');
  // 전설: 동물 스폰됨
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('#mole-pop-layer .mole-pop'))
      .some((p) => p.className.indexOf('mole-pop--animal') > -1 || p.className.indexOf('mole-pop--bomb') > -1),
    { timeout: 12000 });
}

// 하트 소모 + 0 에서 막힘
async function assertHearts(page) {
  await page.evaluate(() => { window.__debugSkipOnboarding(); window.__debugAddFace(); window.__debugSetHearts(1); });
  await page.evaluate(() => window.__debugShowHome());
  const before = await page.evaluate(() => window.MoleGame.Economy.getHearts());
  await page.evaluate(() => document.querySelector('[data-h-play="easy"]').click());
  await page.waitForFunction(() => !document.getElementById('game-screen').classList.contains('is-start'));
  const after = await page.evaluate(() => window.MoleGame.Economy.getHearts());
  if (after !== before - 1) throw new Error('하트 1 안 깎임: ' + before + '→' + after);
}

// best 마이그레이션
async function assertMigration(page) {
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('moleBestScore', '4321'); });
  await page.reload({ waitUntil: 'networkidle0' });
  const migrated = await page.evaluate(() => localStorage.getItem('mole.best.easy'));
  if (migrated !== '4321') throw new Error('moleBestScore → mole.best.easy 마이그레이션 실패');
}
```

- [ ] **Step 2: game.js — 난이도 헬퍼**

```js
  var DIFFS = ['easy', 'mid', 'legend'];
  function currentDifficulty() {
    var d = localStorage.getItem('mole.difficulty');
    return DIFFS.indexOf(d) > -1 ? d : 'easy';
  }
  function bestFor(diff) {
    var v = parseInt(localStorage.getItem('mole.best.' + diff), 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBestFor(diff, score) {
    localStorage.setItem('mole.best.' + diff, String(score));
  }
  // 구 단일 키 마이그레이션 (1회)
  function migrateBest() {
    var old = localStorage.getItem('moleBestScore');
    if (old != null && localStorage.getItem('mole.best.easy') == null) {
      localStorage.setItem('mole.best.easy', old);
      localStorage.removeItem('moleBestScore');
    }
  }
```

`loadBest`/`saveBest` (구 `BEST_KEY`) 는 제거하고 `bestFor(currentDifficulty())` / `saveBestFor` 로 대체. `retriggerBestSms` 의 `bestFor` 임시 정의도 진짜로 교체.

- [ ] **Step 3: game.js — startGame + 온보딩**

```js
  function startGame(difficulty) {
    var diff = DIFFS.indexOf(difficulty) > -1 ? difficulty : 'easy';

    // 온보딩: 첫 실행이면 메이커 강제 → 저장 후 하트 소모 없이 하수 시작
    if (!localStorage.getItem('mole.onboarded')) {
      screenNav.show('face-maker');
      faceMaker.open({ forced: true });
      // onDone 콜백(아래 배선)이 mole.onboarded 세팅 + startGame('easy', {free:true}) 호출
      pendingOnboardStart = true;
      return;
    }

    if (!MG.FaceStore.getActiveId()) {
      alert(I18N.t('mole.home.needFace'));
      screenNav.show('face-maker'); faceMaker.open({});
      return;
    }

    if (!MG.Economy.spendHeart()) {
      showNoHeartModal();
      return;
    }

    localStorage.setItem('mole.difficulty', diff);
    var gs = document.getElementById('game-screen');
    DIFFS.forEach(function (d) { gs.classList.remove('diff-' + d); });
    gs.classList.add('diff-' + diff);

    loadActiveFace().then(function () {
      currentDiff = diff;
      startRound(1, { fresh: true });
    });
  }
```

모듈 변수: `let currentDiff = 'easy'; let pendingOnboardStart = false;`

`startRound` 안 scheduler 생성에 obstacles 추가:

```js
    const config = {
      maxConcurrentMoles: levelData.maxConcurrentMoles,
      maxConcurrentAnimals: levelData.maxConcurrentAnimals,
      maxConcurrentBombs: levelData.maxConcurrentBombs,
      popDuration: levelData.moleDuration,
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: currentDiff === 'legend'
    };
```

- [ ] **Step 4: game.js — 하트 없음 모달**

```js
  function showNoHeartModal() {
    var v = document.createElement('div');
    v.className = 'ad-overlay';
    v.innerHTML = '<div class="ad-overlay-card">' +
      '<div class="nh-title">' + I18N.t('mole.home.noHearts') + '</div>' +
      '<div class="nh-btns">' +
        '<button type="button" data-nh="ad">' + I18N.t('mole.shop.watchHeart') + '</button>' +
        '<button type="button" data-nh="shop">' + I18N.t('mole.home.shop') + '</button>' +
        '<button type="button" data-nh="close">' + I18N.t('mole.common.close') + '</button>' +
      '</div></div>';
    document.body.appendChild(v);
    v.querySelector('[data-nh="ad"]').addEventListener('click', function () {
      v.remove();
      MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); homeScreen.refresh(); } });
    });
    v.querySelector('[data-nh="shop"]').addEventListener('click', function () { v.remove(); screenNav.show('shop'); if (shop) shop.show(); });
    v.querySelector('[data-nh="close"]').addEventListener('click', function () { v.remove(); });
  }
```

i18n 키: `mole.shop.watchHeart` = '광고 보고 하트 +1' / 'Watch ad for +1 heart', `mole.common.close` = '닫기' / 'Close'.

- [ ] **Step 5: game.js — 결과 화면 코인/베스트**

`finishFromRound(reason)` 수정:

```js
  function finishFromRound(reason) {
    var total = run.combo.score;
    var diff = currentDiff;
    var best = bestFor(diff);
    var isNewBest = total > best;
    if (isNewBest) saveBestFor(diff, total);

    var coins = Math.floor(total / 200);
    if (coins > 0) MG.Economy.addCoins(coins);

    try {
      localStorage.setItem('mole.lastPlayed', String(Date.now()));
      localStorage.setItem('mole.lastWasBest', isNewBest ? '1' : '0');
      localStorage.setItem('mole.lastWasBad', reason === 'lives' ? '1' : '0');
      var hist = JSON.parse(localStorage.getItem('mole.history') || '[]');
      hist.push({ t: Date.now(), score: total, best: isNewBest, reason: reason, diff: diff });
      if (hist.length > 500) hist.splice(0, hist.length - 500);
      localStorage.setItem('mole.history', JSON.stringify(hist));
    } catch (e) {}

    document.getElementById('gameover-reason').textContent =
      I18N.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.allClear');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.score', { n: total.toLocaleString() });
    var line = isNewBest
      ? I18N.t('mole.result.newBest', { n: total.toLocaleString() })
      : I18N.t('mole.result.best', { n: Math.max(best, total).toLocaleString() });
    if (coins > 0) line += '   +' + coins + '🪙';
    document.getElementById('gameover-best').textContent = line;
    document.getElementById('gameover-overlay').hidden = false;
  }
```

- [ ] **Step 6: game.js — DOMContentLoaded 배선 완성**

```js
    migrateBest();

    // 메이커 onDone: 온보딩 첫 저장이면 바로 하수 시작(하트 무료)
    faceMaker = MG.FaceMaker.create({
      root: document.getElementById('face-maker'),
      onDone: function (id) {
        if (pendingOnboardStart || !localStorage.getItem('mole.onboarded')) {
          localStorage.setItem('mole.onboarded', '1');
          pendingOnboardStart = false;
          screenNav.show('home-screen');
          currentDiff = 'easy';
          localStorage.setItem('mole.difficulty', 'easy');
          var gs = document.getElementById('game-screen');
          DIFFS.forEach(function (d) { gs.classList.remove('diff-' + d); });
          gs.classList.add('diff-easy');
          loadActiveFace().then(function () { startRound(1, { fresh: true }); });
        } else {
          screenNav.back();
          homeScreen.refresh();
        }
      },
      onCancel: function () { screenNav.back(); }
    });

    // ... faceLocker, homeScreen, shop, daily 인스턴스 생성 (Task 8/10/12/13) ...

    // 첫 진입: 온보딩 여부에 따라
    if (!localStorage.getItem('mole.onboarded')) {
      document.getElementById('game-screen').classList.add('is-start');
      screenNav.show('face-maker');
      faceMaker.open({ forced: true });
      pendingOnboardStart = true;
    } else {
      showHome();
    }
```

`gameover-retry-btn` → `startGame(currentDifficulty())`. `gameover-select-btn` → `showHome()`.

- [ ] **Step 7: game.js — 디버그 훅**

```js
    window.__debugStartGame = function (diff) {
      localStorage.setItem('mole.onboarded', '1');
      loadActiveFace().then(function () {
        currentDiff = (['easy','mid','legend'].indexOf(diff) > -1) ? diff : 'easy';
        localStorage.setItem('mole.difficulty', currentDiff);
        var gs = document.getElementById('game-screen');
        ['easy','mid','legend'].forEach(function (d) { gs.classList.remove('diff-' + d); });
        gs.classList.add('diff-' + currentDiff);
        startRound(1, { fresh: true });
      });
    };
    window.__debugShowHome = function () { showHome(); };
    window.__debugSetHearts = function (n) {
      localStorage.setItem('mole.hearts', String(n));
      localStorage.setItem('mole.heartsAt', String(Date.now()));
      if (homeScreen) homeScreen.refresh();
    };
    window.__debugSetCoins = function (n) { localStorage.setItem('mole.coins', String(n)); if (homeScreen) homeScreen.refresh(); };
    window.__debugAddFace = function () {
      // 1x1 투명 PNG blob
      return fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
        .then(function (r) { return r.blob(); })
        .then(function (b) { return MG.FaceStore.saveFace(b, '테스트'); })
        .then(function (id) { MG.FaceStore.setActive(id); if (homeScreen) homeScreen.refresh(); return id; });
    };
    window.__debugSkipOnboarding = function () { localStorage.setItem('mole.onboarded', '1'); };
```

기존 유지: `__debugStartRound`, `__debugEndRound`, `__debugForceGameOver`, `__debugHitCell`, `__debugPumpCombo`, `__debugIntroActive`, `__debugHittableMoleRegion`. 삭제: `__debugSetVisits`, `__debugResetIntro` (Task 6 에서 이미).

- [ ] **Step 8: style.css — 난이도 hot-glow**

```css
/* 고수·전설: 버튼 불(어느 구멍에 두더지 있는지) 끔 — 판을 봐야 함 */
#game-screen.diff-mid .lane-button--hot,
#game-screen.diff-legend .lane-button--hot {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}
#game-screen.diff-mid .lane-button--call.lane-button--hot,
#game-screen.diff-legend .lane-button--call.lane-button--hot {
  background: #2ecc57;
  box-shadow: none;
}
```

- [ ] **Step 9: 전체 테스트 + 스모크**

```bash
node mole/scripts/run-all-tests.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

Expected: green. 새 어서션(difficulty/hearts/migration) 통과.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(mole): 진입 오케스트레이션 — 하트 소모·난이도·온보딩·코인·베스트 마이그레이션"
```

---

### Task 12: shop — 상점 화면

**Files:**
- Create: `mole/js/shop.js`
- Modify: `mole/index.html`, `mole/style.css`, `mole/js/i18n-strings.js`, `mole/js/game.js` (배선)

**Interfaces:**
- Consumes: `MG.Economy.*`, `MG.Ads.rewarded`
- Produces: `MG.Shop.create({ root, onClose, onChange })` → `{ show() }`
  - 항목: 하트 +1(100코인) / 하트 가득(400코인) / 광고 보고 하트 +1 / 광고 보고 코인 +50 / 망치 스킨 기본·금색(`localStorage['mole.hammerSkin']`)
  - 구매·시청 후 `onChange()` (홈 refresh 용)

- [ ] **Step 1: index.html — `#shop`**

```html
        <div class="board-screen shop" id="shop" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-shop-close aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.home.shop">상점</span>
            <span class="shop-bal" data-shop-bal></span>
          </div>
          <div class="shop-list" data-shop-list></div>
        </div>
```

- [ ] **Step 2: i18n**

```
'mole.shop.heart1': '하트 +1' / '+1 heart',
'mole.shop.heartFull': '하트 가득 채우기' / 'Refill hearts',
'mole.shop.watchHeart': '광고 보고 하트 +1' / 'Watch ad: +1 heart',
'mole.shop.watchCoin': '광고 보고 코인 +50' / 'Watch ad: +50 coins',
'mole.shop.skin': '망치 스킨' / 'Hammer skin',
'mole.shop.skinBasic': '기본' / 'Basic',
'mole.shop.skinGold': '금색' / 'Gold',
'mole.shop.own': '보유' / 'Owned',
'mole.shop.buy': '구매' / 'Buy',
'mole.shop.equip': '장착' / 'Equip',
'mole.shop.equipped': '장착됨' / 'Equipped',
'mole.shop.noCoin': '코인이 부족해요' / 'Not enough coins',
'mole.shop.bal': '🪙 {n}' / '🪙 {n}'
```

- [ ] **Step 3: shop.js**

```js
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var GOLD_KEY = 'mole.skinGoldOwned';
  var SKIN_KEY = 'mole.hammerSkin';
  var GOLD_PRICE = 300;

  function create(opts) {
    var el = opts.root;
    var list = el.querySelector('[data-shop-list]');
    el.querySelector('[data-shop-close]').addEventListener('click', opts.onClose);

    function row(label, btnLabel, disabled, onClick) {
      var d = document.createElement('div');
      d.className = 'shop-row';
      d.innerHTML = '<span>' + label + '</span><button type="button"' + (disabled ? ' disabled' : '') + '>' + btnLabel + '</button>';
      d.querySelector('button').addEventListener('click', onClick);
      list.appendChild(d);
    }

    function show() {
      el.querySelector('[data-shop-bal]').textContent = T('mole.shop.bal', { n: MG.Economy.getCoins().toLocaleString() });
      list.innerHTML = '';
      row(T('mole.shop.heart1') + ' (100🪙)', T('mole.shop.buy'), MG.Economy.getCoins() < 100, function () {
        if (MG.Economy.spendCoins(100)) { MG.Economy.addHearts(1); done(); } else alert(T('mole.shop.noCoin'));
      });
      row(T('mole.shop.heartFull') + ' (400🪙)', T('mole.shop.buy'), MG.Economy.getCoins() < 400, function () {
        if (MG.Economy.spendCoins(400)) { MG.Economy.addHearts(MG.Economy.HEART_MAX); done(); } else alert(T('mole.shop.noCoin'));
      });
      row(T('mole.shop.watchHeart'), '▶', false, function () {
        MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); done(); } });
      });
      row(T('mole.shop.watchCoin'), '▶', false, function () {
        MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addCoins(50); done(); } });
      });

      var goldOwned = localStorage.getItem(GOLD_KEY) === '1';
      var skin = localStorage.getItem(SKIN_KEY) || 'basic';
      row(T('mole.shop.skin') + ': ' + T('mole.shop.skinBasic'),
          skin === 'basic' ? T('mole.shop.equipped') : T('mole.shop.equip'),
          skin === 'basic', function () { localStorage.setItem(SKIN_KEY, 'basic'); done(); });
      if (goldOwned) {
        row(T('mole.shop.skin') + ': ' + T('mole.shop.skinGold'),
            skin === 'gold' ? T('mole.shop.equipped') : T('mole.shop.equip'),
            skin === 'gold', function () { localStorage.setItem(SKIN_KEY, 'gold'); done(); });
      } else {
        row(T('mole.shop.skin') + ': ' + T('mole.shop.skinGold') + ' (' + GOLD_PRICE + '🪙)',
            T('mole.shop.buy'), MG.Economy.getCoins() < GOLD_PRICE, function () {
          if (MG.Economy.spendCoins(GOLD_PRICE)) { localStorage.setItem(GOLD_KEY, '1'); localStorage.setItem(SKIN_KEY, 'gold'); done(); }
          else alert(T('mole.shop.noCoin'));
        });
      }
    }
    function done() { show(); if (opts.onChange) opts.onChange(); }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Shop = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css**

```css
.shop-bal { margin-left: auto; font-size: 0.85rem; color: #f2c14e; }
.shop-list { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.shop-row { display: flex; align-items: center; gap: 8px; padding: 12px; background: #16171c; border-radius: 10px; font-size: 0.85rem; }
.shop-row span { flex: 1; }
.shop-row button { padding: 6px 14px; border: none; border-radius: 8px; background: #2fb457; color: #fff; font-weight: 800; cursor: pointer; }
.shop-row button:disabled { background: #33343e; color: #77787f; cursor: default; }
```

- [ ] **Step 5: game.js 배선**

```js
    shop = MG.Shop.create({
      root: document.getElementById('shop'),
      onClose: function () { screenNav.back(); },
      onChange: function () { if (homeScreen) homeScreen.refresh(); }
    });
```

`let shop = null;` + `on.shop` 콜백을 `function () { screenNav.show('shop'); shop.show(); }` 로. script 로드 추가.

> 망치 스킨 실제 적용(gold 틴트 스프라이트)은 이 태스크 범위 밖 — `SKIN_KEY` 저장만. `lane-hammer.create({ sprite })` 연결은 후속(스펙 §7, Phase 1 "플레이스홀더"). 여기선 skin 값만 관리.

- [ ] **Step 6: 스모크(간단) + 커밋**

스모크: `__debugSetCoins(500)` → `#shop` 열기 → 하트+1 버튼 클릭 → `Economy.getHearts()` 증가, `getCoins()` 100 감소.

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
git add -A && git commit -m "feat(mole): 상점 화면 (하트·코인 교환, 망치 스킨)"
```

---

### Task 13: daily — 7일 출석

**Files:**
- Create: `mole/js/daily.js`
- Modify: `mole/index.html`, `mole/style.css`, `mole/js/i18n-strings.js`, `mole/js/game.js`

**Interfaces:**
- Consumes: `MG.Economy.addCoins`, `MG.Ads.rewarded`
- Produces:
  - `MG.Daily.create({ root, onClose, onChange })` → `{ show(), claimableToday() }`
  - `localStorage['mole.daily']` = `{ streak, lastClaim: 'YYYY-MM-DD' }`
  - 보상 배열 `[20, 30, 40, 50, 60, 80, 100]` (streak 1..7, 7 이후 7일차 반복)

- [ ] **Step 1: index.html — `#daily`**

```html
        <div class="board-screen daily" id="daily" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-daily-close aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.home.daily">일일 출석</span>
          </div>
          <div class="daily-grid" data-daily-grid></div>
          <button type="button" class="daily-claim" data-daily-claim></button>
          <button type="button" class="daily-2x" data-daily-2x data-i18n="mole.daily.double">광고 보고 2배</button>
        </div>
```

- [ ] **Step 2: i18n**

```
'mole.daily.day': '{n}일차' / 'Day {n}',
'mole.daily.claim': '오늘 보상 받기 (+{n}🪙)' / 'Claim today (+{n}🪙)',
'mole.daily.claimed': '오늘은 받았어요' / 'Claimed today',
'mole.daily.double': '광고 보고 2배' / 'Watch ad to double',
'mole.daily.gotDouble': '2배 지급 완료!' / 'Doubled!'
```

- [ ] **Step 3: daily.js**

```js
(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var REWARDS = [20, 30, 40, 50, 60, 80, 100];
  var KEY = 'mole.daily';

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function yesterday() {
    var d = new Date(Date.now() - 86400000);
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { streak: 0, lastClaim: '' }; }
    catch (e) { return { streak: 0, lastClaim: '' }; }
  }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function create(opts) {
    var el = opts.root;
    var grid = el.querySelector('[data-daily-grid]');
    var claimBtn = el.querySelector('[data-daily-claim]');
    var dblBtn = el.querySelector('[data-daily-2x]');
    el.querySelector('[data-daily-close]').addEventListener('click', opts.onClose);

    function claimableToday() { return read().lastClaim !== today(); }

    function nextStreak() {
      var s = read();
      if (s.lastClaim === yesterday()) return Math.min(7, s.streak + 1);
      if (s.lastClaim === today()) return s.streak;
      return 1;
    }

    function show() {
      var s = read();
      var ns = nextStreak();
      grid.innerHTML = '';
      for (var i = 1; i <= 7; i++) {
        var cell = document.createElement('div');
        cell.className = 'daily-cell' +
          (i < ns || (i === ns && !claimableToday()) ? ' daily-cell--done' : '') +
          (i === ns && claimableToday() ? ' daily-cell--today' : '');
        cell.innerHTML = '<i>' + T('mole.daily.day', { n: i }) + '</i><b>' + REWARDS[i - 1] + '🪙</b>';
        grid.appendChild(cell);
      }
      if (claimableToday()) {
        claimBtn.disabled = false;
        claimBtn.textContent = T('mole.daily.claim', { n: REWARDS[ns - 1] });
        dblBtn.hidden = true;
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = T('mole.daily.claimed');
        dblBtn.hidden = (localStorage.getItem('mole.dailyDoubled') === today());
      }
    }

    claimBtn.addEventListener('click', function () {
      if (!claimableToday()) return;
      var ns = nextStreak();
      MG.Economy.addCoins(REWARDS[ns - 1]);
      write({ streak: ns, lastClaim: today() });
      show();
      if (opts.onChange) opts.onChange();
    });
    dblBtn.addEventListener('click', function () {
      var ns = read().streak;
      MG.Ads.rewarded().then(function (ok) {
        if (!ok) return;
        MG.Economy.addCoins(REWARDS[Math.max(0, ns - 1)]);
        localStorage.setItem('mole.dailyDoubled', today());
        show();
        if (opts.onChange) opts.onChange();
      });
    });

    return { show: show, claimableToday: claimableToday };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Daily = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css**

```css
.daily-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 14px; }
.daily-cell { background: #16171c; border-radius: 10px; padding: 12px 4px; text-align: center; border: 2px solid transparent; }
.daily-cell i { display: block; font-style: normal; font-size: 0.7rem; color: #9a9aa2; }
.daily-cell b { font-size: 0.85rem; }
.daily-cell--done { opacity: 0.45; }
.daily-cell--today { border-color: #f2c14e; }
.daily-claim { margin: 6px 14px; padding: 12px; border: none; border-radius: 10px;
  background: linear-gradient(180deg,#57d977,#2fb457); color: #fff; font-weight: 800; cursor: pointer; }
.daily-claim:disabled { background: #33343e; color: #77787f; }
.daily-2x { margin: 0 14px 12px; padding: 10px; border: none; border-radius: 10px; background: #2a2b33; color: #d8d8de; cursor: pointer; }
```

- [ ] **Step 5: game.js 배선 + 스모크 + 커밋**

```js
    daily = MG.Daily.create({
      root: document.getElementById('daily'),
      onClose: function () { screenNav.back(); },
      onChange: function () { if (homeScreen) homeScreen.refresh(); }
    });
```

`on.daily` → `function () { screenNav.show('daily'); daily.show(); }`.

스모크: `#daily` 열기 → `.daily-cell` 7개, claim 버튼 클릭 → 코인 증가 + streak 1.

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
git add -A && git commit -m "feat(mole): 일일 7일 출석"
```

---

### Task 14: 정적 화면 — 스코어 / 게임설명서 / 개인정보·라이센스 / 설정

**Files:**
- Create: `mole/js/score-screen.js`
- Modify: `mole/index.html` (`#score-screen`, `#help-screen`, `#privacy-screen` 내용), `mole/style.css`, `mole/js/i18n-strings.js`, `mole/js/game.js`
- Read: `mole/audio/CREDITS.txt` (개인정보·라이센스 화면 문구 근거)

**Interfaces:**
- Consumes: `localStorage['mole.history']`
- Produces:
  - `MG.ScoreScreen.create({ root, onClose })` → `{ show() }` — 난이도별 최고 + 최근 20판 리스트.
  - `#help-screen`, `#privacy-screen` 은 순수 정적 HTML (JS 없음, 뒤로가기 버튼만 game.js 가 배선).
  - 설정: 기존 `window.FGH.SettingsUI` 재사용. 없으면 간단 대체 불필요 — `SettingsUI.mount()` 가 이미 우상단에 톱니를 붙이므로, 홈의 `data-h-settings` 톱니는 `FGH.SettingsUI` 의 모달을 여는 함수를 호출. `common/settings-ui.js` 에 공개 `open()` 이 없으면 추가 (1줄: 모달 요소 `.hidden = false`).

- [ ] **Step 1: index.html — 정적 화면**

```html
        <div class="board-screen info-screen" id="help-screen" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-back="help" aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.home.help">게임설명서</span>
          </div>
          <div class="info-body">
            <p data-i18n="mole.help.p1">두더지를 망치로 때려서 점수를 얻어요. 10라운드, 각 30초.</p>
            <p data-i18n="mole.help.p2">하단 키패드의 16칸은 구멍 16개와 1:1이에요. 두더지가 있는 칸을 누르면 망치가 내려쳐요.</p>
            <p data-i18n="mole.help.p3">하수는 두더지가 있는 칸에 불이 들어와요. 고수·전설은 불이 없어요. 전설엔 동물이 섞여요 — 동물을 때리면 손해!</p>
            <p data-i18n="mole.help.p4">목숨 3개는 10라운드 전체에 적용돼요. 콤보 100마다 목숨 +1.</p>
            <p data-i18n="mole.help.p5">사람두더지: 사진으로 얼굴을 만들면 두더지 머리에 그 얼굴이 붙어요.</p>
          </div>
        </div>

        <div class="board-screen info-screen" id="privacy-screen" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-back="privacy" aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.home.privacy">개인정보·라이센스</span>
          </div>
          <div class="info-body">
            <h3 data-i18n="mole.priv.h1">사진</h3>
            <p data-i18n="mole.priv.p1">사진은 이 기기 안에서만 처리돼요. 서버에 올리지 않아요. 저장되는 것은 얼굴을 원형으로 자른 이미지 한 장뿐이고, 기기에만 저장돼요(설정 → 데이터 초기화로 삭제).</p>
            <h3 data-i18n="mole.priv.h2">라이센스·크레딧</h3>
            <p data-i18n="mole.priv.p2">타격 효과음: 효과음ラボ(soundeffect-lab.info) — 상용 무료, 크레딧 불필요. BGM: CC0.</p>
          </div>
        </div>

        <div class="board-screen" id="score-screen" hidden>
          <div class="board-screen-bar">
            <button type="button" class="bs-back" data-back="score" aria-label="뒤로">‹</button>
            <span class="bs-title" data-i18n="mole.home.score">스코어</span>
          </div>
          <div class="score-best" data-score-best></div>
          <div class="score-hist" data-score-hist></div>
        </div>
```

- [ ] **Step 2: i18n** — 위 `data-i18n` 키 전부 ko/en 등록 + `'mole.score.noHist': '아직 플레이 기록이 없어요' / 'No plays yet'`, `'mole.score.bestOf': '{d} 최고 {n}점' / '{d} best {n}'`.

- [ ] **Step 3: score-screen.js**

```js
(function (root) {
  'use strict';
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var DIFF_LABEL = { easy: 'mole.diff.easy', mid: 'mole.diff.mid', legend: 'mole.diff.legend' };

  function create(opts) {
    var el = opts.root;
    el.querySelector('[data-back="score"]').addEventListener('click', opts.onClose);
    function show() {
      var bestBox = el.querySelector('[data-score-best]');
      bestBox.innerHTML = '';
      ['easy', 'mid', 'legend'].forEach(function (d) {
        var n = parseInt(localStorage.getItem('mole.best.' + d), 10) || 0;
        var row = document.createElement('div');
        row.className = 'score-best-row';
        row.textContent = T('mole.score.bestOf', { d: T(DIFF_LABEL[d]), n: n.toLocaleString() });
        bestBox.appendChild(row);
      });
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('mole.history') || '[]'); } catch (e) {}
      var box = el.querySelector('[data-score-hist]');
      box.innerHTML = '';
      if (!hist.length) { box.innerHTML = '<p class="score-empty">' + T('mole.score.noHist') + '</p>'; return; }
      hist.slice(-20).reverse().forEach(function (h) {
        var row = document.createElement('div');
        row.className = 'score-hist-row';
        var dt = new Date(h.t);
        row.innerHTML = '<span>' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</span>' +
          '<span>' + T(DIFF_LABEL[h.diff] || 'mole.diff.easy') + '</span>' +
          '<b>' + (h.score || 0).toLocaleString() + '</b>' + (h.best ? ' <i>★</i>' : '');
        box.appendChild(row);
      });
    }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScoreScreen = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: style.css**

```css
.info-body { padding: 16px; line-height: 1.6; font-size: 0.86rem; color: #cfcfd4; }
.info-body h3 { margin: 14px 0 6px; font-size: 0.9rem; color: #e8e8ea; }
.info-body p { margin: 0 0 10px; }
.score-best { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid #17171b; }
.score-best-row { font-size: 0.86rem; color: #d8d8de; }
.score-hist { padding: 8px 16px; }
.score-hist-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #141418; font-size: 0.82rem; }
.score-hist-row b { margin-left: auto; }
.score-hist-row i { color: #f2c14e; font-style: normal; }
.score-empty { padding: 24px; text-align: center; color: #6d6d76; }
```

- [ ] **Step 5: game.js 배선**

```js
    scoreScreen = MG.ScoreScreen.create({ root: document.getElementById('score-screen'), onClose: function () { screenNav.back(); } });
    // 정적 화면 뒤로가기
    ['help', 'privacy'].forEach(function (k) {
      document.querySelector('[data-back="' + k + '"]').addEventListener('click', function () { screenNav.back(); });
    });
```

`on.score` → `function () { screenNav.show('score-screen'); scoreScreen.show(); }`.
`on.settings` → `FGH.SettingsUI` 의 모달 open (없으면 `common/settings-ui.js` 에 `open()` 추가 — 1줄 export).

- [ ] **Step 6: 스모크 + 커밋**

스모크: 홈 그리드에서 help/privacy/score 각각 열려서 `.info-body`/`.score-*` 표시. `data-i18n` 미치환(원문 그대로 남은 키) 없는지.

```bash
node mole/scripts/run-all-tests.js && SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
git add -A && git commit -m "feat(mole): 스코어·게임설명서·개인정보·설정 화면"
```

---

### Task 15: sw.js / manifest.json / i18n 정리 + 스모크 전면 개편

**Files:**
- Modify: `mole/sw.js`, `mole/manifest.json`, `mole/js/i18n-strings.js`
- Modify: `mole/scripts/verify-mole-smoke.js` (전면 재작성)
- Modify: `mole/index.html` (`#build-tag` 버전)

**Interfaces:** 없음 (마감 정리)

- [ ] **Step 1: sw.js**

- `CACHE` 를 현재 값에서 +1 (`grep "const CACHE" mole/sw.js` 로 현재 확인 후).
- SHELL 에서 `./assets/avatar-mole.png`, `./assets/avatar-hippo.png` 제거.
- SHELL 에 추가: `./js/screen-nav.js`, `./js/economy.js`, `./js/face-store.js`, `./js/ads.js`, `./js/face-maker.js`, `./js/face-locker.js`, `./js/home-screen.js`, `./js/shop.js`, `./js/daily.js`, `./js/score-screen.js`.
- `#build-tag` 와 sw `CACHE` 를 같은 숫자로 bump (기존 관례).

- [ ] **Step 2: manifest.json**

```json
{
  "name": "두더지 게임",
  "short_name": "두더지",
  "description": "사진으로 만드는 사람두더지 잡기 게임",
  "start_url": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0b0b0d",
  "theme_color": "#0b0b0d",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`index.html` `<meta name="theme-color" content="#0b0b0d">` 로 맞춤. `<title>` 은 `data-i18n="mole.title"` 그대로.

- [ ] **Step 3: i18n 정리**

`mole.start.tag` 키가 이제 안 쓰이면(고아) 데이터만 남겨두거나 제거 — 검색 후 판단. `mole.mode` 도 사용처 확인. 새로 추가한 키들이 ko/en 양쪽에 다 있는지 확인 (`node -e` 로 두 객체 키 diff).

- [ ] **Step 4: verify-mole-smoke.js 전면 재작성**

최종 스모크가 검증할 것 (스펙 §12):
1. 홈: 하트/코인 표시, 3 pill, 그리드 8칸
2. 온보딩: `localStorage.clear()` + reload → 첫 화면이 `#face-maker` (forced, 취소버튼 hidden) → makeFace → `#game-screen` is-start 해제(게임 시작), 하트 5 그대로(무료)
3. 메이커: makeFace 플로우 (crop→preview→save), `FaceStore` 1건 + 활성
4. 보관함: `.fl-card` 존재, active 표시
5. 얼굴 레이어: 게임 중 `.mole-pop--mole .mole-face` 존재, `.mole-pop--animal .mole-face` 없음
6. 난이도: `diff-easy`/`diff-mid`/`diff-legend` 클래스, 전설에서 동물 스폰
7. 하트: pill 탭 → 하트 −1, 하트 0 → 모달
8. 결과: 코인 증가, `mole.best.<diff>` 저장
9. 마이그레이션: `moleBestScore` → `mole.best.easy`
10. 기존 게임 검사: 두더지 `<img>`, 16 구멍(`.mole-hole`/`.mole-hole-front` 각 16), 레인 버튼 16, 직접 터치 무효(`.mole-pop` pointer-events none), 타격 후 침몰 타이밍(`__debugHittableMoleRegion`), 일시정지(`#btn-pause` 토글 → `state.paused`)
11. tofu 감지: 홈 그리드 아이콘 `.ic-wrap` 이 □(U+FFFD 등)로 렌더되면 경고 로그(실패는 아님)

`SMOKE_PORT` env (기본 8846), 끝나면 서버 kill.

- [ ] **Step 5: 실행**

```bash
node mole/scripts/run-all-tests.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

Expected: 전부 green.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "chore(mole): sw/manifest/i18n 정리 + 스모크 전면 개편"
```

---

### Task 16: 전체 재검 (스펙 §12 전체 재검)

**Files:** 없음 (검증 전용, 필요 시 수정)

- [ ] **Step 1: 전체 테스트**

```bash
node mole/scripts/run-all-tests.js
```
Expected: 모든 `test-*.js` green (economy, face-store, spawn-scheduler, mole-sprites, grid-partition, combo-score, levels).

- [ ] **Step 2: 스모크**

```bash
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```
Expected: green.

- [ ] **Step 3: 스크린샷 (Edge headless, `scratchpad/shot.js` 스타일)**

`PORT=8846 node scripts/serve.js` (레포 루트) 후 puppeteer 로 캡처, 끝나면 kill:
- 홈화면 (다크, 카톡 더보기 느낌)
- 메이커 3단계 (pick / crop / preview)
- 보관함 (얼굴 얹은 두더지 썸네일)
- 하수 플레이 (두더지에 얼굴, 버튼 불 O)
- 고수 플레이 (버튼 불 X)
- 전설 플레이 (동물 섞임, 동물엔 얼굴 X)
- 결과 화면 (코인 +N 표시)
- 상점 / 일일 / 스코어 / 개인정보

각 스크린샷 육안 확인:
- 얼굴이 두더지 머리에 맞는가 (전신·빠끔·모자 포즈별). 어긋나면 `HEAD_ANCHOR` 값 조정 → `mole-sprites.js` 수정 → 재커밋.
- 다크에서 색 깨짐 없나 (홈·화면 패널 전부 명시 색이므로 OK 예상).
- tofu(□) 없나.

- [ ] **Step 4: 삭제 확인**

```bash
grep -rn "chat-first\|chat-return\|RETURN_PHRASES\|avatar-hippo\|avatar-mole\|두더지 오빠\|showStartScreen" mole/ || echo "clean"
```
Expected: `clean` (또는 주석/문서 언급만).

- [ ] **Step 5: 로컬 SW 스킵 동작 확인**

`mole/index.html` 의 localhost SW 스킵 로직이 그대로인지 확인 (`grep -n "getRegistrations\|localhost" mole/index.html`).

- [ ] **Step 6: 최종 커밋 (스크린샷 조정분이 있었으면)**

```bash
git add -A
git commit -m "fix(mole): Phase 1 전체 재검 — 얼굴 앵커/색 미세 조정"
```

> 조정이 없었으면 이 커밋 생략.

---

### Task 17: 레포 분리 (⚠️ 실행 전 사용자 확인)

**스펙 §16. 파괴적 작업 — subagent-driven-development 실행자는 이 태스크 시작 전 사용자에게 "지금 snake/coloring/match 삭제하고 두더지를 루트로 올릴까요?" 확인받을 것.** 사용자가 "나중에" 라고 하면 이 태스크는 스킵하고 Phase 1 은 여기서 완료 (두더지는 계속 `mole/` 하위, 허브 링크만 끊긴 상태 — 기능상 문제 없음).

**Files:**
- Delete: `snake/`, `coloring/`, `match/`, `hub.js`, `hub.css`, `hub-strings.js`, `scripts/verify-hub-smoke.js`, `scripts/verify-snake-smoke.js`, `snake/` 테스트들
- Modify: 루트 `index.html`
- Keep: `common/`, `cosmic-theme.css`, `mole/`

- [ ] **Step 1: 아카이브 태그**

```bash
git tag archive/hub-snapshot
git log -1 archive/hub-snapshot --oneline
```

- [ ] **Step 2: 삭제**

```bash
git rm -r snake coloring match
git rm hub.js hub.css hub-strings.js
git rm scripts/verify-hub-smoke.js scripts/verify-snake-smoke.js
```

`grep -rn "snake\|coloring" scripts/ package.json` 로 남은 참조 정리.

- [ ] **Step 3: 루트 index.html — 두더지로**

기본안 = 리다이렉트 (저위험):

```html
<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=mole/">
<link rel="canonical" href="mole/"><title>두더지 게임</title>
</head><body><a href="mole/">두더지 게임</a></body></html>
```

- [ ] **Step 4: 검증**

```bash
node mole/scripts/run-all-tests.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
```

`PORT=8846 node scripts/serve.js` → `http://localhost:8846/` 가 `/mole/` 로 리다이렉트되고 홈이 뜨는지 스크린샷. 서버 kill.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore: 두더지 게임 독립 — snake/coloring/match 제거, 루트를 두더지로"
```

- [ ] **Step 6: 사용자 안내**

푸시는 사용자 요청 시. 레포/GitHub Pages URL 이름 변경은 사용자가 GitHub 웹에서 (범위 밖). 사용자 폰의 기존 PWA 캐시는 앱 재실행 2~3회로 갱신됨을 안내.

---

## Self-Review

**1. Spec coverage**

| 스펙 섹션 | 태스크 |
|---|---|
| §1 유지/삭제 | Task 6 (삭제), 전반 (유지) |
| §2 큰 그림 | Task 6·10·11 |
| §3 홈화면 | Task 10 (레이아웃), Task 11 (동작 배선), Task 14 (설정/문의) |
| §4 온보딩 | Task 11 Step 3·6 |
| §5 사람두더지 메이커 | Task 7 (플로우), Task 5 (HEAD_ANCHOR), Task 9 (실시간 합성), Task 2 (스토어), Task 8 (보관함) |
| §6 난이도 | Task 4 (obstacles), Task 11 (클래스/진입), Task 11 Step 8 (hot-glow CSS) |
| §7 하트/코인/상점 | Task 1 (economy), Task 12 (shop) |
| §8 일일 | Task 13 |
| §9 광고 스텁 | Task 3 (ads), Task 10 (배너), Task 11/12/13 (rewarded 호출) |
| §10 코드 구조 | 파일 구조 표 + 각 태스크 |
| §11 데이터 흐름 | Task 9·11 |
| §12 테스트 | Task 15 (스모크), Task 16 (재검), 각 태스크 단위 테스트 |
| §13 세부 결정 | 반영 (얼굴 원 저장, CSS 레이어, 하수=고수, 20분/개, floor(총점/200)) |
| §14 Phase 2 | 범위 밖 (ads.js 인터페이스만 준비) |
| §15 Phase 3 | 범위 밖 |
| §16 레포 분리 | Task 17 (사용자 확인 게이트) |

갭 없음. Phase 2/3 는 의도적으로 범위 밖.

**2. Placeholder scan**

- "Task 10/11 에서 채움" 류 = 의도된 태스크 간 인터페이스 참조 (screen-nav 스텁 → 실제 배선). 각 참조는 뒤 태스크에 실제 구현이 있음. OK.
- Task 5 의 `HEAD_ANCHOR` 예시 값은 "measure 스크립트 출력으로 대체" 라고 명시 — 실행자가 스크립트를 돌려 실제 값을 넣음. 스크립트 코드는 완전함. OK.
- Task 15 의 "현재 값 확인 후 +1" = `CACHE` 버전은 진행 중 계속 바뀌므로 실행 시점에 grep. OK (구체적 명령 제시).
- "구현 시 결정" 없음. "적절한 에러 처리" 없음.

**3. Type consistency**

- `MG.PopElements.create` 시그니처: Task 9 에서 `{ container, onEmerge, faceUrl }` + `setFaceUrl`. game.js(Task 9 Step 4)가 `setFaceUrl(activeFaceUrl)` 호출. 일치.
- `MG.FaceStore` 메서드명: `saveFace`/`listFaces`/`getFace`/`deleteFace`/`renameFace`/`count`/`getActiveId`/`setActive`/`clearActive` — Task 2 정의, Task 7·8·9·10·11 사용. 일치.
- `MG.Economy`: `regen`/`getHearts`/`canPlay`/`spendHeart`/`addHearts`/`nextHeartMs`/`getCoins`/`addCoins`/`spendCoins`/`HEART_MAX`/`REGEN_MS` — Task 1 정의, Task 10·11·12·13 사용. `HEART_MAX` 는 Task 12 `addHearts(MG.Economy.HEART_MAX)` 에서 참조 — Task 1 api 에 포함됨. 일치.
- `MG.MoleSprites.headAnchor` — Task 5 정의, Task 7·8·9·10 사용. 일치.
- `MG.ScreenNav.create({ screens, onShow })` → `{ show, back, current }` — Task 6 정의, 이후 전부 `screenNav.show(id)`/`screenNav.back()`. 일치.
- `startGame(difficulty)` — Task 11 정의. Task 6·10 에서 임시 스텁으로 앞서 참조(명시됨), Task 11 에서 실제 구현. `currentDifficulty()` 동일.
- `homeScreen.refresh()` — Task 10 정의(`{ show, refresh }`), Task 11·12·13 에서 호출. 일치.
- `MG.Ads.rewarded()` → `Promise<boolean>` — Task 3 정의, Task 11·12·13 에서 `.then(function(ok){...})`. 일치.
- 난이도 키: `'easy'|'mid'|'legend'` — Task 4(테스트)·11·14 전부 동일. CSS 클래스 `diff-easy/diff-mid/diff-legend` 동일.
- localStorage 키: `mole.hearts`/`mole.heartsAt`/`mole.coins`/`mole.activeFaceId`/`mole.difficulty`/`mole.best.<diff>`/`mole.onboarded`/`mole.nick`/`mole.history`/`mole.daily`/`mole.hammerSkin` — 일관.

이슈 없음.

# 허브 셸 + 공용 설정/다국어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fun-games-hub 에 색칠앱식 공용 셸(우상단 언어/설정 + 하단 탭바)을 붙이고, 허브·두더지·그림맞추기가 한 벌의 설정값(언어·소리·BGM·진동)을 공유하며, 두더지에 보스 BGM 을 추가한다.

**Architecture:** 새 `common/` 폴더에 프레임워크 없는 IIFE 모듈 3개(`settings.js`·`i18n.js`·`settings-ui.js`) + CSS 1개를 두고, 허브와 두 게임이 `<script>` 로 로드한다. 설정은 `localStorage`(색칠앱과 동일 키) 단일 소스, i18n 은 `data-i18n` 속성 + `I18N.t()`. 지렁이·색칠앱은 건드리지 않는다.

**Tech Stack:** 순수 브라우저 JS(ES2018, IIFE, `window.FGH` 네임스페이스), 인라인 SVG 아이콘, `localStorage`, `<audio>`; 테스트는 `node:assert`(로직) + `puppeteer-core` + Edge headless(스모크). 번들러 없음.

**Spec:** `docs/superpowers/specs/2026-09-02-hub-shell-settings-i18n-design.md`

## Global Constraints

- 언어는 `ko`/`en` 2개만. 지렁이 게임(`snake/`)은 이 작업에서 제외 — `common/*` 로드 금지. 색칠앱(`coloring/`)은 코드 변경 금지.
- `localStorage` 키는 색칠앱과 통일: `appLang`(`'ko'`|`'en'`), `soundOn`·`musicOn`·`vibrationOn`(각 `'1'`|`'0'`).
- 기본값: 소리 켜짐(`soundOn` 없으면 on), BGM 꺼짐(`musicOn` 없으면 off), 진동 켜짐(`vibrationOn` 없으면 on), 언어(브라우저가 `ko*` 면 `ko` 아니면 `en`).
- 모든 아이콘은 **인라인 SVG**(`currentColor`). 이모지 금지 — 사용자 기기에서 tofu(□) 로 깨진 전례가 여러 번 있음.
- 설정 UI(🌐/⚙️)는 **허브에서만** 렌더. 게임 화면엔 설정 버튼 없음 — 게임은 로드 시 값을 읽어 1회 적용.
- 다이얼러 위장 버튼 라벨(`연락처`/`키패드`/`최근기록`/`통화`/자음)은 번역 안 함 — 현행 유지.
- 의성어 번역: `톡!`→`Tap!`, `쾅!`→`Bam!`, `깡!`→`Clang!`, `시작!`→`Go!`.
- 기존 모듈 관행 준수: IIFE `(function (root) { 'use strict'; ... })(typeof window !== 'undefined' ? window : null)`, `if (typeof module !== 'undefined' && module.exports) module.exports = api;` 병행, 한국어 주석.
- 커밋은 `master` 직커밋(프로젝트 관행). `git push` 는 사용자가 명시적으로 요청할 때만.
- 커밋 메시지 말미에 항상:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
  ```

---

## File Structure

**새로 만드는 파일:**

| 경로 | 책임 |
|---|---|
| `common/settings.js` | `window.FGH.Settings` — 설정 읽기/쓰기/구독, `vibrate()`·`sfxEnabled()` 헬퍼. DOM 모름. |
| `common/i18n.js` | `window.FGH.I18N` — 문구 사전 등록·조회(`t`), `data-i18n` DOM 적용, 언어 전환. `Settings` 에 의존. |
| `common/settings-ui.js` | `window.FGH.SettingsUI.mount()` — 우상단 🌐/⚙️ 버튼 + 언어 메뉴 + 설정 모달을 `document.body` 에 주입·배선. **허브 전용.** |
| `common/settings.css` | 위 주입 UI 의 스타일. |
| `common/scripts/test-settings.js` | `settings.js` 단위 테스트. |
| `common/scripts/test-i18n.js` | `i18n.js` 단위 테스트. |
| `common/scripts/run-all-tests.js` | 두 단위 테스트 러너. |
| `common/scripts/fixture.html` | settings-ui 스모크용 최소 페이지. |
| `common/scripts/verify-settings-ui-smoke.js` | settings-ui 주입/토글/모달 스모크. |
| `hub.js` | 허브 탭 전환 + `SettingsUI.mount()` + `I18N.applyStatic()`. |
| `hub.css` | 허브 레이아웃(탭바/화면/카드) — 기존 `index.html` 인라인 `<style>` 을 여기로. |
| `hub-strings.js` | 허브 문구 ko/en 등록. |
| `scripts/verify-hub-smoke.js` | 허브 스모크(탭 전환·설정 저장·언어 전환). |
| `mole/js/i18n-strings.js` | 두더지 문구 ko/en 등록. |
| `mole/audio/bgm-boss-battle.mp3` | `coloring/audio/bgm-boss-battle.mp3` 복사본. |

**수정하는 파일:**

| 경로 | 변경 |
|---|---|
| `index.html` (허브) | 전면 재작성 — 화면 4개 + 탭바 + 스크립트 로드. 인라인 `<style>` → `hub.css`. |
| `mole/index.html` | `common/*`·`i18n-strings.js` 로드, `<audio id="bgm">`, 정적 문구에 `data-i18n`. |
| `mole/js/game.js` | 동적 문구 `I18N.t()`, BGM 재생 제어. |
| `mole/js/hud.js` | 문구 `I18N.t()`. |
| `mole/js/hit-fx.js` | `tone()` 를 `FGH.Settings.sfxEnabled()` 로 게이트, `vibrate()` → `FGH.Settings.vibrate()`, 의성어 `I18N.t()`. |
| `mole/sw.js` | `CACHE` v5→v6, `SHELL` 에 common/audio 추가. |
| `mole/scripts/verify-mole-smoke.js` | i18n·BGM·게이팅 검증 추가. |
| `match/index.html` | `common/*` 로드 + `data-i18n` + 인라인 문구 등록 + `applyStatic()`. |

---

## Task 1: 두더지 점수 어택 변경 커밋 (선행)

이번 세션에서 이미 구현·검증됐으나 uncommitted 상태인 두더지 점수 어택 전환을 독립 커밋으로 남긴다. 이 플랜의 나머지가 깨끗한 base 에서 출발하도록.

**Files:**
- Modify(commit): `mole/index.html`, `mole/js/game.js`, `mole/js/hud.js`, `mole/js/spawn-scheduler.js`, `mole/style.css`, `mole/sw.js`, `mole/scripts/test-spawn-scheduler.js`, `mole/scripts/verify-mole-smoke.js`

**Interfaces:**
- Consumes: 없음
- Produces: 커밋된 두더지 게임 — `window.__debugStartGame()`, `__debugEndRound()`, `__debugForceGameOver()`, `__debugHitCell(regionId)`, `__debugIntroActive()`; `localStorage['moleBestScore']`; `mole/sw.js` `CACHE = 'mole-game-v5'`.

- [ ] **Step 1: 로직 테스트 통과 확인**

Run: `cd fun-games-hub && node mole/scripts/run-all-tests.js`
Expected: `✓ all mole game logic tests passed`

- [ ] **Step 2: 스모크 테스트 통과 확인**

레포 루트에서 http 서버가 필요하다. 사용자의 미리보기 서버가 http:8844 를 이미 물고 있으면 그걸 쓴다.
Run: `cd fun-games-hub && SMOKE_PORT=8844 node mole/scripts/verify-mole-smoke.js`
(8844 가 안 뜨면: `PORT=8846 node scripts/serve.js &` 후 `SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js`, 끝나면 그 서버 kill)
Expected: `verify-mole-smoke.js: all assertions passed`

- [ ] **Step 3: 커밋**

```bash
cd fun-games-hub
git add mole/
git commit -m "$(cat <<'EOF'
feat(mole): 두더지 게임을 60초 점수 어택으로 전환

16칸 클리어 개념 제거. 레벨 선택 화면 → 시작 버튼 하나. 두더지는 16칸
아무 데나 랜덤 반복 등장(잡은 칸도 다시), 등장 간격 0.15~0.35초로 단축,
동시 두더지 수 2→4로 60초에 걸쳐 증가. 60초 종료 시 결과 화면(점수 +
최고 기록 localStorage 저장). 방해물/목숨 3개는 유지. 생명 하트는 아래줄
구멍과 안 겹치게 바닥으로 이동. 레벨 난이도 표(levels.js)와 scheduler 의
완성 판정 코드는 나중 스테이지/모드용으로 보존.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

- [ ] **Step 4: 커밋 확인**

Run: `git log --oneline -1 && git status --porcelain`
Expected: 최신 커밋이 위 메시지, `mole/` 관련 변경 없음(`기획서/` 만 `??` 로 남음).

---

## Task 2: `common/settings.js` — 설정 단일 소스

**Files:**
- Create: `common/settings.js`
- Create: `common/scripts/test-settings.js`
- Create: `common/scripts/run-all-tests.js`

**Interfaces:**
- Consumes: 없음 (`root.localStorage`, `root.navigator` 를 런타임에 참조)
- Produces: `window.FGH.Settings`:
  - `get(name)` — `name`: `'lang'|'sound'|'music'|'vibration'`. 반환: `'ko'|'en'` (lang) / `boolean` (나머지).
  - `set(name, value)` — 저장(lang 은 `'ko'/'en'` 문자열, 나머지는 truthy→`'1'`/falsy→`'0'`) 후 같은 이름 구독자에게 `cb(name, value)` 통지. 잘못된 `name` 무시.
  - `onChange(cb)` — `cb(name, value)`. 반환: 구독 해제 함수. `storage` 이벤트(다른 탭 변경)도 이 콜백으로 전달.
  - `vibrate(pattern)` — `get('vibration')` 이 true 이고 `root.navigator.vibrate` 가 있으면 호출. 예외 무시.
  - `sfxEnabled()` — `get('sound')` 와 동일.
  - `KEYS` — `{ lang:'appLang', sound:'soundOn', music:'musicOn', vibration:'vibrationOn' }` (테스트/디버그용 노출).

- [ ] **Step 1: 실패하는 테스트 작성**

`common/scripts/test-settings.js`:

```js
const assert = require('assert');

// --- 브라우저 전역 흉내 (모듈 로드 전에 세팅) ---
function makeStorage(seed) {
  const map = Object.assign({}, seed);
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    _map: map
  };
}
global.window = global;
global.localStorage = makeStorage({});
global.navigator = { language: 'en-US', vibrate: null };
global.addEventListener = () => {};

const { Settings } = require('../settings.js');

// 1) 빈 스토리지 → 기본값
assert.strictEqual(Settings.get('sound'), true, 'sound defaults on');
assert.strictEqual(Settings.get('music'), false, 'music defaults off');
assert.strictEqual(Settings.get('vibration'), true, 'vibration defaults on');
assert.strictEqual(Settings.get('lang'), 'en', 'lang follows navigator.language (en-US → en)');

// 2) 저장/복원
Settings.set('music', true);
assert.strictEqual(localStorage.getItem('musicOn'), '1', 'music true stored as "1"');
assert.strictEqual(Settings.get('music'), true);
Settings.set('sound', false);
assert.strictEqual(localStorage.getItem('soundOn'), '0');
assert.strictEqual(Settings.get('sound'), false);
Settings.set('lang', 'ko');
assert.strictEqual(localStorage.getItem('appLang'), 'ko');
assert.strictEqual(Settings.get('lang'), 'ko');

// 3) onChange 통지 + 해제
let seen = [];
const off = Settings.onChange((name, value) => seen.push([name, value]));
Settings.set('vibration', false);
assert.deepStrictEqual(seen, [['vibration', false]], 'subscriber notified');
off();
Settings.set('vibration', true);
assert.strictEqual(seen.length, 1, 'unsubscribed subscriber not notified');

// 4) 잘못된 name 무시
Settings.set('bogus', 'x');
assert.strictEqual(Settings.get('bogus'), undefined);

// 5) vibrate 게이팅
let vibed = null;
global.navigator.vibrate = (p) => { vibed = p; };
Settings.set('vibration', false);
Settings.vibrate(30);
assert.strictEqual(vibed, null, 'vibrate suppressed when vibration off');
Settings.set('vibration', true);
Settings.vibrate([10, 20]);
assert.deepStrictEqual(vibed, [10, 20], 'vibrate passes through when on');

// 6) sfxEnabled 연동
Settings.set('sound', true);
assert.strictEqual(Settings.sfxEnabled(), true);
Settings.set('sound', false);
assert.strictEqual(Settings.sfxEnabled(), false);

console.log('test-settings.js: all assertions passed');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd fun-games-hub && node common/scripts/test-settings.js`
Expected: FAIL — `Cannot find module '../settings.js'`

- [ ] **Step 3: `common/settings.js` 구현**

```js
(function (root) {
  'use strict';

  // 설정 단일 소스. 색칠앱과 저장키를 통일한다(appLang/soundOn/musicOn/vibrationOn).
  // 같은 origin(mrkyp-png.github.io)이라 배포된 색칠앱과도 설정이 공유된다 — 의도된 동작.
  var KEYS = { lang: 'appLang', sound: 'soundOn', music: 'musicOn', vibration: 'vibrationOn' };
  var BOOL_DEFAULT = { sound: true, music: false, vibration: true };

  function ls() { return root && root.localStorage ? root.localStorage : null; }
  function nav() { return root && root.navigator ? root.navigator : null; }

  function detectLang() {
    var n = nav();
    var l = n && (n.language || (n.languages && n.languages[0])) || 'en';
    return /^ko/i.test(l) ? 'ko' : 'en';
  }

  function get(name) {
    if (name === 'lang') {
      var v = ls() && ls().getItem(KEYS.lang);
      return (v === 'ko' || v === 'en') ? v : detectLang();
    }
    if (!(name in BOOL_DEFAULT)) return undefined;
    var raw = ls() && ls().getItem(KEYS[name]);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return BOOL_DEFAULT[name];
  }

  var subs = [];
  function notify(name, value) {
    subs.slice().forEach(function (cb) { try { cb(name, value); } catch (e) { /* 구독자 예외 격리 */ } });
  }

  function set(name, value) {
    if (name === 'lang') {
      var l = (value === 'ko') ? 'ko' : 'en';
      if (ls()) ls().setItem(KEYS.lang, l);
      notify('lang', l);
      return;
    }
    if (!(name in BOOL_DEFAULT)) return;
    var b = !!value;
    if (ls()) ls().setItem(KEYS[name], b ? '1' : '0');
    notify(name, b);
  }

  function onChange(cb) {
    subs.push(cb);
    return function () {
      var i = subs.indexOf(cb);
      if (i >= 0) subs.splice(i, 1);
    };
  }

  // 다른 탭/창에서 바뀌면 storage 이벤트로 들어온다 (허브에서 바꾸고 게임 탭이 열려 있을 때).
  if (root && root.addEventListener) {
    root.addEventListener('storage', function (e) {
      if (!e || !e.key) return;
      for (var name in KEYS) {
        if (KEYS[name] === e.key) { notify(name, get(name)); return; }
      }
    });
  }

  function vibrate(pattern) {
    if (!get('vibration')) return;
    var n = nav();
    if (n && n.vibrate) { try { n.vibrate(pattern); } catch (e) { /* noop */ } }
  }

  function sfxEnabled() { return get('sound'); }

  var api = { get: get, set: set, onChange: onChange, vibrate: vibrate, sfxEnabled: sfxEnabled, KEYS: KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Settings: api };
  if (root) { root.FGH = root.FGH || {}; root.FGH.Settings = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd fun-games-hub && node common/scripts/test-settings.js`
Expected: `test-settings.js: all assertions passed`

- [ ] **Step 5: 러너 작성**

`common/scripts/run-all-tests.js`:

```js
const { execFileSync } = require('child_process');
const path = require('path');

const tests = ['test-settings.js', 'test-i18n.js'];
let failed = false;
for (const t of tests) {
  try {
    process.stdout.write(execFileSync('node', [path.join(__dirname, t)], { encoding: 'utf8' }));
  } catch (e) {
    failed = true;
    console.error(`FAILED: ${t}`);
    console.error(e.stdout || e.message);
  }
}
if (failed) { console.error('\n✗ common tests failed'); process.exit(1); }
console.log('\n✓ all common tests passed');
```

(이 시점엔 `test-i18n.js` 가 없어 러너가 실패한다 — Task 3 에서 채운다. 지금은 `test-settings.js` 만 직접 돌려 확인.)

- [ ] **Step 6: 커밋**

```bash
cd fun-games-hub
git add common/settings.js common/scripts/test-settings.js common/scripts/run-all-tests.js
git commit -m "$(cat <<'EOF'
feat(common): FGH.Settings — 공용 설정(언어/소리/BGM/진동) 단일 소스

색칠앱과 저장키 통일(appLang/soundOn/musicOn/vibrationOn). get/set/onChange
+ vibrate()·sfxEnabled() 게이팅 헬퍼. storage 이벤트로 탭 간 동기화.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 3: `common/i18n.js` — 다국어

**Files:**
- Create: `common/i18n.js`
- Create: `common/scripts/test-i18n.js`

**Interfaces:**
- Consumes: `FGH.Settings` (`get('lang')`, `set('lang', l)`, `onChange`)
- Produces: `window.FGH.I18N`:
  - `lang` — 현재 언어 문자열 getter (`'ko'|'en'`).
  - `t(key, vars)` — 현재 언어 문구. 없으면 en → 없으면 `key` 그대로. `vars` 가 `{n: 5}` 면 문구의 `{n}` 를 `5` 로 치환.
  - `register(dict)` — `dict` = `{ ko: {key:str,...}, en: {key:str,...} }`. 여러 번 호출 가능, 같은 키는 나중 것이 이김.
  - `setLang(l)` — `Settings.set('lang', l)` 호출 → 자동으로 `applyStatic()` + `onChange` 통지.
  - `applyStatic(rootEl)` — `rootEl`(기본 `document`) 안에서 `[data-i18n]`→`textContent`, `[data-i18n-aria-label]`→`aria-label`, `[data-i18n-placeholder]`→`placeholder`.
  - `onChange(cb)` — `cb(lang)`. 반환: 해제 함수.

- [ ] **Step 1: 실패하는 테스트 작성**

`common/scripts/test-i18n.js`:

```js
const assert = require('assert');

function makeStorage(seed) {
  const map = Object.assign({}, seed);
  return { getItem: (k) => (k in map ? map[k] : null), setItem: (k, v) => { map[k] = String(v); }, removeItem: (k) => { delete map[k]; } };
}
global.window = global;
global.localStorage = makeStorage({ appLang: 'ko' });
global.navigator = { language: 'ko-KR' };
global.addEventListener = () => {};
// i18n.js 는 settings.js 에 의존
require('../settings.js');
const { I18N } = require('../i18n.js');

// 1) register + t + 언어 선택
I18N.register({ ko: { hi: '안녕', bye: '잘가' }, en: { hi: 'hi', bye: 'bye' } });
assert.strictEqual(I18N.lang, 'ko');
assert.strictEqual(I18N.t('hi'), '안녕');

// 2) 없는 키 → en 폴백 → key 폴백
I18N.register({ en: { onlyEn: 'only-en' } });
assert.strictEqual(I18N.t('onlyEn'), 'only-en', 'falls back to en when ko missing');
assert.strictEqual(I18N.t('missing'), 'missing', 'falls back to the key itself');

// 3) {n} 치환
I18N.register({ ko: { pts: '{n}점' }, en: { pts: '{n} pts' } });
assert.strictEqual(I18N.t('pts', { n: 120 }), '120점');

// 4) setLang → 즉시 반영
I18N.setLang('en');
assert.strictEqual(I18N.lang, 'en');
assert.strictEqual(I18N.t('hi'), 'hi');
assert.strictEqual(localStorage.getItem('appLang'), 'en');

// 5) register 병합/덮어쓰기
I18N.register({ en: { hi: 'HELLO' } });
assert.strictEqual(I18N.t('hi'), 'HELLO', 'later register wins for the same key');
assert.strictEqual(I18N.t('bye'), 'bye', 'earlier keys survive the merge');

// 6) onChange
let langs = [];
const off = I18N.onChange((l) => langs.push(l));
I18N.setLang('ko');
assert.deepStrictEqual(langs, ['ko']);
off();

console.log('test-i18n.js: all assertions passed');
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd fun-games-hub && node common/scripts/test-i18n.js`
Expected: FAIL — `Cannot find module '../i18n.js'`

- [ ] **Step 3: `common/i18n.js` 구현**

```js
(function (root) {
  'use strict';

  var Settings = root && root.FGH && root.FGH.Settings;
  if (typeof module !== 'undefined' && module.exports && !Settings) {
    Settings = require('./settings.js').Settings;
  }

  var DICT = { ko: {}, en: {} };

  function register(dict) {
    ['ko', 'en'].forEach(function (l) {
      if (dict && dict[l]) {
        for (var k in dict[l]) DICT[l][k] = dict[l][k];
      }
    });
  }

  function currentLang() { return Settings ? Settings.get('lang') : 'en'; }

  function t(key, vars) {
    var l = currentLang();
    var s = (DICT[l] && DICT[l][key]);
    if (s == null) s = (DICT.en && DICT.en[key]);
    if (s == null) s = key;
    if (vars) {
      for (var name in vars) s = s.split('{' + name + '}').join(String(vars[name]));
    }
    return s;
  }

  function applyStatic(rootEl) {
    rootEl = rootEl || (root && root.document);
    if (!rootEl || !rootEl.querySelectorAll) return;
    rootEl.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    rootEl.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  var subs = [];
  function onChange(cb) {
    subs.push(cb);
    return function () { var i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
  }

  function setLang(l) {
    if (Settings) Settings.set('lang', l);
    applyStatic();
    subs.slice().forEach(function (cb) { try { cb(currentLang()); } catch (e) { /* 격리 */ } });
  }

  // Settings 쪽에서 언어가 바뀌어도(예: storage 이벤트) 화면을 다시 칠한다.
  if (Settings && Settings.onChange) {
    Settings.onChange(function (name, value) {
      if (name !== 'lang') return;
      applyStatic();
      subs.slice().forEach(function (cb) { try { cb(value); } catch (e) { /* 격리 */ } });
    });
  }

  var api = {
    t: t, register: register, setLang: setLang, applyStatic: applyStatic, onChange: onChange,
    get lang() { return currentLang(); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { I18N: api };
  if (root) { root.FGH = root.FGH || {}; root.FGH.I18N = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd fun-games-hub && node common/scripts/test-i18n.js`
Expected: `test-i18n.js: all assertions passed`

- [ ] **Step 5: 러너 통과 확인**

Run: `cd fun-games-hub && node common/scripts/run-all-tests.js`
Expected: `✓ all common tests passed`

- [ ] **Step 6: 커밋**

```bash
cd fun-games-hub
git add common/i18n.js common/scripts/test-i18n.js
git commit -m "$(cat <<'EOF'
feat(common): FGH.I18N — ko/en 다국어 (data-i18n + t())

register()로 화면별 문구 등록, t(key,{n})로 조회+치환, applyStatic()으로
[data-i18n] 계열 속성 DOM 반영. Settings 와 언어값 공유.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 4: `common/settings-ui.js` + `common/settings.css` — 주입형 설정 UI

**Files:**
- Create: `common/settings-ui.js`
- Create: `common/settings.css`
- Create: `common/scripts/fixture.html`
- Create: `common/scripts/verify-settings-ui-smoke.js`

**Interfaces:**
- Consumes: `FGH.Settings`, `FGH.I18N` (공용 문구 키 `settings.title`/`settings.sound`/`settings.music`/`settings.vibration`/`settings.lang`/`lang.ko`/`lang.en`/`common.close` — 이 Task 에서 `common/i18n.js` 로드 후 `I18N.register` 로 등록).
- Produces: `window.FGH.SettingsUI.mount()` — 멱등(두 번 불러도 중복 주입 안 함). `document.body` 에 다음을 주입:
  - `#fgh-topright` (position:fixed 우상단) 안에 `#fgh-lang-btn`, `#fgh-settings-btn`
  - `#fgh-lang-menu` (`[data-lang="ko"]`, `[data-lang="en"]` 버튼)
  - `#fgh-settings-modal` (`.fgh-set-row` × 3: `data-set="sound|music|vibration"`, 각 행에 `.fgh-set-toggle` 버튼) + `#fgh-settings-close`

- [ ] **Step 1: 실패하는 스모크 + fixture 작성**

`common/scripts/fixture.html`:

```html
<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<link rel="stylesheet" href="../settings.css"></head>
<body>
<script src="../settings.js"></script>
<script src="../i18n.js"></script>
<script src="../settings-ui.js"></script>
<script>FGH.SettingsUI.mount();</script>
</body></html>
```

`common/scripts/verify-settings-ui-smoke.js`:

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/common/scripts/fixture.html`, { waitUntil: 'load' });

    // 1) 버튼 2개 주입
    assert.ok(await page.$('#fgh-lang-btn'), 'lang button injected');
    assert.ok(await page.$('#fgh-settings-btn'), 'settings button injected');

    // 2) 멱등 — 다시 mount 해도 하나뿐
    await page.evaluate(() => FGH.SettingsUI.mount());
    assert.strictEqual((await page.$$('#fgh-settings-btn')).length, 1, 'mount is idempotent');

    // 3) 설정 모달 열기 → 진동 토글 off → localStorage 반영
    await page.click('#fgh-settings-btn');
    assert.strictEqual(await page.evaluate(() => document.getElementById('fgh-settings-modal').hidden), false, 'modal opens');
    await page.click('.fgh-set-row[data-set="vibration"] .fgh-set-toggle');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('vibrationOn')), '0', 'vibration toggled off');
    await page.click('#fgh-settings-close');
    assert.strictEqual(await page.evaluate(() => document.getElementById('fgh-settings-modal').hidden), true, 'modal closes');

    // 4) 언어 메뉴 → English → appLang + 모달 제목 번역
    await page.click('#fgh-lang-btn');
    await page.click('#fgh-lang-menu [data-lang="en"]');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('appLang')), 'en', 'lang switched to en');
    await page.click('#fgh-settings-btn');
    const title = await page.evaluate(() => document.querySelector('#fgh-settings-modal [data-i18n="settings.title"]').textContent);
    assert.strictEqual(title, 'Settings', 'modal title re-localized to en');

    console.log('verify-settings-ui-smoke.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 스모크 실패 확인**

레포 루트 http 서버 필요:
Run: `cd fun-games-hub && PORT=8846 node scripts/serve.js &` 그다음 `SMOKE_PORT=8846 node common/scripts/verify-settings-ui-smoke.js`
Expected: FAIL — `#fgh-lang-btn` 없음 (settings-ui.js 미구현). 끝나면 `kill %1`.

- [ ] **Step 3: `common/settings.css` 작성**

```css
/* FGH 공용 설정 UI — 허브에 주입. cosmic-theme.css 변수(--card-bg/--ink/--brand/--shadow) 사용. */
#fgh-topright {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top));
  right: calc(10px + env(safe-area-inset-right));
  z-index: 50;
  display: flex;
  gap: 8px;
}
.fgh-icon-btn {
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--card-bg, #2a2350);
  color: var(--ink, #fff);
  border: none; cursor: pointer;
  box-shadow: var(--shadow, 0 3px 8px rgba(0,0,0,.3));
}
.fgh-icon-btn svg { width: 22px; height: 22px; }

#fgh-lang-menu {
  position: fixed;
  top: calc(58px + env(safe-area-inset-top));
  right: calc(10px + env(safe-area-inset-right));
  z-index: 51;
  background: var(--card-bg, #2a2350);
  border-radius: 12px;
  box-shadow: var(--shadow, 0 6px 16px rgba(0,0,0,.4));
  overflow: hidden;
}
#fgh-lang-menu button {
  display: block; width: 100%;
  padding: 10px 20px;
  background: none; border: none;
  color: var(--ink, #fff); font-size: 0.95rem; text-align: left; cursor: pointer;
}
#fgh-lang-menu button.is-active { background: var(--brand, #7c5cff); color: #fff; }

#fgh-settings-modal {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(6, 4, 23, 0.82);
  display: flex; align-items: center; justify-content: center;
}
#fgh-settings-card {
  background: var(--card-bg, #2a2350);
  color: var(--ink, #fff);
  border-radius: 20px;
  padding: 24px;
  min-width: 260px;
  box-shadow: var(--shadow, 0 10px 30px rgba(0,0,0,.5));
}
#fgh-settings-card h2 { margin: 0 0 16px; font-size: 1.2rem; }
.fgh-set-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
}
.fgh-set-row .fgh-set-ico { width: 24px; height: 24px; flex: 0 0 auto; }
.fgh-set-row .fgh-set-lbl { flex: 1; font-weight: 700; }
.fgh-set-toggle {
  width: 52px; height: 30px; border-radius: 999px;
  border: none; cursor: pointer; position: relative;
  background: #55506e;
  transition: background 0.15s ease;
}
.fgh-set-toggle::after {
  content: ""; position: absolute; top: 3px; left: 3px;
  width: 24px; height: 24px; border-radius: 50%;
  background: #fff; transition: transform 0.15s ease;
}
.fgh-set-toggle[aria-pressed="true"] { background: var(--brand, #7c5cff); }
.fgh-set-toggle[aria-pressed="true"]::after { transform: translateX(22px); }
#fgh-settings-close {
  margin-top: 16px; width: 100%;
  padding: 10px; border-radius: 999px; border: none;
  background: var(--brand, #7c5cff); color: #fff; font-weight: 700; cursor: pointer;
}
```

- [ ] **Step 4: `common/settings-ui.js` 구현**

```js
(function (root) {
  'use strict';

  var S = root.FGH && root.FGH.Settings;
  var I = root.FGH && root.FGH.I18N;

  // 공용 문구 (settings-ui 가 소유). 허브/게임의 공통 버튼 문구도 여기 둔다.
  if (I) I.register({
    ko: {
      'settings.title': '설정', 'settings.sound': '소리', 'settings.music': '배경음악',
      'settings.vibration': '진동', 'settings.lang': '언어',
      'lang.ko': '한국어', 'lang.en': 'English',
      'common.close': '닫기', 'common.toHub': '허브로', 'common.back': '나가기', 'common.retry': '다시하기'
    },
    en: {
      'settings.title': 'Settings', 'settings.sound': 'Sound', 'settings.music': 'Music',
      'settings.vibration': 'Vibration', 'settings.lang': 'Language',
      'lang.ko': '한국어', 'lang.en': 'English',
      'common.close': 'Close', 'common.toHub': 'Hub', 'common.back': 'Exit', 'common.retry': 'Retry'
    }
  });

  var SVG = {
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4l-2-1.5.3-2.5-2.4-.9-1-2.3-2.5.5L12 2 9.9 3.8 7.4 3.3l-1 2.3-2.4.9.3 2.5L2 12l2 1.5-.3 2.5 2.4.9 1 2.3 2.5-.5L12 22l2.1-1.8 2.5.5 1-2.3 2.4-.9-.3-2.5z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17V5l10-2v12"/><circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/></svg>',
    vibrate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M3 9v6M21 9v6"/></svg>'
  };

  var mounted = false;

  function toggleRow(key, setName) {
    var on = S.get(setName);
    var ico = (setName === 'sound') ? (on ? SVG.soundOn : SVG.soundOff)
            : (setName === 'music') ? SVG.music : SVG.vibrate;
    return '<div class="fgh-set-row" data-set="' + setName + '">' +
      '<span class="fgh-set-ico">' + ico + '</span>' +
      '<span class="fgh-set-lbl" data-i18n="' + key + '"></span>' +
      '<button class="fgh-set-toggle" aria-pressed="' + on + '" aria-label="' + setName + '"></button>' +
      '</div>';
  }

  function mount() {
    if (mounted || !root.document || !root.document.body) return;
    mounted = true;
    var lang = S.get('lang');

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="fgh-topright">' +
        '<button id="fgh-lang-btn" class="fgh-icon-btn" aria-label="Language">' + SVG.globe + '</button>' +
        '<button id="fgh-settings-btn" class="fgh-icon-btn" aria-label="Settings">' + SVG.gear + '</button>' +
      '</div>' +
      '<div id="fgh-lang-menu" hidden>' +
        '<button type="button" data-lang="ko" data-i18n="lang.ko"></button>' +
        '<button type="button" data-lang="en" data-i18n="lang.en"></button>' +
      '</div>' +
      '<div id="fgh-settings-modal" hidden><div id="fgh-settings-card">' +
        '<h2 data-i18n="settings.title"></h2>' +
        toggleRow('settings.sound', 'sound') +
        toggleRow('settings.music', 'music') +
        toggleRow('settings.vibration', 'vibration') +
        '<button id="fgh-settings-close" data-i18n="common.close"></button>' +
      '</div></div>';
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    var langMenu = document.getElementById('fgh-lang-menu');
    var modal = document.getElementById('fgh-settings-modal');

    function markLang() {
      langMenu.querySelectorAll('[data-lang]').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-lang') === S.get('lang'));
      });
    }
    markLang();

    document.getElementById('fgh-lang-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      langMenu.hidden = !langMenu.hidden;
    });
    langMenu.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        I.setLang(b.getAttribute('data-lang'));
        markLang();
        langMenu.hidden = true;
      });
    });
    document.addEventListener('click', function (e) {
      if (!langMenu.hidden && e.target !== document.getElementById('fgh-lang-btn') && !langMenu.contains(e.target)) {
        langMenu.hidden = true;
      }
    });

    document.getElementById('fgh-settings-btn').addEventListener('click', function () { modal.hidden = false; });
    document.getElementById('fgh-settings-close').addEventListener('click', function () { modal.hidden = true; });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });

    modal.querySelectorAll('.fgh-set-row').forEach(function (row) {
      var setName = row.getAttribute('data-set');
      row.querySelector('.fgh-set-toggle').addEventListener('click', function () {
        S.set(setName, !S.get(setName));
      });
    });

    // 설정 바뀌면(같은 탭·다른 탭) 토글 상태와 소리 아이콘 갱신
    S.onChange(function (name) {
      var row = modal.querySelector('.fgh-set-row[data-set="' + name + '"]');
      if (!row) return;
      row.querySelector('.fgh-set-toggle').setAttribute('aria-pressed', String(S.get(name)));
      if (name === 'sound') row.querySelector('.fgh-set-ico').innerHTML = S.get('sound') ? SVG.soundOn : SVG.soundOff;
    });

    if (I) I.applyStatic(document);
  }

  var api = { mount: mount };
  if (root) { root.FGH = root.FGH || {}; root.FGH.SettingsUI = api; }
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 5: 스모크 통과 확인**

Run: `cd fun-games-hub && PORT=8846 node scripts/serve.js &` 그다음 `SMOKE_PORT=8846 node common/scripts/verify-settings-ui-smoke.js` 그다음 `kill %1`
Expected: `verify-settings-ui-smoke.js: all assertions passed`

- [ ] **Step 6: 커밋**

```bash
cd fun-games-hub
git add common/settings-ui.js common/settings.css common/scripts/fixture.html common/scripts/verify-settings-ui-smoke.js
git commit -m "$(cat <<'EOF'
feat(common): FGH.SettingsUI — 우상단 언어/설정 주입 UI (허브 전용)

인라인 SVG 아이콘, 언어 메뉴(한/영), 소리·BGM·진동 토글 모달. 멱등 mount().
공용 문구(settings.*/common.*) 는 여기서 register.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 5: 허브 재작성 — 탭바 + 설정 UI + i18n

**Files:**
- Modify: `index.html` (전면 재작성)
- Create: `hub.css`
- Create: `hub-strings.js`
- Create: `hub.js`
- Create: `scripts/verify-hub-smoke.js`

**Interfaces:**
- Consumes: `FGH.Settings`, `FGH.I18N`, `FGH.SettingsUI.mount()`
- Produces: 허브 페이지 — `#home-screen`/`#score-screen`/`#album-screen`/`#shop-screen` (`.hub-screen`), `#tab-bar` 의 `.fgh-tab[data-tab="score|album|home|shop"]`. 홈 탭에 게임 4카드(`.theme-card`).

- [ ] **Step 1: 실패하는 스모크 작성**

`scripts/verify-hub-smoke.js`:

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8846;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

    // 1) 탭 4개 + 홈이 기본
    assert.strictEqual((await page.$$('#tab-bar .fgh-tab')).length, 4, '4 tabs render');
    assert.strictEqual(await page.evaluate(() => document.getElementById('home-screen').hidden), false, 'home visible by default');
    assert.strictEqual(await page.evaluate(() => document.getElementById('score-screen').hidden), true, 'score hidden by default');

    // 2) 게임 카드 4개
    assert.strictEqual((await page.$$('#home-screen .theme-card')).length, 4, '4 game cards on home');

    // 3) 탭 전환
    await page.click('#tab-bar .fgh-tab[data-tab="shop"]');
    assert.strictEqual(await page.evaluate(() => document.getElementById('shop-screen').hidden), false, 'shop shows on tab click');
    assert.strictEqual(await page.evaluate(() => document.getElementById('home-screen').hidden), true, 'home hides');
    await page.click('#tab-bar .fgh-tab[data-tab="home"]');

    // 4) 설정 UI 주입됨 + 진동 토글 저장/복원
    await page.click('#fgh-settings-btn');
    await page.click('.fgh-set-row[data-set="music"] .fgh-set-toggle');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('musicOn')), '1', 'music toggled on');
    await page.reload({ waitUntil: 'load' });
    await page.click('#fgh-settings-btn');
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('.fgh-set-row[data-set="music"] .fgh-set-toggle').getAttribute('aria-pressed')),
      'true', 'music toggle restored after reload');
    await page.click('#fgh-settings-close');

    // 5) 언어 전환 → 탭 라벨 영어 + 유지
    await page.click('#fgh-lang-btn');
    await page.click('#fgh-lang-menu [data-lang="en"]');
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('#tab-bar .fgh-tab[data-tab="score"] .fgh-tab-lbl').textContent),
      'Score', 'tab label localized to en');
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(
      await page.evaluate(() => document.querySelector('#tab-bar .fgh-tab[data-tab="score"] .fgh-tab-lbl').textContent),
      'Score', 'language persists after reload');

    // 정리 — 다음 실행이 ko 로 시작하도록
    await page.evaluate(() => localStorage.clear());

    console.log('verify-hub-smoke.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 스모크 실패 확인**

Run: `cd fun-games-hub && PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node scripts/verify-hub-smoke.js` → `kill %1`
Expected: FAIL — `#tab-bar` 없음.

- [ ] **Step 3: `hub.css` 작성 (기존 인라인 스타일 이전 + 탭바)**

```css
.hub {
  display: flex; flex-direction: column; align-items: center;
  padding: 32px 20px 96px; /* 하단 탭바 높이만큼 여유 */
  max-width: 480px; margin: 0 auto;
}
.hub-title { font-size: 1.8rem; font-weight: 700; margin: 8px 0 28px; text-align: center; }
.theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }
.theme-card {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; aspect-ratio: 1; border-radius: 24px;
  background: var(--card-bg); box-shadow: var(--shadow);
  border: none; color: var(--ink); cursor: pointer; text-decoration: none;
  -webkit-tap-highlight-color: transparent; transition: transform 0.15s ease;
}
.theme-card:active { transform: scale(0.95); }
.theme-emoji { font-size: 3rem; line-height: 1; }
.theme-label { font-size: 1.05rem; font-weight: 700; }

.hub-screen { min-height: 60dvh; }
.hub-placeholder {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 60dvh; gap: 12px; text-align: center; color: var(--muted);
}
.hub-placeholder-emoji { font-size: 3.4rem; }

#tab-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
  display: flex;
  background: var(--card-bg);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.35);
  padding-bottom: env(safe-area-inset-bottom);
}
.fgh-tab {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 10px 0; background: none; border: none; cursor: pointer;
  color: var(--muted); font: inherit;
}
.fgh-tab[aria-selected="true"] { color: var(--ink); }
.fgh-tab svg { width: 22px; height: 22px; }
.fgh-tab-lbl { font-size: 0.72rem; font-weight: 700; }
```

- [ ] **Step 4: `hub-strings.js` 작성**

```js
(function (root) {
  'use strict';
  var I = root.FGH && root.FGH.I18N;
  if (!I) return;
  I.register({
    ko: {
      'hub.title': 'Fun Games',
      'hub.tab.score': '스코어', 'hub.tab.album': '앨범', 'hub.tab.home': '홈', 'hub.tab.shop': '상점',
      'hub.card.snake': '지렁이', 'hub.card.mole': '두더지', 'hub.card.match': '그림맞추기', 'hub.card.coloring': '색칠하기',
      'hub.comingSoon': '준비 중이에요. 곧 만나요!'
    },
    en: {
      'hub.title': 'Fun Games',
      'hub.tab.score': 'Score', 'hub.tab.album': 'Album', 'hub.tab.home': 'Home', 'hub.tab.shop': 'Shop',
      'hub.card.snake': 'Snake', 'hub.card.mole': 'Whack-a-Mole', 'hub.card.match': 'Match', 'hub.card.coloring': 'Coloring',
      'hub.comingSoon': 'Coming soon!'
    }
  });
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 5: `index.html` 재작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fun Games</title>
<link rel="stylesheet" href="cosmic-theme.css">
<link rel="stylesheet" href="common/settings.css">
<link rel="stylesheet" href="hub.css">
</head>
<body>
<div class="cosmic-bg">

  <section id="home-screen" class="hub-screen">
    <div class="hub cosmic-content">
      <h1 class="hub-title" data-i18n="hub.title">Fun Games</h1>
      <div class="theme-grid">
        <a class="theme-card" href="snake/index.html">
          <span class="theme-emoji">🐛</span>
          <span class="theme-label" data-i18n="hub.card.snake">지렁이</span>
        </a>
        <a class="theme-card" href="mole/index.html">
          <span class="theme-emoji">🕳️</span>
          <span class="theme-label" data-i18n="hub.card.mole">두더지</span>
        </a>
        <a class="theme-card" href="match/index.html">
          <span class="theme-emoji">🧩</span>
          <span class="theme-label" data-i18n="hub.card.match">그림맞추기</span>
        </a>
        <a class="theme-card" href="coloring/index.html">
          <span class="theme-emoji">🎨</span>
          <span class="theme-label" data-i18n="hub.card.coloring">색칠하기</span>
        </a>
      </div>
    </div>
  </section>

  <section id="score-screen" class="hub-screen" hidden>
    <div class="hub cosmic-content"><div class="hub-placeholder">
      <div class="hub-placeholder-emoji">🏆</div>
      <p data-i18n="hub.comingSoon">준비 중이에요. 곧 만나요!</p>
    </div></div>
  </section>

  <section id="album-screen" class="hub-screen" hidden>
    <div class="hub cosmic-content"><div class="hub-placeholder">
      <div class="hub-placeholder-emoji">📁</div>
      <p data-i18n="hub.comingSoon">준비 중이에요. 곧 만나요!</p>
    </div></div>
  </section>

  <section id="shop-screen" class="hub-screen" hidden>
    <div class="hub cosmic-content"><div class="hub-placeholder">
      <div class="hub-placeholder-emoji">🛍️</div>
      <p data-i18n="hub.comingSoon">준비 중이에요. 곧 만나요!</p>
    </div></div>
  </section>

  <nav id="tab-bar">
    <button class="fgh-tab" data-tab="score" type="button">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.6 1.4 6.8L12 17.8 5.9 20.5l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>
      <span class="fgh-tab-lbl" data-i18n="hub.tab.score">스코어</span>
    </button>
    <button class="fgh-tab" data-tab="album" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 5"/></svg>
      <span class="fgh-tab-lbl" data-i18n="hub.tab.album">앨범</span>
    </button>
    <button class="fgh-tab" data-tab="home" type="button">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z"/></svg>
      <span class="fgh-tab-lbl" data-i18n="hub.tab.home">홈</span>
    </button>
    <button class="fgh-tab" data-tab="shop" type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h16l-1.2 11.2a2 2 0 01-2 1.8H7.2a2 2 0 01-2-1.8zM9 8V6a3 3 0 016 0v2"/></svg>
      <span class="fgh-tab-lbl" data-i18n="hub.tab.shop">상점</span>
    </button>
  </nav>

</div>

<script src="common/settings.js"></script>
<script src="common/i18n.js"></script>
<script src="hub-strings.js"></script>
<script src="common/settings-ui.js"></script>
<script src="hub.js"></script>
</body>
</html>
```

- [ ] **Step 6: `hub.js` 작성**

```js
(function () {
  'use strict';
  var I = window.FGH.I18N;

  var SCREENS = ['score', 'album', 'home', 'shop'];
  function show(tab) {
    SCREENS.forEach(function (t) {
      document.getElementById(t + '-screen').hidden = (t !== tab);
    });
    document.querySelectorAll('#tab-bar .fgh-tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
    });
  }

  document.querySelectorAll('#tab-bar .fgh-tab').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-tab')); });
  });

  window.FGH.SettingsUI.mount();
  I.applyStatic(document);
  I.onChange(function () { I.applyStatic(document); });
  show('home');
})();
```

- [ ] **Step 7: 스모크 통과 확인**

Run: `cd fun-games-hub && PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node scripts/verify-hub-smoke.js` → `kill %1`
Expected: `verify-hub-smoke.js: all assertions passed`

- [ ] **Step 8: 커밋**

```bash
cd fun-games-hub
git add index.html hub.css hub.js hub-strings.js scripts/verify-hub-smoke.js
git commit -m "$(cat <<'EOF'
feat(hub): 하단 탭바(스코어/앨범/홈/상점) + 우상단 언어/설정 + i18n

index.html 재작성, 인라인 스타일을 hub.css 로 분리. 게임 카드/탭 라벨에
data-i18n. SettingsUI.mount() 로 ⚙️/🌐 주입. 탭은 순수 표시 토글.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 6: 두더지 게임 — i18n

**Files:**
- Create: `mole/js/i18n-strings.js`
- Modify: `mole/index.html` (스크립트 로드 + 정적 문구 `data-i18n`)
- Modify: `mole/js/game.js` (동적 문구 `I18N.t()`)
- Modify: `mole/js/hud.js` (문구 `I18N.t()`)
- Modify: `mole/js/hit-fx.js` (의성어 `I18N.t()`)
- Modify: `mole/scripts/verify-mole-smoke.js` (en 검증 1건 추가)

**Interfaces:**
- Consumes: `FGH.I18N` (`t`, `register`, `applyStatic`)
- Produces: 두더지 게임의 눈에 보이는 문구가 `appLang` 을 따름. `mole.*` 키 사전.

- [ ] **Step 1: 스모크에 실패 검증 추가**

`mole/scripts/verify-mole-smoke.js` 의 `// 1) 시작 화면` 블록 바로 뒤에 추가:

```js
    // 1b) appLang=en 이면 시작 버튼이 영어
    await page.evaluate(() => localStorage.setItem('appLang', 'en'));
    await page.reload({ waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 200));
    const startLabel = await page.evaluate(() => document.getElementById('start-btn').textContent.trim());
    assert.strictEqual(startLabel, 'Start', 'start button localized to en when appLang=en');
    await page.evaluate(() => localStorage.removeItem('appLang'));
    await page.reload({ waitUntil: 'load' });
```

- [ ] **Step 2: 스모크 실패 확인**

Run: `cd fun-games-hub && SMOKE_PORT=8844 node mole/scripts/verify-mole-smoke.js` (또는 8846 서버)
Expected: FAIL — 시작 버튼이 `시작` (아직 i18n 미적용)

- [ ] **Step 3: `mole/js/i18n-strings.js` 작성**

```js
(function (root) {
  'use strict';
  var I = root.FGH && root.FGH.I18N;
  if (!I) return;
  I.register({
    ko: {
      'mole.title': '두더지 게임',
      'mole.start.tag': '1분 동안 두더지를 최대한 많이 잡아 점수를 올려요!',
      'mole.start.btn': '시작',
      'mole.start.best': '최고 기록 {n}점',
      'mole.count.go': '시작!',
      'mole.result.time': '시간 종료!',
      'mole.result.lives': '목숨 소진!',
      'mole.result.score': '{n}점',
      'mole.result.newBest': '최고 기록 달성! {n}점',
      'mole.result.best': '최고 기록 {n}점',
      'mole.mode': '두더지만 때려잡자!',
      'mole.hud.sec': '{n}초',
      'mole.hud.combo': 'COMBO {n}',
      'mole.hud.maxCombo': 'MAX COMBO {n}',
      'mole.fx.tap': '톡!', 'mole.fx.bam': '쾅!', 'mole.fx.clang': '깡!'
    },
    en: {
      'mole.title': 'Whack-a-Mole',
      'mole.start.tag': 'Whack as many moles as you can in 60 seconds!',
      'mole.start.btn': 'Start',
      'mole.start.best': 'Best {n}',
      'mole.count.go': 'Go!',
      'mole.result.time': "Time's up!",
      'mole.result.lives': 'Out of lives!',
      'mole.result.score': '{n} pts',
      'mole.result.newBest': 'New best! {n}',
      'mole.result.best': 'Best {n}',
      'mole.mode': 'Whack those moles!',
      'mole.hud.sec': '{n}s',
      'mole.hud.combo': 'COMBO {n}',
      'mole.hud.maxCombo': 'MAX COMBO {n}',
      'mole.fx.tap': 'Tap!', 'mole.fx.bam': 'Bam!', 'mole.fx.clang': 'Clang!'
    }
  });
})(typeof window !== 'undefined' ? window : null);
```

- [ ] **Step 4: `mole/index.html` 수정**

`<head>` 에 CSS 추가 (`style.css` 앞):

```html
<link rel="stylesheet" href="../common/settings.css">
```

`js/levels.js` 로드 앞에 추가:

```html
<script src="../common/settings.js"></script>
<script src="../common/i18n.js"></script>
<script src="js/i18n-strings.js"></script>
```

정적 문구에 `data-i18n` 부착:
- `<title>두더지 게임</title>` → `<title data-i18n="mole.title">두더지 게임</title>`
- `<h1>두더지 게임</h1>` → `<h1 data-i18n="mole.title">두더지 게임</h1>`
- `.start-tag` → `<p class="start-tag" data-i18n="mole.start.tag">1분 동안 …</p>`
- `#start-btn` → `<button id="start-btn" class="start-btn" data-i18n="mole.start.btn">시작</button>`
- `#gameover-retry-btn` → `... data-i18n="common.retry">다시하기</button>`
- `#gameover-select-btn` → `... data-i18n="common.back">나가기</button>`

`game.js` 끝 `<script>` 태그는 그대로. `js/game.js` 로드 뒤에 다음 한 줄 스크립트 추가:

```html
<script>window.FGH.I18N.applyStatic(document);</script>
```

- [ ] **Step 5: `mole/js/hud.js` 수정**

`MODE_TITLE` 상수와 `update()` 를 `I18N.t()` 기반으로:

```js
  function update(state) {
    var I = window.FGH.I18N;
    setAll('tk-mode', I.t('mole.mode'));
    setAll('tk-t', I.t('mole.hud.sec', { n: Math.max(0, Math.ceil(state.timeRemaining)) }));
    setAll('tk-c', state.combo > 0
      ? I.t(state.isMaxCombo ? 'mole.hud.maxCombo' : 'mole.hud.combo', { n: state.combo })
      : I.t('mole.hud.combo', { n: 0 }));

    var score = document.getElementById('hud-score');
    ...
```

`var MODE_TITLE = ...` 줄과 `api` 의 `MODE_TITLE` 노출은 제거 (더 이상 안 쓰임 — 이 변경으로 orphan).

- [ ] **Step 6: `mole/js/game.js` 수정 — 동적 문구**

- `playRoundIntro` 의 `STEPS = ['3', '2', '1', '시작!']` → `['3', '2', '1', window.FGH.I18N.t('mole.count.go')]` (단, `startGame` 마다 새로 만들도록 배열 생성을 `playRoundIntro` 안으로 유지 — 이미 그러함).
- 시작 화면 최고 기록:
  ```js
  var best = loadBest();
  document.getElementById('start-best').textContent =
    best > 0 ? window.FGH.I18N.t('mole.start.best', { n: best.toLocaleString() }) : '';
  ```
- `endGame(reason)`:
  ```js
  var I = window.FGH.I18N;
  document.getElementById('gameover-reason').textContent =
    I.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.time');
  document.getElementById('gameover-score').textContent =
    I.t('mole.result.score', { n: score.toLocaleString() });
  document.getElementById('gameover-best').textContent = isNewBest
    ? I.t('mole.result.newBest', { n: score.toLocaleString() })
    : I.t('mole.result.best', { n: Math.max(best, score).toLocaleString() });
  ```

- [ ] **Step 7: `mole/js/hit-fx.js` 수정 — 의성어**

```js
  function moleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.bam') + '</span>');
    ...
  }
  function moleTap(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-burst', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.tap') + '</span>');
    ...
  }
  function obstacleHit(boardEl, xFrac, yFrac) {
    shake(boardEl);
    spawnAt(boardEl, 'hit-fx-clang', xFrac, yFrac, '<span>' + window.FGH.I18N.t('mole.fx.clang') + '</span>');
    ...
  }
```

(이 Task 에선 `tone()`/`vibrate()` 는 건드리지 않는다 — Task 7.)

- [ ] **Step 8: 로직 테스트 + 스모크 통과 확인**

Run: `cd fun-games-hub && node mole/scripts/run-all-tests.js`
Expected: `✓ all mole game logic tests passed` (levels/combo/scheduler 등 로직은 안 건드렸으니 그대로 그린)

Run: `PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js` → `kill %1`
Expected: `verify-mole-smoke.js: all assertions passed` (신규 en 검증 포함)

- [ ] **Step 9: 커밋**

```bash
cd fun-games-hub
git add mole/js/i18n-strings.js mole/index.html mole/js/game.js mole/js/hud.js mole/js/hit-fx.js mole/scripts/verify-mole-smoke.js
git commit -m "$(cat <<'EOF'
feat(mole): 한/영 다국어 (data-i18n + I18N.t), 의성어 번역

시작·결과·HUD·카운트다운 문구와 톡!/쾅!/깡! 이펙트를 appLang 에 연동.
공용 common/settings.js·i18n.js 로드.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 7: 두더지 게임 — BGM + 효과음/진동 게이팅

**Files:**
- Create: `mole/audio/bgm-boss-battle.mp3` (복사)
- Modify: `mole/index.html` (`<audio>` 추가)
- Modify: `mole/js/game.js` (BGM 재생 제어)
- Modify: `mole/js/hit-fx.js` (`tone()` 게이트, `vibrate()` → `Settings.vibrate()`)
- Modify: `mole/sw.js` (`CACHE` v5→v6, `SHELL` 추가)
- Modify: `mole/scripts/verify-mole-smoke.js` (BGM/게이팅 검증)

**Interfaces:**
- Consumes: `FGH.Settings` (`get('music')`, `onChange`, `sfxEnabled()`, `vibrate()`)
- Produces: 두더지 게임 BGM(`musicOn` 연동, 시작 제스처 후 재생), 효과음·진동이 설정을 따름.

- [ ] **Step 1: BGM 파일 복사**

```bash
cd fun-games-hub
mkdir -p mole/audio
cp coloring/audio/bgm-boss-battle.mp3 mole/audio/bgm-boss-battle.mp3
ls -la mole/audio/bgm-boss-battle.mp3   # ~6.8MB 확인
```

- [ ] **Step 2: 스모크에 실패 검증 추가**

`mole/scripts/verify-mole-smoke.js` — `// 3d) 구멍 버튼 16개` 다음에:

```js
    // 3h) BGM: <audio> 존재 + musicOn=1 이면 시작 후 재생 시도
    const audioSrc = await page.evaluate(() => {
      const a = document.getElementById('bgm');
      return a ? a.getAttribute('src') : null;
    });
    assert.ok(audioSrc && /audio\/bgm-boss-battle\.mp3$/.test(audioSrc), `bgm audio src points at the track (got ${audioSrc})`);

    // 3i) 효과음 게이팅 훅
    const sfxGated = await page.evaluate(() => {
      localStorage.setItem('soundOn', '0');
      return window.FGH.Settings.sfxEnabled();
    });
    assert.strictEqual(sfxGated, false, 'sfxEnabled() reflects soundOn=0');
    await page.evaluate(() => localStorage.setItem('soundOn', '1'));
```

그리고 `// 5) 목숨 소진 경로` 뒤(결과 오버레이 검증 후)에:

```js
    // 7) musicOn=1 로 새 게임 → bgm 이 재생 시도됨 (헤드리스 자동재생 허용 가정)
    await page.evaluate(() => localStorage.setItem('musicOn', '1'));
    await page.evaluate(() => window.__debugStartGame());
    await waitIntroDone();
    await new Promise((r) => setTimeout(r, 300));
    const bgmPlaying = await page.evaluate(() => {
      const a = document.getElementById('bgm');
      return a && !a.paused;
    });
    assert.ok(bgmPlaying, 'bgm plays after start when musicOn=1');
    // 설정에서 끄면 멈춘다
    await page.evaluate(() => window.FGH.Settings.set('music', false));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(await page.evaluate(() => document.getElementById('bgm').paused), true, 'bgm pauses when music turned off');
    await page.evaluate(() => localStorage.removeItem('musicOn'));
```

- [ ] **Step 3: 스모크 실패 확인**

Run: `PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js` → `kill %1`
Expected: FAIL — `#bgm` 없음

- [ ] **Step 4: `mole/index.html` 에 `<audio>` 추가**

`<div class="cosmic-bg">` 바로 다음 줄:

```html
  <audio id="bgm" loop preload="auto" src="audio/bgm-boss-battle.mp3"></audio>
```

- [ ] **Step 5: `mole/js/game.js` — BGM 제어**

파일 상단 상수 근처에 추가:

```js
  var BGM_VOLUME = 0.35;
```

IIFE 안, `DOMContentLoaded` 리스너 안에 BGM 배선 추가 (기존 리스너 안 `window.__debugStartGame = startGame;` 앞):

```js
    var bgm = document.getElementById('bgm');
    bgm.volume = BGM_VOLUME;
    function syncBgm(playIntent) {
      var want = window.FGH.Settings.get('music') && playIntent;
      if (want) { bgm.play().catch(function () { /* 자동재생 차단 — 다음 제스처에 재시도 */ }); }
      else { bgm.pause(); }
    }
    window.__moleBgm = { el: bgm, sync: syncBgm };
    window.FGH.Settings.onChange(function (name) {
      if (name === 'music') syncBgm(state && !state.ended);
    });
```

`startGame()` 안 — `document.getElementById('game-screen').hidden = false;` 다음 줄:

```js
    if (window.__moleBgm) window.__moleBgm.sync(true);
```

`showStartScreen()` 안 — `state = null;` 다음 줄:

```js
    if (window.__moleBgm) window.__moleBgm.sync(false); // 허브로 나가면 정지
```

(결과 화면에선 계속 재생 — `endGame` 에선 아무것도 안 함. 스펙 §13 결정: 결과 화면 BGM 유지, 허브 복귀 시 정지.)

- [ ] **Step 6: `mole/js/hit-fx.js` — 게이팅**

`tone()` 함수 맨 앞:

```js
  function tone(freq, type) {
    if (window.FGH && window.FGH.Settings && !window.FGH.Settings.sfxEnabled()) return;
    try {
      ...
```

`vibrate()` 헬퍼를 교체:

```js
  function vibrate(pattern) {
    if (window.FGH && window.FGH.Settings) window.FGH.Settings.vibrate(pattern);
    else if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* noop */ } }
  }
```

- [ ] **Step 7: `mole/sw.js` — 캐시 bump + SHELL**

```js
const CACHE = 'mole-game-v6';
```

`SHELL` 배열에 추가:

```js
  './audio/bgm-boss-battle.mp3',
  '../common/settings.js',
  '../common/i18n.js',
  '../common/settings.css',
  './js/i18n-strings.js',
```

(주의: `../common/*` 는 SW scope 밖이라 `cache.addAll` 이 실패할 수 있다. 실패 시 install 이 통째로 깨지므로, `addAll(SHELL)` 을 `Promise.allSettled` 기반 개별 `cache.add` 로 바꾸거나 `../common/*` 를 SHELL 에서 빼고 런타임 SWR 에 맡긴다. **구현 시**: 먼저 `addAll` 로 시도하고 배포 후 `curl`/DevTools 로 확인 — 실패하면 개별 add 로 전환. BGM 6.8MB 도 install 을 느리게 하면 SHELL 에서 빼고 런타임 캐시로.)

- [ ] **Step 8: 로직 테스트 + 스모크 통과 확인**

Run: `cd fun-games-hub && node mole/scripts/run-all-tests.js`
Expected: 그대로 그린

Run: `PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js` → `kill %1`
Expected: `verify-mole-smoke.js: all assertions passed`

- [ ] **Step 9: 지렁이 회귀 확인 (변경 없음 재확인)**

Run: `PORT=8846 node scripts/serve.js &` → `SMOKE_PORT=8846 node snake/scripts/verify-snake-smoke.js` (env 미지원이면 스크립트 포트 확인 후 실행) → `kill %1`
Expected: `verify-snake-smoke.js: all assertions passed`
(지렁이 스모크가 `SMOKE_PORT` 를 안 받으면 이 스텝은 "포트 하드코딩 확인 후 해당 포트로 서버 띄워 실행"으로 처리 — 지렁이 파일은 수정 금지.)

- [ ] **Step 10: 커밋**

```bash
cd fun-games-hub
git add mole/audio/bgm-boss-battle.mp3 mole/index.html mole/js/game.js mole/js/hit-fx.js mole/sw.js mole/scripts/verify-mole-smoke.js
git commit -m "$(cat <<'EOF'
feat(mole): 보스 BGM + 효과음/진동을 공용 설정에 연동

bgm-boss-battle.mp3(CC0) 복사. 시작 버튼 제스처 후 musicOn 이면 재생,
설정에서 끄면 정지, 허브 복귀 시 정지. hit-fx tone()은 sfxEnabled(),
vibrate()는 Settings.vibrate() 게이트. sw 캐시 v5→v6.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 8: 그림맞추기 — i18n

**Files:**
- Modify: `match/index.html`

**Interfaces:**
- Consumes: `FGH.I18N`
- Produces: placeholder 문구가 `appLang` 을 따름.

- [ ] **Step 1: `match/index.html` 수정**

`<head>` 에 `../cosmic-theme.css` 링크 다음:

```html
<link rel="stylesheet" href="../common/settings.css">
```

문구에 `data-i18n`:
- `<title>그림맞추기</title>` → `<title data-i18n="match.title">그림맞추기</title>`
- `<h1 class="placeholder-title">그림맞추기</h1>` → `... data-i18n="match.title">그림맞추기</h1>`
- `<p class="placeholder-desc">준비 중이에요. 곧 만나요!</p>` → `... data-i18n="match.desc">준비 중이에요. 곧 만나요!</p>`
- `<a class="back-btn" href="../index.html">← 허브로</a>` → `<a class="back-btn" href="../index.html"><span data-i18n="common.toHub">허브로</span></a>` (화살표는 CSS `::before` 또는 그냥 텍스트로 두되 번역 대상 아님 — 간단히 `<a ...>← <span data-i18n="common.toHub">허브로</span></a>`)

`</body>` 앞:

```html
<script src="../common/settings.js"></script>
<script src="../common/i18n.js"></script>
<script>
  window.FGH.I18N.register({
    ko: { 'match.title': '그림맞추기', 'match.desc': '준비 중이에요. 곧 만나요!' },
    en: { 'match.title': 'Match', 'match.desc': 'Coming soon!' }
  });
  window.FGH.I18N.applyStatic(document);
</script>
```

- [ ] **Step 2: 수동 확인**

Run: `cd fun-games-hub && PORT=8846 node scripts/serve.js &`
브라우저로 `http://localhost:8846/match/index.html` — 한국어로 뜨는지. 그다음
`http://localhost:8846/match/index.html` 콘솔에서 `localStorage.appLang='en';location.reload()` → `Match` / `Coming soon!` / `Hub`.
Run: `kill %1`
Expected: 두 언어 다 정상.

- [ ] **Step 3: 커밋**

```bash
cd fun-games-hub
git add match/index.html
git commit -m "$(cat <<'EOF'
feat(match): placeholder 한/영 다국어

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CNspuQWpVSMKvZXd7hd1gX
EOF
)"
```

---

## Task 9: 마무리 검증 + 메모리 갱신

**Files:**
- 없음 (검증 + 메모리 파일만)

- [ ] **Step 1: 전체 테스트 스위트**

```bash
cd fun-games-hub
node common/scripts/run-all-tests.js
node mole/scripts/run-all-tests.js
PORT=8846 node scripts/serve.js &
SMOKE_PORT=8846 node common/scripts/verify-settings-ui-smoke.js
SMOKE_PORT=8846 node scripts/verify-hub-smoke.js
SMOKE_PORT=8846 node mole/scripts/verify-mole-smoke.js
# 지렁이: 해당 스모크의 포트 규약대로 실행
kill %1
```
Expected: 전부 `all assertions passed` / `all ... tests passed`.

- [ ] **Step 2: Edge 스크린샷 육안 확인**

`scratchpad` 에 puppeteer 스크립트로: 허브(한국어), 허브(영어 전환 후), 설정 모달, 두더지 시작화면(영어), 두더지 플레이 1판. 레이아웃 깨짐/문구 넘침 없나.

- [ ] **Step 3: 메모리 갱신**

`C:\Users\master\.claude\projects\C--Users-master-Desktop\memory\fun-games-hub.md` 에 이번 라운드(허브 셸 + 공용 설정/i18n + 두더지 BGM) 구현 완료를 요약 추가. "Still open" 목록 갱신. 커밋은 됐고 **push 는 사용자 확인 후**임을 명시.

- [ ] **Step 4: 사용자에게 push 여부 확인**

푸시하면 GitHub Pages 가 ~1-2분 뒤 재배포됨. 사용자에게 로컬 미리보기(미리보기.bat)로 먼저 확인하도록 안내하고 push 여부를 물어본다.

---

## Self-Review

**1. Spec coverage:**

| 스펙 요구 | Task |
|---|---|
| §3 저장키 통일 + 기본값 | Task 2 (`Settings.KEYS`, `BOOL_DEFAULT`) |
| §4.1 `Settings` API | Task 2 |
| §4.2 `I18N` API | Task 3 |
| §4.3 `SettingsUI` (허브 전용, 인라인 SVG, 3토글+언어) | Task 4 |
| §5 허브 재작성 (탭바 4개, 우상단, i18n) | Task 5 |
| §6 두더지 i18n (data-i18n + 동적 t()) | Task 6 |
| §6 두더지 BGM (복사, 제스처 후, musicOn 연동, 볼륨 0.35) | Task 7 |
| §6 hit-fx SFX/진동 게이팅 | Task 7 |
| §6 sw.js v6 + SHELL | Task 7 |
| §7 그림맞추기 i18n | Task 8 |
| §8 오디오/진동 표 | Task 7 |
| §9 문구 인벤토리 ko/en (공용/허브/두더지/그림맞추기) | Task 4/5/6/8 |
| §10.1 단위 테스트 (settings/i18n) | Task 2/3 |
| §10.2 스모크 (허브/두더지 확장/지렁이 회귀) | Task 5/6/7 |
| §11 커밋 계획 A~E | Task 1/2·3·4/5/6·7/8 |
| §12 확정 결정 | Global Constraints 에 반영 |
| §13 미결 (CSS 분리 / 인디케이터 / SHELL 선캐시 / 결과화면 BGM) | Task 5(CSS 분리함), Task 7 Step 5(결과화면 BGM 유지)·Step 7(SHELL 판단) |

갭 없음. (탭 인디케이터 슬라이드는 스펙 §13 "미결, 되돌리기 쉬움" — 넣지 않기로 결정, `aria-selected` 색상 변화로 충분.)

**2. Placeholder scan:** "TBD"/"적절히"/"등등" 없음. Task 7 Step 7 의 SW SHELL 판단은 구체적 대안 2개(개별 add / 런타임 SWR)와 판단 기준(배포 후 curl 확인)을 명시 — placeholder 아님.

**3. Type consistency:**
- `Settings.get(name)` 이름: `'lang'|'sound'|'music'|'vibration'` — Task 2 정의, Task 4/5/6/7 에서 동일하게 사용. ✓
- `Settings.set(name, value)`, `Settings.onChange(cb)` 반환 해제함수 — Task 2 정의, Task 4 `S.onChange(...)` 사용. ✓
- `I18N.t(key, vars)`, `.register(dict)`, `.applyStatic(rootEl)`, `.setLang(l)`, `.onChange(cb)`, `.lang` getter — Task 3 정의, Task 4/5/6/8 에서 동일 시그니처 사용. ✓
- `SettingsUI.mount()` — Task 4 정의, Task 5 `hub.js` 에서 `window.FGH.SettingsUI.mount()`. ✓
- DOM id: `#fgh-settings-btn`/`#fgh-lang-btn`/`#fgh-lang-menu`/`#fgh-settings-modal`/`#fgh-settings-close`/`.fgh-set-row[data-set]`/`.fgh-set-toggle` — Task 4 마크업과 Task 4·5 스모크가 일치. ✓
- 탭: `.fgh-tab[data-tab="score|album|home|shop"]`, `.fgh-tab-lbl`, 화면 `#{tab}-screen` — Task 5 마크업/`hub.js`/스모크 일치. ✓
- `window.__moleBgm.sync(playIntent)` — Task 7 Step 5 정의·사용 일관. ✓
- 두더지 디버그훅 이름은 Task 1 Produces 와 기존 코드 일치(`__debugStartGame` 등). ✓

이상 없음.

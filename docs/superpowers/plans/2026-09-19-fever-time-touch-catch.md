# 피버타임(터치캐치 보너스타임) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두더지팡 라운드2에서 콤보 100 달성 시, 라운드 타이머를 멈추고 게임보드와
버튼보드(다이얼패드)를 서로 자리 교차 스왑한 뒤, 버튼보드는 콤보/잔여시간 전광판이 되고
넓어진 게임화면에서 20초간 두더지를 직접 터치해 잡는 보너스타임을 구현한다.

**Architecture:** 기존 `js/game.js`의 메인 루프·콤보 훅·`state.laneHammer.strike()` API,
`js/lane-controls.js`의 다이얼패드 렌더링을 그대로 재사용한다. 새로 추가하는 것은 (1) 피버
상태 필드와 트리거, (2) 버튼보드 전체 회전+전광판 전환, (3) 보드↔버튼보드 위치 교차 스왑
애니메이션, (4) 게임보드 직접 터치 → 기존 `handleCell(regionId)` 호출로 잇는 좌표 역산
레이어. 기존 콤보50 점수배율 피버(`isFever()`)는 전혀 건드리지 않는다.

**Tech Stack:** 순수 HTML/CSS/JS(빌드 도구 없음, 모듈은 `(function(root){...})(window)` IIFE
패턴). 자동 검증은 이 저장소 기존 관례대로 `puppeteer-core` + 로컬 Edge
(`scripts/verify-hub-smoke.js` 패턴)로 DOM 상태를 assert한다 — 이 프로젝트엔 pytest/jest 같은
단위테스트 프레임워크가 없으므로, 각 태스크의 "테스트"는 이 방식의 스모크 스크립트다. 애니메이션
타이밍·실기기 느낌은 **폰 앱(PWA) 실기기 확인이 최종 기준**([[laptop-vs-phone-render-mismatch]]
메모리 참고) — 코드 완성과 실기기 확인은 별개 단계로 명시한다.

**Spec:** `docs/superpowers/specs/2026-09-19-fever-time-touch-catch-design.md`

## Global Constraints

- 1차 구현·테스트 범위는 **라운드2에서만** 발동 (`currentChapter() === 2`). 검증 후 Task 6에서
  `!== 1`로 한 줄만 바꿔 라운드2~8로 확대한다.
- 라운드당 1회만 발동, 재발동 없음.
- 기존 콤보50 배율 피버(`isFever()`, `SCORE_MULT`, `updateFeverHud()`)는 이름·동작 전부
  그대로 유지 — 이 작업에서 절대 수정하지 않는다.
- 피버 20초는 헛방/시간초과로 조기종료되지 않는다 — 항상 20초 다 채운다.
- 매 커밋 뒤 `mole/index.html`의 `#build-tag`, `mole/sw.js`의 `CACHE`, `mole/index.html`의
  `register('sw.js?v=N')` 3곳을 버전 +1 동기화한다(이 저장소 기존 관례).

---

### Task 1: 피버 상태 필드 + 트리거 + 라운드 타이머 프리즈

**Files:**
- Modify: `mole/js/game.js` (상수 선언부 `COMBO_LIFE_STEP` 근처, `checkComboLifeBonus()`
  함수, 메인 루프 `loop()`의 타이머 감소 블록 `js/game.js:1657-1663`)
- Test: `mole/verify-fever-trigger.js` (신규)

**Interfaces:**
- Consumes: `run.combo.combo`(getter, `combo-score.js`), `currentChapter()`(기존 함수),
  `state.timeRemaining`(기존 필드)
- Produces: `state.feverEventDone`(bool), `state.feverEventActive`(bool),
  `state.pausedByFever`(bool), `state.feverEventUntil`(number, `performance.now()` 기준
  타임스탬프), 함수 `startFeverEvent()`, `endFeverEvent()` — 이후 태스크에서 이 두 함수 안에
  연출 코드를 채워 넣는다.

- [ ] **Step 1: `state` 초기화 지점에 피버 필드 추가**

`js/game.js`에서 라운드 시작 시 `state = {...}`를 만드는 부분을 찾아(`state.timeRemaining`을
설정하는 바로 그 객체 리터럴) 아래 필드를 추가한다:

```js
feverEventDone: false,
feverEventActive: false,
pausedByFever: false,
feverEventUntil: 0,
```

- [ ] **Step 2: 트리거 함수 추가**

`checkComboLifeBonus()` 함수 바로 위에 새 함수를 추가한다(`js/game.js:2093` 근처):

```js
// 피버타임(터치캐치 보너스타임) 트리거 — 콤보100, 라운드당 1회, 1차 테스트는 라운드2만
// (사용자 지정: "일단 테스트가 되어야하니, 라운드2에서만 적용해줘" — 검증 후 !== 1 로 확대).
// 기존 콤보50 점수배율 피버(isFever())와는 완전히 별개, 서로 건드리지 않는다.
function checkFeverEventTrigger() {
  if (state.feverEventDone || state.feverEventActive) return;
  if (currentChapter() !== 2) return;
  if (run.combo.combo < 100) return;
  state.feverEventDone = true;
  startFeverEvent();
}
```

`checkComboLifeBonus()` 함수 본문 맨 끝(`showComboHeartPop();` 다음 줄, 함수의 닫는 `}` 전)에
호출을 추가한다:

```js
      showComboHeartPop(); // 상단에 "+❤️" 이모티콘 (콤보 100 달성)
    }
    checkFeverEventTrigger();
  }
```

(주의: `checkComboLifeBonus()`는 `if (step > run.comboMilestone) { ... }` 블록 안에서만
`showComboHeartPop()`을 부르므로, `checkFeverEventTrigger()`는 그 블록 **밖**, 함수 맨 끝에
둬서 콤보가 100 미만일 때도 항상 호출되게 한다 — 함수 내부에서 자체적으로 100 미만이면
바로 return하므로 안전하다.)

- [ ] **Step 3: `startFeverEvent()` / `endFeverEvent()` 최소 구현 (연출은 아직 없음)**

`checkFeverEventTrigger()` 바로 아래에 추가:

```js
function startFeverEvent() {
  state.feverEventActive = true;
  state.pausedByFever = true;
  state.feverEventUntil = performance.now() + 20000;
  setTimeout(endFeverEvent, 20000);
}
function endFeverEvent() {
  state.pausedByFever = false;
  state.feverEventActive = false;
}
```

- [ ] **Step 4: 메인 루프 타이머 감소를 `pausedByFever`로 감싸기**

`js/game.js:1657-1663`을 찾는다:

```js
    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      roundComplete();
      return;
    }
```

아래로 교체(스폰/망치 업데이트는 계속 돌아야 하므로 시간 감소·종료판정만 감싼다):

```js
    if (!state.pausedByFever) {
      state.timeRemaining -= dt;
      if (state.timeRemaining <= 0) {
        state.timeRemaining = 0;
        updateHUD();
        roundComplete();
        return;
      }
    }
```

- [ ] **Step 5: 스모크 테스트 작성**

`mole/verify-fever-trigger.js` 생성 (기존 `scripts/verify-hub-smoke.js` 패턴, 로컬 서버는
`scripts/serve.js`를 `mole/` 루트로 띄운 상태 가정 — Step 6에서 실행 방법 설명):

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8847;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());

    // 라운드2 진입 후 콤보를 강제로 100까지 올려 트리거 확인.
    // __debugState 는 없으므로, 콤보 객체를 직접 100번 hit() 시켜 트리거를 재현한다.
    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.__MG_TEST_START_ROUND2 && window.__MG_TEST_START_ROUND2();
        setTimeout(() => {
          const g = window.__MG_TEST_STATE();
          for (let i = 0; i < 100; i++) g.run.combo.onMoleHit();
          g.checkComboLifeBonus();
          setTimeout(() => {
            const s = g.state;
            resolve({
              feverEventActive: s.feverEventActive,
              pausedByFever: s.pausedByFever,
              timeAfterTrigger: s.timeRemaining
            });
          }, 50);
        }, 300);
      });
    });
    assert.strictEqual(result.feverEventActive, true, 'fever event active after combo 100');
    assert.strictEqual(result.pausedByFever, true, 'round timer paused during fever');
    console.log('verify-fever-trigger.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

이 테스트가 요구하는 디버그 훅(`window.__MG_TEST_START_ROUND2`, `window.__MG_TEST_STATE`)이
아직 없다면, `js/game.js` 최상위 스코프 끝(기존 `__debugSetWeapon` 등 디버그 훅이 모여있는
자리)에 추가한다:

```js
window.__MG_TEST_START_ROUND2 = () => { startRound(2); }; // startRound(chapter) 기존 함수명에 맞춰 조정
window.__MG_TEST_STATE = () => ({ state, run, checkComboLifeBonus });
```

(`startRound`가 실제 함수명이 아니면, 라운드2를 시작시키는 기존 함수/경로를 찾아 그 이름으로
바꾼다 — `__debugSetWeapon` 등 기존 디버그 훅 근처에서 라운드 시작 함수를 확인할 것.)

- [ ] **Step 6: 로컬 서버로 테스트 실행**

```bash
cd fun-games-hub
node scripts/serve.js &   # PORT 기본 8844, 필요시 PORT=8847 node scripts/serve.js
SMOKE_PORT=8847 node mole/verify-fever-trigger.js
```

Expected: `verify-fever-trigger.js: all assertions passed` 출력.

- [ ] **Step 7: 커밋**

```bash
cd fun-games-hub
git add mole/js/game.js mole/verify-fever-trigger.js
git commit -m "두더지팡: 피버타임 상태/트리거/타이머프리즈 추가 (연출 없음, 라운드2 전용)"
```

---

### Task 2: 버튼보드 전체 회전 + 전광판 얼굴

**Files:**
- Modify: `mole/index.html` (`#lane-button-bar` 안, `js/game.js:543` 근처)
- Modify: `mole/js/lane-controls.js` (`spinChannelsIn()` 옆에 새 함수 추가, `js/lane-controls.js:355`의 반환 객체)
- Modify: `mole/style.css`
- Test: `mole/verify-fever-scoreboard.js` (신규)

**Interfaces:**
- Consumes: 없음 (독립 UI 조각)
- Produces: `sharedLaneControls.spinBoardBlank(toBlank)` — `toBlank`가 true면 버튼보드를
  10바퀴 회전시키며 숫자 그리드를 숨기고 전광판을 보이게, false면 반대로 회전시키며 숫자
  그리드를 복원. 콜백 없이 동기 시작, 애니메이션은 CSS transition으로 처리(0.9초).
  전광판 갱신 함수 `sharedLaneControls.setFeverScoreboard(comboVal, secondsLeft)`.

- [ ] **Step 1: 전광판 마크업 추가**

`mole/index.html`의 `#lane-button-bar` 안, `#build-tag` 바로 다음에 추가:

```html
<div id="fever-scoreboard" class="fever-scoreboard" hidden>
  <div class="fever-scoreboard-label" data-i18n="mole.fever.label">FEVER!</div>
  <div class="fever-scoreboard-combo"><b id="fever-sb-combo">0</b> COMBO</div>
  <div class="fever-scoreboard-time" id="fever-sb-time">20</div>
</div>
```

- [ ] **Step 2: i18n 문구 추가**

`mole/js/i18n-strings.js`의 `'mole.shop.watchAdBtn': '광고보기',` 줄(한국어 섹션,
`i18n-strings.js:171` 근처) 바로 아래에 추가:

```js
      'mole.fever.label': 'FEVER!',
```

같은 파일의 `'mole.shop.watchAdBtn': 'Watch Ad',` 줄(영어 섹션, `i18n-strings.js:383` 근처)
바로 아래에 추가:

```js
      'mole.fever.label': 'FEVER!',
```

- [ ] **Step 3: 전광판 CSS**

`mole/style.css`의 `#lane-button-bar` 규칙(`style.css:1380`) 바로 아래에 추가:

```css
/* 피버타임 전광판(사용자 지정: "전광판처럼 콤보 표기, 남은 타임 표기") — 버튼보드 자리를
   그대로 덮는 절대배치 오버레이. 평소엔 hidden, 피버 중에만 표시. */
.fever-scoreboard {
  position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  background: linear-gradient(180deg, #1a1a2e, #0f0f1e);
  border-radius: 8px 8px 0 0; color: #ffce33; text-align: center;
}
.fever-scoreboard-label { font-size: 1.3rem; font-weight: 900; letter-spacing: 0.05em;
  text-shadow: 0 0 8px rgba(255, 206, 51, 0.8); }
.fever-scoreboard-combo { font-size: 0.85rem; font-weight: 700; color: #fff; }
.fever-scoreboard-combo b { color: #ffce33; font-size: 1.1em; }
.fever-scoreboard-time { font-size: 2.2rem; font-weight: 900; color: #fff; line-height: 1; }
```

- [ ] **Step 4: `spinBoardBlank()` 함수 추가**

`mole/js/lane-controls.js`의 `spinChannelsIn()` 함수(`js/lane-controls.js:310`) 바로 뒤에
추가. `simple` 분기가 이미 쓰는 "버튼보드 전체를 rotateY로 돌리는" 기법을 그대로 재사용하되,
`simple` 여부와 무관하게 항상 전체 바를 돌리고, 회전 끝에 전광판을 토글한다:

```js
// 피버타임(터치캐치 보너스타임) 전용 — 버튼보드 전체를 10바퀴 회전시켜 숫자판↔전광판을
// 전환한다. spinChannelsIn()의 simple 분기와 같은 "버튼보드 통째로 rotateY" 기법을 재사용
// (일반 모드의 spinChannelsIn()은 버튼 개별 플립이라 이 용도엔 안 맞음).
function spinBoardBlank(toBlank) {
  if (!buttonBar) return;
  const scoreboard = document.getElementById('fever-scoreboard');
  buttonBar.style.transition = 'none';
  buttonBar.style.transform = 'perspective(1200px) rotateY(0deg)';
  void buttonBar.offsetWidth;
  buttonBar.style.transition = 'transform 0.9s cubic-bezier(.2, .7, .3, 1)';
  buttonBar.style.transform = 'perspective(1200px) rotateY(' + (toBlank ? 3600 : 3600) + 'deg)';
  setTimeout(() => {
    if (scoreboard) scoreboard.hidden = !toBlank;
    Array.prototype.forEach.call(buttonBar.querySelectorAll('.lane-button'), (b) => {
      b.style.visibility = toBlank ? 'hidden' : '';
    });
  }, 450); // 회전 절반(뒤집힌 순간) 시점에 얼굴 전환 — 정면에서 전환이 안 보이게
  setTimeout(() => { buttonBar.style.transition = ''; buttonBar.style.transform = ''; }, 950);
}
function setFeverScoreboard(comboVal, secondsLeft) {
  const c = document.getElementById('fever-sb-combo');
  const t = document.getElementById('fever-sb-time');
  if (c) c.textContent = String(comboVal);
  if (t) t.textContent = String(Math.max(0, Math.ceil(secondsLeft)));
}
```

- [ ] **Step 5: 반환 객체에 노출**

`js/lane-controls.js:355`:

```js
    return { setCellHot, setBombIndicator, setHudStat, flashBurst, flashQuakeArea, setActiveNav, clear, spinChannelsIn };
```

를 아래로 교체:

```js
    return { setCellHot, setBombIndicator, setHudStat, flashBurst, flashQuakeArea, setActiveNav, clear, spinChannelsIn, spinBoardBlank, setFeverScoreboard };
```

- [ ] **Step 6: 스모크 테스트**

`mole/verify-fever-scoreboard.js` 생성:

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8847;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

    const before = await page.evaluate(() => document.getElementById('fever-scoreboard').hidden);
    assert.strictEqual(before, true, 'scoreboard hidden by default');

    await page.evaluate(() => {
      window.__MG_TEST_LANE_CONTROLS().spinBoardBlank(true);
    });
    await new Promise((r) => setTimeout(r, 1000));
    const after = await page.evaluate(() => document.getElementById('fever-scoreboard').hidden);
    assert.strictEqual(after, false, 'scoreboard shown after spinBoardBlank(true)');

    await page.evaluate(() => {
      window.__MG_TEST_LANE_CONTROLS().setFeverScoreboard(123, 7.4);
    });
    const combo = await page.evaluate(() => document.getElementById('fever-sb-combo').textContent);
    const time = await page.evaluate(() => document.getElementById('fever-sb-time').textContent);
    assert.strictEqual(combo, '123', 'combo number rendered');
    assert.strictEqual(time, '8', 'time rounds up');

    console.log('verify-fever-scoreboard.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

`window.__MG_TEST_LANE_CONTROLS`가 없다면 Task 1의 디버그 훅 옆에 추가:
`window.__MG_TEST_LANE_CONTROLS = () => sharedLaneControls;`

- [ ] **Step 7: 실행 확인**

```bash
node scripts/serve.js &
SMOKE_PORT=8847 node mole/verify-fever-scoreboard.js
```

Expected: `all assertions passed`.

- [ ] **Step 8: 커밋**

```bash
git add mole/index.html mole/js/lane-controls.js mole/style.css mole/verify-fever-scoreboard.js
git commit -m "두더지팡: 피버타임 버튼보드 회전+전광판 얼굴 추가"
```

---

### Task 3: 게임보드 ↔ 버튼보드 위치 교차 스왑

**Files:**
- Modify: `mole/js/game.js`
- Modify: `mole/style.css`
- Test: `mole/verify-fever-swap.js` (신규)

**Interfaces:**
- Consumes: `#mole-board`, `#lane-button-bar` (기존 DOM, 둘 다 `width: var(--sq); aspect-ratio: 1; position: relative;`)
- Produces: `swapBoardPositions(toSwapped)` 함수(`js/game.js` 내부, 모듈 스코프) — FLIP 기법으로
  두 요소를 서로의 자리로 애니메이션.

- [ ] **Step 1: CSS 트랜지션 클래스 추가**

`mole/style.css`에 추가(위치는 `.mole-board` 규칙 근처):

```css
/* 피버타임 보드 교차 스왑(사용자 지정: "서로 교차되면서 내려오는 방식") — FLIP 기법으로
   JS가 매긴 translateY 를 이 transition 이 부드럽게 만든다. */
.mole-board, #lane-button-bar { transition: none; }
.fever-swap-animating { transition: transform 0.6s cubic-bezier(.4, 0, .2, 1) !important; }
```

- [ ] **Step 2: `swapBoardPositions()` 함수 추가**

`js/game.js`의 `startFeverEvent()` 함수 바로 위에 추가:

```js
// 게임보드↔버튼보드 자리 교차 스왑(FLIP 기법) — toSwapped=true 면 보드가 아래로, 버튼보드가
// 위로. 두 요소는 같은 폭(--sq)의 정사각형이라 서로 상대 위치로 translateY 만 하면 된다.
let boardSwapped = false;
function swapBoardPositions(toSwapped) {
  if (toSwapped === boardSwapped) return;
  const board = document.getElementById('mole-board');
  const bar = document.getElementById('lane-button-bar');
  if (!board || !bar) return;
  const boardRect = board.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const delta = barRect.top - boardRect.top; // 보드가 버튼보드 자리로 가려면 +delta 만큼 아래로
  [board, bar].forEach((el) => { el.classList.add('fever-swap-animating'); });
  board.style.transform = toSwapped ? `translateY(${delta}px)` : '';
  bar.style.transform = toSwapped ? `translateY(${-delta}px)` : '';
  setTimeout(() => {
    board.classList.remove('fever-swap-animating');
    bar.classList.remove('fever-swap-animating');
  }, 650);
  boardSwapped = toSwapped;
}
```

(참고: `translateY`만으로는 두 요소의 **DOM 순서**가 안 바뀌므로 z-index 문제가 없다 — 시각적
자리만 교차하고, 실제 레이아웃 흐름은 그대로. 터치 판정(Task 4)은 화면 좌표 기준이라 이 방식과
호환된다.)

- [ ] **Step 3: `startFeverEvent()`/`endFeverEvent()`에 연결**

Task 1에서 만든 두 함수를 아래로 교체:

```js
function startFeverEvent() {
  state.feverEventActive = true;
  state.pausedByFever = true;
  if (sharedLaneControls) sharedLaneControls.spinBoardBlank(true);
  swapBoardPositions(true);
  state.feverEventUntil = performance.now() + 20000;
  setTimeout(endFeverEvent, 20000);
}
function endFeverEvent() {
  swapBoardPositions(false);
  if (sharedLaneControls) sharedLaneControls.spinBoardBlank(false);
  state.pausedByFever = false;
  state.feverEventActive = false;
}
```

- [ ] **Step 4: 스모크 테스트**

`mole/verify-fever-swap.js`:

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8847;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

    const before = await page.evaluate(() => {
      const b = document.getElementById('mole-board');
      return getComputedStyle(b).transform;
    });
    assert.strictEqual(before, 'none', 'board not transformed before swap');

    await page.evaluate(() => window.__MG_TEST_SWAP(true));
    await new Promise((r) => setTimeout(r, 700));
    const after = await page.evaluate(() => {
      const b = document.getElementById('mole-board');
      return getComputedStyle(b).transform !== 'none';
    });
    assert.strictEqual(after, true, 'board transformed after swap(true)');

    await page.evaluate(() => window.__MG_TEST_SWAP(false));
    await new Promise((r) => setTimeout(r, 700));
    const reverted = await page.evaluate(() => {
      const b = document.getElementById('mole-board');
      return getComputedStyle(b).transform;
    });
    assert.strictEqual(reverted, 'none', 'board back to no transform after swap(false)');

    console.log('verify-fever-swap.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

디버그 훅 `window.__MG_TEST_SWAP = (v) => swapBoardPositions(v);` 를 Task 1 훅 옆에 추가.

- [ ] **Step 5: 실행 확인**

```bash
node scripts/serve.js &
SMOKE_PORT=8847 node mole/verify-fever-swap.js
```

Expected: `all assertions passed`.

- [ ] **Step 6: 커밋**

```bash
git add mole/js/game.js mole/style.css mole/verify-fever-swap.js
git commit -m "두더지팡: 피버타임 게임보드/버튼보드 교차 스왑 추가"
```

---

### Task 4: 게임보드 직접 터치 → 두더지 타격

**Files:**
- Modify: `mole/js/game.js`
- Test: `mole/verify-fever-touch.js` (신규)

**Interfaces:**
- Consumes: `state.spawnPoints`(기존, `{regionId, col, row, x, y}[]`), `handleCell(regionId)`
  (기존 함수, `js/game.js:1787`), `state.feverEventActive`
- Produces: `regionIdFromBoardPoint(fx, fy)` — 보드 내 분수 좌표(0~1)를 가장 가까운
  `regionId`로 변환. `#mole-board`에 피버 전용 `pointerdown` 리스너 등록.

- [ ] **Step 1: 좌표→구역 역산 함수 추가**

`js/grid-partition.js`의 `V_TOP=0.27`, `V_BOTTOM=0.88`, `gridSize` 공식과 정확히 대칭이 되게
`js/game.js`의 `handleCell` 함수(`js/game.js:1787`) 바로 위에 추가:

```js
// 피버타임 전용 — 보드 위 터치 좌표(0~1 분수)를 가장 가까운 구멍(regionId)으로 역산.
// grid-partition.js 의 partition()과 정확히 같은 격자 공식(V_TOP/V_BOTTOM, gridSize)을 뒤집는다.
const FEVER_GRID_V_TOP = 0.27;
const FEVER_GRID_V_BOTTOM = 0.88;
function regionIdFromBoardPoint(fx, fy) {
  const gridSize = Math.sqrt(state.spawnPoints.length);
  const vStep = gridSize > 1 ? (FEVER_GRID_V_BOTTOM - FEVER_GRID_V_TOP) / (gridSize - 1) : 0;
  let col = Math.round(fx * gridSize - 0.5);
  col = Math.max(0, Math.min(gridSize - 1, col));
  let row = vStep > 0 ? Math.round((fy - FEVER_GRID_V_TOP) / vStep) : 0;
  row = Math.max(0, Math.min(gridSize - 1, row));
  const sp = state.spawnPoints.find((s) => s.col === col && s.row === row);
  return sp ? sp.regionId : null;
}
```

- [ ] **Step 2: `#mole-board`에 피버 전용 터치 리스너 등록**

`js/game.js`에서 `sharedLaneControls = MG.LaneControls.create({...})` 호출부(약
`js/game.js:735`) 다음 줄, 같은 초기화 함수 안에 한 번만 등록되게 추가:

```js
    // 피버타임 전용 게임보드 직접 터치 — 평소엔 아무 리스너 없음(입력은 다이얼패드로만),
    // state.feverEventActive 일 때만 동작. handleCell()을 그대로 호출해 기존 타격 파이프라인
    // (콤보/점수/버스트/지진 전부 포함)을 그대로 재사용한다.
    const moleBoardEl = document.getElementById('mole-board');
    if (moleBoardEl) {
      moleBoardEl.addEventListener('pointerdown', (ev) => {
        if (!state || !state.feverEventActive) return;
        const rect = moleBoardEl.getBoundingClientRect();
        const fx = (ev.clientX - rect.left) / rect.width;
        const fy = (ev.clientY - rect.top) / rect.height;
        if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
        const regionId = regionIdFromBoardPoint(fx, fy);
        if (regionId != null) handleCell(regionId);
      });
    }
```

- [ ] **Step 3: 스모크 테스트**

`mole/verify-fever-touch.js`:

```js
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = process.env.SMOKE_PORT || 8847;

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 780 });
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });

    // regionIdFromBoardPoint 단위 검증 — 4x4 그리드에서 (0,0)칸 중심 좌표는 col0,row0.
    const regionId = await page.evaluate(() => {
      window.__MG_TEST_SETUP_SPAWNPOINTS(); // 4x4 spawnPoints 를 state 에 채우는 테스트 훅
      return window.__MG_TEST_REGION_FROM_POINT(0.125, 0.27); // col0,row0 중심 근사
    });
    assert.strictEqual(regionId, 0, 'top-left touch maps to regionId 0');

    // feverEventActive 가 false 면 터치가 handleCell 을 안 부르는 것 확인.
    const calledWhenInactive = await page.evaluate(() => {
      window.__MG_TEST_STATE().state.feverEventActive = false;
      let called = false;
      window.__MG_TEST_SET_HANDLECELL_SPY(() => { called = true; });
      document.getElementById('mole-board').dispatchEvent(
        new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
      return called;
    });
    assert.strictEqual(calledWhenInactive, false, 'touch ignored when fever not active');

    console.log('verify-fever-touch.js: all assertions passed');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
```

테스트 훅 3개를 Task 1 디버그 훅 옆에 추가:

```js
window.__MG_TEST_SETUP_SPAWNPOINTS = () => {
  const { spawnPoints } = MG.GridPartition.partition({ gridSize: 4 });
  if (state) state.spawnPoints = spawnPoints;
};
window.__MG_TEST_REGION_FROM_POINT = (fx, fy) => regionIdFromBoardPoint(fx, fy);
window.__MG_TEST_SET_HANDLECELL_SPY = (fn) => { /* 실제 handleCell 을 대체하지 않고, 호출 여부만
  확인하려면 handleCell 내부에서 이 스파이를 호출하도록 handleCell 첫 줄에
  `if (window.__feverTestSpy) window.__feverTestSpy();` 를 추가하고 여기서
  `window.__feverTestSpy = fn;` 로 등록한다. */ window.__feverTestSpy = fn; };
```

`handleCell(regionId)` 함수(`js/game.js:1787`) 첫 줄에 테스트 훅을 추가한다:

```js
  function handleCell(regionId) {
    if (window.__feverTestSpy) window.__feverTestSpy();
    if (!state || state.ended || state.introActive || state.paused) return false;
```

- [ ] **Step 4: 실행 확인**

```bash
node scripts/serve.js &
SMOKE_PORT=8847 node mole/verify-fever-touch.js
```

Expected: `all assertions passed`.

- [ ] **Step 5: 커밋**

```bash
git add mole/js/game.js mole/verify-fever-touch.js
git commit -m "두더지팡: 피버타임 게임보드 직접터치 → handleCell 연결"
```

---

### Task 5: 전광판 실시간 갱신 + 전체 흐름 연결

**Files:**
- Modify: `mole/js/game.js` (`updateHUD()` 함수, `js/game.js:1744`)

**Interfaces:**
- Consumes: `sharedLaneControls.setFeverScoreboard(comboVal, secondsLeft)`(Task 2),
  `state.feverEventActive`, `state.feverEventUntil`, `run.combo.combo`
- Produces: 없음(터미널 태스크 — 전체 플로우 완성)

- [ ] **Step 1: `updateHUD()`에 전광판 갱신 추가**

`js/game.js:1744`의 `updateHUD()` 함수 안, `updateFeverHud();` 호출 다음 줄에 추가:

```js
    updateFeverHud();
    updateInvincibleHud();
    if (state.feverEventActive && sharedLaneControls) {
      const secondsLeft = (state.feverEventUntil - performance.now()) / 1000;
      sharedLaneControls.setFeverScoreboard(run.combo.combo, secondsLeft);
    }
```

- [ ] **Step 2: 수동 통합 확인 (자동화 불가 구간 — 실제 20초 대기 필요)**

```bash
node scripts/serve.js
```

브라우저(또는 Puppeteer headful)로 `http://localhost:8844/mole/index.html` 접속 → 라운드2
시작 → 콤보를 100까지 올림(실제 플레이 또는 콘솔에서
`window.__MG_TEST_STATE().run.combo.combo`를 확인하며 진행) → 다음을 육안 확인:
1. 콤보100 순간 타이머 숫자가 멈춤
2. 버튼보드가 회전하며 전광판(콤보/카운트다운)으로 바뀜
3. 게임보드와 버튼보드가 자리를 바꿈(보드가 아래로, 버튼보드가 위로)
4. 전광판의 카운트다운이 20→0으로 줄어들고, 콤보 숫자도 실시간 갱신
5. 넓어진 화면에서 두더지를 터치하면 무기가 그 자리로 와서 타격 연출
6. 20초 후 자리가 원위치로 복귀하고 버튼보드가 다시 회전해 숫자판으로 돌아오며, 타이머가
   다시 줄어들기 시작

이 단계는 **puppeteer 스모크 테스트로 대체하지 않는다** — 애니메이션 타이밍/느낌은 실기기
확인이 최종 기준([[laptop-vs-phone-render-mismatch]])이므로, 이 Step은 사람이 직접 확인하고
다음 Step으로 넘어간다.

- [ ] **Step 3: 커밋**

```bash
git add mole/js/game.js
git commit -m "두더지팡: 피버타임 전광판 실시간 콤보/카운트다운 갱신"
```

---

### Task 6: 버전 동기화 + 배포 + 라운드2~8 확대 (사용자 검증 후)

**Files:**
- Modify: `mole/index.html` (`#build-tag`, `register('sw.js?v=N')`)
- Modify: `mole/sw.js` (`CACHE`)
- Modify: `mole/js/game.js` (`checkFeverEventTrigger()`의 라운드 조건, 확대 시점에만)

**Interfaces:**
- Consumes: 없음
- Produces: 없음(배포 태스크)

- [ ] **Step 1: 버전 3곳 동기화**

`mole/index.html`의 `#build-tag` 텍스트, `register('sw.js?v=N')`의 `N`, `mole/sw.js`의
`CACHE = 'mole-game-vN'`을 현재 최신 버전(v614) 기준으로 +1 해서 셋 다 같은 번호로 맞춘다.

- [ ] **Step 2: 커밋 + 푸시**

```bash
git add mole/index.html mole/sw.js
git commit -m "두더지팡: 피버타임(라운드2 테스트) 배포, vN"
git push origin master
```

- [ ] **Step 3: 사용자에게 실기기(폰 앱) 확인 요청**

커밋 해시와 버전 번호를 사용자에게 보고하고, 라운드2에서 실제로 20초 보너스타임이 의도대로
동작하는지 확인을 요청한다. **이 Step에서 사용자 승인 없이 Step 4로 넘어가지 않는다.**

- [ ] **Step 4: (사용자 승인 후) 라운드2~8로 확대**

`js/game.js`의 `checkFeverEventTrigger()`에서:

```js
  if (currentChapter() !== 2) return;
```

를:

```js
  if (currentChapter() === 1) return;
```

로 교체(사용자 지정: "테스트 완료되면 라운드 2~8까지 확대적용"). 버전 동기화 후 다시 커밋+푸시.

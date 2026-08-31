# 두더지 게임 — 레인 버튼 조작 + 대각 망치 타격 (설계)

**작성일:** 2026-08-31
**대상:** `mole/` (두더지 게임)
**한 줄 요약:** 두더지를 직접 터치하는 대신, 하단의 **열 버튼 4개**로 조작한다. 버튼을 누르면
망치가 **우측 하단에서 대각선으로 스윙**하며 그 열 두더지의 **모자 정수리**를 내리친다.
판정은 그 **열 전체**에 적용된다.

---

## 1. 배경 / 문제

현재는 두더지를 손가락으로 직접 탭하면 그 자리에 뿅망치 연출이 잠깐 뜬다
(`기획서 §5`, `hammer-fx.js`). 실제로 폰에서 해보면:

- 손가락이 두더지를 가려서 **타격 순간이 안 보인다**
- 망치가 손가락 밑에서 짧게 번쩍여서 **망치가 거의 안 보인다**
- 여러 마리가 동시에 뜨면 손가락이 화면을 왔다 갔다 해서 불편하다

두더지 게임의 재미는 **타격감**이다. 조작을 바꾸되 "쾅" 이 더 잘 꽂히게 만든다.

---

## 2. 조작 모델

### 2.1 레인 버튼

- 화면 하단에 **큰 버튼 4개**. 각 버튼 = 4×4 격자의 한 **열**(column 0~3).
- 버튼은 격자의 열과 가로로 정렬한다 (1번 버튼이 1번 열 아래).
- PC: 클릭 + 키보드 `1` `2` `3` `4`.
- 버튼은 항상 활성. 비활성/쿨다운 없음.

### 2.2 열 강타 판정 (`resolveColumn(col)`)

버튼을 누른 순간, 그 열에 떠 있는(등장 애니메이션 중이거나 대기 중인, `dying` 아닌)
모든 pop 을 판정한다:

| 대상 | 처리 |
|---|---|
| 두더지 (1히트) | 처치 — 영역 완성 + `comboScore.onMoleHit()` + 점수 |
| 두더지 (다타, 미완) | 한 단계 내려감 (`hitsTaken += 1`), 영역/콤보/점수 없음 (기존 `기획서 §5` 로직 그대로, 트리거만 열 단위) |
| 두더지 (다타, 최종타) | 처치 처리 |
| 동물 (일반) | 목숨 -1, 콤보 0 |
| 고글 동물 (폭탄) | 시간 -3초, 콤보 0 |

- **한 번에 두더지 2마리를 처치하면 콤보가 2 오른다** (`onMoleHit()` 를 마리당 호출).
- 다타 두더지 연타 쿨다운(`HIT_COOLDOWN = 0.12s`)은 그대로 유지 — 같은 두더지를
  0.12초 안에 두 번 판정하지 않는다.
- **동물이 있는 열을 치면 손해.** 레인을 보고 눌러야 한다 (스킬).
- **빈 열**을 누르면: 아무 판정 없음. 헛스윙 연출만. 페널티도 잠금도 없다.

### 2.3 버튼 표시 (초보 가이드)

- 그 열에 **두더지**가 떠 있으면 버튼이 은은하게 빛난다 (`--hot`).
- **동물 / 폭탄**은 버튼을 빛나게 하지 않는다 → 직접 격자를 보고 피해야 한다 (긴장 유지).

---

## 3. 망치 모션

망치는 **하나**. `#mole-board` 안 최상단 레이어(`#mole-hammer-layer`)에 산다.

### 3.1 상태 기계 (`lane-hammer.js`)

```
idle → (strike) → winding → swinging → impact → recovering → idle
```

- **축(pivot) = 보드 우측 하단.** 회전 각도가 어느 열을 때리는지 결정한다
  (넓게 젖힘 = 왼쪽 열, 좁게 = 오른쪽 열).
- `strike(col, targetYFrac, onImpact)`:
  1. **winding (~70ms):** 축을 목표 열 쪽으로 **짧게 슬라이드** + 어깨 뒤로 젖힘.
     이동을 예비동작 시간 안에 숨긴다 → 체감 지연 ≈ 0.
  2. **swinging (~60ms):** 대각선 아래로 스윙 + 목표 쪽으로 **전진(lunge)**.
     망치머리가 목표 두더지의 **모자 정수리 좌표**에 착지.
  3. **impact:** `onImpact()` 콜백 발화 (여기서 juice + 점수/목숨/시간 적용).
     히트스톱 동안 이 프레임에서 멈춘 듯 보인다.
  4. **recovering (~120ms):** 튕겨서 idle 로 복귀. **중단 가능.**
- **재조준:** impact 전에 새 `strike` 가 오면 애니메이션을 리셋하지 않고
  목표 각도만 새 열로 보간한다.
- **같은 열 연타:** 슬라이드 생략, 빠른 chop 반복.
- **목표 좌표 결정:**
  - 그 열의 두더지 중 `remaining` 이 가장 작은 놈(곧 사라질 놈)의 모자 정수리.
  - 두더지 없고 동물만 있으면 그 동물.
  - 완전히 비었으면 그 열 중앙 높이의 기본 구멍 위치 (헛스윙).
- 한 열에 두더지 2마리(다른 행)면: 빠른 **2연타 chop**, 아니면 1타.

### 3.2 구현

- CSS `transform`(회전 + 이동)을 JS가 매 프레임 계산해서 넣는다
  (`lane-hammer.update(dt)` 를 메인 루프에서 호출). 재조준·중단이 필요해서
  CSS transition 보다 JS 구동이 깔끔하다.
- 망치 스프라이트는 기존 `assets/hammer.png` 재사용 (필요하면 크게).
- `transform-origin` = 손잡이 끝(우측 하단).

---

## 4. 타격 연출 (juice) — 모자 정수리 기준

모든 효과는 **맞은 두더지의 모자 정수리 좌표**에 집중한다 (열 전체가 아니라).

`hit-fx.js` (`hammer-fx.js` 대체):

| 효과 | 내용 |
|---|---|
| 히트스톱 | 성공타 시 메인 루프 dt 를 **70ms** 정지 (콤보당 +10ms, 최대 120ms) |
| 화면 쉐이크 | `#mole-board` 를 스윙 방향(좌하 대각)으로 몇 px, ~200ms 감쇠 |
| 두더지 찌부 | 맞은 스프라이트 `scaleY(0.5)` 순간 압축 후 기존 sink 연출로 이어짐 |
| 모자 튕김 | `helmet.png` 스프라이트가 회전 + 중력으로 튀어 날아가 페이드 |
| 별 + "쾅!" | 정수리에 별 몇 개 + 만화체 "쾅!" 텍스트가 커지며 페이드 |
| 흙먼지 | 구멍 테두리에서 흙 파티클 몇 개 |
| 햅틱 | `navigator.vibrate(15)` (모바일, 가드) |
| 사운드 | WebAudio 합성 "톡" (에셋 없음), `playbackRate` ±10% 랜덤, 음소거 가능 |

- **헛스윙:** 낮고 둔한 "툭" + 흙먼지 조금. 쉐이크·히트스톱 없음.
- **동물 타격:** 금속성 "깡!" + 망치가 더 세게 튕김 + 해당 HUD(목숨/시간) 빨간 플래시.

---

## 5. 레이아웃

- `#game-screen` = 세로 flex: **HUD(위) / 보드(가운데) / 레인 버튼 바(아래)**.
- 보드: `aspect-ratio: 1` 유지. 최대폭을
  `min(100vw - 24px, 100dvh - HUD높이 - 버튼바높이 - gap)` 로.
- 레인 버튼 바: 전체폭, 버튼 4개 균등, 높이 ~72–88px, gap 8px,
  좌우 패딩은 보드와 맞춤. 버튼에 열 번호 1–4.
- 지금 플레이 화면 아래에 남던 빈 공간을 버튼 바가 채운다.
- HUD 자체는 이번 작업 범위 밖 (텍스트 한 줄 그대로 둔다).

---

## 6. 코드 구조

### 새 모듈

| 파일 | 역할 | 인터페이스 |
|---|---|---|
| `js/lane-controls.js` | 버튼 바 + 입력(포인터/키보드) | `create({ buttonBar, gridSize, onColumn })` → `{ setColumnHot(col, bool), clear() }` |
| `js/lane-hammer.js` | 망치 비주얼 + 상태 기계 | `create({ layer })` → `{ strike(col, targetYFrac, onImpact), update(dt), clear() }` |
| `js/hit-fx.js` | 타격 연출 스포너 (`hammer-fx.js` 대체) | `moleHit(boardEl, xFrac, yFrac, combo)`, `obstacleHit(boardEl, xFrac, yFrac, kind)`, `whiff(boardEl, colXFrac)` |

각 모듈은 게임 상태를 모른다. `lane-controls` 는 열 인덱스만 내보내고,
`lane-hammer`·`hit-fx` 는 순수 비주얼(fire-and-forget)이다.

### 변경

| 파일 | 변경 |
|---|---|
| `js/grid-partition.js` | 각 `spawnPoint` 에 `col`, `row` 추가 |
| `js/spawn-scheduler.js` | `resolveHit(popId)` → **`resolveColumn(col)`**: 그 열의 활성·비-dying pop 전부 판정, 결과 배열 `[{ type, regionId, done, xFrac, yFrac, hitsTaken, hitsRequired }]` 반환. 점수/목숨/시간은 호출자(game.js)가 적용 |
| `js/pop-elements.js` | pop 별 `pointerdown` 리스너 제거, `create({ container })` (onHit 삭제). `.mole-pop { pointer-events: none }`. 처치된 두더지 `flatten(popId)` (찌부 1회) 추가 |
| `js/game.js` | `handlePopHit(popId,x,y)` → **`handleColumn(col)`**: `scheduler.resolveColumn` + `laneHammer.strike` 호출, impact 콜백에서 juice·점수·목숨·시간·히트스톱 적용. `startLevel` 에서 `laneControls`/`laneHammer` 생성, 루프에서 `laneHammer.update(dt)`, 루프 dt 에서 히트스톱 차감. 버튼 hot 갱신 (매 프레임 각 열에 두더지 있는지 → `setColumnHot`) |
| `index.html` | `#mole-board` 안에 `#mole-hammer-layer`, `#game-screen` 에 `#lane-button-bar`, 새 스크립트 로드, `hammer-fx.js` 제거 |
| `style.css` | `.lane-button-bar`, `.lane-button`, `.lane-button--hot`, `#mole-hammer-layer`, `.lane-hammer`, 보드 사이징, `pointer-events`, 쉐이크/찌부/별/"쾅!" 키프레임 |
| `두더지게임-기획서.md` | §4/§5 재작성(터치 → 레인 버튼 + 열 강타 + 대각 망치), §8/§11/§12 보강(강타한 레인의 동물 = 페널티, 레인 감시 필요), 버튼 hot 규칙 명시 |

---

## 7. 데이터 흐름 (한 번의 타격)

```
버튼/키 입력
  → lane-controls.onColumn(col)
  → game.handleColumn(col):
       results = scheduler.resolveColumn(col)        // 상태 전이 + 결과
       target  = 그 열 primary pop 의 정수리 yFrac
       laneHammer.strike(col, target, onImpact)      // 비주얼 시작
  → (스윙 ~130ms 후) onImpact():
       state.hitstopUntil = now + 70~120ms
       results.forEach(r =>
          mole  → comboScore.onMoleHit(); score; regionReveal.lighten(); hitFx.moleHit(...); pop.flatten()
          animal→ lives-1; comboScore.onObstacleHit(); hitFx.obstacleHit('animal')
          bomb  → time-3; comboScore.onObstacleHit(); hitFx.obstacleHit('bomb'))
       results 비었으면 hitFx.whiff(col)
       updateHUD(); isComplete() → levelClear(); lives<=0 → gameOver()
```

---

## 8. 확정한 세부 결정 (스펙 리뷰에서 뒤집을 수 있음)

- 빈 열 누름: 페널티·잠금 없음, 헛스윙 연출만.
- 한 열 두더지 2마리: 스윙 1번(빠른 2연타 chop), 둘 다 판정, 콤보는 마리당 +1, juice 는 둘 다(주 정수리 크게 + 부 작게).
- 버튼 hot 글로우: 두더지만.
- 키보드: `1` `2` `3` `4`.
- 사운드: WebAudio 합성음(에셋 없음), 최소 구현, 음소거 가능. 같은 페이즈에 포함.
- 히트스톱: 기본 70ms, 콤보당 +10ms, 최대 120ms.
- 다타 두더지 확률/유지시간 배수(`기획서 §5`), 콤보 점수표(`§12`), 별 등급(`§15`),
  레벨 파라미터(`levels.js`): **변경 없음.**

---

## 9. 테스트 (성공 기준)

### 단위 (`node assert`, 프레임워크 없음)

`scripts/test-spawn-scheduler.js` 확장 또는 `scripts/test-lane-resolve.js` 신규:

1. `resolveColumn(col)` — 그 열에 두더지 1마리 → 결과 1개 `done:true`, 영역 완성됨
2. `resolveColumn` — 두더지 + 동물 같은 열 → 결과 2개, 영역 완성 + 동물 결과 존재
3. `resolveColumn` — 빈 열 → 빈 배열
4. `resolveColumn` — 2히트 두더지: 1번째 `done:false`(hitsTaken 1), 2번째 `done:true`
5. 다타 쿨다운: 같은 두더지를 0.12초 안에 두 번 판정 안 함
6. 열 귀속: col 2 spawnPoint 의 pop 은 `resolveColumn(2)` 에서만 판정됨

`scripts/test-grid-partition.js` 확장:

7. 각 spawnPoint 의 `col` 은 0–3, `row` 는 0–3, `regionId === row*4 + col`

### 스모크 (`scripts/verify-mole-smoke.js`, puppeteer)

- `.lane-button` 4개 렌더
- 두더지가 뜬 열의 버튼을 클릭 → 잠시 후 `#hud-region-count` 증가, `.lane-hammer` 요소가 스윙(transform 변화) 확인
- 키보드 `keydown` `'2'` → 2번 열 두더지가 처치됨
- 기존 검사(레벨 카드 10, 두더지 `<img>` 스프라이트, 클리어/게임오버 오버레이) 유지
- `.mole-pop` 에 `pointerdown` 걸어도 아무 일 없음 (직접 터치 비활성 회귀 방지)

### 전체 재검

- `scripts/run-all-tests.js` 전부 green
- `verify-mole-smoke.js` green
- 게임 내 puppeteer 스크린샷: 버튼 4개, 망치 대각 스윙, 두더지 처치 시 별/"쾅!"/쉐이크,
  동물 타격 시 목숨 감소 + 빨간 플래시, 빈 열 헛스윙

---

## 10. 범위 밖 (다음에)

- HUD 정보 구조 재설계 (텍스트 한 줄 → 시각적 계층)
- 레벨 선택 화면 카드 크기/스크롤
- `🦫` / `🪙` 이모지 tofu 박스 → 실제 아이콘 교체
- 두더지↔구멍 앞턱 경계 미세 검정 (앞선 라운드에서 사용자가 보류)

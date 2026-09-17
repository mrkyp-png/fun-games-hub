# 두더지팡 — 동시 멀티터치 다중 타격 (설계)

**작성일:** 2026-09-17
**대상:** `mole/` (두더지팡)
**한 줄 요약:** 다이얼패드 버튼 2~4개를 손가락으로 동시에 누르면, 그 개수만큼 무기 이미지가
**동시에** 각자 나타나 각자의 구멍을 타격한다. 뿅망치/골드해머/캐논/알리펀치 4종 전부 대상.

---

## 1. 배경 / 문제

사용자가 실제로 1000판 넘게 플레이하며 발견한 두 가지 사실:

1. 다이얼패드 버튼을 2~3개 동시에 누르면(멀티터치) 실제로는 **1개만 적용**된다. 원인은
   `mole/index.html`의 뷰포트 메타에 `maximum-scale=1, user-scalable=no`가 없어, 두 손가락이
   동시에 닿을 때 브라우저가 핀치줌 여부를 판정하려고 두 번째 이후 터치 전달을 보류하는 것으로
   추정된다. `lane-controls.js`의 버튼 `pointerdown` 리스너 자체는 버튼마다 독립적이라 멀티터치를
   막는 코드는 없다.
2. 동시터치가 게임을 훨씬 쉽게 만든다는 걸 체감 — 이걸 버그로 막을 게 아니라, **의도된 규칙**으로
   삼기로 함(사용자 결정: "진짜 멀티터치 허용"). 나아가 신규 게임 "리듬팡"(동시입력이 핵심 규칙인
   리듬 게임)의 토대가 되므로, 두더지팡에서 먼저 제대로 된 동시타격을 구현해 검증한다.

현재 무기 타격 애니메이션(`lane-hammer.js`/`lane-cannon.js`/`lane-boxing.js`)은 전부
**단일 인스턴스**를 재사용하는 구조라, 두 구멍을 거의 동시에 누르면 하나의 무기가 목표만
바뀐 채 리다이렉트될 뿐 — 이미지 2개가 동시에 뜨지 않는다. 이번 작업 범위는 여기를 고친다.

---

## 2. 입력단 수정 (터치 자체가 씹히는 문제)

1. `mole/index.html` 뷰포트 메타에 `maximum-scale=1, user-scalable=no` 추가.
2. `mole/style.css`의 `.dialpad`에 `touch-action: manipulation` 명시(현재 `.lane-button`
   자신에만 있고 컨테이너엔 없음) — 컨테이너 레벨 제스처 판정 개입 여지를 줄인다.

이 둘은 실기기 확인이 전제라, 배포 후 사용자가 직접 2~4개 동시터치로 검증한다.

---

## 3. 무기 인스턴스 풀

### 3.1 배경 — 왜 풀(pool)인가

`lane-hammer.js`/`lane-cannon.js`/`lane-boxing.js` 세 모듈은 이미 동일한 인터페이스를 공유한다
(`lane-cannon.js` 주석: "뿅망치와 같은 인터페이스"):

```
create(opts) → { strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId),
                 update(dt), isBusy(), home(), clear(),
                 [meet, demo, spinIn, popIn] }  // 무기별 선택적 메서드
```

세 모듈 내부(스윙 좌표·타이밍·포즈 표)는 여러 세션에 걸쳐 실기기로 힘들게 맞춘 값들이라
(`gripOff`, 캐논 5포즈 각도표 등) 손대지 않는다. 대신 `game.js`가 들고 있는
**`state.laneHammer` 하나를 "인스턴스 풀" 래퍼로 교체**한다. 래퍼가 같은 인터페이스를
그대로 노출하므로, `game.js` 안의 기존 ~15개 호출부(인트로 연출, 라운드 종료, 메인루프,
`handleCell`)는 **하나도 수정하지 않는다** — `strike`를 여러 인스턴스에 분배하는 로직만
래퍼 내부에 생긴다.

### 3.2 풀 API (기존과 동일한 표면)

새 파일 `js/weapon-pool.js`:

```
WeaponPool.create(WeaponMod, hammerOpts) → {
  strike(targetXFrac, targetYFrac, onImpact, frameKey, regionId),
  update(dt), isBusy(), home(), clear(),
  meet(), demo(...), spinIn(...), popIn(...)   // instances[0]으로만 위임, 없으면 no-op
}
```

- 내부에 `instances = [WeaponMod.create(hammerOpts)]`로 시작(기존과 동일하게 인스턴스 1개).
- `strike(...)`: `instances`에서 `isBusy() === false`인 걸 찾아 그 인스턴스에 위임. 없고
  `instances.length < MAX_CONCURRENT`(=5)면 `WeaponMod.create(hammerOpts)`로 하나 더 만들어
  배열에 추가 후 위임. 이미 5개 다 바쁘면(비현실적 극단값) 가장 오래전에 `strike`된
  인스턴스를 새 목표로 리다이렉트(기존 동작과 동일한 폴백).
- `update(dt)`: 배열의 모든 인스턴스에 순서대로 호출. 그 후 `instances[0]`을 제외한 인스턴스 중,
  **각 인스턴스의 마지막 `strike()` 호출 시각으로부터 `PRUNE_AFTER_MS`(=1500ms, 4개 무기 모두의
  FLY+CHOP+RISE+HOME 사이클을 넉넉히 덮는 고정값) 이상 지났고 `isBusy() === false`인 것**을
  `clear()` 호출 후 배열에서 제거(pruning)한다 — 여분 인스턴스를 계속 쌓아두지 않는다. 각 모듈에
  `phase`/`isHome()` 등 새 메서드를 추가하지 않고, 풀 쪽에서 타임스탬프만으로 판단해 3개 모듈은
  전혀 건드리지 않는다.
- `home()`: 모든 인스턴스에 `home()` 호출 후, `instances[0]`만 남기고 나머지는 `clear()` +
  배열에서 제거.
- `clear()`: 모든 인스턴스 `clear()` 호출, 배열 비움(다음 라운드 시작 시 `create()`가 다시
  1개로 초기화하므로 완전히 빈 배열로 둬도 안전 — 단, `startLevel`이 풀을 새로 만들 때는
  이전 풀의 `clear()`를 먼저 호출하는 기존 흐름을 그대로 따른다).
- `isBusy()`: 인스턴스 중 하나라도 busy면 true (호출부가 있는지는 구현 시 재확인, 없으면
  구현 안 해도 무방).
- `meet`/`demo`/`spinIn`/`popIn`: `instances[0]`에 해당 메서드가 있으면 그대로 위임, 없으면
  아무 것도 안 함(기존 `game.js`가 `state.laneHammer.meet &&` 식으로 이미 가드하고 있어 안전).

### 3.3 `game.js` 변경 지점

- `const laneHammer = WeaponMod.create(hammerOpts);` →
  `const laneHammer = MG.WeaponPool.create(WeaponMod, hammerOpts);` **한 줄만 교체.**
- 그 외 `state.laneHammer.*` 호출부는 전부 그대로 둔다.

### 3.4 콤보/점수/무기별 특수효과

`handleCell(regionId)`(`game.js`)는 이미 호출마다 독립적으로 동작한다:

- `scheduler.resolveRegion(regionId, ...)` — 순수 함수, 공유 가변 상태 없음.
- `state.laneHammer.strike(..., () => onHammerImpact(targetX, targetY, results, { regionId }), ...)`
  — 콜백이 각 인스턴스의 `chop` 단계에서 독립적으로 발화되므로, 동시에 눌린 N개 구멍은
  스윙 타이밍에 따라 각자 다른 프레임에 `onHammerImpact`가 불려 콤보·점수에 개별 반영된다.
  **이 부분은 수정 없이 그대로 작동한다.**
- 캐논 연사(`burstAutoFire`)·골드해머 지진(`quakeRipple`) 같은 무기별 부수 효과도
  `handleCell` 안에서 매 호출마다 판단하므로 그대로 작동한다.

---

## 4. 리스크 / 한계

- 모든 인스턴스가 **같은 대기위치**(우측 하단 홀스터, `HOME_X/HOME_Y`)에서 출발·복귀한다.
  4개가 동시에 눌리면 같은 지점에서 부채꼴로 뻗어나가는 모양이 된다 — 의도적으로 손대지
  않고 1차로 그대로 둔 뒤, 실기기 확인 후 필요하면 후속 조정.
- 캐논은 포즈가 5종 고정 포즈(회전 애니메이션 아님)라, 동시에 여러 인스턴스가 다른 포즈로
  뜨는 게 시각적으로 자연스러운지 확인 필요.
- **알리펀치 확인 완료:** `lane-boxing.js`의 `create()` 하나는 이미 왼쪽/오른쪽 글러브를
  각각 독립 상태로 관리한다(`isBusy() = left.isBusy() || right.isBusy()`, `strike()`가
  `ZONES[regionId]`로 어느 글러브를 쓸지 내부에서 결정). 즉 인스턴스 1개로 이미 최대 2개
  동시타격(좌우 각 1개)을 처리할 수 있다. 3번째 동시타격이 필요한 순간(예: 두 구멍이 모두
  같은 쪽 글러브를 요구)에는 풀이 일반 규칙대로 인스턴스를 하나 더 만든다 — 이 경우 "복서가
  한 명 더 등장"하는 모양이 되는데, 이는 "동시에 누른 개수만큼 무기 이미지가 뜬다"는 요구사항과
  모순되지 않으므로 별도 특수 처리 없이 일반 풀 로직 그대로 적용한다.
- `MAX_CONCURRENT = 5`는 임시값. 실기기에서 과도하면 낮춘다.

---

## 5. 테스트 (성공 기준)

### 단위 테스트

- `js/weapon-pool.js`용 신규 `scripts/test-weapon-pool.js`(node assert, mock `WeaponMod`):
  1. `strike()`를 서로 다른 좌표로 연속 호출 시 인스턴스가 늘어난다(첫 호출은 기존 인스턴스
     재사용, 이후 busy면 신규 생성).
  2. `update(dt)`가 모든 인스턴스에 전파된다.
  3. 대기 복귀한 여분 인스턴스가 정리(clear + 배열 제거)된다.
  4. `MAX_CONCURRENT` 초과 시 새 인스턴스를 만들지 않고 기존 걸 리다이렉트한다.
  5. `home()`/`clear()` 후 인스턴스가 정상적으로 1개(또는 0개)로 수렴한다.

### 스모크 (puppeteer, `scripts/verify-mole-smoke.js` 확장 또는 신규)

- 합성 멀티터치 이벤트(2~3개 `pointerId`)로 서로 다른 구멍 버튼을 동시에 누른 뒤,
  `.lane-hammer` 요소가 2~3개 DOM에 존재하는지 확인.
- 그 직후 콤보/점수 HUD가 눌린 유효 타격 수만큼 증가했는지 확인.
- 잠시 후(스윙 사이클 종료) 여분 `.lane-hammer` 요소가 정리돼 1개로 돌아오는지 확인.

### 실기기 확인 (사용자)

- 두더지팡 실기기에서 2/3/4개 손가락 동시 탭 → 각각 이미지 등장 + 콤보/점수 반영 확인.
- 뿅망치/골드해머/캐논/알리펀치 4개 무기 모두 동일하게 확인.

---

## 6. 범위 밖 (다음에)

- "리듬팡" 신규 게임 자체 설계(이 작업은 그 토대만 마련).
- 동시 타격 시 대기위치 분산 배치(부채꼴 출발 연출 개선).
- 동시 타격 전용 콤보 보너스/연출(예: "더블킬" 문구 등) — 요청 없었음, 추가하지 않음.

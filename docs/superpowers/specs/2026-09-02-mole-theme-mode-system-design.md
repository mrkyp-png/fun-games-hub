# 두더지 게임 — 테마1 "두더지 잡기" 모드 시스템 (설계)

**작성일:** 2026-09-02
**대상:** `mole/` (두더지 게임) — 이 작업 후 이 레포는 두더지 게임 전용이 된다
**한 줄 요약:** 규칙 하나에 고정돼 있던 두더지 게임을, **좌우로 넘기는 모드 페이지 여러 개**로
바꾼다. 모드마다 "무엇을 때리면 점수/페널티인가"가 다르고, 앞 모드를 클리어(또는 광고)해야
다음 페이지가 열린다. 모드 설명은 게임박스 안에서 **카톡풍 문자**로 온다.

---

## 1. 배경 / 목표

지금 두더지 게임은 "두더지를 때린다 / 동물은 −목숨 / 안경동물은 −시간" 규칙 **하나**로만
돌아간다 (`game.js` `onHammerImpact`의 타입별 하드코딩 분기 + `spawn-scheduler.js`의 고정
`mole`/`animal`/`bomb` 3종 스폰).

사용자 비전:

- 두더지 게임은 **여러 테마**의 묶음이 된다. 테마1 = "두더지 잡기"(이번 작업), 테마2 = "체스 같은
  것"(별도 스펙, 나중), 테마3 = 구상 중.
- 테마1 안에 **모드 여러 개**: ①기본 ②폭탄 ③다 때려잡기 ④안경만 ⑤두더지 빼고 ⑥…(+@ 슬롯).
- 모드는 폰 홈화면 넘기듯 **좌우 스와이프**로 이동. **순차 잠금**.
- 이 레포에서 지렁이·색칠·카드맞추기는 삭제 → 두더지 게임 전용 레포.

이번 스펙 범위: 테마1의 모드 시스템 + 레포 재구성. **앱화(Capacitor)·광고 실연결·인앱결제·
체스 테마는 범위 밖** (§16).

---

## 2. 큰 그림

```
앱 열기 / 게임 중 좌상단 홈버튼
  → [홈 화면]  두더지 게임풍 히어로 이미지 + 일반/어려움 선택
                                        │
                                        ▼
        [모드 캐러셀]  ◀── 좌우 스와이프 ──▶
        ┌────────┐   ┌────────┐   ┌────────┐   ┌─ 잠김 ─┐
        │ 모드1   │   │ 모드2   │   │ 모드3   │   │  🔒    │
        │ 기본    │   │ 폭탄    │   │ 다때려  │   │ 안경만 │
        └────────┘   └────────┘   └────────┘   └────────┘
             │
      (페이지 안에서)
        카톡풍 문자 인트로 → 시작 → 10라운드×30초 플레이 → 결과 화면
                                                          ├ 다시하기
                                                          ├ 광고 보고 다음 ▶  (목표 미달)
                                                          └ 다음 모드 ▶       (목표 달성)
```

---

## 3. 등장 요소 4종

| 타입 | 스프라이트 | 비고 |
|---|---|---|
| `mole` | `mole1`~`mole6`, `mole8` (7종 랜덤 포즈) | 헬멧. 다타(1/2/3히트) 유지 |
| `goggleMole` | `mole7` (고정) | **신규 타입.** 안경 낀 두더지. 지금은 `mole7`이 일반 두더지 랜덤 포즈 풀에 섞여 있는데, 풀에서 빼서 독립 타입으로. **재슬라이스 불필요** — `assets/moles/mole7.png` 이미 존재 |
| `animal` | `assets/moles/{rabbit,tiger,hippo,lion,dog}.png` | 맨 얼굴 동물 |
| `goggleAnimal` | `assets/moles/{rabbit,tiger,...}-x.png` | 고글 낀 동물. 지금 `bomb`으로 부르던 것 = 이걸로 **개명** |

- 다타(多打)는 `mole`·`goggleMole`만. `animal`·`goggleAnimal`은 1히트.
- `goggleMole`도 다타 가능하게 할지: **1히트 고정** (구분을 단순하게). — 확정 세부 §14.

---

## 4. 모드 = 설정 데이터

### 4.1 구조 (`js/modes.js`, 신규)

```js
MG.MODES = [
  {
    id: 'basic',
    order: 0,                        // 캐러셀 페이지 순서 = 잠금 순서
    name: { ko: '두더지를 때려잡자', en: 'Whack the Moles' },
    // 카톡풍 인트로 대사 (친근한 반말). {n} 등 치환 없음, 순수 문자열 배열.
    chat: {
      ko: ['왔어? ㅋㅋ', '규칙 간단해 — 두더지만 패면 돼', '동물은 건들지 마 목숨 날아가', '준비되면 시작 눌러'],
      en: [...]
    },
    // 때리면 +점수인 타입
    target: ['mole', 'goggleMole'],
    // 때리면 손해인 타입 → 효과
    penalty: { animal: 'life', goggleAnimal: 'time' },   // 'life' | 'time' | 'score'
    // 라운드당 등장 요소 비중 (스케줄러가 이 가중치로 스폰). 합은 임의, 상대값.
    spawnWeights: { mole: 8, goggleMole: 1, animal: 2, goggleAnimal: 1 },
    spawnGapMult: 1,                 // 등장 간격 배수 (<1 = 더 자주. ②폭탄이 0.7 정도)
    goalScore: 3000                  // 다음 모드 잠금 해제 기준 (10라운드 누적 점수)
  },
  // ... 모드 2~5
];
```

### 4.2 5개 모드

| 등장 요소 | ①기본 `basic` | ②폭탄 `bomb` | ③다때려 `smashAll` | ④안경만 `gogglesOnly` | ⑤두더지빼고 `noMoles` |
|---|---|---|---|---|---|
| `mole` (헬멧) | ✅target | ✅target | ✅target | ❌penalty:score | ❌penalty:life |
| `goggleMole` (안경) | ✅target | ✅target | ✅target | ✅target | ❌penalty:life |
| `animal` (맨얼굴) | ❌penalty:life | ❌penalty:life | ✅target | ❌penalty:score | ✅target |
| `goggleAnimal` (안경) | ❌penalty:time | ❌penalty:time | ✅target | ✅target | ✅target |
| 그 외(빈 구멍) | 헛스윙 | 헛스윙 | 헛스윙 | 헛스윙 | 헛스윙 |

- **②폭탄**: 규칙은 ①과 동일. `spawnWeights`에서 `goggleAnimal`(폭탄) 비중을 크게 올리고,
  `levels.js`가 아닌 모드 쪽 배수로 등장 간격을 좁힌다 (`spawnGapMult: 0.7` 같은 필드).
- **③다때려**: 모든 타입이 target, `penalty: {}` 비어 있음. 헛스윙만 손해 아님(그냥 콤보 끊김).
- **④안경만**: 판단 기준 = **안경 유무**. 안경 안 낀 두더지·동물을 치면 `penalty:score`
  (점수 차감 + 콤보 리셋, 목숨/시간은 안 건드림 — 실수 유도가 목적이지 게임오버가 목적이 아님).
- **⑤두더지빼고**: 판단 기준 = **두더지냐**. `mole`·`goggleMole` 둘 다 치면 `penalty:life`.

penalty 효과 정의:
| 효과 | 처리 |
|---|---|
| `life` | 목숨 −1, 콤보 0, `hud-hearts` 빨간 플래시 |
| `time` | 남은 시간 −3초, 콤보 0, `hud-ticker` 빨간 플래시 |
| `score` | 점수 −(그 모드 기본 처치 점수), 최저 0, 콤보 0, 화면 짧은 빨간 비네트 |

---

## 5. 한 판 구조 — 지금 그대로 (10라운드 × 30초)

- 모드 하나 = **라운드 1~10, 각 30초, 라운드 사이 자동 진행, 누적 점수** (현재 `game.js` 구조 유지).
- 라운드별 난이도 곡선(`MG.LEVELS`: 동시 두더지 1→5, 유지시간 2.5→1.0초)은 **모드 공통 재사용**.
  모드마다 다른 건 **등장 요소 믹스(`spawnWeights`)와 등장 간격 배수**뿐.
- 목숨: 라운드마다 `START_LIVES`(3)로 리셋 (현재 동작 유지).
- `goalScore` 비교 대상 = 10라운드 **누적 점수**(`runBanked + 마지막 라운드 점수`).
- `ROUND_SECONDS = 30`, `FINAL_ROUND = 10` 상수 유지.

---

## 6. 홈 화면

새 화면 `#home-screen` (기존 `#start-screen` 대체). Angry Smash 홈(영상 참고 frame 22) 스타일:

- **가운데 큰 히어로 이미지** — "두더지 게임풍" 일러스트. **에셋은 사용자가 제공 예정**
  (`assets/home-hero.png` 자리, 그때까지 임시 이미지). 영상의 해적선 자리에 해당.
- 상단바: 타이틀 "두더지 잡기" + 설정 톱니(선택). 폰 컨셉은 유지하되 이 화면은 폰 프레임
  전체가 아니라 랜딩 느낌.
- **난이도 선택 + 시작**: `일반 시작` / `어려움 시작` 큰 버튼 2개 (또는 난이도 토글 + `시작` 1개
  — 구현 시 확정, 기본안 = 버튼 2개).
  - `일반` = 레인 버튼 hot-glow 켜짐 (현재 동작)
  - `어려움` = hot-glow 안 켜짐 (`#game-screen`에 `.hard` 클래스 → `.lane-button--hot` 무력화).
    이미 [[fun-games-hub]] 메모에 "hard mode = no hot-glow"로 계획돼 있던 것.
- 난이도는 **세션 전역** — 홈에서 고르면 캐러셀 전체에 적용. 바꾸려면 홈으로.
- 시작 → 모드 캐러셀 (마지막에 연 모드 페이지, 없으면 모드1).
- **게임 화면 좌상단 홈 버튼**(`#btn-back-to-hub`)의 목적지 = 이 화면. 플레이 중이면
  현재 판을 버리고 홈으로 (이번 세션에서 만든 조건부 로직을 이 화면 기준으로 조정).
- 최근 최고 점수 요약(모드1×현재난이도) 정도 표시.

*(테마2·3이 생기면 이 홈에 테마 카드가 추가된다 — 이번 범위 밖. 지금은 홈 = 테마1 입구.)*

---

## 7. 모드 캐러셀

새 모듈 `js/mode-carousel.js`.

- `#mole-board`(게임박스)를 감싸는 뷰포트 안에서 **가로 트랙**이 모드 수만큼의 페이지를 가진다.
- 각 페이지 = 그 모드의 인트로/시작 상태 (게임박스 크기와 동일). 실제 플레이는 그 자리에서 시작.
- **스와이프**: 포인터 드래그 가로 이동. 페이지 스냅. 하단에 페이지 점(dot) 표시.
- **잠금**: `order > 해금레벨`인 페이지는 자물쇠 오버레이 + 스와이프가 그 앞에서 막힘.
- **해금 상태 저장**: `localStorage['mole.unlockedModes']` = 정수(0=모드1만, 1=모드2까지, …).
- 플레이 중에는 스와이프 잠금 (라운드 진행 중 페이지 이동 불가). 결과 화면/인트로에서만 이동.
- 리워드 광고 자리: **지금은 웹이라 스텁**. "광고 보고 다음 ▶" 버튼 → 2초 가짜 로딩 →
  해금. 앱 단계에서 `MG.Ads.showRewarded()` 로 교체할 수 있게 함수 하나로 감싼다.

---

## 8. 결과 화면 (모드 한 판 종료)

현재 `#gameover-overlay`(게임박스 안) 확장:

- "전체 클리어! / 목숨 소진!" + 누적 점수 + 최고 점수
- **목표 점수 게이지**: `누적 / goalScore` 바. 달성 시 별/체크.
- 버튼:
  - `다시하기` (항상)
  - 목표 **달성** → `다음 모드 ▶` (해금 + 캐러셀 다음 페이지로 스와이프)
  - 목표 **미달** → `광고 보고 다음 ▶` (스텁) + `다시 도전`
  - 이미 해금된 모드를 다시 플레이한 경우 → `다음 모드 ▶`만 (목표 무관)
- `나가기` → 홈 화면

---

## 9. 카톡풍 문자 인트로

새 모듈 `js/chat-intro.js` + `#board-chat` 패널(게임박스 안, `board-panel` 클래스 재사용).

- **말풍선 UI**: 상대 프로필(작은 원형 아바타 + 이름) + 왼쪽 정렬 회색 말풍선.
  "카톡 보는 느낌 / 문자 받는 느낌 / 아주 친근하게".
- `chat.ko` 배열의 각 줄이 순차로 등장: 짧은 "…" 타이핑 인디케이터 → 말풍선 pop, ~600ms 간격.
- 마지막에 **초록 말풍선 버튼 "시작"** → 그 모드 라운드 1 시작.
- **첫 방문**: 자동 재생. **재방문**: 상단에 "건너뛰기 ▶" — 누르면 바로 시작.
- 화자 페르소나: v1 = 이름 "매니저"(가칭) + 이모지 아바타. 스크립트는 `modes.js`에 모드별로.
  (진짜 캐릭터/이름은 나중에 사용자가 정하면 교체 — 스크립트만 갈아끼우면 됨.)
- 애니메이션 안 도는 환경 대비: 1.2초 후 전체 즉시 표시 폴백.

---

## 10. 최고 점수 저장

- 키: `localStorage['mole.best.<modeId>.<difficulty>']` (예: `mole.best.basic.normal`).
- 기존 `moleBestScore` 단일 키는 **마이그레이션**: 있으면 `mole.best.basic.normal`로 옮기고 삭제.
- 홈/캐러셀 페이지/결과 화면에서 해당 (모드×난이도) 최고 점수 표시.

---

## 11. 코드 구조

### 새 모듈

| 파일 | 역할 | 인터페이스 |
|---|---|---|
| `js/modes.js` | 모드 정의 데이터 + 조회 헬퍼 | `MG.MODES`, `MG.Modes.get(id)`, `MG.Modes.byOrder(n)`, `MG.Modes.count` |
| `js/mode-carousel.js` | 캐러셀 뷰 + 스와이프 + 잠금 + 해금 저장 | `create({ viewport, onModeStart(modeId), unlockedGetter, adStub })` → `{ goto(order), refreshLocks(), clear() }` |
| `js/chat-intro.js` | 카톡풍 인트로 재생 | `create({ panel })` → `{ play(lines, { skippable }, onDone), clear() }` |

각 모듈은 게임 규칙을 모른다. `modes.js`는 순수 데이터, `mode-carousel`은 페이지 인덱스만,
`chat-intro`는 문자열 배열만 받는다.

### 변경

| 파일 | 변경 |
|---|---|
| `js/spawn-scheduler.js` | `create({..., spawnWeights, spawnGapMult})` 추가. `trySpawn`이 `mole`/`animal`/`bomb` 3분기 대신 **가중치 룰렛으로 4타입 중 선택**, pop에 `variant`(`mole`\|`goggleMole`\|`animal`\|`goggleAnimal`) 필드. `resolveOne`은 **지금처럼** pop 상태전이만 담당(다타 카운트·`done`·`sinkIn`·쿨다운), 결과에 `variant` 포함해서 반환 — target/penalty 해석은 원래도 `game.js` 몫이라 그대로. `MIN/MAX_SPAWN_GAP`에 `spawnGapMult` 곱함. `completedRegions`/`isComplete`는 점수어택엔 무의미하니 계속 미사용 유지 |
| `js/mole-sprites.js` | `mole7`을 일반 포즈 풀에서 제외 (`MOLE_POSES = [0,1,2,3,4,5,7]`). `spriteForVariant(variant, poseIndex)` 헬퍼: `goggleMole`→항상 `mole7`, `animal`→`{name}`, `goggleAnimal`→`{name}-x` |
| `js/pop-elements.js` | `variant` 기반 스프라이트 선택. `goggleMole`은 다타 없음(항상 전신 포즈) |
| `js/game.js` | **모드 인지 리팩터.** `startMode(modeId, difficulty)` 진입점 추가 → chat-intro → `startRound(1, {fresh})`. `state`에 `mode`(설정 객체 참조), `difficulty` 보관. `onHammerImpact`의 타입별 하드코딩 분기 → `mode.target.includes(variant)` / `mode.penalty[variant]` 조회로 교체. 결과 화면에서 `goalScore` 비교 + 해금 처리. `#home-screen` 이벤트, 캐러셀·chat-intro 인스턴스 생성/정리 |
| `js/hit-fx.js` | `penalty:'score'` 용 빨간 비네트 연출 하나 추가. 나머지 재사용 |
| `js/hud.js` | 목표 점수 게이지(결과 화면) 갱신 |
| `index.html` | `#home-screen`(난이도 2버튼), `#board-chat` 패널, 캐러셀 뷰포트 래퍼, 새 스크립트 3개 로드. `#start-screen`은 `#home-screen`으로 대체 |
| `style.css` | `.home-screen`, 난이도 버튼, `.mode-carousel`/`.mode-page`/페이지 점/자물쇠, `.chat-*`(말풍선·아바타·타이핑), `#game-screen.hard .lane-button--hot { … 무력화 }`, 목표 게이지 |
| `sw.js` | SHELL에 새 js 3개 추가, `mole7.png` 확인, `CACHE` 버전업 |
| `scripts/verify-mole-smoke.js` | 모드 캐러셀·해금·chat-intro·모드별 판정 검사로 확장 |
| `두더지게임-기획서.md` | 사용자 문서 — 이미 out of sync, 이번엔 손대지 않음 (사용자가 갱신) |

---

## 12. 데이터 흐름 (한 번의 타격, 모드 인지)

```
버튼/키 입력 → lane-controls.onCell(regionId)
  → game.handleCell(regionId):
       results = scheduler.resolveRegion(regionId)   // [{ variant, regionId, done, xFrac, yFrac }]
                                                     // resolveRegion은 판정 안 함 — 맞았다는 사실 + 타입 + 좌표만.
                                                     // 최종타면 pop.sinkIn 세팅(침몰은 SINK_DELAY 뒤).
       laneHammer.strike(x, y, () => onHammerImpact(x, y, results))  // 망치 도달(~135ms) 후 콜백
  → onHammerImpact(x, y, results):   // ← 현재도 여기서 점수/FX. 모드 인지로 바꿀 부분.
       const m = state.mode;
       results.forEach(r =>
         if (m.target.includes(r.variant) && r.done):
              comboScore.onMoleHit(); score += 점수; hitFx.moleHit(...); hitstop
         else if (m.penalty[r.variant]):
              'life' → lives-1 / 'time' → time-3 / 'score' → score -= 기본점수
              comboScore.onObstacleHit(); hitFx.penalty(종류)
         else if (r.variant 다타 미완):
              hitFx.moleTap(...))
       results 비었으면 hitFx.whiff(...)
       lives<=0 → finish('lives')
```

*(타격 타이밍·`sinkIn`(침몰 지연)·`__debugHittableMoleRegion`·타격음 파일은 2026-09-02
세션에서 만든 것 그대로. `onHammerImpact`은 이름·호출 위치 그대로 두고 내부 분기만 모드 설정
조회로 교체한다.)*

---

## 13. 레포 재구성 (스펙 승인 후, 모드 시스템 구현 전에 실행)

**사용자 확정:** 이 레포는 두더지 게임 전용이 된다.

1. **`git tag archive/snake` + `git tag archive/coloring` + `git tag archive/match`** 를 현재 HEAD에
   찍는다 (지렁이 코드 보존 — 히스토리에도 남지만 태그로 복구 쉽게).
2. `snake/`, `coloring/`, `match/` 폴더 삭제.
3. 허브 셸 정리:
   - 사이트가 **두더지 게임으로 바로 열리게** 한다 (진입 후 §6 홈 화면이 뜸). 방식: 루트
     `index.html`을 `mole/index.html` 내용으로 대체하고 경로를 루트 기준으로 조정 **하거나**,
     루트 `index.html`을 `<meta http-equiv="refresh" content="0; url=mole/">` 한 줄 리다이렉트로.
     → **구현 시 결정** (리다이렉트 저위험, 루트 승격이 장기적으로 깔끔). 기본안 = 리다이렉트.
   - `hub.js`, `hub.css`, `hub-strings.js`, `scripts/verify-hub-smoke.js`, `docs/.../hub-shell-*` 삭제.
   - `common/settings.js`·`common/i18n.js`·`common/settings.css`는 두더지가 쓰므로 **남긴다**
     ("공유"가 아니게 될 뿐, 위치 그대로).
   - `common/settings-ui.js`(🌐/⚙️ 모달)는 **hub 전용**이었음. 두더지 홈에 설정 톱니를 넣으면
     이걸 재사용하거나 두더지용 간단 설정으로 대체 — **구현 시 결정** (§6).
   - `cosmic-theme.css`는 두더지가 색상 변수·`.cosmic-bg`를 참조하므로 **남긴다**.
4. `snake/`·`coloring/` 관련 테스트·plan 문서 삭제. `docs/superpowers/plans/2026-08-26-snake-game.md`
   등은 히스토리에 남으니 삭제해도 됨 (또는 `docs/archive/`로 이동 — 구현 시 결정).
5. GitHub Pages 경로: 지금 `mrkyp-png.github.io/fun-games-hub/mole/`. 리다이렉트면
   `.../fun-games-hub/`가 두더지로 감. 레포/URL 이름 변경은 **범위 밖** (사용자가 GitHub에서).

---

## 14. 확정한 세부 결정 (스펙 리뷰에서 뒤집을 수 있음)

- `goggleMole`은 **1히트 고정** (다타 없음) — 안경/헬멧 구분을 단순하게.
- ④안경만의 오답 페널티 = `score`(점수 차감), 목숨/시간 안 건드림. 게임오버 유도 아님.
- 난이도(일반/어려움)는 **세션 전역**, 홈에서만 변경, 최고점수는 (모드×난이도)로 분리.
- 잠금 해제 단위 = **한 칸씩** (모드1 깨면 모드2만 열림). "한 번에 전부"는 아님.
- 이미 해금한 모드 재플레이: 목표 미달이어도 `다음 모드 ▶` 그냥 감.
- chat-intro 화자 = 임시 "매니저" + 이모지 아바타. 진짜 캐릭터는 나중.
- `MG.LEVELS` 난이도표, 콤보 점수표(`combo-score.js`), `ROUND_SECONDS`/`FINAL_ROUND`,
  타격 연출·사운드·타이밍(이번 세션 작업분): **변경 없음.**
- 모드6·+@: `modes.js`에 객체 추가 슬롯만. 이번에 구현 안 함.

---

## 15. 테스트 (성공 기준)

### 단위 (`node assert`)

`scripts/test-modes.js` (신규):
1. `MG.MODES` 5개, 각 `id`/`order`/`target`/`penalty`/`spawnWeights`/`goalScore` 존재, `order` 0~4 유일
2. 모든 `target`/`penalty` 키가 4개 유효 타입 중 하나
3. `MG.Modes.get('basic').target` 에 `mole` 포함, `gogglesOnly`.penalty 에 `mole`==`score`

`scripts/test-spawn-scheduler.js` 확장:
4. `spawnWeights: { mole: 1, animal: 0, ... }` → 여러 번 스폰해도 `animal` 안 나옴
5. `spawnWeights`로 `goggleMole`/`goggleAnimal` 이 실제로 스폰됨 (`variant` 필드 확인)
6. `spawnGapMult: 0.5` → 등장 간격이 절반 근처
7. `resolveRegion`이 판정 없이 `variant`+좌표만 반환 (target/penalty 해석 안 함)

`scripts/test-mole-sprites.js` 확장:
8. `mole7`이 일반 포즈 풀에 없음. `spriteForVariant('goggleMole', *)` === `mole7`,
   `spriteForVariant('goggleAnimal', 0)` 끝이 `-x`

해금 저장:
9. `localStorage` 스텁으로 해금 0→1→2 진행, 재로드 시 유지

### 스모크 (`scripts/verify-mole-smoke.js`, puppeteer)

- 홈 화면: `일반`/`어려움` 버튼 2개, `어려움` 선택 시 `#game-screen.hard`
- 캐러셀: 페이지 점 = 모드 수, 모드1만 열림·나머지 자물쇠, 스와이프가 잠긴 페이지 앞에서 막힘
- 모드1 진입: `#board-chat` 말풍선 뜸 → "시작" → 라운드 1 시작
- 모드1에서 `basic` 규칙 동작: 두더지 버튼 → 점수↑, 동물 버튼 → 목숨↓
- `__debugStartMode('gogglesOnly', 'normal')` → 안경 안 낀 두더지 처치 시 점수 **감소**
- 결과 화면: 목표 게이지, 목표 달성 시 `다음 모드 ▶` → 모드2 해금 + 캐러셀 이동
- 목표 미달 시 `광고 보고 다음 ▶`(스텁) → 2초 후 해금
- `moleBestScore` → `mole.best.basic.normal` 마이그레이션
- 기존 검사(두더지 `<img>` 스프라이트, 16구멍, 레인 버튼 16, 직접터치 무효, 타격 타이밍) 유지

### 전체 재검

- `scripts/run-all-tests.js` 전부 green, `verify-mole-smoke.js` green
- 게임 내 puppeteer 스크린샷: 홈, 캐러셀(잠금 포함), chat-intro, 각 모드 플레이 한 장씩,
  안경만 모드 오답 페널티, 결과 화면 목표 달성/미달
- 레포 재구성 후: 루트 URL이 두더지로 열림, `snake/`·`coloring/`·`match/` 없음, 태그 3개 존재

### 디버그 훅 (영구 보존, 지렁이 컨벤션)

`__debugStartMode(modeId, difficulty)`, `__debugUnlockAll()`, `__debugSetBest(modeId, diff, n)` 추가.
기존 `__debugStartGame`/`__debugStartRound`/`__debugEndRound`/`__debugForceGameOver`/
`__debugHitCell`/`__debugIntroActive`/`__debugHittableMoleRegion` 유지 (`__debugStartGame` =
`__debugStartMode('basic','normal')`).

---

## 16. 범위 밖 (다음에, 각자 별도 스펙)

- **앱화**: Capacitor로 안드로이드 래핑, 빌드·서명 (`fun-games-hub` 메모의 6단계 로드맵 참고)
- **광고 실연결**: AdMob 리워드/전면. 이번엔 `adStub`만.
- **인앱결제**: No Ads / 코인팩 / 상점 화면. Google Play Billing.
- **스토어 출시**: 아이콘·스크린샷·개인정보처리방침·콘텐츠 등급·내부 테스트 트랙.
- **테마2 "체스 같은 것"**: UI·규칙 미정. 별도 브레인스토밍.
- **테마3**: 구상 중.
- 모드6·+@ 실제 구현.
- chat-intro 실제 캐릭터/스토리.
- 레포/GitHub URL 이름 변경.

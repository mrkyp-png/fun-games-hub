# 두더지 게임 — 독립 앱 + 사람두더지 메이커 (설계)

> **⚠️ v2 정정 (2026-09-03, 구현 중).** v1의 "카톡 대화 삭제 + 더보기 스타일이 첫 화면" 은
> 사용자 발언(*"유아 게임도 아닌데 케릭터…"*)의 **오독**이었다. 실제 의도는 "오빠 사랑해→자기야 사랑해"
> 문구 수정뿐(이미 반영됨). 정정된 구조:
> - **첫 화면 = 두더지 오빠 ↔ 하마 카톡 대화 (그대로, 불변).** §1의 "삭제" 목록 전부 취소 → 유지.
> - **더보기 메뉴 = 게임 화면 좌상단 ⊞ 아이콘 뒤의 별도 메뉴** (`#more-menu`). §3의 홈화면 레이아웃·구성요소는
>   그대로 쓰되 "첫 화면"이 아니라 "⊞ 뒤 메뉴". `#home-screen` → `#more-menu`, `showHome()`는
>   "메뉴 열기"로. `showStartScreen()`(대화)은 이름·동작 유지.
> - **난이도(하수/고수/전설) + 사람두더지 메이커 = 더보기 메뉴 안.** 대화 화면 시작 버튼은
>   `mole.difficulty`(기본 easy) 로 시작 + 하트 1 소모.
> - **온보딩 없음** (사용자 B안, 2026-09-03): 앱 첫 실행 = 바로 대화 화면. 사람두더지는 더보기 메뉴에서 원할 때 만든다. 게임은 얼굴 없어도 일반 두더지로 동작.
> - Tasks 1~5(economy/face-store/ads/HEAD_ANCHOR/obstacle 토글)는 **완료·유지**. Task 6 이후를 이 정정대로 재구현.

**작성일:** 2026-09-03
**대상:** `mole/` — 이 작업 후 두더지 게임은 fun-games-hub에서 떨어져 나와 **독립 안드로이드 앱**이 된다.
**한 줄 요약 (v2):** 첫 화면(두더지 오빠 ↔ 하마 카톡 대화)은 **그대로 유지.** 게임 화면 좌상단 ⊞ 아이콘 뒤에 **더보기 메뉴**(카톡 더보기 탭 스타일, 다크)를 새로 만들고, 거기에 **핵심 콘텐츠 = 사람두더지 메이커**(내 사진 → 얼굴 → 두더지 머리 합성) + 난이도(하수/고수/전설) + 하트·코인·상점·일일 메타를 넣는다.
<br>~~(v1: 홈화면을 카톡 더보기 스타일로 새로 만들고 캐릭터·대화 인트로는 뺀다) — **오독. 폐기.**~~

이 스펙은 **2026-09-02 `mole-theme-mode-system-design.md`를 대체**한다. 그 문서의 모드 캐러셀(기본/폭탄/다때려/안경만/두더지빼고)은 **Phase 3**로 이월 — 방향만 남기고 이번 구현 범위 밖.

---

## 0. 단계 구분

| Phase | 내용 | 범위 |
|---|---|---|
| **Phase 1 (웹)** | 홈화면 · 사람두더지 메이커 · 보관함 · 하수/고수/전설 · 하트/코인 · 광고 스텁 | **이 스펙에서 상세** |
| Phase 2 (네이티브 포장) | Capacitor 래핑 → AdMob 실연결 → 플레이스토어 | 방향만 (§9) |
| Phase 3 (모드 시스템) | 폭탄/다때려/안경만/두더지빼고 모드 + 전설 세부 튜닝 | 방향만 (§10) |

Phase 1은 브라우저/현재 PWA에서 그대로 돈다. 며칠 안에 눈에 보이는 것이 목표.

---

## 1. 유지 / 삭제

**유지 (그대로):**
- 게임 자체 — 두더지/동물/구멍/망치, 레인 버튼(전화 다이얼러 위장), 4×4 그리드, 10라운드×30초, 하트 3개(한 판), 콤보 누적·콤보 보너스 생명, 일시정지
- 폰 위장 — 가짜 주소창(`#hud-addr`), 다이얼러 키패드
- **최고기록 알림** — 위에서 툭 내려오는 문자 알림(`#start-best`), 홈화면에 표시
- 스프라이트 전부(`mole1~8`, `peek1/2`, `helmet`, `hole`, `hole-front`, 동물 `-x` 포함), 타격음(`hit1~4.mp3`), 배경(`board-scene.jpg`), 밤하늘 트윙클
- `spawn-scheduler` / `pop-elements` / `lane-hammer` / `lane-controls` / `hit-fx` / `combo-score` / `region-reveal`(어두운 베일) 로직
- 타격 타이밍·`sinkIn` 침몰 지연·`__debugHittableMoleRegion` (2026-09-02 세션 작업분)

**삭제:**
- `두더지 오빠` 캐릭터, `하마` 아바타, 카톡 대화 인트로(`#chat-first`)
- 재방문 랜덤 문구(`RETURN_PHRASES` ~90개), `HIPPO_REPLIES`, `HIPPO_MOODS`, `CELEBRATE_EMOJI`, `RETRY_TEXT`
- 다시하기 이모티콘 리액션(축하/폭죽 이모티콘 날리기, `emojiRow`/`bubbleRow`/`avatarEl`/`makeStartBtn`/`buildReturnChat`/`revealThread`)
- `#chat-first`/`#chat-return` DOM, `.chat-row`/`.chat-bubble`/`.chat-avatar`/`.chat-emoji`/`.chat-burst` CSS
- `assets/avatar-mole.png`, `assets/avatar-hippo.png`
- 첫방문/재방문 분기(`mole.visits` 기반 대화 선택) — 온보딩(§4)으로 대체
- fun-games-hub 연결: 게임 화면 좌상단 2×2 아이콘의 목적지 = 홈화면(§3), 허브 아님

**주의 (외과적):** 위 삭제로 고아가 되는 import/헬퍼/CSS만 제거. `#start-best` SMS 애니메이션 코드는 유지·재타깃. `showStartScreen`은 이름 유지하되 내부를 홈화면 렌더로 교체(또는 `showHome`으로 개명 + 호출부 일괄).

---

## 2. 큰 그림

```
앱 실행
  │
  ├─ 첫 실행 → [온보딩] 사람두더지 1개 만들기 → 하수 게임 바로 시작
  │
  └─ 재실행 → [홈화면] (카톡 더보기 스타일, 다크)
                 │
   ┌─────────────┼──────────────┬───────────┐
   ▼             ▼              ▼           ▼
[사람두더지     [난이도 pill]   [보관함]     [스코어/일일/
 메이커]        하수/고수/전설              상점/설정/…]
   │             │
   ▼             ▼  (하트 1 소모)
 사진→얼굴→합성   활성 사람두더지로 10라운드×30초 플레이
   →보관함 저장          │
                        ▼
                    [결과 화면]  ├ 다시하기(하트 1)
                                 ├ 코인 획득
                                 └ 나가기 → 홈
```

모든 화면은 `#mole-board`(폰 화면) 안에서 뜬다. 다이얼러 키패드(`#lane-button-bar`)는 **게임 중에만** 표시, 그 외 화면에선 숨김.

---

## 3. 홈화면 (`#home-screen`)

카톡 "더보기" 탭 레이아웃을 흉내낸 **다크 네이티브** 화면. 다크로 설계하면 삼성인터넷 강제 다크가 바꿀 게 없어 색 깨짐 문제 회피.

```
╔═══════════════════════════════════╗
║  🔍 더보기        ❤️❤️❤️❤️❤️ ⏱4:59  🪙1,200  ⚙️ ║  상단바
╟───────────────────────────────────╢
║   ⬤  하마짱                              ║  프로필
║       전설 · 최고 24,800점                 ║
╟───────────────────────────────────╢
║  ┌─────────────────────────────┐  ║
║  │ 😀😀  사진으로 사람두더지 만들기  [만들기] │  ║  송금박스 = 메이커
║  └─────────────────────────────┘  ║
║  🗂 내 사람두더지  😀 😀 😀 😀 …    ›     ║  보관함 지름길(썸네일 스트립)
╟───────────────────────────────────╢
║     [ 하수 ]    [ 고수 ]    [ 전설 ]        ║  난이도 pill (홈/지갑/게임 자리)
╟───────────────────────────────────╢
║   📊       📅       🛒       🗂         ║  1번째 줄
║  스코어    일일     상점   사진보관        ║
║   📖          📜          ✉️        ⚙️      ║  2번째 줄
║  게임설명서  개인정보·라이센스  문의하기  설정  ║
╟───────────────────────────────────╢
║          [   광고 배너   ]              ║  하단 고정 (Phase 1 = 플레이스홀더)
╚═══════════════════════════════════╝
```

| 요소 | 동작 |
|---|---|
| 상단바 하트 | 현재 하트 수 + 다음 충전까지 남은 시간. 탭 → 상점 |
| 상단바 코인 | 현재 코인. 탭 → 상점 |
| ⚙️ (상단바 우측) | 설정 |
| 프로필 | 닉네임 + 마지막 플레이 난이도 + 그 난이도 최고 점수. 닉네임 탭 → 이름 변경 |
| 송금박스 [만들기] | 사람두더지 메이커(§5) 진입. 왼쪽에 최근 만든 얼굴 썸네일 2개 |
| 보관함 스트립 | 사진보관 화면과 같은 목적지(지름길) |
| 하수/고수/전설 pill | 하트 1 소모 → 그 난이도로 게임 시작(§6). 마지막 선택 난이도 하이라이트. 활성 사람두더지 없으면 메이커로 유도 |
| 스코어 | 최고 점수 + 플레이 히스토리(`mole.history` 이미 존재) |
| 일일 | 7일 출석(§8) |
| 상점 | 하트 구매 + 망치 스킨(§7) |
| 사진보관 | 보관함(§5.5) |
| 게임설명서 | 정적 텍스트: 룰·조작법 |
| 개인정보·라이센스 | 정적 텍스트: **"사진은 기기에서만 처리, 업로드 안 함"** + 에셋 크레딧(효과음ラボ 등, `audio/CREDITS.txt` 내용) |
| 문의하기 | `mailto:mrkyp@hanmail.net` |
| 설정 | 소리·진동·언어·데이터 초기화 (기존 `common/settings-ui.js` 재사용 or 간단 대체 — 구현 시 결정) |

**최고기록 문자 알림(`#start-best`)** — 홈 진입 시 위에서 툭 내려옴, 현재 애니메이션 그대로. 표시 내용 = 마지막 플레이 난이도의 최고 점수.

**상단바 주소창(`#hud-addr`)** — 홈에서는 "카카오톡" 또는 숨김(구현 시 결정, 기본안 = "더보기" 텍스트를 상단바에 두고 `#hud-addr` 숨김).

---

## 4. 첫 실행 온보딩

- 판별: `localStorage['mole.onboarded']` 없음.
- 흐름: 짧은 환영 1문장 → **사람두더지 메이커 강제 1회**(§5, 건너뛰기 없음) → 저장 → 그 얼굴을 활성으로 → **하수 게임 바로 시작**(첫 판은 하트 소모 없음).
- 완료 시 `mole.onboarded = '1'`. 이후 실행은 홈화면.
- 애니메이션 안 도는 환경 대비: 환영 문장은 1.2초 후 즉시 표시 폴백.

---

## 5. 사람두더지 메이커

### 5.1 흐름

```
[만들기]
  ▼
① 사진 선택   <input type="file" accept="image/*">  (갤러리 or 카메라)
  │           원본은 메모리에만. 저장·업로드 안 함.
  ▼
② 얼굴 맞추기  원형 마스크 고정 + 사진을 드래그/핀치로 확대·이동
  │           "얼굴을 원 안에 맞춰주세요"   [다음]
  ▼
③ 미리보기    잘린 얼굴 원 → 두더지 머리에 얹은 모습, 뿅 올라오는 애니
  │           "이 두더지로 할까요?"   [저장]  [다시]
  ▼
④ 저장        이름(선택) → 보관함(IndexedDB). 저장물 = 얼굴 원 PNG 1장
  ▼
⑤ 완료        "홈으로"  또는  "바로 하수 게임"
```

### 5.2 확정 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 얼굴 선택 | **수동 원형 크롭** (자동 얼굴인식 X) | 안드로이드 WebView에서 얼굴인식 불안정. 오프라인 100% 동작 |
| 저장 형식 | **잘린 얼굴 원 PNG 1장** (256×256, 원 밖 투명), 원본 사진 저장 안 함 | 용량 ~50–100KB, 개인정보 최소 |
| 합성 시점 | **저장은 얼굴만, 게임 중 실시간 합성** | 두더지 8포즈에 매 프레임 얼굴을 머리 위치에 그림. 아트 바뀌어도 유지 |
| 적용 범위 | **그 판의 두더지 전부 활성 얼굴** | 단순·임팩트. 동물(장애물)엔 얼굴 안 붙임 |
| 보관함 상한 | 20개 | 초과 시 저장 전 "오래된 것 삭제" 안내 |

### 5.3 크롭 UI (`js/face-maker.js`)

- 고정 원형 창(보드 폭의 ~70%), 그 아래 사진 `<img>`이 CSS `transform: translate() scale()`.
- 포인터 드래그 = 이동, 두 손가락 핀치 / 휠 = 스케일. 바닐라 포인터 이벤트, 라이브러리 없음(프로젝트 관례).
- [다음] → 보이는 원 영역을 오프스크린 캔버스(256²)에 그림 → `ctx.globalCompositeOperation='destination-in'` 원형 마스크 → `canvas.toBlob('image/png')` → 스토어로.
- 경계: 사진을 원 밖으로 못 빼도록 팬/줌 클램프.

### 5.4 실시간 합성 (`pop-elements.js` 변경)

- 접근: **CSS 레이어** (캔버스 아님). `.mole-pop` 클립 박스 안에 두더지 `<img>` 위로 얼굴 `<img class="mole-face">`를 절대배치.
  - 얼굴 위치·크기 = 그 포즈의 머리 앵커. `border-radius:50%`로 원형 유지.
  - 두더지가 가라앉을 때(depth sink) 클립 박스가 같이 내려가므로 얼굴도 따라감 — 추가 코드 없음.
  - 포즈 프레임 교체(전신→빠끔→모자) 시 앵커도 교체.
- 빠끔/모자 프레임: 앞 구멍 테두리(`hole-front`)에 얼굴 일부가 가려짐 — 의도된 것(고개만 빼꼼).
- 활성 얼굴 없으면(예외 상황) 얼굴 레이어 생략, 기본 두더지.

### 5.5 머리 앵커 데이터 (`mole-sprites.js` 변경)

```js
MG.MoleSprites.HEAD_ANCHOR = {
  mole1: { cx: 0.50, cy: 0.30, r: 0.26 },   // 스프라이트 박스 대비 비율
  mole2: { ... }, ...  mole8, peek1, peek2, helmet
};
```
- 측정: 각 스프라이트에서 얼굴 중심·반경을 눈으로 재서 상수로 박음 (8+3개). 슬라이스 스크립트가 아니라 1회 수동 측정 → 커밋.
- 검증: 게임 내 스크린샷으로 얼굴이 두더지 머리에 맞는지 포즈별 확인.

### 5.6 얼굴 스토어 (`js/face-store.js`)

IndexedDB DB `moleFaces`, store `faces` (keyPath `id`).

```
{ id, name, blob(PNG), createdAt }
```

| 함수 | 동작 |
|---|---|
| `saveFace(blob, name)` | id 생성(timestamp), 저장. 20개 초과면 reject('full') |
| `listFaces()` | createdAt desc |
| `getFace(id)` / `getActive()` | Blob → objectURL |
| `deleteFace(id)` | 삭제. 활성이었으면 활성 해제 |
| `setActive(id)` / `getActiveId()` | `localStorage['mole.activeFaceId']` |

- 테스트: `fake-indexeddb`로 save/list/delete/20개상한/활성 (`scripts/test-face-store.js`).

### 5.7 보관함 화면 (`#face-locker`)

- 활성 얼굴 여러 개 저장 목록(그리드). 각 항목: 두더지에 얹은 미리보기 썸네일.
- 항목 탭 → [게임에 넣기(=활성 지정)] / [이름 변경] / [삭제].
- 상단 [+ 새로 만들기] → 메이커.

### 5.8 개인정보

- 원본 사진: `<input>` → `FileReader`/`createImageBitmap`으로 메모리에서만. **저장·전송 절대 없음.**
- 저장물: 잘린 얼굴 원 PNG만, IndexedDB(기기 로컬).
- 설정 → "데이터 초기화"가 얼굴 스토어도 비움.

---

## 6. 난이도 (하수 / 고수 / 전설)

| | 하수 | 고수 | 전설 |
|---|---|---|---|
| 버튼 불 (어느 구멍에 두더지 있는지 표시, `.lane-button--hot`) | **켜짐** | 꺼짐 | 꺼짐 |
| 동물(장애물) | 없음 | 없음 | **있음** |
| 그 외(속도·노출·동시수) | ← 하수 = 고수 동일 → | | 고수 + 동물 (세부 튜닝 Phase 3) |

- **하수 = 고수**는 게임 내용 동일, **버튼 불 도움만** 차이.
- **전설 = 고수 + 동물**. "더 빡세게 + α"(가짜 두더지·구멍 이동·시간 아이템 등)는 **Phase 3에서 사용자가 세팅** — 지금은 훅만.
- 구현:
  - `#game-screen`에 난이도 클래스(`.diff-easy` / `.diff-mid` / `.diff-legend`).
  - `.diff-mid .lane-button--hot`, `.diff-legend .lane-button--hot` → hot 글로우 무력화(CSS만).
  - `spawn-scheduler.create({ obstacles: boolean })` — `false`면 `animal`/`goggleAnimal` 스폰 안 함(하수·고수). 기존 3분기에서 obstacle 롤을 건너뜀.
  - 난이도는 **세션 값** `localStorage['mole.difficulty']` (`easy`|`mid`|`legend`), 홈 pill로만 변경.
- 최고 점수 키 분리: `localStorage['mole.best.<difficulty>']`. 기존 `moleBestScore` → `mole.best.easy` 마이그레이션(있으면 옮기고 삭제).

---

## 7. 하트 · 코인 · 상점

### 7.1 하트 (`js/economy.js`)

- `localStorage`: `mole.hearts`(정수), `mole.heartsAt`(마지막 갱신 timestamp).
- 상한 `HEART_MAX = 5`. 자동 충전 `REGEN_MS = 20*60*1000` (20분/개, 0→만땅 100분).
- 앱 열 때 계산(순수 함수, 테스트 대상):
  ```
  regen(stored, at, now) → { hearts: min(MAX, stored + floor((now-at)/REGEN_MS)),
                             at: 충전이 있었으면 at + n*REGEN_MS, 만땅이면 now }
  ```
- 게임 시작 = 하트 −1. 0이면 시작 막고 모달: [광고 보고 +1] (스텁) / [상점] / [닫기].
- 첫 온보딩 게임은 하트 소모 없음.
- 다시하기도 하트 −1.

### 7.2 코인

- `localStorage['mole.coins']`.
- 획득: 라운드 클리어(누적 점수 기준 소량, 예: `floor(총점/200)`), 일일 출석, 광고 시청.
- 사용: 하트 구매(100코인=하트1), 망치 스킨.

### 7.3 상점 화면 (`#shop`) — Phase 1 최소

- **하트**: `+1 (100코인)`, `가득 채우기 (400코인)`, `광고 보고 +1` (스텁).
- **코인**: `광고 보고 +50` (스텁). (실제 코인팩 결제는 Phase 2.)
- **망치 스킨**: 기본 + 1종(플레이스홀더 스프라이트, 예: 금색 틴트). `lane-hammer.create({ sprite })`가 이미 `sprite` 파라미터 받음 — 선택 스킨을 넘김. `localStorage['mole.hammerSkin']`.
- "광고 제거"·코인팩 = Phase 2.

---

## 8. 일일 출석 (`#daily`) — Phase 1 최소

- 7칸. 하루 1회 오늘 칸 열기 → 코인 보상(1일차 20 … 7일차 100).
- `localStorage['mole.daily']` = `{ streak, lastClaim(YYYY-MM-DD) }`. 하루 거르면 streak 1로.
- "광고 보고 2배" 버튼(스텁).
- 데일리 미션(처치수/콤보 목표)은 Phase 3.

---

## 9. 광고 (`js/ads.js`) — Phase 1 = 스텁

- 모듈 인터페이스:
  ```js
  MG.Ads = {
    banner(el),                 // 홈 하단: 플레이스홀더 div ("광고")
    interstitial() → Promise,   // 2초 가짜 로딩
    rewarded() → Promise<bool>  // 2초 가짜 → true(보상 지급)
  }
  ```
- 3곳:
  1. **홈 하단 배너** — 항상.
  2. **게임오버 후** — `interstitial()` 1회(빈도 제한: N판마다), 그리고 결과 화면의 "광고 보고 코인/하트" = `rewarded()`.
  3. **일일 2배** — `rewarded()`.
- Phase 2에서 이 3개 메서드 본문만 Capacitor AdMob 플러그인 호출로 교체. 호출부 안 바뀜.

---

## 10. 코드 구조 (Phase 1)

### 새 모듈

| 파일 | 역할 | 인터페이스 |
|---|---|---|
| `js/home-screen.js` | 더보기 홈 렌더 + 탭 배선 | `create({ root, on: { make, locker, play(diff), shop, daily, score, settings, help, privacy } })` → `{ show(), refresh() }` |
| `js/face-maker.js` | 사진 선택 + 원형 크롭 UI | `create({ root })` → `{ open({ forced, onDone(faceId) }) }` |
| `js/face-store.js` | IndexedDB 얼굴 CRUD + 활성 | `saveFace / listFaces / getFace / getActive / deleteFace / setActive / getActiveId` |
| `js/face-locker.js` | 보관함 목록 화면 | `create({ root, onMake })` → `{ show() }` |
| `js/economy.js` | 하트 충전 계산 + 코인 | `regen(...)`(순수), `getHearts() / spendHeart() / addHearts(n)`, `getCoins() / addCoins(n) / spendCoins(n)` |
| `js/ads.js` | 광고 스텁 3종 | `banner(el) / interstitial() / rewarded()` |
| `js/shop.js` | 상점 화면 | `create({ root })` → `{ show() }` |
| `js/daily.js` | 출석 화면 | `create({ root })` → `{ show(), claimableToday() }` |

각 모듈은 게임 규칙을 모른다. `game.js`가 오케스트레이션.

### 변경

| 파일 | 변경 |
|---|---|
| `js/game.js` | 진입점 재구성: `showHome()`(← `showStartScreen` 대체), `startGame(difficulty)` = 하트 −1 → 활성 얼굴 조회 → `startRound(1,{fresh})`. 캐릭터/카톡 대화 코드·상수·헬퍼 삭제. `state`에 `difficulty` 보관. `startRound`에서 `spawn-scheduler.create({ obstacles: difficulty==='legend' })`. `#btn-back-to-hub` → `showHome()`. 온보딩 분기. 결과 화면에서 코인 지급 + `mole.best.<diff>` 갱신. `#start-best` 리타깃(마지막 난이도 최고점). |
| `js/spawn-scheduler.js` | `create({ ..., obstacles = true })`. `obstacles===false`면 obstacle 스폰 스킵(두더지만). 나머지 그대로. |
| `js/pop-elements.js` | 활성 얼굴 있으면 `.mole-pop`에 `<img class="mole-face">` 레이어(머리 앵커 위치), 포즈/뎁스 따라 갱신. 동물 pop엔 안 붙임. |
| `js/mole-sprites.js` | `HEAD_ANCHOR` 상수 추가 + `headAnchor(spriteName)` 헬퍼. |
| `js/hud.js` | 게임 중 HUD는 그대로. (홈 상단바는 `home-screen.js` 담당.) |
| `index.html` | `#board-start`(카톡 대화) → `#home-screen` + 화면 패널들(`#face-maker` `#face-locker` `#shop` `#daily` `#score` `#help` `#privacy`, 모두 `board-panel`). `#start-best` 유지. 새 스크립트 로드. `<title>`/메타 이름 정리. |
| `style.css` | `.chat-*` 삭제. `.home-screen`(더보기 다크 레이아웃), 상단바(하트/코인), pill, 2×2 그리드, `.face-maker`(원형 크롭), `.face-locker`, `.shop`, `.daily`, `.mole-face`(원형 얼굴 레이어), `.diff-* .lane-button--hot { 무력화 }`. |
| `sw.js` | SHELL에서 `avatar-mole.png`/`avatar-hippo.png` 제거, 새 js 추가. `CACHE` 버전업. |
| `manifest.json` | 이름/아이콘/`theme_color` 독립 앱용으로 정리. |
| `scripts/verify-mole-smoke.js` | 홈화면·하트 소모·메이커(모의 파일 업로드)·난이도 클래스·얼굴 레이어 검사로 확장. |
| `#build-tag` | 진단 마커 유지(버전 표기). |

### 삭제(고아)

`assets/avatar-mole.png`, `assets/avatar-hippo.png`, `game.js`의 카톡 대화 상수·헬퍼, `style.css`의 `.chat-*`.

---

## 11. 데이터 흐름 (게임 시작, 얼굴 적용)

```
홈 pill "고수" 탭
  → home-screen on.play('mid')
  → game.startGame('mid'):
       economy.spendHeart()  // 0이면 모달 띄우고 중단
       faceId = faceStore.getActiveId()   // 없으면 face-maker.open({forced:false}) 유도
       faceUrl = await faceStore.getActive()
       #game-screen.classList = 'diff-mid'
       startRound(1, { fresh: true })
         scheduler = SpawnScheduler.create({ ..., obstacles: false })  // mid → 동물 없음
  → 매 스폰: pop-elements 가 pop 생성 시 faceUrl 있으면 .mole-face 레이어 부착
             (mole-sprites.headAnchor(현재포즈) 위치, 원형)
  → 타격/침몰: 기존 그대로. 얼굴은 클립 박스 따라 같이 내려감.
  → finish: economy.addCoins(floor(총점/200)); mole.best.mid 갱신; 결과 화면
```

타격 판정·`onHammerImpact`·`sinkIn`·타격음은 **현재 그대로**. 이번 변경은 (a) 진입 오케스트레이션, (b) 얼굴 레이어, (c) obstacle 토글뿐.

---

## 12. 테스트 (성공 기준)

### 단위 (`node assert`)

- `scripts/test-economy.js` (신규): `regen()` — 경과시간별 충전 개수, 상한 클램프, `at` 진행; 만땅에서 시간 지나도 상한.
- `scripts/test-face-store.js` (신규, `fake-indexeddb`): save→list 순서, delete, 20개 상한 reject, setActive/getActiveId, delete가 활성 해제.
- `scripts/test-spawn-scheduler.js` 확장: `obstacles:false` → 수백 번 스폰해도 `animal`/`goggleAnimal` 안 나옴; `obstacles:true` → 나옴(기존 동작).
- `scripts/test-mole-sprites.js` 확장: `HEAD_ANCHOR`에 8+3 포즈 존재, 각 `cx/cy/r`가 0~1.
- 기존 `run-all-tests.js` 전부 green.

### 스모크 (`scripts/verify-mole-smoke.js`, puppeteer)

- 홈화면: 하트/코인 표시, 3 pill, 2×2 그리드 항목.
- 메이커: 모의 이미지 파일 주입 → [다음] → [저장] → `face-store`에 1건, 활성 지정.
- 얼굴 레이어: 활성 얼굴 있는 상태로 게임 시작 → `.mole-pop .mole-face` 존재, 두더지 침몰 시 같이 이동.
- 난이도: `하수` → `#game-screen.diff-easy` + `.lane-button--hot` 살아있음; `고수` → `.diff-mid` + hot 무력화; `전설` → 동물 스폰됨.
- 하트: pill 탭 시 하트 −1; 하트 0에서 모달.
- 결과 화면: 코인 증가, `mole.best.<diff>` 저장.
- `moleBestScore` → `mole.best.easy` 마이그레이션.
- 온보딩: `mole.onboarded` 없을 때 첫 진입이 메이커(강제) → 하수 게임, 하트 소모 없음.
- 기존 검사(두더지 `<img>` 스프라이트, 16구멍, 레인 버튼 16, 직접터치 무효, 타격 타이밍, 일시정지) 유지.

### 전체 재검

- `run-all-tests.js` + `verify-mole-smoke.js` green.
- 게임 내 스크린샷: 홈, 메이커 3단계, 보관함, 각 난이도 플레이(얼굴 얹힌 두더지 포즈별로 맞는지), 결과 화면, 상점, 일일.
- 삭제 확인: `.chat-*` CSS 없음, avatar PNG 2개 없음, 카톡 대화 DOM 없음.

### 디버그 훅 (영구 보존)

추가: `__debugShowHome()`, `__debugStartGame(diff)` (인자 없으면 `'easy'` — 기존 무인자 호출 호환), `__debugSetHearts(n)`, `__debugSetCoins(n)`, `__debugAddFace()` (더미 얼굴 1개 생성+활성), `__debugSkipOnboarding()`.
기존 `__debugStartRound`/`__debugEndRound`/`__debugForceGameOver`/`__debugHitCell`/`__debugHittableMoleRegion`/`__debugPumpCombo` 유지.

---

## 13. 확정한 세부 결정 (스펙 리뷰에서 뒤집을 수 있음)

- 얼굴 저장 = 잘린 원 PNG만, 원본 사진 저장/전송 없음.
- 게임 중 얼굴 합성 = CSS 레이어(캔버스 아님).
- 그 판의 두더지 전부 활성 얼굴 하나. 판 중 얼굴 교체 없음.
- 하수 = 고수 (버튼 불만 차이), 전설 = 고수 + 동물. 전설 세부는 Phase 3.
- 하트: 20분/개, 상한 5, 게임·다시하기 각 −1, 온보딩 첫 판 무료.
- 코인 획득 공식 `floor(총점/200)` (튜닝 가능).
- 난이도·활성얼굴은 `localStorage`, 얼굴 이미지는 IndexedDB.
- 상점 Phase 1 = 하트/코인 광고·코인교환 + 스킨 1개. 광고제거·코인팩 결제는 Phase 2.
- 일일 = 7일 출석 + 코인. 미션은 Phase 3.
- `MG.LEVELS` 난이도표, `combo-score.js`, `ROUND_SECONDS(30)`/`FINAL_ROUND(10)`/`START_LIVES(3)`, 타격 연출·사운드·타이밍: **변경 없음**.
- 게임 화면 좌상단 2×2 아이콘 → 홈화면(허브 삭제).

---

## 14. Phase 2 — 네이티브 포장 (방향만)

- **Capacitor**로 `mole/` 웹 자산을 안드로이드 WebView 앱으로 래핑. 웹 코드 ~95% 재사용.
- `@capacitor-community/admob` → `js/ads.js`의 `banner/interstitial/rewarded` 본문 교체(호출부 불변).
- WebView `forceDarkAllowed=false` → 삼성 계열 강제 다크 완전 차단(다크 네이티브 설계라 영향 적지만 확실히).
- 파일 선택: Capacitor `Camera`/`Filesystem` 플러그인으로 갤러리·카메라 접근 견고화(웹 `<input>` 폴백 유지).
- 서비스워커 → 앱에선 자산 번들이라 사실상 불필요(유지해도 무해).
- 플레이스토어: 아이콘·스크린샷·개인정보처리방침 URL·콘텐츠 등급·내부 테스트 트랙. AAB 서명.
- 인앱결제(Google Play Billing): "광고 제거", 코인팩.
- 각 항목 별도 스펙.

---

## 15. Phase 3 — 모드 시스템 + 전설 (방향만)

2026-09-02 `mole-theme-mode-system-design.md`의 내용 이월:

- 모드: ②폭탄 ③다때려잡기 ④안경만(안경 없는 걸 치면 감점) ⑤두더지빼고 — `target`/`penalty`/`spawnWeights` 데이터 설정으로.
- 난이도(하수/고수/전설)와 모드는 직교. 전설에서 모드가 열리는 식일 수도(구현 시).
- **전설 세부**: 가짜 두더지(때리면 감점), 구멍 이동, 사람두더지 사이 진짜 두더지 섞임, 시간 감소 아이템 등 — 사용자가 세팅.
- `goggleMole` 독립 타입화(`mole7` 포즈 풀에서 분리).
- 별도 스펙.

---

## 16. 레포 분리 (스펙 승인 후, 구현 전)

**사용자 확정:** 두더지 게임은 fun-games-hub에서 떨어져 독립한다.

1. `git tag archive/hub-snapshot` 현재 HEAD에 (지렁이·색칠 코드 히스토리 보존).
2. 분리 방식 — **구현 시 결정**, 기본안:
   - 옵션 A: `mole/` 내용을 새 레포로 옮김(`git subtree split` 또는 새 레포 + 히스토리 복사). 깔끔하지만 작업량 큼.
   - 옵션 B: 이 레포에서 `snake/`·`coloring/`·`match/`·`hub.*` 삭제 + 루트를 두더지로 승격, 레포 이름만 GitHub에서 변경. 저위험.
   - **기본안 = B.** 레포/URL 이름 변경은 사용자가 GitHub 웹에서.
3. `common/settings.*`·`cosmic-theme.css`는 두더지가 참조하므로 유지(위치 그대로, "공유" 개념만 사라짐).
4. GitHub Pages: 루트가 두더지 홈으로 열리게(`index.html` 승격 or 리다이렉트).
5. `기획서/` 폴더(사용자 .odt)·`두더지게임-기획서.md` = 사용자 문서, 이번엔 손대지 않음.

---

## 17. 범위 밖

- Phase 2 전체(Capacitor·AdMob·결제·스토어).
- Phase 3 전체(모드 시스템·전설 세부).
- 실제 망치 스킨 아트(플레이스홀더 1종만).
- 얼굴 자동 인식/보정, 여러 얼굴 한 판에 섞기.
- 리더보드/온라인 랭킹(서버 필요).
- 닉네임 외 프로필 커스텀.
- 레포/GitHub URL 이름 변경(사용자가 직접).

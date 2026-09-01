# fun-games-hub 허브 셸 + 공용 설정/다국어 — 설계

작성 2026-09-02.

## 1. 목표

fun-games-hub 에 색칠앱 표지 화면과 같은 **공용 셸**(우상단 언어/설정 버튼 + 하단 탭바)을
붙이고, 허브·두더지·그림맞추기가 **하나의 설정값**(언어·소리·BGM·진동)을 공유하게 한다.
두더지 게임에는 색칠앱 보스 BGM 을 붙인다.

성공 기준:

- 허브 우상단 🌐 로 한↔영 실시간 전환, 새로고침 후에도 유지된다.
- 허브 우상단 ⚙️ 설정 모달에서 소리·BGM·진동을 켜고 끄면 저장되고, 두더지 게임이 그 값을 따른다.
- 두더지 게임 시작 후 BGM 이 (설정이 켜져 있을 때만) 흐르고, 설정에서 끄면 멈춘다.
- 두더지·그림맞추기의 눈에 보이는 문구가 `appLang` 에 따라 한/영으로 뜬다.
- 기존 두더지 점수 어택 흐름과 지렁이 게임은 회귀 없이 그대로다.

## 2. 범위 밖 (Non-goals)

- **지렁이 게임** — 이번 작업에서 제외. `common/*` 로드도 안 한다.
- **색칠앱** — 코드 변경 없음. 이미 `appLang`/`musicOn`/`vibrationOn` 키를 쓰므로 저장키 통일만으로 허브 설정을 따라간다.
- 게임 화면 안의 언어 전환 버튼(🌐) — 없음. 게임은 로드 시 `appLang` 1회 적용.
- 게임을 직접 열었을 때(북마크/PWA)의 설정 UI — 없음. 설정은 허브에서만. (사용자 확정)
- 스코어/앨범/상점 탭의 실제 기능 — "준비 중" 플레이스홀더만.
- 3개 언어 이상, 음량 슬라이더, 게임별 개별 BGM.

## 3. 저장키와 기본값

`localStorage`, origin `mrkyp-png.github.io` 전체 공유 (배포된 색칠앱과도 공유 — 의도된 동작).

| 키 | 값 | 기본 | 비고 |
|---|---|---|---|
| `appLang` | `'ko'` \| `'en'` | 브라우저 언어가 `ko*` 면 `ko`, 아니면 `en` | 색칠앱과 동일 키 |
| `soundOn` | `'1'` \| `'0'` | `'1'` (켜짐) | 색칠앱은 미저장이었음 → 이제 저장 |
| `musicOn` | `'1'` \| `'0'` | `'0'` (꺼짐) | 색칠앱과 동일 키. 색칠앱 기본은 꺼짐과 호환 |
| `vibrationOn` | `'1'` \| `'0'` | `'1'` (켜짐) | 색칠앱과 동일 키 |

읽을 때 값이 없거나 이상하면 위 기본값으로 폴백한다.

## 4. `common/` — 공용 코드 (신설 폴더)

`fun-games-hub/common/`. 허브는 `common/x.js`, 게임은 `../common/x.js` 로 로드.
모든 파일은 IIFE + `window.FGH` 네임스페이스. Node 단위 테스트용 `module.exports` 병행.

### 4.1 `common/settings.js` → `window.FGH.Settings`

설정 단일 소스. DOM 을 모른다 (UI 는 settings-ui.js).

```
Settings.get(name)          // name: 'lang'|'sound'|'music'|'vibration'
                            //  → 'ko'/'en' | boolean | boolean | boolean
Settings.set(name, value)   // localStorage 저장 + onChange 구독자 호출
Settings.onChange(cb)       // cb(name, value) — 반환값은 구독 해제 함수
Settings.vibrate(pattern)   // vibration 켜져 있을 때만 navigator.vibrate(pattern)
Settings.sfxEnabled()       // === get('sound')
```

- 같은 탭 내 `set()` → 즉시 `onChange` 통지.
- 다른 탭/창에서 바뀐 경우 `window` 의 `storage` 이벤트를 듣고 `onChange` 통지 (허브에서 바꾸고 게임 탭이 열려 있을 때).
- 잘못된 `name`/`value` 는 조용히 무시 (throw 안 함).

### 4.2 `common/i18n.js` → `window.FGH.I18N`

```
I18N.register({ ko: { key: '문구', ... }, en: { key: 'text', ... } })
    // 여러 번 호출 가능 — 화면마다 자기 문구 등록. 나중 등록이 같은 키를 덮어씀.
I18N.t(key)                 // 현재 언어 문구. 없으면 en → 없으면 key 그대로 반환
I18N.lang                   // 'ko' | 'en'
I18N.setLang(l)             // appLang 저장 + applyStatic() + onChange 통지
I18N.applyStatic(root=document)
    // root 안의 [data-i18n] → textContent = t(속성값)
    //                [data-i18n-aria-label] → aria-label
    //                [data-i18n-placeholder] → placeholder
I18N.onChange(cb)           // cb(lang)
```

- 로드 시 `appLang` 을 읽어 `I18N.lang` 세팅. `Settings` 와 언어값을 공유하기 위해
  `I18N.setLang` 은 `Settings.set('lang', l)` 를 호출하고, `Settings.onChange('lang')` 도 듣는다
  (둘 중 하나만 호출해도 동기화되도록).
- **로드 순서**: `settings.js` → `i18n.js` → 화면별 문구 등록 스크립트 → 화면 로직.
  `common/i18n.js` 자체는 공용 키(설정 모달, 공통 버튼 "닫기"/"허브로"/"나가기"/"다시하기")만 내장.

### 4.3 `common/settings-ui.js` + `common/settings.css` — **허브 전용**

- `SettingsUI.mount()` → 우상단에 🌐 버튼 + 🌐 메뉴(한국어/English) + ⚙️ 버튼 + ⚙️ 모달 마크업을
  `document.body` 에 주입하고 배선.
- ⚙️ 모달 = 소리 / BGM / 진동 토글 행 3개 + 닫기. 각 행: [아이콘 SVG] [라벨 data-i18n] [on/off 스위치].
- 토글 → `Settings.set(...)`. 아이콘/스위치 상태는 `Settings.onChange` 로 갱신.
- 모든 아이콘은 **인라인 SVG**(lane-controls.js 선례 — 이모지 tofu 회피). `currentColor`.
  - 소리: 스피커 (on) / 스피커+빗금 (off)
  - BGM: 음표 (♪)
  - 진동: 진동 물결
  - 언어: 지구본
  - 설정: 톱니바퀴
- 색칠앱 `#btn-lang`/`#lang-menu`/`#settings-modal` 의 배선 로직(`wireLangSwitcher`, 바깥 클릭 닫기)을 참고해 재구현 — **코드 복사 아님**, ko/en 2개로 단순화.

## 5. 허브 `index.html` 재작성

배경은 지금 우주 테마(`cosmic-theme.css` 의 별/성운) 유지.

### 5.1 구조

```
<div class="cosmic-bg">
  (settings-ui.js 가 주입: 🌐 / ⚙️ — position:fixed 우상단, safe-area 고려)

  <section id="home-screen"   class="hub-screen">   ... 게임 4카드 그리드 (현재 내용) ...
  <section id="score-screen"  class="hub-screen" hidden> "준비 중" 플레이스홀더
  <section id="album-screen"  class="hub-screen" hidden> "준비 중" 플레이스홀더
  <section id="shop-screen"   class="hub-screen" hidden> "준비 중" 플레이스홀더

  <nav id="tab-bar"> 스코어 / 앨범 / 홈 / 상점  (4개, 인라인 SVG 아이콘 + data-i18n 라벨)
</div>
```

- 탭 전환은 순수 표시 토글 (`hidden`). "홈"이 기본.
- **"더보기" 탭 없음** — 설정은 우상단 ⚙️.
- 탭바 = 색칠앱 탭바의 시각 스타일 참고, 4칸 균등. 활성 탭 인디케이터는 선택 (있으면 색칠앱처럼 슬라이드).
- 게임 카드 이름(지렁이/두더지/그림맞추기/색칠하기)에 `data-i18n`.

### 5.2 스크립트 로드

```
common/settings.js
common/i18n.js
hub-strings.js            (허브 문구 ko/en 등록)
common/settings-ui.js
hub.js                    (탭 전환 로직 + SettingsUI.mount() + I18N.applyStatic())
```

기존 허브는 인라인 `<style>`/`<script>` 없음(정적) — `hub.js` 신설, CSS 는 인라인 유지하거나 `hub.css` 로 분리(택1, 구현 시 결정).

## 6. 두더지 게임 변경

- `index.html`: `<head>` 에 `../common/settings.css` 링크 추가.
  `<body>` 끝에 스크립트 추가(기존 `js/*` 보다 먼저): `../common/settings.js`, `../common/i18n.js`, `js/i18n-strings.js`.
- `<audio id="bgm" loop preload="auto">` 추가.
- 눈에 보이는 문구를 `data-i18n`(정적) 또는 `I18N.t()`(동적) 로 전환 — §9 인벤토리.
  - 정적: 시작 화면 문구, 시작 버튼, 결과 화면 버튼("다시하기"/"나가기")
  - 동적(JS 가 매번 씀): 카운트다운 "시작!", 결과 사유 "시간 종료!"/"목숨 소진!", "…점", "최고 기록 …", HUD 티커 모드명/`초`/`COMBO`, 타격 이펙트 "톡!"/"쾅!"
- `js/hit-fx.js`:
  - `tone()` 호출 앞에 `if (!window.FGH.Settings.sfxEnabled()) return;` 게이트 (헬퍼 안에서 1곳).
  - `vibrate()` 헬퍼를 `window.FGH.Settings.vibrate(pattern)` 로 교체 (진동 설정 반영).
- `js/hud.js`: `MODE_TITLE` 등 하드코딩 문구를 `I18N.t('mole.mode')` 등으로.
- `js/game.js`: BGM 제어 — `startGame()` 의 첫 사용자 제스처(시작 버튼 클릭) 이후
  `Settings.get('music')` 면 `bgm.play()`. `Settings.onChange('music')` 로 켜기/끄기.
  `endGame`/`showStartScreen` 에서 계속 틀지 멈출지는 구현 시 결정(권장: 결과 화면에서도 계속, 허브로 나가면 정지).
  자동재생 차단 시 조용히 무시 (`.catch(()=>{})`).
- `mole/audio/bgm-boss-battle.mp3` — `coloring/audio/bgm-boss-battle.mp3` (CC0, "Battle RPG Theme" by Cleyton Kauffman) 복사. 볼륨 0.35.
- `sw.js`: `CACHE` `v5` → `v6`. `SHELL` 에 `./audio/bgm-boss-battle.mp3`,
  `../common/settings.js`, `../common/i18n.js`, `../common/settings.css`, `./js/i18n-strings.js` 추가.
  (BGM 6.8MB 가 install 캐시에 포함됨 — 첫 로드 느려질 수 있음. `bgm` 은 SHELL 에서 빼고
  런타임 stale-while-revalidate 에 맡기는 대안도 가능 — 구현 시 결정.)

## 7. 그림맞추기 변경

placeholder 4문구(`그림맞추기`, `준비 중이에요. 곧 만나요!`, `← 허브로`, `<title>`)에 `data-i18n`.
`../common/settings.js` + `../common/i18n.js` + 인라인 문구 등록 + `I18N.applyStatic()` 한 줄.
(BGM/효과음 없음 — 게이팅 대상 없음.)

## 8. 오디오 & 진동 요약

| | 소스 | 게이트 |
|---|---|---|
| 두더지 BGM | `mole/audio/bgm-boss-battle.mp3` (`<audio loop>`) | `Settings.get('music')`, 첫 제스처 후 재생 |
| 두더지 효과음 | `hit-fx.js` WebAudio `tone()` | `Settings.sfxEnabled()` |
| 두더지 진동 | `hit-fx.js` `navigator.vibrate` | `Settings.vibrate()` (= `vibrationOn`) |

## 9. 문구 인벤토리 (ko / en)

### 9.1 공용 (`common/i18n.js` 내장)

| key | ko | en |
|---|---|---|
| `common.close` | 닫기 | Close |
| `common.toHub` | 허브로 | Hub |
| `common.back` | 나가기 | Exit |
| `common.retry` | 다시하기 | Retry |
| `settings.title` | 설정 | Settings |
| `settings.sound` | 소리 | Sound |
| `settings.music` | 배경음악 | Music |
| `settings.vibration` | 진동 | Vibration |
| `settings.lang` | 언어 | Language |
| `lang.ko` | 한국어 | 한국어 |
| `lang.en` | English | English |

### 9.2 허브 (`hub-strings.js`)

| key | ko | en |
|---|---|---|
| `hub.title` | Fun Games | Fun Games |
| `hub.tab.score` | 스코어 | Score |
| `hub.tab.album` | 앨범 | Album |
| `hub.tab.home` | 홈 | Home |
| `hub.tab.shop` | 상점 | Shop |
| `hub.card.snake` | 지렁이 | Snake |
| `hub.card.mole` | 두더지 | Whack-a-Mole |
| `hub.card.match` | 그림맞추기 | Match |
| `hub.card.coloring` | 색칠하기 | Coloring |
| `hub.comingSoon` | 준비 중이에요. 곧 만나요! | Coming soon! |

### 9.3 두더지 (`mole/js/i18n-strings.js`)

| key | ko | en |
|---|---|---|
| `mole.title` | 두더지 게임 | Whack-a-Mole |
| `mole.start.tag` | 1분 동안 두더지를 최대한 많이 잡아 점수를 올려요! | Whack as many moles as you can in 60 seconds! |
| `mole.start.btn` | 시작 | Start |
| `mole.start.best` | 최고 기록 {n}점 | Best {n} |
| `mole.count.go` | 시작! | Go! |
| `mole.result.time` | 시간 종료! | Time's up! |
| `mole.result.lives` | 목숨 소진! | Out of lives! |
| `mole.result.score` | {n}점 | {n} pts |
| `mole.result.newBest` | 최고 기록 달성! {n}점 | New best! {n} |
| `mole.result.best` | 최고 기록 {n}점 | Best {n} |
| `mole.mode` | 두더지만 때려잡자! | Whack those moles! |
| `mole.hud.sec` | {n}초 | {n}s |
| `mole.hud.combo` | COMBO {n} | COMBO {n} |
| `mole.hud.maxCombo` | MAX COMBO {n} | MAX COMBO {n} |
| `mole.fx.tap` | 톡! | Tap! |
| `mole.fx.bam` | 쾅! | Bam! |

`{n}` 치환은 `I18N.t(key).replace('{n}', v)` 수준의 단순 치환 헬퍼(`I18N.t(key, {n: v})`) 를 i18n.js 에 둔다.

다이얼러 버튼 라벨(연락처/키패드/최근기록/통화, 자음)은 **전화 위장**이라 번역 대상에서 제외 —
현행 유지. (스펙 결정: 위장 UI 는 로케일 무관.)

### 9.4 그림맞추기 (`match` 인라인)

| key | ko | en |
|---|---|---|
| `match.title` | 그림맞추기 | Match |
| `match.desc` | 준비 중이에요. 곧 만나요! | Coming soon! |

## 10. 테스트

### 10.1 단위 (`common/scripts/`, plain `node assert`)

- `test-settings.js` — 기본값(빈 스토리지), 저장·복원, `onChange` 통지, 잘못된 입력 무시,
  `vibrate()` 가 `vibrationOn=0` 일 때 `navigator.vibrate` 안 부름(모킹), `sfxEnabled` 연동.
- `test-i18n.js` — 키 없을 때 en 폴백 → key 폴백, `register` 병합/덮어쓰기, `{n}` 치환,
  `setLang` 이 `appLang` 저장.

`fun-games-hub/package.json` 에 `common` 테스트를 도는 스크립트 추가 (또는 각 게임 run-all-tests 패턴).

### 10.2 스모크 (puppeteer-core, Edge headless)

- **허브** `verify-hub-smoke.js` (신규):
  - 탭 4개 렌더, 클릭 시 해당 화면만 표시.
  - ⚙️ 열기 → 진동 토글 off → 모달 닫고 새로고침 → 토글 off 로 복원 (`vibrationOn='0'`).
  - 🌐 → English → 탭 라벨이 `Score/Album/Home/Shop`, 새로고침 후 유지.
- **두더지** `verify-mole-smoke.js` (확장):
  - 기존 점수 어택 흐름 전부 유지.
  - `<audio id="bgm">` 존재, `src` 가 `audio/bgm-boss-battle.mp3`.
  - `localStorage.musicOn='1'` 세팅 + 시작 → `bgm.paused === false` (자동재생 허용 헤드리스 가정; 막히면 `bgm.play` 호출 여부를 스텁으로 검증).
  - `localStorage.appLang='en'` + 시작 화면 → 시작 버튼 텍스트 `Start`.
  - `soundOn='0'` → `FGH.Settings.sfxEnabled() === false`.
- **지렁이** 기존 `verify-snake-smoke.js` 회귀 (변경 없어야 함).

### 10.3 수동/스크린샷

- 허브 한/영, 설정 모달, 탭 전환 — Edge 스크린샷.
- 두더지: BGM on 상태로 1판, 설정에서 끄면 멈추는지.

## 11. 커밋 계획

1. **커밋 A** (선행, 독립): 두더지 점수 어택 전환 (이미 완료·검증됨, 현재 uncommitted).
2. **커밋 B**: `common/` (settings.js + i18n.js + settings-ui.js + settings.css) + 단위 테스트.
3. **커밋 C**: 허브 재작성 (탭바 + 설정 UI 마운트 + i18n) + 허브 스모크.
4. **커밋 D**: 두더지 i18n + BGM + SFX/진동 게이팅 + sw.js + 스모크 확장.
5. **커밋 E**: 그림맞추기 i18n.

각 커밋마다 관련 테스트 그린 확인 후 진행. 전부 `master` 직커밋 (기존 관행), push 는 사용자 확인 후.

## 12. 확정된 결정 (재론의 금지)

- 언어 ko/en 2개. 지렁이 제외. 색칠앱 무변경.
- 설정은 허브에서만. 게임 안엔 🌐/⚙️ 없음.
- BGM: 두더지만, `bgm-boss-battle.mp3` 원본, 기본 꺼짐, 볼륨 0.35.
- 기본값: 소리 켜짐 / BGM 꺼짐 / 진동 켜짐.
- 저장키: `appLang`/`soundOn`/`musicOn`/`vibrationOn` (색칠앱과 통일, 동일 origin 공유 감수).
- 탭바 4개: 스코어 / 앨범 / 홈 / 상점. "더보기" 없음.
- 의성어 번역: 톡!→Tap! / 쾅!→Bam! / 시작!→Go!.
- 아이콘 전부 인라인 SVG.
- 다이얼러 위장 버튼 라벨은 번역 안 함.

## 13. 미결 (구현 중 판단, 되돌리기 쉬움)

- 허브 CSS 인라인 유지 vs `hub.css` 분리.
- 탭바 활성 인디케이터 슬라이드 애니메이션 넣을지.
- 두더지 BGM 을 sw.js SHELL 에 넣을지(6.8MB 선캐시) vs 런타임 캐시.
- 두더지 결과 화면에서 BGM 계속 vs 정지.

(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const CANNON_HOLE = 15;     // 대포 장착 시 없애는 구멍 (우하단 = row3·col3). 15구멍으로 플레이.
  const ROUND_SECONDS = 15;       // 챕터 1~2
  const ROUND_SECONDS_LONG = 30;  // 챕터 3부터 (난이도 상승분 보정 — 사용자 요청)
  function roundSeconds() { return currentChapter() >= 3 ? ROUND_SECONDS_LONG : ROUND_SECONDS; }
  const FINAL_ROUND = 10;     // 라운드 1~10
  // 처치 순간 게임 시간을 잠깐 멈춘다 (히트스톱) — 타격감. 콤보가 쌓일수록 조금 더 길게.
  const HITSTOP_BASE_MS = 90;
  const HITSTOP_MAX_MS = 150;

  // 라운드별 난이도는 MG.LEVELS 표(동시 두더지 1→5, 유지시간 2.5→1.0s, 방해물 증가)를 쓴다.
  // 16칸 클리어 개념은 없다 — 두더지는 16칸 아무 데나 랜덤 반복 등장, 60초가 끝나면 다음 라운드.

  // 재접/홈복귀 대화 문구 풀은 언어별이라 chat-phrases.js 로 뺐다 (MG.ChatPhrases).
  // 다시하기 축하 이모티콘 + 하마 기분 이모티콘 (언어 무관).
  const CELEBRATE_EMOJI = '🎉';
  const HIPPO_MOODS = ['❓', '❤️', '😡', '😂', '😐', '🙄', '✋', '🔥', '😅', '👍'];

  let state = null;   // 현재 라운드 상태 (시작 화면일 땐 null)
  // 10라운드를 통틀어 유지되는 것: 콤보·점수(1라운드부터 누적).
  // 목숨(run.lives)은 허브 공유 생명(MG.Economy) 그 자체다 — 동물 -1 / 콤보 100마다 +1 이
  // 즉시 공유 풀에 반영되고, 홈·더보기·게임 화면이 항상 같은 수를 보여준다. setRunLives() 로만 바꾼다.
  let run = null;     // { combo: ComboScore, lives, comboMilestone }
  const COMBO_LIFE_STEP = 100; // 콤보가 이 배수를 넘길 때마다 목숨 +1
  const JUGGLE_BONUS = 30;     // 저글(더블) 점수 — 작은 덤 (콤보 점수표 안 씀)
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성
  let sharedLaneControls = null; // 다이얼러 버튼 — 시작 화면에도 (비활성으로) 계속 보여야 하므로 세션당 한 번만 생성
  let sessionGen = 0; // startRound/showStartScreen 호출마다 +1 — 카운트다운·자동진행 타이머 취소 토큰

  // run.lives 는 공유 생명 풀(MG.Economy)과 항상 동기화된다.
  function setRunLives(n) {
    n = Math.max(0, n | 0);
    if (run) run.lives = n;
    MG.Economy.setHearts(n);
    refreshBoardStats();
  }

  // 홈(시작) 화면 우측 상단 하트·코인 숫자 — 공유 풀에서 다시 읽어 그린다.
  // 광고/콤보/동물 등으로 값이 바뀔 때마다 호출해 홈·더보기·게임이 같은 수를 보이게 한다.
  function refreshBoardStats() {
    const bs = document.getElementById('board-stats');
    if (!bs) return;
    const fit = (el) => {
      const digits = el.textContent.replace(/[^0-9]/g, '').length;
      el.style.fontSize = digits <= 4 ? '' : digits <= 6 ? '0.82em' : digits <= 8 ? '0.68em' : '0.56em';
    };
    const h = bs.querySelector('[data-bs-hearts]');
    const c = bs.querySelector('[data-bs-coins]');
    if (h) { h.textContent = String(MG.Economy.getHearts()); fit(h); }
    if (c) { c.textContent = MG.Economy.getCoins().toLocaleString(); fit(c); }
    if (moreMenu) {
      const mm = document.getElementById('more-menu');
      if (mm && !mm.hidden) moreMenu.refresh();
    }
  }

  // 화면별 BGM. 홈 bgm-home-1~4, 게임 bgm-game-1~2 (재진입마다 순환), 더보기 bgm-more.
  let bgm = null;          // <audio id="bgm">
  let currentBgm = 'audio/bgm-home-1.mp3'; // index.html 의 초기 src 와 일치
  const HOME_BGM_COUNT = 4;
  const GAME_BGM_COUNT = 2;
  let homeBgmIdx = 0;
  let gameBgmIdx = 0;
  let bgmWantPlay = false; // 지금 화면이 BGM 을 원하는가 (홈/더보기/게임 진입 시 true)

  // BGM 재생/정지의 유일한 결정 지점 — 화면 의도 · 앱 가시성 · 설정을 모두 본다.
  function applyBgm() {
    if (!bgm) return;
    const want = bgmWantPlay && !document.hidden && window.FGH.Settings.get('music');
    if (want) {
      if (bgm.paused) bgm.play().catch(() => { /* 자동재생 차단 — 다음 제스처(스플래시 탭 등)에 재시도 */ });
    } else if (!bgm.paused) {
      bgm.pause();
    }
  }

  // screen: 'home' | 'more' | 'game'. 매 진입마다 해당 트랙을 처음부터.
  // 홈(4곡)·게임(2곡)은 loop 안 함 — 한 곡이 끝나면 ended 이벤트가 다음 곡을 틀어
  // 플레이리스트처럼 순차 재생·순환한다. 더보기(1곡)만 loop.
  function playScreenBgm(screen) {
    if (!bgm) return;
    let file;
    if (screen === 'home') { file = 'audio/bgm-home-' + (homeBgmIdx % HOME_BGM_COUNT + 1) + '.mp3'; homeBgmIdx++; }
    else if (screen === 'game') { file = 'audio/bgm-game-' + (gameBgmIdx % GAME_BGM_COUNT + 1) + '.mp3'; gameBgmIdx++; }
    else { file = 'audio/bgm-' + screen + '.mp3'; }
    bgm.loop = (screen === 'more');
    bgmWantPlay = true;
    if (currentBgm !== file) {
      currentBgm = file;
      bgm.src = file; // src 를 바꾸면 자동으로 처음부터 (bgm.load() 는 로딩 직후 blip 원인이라 안 씀)
    } else if (bgm.currentTime > 0.5) {
      bgm.currentTime = 0; // 같은 곡 재진입 — 이미 재생 중일 때만 되감기(로딩 blip 방지)
    }
    applyBgm();
  }

  // ---------- 더보기 메뉴 / 난이도 / 사람두더지 (독립앱 Phase 1) ----------
  let screenNav = null, moreMenu = null, faceMaker = null, faceLocker = null;
  let shop = null, daily = null, scoreScreen = null, settingsScreen = null, costumeScreen = null, inventoryScreen = null;
  let currentDiff = 'easy';        // 현재 판 난이도
  let activeFaceUrl = null;        // 활성 사람두더지 얼굴 원본 크롭 objectURL (합성 재료)
  let activeFaceMap = null;        // 포즈별 "얼굴+몸체 합성 완료" 이미지 맵 (게임에 넘김)

  // 라이트(힌트) 축 — 내부 id 는 easy/mid/legend 유지(= ON/DIM/OFF). 동물/폭탄은 이제 챕터가 결정.
  const DIFFS = ['easy', 'mid', 'legend'];
  function currentDifficulty() {
    const d = localStorage.getItem('mole.difficulty');
    return DIFFS.indexOf(d) > -1 ? d : 'easy';
  }
  const currentLight = currentDifficulty; // 라이트 = 힌트 축 (easy/mid/legend = ON/DIM/OFF)
  // 챕터 축 (콘텐츠) — Phase A 는 챕터1 고정. 챕터2~ 는 다음 단계.
  function currentChapter() {
    const c = parseInt(localStorage.getItem('mole.chapter'), 10);
    return (c >= 1 && c <= MG.Progress.MAX_CHAPTER) ? c : 1;
  }
  // 챕터 이름표 ("챕터 N : 부제"). 이름 없으면 "챕터 N".
  function chapterLabel(n) {
    const named = I18N.t('mole.chapter.name.' + n);
    return (named && named !== 'mole.chapter.name.' + n) ? named : I18N.t('mole.chapter.n', { n: n });
  }
  function lastScore() { return parseInt(localStorage.getItem('mole.lastScore'), 10) || 0; }
  function bestFor(diff) {
    const v = parseInt(localStorage.getItem('mole.best.' + diff), 10);
    return Number.isFinite(v) ? v : 0;
  }
  function saveBestFor(diff, score) { localStorage.setItem('mole.best.' + diff, String(score)); }
  function migrateBest() {
    const old = localStorage.getItem('moleBestScore');
    if (old != null && localStorage.getItem('mole.best.easy') == null) {
      localStorage.setItem('mole.best.easy', old);
      localStorage.removeItem('moleBestScore');
    }
  }
  function applyDiffClass(diff) {
    const gs = document.getElementById('game-screen');
    DIFFS.forEach((d) => gs.classList.remove('diff-' + d));
    gs.classList.add('diff-' + diff);
  }
  // 활성 사람두더지 얼굴 → 포즈별 합성 이미지 맵을 만든다. 원본 사진/얼굴 원은 게임에 안 넘긴다.
  function loadActiveFace() {
    const id = MG.FaceStore.getActiveId();
    if (activeFaceUrl) { URL.revokeObjectURL(activeFaceUrl); activeFaceUrl = null; }
    if (activeFaceMap) { MG.MoleComposite.revoke(activeFaceMap); activeFaceMap = null; }
    if (!id) return Promise.resolve(null);
    return MG.FaceStore.getFace(id).then((rec) => {
      if (!rec) return null;
      activeFaceUrl = URL.createObjectURL(rec.blob);
      return MG.MoleComposite.build(activeFaceUrl, rec.costume, rec.shape).then((map) => {
        activeFaceMap = map;
        return map;
      }).catch(() => null);
    });
  }

  // 대화 화면 "시작" 버튼(들)이 부르는 진입점. 타이핑 인트로(챕터+준비 문구) → 활성 얼굴 로드 → 라운드 1.
  // 시작 시 생명을 미리 깎지 않는다 — 현재 공유 풀 그대로 플레이하고, 동물 맞을 때만 -1.
  // 단 풀이 0이면 플레이 자체가 불가(즉시 게임오버) → "생명 없음" 모달.
  let gameStarting = false; // 시작 버튼 연타 방지 — 한 번 누르면 홈으로 돌아올 때까지 재진입 차단
  function beginGame() {
    if (gameStarting || state) return;   // 이미 시작 진행 중이거나 게임 중 — 짧게 연타해도 무시 (길게=arm은 별개)
    if (MG.Economy.getHearts() <= 0) { showNoHeartModal(); return; }
    if (!MG.Economy.spendTicket()) { showNoTicketModal(); return; } // 챕터 입장권 1장 차감
    refreshChapterNav();
    gameStarting = true;
    setNavLock(true); // 인트로~카운트다운 동안 ⊞ 잠금
    // 게임 BGM 은 여기서(시작 버튼 탭 = 사용자 제스처 콜스택 안) 튼다. startRound 는 인트로
    // 2~4초 뒤라 그때 play() 하면 모바일/PWA 자동재생 정책에 막혀 소리가 안 났음(사용자 보고).
    playScreenBgm('game');
    currentDiff = currentDifficulty();
    applyDiffClass(currentDiff);
    preloadRoundMoles(); // 라운드1 플레이하는 동안 미리 받아둬야 라운드2 전환 때 안 늦음
    playStartIntro(() => {
      loadActiveFace().catch(() => null).then(() => startRound(1, { fresh: true }));
    });
  }

  // 라운드 전환 두더지 이미지 6장(텍스트 콜아웃 있던 2장 제외) — 늦게 로드되면 "라운드N" 글자만 먼저 뜨고 이미지가
  // 뒤늦게 팝인해 화면이 두 번 나오는 것처럼 보임(사용자 보고). 미리 캐시에 올려둔다.
  let roundMolesPreloaded = false;
  function preloadRoundMoles() {
    if (roundMolesPreloaded) return;
    roundMolesPreloaded = true;
    for (let i = 1; i <= 6; i++) {
      const img = new Image();
      img.src = 'assets/round-moles/mole' + i + '.png';
    }
  }

  // 커튼(.ri-curtain)이 뜰 때마다 재생 — 원(노랑+분홍 동심원, 위치 고정)이 제자리에서
  // 커진다: 노랑이 먼저 천천히 커지고, 그 중심에서 분홍이 더 빠르게 커져 노랑을 뒤덮으며
  // 화면 전체가 분홍이 된다. CSS @property 로 그라디언트 stop 을 애니메이션했더니 브라우저
  // 렌더링이 깨져서(도형이 이상하게 뜯김) — 매 프레임 JS 로 정적 그라디언트 문자열을 직접
  // 새로 계산해 넣는 방식으로 변경(안전, 검증된 렌더 경로).
  // reversed=true(10라운드 완주 결과화면 전환용) — 색 역할이 뒤바뀜: 분홍이 천천히 먼저
  // 보이고, 노랑이 빠르게 따라잡아 앞질러서 최종 단색이 노랑이 된다.
  let curtainPatternGen = 0;
  function restartCurtainPattern(overlay, reversed) {
    const curtains = overlay.querySelectorAll('.ri-curtain');
    // 좌/우 패널이 각자 자기 왼쪽 모서리(0,0) 기준으로 따로 타일링돼서, 우측 패널은
    // 화면상 중앙(좌측 패널 너비만큼 떨어진 지점)부터 시작해 타일 위상이 어긋나 중앙에
    // 폭이 좁은/이상한 구간이 생겼다(사용자 보고) — 우측 패널의 시작 위치를 타일
    // 크기(70px)의 배수만큼 왼쪽으로 당겨서 좌측 패널과 같은 리듬으로 이어지게 보정.
    const TILE = 70;
    curtains.forEach((c) => {
      if (c.classList.contains('ri-curtain--r')) {
        const offset = c.offsetLeft % TILE;
        c.style.setProperty('--curtain-pos', (-offset) + 'px 0');
      }
    });
    const myGen = ++curtainPatternGen;
    const DURATION = 2300;
    const SLOW_MAX = 45; // px — 먼저 보이는 색, 처음부터 끝까지 꾸준히(선형) 천천히 커짐
    const FAST_MAX = 70; // px — 나중 색, 처음엔 거의 안 보이다(cubic ease-in) 뒤늦게 확 커져
                          // 앞의 색을 따라잡고 앞질러 타일 전체를 뒤덮는다("따라잡는 재미").
    const slowColor = reversed ? '#ff6f91' : '#ffd166';
    const fastColor = reversed ? '#ffd166' : '#ff6f91';
    const t0 = performance.now();
    function frame(now) {
      if (myGen !== curtainPatternGen) return; // 새 재생이 시작돼 이 루프는 폐기
      const t = Math.min(1, (now - t0) / DURATION);
      const slowR = t * SLOW_MAX;
      const fastR = t * t * t * FAST_MAX; // cubic ease-in — 뒤로 갈수록 급격히 따라잡음
      const grad =
        'radial-gradient(circle at 25% 25%, ' + fastColor + ' 0 ' + fastR + 'px, ' + slowColor + ' ' + fastR + 'px ' + slowR + 'px, transparent ' + slowR + 'px),' +
        'radial-gradient(circle at 75% 75%, ' + fastColor + ' 0 ' + fastR + 'px, ' + slowColor + ' ' + fastR + 'px ' + slowR + 'px, transparent ' + slowR + 'px)';
      curtains.forEach((c) => c.style.setProperty('--curtain-grad', grad));
      if (t < 1) requestAnimationFrame(frame);
    }
    // 첫 프레임을 rAF 로 미루면, 그 사이 커튼에 남아있던 "지난 전환의 마지막(단색)"
    // 인라인 스타일이 한 프레임 그대로 보여서 분홍이 잠깐 번쩍이는 버그가 있었다(사용자
    // 보고) — t=0 상태를 즉시(동기) 적용해 그 뒤부터 rAF 로 이어간다.
    frame(t0);
  }

  // 글자 하나씩 타이핑, 다 치면 onTyped 호출. 글자가 보일 때마다 타자기 소리(공백 제외).
  function typeText(el, text, onTyped) {
    let i = 0;
    (function step() {
      el.textContent = text.slice(0, i);
      const ch = text[i - 1];
      if (i > 0 && ch && ch !== ' ') MG.HitFx.typeTick();
      i++;
      if (i <= text.length) setTimeout(step, 45);
      else onTyped();
    })();
  }

  // 라운드1 진입 전 한 번 — 커튼 패턴(노랑->분홍, 2.3s) 이 다 끝난 뒤 "챕터N" 타이핑,
  // 이어서 "손을 풀어봅시다..." 타이핑, 끝나면 잠깐 멈췄다 커튼 오픈.
  function playStartIntro(onDone) {
    const myGen = sessionGen; // 인트로 도중 홈버튼/메뉴로 나가면 sessionGen 이 바뀌어 이 체인이 중단됨
    const overlay = document.getElementById('start-intro-overlay');
    const chapterNumEl = document.getElementById('si-chapter-num');
    const chapterSubEl = document.getElementById('si-chapter-sub');
    const tipEl = document.getElementById('si-tip-text');
    const caretEl = document.getElementById('si-caret');
    chapterNumEl.textContent = '';
    chapterSubEl.textContent = '';
    tipEl.textContent = '';
    caretEl.hidden = true; // 타이핑 시작 전엔 깜빡이는 커서도 같이 숨김(사용자 보고)
    overlay.classList.remove('is-opening');
    overlay.hidden = false;
    restartCurtainPattern(overlay);
    setHammerLayerVisible(false);
    // "챕터N : 부제" 한 줄이던 걸 두 줄로 쪼갬(1줄=챕터N, 2줄=부제) + 팁 문구를 3번째
    // 줄로 - 총 3줄이 순서대로 타이핑(사용자 요청).
    const fullChapter = chapterLabel(currentChapter());
    const sepIdx = fullChapter.indexOf(' : ');
    const chapterNum = sepIdx >= 0 ? fullChapter.slice(0, sepIdx) : fullChapter;
    const chapterSub = sepIdx >= 0 ? fullChapter.slice(sepIdx + 3) : '';
    const fullTip = I18N.t('mole.startintro.tip');
    const aborted = () => myGen !== sessionGen;
    setTimeout(() => {
      if (aborted()) { overlay.hidden = true; overlay.classList.remove('is-opening'); return; }
      typeText(chapterNumEl, chapterNum, () => {
        if (aborted()) return;
        typeText(chapterSubEl, chapterSub, () => {
          if (aborted()) return;
          caretEl.hidden = false; // 이 줄 타이핑 시작하는 순간부터 커서 등장
          typeText(tipEl, fullTip, () => {
            if (aborted()) return;
            setTimeout(() => {
              if (aborted()) { overlay.hidden = true; overlay.classList.remove('is-opening'); return; }
              overlay.classList.add('is-opening');
              setHammerLayerVisible(true);
              onDone();
              setTimeout(() => {
                overlay.hidden = true;
                overlay.classList.remove('is-opening');
              }, 300); // 커튼 transition(0.26s) 후 정리
            }, 500); // 타이핑 끝난 뒤 잠깐 멈춤
          });
        });
      });
    }, 2300); // 커튼 패턴이 분홍으로 다 정리된 뒤에 타이핑 시작
  }

  // ---------- 시작화면 초록 버튼: 탭=시작 / 꾹=종료 대기 / 다시 탭=종료창 ----------
  // (홈 화면에서만. 게임 중엔 이 버튼은 15번 구멍 타격이라 handleCell 이 담당.)
  const armState = { armed: false, revertT: null };
  let setCallLabel = () => {}; // (mode) 'home' → "시작" / 'game' → "통화" (게임 중엔 15번 구멍 타격)

  // 시작 인트로~카운트다운·라운드 전환 동안엔 ⊞(홈/더보기) 잠금 + 회색 음영 (사용자 요청).
  // 이 시간엔 게임 상태가 불안정해 이탈 시 버그가 났음 — 아예 못 누르게 막는 게 근본 해결.
  let navLocked = false;
  function setNavLock(on) {
    navLocked = !!on;
    const btn = document.getElementById('btn-back-to-hub');
    if (btn) {
      btn.classList.toggle('nav-locked', navLocked);
      btn.setAttribute('aria-disabled', navLocked ? 'true' : 'false');
    }
  }

  function wireStartButton() {
    const btn = document.querySelector('#lane-button-bar .lane-button--call');
    if (!btn) return;
    const lbl = btn.querySelector('.lane-lbl');
    const isHome = () => document.getElementById('game-screen').classList.contains('is-start');
    let holdT = null, longFired = false;

    function setArmed(on) {
      armState.armed = on;
      clearTimeout(armState.revertT);
      btn.classList.toggle('lane-button--armed', on);
      if (lbl) lbl.textContent = I18N.t(on ? 'mole.start.armLabel' : 'mole.start.btn');
      if (on) armState.revertT = setTimeout(() => setArmed(false), 3200);
    }
    setCallLabel = (mode) => {
      if (armState.armed) setArmed(false);
      if (lbl) lbl.textContent = I18N.t(mode === 'game' ? 'mole.start.callBtn' : 'mole.start.btn');
    };

    // navLocked = 시작 인트로~카운트다운 구간. 이때는 아직 is-start 가 안 벗겨져서
    // isHome() 이 true 라, 초록버튼 길게누름이 "종료 대기"로 무장되는 버그가 있었다 → navLocked 도 배제.
    btn.addEventListener('pointerdown', () => {
      if (!isHome() || navLocked) return;
      longFired = false;
      holdT = setTimeout(() => {
        if (!isHome() || navLocked) return;
        longFired = true;
        setArmed(true);
        if (window.FGH.Settings.vibrate) window.FGH.Settings.vibrate();
      }, 600);
    });
    const cancelHold = () => clearTimeout(holdT);
    btn.addEventListener('pointercancel', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('pointerup', () => {
      if (!isHome() || navLocked) return;
      clearTimeout(holdT);
      if (longFired) { longFired = false; return; } // 방금 꾹 눌러 무장 → 이 up 은 무시
      if (armState.armed) { setArmed(false); showQuitDialog(); }
      else beginGame();
    });
  }

  function showQuitDialog() {
    const v = document.createElement('div');
    v.className = 'ad-overlay';
    v.innerHTML = '<div class="ad-overlay-card quit-card">' +
      '<div class="quit-title">' + I18N.t('mole.quit.title') + '</div>' +
      '<div class="quit-btns">' +
      '<button type="button" class="quit-yes" data-q="yes">' + I18N.t('mole.quit.yes') + '</button>' +
      '<button type="button" data-q="no">' + I18N.t('mole.quit.no') + '</button></div></div>';
    document.body.appendChild(v);
    v.querySelector('[data-q="no"]').addEventListener('click', () => v.remove());
    v.querySelector('[data-q="yes"]').addEventListener('click', () => { v.remove(); exitApp(); });
  }

  function exitApp() {
    // 라운드 전환과 같은 커튼이 닫히며 종료 (사용자 요청).
    const ri = document.getElementById('round-intro-overlay');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    const bye = document.getElementById('bye-msg');
    if (bye) { bye.hidden = true; bye.textContent = ''; }
    ri.classList.add('is-opening', 'is-bye'); // is-bye = 불투명 배경(뒤 밤하늘 안 비치게)
    ri.hidden = false;
    setHammerLayerVisible(false);
    // display:none → 표시 직후엔 transition 시작점이 안 잡힌다. 열린 상태를
    // 두 프레임 렌더한 뒤 클래스를 빼야 커튼이 가운데로 닫히는 게 애니메이션된다.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { ri.classList.remove('is-opening'); });
    });
    // 실제 종료 시도. window.close() 는 스크립트로 연 창에서만 동작 —
    // 일반 브라우저 탭·홈화면 PWA 에선 무시된다(진짜 종료는 Phase 2 네이티브 래퍼: Capacitor App.exitApp).
    setTimeout(() => { try { window.close(); } catch (e) { /* 무시 */ } }, 300);
    // 안 닫혔으면 정체불명 화면 대신 안내 — 탭하면 다시 열림.
    setTimeout(() => {
      if (document.hidden || !bye) return;
      bye.textContent = I18N.t('mole.quit.done');
      bye.hidden = false;
      bye.onclick = () => {
        bye.hidden = true; bye.textContent = ''; bye.onclick = null;
        ri.classList.remove('is-bye');
        showStartScreen({ skipFlash: true });
      };
    }, 650);
  }

  function showNoHeartModal() {
    const v = document.createElement('div');
    v.className = 'ad-overlay';
    v.innerHTML = '<div class="ad-overlay-card"><div class="nh-title">' + I18N.t('mole.more.noHearts') + '</div>' +
      '<div class="nh-btns">' +
      '<button type="button" data-nh="ad">' + I18N.t('mole.shop.watchHeart') + '</button>' +
      '<button type="button" data-nh="shop">' + I18N.t('mole.more.shop') + '</button>' +
      '<button type="button" data-nh="close">' + I18N.t('mole.common.close') + '</button></div></div>';
    document.body.appendChild(v);
    v.querySelector('[data-nh="ad"]').addEventListener('click', () => {
      v.remove();
      MG.Ads.rewarded().then((ok) => { if (ok) { MG.Economy.addHearts(1); refreshBoardStats(); } });
    });
    v.querySelector('[data-nh="shop"]').addEventListener('click', () => { v.remove(); openMore('shop-screen'); });
    v.querySelector('[data-nh="close"]').addEventListener('click', () => v.remove());
  }

  // 챕터 입장권 소진 — 다음 충전까지 남은 시간 안내. (개발용 상한 10000이라 실제로는 안 뜸.
  // 출시 전: i18n 키 + 광고/코인 충전 옵션 추가 예정.)
  function showNoTicketModal() {
    const ms = MG.Economy.nextTicketMs();
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    const v = document.createElement('div');
    v.className = 'ad-overlay';
    v.innerHTML = '<div class="ad-overlay-card"><div class="nh-title">챕터 입장권이 없어요</div>' +
      '<div style="margin:6px 0 12px;font-size:14px;opacity:.8">다음 충전까지 ' +
      mm + '분 ' + (ss < 10 ? '0' : '') + ss + '초</div>' +
      '<div class="nh-btns"><button type="button" data-nt="close">' + I18N.t('mole.common.close') + '</button></div></div>';
    document.body.appendChild(v);
    v.querySelector('[data-nt="close"]').addEventListener('click', () => v.remove());
  }

  // 화면 전환 플래시(더보기↔홈, 게임종료→홈) — 보라/진한노랑 랜덤. 누른 버튼 위치에서
  // 터져나가는 것처럼 origin 을 그 버튼 중심으로 잡는다(originEl 없으면 화면 중앙).
  const FLASH_DELAY_MS = 100; // 광선이 화면을 덮는 시점(22% 키프레임)에 맞춰 실제 화면 전환
  function screenFlash(originEl) {
    var el = document.getElementById('screen-flash-fx');
    if (!el) return;
    var r = originEl && originEl.getBoundingClientRect ? originEl.getBoundingClientRect() : null;
    var ox = r ? ((r.left + r.width / 2) / window.innerWidth * 100) : 50;
    var oy = r ? ((r.top + r.height / 2) / window.innerHeight * 100) : 50;
    el.style.setProperty('--fx-x', ox + '%');
    el.style.setProperty('--fx-y', oy + '%');
    el.classList.remove('is-on', 'fx-violet', 'fx-gold');
    void el.offsetWidth;
    el.classList.add(Math.random() < 0.5 ? 'fx-violet' : 'fx-gold');
    el.classList.add('is-on');
  }

  // 책장 넘기듯 전환 — 이어가기(더보기→게임화면)에서 정상 작동 확인된 방식 그대로,
  // 다른 전환에도 동일하게 적용(mole-board 를 가리지 않음 — 그게 핵심 차이였음).
  // mole-board 처럼 여러 방향(게임↔더보기)에서 재사용되는 요소는, 열자마자 바로
  // 닫는 식으로 빠르게 연타하면 이전 호출의 "숨기기" 타이머가 나중에 잘못 발동해
  // 방금 보여준 걸 다시 숨겨버릴 수 있다 — 요소별로 대기 중인 타이머를 취소한다.
  const FLIP_MS = 700; // style.css 의 flip-out/flip-in 애니메이션 길이(0.7s)와 맞춤
  const pendingFlipTimers = new WeakMap();
  function clearPendingFlip(el) {
    var t = pendingFlipTimers.get(el);
    if (t) {
      clearTimeout(t);
      pendingFlipTimers.delete(el);
      el.classList.remove('flip-out', 'flip-in'); // 취소된 이전 애니메이션의 클래스 잔여물 제거
    }
  }
  function flipSwap(outEl, inEl) {
    if (!outEl || !inEl || outEl === inEl) return;
    clearPendingFlip(outEl);
    clearPendingFlip(inEl);
    inEl.hidden = false;
    outEl.classList.remove('flip-out'); void outEl.offsetWidth; outEl.classList.add('flip-out');
    inEl.classList.remove('flip-in'); void inEl.offsetWidth; inEl.classList.add('flip-in');
    var timer = setTimeout(function () {
      outEl.hidden = true;
      outEl.classList.remove('flip-out');
      inEl.classList.remove('flip-in');
      pendingFlipTimers.delete(outEl);
      pendingFlipTimers.delete(inEl);
    }, FLIP_MS);
    pendingFlipTimers.set(outEl, timer);
    pendingFlipTimers.set(inEl, timer);
  }

  // 더보기 메뉴 열기/닫기.
  function openMore(sub, originEl) {
    var isStart = document.getElementById('game-screen').classList.contains('is-start');
    var outEl = document.getElementById(isStart ? 'board-start' : 'mole-board');
    openMoreNow(sub); // more-menu 내용 준비(hidden=false 는 flipSwap 이 처리)
    flipSwap(outEl, document.getElementById('more-menu'));
  }
  function openMoreNow(sub) {
    // 백스톱: 시작 인트로(챕터 타이핑) 도중 어떻게든 메뉴가 열리면 대기 중이던 라운드 시작을
    // 취소하고 깨끗한 "더보기"만 연다. (평소엔 아래 navLock 으로 ⊞ 자체가 이 시간엔 안 먹힘.)
    var si = document.getElementById('start-intro-overlay');
    if (!state && si && !si.hidden) {
      sessionGen++;
      si.hidden = true; si.classList.remove('is-opening');
    }
    // 진행 중이던 게임이 있으면(직접 일시정지했든 아니든) 상단 = "‹ 이어하기" + 칩 잠금.
    var resumable = !!(state && !state.ended);
    // 플레이 중(일시정지 아님)에 열면 게임을 멈춘다 (닫을 때 자동 재개).
    if (resumable && !state.introActive && !state.paused) {
      state.paused = true;
      state.pausedByMenu = true;
    }
    var mm = document.getElementById('more-menu');
    mm.classList.toggle('mm-paused', resumable);
    mm.hidden = false;
    playScreenBgm('more'); // 더보기 화면 진입 — 더보기 BGM 을 처음부터
    if (moreMenu) moreMenu.refresh();
    if (sub) {
      screenNav.show(sub);
      if (sub === 'face-locker' && faceLocker) faceLocker.show();
      if (sub === 'shop-screen' && shop) shop.show();
      if (sub === 'daily-screen' && daily) daily.show();
      if (sub === 'score-screen' && scoreScreen) scoreScreen.show();
      if (sub === 'settings-screen' && settingsScreen) settingsScreen.show();
      if (sub === 'inventory-screen' && inventoryScreen) inventoryScreen.show();
    }
  }
  function closeMore(e) {
    var mm = document.getElementById('more-menu');
    // 진행 중이던 게임이 있으면 그대로 더보기만 닫고, 없으면 대화 화면 — 이 경우
    // more-menu 를 여기서 먼저 숨기지 않는다(showStartScreenNow 가 플래시 시점에 맞춰 처리).
    if (!state) { showStartScreen({ originEl: e && e.currentTarget }); return; }
    screenNav.reset();
    flipSwap(mm, document.getElementById('mole-board')); // 이어가기 → 게임화면 (3D 플립)
    mm.classList.remove('mm-paused');
    playScreenBgm('game'); // 게임 화면으로 복귀 — 게임 BGM 을 처음부터

    // 열 때 멈춘 게임이면 재개.
    if (state.pausedByMenu) {
      state.paused = false;
      state.pausedByMenu = false;
      lastTime = performance.now();
    }
  }

  // ---------- 시작 화면 ----------
  function showStartScreen(opts) {
    if (!(opts && opts.skipFlash)) {
      // 지금 보이는 패널(더보기/결과화면/다음챕터)에서 홈으로 — showStartScreenNow 가
      // 이 패널들을 hidden=true 로 만들기 전에 먼저 찾아둬야 함.
      var mm = document.getElementById('more-menu');
      var go = document.getElementById('gameover-overlay');
      var ncp = document.getElementById('next-chapter-panel');
      var outEl = !mm.hidden ? mm : !go.hidden ? go : !ncp.hidden ? ncp : null;
      showStartScreenNow(opts);
      // showStartScreenNow 가 이미 outEl 을 hidden=true 처리했을 수 있음 — flip-out 애니메이션이
      // 보이려면 다시 잠깐 보여야 한다(끝나면 flipSwap 이 다시 hidden=true 로 되돌림).
      if (outEl) { outEl.hidden = false; flipSwap(outEl, document.getElementById('board-start')); }
      return;
    }
    showStartScreenNow(opts);
  }
  function showStartScreenNow(opts) {
    sessionGen++; // 진행 중이던 카운트다운/자동진행 타이머 무효화
    gameStarting = false;
    setNavLock(false);
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    state = null;
    run = null;
    playScreenBgm('home'); // 홈 진입 — 홈 BGM(3곡 순환)을 처음부터
    const go = document.getElementById('gameover-overlay');
    go.hidden = true; go.classList.remove('is-win', 'is-lose', 'is-sliding');
    const cf = go.querySelector('.go-confetti'); if (cf) cf.innerHTML = '';
    const rsh = document.getElementById('result-swipe-hint');
    if (rsh) { rsh.hidden = true; rsh.classList.remove('is-on'); }
    const ncp = document.getElementById('next-chapter-panel');
    ncp.hidden = true; ncp.classList.remove('is-in');
    const ri = document.getElementById('round-intro-overlay');
    ri.hidden = true; ri.classList.remove('is-opening', 'is-bye');
    const byeEl = document.getElementById('bye-msg');
    if (byeEl) { byeEl.hidden = true; byeEl.textContent = ''; byeEl.onclick = null; }
    const si = document.getElementById('start-intro-overlay');
    if (si) { si.hidden = true; si.classList.remove('is-opening'); }
    setHammerLayerVisible(true);
    document.getElementById('board-start').hidden = false;
    // board-start는 #mole-board 의 자식 — 플레이 중 더보기(openMore)가 mole-board 자체를
    // flip-out 으로 hidden 처리해둔 상태일 수 있어(v166), 여기서도 같이 복구해야
    // board-start 가 0x0으로 렌더링되지 않는다(키패드만 보이는 버그의 원인이었음).
    // 더보기 여는 애니메이션(700ms) 중 바로 PLAY를 누른 경우 대기 중인 hide 타이머가
    // 나중에 발동해 다시 숨기는 걸 막기 위해 취소도 같이 한다.
    const board = document.getElementById('mole-board');
    clearPendingFlip(board);
    board.hidden = false;
    document.getElementById('game-screen').classList.add('is-start');
    setCallLabel('home'); // 홈: 초록 버튼 "시작" (빨간 대기 상태였으면 해제)
    if (screenNav) screenNav.reset();
    const mm = document.getElementById('more-menu');
    if (mm) mm.hidden = true;

    refreshChapterNav();

    // 위에서 내려오는 문자 배너 = 광고 버튼 2개(하트+1 / 코인+50). 툭↓ 4초 보임 → 그동안 누를 수 있음.
    const sms = document.getElementById('start-best');
    if (!sms.querySelector('.chat-ad-btns')) sms.appendChild(adButtons());
    syncStartAds();
    refreshBoardStats();
    tuneAddrTicker();
    sms.classList.remove('sms-anim');   // 시작화면 열 때마다 배너 툭↓ 리트리거
    void sms.offsetWidth;
    sms.classList.add('sms-anim');

    // 첫 방문 = 전체 인트로. 아니면 재방문 대화(재접=랜덤 문구 / 다시하기·챕터클리어=축하 이모티콘 리액션).
    const isRetry = !!(opts && opts.retry);
    const isClear = !!(opts && opts.chapterClear);  // 승리 스와이프로 다음 챕터 홈에 도착
    const visits = parseInt(localStorage.getItem('mole.visits'), 10) || 0;
    if (!isRetry && !isClear) localStorage.setItem('mole.visits', String(visits + 1));
    const firstVisit = !isRetry && !isClear && visits === 0;
    const firstEl = document.getElementById('chat-first');
    const returnEl = document.getElementById('chat-return');
    firstEl.hidden = !firstVisit;
    returnEl.hidden = firstVisit;

    if (!firstVisit) buildReturnChat(isClear ? 'clear' : isRetry ? 'retry' : 'phrase');
    revealThread(firstVisit ? firstEl : returnEl);
    maybeShowStartCoach();
  }

  // 챕터 선택 ◀ 챕터 N ▶ — 열린 챕터가 2개 이상일 때만 표시. mole.chapter 를 설정.
  // HUD 주소창 자리를 차지 → 그때 주소창 숨김.
  function refreshChapterNav() {
    const nav = document.getElementById('chapter-nav');
    if (!nav) return;
    const maxCh = MG.Progress.maxChapterFor(currentLight());
    // 항상 표시 — 챕터가 하나만 열렸어도 "챕터 1" 배지는 보이고, 양쪽 화살표만 비활성.
    let ch = currentChapter();
    if (ch > maxCh) { ch = maxCh; localStorage.setItem('mole.chapter', String(ch)); }
    nav.hidden = false;
    nav.setAttribute('data-ch', String(ch)); // 챕터별 불빛 색 (style.css #chapter-nav[data-ch="N"])
    nav.querySelector('[data-ch-label]').textContent = I18N.t('mole.chapter.n', { n: ch });
    nav.querySelector('[data-ch-prev]').disabled = ch <= 1;
    nav.querySelector('[data-ch-next]').disabled = ch >= maxCh;
    const tn = nav.querySelector('[data-ch-tickets]'); // 챕터 입장권 (2시간마다 +1, 입장 시 -1)
    if (tn) tn.textContent = String(MG.Economy.getTickets());
  }
  function wireChapterNav() {
    const nav = document.getElementById('chapter-nav');
    if (!nav) return;
    const step = (d) => {
      const maxCh = MG.Progress.maxChapterFor(currentLight());
      const before = currentChapter();
      const ch = Math.max(1, Math.min(maxCh, before + d));
      localStorage.setItem('mole.chapter', String(ch));
      refreshChapterNav();
      // 챕터가 실제로 바뀌었으면 글자에서 아우라가 확 터졌다 가라앉는 연출
      if (ch !== before) {
        const lbl = nav.querySelector('.ch-label');
        if (lbl) {
          lbl.classList.remove('ch-flare'); void lbl.offsetWidth; lbl.classList.add('ch-flare');
          setTimeout(() => lbl.classList.remove('ch-flare'), 900); // 끝나면 떼서 평소 아우라 펄스로 복귀
        }
      }
    };
    nav.querySelector('[data-ch-prev]').addEventListener('click', () => step(-1));
    nav.querySelector('[data-ch-next]').addEventListener('click', () => step(1));
  }

  // 티커: 문구 길이가 달라도(언어/힌트) 스크롤 속도가 일정하도록 duration 을 폭에 맞추고,
  // 루프 이동량(--tk-shift)도 세그먼트 1개 폭 그대로 px 로 박아준다 — 키프레임의 -50%(트랙 절반)에
  // 의존하면 기기별 서브픽셀 반올림으로 세그먼트 폭과 어긋나 "문장 중간에 끊고 처음으로" 버그가 남.
  function tuneTicker(rootSel, pxPerSec) {
    const seg = document.querySelector(rootSel + ' .ticker-seg');
    const track = document.querySelector(rootSel + ' .ticker-track');
    if (!seg || !track) return;
    const w = seg.getBoundingClientRect().width;
    if (w > 0) {
      track.style.setProperty('--tk-shift', '-' + Math.round(w) + 'px');
      track.style.animationDuration = Math.max(12, w / pxPerSec).toFixed(1) + 's';
    }
  }
  function tuneAddrTicker() { tuneTicker('#hud-addr', 60); }

  // 초록 버튼 롱프레스=종료 안내 말풍선 — 1회만.
  function maybeShowStartCoach() {
    const coach = document.querySelector('[data-start-coach]');
    if (!coach || localStorage.getItem('mole.startCoachSeen') === '1') return;
    localStorage.setItem('mole.startCoachSeen', '1');
    setTimeout(() => {
      if (!document.getElementById('game-screen').classList.contains('is-start')) return;
      coach.classList.add('is-on');
      const hide = () => coach.classList.remove('is-on');
      setTimeout(hide, 6000);
      document.addEventListener('pointerdown', hide, { once: true });
    }, 1400);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // --- 재방문 대화 조립 (말풍선 줄 / 이모티콘 줄) ---
  function avatarEl(kind) {
    const d = document.createElement('div');
    d.className = 'chat-avatar chat-avatar--' + kind;
    d.setAttribute('aria-hidden', 'true');
    return d;
  }
  function bubbleRow(side, text) {
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--' + side;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--' + side;
    bubble.appendChild(document.createTextNode(text));
    if (side === 'them') { row.appendChild(avatarEl('mole')); row.appendChild(bubble); }
    else { row.appendChild(bubble); row.appendChild(avatarEl('hippo')); }
    return row;
  }
  // 이모티콘만 = 말풍선 없이 큼 (카톡).
  function emojiRow(side, emoji, withBurst) {
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--' + side + ' chat-row--emoji';
    const em = document.createElement('div');
    em.className = 'chat-emoji';
    em.textContent = emoji;
    if (withBurst) {
      const b = document.createElement('span');
      b.className = 'chat-burst';
      b.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 10; i++) b.appendChild(document.createElement('i'));
      em.appendChild(b);
    }
    if (side === 'them') { row.appendChild(avatarEl('mole')); row.appendChild(em); }
    else { row.appendChild(em); row.appendChild(avatarEl('hippo')); }
    return row;
  }
  // chat-phrases.js 가 (스테일 캐시 등으로) 없어도 대화가 죽지 않게 최소 폴백.
  const CP = MG.ChatPhrases || {
    returnPhrases: () => ['왔어?'], hippoReplies: () => ['ㅇㅇ'],
    retryText: (k) => (k === 'best' ? '신기록!' : k === 'bad' ? 'ㅋㅋ' : '잘했어!'),
    clearPhrases: () => ['챕터 클리어!']
  };
  function buildReturnChat(mode) {
    const el = document.getElementById('chat-return');
    el.innerHTML = '';
    if (mode === 'clear') {
      el.appendChild(emojiRow('them', CELEBRATE_EMOJI, true));        // 축하 이모티콘(큼) + 폭죽
      el.appendChild(bubbleRow('them', pick(CP.clearPhrases())));     // "챕터 클리어! 다음도 가보자" 류
      el.appendChild(emojiRow('me', pick(HIPPO_MOODS), false));       // 하마 이모티콘(큼)
    } else if (mode === 'retry') {
      const kind = localStorage.getItem('mole.lastWasBest') === '1' ? 'best'
        : localStorage.getItem('mole.lastWasBad') === '1' ? 'bad' : 'clear';
      el.appendChild(emojiRow('them', CELEBRATE_EMOJI, true));        // 축하 이모티콘(큼) + 폭죽
      el.appendChild(bubbleRow('them', CP.retryText(kind)));         // 글자는 따로
      el.appendChild(emojiRow('me', pick(HIPPO_MOODS), false));       // 하마 이모티콘(큼)
    } else {
      el.appendChild(bubbleRow('them', pick(CP.returnPhrases())));
      el.appendChild(bubbleRow('me', pick(CP.hippoReplies())));
    }
  }

  // 홈 광고 = 생명/코인 각각 하루 최대 3회. localStorage 에 날짜별 카운트.
  const AD_DAILY_MAX = 3;
  function adDailyDate() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function adDaily() {
    let o;
    try { o = JSON.parse(localStorage.getItem('mole.adDaily') || '{}'); } catch (e) { o = {}; }
    if (!o || o.date !== adDailyDate()) o = { date: adDailyDate(), life: 0, coin: 0 };
    return o;
  }
  function bumpAdDaily(kind) {
    const o = adDaily();
    o[kind] = (o[kind] || 0) + 1;
    try { localStorage.setItem('mole.adDaily', JSON.stringify(o)); } catch (e) { /* noop */ }
    return o[kind];
  }
  function syncAdBtn(btn, kind) {
    if (!btn) return;
    const n = adDaily()[kind] || 0;
    const cap = btn.querySelector('.chat-ad-cap');
    if (cap) cap.textContent = n + '/' + AD_DAILY_MAX;
    btn.disabled = n >= AD_DAILY_MAX;
  }

  // 광고 버튼 2개 (하트+1 / 코인+50) — 시작화면 문자 배너(#start-best) 안에 삽입.
  function adButtons() {
    const wrap = document.createElement('span');
    wrap.className = 'chat-ad-btns';
    wrap.innerHTML =
      '<button type="button" class="chat-ad-btn" data-ad="life" aria-label="' + I18N.t('mole.start.adLife') + '">' +
        '<span class="chat-ad-play" aria-hidden="true">▶</span>' +
        '<svg class="chat-ad-ic chat-ad-ic--heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>' +
        '<span class="chat-ad-n">+1</span><span class="chat-ad-cap"></span></button>' +
      '<button type="button" class="chat-ad-btn" data-ad="coin" aria-label="' + I18N.t('mole.shop.watchCoin') + '">' +
        '<span class="chat-ad-play" aria-hidden="true">▶</span>' +
        '<svg class="chat-ad-ic chat-ad-ic--coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6"/></svg>' +
        '<span class="chat-ad-n">+50</span><span class="chat-ad-cap"></span></button>';
    wireChatAds(wrap);
    return wrap;
  }
  // 시작화면 열 때마다 "N/3" 카운터·비활성 상태를 다시 반영 (날짜 바뀜 / 다른 화면에서 광고 봄).
  function syncStartAds() {
    const sms = document.getElementById('start-best');
    if (!sms) return;
    syncAdBtn(sms.querySelector('[data-ad="life"]'), 'life');
    syncAdBtn(sms.querySelector('[data-ad="coin"]'), 'coin');
  }

  // "광고 보고 하트/코인" 버튼 연결 — 하루 3회 제한 + "N/3" 카운터.
  function wireChatAds(scope) {
    [['life', scope.querySelector('[data-ad="life"]')],
     ['coin', scope.querySelector('[data-ad="coin"]')]].forEach(function (pair) {
      const kind = pair[0], btn = pair[1];
      if (!btn || btn.dataset.wired) return;
      btn.dataset.wired = '1';
      syncAdBtn(btn, kind);
      btn.addEventListener('click', () => {
        if ((adDaily()[kind] || 0) >= AD_DAILY_MAX) return;
        MG.Ads.rewarded().then((ok) => {
          if (!ok) return;
          bumpAdDaily(kind);
          if (kind === 'life') MG.Economy.addHearts(1);
          else MG.Economy.addCoins(50);
          refreshBoardStats();
          syncAdBtn(btn, kind);
        });
      });
    });
  }

  // 카톡처럼 메시지를 한 줄씩 공개하며 아래로 따라 스크롤
  function revealThread(thread) {
    if (!thread) return;
    const rows = Array.prototype.slice.call(thread.querySelectorAll('.chat-row'));
    const myGen = sessionGen;
    rows.forEach((r) => { r.classList.add('chat-pending'); r.classList.remove('chat-appear'); });
    let i = 0;
    const step = () => {
      if (myGen !== sessionGen || i >= rows.length) return;
      rows[i].classList.remove('chat-pending');
      rows[i].classList.add('chat-appear');
      thread.scrollTop = thread.scrollHeight;
      i += 1;
      setTimeout(step, 560);
    };
    setTimeout(step, 450);
  }

  // ---------- 라운드 시작 ----------
  // opts.fresh: true면 콤보·점수·목숨을 리셋 (시작 버튼/다시하기).
  //             없으면 자동 다음 라운드로 보고 그대로 이어간다.
  function startRound(roundNum, opts) {
    sessionGen++;
    gameStarting = false; // 라운드 진입 성공 — 이후 재진입은 state 존재로 차단됨
    setNavLock(true); // 카운트다운 동안 ⊞ 잠금 (playRoundIntro onDone 에서 해제)
    const myGen = sessionGen;
    // fresh(시작/다시하기)면 콤보·점수 리셋. 목숨은 공유 생명 풀에서 이어받는다(리셋 아님).
    // 자동 다음 라운드면 그대로 이어간다.
    if (opts && opts.fresh) {
      run = { combo: MG.ComboScore.create(), lives: MG.Economy.getHearts(), comboMilestone: 0, shield: false };
    }
    updateShieldHud();
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();

    const levelData = MG.LEVELS[roundNum - 1];

    // 홈→게임 진입 전환은 이제 타이핑 인트로+커튼(playStartIntro)이 담당 — 플래시 제거(사용자 요청).
    const boardStartEl = document.getElementById('board-start');
    boardStartEl.hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').classList.remove('is-start');
    setCallLabel('game'); // 게임 중: 초록 버튼은 "통화"(위장) — 15번 구멍 타격 담당
    // 홈→게임 첫 진입(fresh)에만 — 채널(유튜브 아이콘) 버튼을 10바퀴 돌려 숫자 버튼으로 전환.
    if (opts && opts.fresh && sharedLaneControls) sharedLaneControls.spinChannelsIn();
    // 새 게임 시작(fresh)일 때만 더보기 메뉴를 닫는다. 자동 다음 라운드는 메뉴를 건드리지 않음
    // (플레이 중 메뉴 열어둔 채 라운드가 넘어가도 화면이 안 튀게).
    if (opts && opts.fresh) {
      if (screenNav) screenNav.reset();
      document.getElementById('more-menu').hidden = true;
    }
    // fresh 는 beginGame 이 이미 게임 BGM 을 시작했음. 여기선 (혹시 막혔으면) 이어재생만.
    applyBgm();
    MG.HitFx.warmup(); // 오디오 컨텍스트 + 타격음 파일 프리로드 (카운트다운 동안)

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + roundNum + '-' + Date.now())) };
    const weapon = localStorage.getItem('mole.weapon') === 'cannon' ? 'cannon' : 'hammer';
    let { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: GRID_SIZE });
    if (weapon === 'cannon') {  // 대포 자리 = 우하단 구멍 하나 빼고 15구멍 (모든 라운드)
      regions = regions.filter((r) => r.id !== CANNON_HOLE);
      spawnPoints = spawnPoints.filter((sp) => sp.regionId !== CANNON_HOLE);
    }

    // 챕터 = 모드: 1 두더지만 / 2 +동물 / 3 +폭탄 / 4 +실드아이템 / 5 두더지 적게 + 방해물 최대.
    const ch = currentChapter();
    const config = {
      maxConcurrentMoles: ch >= 5 ? Math.max(1, levelData.maxConcurrentMoles - 2) : levelData.maxConcurrentMoles,
      maxConcurrentAnimals: ch >= 2 ? levelData.maxConcurrentAnimals + (ch >= 5 ? 1 : 0) : 0,
      maxConcurrentBombs: ch >= 3 ? levelData.maxConcurrentBombs + (ch >= 5 ? 1 : 0) : 0,
      maxConcurrentItems: ch >= 4 ? 1 : 0,   // 실드 아이템 (챕터 4~5)
      shieldItems: ch >= 4,
      popDuration: levelData.moleDuration,
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: ch >= 2,
      fourHit: ch >= 5,   // 4타 두더지 (전신→빠끔1→빠끔2→모자) — 챕터 5 전용
      cannonBurst: weapon === 'cannon'   // 대포 연사 스킬 (2·3타 두더지 첫 타 10%)
    };

    const scheduler = MG.SpawnScheduler.create({ regions, spawnPoints, config, rng });

    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onEmerge: (x, y, type) => {
          const bd = document.getElementById('mole-board');
          if (type === 'mole') MG.HitFx.emerge(bd, x, y);
          else if (type === 'animal' || type === 'bomb') MG.HitFx.emerge(bd, x, y, { weak: true }); // 동물/폭탄도 흙 폭발(약하게)
          else if (type === 'item') MG.HitFx.starBurst(bd, x, y); // 실드 아이템 = 반짝이
        }
      });
    }
    sharedPopElements.clear();
    if (sharedPopElements.setFace) sharedPopElements.setFace(activeFaceMap);

    const holeLayer = MG.HoleLayer.create({
      container: document.getElementById('mole-hole-layer'),
      frontContainer: document.getElementById('mole-hole-front-layer'),
      spawnPoints
    });

    // 장착 무기 = 망치(기본) 또는 대포 스킨. 인터페이스 동일 (strike/update/home/clear/isBusy).
    const WeaponMod = (weapon === 'cannon' && MG.LaneCannon) ? MG.LaneCannon : MG.LaneHammer;
    const laneHammer = WeaponMod.create({
      layer: document.getElementById('mole-hammer-layer')
    });

    state = {
      round: roundNum, levelData, regions, spawnPoints, scheduler, holeLayer, laneHammer, weapon,
      timeRemaining: roundSeconds(),
      hitstopUntil: 0,
      ended: false,
      paused: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };

    updateHUD();
    playRoundIntro(roundNum, () => {
      if (myGen !== sessionGen || !state) return; // 그 사이 나가버림 — 이 콜백 무효
      state.introActive = false;
      setNavLock(false); // 라운드 실제 진행 → ⊞ 다시 활성
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    });
  }

  // 모든 라운드: "라운드 N" 이 오른쪽에서(라운드2~ 는 두더지 이미지가 왼쪽에서) 날아와 중앙에
  // 멈추면 한 글자씩 타이핑(+타자기 소리).
  //  · 라운드 2~10: 분홍 커튼 패턴(2.3s) 뒤 시작 → 타이핑 후 타이틀 왼쪽·두더지 오른쪽 퇴장 + 커튼 오픈.
  //  · 라운드 1: 챕터 인트로가 방금 커튼을 보여줬으니 커튼 없이(투명 오버레이, 보드 비침) 바로
  //    "라운드 1" fly-in → 타이핑 → 3·2·1·GO! 카운트다운(줌인 + 색상 3빨/2주/1노/GO초, GO 는 흰
  //    플래시). GO 에서 "라운드 1" 은 왼쪽·"GO!" 는 오른쪽으로 빛처럼 사라진다. (두더지 그림 없음.)
  function playRoundIntro(roundNum, onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const title = document.getElementById('round-intro-title');
    const count = document.getElementById('round-intro-count');
    const moleImg = document.getElementById('round-intro-mole');
    const isR1 = roundNum === 1;

    overlay.hidden = false;
    count.hidden = true;
    count.className = 'round-intro-count';
    title.textContent = '';
    moleImg.hidden = true;
    if (isR1) {
      overlay.classList.remove('has-mole', 'mole-in', 'is-opening'); // 커튼 효과 없음(투명)
    } else {
      restartCurtainPattern(overlay);
      overlay.classList.add('has-mole'); // 분홍 커튼 패턴
    }
    const showMole = !isR1; // 라운드1 은 글자만
    const idx = ((roundNum - 2) % 6 + 6) % 6 + 1;
    moleImg.src = 'assets/round-moles/mole' + idx + '.png';

    const FLY_IN_MS = 400;         // = ri-title-fly-in 0.4s
    const HOLD_AFTER_TYPE_MS = 480;
    const full = I18N.t('mole.round', { n: roundNum });
    const typeMs = full.replace(/ /g, '').length * 45; // typeText 는 45ms/글자

    // 라운드1 전용: 타이핑 뒤 3·2·1·GO!. 끝나면 finish() 호출.
    function runCountdown(finish) {
      count.hidden = false;
      const STEPS = ['3', '2', '1', 'GO!']; // 무조건 영어 (사용자 지정)
      let i = 0;
      (function tick() {
        if (myGen !== sessionGen) return;
        const go = i >= 3;
        count.textContent = STEPS[i];
        count.className = 'round-intro-count ' + (go ? 'cgo' : 'c' + (3 - i)); // 카운트별 색상
        void count.offsetWidth;
        count.classList.add('pop'); // 줌인 애니
        i++;
        if (i < STEPS.length) setTimeout(tick, 650);
        else setTimeout(finish, 360);
      })();
    }

    // 퇴장(타이틀 왼쪽 / GO!·두더지 오른쪽 / 라운드2~ 커튼 오픈) + 정리 + onDone.
    function exitAndStart() {
      if (myGen !== sessionGen) return;
      // 입장 애니메이션(forwards)이 남아 transition 이 안 먹는 문제 — animation 먼저 끄고 리플로우 후 is-opening.
      title.style.animation = 'none';
      moleImg.style.animation = 'none';
      void title.offsetWidth;
      overlay.classList.add('is-opening');
      setHammerLayerVisible(true);
      setTimeout(() => {
        if (myGen !== sessionGen) return;
        overlay.hidden = true;
        overlay.classList.remove('is-opening', 'has-mole', 'mole-in');
        count.hidden = true;
        count.className = 'round-intro-count';
        moleImg.hidden = true;
        title.style.animation = '';
        moleImg.style.animation = '';
      }, 260);
      setTimeout(() => { if (myGen === sessionGen) onDone(); }, 260 + 200);
    }

    setTimeout(() => {
      if (myGen !== sessionGen) return;
      // 1) "라운드 N" 오른쪽에서, (라운드2~) 두더지 왼쪽에서 날아와 중앙에서 만남 (0.4s)
      title.textContent = full;
      overlay.classList.add('mole-in');
      if (showMole) moleImg.hidden = false;
      // 2) 중앙에 멈추면 "라운드 N" 을 한 글자씩 다시 타이핑(+ 타자기 소리)
      setTimeout(() => { if (myGen === sessionGen) typeText(title, full, () => {}); }, FLY_IN_MS + 40);
      // 3) 타이핑 끝난 뒤 — 라운드1: 3·2·1·GO! 후 퇴장 / 라운드2~: 바로 퇴장
      setTimeout(() => {
        if (myGen !== sessionGen) return;
        if (isR1) runCountdown(exitAndStart);
        else exitAndStart();
      }, FLY_IN_MS + 40 + typeMs + HOLD_AFTER_TYPE_MS);
    }, isR1 ? 250 : 2300); // 라운드1: 챕터 커튼 열린 직후 바로 / 라운드2~: 분홍 커튼 패턴 뒤
  }

  // ---------- 메인 루프 ----------
  function loop(now) {
    if (!state || state.ended) return;
    if (state.paused) { lastTime = now; rafId = requestAnimationFrame(loop); return; } // 일시정지: 시간·스폰 정지, 루프만 유지
    const rawDt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    // 히트스톱: 성공타 직후 잠깐 게임 시간을 멈춘다 (루프는 계속 돈다).
    const dt = (now < state.hitstopUntil) ? 0 : rawDt;

    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      updateHUD();
      roundComplete();
      return;
    }

    state.scheduler.tick(dt);
    state.laneHammer.update(rawDt); // 망치는 히트스톱과 무관하게 부드럽게
    syncPops();

    // 구멍별 버튼 hot: 그 구멍에 두더지(방해물 아님)가 떠 있으면 빛낸다 (스펙 §2.3).
    const moleRegions = new Set();
    state.scheduler.getActivePops().forEach((p) => {
      if (p.type === 'mole' && !p.dying) moleRegions.add(p.regionId);
    });
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) {
      sharedLaneControls.setCellHot(id, moleRegions.has(id));
    }

    updateHUD();
    rafId = requestAnimationFrame(loop);
  }

  // 점수 배율 — 라이트(난이도) × 피버타임. 사용자 지정 표.
  const SCORE_MULT = {
    easy:   { base: 1,   fever: 1 },   // 라이트 ON
    mid:    { base: 1.2, fever: 1.5 }, // 라이트 DIM
    legend: { base: 2,   fever: 3 }    // 라이트 OFF
  };
  // 피버타임 = 콤보 50 이상 (챕터 3부터).
  function isFever() {
    return !!(run && run.combo.combo >= 50 && currentChapter() >= 3);
  }
  function currentScoreMult() {
    const m = SCORE_MULT[currentDifficulty()] || SCORE_MULT.easy;
    return isFever() ? m.fever : m.base;
  }
  function updateFeverHud() {
    const b = document.getElementById('fever-badge');
    if (b) b.hidden = !isFever();
  }
  // 콤보 100 달성 → 상단에 "+❤️" 이모티콘 잠깐.
  function showComboHeartPop() {
    const el = document.getElementById('combo-heart-pop');
    if (!el) return;
    el.textContent = '+❤️';
    el.classList.remove('is-pop');
    void el.offsetWidth;
    el.classList.add('is-pop');
  }

  function updateHUD() {
    MG.HUD.update({
      round: state.round,
      lives: run.lives,
      timeRemaining: state.timeRemaining,
      combo: run.combo.combo,
      isMaxCombo: run.combo.isMaxCombo(),
      score: run.combo.score, // 1라운드부터 누적 (콤보·점수 한 통)
      modeLabel: chapterLabel(currentChapter()) // 게임화면 티커 맨 앞 = 현재 챕터 이름 ("두더지팡" 대체)
    });
    updateFeverHud();
  }

  function syncPops() {
    sharedPopElements.sync(state.scheduler.getActivePops());
  }

  // 모든 구멍 버튼의 hot 하이라이트를 끈다 (라운드 시작/시작 화면 복귀 시).
  function resetHot() {
    if (!sharedLaneControls) return;
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) sharedLaneControls.setCellHot(id, false);
  }

  // ---------- 구멍 버튼 입력 → 그 구멍 타격 ----------
  function handleCell(regionId) {
    if (!state || state.ended || state.introActive || state.paused) return false;
    const sp = state.spawnPoints.find((s) => s.regionId === regionId);
    if (!sp) return false; // 대포 모드에서 없앤 구멍(15) 탭 = 무시 (헛방 처리 안 함)
    const results = state.scheduler.resolveRegion(regionId);

    const primary = results[0] || null;
    const targetX = primary ? primary.xFrac : sp.x;
    const targetY = primary ? primary.yFrac : sp.y;

    // 두더지 현재 프레임(전신/빠끔1/빠끔2/모자)에 따라 망치 타격점 높이가 달라진다 — 헬멧을 때린다.
    const frameKey = sharedPopElements.frameKeyAt ? sharedPopElements.frameKeyAt(regionId) : null;
    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, targetY, results), frameKey);

    // 대포 연사: 이번 첫 타에 burst 가 떴으면 — 아래 터치화면에 "BURST!" 띄우고(발동 즉시 인지),
    // 남은 타격을 자동 연속 발사 → 1마리 클리어.
    if (primary && primary.type === 'mole' && primary.burst && primary.done === false && primary.hitsTaken === 1) {
      MG.HitFx.burstBanner(document.querySelector('.dialpad'));
      burstAutoFire(regionId, primary.hitsRequired - 1);
    }

    // 버튼 이펙트 색: 헛방(구멍에 아무것도 없음) 또는 폭탄이면 빨간색.
    return results.length === 0 || results.some((r) => r.type === 'bomb');
  }

  // 연사 자동샷 — n 발(3타=2발, 2타=1발)을 BURST_SHOT_GAP 간격으로 대포 재발사.
  const BURST_SHOT_GAP = 190; // ms
  function burstAutoFire(regionId, n, i) {
    i = i || 0;
    if (i >= n || !state || state.ended) return;
    setTimeout(() => {
      if (!state || state.ended) return;
      const sp = state.spawnPoints.find((s) => s.regionId === regionId);
      const res = state.scheduler.resolveRegion(regionId, { burst: true });
      const pr = res[0] || null;
      const tx = pr ? pr.xFrac : (sp ? sp.x : 0.5);
      const ty = pr ? pr.yFrac : (sp ? sp.y : 0.5);
      const fk = sharedPopElements.frameKeyAt ? sharedPopElements.frameKeyAt(regionId) : null;
      state.laneHammer.strike(tx, ty, () => {
        onHammerImpact(tx, ty, res);
        if (pr && pr.done && sp) MG.HitFx.burstWord(document.getElementById('mole-board'), sp.x, sp.y);
      }, fk);
      burstAutoFire(regionId, n, i + 1);
    }, BURST_SHOT_GAP);
  }

  function onHammerImpact(hitXFrac, hitYFrac, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;
    run.combo.setMult(currentScoreMult()); // 라이트·피버 배율 (이번 타격에 적용)

    results.forEach((r) => {
      if (r.ignored) return; // 연타 쿨다운 중 타격 — 점수·연출·콤보 변화 없음 (헛방도 아님)
      if (r.type === 'mole') {
        if (r.juggle) {
          const before = run.combo.score;
          run.combo.onJuggle(JUGGLE_BONUS); // 콤보 +1 + 작은 고정 보너스 (점수표 안 씀)
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();
          MG.HitFx.juggle(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else if (r.done) {
          const before = run.combo.score;
          run.combo.onMoleHit();   // 스펙 §12 — 마리당 1콤보 (콤보·라이트·피버 배율은 setMult 로 이미 반영)
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();   // 콤보 100단위 넘기면 목숨 +1
          // 처치(마지막) 타격에만: 대포면 폭발 흩뿌림, 아니면 기존 타격. 중간타(빼꼼/모자)는 손 안 댐.
          if (state.weapon === 'cannon') MG.HitFx.moleBlast(board, r.xFrac, r.yFrac);
          else MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          MG.HitFx.moleTap(board, r.xFrac, r.yFrac);
        }
      } else if (r.type === 'item') {
        run.shield = true;              // 실드 아이템 획득 (챕터 4~5) — 폭탄 1회 방어
        MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
        flashHud('hud-hearts');
        updateShieldHud();
      } else if (r.type === 'animal') {
        setRunLives(run.lives - 1);     // 동물 = 공유 생명 -1 (즉시 풀에 반영)
        run.combo.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
        flashHud('hud-hearts');
      } else if (r.type === 'bomb') {
        if (run.shield) {               // 실드가 폭탄을 막는다 (페널티 무효)
          run.shield = false;
          MG.HitFx.juggle(board, r.xFrac, r.yFrac); // "방어!" 느낌의 가벼운 연출
          updateShieldHud();
        } else {
          state.timeRemaining = Math.max(0, state.timeRemaining - 3); // 스펙 §8
          run.combo.onObstacleHit();
          MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'bomb');
          flashHud('hud-ticker'); // 시간 −3 — 티커 전체를 잠깐 번쩍
        }
      }
    });

    if (results.length === 0) {
      run.combo.onObstacleHit(); // 헛방 = 콤보 처음으로 회귀 (막 두드리기 방지)
      MG.HitFx.whiff(board, hitXFrac, hitYFrac); // 빈 구멍 헛스윙
    }
    if (moleHits > 0) {
      state.hitstopUntil = performance.now() +
        Math.min(HITSTOP_MAX_MS, HITSTOP_BASE_MS + run.combo.combo * 10);
    }

    syncPops();
    updateHUD();
    if (run.lives <= 0) {
      finish('lives');
    }
  }

  // 콤보가 100·200·300… 을 새로 넘겼으면 공유 생명 +1 (풀에 영구 반영).
  function checkComboLifeBonus() {
    const step = Math.floor(run.combo.combo / COMBO_LIFE_STEP);
    if (step > run.comboMilestone) {
      setRunLives(run.lives + (step - run.comboMilestone));
      run.comboMilestone = step;
      flashHud('hud-hearts');
      const h = document.getElementById('hud-hearts');
      if (h) { h.classList.remove('life-bonus'); void h.offsetWidth; h.classList.add('life-bonus'); }
      showComboHeartPop(); // 상단에 "+❤️" 이모티콘 (콤보 100 달성)
    }
  }

  function flashHud(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hud-flash');
    void el.offsetWidth;
    el.classList.add('hud-flash');
  }

  // 실드(챕터 4~5) 표시 = 보드에 파란 테두리 글로우 (별도 HUD 요소 없이).
  function updateShieldHud() {
    const b = document.getElementById('mole-board');
    if (b) b.classList.toggle('mole-board--shielded', !!(run && run.shield));
  }

  // 게임은 더보기 메뉴를 열면 멈춘다(state.paused / pausedByMenu — openMore·closeMore 참고).
  // 별도 일시정지 버튼은 없앰(사용자 요청).

  // ---------- 라운드 종료 → 다음 라운드 or 최종 결과 ----------
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
    setNavLock(true); // 라운드 전환(커튼~다음 카운트다운) 동안 ⊞ 잠금
    sessionGen++; // 이 전환 = 새 세션 토큰 (직전 카운트다운의 정리 타이머를 무효화)
    const myGen = sessionGen;
    const finishedRound = state.round;
    if (rafId) cancelAnimationFrame(rafId);
    if (state.laneHammer) state.laneHammer.home(); // 루프 멈추기 전 망치 대기위치로 스냅
    sharedPopElements.clear();
    resetHot();

    if (finishedRound >= FINAL_ROUND) {
      closeCurtain(() => { finishFromRound('done'); }); // 10라운드 완주 → 커튼 닫고 결과
      return;
    }

    // "라운드 완료!" 카드 없앰 — 커튼을 바로 닫아 직전 라운드 화면을 완전히 가리고,
    // 짧게 뒤 다음 라운드 카운트다운(같은 커튼)으로 이어진다.
    const ri = document.getElementById('round-intro-overlay');
    ri.classList.remove('is-opening');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    ri.hidden = false;
    setHammerLayerVisible(false);

    const advance = () => {
      if (myGen !== sessionGen) return; // 그 사이 나가버림
      // 더보기 메뉴가 열려 있으면 닫힐 때까지 대기 (메뉴 뒤에서 라운드가 넘어가지 않게).
      if (!document.getElementById('more-menu').hidden) { setTimeout(advance, 300); return; }
      startRound(finishedRound + 1); // fresh 아님 → 누적 유지 (커튼은 계속 닫힌 채)
    };
    // 이제 다음 라운드 카운트다운(playRoundIntro) 자체가 커튼 패턴 애니메이션(2.3s+)을
    // 갖고 있어 여기서 따로 더 기다릴 필요 없음 — 예전엔 패턴 없는 커튼이라 550ms 버퍼를
    // 뒀었는데, 지금은 그만큼 대기가 늘어지기만 해서(사용자 보고) 없앰.
    advance();
  }

  // 뽕망치 레이어(보드 밖, z 높음)는 커튼 위에 뜨므로 전환/결과 동안 같이 숨긴다.
  function setHammerLayerVisible(v) {
    const h = document.getElementById('mole-hammer-layer');
    if (h) h.style.visibility = v ? '' : 'hidden';
  }

  // 게임 최종 종료(10라운드 완주 또는 목숨 소진) → 커튼 닫고 cb(결과화면)로 이어짐.
  // 색 역할을 반대로(분홍이 먼저 천천히, 노랑이 따라잡아 최종 노랑) 재생해 라운드
  // 전환(최종 분홍)과 구분(사용자 요청) — 목숨 소진 실패도 동일하게 적용.
  function closeCurtain(cb) {
    const ri = document.getElementById('round-intro-overlay');
    ri.classList.remove('is-opening');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    ri.hidden = false;
    ri.classList.add('has-mole'); // :not(.has-mole) 규칙이 패턴을 안 보이게 하므로 필요
    setHammerLayerVisible(false);
    restartCurtainPattern(ri, true);
    setTimeout(() => {
      ri.classList.remove('has-mole');
      cb();
    }, 2300);
  }

  // 목숨 소진(라운드 도중) — 지금까지 친 점수까지 반영하고 최종 결과.
  function finish(reason) {
    if (!state || state.ended) return;
    state.ended = true;
    sessionGen++; // 직전 카운트다운 정리 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (state.laneHammer) state.laneHammer.home(); // 망치 대기위치로 스냅
    sharedPopElements.clear();
    resetHot();
    // 실패 순간 커튼이 확 닫히고 나서 결과 멘트 (사용자 요청).
    closeCurtain(() => { finishFromRound(reason); });
  }

  // 승리 결과 화면에서 왼쪽으로 스와이프 → 화면이 왼쪽으로 사라지고 "챕터 N" 화면.
  // (다음 챕터가 열려 있을 때만. 실제 챕터 콘텐츠는 Phase B — 지금은 글자 placeholder.)
  function wireResultSwipe() {
    const ov = document.getElementById('gameover-overlay');
    let x0 = null, y0 = 0, fired = false;
    // ov.hidden 체크 필수: 승리 후 홈으로 나가도 dataset.nextChapter 가 남아있어서,
    // 이게 없으면 홈화면 다이얼러(같은 .dialpad)에서 왼쪽 스와이프 시 오작동한다.
    const start = (x, y) => { if (ov.hidden || !ov.dataset.nextChapter) return; x0 = x; y0 = y; fired = false; };
    const move = (x, y) => {
      if (x0 == null || fired) return;
      const dx = x - x0, dy = y - y0;
      // 왼쪽으로 충분히, 그리고 세로보다 가로가 우세할 때
      if (dx < -55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        fired = true; x0 = null;
        goToNextChapter(parseInt(ov.dataset.nextChapter, 10));
      }
    };
    const end = (x, y) => {
      if (x0 != null && typeof x === 'number') move(x, y); // move 이벤트가 없던 경우 대비 (총 이동량으로 판정)
      x0 = null;
    };
    // 힌트(#result-swipe-hint)가 키패드 위 여백으로 내려갔으므로 스와이프도 키패드에서 먹혀야
    // 한다 — 안 그러면 "힌트는 키패드에 있는데 여기선 안 밀리네" 로 헷갈림. start() 가
    // ov.dataset.nextChapter 로 게이팅하니 플레이 중 키패드 탭엔 영향 없음.
    ov.addEventListener('dragstart', (e) => e.preventDefault()); // 하마 이미지 기본 드래그 차단
    [ov, document.querySelector('.dialpad')].forEach((el) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { if (el === ov) e.preventDefault(); start(e.clientX, e.clientY); });
      el.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
      el.addEventListener('pointerup', (e) => end(e.clientX, e.clientY));
      el.addEventListener('pointercancel', () => end());
      // 터치 폴백 (일부 안드로이드 웹뷰에서 스와이프 중 pointer 이벤트가 끊김)
      el.addEventListener('touchstart', (e) => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchmove', (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      el.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; end(t.clientX, t.clientY); });
    });
  }
  function goToNextChapter(ch) {
    localStorage.setItem('mole.chapter', String(ch));
    const sh = document.getElementById('result-swipe-hint');
    if (sh) { sh.hidden = true; sh.classList.remove('is-on'); }

    const ov = document.getElementById('gameover-overlay');
    const bs = document.getElementById('board-start');

    // "다음 챕터로" = 그 챕터의 홈 화면으로 간다 (아래 키패드는 그대로, 위 보드만 교체).
    // showStartScreenNow 가 board-start 를 챕터 N 내용으로 빌드/표시하고 ov 를 숨기므로,
    // 슬라이드 연출용으로 ov 를 되살린다: 성공 카드는 왼쪽으로, 홈 화면은 오른쪽에서 들어옴.
    showStartScreenNow({ chapterClear: true });
    bs.classList.add('nc-enter');
    ov.hidden = false;
    ov.classList.add('is-win', 'is-sliding');
    void bs.offsetWidth;
    bs.classList.add('nc-enter--on');

    setTimeout(() => {
      ov.hidden = true;
      ov.classList.remove('is-sliding', 'is-win', 'is-lose');
      ov.querySelector('.go-confetti').innerHTML = '';
      bs.classList.remove('nc-enter', 'nc-enter--on');
    }, 360);
  }

  // 최종 결과 화면 (10라운드 완주 or 목숨 소진).
  function finishFromRound(reason) {
    setNavLock(false); // 결과 화면에선 ⊞ = 홈으로 (활성)
    const total = run.combo.score;
    const light = currentLight();
    const chapter = currentChapter();
    const best = bestFor(light);
    const isNewBest = total > best;
    if (isNewBest) saveBestFor(light, total);

    // 클리어 판정 = 누적점수 ≥ 목표(완벽 플레이 90%). 통과 시 다음 챕터 해금.
    const prog = MG.Progress.record(chapter, light, total);

    // 코인 = 점수 ÷ 5000 (내림) + 10라운드 완주 보너스 20 (사용자 지정 v269 — 예전 ÷10000 은 너무 박했음).
    const coins = Math.floor(total / 5000) + (reason === 'done' ? 20 : 0);
    if (coins > 0) MG.Economy.addCoins(coins);

    // 재방문 인사용 + 기록 보관 (100판 이상도 문제없음, 개당 수십 바이트).
    try {
      localStorage.setItem('mole.lastPlayed', String(Date.now()));
      localStorage.setItem('mole.lastScore', String(total)); // 홈 문자칸 "득점" = 마지막 플레이 점수
      localStorage.setItem('mole.lastWasBest', prog.passed ? '1' : '0');
      localStorage.setItem('mole.lastWasBad', prog.passed ? '0' : '1');
      const hist = JSON.parse(localStorage.getItem('mole.history') || '[]');
      hist.push({ t: Date.now(), score: total, passed: prog.passed, reason: reason, ch: chapter, light: light });
      if (hist.length > 500) hist.splice(0, hist.length - 500); // 안전 상한
      localStorage.setItem('mole.history', JSON.stringify(hist));
    } catch (e) { /* localStorage 불가 환경 무시 */ }

    // 10라운드 완주 + 목표 달성 = 승리(축하 연출 계속) / 아니면 실패(실패 연출).
    // 두 경우 다 아래 버튼은 "다시하기" 하나 (누르면 홈 화면).
    const win = reason === 'done' && prog.passed;
    const ov = document.getElementById('gameover-overlay');
    ov.classList.toggle('is-win', win);
    ov.classList.toggle('is-lose', !win);

    // 축하 색종이+반짝이 / 실패 빗줄기 — 글자·하마가 중앙에 다 날아온(fly-in 0.4s) 뒤에 채운다.
    const conf = ov.querySelector('.go-confetti');
    conf.innerHTML = '';

    // 하마 = 기쁨/슬픔 3포즈 중 랜덤 1개
    const poseN = 1 + Math.floor(Math.random() * 3);
    const hippo = document.getElementById('gameover-hippo');
    hippo.src = 'assets/hippo/' + (win ? 'happy' : 'sad') + poseN + '.png';

    document.getElementById('gameover-reason').textContent =
      I18N.t(win ? 'mole.result.success' : 'mole.result.fail');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.scoreVs', { n: total.toLocaleString(), t: prog.target.toLocaleString() });
    // 버튼 없음 — 성공/실패 둘 다 좌상단 ⊞ 로 홈. (광고는 유저 피로도 때문에 뺌.)

    // 승리 시 다음 챕터가 열렸으면: 왼쪽 스와이프로 "챕터 N" 화면으로 넘어갈 수 있다는 힌트.
    const nextCh = win ? chapter + 1 : 0;
    ov.dataset.nextChapter = (nextCh && MG.Progress.isUnlocked(nextCh, light)) ? String(nextCh) : '';
    // 챕터 해금 = 그 즉시 다음 챕터로 전환. (예전엔 승리화면에서 왼쪽 스와이프를 해야만
    // mole.chapter 가 넘어가서, 스와이프 안 하면 다음에 시작 눌러도 이전 챕터 그대로 돌던 문제.)
    // 스와이프는 축하 연출(next-chapter-panel)만 보여줄 뿐 — 값 자체는 여기서 바로 확정.
    if (ov.dataset.nextChapter) localStorage.setItem('mole.chapter', ov.dataset.nextChapter);

    // 커튼 오버레이는 결과 카드로 교체 (둘 다 z-index 10, ri 가 DOM 상 뒤라 안 치우면 위를 덮음).
    document.getElementById('round-intro-overlay').hidden = true;
    setHammerLayerVisible(false);
    ov.classList.remove('is-sliding');
    ov.hidden = false;
    // 하마 세로 크기 = 보드 높이의 40% (포즈마다 종횡비가 달라서 vh/% CSS 로는 머리가 잘렸음).
    hippo.style.maxHeight = Math.round(ov.clientHeight * 0.4) + 'px';

    setTimeout(() => {
      // 성공 = 색종이만(반짝이별/광선 제거, 사용자 요청). 색종이 2배, 실패 빗줄기 5배.
      const n = win ? 92 : 200;
      for (let k = 0; k < n; k++) {
        const p = document.createElement('i');
        p.style.left = (Math.random() * 100) + '%';
        p.style.animationDelay = (Math.random() * 2.8) + 's';
        p.style.animationDuration = (win ? 1.5 + Math.random() * 1.6 : 2.4 + Math.random() * 1.8) + 's';
        if (win) p.style.setProperty('--h', String(Math.floor(Math.random() * 360))); // 알록달록
        conf.appendChild(p);
      }
    }, 400); // 글자·하마 fly-in(0.4s) 끝난 뒤

    // 승리 + 다음 챕터가 열려 있으면: 축하 연출 5초 뒤 "왼쪽으로 밀어" 힌트 (손 이모지 + 화살표).
    const sh = document.getElementById('result-swipe-hint');
    if (sh) { sh.hidden = true; sh.classList.remove('is-on'); }
    if (win && ov.dataset.nextChapter && sh) {
      const myGen = sessionGen;
      setTimeout(() => {
        if (myGen !== sessionGen || ov.hidden || !ov.dataset.nextChapter) return;
        sh.hidden = false;
        void sh.offsetWidth;
        sh.classList.add('is-on');
      }, 5000);
    }
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgm = document.getElementById('bgm');
    bgm.volume = 0.35;
    // 곡이 끝나면 다음 곡으로 — 홈은 4곡, 게임은 2곡을 순차 재생·순환 (플레이리스트).
    bgm.addEventListener('ended', () => {
      if (/\/bgm-game-\d/.test(currentBgm)) playScreenBgm('game');
      else if (/\/bgm-home-\d/.test(currentBgm)) playScreenBgm('home');
    });
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') applyBgm();
    });
    // 자동재생 정책에 막혔을 때 대비 — 모든 입력·버퍼완료·복귀 신호에서 applyBgm() 재시도.
    // 설치형 PWA 는 로딩 직후 재생이 허용되기도 해서 그 경우 첫 신호에 바로 시작된다.
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, applyBgm, { capture: true, passive: true }));
    window.addEventListener('pageshow', applyBgm);
    bgm.addEventListener('canplay', applyBgm);
    setTimeout(applyBgm, 400);
    // 앱이 "오래" 가려지면(유튜브 채널 이동·다른 앱 전환·화면 잠금) BGM 정지, 돌아오면 재개.
    // 500ms 디바운스 — PWA 실행 순간 잠깐 hidden 이 깜빡여서 로딩 때 "띡" 하고 끊기던 문제(사용자 보고).
    let bgmHideTimer = null;
    document.addEventListener('visibilitychange', () => {
      clearTimeout(bgmHideTimer);
      if (document.hidden) bgmHideTimer = setTimeout(() => { if (document.hidden && bgm) bgm.pause(); }, 500);
      else applyBgm();
    });
    // 언어 전환 시 JS 로 채운 동적 문구도 다시 그린다 (applyStatic 이 못 건드리는 것들).
    I18N.onChange(() => {
      const mm = document.getElementById('more-menu');
      if (moreMenu && mm && !mm.hidden) moreMenu.refresh();
      tuneAddrTicker();
    });

    // 두더지/방해물/구멍/망치 스프라이트를 지금 미리 디코드 (시작화면 대화 도는 동안).
    // 안 하면 첫 라운드에서 두더지가 올라오며 프레임 바꿀 때 디코드 hitch 로 끊긴다.
    MG.MoleSprites.preloadAll();

    // 다이얼러 버튼은 시작 화면에도 계속 보인다 (폰 컨셉) — 세션당 한 번만 생성.
    // 시작 화면/카운트다운 동안엔 handleCell 이 앞에서 막으므로 눌러도 아무 일 없다.
    sharedLaneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: GRID_SIZE,
      onCell: handleCell,
      isHome: () => document.getElementById('game-screen').classList.contains('is-start'),
      // 홈 화면(전화 다이얼러로 위장 중)일 때만 탭음(버튼소리1 고정) — 플레이 중엔 연타가 잦아
      // 타격음과 겹치므로 안 씀.
      onTap: () => { if (document.getElementById('game-screen').classList.contains('is-start')) MG.HitFx.uiTap(0); },
      // 채널 링크 — 홈 화면에서 채널 버튼을 "두 번 톡톡"(더블탭)하면 광고 후 유튜브 채널로 이동.
      // lane-controls 가 URL 을 직접 넘겨준다 (LINKS 하드코딩 + 유저가 이 기기에 등록한 것 둘 다 포함).
      // window.open(_blank) 은 광고(비동기) 뒤엔 팝업 차단됨 → 같은 탭 이동(location.href).
      onChannelEnter: (url) => {
        if (!url || !document.getElementById('game-screen').classList.contains('is-start')) return;
        MG.Ads.interstitial(I18N.t('mole.channel.hint')).then((ok) => {
          if (ok) { if (bgm) bgm.pause(); window.location.href = url; } // 채널 이동 전 BGM 정지
        });
      }
    });
    wireStartButton(); // 다이얼러 초록 버튼: 홈에서 탭=시작 / 꾹=종료 대기
    wireChapterNav();  // ◀ 챕터 N ▶ (열린 챕터 2개 이상일 때만 노출)

    migrateBest();
    wireMoreMenu();

    // ⚠️ 핵심 리스너 배선을 showStartScreen() 보다 먼저 — showStartScreen 안에서 예외가 나도
    // (예: 스테일 캐시로 모듈 하나 누락) ⊞ 홈버튼·일시정지 등이 죽지 않도록.
    // 좌상단 ⊞ = 더보기 메뉴 열기.
    document.getElementById('btn-back-to-hub').addEventListener('click', (e) => {
      if (navLocked) return; // 인트로/카운트다운/라운드 전환 중엔 안 먹힘 (회색 음영)
      // 결과 화면에선 ⊞ = 곧장 홈(대화)으로 (다시하기 버튼 없앰 — 중복). 그 외엔 더보기 메뉴.
      if (!document.getElementById('gameover-overlay').hidden) { showStartScreen({ retry: true, originEl: e.currentTarget }); return; }
      openMore(undefined, e.currentTarget);
    });
    // 앱 전체 버튼 탭음(버튼소리2 고정) — 게임 키패드(#lane-button-bar, 다이얼패드일 땐 버튼소리1을
    // 자체 처리, 플레이 중엔 무음)만 제외하고 전부. 더보기/설정/상점/일일/인벤토리 등을 화면마다
    // 일일이 지정하지 않아도 새 버튼이 생기면 자동으로 소리가 붙는다.
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || btn.closest('#lane-button-bar')) return;
      MG.HitFx.uiTap(1);
    });
    document.getElementById('nc-back-btn').addEventListener('click', () => {
      const panel = document.getElementById('next-chapter-panel');
      panel.classList.remove('is-in');
      panel.hidden = true;
      showStartScreen();
    });
    wireResultSwipe(); // 승리 화면 왼쪽 스와이프 → 다음 챕터 화면
    // 대화 공개 중 아무 데나 탭하면 나머지 메시지 즉시 표시 (건너뛰기)
    document.getElementById('board-start').addEventListener('click', (e) => {
      if (e.target.closest('.chat-ad-btn')) return;
      const thread = document.querySelector('#board-start .chat-thread:not([hidden])');
      const pending = thread && thread.querySelectorAll('.chat-row.chat-pending');
      if (!pending || !pending.length) return;
      pending.forEach((r) => { r.classList.remove('chat-pending'); r.classList.add('chat-appear'); });
      thread.scrollTop = thread.scrollHeight;
    });

    // 첫 화면 = 두더지 오빠 대화. (예외가 나도 위 배선은 이미 끝났음. 최초 진입은 플래시 없음.)
    try { showStartScreen({ skipFlash: true }); } catch (e) { console.error('showStartScreen failed', e); }

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = (diff, chapter) => {
      loadActiveFace().then(() => {
        currentDiff = DIFFS.indexOf(diff) > -1 ? diff : 'easy';
        localStorage.setItem('mole.difficulty', currentDiff);
        if (chapter >= 1 && chapter <= MG.Progress.MAX_CHAPTER) localStorage.setItem('mole.chapter', String(chapter));
        applyDiffClass(currentDiff);
        startRound(1, { fresh: true });
      });
    };
    window.__debugSetChapter = (n) => { localStorage.setItem('mole.chapter', String(n)); };
    window.__debugUnlockAll = () => { localStorage.setItem('mole.unlockAll', '1'); };
    window.__debugProgress = () => ({
      chapter: currentChapter(), light: currentLight(),
      target: MG.Progress.target(currentChapter()),
      rec: MG.Progress.get(currentChapter(), currentLight())
    });
    window.__debugStartRound = (n) => startRound(n, { fresh: true });
    window.__debugEndRound = function () {
      if (state && !state.ended) { state.timeRemaining = 0; roundComplete(); }
    };
    window.__debugForceGameOver = function () {
      if (!state || !run) return;
      setRunLives(0);
      finish('lives');
    };
    window.__debugSetWeapon = (w) => { localStorage.setItem('mole.weapon', w === 'cannon' ? 'cannon' : 'hammer'); };
    window.__debugFireWeapon = (xf, yf) => {
      if (state && state.laneHammer) state.laneHammer.strike(xf == null ? 0.5 : xf, yf == null ? 0.35 : yf, () => {});
    };
    window.__debugHitCell = function (regionId) {
      if (state) handleCell(regionId);
    };
    // 콤보 강제 주입 — 100단위 목숨 보너스 테스트용.
    window.__debugPumpCombo = function (n) {
      if (!run) return null;
      for (let i = 0; i < n; i++) { run.combo.onMoleHit(); checkComboLifeBonus(); }
      updateHUD();
      return { combo: run.combo.combo, lives: run.lives };
    };
    window.__debugIntroActive = function () {
      return !!(state && state.introActive);
    };
    // 대포 연사 연출 확인용 — 안 맞은 다타 두더지 하나를 연사 대상으로 강제. 인자 없으면 아무 구멍.
    window.__debugForceBurst = function (regionId) {
      if (!state || !state.scheduler.debugForceBurst) return null;
      if (regionId == null) {
        const p = state.scheduler.getActivePops().find((m) => m.type === 'mole' && m.hitsRequired > 1 && m.hitsTaken === 0 && !m.dying);
        regionId = p ? p.regionId : null;
      }
      if (regionId == null) return null;
      return state.scheduler.debugForceBurst(regionId) ? regionId : null;
    };
    // 지금 실제로 때릴 수 있는(살아있고 아직 안 맞은) 두더지의 regionId — 없으면 null.
    // sinkIn(타격 후 침몰 대기) 창에는 두더지가 아직 서 있어 보이지만 이미 처치된 상태라 제외한다.
    window.__debugHittableMoleRegion = function () {
      if (!state || state.ended) return null;
      const p = state.scheduler.getActivePops().find((m) =>
        m.type === 'mole' && !m.dying && !m.sinkIn && (m.hitCooldown || 0) <= 0);
      return p ? p.regionId : null;
    };
    // 첫 방문/재방문 대화 테스트용.
    window.__debugSetVisits = function (n) {
      localStorage.setItem('mole.visits', String(Math.max(0, n - 1)));
      showStartScreen();  // 안에서 +1 → n번째 방문으로 표시
    };
    window.__debugResetIntro = function () {
      ['mole.visits', 'mole.lastPlayed', 'mole.lastWasBest', 'mole.lastWasBad', 'mole.history']
        .forEach((k) => localStorage.removeItem(k));
      showStartScreen();
    };
    window.__debugOpenMore = (sub) => openMore(sub);
    window.__debugSetHearts = function (n) {
      MG.Economy.setHearts(n);
      if (run) run.lives = MG.Economy.getHearts();
      refreshBoardStats();
    };
    window.__debugSetCoins = function (n) {
      localStorage.setItem('mole.coins', String(n));
      refreshBoardStats();
    };
    window.__debugExitApp = () => exitApp();
    window.__debugAddFace = function () {
      return fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
        .then((r) => r.blob())
        .then((b) => MG.FaceStore.saveFace(b, '테스트'))
        .then((id) => { MG.FaceStore.setActive(id); if (moreMenu) moreMenu.refresh(); return id; });
    };
  });

  // 더보기 메뉴 + 하위 화면 모듈 인스턴스 생성·배선.
  function wireMoreMenu() {
    screenNav = MG.ScreenNav.create({
      screens: ['face-maker', 'costume-screen', 'face-locker', 'shop-screen', 'daily-screen', 'score-screen', 'settings-screen', 'inventory-screen', 'help-screen', 'privacy-screen', 'quest-screen', 'friends-screen']
    });

    faceMaker = MG.FaceMaker.create({
      root: document.getElementById('face-maker'),
      onDone: onFaceMade,
      onCancel: () => screenNav.back()
    });
    costumeScreen = MG.CostumeScreen.create({
      root: document.getElementById('costume-screen'),
      onClose: () => { screenNav.reset(); document.getElementById('more-menu').hidden = true; if (!state) showStartScreen(); },
      onSave: (faceId, costume) => {
        MG.FaceStore.setCostume(faceId, costume).then(() => {
          MG.FaceStore.setActive(faceId);
          screenNav.reset();
          document.getElementById('more-menu').hidden = true;
          if (moreMenu) moreMenu.refresh();
          if (!state) showStartScreen();
        });
      }
    });
    faceLocker = MG.FaceLocker.create({
      root: document.getElementById('face-locker'),
      onMake: () => { screenNav.show('face-maker'); faceMaker.open({}); },
      onEdit: (rec) => { screenNav.show('costume-screen'); costumeScreen.open(rec); },
      onPick: () => screenNav.back(),
      onClose: () => screenNav.back()
    });
    shop = MG.Shop.create({
      root: document.getElementById('shop-screen'),
      onClose: () => screenNav.back(),
      onChange: () => { if (moreMenu) moreMenu.refresh(); }
    });
    daily = MG.Daily.create({
      root: document.getElementById('daily-screen'),
      onClose: () => screenNav.back(),
      onChange: () => { if (moreMenu) moreMenu.refresh(); }
    });
    scoreScreen = MG.ScoreScreen.create({
      root: document.getElementById('score-screen'),
      onClose: () => screenNav.back()
    });
    settingsScreen = MG.SettingsScreen.create({
      root: document.getElementById('settings-screen'),
      onClose: () => screenNav.back(),
      onPrivacy: () => screenNav.show('privacy-screen'),
      onHelp: () => screenNav.show('help-screen'),
      onContact: () => { window.location.href = 'mailto:mrkyp@hanmail.net'; }
    });
    inventoryScreen = MG.InventoryScreen.create({
      root: document.getElementById('inventory-screen'),
      onClose: () => screenNav.back(),
      // 게임 진행 중(라운드1~클리어)엔 무기 변경 잠금. 홈·게임오버 후엔 허용.
      gameInProgress: () => !!(state && !state.ended)
    });
    ['help', 'privacy', 'quest', 'friends'].forEach((k) => {
      const b = document.querySelector('[data-back="' + k + '"]');
      if (b) b.addEventListener('click', () => screenNav.back());
    });

    moreMenu = MG.MoreMenu.create({
      root: document.getElementById('more-menu'),
      on: {
        close: closeMore,
        make: () => { screenNav.show('face-maker'); faceMaker.open({}); },
        locker: () => { screenNav.show('face-locker'); faceLocker.show(); },
        diff: (d) => {
          // 라이트 모드는 "설정만" — 선택 표시만 바꾸고 화면 이동 없음.
          localStorage.setItem('mole.difficulty', d);
          moreMenu.refresh();
        },
        start: (e) => {
          // 더보기 메뉴의 "시작" (통화 버튼 자리) → 더보기 닫고 대화 화면으로.
          // (대화 화면 시작 버튼을 눌러야 그 난이도로 게임이 시작된다. more-menu 숨김/screenNav
          // 리셋은 showStartScreenNow 가 이미 처리하므로 여기서 먼저 하지 않는다 —
          // 플래시가 화면을 덮은 순간에 맞춰 전환돼야 "그 버튼에서 펼쳐지는" 느낌이 남.)
          showStartScreen({ originEl: e && e.currentTarget });
        },
        shop: () => { screenNav.show('shop-screen'); shop.show(); },
        daily: () => { screenNav.show('daily-screen'); daily.show(); },
        score: () => { screenNav.show('score-screen'); scoreScreen.show(); },
        quest: () => screenNav.show('quest-screen'),
        friends: () => screenNav.show('friends-screen'),
        inventory: () => { screenNav.show('inventory-screen'); inventoryScreen.show(); },
        settings: () => { screenNav.show('settings-screen'); settingsScreen.show(); },
        editName: () => {
          const n = prompt(I18N.t('mole.more.nickPrompt'), localStorage.getItem('mole.nick') || '');
          if (n != null) { localStorage.setItem('mole.nick', n.trim().slice(0, 12)); moreMenu.refresh(); }
        },
        editAvatar: () => {
          screenNav.show('face-maker');
          faceMaker.open({
            profile: true,
            onDone: (dataUrl) => {
              try { localStorage.setItem('mole.profilePic', dataUrl); } catch (e) { alert(I18N.t('mole.fm.priv')); }
              screenNav.back();
              moreMenu.refresh();
            }
          });
        }
      }
    });
  }

  // 얼굴 크롭 저장 완료 → 바로 꾸미기 화면으로.
  function onFaceMade(id) {
    MG.FaceStore.getFace(id).then((rec) => {
      if (!rec) { screenNav.back(); return; }
      screenNav.show('costume-screen');
      costumeScreen.open(rec);
    });
  }
})();

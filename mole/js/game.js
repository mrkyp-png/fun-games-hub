(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const START_LIVES = 3;      // 스펙 §11
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const CANNON_HOLE = 15;     // 대포 장착 시 없애는 구멍 (우하단 = row3·col3). 15구멍으로 플레이.
  const ROUND_SECONDS = 15;   // ⚠️ 임시 테스트값 (챕터 전환 흐름 빨리 돌려보려고). 원래 30 — 출시 전 원복.
                              //    (index.html 인트로·도움말의 "각 30초" 문구는 안 건드림 — 같이 원복)
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
  // 10라운드를 통틀어 유지되는 것: 콤보·점수(1라운드부터 누적)와 목숨.
  let run = null;     // { combo: ComboScore, lives, comboMilestone }
  const COMBO_LIFE_STEP = 100; // 콤보가 이 배수를 넘길 때마다 목숨 +1
  const JUGGLE_BONUS = 30;     // 저글(더블) 점수 — 작은 덤 (콤보 점수표 안 씀)
  let rafId = null;
  let lastTime = 0;
  let sharedPopElements = null; // #mole-pop-layer는 재생성 안 되는 고정 DOM이므로 세션당 한 번만 생성
  let sharedLaneControls = null; // 다이얼러 버튼 — 시작 화면에도 (비활성으로) 계속 보여야 하므로 세션당 한 번만 생성
  let sessionGen = 0; // startRound/showStartScreen 호출마다 +1 — 카운트다운·자동진행 타이머 취소 토큰
  let adBonusLives = 0; // "광고 보고 생명 +1" → 다음 판 목숨에 더해지고 소비됨

  let bgm = null; // <audio id="bgm">
  function syncBgm(playIntent) {
    if (!bgm) return;
    if (window.FGH.Settings.get('music') && playIntent) {
      bgm.play().catch(() => { /* 자동재생 차단 — 다음 제스처/토글에 재시도 */ });
    } else {
      bgm.pause();
    }
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

  // 대화 화면 "시작" 버튼(들)이 부르는 진입점. 활성 얼굴 로드 → 라운드 1.
  // Phase 1: 하트 소모 게이트는 비활성 (게임 완성 우선). Phase 2에서 재활성 — 아래 한 줄 주석 해제.
  function beginGame() {
    currentDiff = currentDifficulty();
    // if (!MG.Economy.spendHeart()) { showNoHeartModal(); return; }
    applyDiffClass(currentDiff);
    loadActiveFace().then(() => startRound(1, { fresh: true }));
  }

  // ---------- 시작화면 초록 버튼: 탭=시작 / 꾹=종료 대기 / 다시 탭=종료창 ----------
  // (홈 화면에서만. 게임 중엔 이 버튼은 15번 구멍 타격이라 handleCell 이 담당.)
  const armState = { armed: false, revertT: null };
  let setCallLabel = () => {}; // (mode) 'home' → "시작" / 'game' → "통화" (게임 중엔 15번 구멍 타격)
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

    btn.addEventListener('pointerdown', () => {
      if (!isHome()) return;
      longFired = false;
      holdT = setTimeout(() => {
        longFired = true;
        setArmed(true);
        if (window.FGH.Settings.vibrate) window.FGH.Settings.vibrate();
      }, 600);
    });
    const cancelHold = () => clearTimeout(holdT);
    btn.addEventListener('pointercancel', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('pointerup', () => {
      if (!isHome()) return;
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
    // 안드로이드 앱/standalone PWA 에선 실제로 닫힌다. Phase 2: Capacitor App.exitApp().
    // 그냥 검은 화면이 아니라 라운드 전환과 같은 커튼이 닫히며 종료 (사용자 요청).
    const ri = document.getElementById('round-intro-overlay');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    ri.classList.add('is-opening'); // 커튼 열린 상태로 시작
    ri.hidden = false;
    setHammerLayerVisible(false);
    // display:none → 표시 직후엔 transition 시작점이 안 잡힌다. 열린 상태를
    // 두 프레임 렌더한 뒤 클래스를 빼야 커튼이 가운데로 닫히는 게 애니메이션된다.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { ri.classList.remove('is-opening'); });
    });
    try { window.close(); } catch (e) { /* 무시 */ }
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
      MG.Ads.rewarded().then((ok) => { if (ok) { MG.Economy.addHearts(1); if (moreMenu) moreMenu.refresh(); } });
    });
    v.querySelector('[data-nh="shop"]').addEventListener('click', () => { v.remove(); openMore('shop-screen'); });
    v.querySelector('[data-nh="close"]').addEventListener('click', () => v.remove());
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
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    state = null;
    run = null;
    setPauseUI(false);
    syncBgm(false); // 허브 시작 화면으로 나오면 BGM 정지
    const go = document.getElementById('gameover-overlay');
    go.hidden = true; go.classList.remove('is-win', 'is-lose', 'is-sliding');
    const cf = go.querySelector('.go-confetti'); if (cf) cf.innerHTML = '';
    const ncp = document.getElementById('next-chapter-panel');
    ncp.hidden = true; ncp.classList.remove('is-in');
    const ri = document.getElementById('round-intro-overlay');
    ri.hidden = true; ri.classList.remove('is-opening');
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

    // 위에서 내려오는 문자 알림 = 이번 판 목표 점수 / 마지막 플레이 득점.
    const goal = MG.Progress.target(currentChapter());
    const sms = document.getElementById('start-best');
    const smsTxt = I18N.t('mole.start.goal', { n: goal.toLocaleString() }) +
      '  /  ' + I18N.t('mole.start.best', { n: lastScore().toLocaleString() });
    sms.querySelector('.chat-sms-txt').textContent = smsTxt;
    const bs = document.getElementById('board-stats');
    if (bs) {
      // 숫자 자리수가 늘어나도 박스 크기/위치는 고정 — 폰트만 줄인다.
      const fitStatNum = (el) => {
        const digits = el.textContent.replace(/[^0-9]/g, '').length;
        el.style.fontSize = digits <= 4 ? '' : digits <= 6 ? '0.82em' : digits <= 8 ? '0.68em' : '0.56em';
      };
      const heartsEl = bs.querySelector('[data-bs-hearts]');
      const coinsEl = bs.querySelector('[data-bs-coins]');
      heartsEl.textContent = String(MG.Economy.getHearts());
      coinsEl.textContent = MG.Economy.getCoins().toLocaleString();
      fitStatNum(heartsEl);
      fitStatNum(coinsEl);
    }
    sms.classList.toggle('is-empty', false);
    sms.classList.remove('sms-anim');   // 시작화면 열 때마다 문자 툭↓ + 폭죽 리트리거
    void sms.offsetWidth;
    sms.classList.add('sms-anim');

    // 첫 방문 = 전체 인트로. 아니면 재방문 대화(재접=랜덤 문구 / 다시하기=축하 이모티콘 리액션).
    const isRetry = !!(opts && opts.retry);
    const visits = parseInt(localStorage.getItem('mole.visits'), 10) || 0;
    if (!isRetry) localStorage.setItem('mole.visits', String(visits + 1));
    const firstVisit = !isRetry && visits === 0;
    const firstEl = document.getElementById('chat-first');
    const returnEl = document.getElementById('chat-return');
    firstEl.hidden = !firstVisit;
    returnEl.hidden = firstVisit;

    if (!firstVisit) buildReturnChat(isRetry ? 'retry' : 'phrase');
    revealThread(firstVisit ? firstEl : returnEl);
    maybeShowStartCoach();
  }

  // 챕터 선택 ◀ 챕터 N ▶ — 열린 챕터가 2개 이상일 때만 표시. mole.chapter 를 설정.
  // HUD 주소창 자리를 차지 → 그때 주소창 숨김.
  function refreshChapterNav() {
    const nav = document.getElementById('chapter-nav');
    const addr = document.getElementById('hud-addr');
    if (!nav) return;
    const maxCh = MG.Progress.maxChapterFor(currentLight());
    if (maxCh <= 1) { nav.hidden = true; if (addr) addr.hidden = false; return; }
    let ch = currentChapter();
    if (ch > maxCh) { ch = maxCh; localStorage.setItem('mole.chapter', String(ch)); }
    nav.hidden = false;
    if (addr) addr.hidden = true;
    nav.querySelector('[data-ch-label]').textContent = chapterLabel(ch);
    nav.querySelector('[data-ch-prev]').disabled = ch <= 1;
    nav.querySelector('[data-ch-next]').disabled = ch >= maxCh;
  }
  function wireChapterNav() {
    const nav = document.getElementById('chapter-nav');
    if (!nav) return;
    const step = (d) => {
      const maxCh = MG.Progress.maxChapterFor(currentLight());
      const ch = Math.max(1, Math.min(maxCh, currentChapter() + d));
      localStorage.setItem('mole.chapter', String(ch));
      refreshChapterNav();
      // 목표 점수 문자알림 갱신
      const sms = document.getElementById('start-best');
      sms.querySelector('.chat-sms-txt').textContent =
        I18N.t('mole.start.goal', { n: MG.Progress.target(ch).toLocaleString() }) +
        '  /  ' + I18N.t('mole.start.best', { n: lastScore().toLocaleString() });
    };
    nav.querySelector('[data-ch-prev]').addEventListener('click', () => step(-1));
    nav.querySelector('[data-ch-next]').addEventListener('click', () => step(1));
  }

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
    retryText: (k) => (k === 'best' ? '신기록!' : k === 'bad' ? 'ㅋㅋ' : '잘했어!')
  };
  function buildReturnChat(mode) {
    const el = document.getElementById('chat-return');
    el.innerHTML = '';
    if (mode === 'retry') {
      const kind = localStorage.getItem('mole.lastWasBest') === '1' ? 'best'
        : localStorage.getItem('mole.lastWasBad') === '1' ? 'bad' : 'clear';
      el.appendChild(emojiRow('them', CELEBRATE_EMOJI, true));        // 축하 이모티콘(큼) + 폭죽
      el.appendChild(bubbleRow('them', CP.retryText(kind)));         // 글자는 따로
      el.appendChild(emojiRow('me', pick(HIPPO_MOODS), false));       // 하마 이모티콘(큼)
    } else {
      el.appendChild(bubbleRow('them', pick(CP.returnPhrases())));
      el.appendChild(bubbleRow('me', pick(CP.hippoReplies())));
    }
    el.appendChild(adRow());   // 두더지 마지막 말풍선 = "하트나 코인 필요하면 눌러" (일반 대화 줄)
  }

  // 광고 보기 = 두더지 말풍선 (재방문 대화 마지막 줄). 일반 대화처럼 한 줄씩 공개·스크롤.
  function adRow() {
    const row = document.createElement('div');
    row.className = 'chat-row chat-row--them';
    row.appendChild(avatarEl('mole'));
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble--them chat-ad-bubble';
    bubble.innerHTML =
      '<span class="chat-ad-say">' + I18N.t('mole.start.adIntro') + '</span>' +
      '<span class="chat-ad-btns">' +
        '<button type="button" class="chat-ad-btn" data-ad="life" aria-label="' + I18N.t('mole.start.adLife') + '">' +
          '<span class="chat-ad-play" aria-hidden="true">▶</span>' +
          '<svg class="chat-ad-ic chat-ad-ic--heart" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>' +
          '<span class="chat-ad-n">+1</span></button>' +
        '<button type="button" class="chat-ad-btn" data-ad="coin" aria-label="' + I18N.t('mole.shop.watchCoin') + '">' +
          '<span class="chat-ad-play" aria-hidden="true">▶</span>' +
          '<svg class="chat-ad-ic chat-ad-ic--coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6"/></svg>' +
          '<span class="chat-ad-n">+50</span></button>' +
      '</span>';
    row.appendChild(bubble);
    wireChatAds(row);
    return row;
  }

  // "광고 보고 하트/코인" 버튼 연결.
  function wireChatAds(scope) {
    const life = scope.querySelector('[data-ad="life"]');
    const coin = scope.querySelector('[data-ad="coin"]');
    if (life && !life.dataset.wired) {
      life.dataset.wired = '1';
      life.addEventListener('click', () => MG.Ads.rewarded().then((ok) => {
        if (!ok) return;
        adBonusLives += 1;
        life.disabled = true;
        life.querySelector('.chat-ad-n').textContent = '✓';
      }));
    }
    if (coin && !coin.dataset.wired) {
      coin.dataset.wired = '1';
      coin.addEventListener('click', () => MG.Ads.rewarded().then((ok) => {
        if (ok) MG.Economy.addCoins(50);
      }));
    }
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
    const myGen = sessionGen;
    // fresh(시작/다시하기)면 콤보·점수·목숨 전부 리셋. 자동 다음 라운드면 그대로 이어간다.
    if (opts && opts.fresh) {
      run = { combo: MG.ComboScore.create(), lives: START_LIVES + adBonusLives, comboMilestone: 0, shield: false };
      adBonusLives = 0; // 광고 보너스 목숨은 한 판만
    }
    updateShieldHud();
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();

    const levelData = MG.LEVELS[roundNum - 1];

    // 홈 화면(대화)에서 바로 시작하는 경우만 전환 플래시.
    const boardStartEl = document.getElementById('board-start');
    if (opts && opts.fresh && !boardStartEl.hidden) screenFlash(document.querySelector('.lane-button--call'));
    boardStartEl.hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').classList.remove('is-start');
    setCallLabel('game'); // 게임 중: 초록 버튼은 "통화"(위장) — 15번 구멍 타격 담당
    // 새 게임 시작(fresh)일 때만 더보기 메뉴를 닫는다. 자동 다음 라운드는 메뉴를 건드리지 않음
    // (플레이 중 메뉴 열어둔 채 라운드가 넘어가도 화면이 안 튀게).
    if (opts && opts.fresh) {
      if (screenNav) screenNav.reset();
      document.getElementById('more-menu').hidden = true;
    }
    syncBgm(true); // 시작 버튼(사용자 제스처) 이후 — 설정에서 켜져 있으면 재생
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
      obstacles: ch >= 2
    };

    const scheduler = MG.SpawnScheduler.create({ regions, spawnPoints, config, rng });

    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onEmerge: (x, y, type) => {
          if (type === 'mole') MG.HitFx.emerge(document.getElementById('mole-board'), x, y);
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
      round: roundNum, levelData, regions, spawnPoints, scheduler, holeLayer, laneHammer,
      timeRemaining: ROUND_SECONDS,
      hitstopUntil: 0,
      ended: false,
      paused: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };
    setPauseUI(false);

    updateHUD();
    playRoundIntro(roundNum, () => {
      if (myGen !== sessionGen || !state) return; // 그 사이 나가버림 — 이 콜백 무효
      state.introActive = false;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    });
  }

  // "라운드 N" → 3·2·1·시작! 카운트다운을 보여주고 onDone 호출.
  function playRoundIntro(roundNum, onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const title = document.getElementById('round-intro-title');
    const count = document.getElementById('round-intro-count');
    title.textContent = I18N.t('mole.round', { n: roundNum });
    overlay.hidden = false;
    const STEPS = ['3', '2', '1', I18N.t('mole.count.go')];
    let i = 0;
    function tick() {
      if (myGen !== sessionGen) return; // 도중에 나가버림
      count.textContent = STEPS[i];
      count.classList.remove('pop');
      void count.offsetWidth;
      count.classList.add('pop');
      i++;
      if (i < STEPS.length) {
        setTimeout(tick, 650);
      } else {
        // 마지막("시작!") 잠깐 보여준 뒤 커튼을 양쪽으로 확 연다.
        setTimeout(() => {
          if (myGen !== sessionGen) return;
          overlay.classList.add('is-opening');
          setHammerLayerVisible(true); // 전환 중 숨겨둔 망치(z 20, 커튼 위)를 커튼 열리며 복귀
          onDone(); // 게임 루프는 커튼 열리는 동안 바로 시작
          setTimeout(() => {
            if (myGen !== sessionGen) return; // 다음 라운드 전환이 이미 커튼 다시 닫았으면 건드리지 않음
            overlay.hidden = true;
            overlay.classList.remove('is-opening');
          }, 300); // 커튼 transition(0.26s) 후 정리
        }, 380);
      }
    }
    tick();
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

  function updateHUD() {
    MG.HUD.update({
      round: state.round,
      lives: run.lives,
      timeRemaining: state.timeRemaining,
      combo: run.combo.combo,
      isMaxCombo: run.combo.isMaxCombo(),
      score: run.combo.score // 1라운드부터 누적 (콤보·점수 한 통)
    });
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

    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, targetY, results));
    // 버튼 이펙트 색: 헛방(구멍에 아무것도 없음) 또는 폭탄이면 빨간색.
    return results.length === 0 || results.some((r) => r.type === 'bomb');
  }

  function onHammerImpact(hitXFrac, hitYFrac, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;

    results.forEach((r) => {
      if (r.type === 'mole') {
        if (r.juggle) {
          run.combo.onJuggle(JUGGLE_BONUS); // 콤보 +1 + 작은 고정 보너스 (점수표 안 씀)
          checkComboLifeBonus();
          MG.HitFx.juggle(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else if (r.done) {
          run.combo.onMoleHit();   // 스펙 §12 — 마리당 1콤보
          checkComboLifeBonus();   // 콤보 100단위 넘기면 목숨 +1
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
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
        run.lives -= 1;                 // 스펙 §8/§11 — 목숨은 10라운드 통틀어 3개
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

  // 콤보가 100·200·300… 을 새로 넘겼으면 목숨 1개 보너스.
  function checkComboLifeBonus() {
    const step = Math.floor(run.combo.combo / COMBO_LIFE_STEP);
    if (step > run.comboMilestone) {
      run.lives += (step - run.comboMilestone);
      run.comboMilestone = step;
      flashHud('hud-hearts');
      const h = document.getElementById('hud-hearts');
      if (h) { h.classList.remove('life-bonus'); void h.offsetWidth; h.classList.add('life-bonus'); }
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

  // ---------- 일시정지 ----------
  // 아이콘: 플레이 중 = ▶ / 일시정지 = ⏸ (사용자 요청 — 현재 상태 표시).
  function setPauseUI(paused) {
    const btn = document.getElementById('btn-pause');
    if (btn) btn.classList.toggle('is-paused', paused);
    document.getElementById('game-screen').classList.toggle('is-paused', paused);
  }
  function togglePause() {
    if (!state || state.ended || state.introActive) return;
    state.paused = !state.paused;
    setPauseUI(state.paused);
    if (!state.paused) lastTime = performance.now(); // 재개 시 시간 점프 방지
  }

  // ---------- 라운드 종료 → 다음 라운드 or 최종 결과 ----------
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
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
    setTimeout(advance, 550);
  }

  // 뽕망치 레이어(보드 밖, z 높음)는 커튼 위에 뜨므로 전환/결과 동안 같이 숨긴다.
  function setHammerLayerVisible(v) {
    const h = document.getElementById('mole-hammer-layer');
    if (h) h.style.visibility = v ? '' : 'hidden';
  }

  // 커튼을 바로 닫아 직전 화면을 가림 → cb (결과/카운트다운) 로 이어짐.
  function closeCurtain(cb) {
    const ri = document.getElementById('round-intro-overlay');
    ri.classList.remove('is-opening');
    ri.querySelector('.round-intro-title').textContent = '';
    ri.querySelector('.round-intro-count').textContent = '';
    ri.hidden = false;
    setHammerLayerVisible(false);
    setTimeout(cb, 240);
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
    const start = (x, y) => { if (!ov.dataset.nextChapter) return; x0 = x; y0 = y; fired = false; };
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
    ov.addEventListener('pointerdown', (e) => start(e.clientX, e.clientY));
    ov.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    ov.addEventListener('pointerup', (e) => end(e.clientX, e.clientY));
    ov.addEventListener('pointercancel', () => end());
    // 터치 폴백 (일부 안드로이드 웹뷰에서 스와이프 중 pointer 이벤트가 끊김)
    ov.addEventListener('touchstart', (e) => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive: true });
    ov.addEventListener('touchmove', (e) => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
    ov.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; end(t.clientX, t.clientY); });
  }
  function goToNextChapter(ch) {
    localStorage.setItem('mole.chapter', String(ch));
    const ov = document.getElementById('gameover-overlay');
    const panel = document.getElementById('next-chapter-panel');
    panel.querySelector('[data-nc-label]').textContent = chapterLabel(ch);
    panel.hidden = false;
    void panel.offsetWidth;
    ov.classList.add('is-sliding');      // 축하 화면 왼쪽으로
    panel.classList.add('is-in');        // 챕터 화면 오른쪽에서 들어옴
    setTimeout(() => {
      ov.hidden = true;
      ov.classList.remove('is-sliding', 'is-win', 'is-lose');
      ov.querySelector('.go-confetti').innerHTML = '';
    }, 360);
  }

  // 최종 결과 화면 (10라운드 완주 or 목숨 소진).
  function finishFromRound(reason) {
    const total = run.combo.score;
    const light = currentLight();
    const chapter = currentChapter();
    const best = bestFor(light);
    const isNewBest = total > best;
    if (isNewBest) saveBestFor(light, total);

    // 클리어 판정 = 누적점수 ≥ 목표(완벽 플레이 90%). 통과 시 다음 챕터 해금.
    const prog = MG.Progress.record(chapter, light, total);

    const coins = Math.floor(total / 10000); // 점수 ÷ 10000 (사용자 지정) — 예: 130,000점 → 13코인
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

    // 축하 색종이+반짝이 / 실패 빗줄기 채우기 (계속 반복)
    const conf = ov.querySelector('.go-confetti');
    conf.innerHTML = '';
    const n = win ? 46 : 40;
    for (let k = 0; k < n; k++) {
      const p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.animationDelay = (Math.random() * 2.8) + 's';
      p.style.animationDuration = (win ? 1.5 + Math.random() * 1.6 : 2.4 + Math.random() * 1.8) + 's';
      if (win) p.style.setProperty('--h', String(Math.floor(Math.random() * 360))); // 알록달록
      conf.appendChild(p);
    }
    if (win) {
      for (let k = 0; k < 14; k++) {
        const s = document.createElement('span');
        s.className = 'go-spark';
        s.style.left = (8 + Math.random() * 84) + '%';
        s.style.top = (10 + Math.random() * 70) + '%';
        s.style.animationDelay = (Math.random() * 1.8) + 's';
        conf.appendChild(s);
      }
    }

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

    // 커튼 오버레이는 결과 카드로 교체 (둘 다 z-index 10, ri 가 DOM 상 뒤라 안 치우면 위를 덮음).
    document.getElementById('round-intro-overlay').hidden = true;
    setHammerLayerVisible(false);
    ov.classList.remove('is-sliding');
    ov.hidden = false;
    // 하마 세로 크기 = 보드 높이의 40% (포즈마다 종횡비가 달라서 vh/% CSS 로는 머리가 잘렸음).
    hippo.style.maxHeight = Math.round(ov.clientHeight * 0.4) + 'px';
  }

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgm = document.getElementById('bgm');
    bgm.volume = 0.35;
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') syncBgm(state && !state.ended);
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
      // 홈 화면(전화 다이얼러로 위장 중)일 때만 탭음(버튼소리1 고정) — 플레이 중엔 연타가 잦아
      // 타격음과 겹치므로 안 씀.
      onTap: () => { if (document.getElementById('game-screen').classList.contains('is-start')) MG.HitFx.uiTap(0); },
      // 채널 링크 — 시작버튼 제외 나머지 버튼 길게누르기. 홈 화면일 때만, 그 자리에 등록된
      // 채널이 있을 때만 발동(channel-links.js LINKS 에서 뺀 자리는 자동으로 아무 일도 안 함).
      onLongPress: (id) => {
        if (!document.getElementById('game-screen').classList.contains('is-start')) return;
        const link = MG.ChannelLinks && MG.ChannelLinks.LINKS[id];
        if (!link) return;
        MG.Ads.interstitial(I18N.t('mole.channel.hint')).then(() => { window.open(link.url, '_blank'); });
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
    document.getElementById('btn-pause').addEventListener('click', togglePause);
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
      run.lives = 0;
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
      localStorage.setItem('mole.hearts', String(n));
      localStorage.setItem('mole.heartsAt', String(Date.now()));
      if (moreMenu) moreMenu.refresh();
    };
    window.__debugSetCoins = function (n) {
      localStorage.setItem('mole.coins', String(n));
      if (moreMenu) moreMenu.refresh();
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
      onClose: () => screenNav.back()
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

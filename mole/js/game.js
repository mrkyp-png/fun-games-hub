(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const START_LIVES = 3;      // 스펙 §11
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const ROUND_SECONDS = 30;   // 라운드마다 30초 점수 어택
  const FINAL_ROUND = 10;     // 라운드 1~10
  // 처치 순간 게임 시간을 잠깐 멈춘다 (히트스톱) — 타격감. 콤보가 쌓일수록 조금 더 길게.
  const HITSTOP_BASE_MS = 90;
  const HITSTOP_MAX_MS = 150;

  // 라운드별 난이도는 MG.LEVELS 표(동시 두더지 1→5, 유지시간 2.5→1.0s, 방해물 증가)를 쓴다.
  // 16칸 클리어 개념은 없다 — 두더지는 16칸 아무 데나 랜덤 반복 등장, 60초가 끝나면 다음 라운드.

  // 재접/홈복귀 시 두더지 오빠 한 줄 — 짧은 문구 풀에서 랜덤 (첫 방문만 전체 인트로).
  const RETURN_PHRASES = [
    '왔어?', '왜 이제 와', '빨리 와', '늦었네', '기다렸잖아', '왔구나 ㅎㅎ', '또 왔네', '오늘도 오셨네',
    '딱 맞춰 왔다', '잠깐 시간 돼?', '5분만 하자', '한 판만', '딱 한 판만 진짜', '겜 ㄱ?',
    '보고싶었어', '나 안 보고싶었어?', '답장 좀 하지', '왜 안 읽어', '어제 왜 씹었어', '나 삐졌어',
    '화 안 났어', '요즘 뭐 하고 지내', '연락 좀 하자', '요즘 바빠?', '나만 안 바쁜가 봐', '오늘 하루 어땠어',
    '힘든 일 있었어?', '얘기 들어줄게', '오빠가 있잖아', '옆에 있어 줄게', '무슨 일 있으면 말해',
    '준비됐어?', '손 풀었어?', '컨디션 어때', '오늘 각 나온다', '느낌 좋아', '오늘은 신기록이야',
    '넌 할 수 있어', '오빠가 믿는다', '가보자고', '두더지 떨고 있어', '걔네 오늘 각오해', '살살 안 봐줄 거지?',
    '다 때려잡자', '몇 마리 목표야?', '최고 기록 깨자', '오늘 미친 척 하자', '집중 모드 ON',
    '자신 있어?', '지난번 그 점수 뭐야', '오늘은 좀 하냐', '또 질 거야?', '내기할까', '지면 뭐 해줄 거야',
    '겁먹었어?', '손 떨고 있네', '긴장했지', '이번엔 다르다며', '말만 하지 말고',
    '밥 먹었어?', '잠은 잤어?', '커피 마셨어?', '날씨 좋더라', '주말이다 ㅎㅎ', '월요일 화이팅',
    '오늘 금요일이야', '비 온대 우산 챙겨', '환절기 감기 조심', '물 좀 마셔',
    '회사지 지금?', '팀장 뒤에 있어?', '걸리지 마', '소리 껐지?', '화면 밝기 낮춰', '통화하는 척 해',
    '이거 업무 전화야', '완벽한 위장이지', '아무도 몰라 이게 게임인지', '상사 오면 통화 버튼',
    '근무 시간엔 조용히', '딴짓 아니야 이거',
    '두더지들이 파업했대', '오늘 운세 대박이래', '나 꿈에 나왔어?', '로또 번호 불러줄까', '두더지 왕이 화났어',
    '우리 전생에 봤나?', 'MBTI 뭐야 너', '갑자기 배고프다', '두더지가 안부 전해달래', '오늘 밤에 별똥별 온대'
  ];
  const HIPPO_REPLIES = ['ㅇㅇ', 'ㄱㄱ', '감', '...', '해', 'ㅇㅋ', '뭐', '왜', 'ㅎ', '바빠', '조용히 해', '알겠어'];

  // 다시하기(방금 점수 남김) — 두더지는 항상 축하 이모티콘(말풍선 없이 큼) + 폭죽, 그리고 따로 글자.
  // 하마는 말풍선 없는 큰 이모티콘 랜덤 (두더지 축하하는데 하마는 😡 → 개그).
  const CELEBRATE_EMOJI = '🎉';
  const RETRY_TEXT = { best: '미쳤다 신기록!', clear: '잘했어!', bad: 'ㅋㅋ 그럴 수 있어' };
  const HIPPO_MOODS = ['❓', '❤️', '😡', '😂', '😐', '🙄', '✋', '🔥', '😅', '👍'];

  let state = null;   // 현재 라운드 상태 (시작 화면일 땐 null)
  // 10라운드를 통틀어 유지되는 것: 콤보·점수(1라운드부터 누적)와 목숨.
  let run = null;     // { combo: ComboScore, lives, comboMilestone }
  const COMBO_LIFE_STEP = 100; // 콤보가 이 배수를 넘길 때마다 목숨 +1
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
  let shop = null, daily = null, scoreScreen = null, settingsScreen = null, costumeScreen = null;
  let currentDiff = 'easy';        // 현재 판 난이도
  let activeFaceUrl = null;        // 활성 사람두더지 얼굴 원본 크롭 objectURL (합성 재료)
  let activeFaceMap = null;        // 포즈별 "얼굴+몸체 합성 완료" 이미지 맵 (게임에 넘김)

  const DIFFS = ['easy', 'mid', 'legend'];
  function currentDifficulty() {
    const d = localStorage.getItem('mole.difficulty');
    return DIFFS.indexOf(d) > -1 ? d : 'easy';
  }
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
  let disarmStartButton = () => {};
  function wireStartButton() {
    const btn = document.querySelector('#lane-button-bar .lane-button--call');
    if (!btn) return;
    const isHome = () => document.getElementById('game-screen').classList.contains('is-start');
    let holdT = null, longFired = false;

    function setArmed(on) {
      armState.armed = on;
      clearTimeout(armState.revertT);
      btn.classList.toggle('lane-button--armed', on);
      const lbl = btn.querySelector('.lane-lbl');
      if (lbl) lbl.textContent = I18N.t(on ? 'mole.start.armLabel' : 'mole.start.btn');
      if (on) armState.revertT = setTimeout(() => setArmed(false), 3200);
    }
    disarmStartButton = () => setArmed(false);

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
    const bye = document.createElement('div');
    bye.className = 'bye-screen';
    bye.textContent = I18N.t('mole.quit.bye');
    document.body.appendChild(bye);
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

  // 더보기 메뉴 열기/닫기.
  function openMore(sub) {
    document.getElementById('more-menu').hidden = false;
    if (moreMenu) moreMenu.refresh();
    if (sub) {
      screenNav.show(sub);
      if (sub === 'face-locker' && faceLocker) faceLocker.show();
      if (sub === 'shop-screen' && shop) shop.show();
      if (sub === 'daily-screen' && daily) daily.show();
      if (sub === 'score-screen' && scoreScreen) scoreScreen.show();
      if (sub === 'settings-screen' && settingsScreen) settingsScreen.show();
    }
  }
  function closeMore() {
    screenNav.reset();
    document.getElementById('more-menu').hidden = true;
    // 진행 중이던 게임이 있으면 그대로, 없으면 대화 화면.
    if (!state) showStartScreen();
  }

  // ---------- 시작 화면 ----------
  function showStartScreen(opts) {
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
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('round-intro-overlay').hidden = true;
    document.getElementById('board-start').hidden = false;
    document.getElementById('game-screen').classList.add('is-start');
    disarmStartButton(); // 초록 버튼이 빨간 대기 상태로 남아있으면 초기화
    if (screenNav) screenNav.reset();
    const mm = document.getElementById('more-menu');
    if (mm) mm.hidden = true;

    // 최고 스코어 = 위에서 내려오는 문자 알림 (현재 난이도 기준). 기록 없으면 숨김.
    const best = bestFor(currentDifficulty());
    const sms = document.getElementById('start-best');
    sms.querySelector('.chat-sms-txt').textContent =
      best > 0 ? I18N.t('mole.start.best', { n: best.toLocaleString() }) : '';
    sms.classList.toggle('is-empty', best <= 0);
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
  // "광고 보고 생명/코인" 줄 — 시작은 다이얼러 초록 버튼이 담당하므로 대화엔 이것만.
  function adRow() {
    const row = document.createElement('div');
    row.className = 'chat-row chat-ad-row';
    row.innerHTML =
      '<button type="button" class="chat-ad-btn" data-ad="life"><b>▶</b>' +
      '<span>' + I18N.t('mole.start.adLife') + '</span></button>' +
      '<button type="button" class="chat-ad-btn" data-ad="coin"><b>▶</b>' +
      '<span>' + I18N.t('mole.shop.watchCoin') + '</span></button>';
    wireChatAds(row);
    return row;
  }

  function buildReturnChat(mode) {
    const el = document.getElementById('chat-return');
    el.innerHTML = '';
    if (mode === 'retry') {
      const kind = localStorage.getItem('mole.lastWasBest') === '1' ? 'best'
        : localStorage.getItem('mole.lastWasBad') === '1' ? 'bad' : 'clear';
      el.appendChild(emojiRow('them', CELEBRATE_EMOJI, true));        // 축하 이모티콘(큼) + 폭죽
      el.appendChild(bubbleRow('them', RETRY_TEXT[kind]));            // 글자는 따로
      el.appendChild(emojiRow('me', pick(HIPPO_MOODS), false));       // 하마 이모티콘(큼)
    } else {
      el.appendChild(bubbleRow('them', pick(RETURN_PHRASES)));
      el.appendChild(bubbleRow('me', pick(HIPPO_REPLIES)));
    }
    el.appendChild(adRow());
  }

  // 대화 안 "광고 보고 생명/코인" 버튼 연결 (scope = 대화 줄 또는 document).
  function wireChatAds(scope) {
    const life = scope.querySelector('[data-ad="life"]');
    const coin = scope.querySelector('[data-ad="coin"]');
    if (life && !life.dataset.wired) {
      life.dataset.wired = '1';
      life.addEventListener('click', () => MG.Ads.rewarded().then((ok) => {
        if (!ok) return;
        adBonusLives += 1;
        life.disabled = true;
        life.querySelector('span').textContent = I18N.t('mole.start.adLifeGot');
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
      run = { combo: MG.ComboScore.create(), lives: START_LIVES + adBonusLives, comboMilestone: 0 };
      adBonusLives = 0; // 광고 보너스 목숨은 한 판만
    }
    if (rafId) cancelAnimationFrame(rafId);
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();

    const levelData = MG.LEVELS[roundNum - 1];

    document.getElementById('board-start').hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('round-done-overlay').hidden = true;
    document.getElementById('game-screen').classList.remove('is-start');
    if (screenNav) screenNav.reset();
    document.getElementById('more-menu').hidden = true;
    syncBgm(true); // 시작 버튼(사용자 제스처) 이후 — 설정에서 켜져 있으면 재생
    MG.HitFx.warmup(); // 오디오 컨텍스트 + 타격음 파일 프리로드 (카운트다운 동안)

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + roundNum + '-' + Date.now())) };
    const { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: GRID_SIZE });

    const config = {
      maxConcurrentMoles: levelData.maxConcurrentMoles,
      maxConcurrentAnimals: levelData.maxConcurrentAnimals,
      maxConcurrentBombs: levelData.maxConcurrentBombs,
      popDuration: levelData.moleDuration,
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: currentDiff === 'legend' // 하수·고수는 두더지만, 전설만 동물
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

    const laneHammer = MG.LaneHammer.create({
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
        setTimeout(() => {
          if (myGen !== sessionGen) return;
          overlay.hidden = true;
          onDone();
        }, 450);
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
    if (!state || state.ended || state.introActive || state.paused) return;
    const results = state.scheduler.resolveRegion(regionId);
    const sp = state.spawnPoints[regionId];

    const primary = results[0] || null;
    const targetX = primary ? primary.xFrac : sp.x;
    const targetY = primary ? primary.yFrac : sp.y;

    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, targetY, results));
  }

  function onHammerImpact(hitXFrac, hitYFrac, results) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    let moleHits = 0;

    results.forEach((r) => {
      if (r.type === 'mole') {
        if (r.done) {
          run.combo.onMoleHit();   // 스펙 §12 — 마리당 1콤보
          checkComboLifeBonus();   // 콤보 100단위 넘기면 목숨 +1
          MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          MG.HitFx.moleTap(board, r.xFrac, r.yFrac);
        }
      } else if (r.type === 'animal') {
        run.lives -= 1;                 // 스펙 §8/§11 — 목숨은 10라운드 통틀어 3개
        run.combo.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
        flashHud('hud-hearts');
      } else if (r.type === 'bomb') {
        state.timeRemaining = Math.max(0, state.timeRemaining - 3); // 스펙 §8
        run.combo.onObstacleHit();
        MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'bomb');
        flashHud('hud-ticker'); // 시간 −3 — 티커 전체를 잠깐 번쩍
      }
    });

    if (results.length === 0) {
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
    const myGen = sessionGen;
    const finishedRound = state.round;
    if (rafId) cancelAnimationFrame(rafId);
    sharedPopElements.clear();
    resetHot();

    if (finishedRound >= FINAL_ROUND) {
      finishFromRound('done');
      return;
    }

    // 라운드 사이 짧은 안내 후 자동으로 다음 라운드.
    document.getElementById('round-done-title').textContent =
      I18N.t('mole.roundDone', { n: finishedRound });
    document.getElementById('round-done-total').textContent =
      I18N.t('mole.cumulative', { n: run.combo.score.toLocaleString() });
    document.getElementById('round-done-overlay').hidden = false;

    setTimeout(() => {
      if (myGen !== sessionGen) return; // 그 사이 나가버림
      document.getElementById('round-done-overlay').hidden = true;
      startRound(finishedRound + 1); // fresh 아님 → 누적 유지
    }, 1400);
  }

  // 목숨 소진(라운드 도중) — 지금까지 친 점수까지 반영하고 최종 결과.
  function finish(reason) {
    if (!state || state.ended) return;
    state.ended = true;
    if (rafId) cancelAnimationFrame(rafId);
    sharedPopElements.clear();
    resetHot();
    finishFromRound(reason);
  }

  // 최종 결과 화면 (10라운드 완주 or 목숨 소진).
  function finishFromRound(reason) {
    const total = run.combo.score;
    const diff = currentDiff;
    const best = bestFor(diff);
    const isNewBest = total > best;
    if (isNewBest) saveBestFor(diff, total);

    const coins = Math.floor(total / 200);
    if (coins > 0) MG.Economy.addCoins(coins);

    // 재방문 인사용 + 기록 보관 (100판 이상도 문제없음, 개당 수십 바이트).
    try {
      localStorage.setItem('mole.lastPlayed', String(Date.now()));
      localStorage.setItem('mole.lastWasBest', isNewBest ? '1' : '0');
      localStorage.setItem('mole.lastWasBad', reason === 'lives' ? '1' : '0');
      const hist = JSON.parse(localStorage.getItem('mole.history') || '[]');
      hist.push({ t: Date.now(), score: total, best: isNewBest, reason: reason, diff: diff });
      if (hist.length > 500) hist.splice(0, hist.length - 500); // 안전 상한
      localStorage.setItem('mole.history', JSON.stringify(hist));
    } catch (e) { /* localStorage 불가 환경 무시 */ }

    document.getElementById('gameover-reason').textContent =
      I18N.t(reason === 'lives' ? 'mole.result.lives' : 'mole.result.allClear');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.score', { n: total.toLocaleString() });
    let bestLine = isNewBest
      ? I18N.t('mole.result.newBest', { n: total.toLocaleString() })
      : I18N.t('mole.result.best', { n: Math.max(best, total).toLocaleString() });
    if (coins > 0) bestLine += '   +' + coins + '🪙';
    document.getElementById('gameover-best').textContent = bestLine;
    document.getElementById('gameover-overlay').hidden = false;
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
      onCell: handleCell
    });
    wireStartButton(); // 다이얼러 초록 버튼: 홈에서 탭=시작 / 꾹=종료 대기

    migrateBest();
    wireMoreMenu();

    // 첫 화면 = 두더지 오빠 대화 (그대로). 사람두더지는 더보기 메뉴에서 원할 때 만든다.
    showStartScreen();

    // 첫 방문 대화의 "광고 보고 생명/코인" 버튼. 재방문 대화 버튼은 adRow() 가 직접 연결한다.
    wireChatAds(document);
    // 대화 공개 중 아무 데나 탭하면 나머지 메시지 즉시 표시 (건너뛰기)
    document.getElementById('board-start').addEventListener('click', (e) => {
      if (e.target.closest('.chat-ad-btn')) return;
      const thread = document.querySelector('#board-start .chat-thread:not([hidden])');
      const pending = thread && thread.querySelectorAll('.chat-row.chat-pending');
      if (!pending || !pending.length) return;
      pending.forEach((r) => { r.classList.remove('chat-pending'); r.classList.add('chat-appear'); });
      thread.scrollTop = thread.scrollHeight;
    });
    // 좌상단 ⊞ = 더보기 메뉴 열기 (대화 화면에서든 플레이 중에든).
    document.getElementById('btn-back-to-hub').addEventListener('click', () => openMore());
    document.getElementById('gameover-retry-btn').addEventListener('click', () => showStartScreen({ retry: true }));
    document.getElementById('gameover-select-btn').addEventListener('click', () => showStartScreen());
    document.getElementById('btn-pause').addEventListener('click', togglePause);

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = (diff) => {
      loadActiveFace().then(() => {
        currentDiff = DIFFS.indexOf(diff) > -1 ? diff : 'easy';
        localStorage.setItem('mole.difficulty', currentDiff);
        applyDiffClass(currentDiff);
        startRound(1, { fresh: true });
      });
    };
    window.__debugStartRound = (n) => startRound(n, { fresh: true });
    window.__debugEndRound = function () {
      if (state && !state.ended) { state.timeRemaining = 0; roundComplete(); }
    };
    window.__debugForceGameOver = function () {
      if (!state || !run) return;
      run.lives = 0;
      finish('lives');
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
      screens: ['face-maker', 'costume-screen', 'face-locker', 'shop-screen', 'daily-screen', 'score-screen', 'settings-screen', 'help-screen', 'privacy-screen']
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
      onClose: () => screenNav.back()
    });
    ['help', 'privacy'].forEach((k) => {
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
        start: () => {
          // 더보기 메뉴의 "시작" (통화 버튼 자리) → 더보기 닫고 대화 화면으로.
          // (대화 화면 시작 버튼을 눌러야 그 난이도로 게임이 시작된다.)
          screenNav.reset();
          document.getElementById('more-menu').hidden = true;
          showStartScreen();
        },
        shop: () => { screenNav.show('shop-screen'); shop.show(); },
        daily: () => { screenNav.show('daily-screen'); daily.show(); },
        score: () => { screenNav.show('score-screen'); scoreScreen.show(); },
        help: () => screenNav.show('help-screen'),
        privacy: () => screenNav.show('privacy-screen'),
        contact: () => { window.location.href = 'mailto:mrkyp@hanmail.net'; },
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

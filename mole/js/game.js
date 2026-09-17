(function () {
  'use strict';

  const MG = window.MoleGame;
  const I18N = window.FGH.I18N;
  const GRID_SIZE = 4;        // 4x4 = 16칸 고정 격자
  const CANNON_HOLE = 15;     // 캐논·특수망치 장착 시 없애는 구멍 (우하단 = row3·col3). 15구멍 + 스킬존. 뿅망치는 16구멍.
  const ALIPUNCH_HOLES = [12, 15]; // 알리 펀치 = 좌하단(12)·우하단(15) 삭제, 그 자리에 글러브. 14구멍.
  const ALIPUNCH_INVINCIBLE_CHANCE = 0.2;   // 무적 발동 확률 (기획서 §7)
  const ALIPUNCH_INVINCIBLE_MS = 5000;      // 무적 지속시간
  const ROUND1_SECONDS = 60;      // 라운드1 (구 챕터1+2+3 병합, 3구간 연속)
  const ROUND_SECONDS_LONG = 100; // 라운드2~8 실제 플레이 시간(사용자 지정, 원래 100초를 140초로 잘못 구현했던 것 수정)
  // 난이도 10단계 키프레임은 원래 140초짜리 커브(§4) — 실플레이 100초를 앞 40초는 건너뛰고
  // 그 뒤 100초(40~140초 구간)만 쓴다(사용자: "너무 쉬워서 앞부분 40초는 빼도 될듯" → "총 100초
  // 유지, 난이도 커브만 앞당김"). 라운드 t=0 이 커브의 40초 지점에 대응.
  const DIFFICULTY_CURVE_SECONDS = 140;
  const DIFFICULTY_CURVE_OFFSET = 40;
  function roundSeconds() { return currentChapter() === 1 ? ROUND1_SECONDS : ROUND_SECONDS_LONG; }
  // 챕터→라운드 재구조화(2026-09-17): 라운드1(구 챕터1~3 병합) = 9홀(3x3), 라운드2~8(구 챕터4~10) = 16홀(4x4).
  function isSmallBoardChapter() { return currentChapter() === 1; }
  function roundGridSize() { return isSmallBoardChapter() ? 3 : GRID_SIZE; }
  // 챕터별 보드 배경 — 4~6=가을, 7~9=겨울(사용자 지정). 나머지는 기본(board-scene.jpg).
  function applyBoardTheme() {
    const el = document.getElementById('mole-board');
    if (!el) return;
    el.classList.remove('mole-board--autumn', 'mole-board--winter');
    const ch = currentChapter();
    if (ch >= 2 && ch <= 4) el.classList.add('mole-board--autumn');
    else if (ch >= 5 && ch <= 7) el.classList.add('mole-board--winter');
  }
  // 챕터별 날씨(사용자 지정: 챕터6 라운드1~10=비, 챕터9 라운드1~10=눈) + 챕터6은 흐린 날씨라
  // 하늘 쪽 구름도 추가(사용자: "흐린날씨에는 구름이 많고"). 매 라운드 시작마다 호출(멱등).
  let weatherKind = null; // 마지막으로 채운 상태 — 같으면 재생성 안 함(깜빡임 방지)
  function applyWeather() {
    const layer = document.getElementById('mole-weather');
    const sky = document.getElementById('mole-sky');
    const ch = currentChapter();
    const kind = ch === 4 ? 'rain' : (ch === 7 ? 'snow' : null);
    if (kind !== weatherKind) {
      weatherKind = kind;
      if (layer) {
        layer.className = kind ? 'mole-board-layer is-' + kind : 'mole-board-layer';
        layer.innerHTML = '';
        if (kind) {
          const n = kind === 'rain' ? 70 : 40; // 실기기 확인 후 조정 예정(사용자 지정)
          for (let i = 0; i < n; i++) {
            const p = document.createElement('i');
            p.style.left = (Math.random() * 100) + '%';
            if (kind === 'rain') {
              p.style.animationDelay = (Math.random() * 1.6) + 's';
              p.style.animationDuration = (0.55 + Math.random() * 0.3) + 's';
            } else {
              p.style.animationDelay = (Math.random() * 4) + 's';
              p.style.animationDuration = (3 + Math.random() * 2.5) + 's';
              p.style.setProperty('--sway', (Math.random() * 30 - 15).toFixed(0) + 'px');
              const sz = (2 + Math.random() * 3).toFixed(1) + 'px';
              p.style.width = sz; p.style.height = sz;
              p.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
            }
            layer.appendChild(p);
          }
        }
      }
      if (sky) {
        sky.querySelectorAll('.mole-cloud--extra').forEach((c) => c.remove());
        if (ch === 4) {
          const EXTRA = 8;
          for (let i = 0; i < EXTRA; i++) {
            const img = 1 + Math.floor(Math.random() * 2);
            const c = document.createElement('span');
            c.className = 'mole-cloud mole-cloud--extra';
            c.style.backgroundImage = "url('assets/cloud" + img + ".png')";
            c.style.aspectRatio = img === 1 ? '122 / 64' : '138 / 62';
            c.style.width = (6 + Math.random() * 13).toFixed(1) + '%';
            c.style.top = (1 + Math.random() * 18).toFixed(0) + '%'; // 하늘 부분에 집중(사용자 지정)
            c.style.opacity = (0.38 + Math.random() * 0.42).toFixed(2);
            if (Math.random() < 0.5) c.style.transform = 'scaleX(-1)';
            const dur = 80 + Math.random() * 220;
            const delay = -(Math.random() * dur);
            c.style.animation = 'mole-cloud-drift ' + dur.toFixed(0) + 's linear ' + delay.toFixed(0) + 's infinite';
            sky.appendChild(c);
          }
        }
      }
    }
  }
  // 처치 순간 게임 시간을 잠깐 멈춘다 (히트스톱) — 타격감. 콤보가 쌓일수록 조금 더 길게.
  const HITSTOP_BASE_MS = 90;
  const HITSTOP_MAX_MS = 150;

  // 라운드별 난이도는 levels.js 의 키프레임 표를 MG.interpolate() 로 라운드 전체 시간에 걸쳐
  // 연속 보간해서 쓴다(챕터→라운드 재구조화, 2026-09-17). 16칸 클리어 개념은 없다 — 두더지는
  // 16칸 아무 데나 랜덤 반복 등장, 라운드 시간(60s/140s)이 끝나면 결과 화면으로.

  let state = null;   // 현재 라운드 상태 (시작 화면일 땐 null)
  // 10라운드를 통틀어 유지되는 것: 콤보·점수(1라운드부터 누적).
  // 목숨(run.lives)은 허브 공유 생명(MG.Economy) 그 자체다 — 동물 -1 / 콤보 100마다 +1 이
  // 즉시 공유 풀에 반영되고, 홈·더보기·게임 화면이 항상 같은 수를 보여준다. setRunLives() 로만 바꾼다.
  let run = null;     // { combo: ComboScore, lives, comboMilestone }
  const COMBO_LIFE_STEP = 100; // 콤보가 이 배수를 넘길 때마다 목숨 보상 판정
  const COMBO_LIFE_BONUS = { easy: 0, mid: 1, legend: 2 }; // 라이트 ON/DIM/OFF 별 목숨 보상 개수
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

  // 홈 화면 다이얼패드 1·2·4번(하트·코인·스코어) 카운터 + 상단 티커 최고점수 — 공유 풀에서
  // 다시 읽어 그린다. 광고/콤보/동물 등으로 값이 바뀔 때마다 호출해 홈·더보기·게임이 같은 수를 보이게 한다.
  function refreshBoardStats() {
    const best = bestFor(currentLight());
    if (sharedLaneControls) {
      sharedLaneControls.setHudStat('hearts', MG.Economy.getHearts());
      sharedLaneControls.setHudStat('coins', MG.Economy.getCoins().toLocaleString());
    }
    document.querySelectorAll('[data-hud-score]').forEach((el) => {
      el.textContent = I18N.t('mole.addr.best', { n: best.toLocaleString() });
    });
    const nick = localStorage.getItem('mole.nick') || '두더지';
    document.querySelectorAll('[data-hud-nick]').forEach((el) => { el.textContent = nick; });
    refreshHubAvatar();
    if (moreMenu) {
      const mm = document.getElementById('more-menu');
      if (mm && !mm.hidden) moreMenu.refresh();
    }
  }

  // 홈 화면 게임판 자리(#board-start 뒤) — 원본 3x3 콜라주 구도를 유지한 9칸 그리드 페이지가
  // 3장(1~9/10~18/19~27) 있고, 20~30초 간격으로 다음 페이지로 전환(사용자 지정: "한장에 9개가
  // 다들어가있는 이미지 그대로 사용"). 페이지 전환 중엔 각 칸이 재생 중인 홈 BGM 비트에 맞춰
  // 개별적으로 사라졌다/나타났다·회전·확대축소(popTile → pulseGridCells 로 교체).
  // is-start 아닐 땐 board-start 자체가 가려지므로 안 보임 — 타이머·루프는 그냥 항상 돌아도 무해.
  function initHomeShowcase() {
    const pages = Array.prototype.slice.call(document.querySelectorAll('.hg-page'));
    if (!pages.length) return;
    let idx = 0;
    (function nextPage() {
      setTimeout(() => {
        pages[idx].classList.remove('is-active');
        idx = (idx + 1) % pages.length;
        pages[idx].classList.add('is-active');
        nextPage();
      }, 20000 + Math.random() * 10000); // 20~30초
    })();
    initHomeShowcaseBeat();
  }

  // 재생 중인 홈 BGM(bgm-a/bgm-b 핑퐁) 을 Web Audio AnalyserNode 로 실시간 분석해 저음 에너지가
  // 평균 대비 튈 때("비트")마다 작은 타일 하나를 랜덤 이미지로 팝 전환. 오디오 재생 자체(스피커
  // 출력)는 analyser 를 거쳐 그대로 destination 에 연결해 끊기지 않는다.
  let bgmAnalysers = null;
  let bgmAudioCtx = null; // 자동재생 정책으로 suspended 상태일 수 있어 제스처마다 resume 재시도
  function ensureBgmAnalysers() {
    if (bgmAnalysers || !bgmEls || !bgmEls[0] || !bgmEls[1]) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const actx = new Ctx();
      bgmAudioCtx = actx;
      bgmAnalysers = bgmEls.map((el) => {
        const src = actx.createMediaElementSource(el);
        const an = actx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        an.connect(actx.destination); // 필수 — 안 붙이면 이 엘리먼트 소리가 스피커로 안 나감(버그 수정)
        return { analyser: an, buf: new Uint8Array(an.frequencyBinCount) };
      });
      if (actx.state === 'suspended') actx.resume().catch(() => {});
    } catch (e) { bgmAnalysers = null; bgmAudioCtx = null; } // 실패해도 큰 이미지 캐러셀은 그대로 동작
  }
  function resumeBgmAudioCtx() {
    if (bgmAudioCtx && bgmAudioCtx.state === 'suspended') bgmAudioCtx.resume().catch(() => {});
  }
  // 스펙트럴 플럭스 온셋 감지 — "리듬에 안 맞고 딱딱 끊긴다"는 사용자 피드백으로 교체.
  // 이전 방식(광대역 에너지가 자기 평균보다 큰가)은 곡의 전체 음량 굴곡만 따라가서 실제
  // 음표 타격(어택) 시점과 안 맞았고, 1.1초 고정 폴백이 음악과 무관하게 계속 끼어들어
  // 메트로놈처럼 딱딱해 보였음. 스펙트럴 플럭스는 "직전 프레임 대비 늘어난 주파수 성분의 합"
  // 이라 타악기·신스 어택처럼 순간적으로 튀는 지점(=실제 박자)에서만 뾰족하게 반응한다.
  let showcasePrevSpectrum = null;
  function initHomeShowcaseBeat() {
    function tick() {
      requestAnimationFrame(tick);
      if (!bgmAnalysers) { ensureBgmAnalysers(); return; }
      // bgm-a/b 핑퐁 중 실제 소리가 나는 채널만 채택 — 무음 채널을 같이 더하면 그 채널의
      // 0값이 매 프레임 "감소"로 잡혀 플럭스 계산에 노이즈가 낌.
      let buf = null;
      bgmAnalysers.forEach((a) => {
        a.analyser.getByteFrequencyData(a.buf);
        let sum = 0;
        for (let i = 0; i < a.buf.length; i++) sum += a.buf[i];
        if (sum > 0) buf = a.buf;
      });
      if (!buf) return;
      if (!showcasePrevSpectrum) { showcasePrevSpectrum = new Uint8Array(buf); return; }
      let flux = 0;
      const n = Math.min(48, buf.length); // 저음~중음 구간(타악기·베이스 어택 대부분 여기)
      for (let i = 0; i < n; i++) {
        const d = buf[i] - showcasePrevSpectrum[i];
        if (d > 0) flux += d;
        showcasePrevSpectrum[i] = buf[i];
      }
      // 평균을 천천히 반응하게 해야 "평소 수준"을 대표함 — 너무 빨리 쫓아가면(예: 0.9/0.1)
      // 평균이 순간값을 계속 따라잡아 거의 매 프레임이 "평균보다 큼"을 통과해버려 최소
      // 간격(220ms)마다 계속 터지는, 사실상 메트로놈과 다를 바 없는 결과가 났었음(실측 확인 —
      // 간격이 260~280ms로 지나치게 균일).
      showcaseAvgEnergy = showcaseAvgEnergy * 0.96 + flux * 0.04;
      const now = performance.now();
      const beatByAudio = flux > showcaseAvgEnergy * 2.2 && flux > 25 && now - showcaseLastBeat > 320;
      // 곡이 한동안 너무 잠잠해도 완전히 멈춰 보이진 않게 드문 안전망만.
      const beatByFallback = now - showcaseLastBeat > 1800;
      if (beatByAudio || beatByFallback) {
        showcaseLastBeat = now;
        pulseGridCells();
        pulseDialPad(); // 다이얼패드 버튼들도 비트에 맞춰 커졌다 움직임(사용자 지정 — "축제 분위기")
      }
    }
    requestAnimationFrame(tick);
  }
  let showcaseAvgEnergy = 0;
  let showcaseLastBeat = 0;
  // 현재 활성 페이지의 9칸 중 여러 개를 골라 비트마다 펄스(사용자 지정 — 화려한 변형 13종은
  // "너무 산만함", 히트 플래시는 "눈이 너무 아픔" 피드백으로 빼고, 그라디언트 테두리도 "펄스
  // 효과만" 요청으로 마저 빼서 눌림 스케일 하나만 유지).
  function pulseGridCells() {
    const page = document.querySelector('.hg-page.is-active');
    if (!page) return;
    const cells = page.querySelectorAll('.hg-cell');
    if (!cells.length) return;
    const n = 2 + ((Math.random() * 3) | 0); // 2~4개, 동시에 움직여도 됨(사용자 지정)
    for (let i = 0; i < n; i++) {
      const cell = cells[(Math.random() * cells.length) | 0];
      const img = cell.querySelector('img');
      if (!img) continue;
      cell.classList.remove('is-press');
      img.classList.remove('is-press');
      void img.offsetWidth;
      cell.classList.add('is-press');
      img.classList.add('is-press');
    }
  }

  // 다이얼패드 버튼 전체가 비트마다 살짝 커지고 흔들리는 펄스(사용자 지정) — 홈 화면에서만
  // (실제 라운드 플레이 중엔 타격 판정용 버튼이라 안 건드림).
  // 항상 같이 트는 2종(사용자 지정 — 눌림 스케일 + 히트 플래시. 그라디언트 테두리는 버튼보드에는
  // 적용 안 함, 사용자 지정) + 랜덤으로 하나 더 섞는 강조 변형(기존 팝/플래시/셰이크). 클래스
  // 여러 개로는 animation 단축 속성이 충돌해서(위 style.css 주석 참고) JS 에서 직접 콤마로 이어
  // 인라인 지정.
  const LANE_ALWAYS = ['lane-press-scale 0.3s ease', 'lane-hitflash-btn 0.28s ease'];
  // 'textgrow' 는 인라인 애니메이션이 아니라 버튼 안의 숫자/자막 span 에 붙는 클래스라 따로 처리
  // (좌우 흔들림 대체, 사용자 지정).
  const LANE_VARIANTS = ['lane-beat-pulse 0.4s ease-out', 'lane-attnflash 0.5s ease', 'textgrow'];
  function pulseDialPad() {
    if (!document.getElementById('game-screen').classList.contains('is-start')) return;
    const bar = document.getElementById('lane-button-bar');
    if (!bar) return;
    // 전체가 한 번에 말고 버튼 몇 개만 각자 독립적으로 팝(사용자 지정). 시작(통화) 버튼은 제외
    // (사용자 지정 — "시작 버튼은 기존 효과만", 골든 링 쉬머는 그대로 유지).
    const btns = Array.prototype.filter.call(
      bar.querySelectorAll('.lane-button'),
      (b) => !b.classList.contains('lane-button--call')
    );
    if (!btns.length) return;
    const n = 2 + ((Math.random() * 2) | 0); // 2~3개
    for (let i = 0; i < n; i++) {
      const b = btns[(Math.random() * btns.length) | 0];
      const variant = LANE_VARIANTS[(Math.random() * LANE_VARIANTS.length) | 0];
      const isTextgrow = variant === 'textgrow';
      b.classList.remove('beat-textgrow');
      b.style.animation = 'none';
      void b.offsetWidth;
      if (isTextgrow) b.classList.add('beat-textgrow');
      b.style.animation = isTextgrow ? LANE_ALWAYS.join(', ') : LANE_ALWAYS.concat(variant).join(', ');
    }
  }

  // 홈 화면 좌상단 ⊞ 자리 — 프로필 사진(사용자 지정, 더보기의 mm-avatar와 같은 소스).
  function refreshHubAvatar() {
    const av = document.getElementById('hub-avatar');
    if (!av) return;
    const pic = localStorage.getItem('mole.profilePic');
    av.style.backgroundImage = pic ? 'url("' + pic + '")' : 'url("assets/moles/mole1.png")';
  }
  // 프로필 사진 변경 — 홈 화면 좌상단 아바타 탭(사용자 지정, 더보기의 editAvatar와 동일 로직).
  function editProfileAvatar() {
    screenNav.show('face-maker');
    faceMaker.open({
      profile: true,
      onDone: (dataUrl) => {
        try { localStorage.setItem('mole.profilePic', dataUrl); } catch (e) { alert(I18N.t('mole.fm.priv')); }
        screenNav.back();
        refreshHubAvatar();
        if (moreMenu) moreMenu.refresh();
      }
    });
  }

  // 라이트 ON/DIM/OFF — 더보기 알약(mm-pill)과 다이얼패드 ✱("두더지팡") 팝업(light-popup)이
  // 공유하는 단일 로직. 뿅망치는 라이트 ON 만 사용 가능(사용자 지정) — 양쪽 다 한 번 더 방어.
  function setDifficulty(d) {
    const w = localStorage.getItem('mole.weapon');
    const paidWeapon = w === 'cannon' || w === 'goldhammer' || w === 'alipunch';
    if (!paidWeapon && d !== 'easy') return;
    localStorage.setItem('mole.difficulty', d); // "설정만" — 선택 표시만 바꾸고 화면 이동 없음
    if (moreMenu) moreMenu.refresh();
    refreshLightPopup();
  }
  function refreshLightPopup() {
    const el = document.getElementById('light-popup');
    if (!el) return;
    const diff = localStorage.getItem('mole.difficulty') || 'easy';
    const w = localStorage.getItem('mole.weapon');
    const hammerOnly = w !== 'cannon' && w !== 'goldhammer' && w !== 'alipunch';
    el.querySelectorAll('[data-lp-diff]').forEach((b) => {
      const d = b.getAttribute('data-lp-diff');
      b.classList.toggle('mm-pill--on', d === diff);
      if (d === 'mid' || d === 'legend') b.classList.toggle('mm-pill--locked', hammerOnly);
    });
  }
  // 2026-09-18(사용자 지정): 예전엔 독립 팝업(openLightPopup/closeLightPopup, 화면 전체 덮는
  // 카드)이었으나, 다른 12개 화면과 통일해 openMore('light-popup') 경로로 보드 영역에 표시.
  function wireLightPopup() {
    const el = document.getElementById('light-popup');
    if (!el) return;
    el.querySelectorAll('[data-lp-diff]').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.classList.contains('mm-pill--locked')) return;
        setDifficulty(b.getAttribute('data-lp-diff'));
      });
    });
  }

  // 화면별 BGM. 홈 bgm-home-1~4, 게임 bgm-game-1~3 (재진입마다 순환, game-1=달빛축제 1순위), 더보기 bgm-more.
  // 곡 전환마다 부자연스럽게 뚝 끊기던 것(+ 로딩 중 몇 초 무음) 을 없애려고(사용자 지적)
  // <audio> 2개를 핑퐁으로 써서 크로스페이드한다.
  let bgmEls = null;       // [<audio id="bgm-a">, <audio id="bgm-b">]
  let bgmActiveIdx = 0;    // 0|1 — 지금 "메인"인 쪽(재생 중이거나 재생하려는 쪽)
  let currentBgm = 'audio/bgm-home-1.mp3'; // index.html 의 bgm-a 초기 src 와 일치
  const HOME_BGM_COUNT = 6;
  let homeBgmIdx = 0;
  let bgmWantPlay = false; // 지금 화면이 BGM 을 원하는가 (홈/더보기/게임 진입 시 true)
  const BGM_VOL = 0.35;
  const BGM_FADE_MS = 900;
  let bgmFadeTimer = null;

  function bgmActiveEl() { return bgmEls ? bgmEls[bgmActiveIdx] : null; }
  function bgmInactiveEl() { return bgmEls ? bgmEls[1 - bgmActiveIdx] : null; }

  // 홈/더보기 BGM 삭제(사용자 지정, 신규 트랙 삽입 예정) — 그 화면 진입 시 그냥 정지.
  function stopBgm() { bgmWantPlay = false; applyBgm(); }

  // BGM 재생/정지의 유일한 결정 지점 — 화면 의도 · 앱 가시성 · 설정을 모두 본다.
  function applyBgm() {
    const el = bgmActiveEl();
    if (!el) return;
    const want = bgmWantPlay && !document.hidden && window.FGH.Settings.get('music');
    if (want) {
      if (el.paused) el.play().catch(() => { /* 자동재생 차단 — 다음 제스처(스플래시 탭 등)에 재시도 */ });
    } else if (!el.paused) {
      el.pause();
    }
  }

  // 다른 곡으로 크로스페이드 — 비활성 쪽에 새 곡을 미리 재생 시작해 페이드인, 활성 쪽은
  // 페이드아웃 후 정지. 로딩 지연이 있어도 무음 구간 없이 겹쳐서 자연스럽게 넘어간다.
  function crossfadeBgm(file, loop) {
    if (!bgmEls) return;
    const from = bgmActiveEl();
    const to = bgmInactiveEl();
    if (bgmFadeTimer) { clearTimeout(bgmFadeTimer); bgmFadeTimer = null; }
    currentBgm = file;
    to.loop = loop;
    if (to.src.indexOf(file) === -1) to.src = file;
    to.currentTime = 0;
    to.volume = 0;
    // applyBgm 과 같은 조건 — 음소거/화면숨김 등으로 재생을 원하지 않으면 소리 내지 않고
    // 북키핑만 하고 끝낸다(사용자 리포트: 곡 전환마다 설정 무시하고 잠깐 소리 났었음).
    const want = bgmWantPlay && !document.hidden && window.FGH.Settings.get('music');
    if (!want) {
      from.pause();
      from.currentTime = 0;
      from.volume = BGM_VOL;
      bgmActiveIdx = 1 - bgmActiveIdx;
      return;
    }
    const p = to.play();
    if (p && p.catch) p.catch(() => { /* 자동재생 차단 — 다음 제스처 때 applyBgm 이 재시도 */ });
    const start = performance.now();
    const fromStartVol = from.volume;
    // setTimeout 기반(요청프레임 아님) — requestAnimationFrame 은 화면 전환(flipSwap 3D
    // 트랜지션 등) 도중 콜백이 안 불려서 페이드가 중간에 영구히 멈추는 문제가 있었음(사용자
    // 리포트: "더보기 들어가면/나오면 브금이 안 바뀜" — 새 트랙이 볼륨0에 갇히고 옛 트랙만
    // 계속 들림). k 는 경과시간 기준이라 콜백이 늦게 와도 뜀 없이 정확히 따라잡는다.
    (function step() {
      const k = Math.min(1, (performance.now() - start) / BGM_FADE_MS);
      to.volume = BGM_VOL * k;
      from.volume = fromStartVol * (1 - k);
      if (k < 1) { bgmFadeTimer = setTimeout(step, 50); return; }
      from.pause();
      from.currentTime = 0;
      from.volume = BGM_VOL;
      bgmActiveIdx = 1 - bgmActiveIdx;
      bgmFadeTimer = null;
    })();
  }

  // screen: 'home' | 'more' | 'game'. 매 진입마다 해당 트랙을 처음부터.
  // 홈(4곡)은 loop 안 함 — 곡이 끝나갈 때(아래 timeupdate) 다음 곡으로 미리 크로스페이드해
  // 플레이리스트처럼 순차 재생·순환한다. 더보기·게임(각 1곡, 게임=달빛축제 고정 — 사용자
  // 지정으로 나머지 게임 BGM 삭제)은 loop.
  function playScreenBgm(screen) {
    if (!bgmEls) return;
    let file;
    if (screen === 'home') { file = 'audio/bgm-home-' + (homeBgmIdx % HOME_BGM_COUNT + 1) + '.mp3'; homeBgmIdx++; }
    else if (screen === 'game') { file = 'audio/bgm-game-1.mp3'; }
    else { file = 'audio/bgm-' + screen + '.mp3'; }
    const loop = (screen === 'more' || screen === 'game');
    bgmWantPlay = true;
    if (currentBgm !== file) {
      crossfadeBgm(file, loop);
    } else {
      const el = bgmActiveEl();
      el.loop = loop;
      if (el.currentTime > 0.5) el.currentTime = 0; // 같은 곡 재진입 — 이미 재생 중일 때만 되감기(로딩 blip 방지)
      applyBgm();
    }
  }

  // 곡이 끝나가면(마지막 BGM_FADE_MS + 여유) 다음 곡으로 미리 크로스페이드 시작 —
  // ended 를 기다렸다 전환하면 그 순간 로딩 때문에 몇 초 무음(사용자 지적)이 생길 수 있어,
  // 끝나기 전에 겹쳐서 시작한다. 홈(4곡 순환)만 해당 — 더보기·게임은 loop 라 여기 안 옴.
  function bgmNearEndTick(el) {
    if (el !== bgmActiveEl() || el.loop || !el.duration || bgmFadeTimer) return;
    if (el.duration - el.currentTime <= BGM_FADE_MS / 1000 + 0.15) {
      if (/\/bgm-home-\d/.test(currentBgm)) playScreenBgm('home');
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
  // mole.chapter 를 쓰는 모든 곳에서 이걸로 — 라운드1(뿅망치 전용)으로 들어가면 장착 무기도
  // 뿅망치로 같이 저장해, 보관창 "장착됨" 표시가 실제 플레이 무기와 어긋나지 않게 한다(사용자 지정).
  // 챕터→라운드 재구조화(2026-09-17): 구 챕터1~3(n<=3) 강제 뿅망치 임계값 → 신규 라운드1(n===1)로
  // 이동 — 놓쳤던 것을 Puppeteer 검증(라운드2 캐논 인트로가 안 보이는 문제) 중 발견해 수정.
  function setChapter(n) {
    localStorage.setItem('mole.chapter', String(n));
    if (n === 1) {
      localStorage.setItem('mole.weapon', 'hammer');
      // 뿅망치는 라이트 ON 만 사용 가능(사용자 지정) — 라운드1 진입 시 강제 장착과 세트로 같이 내림.
      const diff = localStorage.getItem('mole.difficulty');
      if (diff === 'mid' || diff === 'legend') localStorage.setItem('mole.difficulty', 'easy');
    }
  }
  // 챕터 이름표 ("챕터 N : 부제"). 이름 없으면 "챕터 N".
  function chapterLabel(n) {
    const named = I18N.t('mole.chapter.name.' + n);
    return (named && named !== 'mole.chapter.name.' + n) ? named : I18N.t('mole.chapter.n', { n: n });
  }
  // 챕터별 안내문구 "내용 설명" (사용자 지정, 챕터2~10만 존재). 없으면 빈 문자열.
  function chapterDesc(n) {
    const v = I18N.t('mole.chapter.desc.' + n);
    return (v && v !== 'mole.chapter.desc.' + n) ? v : '';
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
    // 다이얼패드가 항상 노출돼있어 상점/아이템 등 화면이 열린 채로도 시작 버튼이 눌리는데,
    // 홈 화면일 때만 게임 진입을 허용한다(사용자 지정) — 다른 화면이 열려있으면 무시.
    var mm = document.getElementById('more-menu');
    if (mm && !mm.hidden) return;
    if (MG.Economy.getHearts() <= 0) { showNoHeartModal(); return; }
    if (!MG.Economy.spendTicket()) { showNoTicketModal(); return; } // 챕터 입장권 1장 차감
    refreshChapterNav();
    gameStarting = true;
    setNavLock(true); // 인트로~카운트다운 동안 ⊞ 잠금
    // 라운드 인트로가 도는 몇 초 동안 다이얼패드가 계속 홈 화면(아이콘+글자) 그대로 보여서
    // "게임화면에 홈화면이 나온다"처럼 보였음(사용자 지적) — startRound() 를 기다리지 않고
    // 여기서 바로 게임용(숫자+무기 구획선)으로 전환. spinChannelsIn 도 여기서 한 번만 돈다
    // (startRound 의 같은 호출은 아래에서 제거).
    // ⚠️ board-start/gameover-overlay/is-start 는 여기서 안 건드린다 — 인트로 동안은 화면
    // 배경이 계속 "홈 화면"이어야 하고(사용자 지정: "라운드 설명하기전 홈화면에서 라운드
    // 설명하는 장면이 되어야지"), 녹색 게임판은 startRound()(인트로 끝) 시점에만 드러나야
    // 한다. 다이얼패드만 먼저 숫자로 바꾸기 위해 .gs-starting 마커만 추가(style.css 참고).
    document.getElementById('game-screen').classList.add('gs-starting');
    if (sharedLaneControls) sharedLaneControls.setActiveNav(null);
    ensureLaneControlsForChapter(isSmallBoardChapter());
    const wRaw0 = localStorage.getItem('mole.weapon');
    const weapon0 = isSmallBoardChapter() ? 'hammer'
      : (wRaw0 === 'cannon' ? 'cannon' : (wRaw0 === 'goldhammer' ? 'goldhammer'
        : (wRaw0 === 'alipunch' ? 'alipunch' : 'hammer')));
    document.getElementById('game-screen').classList.toggle('gs-laneskill', weapon0 !== 'hammer');
    document.getElementById('game-screen').classList.toggle('gs-alipunch', weapon0 === 'alipunch');
    if (sharedLaneControls) sharedLaneControls.spinChannelsIn();
    // 게임 BGM 은 여기서(시작 버튼 탭 = 사용자 제스처 콜스택 안) 튼다. startRound 는 인트로
    // 2~4초 뒤라 그때 play() 하면 모바일/PWA 자동재생 정책에 막혀 소리가 안 났음(사용자 보고).
    playScreenBgm('game');
    currentDiff = currentDifficulty();
    applyDiffClass(currentDiff);
    preloadRoundMoles(); // 라운드1 플레이하는 동안 미리 받아둬야 라운드2 전환 때 안 늦음
    playStartIntro(() => {
      loadActiveFace().catch(() => null).then(() => startRound({ fresh: true }));
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
  let winFxTimer = null; // 승리 화면 불꽃놀이 반복 스폰 — 화면 전환(닫힘) 시 clearInterval
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
    chapterSubEl.classList.remove('si-faceoff-in'); // 챕터8 전용 레이아웃 잔여 클래스 정리
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
    // 챕터별 "내용 설명"(사용자 지정, 챕터2~10) — 없으면(챕터1) 기존 공용 팁 문구로 대체.
    const chDesc = chapterDesc(currentChapter());
    const fullTip = chDesc || I18N.t('mole.startintro.tip');
    const aborted = () => myGen !== sessionGen;
    setTimeout(() => {
      if (aborted()) { overlay.hidden = true; overlay.classList.remove('is-opening'); return; }
      typeText(chapterNumEl, chapterNum, () => {
        if (aborted()) return;
        // 라운드6(구챕터8) "소제목" = 텍스트가 아니라 [두더지 이미지] + FACE OFF + [토끼 이미지] 구성(사용자 지정).
        const showSub = currentChapter() === 6
          ? (cb) => {
              chapterSubEl.innerHTML =
                '<img class="si-faceoff-img" src="assets/moles/mole1.png" alt="">' +
                '<b class="si-faceoff-txt">FACE OFF</b>' +
                '<img class="si-faceoff-img" src="assets/moles/rabbit.png" alt="">';
              chapterSubEl.classList.add('si-faceoff-in');
              MG.HitFx.typeTick();
              setTimeout(cb, 500); // 타이핑 대신 이미지 등장 — 다음 줄까지 비슷한 정도 대기
            }
          : (cb) => typeText(chapterSubEl, chapterSub, cb);
        showSub(() => {
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

  // 챕터1~3(9홀 숫자패드) ↔ 챕터4~10(16홀 다이얼러) 카테고리가 바뀔 때 버튼바를 다시 짓는다.
  // 세션 내내 하나만 쓰던 sharedLaneControls 를 clear+재생성 — wireStartButton/
  // wireAlipunchStarButton 이 버튼을 querySelector 로 새로 찾아 리스너를 다시 붙여야 하므로
  // 재생성 직후 반드시 같이 호출한다(안 그러면 "시작" 버튼이 죽은 옛 DOM 을 계속 가리킴).
  // ⚠️ 홈 화면은 항상 기존 16버튼 다이얼러로 불변(사용자 지정) — 9홀/숫자패드는 실제
  // 라운드 진행(startRound) 중에만 적용. wantSmall 을 호출부가 명시적으로 넘긴다.
  let laneControlsIsSmall = null;
  function ensureLaneControlsForChapter(wantSmall, force) {
    const small = !!wantSmall;
    if (!force && laneControlsIsSmall === small) return false; // 이미 그 상태 — 다시 안 지음
    if (sharedLaneControls) sharedLaneControls.clear();
    sharedLaneControls = MG.LaneControls.create({
      buttonBar: document.getElementById('lane-button-bar'),
      gridSize: small ? 3 : GRID_SIZE, // roundGridSize() 는 안 씀 — 이건 현재 챕터가 아니라 인자로 받은 small 을 따라야 함
      simple: small, // 챕터1~3 라운드 중: 채널/다이얼 위장 없는 순수 숫자 1~9(홈 화면은 항상 false)
      onCell: handleCell,
      isHome: () => document.getElementById('game-screen').classList.contains('is-start'),
      // 홈 화면(전화 다이얼러로 위장 중)일 때만 탭음(버튼소리1 고정) — 플레이 중엔 연타가 잦아
      // 타격음과 겹치므로 안 씀.
      onTap: () => { if (document.getElementById('game-screen').classList.contains('is-start')) MG.HitFx.uiTap(0); },
      // 홈 화면 다이얼패드에 흡수된 더보기 기능(하트·코인·티켓·스코어·상점·홈·일일·퀘스트·친구·
      // 사진보관·아이템보관·설정·라이트모드) — 탭하면 그 화면/팝업으로. 인트로/카운트다운
      // 중(navLocked)엔 무시.
      onHomeAction: (action) => {
        if (navLocked) return;
        if (action === 'home') { showStartScreen(); return; }
        const sub = { shop: 'shop-screen', score: 'score-screen', daily: 'daily-screen',
          quest: 'quest-screen', friends: 'friends-screen', locker: 'face-locker',
          inventory: 'inventory-screen', settings: 'settings-screen', lightMode: 'light-popup' }[action];
        if (sub) { openMore(sub); if (sharedLaneControls) sharedLaneControls.setActiveNav(action); }
      }
    });
    laneControlsIsSmall = small;
    wireStartButton(); // 다이얼러 초록 버튼: 홈에서 탭=시작 / 꾹=종료 대기 (재생성된 새 버튼에 다시 배선)
    wireAlipunchStarButton(); // 알리 펀치 전용 별표 버튼(스킬 슬롯 2개 더) — small 이면 무해하게 no-op
    return true; // 실제로 다시 지었음
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

    // 게임 중엔 이 코너(구멍 15 자리)가 "스킬 슬롯 2개"로 바뀐다 (캐논·특수망치, gs-laneskill). 홈에선 "시작" 버튼.
    // 껍데기 — 슬롯 스킬은 LANE_SKILLS 에 지정 (0 위 반원 · 1 아래 반원). 빈 슬롯 탭은 무동작(화면이동 X).
    if (!btn.querySelector('.lane-items')) {
      btn.appendChild(createLaneItemsBox());
      renderLaneItems();
    }
  }

  // 스킬 슬롯 카드 2장 DOM(빈 슬롯 껍데기, 탭 눌림/물결만) — 통화버튼·알리펀치 별표버튼 공용.
  function createLaneItemsBox() {
    const box = document.createElement('div');
    box.className = 'lane-items';
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 2; i++) {
      const it = document.createElement('div');
      it.className = 'lane-item lane-item--empty';
      it.dataset.slot = String(i);
      const sweep = document.createElement('i');
      sweep.className = 'lane-item-sweep';
      it.appendChild(sweep);
      const icon = document.createElement('span');
      icon.className = 'lane-item-icon';
      it.appendChild(icon);
      it.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        it.classList.add('is-press');
        it.classList.remove('is-rip'); void it.offsetWidth; it.classList.add('is-rip'); // 물결 재발동
        try { if (window.FGH.Settings.vibrate) window.FGH.Settings.vibrate(16); } catch (err) { /* 무시 */ }
      });
      const rel = () => it.classList.remove('is-press');
      it.addEventListener('pointerup', rel);
      it.addEventListener('pointercancel', rel);
      it.addEventListener('pointerleave', rel);
      box.appendChild(it);
    }
    return box;
  }

  // 스킬 슬롯 2칸 (게임 중 우하단 코너, 통화버튼). null = 빈 칸. 예: { icon: '⚡', id: 'xxx' }
  const LANE_SKILLS = [null, null];
  function renderLaneItems() {
    const box = document.querySelector('#lane-button-bar .lane-button--call .lane-items');
    if (!box) return;
    box.querySelectorAll('.lane-item').forEach((el, i) => {
      const it = LANE_SKILLS[i];
      el.classList.toggle('lane-item--empty', !it);
      const iconEl = el.querySelector('.lane-item-icon');
      if (iconEl) iconEl.textContent = it && it.icon ? it.icon : '';
    });
  }

  // 알리 펀치 전용 "별표"(다이얼패드 실제 '✱' 키, 구멍12) — 스킬 슬롯 2칸 더(기획서 §8, 총 4개).
  // 통화버튼(구멍15)과 완전히 동일한 방식 — 다른 무기에선 CSS(.gs-alipunch 없음)로 원래 숫자키 그대로.
  const STAR_SKILLS = [null, null];
  function wireAlipunchStarButton() {
    const btn = document.querySelector('#lane-button-bar [data-region="12"]');
    if (!btn || btn.querySelector('.lane-items')) return;
    btn.appendChild(createLaneItemsBox());
    renderStarItems();
  }
  function renderStarItems() {
    const box = document.querySelector('#lane-button-bar [data-region="12"] .lane-items');
    if (!box) return;
    box.querySelectorAll('.lane-item').forEach((el, i) => {
      const it = STAR_SKILLS[i];
      el.classList.toggle('lane-item--empty', !it);
      const iconEl = el.querySelector('.lane-item-icon');
      if (iconEl) iconEl.textContent = it && it.icon ? it.icon : '';
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
  // ⚠️책장 넘기는 3D 플립 연출은 완전히 삭제됨(사용자 지정 — 위/아래 전부 없애라).
  // 실기기에서 다이얼패드가 같이 비어버리는 버그가 반복돼 원인 격리 시도도 실패 — 전환은
  // 그냥 즉시 스위치(무연출)로 통일.
  function flipSwap(outEl, inEl) {
    if (!outEl || !inEl || outEl === inEl) return;
    outEl.hidden = true;
    inEl.hidden = false;
  }

  // 더보기 메뉴 열기/닫기.
  function openMore(sub, originEl) {
    var isStart = document.getElementById('game-screen').classList.contains('is-start');
    var outEl = document.getElementById(isStart ? 'board-start' : 'mole-board');
    openMoreNow(sub); // more-menu 내용 준비(hidden=false 는 flipSwap 이 처리)
    flipSwap(outEl, document.getElementById('more-menu'));
    // more-menu 가 보드 자리에 들어가는 구조라 — #board-start 만 숨겨서는 그 부모인
    // #mole-board(aspect-ratio 로 고정폭 유지) 가 빈 채로 자기 자리를 계속 차지해 more-menu 가
    // 그 아래로 밀려나고 다이얼패드가 화면 밖으로 밀려나는 버그가 생김. #mole-board 자체도
    // 같이 숨겨 그 자리를 비운다(홈 화면 진입 때만 — 실제 플레이 중 더보기는 게임판을 유지).
    if (isStart) document.getElementById('mole-board').hidden = true;
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
    // 실제 진행 중이던 라운드를 멈추고 여는 경우만 브금 정지 — 홈에서 상점/아이템 등
    // 화면을 왔다갔다할 땐 브금이 끊기지 않고 계속 유지되어야 함(사용자 지정).
    if (resumable) stopBgm();
    if (moreMenu) moreMenu.refresh();
    if (sub) {
      screenNav.show(sub);
      if (sub === 'face-locker' && faceLocker) faceLocker.show();
      if (sub === 'shop-screen' && shop) shop.show();
      if (sub === 'daily-screen' && daily) daily.show();
      if (sub === 'score-screen' && scoreScreen) scoreScreen.show();
      if (sub === 'settings-screen' && settingsScreen) settingsScreen.show();
      if (sub === 'inventory-screen' && inventoryScreen) inventoryScreen.show();
      if (sub === 'light-popup') refreshLightPopup();
    }
  }
  function closeMore(e) {
    var mm = document.getElementById('more-menu');
    // 진행 중이던 게임이 있으면 그대로 더보기만 닫고, 없으면 대화 화면 — 이 경우
    // more-menu 를 여기서 먼저 숨기지 않는다(showStartScreenNow 가 플래시 시점에 맞춰 처리).
    if (!state) { showStartScreen({ originEl: e && e.currentTarget }); return; }
    screenNav.reset();
    if (sharedLaneControls) sharedLaneControls.setActiveNav(null); // 더보기 닫음 — 확대된 네비 버튼 원위치
    flipSwap(mm, document.getElementById('mole-board')); // 이어가기 → 게임화면
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
    showStartScreenNow(opts);
  }
  function showStartScreenNow(opts) {
    sessionGen++; // 진행 중이던 카운트다운/자동진행 타이머 무효화
    gameStarting = false;
    setNavLock(false);
    // 홈 화면 자체가 "홈" 탭이 선택된 상태 — 홈 아이콘은 항시 확대 유지(사용자 지정), 다른
    // 네비를 열면 그쪽이 확대되며 홈은 자동으로 원래 크기로 돌아감(같은 setActiveNav 토글).
    if (sharedLaneControls) sharedLaneControls.setActiveNav('home');
    if (rafId) cancelAnimationFrame(rafId);
    if (sharedPopElements) sharedPopElements.clear();
    if (state && state.holeLayer) state.holeLayer.clear();
    if (state && state.laneHammer) state.laneHammer.clear();
    resetHot();
    clearInvincibleFx();
    state = null;
    run = null;
    // 홈 화면 = 항상 기존 16버튼 다이얼러(불변, 사용자 지정). 직전 라운드가 챕터1~3(9버튼)
    // 이었다면 여기서 다시 지어짐 — 버튼보드 자체는 항시 고정이라 무연출로 조용히 전환(사용자 지정).
    ensureLaneControlsForChapter(false);
    // 홈 BGM(6곡, 사용자 지정 신규) — 접속 시 1번 고정, 이후 순서대로 진행 후 반복.
    // 단, 최초 부팅 직후(스플래시/인트로가 아직 화면을 덮고 있는 동안)엔 재생을 미룬다(사용자
    // 지정 — "브금은 인트로에 안 나오고 홈화면 진입하면 나오게"). index.html 이 인트로/스플래시가
    // 실제로 사라지는 시점에 window.FGH.startHomeBgm() 을 불러 시작한다.
    // 상점/아이템 등에서 홈으로 돌아올 때 홈 브금이 이미 재생 중이면 재호출하지 않는다 —
    // playScreenBgm('home') 은 매번 호출 시 다음 곡으로 넘어가버려서, 안 건드리면 원래
    // 이어질 곡이 화면 전환마다 계속 스킵되는 문제였음(사용자 지정 — 브금은 화면 전환과 무관하게 유지).
    if (!(opts && opts.deferBgm) && !/\/bgm-home-\d/.test(currentBgm)) playScreenBgm('home');
    const go = document.getElementById('gameover-overlay');
    go.hidden = true; go.classList.remove('is-win', 'is-lose', 'is-sliding');
    const cf = go.querySelector('.go-confetti'); if (cf) cf.innerHTML = '';
    const fwc = go.querySelector('.go-fireworks'); if (fwc) fwc.innerHTML = '';
    const spc = go.querySelector('.go-starpop'); if (spc) spc.innerHTML = '';
    go.classList.remove('win-fx-rays', 'win-fx-starpop');
    go.classList.remove('fail-fx-1', 'fail-fx-3', 'fail-fx-4', 'fail-fx-8');
    ['fail-dust-layer', 'fail-heart-layer', 'fail-ash-layer'].forEach((cls) => {
      const el = go.querySelector('.' + cls);
      if (el) el.innerHTML = '';
    });
    if (winFxTimer) { clearInterval(winFxTimer); winFxTimer = null; }
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
    // board-start는 #mole-board 의 자식 — 더보기(openMore)가 mole-board 자체를 hidden
    // 처리해둔 상태일 수 있어(v166), 여기서도 같이 복구해야 board-start 가 0x0으로
    // 렌더링되지 않는다(키패드만 보이는 버그의 원인이었음).
    document.getElementById('mole-board').hidden = false;
    document.getElementById('game-screen').classList.add('is-start');
    setCallLabel('home'); // 홈: 초록 버튼 "시작" (빨간 대기 상태였으면 해제)
    if (screenNav) screenNav.reset();
    const mm = document.getElementById('more-menu');
    if (mm) mm.hidden = true;

    refreshChapterNav();
    refreshBoardStats();
    tuneAddrTicker();
    maybeShowStartCoach();
  }

  // 챕터 선택 ◀ 챕터 N ▶ — 열린 챕터가 2개 이상일 때만 표시. mole.chapter 를 설정.
  // HUD 주소창 자리를 차지 → 그때 주소창 숨김.
  function refreshChapterNav() {
    const nav = document.getElementById('chapter-nav');
    if (!nav) return;
    const maxCh = MG.Progress.maxChapterFor(currentLight());
    // 항상 표시 — 챕터가 하나만 열렸어도 "ROUND 1" 배지는 보이고, 양쪽 화살표만 비활성.
    let ch = currentChapter();
    if (ch > maxCh) { ch = maxCh; setChapter(ch); }
    nav.hidden = false;
    nav.setAttribute('data-ch', String(ch)); // 챕터별 불빛 색 (style.css #chapter-nav[data-ch="N"])
    // "ROUND N" 표기(사용자 지정, 언어 무관 고정 — 챕터 이름/부제(chapterLabel) 등 다른 표시는 그대로).
    nav.querySelector('[data-ch-label]').textContent = 'ROUND ' + ch;
    nav.querySelector('[data-ch-prev]').disabled = ch <= 1;
    nav.querySelector('[data-ch-next]').disabled = ch >= maxCh;
    // 챕터 입장권 (2시간마다 +1, 입장 시 -1) — 다이얼패드 3번 버튼 카운터로 표시(사용자 지정).
    if (sharedLaneControls) sharedLaneControls.setHudStat('tickets', MG.Economy.getTickets());
  }
  function wireChapterNav() {
    const nav = document.getElementById('chapter-nav');
    if (!nav) return;
    const step = (d) => {
      const maxCh = MG.Progress.maxChapterFor(currentLight());
      const before = currentChapter();
      const ch = Math.max(1, Math.min(maxCh, before + d));
      setChapter(ch);
      // 홈 화면 버튼바는 기존 16버튼 다이얼러로 불변(사용자 지정) — 챕터 넘겨봐도 안 바뀜.
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

  // ---------- 라운드 시작 ----------
  // opts.fresh: true면 콤보·점수·목숨을 리셋 (시작 버튼/다시하기).
  //             없으면 자동 다음 라운드로 보고 그대로 이어간다.
  function startRound(opts) {
    sessionGen++;
    gameStarting = false; // 라운드 진입 성공 — 이후 재진입은 state 존재로 차단됨
    setNavLock(true); // 카운트다운 동안 ⊞ 잠금 (playRoundIntro onDone 에서 해제)
    // 홈에서 확대돼있던 네비 버튼(홈 아이콘)이 그 자리 그대로 게임화면 숫자키로 재사용되는
    // 챕터(그리드 안 바뀜=재생성 안 됨)에서, 확대 클래스가 안 지워진 채 남아 숫자키가 커 보이던
    // 버그 수정 — 라운드 진입 시 항상 원위치.
    if (sharedLaneControls) sharedLaneControls.setActiveNav(null);
    ensureLaneControlsForChapter(isSmallBoardChapter()); // 실제 라운드 진행 중에만 9홀/숫자패드로 전환
    applyBoardTheme();
    applyWeather();
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

    // 홈→게임 진입 전환은 이제 타이핑 인트로+커튼(playStartIntro)이 담당 — 플래시 제거(사용자 요청).
    const boardStartEl = document.getElementById('board-start');
    boardStartEl.hidden = true;
    document.getElementById('gameover-overlay').hidden = true;
    document.getElementById('game-screen').classList.remove('is-start');
    document.getElementById('game-screen').classList.remove('gs-starting'); // beginGame() 이 붙였던 임시 마커, 이제 is-start 로 대체됨
    setCallLabel('game'); // 게임 중: 초록 버튼은 "통화"(위장) — 15번 구멍 타격 담당
    // 캐논·특수망치 = 우하단 코너가 무기존(캐논 본체 or 스킬 슬롯 2개) → 구멍 15 빼고 15구멍. 뿅망치 = 16구멍.
    // (spinChannelsIn 이 gs-laneskill 을 보고 통화 버튼도 같이 돌리므로 그 호출 전에 세팅해야 한다.)
    const wRaw = localStorage.getItem('mole.weapon');
    // 챕터1~3(9홀 튜토리얼)은 뿅망치만 사용(사용자 지정) — 보관창 장착값과 무관하게 강제.
    const weapon = isSmallBoardChapter() ? 'hammer'
      : (wRaw === 'cannon' ? 'cannon' : (wRaw === 'goldhammer' ? 'goldhammer'
        : (wRaw === 'alipunch' ? 'alipunch' : 'hammer')));
    const laneSkillZone = weapon !== 'hammer'; // 캐논·골드해머·알리펀치 = 통화버튼 스킬존(§8 포함)
    document.getElementById('game-screen').classList.toggle('gs-laneskill', laneSkillZone);
    document.getElementById('game-screen').classList.toggle('gs-alipunch', weapon === 'alipunch');
    // 채널→숫자 회전(spinChannelsIn)은 이제 beginGame() 이 인트로 시작 전에 미리 돈다 —
    // 여기서 또 돌리면 라운드 진입마다 두 번 돌아버림.
    // 새 게임 시작(fresh)일 때만 더보기 메뉴를 닫는다. 자동 다음 라운드는 메뉴를 건드리지 않음
    // (플레이 중 메뉴 열어둔 채 라운드가 넘어가도 화면이 안 튀게).
    if (opts && opts.fresh) {
      if (screenNav) screenNav.reset();
      document.getElementById('more-menu').hidden = true;
    }
    // fresh 는 beginGame 이 이미 게임 BGM 을 시작했음. 여기선 (혹시 막혔으면) 이어재생만.
    applyBgm();
    MG.HitFx.warmup(); // 오디오 컨텍스트 + 타격음 파일 프리로드 (카운트다운 동안)

    const rng = { next: MG.RNG.mulberry32(MG.RNG.hashSeed('mole-r' + currentChapter() + '-' + Date.now())) };
    let { regions, spawnPoints } = MG.GridPartition.partition({ gridSize: roundGridSize() });
    // 캐논·골드해머 = 우하단 구멍 1개(15) 제외 → 15구멍. 알리 펀치 = 좌·우하단 2개(12·15) 제외 →
    // 14구멍 + 그 자리에 글러브(§1). 뿅망치는 그대로 16구멍.
    const excludedHoles = weapon === 'alipunch' ? ALIPUNCH_HOLES : (laneSkillZone ? [CANNON_HOLE] : []);
    if (excludedHoles.length) {
      regions = regions.filter((r) => excludedHoles.indexOf(r.id) === -1);
      spawnPoints = spawnPoints.filter((sp) => excludedHoles.indexOf(sp.regionId) === -1);
    }

    // 전체 챕터 기획서(2026-09-14) §7 난이도 순서: 빼꼼(다타) 챕터2 → 동물 챕터3 → 폭탄 챕터5 →
    // 모자(4타) 챕터7 → 목표물 전환 챕터8(타겟=동물/방해물=두더지) → 목표물 혼합 챕터10(+방해비율10%↑).
    // 강력폭탄(챕터6)·반격(챕터9)은 보류(사용자 지정 — UI 완료 후 별도 작업). 실드 아이템(기존 기능,
    // 문서에 없지만 §13 "기존 기능 임의 삭제 금지"에 따라 유지)은 폭탄이 시작되는 챕터5부터 계속.
    // 챕터→라운드 재구조화(2026-09-17): ch 는 이제 "새 라운드 번호"(1~8) — 구 챕터 임계값(N)은
    // 전부 N-2 로 이동(라운드2=구챕터4 ... 라운드8=구챕터10). 라운드1(구챕터1~2~3 병합)은
    // 아래 별도 분기 + updateLiveDifficulty() 의 시간 기반 로직이 전담하므로 여기선 라운드2~8
    // 기준값(라운드 시작 순간, t=0)만 채운다 — 매 프레임 updateLiveDifficulty() 가 갱신한다.
    const ch = currentChapter();
    const reverseTarget = ch === 6;              // 라운드6(구챕터8): 동물이 타겟, 두더지가 방해물
    const dualTarget = ch === 8;                 // 라운드8(구챕터10): 두더지+동물 둘 다 타겟
    const config = {
      maxConcurrentMoles: isSmallBoardChapter() ? MG.SMALL_CHAPTER_MOLES[0]
        : Math.round(MG.interpolate(reverseTarget ? MG.MAX_CONCURRENT_ANIMALS : MG.MAX_CONCURRENT_MOLES, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS)),
      maxConcurrentAnimals: isSmallBoardChapter() ? 0
        : Math.round(MG.interpolate(reverseTarget ? MG.MAX_CONCURRENT_MOLES : MG.MAX_CONCURRENT_ANIMALS, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS)),
      maxConcurrentBombs: (!isSmallBoardChapter() && ch >= 3) ? Math.round(MG.interpolate(MG.MAX_CONCURRENT_BOMBS, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS)) : 0,
      bombChance: (!isSmallBoardChapter() && ch >= 3) ? MG.interpolate(MG.BOMB_CHANCE_BY_ROUND, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS) : 0,
      strongBombChance: (!isSmallBoardChapter() && ch >= 4) ? MG.interpolate(MG.STRONG_BOMB_CHANCE_BY_ROUND, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS) : 0,
      maxConcurrentItems: 0,   // 실드 아이템 스폰 삭제(사용자 지정, 2026-09-14)
      shieldItems: false,
      popDuration: isSmallBoardChapter() ? 2.5 : MG.interpolate(MG.MOLE_DURATION, DIFFICULTY_CURVE_OFFSET, DIFFICULTY_CURVE_SECONDS),
      molePoseCount: MG.MoleSprites.POSE_COUNT,
      obstacleCount: MG.MoleSprites.OBSTACLE_COUNT,
      obstacles: !isSmallBoardChapter(),  // 라운드1은 40초부터(updateLiveDifficulty), 라운드2~8은 항상
      multiHit: !isSmallBoardChapter(),   // 라운드1은 20초부터(updateLiveDifficulty), 라운드2~8은 항상
      fourHit: !isSmallBoardChapter() && ch >= 5,      // 4타 두더지 — 라운드5~8(구챕터7~10)
      animalMultiHit: !isSmallBoardChapter() && ch === 6,  // 라운드6(구챕터8): 동물이 타겟이라 다타 동물 도입
      reverseTarget: reverseTarget,
      dualTarget: dualTarget,
      obstacleRatioBoost: (!isSmallBoardChapter() && ch === 8) ? 1.1 : 1,  // 라운드8(구챕터10): 방해물 스폰 빈도 10% 상향
      cannonBurst: weapon === 'cannon',   // 대포 연사 스킬 (2·3타 두더지 첫 타 10%)
      moleUpBonus: weapon === 'alipunch' ? 0.1 : 0   // 알리 펀치 [방어]: 내려가기 전 0.1초 더 여유(§7)
    };

    const scheduler = MG.SpawnScheduler.create({ regions, spawnPoints, config, rng });

    if (!sharedPopElements) {
      sharedPopElements = MG.PopElements.create({
        container: document.getElementById('mole-pop-layer'),
        onEmerge: (x, y, type) => {
          const bd = document.getElementById('mole-board');
          // 등장 소리(사용자 지정, 2026-09-17): 라운드6(reverseTarget, 동물이 타겟)은 동물 등장에만,
          // 그 외 라운드는 두더지 등장에만 — "타겟 생물"이 올라올 때 울리게.
          const reverseTarget = !!(state && state.config && state.config.reverseTarget);
          if (type === 'mole') {
            MG.HitFx.emerge(bd, x, y);
            if (!reverseTarget) MG.HitFx.emergeSound();
          } else if (type === 'animal' || type === 'bomb') {
            MG.HitFx.emerge(bd, x, y, { weak: true }); // 동물/폭탄도 흙 폭발(약하게)
            if (type === 'animal' && reverseTarget) MG.HitFx.emergeSound();
          } else if (type === 'item') {
            MG.HitFx.starBurst(bd, x, y); // 실드 아이템 = 반짝이
          }
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

    // 장착 무기 = 망치(기본) / 대포 스킨 / 골드해머(지진) / 알리 펀치(글러브 2개). 인터페이스 동일
    // (strike/update/home/clear/isBusy).
    const WeaponMod = (weapon === 'cannon' && MG.LaneCannon) ? MG.LaneCannon
      : (weapon === 'alipunch' && MG.LaneBoxing) ? MG.LaneBoxing : MG.LaneHammer;
    const hammerOpts = { layer: document.getElementById('mole-hammer-layer') };
    if (weapon === 'hammer') hammerOpts.idle = 'bounce'; // 대기 애니메이션(사용자 지정, 잠깐 자리 비웠을 때)
    if (weapon === 'cannon') {
      // 캐논 인트로 전용 이미지들(body-flip/a3-mirror/a4-mirror) — HTML에 없고 JS가 실행
      // 시점에 처음 .src 를 주기 때문에, 캐시 없는 첫 플레이에서 네트워크 로딩 중 작은
      // 깨진 이미지 아이콘이 잠깐 보였다(사용자 리포트, 두 번째부턴 캐시로 정상). 미리 로드.
      ['cannon-intro-body-flip', 'cannon-a3-mirror', 'cannon-a4-mirror'].forEach((n) => {
        const i = new Image(); i.src = 'assets/weapons/' + n + '.png';
      });
    }
    if (weapon === 'goldhammer') {
      hammerOpts.sprite = 'assets/weapons/goldhammer.png';
      // 스프라이트가 이미 뿅망치 축각도(~21°)로 잘려있어 degOffset 불필요 → 스윙 궤적·타격점이 뿅망치와 동일.
      hammerOpts.grip = { x: 56, y: 72 };        // 골드해머 스프라이트 손잡이 잡는 점
      hammerOpts.cssClass = 'lane-hammer--gold'; // 뿅망치보다 1.2배 크게
      // 골드해머는 그립(56%,72%)·타격면 위치·크기(17.5% vs 14.04%)가 뿅망치와 달라 기본 gripOff 그대로 쓰면
      // 타격면이 목표보다 위/옆으로 빗나간다. 스프라이트 픽셀(빨간 타격면 중심 vs 그립)을 실측 + 회전변환으로
      // 역산한 값(대략치 — 실기기에서 미세조정 필요할 수 있음).
      hammerOpts.gripOff = { x: 0.097, y: -0.065 }; // 타격점 좌측으로 0.1cm 추가이동 (누적 0.2cm, 좌표계=보드분수 1cm≈0.1)
      hammerOpts.emptyDy = -0.025; // 빈 구멍 헛스윙 전용: 공용 AIM_DY(-0.055)보다 아래로 0.3cm (뿅망치는 그대로)
      hammerOpts.homeMarginTop = '-0.3cm';       // 대기 위치를 기본(0.2cm 아래)에서 위로 0.5cm
      hammerOpts.homeDegOffset = 20;             // 대기 각도만 시계방향으로 20도 추가 회전
      hammerOpts.idle = 'spin';                  // 대기 애니메이션 — 제자리 360도 회전(사용자 지정)
      // 지진 분신 포즈 미리 로드 (첫 지진 때 이미지가 늦게 떠서 안 보이는 것 방지)
      ['goldhammer-0', 'goldhammer-90'].forEach((n) => { const i = new Image(); i.src = 'assets/weapons/' + n + '.png'; });
    }
    // 동시타격 오버플로(분신) — 랜덤 배정에서 "진짜"를 못 받은 나머지 타격들이 여기로 온다.
    // 무기별로 다른 분신 연출(quakeClone/cannonClone 재사용, 사용자 지정 — "황금묠니르처럼
    // 분신 개념"). 실제 타격 판정(onImpact)은 그대로 호출하므로 콤보/점수는 정상 반영된다.
    function weaponCloneOverflow(targetXFrac, targetYFrac, onImpact, frameKey, regionId) {
      const fxLayer = document.getElementById('mole-hammer-layer'); // overflow:visible
      if (weapon === 'cannon') {
        // 분신 몸체·포즈 맞추기는 포기(사용자 지정 — "쉬운 방법"): 게임판 밖에 분신 대포가
        // 있다고 치고, 왼쪽 외곽~좌하단 모서리~아래쪽 외곽 경로 위 랜덤한 지점에서 포탄만
        // 목표까지 날아간다(randomCannonCloneStart, 정확한 경로는 사용자 지정). 랜덤이라
        // 동시에 여러 개(8개까지 실기기 확인) 떠도 자연스럽게 안 겹친다.
        // ⚠️ 판 밖은 안 보이게(clip) 하려던 시도(#mole-board)는 무작위 시작점과 목표 거리가
        // 들쭉날쭉해서 "어떤 건 잘 보이고 어떤 건 중앙 근처에서 톡 나타남"으로 일관성이
        // 없었다(사용자 리포트) — 사용자 지정으로 클리핑을 포기하고 fxLayer(mole-hammer-layer,
        // overflow:visible)에 그려 판 밖 구간부터 항상 전체가 보이게 확정.
        const start = randomCannonCloneStart();
        MG.HitFx.cannonClone(fxLayer, start.x, start.y, targetXFrac, targetYFrac, onImpact);
      } else if (weapon === 'alipunch') {
        // 분신도 실제 위치와 "같은 글러브·같은 애니메이션"이어야 한다(사용자 지정) — 일반
        // quakeClone 대신 lane-boxing.js 가 export 하는 makeGlove 로 그 구역의 진짜 글러브를
        // 하나 더 만들어(50% 투명) 똑같이 strike() 시킨다. 무적 중 황금색 필터(.lane-boxing-glove
        // img 셀렉터 기반)도 클래스가 같아서 자동으로 같이 적용된다.
        const LB = MG.LaneBoxing;
        const style = LB && LB.ZONES && LB.ZONES[regionId];
        const side = LB && LB.GLOVE_OF && LB.GLOVE_OF[regionId];
        if (LB && LB.makeGlove && style && side) {
          const home = side === 'L' ? LB.HOME_L : LB.HOME_R;
          const cloneCss = 'lane-boxing-glove--' + side.toLowerCase() + ' lane-boxing-glove--clone';
          const glove = LB.makeGlove(fxLayer, home, cloneCss, side);
          glove.strike(targetXFrac, targetYFrac, style, onImpact, regionId);
          // update() 를 직접 돌려줘야 실제로 스윙·페인트되고 onImpact 도 불린다(makeGlove 는
          // 자기 스스로 애니메이션을 굴리지 않음) — 메인 루프가 매 프레임 이 배열을 순회한다.
          if (state) state.aliClones.push(glove);
          setTimeout(() => {
            glove.clear();
            if (state) {
              const i = state.aliClones.indexOf(glove);
              if (i > -1) state.aliClones.splice(i, 1);
            }
          }, 400); // 스윙 전체 주기(reach+return ≈240ms)보다 넉넉히
        } else if (onImpact) {
          onImpact(); // 방어적 폴백 — 연출 없이도 판정(콤보/점수)은 반영
        }
      } else if (weapon === 'goldhammer') {
        MG.HitFx.quakeClone(fxLayer, quakeClonePose(regionId), targetXFrac, targetYFrac, quakeCloneKind(regionId), onImpact);
      } else {
        MG.HitFx.quakeClone(fxLayer, 'assets/hammer.png', targetXFrac, targetYFrac, quakeCloneKind(regionId), onImpact, 'quake-clone--hammer');
      }
    }
    const laneHammer = MG.WeaponPool.create(WeaponMod, hammerOpts, { onOverflow: weaponCloneOverflow });

    state = {
      regions, spawnPoints, scheduler, holeLayer, laneHammer, weapon, rng, config,
      timeRemaining: roundSeconds(),
      aliClones: [], // 알리펀치 동시타격 분신 글러브들 — 메인 루프가 매 프레임 update() 돌려줘야 실제로 스윙한다.
      hitstopUntil: 0,
      alipunchInvincibleUntil: 0, // 알리 펀치 [공격력]: 무적 활성 종료 시각(performance.now() 기준, §7)
      ended: false,
      paused: false,
      introActive: true // 카운트다운 동안은 시간도 안 흐르고 구멍 입력도 무시 (handleCell 참고)
    };

    updateHUD();
    playRoundIntro(() => {
      if (myGen !== sessionGen || !state) return; // 그 사이 나가버림 — 이 콜백 무효
      state.introActive = false;
      setNavLock(false); // 라운드 실제 진행 → ⊞ 다시 활성
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    });
  }

  // 모든 라운드(1~8): "라운드 N" 타이틀·음성 없이 바로 Ready → GO! 카운트다운(줌인 + 색상,
  // GO! 는 흰 플래시) → 퇴장(사용자 지정, 2026-09-17 — 타이틀 단계가 불필요하다고 판단).
  // 커튼 없음(투명 오버레이, 보드가 비침), 장식용 두더지 이미지도 없음.
  // 골드해머 인트로 "회전 등장" 시작 위치 — 키패드 '✱' 키 중심의 lane-hammer 좌표계
  // (#mole-hammer-layer 기준) 분수(실측).
  const GH_SPIN_START = { x: 0.128, y: 1.871 };

  function playRoundIntro(onDone) {
    const myGen = sessionGen;
    const overlay = document.getElementById('round-intro-overlay');
    const title = document.getElementById('round-intro-title');
    const count = document.getElementById('round-intro-count');
    const moleImg = document.getElementById('round-intro-mole');

    overlay.hidden = false;
    count.hidden = true;
    count.className = 'round-intro-count';
    title.textContent = '';
    moleImg.hidden = true;
    // 캐논/골드해머/뿅망치 인트로 연출 — 모든 라운드(1~8)에서 이 함수 시작 시점에 바로 시작
    // (사용자 지정). 커튼 없이 느긋한 타이밍(구 라운드1 전용이었던 쪽) 하나로 통일.
    if (state.weapon === 'cannon') playCannonIntro(false);
    if (state.weapon === 'goldhammer') playGoldHammerIntro(false);
    if (state.weapon === 'hammer') playHammerIntro(false);
    overlay.classList.remove('has-mole', 'mole-in', 'is-opening'); // 커튼 효과 없음(투명, 모든 라운드 공통)
    // 알리 펀치: 인트로 시작부터 바로 글러브가 보여야 한다(사용자 지적).
    if (state.weapon === 'alipunch') setHammerLayerVisible(true);

    // 인트로 동안은 메인 루프(loop, requestAnimationFrame)가 아직 시작 전이라 laneHammer.update()가
    // 한 번도 안 불려서 시연 애니메이션이 화면에 안 그려짐 — 인트로 전용 가벼운 틱을 별도로 돌린다.
    function tickHammerDuring(ms) {
      const end = performance.now() + ms;
      let last = performance.now();
      (function step(now) {
        if (myGen !== sessionGen || !state || !state.laneHammer) return;
        const dt = Math.min(0.1, ((now || performance.now()) - last) / 1000);
        last = now || performance.now();
        state.laneHammer.update(dt);
        if (last < end) requestAnimationFrame(step);
      })();
    }

    // 캐논 인트로 등장 연출(사용자 지정) — 라운드 시작하자마자 좌측에서 등장해 대기위치까지
    // 이동(옆면-외곽선, 바퀴 회전) → 도착하면 3시 방향(a3 거울상) → 12시 방향(a4 거울상) 포즈를
    // 짧게 거쳐 → 실제 대포(평소 대기 포즈)로 교체. 평소엔 #mole-hammer-layer(진짜 대포)를
    // 숨겨뒀다가 끝나면 교체. fast 인자는 항상 false(모든 라운드 동일 타이밍으로 통일).
    function playCannonIntro(fast) {
      const ci = document.getElementById('cannon-intro');
      if (!ci) return;
      setHammerLayerVisible(false); // 실제 대포는 인트로 끝날 때까지 숨김(사용자 지적)
      const rig = ci.querySelector('.ci-rig');
      const body = ci.querySelector('.ci-body');
      const wheels = ci.querySelectorAll('.ci-wheel');
      ci.hidden = false;
      // 이미지마다 실제 크기가 달라(옆면 이미지는 여백이 많고, a3·a4 는 lane-cannon.js 의
      // 자체 보정 폭 사용) 폭을 하나로 통일하면 전환 때 크기가 튀어 이질감 생김(사용자 지적).
      // 이미지 바뀔 때마다 그 이미지에 맞는 폭을 직접 지정.
      // .ci-rig 에 폭을 직접 준다(% width는 부모=#cannon-intro 기준으로 고정폭이라 안전).
      // .ci-body 에 width:%를 주면 부모(.ci-rig, 폭 미지정)를 기준으로 순환 참조가 생겨
      // 프레임마다 계속 줄어드는 버그가 났었음(사용자 보고 "애니메이션 다 깨짐") — 그래서
      // 크기는 항상 rig 에 준다.
      // 완료 시점 = 카운트다운 종료·퇴장(is-opening) 시작 순간에 맞춘다(사용자 지정 "딱 맞춰야함").
      // 타이틀 단계 삭제(2026-09-17, "라운드 N" 글자+음성 제거) 후 전체 흐름이 250(초기 지연)+
      // 1010(Ready 650+GO! 후 360) = 1260ms 로 짧아져 travelMs/holdMs 도 그에 맞춰 축소 — Puppeteer 재검증.
      const travelMs = fast ? 3000 : 900;
      const holdMs = fast ? 205 : 180;
      rig.style.width = '27.8%'; // 실측 24.2%(a3)에서 +15% — 옆면 이미지는 여백이 많아서 보정
      rig.style.animationDuration = travelMs + 'ms';
      body.src = 'assets/weapons/cannon-intro-body-flip.png'; // 이동 중엔 항상 이 이미지(사용자 지정)
      wheels.forEach((w) => w.classList.remove('ci-hide'));
      rig.className = 'ci-rig ci-play'; // 좌측 등장 → 대기위치까지 이동(바퀴는 계속 회전)
      MG.HitFx.cannonWheelRoll(); // 바퀴 굴러가는 소리(사용자 제공, Pixabay) — 이동 시작과 동시에
      setTimeout(() => { // 도착 — 3시 방향 포즈로 전환(바퀴는 이 포즈 그림에 이미 있어 오버레이 숨김)
        if (myGen !== sessionGen) return;
        wheels.forEach((w) => w.classList.add('ci-hide'));
        rig.style.width = '25%'; // a3 실측 24.2% + 15%, 다시 -10%(사용자 지정)
        body.src = 'assets/weapons/cannon-a3-mirror.png';
        MG.HitFx.cannonRotateClick(); // 각도 전환 "철컥" 소리(사용자 제공)
      }, travelMs); // GO!(라운드1)/타이핑 끝(라운드2~10) 타이밍에 정착이 맞춰지도록(사용자 지정)
      setTimeout(() => { // 12시 방향 포즈로 전환
        if (myGen !== sessionGen) return;
        rig.style.width = '23.6%'; // a4 실측 21.6% + 15%, 다시 -5%(사용자 지정)
        body.src = 'assets/weapons/cannon-a4-mirror.png';
        MG.HitFx.cannonRotateClick(); // 각도 전환 "철컥" 소리(사용자 제공)
      }, travelMs + holdMs);
      setTimeout(() => { // 완료 — 인트로 숨기고 실제 대포(평소 대기 포즈)로 교체
        if (myGen !== sessionGen) return;
        ci.hidden = true;
        rig.className = 'ci-rig';
        setHammerLayerVisible(true);
      }, travelMs + holdMs * 2);
    }

    // 골드해머 라운드 인트로 등장 연출(사용자 지정 "회전 등장") — 키패드 '✱' 키 위치에서 작게·
    // 0도 포즈로 시작해, 대기 위치로 날아가며 회전(느리게→빠르게)·확대(작게→크게) 동시 진행,
    // 회전이 정확히 대기 각도에 맞춰 끝나는 순간 기본 스프라이트로 교체해 안착.
    // 시작 좌표는 실행 시점에 '✱' 키를 직접 찾아 실측한다 — 다이얼패드(.dialpad)는 보드
    // (#mole-hammer-layer, --sq 기준 정사각형)와 별개 레이아웃이라, 화면 비율이 다르면 고정
    // 분수값 하나로는 두 좌표계 비율이 안 맞아 화면 크기별로 위치가 어긋난다(사용자 지적).
    function playGoldHammerIntro(fast) {
      if (!state.laneHammer || !state.laneHammer.spinIn) return;
      setHammerLayerVisible(true);
      const layer = document.getElementById('mole-hammer-layer');
      const starNum = Array.from(document.querySelectorAll('#lane-button-bar .lane-button .lane-num'))
        .find((n) => n.textContent.trim() === '✱');
      let sx = GH_SPIN_START.x, sy = GH_SPIN_START.y; // 폴백(요소를 못 찾을 때만)
      if (layer && starNum) {
        const lr = layer.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(starNum);
        const r = range.getBoundingClientRect();
        sx = (r.x + r.width / 2 - lr.x) / lr.width;
        sy = (r.y + r.height / 2 - lr.y) / lr.height;
      }
      const ms = fast ? 3380 : 1260; // 타이틀 단계 삭제 후 전체 흐름 250+1010=1260ms — Puppeteer 재검증
      state.laneHammer.spinIn(sx, sy, ms, 4, 0.04, () => {});
      const SOUND_MS = 1837; // audio/goldhammer-spin.mp3 실측 길이(ffprobe) — 재생이 착지 시점에 끝나도록
      setTimeout(() => { if (myGen === sessionGen) MG.HitFx.goldHammerSpin(); }, Math.max(0, ms - SOUND_MS));
    }

    // 뿅망치 라운드 인트로 등장 연출(사용자 지정 "쭉 늘어났다 팡 등장").
    function playHammerIntro(fast) {
      if (!state.laneHammer || !state.laneHammer.popIn) return;
      setHammerLayerVisible(true);
      const total = fast ? 3380 : 1260; // 타이틀 단계 삭제 후 전체 흐름 250+1010=1260ms — Puppeteer 재검증
      const popMs = 650;
      const delay = Math.max(0, total - popMs);
      state.laneHammer.popIn(delay, popMs, () => {});
      setTimeout(() => { if (myGen === sessionGen) MG.HitFx.hammerPop(); }, delay); // 뿅 소리 — 등장과 동시에
    }

    // 매 라운드 시작: 타이핑 뒤 Ready → GO!. 끝나면 finish() 호출.
    // 알리 펀치 장착 시 — "Ready"=만남 제스처 → "GO!"=만남 제스처 + fight 음향.
    function runCountdown(finish) {
      count.hidden = false;
      const alipunchReady = state.weapon === 'alipunch' && state.laneHammer && state.laneHammer.meet;
      if (alipunchReady) { setHammerLayerVisible(true); tickHammerDuring(650 + 360); }
      const STEPS = ['Ready', 'GO!']; // 무조건 영어 (사용자 지정, 스펠링 확인됨)
      let i = 0;
      (function tick() {
        if (myGen !== sessionGen) return;
        const go = i >= STEPS.length - 1;
        count.textContent = STEPS[i];
        count.className = 'round-intro-count ' + (go ? 'cgo' : 'c' + (STEPS.length - i));
        void count.offsetWidth;
        count.classList.add('pop'); // 줌인 애니
        if (alipunchReady) {
          state.laneHammer.meet(); // "Ready"·"GO!" 둘 다 만남 제스처
          if (go) MG.HitFx.fight(); // 마지막("GO!")에만 fight 음향(사용자 지정)
        }
        i++;
        if (i < STEPS.length) setTimeout(tick, 650);
        else setTimeout(finish, 360);
      })();
    }

    // 퇴장(타이틀 왼쪽 / GO! 오른쪽 / 커튼 오픈) + 정리 + onDone.
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
      runCountdown(exitAndStart);
    }, 250); // 챕터/라운드 커튼 열린 직후 바로 (모든 라운드 공통)
  }

  // 라운드 경과시간에 따라 state.config 의 시간형 필드를 매 프레임 갱신한다. spawn-scheduler.js
  // 는 config 를 참조로 받아 매번 새로 읽으므로(create() 시점에 캐싱하지 않음), 여기서 같은
  // 객체를 직접 mutate 하면 별도 훅 없이 그대로 반영된다.
  function updateLiveDifficulty() {
    if (!state) return;
    const cfg = state.config;
    const elapsed = roundSeconds() - state.timeRemaining;
    if (isSmallBoardChapter()) {
      // 라운드1(구 챕터1~2~3 병합) — 60초, 3구간(각 20초) 연속. 두더지 수만 전 구간에서
      // 연속 보간, 다타·동물은 시간 임계값에서 켜진다(자막 없이).
      cfg.maxConcurrentMoles = Math.round(MG.interpolate(MG.SMALL_CHAPTER_MOLES, elapsed, ROUND1_SECONDS));
      cfg.multiHit = elapsed >= 20;
      cfg.obstacles = elapsed >= 40;
      cfg.maxConcurrentAnimals = elapsed >= 40 ? Math.round(MG.interpolate([0, 2], elapsed - 40, 20)) : 0;
    } else {
      // 실플레이 100초를 원래 140초짜리 난이도 커브의 40~140초 구간에 매핑(위 상수 설명 참고) —
      // 앞 40초(너무 쉬운 구간)를 건너뛰고 그만큼 압축된 난이도로 시작한다.
      const curveElapsed = elapsed + DIFFICULTY_CURVE_OFFSET;
      const total = DIFFICULTY_CURVE_SECONDS;
      const ch = currentChapter();
      cfg.popDuration = MG.interpolate(MG.MOLE_DURATION, curveElapsed, total);
      cfg.maxConcurrentMoles = Math.round(MG.interpolate(cfg.reverseTarget ? MG.MAX_CONCURRENT_ANIMALS : MG.MAX_CONCURRENT_MOLES, curveElapsed, total));
      cfg.maxConcurrentAnimals = Math.round(MG.interpolate(cfg.reverseTarget ? MG.MAX_CONCURRENT_MOLES : MG.MAX_CONCURRENT_ANIMALS, curveElapsed, total));
      // 게이팅은 currentChapter() 로 직접 판정(§4) — cfg 의 현재값(예: bombChance)으로 게이팅을
      // 판단하면 커브 자체가 0에서 시작하는 라운드(막 켜진 라운드3의 t=0)와 아예 꺼진 라운드를
      // 구분할 수 없어, 켜진 라운드가 라운드 내내 0에 고정되는 버그가 있었다(Puppeteer 로 실측 확인).
      if (ch >= 3) {
        cfg.maxConcurrentBombs = Math.round(MG.interpolate(MG.MAX_CONCURRENT_BOMBS, curveElapsed, total));
        cfg.bombChance = MG.interpolate(MG.BOMB_CHANCE_BY_ROUND, curveElapsed, total);
      }
      if (ch >= 4) {
        cfg.strongBombChance = MG.interpolate(MG.STRONG_BOMB_CHANCE_BY_ROUND, curveElapsed, total);
      }
    }
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

    updateLiveDifficulty();
    const tickResult = state.scheduler.tick(dt);
    // 타겟(§8·§10 에 따라 두더지 또는 동물일 수 있음)을 처치 못 하고 시간초과로 놓치면
    // 헛방·방해물과 동일하게 콤보 초기화.
    if (tickResult.expired.some((e) => effectiveHitType(state.config, e.type) === 'mole' && e.timedOut)) run.combo.onObstacleHit();
    // "의문사" 방지(사용자 지정) — 무적 중에 올라온 방해물은, 그 사이 무적이 끝나도
    // 계속 안전 취급되도록 스폰 순간에 낙인찍는다(spawn-scheduler.js 가 그대로 전달).
    if (alipunchInvincible()) {
      tickResult.spawned.forEach((p) => {
        if ((effectiveHitType(state.config, p.type) === 'animal') || p.type === 'bomb') p.safeAlways = true;
      });
    }
    state.laneHammer.update(rawDt); // 망치는 히트스톱과 무관하게 부드럽게
    if (state.aliClones.length) state.aliClones.forEach((g) => g.update(rawDt)); // 알리펀치 분신 글러브
    // 방금 그 타격(예: 폭탄으로 하트 0)이 laneHammer 의 impact 콜백을 통해 동기적으로
    // finish()/roundComplete() 를 이미 불렀을 수 있다 — 그러면 이 프레임의 나머지(재렌더·
    // hot 재계산·다음 rAF 예약)를 마저 돌리면 방금 finish() 가 지운 상태(resetHot·팝 clear)를
    // 도로 덮어써버린다(사용자 보고 — 폭탄 실패 후 다이얼패드에 원형 하이라이트가 남는 버그).
    if (state.ended) return;
    syncPops();

    // 구멍별 버튼 hot: 그 구멍에 타겟(방해물 아님)이 떠 있으면 빛낸다 (스펙 §2.3).
    // 알리 펀치 무적 중엔 방해물도 안전한 타격 대상이 되므로 타겟과 동일하게 hot 표시.
    const invincibleNow = alipunchInvincible();
    const moleRegions = new Set();
    const safeAnimalRegions = new Set(); // 무적 중 안전해진 동물 — hot 색을 노랑으로(사용자 지정)
    const bombRegions = new Map(); // 폭탄 든 두더지가 뜬 구멍 → 'normal'|'strong' (다이얼패드 표시용, 사용자 지정)
    state.scheduler.getActivePops().forEach((p) => {
      // 저글 보너스 유도용으로 죽은 뒤에도 잠깐 hot 을 켜뒀었는데, 2·3타 두더지가 살아서
      // 켜진 것과 구분이 안 돼 헷갈린다는 지적(사용자 지정) — 죽으면(dying) 바로 꺼짐.
      // 저글 보너스 자체(점수)는 spawn-scheduler.js resolveOne() 쪽 판정이라 안 건드림, 화면
      // 힌트만 없어짐(터치 물결 애니메이션이 끝나면 바로 사라짐).
      // p.dying 은 최종 타격 후 SINK_DELAY(0.17s, 망치 스윙 도달 싱크용)가 지나야 켜져서, 그동안
      // hot 표시가 안 꺼져 "성공했는데 늦게 없어진다"는 지적(사용자 지정) — sinkIn>0(최종 타격은
      // 이미 등록됨, 침몰 대기 중)도 같이 걸러 타격 성공 즉시(다음 프레임) 꺼지게 한다.
      if (p.dying || p.sinkIn > 0) return;
      const et = effectiveHitType(state.config, p.type);
      if (et === 'mole') moleRegions.add(p.regionId);
      else if ((invincibleNow || p.safeAlways) && et === 'animal') { moleRegions.add(p.regionId); safeAnimalRegions.add(p.regionId); }
      if (p.bombKind) bombRegions.set(p.regionId, p.bombKind);
    });
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) {
      sharedLaneControls.setCellHot(id, moleRegions.has(id), safeAnimalRegions.has(id));
      sharedLaneControls.setBombIndicator(id, bombRegions.get(id) || null);
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
  // 피버타임 = 콤보 50 이상. 라운드1(구챕터1~3 병합)은 obstacles 게이트(40초부터, 구챕터3부터
  // 켜지던 것과 동일 시점) 이후부터만, 라운드2~8은 항상 가능.
  function isFever() {
    return !!(run && run.combo.combo >= 50 && (currentChapter() !== 1 || (state && state.config && state.config.obstacles)));
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
      round: currentChapter(),
      lives: run.lives,
      timeRemaining: state.timeRemaining,
      timeTotal: roundSeconds(),
      combo: run.combo.combo,
      isMaxCombo: run.combo.isMaxCombo(),
      score: run.combo.score, // 1라운드부터 누적 (콤보·점수 한 통)
      modeLabel: chapterLabel(currentChapter()), // 게임화면 티커 맨 앞 = 현재 챕터 이름 ("두더지팡" 대체)
      chapterDesc: chapterDesc(currentChapter()) // 챕터2~10 안내문구 — 있으면 티커의 기존 팁 문구 대체(사용자 지정)
    });
    updateFeverHud();
    updateInvincibleHud();
  }

  function syncPops() {
    sharedPopElements.sync(state.scheduler.getActivePops());
  }

  // 모든 구멍 버튼의 hot 하이라이트를 끈다 (라운드 시작/시작 화면 복귀 시).
  function resetHot() {
    if (!sharedLaneControls) return;
    for (let id = 0; id < GRID_SIZE * GRID_SIZE; id++) {
      sharedLaneControls.setCellHot(id, false);
      sharedLaneControls.setBombIndicator(id, null);
    }
  }

  // 알리 펀치 무적 연출 잔류 버그 수정 — 루프가 멈추면(라운드 종료/홈 복귀 등)
  // updateInvincibleHud() 가 더 이상 안 불려서 보드 테두리·카운트다운·연기 아우라·황금
  // 글러브가 남아있었다. 성공/실패 결과화면 포함, 라운드가 끝나는 모든 경로에서 호출
  // (사용자 지정: "성공/실패 화면은 항상 스킬 효과가 안 나타나게 해야함").
  function clearInvincibleFx() {
    const mb = document.getElementById('mole-board');
    if (mb) mb.classList.remove('mole-board--invincible');
    const gs = document.getElementById('game-screen');
    if (gs) gs.classList.remove('gs-invincible');
    const cd = document.getElementById('invincible-countdown');
    if (cd) cd.hidden = true;
  }

  // ---------- 구멍 버튼 입력 → 그 구멍 타격 ----------
  function handleCell(regionId) {
    if (!state || state.ended || state.introActive || state.paused) return false;
    const sp = state.spawnPoints.find((s) => s.regionId === regionId);
    if (!sp) return false; // 대포 모드에서 없앤 구멍(15) 탭 = 무시 (헛방 처리 안 함)
    // 알리 판취 = 2·3타 두더지도 한 번에 소탕(사용자 지정).
    const results = state.scheduler.resolveRegion(regionId, state.weapon === 'alipunch' ? { alipunch: true } : undefined);

    const primary = results[0] || null;
    const targetX = primary ? primary.xFrac : sp.x;
    const targetY = primary ? primary.yFrac : sp.y;

    // 두더지 현재 프레임(전신/빠끔1/빠끔2/모자)에 따라 망치 타격점 높이가 달라진다 — 헬멧을 때린다.
    const frameKey = sharedPopElements.frameKeyAt ? sharedPopElements.frameKeyAt(regionId) : null;
    // regionId 는 알리 펀치가 어느 글러브·펀치스타일로 때릴지 구역 판정에 쓴다(다른 무기는 무시).
    state.laneHammer.strike(targetX, targetY, () => onHammerImpact(targetX, targetY, results, { regionId }), frameKey, regionId);

    // 대포 연사: 이번 첫 타에 burst 가 떴으면 — 그 두더지 흙더미에 "BURST!" 띄우고(발동 즉시 인지),
    // 남은 타격을 자동 연속 발사 → 1마리 클리어.
    if (primary && primary.type === 'mole' && primary.burst && primary.done === false && primary.hitsTaken === 1) {
      MG.HitFx.burstWord(document.getElementById('mole-board'), primary.xFrac, primary.yFrac);
      if (sharedLaneControls) sharedLaneControls.flashBurst(regionId); // 이번(유저) 샷 = 골드 링
      burstAutoFire(regionId, primary.hitsRequired - 1);
    }

    // 골드해머 지진: "실제 타겟" 타격 성공 시(중간타 포함, 저글/무시 제외) 15% 발동. 예전엔
    // primary.type==='mole' 원본 타입만 봐서, 라운드6(reverseTarget=동물이 타겟)에서 두더지
    // (=방해물)를 잘못 쳐도 지진이 발동 → 연쇄로 주변 두더지(=방해물)를 더 때려 페널티만 쌓이는
    // 버그가 있었음(사용자 리포트) — effectiveHitType 으로 "진짜 타겟"인지 판정하도록 수정.
    if (state.weapon === 'goldhammer' && primary && effectiveHitType(state.config, primary.type) === 'mole' && typeof primary.done === 'boolean') {
      if (forceQuakeNext || state.rng.next() < QUAKE_CHANCE) {
        forceQuakeNext = false;
        if (sharedLaneControls) sharedLaneControls.flashBurst(regionId); // 캐논과 동일한 골드 링(사용자 지정)
        setTimeout(() => quakeRipple(regionId, 0), 40);
      }
    }

    // 버튼 이펙트 색: 헛방(구멍에 아무것도 없음) 또는 폭탄이면 빨간색.
    // 알리 펀치 무적 중엔 폭탄도 안전한 타격이므로 빨간색 아님(초록).
    return results.length === 0 || (results.some((r) => r.type === 'bomb' && !r.safe) && !alipunchInvincible());
  }

  // ---------- 골드해머: 지진 ----------
  // 발동 구멍 + 주변 8칸의 두더지에게 "지진 분신 골드해머"가 날아가 각 1대씩 (1타=처치, 다타=한 단계).
  // 폭탄·장애물·동물은 스킵. 자동타격당한 두더지도 각자 15% 재발동 → 연쇄. 콤보·점수는 반영,
  // hitstop 은 안 건다(플레이어 직접타격만). 분신 포즈는 목표 구멍의 다이얼패드 위치 기준(사용자 지정).
  const QUAKE_CHANCE = 0.15;
  const QUAKE_MAX_DEPTH = 4;
  const QUAKE_CLONE_GAP = 55; // ms — 분신들 시차 연타
  let forceQuakeNext = false; // __debugForceQuake

  // 캐논 분신 발사 시작점 — 게임판 "밖"(화면 밖에 분신 대포가 있다고 치고, 사용자 지정)에서
  // 왼쪽 외곽을 타고 내려오다 좌하단 모서리를 돌아 아래쪽 외곽을 타고 이동하는 경로 위의
  // 랜덤한 한 점. 경로 양끝(사용자 지정): (1) 3번째 줄(row index2) 왼쪽열 높이의 왼쪽 바깥쪽,
  // (2) 4번째 줄(row index3) 3번째 구멍(#, regionId14) 아래쪽 바깥. grid-partition.js 의
  // V_TOP=0.27/V_BOTTOM=0.88/gridSize=4 기준 좌표(vStep=(0.88-0.27)/3).
  // 아래쪽 경로는 게임판 경계(y=1.0) 밑으로 내려가면 다이얼패드(버튼보드) 외곽선에 닿아
  // 보인다(사용자 지정 — "시작점은 버튼 위어야함", "다이얼패드 외각선은 포탄이 건들면
  // 안됨") — y=0.97 로 판 바닥 경계 안쪽에 머물게 클램프.
  const CANNON_CLONE_PATH_A = { x: -0.06, y: 0.27 + ((0.88 - 0.27) / 3) * 2 };  // 3행 왼쪽열 높이
  const CANNON_CLONE_PATH_CORNER = { x: -0.06, y: 0.97 };                      // 좌하단 바깥 모서리(판 안쪽 경계)
  const CANNON_CLONE_PATH_B = { x: (2 + 0.5) / 4, y: 0.97 };                    // 4행 3번째구멍(#) 아래(판 안쪽 경계)
  function randomCannonCloneStart() {
    const seg1 = CANNON_CLONE_PATH_CORNER.y - CANNON_CLONE_PATH_A.y; // 왼쪽 외곽 구간(세로)
    const seg2 = CANNON_CLONE_PATH_B.x - CANNON_CLONE_PATH_CORNER.x; // 아래쪽 외곽 구간(가로)
    const t = Math.random() * (seg1 + seg2);
    if (t < seg1) return { x: CANNON_CLONE_PATH_A.x, y: CANNON_CLONE_PATH_A.y + t };
    return { x: CANNON_CLONE_PATH_CORNER.x + (t - seg1), y: CANNON_CLONE_PATH_CORNER.y };
  }

  // 분신 포즈 = 목표 구멍의 다이얼패드 위치 기준 (사용자 지정).
  //  ✱·0·#(12·13·14) = 0°(옆면, 아래로 내리침) / 연락처·키패드·최근기록(3·7·11) = 90°(정면, 직선 찌르기) / 나머지 = 45°(대각선, 내리침)
  function quakeCloneKind(regionId) {
    if (regionId === 12 || regionId === 13 || regionId === 14) return '0';
    if (regionId === 3 || regionId === 7 || regionId === 11) return '90';
    return '45';
  }
  function quakeClonePose(regionId) {
    const kind = quakeCloneKind(regionId);
    // 45(대각선)는 전용 스프라이트 없이 기본 대기 포즈(goldhammer.png, 이미 로드돼있음)를 그대로 쓴다.
    if (kind === '45') return 'assets/weapons/goldhammer.png';
    return 'assets/weapons/goldhammer-' + kind + '.png';
  }

  function quakeNeighbors(regionId) {
    const row = Math.floor(regionId / GRID_SIZE), col = regionId % GRID_SIZE;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
        out.push(nr * GRID_SIZE + nc);
      }
    }
    return out;
  }

  function liveMoleAt(id) {
    // 지진은 폭탄 든 두더지는 스킵해야 함(원래 기획 — 폭탄은 구식 type==='bomb' 시절 걸러졌는데,
    // 지금은 폭탄도 type==='mole'(bombKind 만 다름)라 여기서 새로 막아야 함(사용자 보고 — 지진이
    // 폭탄 두더지를 때려 하트가 깎임).
    return state.scheduler.getActivePops().find((q) =>
      q.regionId === id && q.type === 'mole' && !q.bombKind && !q.dying && !q.killed && !(q.sinkIn > 0));
  }

  function quakeRipple(originId, depth) {
    depth = depth || 0;
    if (!state || state.ended || depth > QUAKE_MAX_DEPTH) return;
    const board = document.getElementById('mole-board');
    const fxLayer = document.getElementById('mole-hammer-layer'); // overflow:visible — 분신이 보드 밖에서 날아듦
    const sp0 = state.spawnPoints.find((s) => s.regionId === originId);
    const area = [originId].concat(quakeNeighbors(originId))
      .filter((id) => state.spawnPoints.some((s) => s.regionId === id));

    // 지진 처리 중엔 이 구역에 새 두더지가 안 뜨게 잠갔다가, 연출(lane-controls.js
    // flashQuakeArea 와 같은 640ms) 끝나면 푼다(사용자 지정). scheduler 참조를 미리 붙잡아
    // 둬야 그 사이 라운드가 넘어가 새 scheduler 가 생겨도 엉뚱한 걸 풀지 않는다.
    const lockedScheduler = state.scheduler;
    lockedScheduler.lockMoleRegions(area);
    setTimeout(() => { lockedScheduler.unlockMoleRegions(area); }, 640);

    MG.HitFx.shake(board);
    if (sp0) MG.HitFx.quakeDust(board, sp0.x, sp0.y);

    const killed = [];
    const paintPad = () => {
      if (sharedLaneControls && sharedLaneControls.flashQuakeArea) {
        sharedLaneControls.flashQuakeArea(area, killed.slice());
      }
    };
    paintPad();

    const targets = quakeNeighbors(originId).filter((id) =>
      state.spawnPoints.some((s) => s.regionId === id) && liveMoleAt(id));

    targets.forEach((id, k) => {
      setTimeout(() => {
        if (!state || state.ended) return;
        const p = liveMoleAt(id);
        if (!p) return;
        const res = state.scheduler.resolveRegion(id, { quake: true });
        if (!res.length || res.every((r) => r.ignored)) return;
        MG.HitFx.quakeClone(fxLayer, quakeClonePose(id), p.x, p.y, quakeCloneKind(id), () => {
          if (!state || state.ended) return;
          onHammerImpact(p.x, p.y, res, { noHitstop: true });
          MG.HitFx.quakeDust(board, p.x, p.y);
          if (res.some((r) => r.type === 'mole' && r.done)) { killed.push(id); paintPad(); }
          if (!forceQuakeNext && state.rng.next() < QUAKE_CHANCE) quakeRipple(id, depth + 1);
        });
      }, k * QUAKE_CLONE_GAP);
    });
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
      if (sharedLaneControls) sharedLaneControls.flashBurst(regionId); // 자동샷 = 골드 링 (대포 3발과 동기)
      state.laneHammer.strike(tx, ty, () => { onHammerImpact(tx, ty, res); }, fk);
      burstAutoFire(regionId, n, i + 1);
    }, BURST_SHOT_GAP);
  }

  // 알리 펀치 [공격력]: 무적 중이면 동물/폭탄도 안전하게 처리(§7 "어떤 대상이든 공격 가능").
  function alipunchInvincible() {
    return state.weapon === 'alipunch' && performance.now() < state.alipunchInvincibleUntil;
  }

  // 챕터8(reverseTarget): 동물이 타겟·두더지가 방해물 → 서로 바꿔서 취급.
  // 챕터10(dualTarget): 두더지·동물 둘 다 타겟 → 동물도 "mole"로 취급.
  // 그 외(item·bomb, 일반 챕터)는 그대로. 스프라이트(무엇으로 보이는지)는 건드리지 않고
  // 이 타격의 점수/연출/페널티 분기만 바꾼다.
  function effectiveHitType(cfg, type) {
    if (type !== 'mole' && type !== 'animal') return type;
    if (cfg && cfg.dualTarget) return 'mole';
    if (cfg && cfg.reverseTarget) return type === 'mole' ? 'animal' : 'mole';
    return type;
  }

  function onHammerImpact(hitXFrac, hitYFrac, results, opts) {
    if (!state || state.ended) return;
    const board = document.getElementById('mole-board');
    const cfg = state.config || {};
    let moleHits = 0;
    run.combo.setMult(currentScoreMult()); // 라이트·피버 배율 (이번 타격에 적용)

    results.forEach((r) => {
      if (r.ignored) return; // 연타 쿨다운 중 타격 — 점수·연출·콤보 변화 없음 (헛방도 아님)
      const effType = effectiveHitType(cfg, r.type);
      // 폭탄 든 두더지(bombKind)는 챕터8 역할반전(reverseTarget)과 무관하게 항상 두더지
      // 쪽 분기로 — 폭탄은 언제나 "두더지가 든 것"이지 동물로 옮겨간 게 아님(사용자 지정).
      if (effType === 'mole' || r.bombKind) {
        if (r.juggle) {
          const before = run.combo.score;
          run.combo.onJuggle(JUGGLE_BONUS); // 콤보 +1 + 작은 고정 보너스 (점수표 안 씀)
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();
          MG.HitFx.juggle(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else if (r.done && r.bombKind) {
          // 폭탄 든 두더지(2026-09-14 확정) — 점수 없이 페널티만. 일반 하트-1, 강력 하트-2.
          // 챕터8(reverseTarget)은 두더지 자체가 장애물이라 기본 장애물 페널티(-1)가 폭탄
          // 페널티에 합산됨(사용자 지정: "두더지 -1 + 폭탄 -1/강력-2, 합산") — 일반 -1→-2,
          // 강력 -2→-3. 다른 챕터(두더지=타겟)는 기존 그대로 -1/-2.
          // 동물/폭탄 방해물과 동일하게 콤보 리셋. 연출은 대포 처치 폭발 기반 전용 함수
          // bombBlast(사용자 지정 — moleBlast 는 안 건드림, 캐논 무기 자체 연출과 분리).
          // pop-elements.js 의 m.blast 도 bombKind 면 무기 무관 항상 켜짐, 여기와 세트.
          const bombPenalty = (cfg.reverseTarget ? 1 : 0) + (r.bombKind === 'strong' ? 2 : 1);
          setRunLives(run.lives - bombPenalty);
          run.combo.onObstacleHit();
          MG.HitFx.bombBlast(board, r.xFrac, r.yFrac);
          flashHud('hud-hearts');
        } else if (r.done) {
          const before = run.combo.score;
          run.combo.onMoleHit();   // 스펙 §12 — 마리당 1콤보 (콤보·라이트·피버 배율은 setMult 로 이미 반영)
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();   // 콤보 100단위 넘기면 목숨 +1
          // 처치(마지막) 타격에만: 대포면 폭발 흩뿌림, 알리 펀치면 별 이펙트(피격연출은 pop-elements.js
          // m.punch 가 담당), 아니면 기존 타격. 중간타(빼꼼/모자)는 손 안 댐.
          if (state.weapon === 'cannon') {
            MG.HitFx.moleBlast(board, r.xFrac, r.yFrac);
          } else if (state.weapon === 'alipunch') {
            MG.HitFx.shake(board);
            MG.HitFx.punch(); // 랜덤 타격음 (별 이펙트만으로는 소리가 안 남 — 버그 수정)
            MG.HitFx.punchStar(board, r.xFrac, r.yFrac);
            // [공격력] 무적 발동 확률 20%, 5초(§7).
            if (state.rng.next() < ALIPUNCH_INVINCIBLE_CHANCE) {
              state.alipunchInvincibleUntil = performance.now() + ALIPUNCH_INVINCIBLE_MS;
              MG.HitFx.powerUpWord(board); // "POWER UP" — 무적 발동 알림(보드 중앙)
              // 캐논과 동일한 골드 링(사용자 지정).
              if (sharedLaneControls && opts && opts.regionId != null) sharedLaneControls.flashBurst(opts.regionId);
            }
          } else MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          MG.HitFx.moleTap(board, r.xFrac, r.yFrac);
        }
      } else if (effType === 'item') {
        run.shield = true;              // 실드 아이템 획득 — 폭탄 1회 방어
        MG.HitFx.moleHit(board, r.xFrac, r.yFrac);
        flashHud('hud-hearts');
        updateShieldHud();
      } else if (effType === 'animal') {
        if (alipunchInvincible() || r.safe) {      // 무적 중(또는 무적 중 스폰돼 낙인찍힌 개체) — 페널티 무효, 안전 타격 취급(점수·콤보도 반영)
          const before = run.combo.score;
          run.combo.onJuggle(JUGGLE_BONUS);
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();
          MG.HitFx.shake(board);
          MG.HitFx.punch(); // 랜덤 타격음 — 두더지 처치와 동일한 연출
          MG.HitFx.punchStar(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else {
          setRunLives(run.lives - 1);     // 동물 = 공유 생명 -1 (즉시 풀에 반영)
          run.combo.onObstacleHit();
          MG.HitFx.obstacleHit(board, r.xFrac, r.yFrac, 'animal');
          flashHud('hud-hearts');
        }
      } else if (effType === 'bomb') {
        if (alipunchInvincible() || r.safe) {      // 무적 중(또는 무적 중 스폰돼 낙인찍힌 개체) — 페널티 무효, 안전 타격 취급(점수·콤보도 반영)
          const before = run.combo.score;
          run.combo.onJuggle(JUGGLE_BONUS);
          MG.HitFx.scorePop(board, r.xFrac, r.yFrac, run.combo.score - before);
          checkComboLifeBonus();
          MG.HitFx.juggle(board, r.xFrac, r.yFrac);
          moleHits += 1;
        } else if (run.shield) {               // 실드가 폭탄을 막는다 (페널티 무효)
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
    if (moleHits > 0 && !(opts && opts.noHitstop)) { // 지진 자동타격·연쇄엔 hitstop 안 검 (시간 안 끊기게)
      state.hitstopUntil = performance.now() +
        Math.min(HITSTOP_MAX_MS, HITSTOP_BASE_MS + run.combo.combo * 10);
    }

    syncPops();
    updateHUD();
    if (run.lives <= 0) {
      finish('lives');
    }
  }

  // 콤보가 100·200·300… 을 새로 넘겼으면 공유 생명 보상 (풀에 영구 반영).
  // 보상 개수는 라이트 모드별로 다름: ON(easy) 없음 / DIM(mid) +1 / OFF(legend) +2.
  function checkComboLifeBonus() {
    const step = Math.floor(run.combo.combo / COMBO_LIFE_STEP);
    if (step > run.comboMilestone) {
      const blocks = step - run.comboMilestone;
      run.comboMilestone = step;
      const per = COMBO_LIFE_BONUS[currentDifficulty()] || 0;
      const amount = blocks * per;
      if (amount <= 0) return;
      setRunLives(run.lives + amount);
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

  // 알리 펀치 무적(§7) 표시 = 보드에 회전하는 파란 테두리 + 다이얼패드 중앙 카운트다운(5→1)
  // + 무적 중 두더지 하강 딜레이 보너스 0.1초 → 0.4초(기본 0.1 + 무적 중 0.3 추가).
  // 매 프레임 갱신, 시간 만료로 자동 해제.
  function updateInvincibleHud() {
    const on = alipunchInvincible();
    const b = document.getElementById('mole-board');
    if (b) b.classList.toggle('mole-board--invincible', on);
    const cd = document.getElementById('invincible-countdown');
    if (cd) {
      cd.hidden = !on;
      if (on) cd.textContent = String(Math.max(1, Math.ceil((state.alipunchInvincibleUntil - performance.now()) / 1000)));
    }
    if (state.weapon === 'alipunch') state.config.moleUpBonus = on ? 0.4 : 0.1;
    // 무적 중 권투 글러브 빨간색 → 황금색(글러브는 #mole-hammer-layer, 보드 밖이라 game-screen에 표시).
    const gs = document.getElementById('game-screen');
    if (gs) gs.classList.toggle('gs-invincible', on);
  }

  // 게임은 더보기 메뉴를 열면 멈춘다(state.paused / pausedByMenu — openMore·closeMore 참고).
  // 별도 일시정지 버튼은 없앰(사용자 요청).

  // ---------- 라운드 종료 → 다음 라운드 or 최종 결과 ----------
  // 챕터→라운드 재구조화(2026-09-17): 라운드(1~8) 하나 = 이제 그 자체로 완결된 세션(60초/100초).
  // 더 이상 "다음 내부 라운드로 자동 이어가기"가 없다 — 시간이 다 되면 항상 결과 화면으로.
  function roundComplete() {
    if (!state || state.ended) return;
    state.ended = true;
    sessionGen++; // 직전 카운트다운 정리 타이머 무효화
    if (rafId) cancelAnimationFrame(rafId);
    if (state.laneHammer) state.laneHammer.home(); // 루프 멈추기 전 망치 대기위치로 스냅
    sharedPopElements.clear();
    resetHot();
    clearInvincibleFx(); // 라운드 종료 시 무적 잔류 연출 정리(사용자 지정)
    closeCurtain(() => { finishFromRound('done'); });
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
    clearInvincibleFx(); // 실패 화면도 무적 잔류 연출 정리(사용자 지정)
    // 실패 순간 커튼이 확 닫히고 나서 결과 멘트 (사용자 요청).
    closeCurtain(() => { finishFromRound(reason); });
  }

  // 최종 결과 화면 (라운드 완주 or 목숨 소진).
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
    const fw = ov.querySelector('.go-fireworks'); // 색종이와 별개 레이어(하마 위로 겹쳐도 됨)
    fw.innerHTML = '';
    // 실패 추가 연출 4종(사용자 지정) — 이전 라운드에서 붙은 클래스·파편 정리.
    ov.classList.remove('fail-fx-1', 'fail-fx-3', 'fail-fx-4', 'fail-fx-8');
    ['fail-dust-layer', 'fail-heart-layer', 'fail-ash-layer'].forEach((cls) => {
      const el = ov.querySelector('.' + cls);
      if (el) el.innerHTML = '';
    });

    // 하마 = 기쁨/슬픔 3포즈 중 랜덤 1개
    const poseN = 1 + Math.floor(Math.random() * 3);
    const hippo = document.getElementById('gameover-hippo');
    hippo.src = 'assets/hippo/' + (win ? 'happy' : 'sad') + poseN + '.png';

    document.getElementById('gameover-reason').textContent =
      I18N.t(win ? 'mole.result.success' : 'mole.result.fail');
    document.getElementById('gameover-score').textContent =
      I18N.t('mole.result.scoreVs', { n: total.toLocaleString(), t: prog.target.toLocaleString() });
    // 버튼 없음 — 성공/실패 둘 다 좌상단 ⊞ 로 홈. (광고는 유저 피로도 때문에 뺌.)

    // 승리 + 다음 라운드가 열렸으면: 홈 화면 다이얼패드 선택값을 그 다음 라운드로 미리 넘겨둔다
    // (사용자가 홈에서 직접 골라 시작하는 흐름 — 화면 전환은 없음, §7).
    const nextCh = win ? chapter + 1 : 0;
    if (nextCh && MG.Progress.isUnlocked(nextCh, light)) setChapter(nextCh);

    // 커튼 오버레이는 결과 카드로 교체 (둘 다 z-index 10, ri 가 DOM 상 뒤라 안 치우면 위를 덮음).
    document.getElementById('round-intro-overlay').hidden = true;
    setHammerLayerVisible(false);
    ov.classList.remove('is-sliding');
    ov.hidden = false;
    // 하마 세로 크기 = 보드 높이의 40% (포즈마다 종횡비가 달라서 vh/% CSS 로는 머리가 잘렸음).
    hippo.style.maxHeight = Math.round(ov.clientHeight * 0.4) + 'px';

    setTimeout(() => {
      if (win) {
        // 방사광선 / 별팝 중 매번 랜덤 1개(사용자 지정) — 색종이+불꽃놀이는 항상 같이 나온다.
        ov.classList.remove('win-fx-rays', 'win-fx-starpop');
        const starpop = ov.querySelector('.go-starpop');
        starpop.innerHTML = '';
        if (Math.random() < 0.5) {
          ov.classList.add('win-fx-rays');
        } else {
          ov.classList.add('win-fx-starpop');
          const N = 40;
          for (let i = 0; i < N; i++) {
            const ang = (i / N) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
            const spd = 55 + Math.random() * 100;
            const s = document.createElement('i'); // clip-path 별 도형(CSS) — 텍스트 필요 없음
            s.style.setProperty('--dx', (Math.cos(ang) * spd).toFixed(0) + 'px');
            // 아래로 중력 편향(사용자 지정 후보: "중심에서 별 파편 방사" + 낙하).
            s.style.setProperty('--dy', (Math.sin(ang) * spd + 40 + Math.random() * 40).toFixed(0) + 'px');
            s.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
            s.style.animationDelay = (Math.random() * 0.15) + 's';
            starpop.appendChild(s);
          }
        }
        // 성공 = 기존 색종이 낙하 + 불꽃놀이(사용자 지정, result-fx-compare.html 후보 3번) 동시 표시 —
        // 색종이를 빼는 게 아니라 불꽃놀이를 추가하는 것(사용자 정정).
        const nConf = 150;
        for (let k = 0; k < nConf; k++) {
          const p = document.createElement('i');
          p.style.left = (Math.random() * 100) + '%';
          p.style.setProperty('--h', String(Math.round(Math.random() * 360)));
          p.style.animationDelay = (Math.random() * 2.8) + 's';
          p.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
          conf.appendChild(p);
        }
        // 방사형으로 터지는 파편(각 파편은 --dx/--dy 로 방향·거리를 받음), 보드 전체 영역에서
        // 랜덤 지점에 계속 터짐 — 화면이 닫힐 때까지 반복(사용자 지정), 파편 수는 5배 증량.
        if (winFxTimer) clearInterval(winFxTimer);
        const N = 130; // 기존 26 의 5배
        const spawnBurst = () => {
          const ox = Math.random() * 100, oy = Math.random() * 100; // 보드 전체(사용자 지정: "게임보드에 전체적으로")
          const hue = Math.random() * 360;
          const pieces = [];
          for (let i = 0; i < N; i++) {
            const ang = (i / N) * Math.PI * 2 + Math.random() * 0.3;
            const dist = 70 + Math.random() * 90;
            const p = document.createElement('i');
            p.className = 'go-spark';
            p.style.left = ox + '%'; p.style.top = oy + '%';
            p.style.setProperty('--h', String(Math.round(hue + (Math.random() * 40 - 20))));
            p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
            p.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
            fw.appendChild(p);
            pieces.push(p);
          }
          // 애니메이션(0.9s) 다 끝난 파편은 정리 — 계속 반복이라 안 지우면 DOM 이 무한히 쌓임.
          setTimeout(() => pieces.forEach((p) => p.remove()), 950);
        };
        spawnBurst();
        winFxTimer = setInterval(spawnBurst, 260);
      } else {
        // 실패 빗줄기 3배 증량(사용자 지정) — 그대로 유지.
        const n = 600;
        for (let k = 0; k < n; k++) {
          const p = document.createElement('i');
          p.style.left = (Math.random() * 100) + '%';
          p.style.animationDelay = (Math.random() * 2.8) + 's';
          p.style.animationDuration = (2.4 + Math.random() * 1.8) + 's';
          conf.appendChild(p);
        }
        // 실패 추가 연출 4종(사용자 지정, fail-fx-more.html 후보 1/3/4/8) 중 매번 랜덤 1개 —
        // 빗줄기는 그대로 두고 이 위에 얹힌다.
        const FAIL_FX = ['fail-fx-1', 'fail-fx-3', 'fail-fx-4', 'fail-fx-8'];
        const pick = FAIL_FX[Math.floor(Math.random() * FAIL_FX.length)];
        ov.classList.add(pick);
        if (pick === 'fail-fx-3') {
          const dustLayer = ov.querySelector('.fail-dust-layer');
          for (let i = 0; i < 16; i++) {
            const d = document.createElement('i');
            const ang = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
            d.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
            d.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
            dustLayer.appendChild(d);
          }
        } else if (pick === 'fail-fx-4') {
          const heartLayer = ov.querySelector('.fail-heart-layer');
          for (let i = 0; i < 14; i++) {
            const h = document.createElement('i');
            h.textContent = '💔';
            h.style.left = (Math.random() * 90) + '%';
            h.style.top = '-8%';
            h.style.animationDuration = (0.9 + Math.random() * 0.6) + 's';
            h.style.animationDelay = (0.3 + Math.random() * 0.5) + 's';
            h.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
            heartLayer.appendChild(h);
          }
        } else if (pick === 'fail-fx-8') {
          const ashLayer = ov.querySelector('.fail-ash-layer');
          for (let i = 0; i < 30; i++) {
            const a = document.createElement('i');
            a.style.left = (Math.random() * 100) + '%';
            a.style.setProperty('--sway', (Math.random() * 40 - 20).toFixed(0) + 'px');
            a.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
            a.style.animationDelay = (Math.random() * 0.6) + 's';
            ashLayer.appendChild(a);
          }
        }
      }
    }, 400); // 글자·하마 fly-in(0.4s) 끝난 뒤

  }

  // 동시에 여러 버튼(멀티터치)을 누르면 화면이 핀치줌처럼 커지는 문제(사용자 리포트) — CSS
  // touch-action:manipulation 만으로는 일부 브라우저(iOS Safari 등)가 여전히 두 손가락 제스처를
  // 확대/축소로 해석해 막지 못했음. gesturestart(사파리 핀치 전용 이벤트)와 손가락 2개 이상
  // touchmove 를 앱 전역에서 직접 preventDefault 해 이중으로 차단.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // ---------- 초기화 ----------
  document.addEventListener('DOMContentLoaded', () => {
    bgmEls = [document.getElementById('bgm-a'), document.getElementById('bgm-b')];
    bgmEls.forEach((el) => {
      el.volume = BGM_VOL;
      // 곡이 끝나갈 때(끝나고 나서가 아니라) 다음 곡으로 미리 크로스페이드 — 홈은 4곡,
      // 게임은 3곡을 순차 재생·순환(플레이리스트). 비활성 쪽 이벤트는 bgmNearEndTick 안에서 무시.
      el.addEventListener('timeupdate', () => bgmNearEndTick(el));
      el.addEventListener('canplay', applyBgm);
    });
    window.FGH.Settings.onChange((name) => {
      if (name === 'music') applyBgm();
    });
    window.FGH.retryBgm = applyBgm; // intro.js 등 외부에서 "혹시 멈춰있으면 재시도"용
    // 스플래시/인트로가 실제로 사라지는 시점에 index.html 이 호출 — 그 전까진 홈 BGM 재생을
    // 미룬다(사용자 지정, deferBgm). 이미 시작돼 있으면 아무 일도 안 함(currentBgm 그대로).
    window.FGH.startHomeBgm = () => playScreenBgm('home');
    // 홈 진입 연출(검은화면→점 확장, 사용자 지정) 동안 브금도 같이 서서히 커지게 — 0에서
    // 시작해 ms 에 걸쳐 BGM_VOL 까지 선형 램프. applyBgm/crossfadeBgm 의 볼륨 로직과는 별개로
    // 여기서만 짧게 override 했다가, 램프가 끝나면 그 뒤로는 평소 로직(applyBgm)이 관리.
    window.FGH.fadeInHomeBgm = (ms) => {
      playScreenBgm('home');
      const el = bgmActiveEl();
      if (!el) return;
      const dur = ms || 5000;
      const t0 = performance.now();
      el.volume = 0;
      (function step() {
        const el2 = bgmActiveEl(); // 크로스페이드로 활성 엘리먼트가 바뀌었을 수 있음
        if (!el2) return;
        const k = Math.min(1, (performance.now() - t0) / dur);
        el2.volume = BGM_VOL * k;
        if (k < 1) requestAnimationFrame(step);
      })();
    };
    // 자동재생 정책에 막혔을 때 대비 — 모든 입력·버퍼완료·복귀 신호에서 applyBgm() 재시도.
    // 설치형 PWA 는 로딩 직후 재생이 허용되기도 해서 그 경우 첫 신호에 바로 시작된다.
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, () => { applyBgm(); resumeBgmAudioCtx(); }, { capture: true, passive: true }));
    window.addEventListener('pageshow', applyBgm);
    setTimeout(applyBgm, 400);
    // 앱이 "오래" 가려지면(유튜브 채널 이동·다른 앱 전환·화면 잠금) BGM 정지, 돌아오면 재개.
    // 500ms 디바운스 — PWA 실행 순간 잠깐 hidden 이 깜빡여서 로딩 때 "띡" 하고 끊기던 문제(사용자 보고).
    let bgmHideTimer = null;
    document.addEventListener('visibilitychange', () => {
      clearTimeout(bgmHideTimer);
      if (document.hidden) bgmHideTimer = setTimeout(() => { if (document.hidden) { const el = bgmActiveEl(); if (el) el.pause(); } }, 500);
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

    // 다이얼러 버튼은 시작 화면에도 계속 보인다 (폰 컨셉) — 홈 화면은 항상 기존 16버튼
    // 다이얼러로 불변(사용자 지정). 챕터1~3 라운드 진행 중에만 startRound() 가
    // ensureLaneControlsForChapter(true) 로 9홀 숫자패드로 바꿨다가, 홈으로 돌아오면
    // showStartScreenNow() 가 다시 false 로 되돌린다.
    ensureLaneControlsForChapter(false, true); // false = 홈 기본값(16버튼), true = 최초 생성이라 무조건 실행
    wireChapterNav();  // ◀ 챕터 N ▶ (열린 챕터 2개 이상일 때만 노출)
    initHomeShowcase(); // 홈 화면 홍보 이미지 캐러셀(사용자 지정) — board-start 뒤에서 항상 순환

    migrateBest();
    wireMoreMenu();
    wireLightPopup();

    // ⚠️ 핵심 리스너 배선을 showStartScreen() 보다 먼저 — showStartScreen 안에서 예외가 나도
    // (예: 스테일 캐시로 모듈 하나 누락) ⊞ 홈버튼·일시정지 등이 죽지 않도록.
    // 좌상단 아이콘 — 홈: 프로필 사진(탭하면 사진 변경). 실제 플레이 중: 홈 아이콘(탭하면
    // 라운드 나가고 홈으로, 사용자 지정 — 더보기 화면이 다이얼패드로 흡수돼 필요 없어짐).
    document.getElementById('btn-back-to-hub').addEventListener('click', (e) => {
      if (navLocked) return; // 인트로/카운트다운/라운드 전환 중엔 안 먹힘 (회색 음영)
      // 결과 화면에선 = 곧장 홈으로 (다시하기 버튼 없앰 — 중복).
      if (!document.getElementById('gameover-overlay').hidden) { showStartScreen({ retry: true, originEl: e.currentTarget }); return; }
      const isStart = document.getElementById('game-screen').classList.contains('is-start');
      if (isStart) { editProfileAvatar(); return; }
      showStartScreen();
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

    // 첫 화면 = 두더지 오빠 대화. (예외가 나도 위 배선은 이미 끝났음. 최초 진입은 플래시 없음.)
    // deferBgm: 스플래시/인트로가 화면을 덮고 있는 동안엔 홈 BGM 재생을 미룬다(사용자 지정).
    try { showStartScreen({ skipFlash: true, deferBgm: true }); } catch (e) { console.error('showStartScreen failed', e); }

    // 디버그 훅 — 지렁이 게임과 동일 컨벤션, 영구 보존.
    window.__debugStartGame = (diff, chapter) => {
      loadActiveFace().then(() => {
        currentDiff = DIFFS.indexOf(diff) > -1 ? diff : 'easy';
        localStorage.setItem('mole.difficulty', currentDiff);
        if (chapter >= 1 && chapter <= MG.Progress.MAX_CHAPTER) setChapter(chapter);
        applyDiffClass(currentDiff);
        startRound({ fresh: true });
      });
    };
    window.__debugSetChapter = (n) => { setChapter(n); };
    window.__debugPlayStartIntro = () => { playStartIntro(() => {}); }; // beginGame() 이 거치는 타이핑 인트로만 단독 재생(테스트용)
    window.__debugUnlockAll = () => { localStorage.setItem('mole.unlockAll', '1'); };
    window.__debugProgress = () => ({
      chapter: currentChapter(), light: currentLight(),
      target: MG.Progress.target(currentChapter()),
      rec: MG.Progress.get(currentChapter(), currentLight())
    });
    window.__debugStartRound = () => startRound({ fresh: true });
    window.__debugGetConfig = () => (state ? state.config : null);
    window.__debugGetActivePops = () => (state ? state.scheduler.getActivePops().map((p) => ({
      regionId: p.regionId, type: p.type, dying: p.dying, sinkIn: p.sinkIn, bombKind: p.bombKind,
      hitsTaken: p.hitsTaken, hitsRequired: p.hitsRequired, safeAlways: p.safeAlways
    })) : null);
    window.__debugSetTimeRemaining = (t) => { if (state) state.timeRemaining = t; };
    window.__debugForceDifficultyUpdate = () => { updateLiveDifficulty(); return state ? state.config : null; };
    window.__debugEndRound = function () {
      if (state && !state.ended) { state.timeRemaining = 0; roundComplete(); }
    };
    window.__debugForceGameOver = function () {
      if (!state || !run) return;
      setRunLives(0);
      finish('lives');
    };
    window.__debugSetWeapon = (w) => {
      localStorage.setItem('mole.weapon', w === 'cannon' ? 'cannon' : (w === 'goldhammer' ? 'goldhammer' : (w === 'alipunch' ? 'alipunch' : 'hammer')));
    };
    window.__debugForceQuake = () => { forceQuakeNext = true; }; // 다음 두더지 타격에서 지진 강제 발동
    window.__debugQuakeAt = (regionId) => { if (state) quakeRipple(regionId | 0, 0); }; // 그 구멍에서 지진 파동 즉시
    // 디버그 전용: 지정 구멍에 즉시 두더지(1타, poseIndex 지정 가능 — 0=전신) 강제 스폰 (타격점 확인용).
    window.__debugForceMole = (regionId, poseIndex) => {
      if (state && state.scheduler) state.scheduler.debugForceMole(regionId | 0, poseIndex);
    };
    window.__debugForceBombMole = (regionId, kind) => {
      if (state && state.scheduler) state.scheduler.debugForceBombMole(regionId | 0, kind);
    };
    window.__debugForceAnimal = (regionId) => {
      if (state && state.scheduler) state.scheduler.debugForceAnimal(regionId | 0);
    };
    window.__debugSpawnPoint = (regionId) => {
      const s = state && state.spawnPoints.find((p) => p.regionId === (regionId | 0));
      return s ? { x: s.x, y: s.y } : null;
    };
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
      screens: ['face-maker', 'costume-screen', 'face-locker', 'shop-screen', 'daily-screen', 'score-screen', 'settings-screen', 'inventory-screen', 'help-screen', 'privacy-screen', 'quest-screen', 'friends-screen', 'light-popup']
    });

    faceMaker = MG.FaceMaker.create({
      root: document.getElementById('face-maker'),
      onDone: onFaceMade,
      onCancel: () => screenNav.back()
    });
    costumeScreen = MG.CostumeScreen.create({
      root: document.getElementById('costume-screen'),
      onClose: () => closeMore(),
      onSave: (faceId, costume) => {
        MG.FaceStore.setCostume(faceId, costume).then(() => {
          MG.FaceStore.setActive(faceId);
          closeMore();
        });
      }
    });
    faceLocker = MG.FaceLocker.create({
      root: document.getElementById('face-locker'),
      onMake: () => { screenNav.show('face-maker'); faceMaker.open({}); },
      onEdit: (rec) => { screenNav.show('costume-screen'); costumeScreen.open(rec); },
      // 다이얼패드에서 바로 들어오는 진입점(사용자 지정) — 나갈 땐 더보기가 아니라 홈/게임으로.
      onPick: () => closeMore(),
      onClose: () => closeMore()
    });
    shop = MG.Shop.create({
      root: document.getElementById('shop-screen'),
      onClose: () => closeMore(),
      onChange: () => { if (moreMenu) moreMenu.refresh(); }
    });
    daily = MG.Daily.create({
      root: document.getElementById('daily-screen'),
      onClose: () => closeMore(),
      onChange: () => { if (moreMenu) moreMenu.refresh(); }
    });
    scoreScreen = MG.ScoreScreen.create({
      root: document.getElementById('score-screen'),
      onClose: () => closeMore()
    });
    settingsScreen = MG.SettingsScreen.create({
      root: document.getElementById('settings-screen'),
      onClose: () => closeMore(),
      onPrivacy: () => screenNav.show('privacy-screen'),
      onHelp: () => screenNav.show('help-screen'),
      onContact: () => { window.location.href = 'mailto:mrkyp@hanmail.net'; }
    });
    inventoryScreen = MG.InventoryScreen.create({
      root: document.getElementById('inventory-screen'),
      // 다이얼패드에서 바로 들어오는 진입점(사용자 지정) — 나갈 땐 더보기가 아니라 홈/게임으로.
      onClose: () => closeMore(),
      // 게임 진행 중(라운드1~클리어)엔 무기 변경 잠금. 홈·게임오버 후엔 허용.
      gameInProgress: () => !!(state && !state.ended),
      // 챕터1~3은 뿅망치만 사용(사용자 지정) — 선택된 챕터 기준으로 다른 무기 장착 자체를 막는다.
      hammerOnly: () => isSmallBoardChapter()
    });
    // help/privacy = settings 안에서 push 된 하위 화면(뒤로만, 홈으로 안 나감).
    ['help', 'privacy'].forEach((k) => {
      const b = document.querySelector('[data-back="' + k + '"]');
      if (b) b.addEventListener('click', () => screenNav.back());
    });
    // quest/friends/lightMode = 다이얼패드에서 바로 들어오는 진입점(사용자 지정) — 나갈 땐 홈/게임으로.
    ['quest', 'friends', 'lightMode'].forEach((k) => {
      const b = document.querySelector('[data-back="' + k + '"]');
      if (b) b.addEventListener('click', () => closeMore());
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

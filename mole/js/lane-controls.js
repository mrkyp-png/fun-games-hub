(function (root) {
  'use strict';

  // 구멍별 버튼 (기획서 §4 v1.5). 4x4 격자 = 16개 구멍과 1:1. 버튼을 누르면 그 구멍(영역)만 타격.
  // regionId (0..15, row*4 + col) 만 콜백으로 내보낸다. 게임 상태를 모른다.
  // 키보드: 격자 모양 그대로 1234 / qwer / asdf / zxcv.
  //
  // 겉모습은 전화 다이얼러로 위장한다 (사용자 요청). 1~3열 = 숫자패드, 4열 = 내비(상점/홈/아이템보관).
  // 홈 화면에서는 FACES 의 hud/action 필드로 일부 숫자·내비 자리에 더보기 기능 아이콘을 보여준다
  // (하트/코인/티켓/스코어/일일/퀘스트/친구/사진보관/시크릿). 실제 라운드 플레이 중엔 항상 숫자로 복귀.
  // 위장은 순전히 표시만 — 클릭/키보드/두더지-빛남 동작은 그대로.

  const KEY_GRID = ['1234', 'qwer', 'asdf', 'zxcv'];

  // 내비 아이콘 (이모지 렌더 편차 회피 — 인라인 SVG, currentColor). 더보기 화면(mm-ic)과 같은
  // 선 아이콘 패스를 재사용해 다이얼패드로 옮긴 기능들의 아이콘이 서로 통일되게 한다.
  const SVG = {
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .5 1 1V20c0 .6-.4 1-1 1C10.2 21 3 13.8 3 5c0-.6.5-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>',
    // 홈 화면 1·2·3·4번 버튼 앞면 — 하트/코인/티켓/스코어(사용자 지정: 검은색 외곽선만, 채우기 없음).
    hearts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
    // 옆으로 뉘어진 동전(두께+테두리선, 사용자 지정 — 후보 D).
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="8.5" ry="4.3"/><path d="M3.5 9v3.5c0 2.4 3.8 4.3 8.5 4.3s8.5-1.9 8.5-4.3V9"/><path d="M6.5 9c1.3 1.2 3.4 2 5.5 2s4.2-.8 5.5-2"/></svg>',
    // 양쪽 노치 티켓 + 구멍/점선(사용자 지정).
    tickets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 7h18v3.2a1.6 1.6 0 000 3.6V17H3v-3.2a1.6 1.6 0 000-3.6z"/><path d="M14 7.3v9.4" stroke-dasharray="1.4 1.6"/><circle cx="8" cy="12" r="1.3"/></svg>',
    score: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M7 4h10v4a5 5 0 01-10 0zM7 5.5H4V8a3 3 0 003 3M17 5.5h3V8a3 3 0 01-3 3M12 13v4M8.5 20.5h7l-1-3h-5z"/></svg>',
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8.5 3v4M15.5 3v4"/></svg>',
    quest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M6 4h9l4 4v12H6zM15 4v4h4M9 12h6M9 16h6"/></svg>',
    // 4열 내비 자리 — 상점/홈/아이템보관(사용자 지정, 기존 연락처·키패드·최근기록 대체).
    shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M6.5 8h11l1 11.5h-13zM9 8V6.5a3 3 0 016 0V8"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M3 8l1.6-3.4A1 1 0 015.5 4h13a1 1 0 01.9.6L21 8M4 8h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1zM9.5 12h5"/></svg>',
    friends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.6c2.6.3 5 2.3 5 5.4"/></svg>',
    locker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.4"/><path d="M8.5 7 10 4.5h4L15.5 7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M19.4 13a7.8 7.8 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L14 3h-4l-.6 2.6a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.8 7.8 0 000 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1L10 21h4l.6-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>'
  };

  // regionId(0..15) → 버튼 표시. 왼쪽 3열 = 표준 다이얼(큰 숫자 + 자음 + 영문/기호), 4열 = 내비.
  // hud: 홈 화면에서만(플레이 중엔 숫자로 복귀) 이 자리에 아이콘을 보여준다(사용자 지정) — 원래
  // 숫자는 fillFace() 가 자음/영문 서브텍스트 자리로 옮겨 그린다. hearts/coins/tickets 는 실시간
  // 카운터(setHudStat), score 는 현재 난이도 최고점수 카운터, daily/quest 는 카운터 없이 아이콘만.
  // action: 홈 화면에서 탭하면 그 화면으로 이동(onHomeAction 콜백, game.js 가 실제 내비게이션을
  // 담당 — lane-controls 는 게임 상태를 모른다).
  const FACES = [
    { num: '1', kr: 'ㄱㅋ', en: '', hud: 'hearts' }, { num: '2', kr: 'ㄴ', en: 'ABC', hud: 'coins' }, { num: '3', kr: 'ㄷㅌ', en: 'DEF', hud: 'tickets' }, { nav: '상점', svg: SVG.shop, i18n: 'mole.more.shop', action: 'shop' },
    { num: '4', kr: 'ㄹ', en: 'GHI', hud: 'score', action: 'score' }, { num: '5', kr: 'ㅁ', en: 'JKL', hud: 'daily', action: 'daily' }, { num: '6', kr: 'ㅂㅍ', en: 'MNO', hud: 'quest', action: 'quest' }, { nav: '홈', svg: SVG.home, i18n: 'mole.pad.home', action: 'home' },
    { num: '7', kr: 'ㅅ', en: 'PQRS', hud: 'friends', action: 'friends' }, { num: '8', kr: 'ㅇ', en: 'TUV', hud: 'locker', action: 'locker' }, { num: '9', kr: 'ㅈㅊ', en: 'WXYZ', hud: 'settings', action: 'settings' }, { nav: '아이템', svg: SVG.inventory, i18n: 'mole.pad.lblInventory', action: 'inventory' },
    { num: '✱', kr: '', en: '', hud: 'label', label: '두더지팡', labelI18n: 'mole.pad.gameMole', action: 'lightMode' },
    { num: '0', kr: '', en: '+', hud: 'label', label: '리듬팡', labelI18n: 'mole.pad.gameRhythm' },
    { num: '#', kr: '', en: '', hud: 'label', label: '시크릿', labelI18n: 'mole.pad.secret', lockSub: true },
    { nav: '시작', svg: SVG.phone, call: true, i18n: 'mole.start.btn' }
  ];

  // 아이콘 아래 자음/영문 자리에 넣을 설명 글자(사용자 지정) — 더보기와 같은 i18n 키 재사용.
  // locker/inventory 는 더보기의 긴 이름("사진보관"/"아이템 보관") 대신 다이얼패드 전용 짧은
  // 글자("사진"/"아이템", 사용자 지정 — 아이콘 확대에 맞춰 공간 확보).
  const HUD_LABEL = {
    hearts: 'mole.pad.lblHearts', coins: 'mole.pad.lblCoins', tickets: 'mole.pad.lblTickets',
    score: 'mole.pad.lblScore', daily: 'mole.more.daily', quest: 'mole.more.quest',
    friends: 'mole.more.friends', locker: 'mole.pad.lblLocker', settings: 'mole.more.settings'
  };

  function fillFace(btn, f, id, simple) {
    btn.classList.remove('lane-button--flippable', 'is-flipped');
    var faceHtml;
    if (f.nav) {
      btn.classList.add('lane-button--nav');
      if (f.call) btn.classList.add('lane-button--call');
      var I = root.FGH && root.FGH.I18N;
      var label = f.i18n && I ? I.t(f.i18n) : f.nav;
      var attr = f.i18n ? ' data-i18n="' + f.i18n + '"' : '';
      faceHtml = '<span class="lane-ico">' + f.svg + '</span><span class="lane-lbl"' + attr + '>' + label + '</span>';
    } else {
      var I18Nlang = root.FGH && root.FGH.I18N && root.FGH.I18N.lang;
      var showKr = f.kr && I18Nlang !== 'en'; // 영어권 키패드 = 한글 자음 없이 영문(ABC/DEF...)만
      faceHtml = '<span class="lane-num">' + f.num + '</span>' +
        '<span class="lane-sub">' + (showKr ? '<span class="lane-kr">' + f.kr + '</span>' : '') +
        (f.en ? '<span class="lane-en">' + f.en + '</span>' : '') + '</span>';
    }
    // 홈 화면 숫자칸(FACES 의 hud 필드) — 평소 숫자 얼굴 ↔ 아이콘을 동전처럼 3D 로 뒤집는
    // .lane-flip 카드로 감싼다. 실제 플레이 중엔 CSS(#game-screen:not(.is-start)
    // .lane-button--flippable .lane-flip)가 항상 숫자 면(back)을 강제해 게임 화면은 그대로다.
    // simple(챕터1~3 숫자패드)는 이 개념 자체가 없음 — 평소 얼굴 그대로.
    var hud = !simple && !f.call && f.hud;
    var HUD_COUNTS = { hearts: 1, coins: 1, tickets: 1 }; // 실시간 카운터 배지가 있는 것만(사용자 지정: 스코어는 배지 없이 글자만)
    if (hud === 'label') {
      // 글자 라벨 버튼(✱="두더지팡", 0="리듬팡", #="시크릿"+잠금 등, 사용자 지정) — 숫자 대신
      // 짧은 글자 + (있으면) 자음/영문 자리에 잠금 아이콘. action 이 있으면(✱) 탭 시 그 동작,
      // 없으면(0/#, 아직 미구현) 그냥 표시만.
      btn.classList.add('lane-button--flippable');
      var lbl = f.labelI18n;
      btn.innerHTML =
        '<span class="lane-flip">' +
        '<span class="lane-face lane-face--back">' + faceHtml + '</span>' +
        '<span class="lane-face lane-face--front lane-face--secret">' +
          '<span class="lane-num lane-num--secret"' + (lbl ? ' data-i18n="' + lbl + '"' : '') + '>' + f.label + '</span>' +
          (f.lockSub ? '<span class="lane-sub">' + SVG.lock + '</span>' : '') +
        '</span>' +
        '</span>';
    } else if (hud) {
      // 아이콘은 숫자 자리(왼쪽), 자음/영문 자리(오른쪽, .lane-sub)엔 이 둘 중 하나(사용자 지정):
      //  - 실시간 수량이 있는 것(하트/코인/티켓): 그 수량 숫자만(setHudStat 이 갱신).
      //  - 나머지(스코어/일일/퀘스트/친구/사진보관/설정): 아이콘 설명 글자만 — 원래 숫자는 없음.
      btn.classList.add('lane-button--flippable');
      var I2 = root.FGH && root.FGH.I18N;
      var lblKey2 = HUD_LABEL[hud];
      var lblTxt2 = lblKey2 && I2 ? I2.t(lblKey2) : '';
      var subHtml = HUD_COUNTS[hud]
        ? '<span class="lane-sub"><b class="lane-hud-n" data-hud="' + hud + '">0</b></span>'
        : '<span class="lane-sub">' +
            (lblTxt2 ? '<span class="lane-en"' + (lblKey2 ? ' data-i18n="' + lblKey2 + '"' : '') + '>' + lblTxt2 + '</span>' : '') +
          '</span>';
      btn.innerHTML =
        '<span class="lane-flip">' +
        '<span class="lane-face lane-face--back">' + faceHtml + '</span>' +
        '<span class="lane-face lane-face--front lane-face--hud">' +
          SVG[hud] + subHtml +
        '</span>' +
        '</span>';
    } else {
      btn.innerHTML = faceHtml;
    }
    // 유료무기(캐논·황금해머·알리펀치) 다이얼패드 구획선(사용자 지정) — 버튼 자신의 실제 박스(그리드 셀과
    // 정확히 같은 크기)에 꽉 차는 사각 테두리. innerHTML 로 매번 새로 그려지므로 fillFace 안에서 같이 추가
    // (버튼 생성 시·언어 전환 시 다 여기를 거침 — 한 곳에서만 관리).
    // 보더 색은 style.css 가 #game-screen.gs-laneskill 스코프에서만 입힌다(뿅망치·홈 화면은 투명).
    btn.insertAdjacentHTML('beforeend', '<span class="lane-cell-line" aria-hidden="true"></span>');
  }

  // 동전 뒤집기 — 10바퀴 휙 돌고 반 바퀴 더 돌아 반대 면에 착지 (누적 각도). spinChannelsIn() 이 씀.
  const FLIP_SPINS_DEG = 10 * 360 + 180;

  // 챕터1~3 전용 숫자패드 얼굴(9칸: 1~9) — 채널/다이얼 위장·통화버튼 없음(사용자 지정:
  // "통화버튼 불필요, 버튼보드 정사각형으로"). 홈 화면은 항상 기존 16버튼 다이얼러라
  // 시작은 거기서 이미 눌린 뒤이고, 챕터1~3은 뿅망치만이라 통화버튼(스킬슬롯) 자체가 무의미.
  // 기존 다이얼 1~9 버튼의 자음/영문 서브텍스트 그대로 재사용(사용자 지정 — FACES 의
  // 숫자 얼굴 인덱스 0,1,2,4,5,6,8,9,10 이 순서대로 1~9).
  const DIGIT_FACE_IDX = [0, 1, 2, 4, 5, 6, 8, 9, 10];
  function simpleFaces(gridSize) {
    const faces = [];
    for (let i = 0; i < gridSize * gridSize; i++) faces.push(Object.assign({}, FACES[DIGIT_FACE_IDX[i]]));
    return faces;
  }

  function create({ buttonBar, gridSize, onCell, onTap, onHomeAction, isHome, simple }) {
    const buttons = [];
    const keyMap = {};
    const faces = simple ? simpleFaces(gridSize) : FACES;
    const cellCount = gridSize * gridSize; // simple: 숫자칸 9개뿐(정사각형), 통화버튼 없음
    buttonBar.classList.toggle('lane-bar--simple', !!simple); // style.css: gridSize x gridSize 정사각형

    for (let id = 0; id < cellCount; id++) {
      const row = Math.floor(id / gridSize), col = id % gridSize;
      const b = document.createElement('button');
      b.className = 'lane-button' + (simple ? ' lane-button--simple' : '');
      b.type = 'button';
      b.dataset.region = String(id);
      fillFace(b, faces[id], id, simple);
      if (faces[id].call) b.insertAdjacentHTML('beforeend', '<span class="lane-call-idle" aria-hidden="true"></span>');
      b.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 눌러도 브라우저 메뉴 안 뜨게
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (onTap) onTap(); // 다이얼패드(홈 화면) 전용 탭음 — game.js 가 상황(is-start) 판단
        const bad = onCell(id); // 헛방/폭탄이면 true — 링 색을 빨갛게
        b.classList.remove('lane-button--flash', 'lane-button--miss');
        void b.offsetWidth;
        b.classList.toggle('lane-button--miss', !!bad);
        b.classList.add('lane-button--flash');
        // 홈 화면 전용 내비(하트·코인·티켓·스코어·상점·홈·… — FACES 의 action 필드) — 탭하면 그
        // 화면으로 이동. 실제 플레이 중(isHome() false)엔 평범한 숫자 타격 버튼일 뿐이라 무시.
        if (faces[id].action && onHomeAction && (!isHome || isHome())) onHomeAction(faces[id].action);
      });
      buttonBar.appendChild(b);
      buttons[id] = b;
      if (!simple) {
        const krow = KEY_GRID[row];
        if (krow && krow[col]) keyMap[krow[col]] = id;
      }
    }

    function onKey(e) {
      if (e.repeat) return;
      const id = keyMap[e.key.toLowerCase()];
      if (id !== undefined) onCell(id);
    }
    window.addEventListener('keydown', onKey);

    // safe = 알리 판취 무적 중 안전해진 동물(사용자 지정: 파랑 대신 노랑 하이라이트).
    function setCellHot(id, hot, safe) {
      const b = buttons[id];
      if (!b) return;
      b.classList.toggle('lane-button--hot', !!hot && !safe);
      b.classList.toggle('lane-button--hot-safe', !!hot && !!safe);
    }

    // 폭탄 든 두더지가 올라온 구멍의 버튼에 반투명 폭탄 이모지(글로우 포함) 표시 — 사용자 지정.
    // kind: 'normal'|'strong'|null(없으면 표시 안 함/제거).
    function setBombIndicator(id, kind) {
      const b = buttons[id];
      if (!b) return;
      let ind = b.querySelector('.lane-bomb-indicator');
      if (!kind) { if (ind) ind.remove(); return; }
      if (!ind) {
        ind = document.createElement('span');
        ind.className = 'lane-bomb-indicator';
        ind.textContent = '💣';
        ind.setAttribute('aria-hidden', 'true');
        b.appendChild(ind);
      }
      ind.classList.toggle('lane-bomb-indicator--strong', kind === 'strong');
      ind.classList.toggle('lane-bomb-indicator--normal', kind !== 'strong');
    }

    // 홈 화면 하트·코인·티켓·스코어 카운터 갱신 (FACES 의 hud 필드로 그 버튼을 찾는다).
    // 카운터 없는 hud(daily/quest/friends/locker)는 그 버튼에 .lane-hud-n 이 없어 조용히 무시.
    function setHudStat(kind, value) {
      const b = faces.findIndex((f) => f && f.hud === kind);
      const el = b > -1 && buttons[b] && buttons[b].querySelector('.lane-hud-n');
      if (el) el.textContent = String(value);
    }

    // 대포 연사: 그 버튼 링 플래시를 골드로 재발동 (자동샷마다 호출 → 3연속 펄스).
    function flashBurst(id) {
      const b = buttons[id];
      if (!b) return;
      b.classList.remove('lane-button--flash', 'lane-button--miss');
      void b.offsetWidth;
      b.classList.add('lane-button--flash', 'lane-button--burst');
      setTimeout(() => b.classList.remove('lane-button--burst'), 800); // 링 애니(0.8s) 끝나면 뗀다
    }

    // 골드해머 지진: 발동칸+주변 8칸(areaIds) 전체에 갈색빛 회색 사각 음영, 그 중 두더지가
    // 처치된 칸(killedIds)은 흰색. 버튼바 전체가 잠깐 흔들린다. 잠시 뒤 전부 사라짐.
    function flashQuakeArea(areaIds, killedIds) {
      const kill = new Set(killedIds || []);
      (areaIds || []).forEach((id) => {
        const b = buttons[id];
        if (!b) return;
        let sh = b.querySelector('.lane-quake-shade');
        if (!sh) { sh = document.createElement('span'); sh.className = 'lane-quake-shade'; b.appendChild(sh); }
        sh.classList.toggle('is-kill', kill.has(id));
        sh.classList.remove('is-on'); void sh.offsetWidth; sh.classList.add('is-on');
      });
      if (buttonBar) {
        buttonBar.classList.remove('lane-bar--quake-shake');
        void buttonBar.offsetWidth;
        buttonBar.classList.add('lane-bar--quake-shake');
      }
      clearTimeout(flashQuakeArea._t);
      flashQuakeArea._t = setTimeout(() => {
        (areaIds || []).forEach((id) => {
          const sh = buttons[id] && buttons[id].querySelector('.lane-quake-shade');
          if (sh) sh.remove();
        });
        if (buttonBar) buttonBar.classList.remove('lane-bar--quake-shake');
      }, 640);
    }

    function clear() {
      window.removeEventListener('keydown', onKey);
      buttons.forEach((b) => b.remove());
      buttons.length = 0;
    }

    // 버튼보드(buttonBar) 전체를 하나로 10바퀴 회전시킨다(사용자 지정 — 키패드 안 숫자
    // 각각이 아니라 보드 자체). 챕터1~3(simple) 진입뿐 아니라, 홈으로 복귀하며 보드가
    // 9버튼↔16버튼으로 다시 지어질 때(다음 챕터 성공화면→홈 등)도 이걸로 재사용한다.
    function spinBoardIn() {
      if (!buttonBar) return;
      buttonBar.style.transition = 'none';
      buttonBar.style.transform = 'perspective(1200px) rotateY(0deg)';
      void buttonBar.offsetWidth;
      buttonBar.style.transition = 'transform 0.9s cubic-bezier(.2, .7, .3, 1)';
      buttonBar.style.transform = 'perspective(1200px) rotateY(3600deg)';
      setTimeout(() => { buttonBar.style.transition = ''; buttonBar.style.transform = ''; }, 950);
    }

    // 홈→게임 진입 연출: 채널(유튜브 아이콘)로 설정된 버튼을 10바퀴 휙 돌려 숫자 버튼 얼굴로 바꾼다.
    // 게임 화면엔 키 버튼만 있어야 해서 채널 얼굴은 늘 숫자 쪽으로 고정되는데(style.css 고정 규칙),
    // 원래 전환이 즉시 스냅이라 "아이콘이 그냥 사라짐". .lane-flip--spinning 이 붙은 동안만 그
    // 고정 규칙을 비켜주고(style.css), 여기서 인라인으로 회전을 굴린다. 시크릿 복구 연출과 같은 느낌.
    function spinChannelsIn() {
      // 챕터1~3(simple, 9홀 숫자패드): 채널 뒤집기 카드 자체가 없어 spinBoardIn() 재사용.
      if (simple) { spinBoardIn(); return; }
      buttons.forEach((b) => {
        if (!b || !b.classList.contains('lane-button--flippable')) return;
        const flip = b.querySelector('.lane-flip');
        if (!flip) return;
        flip.style.transition = 'none';
        flip.style.transform = 'rotateY(0deg)';        // 아이콘 면에서 출발
        flip.classList.add('lane-flip--spinning');
        void flip.offsetWidth;                          // 시작점 확정(리플로우)
        flip.style.transition = 'transform 0.9s cubic-bezier(.2, .7, .3, 1)';
        flip.style.transform = 'rotateY(' + FLIP_SPINS_DEG + 'deg)';  // 10.5바퀴 → 숫자 면
        setTimeout(function () {
          flip.classList.remove('lane-flip--spinning'); // 이후 고정 규칙이 rotateY(180deg)로 잡음 (3780 ≡ 180, 점프 없음)
          flip.style.transition = '';
          flip.style.transform = '';
        }, 950);
      });

      // 통화 버튼(스킬 슬롯으로 바뀌는 경우 = 캐논·특수망치)도 같은 타이밍·같은 곡선으로 회전.
      // 채널 유무와 무관하게 항상 (사용자 요청). 단면이라 정확히 10바퀴(3600°)로 끝내 앞면 유지
      // (채널의 3780°는 뒷면이 숫자라 그대로, 통화는 뒷면이 없어 3600°).
      var gs = root.document && root.document.getElementById('game-screen');
      var call = gs && gs.classList.contains('gs-laneskill')
        ? buttons.find(function (b) { return b && b.classList.contains('lane-button--call'); })
        : null;
      if (call) {
        call.style.transition = 'none';
        call.style.transform = 'perspective(600px) rotateY(0deg)';
        void call.offsetWidth;
        call.style.transition = 'transform 0.9s cubic-bezier(.2, .7, .3, 1)';
        call.style.transform = 'perspective(600px) rotateY(3600deg)';
        setTimeout(function () {
          call.style.transition = '';
          call.style.transform = '';
        }, 950);
      }

      // 알리 펀치 전용 '✱' 키(구멍12, 별표 스킬 슬롯)도 통화 버튼과 같은 회전(사용자 지시).
      var star = gs && gs.classList.contains('gs-alipunch')
        ? buttons.find(function (b) { return b && b.dataset && b.dataset.region === '12'; })
        : null;
      if (star) {
        star.style.transition = 'none';
        star.style.transform = 'perspective(600px) rotateY(0deg)';
        void star.offsetWidth;
        star.style.transition = 'transform 0.9s cubic-bezier(.2, .7, .3, 1)';
        star.style.transform = 'perspective(600px) rotateY(3600deg)';
        setTimeout(function () {
          star.style.transition = '';
          star.style.transform = '';
        }, 950);
      }
    }

    // 언어 바뀌면(설정에서 즉시, ko↔en) 숫자키 자음 라벨도 다시 그린다 — 안 그러면 fillFace 는
    // 버튼 생성 시점 한 번뿐이라 en 으로 바꿔도 이미 그려진 ㄱㅋ/ㄴ 같은 한글 라벨이 안 지워짐.
    var I = root.FGH && root.FGH.I18N;
    if (I && I.onChange && !simple) { // simple(숫자만) 모드는 언어별 서브텍스트가 없어 다시 그릴 게 없음
      I.onChange(function () {
        faces.forEach(function (f, id) {
          if (f.num && buttons[id]) fillFace(buttons[id], f, id, simple);
        });
      });
    }

    return { setCellHot, setBombIndicator, setHudStat, flashBurst, flashQuakeArea, clear, spinChannelsIn, spinBoardIn };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);

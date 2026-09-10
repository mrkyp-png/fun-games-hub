(function (root) {
  'use strict';

  // 구멍별 버튼 (기획서 §4 v1.5). 4x4 격자 = 16개 구멍과 1:1. 버튼을 누르면 그 구멍(영역)만 타격.
  // regionId (0..15, row*4 + col) 만 콜백으로 내보낸다. 게임 상태를 모른다.
  // 키보드: 격자 모양 그대로 1234 / qwer / asdf / zxcv.
  //
  // 겉모습은 전화 다이얼러로 위장한다 (사용자 요청). 1~3열 = 숫자패드, 4열 = 내비(연락처/키패드/최근기록/설정).
  // 위장은 순전히 표시만 — 클릭/키보드/두더지-빛남 동작은 그대로.

  const KEY_GRID = ['1234', 'qwer', 'asdf', 'zxcv'];
  const HOLD_MS = 600;       // 길게 누름 = 채널 관리 메뉴 / 시크릿 복구
  const DOUBLE_TAP_MS = 320; // 이 안에 두 번 짧게 = 유튜브 진입 (한 번은 무시 — 실수 방지)

  // 채널 버튼 상태 (로컬):
  //  - deleted (mole.channelHidden.<id>) : 채널 링크 완전 제거 → 그냥 숫자 버튼. 길게 눌러도 무반응.
  //  - secret  (mole.channelSecret.<id>) : 숫자로 위장(숨김). 길게 누르면 10회전하며 유튜브 아이콘 복구.
  //  - user    (mole.channelUser.<id>)   : 유저가 이 기기에서 등록한 채널 {url, icon}. LINKS 보다 우선.
  const HIDDEN_P = 'mole.channelHidden.';
  const SECRET_P = 'mole.channelSecret.';
  const USER_P = 'mole.channelUser.';
  function lsGet(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function lsSet(k, on) { try { on ? localStorage.setItem(k, '1') : localStorage.removeItem(k); } catch (e) { /* noop */ } }
  function isDeleted(id) { return lsGet(HIDDEN_P + id); }
  function isSecret(id) { return lsGet(SECRET_P + id); }
  function chUser(id) {
    try { return JSON.parse(localStorage.getItem(USER_P + id) || 'null'); } catch (e) { return null; }
  }
  function chLink(id) {
    var u = chUser(id);
    if (u && u.url) return u;
    var CL = root.MoleGame && root.MoleGame.ChannelLinks;
    return (CL && CL.LINKS[id]) || null;
  }
  // 짧게 두 번(더블탭)으로 유튜브 진입 가능한 "일반" 상태의 채널만 반환 (삭제/시크릿이면 null).
  function channelFor(id) {
    return (!isDeleted(id) && !isSecret(id)) ? chLink(id) : null;
  }

  // 유튜브 URL 정규화 + 채널 핸들 추출. 핸들에 한글 등 유니코드 허용 (@슈뻘맨 OK).
  function normalizeYtUrl(s) {
    s = (s || '').trim();
    if (!s) return '';
    if (/^@\S+$/.test(s)) {
      s = 'https://www.youtube.com/' + s;               // "@슈뻘맨" → 채널 핸들
    } else if (!/^https?:\/\//i.test(s) && !/[\s/.]/.test(s)) {
      s = 'https://www.youtube.com/@' + s;              // "슈뻘맨"(맨단어, @없음) → 핸들로 간주
    } else if (!/^https?:\/\//i.test(s)) {
      s = 'https://' + s;                               // "youtube.com/@..." → 스킴만 보충
    }
    try {
      var host = new URL(s).hostname.toLowerCase();
      if (host !== 'youtube.com' && host !== 'youtu.be' && !/\.youtube\.com$/.test(host)) return '';
      return new URL(s).href;
    } catch (e) { return ''; }
  }
  function ytHandle(url) {
    var m = url.match(/@([^/?#\s]+)/) || url.match(/\/(?:c|channel|user)\/([^/?#\s]+)/);
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  // 내비 아이콘 (이모지 렌더 편차 회피 — 인라인 SVG, currentColor).
  const SVG = {
    person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/></svg>',
    pad: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="1.9"/><circle cx="12" cy="6" r="1.9"/><circle cx="18" cy="6" r="1.9"/><circle cx="6" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18" cy="12" r="1.9"/><circle cx="6" cy="18" r="1.9"/><circle cx="12" cy="18" r="1.9"/><circle cx="18" cy="18" r="1.9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .5 1 1V20c0 .6-.4 1-1 1C10.2 21 3 13.8 3 5c0-.6.5-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>',
    // 채널 아이콘 로드 실패 시 대체용 유튜브 로고
    youtube: '<svg class="lane-yt-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0000"/><path d="M10 8.5l6 3.5-6 3.5z" fill="#fff"/></svg>'
  };

  // regionId(0..15) → 버튼 표시. 왼쪽 3열 = 표준 다이얼(큰 숫자 + 자음 + 영문/기호), 오른쪽 열 = 내비.
  const FACES = [
    { num: '1', kr: 'ㄱㅋ', en: '' }, { num: '2', kr: 'ㄴ', en: 'ABC' }, { num: '3', kr: 'ㄷㅌ', en: 'DEF' }, { nav: '연락처', svg: SVG.person, i18n: 'mole.pad.contacts' },
    { num: '4', kr: 'ㄹ', en: 'GHI' }, { num: '5', kr: 'ㅁ', en: 'JKL' }, { num: '6', kr: 'ㅂㅍ', en: 'MNO' }, { nav: '키패드', svg: SVG.pad, i18n: 'mole.pad.keypad' },
    { num: '7', kr: 'ㅅ', en: 'PQRS' }, { num: '8', kr: 'ㅇ', en: 'TUV' }, { num: '9', kr: 'ㅈㅊ', en: 'WXYZ' }, { nav: '최근기록', svg: SVG.clock, i18n: 'mole.pad.recent' },
    { num: '✱', kr: '', en: '' }, { num: '0', kr: '', en: '+' }, { num: '#', kr: '', en: '' },
    { nav: '시작', svg: SVG.phone, call: true, i18n: 'mole.start.btn' }
  ];

  function fillFace(btn, f, id) {
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
      faceHtml = '<span class="lane-num">' + f.num + '</span>' +
        '<span class="lane-sub">' + (f.kr ? '<span class="lane-kr">' + f.kr + '</span>' : '') +
        (f.en ? '<span class="lane-en">' + f.en + '</span>' : '') + '</span>';
    }
    // 채널이 등록돼 있으면 평소 얼굴 ↔ 채널 아이콘을 동전처럼 3D 로 뒤집는 .lane-flip 카드로 감싼다.
    // 아이콘 URL 이 없거나 로드 실패하면 유튜브 로고로 대체(채널 버튼임은 유지).
    var ch = !f.call && channelFor(id);
    if (ch) {
      btn.classList.add('lane-button--flippable');
      btn.innerHTML =
        '<span class="lane-flip">' +
        '<span class="lane-face lane-face--back">' + faceHtml + '</span>' +
        '<span class="lane-face lane-face--front">' +
          (ch.icon ? '<img class="lane-channel-icon" alt="">' : SVG.youtube) +
        '</span>' +
        '</span>';
      var img = btn.querySelector('.lane-channel-icon');
      if (img) {
        img.src = ch.icon;
        img.addEventListener('error', function () {
          var front = img.parentElement;
          if (front) front.innerHTML = SVG.youtube;
        });
      }
    } else {
      btn.innerHTML = faceHtml;
    }
  }

  // 빈(채널 없는) 버튼을 더블탭하면 뜨는 "유튜브 채널 등록" 창.
  let regModalEl = null;
  function showRegisterModal(id, btn) {
    if (regModalEl) { regModalEl.remove(); regModalEl = null; } // 혹시 이전 게 안 닫혔으면 치우고 새로 연다
    var I = root.FGH && root.FGH.I18N;
    var T = function (k) { return I ? I.t(k) : k; };
    var v = document.createElement('div');
    v.className = 'ad-overlay ch-reg-overlay';
    v.innerHTML =
      '<div class="ad-overlay-card ch-reg-card">' +
      '<div class="ch-reg-title">' + T('mole.channel.regTitle') + '</div>' +
      '<div class="ch-reg-desc">' + T('mole.channel.regDesc') + '</div>' +
      '<input type="url" class="ch-reg-input" placeholder="youtube.com/@..." autocomplete="off" spellcheck="false" />' +
      '<div class="ch-reg-btns">' +
        '<button type="button" data-r="ok">' + T('mole.channel.regOk') + '</button>' +
        '<button type="button" data-r="cancel">' + T('mole.common.close') + '</button>' +
      '</div></div>';
    document.body.appendChild(v);
    regModalEl = v;
    var input = v.querySelector('.ch-reg-input');
    setTimeout(function () { input.focus(); }, 50);
    var close = function () { v.remove(); regModalEl = null; };
    v.querySelector('[data-r="cancel"]').addEventListener('click', close);
    // 스크림 탭으로 닫기 — 단, 이 창을 연 더블탭의 합성 click 이 곧바로 닫아버리지 않게 잠깐 뒤 배선.
    setTimeout(function () {
      v.addEventListener('click', function (e) { if (e.target === v) close(); });
    }, 120);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') v.querySelector('[data-r="ok"]').click(); });
    v.querySelector('[data-r="ok"]').addEventListener('click', function () {
      var url = normalizeYtUrl(input.value);
      if (!url) { input.classList.add('ch-reg-input--bad'); return; }
      var h = ytHandle(url);
      var rec = { url: url, icon: h ? ('https://unavatar.io/youtube/' + encodeURIComponent(h)) : '' };
      lsSet(SECRET_P + id, false);
      lsSet(HIDDEN_P + id, false);
      try { localStorage.setItem(USER_P + id, JSON.stringify(rec)); } catch (e) { /* noop */ }
      fillFace(btn, FACES[id], id);
      close();
    });
  }

  // 동전 뒤집기 — 10바퀴 휙 돌고 반 바퀴 더 돌아 반대 면에 착지 (누적 각도).
  const FLIP_SPINS_DEG = 10 * 360 + 180;
  function flipChannelCard(btn) {
    const flip = btn.querySelector('.lane-flip');
    if (!flip) return;
    const cur = parseFloat(flip.dataset.deg || '0');
    const next = cur + FLIP_SPINS_DEG;
    flip.dataset.deg = String(next);
    flip.style.transform = 'rotateY(' + next + 'deg)';
  }
  // 시크릿: 유튜브 아이콘 → (10회전) → 숫자. 회전 끝나면 평범한 숫자 버튼으로 확정.
  function secretWithSpin(btn, id) {
    if (btn.querySelector('.lane-flip')) {
      flipChannelCard(btn); // 아이콘(front) → 숫자(back)
      setTimeout(() => fillFace(btn, FACES[id], id), 950);
    } else {
      fillFace(btn, FACES[id], id);
    }
  }
  // 시크릿 해제: 숫자 → (10회전) → 유튜브 아이콘.
  function restoreWithSpin(btn, id) {
    fillFace(btn, FACES[id], id); // 채널 복구 → flip 카드 다시 렌더 (기본 아이콘 face)
    const flip = btn.querySelector('.lane-flip');
    if (!flip) return;
    flip.style.transition = 'none';
    flip.dataset.deg = '180';
    flip.style.transform = 'rotateY(180deg)'; // 숫자 면에서 출발
    void flip.offsetWidth;
    flip.style.transition = '';
    flipChannelCard(btn); // 180 → 아이콘 면으로 회전
  }

  // 길게 누르면 뜨는 채널 관리 말풍선 [🕶 시크릿] [🗑 삭제]
  let chMenuEl = null;
  function closeChannelMenu() {
    document.removeEventListener('pointerdown', chMenuOutside, true);
    if (chMenuEl) { chMenuEl.remove(); chMenuEl = null; }
  }
  function chMenuOutside(e) {
    if (chMenuEl && !chMenuEl.contains(e.target)) closeChannelMenu();
  }
  function showChannelMenu(id, btn) {
    closeChannelMenu();
    const I = root.FGH && root.FGH.I18N;
    const T = (k) => (I ? I.t(k) : k);
    const m = document.createElement('div');
    m.className = 'lane-ch-menu';
    m.innerHTML =
      '<button type="button" data-a="secret"><span class="lch-ic">🕶️</span>' + T('mole.channel.secret') + '</button>' +
      '<button type="button" data-a="delete"><span class="lch-ic">🗑️</span>' + T('mole.channel.delete') + '</button>';
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    // 폰 밖으로 안 나가게 가로 클램프 + 꼬리는 버튼을 계속 가리키게 (--tail-x).
    const mw = m.offsetWidth, mh = m.offsetHeight, mg = 8;
    const btnCx = r.left + r.width / 2;
    const cx = Math.max(mw / 2 + mg, Math.min(window.innerWidth - mw / 2 - mg, btnCx));
    m.style.left = cx + 'px';
    m.style.top = Math.max(mh + mg, r.top - 6) + 'px'; // 위로 못 나가면 아래로 안 넘어가게만 (translateY -100%)
    m.style.setProperty('--tail-x', Math.max(12, Math.min(mw - 12, btnCx - (cx - mw / 2))) + 'px');
    m.querySelector('[data-a="secret"]').addEventListener('click', () => {
      lsSet(SECRET_P + id, true);
      secretWithSpin(btn, id);
      closeChannelMenu();
    });
    m.querySelector('[data-a="delete"]').addEventListener('click', () => {
      lsSet(HIDDEN_P + id, true);
      try { localStorage.removeItem(USER_P + id); } catch (e) { /* noop */ }
      fillFace(btn, FACES[id], id); // 즉시 평범한 숫자로 (더블탭하면 등록창)
      closeChannelMenu();
    });
    chMenuEl = m;
    setTimeout(() => document.addEventListener('pointerdown', chMenuOutside, true), 0);
  }

  // 0.6초 길게 누름 처리 — 홈 화면에서만.
  function onChannelHold(id, btn, isHome) {
    if (isHome && !isHome()) return;
    if (isDeleted(id)) return;      // 삭제됨 = 완전 숫자패드, 무반응
    if (isSecret(id)) {             // 시크릿 → 유튜브로 복구 (10회전)
      lsSet(SECRET_P + id, false);
      restoreWithSpin(btn, id);
      return;
    }
    if (!chLink(id)) return;        // 애초에 채널 없는 자리
    showChannelMenu(id, btn);       // 일반 → [시크릿|삭제]
  }

  function create({ buttonBar, gridSize, onCell, onTap, onChannelEnter, isHome }) {
    const buttons = [];
    const keyMap = {};

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = row * gridSize + col;
        const b = document.createElement('button');
        b.className = 'lane-button';
        b.type = 'button';
        b.dataset.region = String(id);
        fillFace(b, FACES[id], id);
        if (FACES[id].call) b.insertAdjacentHTML('beforeend', '<span class="lane-call-idle" aria-hidden="true"></span>');
        b.addEventListener('contextmenu', (e) => e.preventDefault()); // 길게 눌러도 브라우저 메뉴 안 뜨게
        let lastTapAt = 0; // 이 버튼의 직전 짧은탭 시각 — 더블탭 판정용 (실수 진입 방지)
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (onTap) onTap(); // 다이얼패드(홈 화면) 전용 탭음 — game.js 가 상황(is-start) 판단
          const bad = onCell(id); // 헛방/폭탄이면 true — 링 색을 빨갛게
          b.classList.remove('lane-button--flash', 'lane-button--miss');
          void b.offsetWidth;
          b.classList.toggle('lane-button--miss', !!bad);
          b.classList.add('lane-button--flash');

          // 채널 조작 (시작버튼 제외):
          //   짧게 두 번(더블탭) = 채널 있음→유튜브 진입 / 빈 버튼(삭제·미등록)→채널 등록창. 한 번만은 무시(실수 방지).
          //   0.6초 길게        = onChannelHold — 일반: [시크릿|삭제] 메뉴 / 시크릿: 10회전 복구 / 삭제: 무반응
          // 포인터 캡처로 손가락이 버튼 밖으로 나가도 pointerup 을 여기서 받는다
          // (예전 pointerleave 로 판정하던 게 삭제 제스처가 안 먹던 원인).
          if (!FACES[id].call) {
            let held = false;
            try { b.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
            const holdTimer = setTimeout(() => { held = true; lastTapAt = 0; onChannelHold(id, b, isHome); }, HOLD_MS);
            const cleanup = () => {
              clearTimeout(holdTimer);
              b.removeEventListener('pointerup', up);
              b.removeEventListener('pointercancel', cleanup);
            };
            const up = () => {
              const wasHeld = held;
              cleanup();
              if (wasHeld) return; // 길게 = onChannelHold 가 이미 처리
              if (!isHome || isHome()) {
                // 홈: 시크릿 버튼(숨긴 채널)은 더블탭도 무시 — 나머지는 판정.
                if (isSecret(id)) { lastTapAt = 0; return; }
                const now = Date.now();
                if (now - lastTapAt < DOUBLE_TAP_MS) { // 두 번째 탭
                  lastTapAt = 0;
                  var ch = channelFor(id);
                  if (ch) { if (onChannelEnter) onChannelEnter(ch.url); } // 채널 있음 → 진입 (URL 직접 전달 — 유저 등록분 포함)
                  else showRegisterModal(id, b);                          // 빈 버튼 → 등록창
                } else {
                  lastTapAt = now; // 첫 탭 — 대기
                }
              } else {
                lastTapAt = 0;
              }
            };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointercancel', cleanup);
          }
        });
        buttonBar.appendChild(b);
        buttons[id] = b;
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

    function setCellHot(id, hot) {
      if (buttons[id]) buttons[id].classList.toggle('lane-button--hot', !!hot);
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

    // 홈→게임 진입 연출: 채널(유튜브 아이콘)로 설정된 버튼을 10바퀴 휙 돌려 숫자 버튼 얼굴로 바꾼다.
    // 게임 화면엔 키 버튼만 있어야 해서 채널 얼굴은 늘 숫자 쪽으로 고정되는데(style.css 고정 규칙),
    // 원래 전환이 즉시 스냅이라 "아이콘이 그냥 사라짐". .lane-flip--spinning 이 붙은 동안만 그
    // 고정 규칙을 비켜주고(style.css), 여기서 인라인으로 회전을 굴린다. 시크릿 복구 연출과 같은 느낌.
    function spinChannelsIn() {
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
    }

    return { setCellHot, flashBurst, flashQuakeArea, clear, spinChannelsIn };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);

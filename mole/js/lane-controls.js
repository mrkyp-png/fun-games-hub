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
  const HIDDEN_P = 'mole.channelHidden.';
  const SECRET_P = 'mole.channelSecret.';
  function lsGet(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function lsSet(k, on) { try { on ? localStorage.setItem(k, '1') : localStorage.removeItem(k); } catch (e) { /* noop */ } }
  function isDeleted(id) { return lsGet(HIDDEN_P + id); }
  function isSecret(id) { return lsGet(SECRET_P + id); }
  function chLink(id) {
    var CL = root.MoleGame && root.MoleGame.ChannelLinks;
    return (CL && CL.LINKS[id]) || null;
  }
  // 짧게 탭으로 유튜브 진입 가능한 "일반" 상태의 채널만 반환 (삭제/시크릿이면 null).
  function channelFor(id) {
    return (!isDeleted(id) && !isSecret(id)) ? chLink(id) : null;
  }

  // 내비 아이콘 (이모지 렌더 편차 회피 — 인라인 SVG, currentColor).
  const SVG = {
    person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/></svg>',
    pad: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="1.9"/><circle cx="12" cy="6" r="1.9"/><circle cx="18" cy="6" r="1.9"/><circle cx="6" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18" cy="12" r="1.9"/><circle cx="6" cy="18" r="1.9"/><circle cx="12" cy="18" r="1.9"/><circle cx="18" cy="18" r="1.9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .5 1 1V20c0 .6-.4 1-1 1C10.2 21 3 13.8 3 5c0-.6.5-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>'
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
    // 채널 등록 + 아이콘이 있으면 평소 얼굴과 채널 아이콘을 동전 뒤집듯 3D 로 전환할 수 있게
    // .lane-flip 카드(뒷면=lane-face--back 숫자/내비, 앞면=lane-face--front 채널 아이콘)로 감싼다.
    // 짧게 누르면(동전이 몇 바퀴 빙글 돌다 착지) 서로 교대로 보인다 — flipChannelCard() 참고.
    // 이미지 로드 실패하면(onerror) 뒤집기 자체를 없던 일로 하고 원래 얼굴만 남는다.
    var ch = !f.call && channelFor(id);
    if (ch && ch.icon) {
      btn.classList.add('lane-button--flippable');
      btn.innerHTML =
        '<span class="lane-flip">' +
        '<span class="lane-face lane-face--back">' + faceHtml + '</span>' +
        '<span class="lane-face lane-face--front"><img class="lane-channel-icon" alt=""></span>' +
        '</span>';
      var img = btn.querySelector('.lane-channel-icon');
      img.src = ch.icon;
      img.addEventListener('error', function () {
        btn.classList.remove('lane-button--flippable', 'is-flipped');
        btn.innerHTML = faceHtml;
      });
    } else {
      btn.innerHTML = faceHtml;
    }
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
    m.style.left = (r.left + r.width / 2) + 'px';
    m.style.top = (r.top - 6) + 'px';
    m.querySelector('[data-a="secret"]').addEventListener('click', () => {
      lsSet(SECRET_P + id, true);
      secretWithSpin(btn, id);
      closeChannelMenu();
    });
    m.querySelector('[data-a="delete"]').addEventListener('click', () => {
      lsSet(HIDDEN_P + id, true);
      fillFace(btn, FACES[id], id); // 즉시 평범한 숫자로
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
          //   짧게 두 번(더블탭) = 유튜브 진입 (일반 상태 + 홈일 때만). 한 번만은 아무 일 없음 — 실수 진입 방지.
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
              if (!((!isHome || isHome()) && channelFor(id))) { lastTapAt = 0; return; }
              const now = Date.now();
              if (now - lastTapAt < DOUBLE_TAP_MS) { // 두 번째 탭 = 진입
                lastTapAt = 0;
                if (onChannelEnter) onChannelEnter(id);
              } else {
                lastTapAt = now; // 첫 탭 — 대기
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

    function clear() {
      window.removeEventListener('keydown', onKey);
      buttons.forEach((b) => b.remove());
      buttons.length = 0;
    }

    return { setCellHot, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);

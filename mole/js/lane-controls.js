(function (root) {
  'use strict';

  // 구멍별 버튼 (기획서 §4 v1.5). 4x4 격자 = 16개 구멍과 1:1. 버튼을 누르면 그 구멍(영역)만 타격.
  // regionId (0..15, row*4 + col) 만 콜백으로 내보낸다. 게임 상태를 모른다.
  // 키보드: 격자 모양 그대로 1234 / qwer / asdf / zxcv.
  //
  // 겉모습은 전화 다이얼러로 위장한다 (사용자 요청). 1~3열 = 숫자패드, 4열 = 내비(연락처/키패드/최근기록/설정).
  // 위장은 순전히 표시만 — 클릭/키보드/두더지-빛남 동작은 그대로.

  const KEY_GRID = ['1234', 'qwer', 'asdf', 'zxcv'];
  const LONG_PRESS_MS = 600;    // 채널 링크(onLongPress) 발동 기준 — 짧게 누르면 평소처럼 onCell만.
  const DELETE_PRESS_MS = 2200; // 훨씬 더 오래 누르면 그 채널 등록을 이 기기에서만 해제(로컬).
  const CHANNEL_HIDDEN_PREFIX = 'mole.channelHidden.';

  function isChannelHidden(id) {
    try { return localStorage.getItem(CHANNEL_HIDDEN_PREFIX + id) === '1'; } catch (e) { return false; }
  }
  function hideChannel(id) {
    try { localStorage.setItem(CHANNEL_HIDDEN_PREFIX + id, '1'); } catch (e) { /* noop */ }
  }
  // 채널 링크 정적 설정(channel-links.js)을 읽되, 이 기기에서 해제됐으면 없는 것처럼 취급.
  function channelFor(id) {
    var CL = root.MoleGame && root.MoleGame.ChannelLinks;
    if (!CL || isChannelHidden(id)) return null;
    return CL.LINKS[id] || null;
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
    { num: '1', kr: 'ㄱㅋ', en: '.QZ' }, { num: '2', kr: 'ㄴ', en: 'ABC' }, { num: '3', kr: 'ㄷㅌ', en: 'DEF' }, { nav: '연락처', svg: SVG.person, i18n: 'mole.pad.contacts' },
    { num: '4', kr: 'ㄹ', en: 'GHI' }, { num: '5', kr: 'ㅁ', en: 'JKL' }, { num: '6', kr: 'ㅂㅍ', en: 'MNO' }, { nav: '키패드', svg: SVG.pad, i18n: 'mole.pad.keypad' },
    { num: '7', kr: 'ㅅ', en: 'PRS' }, { num: '8', kr: 'ㅇ', en: 'TUV' }, { num: '9', kr: 'ㅈㅊ', en: 'WXY' }, { nav: '최근기록', svg: SVG.clock, i18n: 'mole.pad.recent' },
    { num: '✱', kr: '', en: '' }, { num: '0', kr: '', en: '+' }, { num: '#', kr: '', en: '' },
    { nav: '시작', svg: SVG.phone, call: true, i18n: 'mole.start.btn' }
  ];

  function fillFace(btn, f, id) {
    if (f.nav) {
      btn.classList.add('lane-button--nav');
      if (f.call) btn.classList.add('lane-button--call');
      var I = root.FGH && root.FGH.I18N;
      var label = f.i18n && I ? I.t(f.i18n) : f.nav;
      var attr = f.i18n ? ' data-i18n="' + f.i18n + '"' : '';
      btn.innerHTML = '<span class="lane-ico">' + f.svg + '</span><span class="lane-lbl"' + attr + '>' + label + '</span>';
    } else {
      btn.innerHTML = '<span class="lane-num">' + f.num + '</span>' +
        '<span class="lane-sub">' + (f.kr ? '<span class="lane-kr">' + f.kr + '</span>' : '') +
        (f.en ? '<span class="lane-en">' + f.en + '</span>' : '') + '</span>';
    }
    // 채널 등록 + 아이콘이 있으면 평소 얼굴 위에 덮어 씌운다. 이미지 로드 실패하면(onerror)
    // 스스로 지워져 원래 얼굴(숫자/내비 아이콘)로 자연스럽게 돌아간다.
    if (!f.call) {
      var ch = channelFor(id);
      if (ch && ch.icon) {
        var img = document.createElement('img');
        img.className = 'lane-channel-icon';
        img.src = ch.icon;
        img.alt = '';
        img.addEventListener('error', function () { img.remove(); });
        btn.appendChild(img);
      }
    }
  }

  function create({ buttonBar, gridSize, onCell, onTap, onLongPress }) {
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
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (onTap) onTap(); // 다이얼패드(홈 화면) 전용 탭음 — game.js 가 상황(is-start) 판단
          const bad = onCell(id); // 헛방/폭탄이면 true — 링 색을 빨갛게
          b.classList.remove('lane-button--flash', 'lane-button--miss');
          void b.offsetWidth;
          b.classList.toggle('lane-button--miss', !!bad);
          b.classList.add('lane-button--flash');

          // 채널 링크 3단계 — 시작버튼은 제외. 짧게(뗌) = 위 onCell만. 중간 길게(LONG_PRESS_MS,
          // game.js가 홈 화면인지/등록 여부 판단) = 채널 이동. 아주 길게(DELETE_PRESS_MS) =
          // 이 기기에서만 등록 해제(아이콘 제거, 되돌릴 수 없음 — 재등록은 채널을 다시 알려줘야 함).
          // 떼는 순간까지 어디까지 도달했는지로 판정(중간에 먼저 쏘지 않음) — 아주 길게 누르는 도중에
          // 광고가 먼저 뜨는 걸 막기 위함.
          if (!FACES[id].call) {
            let stage = 0;
            const mediumTimer = setTimeout(() => { stage = 1; }, LONG_PRESS_MS);
            const deleteTimer = setTimeout(() => { stage = 2; }, DELETE_PRESS_MS);
            const finish = () => {
              clearTimeout(mediumTimer);
              clearTimeout(deleteTimer);
              b.removeEventListener('pointerup', finish);
              b.removeEventListener('pointerleave', finish);
              b.removeEventListener('pointercancel', finish);
              if (stage === 2) {
                if (channelFor(id)) { hideChannel(id); fillFace(b, FACES[id], id); }
              } else if (stage === 1 && onLongPress) {
                onLongPress(id);
              }
            };
            b.addEventListener('pointerup', finish);
            b.addEventListener('pointerleave', finish);
            b.addEventListener('pointercancel', finish);
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

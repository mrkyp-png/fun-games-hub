(function (root) {
  'use strict';
  // 아이템 보관 — 무기 / 스킬 / 코스튬 / 사진 탭(사용자 지정, 2026-09-18 상점과 동일한
  // 카드/탭 비주얼로 개편). 현재는 무기 탭만 실제 구현, 나머지는 준비중 placeholder.
  var I18N = root.FGH.I18N;
  var T = function (k) { return I18N.t(k); };

  // 능력치 표 3줄 (라벨 = i18n 키, 값 = [ko, en]).
  var STAT_ROWS = ['mole.inv.stat.visibility', 'mole.inv.stat.attack', 'mole.inv.stat.defense'];
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/hammer.png',
      stats: [['-', '-'], ['-', '-'], ['-', '-']] },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1.png',
      stats: [['Hole 16 → 15 · 경계선 추가', 'Holes 16 → 15 · Cell borders'],
              ['2·3타 두더지 연타 확률 10%', '10% burst on 2·3-hit moles'],
              ['-', '-']] },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldhammer-0.png',
      gemGlow: true,   // 보석(파란불빛) 부분에 맥동 글로우
      stats: [['Hole 16 → 15 · 경계선 추가', 'Holes 16 → 15 · Cell borders'],
              ['주변 두더지 지진 연타 15% (2·3타 두더지 소탕 포함)', '15% quake — chain-hits nearby moles (clears 2·3-hit moles too)'],
              ['-', '-']] },
    { id: 'alipunch', name: '알리 판취', nameEn: 'Ali Punch', thumb: 'assets/weapons/alipunch-jab.png',
      stats: [['Hole 16 → 14 · 경계선 추가', 'Holes 16 → 14 · Cell borders'],
              ['무적 5초 확률 20% (모든 동물 타격 가능), 2·3타 두더지 소탕 포함', '20% chance — 5s invincibility (any animal is safe to hit), clears 2·3-hit moles'],
              ['하강 딜레이 +0.1초(무적 중 +0.3초 추가)', '+0.1s before mole retreats (+0.3s more while invincible)']] }
  ];

  // 하단 탭 아이콘 — 상점(shop.js)과 같은 그라디언트 입체 아이콘 재사용(사용자 지정: "동일한
  // 스타일로"). 사진 탭은 다이얼패드 "사진보관" 카메라 아이콘(lane-controls.js SVG.locker)
  // 재사용 + 같은 톤의 그라디언트만 추가.
  var WEAPON_TAB_ICON =
    '<svg viewBox="0 0 64 64">' +
    '<defs>' +
      '<linearGradient id="ivWpHandle" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#fbe6a8"/><stop offset="1" stop-color="#c99a3e"/>' +
      '</linearGradient>' +
      '<linearGradient id="ivWpHead" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ff6b5e"/><stop offset="1" stop-color="#c72e22"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<g transform="rotate(45 32 32)">' +
      '<rect x="29" y="30" width="6" height="24" rx="3" fill="url(#ivWpHandle)"/>' +
      '<rect x="14" y="12" width="36" height="20" rx="10" fill="url(#ivWpHead)"/>' +
      '<rect x="14" y="12" width="36" height="8" rx="6" fill="#fff" opacity="0.35"/>' +
      '<path d="M32 16 33.5 20 38 20 34.5 22.6 36 27 32 24.2 28 27 29.5 22.6 26 20 30.5 20Z" fill="#fff"/>' +
    '</g></svg>';
  var SKILL_TAB_ICON =
    '<svg viewBox="0 0 64 64">' +
    '<defs>' +
      '<radialGradient id="ivSkWhite" cx="0.35" cy="0.3" r="0.8">' +
        '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d6dc"/>' +
      '</radialGradient>' +
      '<linearGradient id="ivSkBlack" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#4a4a54"/><stop offset="1" stop-color="#0c0c12"/>' +
      '</linearGradient>' +
    '</defs>' +
    '<circle cx="32" cy="32" r="24" fill="url(#ivSkWhite)" stroke="#0c0c12" stroke-width="2"/>' +
    '<path d="M32 8 A12 12 0 0 1 32 32 A12 12 0 0 0 32 56 A24 24 0 0 0 32 8 Z" fill="url(#ivSkBlack)"/>' +
    '<circle cx="32" cy="20" r="4" fill="#0c0c12"/>' +
    '<circle cx="32" cy="44" r="4" fill="url(#ivSkWhite)"/>' +
    '</svg>';
  // 코스튬 아이콘 = 상점과 동일한 이모지로 통일(사용자 지정: "아이템에서도 코스튬 이모지 변경").
  var COSTUME_TAB_ICON = '👕';
  var PHOTO_TAB_ICON =
    '<svg viewBox="0 0 24 24">' +
    '<defs><linearGradient id="ivPhBody" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#8a8a92"/><stop offset="1" stop-color="#4a4a52"/>' +
    '</linearGradient></defs>' +
    '<rect x="3" y="7" width="18" height="13" rx="2" fill="url(#ivPhBody)"/>' +
    '<circle cx="12" cy="13.5" r="3.4" fill="#dfe8ff" stroke="#2f6fed" stroke-width="1.2"/>' +
    '<path d="M8.5 7 10 4.5h4L15.5 7" fill="#6a6a72"/>' +
    '</svg>';
  // banner = 탭마다 다른 안내문구(사용자 지정: "각 선택창마다 글자가 바뀌어야 할듯" — "어떤
  // 무기를..."가 무기 탭에만 맞는 문구였던 것 지적받음).
  var TABS = [
    { id: 'weapon', i18n: 'mole.inv.weapon', icon: WEAPON_TAB_ICON, banner: 'mole.inv.bannerWeapon' },
    { id: 'skill', i18n: 'mole.shop.tabSkill', icon: SKILL_TAB_ICON, banner: 'mole.inv.bannerSkill' },
    { id: 'costume', i18n: 'mole.shop.tabCostume', icon: COSTUME_TAB_ICON, banner: 'mole.inv.bannerCostume' },
    { id: 'photo', i18n: 'mole.pad.lblLocker', icon: PHOTO_TAB_ICON, banner: 'mole.inv.bannerPhoto' }
  ];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabsEl = el.querySelector('[data-inv-tabs]');
    var bannerTxtEl = el.querySelector('[data-inv-banner-txt]');
    var headEl = el.querySelector('.shop-cards-head');
    var dotsEl = el.querySelector('[data-inv-dots]');
    var prevBtn = el.querySelector('[data-inv-prev]');
    var nextBtn = el.querySelector('[data-inv-next]');
    var equipBtn = el.querySelector('[data-inv-equip]');
    el.querySelector('[data-back="inventory"]')?.addEventListener('click', opts.onClose);
    var active = 'weapon';

    // 상점 카드줄과 동일한 점+화살표 페이징(사용자 지정: "상점 구조와 동일하되 한페이지 한장씩").
    // ⚠️ 처음엔 scrollBy(상대량) 방식이었는데, 카드 실측폭(getBoundingClientRect)과 grid의
    // 실제 clientWidth 가 서브픽셀 단위로 살짝 달라 페이지를 넘길 때마다 오차가 누적되어(사용자
    // 보고: "위치가 다 틀어진거같은데") 3~4번째 카드로 갈수록 어긋났음. 절대 인덱스 기준으로
    // 그 카드의 offsetLeft 로 직접 scrollTo 하는 방식으로 교체 — 오차가 누적되지 않는다.
    var pageIdx = 0;
    function grid() { return body.querySelector('.inv-grid'); }
    function goTo(idx) {
      var g = grid(); if (!g) return;
      var n = g.children.length;
      pageIdx = Math.max(0, Math.min(idx, n - 1));
      var target = g.children[pageIdx];
      if (target) g.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    }
    prevBtn.addEventListener('click', function () { goTo(pageIdx - 1); });
    nextBtn.addEventListener('click', function () { goTo(pageIdx + 1); });
    function syncDots() {
      Array.prototype.forEach.call(dotsEl.children, function (d, i) {
        d.classList.toggle('shop-dot--on', i === pageIdx);
      });
    }
    // renderWeapons() 가 매번 grid 를 통째로 새로 만들기 때문에(body.innerHTML), 장착 버튼을
    // 눌러 재렌더될 때도 새 grid 는 항상 scrollLeft=0 에서 시작 — pageIdx 는 그대로 두고
    // 즉시(비-스무스) 그 위치로 복원해야 "장착 누르면 뿅망치 화면으로 튕김" 버그가 안 생긴다
    // (사용자 보고: "장착 버튼 누르면 뿅망치 화면나오고 장착이 안됨"). 탭 전환일 때만 0으로.
    function updateDots() {
      var g = grid();
      dotsEl.innerHTML = '';
      var n = g ? g.children.length : 0;
      if (pageIdx > n - 1) pageIdx = Math.max(0, n - 1);
      for (var i = 0; i < n; i++) {
        var d = document.createElement('span');
        d.className = 'shop-dot';
        dotsEl.appendChild(d);
      }
      syncDots();
      if (g && g.children[pageIdx]) g.scrollLeft = g.children[pageIdx].offsetLeft;
      updateEquipBtn();
    }
    // 카드를 손으로 직접 스와이프했을 때도 pageIdx/점/장착버튼이 같이 따라가야 함(화살표
    // 클릭 외 유일한 페이지 이동 경로) — grid 는 렌더마다 새로 만들어지므로(body.innerHTML),
    // 스크롤 이벤트가 버블링은 안 해도 캡처 단계에선 조상까지 올라오는 걸 이용해 body 에 고정
    // 리스너를 걸어둔다.
    body.addEventListener('scroll', function (e) {
      var g = grid(); if (!g || e.target !== g || !g.children.length) return;
      var idx = Math.round(g.scrollLeft / g.clientWidth);
      idx = Math.max(0, Math.min(idx, g.children.length - 1));
      if (idx !== pageIdx) {
        pageIdx = idx;
        syncDots();
        updateEquipBtn();
      }
    }, true);

    function equipped() {
      var w = localStorage.getItem('mole.weapon');
      return w === 'cannon' ? 'cannon' : (w === 'goldhammer' ? 'goldhammer' : (w === 'alipunch' ? 'alipunch' : 'hammer'));
    }
    function nameOf(w) {
      return I18N.lang === 'en' ? w.nameEn : w.name;
    }
    // 장착 버튼 = 카드 밖(위쪽)의 단일 버튼(사용자 지정: "장착 선택박스를 아예 밖으로 빼도
    // 됨(위로)") — 현재 페이지(pageIdx)가 가리키는 무기 기준으로 매번 갱신.
    function updateEquipBtn() {
      if (!equipBtn) return;
      var w = WEAPONS[pageIdx];
      if (!w) { equipBtn.hidden = true; return; }
      equipBtn.hidden = false;
      var cur = equipped();
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      equipBtn.textContent = w.id === cur ? T('mole.inv.equipped') : T('mole.inv.equip');
      equipBtn.disabled = w.id === cur || locked;
      equipBtn.onclick = function () {
        localStorage.setItem('mole.weapon', w.id);
        // 뿅망치는 라이트 ON 만 사용 가능(사용자 지정) — DIM/OFF 였으면 ON 으로.
        if (w.id === 'hammer') {
          var diff = localStorage.getItem('mole.difficulty');
          if (diff === 'mid' || diff === 'legend') localStorage.setItem('mole.difficulty', 'easy');
        }
        renderWeapons();
      };
    }

    function renderWeapons() {
      var cur = equipped();
      body.innerHTML = '<div class="inv-grid"></div>';
      var grid = body.querySelector('.inv-grid');
      WEAPONS.forEach(function (w) {
        var card = document.createElement('div');
        card.className = 'inv-card' + (w.id === cur ? ' inv-card--on' : '');
        // 알리 펀치 = 좌/우 글러브 한 쌍(오른쪽은 왼쪽 이미지 거울상 — 실제 게임과 동일, §1).
        // 강조 애니메이션(사용자 지시): 두 글러브가 2번 맞부딪히고, 2번째에 스파크+"POWER UP" 표시.
        var thumbHtml = w.id === 'alipunch'
          ? '<div class="inv-thumb inv-thumb--pair"><img alt="" src="' + w.thumb + '">' +
            '<img alt="" class="inv-thumb-mirror" src="' + w.thumb + '">' +
            '<span class="inv-bump-spark">✨</span><span class="inv-bump-word">POWER UP</span></div>'
          // 캐논 강조 애니메이션(사용자 지시): 포신 반동 + 실제 게임 화염·연기 스프라이트 재사용.
          : w.id === 'cannon'
          ? '<div class="inv-thumb inv-thumb--cannon"><img alt="" src="' + w.thumb + '">' +
            '<img alt="" class="inv-cannon-burn" src="assets/weapons/cannon-fx4.png">' +
            '<img alt="" class="inv-cannon-smoke" src="assets/weapons/cannon-fx5.png">' +
            '<span class="inv-cannon-word">BOOM!</span></div>'
          // 골드해머 강조 애니메이션(사용자 지시, 참고 이미지 확인): 반시계 90도 회전(타격하듯) 후,
          // 망치 끝(머리, 회전 후 위치 약 30%/59%)에서 여러 갈래로 갈라지는 균열 선 + "QUAKE!".
          : '<div class="inv-thumb' + (w.gemGlow ? ' inv-thumb--gem' : '') + '">' +
          '<img alt="" src="' + w.thumb + '">' + (w.gemGlow
            ? // 사용자 지시: 상점 카드 보석 글로우 삭제.
              // 사용자 지정: 균열이 9시(왼쪽)·11시(왼쪽위)·12시(위)·3시(오른쪽) 방향으로 뻗음.
              '<svg class="inv-hammer-crack" viewBox="0 0 100 100" aria-hidden="true">' +
              '<path class="c1" d="M50 50 L40 46 L32 52 L15 47" />' +
              '<path class="c2" d="M50 50 L42 45 L37 36 L30 20" />' +
              '<path class="c3" d="M50 50 L46 40 L52 32 L47 15" />' +
              '<path class="c4" d="M50 50 L60 46 L68 52 L85 47" />' +
              '</svg>' +
              '<span class="inv-hammer-word">QUAKE!</span>'
            : '') + '</div>';
        // 카드가 거의 전체폭이라 좌(이름+이미지)/우(능력치) 2단 배치(사용자 지정: "이름과
        // 이미지 좌측배치, 능력치 우측배치"). 장착 버튼은 카드 밖(위쪽)의 단일 버튼으로 이동
        // (사용자 지정: "장착 선택박스를 아예 밖으로 빼도 됨(위로)") — updateEquipBtn() 참고.
        card.innerHTML =
          '<div class="inv-top">' +
            '<div class="inv-left"><span class="inv-name"></span>' + thumbHtml + '</div>' +
            '<div class="inv-right"><div class="inv-stat">' +
              '<div class="inv-stat-h"></div>' +
              '<table class="inv-stat-tbl"><tbody>' +
                w.stats.map(function () { return '<tr><th></th><td></td></tr>'; }).join('') +
              '</tbody></table>' +
            '</div></div>' +
          '</div>';
        card.querySelector('.inv-name').textContent = nameOf(w);
        card.querySelector('.inv-stat-h').textContent = T('mole.inv.statHead');
        var trs = card.querySelectorAll('.inv-stat-tbl tr');
        w.stats.forEach(function (s, i) {
          trs[i].querySelector('th').textContent = T(STAT_ROWS[i]);
          var td = trs[i].querySelector('td');
          var v = (I18N.lang === 'en' ? s[1] : s[0]);
          td.textContent = v;
          if (v === '-') td.classList.add('inv-stat-dash'); // 값 없음 = 중앙정렬
        });
        grid.appendChild(card);
      });
      updateDots();
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'shop-tab' + (t.id === active ? ' shop-tab--on' : '');
        b.innerHTML = '<span class="shop-tab-ico">' + t.icon + '</span><span class="shop-tab-lbl"></span>';
        b.querySelector('.shop-tab-lbl').textContent = T(t.i18n);
        b.addEventListener('click', function () { active = t.id; pageIdx = 0; paint(); });
        tabsEl.appendChild(b);
      });
    }

    function paint() {
      renderTabs();
      var tab = TABS.filter(function (t) { return t.id === active; })[0];
      if (tab) bannerTxtEl.textContent = T(tab.banner);
      headEl.style.display = active === 'weapon' ? '' : 'none';
      if (active === 'weapon') {
        renderWeapons();
      } else {
        dotsEl.innerHTML = '';
        body.innerHTML = '<p class="inv-soon">' + T('mole.inv.soon') + '</p>';
      }
    }

    return { show: function () { active = 'weapon'; paint(); } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.InventoryScreen = api; }
})(typeof window !== 'undefined' ? window : null);

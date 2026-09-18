(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var I18N = function () { return root.FGH.I18N; };
  var GOLD_KEY = 'mole.skinGoldOwned';
  var SKIN_KEY = 'mole.hammerSkin';
  var GOLD_PRICE = 300;

  // 두더지팡 다이얼패드(lane-controls.js SVG.hearts/coins/tickets)와 같은 아이콘 재사용 —
  // 새 이미지 없이 앱 기존 아이콘 언어를 그대로 상점 카드 배지에 씀(사용자 지정).
  var ICONS = {
    hearts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
    coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="9" rx="8.5" ry="4.3"/><path d="M3.5 9v3.5c0 2.4 3.8 4.3 8.5 4.3s8.5-1.9 8.5-4.3V9"/><path d="M6.5 9c1.3 1.2 3.4 2 5.5 2s4.2-.8 5.5-2"/></svg>',
    tickets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M3 7h18v3.2a1.6 1.6 0 000 3.6V17H3v-3.2a1.6 1.6 0 000-3.6z"/><path d="M14 7.3v9.4" stroke-dasharray="1.4 1.6"/><circle cx="8" cy="12" r="1.3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
  };

  // 상점 "무기" 탭 = 아이템보관창(inventory-screen.js) 무기탭과 같은 4종(사용자 지정: "지금 있는
  // 뿅망치, 팡팡 캐논, 황금 묠니르, 알리 판취 넣어서 구성"). 가격은 참고 이미지 스타일을 맞추기
  // 위한 표시용 placeholder — 실제 구매 로직에 연결하지 않음(사용자: "일단 넣고 이후 수정").
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/hammer.png', price: null },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1.png', price: 3000 },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldhammer-0.png', price: 5000 },
    { id: 'alipunch', name: '알리 판취', nameEn: 'Ali Punch', thumb: 'assets/weapons/alipunch-jab.png', price: 7000 }
  ];

  function create(opts) {
    var el = opts.root;
    var cardsEl = el.querySelector('[data-shop-cards]');
    var tabsEl = el.querySelector('[data-shop-tabs]');
    var bannerEl = el.querySelector('[data-shop-banner]');
    var hudEl = el.querySelector('[data-shop-hud]');
    var dotsEl = el.querySelector('[data-shop-dots]');
    var noticeEl = el.querySelector('[data-shop-notice]');
    var prevBtn = el.querySelector('[data-shop-prev]');
    var nextBtn = el.querySelector('[data-shop-next]');
    // 상단 뒤로가기/제목 바 삭제(사용자 지정) — 종료는 다이얼패드 홈 아이콘(onHomeAction 'home')으로.

    // 카드 줄 좌우 화살표+점 페이지 표시(사용자 지정: "상점UI 파일처럼 화살표, 페이지 점들도").
    // 카드 폭이 이제 %기반(style.css .shop-card, 항상 3장 꽉 참)이라 고정 px 대신 실제 렌더된
    // 카드 폭을 매번 읽어씀 — 화면 크기 달라져도 항상 정확히 카드 1장 단위로 스크롤.
    function cardUnit() {
      var first = cardsEl.children[0];
      return first ? first.getBoundingClientRect().width + 10 : 118; // +10 = gap
    }
    prevBtn.addEventListener('click', function () { cardsEl.scrollBy({ left: -cardUnit() * 3, behavior: 'smooth' }); });
    nextBtn.addEventListener('click', function () { cardsEl.scrollBy({ left: cardUnit() * 3, behavior: 'smooth' }); });
    function updateDots() {
      var n = cardsEl.children.length;
      dotsEl.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var d = document.createElement('span');
        d.className = 'shop-dot';
        dotsEl.appendChild(d);
      }
      syncDots();
    }
    function syncDots() {
      var idx = Math.round(cardsEl.scrollLeft / cardUnit());
      Array.prototype.forEach.call(dotsEl.children, function (d, i) {
        d.classList.toggle('shop-dot--on', i === idx);
      });
    }
    cardsEl.addEventListener('scroll', syncDots);

    // 보이는 3장 중 가운데 카드에 5초마다 스윙 연출(사용자 지정: "중앙에 오면 스윙, 5초간격 루프,
    // 무기도 마찬가지" — 탭 종류 안 가리고 공통 적용).
    setInterval(function () {
      var cards = cardsEl.children;
      if (!cards.length) return;
      Array.prototype.forEach.call(cards, function (c) { c.classList.remove('shop-card--swing'); });
      var centerIdx = Math.min(Math.round(cardsEl.scrollLeft / cardUnit()) + 1, cards.length - 1);
      var target = cards[centerIdx];
      if (target && target.classList.contains('shop-card')) {
        void target.offsetWidth; // 리플로우 강제 — 같은 클래스 재부착해도 애니메이션 재실행되게
        target.classList.add('shop-card--swing');
      }
    }, 5000);

    // 무기 탭 아이콘 — 후보 시트(뿅망치 만화 소프트해머, #7) 사용자 선택, 시계방향 45도 회전 +
    // 그라디언트/하이라이트로 입체감(사용자 지정: "7번으로 해서 시계방향 45도 회전, 입체감").
    var WEAPON_TAB_ICON =
      '<svg viewBox="0 0 64 64">' +
      '<defs>' +
        '<linearGradient id="wpHandle" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#fbe6a8"/><stop offset="1" stop-color="#c99a3e"/>' +
        '</linearGradient>' +
        '<linearGradient id="wpHead" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#ff6b5e"/><stop offset="1" stop-color="#c72e22"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="rotate(45 32 32)">' +
        '<rect x="29" y="30" width="6" height="24" rx="3" fill="url(#wpHandle)"/>' +
        '<rect x="14" y="12" width="36" height="20" rx="10" fill="url(#wpHead)"/>' +
        '<rect x="14" y="12" width="36" height="8" rx="6" fill="#fff" opacity="0.35"/>' +
        '<path d="M32 16 33.5 20 38 20 34.5 22.6 36 27 32 24.2 28 27 29.5 22.6 26 20 30.5 20Z" fill="#fff"/>' +
      '</g></svg>';

    // 스킬 탭 아이콘 — 후보 시트 #7(음양) 사용자 최종 선택, 그라디언트+하이라이트로 입체감.
    var SKILL_TAB_ICON =
      '<svg viewBox="0 0 64 64">' +
      '<defs>' +
        '<radialGradient id="skWhite" cx="0.35" cy="0.3" r="0.8">' +
          '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d6dc"/>' +
        '</radialGradient>' +
        '<linearGradient id="skBlack" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#4a4a54"/><stop offset="1" stop-color="#0c0c12"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="32" cy="32" r="24" fill="url(#skWhite)" stroke="#0c0c12" stroke-width="2"/>' +
      '<path d="M32 8 A12 12 0 0 1 32 32 A12 12 0 0 0 32 56 A24 24 0 0 0 32 8 Z" fill="url(#skBlack)"/>' +
      '<circle cx="32" cy="20" r="4" fill="#0c0c12"/>' +
      '<circle cx="32" cy="44" r="4" fill="url(#skWhite)"/>' +
      '</svg>';

    // 코스튬 탭 아이콘 — 후보 시트 #1(티셔츠) 사용자 선택, 그라디언트+하이라이트로 입체감.
    var COSTUME_TAB_ICON =
      '<svg viewBox="0 0 64 64">' +
      '<defs>' +
        '<linearGradient id="csShirt" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#8fa6e8"/><stop offset="1" stop-color="#3d5aa8"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="M22 12 L14 18 L18 26 L22 23 V52 H42 V23 L46 26 L50 18 L42 12 Q37 17 32 17 Q27 17 22 12Z" fill="url(#csShirt)"/>' +
      '<path d="M22 12 L14 18 L18 26 L22 23 V29 L15 20 Z" fill="#fff" opacity="0.3"/>' +
      '</svg>';

    // 하단 탭 아이콘 — 이모지(사용자 지정: "이모지나 이미지 넣어야함", 참고 이미지의 하트/망치/별/옷 자리).
    var TABS = [
      { id: 'currency', i18n: 'mole.shop.tabCurrency', icon: '❤️' },
      { id: 'weapon', i18n: 'mole.shop.tabWeapon', icon: WEAPON_TAB_ICON },
      { id: 'skill', i18n: 'mole.shop.tabSkill', icon: SKILL_TAB_ICON },
      { id: 'costume', i18n: 'mole.shop.tabCostume', icon: COSTUME_TAB_ICON }
    ];
    var activeTab = 'currency';

    function done() { render(); if (opts.onChange) opts.onChange(); }

    function card(opts2) {
      // opts2: { badge(html), name, price(text|null), btnText, btnDisabled, onClick, equipped }
      var c = document.createElement('div');
      c.className = 'shop-card' + (opts2.equipped ? ' shop-card--equipped' : '');
      c.innerHTML =
        '<div class="shop-card-badge"></div>' +
        '<div class="shop-card-name"></div>' +
        (opts2.price ? '<div class="shop-card-price"></div>' : '') +
        '<button type="button" class="shop-card-btn"' + (opts2.btnDisabled ? ' disabled' : '') + '></button>';
      c.querySelector('.shop-card-badge').innerHTML = opts2.badge;
      c.querySelector('.shop-card-name').textContent = opts2.name;
      if (opts2.price) c.querySelector('.shop-card-price').textContent = opts2.price;
      var btn = c.querySelector('.shop-card-btn');
      btn.textContent = opts2.btnText;
      if (!opts2.btnDisabled) btn.addEventListener('click', opts2.onClick);
      return c;
    }

    function renderCurrencyCards() {
      cardsEl.innerHTML = '';
      cardsEl.appendChild(card({
        badge: ICONS.hearts, name: T('mole.shop.heart1'), price: '100🪙',
        btnText: T('mole.shop.buy'), btnDisabled: MG.Economy.getCoins() < 100,
        onClick: function () { if (MG.Economy.spendCoins(100)) { MG.Economy.addHearts(1); done(); } else alert(T('mole.shop.noCoin')); }
      }));
      cardsEl.appendChild(card({
        badge: ICONS.hearts, name: T('mole.shop.heartFull'), price: '400🪙',
        btnText: T('mole.shop.buy'), btnDisabled: MG.Economy.getCoins() < 400,
        onClick: function () { if (MG.Economy.spendCoins(400)) { MG.Economy.addHearts(MG.Economy.HEART_MAX); done(); } else alert(T('mole.shop.noCoin')); }
      }));
      cardsEl.appendChild(card({
        badge: ICONS.play, name: T('mole.shop.watchHeart'), price: T('mole.shop.free'),
        btnText: '▶', btnDisabled: false,
        onClick: function () { MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); done(); } }); }
      }));
      cardsEl.appendChild(card({
        badge: ICONS.play, name: T('mole.shop.watchCoin'), price: T('mole.shop.free'),
        btnText: '▶', btnDisabled: false,
        onClick: function () { MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addCoins(50); done(); } }); }
      }));
    }

    function equippedWeapon() {
      var w = localStorage.getItem('mole.weapon');
      return w === 'cannon' ? 'cannon' : (w === 'goldhammer' ? 'goldhammer' : (w === 'alipunch' ? 'alipunch' : 'hammer'));
    }

    function renderWeaponCards() {
      cardsEl.innerHTML = '';
      var cur = equippedWeapon();
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      var hammerOnly = !!(opts.hammerOnly && opts.hammerOnly());
      if (locked || hammerOnly) {
        noticeEl.hidden = false;
        noticeEl.textContent = locked ? T('mole.inv.locked') : T('mole.inv.hammerOnly');
      }
      WEAPONS.forEach(function (w) {
        var isCur = w.id === cur;
        var disabled = isCur || locked || (hammerOnly && w.id !== 'hammer');
        // 알리 판취 = 아이템보관창(inventory-screen.js .inv-thumb--pair)과 동일하게 좌/우 글러브
        // 한 쌍(오른쪽은 왼쪽 이미지 거울상)으로 표시(사용자 지정: "아이템에 있는 이미지 그대로").
        var badgeHtml = w.id === 'alipunch'
          ? '<div class="shop-card-badge--pair"><img alt="" src="' + w.thumb + '">' +
            '<img alt="" class="shop-thumb-mirror" src="' + w.thumb + '"></div>'
          : '<img alt="" src="' + w.thumb + '">';
        cardsEl.appendChild(card({
          badge: badgeHtml,
          name: I18N().lang === 'en' ? w.nameEn : w.name,
          price: w.price ? (w.price.toLocaleString() + '🪙') : null,
          btnText: isCur ? T('mole.inv.equipped') : T('mole.inv.equip'),
          btnDisabled: disabled,
          equipped: isCur,
          onClick: function () {
            localStorage.setItem('mole.weapon', w.id);
            if (w.id === 'hammer') {
              var diff = localStorage.getItem('mole.difficulty');
              if (diff === 'mid' || diff === 'legend') localStorage.setItem('mole.difficulty', 'easy');
            }
            done();
          }
        }));
      });
    }

    function renderCostumeCards() {
      cardsEl.innerHTML = '';
      MG.Costume.sets().forEach(function (s) {
        if (s.id === 'starter') return;
        var owned = MG.Costume.ownsSet(s.id);
        cardsEl.appendChild(card({
          badge: MG.CostumeArt.chip('hat', s.hat) + MG.CostumeArt.chip('body', s.body) + MG.CostumeArt.chip('glasses', s.glasses),
          name: s.name,
          price: owned ? null : (s.price.toLocaleString() + '🪙'),
          btnText: owned ? T('mole.cos.setOwned') : T('mole.cos.setBuy', { n: s.price.toLocaleString() }),
          btnDisabled: owned,
          equipped: owned,
          onClick: function () { if (MG.Costume.buySet(s.id)) done(); else alert(T('mole.shop.noCoin')); }
        }));
      });
    }

    // 스킬 탭 — 아직 게임에 없는 카테고리(사용자 지정: "스킬(만들어야지)") — 뼈대만, 준비중 표시.
    function renderSkillCards() {
      cardsEl.innerHTML = '<p class="shop-soon">' + T('mole.inv.soon') + '</p>';
    }

    var RENDERERS = { currency: renderCurrencyCards, weapon: renderWeaponCards, skill: renderSkillCards, costume: renderCostumeCards };

    function renderBanner() {
      bannerEl.innerHTML =
        '<img alt="" class="shop-banner-pic" src="assets/avatar-mole.png">' +
        '<span class="shop-banner-txt"></span>';
      bannerEl.querySelector('.shop-banner-txt').textContent = T('mole.shop.welcome');
    }

    // 참고 이미지처럼 [원형 배지 아이콘][숫자][+ 버튼] 캡슐, 화면 좌우 끝까지 분산(사용자 지정:
    // "좌우 최대한 활용"). + 버튼은 눌리면 하트/코인/티켓 탭으로 이동(자연스러운 동작 연결).
    function hudStat(kind, iconHtml, n) {
      return '<span class="shop-hud-stat shop-hud-stat--' + kind + '">' +
        '<span class="shop-hud-main">' +
          '<span class="shop-hud-ico">' + iconHtml + '</span>' +
          '<b class="shop-hud-n">' + n + '</b>' +
        '</span>' +
        '<button type="button" class="shop-hud-plus" data-hud-plus>+</button></span>';
    }
    function renderHud() {
      // 항상 하트-코인-티켓 순(사용자 지정).
      hudEl.innerHTML =
        hudStat('heart', ICONS.hearts, MG.Economy.getHearts()) +
        hudStat('coin', ICONS.coins, MG.Economy.getCoins().toLocaleString()) +
        hudStat('ticket', ICONS.tickets, MG.Economy.getTickets());
      Array.prototype.forEach.call(hudEl.querySelectorAll('[data-hud-plus]'), function (b) {
        b.addEventListener('click', function () { activeTab = 'currency'; render(); });
      });
    }

    function renderTabs() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'shop-tab' + (t.id === activeTab ? ' shop-tab--on' : '');
        b.innerHTML = '<span class="shop-tab-ico">' + t.icon + '</span><span class="shop-tab-lbl"></span>';
        b.querySelector('.shop-tab-lbl').textContent = T(t.i18n);
        b.addEventListener('click', function () { activeTab = t.id; render(); });
        tabsEl.appendChild(b);
      });
    }

    function render() {
      renderHud();
      renderTabs();
      noticeEl.hidden = true;
      cardsEl.scrollLeft = 0;
      RENDERERS[activeTab]();
      updateDots();
    }

    function show() { renderBanner(); activeTab = 'currency'; render(); }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Shop = api; }
})(typeof window !== 'undefined' ? window : null);

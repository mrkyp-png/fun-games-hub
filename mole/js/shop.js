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

  // 하트 재화 카드 전용 아트 — 사용자 지정: "하트 이미지, 유튜브 이미지 파일에 하트 하나
  // 있잖아. 그걸로 써" + "작은하트 5~6개는 작은 하트 이미지 파일에 있는거 쓰고" — 두
  // 원본 파일에서 하트 하나·작은 하트 6개·광고아이콘을 각각 낱개로 잘라(배경 없음, 알파
  // 그대로) 카드별로 조합. 광고아이콘도 낱개(사용자 지정: "하트위에 일부 유튜브가 겹치게").
  var HEART_ART = {
    heart: 'assets/shop/single-heart.png',     // 하트 이미지, 유튜브 이미지 파일 속 하트 하나
    minis: ['assets/shop/mini-1.png', 'assets/shop/mini-2.png', 'assets/shop/mini-3.png',
      'assets/shop/mini-4.png', 'assets/shop/mini-5.png', 'assets/shop/mini-6.png'], // 작은 하트 이미지 파일 속 6개
    ad: 'assets/shop/ad-icon.png'              // 하트 이미지, 유튜브 이미지 파일 속 광고 아이콘만
  };
  function heroArt(kind) {
    if (kind === 'solo') return '<img alt="" class="hero-solo" src="' + HEART_ART.heart + '">';
    if (kind === 'ad') {
      // 하트 위에 광고 아이콘이 겹쳐 올라타는 구도(사용자 지정: "하트위에 일부 유튜브가
      // 겹치게 올라타기") — 통짜 이미지 대신 하트/아이콘을 낱개로 겹쳐 배치.
      return '<div class="hero-ad"><img alt="" class="hero-ad-heart" src="' + HEART_ART.heart + '">' +
        '<img alt="" class="hero-ad-icon" src="' + HEART_ART.ad + '"></div>';
    }
    // pile — 메인 하트 하나(가운데, 크게) + 작은 하트 6개(둘레에 흩뿌림).
    var minis = HEART_ART.minis.map(function (src, i) {
      return '<img alt="" class="hero-mini hero-mini--' + i + '" src="' + src + '">';
    }).join('');
    return '<div class="hero-pile"><img alt="" class="hero-pile-main" src="' + HEART_ART.heart + '">' + minis + '</div>';
  }

  // 상점 "무기" 탭 = 아이템보관창(inventory-screen.js) 무기탭과 같은 4종(사용자 지정: "지금 있는
  // 뿅망치, 팡팡 캐논, 황금 묠니르, 알리 판취 넣어서 구성"). 가격은 참고 이미지 스타일을 맞추기
  // 위한 표시용 placeholder — 실제 구매 로직에 연결하지 않음(사용자: "일단 넣고 이후 수정").
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/hammer.png', price: null },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1.png', price: 10000 },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldhammer-0.png', price: 50000 },
    { id: 'alipunch', name: '알리 판취', nameEn: 'Ali Punch', thumb: 'assets/weapons/alipunch-jab.png', price: 100000 }
  ];

  function create(opts) {
    var el = opts.root;
    var cardsEl = el.querySelector('[data-shop-cards]');
    var tabsEl = el.querySelector('[data-shop-tabs]');
    var bannerEl = el.querySelector('[data-shop-banner]');
    var dotsEl = el.querySelector('[data-shop-dots]');
    // 상단 뒤로가기/제목 바 삭제(사용자 지정) — 종료는 다이얼패드 홈 아이콘(onHomeAction 'home')으로.

    // 카드 줄 좌우 화살표+점 페이지 표시(사용자 지정: "상점UI 파일처럼 화살표, 페이지 점들도").
    // 카드 폭이 이제 %기반(style.css .shop-card, 항상 3장 꽉 참)이라 고정 px 대신 실제 렌더된
    // 카드 폭을 매번 읽어씀 — 화면 크기 달라져도 항상 정확히 카드 1장 단위로 스크롤.
    function cardUnit() {
      var first = cardsEl.children[0];
      return first ? first.getBoundingClientRect().width + 10 : 118; // +10 = gap
    }
    // 화살표는 배너 안(우측)에 있어 renderBanner() 가 매번 새로 그림 — 거기서 바로 배선.
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

    // 가운데 카드 1장만 스윙하던 것 → 왼쪽부터 순차적으로 전체 카드에 스윙(사용자 지정:
    // "가운데만 주니 의미없다, 왼쪽부터 순차적으로"), 5초마다 한 바퀴씩.
    setInterval(function () {
      var cards = cardsEl.children;
      if (!cards.length) return;
      Array.prototype.forEach.call(cards, function (c) { c.classList.remove('shop-card--swing'); });
      Array.prototype.forEach.call(cards, function (c, i) {
        setTimeout(function () {
          if (!c.classList.contains('shop-card')) return;
          void c.offsetWidth; // 리플로우 강제 — 같은 클래스 재부착해도 애니메이션 재실행되게
          c.classList.add('shop-card--swing');
        }, i * 220);
      });
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

    // 하단 탭 아이콘 — 이모지(사용자 지정: "이모지나 이미지 넣어야함", 참고 이미지의 하트/망치/별/옷 자리).
    var TABS = [
      { id: 'currency', i18n: 'mole.shop.tabCurrency', icon: '💰' },
      { id: 'weapon', i18n: 'mole.shop.tabWeapon', icon: WEAPON_TAB_ICON },
      { id: 'skill', i18n: 'mole.shop.tabSkill', icon: SKILL_TAB_ICON },
      { id: 'costume', i18n: 'mole.shop.tabCostume', icon: '👕' }
    ];
    var activeTab = 'currency';
    var currencyFilter = null; // null=전체, 'heart'/'coin'/'ticket'=다이얼패드 캡슐 클릭으로 필터

    function done() { render(); if (opts.onChange) opts.onChange(); }

    function card(opts2) {
      // opts2: { badge(html), name, price(text|null), priceAmount(숫자만, 버튼 안에 코인
      // 아이콘+숫자로 넣을 때만), btnText, btnDisabled, onClick, equipped, btnPlain }
      // priceAmount 가 있으면 하트 카드와 동일하게 버튼 안에 코인아이콘+숫자로(사용자 지정:
      // "무기 코인도 하트 이미지와 동일하게 자리도 통일, 코인 다음 숫자") — 이때 .shop-card-price
      // 줄은 생략(버튼 안으로 자리를 옮긴 것이므로).
      var c = document.createElement('div');
      c.className = 'shop-card' + (opts2.equipped ? ' shop-card--equipped' : '');
      var showPriceLine = opts2.price && !opts2.priceAmount;
      var btnClass = 'shop-card-btn' + (opts2.btnPlain ? ' shop-card-btn--plain' : '') +
        (opts2.priceAmount ? ' shop-card-btn--rich' : '');
      c.innerHTML =
        '<div class="shop-card-badge' + (opts2.badgeClass ? ' ' + opts2.badgeClass : '') + '"></div>' +
        '<div class="shop-card-name"></div>' +
        (showPriceLine ? '<div class="shop-card-price"></div>' : '') +
        '<button type="button" class="' + btnClass + '"' + (opts2.btnDisabled ? ' disabled' : '') + '></button>';
      c.querySelector('.shop-card-badge').innerHTML = opts2.badge;
      c.querySelector('.shop-card-name').textContent = opts2.name;
      if (showPriceLine) c.querySelector('.shop-card-price').textContent = opts2.price;
      var btn = c.querySelector('.shop-card-btn');
      if (opts2.priceAmount) btn.innerHTML = ICONS.coins + '<b>' + opts2.priceAmount + '</b>';
      else btn.textContent = opts2.btnText;
      if (!opts2.btnDisabled) btn.addEventListener('click', opts2.onClick);
      return c;
    }

    // 하트 카드 3장 전용 템플릿(사용자 제공 참고 이미지 스타일) — 리본 배지+큰 아트+설명문+
    // 보상 알약+가격/버튼. 무기·코스튬·코인 카드(card())와는 완전히 분리된 별도 마크업이라
    // 서로 영향 없음.
    function heartCard(o) {
      var c = document.createElement('div');
      c.className = 'shop-card shop-card--rich shop-card--' + o.theme;
      var btnClass = 'shop-card-btn shop-card-btn--rich' + (o.theme === 'blue' ? ' shop-card-btn--ad' : '');
      c.innerHTML =
        '<div class="shop-card-name-box"><div class="shop-card-name"></div></div>' +
        '<div class="shop-card-img-box"><div class="shop-card-badge shop-card-badge--hero"></div></div>' +
        '<div class="shop-card-desc"></div>' +
        '<div class="shop-card-pill">' + ICONS.hearts + '<span></span></div>' +
        '<button type="button" class="' + btnClass + '"' + (o.btnDisabled ? ' disabled' : '') + '></button>';
      c.querySelector('.shop-card-badge--hero').innerHTML = o.art;
      c.querySelector('.shop-card-name').textContent = o.name;
      c.querySelector('.shop-card-desc').textContent = o.desc;
      c.querySelector('.shop-card-pill span').textContent = o.pillText;
      var btn = c.querySelector('.shop-card-btn');
      btn.innerHTML = o.btnHtml;
      if (!o.btnDisabled) btn.addEventListener('click', o.onClick);
      return c;
    }

    function renderCurrencyCards() {
      cardsEl.innerHTML = '';
      var defs = [
        { kind: 'heart', rich: true, theme: 'pink', art: heroArt('solo'),
          name: T('mole.shop.heart1'), desc: T('mole.shop.descHeart1'), pillText: '+1',
          btnHtml: ICONS.coins + '<b>500</b>', btnDisabled: MG.Economy.getCoins() < 500,
          onClick: function () { if (MG.Economy.spendCoins(500)) { MG.Economy.addHearts(1); done(); } else alert(T('mole.shop.noCoin')); } },
        { kind: 'heart', rich: true, theme: 'pink', art: heroArt('pile'),
          name: T('mole.shop.heartFull'), desc: T('mole.shop.descHeartFull'), pillText: T('mole.shop.fullPill'),
          btnHtml: ICONS.coins + '<b>1,200</b>', btnDisabled: MG.Economy.getCoins() < 1200,
          onClick: function () { if (MG.Economy.spendCoins(1200)) { MG.Economy.addHearts(MG.Economy.HEART_MAX); done(); } else alert(T('mole.shop.noCoin')); } },
        { kind: 'heart', rich: true, theme: 'blue', art: heroArt('ad'),
          name: T('mole.shop.watchHeart'), desc: T('mole.shop.descWatchHeart'), pillText: '+1',
          // 재생 아이콘을 반투명 흰 박스 안에(사용자 지정: "화살표는 투명 흰색 박스안에").
          btnHtml: '<span class="scb-play-box">' + ICONS.play + '</span><b>' + T('mole.shop.watchAdBtn') + '</b>', btnDisabled: false,
          onClick: function () { MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); done(); } }); } }
      ];
      // 다이얼패드 착지 캡슐 클릭 시 그 재화만(사용자 지정: "각 버튼을 누르면 상품이 각 재화별로").
      var filtered = currencyFilter ? defs.filter(function (d) { return d.kind === currencyFilter; }) : defs;
      if (!filtered.length) {
        cardsEl.innerHTML = '<p class="shop-soon">' + T('mole.inv.soon') + '</p>';
        return;
      }
      filtered.forEach(function (d) { cardsEl.appendChild(d.rich ? heartCard(d) : card(d)); });
    }

    function renderWeaponCards() {
      cardsEl.innerHTML = '';
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      WEAPONS.forEach(function (w) {
        // 이미 장착 중이어도 버튼은 계속 눌러 "구매" 가능(사용자 지정: "최대한 계속 구매할 수
        // 있게, 누르면 복귀") — 잠금(라운드 진행 중)만 비활성화 사유로 남김. 장착 표시(테두리)는
        // 아이템보관창 전용(사용자 지정: "상점하고 아이템은 유사하지만 엄연히 다른거다").
        var disabled = locked;
        // 알리 판취 = 아이템보관창(inventory-screen.js .inv-thumb--pair)과 동일하게 좌/우 글러브
        // 한 쌍(오른쪽은 왼쪽 이미지 거울상)으로 표시(사용자 지정: "아이템에 있는 이미지 그대로").
        var badgeHtml = w.id === 'alipunch'
          ? '<div class="shop-card-badge--pair"><img alt="" src="' + w.thumb + '">' +
            '<img alt="" class="shop-thumb-mirror" src="' + w.thumb + '"></div>'
          : '<img alt="" src="' + w.thumb + '">';
        cardsEl.appendChild(card({
          badge: badgeHtml,
          badgeClass: 'shop-card-badge--weapon', // 사용자 지정: "무기 이미지 크기 1.2배"
          name: I18N().lang === 'en' ? w.nameEn : w.name,
          // 사용자 정정: "무기는 원래 코인옆에 숫자있었고, 아래 돈으로 사는 박스가
          // 있었잖아. 그 박스 위치는 우리가 통일화 시킬려고 했고" — 버튼에 합치는 게
          // 아니라 가격줄+구매버튼 2단 구조를 그대로 두고 "위치"만 맞추는 것이었음.
          // 사용자 지정: "캐논 10,000원..." — 단위를 "원"으로(코인 이모지 대신).
          price: w.price ? (w.price.toLocaleString() + '원') : null,
          // "장착" 대신 "구매"(사용자 지정) — 메일함 구매 시스템 도입 예정, 라벨만 우선 반영.
          // 뿅망치는 무료 기본무기라 "구매"가 아니라 "기본"(사용자 지정).
          btnText: w.id === 'hammer' ? T('mole.shop.default') : T('mole.shop.buy'),
          btnDisabled: disabled,
          btnPlain: w.id === 'hammer',
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

    // 배너 우측 메일 아이콘은 다이얼패드 "#"(시크릿 폐기) 자리로 이동함(사용자 지정) — 배너에는
    // 그 자리에 화살표(‹›)를 대신 넣는다(아이템 화면과 동일 패턴).
    function renderBanner() {
      bannerEl.innerHTML =
        '<img alt="" class="shop-banner-pic" src="assets/avatar-mole.png">' +
        '<span class="shop-banner-txt"></span>' +
        '<button type="button" class="shop-arrow shop-arrow--prev" data-shop-prev aria-label="이전">‹</button>' +
        '<button type="button" class="shop-arrow shop-arrow--next" data-shop-next aria-label="다음">›</button>';
      bannerEl.querySelector('.shop-banner-txt').textContent = T('mole.shop.welcome');
      bannerEl.querySelector('[data-shop-prev]').addEventListener('click', function () { cardsEl.scrollBy({ left: -cardUnit() * 3, behavior: 'smooth' }); });
      bannerEl.querySelector('[data-shop-next]').addEventListener('click', function () { cardsEl.scrollBy({ left: cardUnit() * 3, behavior: 'smooth' }); });
    }

    // 하트/코인/티켓 캡슐 = 상점 안이 아니라 다이얼패드(1/2/3 키) 위로 애니메이션 착지(사용자
    // 지정: "두더지팡으로 이동... 진입될때 아래 버튼보드에서 티켓위치로 롤인, 코인위치로 롤인,
    // 하트위치로는 슬라이드다운"). 순서: 티켓→코인→롤인, 하트→슬라이드다운, 순차 스태거.
    // 착지 전엔 전부 파란 "재화" 박스로 통일, 착지 후 하트=빨강/코인=노랑/티켓=하늘색으로 전환
    // (사용자 지정: "버튼보드에 오는 박스는 재화박스 파란색으로 통일... 안착이 된 후 색 변경").
    var DIALPAD_REGION = { ticket: '2', coin: '1', heart: '0' };
    // animateHudEntrance() 는 캡슐마다 350ms 씩 지연시켜(setTimeout) 순차 착지시키는데, 상점을
    // 빠르게 여러 번 열면(사용자 보고: "상품 버튼을 빠르게 누르면... 티켓 화면으로 간다",
    // 간헐적) 이전 호출의 setTimeout 들이 취소 안 된 채 남아있다가 뒤늦게 실행되어 캡슐이
    // 중복 생성되고, 그중 하나가 클릭되며 currencyFilter 를 몰래 바꿔버림 — 대기 중인
    // 타이머를 추적해뒀다가 재호출 시(removeHudFlys) 확실히 취소한다.
    var pendingTimers = [];
    function removeHudFlys() {
      pendingTimers.forEach(clearTimeout);
      pendingTimers = [];
      Array.prototype.forEach.call(document.querySelectorAll('.shop-hud-fly'), function (n) { n.remove(); });
    }
    // 무기 등 다른 탭 누르면 왼쪽으로 빠르게 롤아웃 후 제거(사용자 지정: "왼쪽으로 빠르게
    // 롤인으로 사라져야해").
    // 들어올 때(우측에서 순차 롤인)와 마찬가지로 나갈 때도 순차적으로(사용자 지정: "순차적으로
    // 사라지게"), 다만 진입(350ms 간격)보다 훨씬 빠르게(60ms 간격, 사용자 지정: "속도는 빠르게").
    function rollOutHudFlys() {
      var flys = document.querySelectorAll('.shop-hud-fly');
      if (!flys.length) return;
      var stagger = 60;
      Array.prototype.forEach.call(flys, function (cap, i) {
        setTimeout(function () {
          cap.style.transition = 'transform 0.22s ease-in, opacity 0.22s ease-in';
          cap.style.transform = 'translateX(-160px) rotate(-260deg)';
          cap.style.opacity = '0';
        }, i * stagger);
      });
      pendingTimers.push(setTimeout(removeHudFlys, (flys.length - 1) * stagger + 240));
    }
    function animateHudEntrance() {
      removeHudFlys();
      var order = ['ticket', 'coin', 'heart'];
      var icons = { heart: ICONS.hearts, coin: ICONS.coins, ticket: ICONS.tickets };
      order.forEach(function (kind, i) {
        pendingTimers.push(setTimeout(function () {
          var btn = document.querySelector('#lane-button-bar [data-region="' + DIALPAD_REGION[kind] + '"]');
          if (!btn) return;
          // ⚠️ 버그(사용자 보고: "올때마다 크기가 조금씩 변함", "어떨땐 겹치고") — 이 버튼은 숫자↔
          // 아이콘 3D 뒤집기 카드(.lane-flip)라, 뒤집는 도중(rotateY 트랜지션 중)에 딱 측정하면
          // getBoundingClientRect() 가 압축된 폭/틀어진 위치를 반환함. 폭·높이는 트랜스폼 영향
          // 안 받는 offsetWidth/offsetHeight(레이아웃 값)로, 위치는 rect 의 "중심점"만 써서
          // 그 중심 기준으로 안정된 크기의 박스를 재구성 — 중심은 대칭 트랜스폼에서 안 흔들림.
          var r = btn.getBoundingClientRect();
          var w = btn.offsetWidth, h = btn.offsetHeight;
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var n = kind === 'heart' ? MG.Economy.getHearts()
            : kind === 'coin' ? MG.Economy.getCoins().toLocaleString() : MG.Economy.getTickets();
          var cap = document.createElement('div');
          cap.className = 'shop-hud-fly shop-hud-fly--' + kind;
          cap.innerHTML = '<span class="shop-hud-ico">' + icons[kind] + '</span><b class="shop-hud-n">' + n + '</b>';
          cap.style.width = w + 'px';
          cap.style.height = h + 'px';
          cap.style.left = (cx - w / 2) + 'px';
          cap.style.top = (cy - h / 2) + 'px';
          document.body.appendChild(cap);
          // 시작 위치: 티켓/코인=옆에서 굴러들어옴(롤인), 하트=위에서 떨어짐(슬라이드다운).
          cap.style.transform = kind === 'heart' ? 'translateY(-140px)' : 'translateX(150px) rotate(300deg)';
          cap.style.opacity = '0';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              cap.style.transition = 'transform 0.5s cubic-bezier(.25,.85,.3,1.1), opacity 0.25s, background 0.3s, box-shadow 0.3s';
              cap.style.transform = 'translate(0,0) rotate(0deg)';
              cap.style.opacity = '1';
            });
          });
          cap.addEventListener('transitionend', function onEnd() {
            cap.removeEventListener('transitionend', onEnd);
            cap.classList.add('shop-hud-fly--landed');
            // 인라인 transform/transition 정리 — 안 지우면 CSS :active 눌림 스케일이
            // 인라인 스타일에 밀려 안 먹힘(사용자 지정: "눌림 스케일 효과줘야하고").
            cap.style.transform = '';
            cap.style.transition = '';
          });
          cap.addEventListener('click', function () {
            activeTab = 'currency';
            currencyFilter = kind;
            render();
          });
        }, i * 350));
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
        b.addEventListener('click', function () {
          // 하트/코인/티켓 캡슐은 탭 전환과 무관하게 상점에 있는 동안 항상 유지(사용자 지정:
          // "재화 버튼시에만 나타나라고 했는데 실수야 — 상점에 있을때는 항시 존재, 다른
          // 버튼일때 왼쪽으로 사라지게") — 탭을 바꿔도 롤아웃/재진입 안 함. 상점을 완전히
          // 벗어날 때만(el.hidden 감시, 파일 하단) 롤아웃.
          activeTab = t.id; currencyFilter = null; cardsEl.scrollLeft = 0; render();
        });
        tabsEl.appendChild(b);
      });
    }

    function render() {
      renderTabs();
      RENDERERS[activeTab]();
      updateDots();
    }

    function show() {
      renderBanner();
      activeTab = 'currency';
      currencyFilter = null;
      cardsEl.scrollLeft = 0;
      render();
      animateHudEntrance();
    }
    // 상점 화면이 닫히면(hidden 속성) 다이얼패드에 착지해있던 캡슐도 같이 정리 — 사용자가
    // 어느 경로로 나가도(홈 아이콘, 메일함 등 — 뒤로가기 버튼이 없어 경로가 다양함) 탭 전환과
    // 동일하게 롤아웃(사용자 지정: "재화버튼 외 다른 버튼을 누르면 전부 적용, 홈화면도 동일").
    new MutationObserver(function () {
      if (el.hidden) rollOutHudFlys();
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Shop = api; }
})(typeof window !== 'undefined' ? window : null);

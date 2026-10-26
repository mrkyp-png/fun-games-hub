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
    coins: '<img class="shop-coins-stack" src="assets/shop-ui-v1452/coin4-button-left.png" alt="">',
    tickets: '<img class="ticket-note-icon" src="assets/rhythm/ui/ic-ticket-note-complete.webp" alt="">',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
  };

  // 하트 재화 카드 전용 아트 — 사용자 지정: "하트 이미지, 유튜브 이미지 파일에 하트 하나
  // 있잖아. 그걸로 써" + "작은하트 5~6개는 작은 하트 이미지 파일에 있는거 쓰고" — 두
  // 원본 파일에서 하트 하나·작은 하트 6개·광고아이콘을 각각 낱개로 잘라(배경 없음, 알파
  // 그대로) 카드별로 조합. 광고아이콘도 낱개(사용자 지정: "하트위에 일부 유튜브가 겹치게").
  var SHOP_ART = 'assets/shop-ui-v1450/';
  var CURRENCY_ART = 'assets/shop-ui-v1452/';
  function coinOption(n) { return '<img class="shop-coins-stack" src="' + CURRENCY_ART + 'coin-option-' + n + '-bright20.png" alt="">'; }
  function coinPurchaseIcon(n) { return '<img class="shop-purchase-coin" src="' + CURRENCY_ART + 'coin-option-' + n + '-bright20.png" alt="">'; }
  var HEART_ART = {
    heart: SHOP_ART + '11-heart.webp',
    minis: ['assets/shop/mini-1.png', 'assets/shop/mini-2.png', 'assets/shop/mini-3.png',
      'assets/shop/mini-4.png', 'assets/shop/mini-5.png', 'assets/shop/mini-6.png']
  };
  function heroArt(kind) {
    if (kind === 'solo') return '<img alt="" class="hero-solo" src="' + HEART_ART.heart + '">';
    if (kind === 'ad') {
      return '<div class="hero-ad"><svg class="hero-ad-heart" viewBox="0 0 1254 1254" aria-hidden="true"><defs><clipPath id="shop-ad-heart-contour"><rect x="0" y="200" width="1254" height="1054"></rect></clipPath></defs><image href="' + HEART_ART.heart + '" width="1254" height="1254" clip-path="url(#shop-ad-heart-contour)"></image></svg>' +
        '<img class="hero-ad-icon" alt="" src="assets/shop/ad-icon-complete.png"></div>';
    }
    if (kind === 'jar') return '<img class="hero-jar-full" alt="" src="' + SHOP_ART + 'heart-jar-full.png">';
    // 하트 묶음은 분리한 원본 하트를 개별 배치한다.
    var minis = HEART_ART.minis.map(function (src, i) {
      return '<img alt="" class="hero-mini hero-mini--' + i + '" src="' + src + '">';
    }).join('');
    return '<div class="hero-pile"><img alt="" class="hero-pile-main" src="' + HEART_ART.heart + '">' + minis + '</div>';
  }
  function coinAdArt() {
    return '<div class="hero-ad hero-coin-ad"><img class="hero-coin-ad-coin" alt="" src="' + CURRENCY_ART + 'coin-option-05-bright20.png">' +
      '<img class="hero-ad-icon" alt="" src="assets/shop/ad-icon-complete.png"></div>';
  }

  // 무기 카드 이미지(하트 카드와 같은 리치 카드용) — 알리 판취만 좌/우 글러브 한 쌍(오른쪽은
  // 왼쪽 이미지 거울상, 기존 무기 카드와 동일), 나머지는 이미지 1장.
  function weaponArt(w) {
    if (w.id === 'alipunch') {
      return '<div class="hero-weapon-pair"><img alt="" src="' + w.thumb + '">' +
        '<img alt="" class="shop-thumb-mirror" src="' + w.thumb + '"></div>';
    }
    return '<img alt="" class="hero-weapon" src="' + w.thumb + '">';
  }

  // 상점 "무기" 탭 = 아이템보관창(inventory-screen.js) 무기탭과 같은 4종(사용자 지정: "지금 있는
  // 뿅망치, 팡팡 캐논, 황금 묠니르, 알리 판취 넣어서 구성"). 가격은 참고 이미지 스타일을 맞추기
  // 위한 표시용 placeholder — 실제 구매 로직에 연결하지 않음(사용자: "일단 넣고 이후 수정").
  // price = 현금(원) 결제 가격, coinPrice = 게임 코인 결제 가격 — 사용자 지정: "코인으로
  // 살수도 있고, 현금으로도 살수 있다고"(두 가지 결제 수단 공존).
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/inventory/ui-v1379/approved-mallet-redend-v1405.webp', price: null, coinPrice: null },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1-nol-v1392.png', price: 10000, coinPrice: 100000 },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldpaw-v1382.webp', price: 50000, coinPrice: 500000 },
    { id: 'alipunch', name: '킹판취', nameEn: 'King Punch', thumb: 'assets/weapons/kingfist-jab-mirror-v1390.webp', price: 100000, coinPrice: 1000000 }
  ];

  function create(opts) {
    var el = opts.root;
    var cardsEl = el.querySelector('[data-shop-cards]');
    var cardsBoxEl = el.querySelector('.shop-cards-box');
    var tabsEl = el.querySelector('[data-shop-tabs]');
    var backEl = el.querySelector('[data-shop-back]');
    if (backEl) backEl.addEventListener('click', function () { if (opts.onClose) opts.onClose(); });
    var bannerEl = el.querySelector('[data-shop-banner]');
    var dotsEl = el.querySelector('[data-shop-dots]');
    // 제목 바는 생략하고, 상단 좌측 복귀는 Score 화면의 원본 아이콘으로 처리.

    // 카드 줄 좌우 화살표+점 페이지 표시(사용자 지정: "상점UI 파일처럼 화살표, 페이지 점들도").
    // 카드 폭이 이제 %기반(style.css .shop-card, 항상 3장 꽉 참)이라 고정 px 대신 실제 렌더된
    // 카드 폭을 매번 읽어씀 — 화면 크기 달라져도 항상 정확히 카드 1장 단위로 스크롤.
    function cardUnit() {
      var first = cardsEl.children[0];
      return first ? first.getBoundingClientRect().width + 10 : 118; // +10 = gap
    }
    // 화살표는 배너 안(우측)에 있어 renderBanner() 가 매번 새로 그림 — 거기서 바로 배선.
    function updateDots() {
      var n = TABS.length;
      dotsEl.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var d = document.createElement('span');
        d.className = 'shop-dot';
        dotsEl.appendChild(d);
      }
      syncDots();
    }
    function syncDots() {
      var idx = TABS.findIndex(function (tab) { return tab.id === activeTab; });
      Array.prototype.forEach.call(dotsEl.children, function (d, i) {
        d.classList.toggle('shop-dot--on', i === idx);
      });
    }
    tabsEl.addEventListener('scroll', syncDots);

    // 가운데 카드 1장만 스윙하던 것 → 왼쪽부터 순차적으로 전체 카드에 스윙(사용자 지정:
    // "가운데만 주니 의미없다, 왼쪽부터 순차적으로"), 5초마다 한 바퀴씩.
    // 하트 카드 제목박스 순차 플래시(사용자 지정: "1번 카드부터 플래시 효과 순차적으로",
    // "스윙효과 끝나고 카드가 멈춰있을때 효과발동") — 각 카드 스윙(0.8s)이 끝난 직후 그
    // 카드부터 순서대로 발동.
    var SWING_MS = 800;
    setInterval(function () {
      var cards = cardsEl.children;
      if (!cards.length) return;
      Array.prototype.forEach.call(cards, function (c) {
        c.classList.remove('shop-card--swing');
        var nb = c.querySelector('.shop-card-name-box');
        if (nb) nb.classList.remove('shop-namebox-flash');
      });
      Array.prototype.forEach.call(cards, function (c, i) {
        setTimeout(function () {
          if (!c.classList.contains('shop-card')) return;
          void c.offsetWidth; // 리플로우 강제 — 같은 클래스 재부착해도 애니메이션 재실행되게
          c.classList.add('shop-card--swing');
        }, i * 220);
        setTimeout(function () {
          var nb = c.querySelector('.shop-card-name-box');
          if (!nb) return;
          void nb.offsetWidth;
          nb.classList.add('shop-namebox-flash');
        }, i * 220 + SWING_MS);
      });
    }, 5000);

    // 무기 탭 아이콘 — 후보 시트(뿅망치 만화 소프트해머, #7) 사용자 선택, 시계방향 45도 회전 +
    // 그라디언트/하이라이트로 입체감(사용자 지정: "7번으로 해서 시계방향 45도 회전, 입체감").
    var WEAPON_TAB_ICON = '<img src="assets/inventory/ui-v1379/approved-mallet-redend-v1405.webp" alt="">'; // 무기 화면 전시용 원본

    // 스킬 탭 아이콘 — 후보 시트 #7(음양) 사용자 최종 선택, 그라디언트+하이라이트로 입체감.
    var SKILL_TAB_ICON = '<img src="assets/tabs/skill.png" alt="">'; // 사용자 제공 이미지(v755)

    // 하단 탭 아이콘 — 이모지(사용자 지정: "이모지나 이미지 넣어야함", 참고 이미지의 하트/망치/별/옷 자리).
    var TABS = [
      { id: 'currency', i18n: 'mole.shop.tabHeart', icon: '<img src="' + SHOP_ART + '11-heart.webp" alt="">' },
      { id: 'coin', i18n: 'mole.shop.tabCoin', icon: '<img class="shop-coin-option" src="' + CURRENCY_ART + 'coin-option-05-bright20.png" alt="">' },
      { id: 'ticket', i18n: 'mole.shop.tabTicket', icon: '<img src="' + CURRENCY_ART + 'ticket-single.png" alt="">' },
      { id: 'weapon', i18n: 'mole.shop.tabWeapon', icon: WEAPON_TAB_ICON },
      { id: 'skill', i18n: 'mole.shop.tabSkill', icon: '<img src="' + SHOP_ART + 'skill-icon.png" alt="">' },
      { id: 'costume', i18n: 'mole.shop.tabCostume', icon: '<img src="' + SHOP_ART + 'costume-icon.png" alt="">' }
    ];
    var activeTab = 'currency';
    var currencyFilter = null; // null=전체, 'heart'/'coin'/'ticket'=다이얼패드 캡슐 클릭으로 필터
    var selectedCoinBonusWeapon = null;

    var alphaBoundsBySrc = Object.create(null);
    function centerVisibleImage(img) {
      if (!img.complete || !img.naturalWidth) {
        img.addEventListener('load', function () { centerVisibleImage(img); }, { once: true });
        return;
      }
      var src = img.currentSrc || img.src;
      var bounds = alphaBoundsBySrc[src];
      if (!bounds) {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          var context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(img, 0, 0);
          var pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          var left = canvas.width, top = canvas.height, right = -1, bottom = -1;
          for (var y = 0; y < canvas.height; y++) for (var x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
              if (x < left) left = x; if (x > right) right = x;
              if (y < top) top = y; if (y > bottom) bottom = y;
            }
          }
          bounds = right < left ? [0, 0, canvas.width, canvas.height] : [left, top, right + 1, bottom + 1];
          alphaBoundsBySrc[src] = bounds;
        } catch (e) { return; }
      }
      var rect = img.getBoundingClientRect();
      var scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      var dx = (img.naturalWidth / 2 - (bounds[0] + bounds[2]) / 2) * scale;
      var dy = (img.naturalHeight / 2 - (bounds[1] + bounds[3]) / 2) * scale;
      img.style.setProperty('translate', dx.toFixed(2) + 'px ' + dy.toFixed(2) + 'px', 'important');
    }
    function centerShopTabArt() {
      el.querySelectorAll('.shop-tab-ico img, .shop-card-badge--weapon > img, .hero-weapon, .hero-weapon-pair img, .shop-sale-currency, .shop-sale-item, .shop-sale-set img').forEach(centerVisibleImage);
    }

    function done() { render(); refreshHudFlyNumbers(); if (opts.onChange) opts.onChange(); }

    function showFinalConfirm(message, imageSrc, onConfirm) {
      var english = I18N().lang === 'en';
      var previous = el.querySelector('.shop-coin-choice-dialog');
      if (previous) previous.remove();
      var dialog = document.createElement('div');
      dialog.className = 'shop-coin-choice-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.innerHTML = '<div class="shop-coin-choice-card">' + (imageSrc ? '<img class="shop-coin-choice-art" src="' + imageSrc + '" alt="">' : '') +
        '<b class="shop-coin-choice-message"></b><div class="shop-coin-choice-actions">' +
        '<button type="button" class="shop-card-btn shop-coin-choice-action" data-choice-action="confirm">' + (english ? 'Yes' : '예') + '</button>' +
        '<button type="button" class="shop-card-btn shop-coin-choice-action" data-choice-action="cancel">' + (english ? 'No' : '아니요') + '</button></div></div>';
      dialog.querySelector('.shop-coin-choice-message').textContent = message;
      el.appendChild(dialog);
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog || event.target.closest('[data-choice-action="cancel"]')) { dialog.remove(); return; }
        if (event.target.closest('[data-choice-action="confirm"]')) { dialog.remove(); onConfirm(); }
      });
    }

    function defaultPurchasePrompt(name) {
      var english = I18N().lang === 'en';
      if (english) return 'Purchase ' + name + '?';
      var last = name.charCodeAt(name.length - 1);
      var hasFinalConsonant = last < 0xAC00 || last > 0xD7A3 || (last - 0xAC00) % 28 !== 0;
      return name + (hasFinalConsonant ? '을' : '를') + ' 구매하시겠습니까?';
    }

    function defaultSelectionPrompt(name) {
      var english = I18N().lang === 'en';
      if (english) return 'Select ' + name + '?';
      var last = name.charCodeAt(name.length - 1);
      var hasFinalConsonant = last < 0xAC00 || last > 0xD7A3 || (last - 0xAC00) % 28 !== 0;
      return name + (hasFinalConsonant ? '을' : '를') + ' 선택하시겠습니까?';
    }

    function card(opts2) {
      // opts2: { badge(html), name, price(text)|priceHtml(html, 코인아이콘+숫자용), btnText,
      // btnDisabled, onClick, equipped, btnPlain }
      // 가격줄(.shop-card-price)은 항상 버튼과 분리된 별도 줄 — priceHtml 이 있으면 코인
      // 아이콘+숫자 HTML 로(사용자 지정: "무기 코인 표기는 앞 재화의 코인에 뒤에 숫자형태로"),
      // 없으면 price 를 그냥 텍스트로.
      var c = document.createElement('div');
      c.className = 'shop-card' + (opts2.equipped ? ' shop-card--equipped' : '');
      var showPriceLine = !!(opts2.price || opts2.priceHtml);
      var btnClass = 'shop-card-btn' + (opts2.btnPlain ? ' shop-card-btn--plain' : '');
      c.innerHTML =
        '<div class="shop-card-badge' + (opts2.badgeClass ? ' ' + opts2.badgeClass : '') + '"></div>' +
        '<div class="shop-card-name"></div>' +
        (showPriceLine ? '<div class="shop-card-price"></div>' : '') +
        '<button type="button" class="' + btnClass + '"' + (opts2.btnDisabled ? ' disabled' : '') + '></button>';
      c.querySelector('.shop-card-badge').innerHTML = opts2.badge;
      c.querySelector('.shop-card-name').textContent = opts2.name;
      if (showPriceLine) {
        var priceEl = c.querySelector('.shop-card-price');
        if (opts2.priceHtml) { priceEl.innerHTML = opts2.priceHtml; priceEl.classList.add('shop-card-price--icon'); }
        else priceEl.textContent = opts2.price;
      }
      var btn = c.querySelector('.shop-card-btn');
      if (opts2.priceAmount) btn.innerHTML = ICONS.coins + '<b>' + opts2.priceAmount + '</b>';
      else btn.textContent = opts2.btnText;
      if (!opts2.btnDisabled && opts2.onClick) btn.addEventListener('click', function () {
        showFinalConfirm(opts2.confirmMessage || defaultPurchasePrompt(opts2.name), null, opts2.onClick);
      });
      return c;
    }

    // 하트 카드 3장 전용 템플릿(사용자 제공 참고 이미지 스타일) — 리본 배지+큰 아트+설명문+
    // 보상 알약+가격/버튼. 무기·코스튬·코인 카드(card())와는 완전히 분리된 별도 마크업이라
    // 서로 영향 없음.
    // desc 는 선택(무기 카드는 설명문 없이 이름+이미지+코인가+가격버튼 4단만 사용 — 사용자
    // 지정: "무기카드는 광고 보고 하트+1 카드 타입으로"), pillIcon 은 기본 하트, 무기는 코인.
    function heartCard(o) {
      var c = document.createElement('div');
      c.className = 'shop-card shop-card--rich shop-card--' + o.theme + (o.productClass ? ' ' + o.productClass : '');
      var btnClass = 'shop-card-btn shop-card-btn--rich' + (o.theme === 'blue' ? ' shop-card-btn--ad' : '');
      var hasDesc = o.desc != null;
      c.innerHTML =
        '<div class="shop-card-name-box"><div class="shop-card-name"></div></div>' +
        '<div class="shop-card-img-box"><div class="shop-card-badge shop-card-badge--hero"></div></div>' +
        (hasDesc ? '<div class="shop-card-desc"></div>' : '') +
        '<div class="shop-card-pill' + (o.pillClass ? ' ' + o.pillClass : '') + '">' +
        (o.pillIcon || ICONS.hearts) + '<span></span></div>' +
        '<button type="button" class="' + btnClass + '"' + (o.btnDisabled ? ' disabled' : '') + '></button>';
      c.querySelector('.shop-card-badge--hero').innerHTML = o.art;
      c.querySelector('.shop-card-name').textContent = o.name;
      if (hasDesc) c.querySelector('.shop-card-desc').textContent = o.desc;
      c.querySelector('.shop-card-pill span').textContent = o.pillText;
      var btn = c.querySelector('.shop-card-btn');
      btn.innerHTML = o.btnHtml;
      if (!o.btnDisabled && o.onClick) btn.addEventListener('click', function () {
        showFinalConfirm(o.confirmMessage || defaultPurchasePrompt(o.name), null, o.onClick);
      });
      return c;
    }

    function renderCurrencyCards() {
      cardsEl.innerHTML = '';
      var english = I18N().lang === 'en';
      var defs = [
        { kind: 'heart', rich: true, theme: 'pink', art: heroArt('solo'), name: english ? '+1 heart' : '하트 +1', desc: english ? 'Get 1 heart.' : '하트를 1개 획득합니다.', pillText: '+1',
          btnHtml: coinOption('01') + '<b>5</b>', btnDisabled: MG.Economy.getCoins() < 5,
          onClick: function () { if (MG.Economy.spendCoins(5)) { MG.Economy.addHearts(1); done(); } else alert(T('mole.shop.noCoin')); } },
        { kind: 'heart', rich: true, theme: 'pink', art: heroArt('pile'), productClass: 'shop-card--heart-pile', name: english ? '10 hearts' : '하트 ×10', desc: english ? 'Get 10 hearts.' : '하트를 10개 획득합니다.', pillText: '×10',
          btnHtml: coinOption('06') + '<b>40</b>', btnDisabled: MG.Economy.getCoins() < 40,
          onClick: function () { if (MG.Economy.spendCoins(40)) { MG.Economy.addHearts(10); done(); } else alert(T('mole.shop.noCoin')); } },
        { kind: 'heart', rich: true, theme: 'pink', art: heroArt('jar'), name: english ? '30 hearts' : '하트 ×30', desc: english ? 'Get 30 hearts.' : '하트를 30개 획득합니다.', pillText: '×30',
          btnHtml: coinOption('09') + '<b>100</b>', btnDisabled: MG.Economy.getCoins() < 100,
          onClick: function () { if (MG.Economy.spendCoins(100)) { MG.Economy.addHearts(30); done(); } else alert(T('mole.shop.noCoin')); } },
        { kind: 'heart', rich: true, theme: 'blue', art: heroArt('ad'), name: english ? 'Watch ad: +1 heart' : '광고 보고 하트 +1', desc: english ? 'Get 1 heart after watching an ad.' : '광고 시청 후 하트 1개 획득.', pillText: '+1',
          confirmMessage: english ? 'Watch an ad to get 1 heart?' : '광고를 시청하고 하트 1개를 받으시겠습니까?',
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

    // 뿅망치(무료 기본무기)만 기존 카드 그대로, 나머지(캐논/골드묠니르/알리판취)는 하트 카드와
    // 같은 리치 카드 타입으로(사용자 지정: "무기카드는 광고 보고 하트+1 카드 타입으로 변경... 단
    // 뿅망치는 그대로 둬야함. 제일 위의 박스에는 무기 이름, 중간 박스엔 무기 이미지, 아래에는
    // 코인+가격, 파란박스에는... 50,000원"). 위=이름, 중간=이미지, 알약=코인가(정보용),
    // 버튼(파란, 광고카드와 동일 스타일)=현금가.
    function renderWeaponCards() {
      cardsEl.innerHTML = '';
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      WEAPONS.forEach(function (w) {
        var name = I18N().lang === 'en' ? w.nameEn : w.name;
        // 이미 장착 중이어도 버튼은 계속 눌러 "구매" 가능(사용자 지정: "최대한 계속 구매할 수
        // 있게, 누르면 복귀") — 잠금(라운드 진행 중)만 비활성화 사유로 남김. 장착 표시(테두리)는
        // 아이템보관창 전용(사용자 지정: "상점하고 아이템은 유사하지만 엄연히 다른거다").
        if (w.id === 'hammer') {
          cardsEl.appendChild(card({
            badge: '<img alt="" src="' + w.thumb + '">',
            badgeClass: 'shop-card-badge--weapon',
            name: name,
            priceHtml: null,
            btnText: T('mole.shop.default'),
            btnDisabled: locked,
            btnPlain: true,
            confirmMessage: defaultSelectionPrompt(name),
            onClick: function () {
              localStorage.setItem('mole.weapon', w.id);
              var diff = localStorage.getItem('mole.difficulty');
              if (diff === 'mid' || diff === 'legend') localStorage.setItem('mole.difficulty', 'easy');
              done();
            }
          }));
          return;
        }
        cardsEl.appendChild(heartCard({
          theme: 'blue',
          art: weaponArt(w),
          name: name,
          confirmMessage: defaultSelectionPrompt(name),
          pillIcon: ICONS.coins,
          pillClass: 'shop-card-pill--coin', // 사용자 지정: "코인 이미지는 1.5배 크게, 노란색으로"
          pillText: w.coinPrice.toLocaleString(),
          btnHtml: w.price.toLocaleString() + '원',
          btnDisabled: locked,
          onClick: function () { localStorage.setItem('mole.weapon', w.id); done(); }
        }));
      });
    }

    function renderPendingProducts(items) {
      cardsEl.innerHTML = '';
      var english = I18N().lang === 'en';
      items.forEach(function (item) {
        cardsEl.appendChild(heartCard({
          theme: 'pink', productClass: 'shop-card--sale', art: item.art,
          name: english ? item.nameEn : item.nameKo, desc: null, pillText: '',
          btnHtml: '<b>' + (english ? 'Offer setup pending' : '상품·가격 확정 후 판매') + '</b>', btnDisabled: true
        }));
      });
    }

    function renderSkillCards() {
      var allSkills = '<div class="shop-sale-set">' +
        '<img alt="" src="assets/skills/shield.png"><img alt="" src="assets/skills/targeting-v1403.png"><img alt="" src="assets/skills/ai.png"></div>';
      renderPendingProducts([
        { nameKo: '실드 묶음', nameEn: 'Shield pack', art: '<img class="shop-sale-item" alt="" src="assets/skills/shield.png">' },
        { nameKo: '타겟팅 묶음', nameEn: 'Targeting pack', art: '<img class="shop-sale-item" alt="" src="assets/skills/targeting-v1403.png">' },
        { nameKo: 'AI 스킬 묶음', nameEn: 'AI skill pack', art: '<img class="shop-sale-item" alt="" src="assets/skills/ai.png">' },
        { nameKo: '스킬 세트', nameEn: 'Skill set', art: allSkills }
      ]);
    }

    function renderCostumeCards() {
      var teams = MG.CostumeTeams.teams();
      var allCostumes = '<div class="shop-sale-set">' + teams.map(function (team) {
        return '<img alt="" src="assets/costume/char-' + team.id + '-v1406.webp">';
      }).join('') + '</div>';
      renderPendingProducts([
        { nameKo: '블루 베어스 코스튬', nameEn: 'Blue Bears costume', art: '<img class="shop-sale-item" alt="" src="assets/costume/char-blue_bears-v1406.webp">' },
        { nameKo: '마운트 스타즈 코스튬', nameEn: 'Mount Stars costume', art: '<img class="shop-sale-item" alt="" src="assets/costume/char-mount_stars-v1406.webp">' },
        { nameKo: '클라우드 컵스 코스튬', nameEn: 'Cloud Cups costume', art: '<img class="shop-sale-item" alt="" src="assets/costume/char-cloud_cups-v1406.webp">' },
        { nameKo: '코스튬 세트', nameEn: 'Costume set', art: allCostumes }
      ]);
    }

    function renderCoinCards() {
      cardsEl.innerHTML = '';
      var english = I18N().lang === 'en';
      var bulkRounds = [1, 2, 3].map(function (round) {
        var label = english ? (round + (round === 1 ? 'st' : round === 2 ? 'nd' : 'rd') + ' purchase') : round + '회차';
        return '<div class="shop-coin-bulk-reward"><span class="shop-coin-bulk-step">' + label + '</span></div>';
      }).join('');
      var weaponChoices = WEAPONS.filter(function (weapon) { return weapon.id !== 'hammer'; }).map(function (weapon) {
        var label = english ? weapon.nameEn : ({ cannon: '팡팡 캐논', goldhammer: '골드 묠니르', alipunch: '킹판취' }[weapon.id] || weapon.name);
        return '<button type="button" class="shop-coin-weapon-choice' + (selectedCoinBonusWeapon === weapon.id ? ' is-selected' : '') +
          '" data-coin-weapon="' + weapon.id + '" aria-pressed="' + (selectedCoinBonusWeapon === weapon.id) + '" title="' +
          label + '"><img src="' + weapon.thumb + '" alt=""><span>' + label + '</span></button>';
      }).join('');
      var bulkArt = '<div class="shop-coin-bulk-art">' +
        '<img class="shop-coin-bulk-pile" src="' + CURRENCY_ART + 'coin-option-09-bright20.png" alt="">' +
        '<div class="shop-coin-bulk-details"><b class="shop-coin-bulk-summary">' +
        (english ? '100,000 coins · 20% off' : '100,000 코인 · 20% 할인') +
        '</b><div class="shop-coin-bulk-rewards">' + bulkRounds + '</div><div class="shop-coin-bulk-choice">' +
        '<div class="shop-coin-weapon-choices">' + weaponChoices + '</div><b class="shop-coin-bulk-choice-title">' +
        (english ? 'Weapon selection available from 4th purchase' : '4회차부터 무기 선택 가능') +
        '</b></div></div></div>';
      cardsEl.appendChild(heartCard({
        theme: 'pink', productClass: 'shop-card--sale shop-card--coin-small',
        art: '<div class="shop-coin-small-art"><img src="' + CURRENCY_ART + 'coin-option-01-bright20.png" alt=""><b>' +
          (english ? '8,000 coins' : '8,000 코인') + '</b></div>',
        name: english ? 'Starter pack' : '스타터 팩', pillText: '8,000',
        btnHtml: coinPurchaseIcon('01') + '<b>₩10,000</b>', btnDisabled: true
      }));
      cardsEl.appendChild(heartCard({
        theme: 'blue', productClass: 'shop-card--coin-ad', art: coinAdArt(),
        name: english ? 'Ad · +1 heart' : '광고 · 하트 +1', pillText: '+1',
        btnHtml: '<img class="shop-ad-cta-icon" src="assets/shop/ad-icon-complete.png" alt=""><b>' + T('mole.shop.watchAdBtn') + '</b>',
        btnDisabled: false,
        confirmMessage: english ? 'Watch an ad to get 1 heart?' : '광고를 시청하고 하트 1개를 받으시겠습니까?',
        onClick: function () {
          MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); done(); } });
        }
      }));
      var bulkCard = heartCard({
        theme: 'pink', productClass: 'shop-card--sale shop-card--coin-bulk', art: bulkArt,
        name: english ? 'Reserve pack' : '리저브 팩', pillText: '100,000',
        btnHtml: coinPurchaseIcon('09') + '<del>₩125,000</del><b>₩100,000</b>', btnDisabled: true
      });
      cardsEl.appendChild(bulkCard);
      bulkCard.querySelectorAll('.shop-coin-weapon-choice').forEach(function (choice) {
        choice.addEventListener('click', function () {
          var weapon = WEAPONS.find(function (item) { return item.id === choice.dataset.coinWeapon; });
          if (!weapon) return;
          var oldDialog = el.querySelector('.shop-coin-choice-dialog');
          if (oldDialog) oldDialog.remove();
          var dialog = document.createElement('div');
          dialog.className = 'shop-coin-choice-dialog';
          dialog.setAttribute('role', 'dialog');
          dialog.setAttribute('aria-modal', 'true');
          dialog.setAttribute('aria-label', english ? 'Confirm enhancement material' : '강화 재료 선택 확인');
          var label = english ? weapon.nameEn : ({ cannon: '팡팡 캐논', goldhammer: '골드 묠니르', alipunch: '킹판취' }[weapon.id] || weapon.name);
          var lastChar = label.charCodeAt(label.length - 1);
          var hasFinalConsonant = lastChar >= 0xAC00 && lastChar <= 0xD7A3 && (lastChar - 0xAC00) % 28 !== 0;
          dialog.innerHTML = '<div class="shop-coin-choice-card"><img class="shop-coin-choice-art" src="' + weapon.thumb + '" alt="">' +
            '<b class="shop-coin-choice-message">' + (english ? 'Select ' + label + '?' : label + (hasFinalConsonant ? '을' : '를') + ' 선택하시겠습니까?') + '</b>' +
            '<div class="shop-coin-choice-actions"><button type="button" class="shop-card-btn shop-coin-choice-action" data-choice-action="confirm">' + (english ? 'Yes' : '예') + '</button>' +
            '<button type="button" class="shop-card-btn shop-coin-choice-action" data-choice-action="cancel">' + (english ? 'No' : '아니요') + '</button></div></div>';
          el.appendChild(dialog);
          function closeDialog() { dialog.remove(); }
          dialog.addEventListener('click', function (event) {
            if (event.target === dialog || event.target.closest('[data-choice-action="cancel"]')) { closeDialog(); return; }
            if (event.target.closest('[data-choice-action="confirm"]')) {
              selectedCoinBonusWeapon = weapon.id;
              bulkCard.querySelectorAll('.shop-coin-weapon-choice').forEach(function (other) {
                var selected = other.dataset.coinWeapon === selectedCoinBonusWeapon;
                other.classList.toggle('is-selected', selected);
                other.setAttribute('aria-pressed', String(selected));
              });
              closeDialog();
            }
          });
        });
      });
    }

    function renderEmptyCategory() { cardsEl.innerHTML = '<p class="shop-soon">' + T('mole.inv.soon') + '</p>'; }
    var RENDERERS = { currency: renderCurrencyCards, coin: renderCoinCards, ticket: renderEmptyCategory,
      weapon: renderWeaponCards, skill: renderSkillCards, costume: renderCostumeCards };

    // 배너 우측 메일 아이콘은 다이얼패드 "#"(시크릿 폐기) 자리로 이동함(사용자 지정) — 배너에는
    // 그 자리에 화살표(‹›)를 대신 넣는다(아이템 화면과 동일 패턴).
    function renderBanner() {
      var english = I18N().lang === 'en';
      bannerEl.innerHTML = '<img alt="" class="shop-banner-awning" src="' + SHOP_ART + '01-awning.webp">' +
        '<span class="shop-banner-nameplate"><svg class="shop-sign-defs" width="0" height="0" aria-hidden="true"><defs>' +
        '<filter id="shop-sign-color" color-interpolation-filters="sRGB" x="-5%" y="-5%" width="110%" height="110%">' +
        '<feColorMatrix in="SourceGraphic" type="hueRotate" values="145" result="red"></feColorMatrix>' +
        '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -4 0 4 0 -0.1" result="blue"></feColorMatrix>' +
        '<feComposite in="red" in2="blue" operator="in" result="rim"></feComposite>' +
        '<feComposite in="SourceGraphic" in2="blue" operator="out" result="body"></feComposite>' +
        '<feMerge><feMergeNode in="body"></feMergeNode><feMergeNode in="rim"></feMergeNode></feMerge></filter></defs></svg>' +
        '<img class="shop-weapon-sign" src="assets/inventory/ui-v1379/nameplate.webp" alt="">' +
        '<b class="shop-banner-txt"></b></span>';
      bannerEl.querySelector('.shop-banner-txt').textContent = english ? 'SHOP' : '상점';
    }

    // 하트/코인/티켓 캡슐 = 상점 안이 아니라 다이얼패드(1/2/3 키) 위로 애니메이션 착지(사용자
    // 지정: "두더지팡으로 이동... 진입될때 아래 버튼보드에서 티켓위치로 롤인, 코인위치로 롤인,
    // 하트위치로는 슬라이드다운"). 순서: 티켓→코인→롤인, 하트→슬라이드다운, 순차 스태거.
    // 착지 전엔 전부 파란 "재화" 박스로 통일, 착지 후 하트=빨강/코인=노랑/티켓=하늘색으로 전환
    // (사용자 지정: "버튼보드에 오는 박스는 재화박스 파란색으로 통일... 안착이 된 후 색 변경").
    // V1369 C: 재화 줄이 코인·하트·티켓 순서로 바뀜(lane-controls FACES) — 칸 번호도 같이
    var DIALPAD_REGION = { ticket: '2', coin: '0', heart: '1' };
    // animateHudEntrance() 는 캡슐마다 350ms 씩 지연시켜(setTimeout) 순차 착지시키는데, 상점을
    // 빠르게 여러 번 열면(사용자 보고: "상품 버튼을 빠르게 누르면... 티켓 화면으로 간다",
    // 간헐적) 이전 호출의 setTimeout 들이 취소 안 된 채 남아있다가 뒤늦게 실행되어 캡슐이
    // 중복 생성되고, 그중 하나가 클릭되며 currencyFilter 를 몰래 바꿔버림 — 대기 중인
    // 타이머를 추적해뒀다가 재호출 시(removeHudFlys) 확실히 취소한다.
    // 상점에서 구매/획득 직후 다이얼패드에 착지해있는 하트/코인/티켓 캡슐 숫자를 바로 갱신
    // (사용자 지정: "상점에서 구매시, 바로 버튼보드에 있는 하트, 코인, 티켓 수량 바로
    // 적용되도록") — 캡슐은 생성 시점 숫자로 고정돼있어 그 이후 변동은 반영이 안 됐었음.
    function refreshHudFlyNumbers() {
      ['heart', 'coin', 'ticket'].forEach(function (kind) {
        var n = document.querySelector('#lane-button-bar [data-region="' + DIALPAD_REGION[kind] + '"] .lane-hud-n'); // v904: 알약 숫자 직접 갱신
        if (!n) return;
        n.textContent = MG.Economy.formatK(kind === 'heart' ? MG.Economy.getHearts()
          : kind === 'coin' ? MG.Economy.getCoins() : MG.Economy.getTickets());
      });
    }
    var pendingTimers = [];
    function removeHudFlys() {
      pendingTimers.forEach(clearTimeout);
      pendingTimers = [];
      Array.prototype.forEach.call(document.querySelectorAll('.h2-pill.is-shop'), function (n) { n.classList.remove('is-shop'); });
    }
    // 무기 등 다른 탭 누르면 왼쪽으로 빠르게 롤아웃 후 제거(사용자 지정: "왼쪽으로 빠르게
    // 롤인으로 사라져야해").
    // 들어올 때(우측에서 순차 롤인)와 마찬가지로 나갈 때도 순차적으로(사용자 지정: "순차적으로
    // 사라지게"), 다만 진입(350ms 간격)보다 훨씬 빠르게(60ms 간격, 사용자 지정: "속도는 빠르게").
    // v904(사용자 선택 A안): 홈 버튼보드 개편으로 하트/코인/티켓이 알약(그림 아이콘+수량)이 됨 — 따로 동그라미 캡슐을
    // 띄우지 않고 알약 안의 아이콘이 기존 연출 그대로 들어옴(티켓·코인 = 옆에서 굴러옴, 하트 = 위에서 떨어짐),
    // 착지 후 상점에 있는 동안 알약에 금빛 테두리. 알약을 누르면 그 재화 상품만 보기(예전 캡슐 클릭 기능).
    function animateHudEntrance() {
      removeHudFlys();
      ['ticket', 'coin', 'heart'].forEach(function (kind, i) {
        pendingTimers.push(setTimeout(function () {
          var btn = document.querySelector('#lane-button-bar [data-region="' + DIALPAD_REGION[kind] + '"]');
          var pill = btn && btn.querySelector('.h2-pill'), ic = pill && pill.querySelector('.h2-pill-ic');
          if (!ic) return;
          var from = kind === 'heart' ? 'translateY(-50%) translateY(-140px)' : 'translateY(-50%) translateX(150px) rotate(300deg)';
          if (ic.animate) ic.animate([{ transform: from, opacity: 0 }, { transform: 'translateY(-50%)', opacity: 1 }],
            { duration: 500, easing: 'cubic-bezier(.25,.85,.3,1.1)' });
          pill.classList.add('is-shop');
          if (!btn._shopPick) {
            btn._shopPick = true;
            btn.addEventListener('click', function () {
              if (!pill.classList.contains('is-shop')) return;
              activeTab = kind === 'heart' ? 'currency' : kind;
              currencyFilter = kind === 'heart' ? 'heart' : null;
              render();
            });
          }
        }, i * 350));
      });
    }

    function renderTabs() {
      var previousScroll = tabsEl.scrollLeft;
      tabsEl.innerHTML = '';
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'shop-tab' + (t.id === activeTab ? ' shop-tab--on' : '');
        b.dataset.shopTab = t.id;
        b.innerHTML = '<span class="shop-tab-ico">' + t.icon + '</span><span class="shop-tab-lbl"></span>';
        b.querySelector('.shop-tab-lbl').textContent = T(t.i18n);
        (function (lb) { requestAnimationFrame(function () { lb.style.transform = ''; var room = b.clientWidth * 0.86, w = lb.scrollWidth; // v890: 긴 영어 탭 글자 가로로만 좁힘
          if (w > room) { lb.style.display = 'inline-block'; lb.style.transform = 'scaleX(' + (room / w).toFixed(3) + ')'; } }); })(b.querySelector('.shop-tab-lbl'));
        b.addEventListener('click', function () {
          // 하트/코인/티켓 캡슐은 탭 전환과 무관하게 상점에 있는 동안 항상 유지(사용자 지정:
          // "재화 버튼시에만 나타나라고 했는데 실수야 — 상점에 있을때는 항시 존재, 다른
          // 버튼일때 왼쪽으로 사라지게") — 탭을 바꿔도 롤아웃/재진입 안 함. 상점을 완전히
          // 벗어날 때만(el.hidden 감시, 파일 하단) 롤아웃.
          activeTab = t.id; currencyFilter = null; cardsEl.scrollLeft = 0; render();
          var selected = tabsEl.querySelector('.shop-tab--on');
          if (selected) selected.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        });
        tabsEl.appendChild(b);
      });
      tabsEl.scrollLeft = previousScroll;
      requestAnimationFrame(centerShopTabArt);
    }

    function render() {
      renderTabs();
      RENDERERS[activeTab]();
      updateDots();
      // 재화탭 카드박스 색 = 하트/코인/티켓 캡슐 필터에 맞춰 빨강/노랑/파랑(사용자 지정:
      // "하트선택시 빨강, 코인선택시 노랑, 티켓선택시 파랑") — 필터 없음(전체)은 하트 기본.
      // 무기/스킬/코스튬탭은 기존 파란색 유지.
      cardsBoxEl.classList.remove('shop-cards-box--heart', 'shop-cards-box--coin', 'shop-cards-box--ticket');
      if (activeTab === 'currency') cardsBoxEl.classList.add('shop-cards-box--' + (currencyFilter || 'heart'));
      requestAnimationFrame(alignCoinPrices);
      requestAnimationFrame(centerShopTabArt);
    }

    // Center the visible coin artwork and number ink, keeping their current sizes.
    function alignCoinPrices() {
      var ctx = document.createElement('canvas').getContext('2d');
      cardsEl.querySelectorAll('.shop-card-btn').forEach(function (btn) {
        var icon = btn.querySelector('.shop-coins-stack'), number = btn.querySelector('b');
        if (!icon || !number) return;
        var group = btn.querySelector('.shop-price-group');
        if (!group) {
          var size = icon.getBoundingClientRect();
          group = document.createElement('span');
          group.className = 'shop-price-group';
          group.style.setProperty('--price-icon-width', size.width + 'px');
          group.style.setProperty('--price-icon-height', size.height + 'px');
          btn.appendChild(group); group.appendChild(icon); group.appendChild(number);
        }
        var nr = number.getBoundingClientRect();
        icon.style.transform = 'none';
        centerVisibleImage(icon);
        ctx.font = getComputedStyle(number).font;
        var m = ctx.measureText(number.textContent);
        var ascent = m.fontBoundingBoxAscent, descent = m.fontBoundingBoxDescent;
        var baseline = (nr.height - ascent - descent) / 2 + ascent;
        var inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        var inkCenterX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
        var inkCenterY = baseline + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
        number.style.transform = 'translate(' + (nr.width / 2 - inkCenterX) + 'px,' + (nr.height / 2 - inkCenterY) + 'px)';
      });
      cardsEl.querySelectorAll('.shop-card-pill>span').forEach(function (label) {
        var rect = label.getBoundingClientRect();
        ctx.font = getComputedStyle(label).font;
        var metric = ctx.measureText(label.textContent);
        var baseline = (rect.height - metric.fontBoundingBoxAscent - metric.fontBoundingBoxDescent) / 2 + metric.fontBoundingBoxAscent;
        var dx = rect.width / 2 - (metric.actualBoundingBoxRight - metric.actualBoundingBoxLeft) / 2;
        var dy = rect.height / 2 - baseline - (metric.actualBoundingBoxDescent - metric.actualBoundingBoxAscent) / 2;
        label.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(-8deg)';
      });
      var shell = el.querySelector('.shop-tab-shell');
      var header = el.querySelector('.shop-cards-head');
      if (shell && header && cardsEl.children.length) {
        var enclosureBottom = cardsBoxEl.getBoundingClientRect().bottom + 1;
        var shellRect = shell.getBoundingClientRect();
        // Map the original inner contour through the SAME 70px/10px nine-slice
        // geometry as the unchanged card frame. A 2px source underlap hides AA seams.
        function sliceCoord(value, sourceSize, targetSize) {
          if (value <= 70) return value * 10 / 70;
          if (value >= sourceSize - 70) return targetSize - (sourceSize - value) * 10 / 70;
          return 10 + (value - 70) * (targetSize - 20) / (sourceSize - 140);
        }
        function insetContour(radius, width, height) {
          var points = [];
          [[525,75,-90],[525,789,0],[75,789,90],[75,75,180]].forEach(function (corner) {
            for (var step = 0; step <= 16; step++) {
              var angle = (corner[2] + step * 90 / 16) * Math.PI / 180;
              var x = corner[0] + radius * Math.cos(angle), y = corner[1] + radius * Math.sin(angle);
              points.push([sliceCoord(x, 600, width), sliceCoord(y, 864, height)]);
            }
          });
          return points;
        }
        function applyFrameContour(target, width, height, fillProperty, frameProperty) {
          var contour = insetContour(42, width, height);
          target.style.setProperty(fillProperty, 'polygon(' + contour.map(function (p) { return p[0].toFixed(3) + 'px ' + p[1].toFixed(3) + 'px'; }).join(',') + ')');
          var inner = insetContour(40, width, height);
          var ring = 'M0 0H' + width + 'V' + height + 'H0Z M' + inner.map(function (p) { return p[0].toFixed(3) + ' ' + p[1].toFixed(3); }).join(' L') + 'Z';
          target.style.setProperty(frameProperty, 'path(evenodd, "' + ring + '")');
        }
        applyFrameContour(shell, shellRect.width, shellRect.height, '--shop-sky-contour', '--shop-frame-ring');
        var productBox = cardsBoxEl.getBoundingClientRect();
        var productFrame = getComputedStyle(cardsBoxEl, '::before');
        var frameWidth = productBox.width - parseFloat(productFrame.left) - parseFloat(productFrame.right);
        var frameHeight = productBox.height - parseFloat(productFrame.top) - parseFloat(productFrame.bottom);
        applyFrameContour(cardsBoxEl, frameWidth, frameHeight, '--shop-product-fill', '--shop-product-frame-ring');
        el.style.setProperty('--shop-dots-y', ((enclosureBottom + shellRect.top - header.getBoundingClientRect().height) / 2) + 'px');
        el.style.setProperty('--shop-dots-right', (el.getBoundingClientRect().right - shellRect.right + 10) + 'px');
      }
    }
    root.addEventListener('resize', function () { if (!el.hidden) { requestAnimationFrame(alignCoinPrices); requestAnimationFrame(centerShopTabArt); } });

    function show() {
      renderBanner();
      var shopPick = (MG && MG.shopPick) || null;
      activeTab = shopPick === 'heart' ? 'currency' : (shopPick || 'currency');
      currencyFilter = shopPick === 'heart' ? 'heart' : null; MG.shopPick = null;
      cardsEl.scrollLeft = 0;
      render();
      animateHudEntrance();
      startGoldZap();
    }
    // V1409 C 사용자: 상점 골드 묠니르에도 5초마다 파란 번개(제작소 황금알 망치와 같은 그림 6장, 0.72초). 상점이 닫히면 멈춤.
    var ZAP = [1, 2, 3, 4, 5, 6].map(function (n) { return 'assets/workshop/ham-gold-zap' + n + '-v1409.webp'; });
    var zapTimer = null, zapKeep = [];
    function startGoldZap() {
      if (!zapKeep.length) ZAP.forEach(function (u) { var i = new Image(); i.src = u; zapKeep.push(i); });
      clearInterval(zapTimer);
      zapTimer = setInterval(function () {
        if (el.hidden) { clearInterval(zapTimer); return; }
        el.querySelectorAll('img[src*="goldpaw-v1382"]').forEach(function (img) {
          if (img._zap) return;
          var orig = img.getAttribute('src'), k = 0; img._zap = true;
          (function step() {
            if (k >= 9 || !img.isConnected) { img.src = orig; img._zap = false; return; }
            img.src = ZAP[k % ZAP.length]; k++; setTimeout(step, 80);
          })();
        });
      }, 5000);
    }
    // 상점 화면이 닫히면(hidden 속성) 다이얼패드에 착지해있던 캡슐도 같이 정리 — 사용자가
    // 어느 경로로 나가도(홈 아이콘, 메일함 등 — 뒤로가기 버튼이 없어 경로가 다양함) 탭 전환과
    // 동일하게 롤아웃(사용자 지정: "재화버튼 외 다른 버튼을 누르면 전부 적용, 홈화면도 동일").
    new MutationObserver(function () {
      if (el.hidden) removeHudFlys(); // v802(사용자 지정: 다른 화면 갈 때 원 잔상) — 상점을 떠날 땐 즉시 제거(탭 전환 롤아웃은 그대로)
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Shop = api; }
})(typeof window !== 'undefined' ? window : null);

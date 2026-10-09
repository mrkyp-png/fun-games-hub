(function (root) {
  'use strict';
  // 아이템 보관 — 무기 / 스킬 / 코스튬 / 사진 탭(사용자 지정, 2026-09-18 상점과 동일한
  // 카드/탭 비주얼로 개편). 무기·코스튬 탭 실제 구현, 나머지는 준비중 placeholder.
  var I18N = root.FGH.I18N;
  var T = function (k) { return I18N.t(k); };
  var MG = root.MoleGame;

  // 능력치 표 3줄 (라벨 = i18n 키, 값 = [ko, en]).
  var STAT_ROWS = ['mole.inv.stat.visibility', 'mole.inv.stat.attack', 'mole.inv.stat.defense'];
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/hammer.png', rarity: 'basic',
      desc: ['기본 무기.\n간단하지만 강력한 타격감으로\n두더지를 시원하게!', 'The basic weapon.\nSimple but punchy —\nbonk those moles!'],
      stats: [['-', '-'], ['-', '-'], ['-', '-']] },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1.png', rarity: 'rare',
      desc: ['강력한 포탄으로\n더 많은 두더지를 한 번에!\n넓은 범위를 커버하는 든든한 무기!', 'Powerful cannonballs\nhit more moles at once —\na sturdy weapon with wide reach!'],
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['2·3타 두더지 연타 확률 10%', '10% burst on 2·3-hit moles'],
              ['-', '-']] },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldhammer-0.png', rarity: 'epic',
      desc: ['전설의 힘을 담은 황금 망치!\n지면을 울리는 강력한 충격으로\n주변의 두더지를 한 번에 처치한다!', 'A golden hammer of legend!\nIts ground-shaking blow\ntakes out nearby moles at once!'],
      gemGlow: true,   // 보석(파란불빛) 부분에 맥동 글로우
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['주변 두더지 지진 연타 15% (2·3타 두더지 소탕 포함)', '15% quake — chain-hits nearby moles (clears 2·3-hit moles too)'],
              ['-', '-']] },
    { id: 'alipunch', name: '킹 판취', nameEn: 'King Punch', thumb: 'assets/weapons/alipunch-jab.png', rarity: 'legend',
      desc: ['전설적인 복서의 힘을 담은\n강력한 글러브! 빠르고 강한\n연타로 모든 두더지를 한 번에\n날려버린다!', 'Gloves holding the power of\na legendary boxer! Fast, heavy\ncombos blast every mole away!'],
      stats: [['Hole 16 → 14', 'Holes 16 → 14'],
              ['무적 5초 확률 20% (모든 동물 타격 가능), 2·3타 두더지 소탕 포함', '20% chance — 5s invincibility (any animal is safe to hit), clears 2·3-hit moles'],
              ['하강 딜레이 +0.1초(무적 중 +0.3초 추가)', '+0.1s before mole retreats (+0.3s more while invincible)']] }
  ];

  // 하단 탭 아이콘 — 상점(shop.js)과 같은 그라디언트 입체 아이콘 재사용(사용자 지정: "동일한
  // 스타일로"). 사진 탭은 다이얼패드 "사진보관" 카메라 아이콘(lane-controls.js SVG.locker)
  // 재사용 + 같은 톤의 그라디언트만 추가.
  var WEAPON_TAB_ICON = '<img src="assets/tabs/weapon.png" alt="">'; // 사용자 제공 이미지(v755)
  var SKILL_TAB_ICON = '<img src="assets/tabs/skill.png" alt="">'; // 사용자 제공 이미지(v755)
  // 코스튬 아이콘 = 상점과 동일한 이모지로 통일(사용자 지정: "아이템에서도 코스튬 이모지 변경").
  var COSTUME_TAB_ICON = '<img src="assets/tabs/costume.png" alt="">';
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
    { id: 'photo', i18n: 'mole.inv.tabPhoto', icon: PHOTO_TAB_ICON, banner: 'mole.inv.bannerPhoto' }
  ];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabsEl = el.querySelector('[data-inv-tabs]');
    var bannerTxtEl = el.querySelector('[data-inv-banner-txt]');
    var bannerEl = el.querySelector('.inv-banner');
    var cosLogoEl = el.querySelector('.inv-cos-logo');
    // v996(사용자 지정): 무기 탭 상단 등불 사이 = 무기 이름 나무 간판(넘기면 이름 바뀜)
    var wSignEl = document.createElement('div');
    wSignEl.className = 'inv-wsign'; wSignEl.hidden = true;
    if (cosLogoEl) cosLogoEl.parentNode.insertBefore(wSignEl, cosLogoEl.nextSibling); else el.appendChild(wSignEl);
    var photoSearchBtn = el.querySelector('.inv-photo-search');
    if (photoSearchBtn) {
      photoSearchBtn.addEventListener('click', function () {
        photoCollectionOpen = true;
        renderPhotoCollection();
      });
    }
    var headEl = el.querySelector('.inv-cards-head');
    var dotsEl = el.querySelector('[data-inv-dots]');
    var prevBtn = el.querySelector('[data-inv-prev]');
    var nextBtn = el.querySelector('[data-inv-next]');
    el.querySelector('[data-back="inventory"]')?.addEventListener('click', opts.onClose);
    var active = 'weapon';
    var costumeSelectedId = null; // 코스튬 탭 안에서만 쓰는 "선택" 상태(착용 상태와 별개, §14)
    // 사용자 지정(2026-09-26): 액티브/패시브를 탭 전환이 아니라 한 화면에 박스 2개로 동시
    // 표시(위=액티브, 아래=패시브), 상단 토글버튼은 삭제하고 [복원]만 유지. 각 박스 안
    // 페이지(◀ N/M ▶)는 독립적으로 유지.
    var activePage = 0;
    var passivePage = 0;
    // 사진관 탭 상태 — 현재 보고 있는 코스튬/얼굴형, 전체 컬렉션·상세 오버레이 열림 여부(§20).
    var photoCostumeId = 'blue_bears';
    var photoFace = 'round';
    var photoCollectionOpen = false;
    var photoDetailId = null;

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
        d.classList.toggle('inv-dot--on', i === pageIdx);
      });
      // v855(사용자 지정): 바깥 창 색 = 보고 있는 무기 등급 색
      var box = el.querySelector('.inv-cards-box');
      if (box) box.setAttribute('data-rar', active === 'weapon' && WEAPONS[pageIdx] ? WEAPONS[pageIdx].rarity : '');
      var nm = WEAPONS[pageIdx] ? nameOf(WEAPONS[pageIdx]) : '';
      if (wSignEl.textContent !== nm) { wSignEl.textContent = nm; wSignEl.classList.remove('is-swap'); void wSignEl.offsetWidth; wSignEl.classList.add('is-swap'); }
    }
    // renderWeapons() 가 매번 grid 를 통째로 새로 만들기 때문에(body.innerHTML), 장착 버튼을
    // 눌러 재렌더될 때도 새 grid 는 항상 scrollLeft=0 에서 시작 — pageIdx 는 그대로 두고
    // 즉시(비-스무스) 그 위치로 복원해야 "장착 누르면 뿅망치 화면으로 튕김" 버그가 안 생긴다
    // (사용자 보고: "장착 버튼 누르면 뿅망치 화면나오고 장착이 안됨"). 탭 전환일 때만 0으로.
    function fitStatLines() {
      body.querySelectorAll('.inv-stat-line').forEach(function (ln) {
        ln.style.transform = ''; var room = ln.parentNode.clientWidth - 10;
        if (room > 0 && ln.scrollWidth > room) ln.style.transform = 'scaleX(' + Math.max(room / ln.scrollWidth, 0.6).toFixed(3) + ')';
      });
    }
    function updateDots() {
      var g = grid();
      dotsEl.innerHTML = '';
      var n = g ? g.children.length : 0;
      if (pageIdx > n - 1) pageIdx = Math.max(0, n - 1);
      for (var i = 0; i < n; i++) {
        var d = document.createElement('span');
        d.className = 'inv-dot';
        (function (k) { d.addEventListener('click', function () { goTo(k); }); })(i); // v1001: 점 눌러 이동
        dotsEl.appendChild(d);
      }
      syncDots();
      if (g && g.children[pageIdx]) g.scrollLeft = g.children[pageIdx].offsetLeft;
      requestAnimationFrame(fitStatLines);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(fitStatLines); });
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
      }
    }, true);

    function equipped() {
      var w = localStorage.getItem('mole.weapon');
      return w === 'cannon' ? 'cannon' : (w === 'goldhammer' ? 'goldhammer' : (w === 'alipunch' ? 'alipunch' : 'hammer'));
    }
    function nameOf(w) {
      return I18N.lang === 'en' ? w.nameEn : w.name;
    }
    // v849(사용자 지정): 등급 카드 연출 — 뿅망치(basic) 제외. 빛살 회전·반짝이(공통), 배지 별 톡(rare),
    // 날개 퍼덕·왕관 반짝·보라 숨쉬기(epic), 날개·보석·빛줄기 훑기·금빛 입자(legend). transform/opacity 만(폰 깜빡임 방지).
    var SKILL_RARITY = { freeze: 'rare', goldDouble: 'rare', shield: 'rare', feverTime: 'rare', targeting: 'epic', carpetBombing: 'epic', ai: 'legend' };
    function rarityFx(r) {
      if (r === 'basic') return '';
      var tw = [[18, 22], [78, 30], [24, 70], [74, 74], [50, 14]].map(function (p, i) { return '<i class="inv-tw" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-delay:-' + (i * 0.37).toFixed(2) + 's"></i>'; }).join('');
      var extra = '';
      if (r === 'epic' || r === 'legend') extra += '<span class="inv-glow"></span><i class="inv-crown-tw"></i>';
      if (r === 'legend') {
        extra += '<span class="inv-sweep"></span>';
        for (var k = 0; k < 7; k++) extra += '<i class="inv-mote" style="left:' + (12 + k * 12) + '%;animation-delay:-' + (k * 0.41).toFixed(2) + 's;animation-duration:' + (2.4 + (k % 3) * 0.5) + 's"></i>';
      }
      return '<span class="inv-rfx"><span class="inv-rays"></span>' + tw + (r === 'legend' ? extra.replace('<span class="inv-glow"></span><i class="inv-crown-tw"></i>', '') : '') + '</span>' +
        (r === 'epic' || r === 'legend' ? '<span class="inv-glow"></span><i class="inv-crown-tw"></i>' : '');
    }
    function renderWeapons() {
      var cur = equipped();
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
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
        // 이미지 좌측배치, 능력치 우측배치"). 장착 버튼은 흰색 카드 안, 이미지 바로 밑
        // (사용자 지정: "파란 박스에 있는 장착 박스는 흰색박스 아이템 밑으로 옮긴다").
        // v847(사용자 시안 "무기보관 에셋 변경"): 왼쪽 = 등급 카드(BASIC/RARE/EPIC/LEGENDARY 배경+배지) 안에 무기 + 장착,
        // 오른쪽 = 큰 이름 / 능력치 알약 머리 / 흰 표 / 설명 박스. 특수 애니메이션(88px 기준 좌표)은 thumb 를 통째로 확대해 유지.
        card.className += ' inv-card--' + w.rarity;
        card.innerHTML =
          '<div class="inv-top">' +
            '<div class="inv-left"><div class="inv-rcard"><img class="inv-badge" alt="" src="assets/inventory/rarity/badge-' + w.rarity + '.png">' + rarityFx(w.rarity) +
              '<div class="inv-thumb-zoom">' + thumbHtml + '</div></div>' +
              '<button type="button" class="inv-equip"></button></div>' +
            '<div class="inv-right"><span class="inv-name"></span><div class="inv-stat">' +
              '<div class="inv-stat-h"></div>' +
              '<table class="inv-stat-tbl"><tbody>' +
                w.stats.map(function () { return '<tr><th></th><td></td></tr>'; }).join('') +
              '</tbody></table>' +
            '</div><p class="inv-desc"></p></div>' +
          '</div>';
        card.querySelector('.inv-desc').textContent = I18N.lang === 'en' ? w.desc[1] : w.desc[0];
        card.querySelector('.inv-name').textContent = nameOf(w);
        card.querySelector('.inv-stat-h').textContent = T('mole.inv.statHead');
        var trs = card.querySelectorAll('.inv-stat-tbl tr');
        w.stats.forEach(function (s, i) {
          trs[i].querySelector('th').textContent = T(STAT_ROWS[i]);
          var td = trs[i].querySelector('td');
          var v = (I18N.lang === 'en' ? s[1] : s[0]);
          td.textContent = v;
          if (v === '-') td.classList.add('inv-stat-dash'); // 값 없음 = 중앙정렬
          // v1000(사용자 지정): 괄호 부분은 둘째 줄로, 각 줄은 넘치면 글자 폭만 줄여 한 줄 유지(")"만 밑으로 떨어지던 것)
          if (v.indexOf(' (') > 0) td.innerHTML = v.split(' (').map(function (t, k) { return '<span class="inv-stat-line">' + (k ? '(' : '') + t.replace(/[<&>]/g, '') + '</span>'; }).join('');
        });
        var btn = card.querySelector('.inv-equip');
        btn.textContent = w.id === cur ? T('mole.inv.equipped') : T('mole.inv.equip');
        btn.disabled = w.id === cur || locked;
        if (!locked) {
          btn.addEventListener('click', function () {
            localStorage.setItem('mole.weapon', w.id);
            renderWeapons();
          });
        }
        grid.appendChild(card);
      });
      updateDots();
      requestAnimationFrame(function () { fitRights(); fitLefts(); });
      // 배지 그림이 늦게 로드되면 높이 0으로 계산돼 위치가 어긋남 — 로드되면 다시 맞춤
      el.querySelectorAll('.inv-badge').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { requestAnimationFrame(function () { fitRights(); fitLefts(); }); }, { once: true }); });
    }
    // v856(사용자: 작은 폰에서 알리 판취 설명 박스 아래 잘림) — 오른쪽 칸(이름~설명)이 카드 높이를 넘으면 그만큼 비율로 축소
    // v874(사용자: 작은 폰에서 알리 판취 설명 박스가 좁아짐, 에픽만 간격이 다름) — 넘칠 때 오른쪽 칸을 줄이되
    // 폭은 그대로 유지(줄인 만큼 넓혀서 축소 → 박스 폭 동일), 4장 모두 같은 비율로 줄여 글자 크기·간격 통일
    function applyRight(r, k, colW) {
      r.style.transformOrigin = '0 0';
      if (k >= 1) { r.style.transform = ''; r.style.flex = ''; r.style.width = ''; r.style.marginRight = ''; return; }
      r.style.flex = '0 0 ' + (colW / k).toFixed(1) + 'px'; r.style.width = (colW / k).toFixed(1) + 'px';
      r.style.marginRight = (colW - colW / k).toFixed(1) + 'px'; r.style.transform = 'scale(' + k.toFixed(3) + ')';
    }
    function fitRights() {
      var items = [];
      el.querySelectorAll('.inv-card').forEach(function (c) {
        var r = c.querySelector('.inv-right'); if (!r || !c.getBoundingClientRect().height) return;
        applyRight(r, 1, 0);
        var cs = getComputedStyle(c), room = c.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
        items.push({ r: r, room: room, colW: r.getBoundingClientRect().width });
      });
      var k = 1;
      items.forEach(function (it) {
        var fits = function (kk) { applyRight(it.r, kk, it.colW); return it.r.scrollHeight * kk <= it.room; };
        if (fits(1)) return;
        var lo = 0.6, hi = 1; // 들어맞는 가장 큰 비율을 이분 탐색
        for (var n = 0; n < 8; n++) { var mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
        k = Math.min(k, lo);
      });
      items.forEach(function (it) { applyRight(it.r, k, it.colW); });
    }
    root.addEventListener('resize', function () { if (active === 'weapon') { fitRights(); fitLefts(); } });
    // v870(사용자 지정): 무기 카드 왼쪽(등급 카드+장착) — 4장 모두 장착 버튼 높이가 같게. 등급 카드+장착 묶음을 같은 기준으로
    // 세로 가운데에 두고, 위로 솟은 배지(EPIC·LEGENDARY 왕관)가 카드 위로 잘리지 않을 만큼 4장 공통으로 내림. 넘치면 공통 비율로 축소.
    function fitLefts() {
      var cards = Array.prototype.filter.call(el.querySelectorAll('.inv-card'), function (c) { return c.querySelector('.inv-rcard'); });
      if (!cards.length) return;
      var info = cards.map(function (c) {
        var l = c.querySelector('.inv-left'); l.style.transform = '';
        var cs = getComputedStyle(c), cr = c.getBoundingClientRect(), lr = l.getBoundingClientRect();
        var rc = c.querySelector('.inv-rcard').getBoundingClientRect(), eq = c.querySelector('.inv-equip').getBoundingClientRect(), bd = c.querySelector('.inv-badge').getBoundingClientRect();
        var cTop = cr.top + parseFloat(cs.paddingTop) + 2, cBot = cr.bottom - parseFloat(cs.paddingBottom);
        return { l: l, lTop: lr.top, cTop: cTop, cBot: cBot, gTop: rc.top, gBot: eq.bottom, bTop: Math.min(bd.top, rc.top) };
      });
      // 기준 = 뿅망치(BASIC) 카드: 배지~장착 묶음이 카드 세로 가운데(사용자: "뿅망치 위치가 가장 적당"). 나머지 3장은 장착 버튼을 같은 높이에.
      var base = info[0], need0 = base.gBot - base.bTop, room0 = base.cBot - base.cTop;
      var k = need0 > room0 ? Math.max(0.6, room0 / need0) : 1;
      var mid0 = (base.gTop + base.gBot) / 2, bTop0 = mid0 - (mid0 - base.bTop) * k, gBot0 = mid0 + (base.gBot - mid0) * k;
      var dy0 = (base.cTop + base.cBot) / 2 - (bTop0 + gBot0) / 2, eqTarget = gBot0 + dy0 - base.cBot;
      var shift = 0;
      info.forEach(function (f) { var mid = (f.gTop + f.gBot) / 2; f.dy = (f.cBot + eqTarget) - (mid + (f.gBot - mid) * k); });
      info.forEach(function (f) {
        var mid = (f.gTop + f.gBot) / 2;
        f.l.style.transformOrigin = '50% ' + (mid - f.lTop).toFixed(1) + 'px';
        f.l.style.transform = 'translateY(' + (f.dy + shift).toFixed(1) + 'px)' + (k < 1 ? ' scale(' + k.toFixed(3) + ')' : '');
      });
    }

    // 코스튬 탭 — 5개 팀 카드(가로 스크롤) + 선택 코스튬 상세 + 획득 방법(§1~§58).
    // 무기 탭과 달리 페이지네이션(점/화살표) 없이 카드 줄만 가로 스크롤한다.
    function renderCostumes() {
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      var equippedId = MG.CostumeTeams.equippedId();
      if (!costumeSelectedId || !MG.CostumeTeams.teamById(costumeSelectedId)) costumeSelectedId = equippedId;
      body.innerHTML =
        '<div class="cos-wrap">' +
          '<div class="cos-cards" data-cos-cards></div>' +
          '<div class="cos-detail" data-cos-detail></div>' +
        '</div>';

      var cardsEl = body.querySelector('[data-cos-cards]');
      MG.CostumeTeams.teams().forEach(function (team) {
        var owned = MG.CostumeTeams.owns(team.id);
        var selected = team.id === costumeSelectedId;
        var wrap = document.createElement('button');
        wrap.type = 'button';
        wrap.className = 'cos-card-wrap' + (selected ? ' cos-card-wrap--sel' : '') + (owned ? '' : ' cos-card-wrap--locked');
        wrap.innerHTML =
          '<img class="cos-card-emblem" alt="" src="assets/costume/emblem-cap-' + team.id + '.png">' + // v991: 큰 팀 글자 로고(목표 UI)
          '<span class="cos-card">' +
            '<img class="cos-card-bg" alt="" src="assets/costume2/card-' + team.id + '.jpg">' +
            '<img class="cos-card-char" alt="" src="assets/costume/char-' + team.id + '-detail.png">' +
            (owned ? '<span class="cos-card-check">✓</span>' : '<span class="cos-card-lock">🔒</span>') +
          '</span>';
        wrap.addEventListener('click', function () { costumeSelectedId = team.id; renderCostumes(); });
        cardsEl.appendChild(wrap);
      });

      renderCostumeDetail(costumeSelectedId, equippedId, locked);
    }

    function renderCostumeDetail(id, equippedId, locked) {
      var team = MG.CostumeTeams.teamById(id);
      var detail = body.querySelector('[data-cos-detail]');
      if (!team) { detail.innerHTML = ''; return; }
      var owned = MG.CostumeTeams.owns(id);
      var name = (I18N.lang === 'en' ? team.nameEn : team.nameKo);
      var effectVal = (MG.CostumeTeams.BASE_EFFECT_VALUE * MG.CostumeTeams.upgradeLevel(id)).toFixed(1);
      detail.innerHTML =
        '<div class="cos-detail-char-wrap"><img class="cos-detail-bg" alt="" src="assets/costume2/card-' + id + '.jpg"><img class="cos-detail-char" alt="" src="assets/costume/char-' + id + '-detail.png"></div>' +
        '<div class="cos-detail-mid">' +
          '<div class="cos-detail-name-row"><img class="cos-detail-emblem" alt="" src="assets/costume/emblem-cap-' + id + '.png"><span class="cos-detail-name"></span></div>' +
          '<div class="cos-detail-effect">' +
            '<div class="cos-detail-effect-lbl"></div>' +
            '<div class="cos-detail-effect-row"><img alt="" src="assets/costume/clock.png">' +
              '<span class="cos-detail-effect-name"></span><b class="cos-detail-effect-val"></b></div>' +
          '</div>' +
          '<div class="cos-detail-acquire"></div>' +
        '</div>' +
        '<button type="button" class="inv-equip cos-detail-btn"><span></span></button>';
      detail.querySelector('.cos-detail-name').textContent = name;
      // v993(사용자 지정): 팀 이름은 항상 한 줄 — 폰에서 "마운트 스타즈"가 두 줄로 넘어가 카드가 깨지던 것. 넘치면 글자 폭만 줄임
      function fitCosLines() { // v994: 글꼴이 늦게 로드되면 폭이 바뀌어 폰에서 다시 "…"/두 줄 되던 것 — 글꼴 준비 후에도 다시 맞춤
        var nm = detail.querySelector('.cos-detail-name'); if (!nm || !nm.clientWidth) return;
        nm.style.transform = ''; nm.style.width = '';
        var ef0 = detail.querySelector('.cos-detail-effect-name'); if (ef0) ef0.textContent = T('mole.cos.effectName');
        var k = nm.clientWidth / nm.scrollWidth;
        if (k < 1) { nm.style.display = 'inline-block'; nm.style.transformOrigin = '0 50%'; nm.style.transform = 'scaleX(' + Math.max(k, 0.6).toFixed(3) + ')'; nm.style.width = (nm.scrollWidth) + 'px'; }
        var ef = detail.querySelector('.cos-detail-effect-name'); // 효과 이름도 "…" 없이 한 줄
        if (ef && ef.clientWidth) { ef.style.overflow = 'visible'; ef.style.textOverflow = 'clip'; var k2 = ef.clientWidth / ef.scrollWidth;
          if (k2 < 1) { ef.innerHTML = '<span style="display:inline-block;transform-origin:0 50%;transform:scaleX(' + Math.max(k2, 0.6).toFixed(3) + ')">' + ef.innerHTML + '</span>'; } }
      }
      requestAnimationFrame(fitCosLines);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(fitCosLines); });
      setTimeout(fitCosLines, 400);
      detail.querySelector('.cos-detail-effect-lbl').textContent = T('mole.cos.effectTitle');
      detail.querySelector('.cos-detail-effect-name').textContent = T('mole.cos.effectName');
      detail.querySelector('.cos-detail-effect-val').textContent = '+' + effectVal + (I18N.lang === 'en' ? 's' : '초');
      detail.querySelector('.cos-detail-acquire').textContent = T('mole.cos.acquireLine');
      var btn = detail.querySelector('.cos-detail-btn');
      var isEquipped = owned && id === equippedId;
      btn.querySelector('span').textContent = isEquipped ? T('mole.cos.equipped') : T('mole.cos.equip');
      btn.disabled = !owned || isEquipped || locked;
      if (owned && !isEquipped && !locked) {
        btn.addEventListener('click', function () {
          MG.CostumeTeams.equip(id);
          renderCostumes();
        });
      }
    }

    // 스킬 탭 — 메인화면.png 참고 + 사용자 지정(2026-09-26): 액티브/패시브를 탭 전환이 아니라
    // 좌측에 박스 2개(위=액티브, 아래=패시브)로 한 화면에 동시 표시 + 우측 무기 미리보기
    // (§10~11, §17~22, §41~42). 명세서: 바탕화면 "스킬 UI 및 에셋/명세서.txt".
    var SKL_PER_PAGE = 3; // 사용자 지정(2026-09-26, v996 재확인): 한 줄 3칸 — 카드/글자 크게
    function renderSkills() {
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      var weaponId = equipped();
      var weapon = WEAPONS.filter(function (w) { return w.id === weaponId; })[0];
      var slots = MG.Skills.slotsFor(weaponId);
      var lo = MG.Skills.loadoutFor(weaponId);

      body.innerHTML =
        '<div class="skl-wrap">' +
          '<div class="skl-body">' +
            '<div class="skl-left">' +
              '<div class="skl-box" data-skl-box="active">' +
                '<div class="skl-left-head"><span class="skl-plank"><img class="skl-head-ico" alt="" src="assets/skin2/ic-active.png"><span class="skl-left-title"></span></span>' +
                  '<div class="skl-pager"><button type="button" class="skl-parrow" data-skl-prev>◀</button>' +
                    '<span class="skl-pnum"></span><button type="button" class="skl-parrow" data-skl-next>▶</button></div>' +
                  '<button type="button" class="skl-box-restore" data-skl-restore><img alt="" src="assets/skin2/sk-restore.png"></button>' +
                '</div>' +
                '<div class="skl-grid" data-skl-grid></div>' +
              '</div>' +
              '<div class="skl-box" data-skl-box="passive">' +
                '<div class="skl-left-head"><span class="skl-plank"><img class="skl-head-ico" alt="" src="assets/skin2/ic-passive.png"><span class="skl-left-title"></span></span>' +
                  '<div class="skl-pager"><button type="button" class="skl-parrow" data-skl-prev>◀</button>' +
                    '<span class="skl-pnum"></span><button type="button" class="skl-parrow" data-skl-next>▶</button></div>' +
                  '<button type="button" class="skl-box-restore" data-skl-restore><img alt="" src="assets/skin2/sk-restore.png"></button>' +
                '</div>' +
                '<div class="skl-grid" data-skl-grid></div>' +
              '</div>' +
            '</div>' +
            '<div class="skl-right" data-skl-right></div>' +
          '</div>' +
        '</div>';

      renderSkillBox('active', weaponId, locked, slots.active, lo.activeSkills);
      renderSkillBox('passive', weaponId, locked, slots.passive, lo.passiveSkills);

      renderSkillRight(weaponId, weapon, lo, slots);
      // v995: 카드 4칸이라 좁음 — 스킬 이름이 "…"로 잘리지 않게 넘치면 글자 폭만 줄여 한 줄
      requestAnimationFrame(function () {
        body.querySelectorAll('.skl-left-title').forEach(function (t) { // v997: 이름판 안에 글자 다 들어가게 폭만 줄임
          var room = t.parentNode.clientWidth - 4;
          if (t.scrollWidth > room) { t.style.display = 'inline-block'; t.style.transformOrigin = '50% 50%'; t.style.transform = 'scaleX(' + Math.max(room / t.scrollWidth, 0.5).toFixed(3) + ')'; }
        });
        body.querySelectorAll('.skl-card-name').forEach(function (n) {
          if (!n.clientWidth || n.scrollWidth <= n.clientWidth) return;
          n.innerHTML = '<span style="display:inline-block;transform-origin:0 50%;transform:scaleX(' + Math.max(n.clientWidth / n.scrollWidth, 0.55).toFixed(3) + ')">' + n.innerHTML + '</span>';
        });
      });
    }

    // kind = 'active' | 'passive'. maxSlots/equippedList = 해당 종류의 슬롯 수·현재 장착 목록.
    function renderSkillBox(kind, weaponId, locked, maxSlots, equippedList) {
      var box = body.querySelector('[data-skl-box="' + kind + '"]');
      var restoreBtn = box.querySelector('[data-skl-restore]');
      restoreBtn.setAttribute('aria-label', T('mole.skl.restore'));
      restoreBtn.disabled = locked;
      if (!locked) {
        restoreBtn.addEventListener('click', function () {
          confirmRestoreSkills(weaponId, kind === 'active' ? 'ACTIVE' : 'PASSIVE');
        });
      }
      var list = kind === 'active' ? MG.Skills.activeSkills() : MG.Skills.passiveSkills();
      var pageCount = Math.max(1, Math.ceil(list.length / SKL_PER_PAGE));
      var page = kind === 'active' ? activePage : passivePage;
      if (page > pageCount - 1) page = pageCount - 1;
      var pageItems = list.slice(page * SKL_PER_PAGE, page * SKL_PER_PAGE + SKL_PER_PAGE);
      while (pageItems.length < SKL_PER_PAGE) pageItems.push(null); // 남는 칸 = "추후 추가 예정"(§19)

      box.querySelector('.skl-left-title').textContent =
        T(kind === 'active' ? 'mole.skl.active' : 'mole.skl.passive') + ' (' + equippedList.length + '/' + maxSlots + ')';
      box.querySelector('.skl-pnum').textContent = (page + 1) + ' / ' + pageCount;
      var prevBtn2 = box.querySelector('[data-skl-prev]');
      var nextBtn2 = box.querySelector('[data-skl-next]');
      prevBtn2.disabled = page <= 0;
      nextBtn2.disabled = page >= pageCount - 1;
      prevBtn2.addEventListener('click', function () {
        if (kind === 'active' ? activePage > 0 : passivePage > 0) {
          if (kind === 'active') activePage--; else passivePage--;
          renderSkills();
        }
      });
      nextBtn2.addEventListener('click', function () {
        var cur = kind === 'active' ? activePage : passivePage;
        if (cur < pageCount - 1) {
          if (kind === 'active') activePage++; else passivePage++;
          renderSkills();
        }
      });

      var gridEl = box.querySelector('[data-skl-grid]');
      pageItems.forEach(function (skill) {
        var cell = document.createElement('div');
        if (!skill) {
          cell.className = 'skl-card skl-card--locked';
          cell.innerHTML = '<span class="skl-card-lock">🔒</span><span class="skl-card-soon"></span>';
          cell.querySelector('.skl-card-soon').textContent = T('mole.skl.comingSoon');
          gridEl.appendChild(cell);
          return;
        }
        var qty = MG.Skills.getQuantity(skill.id);
        var isEquipped = equippedList.indexOf(skill.id) > -1;
        // v868(사용자 지정): 스킬 카드 = 무기 카드와 같은 등급 카드 형태. 등급: 빙결·골드2배·실드·피버타임=RARE, 타겟팅·융단폭격=EPIC, AI=LEGENDARY
        var rar = SKILL_RARITY[skill.id] || 'rare';
        cell.className = 'skl-card skl-rcard skl-rar-' + rar + ' inv-card--' + rar + (isEquipped ? ' skl-card--on' : '') + (qty <= 0 ? ' skl-card--empty' : '');
        cell.setAttribute('data-skill-id', skill.id);
        cell.innerHTML =
          rarityFx(rar) + '<img class="skl-badge" alt="" src="assets/inventory/rarity/badge-' + rar + '.png">' +
          '<div class="skl-card-icowrap"><img class="skl-card-ico" alt="" src="' + skill.icon + '">' +
            (isEquipped ? '<span class="skl-card-check">✓</span>' : '') + '</div>' +
          '<div class="skl-card-name"></div>' +
          '<div class="skl-card-qty"></div>' +
          '<button type="button" class="inv-equip skl-card-btn"></button>';
        cell.querySelector('.skl-card-name').textContent = I18N.lang === 'en' ? skill.nameEn : skill.nameKo;
        cell.querySelector('.skl-card-qty').textContent = T('mole.skl.qtyPrefix') + qty;
        var cbtn = cell.querySelector('.skl-card-btn');
        cbtn.textContent = isEquipped ? T('mole.inv.equipped') : T('mole.inv.equip');
        cbtn.disabled = locked || maxSlots <= 0 || (!isEquipped && qty <= 0);
        if (!locked) {
          cbtn.addEventListener('click', function () {
            var res = MG.Skills.toggleEquip(weaponId, skill.id, locked);
            if (res.ok) renderSkills();
          });
        }
        gridEl.appendChild(cell);
      });
    }

    var lastSkillWeapon = null;
    function renderSkillRight(weaponId, weapon, lo, slots) {
      var right = body.querySelector('[data-skl-right]');
      var wr = (weapon && weapon.rarity) || 'basic'; // v871: 무기 칸 = 장착 무기 등급 카드
      // 알리 판취 = 무기 화면과 동일하게 글러브 2개(오른쪽은 거울상) 표시(사용자 지정).
      var imgHtml = (weapon && weapon.id === 'alipunch')
        ? '<div class="skl-right-imgwrap skl-right-imgwrap--pair skl-rw inv-card--' + wr + '">' + rarityFx(wr) + '<img class="skl-rw-badge" alt="" src="assets/inventory/rarity/badge-' + wr + '.png">' +
            '<img class="skl-right-img" alt="" src="' + weapon.thumb + '">' +
            '<img class="skl-right-img skl-right-img--mirror" alt="" src="' + weapon.thumb + '">' +
          '</div>'
        : '<div class="skl-right-imgwrap skl-rw inv-card--' + wr + '">' + rarityFx(wr) + '<img class="skl-rw-badge" alt="" src="assets/inventory/rarity/badge-' + wr + '.png">' +
          '<img class="skl-right-img" alt="" src="' + (weapon ? weapon.thumb : '') + '"></div>';
      right.innerHTML =
        '<div class="skl-right-title skl-rt-' + wr + '"></div>' +
        '<div class="skl-right-panel">' + imgHtml +
        '<div class="skl-right-sec skl-sec--active"><div class="skl-right-lbl"><img class="skl-right-lbl-ico" alt="" src="assets/skin2/ic-active.png">' +
          '<span></span><b></b></div><div class="skl-right-icons" data-skl-r-active></div></div>' +
        '<div class="skl-right-sec skl-sec--passive"><div class="skl-right-lbl"><img class="skl-right-lbl-ico" alt="" src="assets/skin2/ic-passive.png">' +
          '<span></span><b></b></div><div class="skl-right-icons" data-skl-r-passive></div></div></div>';
      right.querySelector('.skl-right-title').textContent = weapon ? nameOf(weapon) : '';
      var secs = right.querySelectorAll('.skl-right-sec');
      secs[0].querySelector('.skl-right-lbl span').textContent = T('mole.skl.active');
      secs[0].querySelector('.skl-right-lbl b').textContent = lo.activeSkills.length + '/' + slots.active;
      secs[1].querySelector('.skl-right-lbl span').textContent = T('mole.skl.passive');
      secs[1].querySelector('.skl-right-lbl b').textContent = lo.passiveSkills.length + '/' + slots.passive;
      // 사용자 지정: 액티브 슬롯이 4개(알리판취)면 패시브 박스를 줄이고 액티브가 더 넓게
      // (2행 배치라 세로 공간이 더 필요) — 2슬롯 무기(캐논/골드묠니르)는 기존 50:50 유지.
      secs[0].style.flex = (slots.active > 2 ? 2 : 1) + ' 1 0';
      secs[1].style.flex = '1 1 0';
      if (lastSkillWeapon !== weaponId) prevEquipped = null; // 무기 바뀌면 첫 렌더는 튀지 않게
      curEquipped = [];
      fillMiniIcons(right.querySelector('[data-skl-r-active]'), lo.activeSkills, slots.active);
      fillMiniIcons(right.querySelector('[data-skl-r-passive]'), lo.passiveSkills, slots.passive);
      prevEquipped = curEquipped.slice(); lastSkillWeapon = weaponId;
    }
    var prevEquipped = null, curEquipped = [];
    function fillMiniIcons(el, ids, max) {
      el.innerHTML = '';
      ids.forEach(function (x) { if (x) curEquipped.push(x); });
      // 사용자 지정: 액티브 4슬롯(알리판취)은 2열×2행 — 왼쪽 열=왼쪽(별표) 버튼 슬롯,
      // 오른쪽 열=오른쪽(통화) 버튼 슬롯("왼쪽은 왼쪽 버튼, 오른쪽은 오른쪽버튼에 장착").
      // ids 순서는 [통화0, 통화1, 별표0, 별표1](applySkillSlots) — 화면 배치는
      // [별표0, 통화0, 별표1, 통화1] 순서로 넣어야 왼쪽열=별표/오른쪽열=통화가 된다.
      el.classList.toggle('skl-right-icons--grid2', max > 2);
      var order = max > 2 ? [2, 0, 3, 1] : null;
      for (var i = 0; i < max; i++) {
        var id = ids[order ? order[i] : i];
        var mini = document.createElement('span');
        mini.className = 'skl-mini' + (id ? '' : ' skl-mini--empty');
        if (id) {
          var s = MG.Skills.skillById(id);
          if (s) mini.innerHTML = '<img alt="" src="' + s.icon + '">';
          mini.className += ' skl-mini--' + (SKILL_RARITY[id] || 'rare'); // v871: 장착 슬롯 = 스킬 등급 색 빛 테두리
          if (prevEquipped && prevEquipped.indexOf(id) < 0) mini.classList.add('is-pop'); // 새로 장착한 것만 톡 튀며 들어옴
        }
        el.appendChild(mini);
      }
    }

    // 복원 확인 팝업 — game.js showQuitDialog() 와 동일한 .ad-overlay/.quit-card 마크업 재사용(§50).
    // type('ACTIVE'|'PASSIVE') — 사용자 지정: 액티브/패시브 박스마다 개별 복원 버튼.
    function confirmRestoreSkills(weaponId, type) {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card quit-card">' +
        '<div class="quit-title"></div>' +
        '<div class="quit-btns">' +
        '<button type="button" data-q="no"></button>' +
        '<button type="button" class="quit-yes" data-q="yes"></button></div></div>';
      v.querySelector('.quit-title').textContent = T('mole.skl.restoreConfirmA') +
        T(type === 'ACTIVE' ? 'mole.skl.active' : 'mole.skl.passive') + T('mole.skl.restoreConfirmB');
      v.querySelector('[data-q="no"]').textContent = T('mole.skl.restoreCancel');
      v.querySelector('[data-q="yes"]').textContent = T('mole.skl.restoreOk');
      document.body.appendChild(v);
      v.querySelector('[data-q="no"]').addEventListener('click', function () { v.remove(); });
      v.querySelector('[data-q="yes"]').addEventListener('click', function () {
        v.remove();
        MG.Skills.restore(weaponId, type);
        renderSkills();
      });
    }

    var PHOTO_FACE_I18N = { round: 'mole.photo.faceRound', sturdy: 'mole.photo.faceSturdy', sharp: 'mole.photo.faceSharp' };

    // 사진관 메인 화면 — 기존 정사각형 영역 안에서만 표시(§8, §35). 명세서: 바탕화면
    // "사진관 UI 및 에셋/명세서.txt". 상단 코스튬 5개 엠블럼 + 얼굴형 3슬롯(현재 코스튬 기준) +
    // 이름/효과/게임적용 + 우측 상단 돋보기(전체 컬렉션 진입).
    function renderPhoto() {
      var PS = MG.PhotoStudio;
      // v1000(사용자 지정, 바탕화면 "사진관 UI 2차 개선"): 팀색 꼰 밧줄에 매달린 엠블럼 간판 5개 +
      // 야구 장식·램프 달린 나무 액자 안에 주황 카드 3장(선택=금색, 그외=파랑) + 아래 나무 받침대.
      // 버튼 글자는 기존 그대로 "게임적용 / 게임미적용"(사용자 지정).
      body.innerHTML =
        '<div class="ph2-embs" data-photo-emblems></div>' +
        '<div class="ph2-frame"><div class="ph2-slots" data-photo-slots></div></div>' +
        '<div class="ph2-stand"></div>';

      var emblemsEl = body.querySelector('[data-photo-emblems]');
      PS.costumes().forEach(function (c, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ph2-emb' + (c.id === photoCostumeId ? ' is-on' : '');
        b.style.animationDelay = '-' + (i * 0.7).toFixed(1) + 's';
        b.innerHTML = '<img alt="" src="assets/photo2/emb-' + c.id + '.png">';
        b.addEventListener('click', function () { photoCostumeId = c.id; renderPhoto(); });
        emblemsEl.appendChild(b);
      });

      var slotsEl = body.querySelector('[data-photo-slots]');
      slotsEl.setAttribute('data-team', photoCostumeId);
      PS.faceTypes().forEach(function (f) {
        var id = f.id + '_' + photoCostumeId;
        var completed = PS.isCompleted(id);
        var applied = PS.isApplied(id);
        var sel = f.id === photoFace;
        var slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'ph2-slot' + (sel ? ' is-sel' : '');
        slot.innerHTML =
          '<img class="ph2-cbg" alt="" src="assets/costume2/card-' + photoCostumeId + '.jpg">' + // v1001(사용자 지정): 카드 안 = 고른 팀 경기장
          '<img class="ph2-card" alt="" src="assets/photo2/card-' + (sel ? 'gold' : 'blue') + '.png">' +
          '<span class="ph2-name"></span>' +
          '<img class="ph2-char' + (completed ? '' : ' photo-slot-img--locked') + '" alt="" src="' + PS.imageFor(id) + '">' +
          '<span class="ph2-btn' + (applied ? ' is-on' : '') + '"></span>';
        slot.querySelector('.ph2-name').textContent = T(PHOTO_FACE_I18N[f.id]);
        slot.querySelector('.ph2-btn').textContent = T(applied ? 'mole.photo.slotApplied' : 'mole.photo.slotNotApplied');
        slot.addEventListener('click', function () { photoFace = f.id; renderPhoto(); });
        slotsEl.appendChild(slot);
      });
    }

    // 이름 변경 팝업 — game.js showQuitDialog()와 동일한 .ad-overlay/.quit-card 재사용(§33).
    function openPhotoRenameDialog(id) {
      var v = document.createElement('div');
      v.className = 'ad-overlay';
      v.innerHTML = '<div class="ad-overlay-card quit-card">' +
        '<div class="quit-title"></div>' +
        '<input type="text" class="fm-name photo-rename-input" maxlength="12">' +
        '<div class="quit-btns">' +
        '<button type="button" data-q="no"></button>' +
        '<button type="button" class="quit-yes" data-q="yes"></button></div></div>';
      v.querySelector('.quit-title').textContent = T('mole.photo.rename');
      var input = v.querySelector('.photo-rename-input');
      input.placeholder = T('mole.photo.renamePlaceholder');
      input.value = MG.PhotoStudio.nameOf(id, I18N.lang);
      v.querySelector('[data-q="no"]').textContent = T('mole.photo.renameCancel');
      v.querySelector('[data-q="yes"]').textContent = T('mole.photo.renameSave');
      document.body.appendChild(v);
      v.querySelector('[data-q="no"]').addEventListener('click', function () { v.remove(); });
      v.querySelector('[data-q="yes"]').addEventListener('click', function () {
        var res = MG.PhotoStudio.setName(id, input.value.trim());
        if (!res.ok) {
          input.classList.remove('is-shake'); void input.offsetWidth; input.classList.add('is-shake');
          return;
        }
        v.remove();
        renderPhoto();
        if (photoCollectionOpen) renderPhotoCollection();
        if (photoDetailId) renderPhotoDetailZoom(photoDetailId);
      });
    }

    // 전체 컬렉션 — 기존 사진관 위 Bottom Sheet/Overlay(§6, §19~23), 정사각형 영역 그대로(§21).
    function renderPhotoCollection() {
      var PS = MG.PhotoStudio;
      // 사용자 지정(2026-09-27): "버튼보드"(게임보드 아래, 하트/코인/티켓~시작버튼이 있는
      // 흰색 .dialpad 영역, 게임보드와 크기 동일)를 위에서 아래로 슬라이드하며 덮는다.
      // #inventory-screen 이 아니라 .dialpad 에 마운트.
      var board = document.querySelector('.dialpad');
      if (!board) return;
      var overlay = board.querySelector('[data-photo-overlay]');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'photo-overlay';
        overlay.setAttribute('data-photo-overlay', '');
        board.appendChild(overlay);
      }
      // 사용자 지정: "별빛박스 좌측 위에 전광판(트로피), 우측 안쪽에 N/15" — 헤더는
      // 전체 높이의 약 10%만 차지, 트로피가 별빛바 위에 겹쳐 올라간다.
      overlay.innerHTML =
        '<button type="button" class="photo-coll-x" data-photo-back aria-label="닫기"><img src="assets/workshop/pick/x.png" alt=""></button>' + // v865(사용자 지정): 뒤로가기 → 오른쪽 빨간 X
        '<div class="photo-coll-headrow">' +
          '<img class="photo-coll-starbar" alt="" src="assets/photo/collection-starbar.png">' +
          '<span class="photo-coll-trophy-wrap"><img class="photo-coll-trophy" alt="" src="assets/photo/collection-trophy.png">' +
            '<span class="rx-shine" style="-webkit-mask-image:url(assets/photo/collection-trophy.png);mask-image:url(assets/photo/collection-trophy.png)"><i></i></span></span>' + // v865: 트로피 빛 훑기
          '<div class="photo-coll-progress" data-photo-progress></div>' +
          '<div class="photo-coll-hint"></div>' +
        '</div>' +
        '<div class="photo-coll-gridwrap">' +
          '<div class="photo-coll-rowlabels"></div>' +
          '<div class="photo-coll-grid" data-photo-grid></div>' +
        '</div>';
      overlay.querySelector('.photo-coll-hint').textContent = T('mole.photo.collHint');
      // 사용자 지정(2026-09-27): "앞쪽 노란박스에 위에서부터 동글형/듬직형/날렵형" —
      // 골드 플레이트(에셋에 이미 그려진 부분) 위에 세로 라벨 오버레이.
      var rowlabelsEl = overlay.querySelector('.photo-coll-rowlabels');
      PS.faceTypes().forEach(function (f) {
        var lbl = document.createElement('span');
        lbl.className = 'photo-coll-rowlabel';
        // v866(사용자 지정): 리듬팡 '일시정지' 글자처럼 노랑→주황 그라데이션 + 진갈색 외곽선·그림자, 세로로 한 글자씩
        var txt = T(PHOTO_FACE_I18N[f.id]), chars = Array.from(txt), gid = 'pcg' + f.id, vbH = chars.length * 100;
        var tx = function (cls, dy) { return chars.map(function (ch, i) { return '<text class="' + cls + '" x="50" y="' + (i * 100 + 82 + dy) + '" text-anchor="middle">' + ch.replace(/[<&>]/g, '') + '</text>'; }).join(''); };
        lbl.innerHTML = '<svg class="pc-rl-svg" viewBox="0 0 100 ' + vbH + '" aria-label="' + txt + '"><defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">' +
          '<stop offset="0" stop-color="#fff58a"/><stop offset="0.45" stop-color="#ffcf1f"/><stop offset="1" stop-color="#ff7a00"/></linearGradient></defs>' +
          tx('pc-rl-sh', 6) + tx('pc-rl-st', 0) + tx('pc-rl-fill', 0).replace(/class="pc-rl-fill"/g, 'class="pc-rl-fill" fill="url(#' + gid + ')"') + '</svg>';
        rowlabelsEl.appendChild(lbl);
      });
      overlay.querySelector('[data-photo-progress]').textContent = PS.completedCount() + ' / ' + PS.TOTAL;
      overlay.classList.toggle('is-all', PS.completedCount() >= PS.TOTAL); // v865: 다 모으면 트로피 금빛 번쩍

      var grid = overlay.querySelector('[data-photo-grid]');
      PS.faceTypes().forEach(function (f) {
        PS.charactersFor(f.id).forEach(function (def) {
          var id = def.id;
          var completed = PS.isCompleted(id);
          var applied = PS.isApplied(id);
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'photo-coll-card' + (completed ? ' is-done' : ''); // v865: 완성 칸 강조
          // 사용자 지정: 완성 여부와 무관하게 항상 엠블럼 팀에 맞는 얼굴형 캐릭터를 표시(§"제일 중요").
          card.innerHTML =
            '<img class="photo-coll-card-img' + (completed ? '' : ' photo-coll-card-img--locked') + '" alt="" src="' + MG.PhotoStudio.imageFor(id) + '">' +
            (applied ? '<span class="photo-coll-card-applied">✓</span>' : '') +
            (completed ? '<i class="photo-coll-tw" style="left:14%;top:12%"></i><i class="photo-coll-tw" style="right:12%;top:30%;animation-delay:-0.7s"></i><i class="photo-coll-tw" style="left:22%;bottom:16%;animation-delay:-1.3s"></i>' : '');
          card.insertAdjacentHTML('beforeend', '<i class="ph2-cframe"></i>'); // v1000: 주황 카드 액자(안쪽 반듯)
          card.addEventListener('click', function () { photoDetailId = id; renderPhotoDetailZoom(id); });
          grid.appendChild(card);
        });
      });

      // 사용자 지정(2026-09-27): "위에서 아래로 내려오는 등장" — CSS class+transition
      // 방식은 새로 append된 엘리먼트에서 트랜지션이 안 걸리고 닫힘 위치에 고정되는
      // 버그가 있었음(§photo-overlay 주석 참고) — Web Animations API로 재생하되,
      // 애니메이션이 어떤 이유로든 안 먹히는 환경 대비 안전장치로 짧은 지연 뒤
      // 인라인 스타일로 최종 위치를 강제 고정(컬렉션 화면 자체가 안 보이는 최악의
      // 상황만은 절대 없게).
      overlay.classList.add('is-open');
      var openAnim = overlay.animate(
        [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }],
        { duration: 280, easing: 'ease-out', fill: 'forwards' }
      );
      // fill:'forwards'인 애니메이션 효과는 끝나도 계속 남아 인라인 스타일보다 우선
      // 적용됨(실측 확인) — 안전장치에서 인라인 스타일을 주기 전에 반드시 cancel()로
      // 애니메이션 효과 자체를 제거해야 실제로 적용된다.
      setTimeout(function () { openAnim.cancel(); overlay.style.transform = 'translateY(0)'; }, 320);
      overlay.querySelector('[data-photo-back]').addEventListener('click', closePhotoCollection);
    }
    function closePhotoCollection() {
      var board = document.querySelector('.dialpad');
      var overlay = board && board.querySelector('[data-photo-overlay]');
      photoCollectionOpen = false;
      photoDetailId = null;
      if (!overlay) return;
      // 애니메이션 완료 콜백이 항상 확실하게 오는 게 아니어서(환경에 따라 지연/누락
      // 가능성 확인됨) setTimeout을 안전장치로 같이 둔다 — 어느 쪽이든 먼저 오는
      // 대로 제거, 뒤로가기 버튼이 절대 "먹통"이 되지 않도록.
      var removed = false;
      function removeOnce() { if (!removed && overlay.parentNode) { removed = true; overlay.remove(); } }
      var closeAnim = overlay.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' }
      );
      closeAnim.onfinish = removeOnce;
      setTimeout(removeOnce, 260);
    }

    // 확대 상세(§31~34) — 컬렉션 위에 뜨는 DETAIL LAYER, 완성된 캐릭터만 진입 가능.
    function renderPhotoDetailZoom(id) {
      var PS = MG.PhotoStudio;
      var board = document.querySelector('.dialpad');
      var overlay = board && board.querySelector('[data-photo-overlay]');
      if (!overlay) return;
      var zoom = overlay.querySelector('[data-photo-zoom]');
      if (!zoom) {
        zoom = document.createElement('div');
        zoom.className = 'photo-zoom';
        zoom.setAttribute('data-photo-zoom', '');
        overlay.appendChild(zoom);
      }
      var list = PS.characters();
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
      var completed = PS.isCompleted(id);
      var applied = PS.isApplied(id);
      zoom.innerHTML =
        '<div class="photo-zoom-dim" data-photo-zoom-dim></div>' +
        '<div class="photo-zoom-card photo-zoom-card--' + ((PS.characterDef(id) || {}).costumeId || '') + '">' + // v890: 확대 카드 = 그 팀 색
          '<button type="button" class="photo-zoom-close" data-photo-zoom-close>✕</button>' +
          '<button type="button" class="photo-zoom-nav photo-zoom-nav--prev" data-photo-zoom-prev>◀</button>' +
          '<button type="button" class="photo-zoom-nav photo-zoom-nav--next" data-photo-zoom-next>▶</button>' +
          '<span class="photo-zoom-imgwrap">' +
            '<img class="photo-zoom-img' + (completed ? '' : ' photo-zoom-img--locked') + '" alt="" src="' + MG.PhotoStudio.imageFor(id) + '">' +
          '</span>' +
          (applied ? '<div class="photo-zoom-applied"></div>' : '') +
          '<div class="photo-zoom-name"></div>' +
          '<div class="photo-zoom-effect"><span></span><b></b></div>' +
          '<div class="photo-zoom-btns">' +
            '<button type="button" class="inv-equip photo-zoom-rename" data-photo-zoom-rename></button>' +
            '<button type="button" class="inv-equip photo-zoom-apply" data-photo-zoom-apply></button>' +
          '</div>' +
        '</div>';
      zoom.querySelector('.photo-zoom-name').textContent = completed ? PS.nameOf(id, I18N.lang) : T('mole.photo.locked');
      if (applied) zoom.querySelector('.photo-zoom-applied').textContent = '✓ ' + T('mole.photo.applied');
      zoom.querySelector('.photo-zoom-effect span').textContent = T('mole.photo.effectTitle');
      zoom.querySelector('.photo-zoom-effect b').textContent = completed
        ? ('+' + PS.CHAR_EFFECT_VALUE + (I18N.lang === 'en' ? 's' : '초') + ' ' + T('mole.photo.effectName'))
        : '-';
      var renameBtn = zoom.querySelector('[data-photo-zoom-rename]');
      renameBtn.textContent = T('mole.photo.rename');
      renameBtn.disabled = !completed;
      if (completed) renameBtn.addEventListener('click', function () { openPhotoRenameDialog(id); });
      var applyBtn = zoom.querySelector('[data-photo-zoom-apply]');
      applyBtn.textContent = applied ? T('mole.photo.applied') : T('mole.photo.apply');
      applyBtn.disabled = !completed || (!applied && PS.appliedIds().length >= PS.MAX_APPLIED);
      if (!applyBtn.disabled) {
        applyBtn.addEventListener('click', function () {
          PS.toggleApply(id);
          renderPhotoDetailZoom(id);
          renderPhotoCollection();
        });
      }
      zoom.querySelector('[data-photo-zoom-close]').addEventListener('click', function () {
        zoom.remove();
        photoDetailId = null;
      });
      zoom.querySelector('[data-photo-zoom-dim]').addEventListener('click', function () {
        zoom.remove();
        photoDetailId = null;
      });
      var prevBtn3 = zoom.querySelector('[data-photo-zoom-prev]');
      var nextBtn3 = zoom.querySelector('[data-photo-zoom-next]');
      prevBtn3.disabled = idx <= 0;
      nextBtn3.disabled = idx >= list.length - 1;
      prevBtn3.addEventListener('click', function () { if (idx > 0) { photoDetailId = list[idx - 1].id; renderPhotoDetailZoom(photoDetailId); } });
      nextBtn3.addEventListener('click', function () { if (idx < list.length - 1) { photoDetailId = list[idx + 1].id; renderPhotoDetailZoom(photoDetailId); } });
    }

    // v890(사용자: 영어 'Costumes' 가 탭 박스 모서리와 겹침) — 글자가 탭 폭의 86%를 넘으면 가로로만 좁힘
    function fitTabLabel(lb) {
      requestAnimationFrame(function () {
        lb.style.transform = ''; var tab = lb.closest('button'); if (!tab) return;
        var room = tab.clientWidth * 0.86, w = lb.scrollWidth;
        if (w > room) { lb.style.display = 'inline-block'; lb.style.transform = 'scaleX(' + (room / w).toFixed(3) + ')'; }
      });
    }
    function renderTabs() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'inv-tab' + (t.id === active ? ' inv-tab--on' : '');
        b.innerHTML = '<span class="inv-tab-ico">' + t.icon + '</span><span class="inv-tab-lbl"></span>';
        b.querySelector('.inv-tab-lbl').textContent = T(t.i18n);
        fitTabLabel(b.querySelector('.inv-tab-lbl'));
        b.addEventListener('click', function () {
          active = t.id; pageIdx = 0; activePage = 0; passivePage = 0;
          // 사용자 지정(2026-09-27): "컬렉션 화면은 사진관 탭일 때만 유지, 다른 탭으로
          // 전환하면 닫혀야 함".
          if (active !== 'photo' && photoCollectionOpen) closePhotoCollection();
          paint();
        });
        tabsEl.appendChild(b);
      });
    }

    function paint() {
      el.setAttribute('data-tab', active); // v991: 코스튬 UI 2차 — 탭별 배경(CSS)
      renderTabs();
      // v860: 무기 탭에서 넘어올 때 등급 창 색(data-rar)이 남아 코스튬·사진관 배경을 덮던 버그 — 탭 바뀌면 항상 초기화
      var rbox = el.querySelector('.inv-cards-box'); if (rbox) rbox.setAttribute('data-rar', '');
      var tab = TABS.filter(function (t) { return t.id === active; })[0];
      if (tab) bannerTxtEl.textContent = T(tab.banner);
      headEl.style.display = active === 'weapon' ? '' : 'none';
      // 코스튬 탭은 상단 안내 박스를 통째로 없앤다(사용자 지정, 2026-09-25).
      // 사용자 지정(2026-09-26): 스킬 탭도 코스튬 탭처럼 상단 안내 배너 삭제 —
      // "어떤 스킬을 장착할까요? 박스 삭제해 필요없네" + 그만큼 전체파란박스가 위로 올라옴.
      // 사진관 탭도 동일 처리(사용자 지정): "어느 사진을 고르시겠어요? 박스 삭제하고
      // 파란전체박스를 스킬화면과 같은 크기로" — 배너 숨기면 flex 구조상 자동으로 커짐.
      if (bannerEl) bannerEl.style.display = (active === 'costume' || active === 'skill' || active === 'photo') ? 'none' : '';
      prevBtn.style.display = active === 'photo' ? 'none' : '';
      nextBtn.style.display = active === 'photo' ? 'none' : '';
      // 몰리그 전광판은 코스튬 탭에서만, 전체파란박스 밖(화면 최상단)에 표시.
      if (cosLogoEl) cosLogoEl.hidden = active !== 'costume';
      wSignEl.hidden = active !== 'weapon';
      if (photoSearchBtn) photoSearchBtn.hidden = active !== 'photo';
      if (active === 'weapon') {
        renderWeapons();
      } else if (active === 'costume') {
        dotsEl.innerHTML = '';
        renderCostumes();
      } else if (active === 'skill') {
        dotsEl.innerHTML = '';
        renderSkills();
      } else if (active === 'photo') {
        dotsEl.innerHTML = '';
        renderPhoto();
      } else {
        dotsEl.innerHTML = '';
        body.innerHTML = '<p class="inv-soon">' + T('mole.inv.soon') + '</p>';
      }
    }

    return { show: function () {
      active = 'weapon'; costumeSelectedId = null; activePage = 0; passivePage = 0;
      photoCostumeId = 'blue_bears'; photoFace = 'round'; photoCollectionOpen = false; photoDetailId = null;
      paint();
    } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.InventoryScreen = api; }
})(typeof window !== 'undefined' ? window : null);

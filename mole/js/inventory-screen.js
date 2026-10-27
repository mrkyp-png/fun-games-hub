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
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/inventory/ui-v1379/approved-mallet-redend-v1405.webp', rarity: 'basic', skillSlots: 0,
      desc: ['기본 무기.\n간단하지만 강력한 타격감으로\n두더지를 시원하게!', 'The basic weapon.\nSimple but punchy —\nbonk those moles!'],
      stats: [['-', '-'], ['-', '-'], ['-', '-']] },
    { id: 'cannon', name: '팡팡 캐논', nameEn: 'Pang Pang Cannon', thumb: 'assets/weapons/cannon-a1-nol-v1392.png', rarity: 'rare', skillSlots: 1,
      desc: ['강력한 포탄으로\n더 많은 두더지를 한 번에!\n넓은 범위를 커버하는 든든한 무기!', 'Powerful cannonballs\nhit more moles at once —\na sturdy weapon with wide reach!'],
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['2·3타 두더지 연타 확률 10%', '10% burst on 2·3-hit moles'],
              ['-', '-']] },
    { id: 'goldhammer', name: '골드 묠니르', nameEn: 'Gold Mjolnir', thumb: 'assets/weapons/goldpaw-v1382.webp', rarity: 'epic', skillSlots: 1,
      desc: ['전설의 힘을 담은 황금 망치!\n지면을 울리는 강력한 충격으로\n주변의 두더지를 한 번에 처치한다!', 'A golden hammer of legend!\nIts ground-shaking blow\ntakes out nearby moles at once!'],
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['주변 두더지 지진 연타 15% (2·3타 두더지 소탕 포함)', '15% quake — chain-hits nearby moles (clears 2·3-hit moles too)'],
              ['-', '-']] },
    { id: 'alipunch', name: '킹 판취', nameEn: 'King Punch', thumb: 'assets/weapons/kingfist-jab-mirror-v1390.webp', rarity: 'legend', skillSlots: 2,
      desc: ['전설적인 복서의 힘을 담은\n강력한 글러브! 빠르고 강한\n연타로 모든 두더지를 한 번에\n날려버린다!', 'Gloves holding the power of\na legendary boxer! Fast, heavy\ncombos blast every mole away!'],
      stats: [['Hole 16 → 14', 'Holes 16 → 14'],
              ['무적 5초 확률 20% (모든 동물 타격 가능), 2·3타 두더지 소탕 포함', '20% chance — 5s invincibility (any animal is safe to hit), clears 2·3-hit moles'],
              ['하강 딜레이 +0.1초(무적 중 +0.3초 추가)', '+0.1s before mole retreats (+0.3s more while invincible)']] }
  ];

  // 하단 탭 아이콘 — 상점(shop.js)과 같은 그라디언트 입체 아이콘 재사용(사용자 지정: "동일한
  // 스타일로"). 사진 탭은 다이얼패드 "사진보관" 카메라 아이콘(lane-controls.js SVG.locker)
  // 재사용 + 같은 톤의 그라디언트만 추가.
  var WEAPON_TAB_ICON = '<img src="assets/inventory/ui-v1379/approved-mallet-redend-v1405.webp" alt="">'; // 무기 화면 전시용 원본
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

    // 상점 카드줄과 동일한 점+화살표 페이징(사용자 지정: "상점 구조와 동일하되 한페이지 한장씩").
    // ⚠️ 처음엔 scrollBy(상대량) 방식이었는데, 카드 실측폭(getBoundingClientRect)과 grid의
    // 실제 clientWidth 가 서브픽셀 단위로 살짝 달라 페이지를 넘길 때마다 오차가 누적되어(사용자
    // 보고: "위치가 다 틀어진거같은데") 3~4번째 카드로 갈수록 어긋났음. 절대 인덱스 기준으로
    // 그 카드의 offsetLeft 로 직접 scrollTo 하는 방식으로 교체 — 오차가 누적되지 않는다.
    var pageIdx = 0; // 화면 열 때 equippedIdx() 로 맞춤(아래 show)
    var nameTimer = null;
    var copyTimer = null;
    var weaponHelp = null;
    function closeWeaponHelp() { if (weaponHelp) { weaponHelp.close(); weaponHelp.remove(); weaponHelp = null; } }
    function fitWeaponName() {
      wSignEl.style.fontSize = '80px';
      for (var size = 80; size > 32 && (wSignEl.scrollWidth > wSignEl.clientWidth || wSignEl.scrollHeight > wSignEl.clientHeight); size--) wSignEl.style.fontSize = (size - 1) + 'px';
    }
    function grid() { return body.querySelector('.iw-pages, .inv-grid'); }
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
      syncWeaponCopy();
      // v855(사용자 지정): 바깥 창 색 = 보고 있는 무기 등급 색
      var box = el.querySelector('.inv-cards-box');
      if (box) box.setAttribute('data-rar', active === 'weapon' && WEAPONS[pageIdx] ? WEAPONS[pageIdx].rarity : '');
      var nm = WEAPONS[pageIdx] ? nameOf(WEAPONS[pageIdx]) : '';
      if (wSignEl.getAttribute('data-name') !== nm) {
        closeWeaponHelp();
        clearTimeout(nameTimer);
        wSignEl.setAttribute('data-name', nm);
        wSignEl.classList.remove('is-swap');
        if (!wSignEl.textContent || root.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          wSignEl.textContent = nm; fitWeaponName(); wSignEl.classList.remove('is-fading');
        } else {
          wSignEl.classList.add('is-fading');
          nameTimer = setTimeout(function () { wSignEl.textContent = nm; fitWeaponName(); wSignEl.classList.remove('is-fading'); }, 120);
        }
      }
    }
    function syncWeaponCopy() {
      var layer = body.querySelector('.iw-copy-layer');
      if (!layer || active !== 'weapon') return;
      var w = WEAPONS[pageIdx];
      clearTimeout(copyTimer);
      if (layer.dataset.weapon === w.id) { layer.classList.remove('is-fading'); layer.inert = false; return; }
      function apply() {
        if (!layer.isConnected || active !== 'weapon') return;
        layer.dataset.weapon = w.id; layer.dataset.grade = w.rarity;
        layer.querySelector('.iw-grade-text').textContent = ({basic:'BASIC',rare:'RARE',epic:'EPIC',legend:'LEGENDARY'})[w.rarity];
        layer.querySelector('.iw-stat-title').textContent = T('mole.inv.statHead');
        layer.querySelector('.iw-help').setAttribute('aria-label', nameOf(w) + (I18N.lang === 'en' ? ' weapon guide' : ' 무기 설명'));
        var rows = layer.querySelectorAll('.iw-stat-row');
        w.stats.forEach(function (stat, i) {
          rows[i].querySelector('.iw-stat-label').textContent = T(STAT_ROWS[i]);
          var value = rows[i].querySelector('.iw-stat-value');
          value.textContent = compactWeaponStat(w, i);
          value.setAttribute('aria-label', stat[0] === '-' ? (I18N.lang === 'en' ? 'Basic: no additional effect' : '기본: 추가 효과 없음') : stat[I18N.lang === 'en' ? 1 : 0].replace(/\u00a0/g, ' '));
        });
        var btn = layer.querySelector('.iw-equip');
        var owned = MG.ItemInventory.owns('weapon', w.id);
        btn.querySelector('.iw-equip-label').textContent = owned ? T(w.id === equipped() ? 'mole.inv.equipped' : 'mole.inv.equip') : (I18N.lang === 'en' ? 'Not owned' : '미보유');
        btn.disabled = !owned || w.id === equipped() || !!(opts.gameInProgress && opts.gameInProgress());
        layer.classList.remove('is-fading'); layer.inert = false;
        requestAnimationFrame(fitLefts);
      }
      if (!layer.dataset.weapon || root.matchMedia('(prefers-reduced-motion: reduce)').matches) apply();
      else { layer.classList.add('is-fading'); layer.inert = true; copyTimer = setTimeout(apply, 120); }
    }
    // renderWeapons() 가 매번 grid 를 통째로 새로 만들기 때문에(body.innerHTML), 장착 버튼을
    // 눌러 재렌더될 때도 새 grid 는 항상 scrollLeft=0 에서 시작 — pageIdx 는 그대로 두고
    // 즉시(비-스무스) 그 위치로 복원해야 "장착 누르면 뿅망치 화면으로 튕김" 버그가 안 생긴다
    // (사용자 보고: "장착 버튼 누르면 뿅망치 화면나오고 장착이 안됨"). 탭 전환일 때만 0으로.
    function fitStatLines() {
      body.querySelectorAll('.inv-stat-line').forEach(function (ln) {
        ln.style.transform = ''; // V1379 G: 설명 값은 가로로 찌그러뜨리지 않고 줄바꿈.
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
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(function () { fitStatLines(); if (active === 'weapon') { fitLefts(); fitRights(); } }); });
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

    // 사용자: 무기·스킬 탭은 다른 탭에서 들어와도 항상 장착된 무기부터 보여줌
    function equippedIdx() { var id = equipped(); for (var i = 0; i < WEAPONS.length; i++) if (WEAPONS[i].id === id) return i; return 0; }
    function equipped() {
      return MG.ItemInventory.equippedWeapon();
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
    // V1403 C: 무기 화면·스킬 탭이 같은 무기 연출(애니메이션) 공유
    var WEAPON_ART = {hammer:[83.44,83.58,-1.09,0.04],cannon:[89.7,74.2,0,0],goldhammer:[63.1,88,0,0],alipunch:[88,63,0,0]};
    function weaponThumbHtml(w) {
        // 알리 펀치 = 좌/우 글러브 한 쌍(오른쪽은 왼쪽 이미지 거울상 — 실제 게임과 동일, §1).
        // 강조 애니메이션(사용자 지시): 두 글러브가 2번 맞부딪히고, 2번째에 스파크+"POWER UP" 표시.
      return w.id === 'alipunch'
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
    }
    function renderWeapons() {
      var cur = equipped();
      clearTimeout(copyTimer);
      body.innerHTML = '<div class="iw-mount"><div class="iw-stage"><div class="iw-pages"></div></div></div>';
      var stage = body.querySelector('.iw-stage');
      stage.setAttribute('data-lang', I18N.lang);
      wSignEl.className = 'iw-name'; stage.appendChild(wSignEl);
      headEl.className = 'iw-head'; stage.appendChild(headEl);
      var grid = body.querySelector('.iw-pages');
      WEAPONS.forEach(function (w) {
        var card = document.createElement('div');
        card.className = 'iw-page' + (w.id === cur ? ' iw-page--on' : '');
        var thumbHtml = weaponThumbHtml(w);
        card.setAttribute('data-weapon', w.id);
        card.setAttribute('data-grade', w.rarity);
        card.innerHTML = '<div class="iw-weapon"><div class="iw-preview-unit"><div class="iw-float">' + thumbHtml + '</div></div></div>';
        grid.appendChild(card);
      });
      var copy = document.createElement('div');
      copy.className = 'iw-copy-layer';
      copy.innerHTML = '<div class="iw-grade"><span class="iw-grade-text"></span></div><button type="button" class="inv-equip iw-equip"><span class="iw-equip-label"></span></button><span class="iw-stat-title"></span><button type="button" class="iw-help" aria-expanded="false" aria-haspopup="dialog"></button><div class="iw-stats">' + [0,1,2].map(function () { return '<div class="iw-stat-row"><span class="iw-stat-label"></span><span class="iw-stat-value"></span></div>'; }).join('') + '</div>';
      stage.appendChild(copy);
      copy.querySelector('.iw-help').addEventListener('click', function () { openWeaponHelp(WEAPONS[pageIdx], this); });
      copy.querySelector('.iw-equip').addEventListener('click', function () {
        if (copy.inert || (opts.gameInProgress && opts.gameInProgress())) return;
        if (MG.ItemInventory.equipWeapon(WEAPONS[pageIdx].id, false)) renderWeapons();
      });
      updateDots();
      requestAnimationFrame(function () { fitLefts(); fitRights(); });
      // 배지 그림이 늦게 로드되면 높이 0으로 계산돼 위치가 어긋남 — 로드되면 다시 맞춤
      el.querySelectorAll('.inv-badge').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { requestAnimationFrame(function () { fitLefts(); fitRights(); }); }, { once: true }); });
    }
    // V1379 G: Short values stay readable; the dialog contains every full effect.
    function compactWeaponStat(w, row) {
      var en = I18N.lang === 'en';
      if (w.stats[row][0] === '-') return en ? 'Basic' : '기본';
      if (row === 0) return w.id === 'alipunch' ? '16 → 14' : '16 → 15';
      if (row === 1) {
        var base = w.id === 'cannon' ? 10 : (w.id === 'goldhammer' ? 15 : (w.id === 'alipunch' ? 20 : 0));
        var level = MG.Workshop ? MG.Workshop.weaponLevel(w.id) : 0;
        return base ? (base + level) + '%' : (en ? 'Basic' : '\uAE30\uBCF8');
      }
      return en ? '+0.1s' : '+0.1\uCD08';
    }
    function openWeaponHelp(w, trigger) {
      closeWeaponHelp();
      var en = I18N.lang === 'en';
      var dialog = document.createElement('dialog');
      dialog.className = 'inv-weapon-guide';
      dialog.setAttribute('aria-labelledby', 'inv-guide-title');
      dialog.innerHTML = '<div class="inv-guide-header"><h2 id="inv-guide-title"></h2><button type="button" class="inv-guide-close"></button></div><div class="inv-guide-scroll"><p class="inv-guide-intro"></p><p class="inv-guide-skills"></p><p class="inv-guide-basic"></p><div class="inv-guide-sections"></div></div>';
      dialog.querySelector('h2').textContent = nameOf(w);
      var close = dialog.querySelector('button');
      close.textContent = en ? 'Close' : '닫기';
      dialog.querySelector('.inv-guide-intro').textContent = (en ? w.desc[1] : w.desc[0]).replace(/\n/g, ' ');
      // V1393 C 사용자: 액티브/패시브 구분 없이 '스킬 장착' 개수만 (캐논·골드 1개, 킹 판취 2개)
      dialog.querySelector('.inv-guide-skills').textContent = w.skillSlots === 0
        ? (en ? 'Skill equipment: Unavailable for this weapon.' : '스킬 장착: 이 무기는 스킬을 장착할 수 없습니다.')
        : (en ? 'Skill equipment: ' + w.skillSlots + (w.skillSlots === 1 ? ' skill.' : ' skills.') : '스킬 장착: ' + w.skillSlots + '개');
      dialog.querySelector('.inv-guide-basic').textContent = en ? 'Basic means the standard mallet effect, with no additional weapon bonus.' : '기본은 뿅망치와 같은 기본 효과이며, 해당 능력치에 추가 보너스가 없다는 뜻입니다.';
      var definitions = en ? [
        'The number of holes on the board. Fewer holes mean fewer places to watch.',
        'The chance of activating this weapon’s special attack when you hit.',
        'Extra time before a mole retreats, giving you more time to hit.'
      ] : [
        '게임판의 구멍 수입니다. 구멍이 줄어들면 살펴봐야 할 곳이 줄어듭니다.',
        '타격할 때 무기 고유의 특수 공격이 발동할 확률입니다.',
        '두더지가 내려가기 전의 시간을 늘려, 타격할 여유를 줍니다.'
      ];
      var sections = dialog.querySelector('.inv-guide-sections');
      w.stats.forEach(function (stat, i) {
        var section = document.createElement('section');
        var heading = document.createElement('h3'); heading.textContent = T(STAT_ROWS[i]);
        var meaning = document.createElement('p'); meaning.textContent = definitions[i];
        var effect = document.createElement('p'); effect.className = 'inv-guide-effect';
        effect.textContent = stat[0] === '-' ? (en ? 'Basic · No additional effect' : '기본 · 추가 효과 없음') : stat[en ? 1 : 0].replace(/\u00a0/g, ' ');
        if (i === 1 && w.id !== 'hammer') {
          var attackTotal = (w.id === 'cannon' ? 10 : (w.id === 'goldhammer' ? 15 : 20)) + (MG.Workshop ? MG.Workshop.weaponLevel(w.id) : 0);
          effect.textContent += en ? ' Attack power: ' + attackTotal + '%.' : ' \uACF5\uACA9\uB825: ' + attackTotal + '%.';
        }
        section.append(heading, meaning, effect); sections.appendChild(section);
      });
      function finish() { trigger.setAttribute('aria-expanded', 'false'); if (weaponHelp === dialog) weaponHelp = null; dialog.remove(); if (trigger.isConnected) trigger.focus(); }
      dialog.addEventListener('close', finish, {once:true});
      close.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (event) { if (event.target === dialog) { var r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
      el.appendChild(dialog); weaponHelp = dialog; trigger.setAttribute('aria-expanded','true'); dialog.showModal(); close.focus();
    }
    function fitRights() { fitLefts(); }
    function fitLefts() {
      if (active !== 'weapon') return;
      var mount = body.querySelector('.iw-mount');
      if (!mount || !body.clientWidth || !body.clientHeight) return;
      // One complete 1278 × 1230 image. Never repeat or stretch its interior.
      // V1387 C 사용자: 액자(그림 안 x2~1274, y8~1210, 바깥 하늘색은 투명)를 칸 안에 전부 들어가게 맞춤.
      var scale = Math.min(body.clientWidth / (1274 - 2), body.clientHeight / (1210 - 8)); // 사용자: 큰 테두리 안에 액자 전체가 들어가게(안 잘림)
      mount.style.width = (1278 * scale) + 'px';
      mount.style.height = (1230 * scale) + 'px';
      mount.style.marginLeft = ((639 - (2 + 1274) / 2) * scale) + 'px';
      mount.style.marginTop = ((615 - (8 + 1210) / 2) * scale) + 'px';
      mount.style.setProperty('--iw-scale', scale);
      fitWeaponName();
      // Visible alpha bounds in the canonical 120 x 88 animation coordinate system.
      var art = WEAPON_ART;
      body.querySelectorAll('.iw-page').forEach(function (page) {
        var a = art[page.dataset.weapon];
        var unit = page.querySelector('.iw-preview-unit');
        var sc = Math.min(440/a[0], 490/a[1]) * (page.dataset.weapon === 'cannon' ? 0.96 : 1); // V1429 C 사용자: 캐논 96%
        unit.style.setProperty('--iw-weapon-scale', sc);
        page.style.setProperty('--iw-weapon-scale', sc); // 뒤 빛이 무기와 같은 거리로 움직이게
        page.querySelector('.inv-thumb').style.transform = 'translate(' + a[2] + 'px,' + a[3] + 'px)';
      });
      body.querySelectorAll('.iw-stat-title,.iw-stat-label,.iw-stat-value,.iw-equip,.iw-grade').forEach(function (label) {
        var grade=label.classList.contains('iw-grade');
        var statLabel=label.classList.contains('iw-stat-label');
        var size = label.classList.contains('iw-equip') ? 80 : (label.classList.contains('iw-stat-title') ? 64 : (grade ? 120 : (statLabel ? 44 : 50)));
        label.style.fontSize = size + 'px';
        if (grade) {
          // V1397 C: 명판 장식(::before)이 칸 밖으로 나가 scrollWidth 로 재면 글자가 최소까지 줄던 문제 — 글자 자체를 판 안쪽 칸(--tw/--th)에 맞춤.
          var gt = label.querySelector('.iw-grade-text'), cs = getComputedStyle(label), tw = parseFloat(cs.getPropertyValue('--tw')) || label.clientWidth, th = parseFloat(cs.getPropertyValue('--th')) || label.clientHeight;
          while (size > 20 && gt && (gt.offsetWidth > tw || gt.offsetHeight > th)) label.style.fontSize = (--size) + 'px';
        } else
        while (size > 30 && (label.scrollWidth > label.clientWidth || label.scrollHeight > label.clientHeight)) label.style.fontSize = (--size) + 'px';
      });
    }
    root.addEventListener('resize', function () { if (active === 'weapon') fitLefts(); });
    // V1398 C: 폰 오류창 'ResizeObserver loop completed' — 크기 맞춤을 다음 프레임으로 미뤄 관찰 중 레이아웃 변경을 피함
    if (root.ResizeObserver) new root.ResizeObserver(function () { if (active === 'weapon') requestAnimationFrame(fitLefts); }).observe(body);

    // 코스튬 탭 — 5개 팀 카드(가로 스크롤) + 선택 코스튬 상세 + 획득 방법(§1~§58).
    // 무기 탭과 달리 페이지네이션(점/화살표) 없이 카드 줄만 가로 스크롤한다.
    // V1405 C 사용자: 코스튬 탭 개편(시안 A) — 스킬 탭과 같은 큰 테두리·판 구성.
    // 위 = 고른 팀 진열장(캐릭터 크게, 위아래 둥실) + 팀 이름·효과·획득, 아래 = 팀 카드 3장(착용 버튼).
    var costumeDrop = false; // 팀을 바꿨을 때만 천장에서 떨어지는 연출
    function renderCostumes() {
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      var equippedId = MG.CostumeTeams.equippedId();
      if (!costumeSelectedId || !MG.CostumeTeams.teamById(costumeSelectedId)) costumeSelectedId = equippedId || MG.CostumeTeams.teams()[0].id;
      var en = I18N.lang === 'en';
      var CH = function (id) { return 'assets/costume/char-' + id + '-v1406.webp'; };
      // 눈 감은 그림(같은 자리·크기)을 위에 겹쳐 두고 아주 잠깐만 보여 깜빡임
      var CHB = function (id) { return '<img alt="" src="' + CH(id) + '"><img class="cs-blink" alt="" src="assets/costume/char-' + id + '-blink-v1406.webp">'; };
      var OUTFIT = { blue_bears: 'assets/costume/outfit-blue_bears.png', mount_stars: 'assets/costume/outfit-mount_stars.png', cloud_cups: 'assets/costume/outfit-cloud_cups.png' };
      // 사용자: 위 진열장 캐릭터는 양발 기준 좌우 가운데(그림마다 양발 가운데가 달라 그만큼 옮김)
      var FEET = { blue_bears: 7.92, mount_stars: -2.39, cloud_cups: -4.63 };
      var sel = MG.CostumeTeams.teamById(costumeSelectedId);
      var cards = MG.CostumeTeams.teams().map(function (t) {
        var owned = MG.CostumeTeams.owns(t.id);
        return '<div class="ks-card cs-card' + (t.id === costumeSelectedId ? ' is-sel' : '') + (owned ? '' : ' is-locked') + '" data-cs-pick="' + t.id + '" data-team="' + t.id + '">' +
          '<span class="cs-card-char"><img class="cs-outfit" alt="" src="' + OUTFIT[t.id] + '"></span>' +
          '<button type="button" class="ks-equip ks-press' + (owned && t.id === equippedId ? ' is-on' : '') + '" data-cs-equip="' + t.id + '"><span></span></button></div>';
      }).join('');
      body.innerHTML = '<div class="ks-mount"><div class="ks-stage cs-stage">' +
        '<div class="ks-name"></div>' +
        '<div class="ks-case' + (costumeDrop ? ' is-drop' : '') + '"><div class="cs-ceil"></div><div class="cs-clip"><div class="cs-hero"><span class="cs-hero-img" data-team="' + sel.id + '" style="--feet:' + (FEET[sel.id] || 0) + '%">' + CHB(sel.id) + '</span></div></div></div>' +
        '<div class="ks-slotpanel cs-info"><div class="ks-slot-pill"><span class="cs-team"></span></div>' +
          '<div class="cs-effect"><img alt="" src="assets/costume/clock.png"><span class="cs-effect-txt"></span></div>' +
          '<div class="cs-acquire"></div></div>' +
        '<div class="ks-cards">' + cards + '</div></div></div>';
      costumeDrop = false;
      var stage = body.querySelector('.ks-stage');
      stage.querySelector('.ks-name').textContent = en ? 'Costume' : '코스튬';
      stage.querySelector('.cs-team').textContent = en ? sel.nameEn : sel.nameKo;
      var effectVal = MG.CostumeTeams.effectValue(sel.id).toFixed(2).replace(/0$/, '');
      stage.querySelector('.cs-effect-txt').innerHTML = '';
      stage.querySelector('.cs-effect-txt').appendChild(document.createTextNode(T('mole.cos.effectName')));
      var v = document.createElement('b'); v.textContent = '+' + effectVal + (en ? 's' : '초'); stage.querySelector('.cs-effect-txt').appendChild(v);
      stage.querySelector('.cs-acquire').textContent = T('mole.cos.acquireLine');
      stage.querySelectorAll('.cs-card').forEach(function (c) {
        var t = MG.CostumeTeams.teamById(c.getAttribute('data-cs-pick'));
        var owned = MG.CostumeTeams.owns(t.id), isOn = owned && t.id === equippedId;
        var b = c.querySelector('.ks-equip');
        b.querySelector('span').textContent = !owned ? T('mole.cos.notOwned') : (isOn ? T('mole.cos.equipped') : (en ? 'Equip' : '착용'));
        if (!owned || isOn || locked) b.classList.add('is-off');
        c.addEventListener('click', function (e) {
          if (!owned) return; // 사용자: 미보유 팀은 눌러도 위 진열장 안 바뀜(떨어지는 연출도 없음)
          var change = costumeSelectedId !== t.id;
          if (e.target.closest('[data-cs-equip]') && owned && !isOn && !locked) { MG.CostumeTeams.equip(t.id); costumeSelectedId = t.id; costumeDrop = change; renderCostumes(); return; }
          if (change) { costumeSelectedId = t.id; costumeDrop = true; renderCostumes(); }
        });
      });
      stage.querySelectorAll('.ks-press').forEach(function (b) {
        b.addEventListener('pointerdown', function () { if (!b.classList.contains('is-off')) b.classList.add('is-down'); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
      });
      startCostumeBlink();
      fitSkillStage();
    }
    // 2~4초마다 무작위 캐릭터 하나가 0.1초 깜빡(가끔 두 번 연속). 코스튬 탭을 떠나면 멈춤.
    var blinkTimer = null;
    function startCostumeBlink() {
      clearTimeout(blinkTimer);
      (function next() {
        blinkTimer = setTimeout(function () {
          if (active !== 'costume') return;
          var els = body.querySelectorAll('.cs-hero-img');
          if (!els.length) return;
          var el = els[Math.floor(Math.random() * els.length)];
          var twice = Math.random() < 0.3;
          el.classList.add('is-blink');
          setTimeout(function () { el.classList.remove('is-blink');
            if (twice) setTimeout(function () { el.classList.add('is-blink'); setTimeout(function () { el.classList.remove('is-blink'); }, 90); }, 120); }, 90);
          next();
        }, 2000 + Math.random() * 2000);
      })();
    }

    // V1403 C 사용자: 스킬 탭 전면 개편(시안 1번 정사각) — 무기 화면 큰 테두리 그대로, 안쪽만 새 UI.
    // 위 = 장착 무기 진열장 + 스킬 슬롯(무기별 1·1·2개), 아래 = 스킬 카드 3장(실드·타겟팅·AI).
    // 그림 에셋엔 글자 없음(글자는 코드). 버튼은 누르면 바로 깊숙이 들어가는 효과(.ks-press).
    var KS = 'assets/inventory/skill-v1403/';
    function renderSkills() {
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      // 사용자: 스킬 탭 무기 = 무기 화면에서 보고 있던 무기(세트). 무기 화면을 안 거쳤으면 장착 무기.
      var weaponId = (WEAPONS[pageIdx] || {}).id || equipped();
      var weapon = WEAPONS.filter(function (w) { return w.id === weaponId; })[0];
      var nSlots = MG.Skills.slotsFor(weaponId).active;
      var lo = MG.Skills.loadoutFor(weaponId).activeSkills;
      var en = I18N.lang === 'en';
      // 사용자: 스킬 탭 무기 = 무기 화면 무기와 세트(같은 연출·빛·바닥 그림자), 조금 작게.
      var a = weapon ? WEAPON_ART[weapon.id] : null;
      var thumb = weapon ? '<div class="iw-page ks-wpage" data-weapon="' + weapon.id + '" data-grade="' + weapon.rarity + '" style="--iw-weapon-scale:' + (Math.min(440 / a[0], 490 / a[1]) * 0.62).toFixed(3) + '"><div class="iw-weapon"><div class="iw-preview-unit" style="--iw-weapon-scale:' + (Math.min(440 / a[0], 490 / a[1]) * 0.62).toFixed(3) + '"><div class="iw-float">' + weaponThumbHtml(weapon) + '</div></div></div></div>' : '';
      var slotsHtml = '';
      for (var i = 0; i < Math.max(nSlots, 1); i++) {
        var sid = lo[i], sk = sid ? MG.Skills.skillById(sid) : null;
        slotsHtml += '<button type="button" class="ks-slot ks-press' + (nSlots ? '' : ' is-off') + '" data-ks-slot="' + (sid || '') + '">' +
          (sk ? '<img class="ks-slot-ico" alt="" src="' + sk.icon + '">' : '') + '</button>';
      }
      var cards = MG.Skills.SKILLS.map(function (sk) {
        var on = lo.indexOf(sk.id) > -1;
        return '<div class="ks-card"><img class="ks-card-ico" alt="" src="' + sk.icon + '">' +
          '<b class="ks-card-name"></b><span class="ks-card-desc"></span>' +
          '<span class="ks-count"><i></i><b>' + MG.Skills.getQuantity(sk.id) + '</b></span>' +
          '<button type="button" class="ks-equip ks-press' + (on ? ' is-on' : '') + '" data-ks-equip="' + sk.id + '"><span></span></button></div>';
      }).join('');
      body.innerHTML = '<div class="ks-mount"><div class="ks-stage" data-slots="' + nSlots + '">' +
        '<div class="ks-name"></div>' +
        '<div class="ks-case">' + thumb + '</div>' +
        '<div class="ks-slotpanel"><div class="ks-slot-pill"><span></span></div><div class="ks-slots">' + slotsHtml + '</div></div>' +
        '<div class="ks-cards">' + cards + '</div></div></div>';
      var stage = body.querySelector('.ks-stage');
      stage.querySelector('.ks-name').textContent = weapon ? nameOf(weapon) : '';
      stage.querySelector('.ks-slot-pill span').textContent = nSlots ? (en ? 'Skill slots ' : '스킬 슬롯 ') + nSlots : (en ? 'No skills' : '스킬 장착 불가');
      if (weapon && weapon.id !== 'hammer') {
        var attackLabel = document.createElement('b'); attackLabel.className = 'ks-atk-bonus';
        attackLabel.textContent = (en ? 'Attack ' : '\uACF5\uACA9\uB825 ') + compactWeaponStat(weapon, 1);
        stage.querySelector('.ks-slot-pill').appendChild(attackLabel);
      }
      stage.querySelectorAll('.ks-card').forEach(function (c, k) {
        var sk = MG.Skills.SKILLS[k];
        c.querySelector('.ks-card-name').textContent = en ? sk.nameEn : sk.nameKo;
        c.querySelector('.ks-card-desc').textContent = en ? sk.descEn : sk.descKo;
        c.querySelector('.ks-count i').textContent = en ? 'Own' : '보유';
        var button = c.querySelector('.ks-equip');
        var pending = !MG.Skills.available(sk.id);
        button.disabled = pending || locked || !nSlots || !MG.ItemInventory.owns('weapon', weaponId) || MG.Skills.getQuantity(sk.id) <= 0;
        button.querySelector('span').textContent = pending ? (en ? 'Coming soon' : '설정 대기') : T(lo.indexOf(sk.id) > -1 ? 'mole.inv.equipped' : 'mole.inv.equip');
      });
      function toggle(id) {
        if (!id || locked || !nSlots) return;
        if (MG.Skills.toggleEquip(weaponId, id, false).ok) renderSkills();
      }
      stage.querySelectorAll('[data-ks-equip]').forEach(function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-ks-equip')); }); });
      stage.querySelectorAll('[data-ks-slot]').forEach(function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-ks-slot')); }); });
      // 누르는 순간 바로 눌림(폰에서 :active 가 늦게 붙는 경우 대비)
      stage.querySelectorAll('.ks-press').forEach(function (b) {
        b.addEventListener('pointerdown', function () { b.classList.add('is-down'); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
      });
      fitSkillStage();
    }
    function fitSkillStage() {
      var mount = body.querySelector('.ks-mount');
      if (!mount || !body.clientWidth || !body.clientHeight) return;
      var scale = Math.min(body.clientWidth / (1274 - 2), body.clientHeight / (1210 - 8)); // 무기 화면과 같은 배율·위치
      mount.style.width = (1278 * scale) + 'px'; mount.style.height = (1230 * scale) + 'px';
      mount.style.marginLeft = ((639 - (2 + 1274) / 2) * scale) + 'px'; mount.style.marginTop = ((615 - (8 + 1210) / 2) * scale) + 'px';
      mount.style.setProperty('--ks-scale', scale);
    }
    root.addEventListener('resize', function () { if (active === 'skill' || active === 'costume' || active === 'photo') fitSkillStage(); });

    var PHOTO_FACE_I18N = { round: 'mole.photo.faceRound', sturdy: 'mole.photo.faceSturdy', sharp: 'mole.photo.faceSharp' };

    // 사진관 메인 화면 — 기존 정사각형 영역 안에서만 표시(§8, §35). 명세서: 바탕화면
    // "사진관 UI 및 에셋/명세서.txt". 상단 코스튬 5개 엠블럼 + 얼굴형 3슬롯(현재 코스튬 기준) +
    // 이름/효과/게임적용 + 우측 상단 돋보기(전체 컬렉션 진입).
    // V1410 C 사용자: 사진관도 무기·스킬·코스튬과 같은 틀(스킬 탭 판 .ks-* 재사용, 시안 A).
    // 위 = 고른 얼굴형 진열장 + 팀 버튼 3개·완성 n/3·돋보기, 아래 = 얼굴형 카드 3장(보유 배지 좌측 상단, 게임적용/미적용).
    function renderPhoto() {
      var PS = MG.PhotoStudio;
      var en = I18N.lang === 'en';
      var team = photoCostumeId;
      var selId = photoFace + '_' + team;
      var nDone = PS.completedCount(); // 사용자: 완성 = 전체 기준 n/9
      var teams = PS.costumes().map(function (c) {
        return '<button type="button" class="ph3-team ks-press' + (c.id === team ? ' is-on' : '') + '" data-ph3-team="' + c.id + '"><span></span></button>';
      }).join('');
      var cards = PS.faceTypes().map(function (f) {
        var id = f.id + '_' + team, done = PS.isCompleted(id), on = PS.isApplied(id);
        return '<div class="ks-card cs-card ph3-card' + (f.id === photoFace ? ' is-sel' : '') + '" data-ph3-face="' + f.id + '" data-team="' + team + '">' +
          '<span class="ph3-own' + (done ? ' is-own' : '') + '"></span>' +
          '<span class="cs-card-char"><img class="' + (done ? '' : 'photo-slot-img--locked') + '" alt="" src="' + PS.imageFor(id) + '"></span>' +
          '<b class="ks-card-name"></b>' +
          '<span class="ks-equip ph3-btn' + (on ? ' is-on' : '') + (done ? ' is-live ks-press' : '') + '"><span></span></span></div>';
      }).join('');
      body.innerHTML = '<div class="ks-mount"><div class="ks-stage cs-stage ph3-stage">' +
        '<div class="ks-name"></div>' +
        '<div class="ks-case"><div class="cs-clip"><div class="cs-hero"><span class="cs-hero-img" data-team="' + team + '"><img class="' + (PS.isCompleted(selId) ? '' : 'photo-slot-img--locked') + '" alt="" src="' + PS.imageFor(selId) + '"></span></div></div></div>' +
        '<div class="ks-slotpanel ph3-info"><div class="ph3-teams">' + teams + '</div>' +
          '<div class="cs-effect ph3-effect"><img alt="" src="assets/costume/clock.png"><span class="cs-effect-txt"></span></div>' +
          '<div class="ph3-done"><span class="ph3-done-lbl"></span><b>' + nDone + '/' + PS.TOTAL + '</b></div>' +
          '<button type="button" class="ph3-search ks-press" aria-label="search"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></svg></button></div>' +
        '<div class="ks-cards">' + cards + '</div></div></div>';
      var stage = body.querySelector('.ks-stage');
      stage.querySelector('.ks-name').textContent = en ? 'Photo Studio' : '사진관';
      // Feet coordinates follow the same cropped character art as the photo preview.
      var photoShadowPositions = {"round_blue_bears":[255.0493,39.5485],"round_cloud_cups":[266.6236,38.2439],"round_mount_stars":[250.007,37.14],"sharp_blue_bears":[253.5123,39.2584],"sharp_cloud_cups":[269.0286,38.218],"sharp_mount_stars":[249.2874,37.14],"sturdy_blue_bears":[250.4999,39.5485],"sturdy_cloud_cups":[268.5333,38.2067],"sturdy_mount_stars":[249.2076,37.14]};
      var photoShadow = photoShadowPositions[selId] || [260, 40];
      var photoCase = stage.querySelector('.ks-case');
      photoCase.style.setProperty('--photo-shadow-x', photoShadow[0] + 'px');
      photoCase.style.setProperty('--photo-shadow-bottom', photoShadow[1] + 'px');
      stage.querySelector('.ph3-done-lbl').textContent = en ? 'Done' : '완성';
      // 사용자: 사진관 설명박스 — 코스튬 화면과 같은 효과 박스
      // 사용자: 팀별 3개(얼굴형 3) 모아 적용 +0.1초, 전체(풀) 적용 +0.5초 — 효과 설명(게임 연동은 아직 API만, photo-studio.js 주석)
      var efx = stage.querySelector('.ph3-effect .cs-effect-txt');
      efx.innerHTML = '<span class="ph3-ef-row"><i></i><b></b></span><span class="ph3-ef-row"><i></i><b></b></span>';
      var rows = efx.querySelectorAll('.ph3-ef-row');
      rows[0].querySelector('i').textContent = en ? 'Team set effect' : '팀세트 적용시 효과'; rows[0].querySelector('b').textContent = '+' + PS.TEAM_EFFECT_VALUE.toFixed(1) + (en ? 's' : '초');
      rows[1].querySelector('i').textContent = en ? 'Full set effect' : '풀세트 적용시 효과'; rows[1].querySelector('b').textContent = '+' + PS.GLOBAL_EFFECT_VALUE.toFixed(1) + (en ? 's' : '초');
      stage.querySelectorAll('[data-ph3-team]').forEach(function (b) {
        var c = PS.costumes().filter(function (x) { return x.id === b.getAttribute('data-ph3-team'); })[0];
        b.querySelector('span').textContent = en ? c.nameEn : c.nameKo;
        b.addEventListener('click', function () { photoCostumeId = c.id; renderPhoto(); });
      });
      stage.querySelectorAll('[data-ph3-face]').forEach(function (cd) {
        var f = cd.getAttribute('data-ph3-face'), id = f + '_' + team;
        cd.querySelector('.ks-card-name').textContent = T(PHOTO_FACE_I18N[f]);
        cd.querySelector('.ph3-own').textContent = PS.isCompleted(id) ? (en ? 'Owned' : '보유') : (en ? 'Not owned' : '미보유');
        cd.querySelector('.ph3-btn span').textContent = T(PS.isApplied(id) ? 'mole.photo.slotApplied' : 'mole.photo.slotNotApplied');
        // 사용자: 전체 컬렉션 삭제 — 카드 누르면 고르기만, 완성 캐릭터는 버튼으로 게임 적용/미적용 바로 바꿈(최대 개수 넘으면 안내)
        cd.addEventListener('click', function (e) {
          if (e.target.closest('.ph3-btn') && PS.isCompleted(id)) {
            var res = PS.toggleApply(id);
            if (!res.ok && res.reason === 'max-applied') { var bs = cd.querySelector('.ph3-btn span'); bs.textContent = T('mole.photo.maxAppliedReached'); setTimeout(renderPhoto, 1400); return; } // 최대 개수 안내는 버튼 글자로 잠깐
            photoFace = f; renderPhoto(); return;
          }
          if (photoFace !== f) { photoFace = f; renderPhoto(); }
        });
      });
      stage.querySelector('.ph3-search').addEventListener('click', function () { openPhotoHelp(this); }); // 사용자: 돋보기 = 효과 설명
      stage.querySelectorAll('.ks-press').forEach(function (b) {
        b.addEventListener('pointerdown', function () { b.classList.add('is-down'); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, function () { b.classList.remove('is-down'); }); });
      });
      fitSkillStage();
    }

    // V1411 C 사용자: 사진관 돋보기 = 효과 설명 창(무기 설명 창 .inv-weapon-guide 재사용)
    function openPhotoHelp(trigger) {
      closeWeaponHelp();
      var en = I18N.lang === 'en', PS = MG.PhotoStudio;
      var sec = function (v) { return '+' + v.toFixed(1) + (en ? 's' : '초'); };
      var dialog = document.createElement('dialog');
      dialog.className = 'inv-weapon-guide';
      dialog.innerHTML = '<div class="inv-guide-header"><h2></h2><button type="button" class="inv-guide-close"></button></div><div class="inv-guide-scroll"><p class="inv-guide-intro"></p><div class="inv-guide-sections"></div></div>';
      dialog.querySelector('h2').textContent = en ? 'Photo Studio Effects' : '사진관 효과';
      var close = dialog.querySelector('button');
      close.textContent = en ? 'Close' : '닫기';
      dialog.querySelector('.inv-guide-intro').textContent = en
        ? 'Take a face photo to complete team costume characters. Apply completed characters to the game to slow the moles going down.'
        : '얼굴을 찍어 팀 코스튬 캐릭터를 완성하고, 완성한 캐릭터를 게임에 적용하면 두더지가 내려가는 속도가 느려집니다.';
      var rows = en ? [
        ['Team set effect', 'Complete and apply all 3 face types (Round · Sturdy · Sharp) of one team.', 'Mole descent delay ' + sec(PS.TEAM_EFFECT_VALUE)],
        ['Full set effect', 'Complete and apply all 9 characters of the 3 teams.', 'Mole descent delay ' + sec(PS.GLOBAL_EFFECT_VALUE)],
        ['Apply to game', 'Tap the button on a completed card to apply it to the game or remove it. Up to ' + PS.MAX_APPLIED + ' can be applied.', '']
      ] : [
        ['팀세트 적용시 효과', '한 팀의 동글형·듬직형·날렵형 3개를 모두 완성해 게임에 적용합니다.', '두더지 하강 딜레이 ' + sec(PS.TEAM_EFFECT_VALUE)],
        ['풀세트 적용시 효과', '3팀 9개 캐릭터를 모두 완성해 게임에 적용합니다.', '두더지 하강 딜레이 ' + sec(PS.GLOBAL_EFFECT_VALUE)],
        ['게임 적용', '완성한 카드의 버튼을 누르면 게임 적용 / 게임 미적용이 바뀝니다. 최대 ' + PS.MAX_APPLIED + '개까지 적용됩니다.', '']
      ];
      var sections = dialog.querySelector('.inv-guide-sections');
      rows.forEach(function (row) {
        var section = document.createElement('section');
        var h = document.createElement('h3'); h.textContent = row[0];
        var m = document.createElement('p'); m.textContent = row[1];
        section.append(h, m);
        if (row[2]) { var e = document.createElement('p'); e.className = 'inv-guide-effect'; e.textContent = row[2]; section.appendChild(e); }
        sections.appendChild(section);
      });
      function finish() { if (weaponHelp === dialog) weaponHelp = null; dialog.remove(); if (trigger && trigger.isConnected) trigger.focus(); }
      dialog.addEventListener('close', finish, { once: true });
      close.addEventListener('click', function () { dialog.close(); });
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
      el.appendChild(dialog); weaponHelp = dialog; dialog.showModal(); close.focus();
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
          // 사용자: 무기↔스킬 탭은 같은 무기로 세트 — 그 사이 전환은 보던 무기(pageIdx) 유지
          var keepWeapon = (active === 'weapon' || active === 'skill') && (t.id === 'weapon' || t.id === 'skill');
          active = t.id; if (!keepWeapon) pageIdx = equippedIdx(); activePage = 0; passivePage = 0;
          paint();
        });
        tabsEl.appendChild(b);
      });
    }

    function paint() {
      closeWeaponHelp();
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
      if (cosLogoEl) cosLogoEl.hidden = true; // V1405 C: 코스튬 탭 개편 — MOLE LEAGUE 간판 안 씀
      wSignEl.hidden = active !== 'weapon';
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

    // V1415 C 사용자: 제작소 강화 수치(+N)와 강화 Glow 를 무기·스킬·코스튬 화면에 표시, 사진관은 Glow 만(수치 없음).
    // 각 화면이 다시 그려질 때마다(body 내용 바뀜) 붙인다. Glow 색 = 제작소와 같은 단계별 색.
    function decorateEnh() {
      var WS = MG.Workshop; if (!WS || !WS.levelOf) return;
      function put(host, glowEl, lv, badge) {
        var c = WS.GLOW[lv] || '';
        glowEl.classList.toggle('has-enh', lv > 0);
        if (lv > 0) glowEl.style.setProperty('--enh', c); else glowEl.style.removeProperty('--enh');
        var b = host.querySelector(':scope > .enh-lv');
        if (!badge || lv <= 0) { if (b) b.remove(); return; } // V1428 C 사용자: +0 은 안 보이게
        if (!b) { b = document.createElement('b'); b.className = 'enh-lv'; host.appendChild(b); }
        b.textContent = '+' + lv;
      }
      body.querySelectorAll('.iw-page[data-weapon]').forEach(function (pg) {
        var wid = pg.getAttribute('data-weapon'); if (wid === 'hammer') return; // 사용자: 뿅망치는 강화 없음(수치·Glow 안 붙임)
        var u = pg.querySelector('.iw-preview-unit'); if (u) put(pg, u, WS.levelOf('weapon', wid), true);
      });
      var photo = !!body.querySelector('.ph3-stage');
      body.querySelectorAll('.cs-card[data-team]').forEach(function (cd) {
        var ch = cd.querySelector('.cs-card-char'); if (ch) put(cd, ch, WS.levelOf('costume', cd.getAttribute('data-team')), !photo);
      });
      var hero = body.querySelector('.cs-hero-img[data-team]');
      if (hero) put(hero.closest('.ks-case'), hero, WS.levelOf('costume', hero.getAttribute('data-team')), !photo);
    }
    new MutationObserver(function () { requestAnimationFrame(decorateEnh); }).observe(body, { childList: true });

    // V1409 C 사용자: 무기·스킬 화면 골드 묠니르도 5초마다 파란 번개(GPT 6장, 0.72초) + 그동안 뒤 색 그림자도 파란색(사용자).
    var ZAP = [1, 2, 3, 4, 5, 6].map(function (n) { return 'assets/workshop/ham-gold-zap' + n + '-v1409.webp'; });
    var zapKeep = [];
    setInterval(function () {
      if (el.hidden || (active !== 'weapon' && active !== 'skill')) return;
      if (!zapKeep.length) ZAP.forEach(function (u) { var i = new Image(); i.src = u; zapKeep.push(i); });
      el.querySelectorAll('.iw-page[data-weapon="goldhammer"] img[src*="goldpaw-v1382"]').forEach(function (img) {
        if (img._zap) return;
        var page = img.closest('.iw-page'), orig = img.getAttribute('src'), k = 0; img._zap = true; page.classList.add('is-zap');
        (function step() {
          if (k >= 9 || !img.isConnected) { img.src = orig; img._zap = false; page.classList.remove('is-zap'); return; }
          img.src = ZAP[k % ZAP.length]; k++; setTimeout(step, 80);
        })();
      });
    }, 5000);
    return { show: function () {
      active = 'weapon'; pageIdx = equippedIdx(); costumeSelectedId = null; activePage = 0; passivePage = 0;
      photoCostumeId = 'blue_bears'; photoFace = 'round';
      paint();
    } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.InventoryScreen = api; }
})(typeof window !== 'undefined' ? window : null);

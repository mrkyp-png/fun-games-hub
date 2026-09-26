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
    { id: 'photo', i18n: 'mole.inv.tabPhoto', icon: PHOTO_TAB_ICON, banner: 'mole.inv.bannerPhoto' }
  ];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabsEl = el.querySelector('[data-inv-tabs]');
    var bannerTxtEl = el.querySelector('[data-inv-banner-txt]');
    var bannerEl = el.querySelector('.inv-banner');
    var cosLogoEl = el.querySelector('.inv-cos-logo');
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
        d.className = 'inv-dot';
        dotsEl.appendChild(d);
      }
      syncDots();
      if (g && g.children[pageIdx]) g.scrollLeft = g.children[pageIdx].offsetLeft;
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
        card.innerHTML =
          '<div class="inv-top">' +
            '<div class="inv-left"><span class="inv-name"></span>' + thumbHtml +
              '<button type="button" class="inv-equip"></button></div>' +
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
        var btn = card.querySelector('.inv-equip');
        btn.textContent = w.id === cur ? T('mole.inv.equipped') : T('mole.inv.equip');
        btn.disabled = w.id === cur || locked;
        if (!locked) {
          btn.addEventListener('click', function () {
            localStorage.setItem('mole.weapon', w.id);
            // 뿅망치는 라이트 ON 만 사용 가능(사용자 지정) — DIM/OFF 였으면 ON 으로.
            if (w.id === 'hammer') {
              var diff = localStorage.getItem('mole.difficulty');
              if (diff === 'mid' || diff === 'legend') localStorage.setItem('mole.difficulty', 'easy');
            }
            renderWeapons();
          });
        }
        grid.appendChild(card);
      });
      updateDots();
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
          '<img class="cos-card-emblem" alt="" src="assets/costume/emblem-' + team.id + '.png">' +
          '<span class="cos-card">' +
            '<img class="cos-card-bg" alt="" src="assets/costume/bg-' + team.id + '.png">' +
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
        '<div class="cos-detail-char-wrap"><img class="cos-detail-char" alt="" src="assets/costume/char-' + id + '-detail.png"></div>' +
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
    var SKL_PER_PAGE = 3; // 사용자 지정(2026-09-26): "4개까지 보여줄필요없다" — 3개로 줄여 카드/글자를 크게
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
                '<div class="skl-left-head"><span class="skl-left-title"></span>' +
                  '<div class="skl-pager"><button type="button" class="skl-parrow" data-skl-prev>‹</button>' +
                    '<span class="skl-pnum"></span><button type="button" class="skl-parrow" data-skl-next>›</button></div>' +
                  '<button type="button" class="skl-box-restore" data-skl-restore><img alt="" src="assets/skills/restore.png"></button>' +
                '</div>' +
                '<div class="skl-grid" data-skl-grid></div>' +
              '</div>' +
              '<div class="skl-box" data-skl-box="passive">' +
                '<div class="skl-left-head"><span class="skl-left-title"></span>' +
                  '<div class="skl-pager"><button type="button" class="skl-parrow" data-skl-prev>‹</button>' +
                    '<span class="skl-pnum"></span><button type="button" class="skl-parrow" data-skl-next>›</button></div>' +
                  '<button type="button" class="skl-box-restore" data-skl-restore><img alt="" src="assets/skills/restore.png"></button>' +
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
        cell.className = 'skl-card' + (isEquipped ? ' skl-card--on' : '') + (qty <= 0 ? ' skl-card--empty' : '');
        cell.innerHTML =
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

    function renderSkillRight(weaponId, weapon, lo, slots) {
      var right = body.querySelector('[data-skl-right]');
      // 알리 판취 = 무기 화면과 동일하게 글러브 2개(오른쪽은 거울상) 표시(사용자 지정).
      var imgHtml = (weapon && weapon.id === 'alipunch')
        ? '<div class="skl-right-imgwrap skl-right-imgwrap--pair">' +
            '<img class="skl-right-img" alt="" src="' + weapon.thumb + '">' +
            '<img class="skl-right-img skl-right-img--mirror" alt="" src="' + weapon.thumb + '">' +
          '</div>'
        : '<div class="skl-right-imgwrap"><img class="skl-right-img" alt="" src="' + (weapon ? weapon.thumb : '') + '"></div>';
      right.innerHTML =
        '<div class="skl-right-title"></div>' +
        imgHtml +
        '<div class="skl-right-sec"><div class="skl-right-lbl"><img class="skl-right-lbl-ico" alt="" src="assets/skills/active_skill.png">' +
          '<span></span><b></b></div><div class="skl-right-icons" data-skl-r-active></div></div>' +
        '<div class="skl-right-sec"><div class="skl-right-lbl"><img class="skl-right-lbl-ico" alt="" src="assets/skills/passive_skill.png">' +
          '<span></span><b></b></div><div class="skl-right-icons" data-skl-r-passive></div></div>';
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
      fillMiniIcons(right.querySelector('[data-skl-r-active]'), lo.activeSkills, slots.active);
      fillMiniIcons(right.querySelector('[data-skl-r-passive]'), lo.passiveSkills, slots.passive);
    }
    function fillMiniIcons(el, ids, max) {
      el.innerHTML = '';
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
      // 사용자 지정(2026-09-26): 하단 이름/효과/게임적용 바 + 투명박스 전부 삭제.
      // 돋보기는 전체파란박스 밖(#inventory-screen 최상단 코너)의 별도 고정 버튼으로
      // 이동(paint()에서 탭별로 토글, create()에서 클릭 1회만 배선).
      // 사용자 지정: "엠블럼 박스만 사이즈 키워봐" — 정사각형(.photo-square) 밖으로 빼서
      // .inv-body 전체 폭(정사각형보다 넓음)을 그대로 쓰게 한다.
      body.innerHTML =
        '<div class="photo-emblems" data-photo-emblems></div>' +
        '<div class="photo-square">' +
          '<div class="photo-slots" data-photo-slots></div>' +
        '</div>';

      var emblemsEl = body.querySelector('[data-photo-emblems]');
      PS.costumes().forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'photo-emblem' + (c.id === photoCostumeId ? ' photo-emblem--on' : '');
        b.innerHTML = '<img alt="" src="assets/costume/emblem-' + c.id + '.png">';
        b.addEventListener('click', function () { photoCostumeId = c.id; renderPhoto(); });
        emblemsEl.appendChild(b);
      });

      var slotsEl = body.querySelector('[data-photo-slots]');
      PS.faceTypes().forEach(function (f) {
        var id = f.id + '_' + photoCostumeId;
        var completed = PS.isCompleted(id);
        var applied = PS.isApplied(id);
        var sel = f.id === photoFace;
        var slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'photo-slot' + (sel ? ' photo-slot--sel' : '');
        // 사용자 지정: 완성 여부와 무관하게 항상 얼굴형 캐릭터 이미지를 보여주고(§"제일
        // 중요"), 미완성은 흑백 처리로만 구분. 얼굴형 이름은 카드 좌상단 대각선 띠로.
        // 캐릭터 발밑에는 에셋6의 원형 발판(선택=골드/그외=블루)을 배경으로 깐다.
        slot.innerHTML =
          '<span class="photo-slot-frame">' +
            '<img class="photo-slot-pedestal" alt="" src="assets/photo/pedestal_' + (sel ? 'gold' : 'blue') + '.png">' +
            '<img class="photo-slot-img' + (completed ? '' : ' photo-slot-img--locked') + '" alt="" src="assets/photo/characters/' + id + '.png">' +
            '<span class="photo-slot-ribbon"></span>' +
            (applied ? '<span class="photo-slot-applied">✓</span>' : '') +
          '</span>';
        slot.querySelector('.photo-slot-ribbon').textContent = T(PHOTO_FACE_I18N[f.id]);
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
      var square = body.querySelector('.photo-square');
      if (!square) return; // 탭 전환 등으로 이미 사라짐
      var overlay = square.querySelector('[data-photo-overlay]');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'photo-overlay';
        overlay.setAttribute('data-photo-overlay', '');
        square.appendChild(overlay);
      }
      overlay.innerHTML =
        '<button type="button" class="photo-coll-back" data-photo-back>‹</button>' +
        '<img class="photo-coll-header" alt="" src="assets/photo/collection-header.png">' +
        '<div class="photo-coll-progress" data-photo-progress></div>' +
        '<div class="photo-coll-gridwrap"><div class="photo-coll-grid" data-photo-grid></div></div>';
      overlay.querySelector('[data-photo-progress]').textContent = PS.completedCount() + ' / ' + PS.TOTAL;

      var grid = overlay.querySelector('[data-photo-grid]');
      PS.faceTypes().forEach(function (f) {
        PS.charactersFor(f.id).forEach(function (def) {
          var id = def.id;
          var completed = PS.isCompleted(id);
          var applied = PS.isApplied(id);
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'photo-coll-card';
          // 사용자 지정: 완성 여부와 무관하게 항상 엠블럼 팀에 맞는 얼굴형 캐릭터를 표시(§"제일 중요").
          card.innerHTML =
            '<img class="photo-coll-card-img' + (completed ? '' : ' photo-coll-card-img--locked') + '" alt="" src="assets/photo/characters/' + id + '.png">' +
            (applied ? '<span class="photo-coll-card-applied">✓</span>' : '');
          card.addEventListener('click', function () { photoDetailId = id; renderPhotoDetailZoom(id); });
          grid.appendChild(card);
        });
      });

      // reflow 뒤에 열림 클래스를 줘야 슬라이드 업 트랜지션이 실제로 재생된다.
      overlay.classList.remove('is-open');
      void overlay.offsetWidth;
      overlay.classList.add('is-open');
      overlay.querySelector('[data-photo-back]').addEventListener('click', closePhotoCollection);
    }
    function closePhotoCollection() {
      var square = body.querySelector('.photo-square');
      var overlay = square && square.querySelector('[data-photo-overlay]');
      photoCollectionOpen = false;
      photoDetailId = null;
      if (!overlay) return;
      overlay.classList.remove('is-open');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 300);
    }

    // 확대 상세(§31~34) — 컬렉션 위에 뜨는 DETAIL LAYER, 완성된 캐릭터만 진입 가능.
    function renderPhotoDetailZoom(id) {
      var PS = MG.PhotoStudio;
      var overlay = body.querySelector('[data-photo-overlay]');
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
        '<div class="photo-zoom-card">' +
          '<button type="button" class="photo-zoom-close" data-photo-zoom-close>✕</button>' +
          '<button type="button" class="photo-zoom-nav photo-zoom-nav--prev" data-photo-zoom-prev>‹</button>' +
          '<button type="button" class="photo-zoom-nav photo-zoom-nav--next" data-photo-zoom-next>›</button>' +
          '<span class="photo-zoom-imgwrap">' +
            '<img class="photo-zoom-img' + (completed ? '' : ' photo-zoom-img--locked') + '" alt="" src="assets/photo/characters/' + id + '.png">' +
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

    function renderTabs() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'inv-tab' + (t.id === active ? ' inv-tab--on' : '');
        b.innerHTML = '<span class="inv-tab-ico">' + t.icon + '</span><span class="inv-tab-lbl"></span>';
        b.querySelector('.inv-tab-lbl').textContent = T(t.i18n);
        b.addEventListener('click', function () { active = t.id; pageIdx = 0; activePage = 0; passivePage = 0; paint(); });
        tabsEl.appendChild(b);
      });
    }

    function paint() {
      renderTabs();
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

(function (root) {
  'use strict';
  // 아이템 보관 — 무기 / 모자 / 옷 / 악세사리 탭.
  // 무기 탭은 동작 (뽕망치 기본 + 대포 스킨 장착). 나머지는 Phase 2 placeholder.
  var I18N = root.FGH.I18N;
  var T = function (k) { return I18N.t(k); };

  // 능력치 표 3줄 (라벨 = i18n 키, 값 = [ko, en]).
  var STAT_ROWS = ['mole.inv.stat.visibility', 'mole.inv.stat.attack', 'mole.inv.stat.defense'];
  var WEAPONS = [
    { id: 'hammer', name: '뿅망치', nameEn: 'Mallet', thumb: 'assets/hammer.png',
      stats: [['-', '-'], ['-', '-'], ['-', '-']] },
    { id: 'cannon', name: '캐논', nameEn: 'Cannon', thumb: 'assets/weapons/cannon-a1.png',
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['2·3타 두더지 연타 확률 10%', '10% burst on 2·3-hit moles'],
              ['-', '-']] },
    { id: 'goldhammer', name: '골드해머', nameEn: 'Gold Hammer', thumb: 'assets/weapons/goldhammer-0.png',
      gemGlow: true,   // 보석(파란불빛) 부분에 맥동 글로우
      stats: [['Hole 16 → 15', 'Holes 16 → 15'],
              ['주변 두더지 지진 연타 15%', '15% quake — chain-hits nearby moles'],
              ['-', '-']] },
    { id: 'alipunch', name: '알리 판취', nameEn: 'Ali Punch', thumb: 'assets/weapons/alipunch-jab.png',
      stats: [['Hole 16 → 14', 'Holes 16 → 14'],
              ['무적 5초 확률 20%', '20% chance — 5s invincibility'],
              ['하강 딜레이 +0.1초', '+0.1s before mole retreats']] }
  ];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabBtns = el.querySelectorAll('[data-inv-tab]');
    el.querySelector('[data-back="inventory"]').addEventListener('click', opts.onClose);
    var active = 'weapon';

    function equipped() {
      var w = localStorage.getItem('mole.weapon');
      return w === 'cannon' ? 'cannon' : (w === 'goldhammer' ? 'goldhammer' : (w === 'alipunch' ? 'alipunch' : 'hammer'));
    }
    function nameOf(w) {
      return I18N.lang === 'en' ? w.nameEn : w.name;
    }

    function renderWeapons() {
      var cur = equipped();
      // 게임 진행 중(라운드1~클리어)엔 무기 변경 잠금 — 라운드 도중 무기가 바뀌면 구멍 수·
      // 스케줄러가 꼬여서(원래 버그: 이어가기 시 옛 무기로 나옴), 아예 못 바꾸게 한다.
      var locked = !!(opts.gameInProgress && opts.gameInProgress());
      body.innerHTML = (locked ? '<p class="inv-locked"></p>' : '') + '<div class="inv-grid"></div>';
      if (locked) body.querySelector('.inv-locked').textContent = T('mole.inv.locked');
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
        card.innerHTML =
          '<div class="inv-head"><span class="inv-name"></span></div>' +
          thumbHtml +
          '<div class="inv-stat">' +
            '<div class="inv-stat-h"></div>' +
            '<table class="inv-stat-tbl"><tbody>' +
              w.stats.map(function () { return '<tr><th></th><td></td></tr>'; }).join('') +
            '</tbody></table>' +
          '</div>' +
          '<button type="button" class="inv-equip"></button>';
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
            renderWeapons();
          });
        }
        grid.appendChild(card);
      });
    }

    function paint() {
      tabBtns.forEach(function (b) {
        b.classList.toggle('inv-tab--on', b.getAttribute('data-inv-tab') === active);
      });
      if (active === 'weapon') renderWeapons();
      else body.innerHTML = '<p class="inv-soon">' + T('mole.inv.soon') + '</p>';
    }
    tabBtns.forEach(function (b) {
      b.addEventListener('click', function () { active = b.getAttribute('data-inv-tab'); paint(); });
    });

    return { show: function () { active = 'weapon'; paint(); } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.InventoryScreen = api; }
})(typeof window !== 'undefined' ? window : null);

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
              ['-', '-']] }
  ];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabBtns = el.querySelectorAll('[data-inv-tab]');
    el.querySelector('[data-back="inventory"]').addEventListener('click', opts.onClose);
    var active = 'weapon';

    function equipped() {
      return localStorage.getItem('mole.weapon') === 'cannon' ? 'cannon' : 'hammer';
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
        card.innerHTML =
          '<div class="inv-head"><span class="inv-name"></span></div>' +
          '<div class="inv-thumb"><img alt="" src="' + w.thumb + '"></div>' +
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

(function (root) {
  'use strict';
  // 아이템 보관 — 무기 / 모자 / 옷 / 악세사리 탭. 실제 목록은 Phase 2 (무기 스킨 시스템
  // + 코스튬 통합). 지금은 탭 전환 + "준비 중" placeholder.
  var I18N = root.FGH.I18N;
  var TABS = ['weapon', 'hat', 'clothes', 'accessory'];

  function create(opts) {
    var el = opts.root;
    var body = el.querySelector('[data-inv-body]');
    var tabBtns = el.querySelectorAll('[data-inv-tab]');
    el.querySelector('[data-back="inventory"]').addEventListener('click', opts.onClose);
    var active = 'weapon';

    function paint() {
      tabBtns.forEach(function (b) {
        b.classList.toggle('inv-tab--on', b.getAttribute('data-inv-tab') === active);
      });
      body.innerHTML = '<p class="inv-soon">' + I18N.t('mole.inv.soon') + '</p>';
    }
    tabBtns.forEach(function (b) {
      b.addEventListener('click', function () { active = b.getAttribute('data-inv-tab'); paint(); });
    });

    return { show: function () { active = 'weapon'; paint(); } };
  }

  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.InventoryScreen = api; }
})(typeof window !== 'undefined' ? window : null);

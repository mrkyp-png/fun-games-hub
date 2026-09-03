(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var GOLD_KEY = 'mole.skinGoldOwned';
  var SKIN_KEY = 'mole.hammerSkin';
  var GOLD_PRICE = 300;

  function create(opts) {
    var el = opts.root;
    var list = el.querySelector('[data-shop-list]');
    el.querySelector('[data-back="shop"]').addEventListener('click', opts.onClose);

    function row(label, btnLabel, disabled, onClick) {
      var d = document.createElement('div');
      d.className = 'shop-row';
      d.innerHTML = '<span></span><button type="button"' + (disabled ? ' disabled' : '') + '></button>';
      d.querySelector('span').textContent = label;
      var btn = d.querySelector('button');
      btn.textContent = btnLabel;
      btn.addEventListener('click', onClick);
      list.appendChild(d);
    }
    function done() { show(); if (opts.onChange) opts.onChange(); }

    function show() {
      el.querySelector('[data-shop-bal]').textContent = T('mole.shop.bal', { n: MG.Economy.getCoins().toLocaleString() });
      list.innerHTML = '';
      row(T('mole.shop.heart1') + ' (100🪙)', T('mole.shop.buy'), MG.Economy.getCoins() < 100, function () {
        if (MG.Economy.spendCoins(100)) { MG.Economy.addHearts(1); done(); } else alert(T('mole.shop.noCoin'));
      });
      row(T('mole.shop.heartFull') + ' (400🪙)', T('mole.shop.buy'), MG.Economy.getCoins() < 400, function () {
        if (MG.Economy.spendCoins(400)) { MG.Economy.addHearts(MG.Economy.HEART_MAX); done(); } else alert(T('mole.shop.noCoin'));
      });
      row(T('mole.shop.watchHeart'), '▶', false, function () {
        MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addHearts(1); done(); } });
      });
      row(T('mole.shop.watchCoin'), '▶', false, function () {
        MG.Ads.rewarded().then(function (ok) { if (ok) { MG.Economy.addCoins(50); done(); } });
      });

      var goldOwned = localStorage.getItem(GOLD_KEY) === '1';
      var skin = localStorage.getItem(SKIN_KEY) || 'basic';
      row(T('mole.shop.skin') + ': ' + T('mole.shop.skinBasic'),
          skin === 'basic' ? T('mole.shop.equipped') : T('mole.shop.equip'),
          skin === 'basic', function () { localStorage.setItem(SKIN_KEY, 'basic'); done(); });
      if (goldOwned) {
        row(T('mole.shop.skin') + ': ' + T('mole.shop.skinGold'),
            skin === 'gold' ? T('mole.shop.equipped') : T('mole.shop.equip'),
            skin === 'gold', function () { localStorage.setItem(SKIN_KEY, 'gold'); done(); });
      } else {
        row(T('mole.shop.skin') + ': ' + T('mole.shop.skinGold') + ' (' + GOLD_PRICE + '🪙)',
            T('mole.shop.buy'), MG.Economy.getCoins() < GOLD_PRICE, function () {
          if (MG.Economy.spendCoins(GOLD_PRICE)) {
            localStorage.setItem(GOLD_KEY, '1'); localStorage.setItem(SKIN_KEY, 'gold'); done();
          } else alert(T('mole.shop.noCoin'));
        });
      }
    }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Shop = api; }
})(typeof window !== 'undefined' ? window : null);

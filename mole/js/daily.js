(function (root) {
  'use strict';
  var MG = root.MoleGame;
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var REWARDS = [20, 30, 40, 50, 60, 80, 100];
  var KEY = 'mole.daily';

  function dstr(ms) { var d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() { return dstr(Date.now()); }
  function yesterday() { return dstr(Date.now() - 86400000); }
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { streak: 0, lastClaim: '' }; }
    catch (e) { return { streak: 0, lastClaim: '' }; }
  }
  function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function create(opts) {
    var el = opts.root;
    var grid = el.querySelector('[data-daily-grid]');
    var claimBtn = el.querySelector('[data-daily-claim]');
    var dblBtn = el.querySelector('[data-daily-2x]');
    el.querySelector('[data-back="daily"]').addEventListener('click', opts.onClose);

    function claimableToday() { return read().lastClaim !== today(); }
    function nextStreak() {
      var s = read();
      if (s.lastClaim === today()) return s.streak;
      if (s.lastClaim === yesterday()) return Math.min(7, s.streak + 1);
      return 1;
    }

    function show() {
      var ns = nextStreak();
      var claimable = claimableToday();
      grid.innerHTML = '';
      for (var i = 1; i <= 7; i++) {
        var cell = document.createElement('div');
        cell.className = 'daily-cell'
          + ((i < ns || (i === ns && !claimable)) ? ' daily-cell--done' : '')
          + ((i === ns && claimable) ? ' daily-cell--today' : '');
        cell.innerHTML = '<i></i><b></b>';
        cell.querySelector('i').textContent = T('mole.daily.day', { n: i });
        cell.querySelector('b').textContent = REWARDS[i - 1] + '🪙';
        grid.appendChild(cell);
      }
      if (claimable) {
        claimBtn.disabled = false;
        claimBtn.textContent = T('mole.daily.claim', { n: REWARDS[ns - 1] });
        dblBtn.hidden = true;
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = T('mole.daily.claimed');
        dblBtn.hidden = (localStorage.getItem('mole.dailyDoubled') === today());
      }
    }

    claimBtn.addEventListener('click', function () {
      if (!claimableToday()) return;
      var ns = nextStreak();
      MG.Economy.addCoins(REWARDS[ns - 1]);
      write({ streak: ns, lastClaim: today() });
      show();
      if (opts.onChange) opts.onChange();
    });
    dblBtn.addEventListener('click', function () {
      var ns = read().streak;
      MG.Ads.rewarded().then(function (ok) {
        if (!ok) return;
        MG.Economy.addCoins(REWARDS[Math.max(0, ns - 1)]);
        localStorage.setItem('mole.dailyDoubled', today());
        show();
        if (opts.onChange) opts.onChange();
      });
    });

    return { show: show, claimableToday: claimableToday };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.Daily = api; }
})(typeof window !== 'undefined' ? window : null);

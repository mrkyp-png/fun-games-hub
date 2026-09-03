(function (root) {
  'use strict';
  var T = function (k, p) { return root.FGH.I18N.t(k, p); };
  var DIFF_LABEL = { easy: 'mole.diff.easy', mid: 'mole.diff.mid', legend: 'mole.diff.legend' };

  function create(opts) {
    var el = opts.root;
    el.querySelector('[data-back="score"]').addEventListener('click', opts.onClose);

    function show() {
      var bestBox = el.querySelector('[data-score-best]');
      bestBox.innerHTML = '';
      ['easy', 'mid', 'legend'].forEach(function (d) {
        var n = parseInt(localStorage.getItem('mole.best.' + d), 10) || 0;
        var r = document.createElement('div');
        r.className = 'score-best-row';
        r.textContent = T('mole.score.bestOf', { d: T(DIFF_LABEL[d]), n: n.toLocaleString() });
        bestBox.appendChild(r);
      });
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem('mole.history') || '[]'); } catch (e) {}
      var box = el.querySelector('[data-score-hist]');
      box.innerHTML = '';
      if (!hist.length) {
        var p = document.createElement('p');
        p.className = 'score-empty';
        p.textContent = T('mole.score.noHist');
        box.appendChild(p);
        return;
      }
      hist.slice(-20).reverse().forEach(function (h) {
        var dt = new Date(h.t);
        var r = document.createElement('div');
        r.className = 'score-hist-row';
        r.innerHTML = '<span></span><span></span><b></b>' + (h.best ? '<i>★</i>' : '');
        var s = r.querySelectorAll('span');
        s[0].textContent = (dt.getMonth() + 1) + '/' + dt.getDate();
        s[1].textContent = T(DIFF_LABEL[h.diff] || 'mole.diff.easy');
        r.querySelector('b').textContent = (h.score || 0).toLocaleString();
        box.appendChild(r);
      });
    }
    return { show: show };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScoreScreen = api; }
})(typeof window !== 'undefined' ? window : null);

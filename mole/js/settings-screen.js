(function (root) {
  'use strict';
  var S = root.FGH.Settings;
  var I18N = root.FGH.I18N;
  var T = function (k) { return I18N.t(k); };

  var ICONS = {
    bgm: '<path d="M9 18V5l11-2v13M9 13l11-2"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    sfx: '<path d="M4 9v6h4l5 4V5L8 9zM17 8a5 5 0 010 8M19.5 5.5a9 9 0 010 13"/>',
    vib: '<rect x="8" y="4" width="8" height="16" rx="1.5"/><path d="M4 8v8M20 8v8"/>'
  };

  function create(opts) {
    var el = opts.root;
    var list = el.querySelector('[data-set-list]');
    el.querySelector('[data-back="settings"]').addEventListener('click', opts.onClose);

    function toggleRow(iconKey, labelKey, settingName) {
      var row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML =
        '<svg class="set-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[iconKey] + '</svg>' +
        '<span class="set-lbl"></span>' +
        '<button type="button" class="set-toggle" role="switch"><span class="set-knob"></span></button>';
      row.querySelector('.set-lbl').textContent = T(labelKey);
      var btn = row.querySelector('.set-toggle');
      function paint() {
        var on = S.get(settingName);
        btn.classList.toggle('set-toggle--on', on);
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
      }
      btn.addEventListener('click', function () {
        S.set(settingName, !S.get(settingName));
        paint();
        if (settingName === 'vibration' && S.get('vibration')) S.vibrate(30);
      });
      paint();
      list.appendChild(row);
    }

    function langRow() {
      var row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML =
        '<svg class="set-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 000 18M12 3a14 14 0 010 18"/></svg>' +
        '<span class="set-lbl"></span>' +
        '<button type="button" class="set-lang" data-lang="ko">한국어</button>' +
        '<button type="button" class="set-lang" data-lang="en">EN</button>';
      row.querySelector('.set-lbl').textContent = T('mole.set.lang');
      var btns = row.querySelectorAll('.set-lang');
      function paint() {
        var cur = S.get('lang');
        btns.forEach(function (b) { b.classList.toggle('set-lang--on', b.getAttribute('data-lang') === cur); });
      }
      btns.forEach(function (b) {
        b.addEventListener('click', function () { S.set('lang', b.getAttribute('data-lang')); paint(); rebuild(); });
      });
      paint();
      list.appendChild(row);
    }

    function linkRow(iconSvg, labelKey, onClick) {
      var row = document.createElement('div');
      row.className = 'set-row set-row--link';
      row.innerHTML =
        '<svg class="set-ic" viewBox="0 0 24 24" aria-hidden="true">' + iconSvg + '</svg>' +
        '<span class="set-lbl"></span>' +
        '<span class="set-chev" aria-hidden="true">›</span>';
      row.querySelector('.set-lbl').textContent = T(labelKey);
      row.addEventListener('click', onClick);
      list.appendChild(row);
    }

    function resetRow() {
      var row = document.createElement('div');
      row.className = 'set-row set-row--reset';
      row.innerHTML = '<button type="button" class="set-reset"></button>';
      var b = row.querySelector('.set-reset');
      b.textContent = T('mole.set.reset');
      b.addEventListener('click', function () {
        if (!confirm(T('mole.set.resetConfirm'))) return;
        try { localStorage.clear(); } catch (e) {}
        if (root.indexedDB && root.indexedDB.deleteDatabase) root.indexedDB.deleteDatabase('moleFaces');
        location.reload();
      });
      list.appendChild(row);
    }

    function rebuild() {
      list.innerHTML = '';
      toggleRow('bgm', 'mole.set.bgm', 'music');
      toggleRow('sfx', 'mole.set.sfx', 'sound');
      toggleRow('vib', 'mole.set.vib', 'vibration');
      langRow();
      if (opts.onPrivacy) {
        linkRow('<path d="M12 3l7 3v5.5c0 4.5-2.8 7.5-7 9-4.2-1.5-7-4.5-7-9V6z"/>',
          'mole.more.privacy', opts.onPrivacy);
      }
      resetRow();
    }

    return { show: rebuild };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.SettingsScreen = api; }
})(typeof window !== 'undefined' ? window : null);

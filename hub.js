(function () {
  'use strict';
  var I = window.FGH.I18N;

  var SCREENS = ['score', 'album', 'home', 'shop'];
  function show(tab) {
    SCREENS.forEach(function (t) {
      document.getElementById(t + '-screen').hidden = (t !== tab);
    });
    document.querySelectorAll('#tab-bar .fgh-tab').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
    });
  }

  document.querySelectorAll('#tab-bar .fgh-tab').forEach(function (b) {
    b.addEventListener('click', function () { show(b.getAttribute('data-tab')); });
  });

  window.FGH.SettingsUI.mount();
  I.applyStatic(document);
  I.onChange(function () { I.applyStatic(document); });
  show('home');
})();

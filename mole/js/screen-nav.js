(function (root) {
  'use strict';
  // #board-start 안의 화면 패널들을 서로 배타적으로 표시 (hidden 토글) + 히스토리 스택.
  function create(opts) {
    var ids = opts.screens.slice();
    var onShow = opts.onShow || function () {};
    var stack = [];

    function render() {
      var top = stack[stack.length - 1];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = (id !== top);
      });
      if (top) onShow(top);
    }
    function show(id) {
      if (ids.indexOf(id) === -1) return;
      if (stack[stack.length - 1] === id) return;
      stack.push(id);
      render();
    }
    function back() {
      if (stack.length > 1) stack.pop();
      render();
    }
    function current() { return stack[stack.length - 1] || null; }
    return { show: show, back: back, current: current };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScreenNav = api; }
})(typeof window !== 'undefined' ? window : null);

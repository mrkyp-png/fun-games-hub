(function (root) {
  'use strict';
  // 더보기 메뉴 안의 하위 화면 패널들을 서로 배타적으로 표시 (hidden 토글) + 히스토리 스택.
  // 스택이 비면(닫힘) 전부 hidden.
  function create(opts) {
    var ids = opts.screens.slice();
    var onShow = opts.onShow || function () {};
    var onClose = opts.onClose || function () {};
    var stack = [];

    function render() {
      var top = stack[stack.length - 1] || null;
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = (id !== top);
      });
      if (top) onShow(top);
      else onClose();
    }
    function show(id) {
      if (ids.indexOf(id) === -1) return;
      if (stack[stack.length - 1] === id) return;
      stack.push(id);
      render();
    }
    function back() {
      stack.pop();
      render();
    }
    function reset() {
      stack = [];
      render();
    }
    function current() { return stack[stack.length - 1] || null; }
    function depth() { return stack.length; }
    return { show: show, back: back, reset: reset, current: current, depth: depth };
  }
  var api = { create: create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.ScreenNav = api; }
})(typeof window !== 'undefined' ? window : null);

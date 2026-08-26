(function (root) {
  'use strict';

  function create(targetEl) {
    let anchor = null;
    let direction = { x: 1, y: 0 }; // 기본값: 오른쪽

    function toLocal(e) {
      return { x: e.clientX, y: e.clientY };
    }

    function onDown(e) {
      anchor = toLocal(e);
      targetEl.setPointerCapture && e.pointerId != null && targetEl.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      if (!anchor) return;
      const p = toLocal(e);
      const dx = p.x - anchor.x;
      const dy = p.y - anchor.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { // 데드존 — 미세한 손떨림으로 방향이 튀는 것 방지
        direction = { x: dx / dist, y: dy / dist };
      }
    }

    function onUp() {
      anchor = null;
    }

    targetEl.addEventListener('pointerdown', onDown);
    targetEl.addEventListener('pointermove', onMove);
    targetEl.addEventListener('pointerup', onUp);
    targetEl.addEventListener('pointercancel', onUp);

    return { getDirection: () => direction };
  }

  const api = { create };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Input = api; }
})(typeof window !== 'undefined' ? window : null);

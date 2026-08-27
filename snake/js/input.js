(function (root) {
  'use strict';

  function create(targetEl) {
    let anchor = null;
    let direction = { x: 1, y: 0 }; // 기본값: 오른쪽

    function toLocal(e) {
      return { x: e.clientX, y: e.clientY };
    }

    function applyDirection(px, py, ox, oy) {
      const dx = px - ox;
      const dy = py - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { // 데드존 — 미세한 흔들림으로 방향이 튀는 것 방지
        direction = { x: dx / dist, y: dy / dist };
      }
    }

    function onDown(e) {
      anchor = toLocal(e);
      targetEl.setPointerCapture && e.pointerId != null && targetEl.setPointerCapture(e.pointerId);
    }

    function onMove(e) {
      // 마우스는 버튼을 누르고 있지 않아도 화면 중심 기준 커서 위치로 계속 조종한다(PC
      // 슬리더리오류 게임의 일반적인 관례) — 버튼을 눌러야만 반응하던 예전 방식은 터치
      // 전용 드래그를 그대로 마우스에 적용한 것이라 "마우스로 조작이 안 된다"는 문제가
      // 있었다. 터치/펜은 원래 스펙대로 누른 지점을 앵커로 하는 드래그를 그대로 쓴다
      // (터치는 화면에 손가락이 닿아있지 않으면 애초에 pointermove 자체가 오지 않는다).
      if (e.pointerType === 'mouse') {
        const rect = targetEl.getBoundingClientRect();
        const p = toLocal(e);
        applyDirection(p.x, p.y, rect.left + rect.width / 2, rect.top + rect.height / 2);
        return;
      }
      if (!anchor) return;
      const p = toLocal(e);
      applyDirection(p.x, p.y, anchor.x, anchor.y);
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

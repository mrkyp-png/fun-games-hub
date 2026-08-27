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
      const p = toLocal(e);
      if (anchor) {
        // 실제로 누른 채 드래그 중(터치/펜/마우스 클릭-드래그 전부 해당) — 누른 지점을
        // 앵커로 한 상대 방향, 원래 스펙대로.
        applyDirection(p.x, p.y, anchor.x, anchor.y);
        return;
      }
      // 버튼을 누르지 않은 상태의 움직임 — 화면 중심 기준 커서 위치로 계속 조종한다(PC
      // 슬리더리오류 게임의 일반적인 관례). 예전엔 `e.pointerType === 'mouse'`로 이 분기를
      // 탔는데, 실제 하드웨어 마우스에서도 이 값이 기대와 다르게 들어와 "마우스로 조작이
      // 안 된다" 문제가 재발했다 — pointerType을 신뢰하는 대신 "지금 누르고 있는지"(anchor
      // 존재 여부)만으로 분기하면 브라우저가 입력장치를 뭘로 분류하든 항상 동작한다(터치는
      // 손가락이 안 닿으면 애초에 pointermove 자체가 안 오므로 이 분기가 실행될 일이 없다).
      const rect = targetEl.getBoundingClientRect();
      applyDirection(p.x, p.y, rect.left + rect.width / 2, rect.top + rect.height / 2);
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

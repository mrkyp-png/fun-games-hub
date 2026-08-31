(function (root) {
  'use strict';

  // 하단 레인 버튼 (기획서 §4 v1.4). 각 버튼 = 격자 한 열. 열 인덱스만 콜백으로 내보낸다.
  // 게임 상태를 전혀 모른다.

  const KEY_COL = { '1': 0, '2': 1, '3': 2, '4': 3 };

  function create({ buttonBar, gridSize, onColumn }) {
    const buttons = [];

    for (let col = 0; col < gridSize; col++) {
      const b = document.createElement('button');
      b.className = 'lane-button';
      b.type = 'button';
      b.dataset.col = String(col);
      b.textContent = String(col + 1);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onColumn(col);
      });
      buttonBar.appendChild(b);
      buttons.push(b);
    }

    function onKey(e) {
      if (e.repeat) return;
      const col = KEY_COL[e.key];
      if (col !== undefined && col < gridSize) onColumn(col);
    }
    window.addEventListener('keydown', onKey);

    function setColumnHot(col, hot) {
      if (buttons[col]) buttons[col].classList.toggle('lane-button--hot', !!hot);
    }

    function clear() {
      window.removeEventListener('keydown', onKey);
      buttons.forEach((b) => b.remove());
      buttons.length = 0;
    }

    return { setColumnHot, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);

(function (root) {
  'use strict';

  // 구멍별 버튼 (기획서 §4 v1.5). 4x4 격자 = 16개 구멍과 1:1. 버튼을 누르면 그 구멍(영역)만 타격.
  // regionId (0..15, row*4 + col) 만 콜백으로 내보낸다. 게임 상태를 모른다.
  // 키보드: 격자 모양 그대로 1234 / qwer / asdf / zxcv.

  const KEY_GRID = ['1234', 'qwer', 'asdf', 'zxcv'];

  function create({ buttonBar, gridSize, onCell }) {
    const buttons = [];
    const keyMap = {};

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const id = row * gridSize + col;
        const b = document.createElement('button');
        b.className = 'lane-button';
        b.type = 'button';
        b.dataset.region = String(id);
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          onCell(id);
        });
        buttonBar.appendChild(b);
        buttons[id] = b;
        const krow = KEY_GRID[row];
        if (krow && krow[col]) keyMap[krow[col]] = id;
      }
    }

    function onKey(e) {
      if (e.repeat) return;
      const id = keyMap[e.key.toLowerCase()];
      if (id !== undefined) onCell(id);
    }
    window.addEventListener('keydown', onKey);

    function setCellHot(id, hot) {
      if (buttons[id]) buttons[id].classList.toggle('lane-button--hot', !!hot);
    }

    function clear() {
      window.removeEventListener('keydown', onKey);
      buttons.forEach((b) => b.remove());
      buttons.length = 0;
    }

    return { setCellHot, clear };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.LaneControls = api; }
})(typeof window !== 'undefined' ? window : null);

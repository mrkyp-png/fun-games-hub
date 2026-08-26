(function (root) {
  'use strict';

  function create(opts) {
    const { imgEl, gridEl } = opts;
    const regions = opts.regions || 10;

    // 격자 칸(cover-cell) regions개를 생성 — CSS grid-template이 5x2로 고정돼 있으므로
    // regions는 항상 10 (스펙 §26 기본값). 다른 값을 넣으면 CSS도 같이 손봐야 함.
    gridEl.innerHTML = '';
    const cells = [];
    for (let i = 0; i < regions; i++) {
      const cell = document.createElement('div');
      cell.className = 'cover-cell';
      gridEl.appendChild(cell);
      cells.push(cell);
    }

    function setEmoji(emojiId) {
      imgEl.src = 'assets/emoji/' + emojiId + '.svg';
      imgEl.alt = emojiId;
    }

    function revealUpTo(regionIndex) {
      const upTo = Math.max(0, Math.min(regions, regionIndex));
      cells.forEach((cell, i) => {
        cell.classList.toggle('revealed', i < upTo);
      });
    }

    function revealAll() {
      revealUpTo(regions);
    }

    function reset() {
      revealUpTo(0);
    }

    return { setEmoji, revealUpTo, revealAll, reset };
  }

  const api = { create };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.EmojiProgress = api; }
})(typeof window !== 'undefined' ? window : null);

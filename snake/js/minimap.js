(function (root) {
  'use strict';

  function render(ctx, opts) {
    const { mapWidth, mapHeight, player, foods } = opts;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(36, 28, 71, 0.9)';
    ctx.fillRect(0, 0, w, h);

    const sx = w / mapWidth;
    const sy = h / mapHeight;

    // 남은 먹이
    ctx.fillStyle = '#f2c879';
    foods.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x * sx, f.y * sy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 플레이어 (🟢)
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const api = { render };
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Minimap = api; }
})(typeof window !== 'undefined' ? window : null);

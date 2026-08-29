(function (root) {
  'use strict';

  // 기획서 §5: 두더지=🦫(기획서 제목 글리프), 다른 동물=🐹, 폭탄=💣 — 커스텀 아트 없이
  // 이모지 글리프 그대로 사용 (사용자 확정).
  const GLYPH = { mole: '🦫', animal: '🐹', bomb: '💣' };

  function create({ container, onHit }) {
    const elements = new Map(); // popId -> element

    function sync(activePops) {
      const activeIds = new Set(activePops.map((p) => p.id));

      elements.forEach((el, id) => {
        if (!activeIds.has(id)) {
          el.remove();
          elements.delete(id);
        }
      });

      activePops.forEach((pop) => {
        if (elements.has(pop.id)) return;
        const el = document.createElement('div');
        el.className = 'mole-pop mole-pop--' + pop.type;
        el.style.left = (pop.x * 100) + '%';
        el.style.top = (pop.y * 100) + '%';
        el.innerHTML = '<span class="mole-pop-hole"></span><span class="mole-pop-glyph">' + GLYPH[pop.type] + '</span>';
        el.addEventListener('pointerdown', () => onHit(pop.id, pop.x, pop.y), { once: true });
        container.appendChild(el);
        elements.set(pop.id, el);
      });
    }

    function clear() {
      elements.forEach((el) => el.remove());
      elements.clear();
    }

    return { sync, clear };
  }

  const api = { create, GLYPH };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.PopElements = api; }
})(typeof window !== 'undefined' ? window : null);

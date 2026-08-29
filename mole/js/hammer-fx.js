(function (root) {
  'use strict';

  // 기획서 §5 뿅망치 연출: 터치 지점에 순간적으로 나타났다 위→아래로 내려치고 사라진다.
  // glyph를 바꿔서 재사용하면 §8 폭탄의 "폭발 연출"(💥)도 같은 함수로 표현 가능.
  function trigger(container, x, y, glyph) {
    const el = document.createElement('div');
    el.className = 'hammer-fx';
    el.textContent = glyph || '🔨';
    el.style.left = (x * 100) + '%';
    el.style.top = (y * 100) + '%';
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  const api = { trigger };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.HammerFx = api; }
})(typeof window !== 'undefined' ? window : null);

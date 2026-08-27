(function (root) {
  'use strict';

  // 지렁이 캐릭터 스프라이트 미리 로드 — 매 프레임 new Image()를 만들지 않도록 한 번만 생성.
  // assets/worm/*.png 6장은 사용자가 제공한 캐릭터 시트(바탕화면 지렁이.png)에서 머리/몸통/
  // 꼬리를 잘라낸 것. 적 버전은 색조만 다르게 돌린 동일 아트(hue-rotate).
  function loadImg(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  const sprites = {
    player: {
      head: loadImg('assets/worm/head.png'),
      body: loadImg('assets/worm/body.png'),
      tail: loadImg('assets/worm/tail.png')
    },
    enemy: {
      head: loadImg('assets/worm/head-enemy.png'),
      body: loadImg('assets/worm/body-enemy.png'),
      tail: loadImg('assets/worm/tail-enemy.png')
    }
  };

  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Sprites = sprites; }
})(typeof window !== 'undefined' ? window : null);

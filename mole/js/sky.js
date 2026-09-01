// 밤하늘에 흐르는 구름 — #mole-sky 에 랜덤 구름 여러 개를 만든다 (장식용, 게임 상태 무관).
// 크기·높이·속도·위상·좌우반전 전부 랜덤. 아주 느리게 왼→오로 지나간다.
(function () {
  'use strict';

  var sky = document.getElementById('mole-sky');
  if (!sky) return;

  var COUNT = 7;
  var ASPECT = { 1: '122 / 64', 2: '138 / 62' };

  for (var i = 0; i < COUNT; i++) {
    var img = 1 + Math.floor(Math.random() * 2);
    var c = document.createElement('span');
    c.className = 'mole-cloud';
    c.style.backgroundImage = "url('assets/cloud" + img + ".png')";
    c.style.aspectRatio = ASPECT[img];
    c.style.width = (6 + Math.random() * 13).toFixed(1) + '%';   // 6% ~ 19% — 작게, 제각각
    c.style.top = (1 + Math.random() * 66).toFixed(0) + '%';      // 하늘 영역 안 랜덤 높이
    c.style.opacity = (0.38 + Math.random() * 0.42).toFixed(2);
    if (Math.random() < 0.5) c.style.transform = 'scaleX(-1)';

    var dur = 110 + Math.random() * 120;                          // 110 ~ 230초 — 아주 느리게
    var delay = -(Math.random() * dur);                           // 위상 랜덤 (이미 지나가는 중)
    c.style.animation = 'mole-cloud-drift ' + dur.toFixed(0) + 's linear ' + delay.toFixed(0) + 's infinite';

    sky.appendChild(c);
  }
})();

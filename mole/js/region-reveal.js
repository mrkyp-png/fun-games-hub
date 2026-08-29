(function (root) {
  'use strict';

  // maskSize 해상도의 커버 캔버스를 이모지 이미지 위에 얹고, 영역이 완성되면 그 영역의
  // 픽셀만 destination-out으로 투명하게 뚫어서 아래 실제 이모지가 드러나게 한다.
  // (SVG clipPath 폴리곤 근사보다 단순하고, k-means가 만든 픽셀 단위 영역과 정확히 일치.)
  function create({ canvas, width, height }) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    function reset(coverColor) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = coverColor || 'rgba(20, 20, 40, 0.92)';
      ctx.fillRect(0, 0, width, height);
    }

    function revealRegion(region) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      region.points.forEach((p) => ctx.fillRect(p.x, p.y, 1, 1));
      ctx.restore();
    }

    function revealAll(regions) {
      regions.forEach(revealRegion);
    }

    return { reset, revealRegion, revealAll };
  }

  const api = { create };
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.RegionReveal = api; }
})(typeof window !== 'undefined' ? window : null);

(function (root) {
  'use strict';

  const DEFAULT_ALPHA_THRESHOLD = 32;

  // 순수 함수: RGBA 픽셀 버퍼에서 불투명 픽셀 좌표만 뽑는다. 브라우저의 ImageData와
  // 동일한 { data, width, height } 형태를 받으므로 Node에서도 fake 객체로 테스트 가능.
  function extractPoints(imageData, alphaThreshold) {
    const threshold = alphaThreshold === undefined ? DEFAULT_ALPHA_THRESHOLD : alphaThreshold;
    const { data, width, height } = imageData;
    const points = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha >= threshold) points.push({ x, y });
      }
    }
    return points;
  }

  // 브라우저 전용: SVG를 오프스크린 캔버스에 그려 alpha mask를 뽑는다.
  function loadMask(svgUrl, maskSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maskSize;
        canvas.height = maskSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, maskSize, maskSize);
        const imageData = ctx.getImageData(0, 0, maskSize, maskSize);
        resolve({ width: maskSize, height: maskSize, points: extractPoints(imageData) });
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  }

  const api = { extractPoints, loadMask, DEFAULT_ALPHA_THRESHOLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.MoleGame = root.MoleGame || {}; root.MoleGame.EmojiMask = api; }
})(typeof window !== 'undefined' ? window : null);

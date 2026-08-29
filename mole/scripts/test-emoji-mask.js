const assert = require('assert');
const { extractPoints } = require('../js/emoji-mask.js');

function makeImageData(width, height, fillPredicate) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i + 3] = fillPredicate(x, y) ? 255 : 0;
    }
  }
  return { data, width, height };
}

// 1) 알파값이 임계치 이상인 픽셀만 추출된다
{
  const imageData = makeImageData(4, 4, (x) => x < 2); // 왼쪽 절반만 불투명
  const points = extractPoints(imageData);
  assert.strictEqual(points.length, 8, '4x4 중 왼쪽 절반(2x4=8픽셀)만 추출돼야 함');
  points.forEach((p) => assert.ok(p.x < 2, '추출된 점은 모두 왼쪽 절반에 있어야 함'));
}

// 2) 완전히 투명하면 빈 배열
{
  const imageData = makeImageData(3, 3, () => false);
  assert.deepStrictEqual(extractPoints(imageData), []);
}

// 3) 커스텀 임계값 적용
{
  const data = new Uint8ClampedArray(4);
  data[3] = 50; // alpha 50인 픽셀 1개
  const imageData = { data, width: 1, height: 1 };
  assert.strictEqual(extractPoints(imageData, 32).length, 1, '임계값(32)보다 높으면 포함');
  assert.strictEqual(extractPoints(imageData, 60).length, 0, '임계값(60)보다 낮으면 제외');
}

console.log('test-emoji-mask.js: all assertions passed');

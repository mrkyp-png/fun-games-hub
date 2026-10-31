const assert = require('assert');
const S = require('../js/mole-sprites.js');

// V1541 C: 빼꼼·머리 단계 폐지 — 상승 6포즈 + 맞은 표정

// 1) 상승 그림: poseIndex 0~5 → mole2-rise1~6
{
  assert.strictEqual(S.riseFile(0), 'mole2-rise1');
  assert.strictEqual(S.riseFile(5), 'mole2-rise6');
}

// 2) 맞은 표정: 1타 = 고른 표정, 2타 = 눈물(1타가 눈물이면 O입), 3타 = 골뱅이, 4타 = 기절
{
  assert.strictEqual(S.hitFile(0, 1), null);
  assert.strictEqual(S.hitFile(1, 1), 'mole2-hit1');
  assert.strictEqual(S.hitFile(1, 3), 'mole2-hit3');
  assert.strictEqual(S.hitFile(2, 1), 'mole2-hit2');
  assert.strictEqual(S.hitFile(2, 2), 'mole2-hit3', '1타 눈물이면 2타는 O입');
  assert.strictEqual(S.hitFile(3, 1), 'mole2-hit4');
  assert.strictEqual(S.hitFile(4, 1), 'mole2-hit5');
}

// 5) 스프라이트 URL 규칙
{
  assert.strictEqual(S.spriteUrl('mole3'), 'assets/moles/mole3.png');
  assert.strictEqual(S.spriteUrl('hole'), 'assets/moles/hole.png');
}

// 6) 포즈 개수 (V1541 C 상승 6종)
{
  assert.strictEqual(S.POSE_COUNT, 6);
}

// 7) sink 보간: 깊이 0 = 안 내려감, 깊이 4 = 클립 밖(>100%), 중간값은 단조 증가
{
  assert.strictEqual(S.sinkForDepth(0), 0);
  assert.ok(S.sinkForDepth(4) > 100, 'depth 4 sinks fully out of the clip box');
  assert.ok(S.sinkForDepth(1) < S.sinkForDepth(2) && S.sinkForDepth(2) < S.sinkForDepth(3), 'monotonic');
  assert.ok(S.sinkForDepth(0.5) > 0 && S.sinkForDepth(0.5) < S.sinkForDepth(1), 'interpolates between integer depths');
}

// 8) 방해물 동물: animal = 일반 얼굴, bomb = 고글(-x) 버전
{
  assert.strictEqual(S.OBSTACLE_COUNT, 24); // 동물 4 × 포즈 6 (강아지 제외 v1021)
  assert.strictEqual(S.obstacleFile('animal', 0), 'rabbit1');
  assert.strictEqual(S.obstacleFile('bomb', 0), 'rabbit1'); // 새 동물 폭탄 = 같은 그림 + 이모지
  assert.strictEqual(S.obstacleFile('animal', 4), 'rabbit2');
  assert.strictEqual(S.obstacleFile('bomb', 3), 'lion1');
  assert.strictEqual(S.obstacleFile('animal', 5), 'tiger2', '동물 다음 줄 = 다음 포즈');
  assert.strictEqual(S.animalFileForDepth('tiger3', 1), 'tiger-head3');
  assert.strictEqual(S.animalFileForDepth('tiger3', 2), 'tiger-peek3');
}

// 9) HEAD_ANCHOR: 11개 포즈, 각 값이 정상 범위 (스프라이트는 콘텐츠 바닥정렬 = 얼굴이 캔버스 아래쪽)
{
  const A = S.HEAD_ANCHOR;
  const keys = ['mole1', 'mole2', 'mole3', 'mole4', 'mole5', 'mole6', 'mole7', 'mole8', 'peek1', 'peek2', 'helmet'];
  keys.forEach((k) => {
    assert.ok(A[k], k + ' 앵커 존재');
    assert.ok(A[k].cx > 0.3 && A[k].cx < 0.75, k + ' cx 범위 (' + A[k].cx + ')');
    assert.ok(A[k].cy > 0.55 && A[k].cy < 0.95, k + ' cy 범위 (' + A[k].cy + ')');
    assert.ok(A[k].r > 0.08 && A[k].r < 0.3, k + ' r 범위 (' + A[k].r + ')');
  });
  assert.deepStrictEqual(S.headAnchor('mole3'), A.mole3);
  assert.deepStrictEqual(S.headAnchor('nonesuch'), A.mole1, '미지 파일 → mole1 폴백');
}

console.log('test-mole-sprites.js: all assertions passed');

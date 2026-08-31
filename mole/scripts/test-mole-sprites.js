const assert = require('assert');
const S = require('../js/mole-sprites.js');

// 깊이 사다리: 0 전신 → 1 빠끔(눈) → 2 빠끔(코) → 3 모자 → (4 사라짐)

// 1) 단타 두더지는 항상 깊이 0(전신)에서 대기
{
  assert.strictEqual(S.restingDepth(1, 0), 0);
}

// 2) 2히트 두더지: 등장은 전신, 한 대 맞으면 빠끔(코) 깊이에서 멈춤
{
  assert.strictEqual(S.restingDepth(2, 0), 0);
  assert.strictEqual(S.restingDepth(2, 1), 2);
}

// 3) 3히트 두더지: 전신 → 빠끔(눈) → 빠끔(코) 로 한 칸씩
{
  assert.strictEqual(S.restingDepth(3, 0), 0);
  assert.strictEqual(S.restingDepth(3, 1), 1);
  assert.strictEqual(S.restingDepth(3, 2), 2);
}

// 4) 깊이 → 스프라이트 파일
{
  assert.strictEqual(S.fileForDepth(0, 0), 'mole1', 'poseIndex 0 → mole1');
  assert.strictEqual(S.fileForDepth(0, 7), 'mole8', 'poseIndex 7 → mole8');
  assert.strictEqual(S.fileForDepth(1, 3), 'peek1');
  assert.strictEqual(S.fileForDepth(2, 3), 'peek2');
  assert.strictEqual(S.fileForDepth(3, 3), 'helmet');
  assert.strictEqual(S.fileForDepth(4, 3), null, '깊이 4 이상은 사라진 상태(그림 없음)');
}

// 5) 스프라이트 URL 규칙
{
  assert.strictEqual(S.spriteUrl('mole3'), 'assets/moles/mole3.png');
  assert.strictEqual(S.spriteUrl('hole'), 'assets/moles/hole.png');
}

// 6) 포즈 개수 (파란 모자·팔벌린 포즈 제외 → 8종)
{
  assert.strictEqual(S.POSE_COUNT, 8);
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
  assert.strictEqual(S.OBSTACLE_COUNT, 5);
  assert.strictEqual(S.obstacleFile('animal', 0), 'rabbit');
  assert.strictEqual(S.obstacleFile('bomb', 0), 'rabbit-x');
  assert.strictEqual(S.obstacleFile('animal', 4), 'dog');
  assert.strictEqual(S.obstacleFile('bomb', 4), 'dog-x');
  assert.strictEqual(S.obstacleFile('animal', 5), 'rabbit', 'index wraps by OBSTACLE_COUNT');
}

console.log('test-mole-sprites.js: all assertions passed');

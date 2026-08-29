const assert = require('assert');
const { mulberry32, hashSeed } = require('../js/rng.js');

// 1) 같은 시드 → 같은 수열
{
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepStrictEqual(seqA, seqB, 'same seed must produce the same sequence');
}

// 2) 값은 항상 0 이상 1 미만
{
  const r = mulberry32(1);
  for (let i = 0; i < 100; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, 'mulberry32 output must be in [0, 1)');
  }
}

// 3) 문자열 시드는 항상 같은 정수로 해시된다
{
  assert.strictEqual(hashSeed('mole-level-1'), hashSeed('mole-level-1'));
  assert.notStrictEqual(hashSeed('mole-level-1'), hashSeed('mole-level-2'));
}

console.log('test-rng.js: all assertions passed');

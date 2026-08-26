const assert = require('assert');
const { computeStars } = require('../js/star-rating.js');

assert.strictEqual(computeStars(0), 3, '충돌 0회는 별 3개');
assert.strictEqual(computeStars(1), 2, '충돌 1회는 별 2개');
assert.strictEqual(computeStars(2), 1, '충돌 2회는 별 1개');
assert.strictEqual(computeStars(7), 1, '충돌이 몇 번이든 2회 초과면 별 1개');

console.log('test-star-rating.js: all assertions passed');

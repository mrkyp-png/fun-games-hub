const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('mole/js/game.js', 'utf8');
const match = source.match(/onUpgrade: \(kind, id\) => \{([\s\S]*?)\n      \},/);
assert(match, 'Actual inventory upgrade callback exists');
let current = 'inventory-screen', previousHidden = false;
const classes = new Set(['asset-preparing', 'asset-failed', 'asset-pop', 'is-out']);
const calls = [];
const context = {
  state: {ended: true},
  MG: {Workshop: {canEnhance: () => true}},
  workshop: {show: (kind, id) => {
    assert.equal(current, 'inventory-screen', 'Prepare content before changing visible screens');
    calls.push(['prepare', kind, id]);
  }},
  document: {getElementById: id => {
    assert.equal(id, 'workshop-screen');
    return {classList: {remove: (...names) => names.forEach(name => classes.delete(name))}};
  }},
  screenNav: {
    current: () => current,
    show: id => { current = id; previousHidden = true; calls.push(['show', id]); }
  },
  revealOrBands: () => { throw new Error('Direct entry must not hide the workshop for an animated reveal'); }
};
const enter = vm.runInNewContext('(kind, id) => {' + match[1] + '\n}', context);
enter('weapon', 'cannon');
assert.equal(current, 'workshop-screen');
assert(previousHidden, 'Previous screen hidden synchronously');
assert.equal(classes.size, 0, 'No lingering preparation or entry animation classes');
assert.deepEqual(calls, [['prepare', 'weapon', 'cannon'], ['show', 'workshop-screen']]);
const count = calls.length;
enter('weapon', 'cannon');
assert.equal(calls.length, count, 'Double tap cannot push another workshop screen');
current = 'inventory-screen';
context.state.ended = false;
enter('weapon', 'cannon');
assert.equal(calls.length, count, 'Gameplay guard retained');
console.log('PASS: actual upgrade callback enters synchronously, prepares selected item first, skips reveal, retains guards');

const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('mole/js/home3d-ui.js', 'utf8');
const method = source.match(/setFeature\(on, label, feature\) \{([\s\S]*?)\n      \},/);
assert(method);
const wrap = {appendChild(node) { node.parentNode = this; }};
const close = {parentNode: wrap, hidden: true, remove() { this.parentNode = null; }};
const context = {wrap, close, hud:{}, stick:{}, jumpBtn:{}, mailBtn:{}, inventoryBtn:{}, dots:{mail:{}}};
const setFeature = vm.runInNewContext('(on,label,feature)=>{' + method[1] + '\n}', context);
for (const feature of ['score','daily','quest','inventory','shop','rhythm']) {
  setFeature(true, '닫기', feature);
  assert.equal(close.parentNode, null, feature + ': no background close box in DOM');
  assert.equal(close.hidden, true);
  setFeature(false);
  assert.equal(close.parentNode, wrap);
  assert.equal(close.hidden, true);
}
setFeature(true, '닫기', 'settings');
assert.equal(close.parentNode, wrap);
assert.equal(close.hidden, false, 'Existing settings close preserved');
assert(fs.readFileSync('mole/js/home3d.js','utf8').includes("'닫기' : 'Close', action)"), 'Pass actual feature to UI');
console.log('PASS: actual feature UI removes background close box for score/daily/quest/inventory/shop');

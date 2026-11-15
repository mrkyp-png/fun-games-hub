// 병 부품의 자리·크기 확인
const fs = require('fs');
const f = process.argv[2], b = fs.readFileSync(f), jl = b.readUInt32LE(12), g = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
const parentOf = {}; g.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parentOf[c] = i; }));
g.nodes.forEach((n, i) => {
  if (!/Bottle|bottle|label|lettering|FrontHeld|Open|Dark/.test(n.name || '')) return;
  const m = n.mesh != null ? g.meshes[n.mesh] : null, pos = m && g.accessors[m.primitives[0].attributes.POSITION];
  console.log(i, n.name, 'parent', parentOf[i], g.nodes[parentOf[i]] && g.nodes[parentOf[i]].name, 'T', JSON.stringify(n.translation), 'R', JSON.stringify(n.rotation), 'S', JSON.stringify(n.scale), pos ? 'min ' + pos.min.map((v) => v.toFixed(3)) + ' max ' + pos.max.map((v) => v.toFixed(3)) + ' attrs ' + Object.keys(m.primitives[0].attributes) : '');
});
const an = g.animations.map((a) => a.name + ':' + a.channels.length + 'ch, t<=' + Math.max(...a.samplers.map((s) => g.accessors[s.input].max[0])).toFixed(2));
console.log('animations', an.join(' | '));
const bh = g.animations.find((a) => a.name === 'Behavior');
console.log('behavior targets', [...new Set(bh.channels.map((c) => g.nodes[c.target.node].name + '.' + c.target.path))].filter((s) => /Bottle|FrontHeld/.test(s)).join(', '));

// GLB 재질 색 비교: node glb-mats.cjs a.glb [b.glb]
const fs = require('fs');
function json(f) { const b = fs.readFileSync(f), len = b.readUInt32LE(12); return JSON.parse(b.slice(20, 20 + len).toString('utf8')); }
for (const f of process.argv.slice(2)) {
  const g = json(f); console.log('==', f.split(/[\\/]/).pop());
  g.materials.forEach((m, i) => console.log(i, m.name, JSON.stringify(m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorFactor), m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture ? 'TEX' : ''));
  console.log('eye nodes', g.nodes.map((n, i) => /Eye|eye|pupil|Cheek|Blush/.test(n.name || '') ? i + ':' + n.name + (n.mesh != null ? '(mesh)' : '') : null).filter(Boolean).join(', '));
}

// V1790 C 사용자: 상점 간판 글자 아래 선 노이즈 제거 — 문 위 벽 한 칸(plaza.blend 'Shop closed shell' 면 732)이
// 주변 벽보다 .008 튀어나와 윗가장자리 가는 조각들이 선처럼 보임 → plaza.glb 에서 그 점들만 벽 깊이로 되돌림.
// 사용: node flatten-shop-lintel-v1790.cjs <plaza.glb> [--write]
const fs = require('fs');
const file = process.argv[2], write = process.argv.includes('--write');
const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl)), binStart = 20 + jl + 8;
// 간판(Sign_shop) 면 = 블렌더 기준 중심 (-6.255, 4.468, 3.808), 바깥 방향 (.814, -.581, 0) → glTF 좌표 (x, z, -y)
const C = [-6.255, 3.808, -4.468], N = [0.814, 0, 0.581];
const off = (p) => (p[0] - C[0]) * N[0] + (p[1] - C[1]) * N[1] + (p[2] - C[2]) * N[2];
let hits = 0;
for (const [ni, node] of j.nodes.entries()) {
  if (node.mesh === undefined || node.name !== 'Home clay batch') continue;
  if (node.translation || node.rotation || node.scale || node.matrix) throw Error('노드 변환 있음 — 좌표 다시 계산 필요');
  for (const prim of j.meshes[node.mesh].primitives) {
    const a = j.accessors[prim.attributes.POSITION], bv = j.bufferViews[a.bufferView];
    const base = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || 12;
    for (let i = 0; i < a.count; i++) {
      const o = base + i * stride, p = [b.readFloatLE(o), b.readFloatLE(o + 4), b.readFloatLE(o + 8)];
      const d = off(p), side = Math.abs((p[0] - C[0]) * -N[2] + (p[2] - C[2]) * N[0]);
      // 튀어나온 칸: 깊이 -.028(벽 -.036), 높이 2.4~3.6, 간판 가운데에서 옆으로 1m 안
      if (Math.abs(d + 0.028) < 0.0012 && p[1] > 2.4 && p[1] < 3.6 && side < 1.0) {
        hits++;
        if (write) { const k = -0.036 - d; b.writeFloatLE(p[0] + N[0] * k, o); b.writeFloatLE(p[1] + N[1] * k, o + 4); b.writeFloatLE(p[2] + N[2] * k, o + 8); }
      }
    }
  }
}
console.log('옮길 점', hits, write ? '→ 저장' : '(확인만)');
if (write) fs.writeFileSync(file, b);

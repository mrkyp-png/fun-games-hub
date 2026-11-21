# V1784 C 사용자: 북쪽 얼음섬 — 왼쪽 큰 산이 원형판(반지름 3.75) 침범 → 바깥으로·작게, 가장자리 산 밑동이 떠 보임 → 밑동 둘레 가장 낮은 땅보다 아래로.
# 게임 파일 island_north.glb 를 직접 고침(build-four-islands.py 는 화산 원본 파일이 없어 재실행 불가).
import bpy, bmesh, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in sc.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
CX, CY = 0.0, 48.0   # 섬 중심(블렌더 좌표)
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
# 떨어진 조각 나누기
seen = set(); comps = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; comp = []; seen.add(v.index)
    while st:
        a = st.pop(); comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen: seen.add(b.index); st.append(b)
    comps.append(comp)
terrain = max(comps, key=len)
print('COMPS', len(comps), 'terrain verts', len(terrain))
for c in comps:
    zt = max(v.co.z for v in c) - min(v.co.z for v in c)
    if zt > 2: print('TALL', len(c), round(sum(v.co.x for v in c) / len(c) - CX, 2), round(sum(v.co.y for v in c) / len(c) - CY, 2), round(zt, 2), round(min(v.co.z for v in c), 2))
PEAKS = [(-5.2, 2.2, 6.5, 2.4), (3.0, -5.0, 4.6, 1.8), (-4.4, -4.2, 3.8, 1.6), (.4, 6.0, 3.2, 1.3)]
NEW = {0: (-5.53, 2.34, 2.1 / 2.4)}   # 왼쪽 큰 산: 새 자리, 크기 비율
# 땅 높이: 지형 조각만 남긴 임시 물체로 광선
tmp = bpy.data.meshes.new('t'); tb = bmesh.new(); vm = {}
for v in terrain: vm[v.index] = tb.verts.new(v.co)
tset = set(v.index for v in terrain)
for f in bm.faces:
    if all(v.index in tset for v in f.verts): tb.faces.new([vm[v.index] for v in f.verts])
tb.to_mesh(tmp); tb.free(); tobj = bpy.data.objects.new('t', tmp); sc.collection.objects.link(tobj)
def gz(x, y):
    hit, loc, n, i = tobj.ray_cast(Vector((CX + x, CY + y, 50)), Vector((0, 0, -1)))
    return loc.z if hit else -1
for k, (px, py, h, r) in enumerate(PEAKS):
    # 그 봉우리 = 꼭짓점 7개 안팎, 바닥 중심이 (px,py) 근처인 조각
    # 봉우리 면들은 따로따로 저장됨 → 꼭대기가 그 자리 근처인 세모 면 + 그 둘레 안의 바닥 면을 모음
    tall = [c for c in comps if c is not terrain and len(c) <= 8 and max(v.co.z for v in c) - min(v.co.z for v in c) > h * .8 and math.hypot(sum(v.co.x for v in c) / len(c) - CX - px, sum(v.co.y for v in c) / len(c) - CY - py) < r * 1.2]
    if not tall: print('PEAK NOT FOUND', k); continue
    apex = max((v for c in tall for v in c), key=lambda v: v.co.z).co
    ax, ay = apex.x - CX, apex.y - CY; zlo = min(v.co.z for c in tall for v in c)
    flat = [c for c in comps if c is not terrain and len(c) <= 8 and c not in tall and all(math.hypot(v.co.x - CX - ax, v.co.y - CY - ay) < r * 1.25 and abs(v.co.z - zlo) < .4 for v in c)]
    c = [v for cc in tall + flat for v in cc]; zmin = min(v.co.z for v in c)
    print('PEAK', k, 'faces', len(tall), '+ base', len(flat))
    base = [v for v in c if v.co.z < zmin + .5]
    bx = sum(v.co.x for v in base) / len(base); by = sum(v.co.y for v in base) / len(base)
    nx, ny, s = NEW.get(k, (bx - CX, by - CY, 1.0))
    rr = r * s
    z0 = gz(nx, ny); zb = min([z0] + [gz(nx + rr * math.cos(a * math.pi / 6), ny + rr * math.sin(a * math.pi / 6)) for a in range(12)])
    target = min(z0 - .3, zb - .15)
    dz = target - zmin
    for v in c:
        rel = v.co - Vector((bx, by, zmin))
        v.co = Vector((CX + nx, CY + ny, target)) + rel * s
    print('PEAK', k, 'from', round(bx - CX, 2), round(by - CY, 2), 'to', round(nx, 2), round(ny, 2), 'scale', round(s, 3), 'drop', round(dz, 3))
bm.to_mesh(me); bm.free(); me.update()
bpy.data.objects.remove(tobj)
# 다시 원래 자리(섬 물체 원점) 기준으로 내보내기: 원본처럼 위치를 물체에 두고 정점은 상대좌표
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True)
print('FIX_DONE')

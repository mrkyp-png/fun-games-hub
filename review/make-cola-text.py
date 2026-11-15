# V1725 C: 병에 바로 쓰는 글자(라벨 없음) — 한국어 '콜라' / 영어 'COLA'. 병 곡면(반지름 R)에 휘어 붙인 메시를 glTF 좌표(병 묶음 노드 기준)로 JSON 저장
# 병 축 = +Y(입구 쪽), 앞면 = +Z, 글자 위 = +Y, 읽는 방향 = +X
import bpy, bmesh, json, math, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cola-text.json')
FONT = r'C:\Windows\Fonts\malgunbd.ttf'
R = 0.302            # 유리(0.28 × 1.05 = 0.294) 바로 바깥
Y_CENTER = -0.70     # 몸통 가운데 쯤
MAX_W, MAX_H = 0.60, 0.25   # 글자 줄 길이(병 길이 방향)·글자 높이(둘레 방향) 최대
# 글자 줄은 병 길이 방향(입구 → 바닥 = 왼쪽 → 오른쪽)으로 씀: 두더지가 병을 옆으로 들 때 가로로 읽힘(둘레로 쓰면 세로로 서 버림)
DEPTH = 0.012
bpy.ops.wm.read_factory_settings(use_empty=True)
font = bpy.data.fonts.load(FONT)
res = {}
for key, body in [('ko', '콜라'), ('en', 'COLA')]:
    cu = bpy.data.curves.new(key, 'FONT'); cu.body = body; cu.font = font; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = 0.5; cu.resolution_u = 3
    ob = bpy.data.objects.new(key, cu); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target='MESH'); ob = bpy.context.view_layer.objects.active
    me = ob.data; bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    k = min(MAX_W / (max(xs) - min(xs)), MAX_H / (max(ys) - min(ys)))
    zmin, zmax = min(zs), max(zs)
    for v in me.vertices:
        u = (v.co.x - cx) * k; h = (v.co.y - cy) * k; w = (v.co.z - zmin) / max(1e-6, zmax - zmin) * DEPTH
        th = h / R; r = R + w   # 글자 위쪽 = +X 둘레 방향, 줄 방향 = -Y(입구에서 바닥 쪽)
        v.co = (r * math.sin(th), Y_CENTER - u, r * math.cos(th))
    me.update(); me.calc_loop_triangles()
    # 면마다 따로(각진 글자) — 꼭짓점을 삼각형마다 복제해 면 법선 사용
    pos, nor, idx = [], [], []
    for t in me.loop_triangles:
        n = t.normal
        for vi in t.vertices:
            p = me.vertices[vi].co; idx.append(len(pos) // 3); pos += [p.x, p.y, p.z]; nor += [n.x, n.y, n.z]
    res[key] = {'pos': pos, 'nor': nor, 'idx': idx}
    print('TEXT', key, len(idx) // 3, 'tris', 'scale', round(k, 4))
json.dump(res, open(OUT, 'w'))
print('SAVED', OUT)

# V1785 C 사용자: 크라켄이 던진 배가 터지면 조각나서 흩어짐 — 배 모델을 앞뒤 3 x 위아래 2 = 6조각으로 잘라 piece0..5 로 내보냄(그림·재질 유지)
import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
V = mathutils.Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ship = bpy.context.object
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(sc.objects):
    if o is not ship: bpy.data.objects.remove(o, do_unlink=True)
pts = [v.co for v in ship.data.vertices]
lo = V((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = V((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
# 사용자: 6조각은 실감 안 남 → 앞뒤 6 x 위아래 3 x 좌우 2 = 36조각(조금씩 비뚤게 잘라 깨진 느낌)
import random; random.seed(7)
NX, NZ, NY = 6, 3, 2
def edges(a, b, n): return [a + (b - a) * (k / n + random.uniform(-.04, .04)) for k in range(1, n)]
xs, zs, ys = edges(lo.x, hi.x, NX), edges(lo.z, hi.z, NZ), edges(lo.y, hi.y, NY)
def cut(o, co, no, keep_pos):
    bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=co, plane_no=no, clear_inner=keep_pos, clear_outer=not keep_pos, use_fill=True)
    bpy.ops.object.mode_set(mode='OBJECT')
PLANES = {}   # 같은 자리를 자르는 면은 이웃 조각과 똑같이(맞물리게)
def plane(axis, k, val):
    key = (axis, k)
    if key not in PLANES:
        no = V((1, 0, 0)) if axis == 0 else V((0, 1, 0)) if axis == 1 else V((0, 0, 1))
        tilt = V((random.uniform(-.15, .15), random.uniform(-.15, .15), random.uniform(-.15, .15))); tilt[axis] = 0
        PLANES[key] = (no * val, (no + tilt).normalized())
    return PLANES[key]
def slab(o, cuts, i, axis):
    if i > 0: co, no = plane(axis, i - 1, cuts[i - 1]); cut(o, co, no, True)
    if i < len(cuts): co, no = plane(axis, i, cuts[i]); cut(o, co, no, False)
# 사용자: 칼로 싹둑 자른 것처럼 말고 → 잘린 면을 잘게 나눈 뒤 위치 기반 잡음으로 울퉁불퉁하게(이웃 조각과 같은 잡음 = 딱 맞물림)
import bmesh
from mathutils import noise
SIZE = max(hi - lo); AMP, FREQ = SIZE * .045, 7.0 / SIZE
def jag(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    on = lambda p: any(abs((p - co).dot(no)) < SIZE * 1e-4 for co, no in PLANES.values())
    caps = [f for f in bm.faces if all(on(v.co) for v in f.verts)]
    if caps:
        bmesh.ops.triangulate(bm, faces=caps)
        caps = [f for f in bm.faces if all(on(v.co) for v in f.verts)]
        edges = list({e for f in caps for e in f.edges})
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=3, use_grid_fill=True)
    for v in bm.verts:
        if on(v.co): v.co += noise.noise_vector(v.co * FREQ) * AMP + noise.noise_vector(v.co * FREQ * 3.1) * AMP * .35
    bm.normal_update(); bm.to_mesh(o.data); bm.free()
pieces = []
for i in range(NX):
    for j in range(NZ):
        for k in range(NY):
            o = ship.copy(); o.data = ship.data.copy(); sc.collection.objects.link(o)
            slab(o, xs, i, 0); slab(o, zs, j, 2); slab(o, ys, k, 1)
            if len(o.data.vertices) < 3: bpy.data.objects.remove(o, do_unlink=True); continue
            jag(o)
            o.name = 'piece%d' % len(pieces); pieces.append(o)
bpy.data.objects.remove(ship, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in pieces: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='WEBP')
print('PIECES', out, len(pieces), [len(o.data.vertices) for o in pieces])

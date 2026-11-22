# V1792 C 사용자: 크라켄이 배를 틈 없이 완전히 감쌈(방법 B) — '배 몸통을 두 바퀴 감는 나선형 다리 끝' 모델.
# 단위 모델: 축 = x(-.5~.5), 나선 중심선 반지름 1, 2.2바퀴, 굵기는 끝으로 갈수록 가늘게. 바깥 kr_red, 배에 닿는 안쪽 kr_in, 안쪽 빨판 kr_suck
# (재질은 kraken-rig.glb 에서 그대로 가져와 다리와 같은 색). 게임에서 배마다 [길이, 높이 반, 폭 반]으로 늘려 씀.
# 사용: blender -b --python build-kraken-coil-v1792.py -- <kraken-rig.glb> <out coil.glb> [<미리보기 배.glb> <미리보기 png 접두사>]
import bpy, bmesh, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
kr, out = argv[0], argv[1]
prev_ship = argv[2] if len(argv) > 2 else None
prev_out = argv[3] if len(argv) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=kr)
mats = {m.name: m for m in bpy.data.materials if m.name in ('kr_red', 'kr_in', 'kr_suck')}
for o in list(bpy.context.scene.objects): bpy.data.objects.remove(o, do_unlink=True)

TURNS, NS, NR, R0 = 2.2, 160, 18, 0.30   # 바퀴, 길이 마디, 둘레 마디, 굵기(중심선 반지름 1 기준)
def center(s):
    a = 2 * math.pi * TURNS * s
    return Vector(((s - 0.5), math.cos(a), math.sin(a)))  # 블렌더 좌표: x=배 길이, y·z=단면
def radius(s): return R0 * (1.0 - 0.55 * s ** 1.4) * min(1.0, 0.35 + s * 8)  # 시작은 다리 굵기로 이어지고 끝은 가늘게

bm = bmesh.new()
rings = []
for i in range(NS + 1):
    s = i / NS
    c, d = center(s), (center(min(1, s + 1e-3)) - center(max(0, s - 1e-3))).normalized()
    radial = Vector((0, c.y, c.z)).normalized()          # 축에서 바깥쪽
    side = d.cross(radial).normalized(); up = side.cross(d).normalized()
    r = radius(s); ring = []
    for k in range(NR):
        a = 2 * math.pi * k / NR
        n = up * math.cos(a) + side * math.sin(a)
        ring.append(bm.verts.new(c + n * r))
    rings.append(ring)
bm.verts.ensure_lookup_table()
faces = []
for i in range(NS):
    for k in range(NR):
        f = bm.faces.new((rings[i][k], rings[i][(k + 1) % NR], rings[i + 1][(k + 1) % NR], rings[i + 1][k]))
        faces.append((i, f))
bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
bm.normal_update()
me = bpy.data.meshes.new('kr_coil'); bm.to_mesh(me); bm.free()
for m in ('kr_red', 'kr_in', 'kr_suck'): me.materials.append(mats[m])
ob = bpy.data.objects.new('kr_coil', me); bpy.context.scene.collection.objects.link(ob)
# 안쪽(배 쪽을 보는 면) = kr_in, 그 가운데 줄 3마디마다 = 빨판 kr_suck
for p in me.polygons:
    c = p.center; inward = -Vector((0, c.y, c.z)).normalized()
    dt = p.normal.dot(inward)
    if dt > 0.55:
        p.material_index = 1
        si = int((c.x + 0.5) * NS * 1.0)
        if dt > 0.9 and (p.index // NR) % 4 == 0: p.material_index = 2
    else:
        p.material_index = 0
for p in me.polygons: p.use_smooth = True
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, use_selection=False)
print('COIL', out, len(me.vertices))

if prev_ship and prev_out:
    # 미리보기: 게임과 같이 배를 길이 2로 맞추고(가운데 원점), 나선을 [길이 .8, 폭 반, 높이 반]에 맞춤
    bpy.ops.import_scene.gltf(filepath=prev_ship)
    sh = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'kr_coil']
    ws = [o.matrix_world @ v.co for o in sh for v in o.data.vertices]
    lo = Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws))); hi = Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))
    size = max(hi - lo); ctr = (lo + hi) / 2; k = 2 / size
    root = bpy.data.objects.new('ship_root', None); bpy.context.scene.collection.objects.link(root)
    for o in sh:
        if o.parent is None: o.parent = root
    root.location = -ctr * k; root.scale = (k, k, k)
    bw, bh = (hi.y - lo.y) * k / 2, (hi.z - lo.z) * k / 2
    hull_h = bh * 0.55                     # 돛대 빼고 몸통 높이 반쯤
    ob.scale = (0.8, bw * 1.05, hull_h * 1.05); ob.location = (0, 0, -bh + hull_h * 1.0)
    print('PREVIEW scale', tuple(round(v, 3) for v in ob.scale), 'loc', tuple(round(v, 3) for v in ob.location))
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x = 700; sc.render.resolution_y = 520; sc.render.film_transparent = False
    cam_d = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    for name, loc in (('front', (0, -4.2, 0.6)), ('side', (4.2, -0.3, 0.6)), ('top', (0.01, -1.2, 4.2)), ('angle', (2.6, -3.2, 1.6))):
        cam.location = loc; cam.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = prev_out + '-' + name + '.png'; bpy.ops.render.render(write_still=True)
    print('PREVIEW done')

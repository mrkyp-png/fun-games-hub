# 두더지팡 아케이드 게임기(사용자 승인 21차 렌더, 2026-11-06) + 게임 뿅망치 GLB(스튜디오 뿅망치_직접회전_3D.html 에서 추출)
# 실행: blender -b -P review/build-arcade-mole.py  → review/home3d-src/arcade-mole.glb (광장 스크립트가 불러옴). ARCADE_RENDER=1 이면 확인용 렌더도.
import bpy, math, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'home3d-src')
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, rgb, rough=0.75):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    return m
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
PINK, BLUE, CREAM, GREY, HOLE = (mat('pink', srgb('d9787f')), mat('blue', srgb('8fb3d9')),
    mat('cream', srgb('f7e6c4')), mat('grey', srgb('c9c2bd')), mat('hole', srgb('5a3a26'), 0.9))
GLOW = mat('glow', srgb('fff0cf'), 0.6)
GLOW.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (*srgb('fff0cf'), 1)
GLOW.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.35

def box(name, loc, size, m, bev=0.04):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bev:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bev; md.segments = 4
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o

def slab(name, loc, size, m, R, bev=0.03):
    # 위에서 본 모양: 앞쪽(-y) 두 모서리만 반지름 R 로 둥근 판
    import bmesh
    cx, cy, cz = loc; w, d, h = size; x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2
    pts = [(x1, y1), (x0, y1)]
    for k in range(13): a = math.pi + (math.pi / 2) * k / 12; pts.append((x0 + R + R * math.cos(a), y0 + R + R * math.sin(a)))
    for k in range(13): a = 1.5 * math.pi + (math.pi / 2) * k / 12; pts.append((x1 - R + R * math.cos(a), y0 + R + R * math.sin(a)))
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bot = [bm.verts.new((x, y, cz - h / 2)) for x, y in pts]; f = bm.faces.new(bot)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, verts=[v for v in ex['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, 0, h))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); bpy.context.view_layer.objects.active = o; o.select_set(True)
    md = o.modifiers.new('bev', 'BEVEL'); md.width = bev; md.segments = 4; md.limit_method = 'ANGLE'
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o

# 사용자 '게임기 높이를 40% 줄여 → 아래 몸통을 줄여야'(2026-11-06): 받침 위~구멍판 아래(0.14~1.10)만 × 0.6, 그 위는 줄어든 만큼 내림
# + '화면과 구멍 사이 분홍색 부위만 줄여'(맨 위 간판 상자·화면은 유지): 구멍판 윗면 1.22 ~ 화면 틀 아래 1.65 만 × 0.5
LB0, LB1, LK = 0.14, 1.10, 0.6
GB0, GB1, GK = 1.22, 1.65, 0.1   # V1619 C 사용자: 위에서 볼 때 라운드·점수 화면이 보이게 더 내림(틈 0.43 → 0.043)
def mz(z):
    d1 = (LB1 - LB0) * (1 - LK)
    if z <= LB0: return z
    if z <= LB1: return LB0 + (z - LB0) * LK
    if z <= GB0: return z - d1
    if z <= GB1: return GB0 - d1 + (z - GB0) * GK
    return z - d1 - (GB1 - GB0) * (1 - GK)
KEEP = {'coin'}   # 모양 유지하고 위치만 내림(동전 구멍판)
W, DP = 1.0, 1.2          # 몸통 폭(x)·깊이(y), 앞면 = -y
# 받침·아래 몸통
box('base', (0, 0, 0.07), (W + 0.08, DP + 0.08, 0.14), GREY, 0.03)
body = box('body', (0, 0, 0.62), (W, DP, 0.96), PINK)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.61)); clip = bpy.context.object; clip.scale = (W / 2 + 0.02, DP / 2 + 0.004, 0.475); clip.hide_render = True; clip.hide_viewport = True
for sx in (-1, 1): box('edge', (sx * (W / 2 - 0.03), -DP / 2 + 0.01, 0.62), (0.07, 0.06, 0.96), BLUE, 0.02)
# 수평 게임판(두께 0.12) + 파란 테두리 + 구멍 9개(진짜로 뚫음)
deck = slab('deck', (0, -0.175, 1.16), (W + 0.06, DP + 0.37, 0.12), CREAM, 0.2)   # V1619 C 사용자: 아이보리 판을 앞으로 0.25 더 빼서 모드 버튼 자리
rim = slab('rim', (0, -0.175, 1.06), (W + 0.14, DP + 0.45, 0.2), BLUE, 0.24)   # V1619 C: 하늘색 띠 위아래 폭 늘림 + 판과 같이 앞으로
for i in range(3):
    for j in range(3):
        x, y = (i - 1) * 0.31, -0.18 + (j - 1) * 0.27
        bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.5, location=(x, y, 1.16)); c = bpy.context.object
        c.data.materials.append(HOLE)
        for tgt in (deck, rim, bpy.data.objects['body']):
            md = tgt.modifiers.new('h', 'BOOLEAN'); md.object = c; md.operation = 'DIFFERENCE'; md.material_mode = 'TRANSFER'
        c.hide_render = True; c.hide_viewport = True
        bpy.ops.mesh.primitive_cylinder_add(radius=0.121, depth=0.02, location=(x, y, 1.1)); f = bpy.context.object; f.data.materials.append(HOLE)
for o in (deck, rim, body):
    o.modifiers.move(o.modifiers.find('bev'), len(o.modifiers) - 1)
# 뒤쪽 탑: 화면 + 간판
tower = box('tower', (0, DP / 2 - 0.15, 1.8), (W, 0.3, 1.2), PINK)
box('scr_frame', (0, DP / 2 - 0.31, 1.95), (0.78, 0.04, 0.6), BLUE, 0.03)
box('screen', (0, DP / 2 - 0.33, 1.95), (0.66, 0.03, 0.48), GLOW, 0.02)
box('marq', (0, DP / 2 - 0.25, 2.52), (W + 0.06, 0.55, 0.32), BLUE, 0.05)
box('marq_panel', (0, DP / 2 - 0.53, 2.52), (W - 0.1, 0.03, 0.22), GLOW, 0.02)
# 동전 구멍(앞면 오른쪽)
coin = box('coin', (0.28, -DP / 2 - 0.02, 0.72), (0.14, 0.04, 0.22), CREAM, 0.02)
slot = box('slot', (0.28, -DP / 2 - 0.04, 0.72), (0.025, 0.05, 0.13), HOLE, 0)  # 10차 확정(사용자): 판 안에만 파 넣음
md = coin.modifiers.new('slot', 'BOOLEAN'); md.object = slot; md.operation = 'DIFFERENCE'; md.material_mode = 'TRANSFER'
coin.modifiers.move(coin.modifiers.find('slot'), 0); slot.hide_render = True; slot.hide_viewport = True
# 옆면 줄무늬(오른쪽, 사선)
for k, m in ((0, CREAM), (1, BLUE)):
    s = box('stripe', (W / 2 - 0.014, 0.05, 0.45 + k * 0.1), (0.036, DP * 2.4, 0.09), m, 0)
    s.rotation_euler = (math.radians(28), 0, 0)
    md = s.modifiers.new('cut', 'BOOLEAN'); md.object = clip; md.operation = 'INTERSECT'
# 오른쪽 걸이 + 줄 판
box('hook_plate', (W / 2 + 0.1, 0.0, 1.2), (0.2, 0.05, 0.04), BLUE, 0.015)  # 망치 머리 아래 손잡이 목을 받침(머리를 뚫지 않게)
box('cord_plate', (W / 2 + 0.03, -0.25, 0.92), (0.05, 0.12, 0.12), BLUE, 0.02)

# 게임 뿅망치(원본 GLB) — 걸이에 머리를 걸고 손잡이는 아래로
bpy.ops.import_scene.gltf(filepath=os.path.join(D, 'mallet-game.glb'))
imp = [o for o in bpy.context.selected_objects]
# 가볍게(사용자: 뿅망치 무겁다 → 가볍게): 부품마다 면 수 줄이기. 야구공 무늬는 그림을 입히려고 Tex_ 이름으로 따로 둠
for o in imp:
    if o.type != 'MESH': continue
    if 'baseball badge' in o.name:
        o.name = 'Tex_badge' + ('_a' if o.name.endswith('-1') else '_b'); ratio = 1.0
    elif 'center sleeve' in o.name:
        ratio = 1.0    # 야구공 뒤 몸통: 줄이면 야구공 앞으로 하늘색 줄이 비집고 나옴(사용자 지적)
    elif 'striking bell' in o.name:
        ratio = 0.15   # 큰 빨간 머리만 많이 줄임
    else:
        ratio = 0.45   # 작은 둥근 부품(손잡이 끝·띠·연결부)은 덜 줄여 울퉁불퉁 노이즈 없게
    md = o.modifiers.new('light', 'DECIMATE'); md.ratio = ratio
MALLET = set(o.name for o in imp)
root = [o for o in imp if o.parent is None]
xs = []
for o in imp:
    if o.type == 'MESH':
        for v in o.bound_box:
            xs.append(o.matrix_world @ __import__('mathutils').Vector(v))
mn = [min(p[k] for p in xs) for k in range(3)]; mx = [max(p[k] for p in xs) for k in range(3)]
size = max(mx[k] - mn[k] for k in range(3))
grp = bpy.data.objects.new('mallet', None); sc.collection.objects.link(grp)
for o in root: o.parent = grp
ctr = [(mn[k] + mx[k]) / 2 for k in range(3)]
for o in root: o.location = (o.location[0] - ctr[0], o.location[1] - ctr[1], o.location[2] - ctr[2])
import mathutils
bell = [o for o in imp if o.name.startswith('Red striking bell')][0]
bp = [bell.matrix_world @ mathutils.Vector(v) for v in bell.bound_box]
ext = sorted(max(p[k] for p in bp) - min(p[k] for p in bp) for k in range(3))
face_d = ext[2]  # 타격면 = 원 지름(가장 큰 두 변이 같은 지름)
HOLE_D = 0.24
s = HOLE_D / ext[1]; grp.scale = (s, s, s)
print('BELL ext', ext, 'scale', s, 'face ->', ext[1] * s)
grp.rotation_euler = (0, 0, math.radians(90)); grp.location = (W / 2 + 0.2, 0.0, mz(1.2) + 0.18)   # 걸이(1.2)와 같은 만큼 내려 걸이 위 자리 유지
bpy.context.view_layer.update()
bpy.context.view_layer.update()
pm = [o for o in imp if o.name.startswith('Ivory rounded pommel')][0]
pp = [pm.matrix_world @ mathutils.Vector(v) for v in pm.bound_box]
ax, ay = sum(p[0] for p in pp) / 8, sum(p[1] for p in pp) / 8
az = min(p[2] for p in pp) + 0.006   # 마개 바닥 안쪽에서 시작 → 틈 없음
print('POMMEL', ax, ay, az)
bx, by, bz = W / 2 + 0.05, -0.25, mz(0.92)
cu = bpy.data.curves.new('cord', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.008; cu.bevel_resolution = 1
sp = cu.splines.new('POLY'); N = 180; sp.points.add(N - 1)
for k in range(N):
    t = k / (N - 1); sag = -0.18 * math.sin(math.pi * t)
    cx, cy, cz = ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t + sag
    a = t * 34 * 2 * math.pi
    rr = 0.02 * min(1.0, t / 0.06, (1 - t) / 0.06)
    sp.points[k].co = (cx + rr * math.cos(a), cy + rr * math.sin(a) * 0.5, cz + rr * math.sin(a), 1)
co = bpy.data.objects.new('cord', cu); sc.collection.objects.link(co); co.data.materials.append(CREAM)
print('MALLET size', size, 'min', mn, 'max', mx)

# 웹용 내보내기: 수정자 적용 → 숨긴 자르개 삭제 → GLB
# ⚠️ 자르개(구멍·띠줄 자르기)를 먼저 지우면 잘라 내기가 사라짐 → 반드시 적용 후 삭제
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type in ('MESH', 'CURVE') and not o.hide_render: o.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in sc.objects if o.type == 'MESH' and not o.hide_render)
bpy.ops.object.convert(target='MESH')
for o in list(sc.objects):
    if o.hide_render: bpy.data.objects.remove(o)
for o in list(sc.objects):
    if o.type == 'MESH' and o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in list(sc.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in sc.objects:   # 아래 몸통만 낮춤(뿅망치·줄은 이미 낮춘 자리에 놓음)
    if o.type != 'MESH' or o.name in MALLET or o.name == 'cord': continue
    if o.name in KEEP:
        zs = [v.co.z for v in o.data.vertices]; c = (min(zs) + max(zs)) / 2; d = mz(c) - c
        for v in o.data.vertices: v.co.z += d
    else:
        for v in o.data.vertices: v.co.z = mz(v.co.z)
bpy.ops.export_scene.gltf(filepath=os.path.join(D, 'arcade-mole.glb'), export_format='GLB', export_animations=False, export_apply=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in sc.objects if o.type == 'MESH')
print('ARCADE_READY tris=%d' % tris)
if os.environ.get('ARCADE_RENDER'):
    # 조명·카메라·렌더
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(10), math.radians(35))); bpy.context.object.data.energy = 3.2
    bpy.ops.object.light_add(type='AREA', location=(-3, -3, 3)); bpy.context.object.data.energy = 250; bpy.context.object.data.size = 4
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.82, 0.88, 0.94, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    bpy.ops.object.camera_add(location=(3.0, -4.8, 3.4)); cam = bpy.context.object; sc.camera = cam
    t = bpy.data.objects.new('t', None); sc.collection.objects.link(t); t.location = (0.1, 0, 1.45)
    cc = cam.constraints.new('TRACK_TO'); cc.target = t; cc.track_axis = 'TRACK_NEGATIVE_Z'; cc.up_axis = 'UP_Y'
    cam.data.lens = 50
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 900; sc.render.resolution_y = 1200
    sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = os.path.join(D, 'arcade-check.png'); bpy.ops.render.render(write_still=True)

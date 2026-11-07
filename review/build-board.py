# 광장 게시판(V1653 C 사용자: 심플한 타입, 게임기처럼 Blender로) — 스코어·일일·퀘스트 칸 3개, 앞뒤 같음
# 실행: blender -b -P review/build-board.py  → mole/assets/home3d/board.glb   (BOARD_RENDER=1 이면 확인용 렌더)
# 좌표: 폭 x(약 1), 높이 z(약 0.85), 앞 = -y. 게임 쪽 home3d-layout.js BOARD 값과 맞춤(칸 가운데 x, 높이, 칸 면 깊이)
import bpy, math, os, bmesh
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, hexrgb, rough=0.75):
    # 게임 렌더러는 baseColorFactor 를 화면 색 그대로 씀 → 16진 색을 그대로 넣음(선형 변환 안 함)
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[int(hexrgb[i:i + 2], 16) / 255 for i in (0, 2, 4)], 1); b.inputs['Roughness'].default_value = rough
    return m
YEL, CREAM, PINK, BLUE, GREEN, PURP, STAR = (mat('board', 'f6d77a'), mat('cream', 'fff6e4'), mat('pink', 'f08a98'),
    mat('blue', '7cc3ee'), mat('green', '86d6a4'), mat('purple', 'b99be6'), mat('star', 'ffcf3d', 0.5))

def box(name, loc, size, m, bev=0.02, seg=4):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); bpy.ops.object.transform_apply(scale=True)
    if bev: md = o.modifiers.new('bev', 'BEVEL'); md.width = bev; md.segments = seg; md.limit_method = 'NONE'
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def cyl(name, loc, r, h, m, bev=0.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=h, location=loc); o = bpy.context.object; o.name = name
    if bev: md = o.modifiers.new('bev', 'BEVEL'); md.width = bev; md.segments = 3; md.limit_method = 'ANGLE'
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def ball(name, loc, r, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=r, location=loc); o = bpy.context.object; o.name = name
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def star(name, loc, r, depth, m):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    pts = [(math.cos(math.pi / 2 + k * math.pi / 5) * (r if k % 2 == 0 else r * 0.5), math.sin(math.pi / 2 + k * math.pi / 5) * (r if k % 2 == 0 else r * 0.5)) for k in range(10)]
    vs = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]; f = bm.faces.new(vs)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f]); bmesh.ops.translate(bm, verts=[v for v in ex['geom'] if isinstance(v, bmesh.types.BMVert)], vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); o.location = loc; o.data.materials.append(m)
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    md = o.modifiers.new('bev', 'BEVEL'); md.width = 0.012; md.segments = 4; md.limit_method = 'NONE'; return o

# 크기(게임 BOARD 와 같게)
BW, BH, BD, BZ = 0.86, 0.36, 0.08, 0.54          # 판 폭·높이·두께·가운데 높이(V1653 C 사용자: 세로 화면 좌우 잘림 → 폭 0.98 → 0.86)
PX, PW, PH = (-0.27, 0.0, 0.27), 0.25, 0.25       # 칸 가운데 x, 칸 바깥 폭·높이
RIM = 0.022                                       # 칸 테두리 두께
FACE = BD / 2 + 0.006 + 0.013 + 0.010   # 칸 크림 면 = 색 테두리(앞면 .059)보다 앞 — 테두리가 크림 판·글자를 가리던 것

box('Board', (0, 0, BZ), (BW, BD, BH), YEL, bev=0.04, seg=6)
for side in (-1, 1):
    for x, m in zip(PX, (PINK, BLUE, GREEN)):
        box('Rim', (x, side * (BD / 2 + 0.006), BZ), (PW, 0.026, PH), m, bev=0.012)
        box('Panel', (x, side * (FACE - 0.004), BZ), (PW - RIM * 2, 0.008, PH - RIM * 2), CREAM, bev=0.003, seg=2)
# 지붕(분홍 둥근 띠) + 별
box('Roof', (0, 0, BZ + BH / 2 + 0.028), (BW + 0.04, BD + 0.05, 0.06), PINK, bev=0.028, seg=6)
star('Star', (0, 0, BZ + BH / 2 + 0.115), 0.075, 0.05, STAR)
# 기둥 두 개 + 보라 받침 + 공
for x in (-BW / 2 + 0.05, BW / 2 - 0.05):
    cyl('Post', (x, 0, (BZ + BH / 2) / 2), 0.032, BZ + BH / 2, BLUE, bev=0)
    cyl('Foot', (x, 0, 0.02), 0.065, 0.04, PURP)
    cyl('Ring', (x, 0, BZ - BH / 2 - 0.02), 0.045, 0.03, PURP)
    ball('Knob', (x, 0, BZ + BH / 2 + 0.085), 0.045, STAR)

# 모디파이어 적용 + 합치기
for o in sc.objects:
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = [o for o in sc.objects if o.type == 'MESH'][0]; bpy.ops.object.join()
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
tris = sum(len(p.vertices) - 2 for p in bpy.context.object.data.polygons)
out = os.path.join(ROOT, 'mole/assets/home3d/board.glb')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_apply=True)
print('BOARD_READY tris', tris, 'FACE', round(FACE, 4), 'Y', BZ, 'PANEL', PW - RIM * 2, PH - RIM * 2)

if os.environ.get('BOARD_RENDER'):
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-30))); bpy.context.object.data.energy = 3
    bpy.ops.object.camera_add(location=(0.9, -2.0, 0.9)); cam = bpy.context.object; sc.camera = cam
    cam.rotation_euler = (math.radians(78), 0, math.radians(24)); cam.data.lens = 50
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 900; sc.render.resolution_y = 700; sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = os.environ['BOARD_RENDER']; bpy.ops.render.render(write_still=True)

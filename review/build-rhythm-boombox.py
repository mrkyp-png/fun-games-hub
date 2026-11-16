# 리듬팡 건물 = 카세트 오디오(붐박스) — 사용자 승인 시안: Desktop/리듬팡건물_새시안/시안C_카세트오디오.png
# 둥근 네모 몸통 + 양옆 스피커(겹 고리) + 위 손잡이 + 가운데 바닥 높이 넓은 입구(민트 테두리) + 빈 명판
# 단위: Blender (x = 가로, -y = 앞, z = 위). 바닥 z=0, 가운데 x=0.
import bpy, bmesh, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]  # 저장 경로 앞부분(.glb / .blend / _render.png)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat(name, hexc, rough=0.62):
    m = bpy.data.materials.new(name); m.use_nodes = True
    c = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = rough
    return m
CREAM, CORAL, CORAL2, MINT, DARK, PLATE = mat('Boombox cream', '#F0CF9C'), mat('Boombox coral', '#F2786C'), mat('Boombox coral light', '#F88E80'), mat('Boombox mint', '#63D6A8'), mat('Boombox inside', '#5A3A22', 0.85), mat('Boombox plate', '#FBE8C8')

def rbox(name, size, loc, radius, material, seg=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    b = o.modifiers.new('bevel', 'BEVEL'); b.width = radius; b.segments = seg; b.limit_method = 'NONE'
    o.data.materials.append(material); return o
def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
def boolean(o, cutter, op='DIFFERENCE'):
    apply_all(cutter); m = o.modifiers.new('bool', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    apply_all(o); bpy.data.objects.remove(cutter)
def smooth(o, angle=40):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception: bpy.ops.object.shade_smooth()
    o.select_set(False)

W, D, H = 5.8, 2.3, 3.45         # 몸통 가로·깊이·높이
FY = -D / 2                       # 앞면 y
DW, DH = 1.6, 2.6                 # 입구 폭·높이 — 지금 리듬팡 유리문(폭 1.44·높이 2.37, Energy_rhythm)이 들어가는 크기

# 몸통 + 입구 구멍(뒤까지 뚫지 않음, 안쪽 1.7 깊이) — 안쪽 면은 진한 색
body = rbox('Boombox body', (W, D, H), (0, 0, H / 2), 0.42, CREAM, 8); apply_all(body)
body.data.materials.append(DARK)
cut = rbox('cut', (DW, 1.7 * 2, DH * 2), (0, FY, 0), 0.22, DARK, 6)
boolean(body, cut)
# 안쪽 바닥은 바깥 바닥과 같은 높이(z=0) — 구멍 아래쪽은 바닥까지 열림
smooth(body)

# 민트 입구 테두리(아래는 열린 ㄷ자를 뒤집은 모양)
rim = rbox('Boombox door rim', (DW + 0.42, 0.34, DH + 0.21), (0, FY - 0.06, (DH + 0.21) / 2), 0.16, MINT, 6); apply_all(rim)
hole = rbox('cut', (DW, 1.0, DH * 2), (0, FY - 0.06, 0), 0.2, MINT, 6)
boolean(rim, hole); smooth(rim)

# 스피커 2개: 큰 원판 + 가운데 고리 + 가운데 볼록
def speaker(x):
    z = 1.5
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.66, depth=0.24, location=(x, FY - 0.05, z), rotation=(math.pi / 2, 0, 0)); a = bpy.context.object
    b = a.modifiers.new('bevel', 'BEVEL'); b.width = 0.1; b.segments = 5; a.data.materials.append(CORAL); apply_all(a); parts.append(a)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.075, major_segments=64, minor_segments=16, location=(x, FY - 0.19, z), rotation=(math.pi / 2, 0, 0)); t = bpy.context.object; t.data.materials.append(CORAL2); parts.append(t)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.26, location=(x, FY - 0.12, z)); s = bpy.context.object; s.scale = (1, 0.55, 1); s.data.materials.append(CORAL2); bpy.ops.object.transform_apply(scale=True); parts.append(s)
    for p in parts: p.name = 'Boombox speaker'; smooth(p)
for x in (-1.98, 1.98): speaker(x)

# 빈 명판(입구 위)
plate = rbox('Boombox sign plate', (1.75, 0.16, 0.44), (0, FY - 0.04, 3.08), 0.12, PLATE, 5); apply_all(plate); smooth(plate)

# 손잡이: 둥근 관(곡선) + 양끝 받침
cv = bpy.data.curves.new('handle', 'CURVE'); cv.dimensions = '3D'; cv.bevel_depth = 0.2; cv.bevel_resolution = 6; cv.resolution_u = 24
sp = cv.splines.new('BEZIER'); sp.bezier_points.add(3)
pts = [(-2.0, 0, H - 0.05), (-1.55, 0, H + 1.15), (1.55, 0, H + 1.15), (2.0, 0, H - 0.05)]
for p, c in zip(sp.bezier_points, pts):
    p.co = c; p.handle_left_type = p.handle_right_type = 'AUTO'
hd = bpy.data.objects.new('Boombox handle', cv); sc.collection.objects.link(hd); hd.data.materials.append(CORAL)
bpy.context.view_layer.objects.active = hd; hd.select_set(True); bpy.ops.object.convert(target='MESH'); hd.select_set(False); smooth(hd)
for x in (-1.95, 1.95):
    f = rbox('Boombox handle foot', (0.72, 0.62, 0.3), (x, 0, H + 0.08), 0.12, CORAL, 5); apply_all(f); smooth(f)

# 미리보기용 유리문(지금 게임의 유리문 자리·크기, 내보내기 안 함 — 게임에선 기존 Energy_rhythm 을 그대로 씀)
GLASS = mat('preview glass', '#9FE3F2', 0.1); GLASS.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.45; GLASS.blend_method = 'BLEND' if hasattr(GLASS, 'blend_method') else None
g = rbox('preview glass door', (1.44, 0.06, 2.37), (0, FY + 0.12, 0.14 + 2.37 / 2), 0.05, GLASS, 3); apply_all(g)
# 저장
bpy.ops.object.select_all(action='SELECT'); g.select_set(False)
bpy.ops.export_scene.gltf(filepath=OUT + '.glb', export_format='GLB', use_selection=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT + '.blend')

# 확인 렌더(3/4 위, 흰 배경)
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.55; sc.world = w
sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 50
for name, loc in (('34', (-7.5, -12.5, 7.0)), ('front', (0, -14, 3.0))):
    cam.location = loc; cam.rotation_euler = (Vector((0, 0, 1.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    if not any(o.type == 'LIGHT' for o in bpy.data.objects):
        L = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); L.data.energy = 3.8; L.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35)); sc.collection.objects.link(L)
    sc.render.filepath = OUT + '_' + name + '.png'; bpy.ops.render.render(write_still=True)

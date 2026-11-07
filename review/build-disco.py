# 디스코 팡팡(V1664 C 사용자: Tripo 얼룩 → Blender 로 깨끗하게) — 디자인 = 바탕화면 11111.png(상판)·2222.png(받침대)
# 실행: blender -b -P review/build-disco.py  → mole/assets/home3d/disco-top.glb, disco-base.glb   (DISCO_RENDER=경로 이면 확인 렌더)
# 크기(모델 단위)는 예전 Tripo 모델과 같게 → home3d-layout.js DISCO(받침 ×4.0, 상판 ×4.6, 상판 높이 2.55) 그대로
#   받침: 반지름 0.43, 원판 윗면 0.41, 기둥 끝 0.637(가운데 = 원점), 계단 = 앞(-y)
#   상판: 반지름 0.49, 높이 0.258, 바닥 0, 안쪽 바닥 높이 0.07
import bpy, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mole/assets/home3d')

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, hexrgb, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*[int(hexrgb[i:i + 2], 16) / 255 for i in (0, 2, 4)], 1); b.inputs['Roughness'].default_value = rough
    return m
def cyl(name, z, r, h, m, bev=0.012, seg=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h, location=(0, 0, z + h / 2)); o = bpy.context.object; o.name = name
    if bev: md = o.modifiers.new('b', 'BEVEL'); md.width = bev; md.segments = 4; md.limit_method = 'ANGLE'
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def torus(name, z, R, r, m, loc=(0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=72, minor_segments=18, location=(loc[0], loc[1], z)); o = bpy.context.object; o.name = name
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def ball(name, loc, r, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=r, location=loc); o = bpy.context.object; o.name = name
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def bowl(name, z0, z1, r0, r1, m, seg=72):
    # 아래가 좁고 위가 넓은 둥근 띠(그릇 바깥면 한 칸)
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r0, radius2=r1, depth=z1 - z0, location=(0, 0, (z0 + z1) / 2), end_fill_type='NOTHING'); o = bpy.context.object; o.name = name
    o.data.materials.append(m); bpy.ops.object.shade_smooth(); return o
def finish(path):
    for o in bpy.context.scene.objects:
        bpy.context.view_layer.objects.active = o
        for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]; bpy.ops.object.join()
    tris = sum(len(p.vertices) - 2 for p in bpy.context.object.data.polygons)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_animations=False, export_apply=True)
    return tris
def render(path):
    sc = bpy.context.scene; w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-30))); bpy.context.object.data.energy = 3
    bpy.ops.object.camera_add(location=(0, -2.2, 1.6)); cam = bpy.context.object; sc.camera = cam; cam.rotation_euler = (math.radians(62), 0, 0); cam.data.lens = 50
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 700; sc.render.resolution_y = 600; sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)

PINK, BLUE, CREAM, GOLD, YEL, GREEN = 'e05a74', '4a9fd8', 'f6dcc0', 'eab12a', 'ffd52e', '45b96a'  # 광장 빛에 바래 보여 진하게
REND = os.environ.get('DISCO_RENDER')

# ---------- 상판(11111.png): 분홍 둥근 테두리, 바깥 줄무늬(분홍·크림·파랑·크림·분홍), 금색 공 12개, 안쪽 파란 쿠션 고리·크림 바닥, 가운데 분홍 돔 ----------
reset()
P, B, C, G = mat('pink', PINK), mat('blue', BLUE), mat('cream', CREAM), mat('gold', GOLD, 0.35)
bands = [(0.0, 0.04, 0.36, 0.39, P), (0.04, 0.07, 0.39, 0.41, C), (0.07, 0.11, 0.41, 0.435, B), (0.11, 0.13, 0.435, 0.445, C), (0.13, 0.235, 0.445, 0.47, P)]  # 11111: 위 분홍 띠가 넓고 금색 공이 박힘
for z0, z1, r0, r1, m in bands: bowl('Band', z0, z1, r0, r1, m)
cyl('Bottom', 0.0, 0.36, 0.02, P, bev=0.008)
torus('Rim', 0.235, 0.45, 0.033, P)
cyl('Floor', 0.02, 0.41, 0.05, C, bev=0)
bowl('InnerWall', 0.07, 0.235, 0.40, 0.44, C)  # 안쪽 벽(속 안 비게)
torus('Cushion', 0.1, 0.395, 0.03, B)
cyl('DomeBase', 0.07, 0.085, 0.03, B, bev=0.008)
cyl('Dome', 0.1, 0.07, 0.045, P, bev=0.02)
ball('DomeCap', (0, 0, 0.145), 0.045, C)
for k in range(12):
    a = 2 * math.pi * k / 12; ball('Stud', (0.466 * math.cos(a), 0.466 * math.sin(a), 0.18), 0.03, mat('stud%d' % k, GOLD, 0.35))  # 공마다 재질 따로 = 게임에서 하나씩 다른 색 불빛(V1666 C)
for k in range(8):
    a = 2 * math.pi * k / 8; ball('DomeStud', (0.08 * math.cos(a), 0.08 * math.sin(a), 0.125), 0.011, G)
t1 = finish(os.path.join(OUT, 'disco-top.glb'))
if REND: render(REND + '_top.png')

# ---------- 받침대(2222.png): 분홍 아래 단(노란 전구 8개), 파란 띠, 크림 윗면, 분홍 기둥 + 초록 고리, 앞 크림 계단 ----------
reset()
P, B, C, Y, GR = mat('pink', PINK), mat('blue', BLUE), mat('cream', CREAM), mat('bulb', YEL, 0.3), mat('green', GREEN)
cyl('Lower', 0.0, 0.43, 0.2, P, bev=0.03)
cyl('Band', 0.2, 0.39, 0.07, B, bev=0.012)
cyl('Top', 0.27, 0.38, 0.14, C, bev=0.03)
for k in range(8):
    a = 2 * math.pi * (k + 0.5) / 8; ball('Bulb', (0.43 * math.cos(a), 0.43 * math.sin(a), 0.11), 0.048, mat('bulb%d' % k, YEL, 0.3))
cyl('Post', 0.41, 0.075, 0.227, P, bev=0.04)
torus('PostRing', 0.43, 0.105, 0.03, GR)
bpy.ops.mesh.primitive_cube_add(location=(0, -0.47, 0.06)); st = bpy.context.object; st.name = 'Step'; st.scale = (0.2, 0.1, 0.06)
bpy.ops.object.transform_apply(scale=True); md = st.modifiers.new('b', 'BEVEL'); md.width = 0.03; md.segments = 4; st.data.materials.append(C); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cube_add(location=(0, -0.47, 0.0)); sb = bpy.context.object; sb.name = 'StepBase'; sb.scale = (0.22, 0.11, 0.03)
bpy.ops.object.transform_apply(scale=True); md = sb.modifiers.new('b', 'BEVEL'); md.width = 0.025; md.segments = 4; sb.data.materials.append(P); bpy.ops.object.shade_smooth()
t2 = finish(os.path.join(OUT, 'disco-base.glb'))
if REND: render(REND + '_base.png')
print('DISCO_READY top', t1, 'base', t2)

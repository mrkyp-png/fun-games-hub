# 3D 홈 광장 Blender 참고 렌더(작업 5 승인용). 실제 브라우저 화면이 아님.
# 실행: blender -b -P review/render-home-plaza.py
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT = Path('C:/Users/master/Desktop/fun-games-hub')
OUT = Path('C:/Users/master/Desktop/3D_공용홈_초안/캡처_5단계'); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'mole/assets/home3d/plaza.blend'))
scene = bpy.context.scene

# 바닥 체크무늬(게임 셰이더와 같은 1.5 칸·색)
fl = bpy.data.materials['Hub checker floor']; nt = fl.node_tree
geo = nt.nodes.new('ShaderNodeNewGeometry'); ck = nt.nodes.new('ShaderNodeTexChecker')
ck.inputs['Scale'].default_value = 1 / 1.5
ck.inputs['Color1'].default_value = (.78, .72, .61, 1); ck.inputs['Color2'].default_value = (.31, .30, .28, 1)
nt.links.new(geo.outputs['Position'], ck.inputs['Vector'])
nt.links.new(ck.outputs['Color'], nt.nodes.get('Principled BSDF').inputs['Base Color'])

# 크기 비교용 두더지 v43(일반 스킨만)
before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'mole/assets/checkerboard-v1590/mole-clay-v43.glb'))
new = [o for o in scene.objects if o not in before]
for o in new:
    if o.type == 'MESH' and not o.name.startswith('Mole_Clay_Skin'): o.hide_render = True
    if o.parent is None: o.location = (0, -1.5, 0); o.rotation_euler[2] = 0; o.scale = (.65, .65, .65)
rig = next((o for o in new if o.type == 'ARMATURE'), None)
if rig and rig.animation_data:
    rig.animation_data.action = None
    for tr in rig.animation_data.nla_tracks: tr.mute = not (tr.name == 'Idle' or tr.name.startswith('Idle_'))
scene.frame_set(1)

def aim(o, p): o.rotation_euler = (Vector(p) - o.location).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('sky'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (.73, .82, .88, 1); bg.inputs['Strength'].default_value = .7
for name, loc, power, size in [('Key', (-9, -6, 16), 2600, 10), ('Fill', (10, 4, 11), 1200, 12)]:
    d = bpy.data.lights.new(name, 'AREA'); d.energy = power; d.shape = 'DISK'; d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc; aim(o, (0, 0, 0))
cd = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cd); scene.collection.objects.link(cam); scene.camera = cam
cd.sensor_fit = 'VERTICAL'; cd.sensor_height = 24; cd.lens = 12 / math.tan(math.pi / 6)   # 세로 화각 60°(게임과 같음)
scene.render.engine = 'CYCLES'; scene.cycles.samples = 16
scene.render.image_settings.file_format = 'PNG'; scene.view_settings.view_transform = 'Standard'

def shot(fname, w, h, dist, pitch, focus=(0, -1.5, 1.35), yaw=0):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    f = Vector(focus)
    cam.location = (f.x - math.sin(yaw) * math.cos(pitch) * dist, f.y - math.cos(yaw) * math.cos(pitch) * dist, f.z + math.sin(pitch) * dist)
    aim(cam, f); scene.render.filepath = str(OUT / fname); bpy.ops.render.render(write_still=True)

shot('1_시작시점_세로.png', 540, 1170, 7.5, .62)          # 게임 시작 카메라(세로)
shot('2_시작시점_가로.png', 1170, 540, 6.5, .62)           # 게임 시작 카메라(가로)
shot('3_전체_위에서.png', 900, 1200, 34, 1.05, (0, 0, 0))   # 섬 전체
shot('4_뒤쪽_리듬팡.png', 540, 1170, 7.5, .62, (0, -3, 1.35), math.pi)  # 뒤돌아 본 리듬팡·해변
print('PLAZA_RENDERS_READY')

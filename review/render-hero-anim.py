# 결과 화면용: 모히칸 두더지(게임 3D) 동작을 투명 배경 프레임으로 렌더 → 바탕화면 결과화면_시안/<이름>/
import bpy, math, os, sys
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
ACTION, NAME, NF = args[0], args[1], int(args[2]) if len(args) > 2 else 24
SRC = r"C:\Users\master\Desktop\fun-games-hub\review\result-scene\hero.glb"
OUT = os.path.join(r"C:\Users\master\Desktop\결과화면_시안", NAME); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = True; sc.render.resolution_x = 512; sc.render.resolution_y = 640
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = .9
for name, rot, e in [('key', (55, 0, -35), 3.2), ('fill', (60, 0, 140), 1.2), ('front', (62, 0, 0), 2.2)]:
    d = bpy.data.lights.new(name, 'SUN'); d.energy = e; o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = tuple(math.radians(v) for v in rot)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = list(bpy.data.objects); arm = next(o for o in objs if o.type == 'ARMATURE')
act = next(a for a in bpy.data.actions if a.name.startswith(ACTION))
for o in objs:
    if o.animation_data:
        for t in o.animation_data.nla_tracks: t.mute = True
arm.animation_data_create(); arm.animation_data.action = act
try:
    if act.slots: arm.animation_data.action_slot = act.slots[0]
except Exception: pass
f0, f1 = act.frame_range
# 웃는 얼굴(Smile)을 같이: 얼굴 뼈만 움직이는 동작이라 다른 트랙으로 겹침
JUMP_H = float(args[3]) if len(args) > 3 else 0.0
sm = next((a for a in bpy.data.actions if a.name.startswith('Smile')), None)
if sm and ACTION != 'Smile':
    tr = arm.animation_data.nla_tracks.new(); st = tr.strips.new('smile', int(sm.frame_range[0]), sm)
    st.blend_type = 'COMBINE'; st.extrapolation = 'HOLD'; tr.mute = False
    st.frame_start = f0; st.frame_end = f1 + 200; st.action_frame_end = sm.frame_range[1]; st.scale = 1
    arm.animation_data.action_blend_type = 'COMBINE'
def lift(i):  # 점프 높이: 쪼그렸다(0~30%) 떠올라(30~78%) 착지
    t = i / NF
    return JUMP_H * max(0.0, math.sin(math.pi * (t - .3) / .48)) if .3 <= t <= .78 else 0.0
print('ACTION', act.name, f0, f1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
# 동작 전체에서 몸이 움직이는 범위로 카메라 고정(뛰어도 안 잘리게)
meshes = [o for o in objs if o.type == 'MESH']; mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for i in range(NF):
    sc.frame_set(int(round(f0 + (f1 - f0) * i / NF))); arm.location.z = lift(i); dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            p = ev.matrix_world @ v.co; mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
        ev.to_mesh_clear()
c = (mn + mx) / 2; hgt = mx.z - mn.z; wid = mx.x - mn.x
cam.data.ortho_scale = max(hgt * 1.08, wid * 1.08 * 640 / 512)
cam.location = (c.x, mn.y - 20, c.z + 1.0); cam.rotation_euler = (math.radians(87), 0, 0)
for i in range(NF):
    sc.frame_set(int(round(f0 + (f1 - f0) * i / NF))); arm.location.z = lift(i)
    sc.render.filepath = os.path.join(OUT, f'f{i:02d}.png'); bpy.ops.render.render(write_still=True)
print('ANIM_DONE', OUT)

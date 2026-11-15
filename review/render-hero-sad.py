# 실패 화면용: 모히칸 두더지가 고개를 푹 숙이는 동작(기본 Idle 자세 위에 머리·몸·팔 뼈를 직접 돌림) → 투명 프레임
import bpy, math, os, sys
from mathutils import Vector, Quaternion, Euler
SRC = r"C:\Users\master\Desktop\fun-games-hub\review\result-scene\hero.glb"
OUT = r"C:\Users\master\Desktop\결과화면_시안\실패_고개숙임"; os.makedirs(OUT, exist_ok=True)
NF = 24
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = True; sc.render.resolution_x = 512; sc.render.resolution_y = 640
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = .9
for name, rot, e in [('key', (55, 0, -35), 3.2), ('fill', (60, 0, 140), 1.2), ('front', (62, 0, 0), 2.2)]:
    d = bpy.data.lights.new(name, 'SUN'); d.energy = e; o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = tuple(math.radians(v) for v in rot)
bpy.ops.import_scene.gltf(filepath=SRC)
objs = list(bpy.data.objects); arm = next(o for o in objs if o.type == 'ARMATURE')
for o in objs:
    if o.animation_data:
        for t in o.animation_data.nla_tracks: t.mute = True
# 기본 자세 = Idle 첫 프레임(+ 아파하는 눈은 PainHit 중간 자세에서 눈 뼈만 가져옴)
idle = next(a for a in bpy.data.actions if a.name.startswith('Idle'))
pain = next(a for a in bpy.data.actions if a.name.startswith('PainHit'))
arm.animation_data_create()
def set_action(act, frame):
    arm.animation_data.action = act
    try:
        if act.slots: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    sc.frame_set(int(frame)); bpy.context.view_layer.update()
pb = arm.pose.bones
set_action(pain, pain.frame_range[0] + (pain.frame_range[1] - pain.frame_range[0]) * .45)
eyes = {n: (pb[n].location.copy(), pb[n].rotation_quaternion.copy(), pb[n].scale.copy()) for n in ['Eye.L', 'Eye.R', 'PainEye.L', 'PainEye.R', 'HappyEye.L', 'HappyEye.R', 'Brow.L', 'Brow.R', 'MouthCorner.L', 'MouthCorner.R', 'Jaw'] if n in pb}
set_action(idle, idle.frame_range[0])
arm.animation_data.action = None  # 이제 손으로 자세를 잡음(Idle 자세 유지)
base = {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in pb}
for b in pb: b.rotation_mode = 'QUATERNION'
def ease(t): return t * t * (3 - 2 * t)
def pose(k, sigh):  # k = 0~1 숙임 정도, sigh = 한숨(몸이 살짝 오르내림)
    for n, (loc, q) in base.items(): pb[n].location = loc.copy(); pb[n].rotation_quaternion = q.copy()
    for n, (loc, q, s) in eyes.items(): pb[n].location = loc.copy(); pb[n].rotation_quaternion = q.copy(); pb[n].scale = s.copy()
    def rot(n, ax, deg):
        if n in pb: pb[n].rotation_quaternion = pb[n].rotation_quaternion @ Quaternion(ax, math.radians(deg))
    rot('Head', (1, 0, 0), 38 * k)          # 고개를 앞으로 푹
    rot('Body', (1, 0, 0), (10 + 2 * sigh) * k)   # 몸도 앞으로 살짝 수그림
    for s in ('L', 'R'):
        rot('UpperArm.' + s, (1, 0, 0), 25 * k)  # 팔 축 늘어뜨림
        rot('Forearm.' + s, (1, 0, 0), 10 * k)
    if 'Root' in pb: pb['Root'].location = base['Root'][0] + Vector((0, -0.03 * k - 0.01 * sigh, 0))
    bpy.context.view_layer.update()
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
pose(0, 0); meshes = [o for o in objs if o.type == 'MESH']; mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for kk in (0, 1):
    pose(kk, 0); dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            p = ev.matrix_world @ v.co; mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
        ev.to_mesh_clear()
c = (mn + mx) / 2; hgt = mx.z - mn.z; wid = mx.x - mn.x
cam.data.ortho_scale = max(hgt * 1.08, wid * 1.08 * 640 / 512)
cam.location = (c.x, mn.y - 20, c.z + 1.0); cam.rotation_euler = (math.radians(87), 0, 0)
for i in range(NF):
    t = i / (NF - 1)
    k = ease(min(1, t / .55))                     # 앞 55% 동안 천천히 숙임
    sigh = math.sin(max(0, t - .55) / .45 * math.pi) if t > .55 else 0   # 숙인 뒤 한숨 한 번
    pose(k, sigh)
    sc.render.filepath = os.path.join(OUT, f'f{i:02d}.png'); bpy.ops.render.render(write_still=True)
print('SAD_DONE', OUT, list(eyes))

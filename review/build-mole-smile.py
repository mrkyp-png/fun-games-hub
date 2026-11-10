# V1682 C 사용자: 리깅으로 웃는 얼굴 — 입꼬리 뼈 2개 추가 + 웃는 눈(∩) 새로 만들어 붙임 + 'Smile' 동작
# 실행: blender -b -P review/build-mole-smile.py -- <입력 glb(v46)> <출력 glb> [렌더 png]
# 웃는 눈은 평소엔 아주 작게 접혀 숨어 있고(뼈 크기 0.02), Smile 동작에서만 뼈를 50배로 펴서 보임. 원래 눈은 그때 접음.
import bpy, bmesh, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; rend = a[2] if len(a) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]; AW = arm.matrix_world; AI = AW.inverted()
EYE = {'.L': mathutils.Vector((-0.275, -0.705, 2.14)), '.R': mathutils.Vector((0.275, -0.705, 2.14))}
CORNER = {'.L': mathutils.Vector((-0.2, -0.97, 1.68)), '.R': mathutils.Vector((0.2, -0.97, 1.68))}
HIDE = 0.02

# 1) 뼈 추가: MouthCorner.L/R, HappyEye.L/R (부모 Head)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT'); eb = arm.data.edit_bones
for sfx in ('.L', '.R'):
    for name, p in (('MouthCorner' + sfx, CORNER[sfx]), ('HappyEye' + sfx, EYE[sfx])):
        b = eb.new(name); b.head = AI @ p; b.tail = AI @ (p + mathutils.Vector((0, 0, 0.08))); b.parent = eb['Head']; b.use_deform = True
bpy.ops.object.mode_set(mode='OBJECT')

def arc_eye(sfx):
    """∩ 모양 웃는 눈(살짝 굵은 관), 눈 가운데 기준으로 HIDE 배 접어 둠"""
    c = EYE[sfx]; pts = []
    for k in range(17):
        t = -1 + 2 * k / 16
        x = c.x + t * 0.12
        z = c.z - 0.01 + 0.075 * (1 - t * t)  # 웃는 눈의 위쪽 곡선을 강조
        y = c.y - 0.005 + 0.03 * t * t       # 가장자리는 머리 곡면을 따라 살짝 뒤로
        pts.append(mathutils.Vector((x, y, z)))
    bm = bmesh.new(); R = 0.025; rings = []
    for i, p in enumerate(pts):
        tan = (pts[min(i + 1, 16)] - pts[max(i - 1, 0)]).normalized(); n1 = mathutils.Vector((0, -1, 0)); n1 = (n1 - tan * n1.dot(tan)).normalized(); n2 = tan.cross(n1)
        rr = R * (0.55 + 0.45 * math.sin(math.pi * i / 16))                                   # 양 끝 가늘게
        rings.append([bm.verts.new(p + (n1 * math.cos(2 * math.pi * j / 10) + n2 * math.sin(2 * math.pi * j / 10)) * rr) for j in range(10)])
    for i in range(16):
        for j in range(10):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % 10], rings[i + 1][(j + 1) % 10], rings[i + 1][j]))
    for ring in (rings[0], rings[-1][::-1]): bm.faces.new(ring)
    for v in bm.verts: v.co = c + (v.co - c) * HIDE                                          # 평소엔 접어 숨김
    me = bpy.data.meshes.new('HappyEye' + sfx); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('HappyEye' + sfx, me); sc.collection.objects.link(o)
    for p in me.polygons: p.use_smooth = True
    return o

for n in ('Mole_Clay_Skin', 'Mole_Carrier_Skin'):
    sk = sc.objects.get(n)
    if not sk: continue
    mw = sk.matrix_world; mats = [m.name for m in sk.data.materials]
    EYEM = next(i for i, m in enumerate(mats) if 'espresso' in m.lower())
    # 2) 입꼬리 무게: 입 둘레(주둥이·입 안·혀) 정점 중 입꼬리 0.13 안 → 가까울수록 크게, 나머지 무게는 줄여 합 1
    keep = {i for i, m in enumerate(mats) if any(k in m.lower() for k in ('muzzle', 'smile', 'tongue', 'clay warm'))}
    vin = set(); [vin.update(p.vertices) for p in sk.data.polygons if p.material_index in keep]
    for sfx in ('.L', '.R'):
        g = sk.vertex_groups.new(name='MouthCorner' + sfx)
        for i in vin:
            v = sk.data.vertices[i]; d = ((mw @ v.co) - CORNER[sfx]).length
            if d > 0.17: continue
            w = (1 - d / 0.17) ** 2
            for e in v.groups: e.weight *= (1 - w)
            g.add([i], w, 'REPLACE')
    # 3) 웃는 눈 붙이기(재질 = 눈 색, 무게 = HappyEye 뼈)
    for sfx in ('.L', '.R'):
        o = arc_eye(sfx); o.data.materials.clear()
        for m in sk.data.materials: o.data.materials.append(m)
        for p in o.data.polygons: p.material_index = EYEM
        o.vertex_groups.new(name='HappyEye' + sfx).add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); sk.select_set(True); bpy.context.view_layer.objects.active = sk; bpy.ops.object.join()
        sk.vertex_groups.get('MouthCorner' + sfx) or sk.vertex_groups.new(name='MouthCorner' + sfx)
    print('SMILE_MESH', n, len(sk.data.vertices))

# 4) 'Smile' 동작(1초, 살짝 들썩이는 웃음)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE'); pb = arm.pose.bones
act = bpy.data.actions.new('Smile'); arm.animation_data_create(); arm.animation_data.action = act
FR = 24
for b in pb: b.rotation_mode = 'QUATERNION'
def key(b):
    b.keyframe_insert('location'); b.keyframe_insert('rotation_quaternion'); b.keyframe_insert('scale')
for f in (0, 12, 24):
    sc.frame_set(f); bob = 0.012 * math.sin(math.pi * f / 12)
    for b in pb: b.location = (0, 0, 0); b.rotation_quaternion = (1, 0, 0, 0); b.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    for sfx, s in (('.L', -1), ('.R', 1)):
        e = pb['Eye' + sfx]; e.scale = (HIDE, HIDE, HIDE); key(e)                               # 동그란 눈 접기
        h = pb['HappyEye' + sfx]; h.scale = (1 / HIDE, 1 / HIDE, 1 / HIDE); key(h)              # 웃는 눈 펴기
        br = pb['Brow' + sfx]; br.matrix = mathutils.Matrix.Translation((0, 0, 0.05 + bob)) @ br.matrix; bpy.context.view_layer.update(); key(br)
        mc = pb['MouthCorner' + sfx]; mc.matrix = mathutils.Matrix.Translation((s * 0.04, -0.015, 0.1 + bob)) @ mc.matrix; bpy.context.view_layer.update(); key(mc)
    j = pb['Jaw']; rest = j.bone.matrix_local; hj = rest.to_translation()
    j.matrix = mathutils.Matrix.Translation(hj) @ mathutils.Matrix.Rotation(math.radians(3), 4, 'X') @ mathutils.Matrix.Translation(-hj) @ j.matrix; bpy.context.view_layer.update(); key(j)
bpy.ops.object.mode_set(mode='OBJECT')
for ac in bpy.data.actions:
    tr = arm.animation_data.nla_tracks.new(); tr.name = ac.name; st = tr.strips.new(ac.name, 0, ac); st.name = ac.name
arm.animation_data.action = None
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False, export_skins=True)
print('SMILE_READY', out, len(bpy.data.actions))

if rend:
    sk = sc.objects['Mole_Clay_Skin']
    for o in list(sc.objects):
        if o.type == 'MESH' and o is not sk: o.hide_render = True
    for tr in arm.animation_data.nla_tracks: tr.mute = True
    arm.animation_data.action = act
    sc.frame_set(0)
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.resolution_x = 600; sc.render.resolution_y = 600; sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.95, 0.95, 0.95, 1)
    bpy.ops.object.light_add(type='SUN', rotation=(math.radians(40), 0, math.radians(-20))); bpy.context.object.data.energy = 3.5
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.6; sc.camera = cam
    cam.location = (0.6, -8, 2.05); cam.rotation_euler = (math.radians(90), 0, math.radians(4)); sc.render.filepath = rend; bpy.ops.render.render(write_still=True)

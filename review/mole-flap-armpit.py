# V1671 C 사용자: (1) 날 때 팔을 옆으로 벌려 파닥이는 동작 'Flap' 추가 (2) 겨털을 진짜 겨드랑이(팔 안쪽 아래)로 옮김
# 실행: blender -b -P review/mole-flap-armpit.py -- <v45 glb> <출력 glb> [렌더 앞부분]
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; rend = a[2] if len(a) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]

# (2) 겨털: 'Armpit cocoa fur' 재질 조각을 쪽마다 모아, 팔 안쪽 아래(어깨 밑 옆구리)로 옮기고 옆을 보게 돌림
for n in ('Mole_Clay_Skin', 'Mole_Carrier_Skin'):
    sk = sc.objects.get(n)
    if not sk: continue
    fi = next(i for i, m in enumerate(sk.data.materials) if 'armpit' in m.name.lower())
    mw, inv = sk.matrix_world, sk.matrix_world.inverted()
    vs = set()
    for p in sk.data.polygons:
        if p.material_index == fi: vs.update(p.vertices)
    for s in (-1, 1):
        side = [i for i in vs if (mw @ sk.data.vertices[i].co).x * s > 0]
        if not side: continue
        c = sum((mw @ sk.data.vertices[i].co for i in side), mathutils.Vector()) / len(side)
        sh = arm.matrix_world @ arm.data.bones['UpperArm' + ('.R' if s > 0 else '.L')].head_local
        tgt = mathutils.Vector((s * 0.835, sh.y + 0.02, sh.z - 0.1))   # V1676 C 사용자: 몸에 붙은 그대로(0.835), 조금 위로(-0.2 → -0.1)
        R = mathutils.Matrix.Rotation(s * math.radians(80), 4, 'Z')          # 앞을 보던 털 → 옆을 보게
        for i in side:
            v = sk.data.vertices[i]; p = mw @ v.co
            q = (R @ (p - c).to_4d()).to_3d(); q.x *= 3.0; q.y *= 3.0; q.z *= 2.0; v.co = inv @ (tgt + q)  # V1676 C: 폭 3배·길이 2배(너무 아래로 내려오던 것)
        print('ARMPIT', n, s, [round(x, 2) for x in c], '->', [round(x, 2) for x in tgt])
    sk.data.update()

# (2a) V1678 C 사용자: 겨털 맨 아래 한 가닥 없앰 — 쪽마다 겨털 조각(이어진 덩어리) 중 가장 낮은 것 삭제
import bmesh
for n in ('Mole_Clay_Skin', 'Mole_Carrier_Skin'):
    sk = sc.objects.get(n)
    if not sk: continue
    fi = next(i for i, m in enumerate(sk.data.materials) if 'armpit' in m.name.lower()); mw = sk.matrix_world
    bm = bmesh.new(); bm.from_mesh(sk.data); bm.faces.ensure_lookup_table()
    left = set(f for f in bm.faces if f.material_index == fi); islands = []
    while left:
        st = [left.pop()]; isl = set(st)
        while st:
            f0 = st.pop()
            for e in f0.edges:
                for f1 in e.link_faces:
                    if f1 in left: left.discard(f1); isl.add(f1); st.append(f1)
        islands.append(isl)
    kill = []
    for sgn in (-1, 1):
        side = [i for i in islands if (mw @ next(iter(i)).calc_center_median()).x * sgn > 0]
        cz = lambda i: sum((mw @ f.calc_center_median()).z for f in i) / len(i)
        zs = sorted(round(cz(i), 3) for i in side); print('FUR_Z', sgn, zs)
        if len(side) > 1:
            zlo = min(cz(i) for i in side); kill += [f for i in side if cz(i) < zlo + float(__import__('os').environ.get('FUR_CUT', '0.016')) for f in i]  # 맨 아래 줄 = 가장 낮은 조각에서 FUR_CUT 안
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(sk.data); bm.free()
    print('FUR_STRANDS', n, 'islands', len(islands), 'removed faces', len(kill))
# (2b) V1674 C 사용자: 파닥일 때 겨털도 파닥 — 겨털 = 겨드랑이 뼈(Armpit.L/R)에만 묶고, 그 뼈를 겨털 위쪽(어깨 밑)으로 옮김
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for sfx, s in (('.L', -1), ('.R', 1)):
    eb = arm.data.edit_bones['Armpit' + sfx]; inv_a = arm.matrix_world.inverted()
    eb.head = inv_a @ mathutils.Vector((s * 0.835, 0.02, 1.42)); eb.tail = inv_a @ mathutils.Vector((s * 0.835, 0.02, 1.62)); eb.roll = 0
bpy.ops.object.mode_set(mode='OBJECT')
for n in ('Mole_Clay_Skin', 'Mole_Carrier_Skin'):
    sk = sc.objects.get(n)
    if not sk: continue
    fi = next(i for i, m in enumerate(sk.data.materials) if 'armpit' in m.name.lower()); mw = sk.matrix_world
    vs = set(); [vs.update(p.vertices) for p in sk.data.polygons if p.material_index == fi]
    for i in vs:
        v = sk.data.vertices[i]; sfx = '.R' if (mw @ v.co).x > 0 else '.L'
        for g in sk.vertex_groups:
            try: g.remove([i])
            except RuntimeError: pass
        sk.vertex_groups['Armpit' + sfx].add([i], 1.0, 'REPLACE')
# (3) 'Flap': 팔을 옆으로 75도 벌리고 ±22도로 파닥(0.5초, 12프레임 반복)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
act = bpy.data.actions.new('Flap'); arm.animation_data_create(); arm.animation_data.action = act
FR = 12; sc.render.fps = 24
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
for f in range(FR + 1):
    sc.frame_set(f); ang = math.radians(75 + 22 * math.sin(2 * math.pi * f / FR))
    for sfx, s in (('.L', 1), ('.R', -1)):
        pb = arm.pose.bones['UpperArm' + sfx]; rest = pb.bone.matrix_local; h = rest.to_translation()
        Rw = mathutils.Matrix.Translation(h) @ mathutils.Matrix.Rotation(s * ang, 4, 'Y') @ mathutils.Matrix.Translation(-h)
        pb.matrix = Rw @ rest
        bpy.context.view_layer.update()
        pb.keyframe_insert('rotation_quaternion', frame=f)
        # V1676 C: 겨털은 바깥쪽으로만(0~32도) — 안쪽으로 흔들려 몸에 파묻히던 것
        ap = arm.pose.bones['Armpit' + sfx]; ra = ap.bone.matrix_local; ha = ra.to_translation()  # 겨털: 팔보다 살짝 늦게 ±25도 파닥
        ap.matrix = mathutils.Matrix.Translation(ha) @ mathutils.Matrix.Rotation(s * math.radians(16 + 16 * math.sin(2 * math.pi * f / FR - 0.9)), 4, 'Y') @ mathutils.Matrix.Translation(-ha) @ ra
        bpy.context.view_layer.update(); ap.keyframe_insert('rotation_quaternion', frame=f)
        fa = arm.pose.bones['Forearm' + sfx]; fa.rotation_quaternion = mathutils.Quaternion((1, 0, 0), 0); fa.keyframe_insert('rotation_quaternion', frame=f)
        # V1672 C 사용자: 파닥일 때 손가락 모으기 — 손가락 3개를 가운데 손가락 쪽으로 오므림(Finger1·3 을 손 축 둘레로 ±18도), 엄지는 손바닥 쪽으로
        # 축 = 뼈 Z(재어 봄: Y 는 효과 없음). 손가락 1·3 = 가운데로(양손 같음), 엄지 = 왼손 -, 오른손 +
        for fn, ang2 in (('Finger1', -14), ('Finger3', 14), ('Thumb', -20 if sfx == '.L' else 20)):  # V1673 C 사용자: 너무 붙임 → 절반
            fb = arm.pose.bones[fn + sfx]; fb.rotation_quaternion = mathutils.Quaternion((0, 0, 1), math.radians(ang2)); fb.keyframe_insert('rotation_quaternion', frame=f)
bpy.ops.object.mode_set(mode='OBJECT')
print('FLAP keys', len(act.fcurves) if hasattr(act, 'fcurves') else 'slotted')
# 다른 동작도 내보내지게 NLA 에 올림
for ac in bpy.data.actions:
    tr = arm.animation_data.nla_tracks.new(); tr.name = ac.name; st = tr.strips.new(ac.name, 0, ac); st.name = ac.name
arm.animation_data.action = None
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_apply=False, export_skins=True, export_image_format='WEBP')
print('FLAP_READY', out)

if rend:
    sk = sc.objects['Mole_Clay_Skin']
    for o in list(sc.objects):
        if o.type == 'MESH' and o is not sk: o.hide_render = True
    for tr in arm.animation_data.nla_tracks: tr.mute = tr.name != 'Flap'
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.render.resolution_x = 500; sc.render.resolution_y = 520
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); cam.data.type = 'ORTHO'; cam.data.ortho_scale = 4.2; sc.camera = cam
    cam.location = (0, -10, 1.5); cam.rotation_euler = (math.radians(90), 0, 0)
    for f in (0, 3, 9):
        sc.frame_set(f); sc.render.filepath = rend + '_flap%d.png' % f; bpy.ops.render.render(write_still=True)
    sc.frame_set(3); hp = arm.matrix_world @ arm.pose.bones['Hand.L'].head; cam.data.ortho_scale = 0.9; cam.location = (hp.x, -9, hp.z - 0.15); sc.render.filepath = rend + '_hand.png'; bpy.ops.render.render(write_still=True)  # 파닥 중 손 가까이
    cam.location = (0, -10, 1.5)
    for tr in arm.animation_data.nla_tracks: tr.mute = True
    sc.frame_set(0); cam.data.ortho_scale = 1.8; cam.location = (-1.6, -9, 1.3); sc.render.filepath = rend + '_pit.png'; bpy.ops.render.render(write_still=True)

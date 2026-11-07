# 신규 두더지(사용자 Tripo, 바탕화면 신규두더지.glb) → 기존 뼈대(mole-clay-v44, 뼈 44·동작 19)에 붙임 (V1655 C)
# 실행: blender -b -P review/build-new-mole.py -- <팔 내린 새 몸 glb> <기존 v44 glb> <출력 glb> [렌더 png 앞부분]
# 1) 기존 뼈의 팔·손·손톱(손가락 = 손톱, 사용자)·꼬리·코를 새 몸 위치로 옮김
# 2) 몸·머리·얼굴 무게 = 기존 몸에서 가까운 면 기준으로 옮김, 팔은 위치로 직접(어깨→팔꿈치→손→손톱)
# 3) 새 몸을 Mole_Clay_Skin 이름으로(광장 렌더러가 이 이름만 그림), 기존 몸 삭제, 동작 그대로
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:]
new_src, rig_src, out = a[0], a[1], a[2]; render = a[3] if len(a) > 3 else None
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=rig_src)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
old = sc.objects['Mole_Clay_Skin']
for o in list(sc.objects):
    if o.type == 'MESH' and o is not old: bpy.data.objects.remove(o, do_unlink=True)   # 폭탄·운반용 몸은 광장에 안 씀
bpy.ops.import_scene.gltf(filepath=new_src)
new = [o for o in sc.objects if o.type == 'MESH' and o is not old][0]
bpy.context.view_layer.objects.active = new; new.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 팔 벌린 원래 자세(T)에서 팔을 고르고, 팔 내림(어깨 축 40도)은 여기서 함 — 내린 뒤 고르면 팔·옆구리가 겹쳐 몸이 딸려 감
X0, X1, PZ, ANG = 0.80, 0.98, 1.22, math.radians(40)
def lower(p):
    ax = abs(p.x)
    if ax < X0 or p.z < 0.75 or p.z > 1.7: return p.copy()
    t = min(1, (ax - X0) / (X1 - X0)); t = t * t * (3 - 2 * t); s = 1 if p.x > 0 else -1; a = -ANG * t * s
    px, dx, dz = s * X0, p.x - s * X0, p.z - PZ
    return mathutils.Vector((px + dx * math.cos(a) - dz * math.sin(a), p.y, PZ + dx * math.sin(a) + dz * math.cos(a)))
T = [v.co.copy() for v in new.data.vertices]                      # 팔 벌린 자세
ISARM = [abs(p.x) > 0.84 and 0.85 < p.z < 1.62 for p in T]
V = [lower(p) for p in T]

# ---- 새 몸 표지점 ----
def side(s):
    idx = [i for i, p in enumerate(T) if ISARM[i] and p.x * s > 0]
    xmax = max(abs(T[i].x) for i in idx)
    sh = lower(mathutils.Vector((s * 0.80, sum(T[i].y for i in idx) / len(idx), 1.22)))
    tipi = [i for i in idx if abs(T[i].x) > xmax - 0.22]
    hand = lower(mathutils.Vector((s * (xmax - 0.2), sum(T[i].y for i in tipi) / len(tipi), sum(T[i].z for i in tipi) / len(tipi) + 0.05)))
    low = sorted(tipi, key=lambda i: V[i].z)[:max(30, len(tipi) // 6)]
    low.sort(key=lambda i: V[i].y)
    tips = [V[low[0]], V[low[len(low) // 2]], V[low[-1]]]
    return idx, sh, hand, tips
L = side(-1); R = side(1)
tailpts = [p for p in V if p.y > 0.95 and p.z < 0.9]
tail = mathutils.Vector([sum(p[k] for p in tailpts) / len(tailpts) for k in range(3)]) if tailpts else None
nose = min(V, key=lambda p: p.y)
print('LANDMARK shoulderL', [round(x, 2) for x in L[1]], 'handL', [round(x, 2) for x in L[2]], 'tail', tail and [round(x, 2) for x in tail], 'nose', [round(x, 2) for x in nose])

# ---- 뼈 옮기기 ----
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT'); eb = arm.data.edit_bones
for sfx, (pts, sh, hand, tips) in (('.L', L), ('.R', R)):
    el = sh + (hand - sh) * 0.55
    eb['UpperArm' + sfx].head = sh; eb['UpperArm' + sfx].tail = el
    eb['Forearm' + sfx].head = el; eb['Forearm' + sfx].tail = hand
    eb['Hand' + sfx].head = hand; eb['Hand' + sfx].tail = hand + mathutils.Vector((0, 0, -0.08))
    # 손가락 = 손톱(사용자: 손가락 없음 → 손톱에 붙임). Finger1/2/3 의 앞·가운데·뒤 순서는 기존과 같게
    order = ['Finger1', 'Finger2', 'Finger3'] if sfx == '.R' else ['Finger3', 'Finger2', 'Finger1']
    for nm, tp in zip(order, tips):
        b = eb[nm + sfx]; b.head = hand + (tp - hand) * 0.35; b.tail = tp
    eb['Thumb' + sfx].head = hand + mathutils.Vector((0, -0.12, 0.06)); eb['Thumb' + sfx].tail = eb['Thumb' + sfx].head + mathutils.Vector((-0.06 if sfx == '.L' else 0.06, -0.05, -0.04))
if tail: eb['Tail'].head = tail + mathutils.Vector((0, -0.25, 0)); eb['Tail'].tail = tail + mathutils.Vector((0, 0.15, -0.03))
nb = eb['Nose']; d = nb.tail - nb.head; nb.head = mathutils.Vector((0, nose.y + 0.15, nose.z)); nb.tail = nb.head + d
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 무게: 기존 몸 → 새 몸(가까운 면), 팔은 직접 ----
for g in old.vertex_groups: new.vertex_groups.new(name=g.name)
bpy.context.view_layer.objects.active = new
dt = new.modifiers.new('w', 'DATA_TRANSFER'); dt.object = old; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier=dt.name)
G = {g.name: g for g in new.vertex_groups}
def setw(v, pairs):
    for g in new.vertex_groups:
        try: g.remove([v.index])
        except RuntimeError: pass
    tot = sum(w for _, w in pairs)
    for n, w in pairs:
        if w > 0: G[n].add([v.index], w / tot, 'REPLACE')
for sfx, s, (idx, sh, hand, tips) in (('.L', -1, L), ('.R', 1, R)):
    xmax = max(abs(T[i].x) for i in idx); clawz = sorted(T[i].z for i in idx if abs(T[i].x) > xmax - 0.22)[len([1 for i in idx if abs(T[i].x) > xmax - 0.22]) // 3]
    order = ['Finger1', 'Finger2', 'Finger3'] if sfx == '.R' else ['Finger3', 'Finger2', 'Finger1']
    for i in idx:
        p, v = T[i], new.data.vertices[i]
        t = (abs(p.x) - 0.80) / (xmax - 0.80)                            # 어깨 0 → 손끝 1(팔 벌린 자세에서)
        blend = max(0.0, min(1.0, (abs(p.x) - 0.84) / 0.12))
        if t > 0.72 and p.z < clawz: pairs = [(order[min(range(3), key=lambda k: (tips[k] - V[i]).length)] + sfx, 1.0)]   # 손톱
        elif t > 0.72: pairs = [('Hand' + sfx, 1.0)]
        elif t > 0.45: w = max(0, (t - 0.62) / 0.1) * 0.5; pairs = [('Forearm' + sfx, 1 - w), ('Hand' + sfx, w)]
        else: w = max(0, (t - 0.35) / 0.1) * 0.5; pairs = [('UpperArm' + sfx, 1 - w), ('Forearm' + sfx, w)]
        setw(v, [(n, w * blend) for n, w in pairs] + [('Body', 1.0 - blend)])
# 팔 내린 위치로 몸 바꿈(무게는 그대로)
for i, v in enumerate(new.data.vertices): v.co = V[i]
new.data.update()

# ---- 바꿔 끼우기 ----
bpy.data.objects.remove(old, do_unlink=True)
new.name = 'Mole_Clay_Skin'; new.data.name = 'Mole_Clay_Skin'
new.parent = arm; md = new.modifiers.new('Armature', 'ARMATURE'); md.object = arm
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_apply=False, export_image_format='JPEG', export_skins=True)
print('MOLE_READY', out, 'tris', len(new.data.polygons), 'groups', len(new.vertex_groups), 'actions', len(bpy.data.actions))

if render:   # 동작 몇 개 확인 렌더(앞)
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = 360; sc.render.resolution_y = 420
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.6; sc.camera = cam
    cam.location = (2.6, -7.5, 1.5); cam.rotation_euler = (math.radians(88), 0, math.radians(19))
    arm.animation_data_create()
    for nm, fr in (('Idle', 10), ('WalkFwd', 6), ('ArmsUp', 12), ('Jump', 8), ('Hit', 6), ('Appear', 14)):
        act = bpy.data.actions.get(nm)
        if not act: continue
        arm.animation_data.action = act
        try: arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
        sc.frame_set(fr); sc.render.filepath = render + '_' + nm + '.png'; bpy.ops.render.render(write_still=True)

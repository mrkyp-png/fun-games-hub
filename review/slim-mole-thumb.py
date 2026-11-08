# 두더지 엄지만 가늘게(V1671 C 사용자: 엄지 통통한 부분 없게) — 다른 곳은 그대로, 다시 짜기 없음
# 실행: blender -b -P review/slim-mole-thumb.py -- <v44 glb> <출력 glb> [렌더 앞부분]
import bpy, sys, mathutils
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; rend = a[2] if len(a) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
K = 0.68   # 엄지 굵기 배율(뼈 줄기 쪽으로)
for n in ('Mole_Clay_Skin', 'Mole_Carrier_Skin'):
    sk = sc.objects.get(n)
    if not sk: continue
    mw, inv = sk.matrix_world, sk.matrix_world.inverted()
    for sfx, bn in [(x, y) for x in ('.L', '.R') for y in ('Thumb', 'Finger1', 'Finger2', 'Finger3')]:  # V1671 C 사용자: 손가락 3개도 엄지처럼
        g = sk.vertex_groups.get(bn + sfx)
        if not g: continue
        b = arm.data.bones[bn + sfx]; h0 = arm.matrix_world @ b.head_local; t0 = arm.matrix_world @ b.tail_local; ax = (t0 - h0).normalized()
        for v in sk.data.vertices:
            w = next((e.weight for e in v.groups if e.group == g.index), 0)
            if w < 0.2: continue
            p = mw @ v.co; c = h0 + ax * (p - h0).dot(ax)
            k = 1 - (1 - K) * min(1, (w - 0.2) / 0.5)           # 뿌리 쪽(무게 작은 곳)은 덜, 엄지 몸통은 0.68배
            v.co = inv @ (c + (p - c) * k)
    # V1671 C 사용자: 손등이 손가락 쪽으로 내려오는 곳의 통통함을 아주 조금 — 손 뼈 줄기 쪽으로, 손가락 가까울수록 최대 0.88배
    for sfx in (() if __import__('os').environ.get('NO_PALM') else ('.L', '.R')):  # NO_PALM=1 = 손등 수정 빼고(손가락만)
        g = sk.vertex_groups.get('Hand' + sfx)
        if not g: continue
        h0 = arm.matrix_world @ arm.data.bones['Hand' + sfx].head_local
        fm = sum((arm.matrix_world @ arm.data.bones['Finger%d%s' % (i, sfx)].head_local for i in (1, 2, 3)), mathutils.Vector()) / 3
        ax = (fm - h0); ln = ax.length; ax.normalize()
        for v in sk.data.vertices:
            w = next((e.weight for e in v.groups if e.group == g.index), 0)
            if w < 0.3: continue
            p = mw @ v.co; t = (p - h0).dot(ax) / ln
            if t < 0.1: continue
            u = min(1, (t - 0.1) / 0.9); u = u * u * (3 - 2 * u); c = h0 + ax * (p - h0).dot(ax)  # 손목부터 천천히(줄 안 생기게)
            v.co = inv @ (c + (p - c) * (1 - 0.12 * u * min(1, (w - 0.3) / 0.5)))
    # V1671 C 사용자: 손등만 90% — 손 뼈 무게 큰 곳을 손등 가운데 쪽으로 0.9배(무게 따라 부드럽게 섞어 이음매 없음)
    if __import__('os').environ.get('PALM90'):
        for sfx in ('.L', '.R'):
            g = sk.vertex_groups.get('Hand' + sfx)
            if not g: continue
            W = [(v, next((e.weight for e in v.groups if e.group == g.index), 0)) for v in sk.data.vertices]
            core = [mw @ v.co for v, w in W if w > 0.8]
            if not core: continue
            c = sum(core, mathutils.Vector()) / len(core)
            for v, w in W:
                if w < 0.2: continue
                u = min(1, (w - 0.2) / 0.6); u = u * u * (3 - 2 * u); p = mw @ v.co
                v.co = inv @ (c + (p - c) * (1 - 0.1 * u))
    # V1671 C 사용자: 손 전체 110% — 손목(손 뼈 시작점) 기준, 손·손가락·엄지 뼈 무게 합으로 부드럽게 섞음
    if __import__('os').environ.get('HAND110'):
        for sfx in ('.L', '.R'):
            gi = {sk.vertex_groups[b + sfx].index for b in ('Hand', 'Thumb', 'Finger1', 'Finger2', 'Finger3') if sk.vertex_groups.get(b + sfx)}
            c = arm.matrix_world @ arm.data.bones['Hand' + sfx].head_local
            for v in sk.data.vertices:
                w = sum(e.weight for e in v.groups if e.group in gi)
                if w < 0.2: continue
                u = min(1, (w - 0.2) / 0.6); u = u * u * (3 - 2 * u); p = mw @ v.co
                v.co = inv @ (c + (p - c) * (1 + float(__import__('os').environ.get('HAND110')) * u))  # HAND110 = 키우는 양(0.1 = 110%)
    # V1671 C 사용자: 엄지 빼고 손가락 3개를 손등 쪽으로 올려 자연스럽게 붙임 — 손가락 뼈 무게만큼 손등 가운데 방향으로 FINGER_UP 만큼
    up = float(__import__('os').environ.get('FINGER_UP', '0'))
    if up:
        for sfx in ('.L', '.R'):
            hg = sk.vertex_groups.get('Hand' + sfx); core = [mw @ v.co for v in sk.data.vertices if any(e.group == hg.index and e.weight > 0.8 for e in v.groups)]
            pc = sum(core, mathutils.Vector()) / len(core)
            gi = {sk.vertex_groups[b + sfx].index for b in ('Finger1', 'Finger2', 'Finger3') if sk.vertex_groups.get(b + sfx)}
            for v in sk.data.vertices:
                w = sum(e.weight for e in v.groups if e.group in gi)
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); p = mw @ v.co; d = (pc - p); d.x *= 0.3; d.normalize()
                v.co = inv @ (p + d * up * u)
    # V1671 C 사용자: 엄지 빼고 손가락 3개를 손등 바깥쪽(몸에서 먼 쪽)으로 옮김 — FINGER_OUT 만큼, 뿌리는 덜
    fo = float(__import__('os').environ.get('FINGER_OUT', '0'))
    if fo:
        for sfx in ('.L', '.R'):
            od = mathutils.Vector((1 if sfx == '.R' else -1, 0, 0))
            gi = {sk.vertex_groups[b + sfx].index for b in ('Finger1', 'Finger2', 'Finger3') if sk.vertex_groups.get(b + sfx)}
            for v in sk.data.vertices:
                w = sum(e.weight for e in v.groups if e.group in gi)
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); p = mw @ v.co
                v.co = inv @ (p + od * fo * u)
    # V1671 C 사용자: 가운데 손가락(Finger2)만 바깥쪽으로 더 — MID_OUT 만큼
    mo = float(__import__('os').environ.get('MID_OUT', '0'))
    if mo:
        for sfx in ('.L', '.R'):
            od = mathutils.Vector((1 if sfx == '.R' else -1, 0, 0)); g = sk.vertex_groups.get('Finger2' + sfx)
            for v in sk.data.vertices:
                w = next((e.weight for e in v.groups if e.group == g.index), 0)
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); v.co = inv @ ((mw @ v.co) + od * mo * u)
    # V1671 C 사용자: 가운데 손가락만 MID_SCALE 배(뿌리 = 손등과 만나는 곳 기준)
    ms = float(__import__('os').environ.get('MID_SCALE', '1'))
    if ms != 1:
        for sfx in ('.L', '.R'):
            g = sk.vertex_groups.get('Finger2' + sfx)
            VW = [(v, next((e.weight for e in v.groups if e.group == g.index), 0)) for v in sk.data.vertices]
            fp = sorted((mw @ v.co for v, w in VW if w > 0.5), key=lambda p: -p.z); jn = fp[:max(1, len(fp) // 8)]  # 뿌리 = 손가락 맨 위(손등 쪽) 부분
            root = sum(jn, mathutils.Vector()) / len(jn)
            for v, w in VW:
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); p = mw @ v.co
                v.co = inv @ (root + (p - root) * (1 + (ms - 1) * u))
    # V1671 C 사용자: 옆에서 볼 때 오른쪽(얼굴 쪽, 앞) 손가락만 FRONT_SCALE 배 — 왼손 Finger3·오른손 Finger1
    fs_ = float(__import__('os').environ.get('FRONT_SCALE', '1'))
    if fs_ != 1:
        for sfx, bn in (('.L', 'Finger3'), ('.R', 'Finger1')):
            g = sk.vertex_groups.get(bn + sfx)
            VW = [(v, next((e.weight for e in v.groups if e.group == g.index), 0)) for v in sk.data.vertices]
            fp = sorted((mw @ v.co for v, w in VW if w > 0.5), key=lambda p: -p.z); jn = fp[:max(1, len(fp) // 8)]
            root = sum(jn, mathutils.Vector()) / len(jn)
            for v, w in VW:
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); p = mw @ v.co
                v.co = inv @ (root + (p - root) * (1 + (fs_ - 1) * u))
    # V1676 C 사용자: 엄지를 아래쪽으로 조금(THUMB_DOWN 만큼, 뿌리는 덜)
    td = float(__import__('os').environ.get('THUMB_DOWN', '0'))
    if td:
        for sfx in ('.L', '.R'):
            g = sk.vertex_groups.get('Thumb' + sfx)
            for v in sk.data.vertices:
                w = next((e.weight for e in v.groups if e.group == g.index), 0)
                if w < 0.05: continue
                u = min(1, w / 0.7); u = u * u * (3 - 2 * u); v.co = inv @ ((mw @ v.co) + mathutils.Vector((0, 0, -td * u)))
    sk.data.update(); print('THUMB', n)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_apply=False, export_skins=True)
print('THUMB_READY', out)
if rend:
    arm.data.pose_position = 'REST'; sk = sc.objects['Mole_Clay_Skin']
    for o in list(sc.objects):
        if o.type == 'MESH' and o is not sk: o.hide_render = True
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.render.resolution_x = 500; sc.render.resolution_y = 500
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); cam.data.type = 'ORTHO'; sc.camera = cam
    hh = arm.matrix_world @ arm.data.bones['Hand.L'].head_local
    for nm, d in (('handF', mathutils.Vector((0, -1, 0))), ('handS', mathutils.Vector((-1, -0.3, 0)).normalized())):
        tgt = hh + mathutils.Vector((0, 0, -0.16)); cam.location = tgt + d * 10; cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); cam.data.ortho_scale = float(__import__('os').environ.get('ORTHO', '0.6'))
        sc.render.filepath = rend + '_' + nm + '.png'; bpy.ops.render.render(write_still=True)

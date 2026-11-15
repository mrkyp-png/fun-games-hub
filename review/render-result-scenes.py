# 성공·실패 화면 시안: 게임 3D 두더지(review/result-scene/*.glb)로 장면 렌더 → 바탕화면 결과화면_시안/
import bpy, math, os, sys
from mathutils import Vector
SRC = r"C:\Users\master\Desktop\fun-games-hub\review\result-scene"
OUT = r"C:\Users\master\Desktop\결과화면_시안"
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = True
    sc.render.resolution_x = 1024; sc.render.resolution_y = 1024
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .9
    for name, rot, e in [('key', (55, 0, -35), 3.2), ('fill', (60, 0, 140), 1.2)]:
        d = bpy.data.lights.new(name, 'SUN'); d.energy = e; o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = tuple(math.radians(v) for v in rot)
    return sc

def place(name, action, frac, loc, rot_z=0, tilt=(0, 0), size=3.0):
    before = set(bpy.data.objects); acts0 = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next((o for o in new if o.type == 'ARMATURE'), None)
    roots = [o for o in new if o.parent is None]
    acts = [a for a in bpy.data.actions if a not in acts0]
    act = next((a for a in acts if a.name.split('.')[0] == action or a.name.startswith(action)), None)
    if arm and act:
        arm.animation_data_create(); arm.animation_data.action = act
        try:
            if act.slots: arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
        f0, f1 = act.frame_range; frame = f0 + (f1 - f0) * frac
    else:
        frame = 0
    for o in new:  # 다른 동작 트랙 끄기
        if o.animation_data and o.animation_data.nla_tracks:
            for t in o.animation_data.nla_tracks: t.mute = True
    return {'roots': roots, 'objs': new, 'frame': frame, 'loc': loc, 'rot_z': rot_z, 'tilt': tilt, 'size': size, 'name': name, 'found': bool(act)}

def finish(items, cam_loc, cam_target, lens, path):
    sc = bpy.context.scene
    for it in items:
        sc.frame_set(int(round(it['frame'])))
        bpy.context.view_layer.update()
        meshes = [o for o in it['objs'] if o.type == 'MESH']
        mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
        dg = bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            ev = o.evaluated_get(dg); me = ev.to_mesh()
            for v in me.vertices:
                w = ev.matrix_world @ v.co; mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
            ev.to_mesh_clear()
        h = max(1e-3, mx.z - mn.z); k = it['size'] / h
        e = bpy.data.objects.new('ctl_' + it['name'], None); sc.collection.objects.link(e)
        for r in it['roots']: r.parent = e
        c = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
        for r in it['roots']: r.location -= c
        e.scale = (k, k, k); e.location = it['loc']
        e.rotation_euler = (math.radians(it['tilt'][0]), math.radians(it['tilt'][1]), math.radians(it['rot_z']))
        it['ctl'] = e
    # 각자 정해진 프레임으로 고정(모델마다 동작 시각이 다름): 동작을 그 프레임 한 장짜리로 굽지 않고 NLA 대신 frame_set 마다 바뀌므로, 렌더 직전 프레임별로 나눠 그리지 않게 action 시간을 맞춤
    for it in items:
        for o in it['objs']:
            ad = o.animation_data
            if ad and ad.action:
                f0, f1 = ad.action.frame_range
                st = ad.nla_tracks.new(); s = st.strips.new('pose', int(f0), ad.action)
                s.action_frame_start = it['frame']; s.action_frame_end = it['frame'] + 1; s.frame_start = 1; s.frame_end = 2
                ad.action = None
    sc.frame_set(1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = lens; cam.location = cam_loc; cam.rotation_euler = (Vector(cam_target) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
    print('RENDER', path, [(i['name'], i['found']) for i in items])

# 성공: 주인공 만세(가운데 앞) + 뒤에 나쁜 두더지들 쓰러짐(소품 들고)
reset()
items = [place('hero', 'ArmsUp', .75, (0, 1.2, 0), 0, size=3.4)]
# 나쁜 두더지 = 주인공 앞쪽 바닥에 뒤로 벌러덩(얼굴이 위·카메라 쪽), 소품은 손에
for i, (k, x, y, tz) in enumerate([('bad-drink', -3.0, -0.6, 25), ('bad-smoke', -1.1, -1.6, 8), ('bad-phone', 1.1, -1.6, -8), ('bad-thief', 3.0, -0.6, -25)]):
    items.append(place(k, 'Behavior', .4, (x, y, .5), tz, (-72, 0), size=2.5))
finish(items, (0, -10.5, 7.2), (0, 0.2, 1.0), 40, os.path.join(OUT, '성공_시안1.png'))

# 실패: 나쁜 두더지 4마리가 각자 동작(놀림), 앞에서 주인공 아파함
reset()
items = [place('hero', 'PainHit', .45, (0, -1.2, 0), 0, size=2.9)]
for i, (k, x, y, tz, fr) in enumerate([('bad-drink', -3.3, 1.6, 20, .55), ('bad-smoke', -1.15, 2.4, 8, .5), ('bad-phone', 1.15, 2.4, -8, .5), ('bad-thief', 3.3, 1.6, -20, .35)]):
    items.append(place(k, 'Behavior', fr, (x, y, 0), tz, size=3.1))
finish(items, (0, -11, 4.0), (0, 1.0, 1.5), 45, os.path.join(OUT, '실패_시안1.png'))
print('RESULT_DONE')

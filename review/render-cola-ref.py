# 음료 두더지 시안용 참고 그림: 지금 술 두더지(behavior-drink.glb) 를 마시는 동작 중간 자세로 정면 렌더
import bpy, math, os
from mathutils import Vector
SRC = r"C:\Users\master\Desktop\fun-games-hub\mole\assets\characters-v1725\behavior-drink.glb"
OUT = r"C:\Users\master\Desktop\콜라두더지_시안"; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = False; sc.render.resolution_x = 768; sc.render.resolution_y = 960
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
for name, rot, e in [('key', (55, 0, -35), 3.0), ('fill', (60, 0, 140), 1.2), ('front', (70, 0, 0), 2.0)]:
    d = bpy.data.lights.new(name, 'SUN'); d.energy = e; o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.rotation_euler = tuple(math.radians(v) for v in rot)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
act = next((a for a in bpy.data.actions if a.name.startswith('Behavior')), None)
print('ACTIONS', [a.name for a in bpy.data.actions])
names = sorted({o.name for o in bpy.data.objects if o.type == 'MESH'})
print('MESHES', names)
if arm and act:
    arm.animation_data_create(); arm.animation_data.action = act
    try:
        if act.slots: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
fr = act.frame_range if act else (1, 1)
for o in bpy.data.objects:
    if o.name.startswith('Bottle text en'): o.hide_render = True
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'
for i, k in enumerate([0.05, 0.4, 0.75]):
    sc.frame_set(int(fr[0] + (fr[1] - fr[0]) * k)); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in meshes:
        ev = o.evaluated_get(dg); me = ev.to_mesh()
        for v in me.vertices:
            p = ev.matrix_world @ v.co; mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
        ev.to_mesh_clear()
    c = (mn + mx) / 2; cam.data.ortho_scale = max(mx.z - mn.z, (mx.x - mn.x) * 960 / 768) * 1.1
    cam.location = (c.x, mn.y - 20, c.z); cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = os.path.join(OUT, f'블렌더_콜라두더지_{i + 1}.png'); bpy.ops.render.render(write_still=True)
print('DONE')

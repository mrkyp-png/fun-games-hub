# 폭탄 든 두더지(CarryIdle) 정면 렌더 — 손 위치 확인용
import bpy, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\characters-v1692\mole-game-smile.glb")
for o in bpy.data.objects:
    if o.name == 'Mole_Clay_Skin': o.hide_render = True
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
act = bpy.data.actions.get('CarryIdle')
arm.animation_data_create(); arm.animation_data.action = act
try:
    if act.slots: arm.animation_data.action_slot = act.slots[0]
except Exception: pass
sc = bpy.context.scene; sc.frame_set(int(act.frame_range[0]) + 6)
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x = sc.render.resolution_y = 700; sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); w.color = (0.9, 0.9, 0.9); sc.world = w
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.4
for name, loc in (('front', (0, -8, 1.5)), ('side', (8, 0, 1.5))):
    cam.location = loc; d = Vector((0, 0, 1.5)) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    for i, e in enumerate([(50, 0, 30), (60, 0, -40)]):
        pass
    if not any(o.type == 'LIGHT' for o in bpy.data.objects):
        L = bpy.data.objects.new('l', bpy.data.lights.new('l', 'SUN')); L.data.energy = 4; L.rotation_euler = (math.radians(50), 0, math.radians(20)); sc.collection.objects.link(L)
    sc.render.filepath = OUT + '_' + name + '.png'; bpy.ops.render.render(write_still=True)

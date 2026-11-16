# 방귀 두더지 정지 자세 렌더(정면) — 시각별
import bpy, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\characters-v1728\behavior-smoke.glb")
act = bpy.data.actions['Behavior']
for o in bpy.data.objects:
    if o.animation_data is None: o.animation_data_create()
    if o.type == 'ARMATURE' or o.name.startswith(('Tip smoke', 'Fart cloud')):
        o.animation_data.action = act
        try:
            if act.slots:
                s = next((s for s in act.slots if o.name in s.name_display), act.slots[0]); o.animation_data.action_slot = s
        except Exception: pass
sc = bpy.context.scene; fps = sc.render.fps / sc.render.fps_base
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x = sc.render.resolution_y = 600
w = bpy.data.worlds.new('w'); w.color = (0.85, 0.85, 0.85); sc.world = w
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 4.4
cam.location = (0, -8, 1.8); cam.rotation_euler = (Vector((0, 0, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
L = bpy.data.objects.new('l', bpy.data.lights.new('l', 'SUN')); L.data.energy = 4; L.rotation_euler = (math.radians(50), 0, math.radians(20)); sc.collection.objects.link(L)
for t in (0.75,):
    sc.frame_set(int(round(t * fps)) + 1); sc.render.filepath = '%s_%.2f.png' % (OUT, t); bpy.ops.render.render(write_still=True)

# 광장 안의 리듬팡 건물(카세트 오디오) 확인 렌더 — 섬 중심 쪽에서 건물을 봄
import bpy, math, sys
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\home3d\plaza.blend")
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1000, 1200
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.75, .88, 1, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6; sc.world = w
site = bpy.data.objects['Site_rhythm'].matrix_world.translation
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 35
d = (Vector((0, 0, 0)) - site).normalized()
cam.location = site + d * 10 + Vector((0, 0, 4.5)); cam.rotation_euler = (site + Vector((0, 0, 1.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
L = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); L.data.energy = 3.5; L.rotation_euler = (math.radians(50), 0, math.radians(-30)); sc.collection.objects.link(L)
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True)

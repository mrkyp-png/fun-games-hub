import bpy,math,sys
from pathlib import Path
from mathutils import Vector
folder=Path(__file__).resolve().parent/'beach-stunts-v1690'
bpy.ops.wm.read_factory_settings(use_empty=True)
forelock='--forelock' in sys.argv
bpy.ops.import_scene.gltf(filepath=str(folder/('forelock-poses.glb' if forelock else 'runtime-poses.glb')))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('QA studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.2,.29,.4,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
bpy.ops.object.camera_add(location=(5,-20,5.6));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=13;camera.rotation_euler=(Vector((4.5,0,4.1))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-1,-5,11));light=bpy.context.object;light.data.energy=1500;light.data.size=8;light.rotation_euler=(Vector((4,0,4))-light.location).to_track_quat('-Z','Y').to_euler()
if forelock:
    scene.render.resolution_y=480;camera.location=(5,-20,3.1);camera.rotation_euler=(Vector((4.5,0,2.0))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/('forelock-poses.png' if forelock else 'runtime-poses.png'));bpy.ops.render.render(write_still=True)
print('RENDERED actual runtime poses; not a browser screenshot')

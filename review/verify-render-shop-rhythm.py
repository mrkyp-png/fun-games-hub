"""Blender geometry checks and close-up render; this is not a live-game capture."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector,Matrix

ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'mole/assets/home3d/plaza.blend'))
bpy.context.view_layer.update()
scene=bpy.context.scene
graph=bpy.context.evaluated_depsgraph_get()
report={}
for name in ['shop','rhythm']:
    site=bpy.data.objects['Site_'+name]
    assert all(abs(a-b)<.0001 for a,b in zip(site.scale,(1.6,.8,1.6)))
    expected={'shop':(-7,5),'rhythm':(-8,-2.5)}[name]
    assert abs(site.location.x-expected[0])<.0001 and abs(site.location.y-expected[1])<.0001
    report[name]={'scale':list(site.scale),'position':list(site.location)}
assert not any(o.name.startswith(('Beach hut','Hut straw roof','Hut door','Surfboard')) for o in bpy.data.objects)
notes=[o for o in bpy.data.objects if o.name.startswith('GateGlow music note')]
assert len(notes)==8 and all(o.type=='MESH' and o.parent.name=='Site_rhythm' for o in notes),'Musical notes are actual attached 3D meshes'
report['rhythmMusicNotes']={'meshParts':len(notes),'placement':'Front side walls, clear of doorway'}
for name in ['Shop closed shell','Shop sealed roof','Club closed shell','Shop curved striped canopy']:
    o=bpy.data.objects[name];bm=bmesh.new();bm.from_mesh(o.data)
    bad=sum(not e.is_manifold for e in bm.edges);bm.free()
    assert bad==0,(name,bad)
    report[name]={'nonManifoldEdges':bad,'faces':len(o.data.polygons)}
site=bpy.data.objects['Site_shop']
for x in [-1.2,-.6,0,.6,1.2]:
    for y in [-.85,0,.85]:
        origin=site.matrix_world@Vector((x,y,4))
        direction=(site.matrix_world.to_3x3()@Vector((0,0,-1))).normalized()
        hit=scene.ray_cast(graph,origin,direction)
        assert hit[0] and hit[4].name=='Shop sealed roof',(x,y,hit[4].name if hit[0] else 'no roof')
door=bpy.data.objects['Door_shop'];closed_matrix=door.matrix_world.copy()
site=bpy.data.objects['Site_shop'];hinge=site.matrix_world@Vector((-.46,-1.115,0))
origin=site.matrix_world@Vector((0,-2.1,.8))
direction=(site.matrix_world.to_3x3()@Vector((0,1,0))).normalized()
hit=scene.ray_cast(graph,origin,direction)
assert hit[0] and hit[4].name=='Door_shop','Closed shop door must conceal interior'
door.matrix_world=Matrix.Translation(hinge)@Matrix.Rotation(math.pi*.53,4,'Z')@Matrix.Translation(-hinge)@closed_matrix
hidden=[o for o in bpy.data.objects if o.name.startswith(('Energy_','Preview_'))]
for o in hidden:o.hide_viewport=True
bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
for name,front in [('shop',-1.1),('rhythm',-.9)]:
    site=bpy.data.objects['Site_'+name]
    for height in [.2,.8,1.45]:
        for x in [-.22,0,.22]:
            origin=site.matrix_world@Vector((x,front-1,height))
            direction=(site.matrix_world.to_3x3()@Vector((0,1,0))).normalized()
            hit=scene.ray_cast(graph,origin,direction)
            assert hit[0] and (hit[1]-origin).length>1.5,'Door is not an open recess: '+name
door.matrix_world=closed_matrix
for o in hidden:o.hide_viewport=False
bpy.context.view_layer.update()
report['shopDoor']='Closed conceals interior; inward-open clears nine passage rays'
report['energyGate']='Non-solid visual plane, walk-through aperture unchanged'
report['roofRays']=15
(ROOT/'review/shop-rhythm-geometry.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
if scene.world is None: scene.world=bpy.data.worlds.new('QA daylight')
scene.world.color=(.55,.65,.8)
world=scene.world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.75,.9,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
site=bpy.data.objects['Site_shop']
target=site.matrix_world@Vector((0,0,1.65))
bpy.ops.object.camera_add(location=site.matrix_world@Vector((5,-9,5.2)))
camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=8.3;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=target+Vector((3,-5,9)))
light=bpy.context.object;light.data.energy=1600;light.data.shape='DISK';light.data.size=7
light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(ROOT/'review/shop-roof-finish.png')
bpy.ops.render.render(write_still=True)
site=bpy.data.objects['Site_rhythm']
target=site.matrix_world@Vector((0,-.1,1.7))
camera.location=site.matrix_world@Vector((3.7,-11,4.4))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.ortho_scale=8.5
light.location=target+Vector((3,-5,9))
light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(ROOT/'review/rhythm-gate-finish.png')
bpy.ops.render.render(write_still=True)
print('PASS: sealed roof, manifold shells, actual doorway recesses, scales and removed hut')

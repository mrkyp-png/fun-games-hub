"""Derived clone-only mesh. Original inventory/main weapon remains unchanged."""
import bpy,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=root/'mole/assets/shop-models-v1509/goldhammer-v18-batched-v1520.glb'
folder=root/'mole/assets/weapons-3d-v1691';folder.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
before=after=0
for obj in list(bpy.context.scene.objects):
    if obj.type!='MESH':continue
    before+=sum(len(p.vertices)-2 for p in obj.data.polygons)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Clone mesh only','DECIMATE');mod.ratio=.5 if 'paw pad' in obj.name.lower() else .18;mod.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    after+=sum(len(p.vertices)-2 for p in obj.data.polygons)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'review/goldhammer-clone-v1691.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'goldhammer-clone.glb'),export_format='GLB',export_animations=False,export_apply=True)
(folder/'manifest.json').write_text(json.dumps({'source':str(source.relative_to(root)),'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceTriangles':before,'cloneTriangles':after,'usage':'clone only; main retains original; same coordinate frame and material identities'},indent=2)+'\n',encoding='utf-8')
print('GOLD_CLONE_LOD',before,after)

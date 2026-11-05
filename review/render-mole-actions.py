# 작업 7: v44 새 동작 확인용 Blender 렌더(GLB 재수입 → 실제 스킨 변형). 실제 브라우저 화면 아님.
# 실행: blender -b -P review/render-mole-actions.py
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT = Path('C:/Users/master/Desktop/fun-games-hub')
OUT = Path('C:/Users/master/AppData/Local/Temp/claude/C--Users-master-Desktop/77ed3fc6-aa15-4a23-aaaf-cbe0d129e345/scratchpad/actions'); OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'mole/assets/checkerboard-v1590/mole-clay-v44.glb'))
for o in scene.objects:
    if o.type == 'MESH' and not o.name.startswith('Mole_Clay_Skin'): o.hide_render = True
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
def aim(o, p): o.rotation_euler = (Vector(p) - o.location).to_track_quat('-Z', 'Y').to_euler()
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.85, .88, .9, 1)
d = bpy.data.lights.new('key', 'SUN'); d.energy = 3; L = bpy.data.objects.new('key', d); scene.collection.objects.link(L); L.rotation_euler = (math.radians(50), 0, math.radians(30))
bpy.ops.mesh.primitive_plane_add(size=20); fl = bpy.context.object
cd = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cd); scene.collection.objects.link(cam); scene.camera = cam; cd.lens = 50
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = scene.render.resolution_y = 320; scene.render.fps = 30
scene.render.image_settings.file_format = 'PNG'

def use(action_name):
    rig.animation_data.action = None
    for tr in rig.animation_data.nla_tracks: tr.mute = not (tr.name == action_name or tr.name.startswith(action_name + '_') or tr.name.startswith(action_name + '.'))
# glTF 좌표: 얼굴 +z(glTF) = Blender -Y. 옆 = Blender +X 에서 봄
def shot(name, action, t, side):
    use(action); scene.frame_set(int(round(t * 30)) + 1)
    cam.location = (6, 0, 1.4) if side else (2.6, -5.2, 1.8)
    aim(cam, (0, 0, .85)); scene.render.filepath = str(OUT / name); bpy.ops.render.render(write_still=True)
for i, t in enumerate([0, .2, .4, .6]): shot('walk_%d.png' % i, 'WalkFwd', t, True)
for i, t in enumerate([0, .1, .3, .5]): shot('jump_%d.png' % i, 'Jump', t, True)
for i, (a, t) in enumerate([('Sleep', 0), ('Wake', .9), ('Dig', .17), ('Dig', .52)]): shot('pose_%d.png' % i, a, t, False)
print('ACTION_RENDERS_READY', [t.name for t in rig.animation_data.nla_tracks][:30])

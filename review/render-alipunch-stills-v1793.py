# V1793 C 사용자: 킹판취 3D 글러브로 메뉴용 그림 — 인벤토리·상점 한 짝(손등 쪽, 옛 kingfist-jab-mirror 와 같은 구도), 제작소·우편함 두 짝(손바닥·메달 쪽 마주 봄)
# 투명 배경 렌더만 함(합치기·크기 맞춤은 make-alipunch-stills-v1793 단계에서 PIL).  사용: blender -b --python ... -- <glove.glb> <출력 접두사>
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
eng = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in eng else 'BLENDER_EEVEE'
sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = True
sc.render.resolution_x = 1200; sc.render.resolution_y = 1200
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
for nm, loc, en in (('key', (-2.2, -3.0, 3.4), 520), ('fill', (3.0, -1.6, 1.4), 200), ('rim', (0.8, 3.2, 2.6), 380), ('back', (-1.5, 3.0, 1.0), 160)):
    ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = en; ld.size = 3; lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo)
    lo.location = loc; lo.rotation_euler = (Vector((0, 0, 0.5)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 1.12; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
tgt = Vector((0, 0, 0.5))
# 블렌더: -Y = 손바닥·메달 쪽(정면), +Y = 손등.  yaw = 위에서 볼 때 카메라 방향 각도
for nm, yaw in (('back', math.radians(180 + 18)), ('front', math.radians(22))):
    d = Vector((math.sin(yaw), -math.cos(yaw), 0.18)).normalized()
    cam.location = tgt + d * 4; cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = out + '-' + nm + '.png'; bpy.ops.render.render(write_still=True)
print('RENDER done')

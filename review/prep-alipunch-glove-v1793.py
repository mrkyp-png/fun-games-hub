# V1793 C 사용자: 킹판취 = Tripo '빨간 복싱 글러브'(바탕화면 red boxing glove 3d model.glb) — 게임용 정리
# 텍스처 4096 → 2048 JPEG(휴대폰 부담), 모양·방향은 그대로(glTF: +Y 위, +Z = 손바닥·메달 쪽, 높이 1). 원본 파일은 건드리지 않음.
# 사용: blender -b --python prep-alipunch-glove-v1793.py -- <원본.glb> <출력.glb>
import bpy, sys
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for img in bpy.data.images:
    if img.size[0] > 2048:
        img.scale(2048, 2048)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in ms: o.name = 'alipunch_glove'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88)
print('SAVED', out, [(i.name, tuple(i.size)) for i in bpy.data.images])

# 콜라 두더지: 마시는 순간(병 입구가 입에 닿고 병이 들린 때) 찾기 + 손 크기 확인
import bpy, math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\characters-v1725\behavior-drink.glb")
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); act = bpy.data.actions['Behavior']
arm.animation_data_create(); arm.animation_data.action = act
try:
    if act.slots: arm.animation_data.action_slot = act.slots[0]
except Exception: pass
sc = bpy.context.scene; fps = sc.render.fps / sc.render.fps_base
rim = bpy.data.objects['Open bottle rim']; pb = arm.pose.bones
f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
print('FPS', fps, 'frames', f0, f1)
for f in range(f0, f1 + 1, 3):
    sc.frame_set(f); bpy.context.view_layer.update()
    head = arm.matrix_world @ pb['Head'].head; jaw = arm.matrix_world @ pb['Jaw'].head if 'Jaw' in pb else head
    r = rim.matrix_world.translation
    hl = pb['Hand.L'].matrix.to_scale(); hr = pb['Hand.R'].matrix.to_scale()
    print('F %3d t=%.2f rim-jaw=%.3f rimZ-headZ=%.3f handL=%.2f handR=%.2f' % (f, (f - f0) / fps, (r - jaw).length, r.z - head.z, hl.x, hr.x))

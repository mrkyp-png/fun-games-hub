import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\home3d\plaza.blend")
for o in bpy.data.objects:
    n = o.name.lower()
    if any(k in n for k in ('rhythm', 'gate', 'music', 'speaker', 'tunnel')):
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box] if o.type == 'MESH' else [o.matrix_world.translation]
        mn = [min(v[i] for v in bb) for i in range(3)]; mx = [max(v[i] for v in bb) for i in range(3)]
        print('OBJ', o.name, o.type, [round(x, 2) for x in mn], [round(x, 2) for x in mx], o.parent.name if o.parent else '')

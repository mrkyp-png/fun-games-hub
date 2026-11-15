import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\master\Desktop\fun-games-hub\mole\assets\characters-v1694\behavior-drink.glb")
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    mats = []
    for s in o.material_slots:
        m = s.material; col = None
        if m and m.use_nodes:
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b: col = tuple(round(v, 3) for v in b.inputs['Base Color'].default_value)
            tex = any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes)
        mats.append((m.name if m else None, col, tex if m else None))
    print('OBJ', o.name, 'parent', o.parent.name if o.parent else None, 'pbone', o.parent_bone, 'verts', len(o.data.vertices), 'vcol', [a.name for a in o.data.color_attributes], mats)

# V1787 C 사용자: 크라켄 다리에 뼈대 — 다리 8개마다 뿌리→끝 뼈 12개(b00..b11), 살은 '뿌리에서 다리 표면 따라 잰 거리'로 이웃 뼈 2개에 나눠 묶음.
# 입력 kraken.glb(V1785 C) → 출력 kraken-rig.glb. 머리는 그대로. 다리 노드 extras.kr_heads = 뼈 머리 위치(glTF 좌표, 다리 로컬, 13개 = 끝 포함).
# 사용: blender -b --python rig-kraken-legs-v1787.py -- src.glb out.glb
import bpy, bmesh, sys, heapq
from mathutils import Vector, kdtree
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
NB = 12
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for ob in sorted([o for o in sc.objects if o.type == 'MESH' and o.name.startswith('leg')], key=lambda o: o.name):
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    n = len(bm.verts)
    co = [v.co.copy() for v in bm.verts]
    lens = [c.length for c in co]
    lo = min(lens)
    # 뿌리 = 원점 가까운 점들, 표면 따라 거리(다익스트라)
    dist = [float('inf')] * n
    pq = []
    for i in range(n):
        if lens[i] < lo + 0.06:
            dist[i] = 0.0; pq.append((0.0, i))
    heapq.heapify(pq)
    while pq:
        d, i = heapq.heappop(pq)
        if d > dist[i]: continue
        for e in bm.verts[i].link_edges:
            j = e.other_vert(bm.verts[i]).index
            nd = d + (co[i] - co[j]).length
            if nd < dist[j]:
                dist[j] = nd; heapq.heappush(pq, (nd, j))
    # 떨어진 조각(빨판 등) = 가장 가까운 연결된 점의 거리
    kd = kdtree.KDTree(n)
    have = [i for i in range(n) if dist[i] < float('inf')]
    for i in have: kd.insert(co[i], i)
    kd.balance()
    for i in range(n):
        if dist[i] == float('inf'):
            _, j, _ = kd.find(co[i]); dist[i] = dist[j]
    dmax = max(dist)
    s = [d / dmax for d in dist]
    # 뼈 머리 = 그 거리 근처 점들의 가운데
    heads = []
    for b in range(NB + 1):
        t = b / NB
        sel = [co[i] for i in have if abs(s[i] - t) < 0.025]
        if b == 0: sel = [co[i] for i in have if s[i] < 0.02]
        if b == NB: sel = [co[i] for i in have if s[i] > 0.985]
        heads.append(sum(sel, Vector()) / len(sel))
    bm.free()
    # 무게 = 뼈 가운데 기준 이웃 2개에 나눔
    groups = [ob.vertex_groups.new(name='b%02d' % b) for b in range(NB)]
    for i in range(n):
        u = s[i] * NB - 0.5
        j0 = int(u // 1); f = u - j0
        if j0 < 0: groups[0].add([i], 1.0, 'REPLACE'); continue
        if j0 >= NB - 1: groups[NB - 1].add([i], 1.0, 'REPLACE'); continue
        groups[j0].add([i], 1.0 - f, 'REPLACE'); groups[j0 + 1].add([i], f, 'REPLACE')
    # 뼈대(다리 로컬 = 다리 위치에 놓은 뼈대)
    arm = bpy.data.armatures.new(ob.name + '_rig')
    ao = bpy.data.objects.new(ob.name + '_rig', arm)
    sc.collection.objects.link(ao)
    ao.matrix_world = ob.matrix_world.copy()
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    prev = None
    for b in range(NB):
        eb = arm.edit_bones.new('%s_b%02d' % (ob.name, b))
        eb.head = heads[b]; eb.tail = heads[b + 1]
        if prev: eb.parent = prev; eb.use_connect = True
        prev = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in range(NB): ob.vertex_groups['b%02d' % b].name = '%s_b%02d' % (ob.name, b)
    mw = ob.matrix_world.copy()
    ob.parent = ao; ob.matrix_world = mw
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = ao
    ob['kr_heads'] = [x for h in heads for x in (h.x, h.z, -h.y)]
    print('RIG', ob.name, 'len', round(dmax, 3), 'heads', [tuple(round(x, 2) for x in h) for h in heads[::4]])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_extras=True, export_skins=True, export_animations=False, export_apply=False, export_yup=True)
print('DONE', out)

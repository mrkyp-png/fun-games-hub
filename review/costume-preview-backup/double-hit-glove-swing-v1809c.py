# 도복 미리보기: 소매+글러브만 어깨(몸통 고리 바깥)를 축으로 앞쪽으로 돌림. 몸통은 그대로.
import bpy, math, os, mathutils
OUT = os.path.dirname(os.path.abspath(__file__))
SRC = 'C:/Users/master/Desktop/fun-games-hub/mole/assets/costume-preview/double-hit.glb'
ANG = math.radians(float(os.environ.get('SWING', '60')))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
gi = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Gi and gloves')][0]
mw = gi.matrix_world; inv = mw.inverted()
vs = [mw @ v.co for v in gi.data.vertices]
# 몸통 고리: 허리 높이 점들로 중심·반지름 측정
ring = [v for v in vs if abs(v.x) < 0.3]
cy = (min(v.y for v in ring) + max(v.y for v in ring)) / 2
R = (max(v.y for v in ring) - min(v.y for v in ring)) / 2
print('x range', round(min(v.x for v in vs), 2), round(max(v.x for v in vs), 2))
print('ring cy', round(cy, 3), 'R', round(R, 3))
def smooth(a, b, t):
    k = max(0.0, min(1.0, (t - a) / (b - a))); return k * k * (3 - 2 * k)
for v, w in zip(gi.data.vertices, vs):
    r = math.hypot(w.x, w.y - cy)
    k = smooth(R - 0.02, R + 0.18, r)
    if k <= 0: continue
    s = 1 if w.x > 0 else -1
    px, py = s * R, cy  # 어깨 축(고리 옆면)
    a = -s * ANG * k     # 오른쪽은 시계, 왼쪽은 반시계 → 앞(-y)·안쪽
    dx, dy = w.x - px, w.y - py
    nx = px + dx * math.cos(a) - dy * math.sin(a); ny = py + dx * math.sin(a) + dy * math.cos(a)
    # 교차: 왼쪽(화면 오른쪽, x<0) 글러브를 앞·위로 띄워 서로 파고들지 않게
    lift = float(os.environ.get('LIFT', '0')) * k * k if s < 0 else 0
    v.co = inv @ mathutils.Vector((nx, ny - lift, w.z + lift * 0.6))
gi.data.update()
TAG = os.environ.get('TAG', '')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'double-hit-swing' + TAG + '.glb'), export_format='GLB', export_animations=False)
sc = bpy.context.scene
sc.render.resolution_x = 600; sc.render.resolution_y = 450; sc.render.film_transparent = True
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.2
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.2
for name, loc, rot in [('front', (0, -6, 1.2), (math.radians(90), 0, 0)), ('top', (0, 0, 7), (0, 0, 0)), ('side', (6, -0.1, 1.2), (math.radians(90), 0, math.radians(90)))]:
    cam.location = loc; cam.rotation_euler = rot
    sc.render.filepath = os.path.join(OUT, 'swing' + TAG + '-' + name + '.png'); bpy.ops.render.render(write_still=True)

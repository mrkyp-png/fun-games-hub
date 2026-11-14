# 동서남북 섬 4개(검토용) — 섬마다 한 덩어리 지형 + 큰 색 띠 + 볼거리 여러 개. 정점색(Color) 사용, 섬당 재질 1개.
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, noise
OUT = r"C:\Users\master\Desktop\동서남북_섬_시안"
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c] + [1]
MAT = bpy.data.materials.new("IslandVC"); MAT.use_nodes = True
nt = MAT.node_tree; bs = nt.nodes["Principled BSDF"]; bs.inputs["Roughness"].default_value = .85
ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Color"; nt.links.new(ca.outputs["Color"], bs.inputs["Base Color"])
EMIT = bpy.data.materials.new("LavaGlow"); EMIT.use_nodes = True
eb = EMIT.node_tree.nodes["Principled BSDF"]; eb.inputs["Base Color"].default_value = srgb("#ff5a1f"); eb.inputs["Emission Color"].default_value = srgb("#ff5a1f"); eb.inputs["Emission Strength"].default_value = 3

def paint(obj, fn):
    me = obj.data
    if "Color" not in me.color_attributes: me.color_attributes.new("Color", 'FLOAT_COLOR', 'CORNER')
    col = me.color_attributes["Color"]
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            col.data[li].color = fn(obj.matrix_world @ v, poly.normal)
def solid(h):
    c = srgb(h); return lambda p, n: c
def add(fn_mesh, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), color=None, name="part"):
    fn_mesh(); o = bpy.context.object; o.name = name
    o.location = loc; o.rotation_euler = rot; o.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if color: paint(o, color if callable(color) else solid(color))
    return o

def terrain(radius, height, seed, shape=None, bands=None, sides=144, rings=40):  # 촘촘하게(광장 가장자리 매끈)
    """둥근 섬: 해안선 노이즈 + 높이 프로필. bands=[(높이, 색)…] 높이별 색 띠"""
    bpy.ops.mesh.primitive_circle_add(vertices=sides, radius=1, fill_type='NOTHING')
    o = bpy.context.object; o.name = "terrain"
    bm = bmesh.new(); random.seed(seed)
    verts = [[None] * sides for _ in range(rings + 1)]
    top = bm.verts.new((0, 0, height))
    for r in range(1, rings + 1):
        t = r / rings
        for s in range(sides):
            a = 2 * math.pi * s / sides
            k = 1 + .14 * noise.noise(Vector((math.cos(a) * 2.1 + seed, math.sin(a) * 2.1, 0))) + .06 * math.sin(3 * a + seed)
            rr = radius * t * k
            x, y = rr * math.cos(a), rr * math.sin(a)
            if shape: x, y, sk = shape(x, y, a, t)
            else: sk = 1
            prof = (1 - t ** 2.2) * height * sk
            z = prof + .25 * height * noise.noise(Vector((x * .25 + seed, y * .25, 0))) * (1 - t)
            if t > .92: z = -.9 * (t - .92) / .08  # 물 아래로 잠기는 가장자리
            verts[r][s] = bm.verts.new((x, y, z))
    for s in range(sides):
        bm.faces.new((top, verts[1][s], verts[1][(s + 1) % sides]))
    for r in range(1, rings):
        for s in range(sides):
            bm.faces.new((verts[r][s], verts[r + 1][s], verts[r + 1][(s + 1) % sides], verts[r][(s + 1) % sides]))
    bm.normal_update(); bm.to_mesh(o.data); bm.free()
    for p in o.data.polygons: p.use_smooth = True
    def col(p, n):
        c = bands[0][1]
        for h, cc in bands:
            if p.z >= h: c = cc
        if n.z < .55 and p.z > .4: c = bands[-1][1] if len(bands) > 3 else c
        return srgb(c)
    paint(o, col)
    return o

def rock(loc, size, seed, color="#7c7468"):
    def mk(): bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    o = add(mk, loc, (0, 0, seed), (size, size * .85, size * .6), None, "rock")
    random.seed(seed)
    for v in o.data.vertices: v.co += (v.co - Vector(loc)).normalized() * random.uniform(-.06, .06) * size
    for p in o.data.polygons: p.use_smooth = True
    paint(o, solid(color)); return o

def palm(base, height, lean, seed):
    parts = []; random.seed(seed); p = Vector(base); d = Vector((math.cos(lean) * .25, math.sin(lean) * .25, 1)).normalized()
    for i in range(6):
        q = p + d * (height / 6)
        def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.22 - i * .02, depth=height / 6 + .05)
        mid = (p + q) / 2
        o = add(mk, mid, d.to_track_quat('Z', 'Y').to_euler(), (1, 1, 1), "#8a5a33" if i % 2 else "#a06a3c", "trunk")
        parts.append(o); p = q; d = (d + Vector((math.cos(lean) * .12, math.sin(lean) * .12, 0))).normalized()
    for k in range(7):
        a = 2 * math.pi * k / 7 + seed
        def mk(): bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=.45, radius2=0, depth=2.6)
        o = add(mk, p + Vector((math.cos(a) * 1.1, math.sin(a) * 1.1, -.25)), (math.radians(105), 0, a - math.pi / 2), (1, .25, 1), "#3f9b46" if k % 2 else "#55b55a", "leaf")
        parts.append(o)
    for k in range(3):
        def mk(): bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=.22)
        parts.append(add(mk, p + Vector((math.cos(k * 2.1) * .3, math.sin(k * 2.1) * .3, -.35)), (0, 0, 0), (1, 1, 1), "#6b4a2a", "coconut"))
    return parts

def tree(base, h, r, seed, leaf="#3f8f3f"):
    parts = []
    def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r * .18, depth=h)
    parts.append(add(mk, Vector(base) + Vector((0, 0, h / 2)), (0, 0, 0), (1, 1, 1), "#7a5230", "trunk"))
    random.seed(seed)
    for k in range(3):
        def mk(): bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r * (1 - k * .18))
        off = Vector((random.uniform(-.3, .3) * r, random.uniform(-.3, .3) * r, h + r * .5 * k))
        parts.append(add(mk, Vector(base) + off, (0, 0, 0), (1, 1, .85), leaf if k != 1 else "#4fa34a", "canopy"))
    return parts

def ground_z(obj, x, y):
    hit, loc, n, i = obj.ray_cast(Vector((x, y, 50)), Vector((0, 0, -1)))
    return loc.z if hit else 0

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
    o = bpy.context.object; o.name = name
    o.data.materials.clear(); o.data.materials.append(MAT)
    return o

islands = {}
WALK = {}  # 섬별 걷기 자료: 지형(terrain) + 막힘 원(blocks, 블렌더 섬 기준 좌표)
def walk_begin(key, t):
    # 지형만 있을 때(소품 합치기 전) 높이 격자를 잼. 게임 좌표 lx=블렌더x, lz=-블렌더y
    step, half = .5, 13; n = int(2 * half / step) + 1; hs = []
    for iz in range(n):
        for ix in range(n):
            lx, lz = -half + ix * step, -half + iz * step
            hit, loc, nn, fi = t.ray_cast(Vector((lx, -lz, 60)), Vector((0, 0, -1)))
            hs.append(round(loc.z, 3) if hit else -9)
    WALK[key] = {"h": hs, "n": n, "step": step, "half": half, "blocks": []}
def block(key, x, y, r): WALK[key]["blocks"].append((x, y, r))
def pad(key, x, y, r, top=0): WALK[key].setdefault("pads", []).append((x, y, r, top))  # 막힘보다 우선: 설 수 있는 자리(top=1 이면 소품 꼭대기 높이)
PLAZA_R = 3.5
def flatten(t, color, edge_hex="#b9a27a"):
    # 게임기 자리: 가운데 반지름 3.5 평평하게(가장자리 1.5 동안 원래 땅과 이어짐) + 광장 색
    h0 = ground_z(t, 0, 0) * .8
    for v in t.data.vertices:
        d = math.hypot(v.co.x, v.co.y)
        if d < PLAZA_R: v.co.z = h0
        elif d < PLAZA_R + 2.5: k = (d - PLAZA_R) / 2.5; k = k * k * (3 - 2 * k); v.co.z = h0 * (1 - k) + v.co.z * k  # 부드럽게 이어짐
    t.data.update()
    me = t.data; col = me.color_attributes["Color"]; c = srgb(color); edge = srgb(edge_hex)
    for poly in me.polygons:
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co; d = math.hypot(p.x, p.y)
            if d < PLAZA_R - .45: col.data[li].color = c
            elif d < PLAZA_R: col.data[li].color = edge
def round_plaza(t, color, edge_hex):
    # 동그란 원형 광장 판(남·북): 평평한 땅 위에 매끈한 원판 + 테두리 띠
    h0 = ground_z(t, 0, 0)
    def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=PLAZA_R + .25, depth=.3)
    rim = add(mk, (0, 0, h0 - .15), (0, 0, 0), (1, 1, 1), edge_hex, "plaza_rim")
    def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=72, radius=PLAZA_R - .1, depth=.3)
    top = add(mk, (0, 0, h0 - .12), (0, 0, 0), (1, 1, 1), color, "plaza")
    return [rim, top]
def away(x, y, minr=PLAZA_R + 1.8):
    d = math.hypot(x, y) or 1
    return (x, y) if d >= minr else (x / d * minr, y / d * minr)
# ---- 동: 해변섬 ----
t = terrain(9, 2.2, 1, bands=[(-9, "#e9d29a"), (.55, "#f1dca6"), (.9, "#7cc463"), (1.7, "#5fae4e")])
flatten(t, "#f3e3b8")
parts = [t]; walk_begin("east", t)
for i, (x, y, h, lean) in enumerate([(-5.4, 2.6, 5.2, .6), (-4.2, -4.0, 4.4, 2.6), (1.2, -5.8, 4.8, 4.3)]):  # 야자수 = 가장자리(가운데 게임기 자리)
    parts += palm((x, y, ground_z(t, x, y) - .1), h, lean, i + 1); block("east", x, y, .55)
ux, uy = 4.4, 4.4
block("east", ux, uy, .35)
def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=.06, depth=2.4)
pz = ground_z(t, ux, uy); parts.append(add(mk, (ux, uy, pz + 1.1), (0, 0, 0), (1, 1, 1), "#f3f3f3", "pole"))
def mk(): bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=1.5, radius2=.08, depth=.6)
parts.append(add(mk, (ux, uy, pz + 2.3), (0, 0, 0), (1, 1, 1), lambda p, n: srgb("#ff5b5b" if (math.atan2(p.y - uy, p.x - ux) * 6 / math.pi) % 2 < 1 else "#ffffff"), "umbrella"))
for k, (x, y, s) in enumerate([(6.8, -2, .9), (-6.5, -3.4, .7), (-5.2, 4.8, 1.1), (3.2, 6.3, .6)]):
    parts.append(rock((x, y, ground_z(t, x, y) + .1), s, k + 3)); block("east", x, y, s * 1.05)
islands["east"] = join(parts, "Island_East_Beach")
# ---- 서: 화산섬 ----
t = terrain(10, 3.0, 7, bands=[(-9, "#c9b58a"), (.4, "#6f6a62"), (1.4, "#55504a")])
walk_begin("west", t); block("west", 0, 0, 6.5)
def mk(): bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=6.2, radius2=1.6, depth=6.5)
cone = add(mk, (0, 0, 2.9 + 3.25 - .4), (0, 0, 0), (1, 1, 1), None, "volcano")
random.seed(5)
for v in cone.data.vertices:
    if v.co.z < 3: v.co.x *= 1 + random.uniform(-.06, .06); v.co.y *= 1 + random.uniform(-.06, .06); v.co.z = ground_z(t, v.co.x * 1.08, v.co.y * 1.08) - .5  # 밑둥을 땅 속까지(떠 보이지 않게)
paint(cone, lambda p, n: srgb("#3b3836" if p.z > 7.6 else "#5a524b" if p.z > 5 else "#6c6259"))
def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.45, depth=.3)
lava = add(mk, (0, 0, 8.45), (0, 0, 0), (1, 1, 1), "#ff5a1f", "lava")
parts = [t, cone]
# 동굴 입구(게임기 자리): 홈 쪽(+X) 화산 밑 옆구리 — 어두운 굴 + 용암색 테두리, 입구 앞·안쪽 = 설 수 있음
cgz = ground_z(t, 6.6, 0)
# 땅바닥에서 시작하는 굴: 화산 밑둥 겉면에 어두운 반원 굴 + 둘레 바위 아치 + 안쪽 바닥 용암빛
hit, loc, nn, fi = cone.ray_cast(Vector((20, 0, cgz + .6)), Vector((-1, 0, 0)))
sx = loc.x if hit else 5.8
def mk(): bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
parts.append(add(mk, (sx - .3, 0, cgz - .15), (0, 0, 0), (.75, 1.9, 2.5), "#120c0a", "cave"))
for k in range(11):  # 바위 아치(반원)
    a = math.pi * k / 10
    parts.append(rock((sx + .1, math.cos(a) * 2.15, cgz - .15 + math.sin(a) * 2.65), .55 + .1 * math.sin(a * 3), 70 + k, "#3a322e"))
def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=1, depth=.08)
parts.append(add(mk, (sx - .35, 0, cgz + .12), (0, 0, 0), (.55, 1.3, 1), "#ff7a2a", "cave_glow"))
pad("west", 6.6, 0, 1.0); pad("west", 0, 0, 1.3, 1)  # 동굴 입구 앞 / 화산 꼭대기
# 연기는 게임에서 움직이게(smoke_puff.glb 한 덩이를 렌더러가 여러 번 그림)
def mk(): bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
puff = add(mk, (0, 0, 0), (0, 0, 0), (1, 1, .85), "#b9b4ae", "smoke_puff")
for k, (x, y, s) in enumerate([(7.0, 4.6, 1.2), (-7, -2.5, 1), (2, -7.6, .9), (-3, 7.2, 1.3), (6, -5, .7)]):
    parts.append(rock((x, y, ground_z(t, x, y) + .2), s, k + 11, "#2f2c2a")); block("west", x, y, s * 1.05)
v_main = join(parts, "Island_West_Volcano")
lava.data.materials.clear(); lava.data.materials.append(EMIT)
islands["west"] = v_main; islands["west_lava"] = lava
# ---- 남: 정글섬(초승달) ----
def crescent(x, y, a, t):
    k = .6 + .4 * (1 + math.cos(a)) / 2   # 한쪽이 들어간 초승달
    return x * (1.15 if math.cos(a) > 0 else .95), y * k + (2.2 if math.cos(a) < -.2 else 0) * t, 1
t = terrain(10, 2.6, 13, shape=crescent, bands=[(-9, "#e3cf97"), (.5, "#4f9a45"), (1.6, "#3e8638")])
flatten(t, "#4f9a45", "#4f9a45")
parts = [t] + round_plaza(t, "#d9c79a", "#a8875a"); random.seed(21); walk_begin("south", t)
spots = [(-5.6, -.8, 0)]  # 큰 나무 자리 비워 둠(가운데 = 게임기)
while len(spots) < 12:
    x, y = random.uniform(-8, 8), random.uniform(-7, 7)
    z = ground_z(t, x, y)
    if z > .6 and math.hypot(x, y) > PLAZA_R + 2 and all((Vector((x, y)) - Vector(s[:2])).length > 2.2 for s in spots): spots.append((x, y, z))
spots = spots[1:]
for k, (x, y, z) in enumerate(spots):
    hh, rr = random.uniform(1.6, 3.2), random.uniform(1.1, 1.7)
    parts += tree((x, y, z - .1), hh, rr, k + 30, random.choice(["#2f7d34", "#3f8f3f", "#2d6e2f"])); block("south", x, y, rr * .45)
gx, gy = -5.6, -.8; gz = ground_z(t, gx, gy)
parts += tree((gx, gy, gz - .2), 5.5, 2.8, 99, "#2a6b2c"); block("south", gx, gy, .9)
for k in range(9):
    x, y = random.uniform(-7, 7), random.uniform(-6, 6); z = ground_z(t, x, y)
    if z > .4 and math.hypot(x, y) > PLAZA_R + 1:
        def mk(): bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=.7)
        parts.append(add(mk, (x, y, z + .25), (0, 0, k), (1, 1, .6), "#5fae4e", "bush"))
islands["south"] = join(parts, "Island_South_Jungle")
# ---- 북: 얼음섬 ----
t = terrain(9.5, 2.0, 17, bands=[(-9, "#cfe7f2"), (.4, "#f4f8fb"), (1.5, "#ffffff")])
flatten(t, "#f4f8fb", "#f4f8fb")
parts = [t] + round_plaza(t, "#e3f1f8", "#8fc3e2"); random.seed(41); walk_begin("north", t)
for k, (x, y, h, r) in enumerate([(-5.2, 2.2, 6.5, 2.4), (3.0, -5.0, 4.6, 1.8), (-4.4, -4.2, 3.8, 1.6), (.4, 6.0, 3.2, 1.3)]):  # 봉우리 = 가장자리
    def mk(): bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=r, radius2=0, depth=h)
    z = ground_z(t, x, y)
    o = add(mk, (x, y, z + h / 2 - .3), (random.uniform(-.08, .08), random.uniform(-.08, .08), k), (1, 1, 1), None, "peak")
    paint(o, lambda p, n, z0=z, h0=h: srgb("#ffffff" if p.z > z0 + h0 * .55 else "#a9d6ee" if n.x + n.y > 0 else "#7fbfe4"))
    parts.append(o); block("north", x, y, r * .95)
ix, iy = 5.2, 2.6; iz = ground_z(t, ix, iy); block("north", ix, iy, 1.5)
def mk(): bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1.4)
ig = add(mk, (ix, iy, iz), (0, 0, 0), (1, 1, .8), None, "igloo")
paint(ig, lambda p, n: srgb("#e6f2f8" if int((p.z - iz) * 3.2) % 2 else "#f8fcff"))
parts.append(ig)
def mk(): bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=.45, depth=1.2)
parts.append(add(mk, (ix - .9, iy - .9, iz + .3), (math.radians(90), 0, math.radians(-45)), (1, 1, 1), "#2f4a5a", "door"))
for k, (x, y, s) in enumerate([(-7.6, -1, .9), (6.4, -3.6, 1.1), (-4.6, -6.2, .8), (3.6, 6.6, .7)]):
    o = rock((x, y, ground_z(t, x, y) + .1), s, k + 51, "#bfe2f3"); parts.append(o); block("north", x, y, s * 1.05)
islands["north"] = join(parts, "Island_North_Ice")

# 배치: 홈(반지름16) 기준 거리 48, 동(+X) 서(-X) 남(-Y) 북(+Y) — 게임 좌표 변환은 적용 때 결정
D = 48
place = {"east": (D, 0), "west": (-D, 0), "south": (0, -D), "north": (0, D)}
for k, (x, y) in place.items():
    o = islands[k]; o.location = (x, y, 0)
islands["west_lava"].location = (-D, 0, 0)
for k in ("east", "west", "south", "north"):
    bpy.ops.object.select_all(action='DESELECT'); islands[k].select_set(True)
    if k == "west": islands["west_lava"].select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"island_{k}.glb"), export_format='GLB', use_selection=True, export_apply=True)
bpy.ops.object.select_all(action='DESELECT'); puff.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "smoke_puff.glb"), export_format='GLB', use_selection=True, export_apply=True)
puff.hide_set(True); puff.hide_render = True
print("FACES", {k: len(o.data.polygons) for k, o in islands.items()})
# 위 표면 높이(소품 포함: 화산·나무·이글루 꼭대기) — 하늘에서 떨어질 때 착지·미끄러짐용
bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
for key, (x0, y0) in place.items():
    W = WALK[key]; top = []
    for iz in range(W["n"]):
        for ix in range(W["n"]):
            lx, lz = -W["half"] + ix * W["step"], -W["half"] + iz * W["step"]
            hit, loc, nn, fi, ob, mx = bpy.context.scene.ray_cast(dg, Vector((x0 + lx, y0 - lz, 60)), Vector((0, 0, -1)))
            top.append(round(loc.z, 3) if hit and ob and ob.name != "smoke_puff" else -9)
    W["top"] = top
# 걷기 자료(게임 좌표): 섬 중심 기준 lx=블렌더x, lz=-블렌더y. 높이 격자 0.5 간격, 물 위만(-0.25 초과) 걸을 수 있음
import json
walk = []
for key, (x0, y0) in place.items():
    W = WALK[key]
    walk.append({"id": key, "cx": x0, "cz": -y0, "half": W["half"], "step": W["step"], "n": W["n"], "h": W["h"], "top": W["top"],
                 "blocks": [[round(bx, 2), round(-by, 2), round(r, 2)] for bx, by, r in W["blocks"]],
                 "pads": [[round(px, 2), round(-py, 2), round(r, 2), tp] for px, py, r, tp in W.get("pads", [])]})
json.dump({"islands": walk}, open(os.path.join(OUT, "islands-walk.json"), "w"))
print("WALK", [(w["id"], w["cx"], w["cz"], len(w["blocks"])) for w in walk])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "four_islands.blend"))
# 미리보기: 바다 + 홈 자리 표시 + 전체 위 + 섬별 확대
bpy.ops.mesh.primitive_circle_add(vertices=96, radius=140, fill_type='NGON', location=(0, 0, -.2))
sea = bpy.context.object; sm = bpy.data.materials.new("Sea"); sm.use_nodes = True
sm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#4fa9d8"); sea.data.materials.append(sm)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=16, depth=.6, location=(0, 0, .1))
home = bpy.context.object; hm = bpy.data.materials.new("Home"); hm.use_nodes = True
hm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = srgb("#e9d9b0"); home.data.materials.append(hm)
sd = bpy.data.lights.new("Sun", 'SUN'); sd.energy = 3.5
sun = bpy.data.objects.new("Sun", sd); sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50), 0, math.radians(30))
sc.world = bpy.data.worlds.new("W"); sc.world.use_nodes = True; sc.world.node_tree.nodes["Background"].inputs[0].default_value = srgb("#a8d8f0")
sc.render.engine = 'BLENDER_EEVEE'; sc.render.image_settings.file_format = 'PNG'
cd = bpy.data.cameras.new("C"); cam = bpy.data.objects.new("C", cd); sc.collection.objects.link(cam); sc.camera = cam
def shot(path, loc, tgt, w=900, h=900, lens=35):
    sc.render.resolution_x = w; sc.render.resolution_y = h; cd.lens = lens
    cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
shot(os.path.join(OUT, "0_전체_위에서.png"), (0, -40, 120), (0, 0, 0))
names = {"east": "1_동_해변섬", "west": "2_서_화산섬", "south": "3_남_정글섬", "north": "4_북_얼음섬"}
for k, (x, y) in place.items():
    shot(os.path.join(OUT, names[k] + ".png"), (x + 14, y - 18, 15), (x, y, 1.5), 900, 700, 35)
shot(os.path.join(OUT, "5_서_동굴입구_정면.png"), (-D + 16, 0, 4), (-D + 5, 0, 1.6), 900, 700, 35)
shot(os.path.join(OUT, "6_남_광장.png"), (5, -D + 11, 11), (0, -D, 1.5), 900, 700, 35)
shot(os.path.join(OUT, "7_북_광장.png"), (5, D - 11, 11), (0, D, 1.5), 900, 700, 35)
print("ISLANDS_DONE")

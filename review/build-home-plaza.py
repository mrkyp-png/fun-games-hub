# 3D 홈 광장 섬 모델 (작업 5). 설계: Desktop/3D_공용홈_초안/06_홈광장_설계.md
# 실행: "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P review/build-home-plaza.py
# 좌표: 게임(layout) (x, z) = Blender (x, -y). 게임 앞(-z) = Blender +Y. 건물 정면은 섬 중심을 본다.
import bpy, math, bmesh
from pathlib import Path
from mathutils import Vector, Matrix

bpy.ops.wm.read_factory_settings(use_empty=True)
ROOT = Path('C:/Users/master/Desktop/fun-games-hub')
OUT = ROOT / 'mole/assets/home3d'
OUT.mkdir(parents=True, exist_ok=True)

# home3d-layout.js SITES 와 같은 값(검사: verify-home3d-layout.cjs 가 GLB 노드 좌표를 대조)
SITES = [('lightMode', 0, -9), ('rhythm', -8, 2.5), ('shop', -7, -5)]
ISLAND_R = 16   # V1632 C 사용자: 광장 좁음 → 12에서 16(건물 자리는 그대로)

def mat(name, rgb, rough=.85):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    return m

# 클레이 톤 팔레트(밝고 부드럽게, 탁한 회색·네온 번짐 없음)
M = {k: mat(n, c) for k, n, c in [
    ('floor', 'Hub checker floor', (.9, .9, .9)),     # 렌더러가 이 이름으로 체크무늬를 칠함
    ('soil', 'Home soil', (.55, .38, .24)), ('soilDark', 'Home soil dark', (.22, .14, .09)),
    ('sand', 'Home sand', (.93, .82, .60)), ('sea', 'Home sea', (.36, .70, .80)),
    ('hedge', 'Home hedge', (.42, .66, .38)), ('fence', 'Home fence', (.96, .90, .78)),
    ('cream', 'Home cream', (.97, .91, .80)), ('wood', 'Home wood', (.76, .52, .32)),
    ('coral', 'Home coral', (.95, .52, .45)), ('sky', 'Home sky blue', (.50, .74, .92)),
    ('mint', 'Home mint', (.55, .84, .72)), ('yellow', 'Home yellow', (.99, .84, .40)),
    ('bulb', 'Home bulb', (1.0, .95, .72)), ('violet', 'Home club violet', (.30, .22, .46)),
    ('neonC', 'Home club cyan', (.40, .90, .95)), ('neonM', 'Home club pink', (.98, .50, .80)),
    ('straw', 'Home straw', (.88, .72, .42)), ('red', 'Home mail red', (.90, .30, .28)),
    ('sign', 'Home sign board', (.98, .95, .88)),
]}

def finish(o, m, bevel=.04):
    o.data.materials.append(m)
    if bevel:
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new('soft', 'BEVEL'); mod.width = bevel; mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons: f.use_smooth = True
    return o

def box(name, loc, size, m, bevel=.05, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=(0, 0, rot))
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, bevel)

def cyl(name, loc, r, h, m, verts=32, bevel=.04, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return finish(o, m, bevel)

def ball(name, loc, r, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=r, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, m, 0)

def cone(name, loc, r, h, m, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, depth=h, location=loc)
    o = bpy.context.object; o.name = name
    return finish(o, m, 0)

def torus(name, loc, R, r, m):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=40, minor_segments=12, location=loc)
    o = bpy.context.object; o.name = name
    return finish(o, m, 0)

def group(name, parts, gx, gz):
    """parts 는 원점에서 정면=-Y 로 만든 것. 섬 중심을 보도록 돌려 (gx, -gz) 에 놓는다."""
    bx, by = gx, -gz
    th = math.atan2(-bx, by) if (bx or by) else 0
    root = bpy.data.objects.new('Site_' + name, None)
    bpy.context.collection.objects.link(root)
    root.location = (bx, by, 0); root.rotation_euler = (0, 0, th)
    if name in ('shop', 'rhythm'): root.scale = (1.6, .8, 1.6)  # 확대안 깊이 절반 후 전체 20% 축소
    for o in parts: o.parent = root
    return root

def sign(action, z, w=2.2, h=.7, y=-1.0):
    """간판: 나무판 + 앞면 글자판(Sign_<action>, UV 0~1, 정면 -Y). 글자는 작업 6에서 텍스처로."""
    board = box('Sign board ' + action, (0, y + .06, z), (w + .16, .12, h + .16), M['wood'], .04)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, y - .005, z), rotation=(math.pi / 2, 0, 0))
    face = bpy.context.object; face.name = 'Sign_' + action; face.scale = (w, h, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    face.data.materials.append(M['sign'])
    return [board, face]

# ---------- 섬 · 바다 · 해변 ----------
cyl('Island floor', (0, 0, -.05), ISLAND_R, .1, M['floor'], 96, .02)
cyl('Island soil side', (0, 0, -.75), ISLAND_R, 1.3, M['soil'], 96, .2)
cyl('Beach sand', (0, -4.3, -.55), 18.1, .5, M['sand'], 96, .2)            # 뒤쪽(게임 +z)으로 삐져나온 모래사장
bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, -.7)); sea = bpy.context.object
sea.name = 'Home sea plane'; sea.data.materials.append(M['sea'])
# 가운데 집 구멍(올라오는 곳)
torus('Home hole rim', (0, 0, .02), 1.05, .22, M['soil'])
cyl('Home hole dark', (0, 0, -.02), 1.0, .06, M['soilDark'], 40, 0)

# 가장자리: 둥근 덤불 + 낮은 울타리(뒤쪽 해변 방향은 울타리만 낮게)
for i in range(58):
    a = 2 * math.pi * i / 58
    x, y = math.cos(a) * 15.65, math.sin(a) * 15.65
    back = y < -8  # 해변 쪽
    if back or i % 2:
        cyl('Fence post', (x, y, .35), .09, .7, M['fence'], 10, .02)
    if not back:
        ball('Hedge', (x, y, .45), .62, M['hedge'], (1, 1, .85))
for i in range(116):
    a = 2 * math.pi * (i + .5) / 116
    box('Fence rail', (math.cos(a) * 15.65, math.sin(a) * 15.65, .55), (.07, .86, .08), M['fence'], .02, a)

# ---------- 건물 ----------
ARCADE_K = 2.84   # 사용자 '지금보다 2배 더 키워'(1.42 → 2.84)
def mole_booth():   # 두더지팡: 아케이드 게임기(review/build-arcade-mole.py, 사용자 승인 2026-11-06). 간판·화면은 비워 둠(사용자 지시)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'review/home3d-src/arcade-mole.glb'))
    p = [o for o in bpy.context.scene.objects if o not in before and o.type == 'MESH']
    for o in list(bpy.context.scene.objects):
        if o not in before and o.type != 'MESH': bpy.data.objects.remove(o)
    for o in p:
        for mm in o.data.materials:   # 그림은 256 으로 줄여 담음(가볍게)
            img = next((n.image for n in mm.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None) if mm and mm.use_nodes else None
            if img and img.size[0] > 256:
                img.scale(256, 256)
                img.pack()
        o.parent = None; o.scale = (ARCADE_K,) * 3; o.location = tuple(v * ARCADE_K for v in o.location)
    # 나무 이름판은 삭제(사용자 지시). 글자는 기계 위 간판 상자 앞면에(Sign_lightMode, 간판 판 크기 0.9×0.22 × K)
    k = ARCADE_K
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, (0.6 - 0.53 - 0.015) * k - .006, (2.52 - .384 - .387) * k), rotation=(math.pi / 2, 0, 0))
    face = bpy.context.object; face.name = 'Sign_lightMode'; face.scale = (0.86 * k, 0.2 * k, 1)   # 간판 상자는 그대로, 아래 몸통(0.384)·화면 아래 분홍 틈(0.215)이 줄어든 만큼 내려감(build-arcade-mole.py mz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    face.data.materials.append(M['sign'])
    # 게임기 화면 = Screen_lightMode 판(글자: 'OO 1라운드' / 'BEST 점수', 렌더러가 그림). 화면 중심 높이 1.95 → 아래 몸통·분홍 틈 줄어든 만큼(0.384+0.215) 내려감
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, (0.6 - 0.33 - 0.015) * k - .006, (1.95 - .384 - .387) * k), rotation=(math.pi / 2, 0, 0))
    scr = bpy.context.object; scr.name = 'Screen_lightMode'; scr.scale = (0.64 * k, 0.46 * k, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    scr.data.materials.append(M['sign'])
    return p + [face, scr]

def doorway_shell(prefix, height, material, front=-1.1, back=1.1):
    """Closed building shell with a real 0.96 x 1.6 doorway, not a painted door."""
    depth = back - front
    return [
        box(prefix + ' back wall', (0, back-.11, height/2), (2.6,.22,height), material,0),
        box(prefix + ' side L', (-1.18,(front+back)/2,height/2), (.24,depth,height), material,0),
        box(prefix + ' side R', (1.18,(front+back)/2,height/2), (.24,depth,height), material,0),
        box(prefix + ' front L', (-.89,front+.11,height/2), (.82,.22,height), material,0),
        box(prefix + ' front R', (.89,front+.11,height/2), (.82,.22,height), material,0),
        box(prefix + ' doorway lintel', (0,front+.11,(height+1.6)/2), (.98,.24,height-1.6+.02), material,0),
        box(prefix + ' floor', (0,(front+back)/2,.04), (2.6,depth,.08), material,0),
    ]

def closed_shell(name, parts):
    """Union before beveling so gable/wall joins have no stacked seams or gaps."""
    shell = parts[0]
    for other in parts[1:]:
        bpy.context.view_layer.objects.active = shell
        mod = shell.modifiers.new('continuous wall union','BOOLEAN')
        mod.operation = 'UNION'; mod.solver = 'EXACT'; mod.object = other
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(other,do_unlink=True)
    shell.name = name
    bm=bmesh.new();bm.from_mesh(shell.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bmesh.ops.dissolve_limit(bm,angle_limit=.0001,verts=list(bm.verts),edges=list(bm.edges))
    bm.to_mesh(shell.data);bm.free()
    bevel = shell.modifiers.new('continuous outside edges','BEVEL')
    bevel.width = .025; bevel.segments = 3
    bpy.context.view_layer.objects.active = shell
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    # Large Boolean wall faces must remain planar in shading, including the door recess.
    for polygon in shell.data.polygons: polygon.use_smooth=False
    return shell

def soft_light(name, color):
    material=mat(name,color)
    shader=material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value=(*color,1)
    shader.inputs['Emission Strength'].default_value=.45
    return material

GATE_CYAN=soft_light('Home gate cyan',(.48,.88,.96))
GATE_PINK=soft_light('Home gate pink',(.98,.58,.79))

def rhythm_house():  # 보라색 클럽만 남기고 실제 입구를 중앙에 둠
    p = [closed_shell('Club closed shell',doorway_shell('Club', 3.2, M['violet'], -.9, 1.3))]
    p += [box('Club roof cap', (0,.2,3.19), (2.7,2.3,.16), M['violet']),
          box('Club strip cyan', (0,-.92,2.6), (2.4,.06,.14), M['neonC'], .02),
          box('Club strip pink', (0,-.92,2.2), (2.4,.06,.14), M['neonM'], .02)]
    for sx in (-.95, .95): p.append(cyl('Club speaker', (sx,-1.0,.45), .32,.9,M['violet'],20,.05))
    # Thick rounded portal surrounds the existing opening; no panel across the walk path.
    for sx in (-.58,.58):
        p.append(box('Club gate pillar',(sx,-.99,.85),(.20,.30,1.70),M['violet'],.075))
        p.append(box('GateGlow pillar',(sx,-1.15,.86),(.045,.035,1.39),GATE_CYAN if sx<0 else GATE_PINK,.015))
    p.append(box('Club gate crown',(0,-.99,1.76),(1.36,.30,.24),M['violet'],.085))
    p.append(box('GateGlow crown',(0,-1.15,1.79),(1.12,.035,.045),GATE_CYAN,.015))
    # Five original inner rhythm bars share one draw, with per-bar UV animation metadata.
    p.append(box('Club equalizer inset',(0,1.055,1.0),(.86,.045,.85),M['violet'],.06))
    for i,h in enumerate([.29,.48,.62,.43,.32]):
        bar=box('RhythmBars_'+str(i),((i-2)*.15,1.015,.67+h/2),(.075,.045,h),GATE_CYAN if i%2==0 else GATE_PINK,.025)
        for old_uv in list(bar.data.uv_layers):bar.data.uv_layers.remove(old_uv)
        uv=bar.data.uv_layers.new(name='Rhythm index')
        for point in uv.data:point.uv=(i/4,0)
        p.append(bar)
    # Walk-through energy membrane stays in front of the restored rhythm bars.
    bpy.ops.mesh.primitive_plane_add(size=1,location=(0,-1.125,.83),rotation=(math.pi/2,0,0))
    energy=bpy.context.object;energy.name='Energy_rhythm';energy.scale=(.94,1.48,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    energy_material=soft_light('Home portal energy',(.38,.34,.78))
    shader=energy_material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Alpha'].default_value=.30
    energy_material.surface_render_method='DITHERED'
    energy.data.materials.append(energy_material);p.append(energy)
    # Blender-only reference bolts; the web shader animates equivalent paths on the plane.
    for i in range(3):
        curve=bpy.data.curves.new('Energy preview bolt','CURVE');curve.dimensions='3D';curve.bevel_depth=.009;curve.bevel_resolution=2
        spline=curve.splines.new('POLY');spline.points.add(12)
        for k,point in enumerate(spline.points):
            x=-.46+.92*k/12;z=.36+i*.43+.065*math.sin(k*4.1+i*2)
            point.co=(x,-1.132,z,1)
        bolt=bpy.data.objects.new('Preview_energy_bolt',curve);bpy.context.collection.objects.link(bolt)
        bolt.data.materials.append(GATE_CYAN if i%2==0 else GATE_PINK);p.append(bolt)
    return p + sign('rhythm', 2.91, 1.92, .28, -.95)

def shop_canopy():
    """Continuous curved striped canvas with a scalloped, thick front valance."""
    vertices=[];faces=[];materials=[]
    # Shared stripe boundaries keep the canopy closed without beveled gaps.
    for i in range(7):
        x=-1.2+i*.4
        for layer in range(2):
            for j in range(13):
                t=j/12
                vertices.append((x,-1.08-.98*t,2.09-.23*(1-math.cos(t*math.pi/2))-.045*layer))
    def v(i,layer,j): return i*26+layer*13+j
    for i in range(6):
        for j in range(12):
            faces.extend([(v(i,0,j),v(i+1,0,j),v(i+1,0,j+1),v(i,0,j+1)),
                          (v(i,1,j+1),v(i+1,1,j+1),v(i+1,1,j),v(i,1,j))])
            materials.extend([i%2,i%2])
        for j in (0,12):
            faces.append((v(i,0,j),v(i,1,j),v(i+1,1,j),v(i+1,0,j)));materials.append(i%2)
    for i in (0,6):
        for j in range(12):
            faces.append((v(i,0,j),v(i,0,j+1),v(i,1,j+1),v(i,1,j)));materials.append(0)
    mesh=bpy.data.meshes.new('Shop curved canvas mesh');mesh.from_pydata(vertices,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    canopy=bpy.data.objects.new('Shop curved striped canopy',mesh);bpy.context.collection.objects.link(canopy)
    mesh.materials.append(M['cream']);mesh.materials.append(M['yellow'])
    for polygon,index in zip(mesh.polygons,materials): polygon.material_index=index
    parts=[canopy]
    for i in range(6):
        left=-1.2+i*.4
        outline=[(left,1.86),(left+.4,1.86)]+[(left+.4-.4*j/12,1.75-.085*math.sin(math.pi*j/12)) for j in range(13)]
        n=len(outline);verts=[(x,y,z) for y in (-2.06,-2.015) for x,z in outline]
        fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(k,(k+1)%n,(k+1)%n+n,k+n) for k in range(n)]
        me=bpy.data.meshes.new('Shop scallop mesh');me.from_pydata(verts,[],fs);me.update()
        bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
        o=bpy.data.objects.new('Shop scalloped valance '+str(i),me);bpy.context.collection.objects.link(o)
        parts.append(finish(o,M['yellow'] if i%2 else M['cream'],0))
    return parts

def shop_house():   # 기념품 가게
    p = doorway_shell('Shop', 2.2, M['cream'])
    for side, y in [('front',-1.1),('back',1.1)]:
        ys = (y,y+.18) if side=='front' else (y-.18,y)
        profile=[(-1.3,2.18),(1.3,2.18),(1.3,2.2),(0,2.91),(-1.3,2.2)]
        verts = [(x, yy, z) for yy in ys for x,z in profile]
        mesh = bpy.data.meshes.new('Shop gable '+side)
        faces=[tuple(range(4,-1,-1)),tuple(range(5,10))]
        faces += [(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        gable = bpy.data.objects.new('Shop roof gable '+side,mesh)
        bpy.context.collection.objects.link(gable)
        p.append(finish(gable,M['cream'],0))
    p = [closed_shell('Shop closed shell',p)]
    # One watertight roof shell: the inner slopes match the gables exactly.
    outer=1.45; inner_eave=2.91-(2.91-2.2)/1.3*outer
    profile=[(-outer,inner_eave),(0,2.91),(outer,inner_eave),
             (outer,inner_eave+.14),(0,3.05),(-outer,inner_eave+.14)]
    verts=[(x,y,z) for y in (-1.24,1.24) for x,z in profile]
    faces=[tuple(range(5,-1,-1)),tuple(range(6,12))]
    faces += [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
    mesh=bpy.data.meshes.new('Shop sealed roof mesh');mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    roof=bpy.data.objects.new('Shop sealed roof',mesh);bpy.context.collection.objects.link(roof)
    p.append(finish(roof,M['coral'],.018))
    p += [box('Shop window L',(-.85,-1.12,1.25),(.55,.06,.55),M['sky'],.02),
          box('Shop window R',(.85,-1.12,1.25),(.55,.06,.55),M['sky'],.02)]
    p += shop_canopy()
    # Frosted warm glazing intentionally conceals the empty interior; no clear transmission.
    leaf=[box('Shop door lower',(0,-1.115,.40),(.91,.10,.63),M['wood'],.025),
          box('Shop door frosted glass',(0,-1.115,1.10),(.75,.055,.66),M['yellow'],.025)]
    for x in (-.425,.425): leaf.append(box('Shop door stile',(x,-1.115,.84),(.075,.11,1.5),M['cream'],.025))
    for z in (.105,.735,1.565): leaf.append(box('Shop door rail',(0,-1.115,z),(.91,.11,.075),M['cream'],.02))
    leaf += [box('Shop frosted highlight',(-.16,-1.148,1.16),(.04,.012,.39),M['cream'],.015),
             box('Shop lower inset',(0,-1.172,.40),(.66,.018,.40),M['cream'],.025),
             ball('Shop door gold handle',(.31,-1.205,.79),.046,M['yellow'])]
    bpy.ops.object.select_all(action='DESELECT')
    for o in leaf:o.select_set(True)
    bpy.context.view_layer.objects.active=leaf[0];bpy.ops.object.join()
    door=bpy.context.object;door.name='Door_shop';p.append(door)
    return p + sign('shop', 2.38, 1.04, .22, -1.14)

def score_tower():   # 전광판 / 명예의 전당
    p = [box('Tower base', (0, 0, 1.4), (1.4, 1.4, 2.8), M['cream']),
         box('Score board', (0, -.2, 3.6), (2.8, .3, 1.6), M['sky']),
         box('Board screen', (0, -.37, 3.6), (2.5, .04, 1.3), M['cream'], .01),
         cone('Star top', (0, -.2, 4.75), .35, .6, M['yellow'], 5)]
    return p + sign('score', 2.35, 1.7, .5, -.75)

def mailbox():
    return [cyl('Mail post', (0, 0, .45), .07, .9, M['wood'], 10, .02), box('Mail box', (0, 0, 1.05), (.55, .7, .45), M['red'], .12)] + sign('mail', 1.6, .9, .3, -.4)

def giftbox():
    return [box('Gift', (0, 0, .35), (.7, .7, .7), M['coral'], .06), box('Ribbon X', (0, 0, .35), (.74, .16, .74), M['yellow'], .03),
            box('Ribbon Y', (0, 0, .35), (.16, .74, .74), M['yellow'], .03), ball('Bow', (0, 0, .78), .14, M['yellow'], (1.6, .8, .7))] + sign('daily', 1.3, .9, .3, -.42)

def board():
    p = [cyl('Board post', (-.55, 0, .6), .06, 1.2, M['wood'], 10, .02), cyl('Board post', (.55, 0, .6), .06, 1.2, M['wood'], 10, .02),
         box('Quest board', (0, 0, 1.0), (1.3, .1, .8), M['wood'], .03)]
    for dx, m in ((-.3, M['cream']), (.25, M['yellow'])): p.append(box('Note', (dx, -.07, 1.0), (.4, .02, .45), m, .01))
    return p + sign('quest', 1.65, .9, .3, -.1)

BUILD = {'lightMode': mole_booth, 'rhythm': rhythm_house, 'shop': shop_house, 'score': score_tower, 'daily': giftbox, 'quest': board}
for action, gx, gz in SITES: group(action, BUILD[action](), gx, gz)

bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'plaza.blend'))
door_hinge=bpy.data.objects['Site_shop'].matrix_world@Vector((-.46,-1.115,0))
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Preview_'):bpy.data.objects.remove(o,do_unlink=True)

# ---------- 웹용: 부모 변환 적용 후 재질별 병합(간판 글자판 Sign_* 은 따로 유지) ----------
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# 재질 색 → 정점 색(COLOR_0)으로 옮기고 한 재질로 병합: 바닥(체크)·바다(물결 작업 8)·간판판만 따로 → 그리기 횟수 최소
CLAY = mat('Home clay', (1, 1, 1))
_avg = {}
def mat_rgb(m):
    if m is None: return (1, 1, 1, 1)
    p = m.node_tree.nodes.get('Principled BSDF') if m.use_nodes and m.node_tree else None
    if p:
        bc = p.inputs['Base Color']
        if bc.is_linked:
            img = next((n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
            if img:
                if img.name not in _avg:
                    px = list(img.pixels); n = len(px) // 4
                    _avg[img.name] = tuple(sum(px[i::4]) / n for i in range(3)) + (1,)
                return _avg[img.name]
        c = tuple(bc.default_value)
        # 광장 재질(Home*/Hub*)은 숫자 = 화면 색. 불러온 모델(게임기·뿅망치)은 선형 색이라 화면 색으로 되돌림
        if not (m.name.startswith('Home') or m.name.startswith('Hub')):
            c = tuple((12.92 * x) if x <= .0031308 else (1.055 * x ** (1 / 2.4) - .055) for x in c[:3]) + (1,)
        return c
    return tuple(m.diffuse_color)
SEPARATE = {'Hub checker floor', 'Home sea'}
groups = {}
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH' or o.name.startswith(('Sign_','Tex_','Screen_','Energy_')): continue
    mname = o.data.materials[0].name
    if mname in SEPARATE:
        groups.setdefault(mname, []).append(o); continue
    cols = [mat_rgb(m) for m in o.data.materials]
    ca = o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in o.data.polygons:
        c = cols[poly.material_index] if poly.material_index < len(cols) else cols[0]
        for li in poly.loop_indices: ca.data[li].color = c
    o.data.color_attributes.active_color = ca
    o.data.materials.clear(); o.data.materials.append(CLAY)
    if o.name=='Door_shop':continue
    group_name='RhythmBars' if o.name.startswith('RhythmBars_') else ('GateGlow' if o.name.startswith('GateGlow') else 'Home clay')
    groups.setdefault(group_name, []).append(o)
for name, objs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); bpy.context.object.name = name + ' batch'
# 간판 글자판은 위치 정보를 노드 원점으로 남김(검사·간판 작업용)
for o in bpy.context.scene.objects:
    if o.name.startswith('Sign_') or o.name.startswith('Screen_'):
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY')
    elif o.name=='Door_shop':
        o.data.transform(Matrix.Translation(-door_hinge));o.location=door_hinge
    elif o.name=='RhythmBars batch':
        points=[o.matrix_world@v.co for v in o.data.vertices]
        base=Vector(((min(v.x for v in points)+max(v.x for v in points))/2,
                     (min(v.y for v in points)+max(v.y for v in points))/2,min(v.z for v in points)))
        o.data.transform(Matrix.Translation(-base));o.location=base
for o in list(bpy.context.scene.objects):
    if o.type == 'EMPTY': bpy.data.objects.remove(o)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == 'MESH')
draws = sum(1 for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.ops.object.select_all(action='SELECT')
try:
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'plaza.glb'), export_format='GLB', export_animations=False, export_apply=True, export_vertex_color='ACTIVE')
except TypeError:
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'plaza.glb'), export_format='GLB', export_animations=False, export_apply=True, export_colors=True)
print('PLAZA_READY draws=%d tris=%d' % (draws, tris))

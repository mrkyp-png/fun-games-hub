"""Author beat loops on the approved rig in Blender; keep the plaza GLB unchanged."""
import bpy,math,json
from pathlib import Path
from mathutils import Vector,Quaternion
ROOT=Path('C:/Users/master/Desktop/fun-games-hub')
SOURCE=ROOT/'mole/assets/home3d/mole-clay-v47-smile.glb'
OUT=ROOT/'mole/assets/home3d/mole-rhythm-dance-v2.glb'
WORK=ROOT/'review/rhythm-dance';WORK.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
scene=bpy.context.scene;scene.render.fps=24
arm=next(o for o in scene.objects if o.type=='ARMATURE');pb=arm.pose.bones
for track in arm.animation_data.nla_tracks:track.mute=True
def capture(action,frame):
    arm.animation_data.action=bpy.data.actions[action];scene.frame_set(frame);bpy.context.view_layer.update()
    return {b.name:(b.location.copy(),b.rotation_quaternion.copy(),b.scale.copy()) for b in pb}
idle=capture('Idle',1);smile=capture('Smile',0)
face_names=['Jaw','Tongue']+[p+s for p in ['Eye','PainEye','HappyEye','Brow','MouthCorner'] for s in ['.L','.R']]
def reset():
    for b in pb:
        b.rotation_mode='QUATERNION';b.location,b.rotation_quaternion,b.scale=idle[b.name]
    for name in face_names:pb[name].location,pb[name].rotation_quaternion,pb[name].scale=smile[name]
def rotate(name,axis,angle):
    b=pb[name];rest=b.bone.matrix_local.to_quaternion()
    b.rotation_quaternion=b.rotation_quaternion@(rest.inverted()@Quaternion(axis,angle)@rest)
def move(name,delta):
    b=pb[name];b.location+=b.bone.matrix_local.to_3x3().inverted()@Vector(delta)
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
reports={}
for variant,name in enumerate(['DanceFreestyle']):
    action=bpy.data.actions.new(name);arm.animation_data.action=action
    report=[]
    for frame in range(0,385):
        scene.frame_set(frame);reset();beat=frame/12;phase=math.pi*beat
        # A single 32-beat phrase: no eight-beat envelope or neutral-pose resets.
        jump=0;crouch=0
        for start,duration,height in [(2,1,.52),(10,1.25,.62),(18,1.25,.55),(26,1.5,.65)]:
            progress=(beat-start)/duration
            if 0<progress<1:jump+=height*math.sin(math.pi*progress)**2
            crouch+=.09*max(0,1-abs(beat-(start+duration+.1))/.3)
        spin=sum(2*math.pi*ease((beat-start)/(end-start)) for start,end in [(6,8),(14,15.5),(22,24),(30,32)])
        sway=math.sin(phase)
        move('Root',(.16*sway+.09*math.sin(phase*.5),.07*math.sin(phase*.25),jump+(1-math.cos(2*phase))*.025))
        rotate('Root',(0,0,1),spin)
        move('Body',(0,0,-crouch))
        rotate('Body',(0,1,0),.15*math.sin(phase*.5))
        rotate('Body',(0,0,1),.15*math.sin(phase*.25))
        rotate('Body',(1,0,0),.10*math.sin(2*phase))
        rotate('Head',(1,0,0),.09*math.sin(2*phase))
        rotate('Head',(0,1,0),-.10*math.sin(phase*.5))
        for side,sign in [('.L',1),('.R',-1)]:
            swing=math.sin(phase+(0 if sign==1 else math.pi))
            lift=max(-.08,min(1.8,.65*sign*math.sin(phase*.5)+.85*math.sin(phase*.25)**2+.30*swing))
            rotate('UpperArm'+side,(0,1,0),sign*lift)
            rotate('UpperArm'+side,(0,0,1),sign*.65*math.sin(phase*.5))
            rotate('Forearm'+side,(1,0,0),.5*swing+.3*sign*math.sin(phase*.5))
            rotate('Hand'+side,(0,0,1),sign*.35*math.sin(2*phase))
            rotate('Hand'+side,(0,1,0),sign*.20*sway)
            rotate('Foot'+side,(0,0,1),sign*.22*sway)
            rotate('Foot'+side,(1,0,0),-.28*max(0,swing))
            move('Foot'+side,(sign*.07*sway,-.18*max(0,swing),.16*max(0,swing)+jump*.15))
        cue=int(beat//4)%4
        if cue in [1,3]:
            for side in ['.L','.R']:
                pb['HappyEye'+side].scale=(.02,.02,.02)
                pb['Eye'+side].scale=idle['Eye'+side][2]
                move('Brow'+side,(0,0,.025))
        if cue==2:
            rotate('Jaw',(1,0,0),math.radians(5))
            move('Tongue',(0,-.045,-.012))
        else:rotate('Jaw',(1,0,0),math.radians(2)*math.sin(2*phase))
        bpy.context.view_layer.update()
        for side in ['.L','.R']:
            raised=pb['Hand'+side].head.z-pb['UpperArm'+side].head.z
            # Leave a generous margin for interpolation: never reveal while lowering past shoulder.
            reveal=ease((raised-.22)/.14)
            pb['Armpit'+side].scale=(reveal,)*3
            report.append({'frame':frame,'side':side,'handAboveShoulder':raised,'furScale':reveal})
        for b in pb:
            b.keyframe_insert('location',frame=frame);b.keyframe_insert('rotation_quaternion',frame=frame);b.keyframe_insert('scale',frame=frame)
    reports[name]=report
for track in list(arm.animation_data.nla_tracks):arm.animation_data.nla_tracks.remove(track)
arm.animation_data.action=None
for name in ['Idle','WalkFwd','Smile','DanceFreestyle']:
    action=bpy.data.actions[name];track=arm.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,0,action);strip.name=name
bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'mole-rhythm-dance-v2.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_apply=False)
(WORK/'pose-audit-v2.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print('DANCE_READY',OUT)
# Front previews of actual skinned poses, independent of any browser.
for track in arm.animation_data.nla_tracks:track.mute=True
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=560;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Dance QA world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.13,.18,.28,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
bpy.ops.object.camera_add(location=(.35,-8,3.0));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.35))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4.0;scene.camera=camera
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));light=bpy.context.object;light.data.energy=450;light.data.size=5
light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
for label,frame in [('Freestyle-step',15),('Freestyle-jump',33),('Freestyle-spin',81)]:
    arm.animation_data.action=bpy.data.actions['DanceFreestyle'];scene.frame_set(frame)
    scene.render.filepath=str(WORK/(label+'.png'));bpy.ops.render.render(write_still=True)
print('PASS: dance actions authored and previews rendered')

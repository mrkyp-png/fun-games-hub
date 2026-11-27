/* Actual 3D plaza mole over the existing 2D rhythm type-selection stage. */
(function(root){
  'use strict';
  const DESIGN={width:941,height:1672,stageX:470.5,stageY:1460,pixelsPerUnit:112};
  const WALK=3,ALIGN=.35,TURN=2.4;
  const VARIATION_BEATS=8, FREESTYLE_INSERT_BEAT=8, FREESTYLE_BEATS=32;
  const VARIATIONS=['DanceSideStep','DanceArmWave','DanceHop','DanceTwist','DanceRobot']; // V1821 C 사용자: 통통 점프·허리 트위스트·로봇 춤 추가
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function sequence(time,reduced){
    time=Math.max(0,time);
    if(reduced)return {phase:'idle',z:0,scale:.78,heading:0,clip:'Idle',clipTime:0};
    if(time<WALK){const k=time/WALK;return {phase:'walk',z:4.8*(1-k),scale:.95-.17*smooth(k),heading:Math.PI,clip:'WalkFwd',clipTime:time};}
    if(time<WALK+ALIGN)return {phase:'align',z:0,scale:.78,heading:Math.PI*(1-smooth((time-WALK)/ALIGN)),clip:'Idle',clipTime:time};
    if(time<WALK+ALIGN+TURN)return {phase:'turn',z:0,scale:.78,heading:2*Math.PI*smooth((time-WALK-ALIGN)/TURN),clip:'Idle',clipTime:time};
    return {phase:'idle',z:0,scale:.78,heading:0,clip:'Idle',clipTime:time};
  }
  function ringOffset(time,reduced){
    if(reduced)return 0;
    time=Math.max(0,time);const start=WALK+ALIGN,end=start+TURN;
    if(time<start)return -100*time/12;
    const base=-100*start/12;
    if(time<end)return base-100*smooth((time-start)/TURN);
    return base-100-100*(time-end)/12;
  }
  function beatAt(time,map){
    const beats=map.beats,bps=map.bpm/60;
    if(!beats.length)return time*bps;
    if(time<=beats[0])return (time-beats[0])*bps;
    let low=0,high=beats.length-1;
    while(high-low>1){const middle=(low+high)>>1;if(beats[middle]<=time)low=middle;else high=middle;}
    if(time>=beats[high])return high+(time-beats[high])*bps;
    return low+(time-beats[low])/(beats[high]-beats[low]);
  }
  function dancePose(beat,start,reduced){
    if(reduced||start===null||beat<start)return null;
    const added=VARIATION_BEATS*VARIATIONS.length;
    const age=(beat-start)%(FREESTYLE_BEATS+added);
    const variation=Math.floor((age-FREESTYLE_INSERT_BEAT)/VARIATION_BEATS);
    const clip=VARIATIONS[variation]||'DanceFreestyle';
    const clipTime=VARIATIONS[variation]?(age-FREESTYLE_INSERT_BEAT-variation*VARIATION_BEATS)/2:
      (age<FREESTYLE_INSERT_BEAT?age:age-added)/2;
    return {phase:'dance',z:0,scale:.78,heading:0,clip,clipTime};
  }
  function addDanceVariations(rig,R){
    const freestyle=rig.animations.find(clip=>clip.name==='DanceFreestyle');
    if(!freestyle)return;
    const duration=VARIATION_BEATS/2, fps=24;
    const times=Float32Array.from({length:duration*fps+1},(_,frame)=>frame/fps);
    const sides=[['.L',1],['.R',-1]];
    const nodes=new Map(rig.model.json.nodes.map((node,index)=>[node.name,index]));
    for(const [variant,name] of VARIATIONS.entries()){
      const tracks=freestyle.tracks.map(track=>{
        const rest=R.sample(track,FREESTYLE_INSERT_BEAT/2);
        const values=new Float32Array(times.length*track.width);
        for(let frame=0;frame<times.length;frame++)values.set(rest,frame*track.width);
        return {...track,times,values,interpolation:'LINEAR'};
      });
      const channels=new Map(tracks.map(track=>[track.node+':'+track.path,track]));
      const channel=(bone,path)=>channels.get(nodes.get(bone)+':'+path);
      rig.animations.push({name,duration,tracks});
      for(let frame=1;frame<times.length-1;frame++){
        const beat=times[frame]*2;
        const fade=smooth(Math.min(beat,VARIATION_BEATS-beat)/.65);
        const sway=Math.sin(beat*Math.PI/2), step=Math.sin(beat*Math.PI);
        const pulse=step*step;
        function shift(bone,x,y,z){
          const values=channel(bone,'translation').values, i=frame*3;
          values[i]+=x*fade; values[i+1]+=y*fade; values[i+2]+=z*fade;
        }
        function turn(bone,axis,angle){
          const values=channel(bone,'rotation').values, i=frame*4;
          const ax=Math.sin(angle*fade/2), w=Math.cos(angle*fade/2);
          const [x,y,z]=[axis===0?ax:0,axis===1?ax:0,axis===2?ax:0];
          const [a,b,c,d]=values.subarray(i,i+4);
          values.set([w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c],i);
        }
        if(variant===0){
          // Alternating crossing steps with a compact shoulder sway.
          shift('Root',.36*sway,0,0);
          turn('Body',2,-.21*sway);
          turn('Head',2,.13*sway);
          turn('Body',1,.24*step);
          for(const [side,sign] of sides){
            const swing=Math.max(0,sign*step);
            shift('Foot'+side,.51*sign*swing,.24*swing,.20*swing);
            turn('Foot'+side,1,sign*.34*swing);
            turn('UpperArm'+side,2,-sign*(.18+.75*swing));
            turn('UpperArm'+side,1,sign*.65*swing);
          }
        }else if(variant===2){
          // 통통 점프: 박자마다 제자리 뜀, 두 손을 위로 번갈아 찌름
          const hop=Math.abs(Math.sin(beat*Math.PI)),up=Math.floor(beat)%2?1:-1;
          shift('Root',0,.32*hop,0);turn('Head',0,-.12*hop);
          for(const [side,sign] of sides){const punch=sign===up?hop:0;
            turn('UpperArm'+side,2,-sign*(.35+1.75*punch));turn('UpperArm'+side,1,sign*.25*punch);
            shift('Foot'+side,0,.10*hop,0);}
        }else if(variant===3){
          // 허리 트위스트: 몸통 좌우 비틀기 + 팔 앞뒤 펌프
          turn('Body',1,.55*sway);turn('Head',1,-.30*sway);shift('Body',0,.05*pulse,0);
          for(const [side,sign] of sides){
            turn('UpperArm'+side,2,-sign*.55);turn('UpperArm'+side,0,.85*sign*sway);
            shift('Foot'+side,0,.07*Math.max(0,sign*sway),0);}
        }else if(variant===4){
          // 로봇 춤: 팔을 직각으로 꺾어 박자마다 딱딱 끊어 움직임
          const q=Math.floor(beat)%4,snap=smooth((beat%1)/.18),poseOf=k=>[[1,-1],[-1,1],[1,1],[-1,-1]][k];
          const now=poseOf(q),prev=poseOf((q+3)%4),mix=i=>prev[i]+(now[i]-prev[i])*snap;
          turn('Head',1,.32*mix(0));turn('Body',1,.12*mix(0));
          for(const [side,sign] of sides){const k=sign>0?mix(0):mix(1);
            turn('UpperArm'+side,2,-sign*1.25);turn('UpperArm'+side,0,.55*k);
            turn('Forearm'+side,2,-sign*1.35);turn('Hand'+side,2,sign*.3*k);}
        }else{
          // A rising arm wave with a two-beat weight shift and head nods.
          shift('Body',.09*sway,.12*pulse,0);
          turn('Body',2,.16*sway);
          turn('Head',0,.18*step);
          turn('Head',2,-.12*sway);
          for(const [side,sign] of sides){
            const swing=sign*sway;
            turn('UpperArm'+side,2,-sign*(.83+.38*swing+.16*pulse));
            turn('UpperArm'+side,1,sign*(.39-.22*swing));
            turn('Hand'+side,1,sign*.38*step);
            shift('Foot'+side,-.06*sign*swing,.09*Math.max(0,sign*step),0);
          }
        }
      }
      for(let frame=1;frame<times.length-1;frame++){
        const pose=R.pose(rig,name,times[frame],false);
        for(const [side] of sides){
          const raised=pose[nodes.get('Hand'+side)][13]-pose[nodes.get('UpperArm'+side)][13];
          channel('Armpit'+side,'scale').values.fill(smooth((raised-.22)/.14),frame*3,frame*3+3);
        }
      }
    }
  }
  function placement(width,height){
    const scale=Math.max(width/DESIGN.width,height/DESIGN.height);
    return {scale,x:(width-DESIGN.width*scale)/2+DESIGN.stageX*scale,
      y:(height-DESIGN.height*scale)/2+DESIGN.stageY*scale};
  }
  function beamUniforms(frame){
    return frame.states.slice(0,2).map(state=>{
      const anchor=frame.calibration.beams[state.lamp.beam],cell=frame.calibration.beamCell;
      const apexX=anchor[0]/cell[0],apexY=anchor[1]/cell[1],height=state.distance/(anchor[2]/cell[1]-apexY);
      return {rect:[state.x,state.y,state.width,height],axes:[Math.cos(state.angle),Math.sin(state.angle),apexX,apexY],
        cell:[state.lamp.beam%2,Math.floor(state.lamp.beam/2),state.intensity,0],
        emitter:[(state.x-DESIGN.stageX)/DESIGN.pixelsPerUnit,(DESIGN.stageY-state.y)/DESIGN.pixelsPerUnit,4]};
    });
  }
  function beamUV(beam,x,y){
    const [px,py,width,height]=beam.rect,[ux,uy,ax,ay]=beam.axes,dx=x-px,dy=y-py;
    return [(dx*uy-dy*ux)/width+ax,(dx*ux+dy*uy)/height+ay];
  }
  const api={sequence,ringOffset,beatAt,dancePose,addDanceVariations,placement,beamUniforms,beamUV,DESIGN,duration:WALK+ALIGN+TURN};
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const screen=root.document.getElementById('rhythm-screen'),panel=screen&&screen.querySelector('[data-rp-types]');
  if(!panel||!root.StudioRig)return;
  const R=root.StudioRig;
  const ring=panel.querySelector('.rp-type-floor-light');
  function releaseRing(){if(ring){ring.style.removeProperty('animation');ring.style.removeProperty('stroke-dashoffset');}}
  const modelURL=new URL('../assets/characters-v1692/mole-rhythm-dance-v2.glb',document.currentScript.src);
  const beatMap=root.MoleGame.RhythmDanceBeats||{bpm:165.56,beats:[],duration:51.96};
  const canvas=document.createElement('canvas');canvas.className='rp-type-mole';canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  panel.appendChild(canvas);
  let modelPromise=null,loading=null,renderer=null,frame=0,previous=0,elapsed=0,panelWasVisible=false,contextLost=false;
  let size={width:0,height:0};
  let danceStart=null,lastSongTime=0,musicLoops=0,displayedPose=sequence(0,false),lastDanceYaw=null,danceRingTurns=0;
  function danceBeat(time){
    const audio=document.getElementById('rhythm-entry-bgm');
    if(audio&&!audio.paused&&Number.isFinite(audio.currentTime)){
      if(audio.currentTime<lastSongTime-1)musicLoops++;
      lastSongTime=audio.currentTime;
      return beatAt(audio.currentTime,beatMap)+musicLoops*Math.ceil(beatAt(beatMap.duration,beatMap));
    }
    return time*beatMap.bpm/60;
  }
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  function loadModel(){
    if(!modelPromise)modelPromise=fetch(modelURL).then(response=>{if(!response.ok)throw Error('Rhythm mole model '+response.status);return response.arrayBuffer();}).then(R.parseGLB).then(model=>root.MoleGame.MoleAppearances.prepare(model,['mohawk'])).then(model=>root.MoleGame.MoleAppearances.paint(model,'mohawk')).catch(error=>{modelPromise=null;throw error;});
    return modelPromise;
  }
  // V1819 C 사용자: 브금 첫 바퀴 끝 무렵 좌우에서 가시머리(타임 키퍼)·파마머리(세이프 찬스)가 걸어와 모히칸 뒤 좌우에 서고, 두 번째 바퀴부터 같이 춤
  const AP=root.MoleGame.MoleAppearances,FRIENDS=[{style:'spiky',costume:'hold-time',side:-1,hair:[.80,.02,.02,1]},{style:'curly',costume:'safe-chance',side:1,hair:[.02,.12,.85,1]}]; // 사용자: 머리색 가시=빨강, 파마=파랑 원색(이 화면만)
  function loadFriends(){return Promise.all([fetch(modelURL).then(r=>{if(!r.ok)throw Error('friends '+r.status);return r.arrayBuffer();}).then(R.parseGLB).then(m=>AP.prepare(m,FRIENDS.map(f=>f.style))),...FRIENDS.map(f=>AP.wornCostume(f.costume))]).catch(error=>{console.warn('Rhythm stage friends unavailable',error);return null;});}
  function prepare(){return Promise.all([loadModel(),AP.arcadeRepair(),loadFriends()]);}
  function makeRenderer(model,costume,friends){
    const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});
    if(!gl)throw Error('WebGL2 unavailable for rhythm stage mole');
    const rig=R.prepare(model),skin=rig.skins[0],jointCount=skin.joints.length,rootNode=model.json.nodes.findIndex(n=>n.name==='Root');
    addDanceVariations(rig,R);
    const smile=rig.animations.find(clip=>clip.name==='Smile');
    const face=smile&&smile.tracks.filter(track=>{const name=model.json.nodes[track.node].name;return name==='Jaw'||/^(Brow|MouthCorner|HappyEye)\.[LR]$/.test(name)||(track.path==='scale'&&/^(Eye|PainEye)\.[LR]$/.test(name));});
    const vertex=`#version 300 es
precision highp float;
in vec3 aPosition,aNormal;in vec4 aColor,aJoints,aWeights;in vec2 aUV;
uniform mat4 uModel,uVP,uBones[${jointCount}];uniform mat3 uNormal;uniform bool uSkin;
out vec3 vNormal,vWorld;out vec4 vColor;out vec2 vUV;
void main(){mat4 s=mat4(1.);if(uSkin)s=aWeights.x*uBones[int(aJoints.x)]+aWeights.y*uBones[int(aJoints.y)]+aWeights.z*uBones[int(aJoints.z)]+aWeights.w*uBones[int(aJoints.w)];
vec4 p=uModel*s*vec4(aPosition,1.);vWorld=p.xyz;vNormal=normalize(uNormal*mat3(s)*aNormal);vColor=aColor;vUV=aUV;gl_Position=uVP*p;}`;
    const fragment=`#version 300 es
precision highp float;in vec3 vNormal,vWorld;in vec4 vColor;in vec2 vUV;uniform vec4 uColor;uniform bool uShadow,uBeamReady;
uniform sampler2D uBeamTexture;uniform vec4 uBeamRects[2],uBeamAxes[2],uBeamCells[2],uCanvasFit;uniform vec3 uEmitters[2];out vec4 frag;
void main(){if(uShadow){float r=length(vUV*2.-1.);frag=vec4(0.,0.,.03,(1.-smoothstep(.1,1.,r))*.34);return;}
vec3 n=normalize(vNormal);float key=max(0.,dot(n,normalize(vec3(-.4,.85,.65))));float rim=max(0.,dot(n,normalize(vec3(.75,.35,-.65))));
vec3 color=uColor.rgb*vColor.rgb*(.40+key*.63)+vec3(.035,.055,.10)*rim;
if(uBeamReady){
  vec2 pixel=vec2(gl_FragCoord.x,uCanvasFit.w-gl_FragCoord.y),design=(pixel-uCanvasFit.yz)/uCanvasFit.x;
  for(int i=0;i<2;i++){
    vec2 delta=design-uBeamRects[i].xy,axis=uBeamAxes[i].xy;
    vec2 local=vec2(dot(delta,vec2(axis.y,-axis.x)),dot(delta,axis));
    vec2 uv=local/uBeamRects[i].zw+uBeamAxes[i].zw;
    if(local.y<0.||any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
    vec4 light=texture(uBeamTexture,(uv+uBeamCells[i].xy)*.5);
    float hit=light.a*uBeamCells[i].z*.8;
    vec3 direction=normalize(uEmitters[i]-vWorld);float diffuse=max(0.,dot(n,direction));
    vec3 halfVector=normalize(direction+normalize(vec3(0.,3.,8.)-vWorld));
    color+=uColor.rgb*vColor.rgb*light.rgb*hit*(.24+diffuse*1.25)+light.rgb*hit*.10*pow(max(0.,dot(n,halfVector)),20.);
  }
}
frag=vec4(pow(clamp(color,0.,1.),vec3(1./2.2)),1.);}`;
    function shader(type,source){const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
    const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    const U={},A={},buffers=[],vaos=[];
    for(const name of ['Model','VP','Bones','Normal','Skin','Color','Shadow','BeamReady','BeamTexture','BeamRects','BeamAxes','BeamCells','Emitters','CanvasFit'])U[name]=gl.getUniformLocation(program,'u'+(['Bones','BeamRects','BeamAxes','BeamCells','Emitters'].includes(name)?name+'[0]':name));
    for(const name of ['Position','Normal','Color','Joints','Weights','UV'])A[name]=gl.getAttribLocation(program,'a'+name);
    function attribute(name,data,width){
      if(A[name]<0)return;
      const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(A[name]);gl.vertexAttribPointer(A[name],width,gl.FLOAT,false,0,0);
    }
    const parts=[];
    function addPart(source,primitive,index,style,list=parts,jointMap=null,dropJoint=-1){
        const vao=gl.createVertexArray();vaos.push(vao);gl.bindVertexArray(vao);
        for(const [name,key,width] of [['Position','POSITION',3],['Normal','NORMAL',3],['Color','COLOR_0',4],['Joints','JOINTS_0',4],['Weights','WEIGHTS_0',4]]){
          const accessor=primitive.attributes[key];
          if(accessor!==undefined)attribute(name,jointMap&&name==='Joints'?Float32Array.from(R.accessor(source,accessor),v=>jointMap[v]??v):style&&name==='Color'?(AP.vertexColors(source,primitive,style)||R.accessor(source,accessor)):R.accessor(source,accessor),source.json.accessors[accessor].type==='VEC3'?3:width);
        }
        let indices=primitive.indices!==undefined?R.accessor(source,primitive.indices):null;
        // 사용자: 타입 선택 화면 파마머리는 안경 없음 → 머리 뼈에 붙은 높은 점(고글)이 있는 삼각형 빼기(목깃은 남김)
        if(indices&&dropJoint>=0){const P=R.accessor(source,primitive.attributes.POSITION),J=R.accessor(source,primitive.attributes.JOINTS_0),Wt=R.accessor(source,primitive.attributes.WEIGHTS_0),gone=v=>{let b=0;for(let q=1;q<4;q++)if(Wt[v*4+q]>Wt[v*4+b])b=q;return J[v*4+b]===dropJoint&&P[v*3+1]>1.95;},keep=[];for(let t=0;t<indices.length;t+=3)if(!gone(indices[t])&&!gone(indices[t+1])&&!gone(indices[t+2]))keep.push(indices[t],indices[t+1],indices[t+2]);indices=keep;}
        if(indices){const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);}
        const material=source.json.materials?.[primitive.material];
        list.push({vao,node:index,indexed:!!indices,count:indices?indices.length:source.json.accessors[primitive.attributes.POSITION].count,
          color:style&&material?AP.materialColor(material,style):material?.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1]});
    }
    model.json.nodes.forEach((node,index)=>{
      if((node.name!=='Mole_Clay_Skin'&&root.MoleGame.MoleAppearances.hairStyle(node)!=='mohawk')||node.mesh===undefined)return;
      for(const primitive of model.json.meshes[node.mesh].primitives)addPart(model,primitive,index);
    });
    if(!parts.length)throw Error('Rhythm stage mole skin missing');
    for(const {joint,primitive} of root.MoleGame.MoleAppearances.costumeParts(model,costume))addPart(costume,primitive,joint);
    // 친구 두더지: 같은 춤 모델(머리 2종 붙임)을 따로 준비, 몸색·머리·복장은 머리 모양별로
    let rig2=null;const friendParts={};
    if(friends){
      const [model2,...worn]=friends;rig2=R.prepare(model2);addDanceVariations(rig2,R);
      const skin2=model2.json.nodes.findIndex(n=>n.name==='Mole_Clay_Skin');
      // 사용자: 세이프 찬스 조끼가 팔 올릴 때 늘어남 → 옷(소매 없음)은 팔 뼈 대신 몸통 뼈를 따라감
      const jn=skin2>=0?model2.json.skins[model2.json.nodes[skin2].skin].joints.map(n=>model2.json.nodes[n].name):[],bodyJ=jn.indexOf('Body'),clothMap=bodyJ<0?null:jn.map((name,i)=>/^(UpperArm|Forearm|Hand|Finger|Thumb|Armpit)/.test(name)?bodyJ:i);
      FRIENDS.forEach((f,k)=>{const list=friendParts[f.style]=[];
        model2.json.nodes.forEach((node,index)=>{if(node.mesh===undefined)return;const hair=AP.hairStyle(node);if(node.name!=='Mole_Clay_Skin'&&hair!==f.style)return;for(const primitive of model2.json.meshes[node.mesh].primitives){addPart(model2,primitive,index,f.style,list);if(hair===f.style&&f.hair)list[list.length-1].color=f.hair;}});
        if(worn[k]&&skin2>=0)for(const {primitive} of R.instances(worn[k]))addPart(worn[k],primitive,skin2,null,list,clothMap,f.style==='curly'?jn.indexOf('Head'):-1);});
    }
    const shadow=gl.createVertexArray();vaos.push(shadow);gl.bindVertexArray(shadow);
    attribute('Position',new Float32Array([-.85,.002,-.48,.85,.002,-.48,.85,.002,.48,-.85,.002,-.48,.85,.002,.48,-.85,.002,.48]),3);
    attribute('UV',new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]),2);
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    if(A.Color>=0)gl.vertexAttrib4f(A.Color,1,1,1,1);
    const camera=R.lookAt([0,3,8],[0,0,0]);
    const beamTexture=gl.createTexture();let beamImage=null;
    return {
      render(time,width,height,reduce){
        if(!width||!height)return;
        const dpr=Math.min(root.devicePixelRatio||1,1.25),w=Math.round(width*dpr),h=Math.round(height*dpr);
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
        const fit=placement(w,h),projection=R.identity(),pixels=DESIGN.pixelsPerUnit*fit.scale;
        const lighting=root.MG&&root.MG.rhythmTypeLighting,lightFrame=lighting&&lighting.lightFrame&&lighting.lightFrame();
        gl.uniform1i(U.BeamReady,!!lightFrame);
        if(lightFrame){
          gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,beamTexture);
          if(beamImage!==lightFrame.atlas){
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,lightFrame.atlas);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);beamImage=lightFrame.atlas;
          }
          const beams=beamUniforms(lightFrame);
          gl.uniform4fv(U.BeamRects,new Float32Array(beams.flatMap(b=>b.rect)));gl.uniform4fv(U.BeamAxes,new Float32Array(beams.flatMap(b=>b.axes)));
          gl.uniform4fv(U.BeamCells,new Float32Array(beams.flatMap(b=>b.cell)));gl.uniform3fv(U.Emitters,new Float32Array(beams.flatMap(b=>b.emitter)));
          gl.uniform4f(U.CanvasFit,fit.scale,(w-DESIGN.width*fit.scale)/2,(h-DESIGN.height*fit.scale)/2,h);gl.uniform1i(U.BeamTexture,0);
        }
        projection[0]=2*pixels/w;projection[5]=2*pixels/h;projection[10]=-2/50;
        projection[12]=2*fit.x/w-1;projection[13]=1-2*fit.y/h;
        gl.uniformMatrix4fv(U.VP,false,R.multiply(projection,camera));
        let state=sequence(time,reduce);
        if(state.phase==='idle'&&!reduce){
          const beat=danceBeat(time);if(danceStart===null)danceStart=Math.ceil(beat);
          state=dancePose(beat,danceStart,reduce)||state;
        }
        displayedPose=state;
        const worlds=root.MoleGame.MoleAppearances.pose(rig,state.clip,state.clipTime,true,state.phase==='dance'?null:face,time);
        if(state.phase==='dance'){
          const yaw=Math.atan2(worlds[rootNode][8],worlds[rootNode][10]);
          if(lastDanceYaw!==null)danceRingTurns+=Math.atan2(Math.sin(yaw-lastDanceYaw),Math.cos(yaw-lastDanceYaw))/(2*Math.PI);
          lastDanceYaw=yaw;
        }else{lastDanceYaw=null;if(reduce)danceRingTurns=0;}
        if(ring){ring.style.animation='none';ring.style.strokeDashoffset=String(ringOffset(time,reduce)-100*danceRingTurns);}
        const instance=R.transform({translation:[0,.105*state.scale,state.z],rotation:[0,Math.sin(state.heading/2),0,Math.cos(state.heading/2)],scale:[state.scale,state.scale,state.scale]});
        gl.bindVertexArray(shadow);gl.uniform1i(U.Shadow,1);gl.uniform1i(U.Skin,0);
        const floor=R.transform({translation:[0,0,state.z],scale:[state.scale,1,state.scale]});
        gl.uniformMatrix4fv(U.Model,false,floor);gl.uniformMatrix3fv(U.Normal,false,R.normals(floor));gl.drawArrays(gl.TRIANGLES,0,6);gl.uniform1i(U.Shadow,0);
        function drawParts(list,inst,rigX,ws){for(const part of list){
          gl.bindVertexArray(part.vao);const matrix=R.multiply(inst,ws[part.node]),bones=R.palette(rigX,ws,part.node);
          gl.uniformMatrix4fv(U.Model,false,matrix);gl.uniformMatrix3fv(U.Normal,false,R.normals(matrix));gl.uniform4fv(U.Color,part.color);
          gl.uniform1i(U.Skin,!!bones);if(bones)gl.uniformMatrix4fv(U.Bones,false,bones);
          if(part.indexed)gl.drawElements(gl.TRIANGLES,part.count,gl.UNSIGNED_INT,0);else gl.drawArrays(gl.TRIANGLES,0,part.count);
        }}
        drawParts(parts,instance,rig,worlds);
        if(rig2&&!reduce)FRIENDS.forEach(f=>{const fs=friendState(time,f.side,state);if(!fs)return;
          const ws=AP.pose(rig2,fs.clip,fs.clipTime,true,fs.phase==='dance'?null:AP.face(rig2,false),time,f.style);
          const inst=R.transform({translation:[fs.x,.105*fs.scale,fs.z],rotation:[0,Math.sin(fs.heading/2),0,Math.cos(fs.heading/2)],scale:[fs.scale,fs.scale,fs.scale]});
          gl.bindVertexArray(shadow);gl.uniform1i(U.Shadow,1);gl.uniform1i(U.Skin,0);const fl=R.transform({translation:[fs.x,0,fs.z],scale:[fs.scale,1,fs.scale]});
          gl.uniformMatrix4fv(U.Model,false,fl);gl.uniformMatrix3fv(U.Normal,false,R.normals(fl));gl.drawArrays(gl.TRIANGLES,0,6);gl.uniform1i(U.Shadow,0);
          drawParts(friendParts[f.style],inst,rig2,ws);});
      },
      dispose(){for(const b of buffers)gl.deleteBuffer(b);for(const v of vaos)gl.deleteVertexArray(v);gl.deleteTexture(beamTexture);gl.deleteProgram(program);}
    };
  }
  // 첫 바퀴 끝 FRIEND_WALK 초 전부터 걸어 들어와, 다음 바퀴부터 모히칸과 같은 춤
  const FRIEND_WALK=4.5,FRIEND_IN=5.5,FRIEND_X=1.85,FRIEND_Z=-1.5,FRIEND_FROM=4.3;
  function songClock(time){const audio=document.getElementById('rhythm-entry-bgm');if(audio&&!audio.paused&&Number.isFinite(audio.currentTime))return {t:audio.currentTime,loops:musicLoops};return {t:time%beatMap.duration,loops:Math.floor(time/beatMap.duration)};}
  function friendState(time,side,main){
    const c=songClock(time),scale=.78*.95*.9,/* 사용자: 뒤 두더지 = 앞의 95% → 10% 더 작게 */home={x:side*FRIEND_X,z:FRIEND_Z,scale};
    if(c.loops>=1)return main.phase==='dance'?{...home,phase:'dance',heading:0,clip:main.clip,clipTime:main.clipTime}:{...home,phase:'idle',heading:0,clip:'Idle',clipTime:time};
    const start=beatMap.duration-FRIEND_IN;if(c.t<start)return null;
    const k=(c.t-start)/FRIEND_WALK;
    if(k<1)return {phase:'walk',x:side*(FRIEND_FROM-(FRIEND_FROM-FRIEND_X)*k),z:FRIEND_Z,scale,heading:-side*Math.PI/2,clip:'WalkFwd',clipTime:c.t};
    return {...home,phase:'idle',heading:-side*Math.PI/2*(1-smooth((c.t-start-FRIEND_WALK)/.5)),clip:'Idle',clipTime:c.t};
  }
  function visible(){return !screen.hidden&&!panel.hidden&&!document.hidden&&!contextLost;}
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;previous=0;}
  function resize(){const bounds=panel.getBoundingClientRect();size={width:bounds.width,height:bounds.height};if(renderer&&visible())renderer.render(elapsed,size.width,size.height,reduced.matches);}
  function tick(now){
    frame=0;if(!renderer||!visible())return;
    if(!previous)previous=now;
    if(now-previous>=1000/30){elapsed+=Math.min(.1,(now-previous)/1000);previous=now;renderer.render(elapsed,size.width,size.height,reduced.matches);}
    if(!reduced.matches)frame=requestAnimationFrame(tick);
  }
  function sync(){
    const panelVisible=!screen.hidden&&!panel.hidden;
    if(panelVisible&&!panelWasVisible){elapsed=0;danceStart=null;lastSongTime=0;musicLoops=0;lastDanceYaw=null;danceRingTurns=0;}
    panelWasVisible=panelVisible;stop();canvas.hidden=!visible();
    if(!visible())return;
    if(!renderer){
      if(!loading)loading=prepare().then(([model,costume,friends])=>{if(contextLost)return;renderer=makeRenderer(model,costume,friends);resize();sync();}).catch(error=>{canvas.hidden=true;releaseRing();console.warn('Rhythm stage mole unavailable; selection remains usable.',error);}).finally(()=>{loading=null;});
      return;
    }
    resize();if(!reduced.matches)frame=requestAnimationFrame(tick);
  }
  const observer=new MutationObserver(sync);
  observer.observe(screen,{attributes:true,attributeFilter:['hidden']});observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',sync);root.addEventListener('resize',resize,{passive:true});
  if(root.ResizeObserver)new ResizeObserver(resize).observe(panel);
  if(reduced.addEventListener)reduced.addEventListener('change',sync);
  if(screen._rpSelectionLightingReady)screen._rpSelectionLightingReady.then(()=>{if(renderer&&visible())resize();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;stop();renderer=null;canvas.hidden=true;releaseRing();});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;sync();});
  root.MoleGame.RhythmTypeMole={...api,state:()=>({...displayedPose,running:!!frame,ready:!!renderer}),prepare:loadModel};
  sync();
})(typeof window!=='undefined'?window:globalThis);

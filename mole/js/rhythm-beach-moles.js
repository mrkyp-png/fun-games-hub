/* Four real 3D actors share one WebGL canvas and the existing beach audio clock. */
(function(root){'use strict';
const MG=root.MoleGame,R=root.StudioRig,AP=MG.MoleAppearances,FX=MG.RhythmBeachStunts;let modelPromise;
function load(){if(!modelPromise)modelPromise=fetch('assets/characters-v1692/mole-clay-v47-smile.glb').then(r=>{if(!r.ok)throw Error('Beach mole model '+r.status);return r.arrayBuffer()}).then(R.parseGLB).then(m=>AP.prepare(m)).catch(e=>{modelPromise=null;throw e});return modelPromise}
function create(stage){
 let canvas,gl,rig,parts=[],program,U,A,ready=false,loading=null,lost=false,geometry=null,lastHandError=0;
 const holeBase='assets/rhythm/beach-sand-hole-v1690/';
 function prepare(){if(ready&&!lost)return Promise.resolve(true);if(!loading)loading=Promise.all([load(),fetch(holeBase+'geometry.json').then(r=>{if(!r.ok)throw Error('Hole geometry '+r.status);return r.json()}),AP.arcadeRepair(),AP.wornCostume('hold-time'),AP.wornCostume('double-hit'),AP.wornCostume('safe-chance'),fetch('assets/characters-v1727/mole-game-smile.glb').then(r=>r.ok?r.arrayBuffer():null).then(b=>b?R.parseGLB(b):null).catch(()=>null)]).then(([model,data,costume,...others])=>{const surprise=others.pop();geometry=data;return initialize(model,costume,others,surprise)}).catch(e=>{loading=null;canvas?.remove();canvas=null;throw e});return loading}
 async function initialize(model,costume,others=[],surprise=null){
  if(canvas)canvas.remove();parts=[];
  canvas=document.createElement('canvas');canvas.className='rp-beach-moles-3d';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;ready=false;stop()});canvas.addEventListener('webglcontextrestored',()=>{lost=false;loading=null;prepare().catch(console.error)});
  gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true});if(!gl)throw Error('WebGL2 is required for beach characters');rig=R.prepare(model);fingerAxes=knuckleAxes(rig);{const nodes=rig.model.json.nodes,h=nodes.findIndex(n=>n.name==='Head'),walk=k=>{headTree.push(k);for(const c of nodes[k].children||[])walk(c);};headTree=[];if(h>=0)walk(h);eyeBones=nodes.map((n,k)=>[k,n.name]).filter(([,n])=>/^Eye\.[LR]$/.test(n||''));browBones=nodes.map((n,k)=>/^Brow\.[LR]$/.test(n.name||'')?k:-1).filter(k=>k>=0);}armRestPose=restArms(rig);
  const joints=Math.max(...rig.skins.map(s=>s.joints.length));
  const vs=`#version 300 es
precision highp float;in vec3 aPosition,aNormal;in vec4 aColor,aJoints,aWeights;in float aHand;uniform mat4 uModel,uVP,uBones[${joints}];uniform bool uSkin;out vec3 vNormal;out vec4 vColor;out float vHand;void main(){mat4 s=mat4(1.);if(uSkin)s=aWeights.x*uBones[int(aJoints.x)]+aWeights.y*uBones[int(aJoints.y)]+aWeights.z*uBones[int(aJoints.z)]+aWeights.w*uBones[int(aJoints.w)];vec4 p=uModel*s*vec4(aPosition,1.);vNormal=normalize(mat3(uModel)*mat3(s)*aNormal);vColor=aColor;vHand=aHand;gl_Position=uVP*p;}`;
  const fs=`#version 300 es
precision highp float;in vec3 vNormal;in vec4 vColor;in float vHand;uniform vec4 uColor,uHoleRect;uniform sampler2D uHoleMask,uHoleFront;uniform float uFlash,uHandsOnRim;out vec4 frag;void main(){vec2 uv=vec2((gl_FragCoord.x-uHoleRect.x)/uHoleRect.z,(uHoleRect.y-gl_FragCoord.y)/uHoleRect.w);if(uv.y>1.)discard;float cover=uv.y<0.?0.:texture(uHoleMask,clamp(uv,vec2(0.),vec2(1.))).a;float visibility=1.-cover*(1.-uHandsOnRim*step(.5,vHand));if(visibility<.001)discard;float d=max(dot(normalize(vNormal),normalize(vec3(-.4,.85,1.))),0.);vec3 base=uColor.rgb*vColor.rgb;base=mix(base,vec3(1.),uFlash);vec3 body=pow(max(base*(.42+.58*d),vec3(0.)),vec3(1./2.2));vec4 front=texture(uHoleFront,clamp(uv,vec2(0.),vec2(1.)));vec3 sand=front.rgb/max(front.a,.00001);frag=vec4(mix(body,sand,1.-visibility),uColor.a*vColor.a);}`;
  function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  program=gl.createProgram();const shaders=[shader(gl.VERTEX_SHADER,vs),shader(gl.FRAGMENT_SHADER,fs)];for(const s of shaders)gl.attachShader(program,s);gl.linkProgram(program);for(const s of shaders)gl.deleteShader(s);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  U=Object.fromEntries(['Model','VP','Bones','Skin','Color','HoleRect','HoleMask','HoleFront','Flash','HandsOnRim'].map(n=>[n,gl.getUniformLocation(program,'u'+(n==='Bones'?'Bones[0]':n))]));A=Object.fromEntries(['Position','Normal','Color','Joints','Weights','Hand'].map(n=>[n,gl.getAttribLocation(program,'a'+n)]));
  function attribute(name,data,width){const loc=A[name];if(loc<0)return null;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,width,gl.FLOAT,false,0,0);return b}
  function addPart(source,p,index,style,rigid=false){
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);const n=source.json.accessors[p.attributes.POSITION].count;
   attribute('Position',R.accessor(source,p.attributes.POSITION),3);
   attribute('Normal',R.accessor(source,p.attributes.NORMAL),3);
   if(!rigid){
    const joints=R.accessor(source,p.attributes.JOINTS_0),weights=R.accessor(source,p.attributes.WEIGHTS_0);
    attribute('Joints',joints,4);attribute('Weights',weights,4);
    const skin=rig.skins[model.json.nodes[index].skin],handFlags=new Float32Array(n);
    if(source!==model&&p.attributes._HAND!==undefined)handFlags.set(R.accessor(source,p.attributes._HAND)); // 도복 소매 끝(커프)만 손처럼 턱 앞에
    if(source===model)for(let v=0;v<n;v++)for(let k=0;k<4;k++)if(/^(Hand|Finger[123]|Thumb)\./.test(model.json.nodes[skin.joints[joints[v*4+k]]].name))handFlags[v]+=weights[v*4+k]; // 옷은 손 예외 없음(모래 턱 뒤로 가려짐)
    attribute('Hand',handFlags,1);
   }
   const colors=p.attributes.COLOR_0===undefined?new Float32Array(n*4).fill(1):R.accessor(source,p.attributes.COLOR_0),colorSize=p.attributes.COLOR_0===undefined?4:source.json.accessors[p.attributes.COLOR_0].type==='VEC3'?3:4;
   const material=source.json.materials?.[p.material]||{},colorBuffer=attribute('Color',colors,colorSize),variants={};
   if(material.name==='Head smooth tone')for(const id of AP.styles)variants[id]=attribute('Color',AP.vertexColors(source,p,id),colorSize);
   const indices=R.accessor(source,p.indices),ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);
   parts.push({vao,node:index,count:indices.length,style,material,colorBuffer,variants,colorSize,rigid});
  }
  model.json.nodes.forEach((node,index)=>{
   const style=AP.hairStyle(node);
   if(node.mesh===undefined||(node.name!=='Mole_Clay_Skin'&&!style))return;
   for(const p of model.json.meshes[node.mesh].primitives)addPart(model,p,index,style);
  });
  for(const {joint,primitive} of AP.costumeParts(model,costume))addPart(costume,primitive,joint,'mohawk',true);
  // V1812 C 사용자: 2번 타임 키퍼, 3번 연타 도장 사범, 4번 세이프 찬스
  // 옷 점마다 두더지 몸 뼈 가중치(소매=팔, 이마띠=머리) → 두더지 몸과 같은 스킨으로 그림
  // V1814 C 사용자: 점프 = 두더지팡 놀란 눈(흰자위+눈동자 'Surprise' 부품, 머리 뼈에 고정)
  if(surprise){const head=model.json.nodes.findIndex(n=>n.name==='Head');surprise.json.nodes.forEach(n=>{if(!/^Surprise /.test(n.name||'')||n.mesh===undefined)return;for(const p of surprise.json.meshes[n.mesh].primitives){addPart(surprise,p,head,null,true);const part=parts[parts.length-1];part.surprise=true;part.local=R.transform({translation:n.translation||[0,0,0],rotation:n.rotation||[0,0,0,1],scale:n.scale||[1,1,1]});}});}
  const skinNode=model.json.nodes.findIndex(n=>n.name==='Mole_Clay_Skin');others.forEach((worn,k)=>{if(worn&&skinNode>=0)for(const {primitive} of R.instances(worn))addPart(worn,primitive,skinNode,AP.styles[k+1]);});
  for(const [slot,file] of [[0,'hole-occlusion.png'],[1,'hole-front.png']]){
   const response=await fetch(holeBase+file);if(!response.ok)throw Error('Hole layer '+response.status);
   const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:slot===1?'premultiply':'none'}),texture=gl.createTexture();
   gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  gl.useProgram(program);gl.uniform1i(U.HoleMask,0);gl.uniform1i(U.HoleFront,1);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);stage.classList.add('rp-use-3d');ready=true;return true;
 }
 let headTree=[],eyeBones=[],browBones=[],beat={bpm:83,first:.232,beats:null};
 // V1813 C: 곡 박자(rhythm.js 가 곡 시작 때 setBeat)로 끄덕임 세기 0~1
 function setBeat(song){beat={bpm:Number(song&&song.bpm)||83,first:Number.isFinite(song&&song.firstBeat)?song.firstBeat:.232,beats:song&&Array.isArray(song.beats)?song.beats:null};}
 function beatPulse(t){let at;if(beat.beats&&beat.beats.length){let lo=0,hi=beat.beats.length-1;if(t<beat.beats[0])return 0;while(lo<hi){const m=(lo+hi+1)>>1;if(beat.beats[m]<=t)lo=m;else hi=m-1;}at=beat.beats[lo];}else{const p=60/beat.bpm;if(t<beat.first)return 0;at=beat.first+Math.floor((t-beat.first)/p)*p;}const d=t-at;return d<.09?d/.09:Math.exp(-(d-.09)/.14);}
 let BACK=1.0,SIDE_LIFT=0;
 let MIDDLE_LEN=1.3,ARM_LIFT=-.52,FINGER_DOWN=.35,fingerAxes=new Map(),armRestPose=null;
 function restArms(rig){const nodes=rig.model.json.nodes,sk=rig.skins[0],rest=n=>{const j=sk.joints.indexOf(n);return j<0?null:R.inverse(sk.inverseBind.subarray(j*16,j*16+16));},body=nodes.findIndex(n=>n.name==='Body'),bi=R.inverse(rest(body)),out=new Map();nodes.forEach((n,k)=>{if(/^(UpperArm|Forearm|Hand|Finger[123]|Thumb)\.[LR]$/.test(n.name||'')){const m=rest(k);if(m)out.set(k,R.multiply(bi,m));}});return out;}
 // 손가락 굽힘 축 = 손가락 1~3이 나란한 손마디 줄(기본 자세) → 손가락 뼈 자기 좌표로 바꿔 둠. 손 위치는 그대로.
 function knuckleAxes(rig){const nodes=rig.model.json.nodes,sk=rig.skins[0],out=new Map(),rest=name=>{const node=nodes.findIndex(n=>n.name===name),j=sk.joints.indexOf(node);return j<0?null:{node,m:R.inverse(sk.inverseBind.subarray(j*16,j*16+16))};};
  for(const side of ['L','R']){const a=rest('Finger1.'+side),c=rest('Finger3.'+side);if(!a||!c)continue;let d=[c.m[12]-a.m[12],c.m[13]-a.m[13],c.m[14]-a.m[14]];const l=Math.hypot(...d);d=d.map(v=>v/l);
   for(const k of [1,2,3]){const f=rest('Finger'+k+'.'+side);if(!f)continue;const m=f.m,sx=Math.hypot(m[0],m[1],m[2]),sy=Math.hypot(m[4],m[5],m[6]),sz=Math.hypot(m[8],m[9],m[10]),loc=[(m[0]*d[0]+m[1]*d[1]+m[2]*d[2])/sx,(m[4]*d[0]+m[5]*d[1]+m[6]*d[2])/sy,(m[8]*d[0]+m[9]*d[1]+m[10]*d[2])/sz],ll=Math.hypot(...loc);out.set(f.node,loc.map(v=>v/ll));}}
  return out;}
 function render(time,layout,heads,moles,jumpDuration=.42){
  if(!ready||lost||document.hidden)return;
  lastHandError=0;
  const host=stage.querySelector('[data-rp-lanes]');if(canvas.parentNode!==host)host.prepend(canvas);canvas.hidden=false;stage.classList.add('rp-3d-ready');
  const w=Math.max(1,Math.round(layout.W)),h=Math.max(1,Math.round(layout.H)),dpr=Math.min(root.devicePixelRatio||1,1.25),pw=Math.round(w*dpr),ph=Math.round(h*dpr);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}gl.viewport(0,0,pw,ph);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  const vp=R.identity();vp[0]=2/w;vp[5]=2/h;vp[10]=-1/1000;vp[12]=-1;vp[13]=-1;gl.uniformMatrix4fv(U.VP,false,vp);
  const nodes=rig.model.json.nodes,headNode=nodes.findIndex(n=>n.name==='Head'),bodyNode=nodes.findIndex(n=>n.name==='Body'),rimWorlds=R.pose(rig,'RimIdle',Math.max(0,time),true),rimBodyInverse=R.inverse(rimWorlds[bodyNode]);
  for(let i=0;i<4;i++){
   const id=AP.styles[i],state=moles[i],dt=time-state.jumpAt,hurt=time-state.hurtAt,jumping=dt>=0&&dt<jumpDuration;
   const clip=hurt>=0&&hurt<.45?'PainHit':jumping?'Jump':'Idle',duration=rig.animations.find(a=>a.name===clip)?.duration||1,clipTime=clip==='Jump'?dt/jumpDuration*duration:clip==='PainHit'?hurt+.22:Math.max(0,time);
   // V1813 C 사용자: 대기 표정 — 웃는 눈(^^) 사이사이 뜬 눈+깜빡임, 점프는 놀란 눈(크게 뜬 눈+눈썹 올림)
   const cyc=((time+i*2.3)%9+9)%9,openEyes=clip==='PainHit'||jumping||(clip==='Idle'&&cyc>6);
   const worlds=AP.pose(rig,clip,clipTime,clip==='Idle',AP.face(rig,openEyes),Math.max(0,time),id),head=heads[i].h||heads[i],scale=head.r/.80,anchor=R.point(worlds[headNode],[0,.57,0]),rect=layout.holeRects[i],bodyDelta=R.multiply(worlds[bodyNode],rimBodyInverse);
   // V1813 C 사용자: 대기 중에도 머리카락이 바닷바람에 좌우로 흔들림(점프 흔들림에 더함, 두더지마다 박자 다르게)
   {const m=FX.hairMotion(time,state.jumpAt,jumpDuration,id),gust=.6+.4*Math.sin(time*.37+i*2.1),wind=(Math.sin(time*2.3+i*1.4)+.35*Math.sin(time*5.1+i))*gust;
    m.sway=(m.sway||0)+.16*wind;m.bend=(m.bend||0)+.06*wind;if(id==='curly'){m.wigLift=Math.max(m.wigLift||0,.001);m.wigRoll=(m.wigRoll||0)+.05*wind;}
    FX.hair(rig,worlds,id,m);}
   const stunt=clip==='PainHit'?{active:false}:FX.sample(state,time);
   const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},rest=stunt.active?0:jumping?1-smooth(Math.min(dt,jumpDuration-dt)/(jumpDuration/7)):1,armRest=rest,/* V1815 C 사용자: 무기에 맞아도(PainHit) 손은 구멍 턱에 그대로 — 모래 뒤로 숨으면 화면 깨진 것 같음 */offsets={};
   for(const side of ['L','R']){const hand=R.multiply(bodyDelta,rimWorlds[nodes.findIndex(n=>n.name==='Hand.'+side)]),x=head.x+scale*(hand[12]-anchor[0]),u=Math.max(0,Math.min(geometry.width-1,(x-rect.x)/rect.w*(geometry.width-1))),lo=Math.floor(u),hi=Math.min(geometry.width-1,lo+1),f=u-lo,edge=geometry.frontCurvePixels[lo]*(1-f)+geometry.frontCurvePixels[hi]*f,target=rect.y+edge/geometry.height*rect.h-scale*.04;offsets[side]=target-(head.y+scale*(anchor[1]-hand[13]));}
   const offset=(offsets.L+offsets.R)/2;
   nodes.forEach((n,k)=>{const match=/^(UpperArm|Forearm|Hand|Finger[123]|Thumb)\.([LR])$/.exec(n.name||'');if(!match||armRest<=0)return;const rim=R.multiply(bodyDelta,rimWorlds[k]);rim[13]-=(offsets[match[2]]-offset)/scale;worlds[k]=new Float32Array(worlds[k].map((v,c)=>v+(rim[c]-v)*armRest));});
   // V1812 C 사용자: 3번(도복) 두더지는 팔 뼈만 기본 자세(몸통 기준)로 → 손이 권투 글러브 안
   const dojoPick=Math.floor(state.jumpAt*997)%2,dojoJump=clip==='Jump'?1-rest:0,dojoLift=dojoPick===0?ARM_LIFT+(SIDE_LIFT-ARM_LIFT)*dojoJump:ARM_LIFT; // V1814 C 사용자: 도장 점프 ① 팔 옆으로 올리기(인벤토리 그림) ② 글러브 뒤로 빼기
   if(i===2&&armRestPose)for(const [k,m0] of armRestPose){const sd=nodes[k].name.slice(-1),sh=armRestPose.get(nodes.findIndex(n=>n.name==='UpperArm.'+sd)),p=[sh[12],sh[13],sh[14]],a=(sd==='L'?-1:1)*dojoLift,lift=R.multiply(R.multiply(R.transform({translation:p}),R.transform({rotation:[0,Math.sin(a/2),0,Math.cos(a/2)]})),R.transform({translation:p.map(v=>-v)})),m=R.multiply(lift,m0);worlds[k]=/^(Hand|Finger[123]|Thumb)\./.test(nodes[k].name)?R.multiply(R.multiply(worlds[bodyNode],m),R.transform({scale:[0,0,0]})):R.multiply(worlds[bodyNode],m);} // 사용자: 손 없어도 됨(글러브가 대신), 인벤토리 그림처럼 팔 옆으로 들어 글러브가 모래 위
   if(i===2&&armRestPose&&dojoPick===1&&dojoJump>0){const back=dojoJump*BACK;for(const sd of ['L','R']){const sh=armRestPose.get(nodes.findIndex(n=>n.name==='UpperArm.'+sd)),p=R.point(worlds[bodyNode],[sh[12],sh[13],sh[14]]),m=R.multiply(R.multiply(R.transform({translation:p}),R.transform({rotation:[Math.sin(back/2),0,0,Math.cos(back/2)]})),R.transform({translation:p.map(v=>-v)}));for(const k of armRestPose.keys())if(nodes[k].name.slice(-1)===sd)worlds[k]=R.multiply(m,worlds[k]);}}
   // V1812 C 사용자: 손가락이 조금 들려 보임 → 손가락 뼈만 아래로 살짝 굽힘(턱 잡은 자세일 때)
   if(armRest>0&&i!==2)for(const [k,ax] of fingerAxes){const s=Math.sin(FINGER_DOWN*armRest/2);worlds[k]=R.multiply(worlds[k],R.transform({rotation:[ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(FINGER_DOWN*armRest/2)]}));}
   // V1812 C 사용자: 가운데 손가락(Finger2)이 짧음 → 길이 방향(뼈 Y)으로 늘림
   if(i!==2)nodes.forEach((n,k)=>{if(/^Finger2\.[LR]$/.test(n.name||''))worlds[k]=R.multiply(worlds[k],R.transform({scale:[1,MIDDLE_LEN,1]}));});
   // V1813 C 사용자: 대기 중 생동감 — 박자 끄덕임 + 숨쉬기 + 두리번(머리와 그 아래 뼈만, 손은 턱 그대로)
   if(clip!=='PainHit'){
    const idleW=clip==='Idle'&&!stunt.active?1:0,bp=beatPulse(time),nod=idleW*(.07*bp*(i%2?.8:1)),look=idleW*(.16*Math.sin(time*.45+i*1.9)+.08*Math.sin(time*1.1+i));
    const hp=R.point(worlds[headNode],[0,0,0]),about=r=>R.multiply(R.multiply(R.transform({translation:hp}),R.transform({rotation:r})),R.transform({translation:hp.map(v=>-v)}));
    const turn=R.multiply(about([0,Math.sin(look/2),0,Math.cos(look/2)]),about([Math.sin(nod/2),0,0,Math.cos(nod/2)]));
    if(nod||look)for(const k of headTree)worlds[k]=R.multiply(turn,worlds[k]);
    if(idleW){const br=1+.018*Math.sin(time*2.2+i*1.3);worlds[bodyNode]=R.multiply(worlds[bodyNode],R.transform({scale:[br,1+(br-1)*.5,br]}));}
   }
   if(openEyes&&clip!=='PainHit'){
    const surprise=jumping?1:0,blinkT=((time+i*1.7)%3+3)%3,blink=!jumping&&blinkT<.12?.12:1;
    if(!surprise)for(const [k,n] of eyeBones)worlds[k]=R.multiply(worlds[k],R.transform({scale:[1,blink,1]}));
    if(surprise)for(const k of browBones)worlds[k]=R.multiply(R.transform({translation:[0,.07,0]}),worlds[k]);
   }
   const baseInstance=R.transform({translation:[head.x-scale*anchor[0],h-head.y-scale*anchor[1]-offset*rest,-scale*anchor[2]],scale:[scale,scale,scale]}),instance=FX.turn(baseInstance,R.point(worlds[bodyNode],[0,.2,0]),stunt);
   if(armRest>.999)for(const side of ['L','R']){const hand=worlds[nodes.findIndex(n=>n.name==='Hand.'+side)],point=R.point(instance,Array.from(hand.slice(12,15))),u=Math.max(0,Math.min(geometry.width-1,(point[0]-rect.x)/rect.w*(geometry.width-1))),lo=Math.floor(u),hi=Math.min(geometry.width-1,lo+1),f=u-lo,target=rect.y+(geometry.frontCurvePixels[lo]*(1-f)+geometry.frontCurvePixels[hi]*f)/geometry.height*rect.h-scale*.04;lastHandError=Math.max(lastHandError,Math.abs((h-point[1])-target));}
   gl.enable(gl.SCISSOR_TEST);{const pad=Math.round(pw*.03);/* 사용자: 옆 칸으로 살짝 넘어간 손이 칼로 자른 듯 잘리지 않게 네 마리 모두 */gl.scissor(Math.round(i*pw/4)-pad,0,Math.ceil(pw/4)+pad*2,ph);}gl.uniform4fv(U.HoleRect,[rect.x*pw/layout.W,(layout.H-rect.y)*ph/layout.H,rect.w*pw/layout.W,rect.h*ph/layout.H]);gl.uniform1f(U.HandsOnRim,armRest);gl.uniform1f(U.Flash,clip==='PainHit'?Math.max(0,1-hurt/.15)*.25:0);
   for(const part of parts){if(part.style&&part.style!==id)continue;if(part.surprise!==undefined&&part.surprise!==jumping)continue;if(jumping&&/^(Eye espresso|Clay squeezed eyes)$/.test(part.material.name||''))continue;gl.bindVertexArray(part.vao);const b=part.variants[id]||part.colorBuffer;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(A.Color,part.colorSize,gl.FLOAT,false,0,0);
    gl.uniform4fv(U.Color,AP.materialColor(part.material,id));gl.uniformMatrix4fv(U.Model,false,part.local?R.multiply(instance,R.multiply(worlds[part.node],part.local)):R.multiply(instance,worlds[part.node]));
    gl.uniform1i(U.Skin,!part.rigid);if(!part.rigid)gl.uniformMatrix4fv(U.Bones,false,R.palette(rig,worlds,part.node));gl.drawElements(gl.TRIANGLES,part.count,gl.UNSIGNED_INT,0);
   }
  }
  gl.disable(gl.SCISSOR_TEST);
 }
 function stop(){if(canvas)canvas.hidden=true;stage.classList.remove('rp-3d-ready')}
 return {prepare,render,stop,setBeat,holeGeometry:()=>geometry,dbg:()=>({ready,lost,styles:AP.styles.slice(),contexts:canvas?1:0,maxRestingHandError:lastHandError})};
}
MG.RhythmBeachMoles={create};
})(window);

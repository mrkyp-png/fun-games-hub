// V 1044 G: localized circuit lights, rendered without animated SVG/CSS filters.
(function(root){
 'use strict';
 const MG=root.MoleGame;
 function create(opts){
  const surfaces=Array.from({length:9},(_,cell)=>{const canvas=document.createElement('canvas');canvas.className='rb-flow-canvas';canvas.dataset.cell=cell;canvas.setAttribute('aria-hidden','true');canvas.style.left=((26+(cell%3)*300)/952*100)+'%';canvas.style.top=((1136+Math.floor(cell/3)*300)/2078*100)+'%';opts.board.appendChild(canvas);return {canvas,ctx:canvas.getContext('2d')};});
  let ctx;const colors=opts.colors,lightColors=colors.slice();
  const routes=MG.rhythmBCircuitRoutes.map(d=>{
   const vertices=Array.from(d.matchAll(/(\d+),(\d+)/g),m=>({x:16+(Number(m[1])-64)*268/1164,y:16+(Number(m[2])-63)*268/1116}));
   const distances=[0];for(let i=1;i<vertices.length;i++)distances.push(distances[i-1]+Math.hypot(vertices[i].x-vertices[i-1].x,vertices[i].y-vertices[i-1].y));
   return {vertices,distances,length:distances[distances.length-1]};
  });
  const slots=Array.from({length:27},(_,i)=>({cell:Math.floor(i/3),next:0,route:null,kind:null}));
  const pressed=Array(9).fill(false);
  let running=false,paused=false,frame=0,origin=0,pauseAt=0,dpr=1,ratio=1,sizeDirty=true;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new ResizeObserver(()=>{sizeDirty=true;});observer.observe(opts.board);
  root.addEventListener('resize',()=>{sizeDirty=true;});
  function resize(){if(!sizeDirty)return;sizeDirty=false;dpr=Math.min(root.devicePixelRatio||1,2);const n=Math.max(1,Math.round(surfaces[0].canvas.getBoundingClientRect().width*dpr));for(const {canvas} of surfaces){if(canvas.width!==n||canvas.height!==n){canvas.width=n;canvas.height=n;}}ratio=n/300;}
  function schedule(s,t){const long=Math.random()<.5;s.kind=long?'long':'short';s.route=routes[(long?40:0)+Math.floor(Math.random()*40)];s.reverse=Math.random()<.5;s.tail=(90+Math.random()*90)*268/1164;s.start=t;s.duration=long?1800+Math.random()*900:650+Math.random()*550;s.next=t+s.duration+80+Math.random()*550;}
  function segment(route,lo,hi){
   if(hi<=lo)return false;let begun=false;ctx.beginPath();
   for(let i=1;i<route.vertices.length;i++){
    const a=route.distances[i-1],b=route.distances[i];if(b<lo)continue;if(a>hi)break;
    const p=route.vertices[i-1],q=route.vertices[i],length=b-a;if(!length)continue;
    const u=Math.max(0,(lo-a)/length),v=Math.min(1,(hi-a)/length);
    if(!begun){ctx.moveTo(p.x+(q.x-p.x)*u,p.y+(q.y-p.y)*u);begun=true;}
    ctx.lineTo(p.x+(q.x-p.x)*v,p.y+(q.y-p.y)*v);
   }return begun;
  }
  function draw(t){
   resize();for(const s of surfaces){s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);s.ctx.setTransform(ratio,0,0,ratio,0,0);}
   if(reduced.matches)return;
   for(const s of slots){
    if(!pressed[s.cell])continue;
    if(t>=s.next)schedule(s,t);if(!s.route)continue;
    const p=(t-s.start)/s.duration;if(p<0||p>1)continue;
    const length=s.route.length,head=s.reverse?length+s.tail-(length+2*s.tail)*p:-s.tail+(length+2*s.tail)*p;
    const lo=Math.max(0,s.reverse?head:head-s.tail),hi=Math.min(length,s.reverse?head+s.tail:head);
    if(hi<=lo)continue;
    const alpha=p<.15?p/.15:p>.8?(1-p)/.2:1;
    ctx=surfaces[s.cell].ctx;ctx.save();
    // Hard clip in logical cell coordinates: a light cannot paint any other button.
    ctx.beginPath();ctx.rect(16,16,268,268);ctx.clip();
    if(segment(s.route,lo,hi)){
     ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=lightColors[s.cell];ctx.shadowColor=lightColors[s.cell];ctx.shadowBlur=3*dpr;ctx.lineWidth=5;ctx.globalAlpha=alpha*.45;ctx.stroke();
     ctx.shadowBlur=0;ctx.lineWidth=14*268/1164;ctx.globalAlpha=alpha;ctx.stroke();
    }ctx.restore();
   }
  }
  function loop(){frame=0;if(!running||paused||!pressed.some(Boolean))return;draw(performance.now()-origin);frame=requestAnimationFrame(loop);}
  return {
   press(cell,on){pressed[cell]=on;if(on){const t=performance.now()-origin;slots.filter(s=>s.cell===cell).forEach(s=>{schedule(s,t-120);});}if(!on){const s=surfaces[cell];s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);}else if(running&&!paused&&!frame){loop();}},
   start(){cancelAnimationFrame(frame);pressed.fill(false);frame=0;running=true;paused=false;sizeDirty=true;origin=performance.now();slots.forEach(s=>{s.route=null;s.next=Math.random()*500;});loop();},
   pause(on){if(!running||on===paused)return;paused=on;if(on){pressed.fill(false);pauseAt=performance.now();cancelAnimationFrame(frame);frame=0;for(const s of surfaces){s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);}}else{origin+=performance.now()-pauseAt;loop();}},
   stop(){pressed.fill(false);running=false;paused=false;cancelAnimationFrame(frame);frame=0;for(const s of surfaces){s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);}},
   dbg(){return {running,paused,pressed:pressed.slice(),slots:slots.map(s=>({cell:s.cell,kind:s.kind})),renderer:'canvas',canvasCount:surfaces.length,clip:[16,16,268,268]};}
  };
 }
 MG.RhythmBRipple={create(opts){
  const canvas=document.createElement('canvas');canvas.className='rb-screen-ripple';canvas.setAttribute('aria-hidden','true');opts.root.appendChild(canvas);const ctx=canvas.getContext('2d');
  const framePath=new Path2D('M476 24H884Q928 24 928 68V2010Q928 2054 884 2054H68Q24 2054 24 2010V68Q24 24 68 24H476Z');
  const waves=[];let frame=0,dirty=true,w=0,h=0,dpr=1,top=0,centers=[],shadows=[],paused=false,pauseAt=0;
  const observer=new ResizeObserver(()=>{dirty=true;});observer.observe(opts.root);observer.observe(opts.board);
  function resize(){if(!dirty)return;dirty=false;const rootBox=opts.root.getBoundingClientRect(),boardBox=opts.board.getBoundingClientRect();w=rootBox.width;h=rootBox.height;dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));top=boardBox.top-rootBox.top+boardBox.height*1136/2078;centers=Array.from(opts.board.querySelectorAll('.rb-button-core'),e=>{const b=e.getBoundingClientRect();return {x:b.left-rootBox.left+b.width*133.5/268,y:b.top-rootBox.top+b.height/2,r:b.width*48/268};});shadows=centers.map((source,lane)=>{const reach=Math.hypot(w,h)*2,angles=Array.from({length:720},(_,i)=>i*Math.PI*2/720);for(let i=0;i<centers.length;i++){if(i===lane)continue;const c=centers[i],dx=c.x-source.x,dy=c.y-source.y,dist=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),spread=Math.asin(Math.min(1,c.r/dist));for(const tangent of [angle-spread,angle+spread])for(const eps of [-.00001,0,.00001])angles.push(((tangent+eps)%(Math.PI*2)+Math.PI*2)%(Math.PI*2));}angles.sort((a,b)=>a-b);const path=new Path2D();angles.forEach((angle,index)=>{const vx=Math.cos(angle),vy=Math.sin(angle);let length=reach;for(let i=0;i<centers.length;i++){if(i===lane)continue;const c=centers[i],dx=c.x-source.x,dy=c.y-source.y,projection=dx*vx+dy*vy,disc=projection*projection-(dx*dx+dy*dy-c.r*c.r);if(disc<0)continue;const hit=projection-Math.sqrt(disc);if(hit>0&&hit<length)length=hit;}const x=source.x+vx*length,y=source.y+vy*length;if(index)path.lineTo(x,y);else path.moveTo(x,y);});path.closePath();return path;});}
  function clear(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  function draw(now){frame=0;resize();clear();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();ctx.translate(12,12);ctx.scale((w-24)/952,(h-24)/2078);ctx.clip(framePath);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.beginPath();ctx.rect(0,top,w,h-top);ctx.clip();
   for(let i=waves.length-1;i>=0;i--){const a=waves[i],p=(now-a.start)/480;if(p>=1){waves.splice(i,1);continue;}const radius=8+(a.end-8)*(1-Math.pow(1-Math.max(0,p),2)),alpha=Math.sin(Math.PI*Math.max(0,p))*.32,gradient=ctx.createRadialGradient(a.x,a.y,0,a.x,a.y,radius*1.05);gradient.addColorStop(0,a.color+Math.round(alpha*255).toString(16).padStart(2,'0'));gradient.addColorStop(.25,a.color+Math.round(alpha*.8*255).toString(16).padStart(2,'0'));gradient.addColorStop(.7,a.color+Math.round(alpha*.3*255).toString(16).padStart(2,'0'));gradient.addColorStop(1,a.color+'00');ctx.save();ctx.clip(a.shadow);ctx.fillStyle=gradient;ctx.fillRect(a.x-radius*1.05,a.y-radius*1.05,radius*2.1,radius*2.1);ctx.restore();}
   ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#000';for(const c of centers){ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fill();}ctx.restore();if(waves.length&&!paused)frame=requestAnimationFrame(draw);else if(!waves.length)clear();
  }
  return {prepare(){resize();},emit(lane){if(paused)return;resize();const c=centers[lane];if(!c)return;waves.push({x:c.x,y:c.y,color:opts.colors[lane],shadow:shadows[lane],start:performance.now(),end:Math.max(...[[0,top],[w,top],[0,h],[w,h]].map(([x,y])=>Math.hypot(x-c.x,y-c.y)))});if(!frame)frame=requestAnimationFrame(draw);},pause(on){if(on===paused)return;paused=on;if(on){pauseAt=performance.now();cancelAnimationFrame(frame);frame=0;}else{const dt=performance.now()-pauseAt;waves.forEach(a=>a.start+=dt);if(waves.length)frame=requestAnimationFrame(draw);}},stop(){cancelAnimationFrame(frame);frame=0;paused=false;waves.length=0;clear();},dbg(){return {active:waves.length,frame:!!frame,top,width:w,height:h,frameBounds:{left:12+24*(w-24)/952,right:w-12-24*(w-24)/952,bottom:h-12-24*(h-24)/2078},centers:centers.map(c=>({...c})),paused};}};
 }};
 // V 1133 G: long bent beams, one event-driven canvas behind the status panel.
 MG.RhythmBLaser={create(opts){
  const canvas=document.createElement('canvas');canvas.className='rb-laser-canvas';canvas.setAttribute('aria-hidden','true');opts.board.appendChild(canvas);
  const ctx=canvas.getContext('2d'),groups=Array.from(opts.board.querySelectorAll('.rb-glass-grow'));
  const shots=[],flashes=Array(9).fill(0);let frame=0,paused=false,pauseAt=0,dirty=true,ratio=1,unit=1,history=[];
  new ResizeObserver(()=>{dirty=true;}).observe(opts.board);
  function resize(){if(!dirty)return;dirty=false;const b=opts.board.getBoundingClientRect(),dpr=Math.min(root.devicePixelRatio||1,2);unit=b.width/952;ratio=unit*dpr;canvas.width=Math.max(1,Math.round(b.width*dpr));canvas.height=Math.max(1,Math.round(b.height*dpr));}
  function clear(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}
  function route(lane,side,outer){
   const cx=175.5+(lane%3)*300,cy=176+Math.floor(lane/3)*300,r=outer?148*296/304:45;
   const start={x:cx+side*150,y:1282+Math.floor(lane/3)*300},end={x:cx+side*r/Math.SQRT2,y:cy+r/Math.SQRT2};
   const bend={x:start.x,y:end.y+Math.abs(start.x-end.x)},vertical=start.y-bend.y,diagonal=Math.hypot(end.x-bend.x,end.y-bend.y);
   const trim=Math.min(24,vertical/3,diagonal/3),entry={x:bend.x,y:bend.y+trim},exit={x:bend.x+(end.x-bend.x)*trim/diagonal,y:bend.y+(end.y-bend.y)*trim/diagonal};
   const travel=[start,entry];
   // V 1135 G: cache a short quadratic bend; no blur or per-frame curve creation.
   for(let i=1;i<=12;i++){const t=i/12,u=1-t;travel.push({x:u*u*entry.x+2*u*t*bend.x+t*t*exit.x,y:u*u*entry.y+2*u*t*bend.y+t*t*exit.y});}
   travel.push(end);const distances=[0];for(let i=1;i<travel.length;i++)distances.push(distances[i-1]+Math.hypot(travel[i].x-travel[i-1].x,travel[i].y-travel[i-1].y));
   return {points:[start,bend,end],travel,distances,trim,length:distances[distances.length-1]};
  }
  function crossing(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
  function overlap(candidate){let score=0;for(const shot of shots){const other=shot.route,pa=candidate.points,pb=other.points;
   if(Math.abs(pa[0].x-pb[0].x)<10)score+=Math.max(0,Math.min(pa[0].y,pb[0].y)-Math.max(pa[1].y,pb[1].y));
   for(let i=0;i<2;i++)for(let j=0;j<2;j++)if(crossing(pa[i],pa[i+1],pb[j],pb[j+1]))score+=30;
  }return score;}
  function point(path,distance){const d=Math.max(0,Math.min(path.length,distance));let i=1;while(i<path.distances.length-1&&path.distances[i]<d)i++;const a=path.travel[i-1],b=path.travel[i],f=(d-path.distances[i-1])/(path.distances[i]-path.distances[i-1]);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
  function draw(now){now=performance.now();frame=0;if(paused)return;resize();clear();ctx.setTransform(ratio,0,0,ratio,0,0);ctx.lineCap='round';ctx.lineJoin='round';
   for(let i=shots.length-1;i>=0;i--){const shot=shots[i];if(!shot.outer&&opts.hasCharacter(shot.lane)){shot.outer=true;shot.route=route(shot.lane,shot.side,true);}
    const path=shot.route,p=Math.max(0,(now-shot.start)/240),head=path.length*2*p,tail=Math.max(0,head-path.length);
    if(head>=path.length&&!shot.arrived){shot.arrived=true;if(!shot.outer&&!opts.hasCharacter(shot.lane)){flashes[shot.lane]=now+220;groups[shot.lane]?.classList.add('is-laser-miss');}history.push({lane:shot.lane,side:shot.side,outer:shot.outer,arrived:true,absorbed:false});if(history.length>16)history.shift();shot.record=history[history.length-1];}
    if(tail>=path.length){if(shot.record)shot.record.absorbed=true;shots.splice(i,1);continue;}
    const front=point(path,head),back=point(path,tail);ctx.strokeStyle=opts.colors[shot.lane];ctx.lineWidth=3/unit;ctx.beginPath();ctx.moveTo(back.x,back.y);for(let j=1;j<path.travel.length-1;j++)if(path.distances[j]>tail&&path.distances[j]<head)ctx.lineTo(path.travel[j].x,path.travel[j].y);ctx.lineTo(front.x,front.y);ctx.stroke();
   }
   for(let i=0;i<9;i++)if(flashes[i]&&(now>=flashes[i]||opts.hasCharacter(i))){flashes[i]=0;groups[i]?.classList.remove('is-laser-miss');}
   if(shots.length||flashes.some(Boolean))frame=requestAnimationFrame(draw);else clear();
  }
  return {
   emit(lane,outer){if(paused)return;resize();const left=route(lane,-1,outer),right=route(lane,1,outer),leftScore=overlap(left),rightScore=overlap(right),side=Math.abs(leftScore-rightScore)<.001?(Math.random()<.5?-1:1):(leftScore<rightScore?-1:1);shots.push({lane,outer,side,route:side<0?left:right,start:performance.now(),arrived:false});if(!frame)frame=requestAnimationFrame(draw);},
   pause(on){if(on===paused)return;paused=on;if(on){pauseAt=performance.now();cancelAnimationFrame(frame);frame=0;}else{const dt=performance.now()-pauseAt;shots.forEach(s=>s.start+=dt);flashes.forEach((t,i)=>{if(t)flashes[i]+=dt;});if(shots.length||flashes.some(Boolean))frame=requestAnimationFrame(draw);}},
   stop(){cancelAnimationFrame(frame);frame=0;shots.length=0;flashes.fill(0);groups.forEach(g=>g.classList.remove('is-laser-miss'));paused=false;history=[];clear();},
   dbg(){return {active:shots.length,frame:!!frame,paused,widthPx:3,durationMs:240,flashing:flashes.map(Boolean),shots:shots.map(s=>({lane:s.lane,side:s.side,outer:s.outer,arrived:s.arrived,length:s.route.length,points:s.route.points.map(p=>({...p})),bendTrim:s.route.trim,travel:s.route.travel.map(p=>({...p}))})),history:history.map(s=>({...s}))};}
  };
 }};
 MG.RhythmBFlow={create};
})(window);

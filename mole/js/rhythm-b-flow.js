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
 MG.RhythmBFlow={create};
})(window);

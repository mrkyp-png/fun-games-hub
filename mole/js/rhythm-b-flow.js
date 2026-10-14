// V 1044 G: localized circuit lights, rendered without animated SVG/CSS filters.
(function(root){
 'use strict';
 const MG=root.MoleGame;
 function create(opts){
  const surfaces=Array.from({length:9},(_,cell)=>{const canvas=document.createElement('canvas');canvas.className='rb-flow-canvas';canvas.dataset.cell=cell;canvas.setAttribute('aria-hidden','true');canvas.style.left=((26+(cell%3)*300)/952*100)+'%';canvas.style.top=((1056+Math.floor(cell/3)*300)/2078*100)+'%';opts.board.appendChild(canvas);return {canvas,ctx:canvas.getContext('2d')};});
  let ctx;const colors=opts.colors,lightColors=colors.slice();
  const routes=MG.rhythmBCircuitRoutes.map(d=>{
   const vertices=Array.from(d.matchAll(/(\d+),(\d+)/g),m=>({x:28+(Number(m[1])-64)*244/1164,y:28+(Number(m[2])-63)*244/1116}));
   const distances=[0];for(let i=1;i<vertices.length;i++)distances.push(distances[i-1]+Math.hypot(vertices[i].x-vertices[i-1].x,vertices[i].y-vertices[i-1].y));
   return {vertices,distances,length:distances[distances.length-1]};
  });
  const slots=Array.from({length:27},(_,i)=>({cell:Math.floor(i/3),next:0,route:null,kind:null}));
  let running=false,paused=false,frame=0,origin=0,pauseAt=0,dpr=1,ratio=1,sizeDirty=true;
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new ResizeObserver(()=>{sizeDirty=true;});observer.observe(opts.board);
  root.addEventListener('resize',()=>{sizeDirty=true;});
  function resize(){if(!sizeDirty)return;sizeDirty=false;dpr=Math.min(root.devicePixelRatio||1,2);const n=Math.max(1,Math.round(surfaces[0].canvas.getBoundingClientRect().width*dpr));for(const {canvas} of surfaces){if(canvas.width!==n||canvas.height!==n){canvas.width=n;canvas.height=n;}}ratio=n/300;}
  function schedule(s,t){const long=Math.random()<.5;s.kind=long?'long':'short';s.route=routes[(long?40:0)+Math.floor(Math.random()*40)];s.reverse=Math.random()<.5;s.tail=(90+Math.random()*90)*244/1164;s.start=t;s.duration=long?1800+Math.random()*900:650+Math.random()*550;s.next=t+s.duration+80+Math.random()*550;}
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
    if(t>=s.next)schedule(s,t);if(!s.route)continue;
    const p=(t-s.start)/s.duration;if(p<0||p>1)continue;
    const length=s.route.length,head=s.reverse?length+s.tail-(length+2*s.tail)*p:-s.tail+(length+2*s.tail)*p;
    const lo=Math.max(0,s.reverse?head:head-s.tail),hi=Math.min(length,s.reverse?head+s.tail:head);
    if(hi<=lo)continue;
    const alpha=p<.15?p/.15:p>.8?(1-p)/.2:1;
    ctx=surfaces[s.cell].ctx;ctx.save();
    // Hard clip in logical cell coordinates: a light cannot paint any other button.
    ctx.beginPath();ctx.rect(28,28,244,244);ctx.clip();
    if(segment(s.route,lo,hi)){
     ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=lightColors[s.cell];ctx.shadowColor=lightColors[s.cell];ctx.shadowBlur=3*dpr;ctx.lineWidth=5;ctx.globalAlpha=alpha*.45;ctx.stroke();
     ctx.shadowBlur=0;ctx.lineWidth=14*244/1164;ctx.globalAlpha=alpha;ctx.stroke();
    }ctx.restore();
   }
  }
  function loop(){if(!running||paused)return;draw(performance.now()-origin);frame=requestAnimationFrame(loop);}
  return {
   start(){cancelAnimationFrame(frame);running=true;paused=false;sizeDirty=true;origin=performance.now();slots.forEach(s=>{s.route=null;s.next=Math.random()*500;});loop();},
   pause(on){if(!running||on===paused)return;paused=on;if(on){pauseAt=performance.now();cancelAnimationFrame(frame);}else{origin+=performance.now()-pauseAt;loop();}},
   stop(){running=false;paused=false;cancelAnimationFrame(frame);for(const s of surfaces){s.ctx.setTransform(1,0,0,1,0,0);s.ctx.clearRect(0,0,s.canvas.width,s.canvas.height);}},
   dbg(){return {running,paused,slots:slots.map(s=>({cell:s.cell,kind:s.kind})),renderer:'canvas',canvasCount:surfaces.length,clip:[28,28,244,244]};}
  };
 }
 MG.RhythmBFlow={create};
})(window);

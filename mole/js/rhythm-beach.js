(function(root){
 'use strict';
 function create(screen){
  const hippo=screen.querySelector('.rp-hippo'),sea=screen.querySelector('.rp-a-sea'),layers=sea.querySelectorAll('i');
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  let running=false,paused=false,frame=-1,hurtUntil=-Infinity,lastOpacity=-1;
  function layout(){
   const w=screen.clientWidth,h=screen.clientHeight,scale=Math.max(w/1024,h/1536),offset=(h-1536*scale)/2;
   sea.style.top=(offset+512*scale)+'px';sea.style.height=(350*scale)+'px';
  }
  function stop(){running=false;paused=false;frame=-1;hurtUntil=-Infinity;lastOpacity=-1;screen.classList.remove('rp-beach-running','rp-beach-paused');hippo.classList.remove('is-cloud-hurt','is-no','is-cheer');sea.hidden=true;}
  function start(bpm){stop();running=true;screen.style.setProperty('--rp-cloud-beat',Math.max(.65,Math.min(1.8,120/(bpm||83)))+'s');screen.classList.add('rp-beach-running');sea.hidden=false;layout();update(0);}
  function pause(on){paused=on;screen.classList.toggle('rp-beach-paused',on);}
  function hurt(time){if(!running)return;hurtUntil=time+.65;hippo.classList.add('is-cloud-hurt');}
  function update(time){
   if(!running||paused)return;
   if(time>=hurtUntil&&hippo.classList.contains('is-cloud-hurt'))hippo.classList.remove('is-cloud-hurt');
   // Two reusable image planes interpolate the8-frame atlas using the existing audio clock.
   const phase=reduced.matches?0:Math.max(0,time)/3,index=Math.floor(phase)%8,mix=phase-Math.floor(phase);
   if(index!==frame){frame=index;for(let i=0;i<2;i++){const tile=(index+i)%8;layers[i].style.backgroundPosition=((tile%4)*100/3)+'% '+(tile<4?0:100)+'%';}}
   const alpha=reduced.matches?0:Math.round(mix*1000)/1000;if(alpha!==lastOpacity){lastOpacity=alpha;layers[1].style.opacity=String(alpha);}
  }
  stop();return {start,stop,pause,hurt,update,layout,dbg(){return {running,paused,frame,hurtUntil,seaHidden:sea.hidden};}};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmBeach={create};
})(window);

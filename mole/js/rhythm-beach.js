(function(root){
 'use strict';
 function create(screen){
  const hippo=screen.querySelector('.rp-hippo'),boss=screen.querySelector('.rp-a-cloud-boss'),sea=screen.querySelector('.rp-a-sea'),layers=sea.querySelectorAll('i');
  const cloudClumps=Array.from(screen.querySelectorAll('.rp-cloud-clump')),cloudMotions=new Map();
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  let running=false,paused=false,frame=-1,nextFrame=-1,transitionStart=0,transitionDuration=0,hurtUntil=-Infinity,lastOpacity=-1,comboTimer=0;
  function layout(){
   const w=screen.clientWidth,h=screen.clientHeight,scale=Math.max(w/1024,h/1536),offset=(h-1536*scale)/2;
   sea.style.top=(offset+512*scale)+'px';sea.style.height=(350*scale)+'px';
  }
  function stopCloudMotion(){cloudMotions.forEach(item=>item.cancel());cloudMotions.clear();cloudClumps.forEach(clump=>{clump.style.transform='';});}
  function animateCloud(clump,startY){
   if(!running||paused||reduced.matches)return;
   const randomY=()=>Math.round((Math.random()*16-8)*10)/10;
   const frames=[{transform:`translateY(${startY}%)`,offset:0},{transform:`translateY(${randomY()}%)`,offset:.25},{transform:`translateY(${randomY()}%)`,offset:.5},{transform:`translateY(${randomY()}%)`,offset:.75},{transform:`translateY(${startY}%)`,offset:1}];
   const animation=clump.animate(frames,{duration:12000,easing:'ease-in-out',fill:'forwards'});cloudMotions.set(clump,animation);
   animation.onfinish=()=>{if(!running)return;animation.cancel();clump.style.transform=`translateY(${startY}%)`;animateCloud(clump,startY);};
  }
  function startCloudMotion(){
   stopCloudMotion();if(reduced.matches)return;
   cloudClumps.forEach(clump=>{const startY=Math.round((Math.random()*16-8)*10)/10;clump.style.transform=`translateY(${startY}%)`;animateCloud(clump,startY);});
  }
  function randomFrame(except){const pick=Math.floor(Math.random()*7);return pick>=except?pick+1:pick;}
  function setSeaFrames(){for(let i=0;i<2;i++){const tile=i===0?frame:nextFrame;layers[i].style.backgroundPosition=((tile%4)*100/3)+'% '+(tile<4?0:100)+'%';}}
  function stop(){running=false;paused=false;stopCloudMotion();clearTimeout(comboTimer);comboTimer=0;frame=-1;nextFrame=-1;transitionStart=0;transitionDuration=0;hurtUntil=-Infinity;lastOpacity=-1;screen.classList.remove('rp-beach-running','rp-beach-paused');hippo.classList.remove('is-cloud-hurt','is-no','is-cheer');boss.classList.remove('is-combo-pop');sea.hidden=true;}
  function start(bpm){stop();running=true;screen.style.setProperty('--rp-cloud-beat',Math.max(.65,Math.min(1.8,120/(bpm||83)))+'s');screen.classList.add('rp-beach-running');sea.hidden=false;layout();startCloudMotion();update(0);}
  function pause(on){paused=on;screen.classList.toggle('rp-beach-paused',on);cloudMotions.forEach(animation=>on?animation.pause():animation.play());}
  function hurt(time){if(!running)return;hurtUntil=time+.65;hippo.classList.add('is-cloud-hurt');}
  function combo(){if(!running||reduced.matches)return;clearTimeout(comboTimer);boss.classList.remove('is-combo-pop');void boss.offsetWidth;boss.classList.add('is-combo-pop');comboTimer=setTimeout(()=>boss.classList.remove('is-combo-pop'),650);}
  function update(time){
   if(!running||paused)return;
   if(time>=hurtUntil&&hippo.classList.contains('is-cloud-hurt'))hippo.classList.remove('is-cloud-hurt');
   // Crossfade randomized atlas frames on the audio clock to avoid a visible fixed loop.
   if(frame<0){frame=reduced.matches?0:Math.floor(Math.random()*8);nextFrame=reduced.matches?frame:randomFrame(frame);transitionStart=Math.max(0,time);transitionDuration=1.7+Math.random()*1.1;setSeaFrames();}
   if(!reduced.matches){while(time>=transitionStart+transitionDuration){frame=nextFrame;nextFrame=randomFrame(frame);transitionStart+=transitionDuration;transitionDuration=1.7+Math.random()*1.1;setSeaFrames();}}
   const mix=reduced.matches?0:Math.max(0,Math.min(1,(time-transitionStart)/transitionDuration));
   const alpha=Math.round(mix*1000)/1000;if(alpha!==lastOpacity){lastOpacity=alpha;layers[1].style.opacity=String(alpha);}
  }
  stop();return {start,stop,pause,hurt,combo,update,layout,dbg(){return {running,paused,frame,hurtUntil,seaHidden:sea.hidden};}};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmBeach={create};
})(window);

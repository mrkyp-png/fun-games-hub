(function(root){
 'use strict';
 function create(screen){
  const sea=screen.querySelector('.rp-a-sea'),sky=screen.querySelector('.rp-a-sky'),ocean=root.MoleGame.RhythmBeachOcean.create(sea);
  const gulls=Array.from(screen.querySelectorAll('.rp-gull')),gullMotions=new Map();
  const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
  let running=false,paused=false,lastTime=0,weaponHorizon=null;
  function layout(horizonY){
   if(Number.isFinite(horizonY))weaponHorizon=horizonY;
   const w=screen.clientWidth,h=screen.clientHeight,scale=Math.max(w/1024,h/1536),offset=(h-1536*scale)/2;
   const shore=offset+942*scale,horizon=Math.max(0,Math.min(shore-1,weaponHorizon??h*.37)),waterHeight=Math.max(1,shore-horizon);
   sky.style.height=Math.max(0,horizon+1)+'px';sea.style.top=horizon+'px';sea.style.height=waterHeight+'px';ocean.resize(w,waterHeight);
   if(running)ocean.render(reduced.matches?0:lastTime,true);
  }
  function stopGulls(){gullMotions.forEach(animation=>animation.cancel());gullMotions.clear();gulls.forEach(gull=>{gull.style.opacity='0';gull.style.transform='';});}
  function flyGull(gull,index,first){
   if(!running||paused)return;
   const w=screen.clientWidth||400,ltr=Math.random()<.5,x0=ltr?-50:w+50,x1=ltr?w+50:-50,dy=(Math.random()-.5)*60,duration=9000+Math.random()*9000;
   gull.style.top=(18+Math.random()*16).toFixed(1)+'%';gull.style.width=(16+Math.random()*14).toFixed(0)+'px';
   gull.firstElementChild.style.animationDuration=(.32+Math.random()*.2).toFixed(2)+'s';
   if(reduced.matches){gull.style.opacity='1';gull.style.transform=`translateX(${w*[.18,.5,.78][index%3]}px)`;return;}
   const animation=gull.animate([{transform:`translate(${x0}px,0)`,opacity:1},{transform:`translate(${x1}px,${dy}px)`,opacity:1}],{duration,delay:first?0:Math.random()*2000,easing:'linear',fill:'both'});
   gullMotions.set(gull,animation);
   // 비치 진입 즉시 세 마리를 서로 다른 화면 안 위치에서 시작한다.
   if(first)animation.currentTime=duration*[.18,.5,.78][index%3];
   animation.onfinish=()=>{if(!running)return;animation.cancel();flyGull(gull,index,false);};
  }
  function startGulls(){stopGulls();gulls.forEach((gull,index)=>flyGull(gull,index,true));}
  function stop(){running=false;paused=false;stopGulls();ocean.stop();lastTime=0;screen.classList.remove('rp-beach-running','rp-beach-paused');sea.hidden=true;}
  function start(){stop();running=true;screen.classList.add('rp-beach-running');sea.hidden=false;layout();startGulls();update(0);}
  function pause(on){paused=on;screen.classList.toggle('rp-beach-paused',on);gullMotions.forEach(animation=>on?animation.pause():animation.play());}
  // Preserve caller hooks until the replacement character is specified.
  function hurt(){}
  function combo(){}
  function update(time){
   if(!running||paused)return;
   lastTime=Math.max(0,time);ocean.render(reduced.matches?0:lastTime);
  }
  stop();layout();return {start,stop,pause,hurt,combo,update,layout,dbg(){return {running,paused,seaHidden:sea.hidden,ocean:ocean.dbg()};}};
 }
 root.MoleGame=root.MoleGame||{};root.MoleGame.RhythmBeach={create};
})(window);

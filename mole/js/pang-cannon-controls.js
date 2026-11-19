/* Reuses the plaza input model; each FIRE pointer-down creates at most one request. */
(function(root){'use strict';
 function layout(width,height,insets={left:0,right:0,bottom:0}){const portrait=height>width,size=portrait?Math.max(72,Math.min(110,width*.245,height*.145)):Math.max(50,Math.min(140,height*.23,width*.18)),pad=Math.max(12,height*.035),bottom=pad+(insets.bottom||0);return{fire:{x:width-pad-(insets.right||0)-size,y:height-bottom-size,w:size,h:size},stick:{x:pad+(insets.left||0),y:height-bottom-size,w:size,h:size},skills:[]};}

 function create(host,options={}){const input=root.MoleGame.Home3DUI.createInput(),held=new Set(),stick=document.createElement('div'),knob=document.createElement('span'),fire=document.createElement('button'),buttons=[];let enabled=false,disposed=false,aim={u:.5,v:.42};stick.className='ppc-stick';stick.appendChild(knob);fire.className='ppc-fire';fire.textContent='FIRE';fire.type='button';fire.setAttribute('aria-label','FIRE');host.append(stick,fire);
  function xy(e){const r=stick.getBoundingClientRect();return[e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2,r.width*.32];}
  function paint(){const r=stick.getBoundingClientRect().width*.32;knob.style.transform='translate('+input.joy.x*r+'px,'+input.joy.y*r+'px)';}
  function reset(){held.clear();input.reset();paint();}
  const listeners=[];function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
  listen(stick,'pointerdown',e=>{if(!enabled)return;e.preventDefault();if(input.stickDown(e.pointerId,...xy(e))){stick.setPointerCapture?.(e.pointerId);paint();}});listen(stick,'pointermove',e=>{input.stickMove(e.pointerId,...xy(e));paint();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(stick,type,e=>{input.stickUp(e.pointerId);paint();});
  function single(button,fn){listen(button,'pointerdown',e=>{e.preventDefault();if(!enabled||button.disabled||held.has(e.pointerId))return;held.add(e.pointerId);button.setPointerCapture?.(e.pointerId);fn();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>held.delete(e.pointerId));}
  single(fire,()=>options.onFire?.({...aim}));
  function resize(){const rect=host.getBoundingClientRect(),style=root.getComputedStyle?.(host),safe=side=>parseFloat(style?.getPropertyValue('--ppc-safe-'+side))||0,d=layout(rect.width||800,rect.height||450,{left:safe('left'),right:safe('right'),bottom:safe('bottom')});for(const [el,p]of [[fire,d.fire],[stick,d.stick],...buttons.map((b,i)=>[b,d.skills[i]])]){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.w+'px';el.style.height=p.h+'px';}paint();}
  listen(root,'resize',resize);const observer=root.ResizeObserver?new root.ResizeObserver(resize):null;observer?.observe(host);resize();
  listen(root,'blur',()=>{reset();options.onBlur?.();});listen(document,'visibilitychange',()=>{if(document.hidden){reset();options.onBlur?.();}});
  function update(dt){if(!enabled||disposed)return aim;const rect=host.getBoundingClientRect(),width=Math.max(1,rect.width||800),height=Math.max(1,rect.height||450),length=Math.hypot(input.joy.x,input.joy.y),deadZone=.10;if(length>deadZone){const speed=Math.min(width,height)*.72*Math.pow(Math.min(1,(length-deadZone)/(1-deadZone)),1.8),step=speed*Math.max(0,dt)/length;aim.u=Math.max(.08,Math.min(.92,aim.u+input.joy.x*step/width));aim.v=Math.max(.08,Math.min(.82,aim.v+input.joy.y*step/height));}return{...aim};}
  function setEnabled(on){enabled=!!on;input.setEnabled(enabled);if(!enabled)reset();}
  function setSkills(ids){for(const b of buttons)b.disabled=!ids.includes(b.dataset.skill);}
  function dispose(){if(disposed)return;disposed=true;observer?.disconnect();setEnabled(false);listeners.forEach(f=>f());for(const el of [stick,fire,...buttons])el.remove();}
  return{update,setEnabled,setSkills,reset,dispose,fire,stick,buttons,aim:()=>({...aim})};
 }
 root.MoleGame.PangCannonControls={create,layout};
})(window);

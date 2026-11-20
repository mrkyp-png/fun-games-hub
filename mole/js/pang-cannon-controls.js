/* V1758 C: sea area = touch-to-aim, release-to-fire; ice area = drag to move the cannon; skill buttons at the bottom right. */
(function(root){'use strict';
 const SKILLS=[['shield','🛡️','Shield'],['targeting','🎯','Targeting'],['ai','🤖','AI']];
 function layout(width,height,insets={left:0,right:0,bottom:0}){const size=Math.round(Math.max(44,Math.min(64,width*.12))),gap=Math.round(size*.22),pad=Math.max(12,height*.025),right=pad+(insets.right||0),bottom=pad+(insets.bottom||0);return{skills:SKILLS.map((_,i)=>({x:width-right-size,y:height-bottom-size-(SKILLS.length-1-i)*(size+gap),w:size,h:size}))};}

 function create(host,options={}){const held=new Set(),buttons=SKILLS.map(([id,icon,label])=>{const b=document.createElement('button');b.type='button';b.className='ppc-skill';b.dataset.skill=id;b.textContent=icon;b.setAttribute('aria-label',label);return b;});let enabled=false,disposed=false,pointer=null,mover=null,aim={u:.5,v:.42};const moveFromV=options.moveFromV??.62;host.append(...buttons);
  const listeners=[];function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
  function point(e){const r=host.getBoundingClientRect(),w=Math.max(1,r.width||800),h=Math.max(1,r.height||450);return{u:Math.max(.08,Math.min(.92,(e.clientX-r.left)/w)),v:Math.max(.08,Math.min(.82,(e.clientY-r.top)/h))};}
  function reset(){held.clear();pointer=null;mover=null;}
  listen(host,'pointerdown',e=>{if(!enabled||e.target.closest?.('button,.ppc-overlay'))return;const r=host.getBoundingClientRect(),v=(e.clientY-r.top)/Math.max(1,r.height||450);if(v>=moveFromV){if(mover)return;e.preventDefault();mover={id:e.pointerId,x:e.clientX,y:e.clientY};host.setPointerCapture?.(e.pointerId);return;}if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;host.setPointerCapture?.(e.pointerId);aim=point(e);});
  listen(host,'pointermove',e=>{if(e.pointerId===pointer)aim=point(e);else if(mover&&e.pointerId===mover.id){const dx=e.clientX-mover.x,dy=e.clientY-mover.y;mover.x=e.clientX;mover.y=e.clientY;if(enabled&&(dx||dy))options.onMove?.(dx,dy);}});
  listen(host,'pointerup',e=>{if(mover&&e.pointerId===mover.id){mover=null;return;}if(e.pointerId!==pointer)return;pointer=null;aim=point(e);if(enabled)options.onFire?.({...aim});});
  for(const type of ['pointercancel','lostpointercapture'])listen(host,type,e=>{if(e.pointerId===pointer)pointer=null;if(mover&&e.pointerId===mover.id)mover=null;});
  function single(button,fn){listen(button,'pointerdown',e=>{e.preventDefault();if(!enabled||button.disabled||held.has(e.pointerId))return;held.add(e.pointerId);button.setPointerCapture?.(e.pointerId);fn();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>held.delete(e.pointerId));}
  for(const b of buttons)single(b,()=>options.onSkill?.(b.dataset.skill));
  function resize(){const rect=host.getBoundingClientRect(),style=root.getComputedStyle?.(host),safe=side=>parseFloat(style?.getPropertyValue('--ppc-safe-'+side))||0,d=layout(rect.width||800,rect.height||450,{left:safe('left'),right:safe('right'),bottom:safe('bottom')});buttons.forEach((el,i)=>{const p=d.skills[i];el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.w+'px';el.style.height=p.h+'px';});}
  listen(root,'resize',resize);const observer=root.ResizeObserver?new root.ResizeObserver(resize):null;observer?.observe(host);resize();
  listen(root,'blur',()=>{reset();options.onBlur?.();});listen(document,'visibilitychange',()=>{if(document.hidden){reset();options.onBlur?.();}});
  function update(){return{...aim};}
  function setEnabled(on){enabled=!!on;if(!enabled)reset();}
  function setSkills(ids){for(const b of buttons)b.disabled=!ids.includes(b.dataset.skill);}
  function dispose(){if(disposed)return;disposed=true;observer?.disconnect();setEnabled(false);listeners.forEach(f=>f());for(const el of buttons)el.remove();}
  return{update,setEnabled,setSkills,reset,dispose,buttons,aim:()=>({...aim})};
 }
 root.MoleGame.PangCannonControls={create,layout};
})(window);

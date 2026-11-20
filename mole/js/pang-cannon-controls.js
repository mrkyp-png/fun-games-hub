/* V1759 C: left joystick moves the cannon, right joystick moves the reticle (auto-fire is in the controller); skill buttons above the right stick. */
(function(root){'use strict';
 const SKILLS=[['shield','🛡️','Shield'],['targeting','🎯','Targeting'],['ai','🤖','AI']];
 function layout(width,height,insets={left:0,right:0,bottom:0}){const size=Math.round(Math.max(90,Math.min(120,width*.27))),pad=Math.max(14,height*.022),bottom=height-pad-(insets.bottom||0)-size,left={x:pad+(insets.left||0),y:bottom,w:size,h:size},right={x:width-pad-(insets.right||0)-size,y:bottom,w:size,h:size},span=right.x-(left.x+size),gap=8,skill=Math.round(Math.max(46,Math.min(64,(span-gap*4)/SKILLS.length))),row=SKILLS.length*skill+(SKILLS.length-1)*gap,x0=left.x+size+(span-row)/2,y=bottom+size-skill;return{move:left,aim:right,skills:SKILLS.map((_,i)=>({x:x0+i*(skill+gap),y,w:skill,h:skill}))};}

 function create(host,options={}){const held=new Set(),buttons=SKILLS.map(([id,icon,label])=>{const b=document.createElement('button');b.type='button';b.className='ppc-skill';b.dataset.skill=id;const src=root.MoleGame.Skills?.skillById(id)?.icon;if(src){const wrap=document.createElement('span'),im=document.createElement('img');wrap.className='ppc-skill-ic';im.alt='';im.src=src;wrap.appendChild(im);b.appendChild(wrap);}else b.textContent=icon;b.setAttribute('aria-label',label);return b;});
  function stick(name){const el=document.createElement('div'),knob=document.createElement('span');el.className='ppc-stick ppc-stick-'+name;el.appendChild(knob);return{el,knob,id:null,x:0,y:0};}
  const move=stick('move'),aimStick=stick('aim');let enabled=false,disposed=false,aim={u:.5,v:.42};host.append(move.el,aimStick.el,...buttons);
  const listeners=[];function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
  function paint(s){const r=s.el.getBoundingClientRect().width*.32;s.knob.style.transform='translate('+s.x*r+'px,'+s.y*r+'px)';}
  function set(s,e){const r=s.el.getBoundingClientRect(),max=r.width*.32;let x=(e.clientX-r.left-r.width/2)/max,y=(e.clientY-r.top-r.height/2)/max;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}s.x=x;s.y=y;paint(s);}
  function release(s){s.id=null;s.x=s.y=0;paint(s);}
  for(const s of [move,aimStick]){listen(s.el,'pointerdown',e=>{if(!enabled||s.id!==null)return;e.preventDefault();s.id=e.pointerId;s.el.setPointerCapture?.(e.pointerId);set(s,e);});listen(s.el,'pointermove',e=>{if(e.pointerId===s.id)set(s,e);});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(s.el,type,e=>{if(e.pointerId===s.id)release(s);});}
  function reset(){held.clear();release(move);release(aimStick);}
  function single(button,fn){listen(button,'pointerdown',e=>{e.preventDefault();if(!enabled||button.disabled||held.has(e.pointerId))return;held.add(e.pointerId);button.setPointerCapture?.(e.pointerId);fn();});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,e=>held.delete(e.pointerId));}
  for(const b of buttons)single(b,()=>options.onSkill?.(b.dataset.skill));
  function place(el,p){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.w+'px';el.style.height=p.h+'px';}
  function resize(){const rect=host.getBoundingClientRect(),style=root.getComputedStyle?.(host),safe=side=>parseFloat(style?.getPropertyValue('--ppc-safe-'+side))||0,d=layout(rect.width||800,rect.height||450,{left:safe('left'),right:safe('right'),bottom:safe('bottom')});place(move.el,d.move);place(aimStick.el,d.aim);buttons.forEach((el,i)=>place(el,d.skills[i]));paint(move);paint(aimStick);}
  listen(root,'resize',resize);const observer=root.ResizeObserver?new root.ResizeObserver(resize):null;observer?.observe(host);resize();
  listen(root,'blur',()=>{reset();options.onBlur?.();});listen(document,'visibilitychange',()=>{if(document.hidden){reset();options.onBlur?.();}});
  const curve=(x,y)=>{const l=Math.hypot(x,y),dead=.1;if(l<=dead)return 0;return Math.pow(Math.min(1,(l-dead)/(1-dead)),1.6)/l;};
  function update(dt){if(!enabled||disposed)return{...aim};const rect=host.getBoundingClientRect(),width=Math.max(1,rect.width||800),height=Math.max(1,rect.height||450),k=curve(aimStick.x,aimStick.y);if(k){const step=Math.min(width,height)*.85*Math.max(0,dt)*k;aim.u=Math.max(.08,Math.min(.92,aim.u+aimStick.x*step/width));aim.v=Math.max(.08,Math.min(.82,aim.v+aimStick.y*step/height));}const m=curve(move.x,move.y);if(m){const step=width*.5*Math.max(0,dt)*m;options.onMove?.(move.x*step,move.y*step);}return{...aim};}
  function setEnabled(on){enabled=!!on;if(!enabled)reset();}
  function setSkills(ids){for(const b of buttons)b.disabled=!ids.includes(b.dataset.skill);}
  function dispose(){if(disposed)return;disposed=true;observer?.disconnect();setEnabled(false);listeners.forEach(f=>f());for(const el of [move.el,aimStick.el,...buttons])el.remove();}
  return{update,setEnabled,setSkills,reset,dispose,buttons,aim:()=>({...aim})};
 }
 root.MoleGame.PangCannonControls={create,layout};
})(window);

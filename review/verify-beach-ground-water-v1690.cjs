const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),L=require('../mole/js/home3d-layout.js');
const source=fs.readFileSync('mole/js/home3d.js','utf8');
function fn(name){const begin=source.indexOf('    function '+name+'('),brace=source.indexOf('{',begin);let depth=1,end=brace+1;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(begin,end);}
assert.equal(L.groundHeight(0,0),0);assert.equal(L.groundHeight(0,20.8),-.3);assert.equal(L.groundHeight(-7,-5),0);
// The rendered beach cylinder has centre -0.55 and depth 0.5: top = -0.3.
const builder=fs.readFileSync('review/build-home-plaza.py','utf8');assert(builder.includes("cyl('Beach sand', (0, -4.3, -.55), 18.1, .5"));
let hearts=4,resets=0;
const c={L,time:2,view:{x:0,z:20.8},st:{state:'EXPLORE'},drowning:null,air:null,onBoat:null,riding:null,inside:null,walking:false,rise:2,RISE_T:.8,HOLE_Y:-.3,hop:null,jumpAt:-1,boardAt:-1,route:{},splashAt:-9,
 IN:{jump:{T:.6,height:t=>4*t}},Math,MG:{Economy:{getHearts:()=>hearts,addHearts:n=>hearts+=n},Home3DRenderer:{seaHeight:()=>.04}},nowS:()=>5,refreshHud(){},rd:{setSmoke(){}},ui:{input:{reset(){}}},setTimeout(){},jumping:()=>false,resetToStart(){resets++;c.drowning=null;c.view.x=0;c.view.z=0;},JUMP_V:4.4,FLAP_V:3.6};
vm.createContext(c);vm.runInContext(['pose','jump','splash','updateDrowning'].map(fn).join('\n'),c);
assert.equal(c.pose().y,-.3,'Idle soles follow beach');c.walking=true;assert.equal(c.pose().clip,'WalkFwd');assert.equal(c.pose().y,-.3);
c.jump();assert.equal(c.air.y,-.3,'Takeoff starts at sand rather than plaza height');c.air=null;
c.splash(0,30);assert.equal(hearts,3);assert.equal(c.view.z,20.8,'No teleport at water contact');assert.equal(c.pose().y,-.58);
c.splash(0,30);assert.equal(hearts,3,'One heart per fall');c.jump();assert.equal(c.air,null,'No flight restart while sinking');
c.time+=.6;assert(c.pose().y<-1.9,'Body continues below the sea');c.updateDrowning();assert.equal(resets,0);
c.time+=.8;c.updateDrowning();assert.equal(resets,1);assert.equal(c.view.x,0);assert.equal(c.view.z,0);
assert(source.includes('if (land && air.y <= L.groundHeight(view.x,view.z))'));
assert(source.includes('if (!land && air.y <= -.62+MG.Home3DRenderer.seaHeight'));
console.log('PASS: beach standing/walking/takeoff/landing match sand -0.3; sinking passes below the animated sea; input locked, one heart charge, return to plaza centre after 1.4s.');

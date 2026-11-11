const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../mole/js/home3d-layout.js');
for(const site of L.SITES.filter(s=>s.doorDepth)) {
  assert.equal(site.scale,1.6);assert.equal(site.depthScale,.8);
  const front=L.entryPoint(site), unit={x:-site.x/Math.hypot(site.x,site.z),z:-site.z/Math.hypot(site.x,site.z)};
  assert(L.allowed(front.x,front.z));assert(!L.crossedDoor(site,front.x,front.z),'Nearby is not entry');
  const outside={x:site.x+unit.x*(site.doorDepth+.2),z:site.z+unit.z*(site.doorDepth+.2)};
  const inside={x:site.x+unit.x*(site.doorDepth-.15),z:site.z+unit.z*(site.doorDepth-.15)};
  assert(L.allowed(outside.x,outside.z));assert(L.allowed(inside.x,inside.z));
  assert(!L.crossedDoor(site,outside.x,outside.z));assert(L.crossedDoor(site,inside.x,inside.z));
  assert(!L.crossedDoor(site,inside.x-unit.z,inside.z+unit.x),'Walking beside door does not enter');
  assert(L.doorApproach(site,front));
  for(const [side,along] of [[0,0],[1,0],[0,-site.halfDepth],[site.halfWidth,0]]) {
    const x=site.x+unit.x*along-unit.z*side,z=site.z+unit.z*along+unit.x*side;
    assert(!L.allowed(x,z),'Only front doorway can pass; walls and interior stay blocked');
  }
}
const shop=L.SITES.find(s=>s.action==='shop'),rhythm=L.SITES.find(s=>s.action==='rhythm');
const arcade=L.SITES.find(s=>s.action==='lightMode'),board=L.SITES.find(s=>s.id==='board');
assert.equal(shop.x,2*arcade.x-board.x,'Shop mirrors board across arcade centerline');
assert.equal(shop.z,board.z,'Shop and board have matching depth');
assert.equal(rhythm.x,2*arcade.x-L.DISCO.x,'Rhythm mirrors disco across arcade centerline');
assert.equal(rhythm.z,L.DISCO.z,'Rhythm and disco have matching depth');
assert(rhythm.x<shop.x,'Rhythm is left of shop');
assert(Math.hypot(shop.x-rhythm.x,shop.z-rhythm.z)>shop.body+rhythm.body);
const source=fs.readFileSync('mole/js/home3d.js','utf8');
const start=source.indexOf('function enterDoor('),end=source.indexOf('function move(',start),body=source.slice(start,end);
assert(!body.includes('setEnabled(false)'),'Door sequence does not disable joystick');
const context={doorEntry:{site:shop,committed:false},walking:true,ui:{input:{joy:{x:1,y:0}}},view:{yaw:0},SPEED:2.8,L,api:{open(){throw Error('Cancelled entry must not open screen')}},wake(){}};
const method=source.slice(source.indexOf('function walkThroughDoor('),end);
const walk=vm.runInNewContext('('+method+')',context);
assert.equal(walk(.016),false);assert.equal(context.doorEntry,null,'Joystick cancels approach');
context.doorEntry={site:shop,committed:true};context.ui.input.joy={x:1,y:0};
assert.equal(walk(.016),false);assert.equal(context.doorEntry,null,'Joystick away from doorway cancels crossing');
const front=L.entryPoint(shop),target=L.doorPoint(shop),u={x:-shop.x/Math.hypot(shop.x,shop.z),z:-shop.z/Math.hypot(shop.x,shop.z)};
context.view={x:shop.x+u.x*(shop.doorDepth-.1),z:shop.z+u.z*(shop.doorDepth-.1),yaw:0};
context.ui.input.joy={x:0,y:0};let opened=0;
context.api.open=(action,back)=>{assert.equal(action,'shop');assert(L.allowed(back.x,back.z));opened++;return true;};
context.doorEntry={site:shop,committed:true,points:[target],index:0,returnView:front};
assert.equal(walk(.016),false);assert.equal(opened,0,'Do not open before completing doorway walk');
for(let i=0;i<60&&context.doorEntry;i++) walk(.016);
assert.equal(opened,1,'Open exactly once after walking through door');
for(const site of [shop,rhythm]) {
  const radius=Math.hypot(site.x,site.z),ux=-site.x/radius,uz=-site.z/radius;
  const from={x:site.x+ux*(site.body+.1),z:site.z+uz*(site.body+.1)};
  const approach=L.doorApproach(site,from);
  assert.deepEqual(approach,[],'Already in front: never step back to the outside entry point');
  context.view={...from,yaw:0};context.doorEntry={site,committed:false,points:approach.concat([L.doorPoint(site)]),index:0,returnView:L.entryPoint(site)};
  let transitions=0;context.api.open=(action)=>{assert.equal(action,site.action);transitions++;return true;};
  let last=L.doorCoordinates(site,from.x,from.z).along;
  for(let i=0;i<180&&context.doorEntry;i++) {
    walk(1/60);
    const along=L.doorCoordinates(site,context.view.x,context.view.z).along;
    assert(along<=last+.00001,'Entry never reverses direction');last=along;
    assert(Math.sin(context.view.heading)*-ux+Math.cos(context.view.heading)*-uz>.99,'Mole faces inward throughout entry');
  }
  assert.equal(transitions,1);
}
console.log('PASS: symmetric placement, doorway-only entry, no proximity entry, joystick cancellation');

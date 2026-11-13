import type { World } from './types';
import { levelFor, levels, movePosition, heatActive } from './levels';
// Explicitly labeled single-browser sandbox. Network play always uses Django's rules.
export function previewWorld(levelId='verdant'): World {
  const now = Date.now() / 1000;
  const level=levels.find(l=>l.id===levelId)??levels[0];
  const world:World = { seed: 4271, started: now, duration: 720, status: 'active', score: 0, energy: 0, weather: 'aurora', waypoint: 0, companion: 'follow', players: [{id:'preview',name:'Explorer',x:0,z:0,yaw:0,shield:100,color:'#b9f36b',connected:true,scan:0}], shards: Array.from({length:18},(_,i)=>({id:i,x:Math.cos(i*Math.PI/9)*(7+(i%4)*3),z:Math.sin(i*Math.PI/9)*(7+(i%4)*3),taken:false})), relays:[{id:0,name:'Echo Spire',x:-12,z:-8,charge:0},{id:1,name:'Verdant Array',x:12,z:-8,charge:0},{id:2,name:'Horizon Gate',x:0,z:14,charge:0}], sentinels:[], events:[], revision:0, now, ai:{message:'Hello, world. I’m ORA, your expedition companion. Launch a squad to connect to the live mission director. Or explore this local preview to get your bearings.',source:'local',weather:'aurora',waypoint:0,companion:'follow'} };
  world.level=level.id;world.duration=level.duration;world.weather=level.weather;world.relays=level.relays.map((r,id)=>({...r,id,charge:0}));
  world.ai.weather=level.weather;world.ai.message=`Welcome to ${level.name}. ${level.rule} Launch a squad to contact Claude, or explore this local sandbox.`;
  return world;
}
export function stepPreview(world:World,x:number,z:number,sprint:boolean,dt:number) {
  if(world.status!=='active')return;
  const p=world.players[0],level=levelFor(world);
  movePosition(world,p,{x,z,sprint},dt);
  if(x||z)p.yaw=Math.atan2(x,z);
  world.now=Date.now()/1000;
  world.sentinels=Array.from({length:level.sentinelCount},(_,i)=>({x:Math.cos((world.now-world.started)*level.sentinelSpeed+i*Math.PI*2/level.sentinelCount)*level.sentinelRadius,z:Math.sin((world.now-world.started)*level.sentinelSpeed+i*Math.PI*2/level.sentinelCount)*level.sentinelRadius}));
  p.shield=Math.min(100,p.shield+dt*3);
  if(world.sentinels.some(h=>Math.hypot(h.x-p.x,h.z-p.z)<1.7))p.shield=Math.max(0,p.shield-dt*(world.weather==='storm'?32:22));
  if(heatActive(world)&&level.zones.some(zone=>zone.kind==='heat'&&Math.hypot(p.x-zone.x,p.z-zone.z)<zone.radius))p.shield=Math.max(0,p.shield-dt*28);
  if(p.shield<=0){p.x=0;p.z=0;p.shield=100;}
  if(world.now-world.started>=world.duration)world.status='lost';
}
export function previewAction(world:World,kind:string):string {
  if(world.status!=='active')return 'This preview has ended. Launch a new expedition.';
  const p=world.players[0];
  if(kind==='scan'){p.scan=Date.now()/1000+4;return 'Survey pulse emitted. The luminous fragments are your energy source.';}
  const shard=world.shards.find(s=>!s.taken&&Math.hypot(s.x-p.x,s.z-p.z)<2.7);
  if(shard){shard.taken=true;world.energy++;world.score+=100;return 'Signal fragment recovered. +100';}
  const relay=world.relays.find(r=>r.charge<3&&Math.hypot(r.x-p.x,r.z-p.z)<3.4);
  if(relay&&levelFor(world).ordered&&world.relays.slice(0,relay.id).some(r=>r.charge<3))return 'Circuit locked. Fully power the preceding relay first.';
  if(relay&&world.energy){relay.charge++;world.energy--;world.score+=250;return `${relay.name}: ${relay.charge}/3 cells installed.`;}
  if(world.relays.every(r=>r.charge===3)&&Math.hypot(p.x,p.z)<4){world.status='won';world.score+=1000;return 'Signal restored. Hello, universe!';}
  return 'Move near a fragment or relay and press E. Each relay needs three cells.';
}

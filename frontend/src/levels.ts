import catalog from '../../shared/levels.json' with { type: 'json' };
import type { Weather, World } from './types';
export interface Level {
  id:string;name:string;sector:string;difficulty:string;description:string;rule:string;duration:number;weather:Weather;ordered:boolean;
  sentinelCount:number;sentinelSpeed:number;sentinelRadius:number;
  palette:{sky:string;ground:string;rock:string;accent:string;flora:string;moon:string;rim:string};
  relays:{name:string;x:number;z:number}[];zones:{x:number;z:number;radius:number;kind:string}[];
}
export const levels=catalog as Level[];
export const levelFor=(world:Pick<World,'level'>)=>levels.find(l=>l.id===world.level)??levels[0];
export const heatActive=(world:World)=>(world.now-world.started)%10>=6;
export function movementSpeed(world:World,x:number,z:number,sprint:boolean){
  const frost=levelFor(world).zones.some(zone=>zone.kind==='frost'&&Math.hypot(x-zone.x,z-zone.z)<zone.radius);
  return (sprint?7:4.5)*(frost?.55:1);
}
export function movePosition(world:World,position:{x:number;z:number},input:{x:number;z:number;sprint:boolean},dt:number){
  const n=Math.max(1,Math.hypot(input.x,input.z)),speed=movementSpeed(world,position.x,position.z,input.sprint);
  position.x+=input.x/n*dt*speed;position.z+=input.z/n*dt*speed;
  const radius=Math.hypot(position.x,position.z);if(radius>23){position.x*=23/radius;position.z*=23/radius;}
}

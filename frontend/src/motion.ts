import { movePosition } from './levels';
import type { Player, World } from './types';

export interface MovementInput {x:number;z:number;sprint:boolean}
export function readMovement(keys:Set<string>):MovementInput {
  return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),z:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')};
}

/** Local prediction is cosmetic. Scores, collisions, pickups and position authority remain on Django. */
export class Motion {
  private previous:World|null=null;
  private latest:World|null=null;
  private received=0;
  private interval=.1;
  private local:{x:number;z:number}|null=null;
  sample(world:World,id:string,input:MovementInput,dt:number,now=performance.now()):Player[] {
    if(id==='preview')return world.players;
    if(world!==this.latest){
      if(this.latest)this.interval=Math.max(.05,Math.min(.2,(now-this.received)/1000));
      this.previous=this.latest;this.latest=world;this.received=now;
    }
    const age=Math.max(0,(now-this.received)/1000),alpha=Math.min(1,age/this.interval);
    return world.players.map(player=>{
      const old=this.previous?.players.find(p=>p.id===player.id)??player;
      if(player.id!==id){
        if(Math.hypot(player.x-old.x,player.z-old.z)>4)return player;
        return {...player,x:old.x+(player.x-old.x)*alpha,z:old.z+(player.z-old.z)*alpha};
      }
      if(!this.local||Math.hypot(this.local.x-player.x,this.local.z-player.z)>4)this.local={x:player.x,z:player.z};
      const active=age<.35&&world.status==='active';
      const target={x:player.x,z:player.z};
      if(active){movePosition(world,this.local,input,Math.min(dt,.05));movePosition(world,target,input,Math.min(age,.15));}
      const correction=1-Math.exp(-dt*7);
      this.local.x+=(target.x-this.local.x)*correction;this.local.z+=(target.z-this.local.z)*correction;
      return {...player,...this.local,yaw:active&&(input.x||input.z)?Math.atan2(input.x,input.z):player.yaw};
    });
  }
}

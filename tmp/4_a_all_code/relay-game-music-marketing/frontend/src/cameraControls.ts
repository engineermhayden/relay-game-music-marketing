import type { AuraCameraRig, AuraCameraPose } from '@aura3d/engine';

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const MIN_DISTANCE=6,MAX_DISTANCE=95;
type Pointer={x:number;y:number;pan:boolean};

/** Pointer gestures drive an Aura3D camera rig, without remounting the scene. */
export function createCameraControls(canvas:HTMLCanvasElement,followTarget?:string){
  const offset=followTarget?[12,16,18]:[35,32,43];
  const defaults={yaw:Math.atan2(offset[0],offset[2]),pitch:Math.asin(offset[1]/Math.hypot(...offset)),distance:Math.hypot(...offset),x:0,z:0};
  let desired={...defaults},current={...defaults};
  const pointers=new Map<number,Pointer>();
  const zoom=(factor:number)=>{desired.distance=clamp(desired.distance*factor,MIN_DISTANCE,MAX_DISTANCE);};
  const pan=(dx:number,dy:number)=>{
    const scale=desired.distance*2*Math.tan(23*Math.PI/180)/Math.max(1,canvas.clientHeight);
    const up=dy/Math.max(.25,Math.sin(current.pitch)),sin=Math.sin(current.yaw),cos=Math.cos(current.yaw);
    desired.x-=scale*(dx*cos+up*sin);desired.z+=scale*(dx*sin-up*cos);
    const radius=Math.hypot(desired.x,desired.z);if(radius>28){desired.x*=28/radius;desired.z*=28/radius;}
  };
  const reset=()=>{desired={...defaults};};
  const clear=()=>{
    for(const id of pointers.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    pointers.clear();canvas.classList.remove('dragging');
  };
  const down=(event:PointerEvent)=>{
    if(event.pointerType!=='touch'&&![0,1,2].includes(event.button))return;
    event.preventDefault();canvas.focus({preventScroll:true});
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,pan:event.button!==0||event.shiftKey});
    canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
  };
  const move=(event:PointerEvent)=>{
    const previous=pointers.get(event.pointerId);if(!previous)return;
    event.preventDefault();
    const next={...previous,x:event.clientX,y:event.clientY};
    if(pointers.size===2){
      const other=[...pointers.entries()].find(([id])=>id!==event.pointerId)![1];
      const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);
      if(before>4&&after>4)zoom(before/after);
      pan((next.x-previous.x)/2,(next.y-previous.y)/2);
    }else if(pointers.size===1){
      const dx=next.x-previous.x,dy=next.y-previous.y;
      if(previous.pan||event.shiftKey)pan(dx,dy);
      else{desired.yaw-=dx*.006;desired.pitch=clamp(desired.pitch+dy*.005,Math.PI/12,Math.PI*82/180);}
    }
    pointers.set(event.pointerId,next);
  };
  const up=(event:PointerEvent)=>{
    pointers.delete(event.pointerId);
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(!pointers.size)canvas.classList.remove('dragging');
  };
  const wheel=(event:WheelEvent)=>{
    event.preventDefault();
    const pixels=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1);
    zoom(Math.exp(clamp(pixels,-500,500)*.0015));
  };
  const contextMenu=(event:Event)=>event.preventDefault();
  const visibility=()=>{if(document.hidden)clear();};
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('lostpointercapture',up);
  canvas.addEventListener('wheel',wheel,{passive:false});
  canvas.addEventListener('contextmenu',contextMenu);
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',visibility);
  const rig:AuraCameraRig={
    id:'relay-inspection',continuous:true,
    update(ctx):AuraCameraPose{
      const blend=1-Math.exp(-Math.min(ctx.dt,.1)*20);
      for(const key of ['yaw','pitch','distance','x','z'] as const)current[key]+=(desired[key]-current[key])*blend;
      const subject=followTarget?ctx.subject(followTarget):undefined;
      const x=(subject?.position[0]??0)+current.x,y=followTarget?1.9:1,z=(subject?.position[2]??0)+current.z;
      const horizontal=Math.cos(current.pitch)*current.distance;
      return {position:[x+Math.sin(current.yaw)*horizontal,y+Math.sin(current.pitch)*current.distance,z+Math.cos(current.yaw)*horizontal],target:[x,y,z],up:[0,1,0],roll:0,fov:46,near:.1,far:300};
    },
  };
  return {rig,zoomIn:()=>zoom(.8),zoomOut:()=>zoom(1.25),reset,dispose:()=>{
    clear();
    canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
    canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('lostpointercapture',up);
    canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('contextmenu',contextMenu);
    window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);
  }};
}

import { test, expect } from '@playwright/test';
import { Motion, readMovement } from '../src/motion';
import { previewWorld } from '../src/preview';
import { movePosition } from '../src/levels';

test('movement is frame-rate independent, diagonal normalized, and bounded',()=>{
  const world=previewWorld(),input={x:1,z:1,sprint:false};
  for(const hz of [30,60,144]){
    const p={x:0,z:0};for(let i=0;i<hz;i++)movePosition(world,p,input,1/hz);
    expect(Math.hypot(p.x,p.z)).toBeCloseTo(4.5,5);
    for(let i=0;i<hz*10;i++)movePosition(world,p,input,1/hz);
    expect(Math.hypot(p.x,p.z)).toBeCloseTo(23,5);
  }
  expect(readMovement(new Set(['KeyD','ArrowRight','ShiftLeft']))).toEqual({x:1,z:0,sprint:true});
  expect(readMovement(new Set(['KeyW','ArrowDown']))).toEqual({x:0,z:0,sprint:false});
});

test('local input responds before the next snapshot and reconciles after release',()=>{
  const world=previewWorld();world.players[0].id='local';
  const motion=new Motion(),idle={x:0,z:0,sprint:false};
  motion.sample(world,'local',idle,1/60,0);
  const result=motion.sample(world,'local',{...idle,x:1},1/60,16.7);
  expect(result[0].x).toBeGreaterThan(.04);
  const fresh=structuredClone(world);fresh.players[0].x=.45;
  let final=result;
  for(let i=0;i<120;i++)final=motion.sample(fresh,'local',idle,1/60,100+i*1000/60);
  expect(final[0].x).toBeCloseTo(.45,3);
  expect(world.players[0].x).toBe(0); // Prediction never modifies server data.
});

test('remote pilots interpolate snapshots and rescues snap immediately',()=>{
  const world=previewWorld();world.players[0].id='remote';const motion=new Motion(),idle={x:0,z:0,sprint:false};
  motion.sample(world,'local',idle,.016,0);
  const fresh=structuredClone(world);fresh.players[0].x=1;
  motion.sample(fresh,'local',idle,.016,100);
  expect(motion.sample(fresh,'local',idle,.016,150)[0].x).toBeCloseTo(.5);
  fresh.players[0].x=10;const rescue=structuredClone(world);
  expect(motion.sample(rescue,'local',idle,.016,200)[0].x).toBe(0);
});

import { test, expect, type Page } from '@playwright/test';

const pose=(page:Page)=>page.evaluate(()=>(globalThis as any).__AURA3D_LIVE_APPS__.all()[0].camera.presented() as {position:number[];target:number[]});
const distance=async(page:Page)=>{const p=await pose(page);return Math.hypot(...p.position.map((v,i)=>v-p.target[i]));};
const ready=async(page:Page)=>{await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:45000});await page.waitForTimeout(200);};

test('mouse orbit, pan, bounded zoom and reset keep the renderer and gameplay alive',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await ready(page);
  const canvas=page.locator('canvas');await canvas.scrollIntoViewIfNeeded();
  const box=(await canvas.boundingBox())!,x=box.x+box.width*.5,y=box.y+box.height*.45;
  await page.evaluate(()=>(globalThis as any).__cameraTestApp=(globalThis as any).__AURA3D_LIVE_APPS__.all()[0]);
  const initial=await pose(page),initialDistance=await distance(page);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+120,y+35,{steps:12});await page.mouse.up();
  await expect.poll(async()=>Math.abs((await pose(page)).position[0]-initial.position[0])).toBeGreaterThan(5);
  const scroll=await page.evaluate(()=>scrollY);
  await page.mouse.wheel(0,-450);
  await expect.poll(()=>distance(page)).toBeLessThan(initialDistance*.7);
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  const target=(await pose(page)).target;
  await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+75,y+40,{steps:10});await page.mouse.up({button:'right'});
  await expect.poll(async()=>Math.hypot(...(await pose(page)).target.map((v,i)=>v-target[i]))).toBeGreaterThan(1);
  // Repeated wheel events stay outside the ground and within the world-view limit.
  for(let i=0;i<8;i++)await page.mouse.wheel(0,-500);
  await page.waitForTimeout(400);expect(await distance(page)).toBeGreaterThanOrEqual(5.99);
  for(let i=0;i<12;i++)await page.mouse.wheel(0,500);
  await page.waitForTimeout(400);expect(await distance(page)).toBeLessThanOrEqual(95.01);
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await expect.poll(async()=>Math.abs((await distance(page))-initialDistance)).toBeLessThan(.1);
  await expect.poll(async()=>Math.hypot(...(await pose(page)).target.map((v,i)=>v-initial.target[i]))).toBeLessThan(.1);
  expect(await page.evaluate(()=>(globalThis as any).__cameraTestApp===(globalThis as any).__AURA3D_LIVE_APPS__.all()[0])).toBe(true);
  expect(await page.evaluate(()=>(globalThis as any).__cameraTestApp.nodes.require('pilot-0').position[0])).toBe(0);
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect.poll(()=>distance(page)).toBeLessThan(initialDistance*.85);
  await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect.poll(async()=>Math.abs((await distance(page))-initialDistance)).toBeLessThan(.1);
  await page.getByRole('button',{name:'Toggle camera',exact:true}).click();await ready(page);
  const followStart=await pose(page);await canvas.focus();await page.keyboard.down('KeyD');await page.waitForTimeout(450);await page.keyboard.up('KeyD');
  await expect.poll(async()=>(await pose(page)).target[0]).toBeGreaterThan(followStart.target[0]+1);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-80,y,{steps:8});await page.mouse.up();
  await expect.poll(async()=>Math.abs((await pose(page)).position[2]-followStart.position[2])).toBeGreaterThan(1);
  await page.screenshot({path:'../artifacts/camera-follow.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('touch orbit and pinch zoom work and canceled gestures release capture',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,baseURL:process.env.BASE_URL||'http://127.0.0.1:5173'});
  try{
    const page=await context.newPage();await page.goto('/');await ready(page);
    await page.locator('canvas').scrollIntoViewIfNeeded();
    const box=(await page.locator('canvas').boundingBox())!,x=box.x+box.width*.5,y=box.y+box.height*.45;
    const cdp=await context.newCDPSession(page),start=await pose(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+60,y:y+20,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(async()=>Math.abs((await pose(page)).position[0]-start.position[0])).toBeGreaterThan(3);
    const before=await distance(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-80,y:y+15,id:1},{x:x+80,y:y+15,id:2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await expect.poll(()=>distance(page)).toBeLessThan(before*.6);
    await expect(page.locator('canvas')).not.toHaveClass(/dragging/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Reset view',exact:true}).click();await expect.poll(async()=>Math.abs((await distance(page))-before)).toBeLessThan(.1);
    await page.screenshot({path:'../artifacts/camera-touch.png',fullPage:true});
  }finally{await context.close();}
});

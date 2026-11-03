import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

// Reproducible production-browser measurement, with no paid AI requests.
const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless:true, args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8080');
  await page.locator('canvas[data-ready="true"]').waitFor({timeout:60000});
  await page.waitForTimeout(4000);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  await page.evaluate(()=>{
    const app=globalThis.__AURA3D_LIVE_APPS__.all()[0];
    const report=globalThis.__profile={frames:[],updates:0,unchangedUpdates:0,keys:[],sampling:true};
    for(const id of ['pilot-0','pilot-1','helmet-1','beam-0','scan-pulse']) {
      const node=app.nodes.require(id),original=node.setVisible;
      node.setVisible=function(v){report.updates++;if(v===node.visible)report.unchangedUpdates++;return original.call(this,v);};
    }
    window.addEventListener('keydown',e=>{if(!e.repeat)report.keys.push({key:e.code,at:performance.now()});});
    let last=performance.now();
    const sample=t=>{if(!report.sampling)return;const p=app.nodes.require('pilot-0').position;report.frames.push({at:t,dt:t-last,x:p[0],z:p[2]});last=t;requestAnimationFrame(sample);};
    requestAnimationFrame(sample);
  });
  await page.locator('canvas').focus();
  for(const key of ['KeyD','ArrowLeft','KeyW','ArrowDown']) {await page.keyboard.down(key);await page.waitForTimeout(1400);await page.keyboard.up(key);await page.waitForTimeout(350);}
  const {profile}=await cdp.send('Profiler.stop');
  const result=await page.evaluate(()=>{
    const r=globalThis.__profile;r.sampling=false;
    const app=globalThis.__AURA3D_LIVE_APPS__.all()[0],gl=document.querySelector('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {...r,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',draws:app.diagnostics().drawCalls,metrics:document.querySelector('.engine-status').textContent};
  });
  const frames=result.frames.slice(1),sorted=frames.map(f=>f.dt).sort((a,b)=>a-b);
  const delays=result.keys.map(k=>{const before=[...frames].reverse().find(f=>f.at<k.at);return frames.find(f=>f.at>=k.at&&before&&Math.hypot(f.x-before.x,f.z-before.z)>.02)?.at-k.at;});
  const samples=new Map();for(const id of profile.samples||[])samples.set(id,(samples.get(id)||0)+1);
  const hot=profile.nodes.map(n=>({name:n.callFrame.functionName,url:n.callFrame.url.split('/').pop(),samples:samples.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,12);
  const summary={renderer:result.renderer,metrics:result.metrics,frames:frames.length,frameMedianMs:sorted[Math.floor(sorted.length*.5)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],longFrames:frames.filter(f=>f.dt>50).length,inputToMotionMs:delays,visibilityCalls:result.updates,redundantVisibilityCalls:result.unchangedUpdates,hot,errors};
  await mkdir('../artifacts',{recursive:true});
  await writeFile(`../artifacts/performance-${process.env.PROFILE_LABEL||'current'}.json`,JSON.stringify({summary,frames},null,2));
  console.log(JSON.stringify(summary,null,2));
} finally {await browser.close();}

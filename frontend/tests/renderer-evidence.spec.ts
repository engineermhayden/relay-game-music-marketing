import { test, expect } from '@playwright/test';
import type { AuraDiagnostics } from '@aura3d/engine';
import { collectRendererEvidence } from '../src/rendererEvidence';
import type { RenderOptions } from '../src/types';

const options:RenderOptions={bloom:true,fog:true,particles:true,shadows:true,camera:'overview',quality:'auto',lab:false,material:'ceramic'};
const report=(value:unknown,settings=options)=>collectRendererEvidence(value as AuraDiagnostics,settings,1);

test('cascaded shadow evidence takes precedence over conflicting legacy counters',()=>{
  expect(report({shadows:{shadows:[{sampled:true}]},renderer:{shadows:{mapRendered:false,mapSampled:false}}}).shadowMap).toBe('Sampled');
  expect(report({shadows:{shadows:[{sampled:false}]},renderer:{shadows:{mapRendered:true,mapSampled:true}}}).shadowMap).toBe('Requested · unreported');
  expect(report({renderer:{shadows:{mapRendered:true,mapSampled:true}}}).shadowMap).toBe('Sampled');
  expect(report({}).shadowMap).toBe('Requested · unreported');
  expect(report({shadows:{shadows:null}}).shadowMap).toBe('Requested · unreported');
});

test('disabled requests cannot inherit sampled evidence from an earlier scene',()=>{
  const evidence=report({shadows:{shadows:[{sampled:true}]},renderer:{bloom:{rendered:true},fog:{enabled:true}}},{...options,bloom:false,fog:false,shadows:false,particles:false});
  for(const key of ['bloom','fog','shadowMap','grounding','particles'] as const)expect(evidence[key]).toBe('Off');
});

test('dropped passes and missing inputs remain visible despite legacy success',()=>{
  const evidence=report({renderer:{bloom:{rendered:true}},post:{present:true,pixelBackedPasses:['bloom'],droppedPasses:['bloom'],missingInputs:['bloom:color']},effects:{errors:[{code:'SOFT_DEPTH_PENDING',message:'Soft particles unavailable'}]}});
  expect(evidence.bloom).toBe('Requested · unreported');
  expect(evidence.limitations).toContain('Postprocess pass unavailable: bloom');
  expect(evidence.limitations).toContain('Missing postprocess input: bloom:color');
  expect(evidence.limitations).toContain('SOFT_DEPTH_PENDING: Soft particles unavailable');
  expect(evidence.particles).toBe('Requested · unreported');
});

test('production lab reports sampled shadows, real footprints, and disabled effects honestly',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:60000});
  await page.getByRole('button',{name:'Engine lab',exact:true}).first().click();
  await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:60000});
  const panel=page.locator('.diagnostic-panel');
  await panel.locator(':scope > summary').click();
  const value=(label:string)=>panel.locator('.evidence-grid > span').filter({hasText:label}).locator('b');
  await expect(value('Shadow map')).toHaveText('Sampled',{timeout:20000});
  await expect(value('Grounding')).toHaveText('Blob footprints');
  await expect(value('Particles')).toHaveText('Rendered');
  await expect(panel).toContainText('Instanced submissions (total)');
  const evidence=await page.evaluate(()=>{
    const app=(globalThis as any).__AURA3D_LIVE_APPS__.all()[0],d=app.diagnostics();
    return {warnings:[...d.warnings,...d.renderer.warnings],modes:d.evidence.interactions.modes,footprints:app.nodes.require('relay-contact-shadow-footprints').visible};
  });
  expect(evidence.warnings.some(w=>w.includes('Scene has no interactions')||w.includes('scene has no contact shadow'))).toBe(false);
  expect(evidence.modes).toEqual(['keyboard','pointer']);expect(evidence.footprints).toBe(true);
  // Freeze time and compare actual pixels with only the grounding mesh hidden.
  const changedPixels=await page.evaluate(async()=>{
    const app=(globalThis as any).__AURA3D_LIVE_APPS__.all()[0];app.pause();
    const mesh=app.nodes.require('relay-contact-shadow-footprints');
    const capture=():string=>{app.step(0);return app.screenshot().dataUrl;};
    const pixels=async(data:string)=>{
      const image=new Image();image.src=data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
      return ctx.getImageData(0,0,canvas.width,canvas.height).data;
    };
    try{
      // Read both frames in one task so game timers cannot move other objects.
      const first=capture();mesh.setVisible(false);const second=capture();
      const [before,after]=await Promise.all([pixels(first),pixels(second)]);
      let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>6)changed++;
      return changed;
    }finally{mesh.setVisible(true);app.resume();}
  });
  expect(changedPixels).toBeGreaterThan(10);
  await page.screenshot({path:'../artifacts/renderer-evidence.png',fullPage:true});
  for(const effect of ['shadows','bloom','fog','particles']){
    await page.getByRole('checkbox',{name:effect,exact:true}).uncheck();
    await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:60000});
    await expect(value(({shadows:'Shadow map',bloom:'Bloom pass',fog:'Fog',particles:'Particles'} as Record<string,string>)[effect])).toHaveText('Off',{timeout:15000});
    if(effect!=='particles')await expect(value('Particles')).toHaveText('Rendered');
  }
  await expect(value('Grounding')).toHaveText('Off');
  await page.getByRole('checkbox',{name:'shadows',exact:true}).check();
  await expect(value('Shadow map')).toHaveText('Sampled',{timeout:20000});
  await expect(value('Grounding')).toHaveText('Blob footprints');
  await page.getByRole('checkbox',{name:'particles',exact:true}).check();
  await expect(value('Particles')).toHaveText('Rendered',{timeout:15000});
  await expect(panel).not.toContainText('VFX_APP_BINDING_AMBIGUOUS');
  expect(errors).toEqual([]);
});

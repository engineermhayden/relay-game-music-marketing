import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

test('downloaded photographs contain scene pixels across destinations, cameras and the lab',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await mkdir('../artifacts/photographs',{recursive:true});
  for(const [id,name] of [['verdant','The Verdant Expanse'],['ember','Ember Caldera'],['glacier','The Glacial Reach'],['tempest','Tempest Circuit'],['lab','Tempest Circuit']]){
    if(id==='lab'){
      await page.getByRole('button',{name:'Engine lab',exact:true}).first().click();
      await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption('low');
    }else{
      await page.getByRole('button',{name:`Explore ${name}`,exact:true}).click();
      if(id==='glacier')await page.getByRole('button',{name:'Toggle camera'}).click();
    }
    await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
    await page.waitForTimeout(300);
    const downloaded=page.waitForEvent('download',{timeout:15000});
    await page.getByRole('button',{name:'Save photograph',exact:true}).click();
    const download=await downloaded;
    // Check the transient toast before PNG decoding can outlast its lifetime.
    await expect(page.getByRole('status')).toContainText('photograph saved');
    expect(download.suggestedFilename()).toBe(`relay-${id==='lab'?'tempest':id}.png`);
    const file=`../artifacts/photographs/${id}.png`;await download.saveAs(file);
    expect(await download.failure()).toBeNull();
    const bytes=await readFile(file);
    expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    // Decode the actual downloaded PNG, not Playwright's page screenshot.
    const pixels=await page.evaluate(async base64=>{
      const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,160,160);
      const data=ctx.getImageData(0,0,160,160).data,colors=new Set<number>();let bright=0,opaque=0;
      for(let i=0;i<data.length;i+=4){
        if(data[i+3]>250)opaque++;
        if(Math.max(data[i],data[i+1],data[i+2])>45&&data[i+3]>250)bright++;
        colors.add((data[i]>>3)*1024+(data[i+1]>>3)*32+(data[i+2]>>3));
      }
      return {width:image.naturalWidth,height:image.naturalHeight,colors:colors.size,bright,opaque};
    },bytes.toString('base64'));
    expect(pixels.width).toBeGreaterThan(300);expect(pixels.height).toBeGreaterThan(300);
    expect(pixels.colors,'PNG must contain varied scene colors, not a flat clear buffer').toBeGreaterThan(32);
    expect(pixels.bright).toBeGreaterThan(100);expect(pixels.opaque).toBeGreaterThan(24000);
    await test.info().attach(`photograph-${id}`,{body:JSON.stringify(pixels),contentType:'application/json'});
    await expect(page.locator('.renderer-error')).toHaveCount(0);
  }
  // A photo must not leave the game paused or lose its input loop.
  await page.locator('canvas').focus();
  const x=()=>page.evaluate(()=>(globalThis as any).__AURA3D_LIVE_APPS__.all()[0].nodes.require('pilot-0').position[0]);
  const before=await x();await page.keyboard.down('KeyD');await page.waitForTimeout(400);await page.keyboard.up('KeyD');
  await expect.poll(x).toBeGreaterThan(before+.5);
  expect(errors).toEqual([]);
});

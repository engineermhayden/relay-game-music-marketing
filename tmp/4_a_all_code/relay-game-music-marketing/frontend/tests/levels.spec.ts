import { test, expect } from '@playwright/test';
import { levels } from '../src/levels';

test('all four destinations render, switch cleanly, and accept both movement schemes',async({page})=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  for(const level of levels){
    await page.getByRole('button',{name:`Explore ${level.name}`,exact:true}).click();
    await expect(page.locator('.world-heading h2')).toHaveText(level.name);
    await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
    await expect(page.locator('.renderer-error')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>(globalThis as any).__AURA3D_LIVE_APPS__.count())).toBe(1);
    await page.locator('canvas').focus();
    const scroll=await page.evaluate(()=>scrollY);
    const x=()=>page.evaluate(()=>(globalThis as any).__AURA3D_LIVE_APPS__.all()[0].nodes.require('pilot-0').position[0]);
    const start=await x();
    await page.keyboard.down('KeyD');await page.waitForTimeout(350);await page.keyboard.up('KeyD');
    await expect.poll(x).toBeGreaterThan(start+.4);
    await page.keyboard.down('ArrowLeft');await page.waitForTimeout(350);await page.keyboard.up('ArrowLeft');
    await expect.poll(x).toBeLessThan(start+.6);
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(200);await page.keyboard.up('ArrowUp');
    expect(await page.evaluate(()=>scrollY)).toBe(scroll);
    // Unused players/relays must stay clean, not be dirtied once per render frame.
    const version=()=>page.evaluate(()=>{const app=(globalThis as any).__AURA3D_LIVE_APPS__.all()[0];return [app.nodes.require('pilot-1').version,app.nodes.require('beam-0').version];});
    const before=await version();await page.waitForTimeout(350);expect(await version()).toEqual(before);
    await page.screenshot({path:`../artifacts/level-${level.id}.png`,fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

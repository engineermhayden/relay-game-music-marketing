import { test, expect } from '@playwright/test';

test('launches a real network expedition from the React interface',async({page})=>{
  test.skip(!process.env.NETWORK_TESTS,'Requires the running Docker Compose stack.');
  await page.addInitScript(()=>{
    const Native=window.WebSocket;
    (window as any).__sockets=[];
    window.WebSocket=class extends Native {constructor(url:string|URL,protocols?:string|string[]){super(url,protocols);(window as any).__sockets.push(this);}};
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toHaveAttribute('data-ready','true',{timeout:45000});
  await page.getByRole('button',{name:'Launch squad'}).click();
  await page.getByLabel('Pilot callsign').fill('UI verification pilot');
  await page.getByLabel('Squad name').fill('Private UI verification');
  await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('tempest');
  await page.getByLabel('Invite-only expedition').check();
  const created=page.waitForResponse(r=>r.url().endsWith('/api/rooms/')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Launch expedition',exact:true}).click();
  const response=await created;expect(response.status()).toBe(201);
  const {room}=await response.json();
  await expect(page.locator('.connection')).toContainText('connected',{timeout:15000});
  await expect(page.locator('.world-heading')).toContainText('LIVE EXPEDITION');
  await expect(page.locator('.world-heading h2')).toHaveText('Tempest Circuit');
  await page.locator('canvas').focus();
  await page.keyboard.down('KeyD');await page.waitForTimeout(1200);await page.keyboard.up('KeyD');
  await expect.poll(()=>page.evaluate(()=>(globalThis as any).__AURA3D_LIVE_APPS__.all()[0].nodes.require('pilot-0').position[0]),{timeout:10000}).toBeGreaterThan(1);
  // Losing focus must release movement, even if key-up never reaches the page.
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(400);
  const stopped=await (await page.request.get(`/api/rooms/${room.code}/`)).json();
  await page.waitForTimeout(350);
  const stoppedAgain=await (await page.request.get(`/api/rooms/${room.code}/`)).json();
  expect(Math.abs(stopped.state.players[0].x-stoppedAgain.state.players[0].x)).toBeLessThan(.15);
  // Force a transport drop. The same squad/session must reconnect automatically.
  await page.evaluate(()=>(window as any).__sockets.at(-1).close());
  await expect(page.locator('.connection')).toContainText('Reconnecting');
  await expect(page.locator('.connection')).toContainText('connected',{timeout:15000});
  const state=await page.request.get(`/api/rooms/${room.code}/`);
  expect((await state.json()).state.players[0].x).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator('.connection')).toContainText('connected',{timeout:15000});
  await expect(page.locator('.squad-card')).toContainText('Private UI verification');
  await expect(page.locator('.renderer-error')).toHaveCount(0);
  await page.screenshot({path:'../artifacts/relay-network.png',fullPage:true});
});

test('two independent pilots share a room while another squad stays isolated',async({browser})=>{
  test.skip(!process.env.NETWORK_TESTS,'Requires the running Docker Compose stack; set NETWORK_TESTS=1 and BASE_URL.');
  const baseURL=process.env.BASE_URL||'http://127.0.0.1:8080';
  const contexts=await Promise.all([browser.newContext({baseURL}),browser.newContext({baseURL}),browser.newContext({baseURL})]);
  try{
    const clients=await Promise.all(contexts.map(async(c,i)=>{
      const b=await c.request.get('/api/session/');const {csrf}=await b.json();
      const session=await c.request.post('/api/session/',{data:{name:`Pilot ${i+1}`},headers:{'X-CSRFToken':csrf}});expect(session.ok()).toBe(true);
      return await session.json();
    }));
    const first=await contexts[0].request.post('/api/rooms/',{data:{name:'Network test squad',private:true,level:'ember'},headers:{'X-CSRFToken':clients[0].csrf}});expect(first.status()).toBe(201);
    const {room}=await first.json();
    const joined=await contexts[1].request.post('/api/rooms/join/',{data:{code:room.code},headers:{'X-CSRFToken':clients[1].csrf}});expect(joined.ok()).toBe(true);
    const other=await contexts[2].request.post('/api/rooms/',{data:{name:'Isolated test squad',private:true,level:'glacier'},headers:{'X-CSRFToken':clients[2].csrf}});expect(other.ok()).toBe(true);
    const {room:room2}=await other.json();
    const pages=await Promise.all(contexts.map(c=>c.newPage()));
    // Keep the transport test independent of three concurrent GPU renderer startups.
    await Promise.all(pages.map(p=>p.goto('/healthz')));
    await Promise.all(pages.map((p,i)=>p.evaluate(({code})=>new Promise<void>((resolve,reject)=>{const w=window as unknown as {socket:WebSocket;state:any};w.socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/rooms/${code}/`);w.socket.onopen=()=>resolve();w.socket.onerror=()=>reject(new Error('WebSocket failed'));w.socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='state')w.state=m.state;};}),{code:i===2?room2.code:room.code})));
    await pages[0].evaluate(()=>{const w=window as any;w.drive=setInterval(()=>w.socket.send(JSON.stringify({type:'input',x:1,z:0,sprint:false})),100);});
    await expect.poll(()=>pages[1].evaluate((id)=>(window as any).state?.players.find((p:any)=>p.id===id)?.x,clients[0].pilot.id),{timeout:10000}).toBeGreaterThan(1);
    await expect.poll(()=>pages[2].evaluate(()=>(window as any).state?.players.length)).toBe(1);
    expect(await pages[1].evaluate(()=>(window as any).state.level)).toBe('ember');
    expect(await pages[2].evaluate(()=>(window as any).state.level)).toBe('glacier');
    await pages[0].evaluate(()=>{const w=window as any;clearInterval(w.drive);w.socket.send(JSON.stringify({type:'input',x:0,z:0}));});
    await pages[0].waitForTimeout(400);
    const stoppedX=await pages[1].evaluate(id=>(window as any).state.players.find((p:any)=>p.id===id).x,clients[0].pilot.id);
    // A key-up immediately after key-down must survive the server rate limiter.
    await pages[0].evaluate(()=>{const ws=(window as any).socket;ws.send(JSON.stringify({type:'input',x:1,z:0}));ws.send(JSON.stringify({type:'input',x:0,z:0}));});
    await pages[0].waitForTimeout(300);
    const releasedX=await pages[1].evaluate(id=>(window as any).state.players.find((p:any)=>p.id===id).x,clients[0].pilot.id);
    expect(Math.abs(releasedX-stoppedX)).toBeLessThan(.6);
    const spatial=await contexts[0].request.get(`/api/rooms/${room.code}/nearby/`);expect(spatial.ok()).toBe(true);expect((await spatial.json()).landmarks).toHaveLength(3);
    const denied=await contexts[2].request.get(`/api/rooms/${room.code}/`);expect(denied.status()).toBe(403);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

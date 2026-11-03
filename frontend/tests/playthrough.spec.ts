import { test, expect } from '@playwright/test';

test('four independent squads complete every destination through real server inputs',async({browser})=>{
  test.skip(!process.env.NETWORK_TESTS,'Requires Docker Compose.');
  test.setTimeout(240000);
  const baseURL=process.env.BASE_URL||'http://127.0.0.1:8080';
  const contexts=await Promise.all(['verdant','ember','glacier','tempest'].map(()=>browser.newContext({baseURL})));
  try{
    const results=await Promise.all(['verdant','ember','glacier','tempest'].map(async(level,i)=>{
      const context=contexts[i];
      const boot=await (await context.request.get('/api/session/')).json();
      const session=await (await context.request.post('/api/session/',{data:{name:`QA ${level}`},headers:{'X-CSRFToken':boot.csrf}})).json();
      const created=await context.request.post('/api/rooms/',{data:{name:`Playthrough ${level}`,level,private:true},headers:{'X-CSRFToken':session.csrf}});
      expect(created.status()).toBe(201);
      const {room}=await created.json();
      const page=await context.newPage();await page.goto('/healthz');
      const result=await page.evaluate(({code,id})=>new Promise<{status:string;score:number;energy:number;charges:number[];elapsed:number}>((resolve,reject)=>{
        const start=performance.now(),ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/rooms/${code}/`);
        let state:any,lastAction=0,timer:ReturnType<typeof setInterval>;
        const finish=(error?:string)=>{clearInterval(timer);ws.close();if(error)reject(new Error(error));else resolve({status:state.status,score:state.score,energy:state.energy,charges:state.relays.map((r:any)=>r.charge),elapsed:(performance.now()-start)/1000});};
        ws.onerror=()=>finish('WebSocket failed');
        ws.onmessage=e=>{const message=JSON.parse(e.data);if(message.type==='state')state=message.state;};
        ws.onopen=()=>{timer=setInterval(()=>{
          if(performance.now()-start>210000){finish(`Playthrough timed out: ${JSON.stringify({level:state?.level,energy:state?.energy,relays:state?.relays,players:state?.players})}`);return;}
          if(!state)return;
          if(state.status!=='active'){finish();return;}
          const pilot=state.players.find((p:any)=>p.id===id),needed=state.relays.reduce((n:number,r:any)=>n+3-r.charge,0);
          let target:any;
          if(state.energy<needed)target=state.shards.filter((s:any)=>!s.taken).sort((a:any,b:any)=>Math.hypot(a.x-pilot.x,a.z-pilot.z)-Math.hypot(b.x-pilot.x,b.z-pilot.z))[0];
          else target=state.relays.find((r:any)=>r.charge<3)??{x:0,z:0};
          if(!target){finish('Ran out of fragments');return;}
          const dx=target.x-pilot.x,dz=target.z-pilot.z,length=Math.hypot(dx,dz),arrived=length<1.3;
          ws.send(JSON.stringify({type:'input',x:arrived?0:dx/length,z:arrived?0:dz/length,sprint:true}));
          if(arrived&&performance.now()-lastAction>600){ws.send(JSON.stringify({type:'interact'}));lastAction=performance.now();}
        },100);};
      }),{code:room.code,id:session.pilot.id});
      expect(result.status).toBe('won');expect(result.charges).toEqual([3,3,3]);expect(result.score).toBeGreaterThanOrEqual(4150);
      await expect.poll(async()=>{const data=await (await context.request.get(`/api/rooms/${room.code}/`)).json();return data.room.status;}).toBe('won');
      const spatial=await (await context.request.get(`/api/rooms/${room.code}/nearby/`)).json();expect(spatial.landmarks).toHaveLength(3);
      return {level,...result};
    }));
    await test.info().attach('completed-missions',{body:JSON.stringify(results,null,2),contentType:'application/json'});
    console.log('Real-input playthroughs:',JSON.stringify(results));
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

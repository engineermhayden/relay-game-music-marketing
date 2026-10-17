import { camera, createAuraApp, effects, instances, lights, material, model, primitives as p, scene, type AuraSceneNode, type AuraTransformSpec } from '@aura3d/engine';
import type { Metrics, RenderOptions, World } from './types';
import { assets } from './assets';
import { levelFor, heatActive } from './levels';
import { Motion, type MovementInput } from './motion';
import { createCameraControls } from './cameraControls';

const glow=(color:string,intensity=2)=>material.emissive({color,emissive:color,emissiveIntensity:intensity,roughness:.3});
function rng(seed:number){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

export function mountWorld(canvas:HTMLCanvasElement,initial:World,options:RenderOptions,getWorld:()=>World,pilotId:string,onMetrics:(v:Metrics)=>void,onError:(v:string)=>void,getInput:()=>MovementInput) {
  const random=rng(initial.seed),level=levelFor(initial),palette=level.palette;
  const stone=material.pbr({color:palette.ground,roughness:.92,metalness:.1}),dark=material.pbr({color:palette.rock,roughness:.7,metalness:.35}),mint=glow(palette.accent);
  const batches=new Map<string,{material:ReturnType<typeof material.pbr>;transforms:AuraTransformSpec[]}>();
  const box=(key:string,mat:ReturnType<typeof material.pbr>,transform:AuraTransformSpec)=>{if(!batches.has(key))batches.set(key,{material:mat,transforms:[]});batches.get(key)!.transforms.push(transform);};
  const world=scene().background(palette.sky);
  world.add(lights.ambient({intensity:.85,color:'#9fcac6'}));
  world.add(lights.directional({position:[-20,40,10],color:'#e2ffca',intensity:2.6,shadow:options.shadows}));
  world.add(lights.directional({position:[20,12,-30],color:palette.rim,intensity:1.4}));
  if(options.bloom)world.add(effects.bloom({intensity:.38,threshold:.75,radius:.4}));
  if(options.fog)world.add(effects.fog({density:initial.weather==='storm'?.022:.006,color:palette.sky}));
  // All geometry below is authored through Aura3D's public scene API.
  world.add(p.cylinder({name:'island-foundation',size:[51,2.2,51],material:dark}).position(0,-1.5,0));
  world.add(p.cylinder({name:'island-surface',size:[49,.55,49],material:stone,receiveShadow:true}).position(0,-.2,0));
  world.add(p.torus({name:'perimeter',material:glow('#347774',.6)}).rotate(Math.PI/2,0,0).scale([24.5,24.5,.1]).position(0,.05,0));
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    box('island-rim',dark,{position:[Math.cos(a)*22,-3,Math.sin(a)*22],rotation:[.1,a,.15],scale:[8,3+random()*3,7]});
  }
  // Radial paths, inset treads, concentric transmitter rings.
  for(let r=0;r<3;r++){
    const relay=initial.relays[r], length=Math.hypot(relay.x,relay.z);
    box('paths',material.pbr({color:palette.flora,roughness:.7}),{position:[relay.x/2,.1,relay.z/2],rotation:[0,Math.atan2(relay.x,relay.z),0],scale:[1.7,.06,length]});
    for(let j=1;j<8;j++)box('path-treads',glow(palette.accent,.6),{position:[relay.x*j/8,.15,relay.z*j/8],rotation:[0,Math.atan2(relay.x,relay.z),0],scale:[.13,.07,.55]});
  }
  world.add(p.cylinder({name:'landing-pad',size:[6,.22,6],material:material.metal({color:'#50736a',roughness:.45})}).position(0,.14,0));
  for(let i=0;i<3;i++)world.add(p.torus({name:`landing-ring-${i}`,material:i===0?mint:glow('#5c9d83',.7)}).position(0,.3+i*.08,0).rotate(Math.PI/2,0,0).scale([1.4+i*.6,1.4+i*.6,.035]));
  for(const relay of initial.relays){
    world.add(p.cylinder({name:`base-${relay.id}`,size:[5,.6,5],material:dark}).position(relay.x,.3,relay.z));
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      box('relay-pillars',material.metal({color:palette.moon,roughness:.36}),{position:[relay.x+Math.cos(a)*1.3,2.7,relay.z+Math.sin(a)*1.3],rotation:[0,-a,Math.sin(a)*.15],scale:[.6,5,.8]});
    }
    world.add(p.box({name:`core-${relay.id}`,size:[1.25,2.5,1.25],material:glow(palette.accent,1.6)}).position(relay.x,3.4,relay.z).rotate(.1,.8,.15));
    world.add(p.torus({name:`ring-${relay.id}`,material:glow(palette.accent,1.4)}).position(relay.x,3.4,relay.z).rotate(Math.PI/2,0,0).scale([2.1,2.1,.065]));
    world.add(p.cylinder({name:`beam-${relay.id}`,size:[.16,24,.16],material:glow(palette.accent,3)}).position(relay.x,12,relay.z));
  }
  const flora:AuraTransformSpec[]=[], rocks:AuraTransformSpec[]=[];
  for(let i=0;i<170;i++){
    const a=random()*Math.PI*2,r=7+random()*17,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(initial.relays.some(v=>Math.hypot(x-v.x,z-v.z)<4))continue;
    flora.push({position:[x,.15+random()*.5,z],rotation:[random()*.2,random()*6,.2],scale:[.1+random()*.2,.3+random()*.85,.1+random()*.2]});
    if(i%5===0)rocks.push({position:[x,.2,z],rotation:[.2,random()*6,.1],scale:[.5+random(),.3+random(),.5+random()]});
  }
  world.add(instances.box({name:'crystal-meadow',transforms:flora,material:glow(palette.flora,.35)}));
  world.add(instances.box({name:'basalt-scatter',transforms:rocks,material:dark}));
  const stars:AuraTransformSpec[]=Array.from({length:140},()=>({position:[(random()-.5)*160,10+random()*70,-35-random()*50],scale:.035+random()*.12}));
  world.add(instances.sphere({name:'starfield',transforms:stars,material:glow('#c4e9e4',1.5)}));
  world.add(p.sphere({name:'moon',material:material.pbr({color:palette.moon,roughness:1}),size:[11,11,11]}).position(-24,13,-28));
  world.add(p.torus({name:'moon-ring',material:glow('#649f93',.65)}).position(-24,13,-28).rotate(1.1,.2,.35).scale([9,9,.055]));
  for(let i=0;i<18;i++)box('asteroids',dark,{position:[(random()-.5)*100,-8-random()*12,(random()-.5)*100],scale:[2+random()*4,2+random()*3,2+random()*4],rotation:[random(),random(),random()]});
  world.add(instances.box({name:'signal-fragments',material:mint,transforms:initial.shards.map(shard=>({position:[shard.x,1,shard.z],scale:[.45,.9,.45]}))}));
  for(let i=0;i<8;i++){
    world.add(p.capsule({name:`pilot-${i}`,size:[.65,1.2,.65],material:material.ceramic({color:'#dce8d7'})}).position(0,.85,0));
    world.add(p.sphere({name:`helmet-${i}`,size:[.72,.65,.72],material:material.metal({color:'#e3eddc',roughness:.3})}).position(0,1.6,0));
    world.add(p.box({name:`visor-${i}`,size:[.57,.23,.16],material:glow('#b9f36b',1.2)}).position(0,1.63,.3));
    world.add(p.box({name:`pack-${i}`,size:[.5,.65,.3],material:dark}).position(0,.95,-.35));
    world.add(p.torus({name:`pilot-ring-${i}`,material:mint}).rotate(Math.PI/2,0,0).scale([.75,.75,.035]).position(0,.05,0));
  }
  for(let i=0;i<level.sentinelCount;i++){
    world.add(p.sphere({name:`sentinel-${i}`,size:[.7,.7,.7],material:glow('#f49a72',1.6)}));
    world.add(p.torus({name:`sentinel-ring-${i}`,material:material.metal({color:'#c78a71'})}).scale([1,1,.07]).rotate(1.2,0,0));
  }
  world.add(model(assets.ora,{name:'ora'}).animate({clip:'Hover',loop:true}).position(2,2,1).scale(1.4));
  world.add(p.torus({name:'scan-pulse',material:glow('#c8ffab',1.5)}).rotate(Math.PI/2,0,0).position(0,.2,0));
  if(options.particles){
    world.add(effects.particles({name:'signal-dust',maxParticles:100,emissionRate:15,intensity:.5,color:'#b9f36b'}));
    if(initial.weather==='storm')world.add(effects.rain({name:'storm-rain',intensity:.45,density:.4,color:'#88b6ce'}));
  }
  if(options.lab){
    world.add(p.box({name:'physics-floor',size:[9,.3,6],material:material.pbr({color:'#516861'}),physics:{type:'static',shape:'box',halfExtents:[4.5,.15,3]}}).position(0,.6,-7));
    for(let i=0;i<5;i++)world.add(p.sphere({name:`physics-${i}`,size:[1,1,1],material:material[options.material]({color:['#b9f36b','#72cddd','#e5a1c7','#efb87b','#c4cadb'][i],roughness:.2}),physics:{type:'dynamic',shape:'sphere',radius:.5,mass:1,restitution:.85}}).position(-3+i*1.5,4+i*.8,-7));
  }
  // Destination geometry is visually distinct while hazards use the shared catalog.
  for(const [i,zone] of level.zones.entries()){
    world.add(p.cylinder({name:`zone-${i}`,size:[zone.radius*2,.06,zone.radius*2],material:material.pbr({color:zone.kind==='heat'?'#8f4937':'#87bdda',roughness:.3})}).position(zone.x,.14,zone.z));
    world.add(p.torus({name:`zone-ring-${i}`,material:glow(palette.accent,1.6)}).position(zone.x,.22,zone.z).rotate(Math.PI/2,0,0).scale([zone.radius,zone.radius,.035]));
  }
  if(level.id==='ember')world.add(p.cylinder({name:'molten-sea',size:[140,.2,140],material:glow('#dc4b25',.7)}).position(0,-9,0));
  if(level.id==='glacier')for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    box('ice-cathedral',material.ceramic({color:'#91c4e2',roughness:.18}),{position:[Math.cos(a)*23,2,Math.sin(a)*23],scale:[1,3+random()*6,1.4],rotation:[.12,a,.22]});
  }
  if(level.id==='tempest')for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    box('storm-antennae',material.metal({color:'#a99acb',roughness:.3}),{position:[Math.cos(a)*23,3,Math.sin(a)*23],scale:[.25,6,.25],rotation:[0,a,0]});
    box('arc-caps',mint,{position:[Math.cos(a)*23,6,Math.sin(a)*23],scale:[1,.12,1]});
  }
  for(const [name,batch] of batches)world.add(instances.box({name,...batch}));
  world.camera(options.camera==='follow'?camera.follow({targetNode:`pilot-${Math.max(0,initial.players.findIndex(p=>p.id===pilotId))}`,offset:[12,16,18],targetOffset:[0,1,0],fov:46}):camera.perspective({position:[35,33,43],target:[0,1,0],fov:46,far:250}));
  const register=(node:AuraSceneNode):AuraSceneNode=>({...node,...('name' in node&&node.name?{runtime:{id:node.name}}:{}),...(node.kind==='group'?{children:node.children.map(register)}:{})} as AuraSceneNode);
  const snapshot=world.toJSON();
  const app=createAuraApp(canvas,{scene:{...snapshot,nodes:snapshot.nodes.map(register)},renderer:{backend:'webgl2',strictMount:true},pixelRatio:{max:options.quality==='high'?1.5:1},performanceQuality:{resolutionScale:options.quality==='low'?.7:1,particleScale:options.quality==='low'?.5:1,lodBias:1,shadowSize:512},diagnostics:{overlay:false}});
  const navigation=createCameraControls(canvas,options.camera==='follow'?`pilot-${Math.max(0,initial.players.findIndex(p=>p.id===pilotId))}`:undefined);
  let alive=true,frames=0,elapsed=0,last=performance.now(),resolution=options.quality==='low'?.7:1,slowWindows=0;
  const motion=new Motion();
  // Registry lookups attach extensions; resolve once, and avoid dirtying unchanged nodes.
  const pilots=Array.from({length:8},(_,i)=>['pilot','helmet','visor','pack','pilot-ring'].map(part=>app.nodes.require(`${part}-${i}`)));
  const relayNodes=initial.relays.map(r=>['beam','core','ring'].map(part=>app.nodes.require(`${part}-${r.id}`)));
  const sentinelNodes=Array.from({length:level.sentinelCount},(_,i)=>[app.nodes.require(`sentinel-${i}`),app.nodes.require(`sentinel-ring-${i}`)]);
  const zoneRings=level.zones.map((_,i)=>app.nodes.require(`zone-ring-${i}`)),zoneHeat=level.zones.map(()=>false);
  const fragments=app.nodes.require('signal-fragments'),ora=app.nodes.require('ora'),pulse=app.nodes.require('scan-pulse');
  const physics=options.lab?Array.from({length:5},(_,i)=>app.nodes.require(`physics-${i}`)):[];
  const colors=new Map<number,string>();
  const visible=(node:typeof pulse,value:boolean)=>{if(node.visible!==value)node.setVisible(value);};
  const position=(node:typeof pulse,x:number,y:number,z:number)=>{const p=node.position;if(Math.abs(p[0]-x)+Math.abs(p[1]-y)+Math.abs(p[2]-z)>.0001)node.setPosition(x,y,z);};
  const rotation=(node:typeof pulse,x:number,y:number,z:number)=>{const r=node.rotation;if(r[0]!==x||r[1]!==y||r[2]!==z)node.setRotation(x,y,z);};
  app.onFrame(({dt,time})=>{
    if(!alive)return;
    if(options.lab&&dt>0){
      app.physics.step(Math.min(dt,.05));
      physics.forEach((node,i)=>node.setPosition(...app.physics.bodies.require(`physics-${i}`).position()));
    }
    const s=getWorld(),players=motion.sample(s,pilotId,getInput(),dt);
    for(let i=0;i<8;i++){
      const [body,helmet,visor,pack,ring]=pilots[i],player=players[i];
      pilots[i].forEach(node=>visible(node,Boolean(player)));
      if(!player)continue;
      if(colors.get(i)!==player.color){body.setMaterial(material.ceramic({color:player.color}));ring.setMaterial(glow(player.color,1));colors.set(i,player.color);}
      position(body,player.x,.9,player.z);rotation(body,0,player.yaw,0);
      position(helmet,player.x,1.65,player.z);
      position(visor,player.x+Math.sin(player.yaw)*.3,1.68,player.z+Math.cos(player.yaw)*.3);rotation(visor,0,player.yaw,0);
      position(pack,player.x-Math.sin(player.yaw)*.35,1,player.z-Math.cos(player.yaw)*.35);rotation(pack,0,player.yaw,0);
      position(ring,player.x,.12,player.z);
    }
    const activeShards=s.shards.filter(shard=>!shard.taken);
    visible(fragments,activeShards.length>0);
    if(activeShards.length)fragments.setInstances(activeShards.map(shard=>({position:[shard.x,1+Math.sin(time*2+shard.id)*.23,shard.z],rotation:[.3,time*.7+shard.id,.5],scale:[.45,.9,.45]})));
    s.relays.forEach((relay,i)=>{
      const [beam,core,ring]=relayNodes[i];visible(beam,relay.charge===3);
      core.setRotation(.15,time*.22+relay.id,.1);ring.setRotation(Math.PI/2+Math.sin(time*.4)*.15,time*.3,0);
    });
    // Sentinel orbits are deterministic; sampling at render time avoids 10 Hz hopping.
    if(s!==lastState){lastState=s;lastStateTime=performance.now();}
    const orbit=(s.now-s.started)+(pilotId==='preview'?0:Math.min(.15,(performance.now()-lastStateTime)/1000));
    sentinelNodes.forEach(([node,ring],i)=>{
      const angle=orbit*level.sentinelSpeed+i*Math.PI*2/level.sentinelCount,x=Math.cos(angle)*level.sentinelRadius,z=Math.sin(angle)*level.sentinelRadius,y=1.2+Math.sin(time*2+i)*.3;
      node.setPosition(x,y,z);ring.setPosition(x,y,z).setRotation(1.2,time*.5,.2);
    });
    zoneRings.forEach((ring,i)=>{const hot=level.zones[i].kind==='heat'&&heatActive(s);if(zoneHeat[i]!==hot){zoneHeat[i]=hot;ring.setScale([level.zones[i].radius,level.zones[i].radius,hot?.12:.035]);}});
    const me=players.find(p=>p.id===pilotId)??players[0],target=s.companion==='scout'?s.relays[s.waypoint]:s.companion==='guard'?{x:0,z:0}:me;
    if(target)ora.setPosition(target.x+2,2.5+Math.sin(time*1.5)*.2,target.z+1).setRotation(0,time*.4,0);
    if(me){const scan=Math.max(0,me.scan-s.now);visible(pulse,scan>0);if(scan>0)pulse.setPosition(me.x,.24,me.z).setScale([1+(4-scan)*4,1+(4-scan)*4,.025]);}
    frames++;elapsed+=dt;
    if(performance.now()-last>1000){
      const fps=frames/Math.max(.01,elapsed),d=app.diagnostics();const renderer=d.renderer as unknown as {bloom?:{rendered?:boolean};fog?:{enabled?:boolean};shadows?:{mapRendered?:boolean};runtime?:{nativeInstancedSubmissions?:number};warnings?:string[]};
      // Adapt only after sustained pressure, and never rebuild the scene to change resolution.
      slowWindows=fps<38?slowWindows+1:0;
      if(options.quality==='auto'&&slowWindows>=3&&resolution>.7){resolution=Math.max(.7,resolution-.15);slowWindows=0;queueMicrotask(()=>{if(alive)app.setPerformanceQuality({resolutionScale:resolution,particleScale:resolution,lodBias:1,shadowSize:512});});}
      onMetrics({fps:Math.round(fps),frameMs:Math.round(elapsed/frames*1000),resolution,draws:d.drawCalls??0,backend:String(d.backend),triangles:Number((d as unknown as Record<string,unknown>).triangles??0),errors:(d.errors??[]).map(String),evidence:{bloom:renderer?.bloom?.rendered===true,fog:renderer?.fog?.enabled===true,shadowMap:renderer?.shadows?.mapRendered===true,instancedSubmissions:renderer?.runtime?.nativeInstancedSubmissions??0,animatedAssets:ora.importedAssetEvidence()?.clips.length??0,warnings:[...(d.warnings??[]).map(String),...(renderer?.warnings??[])]}});frames=0;elapsed=0;last=performance.now();
    }
  });
  let lastState=initial,lastStateTime=performance.now();
  void app.ready().then(()=>{if(!alive)return;if(!app.camera)throw new Error('Aura3D camera controller is unavailable.');app.camera.use(navigation.rig);const d=app.diagnostics();if(d.errors?.length)onError(d.errors.map(String).join('; '));canvas.dataset.ready='true';}).catch(e=>{if(alive)onError(String(e));});
  const screenshot=async()=>{
    await app.ready();
    if(!alive||app.deviceLost()||canvas.dataset.ready!=='true')throw new Error('The scene is unavailable. Wait for it to finish loading and try again.');
    // WebGL may discard the drawing buffer after presentation. Render and read
    // back in the same task, with no await between them. A zero-delta step keeps
    // game time unchanged and avoids preserving the buffer on every live frame.
    app.step(0);
    return app.screenshot();
  };
  return {app,navigation,dispose:()=>{alive=false;navigation.dispose();app.dispose();},screenshot,impulse:()=>{for(let i=0;i<5;i++)app.physics.bodies.get(`physics-${i}`)?.applyImpulse([0,5+i,0]);}};
}
export type WorldRuntime=ReturnType<typeof mountWorld>;

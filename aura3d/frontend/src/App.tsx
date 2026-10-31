import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, AudioLines, Bot, Check, ChevronRight, CircleHelp, Compass, Copy, Cpu, Crosshair, FlaskConical, Globe2, Layers3, LoaderCircle, MapPin, Maximize2, Moon, Radio, RotateCcw, Send, Shield, Sparkles, Sun, Trophy, Users, Volume2, VolumeX, Waves, X, Zap, Camera, ZoomIn, ZoomOut } from 'lucide-react';

import { api, setCsrf } from './api';

import { previewAction, previewWorld, stepPreview } from './preview';

import { mountWorld, type WorldRuntime } from './scene';

import { Soundscape } from './audio';

import { levels, levelFor, heatActive } from './levels';

import { readMovement, type MovementInput } from './motion';

import type { AIPlan, Metrics, RenderOptions, Room, Session, World } from './types';



const initialOptions:RenderOptions={bloom:true,fog:true,particles:true,shadows:true,camera:'overview',quality:'auto',lab:false,material:'ceramic'};

const capabilityRows=[

  ['Scene graph','Typed, composable primitives and groups build the entire expedition.','Aura3D'],

  ['PBR materials','Metal, ceramic, glass and emissive surfaces. Switch samples in the lab.','Aura3D'],

  ['Lighting & shadows','Directional key and rim lights, ambient fill, and cast shadows.','Aura3D'],

  ['Post processing','Bloom, atmospheric fog, and native spark / rain emitters.','Aura3D'],

  ['GPU instancing','Crystal meadows, rock scatter and a 140-star sky use instance batches.','Aura3D'],

  ['GLB & animation','ORA is an original typed GLB asset with a native Hover animation.','Aura3D'],

  ['Physics','The lab drops five dynamic bodies onto a static platform. Relaunch with an impulse.','Aura3D'],

  ['Camera & diagnostics','Overview and follow cameras, live draw calls, FPS, screenshots.','Aura3D'],

  ['AI world direction','Claude chooses validated weather, companion behavior, and waypoints.','Anthropic + app'],

  ['Network game','An authoritative 10 Hz simulation, room isolation, presence, and reconnect.','Django + Redis'],

  ['Spatial persistence','Indexed landmarks, proximity queries, mission snapshots and leaderboards.','PostGIS'],

];



const Viewport=memo(function Viewport({worldRef,pilotId,options,weather,seed,levelId,onMetrics,onError,runtimeRef,getInput}:{worldRef:React.RefObject<World>;pilotId:string;options:RenderOptions;weather:string;seed:number;levelId:string;getInput:()=>MovementInput;onMetrics:(v:Metrics)=>void;onError:(v:string)=>void;runtimeRef:React.RefObject<WorldRuntime|null>}){

  const canvas=useRef<HTMLCanvasElement>(null);

  useEffect(()=>{

    if(!canvas.current)return;

    canvas.current.dataset.ready='false';

    try{const runtime=mountWorld(canvas.current,worldRef.current,options,()=>worldRef.current,pilotId,onMetrics,onError,getInput);runtimeRef.current=runtime;return()=>{runtime.dispose();runtimeRef.current=null;};}catch(e){onError(`Renderer: ${String(e)}`);}

  },[options,weather,seed,levelId,pilotId,onMetrics,onError,worldRef,runtimeRef,getInput]);

  return <canvas ref={canvas} className="world-canvas" aria-label="Interactive Aura3D alien expedition world" tabIndex={0}/>;

});



export function App(){

  const [world,setWorld]=useState<World>(()=>previewWorld());

  const worldRef=useRef(world);const runtimeRef=useRef<WorldRuntime|null>(null);

  const [session,setSession]=useState<Session|null>(null),[room,setRoom]=useState<Room|null>(null),[rooms,setRooms]=useState<Room[]>([]),[scores,setScores]=useState<Room[]>([]);

  const [connected,setConnected]=useState(false),[latency,setLatency]=useState(0),[apiReady,setApiReady]=useState(false);

  const [options,setOptions]=useState(initialOptions),[metrics,setMetrics]=useState<Metrics>({fps:0,draws:0,backend:'initializing',triangles:0,errors:[]});

  const [modal,setModal]=useState<'launch'|'join'|'help'|'capabilities'|'scores'|null>(null),[name,setName]=useState(localStorage.getItem('relay:name')||'Explorer'),[squadName,setSquadName]=useState('The first signal'),[privateRoom,setPrivateRoom]=useState(false),[joinCode,setJoinCode]=useState(new URLSearchParams(location.search).get('room')||'');

  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[renderError,setRenderError]=useState(''),[aiBusy,setAiBusy]=useState(false),[prompt,setPrompt]=useState(''),[sound,setSound]=useState(false);

  const [nearby,setNearby]=useState<{name:string;distance:number}[]|null>(null);
  const [capturing,setCapturing]=useState(false);

  const socket=useRef<WebSocket|null>(null),keys=useRef(new Set<string>()),soundscape=useRef(new Soundscape());

  const [selectedLevel,setSelectedLevel]=useState('verdant');

  const level=levelFor(world);

  const getInput=useCallback(()=>readMovement(keys.current),[]);

  const pilotId=session?.pilot?.id&&room?session.pilot.id:'preview';

  const me=world.players.find(p=>p.id===pilotId)??world.players[0];

  const completed=world.relays.filter(r=>r.charge===3).length;

  const remaining=Math.max(0,Math.ceil(world.duration-(world.now-world.started)));

  const updateWorld=useCallback((next:World)=>{const previous=worldRef.current;worldRef.current=next;if(next.seed!==previous.seed||next.level!==previous.level||next.status!==previous.status)setWorld(next);},[]);

  const notify=useCallback((message:string)=>{setNotice(message);},[]);

  useEffect(()=>{const id=setInterval(()=>setWorld({...worldRef.current}),150);return()=>clearInterval(id);},[]);

  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(id);},[notice]);

  useEffect(()=>{

    void api<Session>('session/').then(async s=>{setSession(s);setCsrf(s.csrf);setApiReady(true);const saved=localStorage.getItem('relay:room');if(saved&&s.pilot&&!joinCode){try{const resumed=await api<{room:Room;state:World}>(`rooms/${saved}/`);setRoom(resumed.room);updateWorld(resumed.state);}catch{localStorage.removeItem('relay:room');}}}).catch(()=>setApiReady(false));

    void api<Room[]>('rooms/').then(setRooms).catch(()=>{});

    if(joinCode)setModal('join');

    return()=>{soundscape.current.dispose();};

  },[]);

  useEffect(()=>{if(!apiReady)return;const id=setInterval(()=>void api<Room[]>('rooms/').then(setRooms).catch(()=>{}),15000);return()=>clearInterval(id);},[apiReady]);

  useEffect(()=>{

    if(!room)return;

    let active=true,timer:ReturnType<typeof setTimeout>,attempt=0;

    const connect=()=>{

      const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/rooms/${room.code}/`);socket.current=ws;

      ws.onopen=()=>{if(!active){ws.close();return;}setConnected(true);attempt=0;};

      ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='state')updateWorld(m.state);if(m.type==='notice'||m.type==='error')notify(m.message);if(m.type==='pong')setLatency(Math.round(performance.now()-m.at));}catch{notify('A network message could not be read.');}};

      ws.onclose=e=>{setConnected(false);if(active){if(e.code===4403){setError('Session expired or squad access denied. Join the squad again.');return;}timer=setTimeout(connect,Math.min(10000,1000*2**attempt++));}};

      ws.onerror=()=>ws.close();

    };

    connect();const ping=setInterval(()=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'ping',at:performance.now()}));},3000);

    return()=>{active=false;clearTimeout(timer);clearInterval(ping);socket.current?.close();socket.current=null;};

  },[room?.code,updateWorld,notify]);

  const doAction=useCallback((kind:string)=>{

    soundscape.current.cue(kind);

    if(room){if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:kind}));else notify('Reconnecting to the squad…');}

    else{notify(previewAction(worldRef.current,kind));updateWorld({...worldRef.current});}

  },[room,notify,updateWorld]);

  const sendInput=useCallback(()=>{

    if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:'input',...getInput()}));

  },[getInput]);

  useEffect(()=>{

    const down=(e:KeyboardEvent)=>{

      if((e.target as HTMLElement).closest('input,textarea,select')||modal)return;

      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();

      if(!keys.current.has(e.code)){keys.current.add(e.code);sendInput();}

      if(!e.repeat&&e.code==='KeyE')doAction('interact');if(!e.repeat&&e.code==='KeyQ')doAction('scan');

    };

    const up=(e:KeyboardEvent)=>{keys.current.delete(e.code);sendInput();};

    const clear=()=>{keys.current.clear();sendInput();};

    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);

    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};

  },[doAction,modal,sendInput]);

  useEffect(()=>{

    if(room){const id=setInterval(sendInput,100);return()=>clearInterval(id);}

    let frame=0,last=performance.now();

    const tick=(now:number)=>{const dt=Math.min(.05,(now-last)/1000);last=now;const {x,z,sprint}=getInput();stepPreview(worldRef.current,x,z,sprint,dt);frame=requestAnimationFrame(tick);};

    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);

  },[room,getInput,sendInput]);

  useEffect(()=>{if(modal){keys.current.clear();sendInput();}},[modal,sendInput]);

  async function launch(join=false){

    setBusy(true);setError('');

    try{

      const bootstrap=await api<Session>('session/');setCsrf(bootstrap.csrf);

      const s=await api<Session>('session/',{name});setSession(s);setCsrf(s.csrf);setApiReady(true);localStorage.setItem('relay:name',name);

      const result=await api<{room:Room;state:World}>(join?'rooms/join/':'rooms/',join?{code:joinCode.trim().toUpperCase()}:{name:squadName,private:privateRoom,level:selectedLevel});

      updateWorld(result.state);setRoom(result.room);localStorage.setItem('relay:room',result.room.code);setModal(null);setNearby(null);notify(`Expedition ${result.room.code} joined. Share your invite to bring your squad.`);

    }catch(e){setError((e as Error).message);}finally{setBusy(false);}

  }

  async function ask(text=prompt){

    if(!text.trim()||aiBusy)return;setPrompt('');setAiBusy(true);

    if(!room){notify('Launch a network expedition to talk to Claude. Local preview does not make paid API calls.');setAiBusy(false);return;}

    try{await api<AIPlan>(`rooms/${room.code}/ai/`,{prompt:text});soundscape.current.cue('scan');}catch(e){notify((e as Error).message);}finally{setAiBusy(false);}

  }

  async function copyInvite(){const url=new URL(location.href);url.searchParams.set('room',room!.code);try{await navigator.clipboard.writeText(url.toString());notify('Squad invite copied. Open it on another browser or device.');}catch{notify(`Squad code: ${room!.code}`);}}

  async function screenshot(){
    if(capturing)return;
    setCapturing(true);
    try{
      const runtime=runtimeRef.current;
      if(!runtime)throw new Error('The scene is still loading. Try again in a moment.');
      const shot=await runtime.screenshot();
      const a=document.createElement('a');a.href=shot.dataUrl;a.download=`relay-${level.id}.png`;
      document.body.appendChild(a);a.click();a.remove();
      notify('Expedition photograph saved.');
    }catch(e){notify(`Capture unavailable: ${(e as Error).message}`);}
    finally{setCapturing(false);}
  }

  async function survey(){if(!room){setNearby(world.relays.map(r=>({name:r.name,distance:Math.round(Math.hypot(r.x-me.x,r.z-me.z)*10)/10})));return;}try{const data=await api<{landmarks:{name:string;distance:number}[]}>(`rooms/${room.code}/nearby/`);setNearby(data.landmarks);}catch(e){notify((e as Error).message);}}

  function explore(id:string){setRenderError('');setSelectedLevel(id);if(room){setError('');setModal('launch');}else{keys.current.clear();updateWorld(previewWorld(id));setNearby(null);}}

  const option=(key:keyof RenderOptions,value:unknown)=>{setRenderError('');setOptions(prev=>({...prev,[key]:value}));};

  const openModal=(kind:typeof modal)=>{setError('');setModal(kind);if(kind==='scores')void api<Room[]>('leaderboard/').then(setScores).catch(()=>setScores([]));};

  return <div className="app-shell">

    <nav className="rail" aria-label="Main navigation"><a className="brand-mark" href="/" aria-label="RELAY home"><Radio size={27}/></a><div className="rail-links"><button className={!options.lab?'active':''} title="Expedition" aria-label="Expedition" onClick={()=>option('lab',false)}><Compass/></button><button className={options.lab?'active':''} title="Engine lab" aria-label="Engine lab" onClick={()=>option('lab',true)}><FlaskConical/></button><button title="Squads" aria-label="Join a squad" onClick={()=>openModal('join')}><Users/></button><button title="Leaderboard" aria-label="Leaderboard" onClick={()=>openModal('scores')}><Trophy/></button></div><div className="rail-bottom"><button title="Capabilities" aria-label="Capabilities" onClick={()=>openModal('capabilities')}><Layers3/></button><button title="How to play" aria-label="How to play" onClick={()=>openModal('help')}><CircleHelp/></button><span className="avatar">{name.slice(0,1).toUpperCase()}</span></div></nav>

    <div className="workspace">

      <header className="topbar"><div className="wordmark">RELAY<span>AN AURA3D EXPEDITION</span></div><nav className="top-tabs"><button className={!options.lab?'selected':''} onClick={()=>option('lab',false)}>Mission control</button><button className={options.lab?'selected':''} onClick={()=>option('lab',true)}>Engine lab <span>LAB</span></button></nav><div className="top-actions"><span className={`connection ${connected?'live':''}`}><i/>{room?(connected?`${latency} ms · connected`:'Reconnecting…'):'Local preview'}</span><button className="button small" onClick={()=>openModal('launch')}><Users size={15}/> Launch squad <ArrowUpRight size={15}/></button></div></header>

      <main>

        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot"/> SECTOR {level.sector}</div><h1>{options.lab?'Under the surface.':'A signal worth finding.'}</h1><p>{options.lab?'A live playground for the systems behind your expedition.':'An uncharted world. A shared mission. A hello to the universe.'}</p></div><div className="heading-meta"><span><Globe2 size={15}/> PROCEDURAL WORLD</span><strong>SEED {world.seed.toString().padStart(6,'0')}</strong></div></div>

        <section className="destination-strip" aria-label="Expedition destinations">{levels.map((destination,i)=><button key={destination.id} className={level.id===destination.id?'destination active':'destination'} style={{'--destination-color':destination.palette.accent} as React.CSSProperties} aria-label={`Explore ${destination.name}`} aria-pressed={level.id===destination.id} onClick={()=>explore(destination.id)}><span className="destination-number">0{i+1}</span><span><strong>{destination.name}</strong><small>{destination.difficulty} · {destination.duration/60} MIN</small></span><ArrowUpRight size={15}/></button>)}</section>

        <div className="mission-layout">

          <section className="viewport-panel" aria-label="Game viewport">

            <Viewport worldRef={worldRef} pilotId={pilotId} options={options} weather={world.weather} seed={world.seed} levelId={level.id} getInput={getInput} onMetrics={setMetrics} onError={setRenderError} runtimeRef={runtimeRef}/>

            <div className="viewport-vignette"/>

            <div className="world-heading"><span className="tag"><span className="live-dot"/>{room?'LIVE EXPEDITION':'EXPLORATION SANDBOX'}</span><h2>{level.name}</h2><p><MapPin size={12}/> 47.28° N &nbsp; 09.41° E <span>FICTIONAL SECTOR</span></p></div>

            <div className="world-tools"><button title="Save photograph" aria-label="Save photograph" disabled={capturing} aria-busy={capturing} onClick={()=>void screenshot()}>{capturing?<LoaderCircle className="spin" size={17}/>:<Camera size={17}/>}</button><button title="Toggle sound" aria-label="Toggle sound" onClick={()=>void soundscape.current.toggle().then(setSound)}>{sound?<Volume2 size={17}/>:<VolumeX size={17}/>}</button><button title="Toggle overview / follow" aria-label="Toggle camera" aria-pressed={options.camera==='follow'} onClick={()=>option('camera',options.camera==='overview'?'follow':'overview')}><Maximize2 size={17}/></button><button title="Zoom in" aria-label="Zoom in" onClick={()=>runtimeRef.current?.navigation.zoomIn()}><ZoomIn size={17}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>runtimeRef.current?.navigation.zoomOut()}><ZoomOut size={17}/></button><button title="Reset view" aria-label="Reset view" onClick={()=>runtimeRef.current?.navigation.reset()}><RotateCcw size={17}/></button></div>

            <div className="camera-hint"><span>Drag to orbit</span><span>Scroll to zoom</span><span>Right-drag to pan</span><small>One finger: orbit / Two fingers: pan + zoom</small></div><div className="compass-label"><span>N</span><div/> <span>S</span></div>

            <div className="world-badge"><span className="orbit-icon">◎</span><div><strong>{world.weather==='storm'?'ION STORM':world.weather==='clear'?'CLEAR SKIES':'AURORA SEASON'}</strong><span>{world.weather==='storm'?'Sentinel interference elevated':'Atmospheric conditions stable'}</span></div></div>

            {renderError&&<div className="renderer-error"><Cpu/><strong>Renderer needs attention</strong><p>{renderError.slice(0,260)}</p><button onClick={()=>{option('quality','low');}}>Try low resolution</button></div>}

            {world.status!=='active'&&<div className="completion"><span className="eyebrow">EXPEDITION COMPLETE</span><h2>{world.status==='won'?'Hello, universe.':'The signal faded.'}</h2><p>{world.status==='won'?'Three relays. One squad. First contact.':'Every expedition is a new beginning. Try again with your squad.'}</p><strong>{world.score.toLocaleString()} <small>POINTS</small></strong><button className="button" onClick={()=>{setSelectedLevel(levels[(levels.findIndex(l=>l.id===level.id)+1)%levels.length].id);openModal('launch');}}>Choose the next destination <ArrowUpRight size={17}/></button></div>}

            <div className="viewport-bottom"><div className="pilot-status"><span className="pilot-orb"/><div><strong>{me?.name||'Explorer'}</strong><span><Shield size={11}/> {Math.round(me?.shield??100)}% shield</span></div></div><div className="coordinate"><span>POSITION</span><strong>{me?.x.toFixed(1)} <small>/</small> {me?.z.toFixed(1)}</strong></div><button className="scan-button" onClick={()=>doAction('scan')}><Crosshair size={17}/> Survey pulse <kbd>Q</kbd></button></div>

            <div className="touch-controls"><div className="dpad">{[['KeyW',ArrowUp],['KeyA',ArrowLeft],['KeyS',ArrowDown],['KeyD',ArrowRight]].map(([key,Icon])=>{const I=Icon as typeof ArrowUp;return <button key={key as string} aria-label={`Move ${key}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(key as string);sendInput();}} onPointerUp={()=>{keys.current.delete(key as string);sendInput();}} onPointerCancel={()=>{keys.current.delete(key as string);sendInput();}}><I size={18}/></button>;})}</div><button onClick={()=>doAction('interact')}>Interact <kbd>E</kbd></button></div>

          </section>

          <aside className="mission-sidebar">

            <section className="brief panel"><div className="section-label"><span><Radio size={14}/> THE MISSION</span><span>{level.difficulty.toUpperCase()}</span></div><h2>Bring the world<br/>back online.</h2><p>{level.description}</p><div className="level-rule"><strong>{level.id==='ember'?(heatActive(world)?'HEAT ACTIVE - KEEP CLEAR':'VENTS COOLING - CROSS NOW'):'FIELD CONDITIONS'}</strong><p>{level.rule}</p></div><div className="mission-stats"><div><strong>{String(completed).padStart(2,'0')}<small>/ 03</small></strong><span>RELAYS ONLINE</span></div><div><strong>{Math.floor(remaining/60)}<small>:{String(remaining%60).padStart(2,'0')}</small></strong><span>SIGNAL WINDOW</span></div></div><div className="objective-list">{world.relays.map((r,i)=><div key={r.id} className={r.charge===3?'done':''}><span className="objective-icon">{r.charge===3?<Check size={14}/>:String(i+1).padStart(2,'0')}</span><div><strong>{r.name}</strong><span>{r.charge===3?'Signal restored':`${r.charge} / 3 cells installed`}</span></div><div className="charge-dots">{[0,1,2].map(n=><i key={n} className={n<r.charge?'filled':''}/>)}</div></div>)}</div><div className="energy-bar"><span><Zap size={14}/> Shared energy</span><strong>{world.energy} <small>CELLS</small></strong></div></section>

            <section className="ora panel"><div className="section-label"><span><Sparkles size={14}/> ORA / MISSION INTELLIGENCE</span><span className="ai-dot"/></div><div className="ora-message"><div className="ora-avatar"><Bot size={23}/></div><div><strong>There’s more out here.</strong><p>{aiBusy?'Reading the signal. Recalculating our next move…':world.ai.message}</p></div></div><div className="ai-source"><span className="tiny-dot"/>{aiBusy?'CONTACTING CLAUDE':world.ai.source==='anthropic'?`CLAUDE · ${world.ai.companion.toUpperCase()}`:'LOCAL GUIDANCE'}{world.ai.reason&&<span title={world.ai.reason}> · FALLBACK</span>}</div><div className="prompt-chips"><button disabled={aiBusy} onClick={()=>void ask('What should our squad do next?')}>Next move <ChevronRight size={12}/></button><button disabled={aiBusy} onClick={()=>void ask('Create an ion storm and send ORA to scout the next relay. Describe the scene.')}>Summon a storm <Waves size={12}/></button></div><form className="ai-input" onSubmit={e=>{e.preventDefault();void ask();}}><input aria-label="Message ORA" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={600} placeholder="Ask ORA, or reshape the atmosphere…"/><button aria-label="Send to ORA" disabled={aiBusy||!prompt.trim()}>{aiBusy?<LoaderCircle className="spin" size={16}/>:<Send size={16}/>}</button></form></section>

          </aside>

        </div>

        <div className="underworld"><div className="controls-legend"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>SHIFT</kbd> Sprint</span><button onClick={()=>doAction('interact')}><kbd>E</kbd> Collect / install</button><span><kbd>Q</kbd> Scan</span></div><div className="engine-status"><span className="live-dot"/><strong>AURA3D</strong><span>{metrics.backend.toUpperCase()}</span><b title={`${metrics.frameMs??0} ms/frame · ${Math.round((metrics.resolution??1)*100)}% render scale`}>{metrics.fps} FPS</b><span>{metrics.draws} draws</span></div></div>

        {options.lab?<section className="lab-panel panel"><div><div className="eyebrow">THE ENGINE, EXPOSED</div><h2>Change something. See it happen.</h2><p>Native Aura3D rendering and physics. Gameplay authority stays on the server.</p></div><div className="lab-controls">{(['bloom','fog','particles','shadows'] as const).map(k=><label key={k} className="toggle-label"><span>{k}</span><input type="checkbox" checked={options[k]} onChange={e=>option(k,e.target.checked)}/><i/></label>)}<label className="select-label">Material <select value={options.material} onChange={e=>option('material',e.target.value)}><option>ceramic</option><option>metal</option><option>glass</option></select></label><label className="select-label">Resolution <select value={options.quality} onChange={e=>option('quality',e.target.value)}><option value="auto">Adaptive</option><option value="high">High</option><option value="low">Low</option></select></label><button className="button secondary" onClick={()=>{try{runtimeRef.current?.impulse();}catch(e){notify(String(e));}}}><ArrowUp size={16}/> Physics impulse</button><button className="text-button" onClick={()=>openModal('capabilities')}>Capability atlas <ArrowUpRight size={15}/></button></div></section>:<section className="bottom-grid"><div className="squad-card panel"><div className="card-icon"><Users size={22}/></div><div><span className="eyebrow">BETTER, TOGETHER</span><h3>{room?room.name:'One world. Your whole squad.'}</h3><p>{room?`${world.players.filter(p=>p.connected).length} pilots connected · room ${room.code}`:'Up to 8 explorers per expedition. Multiple squads, separate worlds.'}</p></div><button className="round-arrow" aria-label={room?'Copy invite':'Join expedition'} onClick={()=>room?void copyInvite():openModal('join')}>{room?<Copy size={18}/>:<ArrowUpRight size={20}/>}</button></div><div className="score-card panel"><div className="card-icon"><Zap size={22}/></div><div><span className="eyebrow">EXPEDITION SCORE</span><strong>{world.score.toLocaleString().padStart(4,'0')}</strong></div><button className="text-button" onClick={()=>openModal('scores')}>Leaderboard <ArrowUpRight size={14}/></button></div><div className="survey-card panel"><div className="card-icon"><MapPin size={22}/></div><div><span className="eyebrow">SPATIAL INTELLIGENCE</span><h3>{nearby?`${nearby[0]?.name??'No landmarks'}`:'Know your surroundings.'}</h3><p>{nearby?`${nearby[0]?.distance??0}m away · ${room?'PostGIS proximity query':'local preview distance'}`:'Discover nearby relays with spatial queries.'}</p></div><button className="round-arrow" aria-label="Query nearby landmarks" onClick={()=>void survey()}><Crosshair size={19}/></button></div></section>}

        {options.lab&&metrics.evidence&&<details className="diagnostic-panel"><summary><Activity size={14}/> Live renderer evidence <span>Reported by Aura3D</span></summary><div className="evidence-grid"><span>Bloom pass <b>{metrics.evidence.bloom?'Rendered':'Not reported'}</b></span><span>Fog <b>{metrics.evidence.fog?'Enabled':'Off'}</b></span><span>Shadow map <b>{metrics.evidence.shadowMap?'Rendered':'Not reported'}</b></span><span>Instanced submissions <b>{metrics.evidence.instancedSubmissions}</b></span><span>GLB animation clips <b>{metrics.evidence.animatedAssets}</b></span></div><p>These are runtime reports, not a claim of visual parity. A requested feature may be unavailable on this renderer path.</p><ul>{metrics.evidence.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}

        <footer><span>BUILT TO EXPLORE. POWERED BY <strong>AURA3D.</strong></span><button onClick={()=>openModal('capabilities')}>Explore the technology <ArrowUpRight size={13}/></button><span>POWERED BY <strong>HAYDEN-FISHER TECHNOLOGIES, INC.</strong></span><span>RELAY / EXPERIMENT 001</span></footer>

      </main>

    </div>

    {notice&&<div className="toast" role="status"><Radio size={17}/><span>{notice}</span><button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={15}/></button></div>}

    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><section className={`modal ${modal==='capabilities'?'wide':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={()=>setModal(null)}><X size={20}/></button>

      {(modal==='launch'||modal==='join')&&<><span className="eyebrow">MAKE CONTACT</span><h2 id="modal-title">{modal==='launch'?'Your expedition begins here.':'Find your people.'}</h2><p>One to eight pilots. Four destinations. One shared mission.</p><form onSubmit={e=>{e.preventDefault();void launch(modal==='join');}}><label>Pilot callsign<input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={24} required/></label>{modal==='launch'?<><label>Squad name<input value={squadName} onChange={e=>setSquadName(e.target.value)} maxLength={48} required/></label><label>Destination<select aria-label="Destination" value={selectedLevel} onChange={e=>setSelectedLevel(e.target.value)}>{levels.map(l=><option value={l.id} key={l.id}>{l.name} · {l.difficulty} · {l.duration/60} min</option>)}</select></label><p className="destination-hint">{levels.find(l=>l.id===selectedLevel)?.rule}</p><label className="check-label"><input type="checkbox" checked={privateRoom} onChange={e=>setPrivateRoom(e.target.checked)}/> Invite-only expedition</label></>:<label>Squad code<input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="ABC234" minLength={6} maxLength={6} required/></label>}{error&&<p className="form-error" role="alert">{error}</p>}<button className="button full" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Radio size={17}/>} {busy?'Establishing uplink…':modal==='launch'?'Launch expedition':'Join expedition'}</button></form>{modal==='join'&&<div className="room-list"><div className="section-label">OPEN EXPEDITIONS</div>{rooms.length?rooms.map(r=><button key={r.code} onClick={()=>setJoinCode(r.code)}><span>{r.name}<small>{r.code} · {levelFor(r).name}</small></span><span>{r.players}/8 <ChevronRight size={14}/></span></button>):<p>No public squads yet. Be the first to launch one.</p>}<button className="text-button" onClick={()=>setModal('launch')}>Create a new squad <ArrowUpRight size={14}/></button></div>}{!apiReady&&<div className="connection-note">Network play needs the Docker services. Run <code>docker compose up --build -d</code>, then launch your squad here. The 3D preview works independently.</div>}</>}

      {modal==='help'&&<><span className="eyebrow">FIELD MANUAL</span><h2 id="modal-title">A small hello.<br/>A very big universe.</h2><p>Explore alone or invite up to seven friends. Each squad has an independent, server-authoritative world.</p><ol className="manual"><li><strong>Look around.</strong> Left-drag to orbit, right-drag or Shift-drag to pan, and scroll to zoom. On touchscreens, drag with one finger or pan and pinch with two. Use the zoom buttons or Reset view at any time. Camera controls also work in follow mode.</li><li><strong>Recover fragments.</strong> Move with WASD or the arrow keys. Press E near a glowing crystal. Shift sprints; Q reveals a survey pulse.</li><li><strong>Restore the relays.</strong> Your squad shares energy. Stand at a spire and press E to install one cell. Each spire requires three.</li><li><strong>Stay out of trouble.</strong> Amber sentinels drain your shield. Your shield recovers away from danger. ORA rescues depleted pilots to the pad.</li><li><strong>Make first contact.</strong> Once all three relays are online, return to the center pad and press E before your destination's signal window ends. Tempest Circuit requires relays in order; watch the field conditions for heat and frost hazards.</li><li><strong>Talk to the world.</strong> Ask ORA for tactics, lore, a storm, or to scout a relay. Claude controls bounded world settings shared by your squad.</li></ol><button className="button full" onClick={()=>setModal(null)}>Ready to explore <ArrowUpRight size={16}/></button></>}

      {modal==='capabilities'&&<><span className="eyebrow">CAPABILITY ATLAS / AURA3D 4.0.0</span><h2 id="modal-title">More than a spinning cube.</h2><p>Aura3D’s appeal is its typed scene API, integrated game tools, and source code that AI can author and you can own. Here is what this app actually exercises.</p><div className="capability-table">{capabilityRows.map(([title,description,owner])=><div key={title}><strong>{title}</strong><p>{description}</p><span>{owner}</span></div>)}</div><p className="scope-note">This is a broad playable showcase, not coverage of every engine API. WebGPU, skeletal IK, navmesh crowds, vehicle dynamics, visual scripting, XR and external generative asset services are not demonstrated here. Renderer availability and warnings appear in live diagnostics; no universal performance superiority is claimed.</p><a className="text-button" href="https://github.com/auraoneai/aura3d" target="_blank" rel="noreferrer">Explore the Aura3D source <ArrowUpRight size={14}/></a></>}

      {modal==='scores'&&<><span className="eyebrow">SIGNALS THAT MADE IT HOME</span><h2 id="modal-title">Expedition leaderboard.</h2><p>Completed public network missions, saved in PostgreSQL. Private squads and local previews stay off this board.</p><div className="leaderboard">{scores.length?scores.map((r,i)=><div key={r.code}><span>{String(i+1).padStart(2,'0')}</span><strong>{r.name}<small>{r.players} pilots · {r.code}</small></strong><b>{r.score.toLocaleString()}</b></div>):<div className="empty-score"><Trophy size={35}/><strong>First contact is still waiting.</strong><p>Complete a public expedition to put your squad on the board.</p></div>}</div></>}

    </section></div>}

  </div>;

}


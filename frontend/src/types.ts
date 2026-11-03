export type Weather = 'aurora' | 'clear' | 'storm';
export interface Pilot { id: string; name: string }
export interface Player extends Pilot { x: number; z: number; yaw: number; shield: number; color: string; connected: boolean; scan: number }
export interface Relay { id: number; name: string; x: number; z: number; charge: number }
export interface AIPlan { message: string; weather: Weather; waypoint: number; companion: 'follow' | 'scout' | 'guard'; source: 'anthropic' | 'local'; reason?: string; model?: string }
export interface World { level?: string; seed: number; started: number; duration: number; status: 'active' | 'won' | 'lost'; score: number; energy: number; weather: Weather; waypoint: number; companion: string; players: Player[]; shards: {id: number; x: number; z: number; taken: boolean}[]; relays: Relay[]; sentinels: {x:number;z:number}[]; events: {id:number;kind:string;message:string;at:number}[]; revision: number; now: number; ai: AIPlan }
export interface Room { level?: string; code: string; name: string; seed: number; status: string; score: number; private: boolean; players: number; created: string }
export interface Session { pilot: Pilot | null; csrf: string; ai: { configured: boolean; model: string; daily_limit: number } }
export interface RenderOptions { bloom: boolean; fog: boolean; particles: boolean; shadows: boolean; camera: 'overview' | 'follow'; quality: 'auto' | 'high' | 'low'; lab: boolean; material: 'ceramic' | 'metal' | 'glass' }
export interface RendererEvidence { bloom: string; fog: string; shadowMap: string; grounding: string; particles: string; instancedSubmissions: number; animatedAssets: number; limitations: string[]; warnings: string[] }
export interface Metrics { frameMs?:number; resolution?:number; fps: number; draws: number; backend: string; triangles: number; errors: string[]; evidence?: RendererEvidence }

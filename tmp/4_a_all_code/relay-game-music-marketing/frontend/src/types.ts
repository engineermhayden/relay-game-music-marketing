export type Weather = 'aurora' | 'clear' | 'storm';
export interface Pilot { id: string; name: string }
export interface Player extends Pilot { x: number; z: number; yaw: number; shield: number; color: string; connected: boolean; scan: number }
export interface Relay { id: number; name: string; x: number; z: number; charge: number }
export interface AIPlan { message: string; weather: Weather; waypoint: number; companion: 'follow' | 'scout' | 'guard'; source: 'anthropic' | 'local'; reason?: string; model?: string }
export interface World { level?: string; seed: number; started: number; duration: number; status: 'active' | 'won' | 'lost'; score: number; energy: number; weather: Weather; waypoint: number; companion: string; players: Player[]; shards: {id: number; x: number; z: number; taken: boolean}[]; relays: Relay[]; sentinels: {x:number;z:number}[]; events: {id:number;kind:string;message:string;at:number}[]; revision: number; now: number; ai: AIPlan }
export interface Room { level?: string; code: string; name: string; seed: number; status: string; score: number; private: boolean; players: number; created: string }
export interface Account { email: string; email_verified: boolean; created: string; recovery_keys_remaining: number | null }
export interface Session { pilot: Pilot | null; account: Account | null; csrf: string; ai: { configured: boolean; model: string; daily_limit: number } }
export interface RenderOptions { bloom: boolean; fog: boolean; particles: boolean; shadows: boolean; camera: 'overview' | 'follow'; quality: 'auto' | 'high' | 'low'; lab: boolean; material: 'ceramic' | 'metal' | 'glass' }
export interface RendererEvidence { bloom: string; fog: string; shadowMap: string; grounding: string; particles: string; instancedSubmissions: number; animatedAssets: number; limitations: string[]; warnings: string[] }
export interface Metrics { frameMs?:number; resolution?:number; fps: number; draws: number; backend: string; triangles: number; errors: string[]; evidence?: RendererEvidence }
export type FeedbackStatus = 'new' | 'planned' | 'done' | 'declined';
export interface FeedbackItem { id: number; title: string; body: string; category: string; status: FeedbackStatus; votes: number; voted: boolean; public: boolean; mine: boolean; staff_response: string | null; created_at: string; published_at: string | null; attachments?: { screenshot: boolean; engine_lab_snapshot: boolean } }
export interface FeedbackBoard { items: FeedbackItem[]; has_more: boolean; mine: FeedbackItem[]; can_vote: boolean; signed_in: boolean; categories: { id: string; label: string }[]; limits: { title_min: number; title: number; body: number; voter_check_hours: number }; csrf: string }
/** The Engine lab snapshot a player can attach to feedback. The server keeps only these fields. */
export interface EngineSnapshot {
  captured_at: string;
  browser: { user_agent: string; language: string; platform: string; viewport: string; pixel_ratio: number };
  renderer: { backend: string; bloom?: string; fog?: string; shadow_map?: string; grounding?: string; particles?: string; instanced_submissions?: number; animated_assets?: number };
  performance: { fps: number; frame_ms?: number; resolution_scale: number; draws: number; triangles: number };
  settings: { quality: string; camera: string; material: string; bloom: boolean; fog: boolean; particles: boolean; shadows: boolean; lab: boolean };
  scene: { destination: string; mode: 'preview' | 'squad' };
  errors: string[]; warnings: string[]; limitations: string[];
}

// src/types/index.ts

export type SceneType = 'INT' | 'EXT';
export type SceneTiming = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
export type RiskLevel = 'low' | 'med' | 'high';
export type CanvasTool = 'select' | 'hand' | 'connect';
export type ViewId =
  | 'canvas'
  | 'script'
  | 'breakdown'
  | 'stripboard'
  | 'shotlist'
  | 'storyboard'
  | 'budget'
  | 'callsheet';

export type InspectorTab = 'info' | 'elems' | 'shots' | 'files' | 'plan';
export type ScreenId = 'home' | 'workbench' | 'login';
export type HomeSection = 'hub' | 'projects' | 'agents' | 'settings';

export interface StudioSettings {
  studioName: string;
  unionScale: string;
  exportFormat: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string;
}

export interface Project {
  id: string;
  name: string;
  phase: 'Development' | 'Pre-Production' | 'Production' | 'Post-Production';
  format: 'Feature Film' | 'Short Film' | 'TV Pilot' | 'Commercial' | 'Music Video';
  genre: string;
  scenesCount: number;
  budgetCap: number;
  estimatedCost: number;
  shootDays: number;
  scriptFile?: string;
  updatedAt: string;
  status: 'active' | 'development' | 'completed';
}

export interface NewProjectForm {
  name: string;
  format: 'Feature Film' | 'Short Film' | 'TV Pilot' | 'Commercial' | 'Music Video';
  genre: string;
  scriptSource: 'upload' | 'ai_prompt';
  scriptText: string;
  scriptFile: string;
  budgetCap: number;
  shootDays: number;
  unionScale: string;
  selectedAgents: string[];
  clickhouseEnabled: boolean;
  generateStoryboards: boolean;
}

/** Progress of an agent-run background job (script ingest, storyboards). */
export interface JobStatus {
  status: 'pending' | 'running' | 'done' | 'partial' | 'error';
  total: number;
  done: number;
  message: string;
  error?: string;
}

export interface Scene {
  id: string;
  num: string;          // '01', '02', ...
  slug: string;         // Full slugline e.g. 'INT. NEON COFFEE SHOP — NIGHT'
  type: SceneType;
  timing: SceneTiming;
  loc: string;          // Short location name
  pages: string;        // '0.31'
  cast: string[];
  shots: number;
  risk: RiskLevel;
  riskNote: string;
  day: number;          // Shoot day number
  desc: string;
  // Breakdown elements
  props: string[];
  ward: string[];
  vfx: string[];
  sfx: string[];
  /** Raw screenplay text for this scene, when we have it. Kept so exporting a
   *  script round-trips instead of regenerating placeholder prose. */
  body?: string;
  /** Dialogue captured per character, in script order. */
  dialogue?: DialogueLine[];
  // Canvas position
  x: number;
  y: number;
}

export interface DialogueLine {
  character: string;
  parenthetical?: string;
  text: string;
}

export interface Connection {
  id: string;
  from: string;  // scene id
  to: string;    // scene id
}

export interface Shot {
  id: string;
  sceneNum: string;
  label: string;     // '1A', '1B', etc.
  type: ShotType;
  angle: string;
  movement: string;
  lens: string;
  desc: string;
  status: ShotStatus;
}
export type ShotType = 'WS' | 'MS' | 'CU' | 'ECU' | 'POV' | 'INSERT';
export type ShotStatus = 'planned' | 'setup' | 'shot' | 'approved';

export interface BudgetItem {
  id: string;
  acct: string;
  category: string;
  desc: string;
  estimated: number;
  cap: number;
  isCategory?: boolean;
  status?: 'ok' | 'over' | 'pending';
  sceneNumber?: string | null;
}

export interface CastCallEntry {
  character: string;
  actor: string;
  makeup: string;
  wardrobe: string;
  setCall: string;
  scenes: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  ts: string;
}

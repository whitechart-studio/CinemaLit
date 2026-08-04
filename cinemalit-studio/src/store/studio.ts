// src/store/studio.ts
import { create } from 'zustand';
import type {
  Scene, Connection, CanvasTool, ViewId, InspectorTab, AgentMessage,
  ScreenId, Project, NewProjectForm, AuthUser,
} from '../types';
import { initialScenes, initialConnections } from '../data/sampleData';
import { saveStateToStorage, loadStateFromStorage } from '../utils/storage';

const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Neon Echoes',
    phase: 'Pre-Production',
    format: 'Short Film',
    genre: 'Sci-Fi Thriller',
    scenesCount: 3,
    budgetCap: 5000,
    estimatedCost: 8110,
    shootDays: 2,
    scriptFile: 'Neon_Echoes_v3.fountain',
    updatedAt: '10 mins ago',
    status: 'active',
  },
  {
    id: 'p2',
    name: 'Cyberpunk Odyssey',
    phase: 'Development',
    format: 'Feature Film',
    genre: 'Action Sci-Fi',
    scenesCount: 12,
    budgetCap: 50000,
    estimatedCost: 48500,
    shootDays: 10,
    scriptFile: 'Odyssey_Treatment.fdx',
    updatedAt: '2 hours ago',
    status: 'development',
  },
  {
    id: 'p3',
    name: 'Solaris Protocol',
    phase: 'Production',
    format: 'TV Pilot',
    genre: 'Mystery Thriller',
    scenesCount: 8,
    budgetCap: 25000,
    estimatedCost: 24200,
    shootDays: 5,
    scriptFile: 'Solaris_Pilot.pdf',
    updatedAt: 'Yesterday',
    status: 'active',
  },
];

const saved = loadStateFromStorage();

interface StudioState {
  // Authentication State
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser | null, token: string | null) => void;
  logout: () => void;

  // Navigation / Screen Router
  currentScreen: ScreenId;
  setScreen: (screen: ScreenId) => void;

  // Wizard
  wizardOpen: boolean;
  openWizard: () => void;
  closeWizard: () => void;

  // Projects
  projects: Project[];
  activeProject: Project;
  setActiveProject: (p: Project) => void;
  createProject: (form: NewProjectForm) => void;

  // View routing
  activeView: ViewId;
  openTabs: ViewId[];
  setActiveView: (v: ViewId) => void;
  closeTab: (v: ViewId) => void;

  // Scenes
  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  addScene: (scene: Scene) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  deleteScene: (id: string) => void;
  duplicateScene: (id: string) => void;
  autoArrangeCanvas: () => void;

  // Connections
  connections: Connection[];
  addConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;

  // Canvas transform
  panX: number;
  panY: number;
  zoom: number;
  setPan: (x: number, y: number) => void;
  setZoom: (z: number) => void;
  resetView: () => void;

  // Canvas tool
  tool: CanvasTool;
  setTool: (t: CanvasTool) => void;

  // Selection & connect mode
  selectedSceneId: string | null;
  selectScene: (id: string | null) => void;
  connectFromId: string | null;
  setConnectFrom: (id: string | null) => void;

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  openInspector: (sceneId: string) => void;
  closeInspector: () => void;
  setInspectorTab: (tab: InspectorTab) => void;

  // Agent messages
  agentMessages: AgentMessage[];
  addAgentMessage: (msg: AgentMessage) => void;
}

let connIdCounter = 10;

export const useStudioStore = create<StudioState>((set) => ({
  user: (() => {
    try {
      const u = localStorage.getItem('cinemalit_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('cinemalit_token') || null,
  setAuth: (user, token) => {
    if (user && token) {
      localStorage.setItem('cinemalit_user', JSON.stringify(user));
      localStorage.setItem('cinemalit_token', token);
    } else {
      localStorage.removeItem('cinemalit_user');
      localStorage.removeItem('cinemalit_token');
    }
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('cinemalit_user');
    localStorage.removeItem('cinemalit_token');
    set({ user: null, token: null });
  },

  currentScreen: 'home',
  setScreen: (screen) => set({ currentScreen: screen }),

  wizardOpen: false,
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),

  projects: saved?.projects || SAMPLE_PROJECTS,
  activeProject: (saved?.projects && saved.projects[0]) || SAMPLE_PROJECTS[0],
  setActiveProject: (p) => set({ activeProject: p, currentScreen: 'workbench' }),

  createProject: (form) =>
    set((s) => {
      const newProj: Project = {
        id: `p${Date.now()}`,
        name: form.name || 'Untitled Production',
        phase: 'Pre-Production',
        format: form.format,
        genre: form.genre || 'Drama',
        scenesCount: 3,
        budgetCap: form.budgetCap || 5000,
        estimatedCost: Math.round((form.budgetCap || 5000) * 0.95),
        shootDays: form.shootDays || 2,
        scriptFile: form.scriptFile || `${form.name.toLowerCase().replace(/\s+/g, '_')}.fountain`,
        updatedAt: 'Just now',
        status: 'active',
      };
      const updatedProjects = [newProj, ...s.projects];
      saveStateToStorage({ scenes: s.scenes, connections: s.connections, projects: updatedProjects });
      return {
        projects: updatedProjects,
        activeProject: newProj,
        wizardOpen: false,
        currentScreen: 'workbench',
        activeView: 'canvas',
      };
    }),

  activeView: 'canvas',
  openTabs: ['canvas', 'script', 'storyboard', 'breakdown', 'stripboard', 'shotlist', 'budget', 'callsheet', 'sql'],
  setActiveView: (v) =>
    set((s) => ({
      activeView: v,
      openTabs: s.openTabs.includes(v) ? s.openTabs : [...s.openTabs, v],
    })),
  closeTab: (v) =>
    set((s) => {
      const nextTabs = s.openTabs.filter((t) => t !== v);
      const remaining = nextTabs.length > 0 ? nextTabs : (['canvas'] as ViewId[]);
      const nextActive = s.activeView === v ? remaining[remaining.length - 1] : s.activeView;
      return { openTabs: remaining, activeView: nextActive };
    }),

  scenes: saved?.scenes || initialScenes,
  setScenes: (scenes) =>
    set((s) => {
      saveStateToStorage({ scenes, connections: s.connections, projects: s.projects });
      return { scenes };
    }),

  addScene: (scene) =>
    set((s) => {
      const next = [...s.scenes, scene];
      saveStateToStorage({ scenes: next, connections: s.connections, projects: s.projects });
      return { scenes: next };
    }),

  updateScene: (id, patch) =>
    set((s) => {
      const next = s.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc));
      saveStateToStorage({ scenes: next, connections: s.connections, projects: s.projects });
      return { scenes: next };
    }),

  deleteScene: (id) =>
    set((s) => {
      const nextScenes = s.scenes.filter((sc) => sc.id !== id);
      const nextConns = s.connections.filter((c) => c.from !== id && c.to !== id);
      saveStateToStorage({ scenes: nextScenes, connections: nextConns, projects: s.projects });
      return { scenes: nextScenes, connections: nextConns, selectedSceneId: null, inspectorOpen: false };
    }),

  duplicateScene: (id) =>
    set((s) => {
      const target = s.scenes.find((sc) => sc.id === id);
      if (!target) return s;
      const dup: Scene = {
        ...target,
        id: `sn${Date.now()}`,
        num: String(s.scenes.length + 1).padStart(2, '0'),
        x: target.x + 40,
        y: target.y + 40,
      };
      const nextScenes = [...s.scenes, dup];
      saveStateToStorage({ scenes: nextScenes, connections: s.connections, projects: s.projects });
      return { scenes: nextScenes, selectedSceneId: dup.id };
    }),

  autoArrangeCanvas: () =>
    set((s) => {
      const rearranged = s.scenes.map((sc, idx) => ({
        ...sc,
        x: 100 + (idx % 4) * 290,
        y: 160 + Math.floor(idx / 4) * 220,
      }));
      saveStateToStorage({ scenes: rearranged, connections: s.connections, projects: s.projects });
      return { scenes: rearranged, panX: 60, panY: 60, zoom: 1 };
    }),

  connections: saved?.connections || initialConnections,
  addConnection: (conn) =>
    set((s) => {
      const next = [...s.connections, conn];
      saveStateToStorage({ scenes: s.scenes, connections: next, projects: s.projects });
      return { connections: next };
    }),
  removeConnection: (id) =>
    set((s) => {
      const next = s.connections.filter((c) => c.id !== id);
      saveStateToStorage({ scenes: s.scenes, connections: next, projects: s.projects });
      return { connections: next };
    }),

  panX: 60,
  panY: 60,
  zoom: 1,
  setPan: (x, y) => set({ panX: x, panY: y }),
  setZoom: (z) => set({ zoom: Math.max(0.2, Math.min(3, z)) }),
  resetView: () => set({ panX: 60, panY: 60, zoom: 1 }),

  tool: 'select',
  setTool: (t) => set({ tool: t, connectFromId: null }),

  selectedSceneId: null,
  selectScene: (id) => set({ selectedSceneId: id }),
  connectFromId: null,
  setConnectFrom: (id) => set({ connectFromId: id }),

  inspectorOpen: false,
  inspectorTab: 'info',
  openInspector: (sceneId) =>
    set({ inspectorOpen: true, selectedSceneId: sceneId }),
  closeInspector: () =>
    set({ inspectorOpen: false, selectedSceneId: null }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  agentMessages: [
    {
      id: 'am0',
      role: 'agent',
      text: 'Scene 2 rain FX flagged. Consolidate ext. locations to save ~$800.',
      ts: '15:52',
    },
  ],
  addAgentMessage: (msg) =>
    set((s) => ({ agentMessages: [...s.agentMessages, msg] })),
}));

// Helper to generate a new scene
export function makeNewScene(scenes: Scene[]): Scene {
  const last = scenes[scenes.length - 1];
  const n = scenes.length + 1;
  return {
    id: `sn${Date.now()}`,
    num: String(n).padStart(2, '0'),
    slug: `INT. NEW LOCATION — DAY`,
    type: 'INT',
    timing: 'DAY',
    loc: `New Location ${n}`,
    pages: '0.25',
    cast: ['TBD'],
    shots: 2,
    risk: 'low',
    riskNote: 'No risk flags',
    day: 1,
    desc: 'New scene.',
    props: [],
    ward: [],
    vfx: [],
    sfx: [],
    x: last ? last.x + 320 : 100,
    y: last ? last.y + 40 : 160,
  };
}

export function makeConnection(from: string, to: string): Connection {
  return { id: `c${connIdCounter++}`, from, to };
}

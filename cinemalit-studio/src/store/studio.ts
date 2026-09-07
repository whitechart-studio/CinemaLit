// src/store/studio.ts
import { create } from 'zustand';
import type {
  Scene, Connection, CanvasTool, ViewId, InspectorTab, AgentMessage,
  ScreenId, HomeSection, Project, NewProjectForm, AuthUser, JobStatus, StudioSettings,
} from '../types';
import { initialScenes, initialConnections } from '../data/sampleData';
import { saveStateToStorage, loadStateFromStorage, saveSettings, loadSettings } from '../utils/storage';
import { apiFetch } from '../utils/api';
import { parseFountainScript } from '../utils/fountainParser';

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

  // Director AI chat rail — toggleable the same way the Inspector is.
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;

  // Which HomePage section is active — lifted to the store so TopBar's
  // Settings icon (and anything else) can deep-link into a section instead
  // of HomePage owning it as unreachable local state.
  homeSection: HomeSection;
  setHomeSection: (section: HomeSection) => void;

  // Studio-wide settings (HomePage's Settings section)
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;

  // Wizard
  wizardOpen: boolean;
  openWizard: () => void;
  closeWizard: () => void;

  // Projects
  projects: Project[];
  activeProject: Project;
  setActiveProject: (p: Project) => void;
  createProject: (form: NewProjectForm) => Promise<void>;
  refreshProjects: () => Promise<void>;
  loadProjectScenes: (projectId: string) => Promise<void>;

  // Agent ingest progress
  job: JobStatus | null;
  setJob: (job: JobStatus | null) => void;

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
  /** Show/hide the panel without forcing a scene selection — for the
   *  WorkspaceHeader toggle, as opposed to clicking a scene node. */
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTab) => void;

  // Agent messages
  agentMessages: AgentMessage[];
  addAgentMessage: (msg: AgentMessage) => void;
}

let connIdCounter = 10;

/** Pull dialogue out of a scene's stored screenplay text, so scenes loaded from
 *  ClickHouse read the same as freshly imported ones. */
function parseSceneDialogue(sceneText: string) {
  const { scenes } = parseFountainScript(sceneText);
  return scenes[0]?.dialogue ?? [];
}

/**
 * Poll an agent job until it settles, refreshing the canvas as scenes land.
 *
 * The ingest runs on the server for as long as the script is long, so the
 * browser polls instead of holding a request open — a refresh mid-ingest picks
 * the progress right back up.
 */
async function pollJob(projectId: string, kind: 'ingest' | 'storyboard', thenStoryboards = false) {
  const store = useStudioStore;
  const deadline = Date.now() + 30 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let job: JobStatus | null = null;
    try {
      const data = await (await apiFetch(`/api/jobs?projectId=${projectId}&kind=${kind}`)).json();
      if (data.status === 'ok') job = data.job as JobStatus;
    } catch {
      continue; // transient — keep polling rather than killing the run
    }
    if (!job) continue;

    store.setState({ job });
    if (job.done > 0) await store.getState().loadProjectScenes(projectId);

    if (job.status === 'done' || job.status === 'partial' || job.status === 'error') {
      await store.getState().loadProjectScenes(projectId);
      await store.getState().refreshProjects();
      if (kind === 'ingest' && thenStoryboards) {
        store.setState({ job: { ...job, status: 'running', done: 0, message: 'Generating storyboards…' } });
        void pollJob(projectId, 'storyboard');
        return;
      }
      setTimeout(() => store.setState({ job: null }), 4000);
      return;
    }
  }
  store.setState({ job: null });
}

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

  chatOpen: true,
  setChatOpen: (open) => set({ chatOpen: open }),

  homeSection: 'hub',
  setHomeSection: (section) => set({ homeSection: section }),

  settings: loadSettings() || {
    studioName: 'CinemaLit Pictures',
    unionScale: 'SAG-AFTRA Ultra Low Budget',
    exportFormat: 'Greenlight Package (HTML/PDF)',
  },
  updateSettings: (patch) =>
    set((s) => {
      const next = { ...s.settings, ...patch };
      saveSettings(next);
      return { settings: next };
    }),

  wizardOpen: false,
  openWizard: () => set({ wizardOpen: true }),
  closeWizard: () => set({ wizardOpen: false }),

  // `saved?.x || fallback` would wrongly replace a legitimately-empty saved
  // array (e.g. a freshly created project with 0 scenes) with demo data,
  // since `[]` is truthy — only fall back when nothing was saved at all.
  projects: saved ? saved.projects ?? SAMPLE_PROJECTS : SAMPLE_PROJECTS,
  activeProject: saved?.projects?.[0] ?? SAMPLE_PROJECTS[0],
  setActiveProject: (p) => {
    set({ activeProject: p, currentScreen: 'workbench' });
    void useStudioStore.getState().loadProjectScenes(p.id);
  },

  job: null,
  setJob: (job) => set({ job }),

  /** Creates the project server-side and hands the script to the Director
   *  Agent. The agent's ingest runs in the background; we poll for progress
   *  and pull the scenes it writes as they land. */
  createProject: async (form) => {
    const resp = await apiFetch('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: form.name,
        format: form.format,
        genre: form.genre,
        budgetCap: form.budgetCap,
        shootDays: form.shootDays,
        unionScale: form.unionScale,
        selectedAgents: form.selectedAgents,
        scriptFile: form.scriptFile,
        scriptText: form.scriptText,
        generateStoryboards: form.generateStoryboards,
      }),
    });
    const data = await resp.json();
    if (data.status !== 'ok') throw new Error(data.error || 'Could not create the project');

    const proj: Project = {
      id: data.projectId,
      name: form.name || 'Untitled Production',
      phase: 'Development',
      format: form.format,
      genre: form.genre || 'Drama',
      scenesCount: 0,
      budgetCap: form.budgetCap || 5000,
      estimatedCost: 0,
      shootDays: form.shootDays || 2,
      scriptFile: form.scriptFile,
      updatedAt: 'Just now',
      status: 'development',
    };
    set((s) => ({
      projects: [proj, ...s.projects],
      activeProject: proj,
      scenes: [],
      connections: [],
      wizardOpen: false,
      currentScreen: 'workbench',
      activeView: 'canvas',
      job: { status: 'pending', total: 0, done: 0, message: 'Handing the script to the Director Agent…' },
    }));

    void pollJob(data.projectId, 'ingest', form.generateStoryboards);
  },

  refreshProjects: async () => {
    try {
      const data = await (await apiFetch('/api/projects')).json();
      if (data.status !== 'ok' || !Array.isArray(data.projects)) return;
      set({ projects: data.projects });
    } catch {
      /* offline — keep whatever is already in the store */
    }
  },

  /** Pull a project's scenes out of ClickHouse and onto the canvas. */
  loadProjectScenes: async (projectId) => {
    try {
      const data = await (await apiFetch(`/api/clickhouse/scenes?projectId=${projectId}`)).json();
      if (data.status !== 'ok' || !Array.isArray(data.scenes)) return;
      const scenes: Scene[] = data.scenes.map((sc: any, i: number) => ({
        id: `sn-${projectId}-${sc.sceneNum}`,
        num: String(sc.sceneNum).padStart(2, '0'),
        slug: sc.slugline,
        type: String(sc.slugline).startsWith('EXT') ? 'EXT' : 'INT',
        timing: (['DAY', 'NIGHT', 'DAWN', 'DUSK'].find((t) => String(sc.slugline).includes(t)) || 'DAY'),
        loc: String(sc.slugline).replace(/^(INT|EXT)\.\s*/, '').split('—')[0].trim(),
        pages: String((sc.pageCount ?? (sc.totalDurationSec || 60) / 60).toFixed(2)),
        cast: sc.cast || [],
        shots: sc.shotCount ?? (sc.frames || []).length,
        risk: sc.risk || 'low',
        riskNote: sc.riskNote || 'No risk flags',
        day: sc.shootDay || 1,
        desc: sc.desc || '',
        props: sc.props || [],
        ward: sc.ward || [],
        vfx: sc.vfx || [],
        sfx: sc.sfx || [],
        body: sc.sceneText || '',
        dialogue: parseSceneDialogue(sc.sceneText || ''),
        x: 100 + (i % 4) * 290,
        y: 160 + Math.floor(i / 4) * 220,
      })) as Scene[];
      set({ scenes });
    } catch {
      /* offline — leave the canvas as-is rather than blanking it */
    }
  },

  activeView: 'canvas',
  openTabs: ['canvas', 'script', 'storyboard', 'breakdown', 'stripboard', 'shotlist', 'budget', 'callsheet'],
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

  scenes: saved ? saved.scenes ?? initialScenes : initialScenes,
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

  connections: saved ? saved.connections ?? initialConnections : initialConnections,
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
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
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

/** Show the progress banner and follow an ingest the agent is already running. */
export function watchIngest(projectId: string) {
  useStudioStore.setState({
    job: { status: 'pending', total: 0, done: 0, message: 'Director Agent is re-reading the script…' },
  });
  void pollJob(projectId, 'ingest');
}

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

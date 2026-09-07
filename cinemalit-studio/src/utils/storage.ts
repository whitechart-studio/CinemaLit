// src/utils/storage.ts
import type { Scene, Connection, BudgetItem, Shot, Project, StudioSettings } from '../types';

const STORAGE_KEY = 'cinemalit_studio_state_v2';
const SETTINGS_KEY = 'cinemalit_studio_settings';

export interface SavedState {
  scenes: Scene[];
  connections: Connection[];
  budgetItems?: BudgetItem[];
  shots?: Shot[];
  projects?: Project[];
  fountainText?: string;
}

/** Studio settings live under their own key — a full-object save/patch cycle
 *  like SavedState's would risk clobbering scenes/connections/projects on
 *  every settings change, since those are always saved together above. */
export function saveSettings(settings: StudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save settings to localStorage:', err);
  }
}

export function loadSettings(): StudioSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Failed to load settings from localStorage:', err);
    return null;
  }
}

export function saveStateToStorage(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save state to localStorage:', err);
  }
}

export function loadStateFromStorage(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load state from localStorage:', err);
    return null;
  }
}

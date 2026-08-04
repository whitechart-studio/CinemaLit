// src/utils/storage.ts
import type { Scene, Connection, BudgetItem, Shot, Project } from '../types';

const STORAGE_KEY = 'cinemalit_studio_state_v2';

export interface SavedState {
  scenes: Scene[];
  connections: Connection[];
  budgetItems?: BudgetItem[];
  shots?: Shot[];
  projects?: Project[];
  fountainText?: string;
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

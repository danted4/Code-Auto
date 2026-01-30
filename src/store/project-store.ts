/**
 * Project Store
 *
 * Global state management for the selected project path.
 * Persisted to localStorage so the project is remembered across sessions.
 * Recent projects (last 5) stored for quick re-selection.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_PROJECTS = 5;

interface ProjectStore {
  projectPath: string | null;
  recentPaths: string[];
  setProjectPath: (path: string | null) => void;
  addRecentPath: (path: string) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projectPath: null,
      recentPaths: [],
      setProjectPath: (path) => set({ projectPath: path }),
      addRecentPath: (path) =>
        set((state) => {
          const trimmed = path.trim();
          if (!trimmed) return state;
          const filtered = state.recentPaths.filter((p) => p !== trimmed);
          const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_PROJECTS);
          return { recentPaths: updated };
        }),
    }),
    {
      name: 'code-auto-project',
    }
  )
);

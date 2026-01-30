/**
 * Electron API exposed via preload script.
 * Only available when running in Electron (desktop app).
 */

export interface ElectronAPI {
  openFolderDialog: () => Promise<string | null>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

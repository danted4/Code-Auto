/**
 * Electron Preload Script
 *
 * Exposes safe APIs to the renderer via contextBridge.
 * Used for native folder picker in Open Project modal.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
});

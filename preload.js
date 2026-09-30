'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure bridge between the sandboxed renderer and the main process.
 * The renderer never gets direct Node/Electron access.
 */
contextBridge.exposeInMainWorld('launcher', {
  // window controls (custom titlebar)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // info
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // auth
  getCurrentUser: () => ipcRenderer.invoke('auth:current'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // server manifest
  getManifest: () => ipcRenderer.invoke('manifest:get'),

  // server status ping → { online, latencyMs?, players?, version?, motd?, error? }
  pingServer: (host, port) => ipcRenderer.invoke('server:ping', { host, port }),

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  // launch
  startLaunch: () => ipcRenderer.invoke('launch:start'),

  // streamed launch progress: cb({ stage, message, percent?, log?, code? })
  onLaunchEvent: (cb) => {
    const handler = (_e, event) => cb(event);
    ipcRenderer.on('launch:event', handler);
    return () => ipcRenderer.removeListener('launch:event', handler);
  },

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});

'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lapis', {
  view: new URLSearchParams(location.search).get('view') || 'main',
  getState: () => ipcRenderer.invoke('get-state'),
  act: (type, payload) => ipcRenderer.send('action', Object.assign({ type }, payload || {})),
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  onChime: cb => ipcRenderer.on('chime', (_e, kind) => cb(kind))
});

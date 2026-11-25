const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('av', {
  ready: () => ipcRenderer.send('render:ready'),
  onJob: (fn) => ipcRenderer.once('render:job', (_e, job) => fn(job)),
  chunk: (position, data) => ipcRenderer.invoke('render:chunk', position, data),
  progress: (frame, total, secs) => ipcRenderer.send('render:progress', frame, total, secs),
  done: (info) => ipcRenderer.send('render:done', info),
  fail: (msg) => ipcRenderer.send('render:fail', msg),
});

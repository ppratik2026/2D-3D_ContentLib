const { contextBridge, ipcRenderer, webUtils } = require('electron');
const CH = ['options', 'estimate', 'settings:get', 'settings:set', 'settings:testKey', 'setup:status', 'setup:run', 'queue:get', 'queue:add', 'queue:start', 'queue:pause', 'queue:cancel', 'queue:retry', 'queue:remove', 'queue:move', 'queue:clearDone',
  'library:list', 'library:open', 'library:delete', 'chars:list', 'chars:import', 'chars:importPaths', 'chars:update', 'chars:delete', 'chars:openFolder', 'open:data', 'update:get', 'update:check', 'update:download', 'update:install', 'queue:retryNow', 'story:prompt', 'story:parse', 'ai:get', 'ai:set', 'ai:models', 'ai:test', 'bg:list', 'bg:import', 'bg:importPaths', 'bg:update', 'bg:delete', 'bg:openFolder', 'voice:list', 'voice:sample'];
contextBridge.exposeInMainWorld('api', {
  call: (ch, arg) => (CH.includes(ch) ? ipcRenderer.invoke(ch, arg) : Promise.reject(new Error('blocked: ' + ch))),
  on: (ch, fn) => { if (['queue', 'setup:progress', 'update'].includes(ch)) ipcRenderer.on(ch, (_e, v) => fn(v)); },
  pathOf: (file) => webUtils.getPathForFile(file),
});

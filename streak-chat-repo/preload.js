const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  press: () => ipcRenderer.invoke('state:press'),
  onState: cb => ipcRenderer.on('state:update', (_e, v) => cb(v)),
  resize: h => ipcRenderer.send('win:resize', h),
  menu: () => ipcRenderer.send('win:menu'),
});

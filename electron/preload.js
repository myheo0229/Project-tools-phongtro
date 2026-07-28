const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC APIs for renderer process
contextBridge.exposeInMainWorld('api', {
  saveMonthData: (monthKey, data) => ipcRenderer.invoke('month-data:save', monthKey, data),
  loadMonthData: (monthKey) => ipcRenderer.invoke('month-data:load', monthKey),
  saveSettingsData: (data) => ipcRenderer.invoke('settings-data:save', data),
  loadSettingsData: () => ipcRenderer.invoke('settings-data:load')
});

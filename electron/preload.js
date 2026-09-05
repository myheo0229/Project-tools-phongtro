const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Lấy phiên bản ứng dụng
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  // Quản lý lưu/đọc dữ liệu chỉ số tháng
  saveMonthData: (monthKey, data) => ipcRenderer.invoke('month-data:save', monthKey, data),
  loadMonthData: (monthKey) => ipcRenderer.invoke('month-data:load', monthKey),

  // Quản lý lưu/đọc cài đặt giá & thư mục gốc
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),

  // Chọn thư mục trên Windows qua dialog native
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),

  // Xuất ảnh JPG & file PDF gộp
  exportReceipts: (monthKey, roomDataList) => ipcRenderer.invoke('export:receipts', monthKey, roomDataList),
  onExportProgress: (callback) => {
    ipcRenderer.removeAllListeners('export:progress');
    ipcRenderer.on('export:progress', (event, data) => callback(data));
  },

  // Auto Updater APIs
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  startDownloadUpdate: () => ipcRenderer.invoke('updater:start-download'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.removeAllListeners('updater:update-available');
    ipcRenderer.on('updater:update-available', (event, data) => callback(data));
  },
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.removeAllListeners('updater:update-not-available');
    ipcRenderer.on('updater:update-not-available', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.removeAllListeners('updater:download-progress');
    ipcRenderer.on('updater:download-progress', (event, data) => callback(data));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.removeAllListeners('updater:update-downloaded');
    ipcRenderer.on('updater:update-downloaded', (event, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.removeAllListeners('updater:error');
    ipcRenderer.on('updater:error', (event, data) => callback(data));
  },

  // Quản lý Người Ở (Persons) & Phòng (Rooms)
  getPersons: () => ipcRenderer.invoke('persons:load'),
  savePerson: (personData) => ipcRenderer.invoke('persons:save', personData),
  deletePersons: (ids) => ipcRenderer.invoke('persons:delete', ids),
  getRooms: () => ipcRenderer.invoke('rooms:load'),
  saveRoomAssignment: (assignment) => ipcRenderer.invoke('rooms:save-assignment', assignment),
  removeRoomMembers: (roomId, memberIds) => ipcRenderer.invoke('rooms:remove-members', roomId, memberIds),
  pickImage: () => ipcRenderer.invoke('dialog:pick-image'),
  readImageBase64: (imagePath) => ipcRenderer.invoke('image:read-base64', imagePath)
});

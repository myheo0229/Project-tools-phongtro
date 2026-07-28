const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
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
  }
});

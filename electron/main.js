const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Tắt tự động tải ngầm, chỉ tải khi người dùng đồng ý
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let pdfLibModule = null; // Cache module pdf-lib sau khi nạp xong

// Nạp NGẦM pdf-lib, không chặn luồng chính
function preloadPdfLibInBackground() {
  setTimeout(() => {
    try {
      pdfLibModule = require('pdf-lib');
    } catch (err) {
      console.error('Preload pdf-lib thất bại (không sao, sẽ thử lại lúc xuất):', err);
    }
  }, 1500); // Trễ 1.5s sau khi cửa sổ hiện
}

// Hàm AN TOÀN lấy pdf-lib trước khi xuất
function getPdfLib() {
  if (!pdfLibModule) {
    pdfLibModule = require('pdf-lib');
  }
  return pdfLibModule;
}

const PROJECT_ROOT = path.join(__dirname, '..');

// Đường dẫn file con trỏ pointer.json trong userData hệ thống
const POINTER_FILE = path.join(app.getPath('userData'), 'pointer.json');

// Đọc thông tin từ pointer.json nếu có
function getPointer() {
  try {
    if (fs.existsSync(POINTER_FILE)) {
      const content = fs.readFileSync(POINTER_FILE, 'utf8');
      const data = JSON.parse(content);
      if (data && data.baseFolder) {
        return {
          baseFolder: data.baseFolder,
          dataFolderName: data.dataFolderName || 'data',
          phieuThuFolderName: data.phieuThuFolderName || 'PhieuThu'
        };
      }
    }
  } catch (err) {
    console.error('Lỗi khi đọc pointer.json:', err);
  }
  return null;
}

// Ghi thông tin vào pointer.json
function savePointer(pointerObj) {
  try {
    const dir = path.dirname(POINTER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(POINTER_FILE, JSON.stringify(pointerObj, null, 2), 'utf8');
  } catch (err) {
    console.error('Lỗi khi ghi pointer.json:', err);
  }
}

// BƯỚC B — Kiểm tra 1 thư mục có phải "data" hợp lệ của app này không
function isValidDataFolder(dir) {
  try {
    const settingsPath = path.join(dir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return false;
    const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return content.appId === 'phong-tro-app';
  } catch {
    return false;
  }
}

// BƯỚC B — Tìm tên thư mục con KHÔNG bị trùng bên trong parentDir, bắt đầu từ baseName
function findAvailableFolderName(parentDir, baseName) {
  let candidate = baseName;
  let i = 1;
  while (fs.existsSync(path.join(parentDir, candidate))) {
    candidate = `${baseName} (${i})`;
    i++;
  }
  return candidate;
}

// Hàm sao chép thư mục đệ quy
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const { toReceiptData } = require(path.join(PROJECT_ROOT, 'src', 'shared', 'format.js'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false, // Ẩn cửa sổ ban đầu để tránh giật/trắng màn hình
    title: `Màn Hình Nhập Liệu - Quản Lý Phòng Trọ v${app.getVersion()}`,
    icon: path.join(PROJECT_ROOT, 'assets', 'icon', 'icon32x32.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Hiện cửa sổ khi đã render xong DOM và bắt đầu preload ngầm pdf-lib
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    preloadPdfLibInBackground();
  });

  mainWindow.loadFile(path.join(PROJECT_ROOT, 'src', 'input', 'index.html'));

  setupAutoUpdater(mainWindow);
}

function setupAutoUpdater(mainWindow) {
  autoUpdater.removeAllListeners();

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-available', {
        version: info ? info.version : '',
        releaseDate: info ? info.releaseDate : '',
        releaseNotes: info ? info.releaseNotes : ''
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-not-available', {
        version: info ? info.version : app.getVersion()
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:download-progress', {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:update-downloaded', {
        version: info ? info.version : ''
      });
    }

    // Gửi thông báo hệ thống Windows (Native Notification) ở góc màn hình
    try {
      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, '../assets/icon/icon256x256.png');
        new Notification({
          title: 'Quản Lý Phòng Trọ',
          body: 'Đã tải xong bản mới! Đang tiến hành nâng cấp ngầm, ứng dụng sẽ tự động mở lại sau giây lát...',
          icon: fs.existsSync(iconPath) ? iconPath : undefined
        }).show();
      }
    } catch (e) {
      console.error('Không thể hiển thị Windows Notification:', e);
    }

    // Đợi 3.5 giây cho người dùng xem đếm ngược trên giao diện trước khi tự động đóng và nâng cấp
    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 3500);
  });

  autoUpdater.on('error', (err) => {
    console.error('Lỗi autoUpdater:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:error', {
        message: err ? (err.message || String(err)) : 'Không thể kết nối máy chủ cập nhật'
      });
    }
  });
}

// IPC: Auto Updater Handlers
ipcMain.handle('updater:check', async () => {
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: res ? res.updateInfo : null };
  } catch (err) {
    console.error('Lỗi khi check update:', err);
    return { error: err.message };
  }
});

ipcMain.handle('updater:start-download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi start download update:', err);
    return { error: err.message };
  }
});

// IPC: Lấy phiên bản ứng dụng
ipcMain.handle('app:get-version', () => app.getVersion());

// IPC: Chọn thư mục lưu xuất ảnh/PDF (dialog native Windows)
ipcMain.handle('dialog:pick-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Chọn thư mục lưu ảnh và PDF phiếu thu'
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  } catch (err) {
    console.error('Lỗi khi mở dialog chọn thư mục:', err);
    return null;
  }
});

// IPC: Đọc Cài đặt (baseFolder/<dataFolderName>/settings.json)
ipcMain.handle('settings:load', async () => {
  try {
    const pointer = getPointer();
    if (pointer && pointer.baseFolder) {
      const settingsFile = path.join(pointer.baseFolder, pointer.dataFolderName || 'data', 'settings.json');
      if (fs.existsSync(settingsFile)) {
        const content = fs.readFileSync(settingsFile, 'utf8');
        const parsed = JSON.parse(content);
        return {
          ...parsed,
          baseFolder: pointer.baseFolder
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Lỗi khi đọc settings:', err);
    return null;
  }
});

// IPC: Lưu Cài đặt (Tự động sao chép toàn bộ dữ liệu cũ sang folder mới ngay khi bấm Lưu Cài Đặt)
ipcMain.handle('settings:save', async (event, data) => {
  try {
    const newBaseFolder = data ? data.baseFolder : null;
    if (!newBaseFolder || typeof newBaseFolder !== 'string' || newBaseFolder.trim() === '') {
      return { error: 'Vui lòng chọn thư mục lưu!' };
    }

    const cleanNewBaseFolder = path.normalize(newBaseFolder.trim());

    // Đọc pointer.json cũ (nếu có) để tìm đường dẫn dữ liệu hiện tại
    const oldPointer = getPointer();
    const oldBaseFolder = oldPointer ? oldPointer.baseFolder : null;
    const oldDataFolderName = oldPointer ? (oldPointer.dataFolderName || 'data') : 'data';
    const oldPhieuThuFolderName = oldPointer ? (oldPointer.phieuThuFolderName || 'PhieuThu') : 'PhieuThu';

    // Đã có folder cũ hay chưa?
    let oldDataDir = null;
    let oldPhieuThuDir = null;

    if (oldBaseFolder) {
      oldDataDir = path.join(oldBaseFolder, oldDataFolderName);
      oldPhieuThuDir = path.join(oldBaseFolder, oldPhieuThuFolderName);
    }

    // Thư mục đích chuẩn
    const targetDataDir = path.join(cleanNewBaseFolder, 'data');
    const targetPTDir = path.join(cleanNewBaseFolder, 'PhieuThu');

    // Tạo các thư mục đích nếu chưa có
    if (!fs.existsSync(targetDataDir)) {
      fs.mkdirSync(targetDataDir, { recursive: true });
    }
    if (!fs.existsSync(targetPTDir)) {
      fs.mkdirSync(targetPTDir, { recursive: true });
    }

    // Sao chép toàn bộ dữ liệu data từ vị trí cũ sang folder mới (chỉ khi có oldBaseFolder khác targetDataDir)
    if (oldDataDir && fs.existsSync(oldDataDir) && path.normalize(oldDataDir) !== path.normalize(targetDataDir)) {
      copyDirSync(oldDataDir, targetDataDir);
    }

    // Sao chép toàn bộ ảnh/PDF phiếu thu đã xuất từ vị trí cũ sang folder mới
    if (oldPhieuThuDir && fs.existsSync(oldPhieuThuDir) && path.normalize(oldPhieuThuDir) !== path.normalize(targetPTDir)) {
      copyDirSync(oldPhieuThuDir, targetPTDir);
    }

    // Khởi tạo các file mặc định nếu thư mục đích chưa có (không bao giờ ghi đè nếu đã có dữ liệu)
    const targetRoomsFile = path.join(targetDataDir, 'rooms.json');
    if (!fs.existsSync(targetRoomsFile)) {
      fs.writeFileSync(targetRoomsFile, JSON.stringify(getDefaultRooms(), null, 2), 'utf8');
    }
    const targetResidentsFile = path.join(targetDataDir, 'residents.json');
    if (!fs.existsSync(targetResidentsFile)) {
      fs.writeFileSync(targetResidentsFile, JSON.stringify([], null, 2), 'utf8');
    }

    // Ghi pointer.json mới trỏ tới baseFolder vừa chọn
    const pointerObj = {
      baseFolder: cleanNewBaseFolder,
      dataFolderName: 'data',
      phieuThuFolderName: 'PhieuThu'
    };
    savePointer(pointerObj);

    // Ghi file settings.json mới (kèm appId) vào <newBaseFolder>/data/settings.json
    const settingsFile = path.join(targetDataDir, 'settings.json');
    const settingsToSave = {
      appId: 'phong-tro-app',
      ...data,
      baseFolder: cleanNewBaseFolder
    };
    fs.writeFileSync(settingsFile, JSON.stringify(settingsToSave, null, 2), 'utf8');

    return { success: true, baseFolder: cleanNewBaseFolder };
  } catch (err) {
    console.error('Lỗi khi ghi settings:', err);
    return { error: err.message };
  }
});

// IPC: Lưu Dữ liệu tháng (baseFolder/<dataFolderName>/history/YYYY-MM.json)
ipcMain.handle('month-data:save', async (event, monthKey, data) => {
  try {
    if (!monthKey || typeof monthKey !== 'string') {
      return { error: 'MonthKey không hợp lệ' };
    }
    const pointer = getPointer();
    if (!pointer || !pointer.baseFolder) {
      return { error: 'Chưa chọn thư mục lưu dữ liệu!' };
    }
    const historyDir = path.join(pointer.baseFolder, pointer.dataFolderName || 'data', 'history');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    const filePath = path.join(historyDir, `${monthKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath };
  } catch (err) {
    console.error('Lỗi khi ghi month-data:', err);
    return { error: err.message };
  }
});

// IPC: Đọc Dữ liệu tháng (baseFolder/<dataFolderName>/history/YYYY-MM.json)
ipcMain.handle('month-data:load', async (event, monthKey) => {
  try {
    if (!monthKey || typeof monthKey !== 'string') {
      return null;
    }
    const pointer = getPointer();
    if (!pointer || !pointer.baseFolder) {
      return null;
    }
    const historyDir = path.join(pointer.baseFolder, pointer.dataFolderName || 'data', 'history');
    const filePath = path.join(historyDir, `${monthKey}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    console.error('Lỗi khi đọc month-data:', err);
    return null;
  }
});

// Helper tạo danh sách 12 phòng mặc định trắng
function getDefaultRooms() {
  const defaultRoomNames = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B', '5B', '6B'];
  return defaultRoomNames.map(phong => ({
    phong,
    tenKhach: '',
    cmnd: '',
    chuPhong: null,
    thanhVien: []
  }));
}

// Helper lấy thư mục data hiện hành
function getActiveDataDir() {
  const pointer = getPointer();
  if (pointer && pointer.baseFolder) {
    const dir = path.join(pointer.baseFolder, pointer.dataFolderName || 'data');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    }
    return dir;
  }
  const defaultUserDataDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(defaultUserDataDir)) {
    try { fs.mkdirSync(defaultUserDataDir, { recursive: true }); } catch (e) {}
  }
  return defaultUserDataDir;
}

// Xóa ký tự không hợp lệ trong tên thư mục
function sanitizeFileName(str) {
  if (!str) return 'chua_dat_ten';
  return str.replace(/[\\/:*?"<>|]/g, '_').trim();
}

// IPC: Đọc danh sách người ở (residents.json)
ipcMain.handle('residents:load', async () => {
  try {
    const dataDir = getActiveDataDir();
    const filePath = path.join(dataDir, 'residents.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
  } catch (err) {
    console.error('Lỗi khi đọc residents.json:', err);
    return [];
  }
});

// IPC: Lưu danh sách người ở (residents.json) - CHỈ LƯU VÀO THƯ MỤC DỮ LIỆU CỦA USER
ipcMain.handle('residents:save', async (event, data) => {
  try {
    const dataDir = getActiveDataDir();
    const filePath = path.join(dataDir, 'residents.json');
    fs.writeFileSync(filePath, JSON.stringify(data || [], null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi lưu residents.json:', err);
    return { error: err.message };
  }
});

// IPC: Đọc danh sách phòng (rooms.json)
ipcMain.handle('rooms:load', async () => {
  try {
    const dataDir = getActiveDataDir();
    const filePath = path.join(dataDir, 'rooms.json');
    if (fs.existsSync(filePath)) {
      const rooms = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(rooms) && rooms.length > 0) {
        return rooms;
      }
    }
    return getDefaultRooms();
  } catch (err) {
    console.error('Lỗi khi đọc rooms.json:', err);
    return getDefaultRooms();
  }
});

// IPC: Lưu danh sách phòng (rooms.json) - CHỈ LƯU VÀO THƯ MỤC DỮ LIỆU CỦA USER
ipcMain.handle('rooms:save', async (event, data) => {
  try {
    const dataDir = getActiveDataDir();
    const filePath = path.join(dataDir, 'rooms.json');
    fs.writeFileSync(filePath, JSON.stringify(data || [], null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi lưu rooms.json:', err);
    return { error: err.message };
  }
});

// IPC: Chọn ảnh từ máy tính (mở dialog native)
ipcMain.handle('dialog:pick-image', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      title: 'Chọn ảnh CCCD (Mặt trước hoặc Mặt sau)',
      filters: [
        { name: 'Hình ảnh (*.jpg, *.png, *.webp)', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
      ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    const ext = path.extname(selectedPath).toLowerCase().replace('.', '') || 'jpeg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileBuffer = fs.readFileSync(selectedPath);
    const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
    return {
      filePath: selectedPath,
      fileName: path.basename(selectedPath),
      dataUrl
    };
  } catch (err) {
    console.error('Lỗi khi chọn ảnh:', err);
    return null;
  }
});

// IPC: Lưu ảnh CCCD vào thư mục theo cấu trúc: data/Thông tin người ở/[Số phòng]/[Tên người]_[4 số cuối CCCD]/
ipcMain.handle('cccd:save-image', async (event, { roomName, personName, cccd, type, dataUrl }) => {
  try {
    if (!dataUrl || !type) {
      return { error: 'Dữ liệu ảnh không hợp lệ' };
    }
    const dataDir = getActiveDataDir();
    const roomFolder = roomName ? sanitizeFileName(roomName) : '_Chưa xếp phòng';
    const last4 = cccd ? String(cccd).slice(-4) : '0000';
    const personFolder = `${sanitizeFileName(personName)}_${last4}`;

    const targetDir = path.join(dataDir, 'Thông tin người ở', roomFolder, personFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    let ext = 'jpg';
    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(dataUrl, 'base64');
    }

    const fileName = `${type}.${ext}`;
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, buffer);

    const relativePath = path.posix.join('Thông tin người ở', roomFolder, personFolder, fileName);
    return { success: true, relativePath, fileName };
  } catch (err) {
    console.error('Lỗi khi lưu ảnh CCCD:', err);
    return { error: err.message };
  }
});

// IPC: Di chuyển thư mục ảnh CCCD khi người đổi phòng hoặc đổi tên/CCCD
ipcMain.handle('cccd:move-folder', async (event, { oldRoom, newRoom, personName, cccd, oldPersonName, oldCccd }) => {
  try {
    const dataDir = getActiveDataDir();
    const oldRoomFolder = oldRoom ? sanitizeFileName(oldRoom) : '_Chưa xếp phòng';
    const newRoomFolder = newRoom ? sanitizeFileName(newRoom) : '_Chưa xếp phòng';
    const oldLast4 = oldCccd ? String(oldCccd).slice(-4) : (cccd ? String(cccd).slice(-4) : '0000');
    const newLast4 = cccd ? String(cccd).slice(-4) : '0000';
    const oldPersonFolder = `${sanitizeFileName(oldPersonName || personName)}_${oldLast4}`;
    const newPersonFolder = `${sanitizeFileName(personName)}_${newLast4}`;

    const oldDirPath = path.join(dataDir, 'Thông tin người ở', oldRoomFolder, oldPersonFolder);
    const newDirPath = path.join(dataDir, 'Thông tin người ở', newRoomFolder, newPersonFolder);

    if (fs.existsSync(oldDirPath) && path.normalize(oldDirPath) !== path.normalize(newDirPath)) {
      if (!fs.existsSync(path.dirname(newDirPath))) {
        fs.mkdirSync(path.dirname(newDirPath), { recursive: true });
      }
      fs.renameSync(oldDirPath, newDirPath);

      // Dọn dẹp phòng cũ nếu trống
      const oldRoomDir = path.dirname(oldDirPath);
      try {
        if (fs.existsSync(oldRoomDir) && fs.readdirSync(oldRoomDir).length === 0) {
          fs.rmdirSync(oldRoomDir);
        }
      } catch (e) {}

      return {
        success: true,
        newRelativeFolder: path.posix.join('Thông tin người ở', newRoomFolder, newPersonFolder)
      };
    }
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi di chuyển thư mục ảnh CCCD:', err);
    return { error: err.message };
  }
});

// IPC: Xóa thư mục ảnh CCCD khi người bị xóa
ipcMain.handle('cccd:delete-folder', async (event, { roomName, personName, cccd }) => {
  try {
    const dataDir = getActiveDataDir();
    const roomFolder = roomName ? sanitizeFileName(roomName) : '_Chưa xếp phòng';
    const last4 = cccd ? String(cccd).slice(-4) : '0000';
    const personFolder = `${sanitizeFileName(personName)}_${last4}`;

    const dirPath = path.join(dataDir, 'Thông tin người ở', roomFolder, personFolder);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }

    // Dọn phòng nếu rỗng
    const roomDir = path.dirname(dirPath);
    try {
      if (fs.existsSync(roomDir) && fs.readdirSync(roomDir).length === 0) {
        fs.rmdirSync(roomDir);
      }
    } catch (e) {}

    return { success: true };
  } catch (err) {
    console.error('Lỗi khi xóa thư mục ảnh CCCD:', err);
    return { error: err.message };
  }
});

// IPC: Đọc ảnh CCCD trả về dạng Data URL
ipcMain.handle('cccd:read-image', async (event, relativePath) => {
  try {
    if (!relativePath) return null;
    const dataDir = getActiveDataDir();
    const normalizedRel = relativePath.replace(/^data[\\/]/, '');
    const fullPath = path.isAbsolute(relativePath) ? relativePath : path.join(dataDir, normalizedRel);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const ext = path.extname(fullPath).toLowerCase().replace('.', '') || 'jpeg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const buffer = fs.readFileSync(fullPath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('Lỗi khi đọc ảnh CCCD:', err);
    return null;
  }
});

// IPC: Xuất Ảnh JPG (12 file) & PDF (1 file gộp) qua printToPDF + pdfjs-dist rasterizer
ipcMain.handle('export:receipts', async (event, monthKey, roomDataList) => {
  let receiptWin = null;
  let rasterWin = null;

  try {
    // 1. Kiểm tra pointer & settings.baseFolder
    const pointer = getPointer();
    if (!pointer || !pointer.baseFolder) {
      return { error: 'CHUA_CHON_THU_MUC', message: 'Vui lòng vào Cài đặt chung để chọn "Thư mục lưu ảnh/PDF" trước khi xuất!' };
    }
    const baseFolder = pointer.baseFolder;
    const dataFolderName = pointer.dataFolderName || 'data';
    const phieuThuFolderName = pointer.phieuThuFolderName || 'PhieuThu';

    const settingsFile = path.join(baseFolder, dataFolderName, 'settings.json');
    let settings = null;
    if (fs.existsSync(settingsFile)) {
      settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
    const dienThoai = settings ? settings.dienThoai : "0982 141 407";

    // 2. Tính toán đường dẫn thư mục xuất: <baseFolder>/<phieuThuFolderName>/Thang_<MM>_<YYYY>/
    const [yyyy, mm] = monthKey.split('-');
    const monthFolderName = `Thang_${mm}_${yyyy}`;
    const targetDir = path.join(baseFolder, phieuThuFolderName, monthFolderName);

    // 3. Kiểm tra file trùng và hỏi xác nhận 1 lần duy nhất nếu đã có file xuất cũ
    if (fs.existsSync(targetDir)) {
      const existingFiles = fs.readdirSync(targetDir);
      if (existingFiles.length > 0) {
        const confirm = await dialog.showMessageBox({
          type: 'question',
          buttons: ['Đồng ý', 'Hủy'],
          defaultId: 0,
          cancelId: 1,
          title: 'Xác nhận ghi đè',
          message: `Đã có dữ liệu xuất của tháng này (${monthFolderName}), ghi đè toàn bộ?`
        });
        if (confirm.response !== 0) {
          return { canceled: true, message: 'Hủy xuất theo yêu cầu người dùng' };
        }
      }
    }

    // 4. Tạo thư mục đích nếu chưa có
    fs.mkdirSync(targetDir, { recursive: true });

    // 5. Mở 2 cửa sổ ẩn: receiptWin (để render phiếu) và rasterWin (để chuyển PDF -> JPG)
    receiptWin = new BrowserWindow({
      show: false,
      width: 1123,
      height: 794,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    const receiptHtmlPath = path.join(PROJECT_ROOT, 'src', 'receipt', 'index.html');
    await receiptWin.loadFile(receiptHtmlPath);

    rasterWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    const rasterizerHtmlPath = path.join(__dirname, 'rasterizer.html');
    await rasterWin.loadFile(rasterizerHtmlPath);

    // Lấy pdf-lib module an toàn
    const { PDFDocument } = getPdfLib();

    // Chuẩn bị PDF document gộp
    const mergedPdf = await PDFDocument.create();
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 6. Lặp qua 12 phòng
    for (let i = 0; i < roomDataList.length; i++) {
      const rawRoomData = roomDataList[i];
      const formattedData = toReceiptData(rawRoomData, monthKey, dienThoai);

      // Gọi renderRoom(formattedData) trong receiptWin
      const script = `if (typeof renderRoom === 'function') { renderRoom(${JSON.stringify(formattedData)}); }`;
      await receiptWin.webContents.executeJavaScript(script);

      // Đợi 150ms cho DOM/layout cập nhật
      await delay(150);

      // Xuất PDF 1 trang từ receiptWin
      const pdfBuffer = await receiptWin.webContents.printToPDF({
        pageSize: 'A4',
        landscape: true,
        printBackground: true,
        margins: { marginType: 'none' }
      });

      // Chuyển trực tiếp PDF buffer sang JPG bằng pdfjs-dist trong rasterWin
      const base64Pdf = pdfBuffer.toString('base64');
      const dataUrl = await rasterWin.webContents.executeJavaScript(
        `window.rasterizePdfToJpeg(${JSON.stringify(base64Pdf)}, 3)`
      );
      const base64Jpg = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      // Ghi file JPG trực tiếp ra đĩa
      const jpgFileName = `Phong-${formattedData.phong}.jpg`;
      fs.writeFileSync(
        path.join(targetDir, jpgFileName),
        Buffer.from(base64Jpg, 'base64')
      );

      // Gộp trang PDF vào mergedPdf
      const singleDoc = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(singleDoc, singleDoc.getPageIndices());
      copiedPages.forEach(p => mergedPdf.addPage(p));

      // Gửi tiến trình về renderer
      event.sender.send('export:progress', { current: i + 1, total: roomDataList.length });
    }

    // 7. Gộp & lưu file PDF tổng: Thang_<MM>_<YYYY>.pdf
    const pdfFileName = `Thang_${mm}_${yyyy}.pdf`;
    const pdfBytes = await mergedPdf.save();
    fs.writeFileSync(path.join(targetDir, pdfFileName), pdfBytes);

    // 8. Tự động mở thư mục xuất cho người dùng xem
    shell.openPath(targetDir);

    return {
      success: true,
      monthFolderName,
      targetDir,
      jpgCount: roomDataList.length,
      pdfFile: pdfFileName
    };
  } catch (err) {
    console.error('Lỗi khi xuất ảnh/PDF phiếu thu:', err);
    return { error: err.message };
  } finally {
    if (receiptWin && !receiptWin.isDestroyed()) {
      receiptWin.close();
    }
    if (rasterWin && !rasterWin.isDestroyed()) {
      rasterWin.close();
    }
  }
});

// ============================================================
// ZALO INTEGRATION IPC HANDLERS
// ============================================================
const zaloManager = require('./zalo-manager');

ipcMain.handle('zalo:get-status', async () => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  const status = zaloManager.getStatus();
  if (!status.connected) {
    // Thử restore nếu chưa restore
    return await zaloManager.restoreSession(baseFolder);
  }
  return status;
});

ipcMain.handle('zalo:start-qr-login', async (event) => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  return await zaloManager.startQrLogin(event.sender, baseFolder);
});

ipcMain.handle('zalo:abort-qr-login', async () => {
  zaloManager.abortQrLogin();
  return { success: true };
});

ipcMain.handle('zalo:retry-qr-login', async (event) => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  return await zaloManager.retryQrLogin(event.sender, baseFolder);
});

ipcMain.handle('zalo:logout', async () => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  zaloManager.clearSession(baseFolder);
  return { success: true };
});

ipcMain.handle('zalo:send-receipts', async (event, { monthKey, roomTasks, appSettings }) => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : (appSettings ? appSettings.baseFolder : '');
  if (!baseFolder) {
    return { error: 'CHUA_CHON_THU_MUC', message: 'Chưa chọn thư mục lưu dữ liệu!' };
  }

  const onProgress = (progressData) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('zalo:send-progress', progressData);
    }
  };

  try {
    return await zaloManager.sendReceipts({ monthKey, baseFolder, roomTasks, appSettings }, onProgress);
  } catch (err) {
    console.error('Lỗi khi thực hiện gửi phiếu thu Zalo:', err);
    return { error: 'SEND_FAILED', message: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  // Khôi phục phiên Zalo ngầm lúc khởi động
  setTimeout(async () => {
    try {
      const pointer = getPointer();
      const baseFolder = pointer ? pointer.baseFolder : '';
      await zaloManager.restoreSession(baseFolder);
    } catch (e) {
      console.warn('Lỗi khi khôi phục session Zalo ngầm:', e);
    }
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


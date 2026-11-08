const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const activityLogger = require('./activity-logger');

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
    const oldPointer = getPointer();
    const oldBaseFolder = oldPointer ? oldPointer.baseFolder : null;
    let newBaseFolder = data ? data.baseFolder : null;
    if (!newBaseFolder || typeof newBaseFolder !== 'string' || newBaseFolder.trim() === '') {
      newBaseFolder = oldBaseFolder;
    }
    if (!newBaseFolder || typeof newBaseFolder !== 'string' || newBaseFolder.trim() === '') {
      return { error: 'Vui lòng chọn thư mục lưu!' };
    }

    const cleanNewBaseFolder = path.normalize(newBaseFolder.trim());

    // Đọc pointer.json cũ (nếu có) để tìm đường dẫn dữ liệu hiện tại
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
      const preTargetLogs = activityLogger.readLogsFromDataDirSync(targetDataDir);
      copyDirSync(oldDataDir, targetDataDir);
      const migrateRes = await activityLogger.migrateLogsOnBaseFolderChange(
        oldDataDir,
        targetDataDir,
        oldBaseFolder,
        cleanNewBaseFolder,
        app.getVersion(),
        preTargetLogs
      );
      if (!migrateRes || !migrateRes.ok) {
        return { error: `Không thể di chuyển Nhật Ký Hoạt Động sang thư mục mới: ${(migrateRes && migrateRes.error) || 'Lỗi không xác định'}` };
      }
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
    let existingSettings = {};
    if (fs.existsSync(settingsFile)) {
      try {
        existingSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      } catch (e) {
        console.error('Lỗi khi đọc settings cũ:', e);
      }
    }
    const settingsToSave = {
      appId: 'phong-tro-app',
      ...existingSettings,
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

// ============================================================
// KHÓA DỮ LIỆU THÁNG ĐÃ LƯU & XUẤT (baseFolder/<dataFolderName>/month-locks.json)
// Lưu riêng file, KHÔNG thay đổi định dạng history/YYYY-MM.json (tương thích ngược 100%)
// ============================================================
const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;

function getMonthLocksFilePath(pointer) {
  return path.join(pointer.baseFolder, pointer.dataFolderName || 'data', 'month-locks.json');
}

function normalizeMonthLocksData(raw) {
  const result = { version: 1, months: {}, legacyScanned: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  if (raw.months && typeof raw.months === 'object' && !Array.isArray(raw.months)) {
    Object.keys(raw.months).forEach(key => {
      const entry = raw.months[key];
      if (MONTH_KEY_REGEX.test(key) && entry && typeof entry === 'object') {
        result.months[key] = entry;
      }
    });
  }
  if (Array.isArray(raw.legacyScanned)) {
    result.legacyScanned = raw.legacyScanned.filter(k => typeof k === 'string' && MONTH_KEY_REGEX.test(k));
  }
  return result;
}

// Liệt kê các tháng đã thực sự nhập dữ liệu và xuất file phiếu thu (.jpg/.pdf) trong PhieuThu/Thang_MM_YYYY
function listExportedMonthKeys(pointer) {
  const keys = [];
  try {
    const ptDir = path.join(pointer.baseFolder, pointer.phieuThuFolderName || 'PhieuThu');
    const historyDir = path.join(pointer.baseFolder, pointer.dataFolderName || 'data', 'history');
    if (!fs.existsSync(ptDir)) return keys;
    fs.readdirSync(ptDir, { withFileTypes: true }).forEach(dirent => {
      if (!dirent.isDirectory()) return;
      const m = /^Thang_(\d{2})_(\d{4})$/.exec(dirent.name);
      if (!m) return;
      const targetMonthDir = path.join(ptDir, dirent.name);
      const files = fs.readdirSync(targetMonthDir);
      if (!files.some(f => /\.(jpg|jpeg|pdf)$/i.test(f))) return;

      const monthKey = `${m[2]}-${m[1]}`;
      // Chỉ coi là tháng đã xuất dữ liệu nếu file lịch sử tháng đó tồn tại và đã có nhập chỉ số mới
      const historyFile = path.join(historyDir, `${monthKey}.json`);
      if (!fs.existsSync(historyFile)) return;
      try {
        const histRaw = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        const rooms = Array.isArray(histRaw) ? histRaw : (histRaw && Array.isArray(histRaw.rooms) ? histRaw.rooms : []);
        const hasEnteredData = rooms.some(r => r && (
          (r.dienMoi !== '' && r.dienMoi !== null && r.dienMoi !== undefined && Number(r.dienMoi) > 0) ||
          (r.nuocMoi !== '' && r.nuocMoi !== null && r.nuocMoi !== undefined && Number(r.nuocMoi) > 0)
        ));
        if (!hasEnteredData) return;
      } catch (histErr) {
        return;
      }

      keys.push(monthKey);
    });
  } catch (err) {
    console.error('Lỗi khi quét thư mục phiếu thu đã xuất:', err);
  }
  return keys.sort();
}

// IPC: Đọc trạng thái khóa các tháng + danh sách tháng đã có file xuất
ipcMain.handle('month-locks:load', async () => {
  try {
    const pointer = getPointer();
    if (!pointer || !pointer.baseFolder) {
      return { ok: false, data: normalizeMonthLocksData(null), exportedMonths: [] };
    }
    const filePath = getMonthLocksFilePath(pointer);
    let raw = null;
    if (fs.existsSync(filePath)) {
      try {
        raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (parseErr) {
        console.error('File month-locks.json bị lỗi định dạng:', parseErr);
        return { ok: false, error: 'FILE_LOI_DINH_DANG', data: normalizeMonthLocksData(null), exportedMonths: listExportedMonthKeys(pointer) };
      }
    }
    return { ok: true, data: normalizeMonthLocksData(raw), exportedMonths: listExportedMonthKeys(pointer) };
  } catch (err) {
    console.error('Lỗi khi đọc month-locks:', err);
    return { ok: false, error: err.message, data: normalizeMonthLocksData(null), exportedMonths: [] };
  }
});

// IPC: Ghi trạng thái khóa các tháng (ghi file tạm rồi đổi tên để tránh hỏng file)
ipcMain.handle('month-locks:save', async (event, data) => {
  try {
    const pointer = getPointer();
    if (!pointer || !pointer.baseFolder) {
      return { error: 'Chưa chọn thư mục lưu dữ liệu!' };
    }
    const normalized = normalizeMonthLocksData(data);
    const filePath = getMonthLocksFilePath(pointer);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi ghi month-locks:', err);
    return { error: err.message };
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

// IPC: Xuất Danh Sách Người Thuê ra file Excel (.xlsx) lưu trực tiếp vào BaseFolder
const excelService = require('./excel-service');
const monthExcelService = require('./month-excel-service');

ipcMain.handle('residents:export-excel', async (event, payload = {}) => {
  try {
    const pointer = getPointer();
    const baseFolder = (pointer && pointer.baseFolder) || (payload && payload.baseFolder) || '';
    const dataFolderName = (pointer && pointer.dataFolderName) || 'data';
    return await excelService.exportResidentsToExcel({
      baseFolder,
      dataFolderName
    });
  } catch (err) {
    console.error('Lỗi khi xuất Excel danh sách người thuê:', err);
    return {
      success: false,
      code: 'UNEXPECTED_ERROR',
      message: `Lỗi hệ thống khi xuất Excel: ${err && err.message ? err.message : String(err)}`
    };
  }
});

// IPC: Xuất Bảng Dữ Liệu Tháng ra file Excel (.xlsx) lưu trực tiếp vào BaseFolder
ipcMain.handle('month:export-excel', async (event, payload = {}) => {
  try {
    const pointer = getPointer();
    const baseFolder = (pointer && pointer.baseFolder) || (payload && payload.baseFolder) || '';
    return await monthExcelService.exportMonthDataToExcel({
      baseFolder,
      monthKey: payload.monthKey || '',
      roomsData: payload.roomsData || []
    });
  } catch (err) {
    console.error('Lỗi khi xuất Excel bảng dữ liệu tháng:', err);
    return {
      success: false,
      code: 'UNEXPECTED_ERROR',
      message: `Lỗi hệ thống khi xuất Excel: ${err && err.message ? err.message : String(err)}`
    };
  }
});

ipcMain.handle('residents:show-excel-in-folder', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { ok: false, message: 'Không tìm thấy file Excel trên ổ đĩa.' };
    }
    shell.showItemInFolder(path.normalize(filePath));
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('excel:open-file', async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { ok: false, message: 'Không tìm thấy file Excel trên ổ đĩa để mở.' };
    }
    const errMsg = await shell.openPath(path.normalize(filePath));
    if (errMsg) {
      return { ok: false, message: `Không thể mở file Excel: ${errMsg}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err && err.message ? err.message : String(err) };
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

// ============================================================
// BACKUP DATA (LOCAL ZIP + GOOGLE DRIVE API) IPC HANDLERS
// ============================================================
const backupConfig = require('./backup-config');
const googleDriveService = require('./google-drive-service');
const backupManager = require('./backup-manager');

ipcMain.handle('backup:get-state', async (event, payload = {}) => {
  const pointer = getPointer();
  const baseFolder = (pointer && pointer.baseFolder) || (payload && payload.baseFolder) || '';
  const runHealthCheck = Boolean(payload && payload.runHealthCheck);
  return await backupManager.getBackupSystemState(baseFolder, runHealthCheck);
});

ipcMain.handle('backup:check-health', async () => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  return await backupManager.getBackupSystemState(baseFolder, true);
});

ipcMain.handle('backup:google-login', async () => {
  try {
    const pointer = getPointer();
    const baseFolder = pointer ? pointer.baseFolder : '';
    await googleDriveService.startOAuthLogin();
    const state = await backupManager.getBackupSystemState(baseFolder, true);
    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'LOGIN_ERROR',
      message: err.message || 'Đăng nhập Google Drive thất bại.'
    };
  }
});

ipcMain.handle('backup:google-cancel-login', async () => {
  return googleDriveService.cancelOAuthLogin();
});

ipcMain.handle('backup:google-logout', async () => {
  const pointer = getPointer();
  const baseFolder = pointer ? pointer.baseFolder : '';
  googleDriveService.disconnectGoogleAccount();
  const state = await backupManager.getBackupSystemState(baseFolder, false);
  return { ok: true, state };
});

ipcMain.handle('backup:configure-folder', async (event, rawInput) => {
  try {
    const pointer = getPointer();
    const baseFolder = pointer ? pointer.baseFolder : '';
    const res = await googleDriveService.configureTargetDriveFolder(rawInput);
    const state = await backupManager.getBackupSystemState(baseFolder, true);
    return { ok: true, ...res, state };
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'FOLDER_ERROR',
      message: err.message || 'Không thể cấu hình thư mục Google Drive.'
    };
  }
});

ipcMain.handle('backup:rename-folder', async (event, newName) => {
  try {
    const pointer = getPointer();
    const baseFolder = pointer ? pointer.baseFolder : '';
    const res = await googleDriveService.renameTargetDriveFolder(newName);
    const state = await backupManager.getBackupSystemState(baseFolder, true);
    return { ok: true, ...res, state };
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'RENAME_FOLDER_ERROR',
      message: err.message || 'Không thể đổi tên thư mục trên Google Drive.'
    };
  }
});

ipcMain.handle('backup:save-oauth-client', async (event, payload) => {
  try {
    const pointer = getPointer();
    const baseFolder = pointer ? pointer.baseFolder : '';
    const saved = backupConfig.saveOAuthClientCredentials(payload);
    const state = await backupManager.getBackupSystemState(baseFolder, false);
    return { ok: true, clientId: saved.clientId, state };
  } catch (err) {
    return { ok: false, message: err.message };
  }
});

ipcMain.handle('backup:pick-oauth-json', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Chọn file JSON OAuth Client (credentials.json) tải từ Google Cloud Console',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    const saved = backupConfig.saveOAuthClientCredentials(parsed);
    const pointer = getPointer();
    const baseFolder = pointer ? pointer.baseFolder : '';
    const state = await backupManager.getBackupSystemState(baseFolder, false);
    return { ok: true, clientId: saved.clientId, state };
  } catch (err) {
    return { ok: false, message: `File JSON không hợp lệ: ${err.message}` };
  }
});

ipcMain.handle('backup:start', async (event, payload = {}) => {
  const pointer = getPointer();
  const baseFolder = (pointer && pointer.baseFolder) || (payload && payload.baseFolder) || '';
  const sendProgress = (prog) => {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('backup:progress', prog);
    }
  };
  return await backupManager.executeFullBackup({ baseFolder, sendProgress });
});

ipcMain.handle('backup:open-local-folder', async (event, payload = {}) => {
  const pointer = getPointer();
  const baseFolder = (pointer && pointer.baseFolder) || (payload && payload.baseFolder) || '';
  if (!baseFolder || !fs.existsSync(baseFolder)) {
    return { ok: false, message: 'Chưa cấu hình hoặc không tìm thấy thư mục dữ liệu gốc (BaseFolder).' };
  }
  const backupDataDir = path.join(path.resolve(baseFolder), 'BackupData');
  if (!fs.existsSync(backupDataDir)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
  }
  await shell.openPath(backupDataDir);
  return { ok: true, path: backupDataDir };
});

ipcMain.handle('backup:open-drive-folder', async () => {
  const config = backupConfig.loadBackupConfig();
  const folderId = config.driveBackupDataFolderId || config.targetDriveFolderId;
  const url = folderId
    ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`
    : 'https://drive.google.com/drive/my-drive';
  await shell.openExternal(url);
  return { ok: true, url };
});

// ============================================================
// NHẬT KÝ HOẠT ĐỘNG (ACTIVITY LOG) IPC HANDLERS
// ============================================================
ipcMain.handle('activity-logs:load', async () => {
  const pointer = getPointer();
  return await activityLogger.loadActivityLogs(pointer);
});

ipcMain.handle('activity-logs:append', async (event, payload = {}) => {
  const pointer = getPointer();
  return await activityLogger.appendActivityLog(pointer, payload, app.getVersion());
});

ipcMain.handle('activity-logs:dismiss-notice', async () => {
  const pointer = getPointer();
  return await activityLogger.dismissCorruptedLogNotice(pointer);
});

ipcMain.handle('activity-logs:preserve-on-restore', async (event, payload = {}) => {
  const pointer = getPointer();
  const preRestoreLogs = Array.isArray(payload.preRestoreLogs) ? payload.preRestoreLogs : [];
  const restoreMetadata = (payload.restoreMetadata && typeof payload.restoreMetadata === 'object') ? payload.restoreMetadata : {};
  return await activityLogger.preserveLogsAfterBackupRestore(pointer, preRestoreLogs, restoreMetadata, app.getVersion());
});

ipcMain.handle('activity-logs:export-json', async () => {
  try {
    const pointer = getPointer();
    const res = await activityLogger.loadActivityLogs(pointer);
    const logs = (res && Array.isArray(res.logs)) ? res.logs : [];

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const defaultName = `NhatKyHoatDong_${ts}.json`;
    const defaultDir = (pointer && pointer.baseFolder) ? pointer.baseFolder : app.getPath('desktop');

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Xuất Nhật Ký Hoạt Động ra file JSON',
      defaultPath: path.join(defaultDir, defaultName),
      filters: [{ name: 'JSON File (*.json)', extensions: ['json'] }]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    const exportPayload = {
      exportedAt: now.toISOString(),
      exportedAtVn: activityLogger.formatTimeVn(now),
      appVersion: `v${app.getVersion()}`,
      totalEvents: logs.length,
      logs
    };

    fs.writeFileSync(filePath, JSON.stringify(exportPayload, null, 2), 'utf8');
    shell.showItemInFolder(filePath);
    return { ok: true, filePath, count: logs.length };
  } catch (err) {
    console.error('Lỗi khi xuất file JSON nhật ký:', err);
    return { ok: false, error: err.message };
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


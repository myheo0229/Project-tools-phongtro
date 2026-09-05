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
    } else {
      // Nếu chưa có pointer.json (lần đầu chọn folder), kiểm tra dữ liệu mặc định cũ (nếu có)
      const legacyPortable = process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data') : null;
      const legacyProject = path.join(PROJECT_ROOT, 'data');
      if (legacyPortable && fs.existsSync(legacyPortable)) {
        oldDataDir = legacyPortable;
      } else if (fs.existsSync(legacyProject)) {
        oldDataDir = legacyProject;
      }
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

    // Sao chép LẬP TỨC toàn bộ dữ liệu data (history, settings...) từ vị trí cũ sang folder mới
    if (oldDataDir && fs.existsSync(oldDataDir) && path.normalize(oldDataDir) !== path.normalize(targetDataDir)) {
      copyDirSync(oldDataDir, targetDataDir);
    }

    // Sao chép LẬP TỨC toàn bộ ảnh/PDF phiếu thu đã xuất từ vị trí cũ sang folder mới
    if (oldPhieuThuDir && fs.existsSync(oldPhieuThuDir) && path.normalize(oldPhieuThuDir) !== path.normalize(targetPTDir)) {
      copyDirSync(oldPhieuThuDir, targetPTDir);
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

// ==========================================
// QUẢN LÝ PHÒNG & NGƯỜI Ở (DATA & CCCD PHOTOS)
// ==========================================

function getDataDir() {
  const pointer = getPointer();
  if (pointer && pointer.baseFolder) {
    return path.join(pointer.baseFolder, pointer.dataFolderName || 'data');
  }
  const legacyPortable = process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data') : null;
  if (legacyPortable && fs.existsSync(legacyPortable)) {
    return legacyPortable;
  }
  return path.join(PROJECT_ROOT, 'data');
}

const DEFAULT_ROOM_IDS = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];

function readRoomsData() {
  const dataDir = getDataDir();
  const roomsFile = path.join(dataDir, 'rooms.json');
  let rooms = [];
  if (fs.existsSync(roomsFile)) {
    try {
      const content = fs.readFileSync(roomsFile, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        rooms = parsed.map(r => ({
          id: r.id || r.phong,
          phong: r.phong || r.id,
          chuPhongId: r.chuPhongId || null,
          thanhVienIds: Array.isArray(r.thanhVienIds) ? r.thanhVienIds : []
        }));
      }
    } catch (e) {
      console.error('Lỗi đọc rooms.json:', e);
    }
  }
  // Đảm bảo đủ 12 phòng mặc định
  for (const rid of DEFAULT_ROOM_IDS) {
    if (!rooms.some(r => r.phong === rid || r.id === rid)) {
      rooms.push({ id: rid, phong: rid, chuPhongId: null, thanhVienIds: [] });
    }
  }
  return rooms;
}

function writeRoomsData(rooms) {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const roomsFile = path.join(dataDir, 'rooms.json');
  fs.writeFileSync(roomsFile, JSON.stringify(rooms, null, 2), 'utf8');
}

function readPersonsData() {
  const dataDir = getDataDir();
  const personsFile = path.join(dataDir, 'persons.json');
  if (fs.existsSync(personsFile)) {
    try {
      const content = fs.readFileSync(personsFile, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Lỗi đọc persons.json:', e);
    }
  }
  return [];
}

function writePersonsData(persons) {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const personsFile = path.join(dataDir, 'persons.json');
  fs.writeFileSync(personsFile, JSON.stringify(persons, null, 2), 'utf8');
}

function getPersonFolderRelPath(person, allPersons = []) {
  const safeName = (person.hoTen || 'NguoiO').replace(/[/\\?%*:|"<>]/g, '').trim() || 'NguoiO';
  const cccd4 = person.soCCCD && person.soCCCD.length >= 4 ? person.soCCCD.slice(-4) : (person.id ? person.id.slice(-4) : '0000');
  
  if (person.phongId && person.phongId.trim() !== '') {
    const pId = person.phongId.trim();
    const sameRoomPersons = allPersons.filter(p => p.phongId === pId && p.id !== person.id);
    const hasSameName = sameRoomPersons.some(p => (p.hoTen || '').trim().toLowerCase() === (person.hoTen || '').trim().toLowerCase());
    const folderName = hasSameName ? `${safeName} (CCCD ${cccd4})` : safeName;
    return path.join('Thông tin người ở', pId, folderName);
  } else {
    const folderName = `${safeName}_${cccd4}`;
    return path.join('Thông tin người ở', '_ChuaXepPhong', folderName);
  }
}

function saveBase64Image(targetFilePath, base64Data) {
  const dir = path.dirname(targetFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(targetFilePath, Buffer.from(cleanBase64, 'base64'));
}

function movePersonPhotoFolder(oldAbsPath, newAbsPath) {
  if (!oldAbsPath || !fs.existsSync(oldAbsPath) || path.normalize(oldAbsPath) === path.normalize(newAbsPath)) return;
  const newParent = path.dirname(newAbsPath);
  if (!fs.existsSync(newParent)) {
    fs.mkdirSync(newParent, { recursive: true });
  }
  try {
    if (!fs.existsSync(newAbsPath)) {
      fs.renameSync(oldAbsPath, newAbsPath);
    } else {
      copyDirSync(oldAbsPath, newAbsPath);
      fs.rmSync(oldAbsPath, { recursive: true, force: true });
    }
    // Dọn dẹp thư mục cha cũ nếu rỗng
    const oldParent = path.dirname(oldAbsPath);
    if (fs.existsSync(oldParent) && fs.readdirSync(oldParent).length === 0) {
      fs.rmdirSync(oldParent);
    }
  } catch (err) {
    console.error('Lỗi khi di chuyển thư mục ảnh CCCD:', err);
  }
}

// IPC: Đọc danh sách người ở
ipcMain.handle('persons:load', async () => {
  try {
    return readPersonsData();
  } catch (err) {
    console.error('Lỗi persons:load:', err);
    return [];
  }
});

// IPC: Lưu hoặc Cập nhật thông tin Người ở
ipcMain.handle('persons:save', async (event, personData) => {
  try {
    if (!personData || !personData.hoTen || !personData.soCCCD) {
      return { error: 'Thiếu thông tin bắt buộc (Họ tên, CCCD)!' };
    }

    const dataDir = getDataDir();
    let persons = readPersonsData();
    let rooms = readRoomsData();

    const isNew = !personData.id;
    const personId = personData.id || `per_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    let existingPerson = persons.find(p => p.id === personId);
    let oldRelFolder = existingPerson ? getPersonFolderRelPath(existingPerson, persons) : null;
    let oldAbsFolder = oldRelFolder ? path.join(dataDir, oldRelFolder) : null;

    // Chuẩn bị object người ở mới
    const updatedPerson = {
      id: personId,
      hoTen: (personData.hoTen || '').trim(),
      sdtGoi: (personData.sdtGoi || '').trim(),
      sdtZalo: (personData.sdtZalo || '').trim(),
      email: (personData.email || '').trim(),
      soCCCD: (personData.soCCCD || '').trim(),
      ngaySinh: (personData.ngaySinh || '').trim(),
      gioiTinh: personData.gioiTinh || 'Nam',
      queQuan: (personData.queQuan || '').trim(),
      queQuanOcr: personData.queQuanOcr || {
        tinhThanh: '',
        quanHuyen: '',
        phuongXa: '',
        diaChiChiTiet: '',
        raw: (personData.queQuan || '').trim()
      },
      ngayVaoO: (personData.ngayVaoO || '').trim(),
      phongId: (personData.phongId || '').trim() || null,
      anhCCCDMatTruoc: existingPerson ? (existingPerson.anhCCCDMatTruoc || '') : '',
      anhCCCDMatSau: existingPerson ? (existingPerson.anhCCCDMatSau || '') : '',
      createdAt: existingPerson ? existingPerson.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Xác định thư mục ảnh mới
    const tempPersonsList = persons.filter(p => p.id !== personId).concat([updatedPerson]);
    const newRelFolder = getPersonFolderRelPath(updatedPerson, tempPersonsList);
    const newAbsFolder = path.join(dataDir, newRelFolder);

    // Di chuyển folder cũ sang folder mới nếu đổi phòng hoặc đổi tên
    if (oldAbsFolder && oldAbsFolder !== newAbsFolder && fs.existsSync(oldAbsFolder)) {
      movePersonPhotoFolder(oldAbsFolder, newAbsFolder);
    }

    if (!fs.existsSync(newAbsFolder)) {
      fs.mkdirSync(newAbsFolder, { recursive: true });
    }

    // Xử lý ảnh mặt trước
    if (personData.frontImageBase64) {
      const frontFileName = 'cccd_mat_truoc.jpg';
      const frontAbsPath = path.join(newAbsFolder, frontFileName);
      saveBase64Image(frontAbsPath, personData.frontImageBase64);
      updatedPerson.anhCCCDMatTruoc = path.join(newRelFolder, frontFileName).replace(/\\/g, '/');
    } else if (personData.removeFrontImage) {
      if (updatedPerson.anhCCCDMatTruoc) {
        const p = path.join(dataDir, updatedPerson.anhCCCDMatTruoc);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      updatedPerson.anhCCCDMatTruoc = '';
    } else if (updatedPerson.anhCCCDMatTruoc && oldRelFolder && oldRelFolder !== newRelFolder) {
      // Cập nhật lại đường dẫn tương đối sau khi di chuyển thư mục
      const baseName = path.basename(updatedPerson.anhCCCDMatTruoc);
      updatedPerson.anhCCCDMatTruoc = path.join(newRelFolder, baseName).replace(/\\/g, '/');
    }

    // Xử lý ảnh mặt sau
    if (personData.backImageBase64) {
      const backFileName = 'cccd_mat_sau.jpg';
      const backAbsPath = path.join(newAbsFolder, backFileName);
      saveBase64Image(backAbsPath, personData.backImageBase64);
      updatedPerson.anhCCCDMatSau = path.join(newRelFolder, backFileName).replace(/\\/g, '/');
    } else if (personData.removeBackImage) {
      if (updatedPerson.anhCCCDMatSau) {
        const p = path.join(dataDir, updatedPerson.anhCCCDMatSau);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      updatedPerson.anhCCCDMatSau = '';
    } else if (updatedPerson.anhCCCDMatSau && oldRelFolder && oldRelFolder !== newRelFolder) {
      const baseName = path.basename(updatedPerson.anhCCCDMatSau);
      updatedPerson.anhCCCDMatSau = path.join(newRelFolder, baseName).replace(/\\/g, '/');
    }

    // Cập nhật vào persons.json
    if (isNew) {
      persons.push(updatedPerson);
    } else {
      const idx = persons.findIndex(p => p.id === personId);
      if (idx !== -1) persons[idx] = updatedPerson;
      else persons.push(updatedPerson);
    }
    writePersonsData(persons);

    // Đồng bộ phòng trong rooms.json
    const newPhongId = updatedPerson.phongId;
    const oldPhongId = existingPerson ? existingPerson.phongId : null;

    if (oldPhongId && oldPhongId !== newPhongId) {
      const oldRoom = rooms.find(r => r.phong === oldPhongId || r.id === oldPhongId);
      if (oldRoom) {
        if (oldRoom.chuPhongId === personId) oldRoom.chuPhongId = null;
        oldRoom.thanhVienIds = (oldRoom.thanhVienIds || []).filter(id => id !== personId);
      }
    }

    if (newPhongId) {
      // Gỡ khỏi các phòng khác nếu có
      rooms.forEach(r => {
        if (r.phong !== newPhongId && r.id !== newPhongId) {
          if (r.chuPhongId === personId) r.chuPhongId = null;
          r.thanhVienIds = (r.thanhVienIds || []).filter(id => id !== personId);
        }
      });
      // Thêm vào phòng mới
      const targetRoom = rooms.find(r => r.phong === newPhongId || r.id === newPhongId);
      if (targetRoom) {
        if (targetRoom.chuPhongId !== personId && !(targetRoom.thanhVienIds || []).includes(personId)) {
          targetRoom.thanhVienIds = targetRoom.thanhVienIds || [];
          targetRoom.thanhVienIds.push(personId);
        }
      }
    } else {
      // Gỡ khỏi mọi phòng
      rooms.forEach(r => {
        if (r.chuPhongId === personId) r.chuPhongId = null;
        r.thanhVienIds = (r.thanhVienIds || []).filter(id => id !== personId);
      });
    }
    writeRoomsData(rooms);

    return { success: true, person: updatedPerson };
  } catch (err) {
    console.error('Lỗi persons:save:', err);
    return { error: err.message };
  }
});

// IPC: Xóa 1 hoặc nhiều Người ở (Hard Delete + Xóa thư mục ảnh)
ipcMain.handle('persons:delete', async (event, ids) => {
  try {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { error: 'Danh sách ID không hợp lệ' };
    }

    const dataDir = getDataDir();
    let persons = readPersonsData();
    let rooms = readRoomsData();

    ids.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person) {
        const relFolder = getPersonFolderRelPath(person, persons);
        const absFolder = path.join(dataDir, relFolder);
        if (fs.existsSync(absFolder)) {
          try {
            fs.rmSync(absFolder, { recursive: true, force: true });
            // Dọn dẹp thư mục cha nếu rỗng
            const parentDir = path.dirname(absFolder);
            if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
              fs.rmdirSync(parentDir);
            }
          } catch (e) {
            console.error('Lỗi xóa thư mục ảnh người:', e);
          }
        }
      }

      // Gỡ khỏi rooms.json
      rooms.forEach(r => {
        if (r.chuPhongId === id) r.chuPhongId = null;
        r.thanhVienIds = (r.thanhVienIds || []).filter(memId => memId !== id);
      });
    });

    persons = persons.filter(p => !ids.includes(p.id));
    writePersonsData(persons);
    writeRoomsData(rooms);

    return { success: true, count: ids.length };
  } catch (err) {
    console.error('Lỗi persons:delete:', err);
    return { error: err.message };
  }
});

// IPC: Đọc danh sách Phòng
ipcMain.handle('rooms:load', async () => {
  try {
    const rooms = readRoomsData();
    const persons = readPersonsData();
    return { rooms, persons };
  } catch (err) {
    console.error('Lỗi rooms:load:', err);
    return { rooms: [], persons: [] };
  }
});

// IPC: Cập nhật phân bổ phòng (Chủ phòng & Thành viên)
ipcMain.handle('rooms:save-assignment', async (event, { roomId, chuPhongId, thanhVienIds }) => {
  try {
    if (!roomId) return { error: 'Thiếu roomId' };

    const dataDir = getDataDir();
    let rooms = readRoomsData();
    let persons = readPersonsData();

    const targetRoom = rooms.find(r => r.phong === roomId || r.id === roomId);
    if (!targetRoom) return { error: 'Không tìm thấy phòng ' + roomId };

    // Tập hợp người mới của phòng
    const newMembersInThisRoom = Array.from(new Set([chuPhongId, ...(thanhVienIds || [])].filter(Boolean)));

    // Những người trước đây ở phòng này nhưng giờ bị gỡ
    const oldMembersInThisRoom = Array.from(new Set([targetRoom.chuPhongId, ...(targetRoom.thanhVienIds || [])].filter(Boolean)));
    const removedMemberIds = oldMembersInThisRoom.filter(id => !newMembersInThisRoom.includes(id));

    // Cập nhật target room
    targetRoom.chuPhongId = chuPhongId || null;
    targetRoom.thanhVienIds = (thanhVienIds || []).filter(id => id !== chuPhongId);

    // Xử lý các người được thêm / giữ lại ở phòng này
    newMembersInThisRoom.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person) {
        const oldRelFolder = getPersonFolderRelPath(person, persons);
        const oldAbsFolder = path.join(dataDir, oldRelFolder);

        person.phongId = roomId;
        person.updatedAt = new Date().toISOString();

        const newRelFolder = getPersonFolderRelPath(person, persons);
        const newAbsFolder = path.join(dataDir, newRelFolder);

        if (oldAbsFolder !== newAbsFolder && fs.existsSync(oldAbsFolder)) {
          movePersonPhotoFolder(oldAbsFolder, newAbsFolder);
          if (person.anhCCCDMatTruoc) {
            person.anhCCCDMatTruoc = path.join(newRelFolder, path.basename(person.anhCCCDMatTruoc)).replace(/\\/g, '/');
          }
          if (person.anhCCCDMatSau) {
            person.anhCCCDMatSau = path.join(newRelFolder, path.basename(person.anhCCCDMatSau)).replace(/\\/g, '/');
          }
        }
      }
    });

    // Xử lý các người bị gỡ khỏi phòng này (trở về _ChuaXepPhong)
    removedMemberIds.forEach(id => {
      const person = persons.find(p => p.id === id);
      if (person && person.phongId === roomId) {
        const oldRelFolder = getPersonFolderRelPath(person, persons);
        const oldAbsFolder = path.join(dataDir, oldRelFolder);

        person.phongId = null;
        person.updatedAt = new Date().toISOString();

        const newRelFolder = getPersonFolderRelPath(person, persons);
        const newAbsFolder = path.join(dataDir, newRelFolder);

        if (oldAbsFolder !== newAbsFolder && fs.existsSync(oldAbsFolder)) {
          movePersonPhotoFolder(oldAbsFolder, newAbsFolder);
          if (person.anhCCCDMatTruoc) {
            person.anhCCCDMatTruoc = path.join(newRelFolder, path.basename(person.anhCCCDMatTruoc)).replace(/\\/g, '/');
          }
          if (person.anhCCCDMatSau) {
            person.anhCCCDMatSau = path.join(newRelFolder, path.basename(person.anhCCCDMatSau)).replace(/\\/g, '/');
          }
        }
      }
    });

    writeRoomsData(rooms);
    writePersonsData(persons);

    return { success: true, rooms, persons };
  } catch (err) {
    console.error('Lỗi rooms:save-assignment:', err);
    return { error: err.message };
  }
});

// IPC: Gỡ 1 hoặc nhiều người khỏi phòng
ipcMain.handle('rooms:remove-members', async (event, roomId, memberIds) => {
  try {
    if (!roomId || !memberIds || !Array.isArray(memberIds)) {
      return { error: 'Dữ liệu không hợp lệ' };
    }

    const dataDir = getDataDir();
    let rooms = readRoomsData();
    let persons = readPersonsData();

    const targetRoom = rooms.find(r => r.phong === roomId || r.id === roomId);
    if (!targetRoom) return { error: 'Không tìm thấy phòng' };

    memberIds.forEach(id => {
      if (targetRoom.chuPhongId === id) targetRoom.chuPhongId = null;
      targetRoom.thanhVienIds = (targetRoom.thanhVienIds || []).filter(mId => mId !== id);

      const person = persons.find(p => p.id === id);
      if (person) {
        const oldRelFolder = getPersonFolderRelPath(person, persons);
        const oldAbsFolder = path.join(dataDir, oldRelFolder);

        person.phongId = null;
        person.updatedAt = new Date().toISOString();

        const newRelFolder = getPersonFolderRelPath(person, persons);
        const newAbsFolder = path.join(dataDir, newRelFolder);

        if (oldAbsFolder !== newAbsFolder && fs.existsSync(oldAbsFolder)) {
          movePersonPhotoFolder(oldAbsFolder, newAbsFolder);
          if (person.anhCCCDMatTruoc) {
            person.anhCCCDMatTruoc = path.join(newRelFolder, path.basename(person.anhCCCDMatTruoc)).replace(/\\/g, '/');
          }
          if (person.anhCCCDMatSau) {
            person.anhCCCDMatSau = path.join(newRelFolder, path.basename(person.anhCCCDMatSau)).replace(/\\/g, '/');
          }
        }
      }
    });

    writeRoomsData(rooms);
    writePersonsData(persons);

    return { success: true, rooms, persons };
  } catch (err) {
    console.error('Lỗi rooms:remove-members:', err);
    return { error: err.message };
  }
});

// IPC: Chọn file ảnh từ máy tính (qua dialog native)
ipcMain.handle('dialog:pick-image', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Chọn ảnh CCCD',
      properties: ['openFile'],
      filters: [
        { name: 'Hình ảnh', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }
      ]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

    return { filePath, base64 };
  } catch (err) {
    console.error('Lỗi dialog:pick-image:', err);
    return null;
  }
});

// IPC: Đọc ảnh từ ổ đĩa dạng base64 để hiển thị
ipcMain.handle('image:read-base64', async (event, relOrAbsPath) => {
  try {
    if (!relOrAbsPath) return null;
    const dataDir = getDataDir();
    const absPath = path.isAbsolute(relOrAbsPath) ? relOrAbsPath : path.join(dataDir, relOrAbsPath);
    if (!fs.existsSync(absPath)) return null;

    const ext = path.extname(absPath).replace('.', '').toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const fileBuffer = fs.readFileSync(absPath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Lỗi image:read-base64:', err);
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

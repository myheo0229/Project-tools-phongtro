const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
}

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

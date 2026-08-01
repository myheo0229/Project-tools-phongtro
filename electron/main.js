const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

const PROJECT_ROOT = path.join(__dirname, '..');

// Xác định thư mục lưu trữ dữ liệu
const getDataRoot = () => {
  // Khi chạy bản Portable, biến môi trường này sẽ chứa đường dẫn tới thư mục đặt file .exe
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  // Mặc định (lúc dev) thì lưu trong thư mục project
  return PROJECT_ROOT;
};

const DATA_ROOT = getDataRoot();
const DATA_DIR = path.join(DATA_ROOT, 'data', 'history');
const SETTINGS_FILE = path.join(DATA_ROOT, 'data', 'settings.json');

const { toReceiptData } = require(path.join(PROJECT_ROOT, 'src', 'shared', 'format.js'));

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `Màn Hình Nhập Liệu - Quản Lý Phòng Trọ v${app.getVersion()}`,
    icon: path.join(PROJECT_ROOT, 'assets', 'icon', 'icon32x32.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
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

// IPC: Đọc Cài đặt (data/settings.json)
ipcMain.handle('settings:load', async () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(content);
    }
    return null;
  } catch (err) {
    console.error('Lỗi khi đọc settings:', err);
    return null;
  }
});

// IPC: Lưu Cài đặt (data/settings.json)
ipcMain.handle('settings:save', async (event, data) => {
  try {
    const dirPath = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Lỗi khi ghi settings:', err);
    return { error: err.message };
  }
});

// IPC: Lưu Dữ liệu tháng (data/history/YYYY-MM.json)
ipcMain.handle('month-data:save', async (event, monthKey, data) => {
  try {
    if (!monthKey || typeof monthKey !== 'string') {
      return { error: 'MonthKey không hợp lệ' };
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = path.join(DATA_DIR, `${monthKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath };
  } catch (err) {
    console.error('Lỗi khi ghi month-data:', err);
    return { error: err.message };
  }
});

// IPC: Đọc Dữ liệu tháng (data/history/YYYY-MM.json)
ipcMain.handle('month-data:load', async (event, monthKey) => {
  try {
    if (!monthKey || typeof monthKey !== 'string') {
      return null;
    }
    const filePath = path.join(DATA_DIR, `${monthKey}.json`);
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
    // 1. Kiểm tra settings.baseFolder
    let settings = null;
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
    const baseFolder = settings ? settings.baseFolder : null;
    if (!baseFolder) {
      return { error: 'CHUA_CHON_THU_MUC', message: 'Vui lòng vào Cài đặt chung để chọn "Thư mục lưu ảnh/PDF" trước khi xuất!' };
    }

    const dienThoai = settings ? settings.dienThoai : "0982 141 407";

    // 2. Tính toán đường dẫn thư mục xuất: <baseFolder>/PhieuThu/Thang_<MM>_<YYYY>/
    const [yyyy, mm] = monthKey.split('-');
    const monthFolderName = `Thang_${mm}_${yyyy}`;
    const targetDir = path.join(baseFolder, 'PhieuThu', monthFolderName);

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

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { Zalo, LoginQRCallbackEventType, ZaloApiLoginQRAborted, ZaloApiLoginQRDeclined } = require('zca-js');

/**
 * Hàm lấy metadata ảnh (chiều cao, chiều rộng, kích thước) bằng sharp cho zca-js v2+
 */
async function imageMetadataGetter(filePath) {
  const data = await fs.promises.readFile(filePath);
  const metadata = await sharp(data).metadata();
  return {
    height: metadata.height,
    width: metadata.width,
    size: metadata.size || data.length,
  };
}

class ZaloManager {
  constructor() {
    this.zalo = new Zalo({
      logging: true,
      imageMetadataGetter
    });
    this.api = null;
    this.currentProfile = null;
    this.currentActions = null; // { retry, abort } từ callback loginQR
    this.isLoginInProgress = false;
    this.sessionFilePath = path.join(app.getPath('userData'), 'zalo_session.json');
  }

  /**
   * Lấy đường dẫn file session dự phòng theo baseFolder (nếu có)
   */
  getBackupSessionPath(baseFolder) {
    if (!baseFolder || typeof baseFolder !== 'string' || baseFolder.trim() === '') return null;
    return path.join(baseFolder, 'data', 'zalo_session.json');
  }

  /**
   * Đọc session đã lưu
   */
  loadSavedSession(baseFolder) {
    // 1. Thử đọc từ userData
    try {
      if (fs.existsSync(this.sessionFilePath)) {
        const raw = fs.readFileSync(this.sessionFilePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Lỗi đọc session từ userData:', err.message);
    }

    // 2. Thử đọc từ backup trong baseFolder
    const backupPath = this.getBackupSessionPath(baseFolder);
    if (backupPath) {
      try {
        if (fs.existsSync(backupPath)) {
          const raw = fs.readFileSync(backupPath, 'utf8');
          return JSON.parse(raw);
        }
      } catch (err) {
        console.warn('Lỗi đọc session từ backup baseFolder:', err.message);
      }
    }

    return null;
  }

  /**
   * Lưu session xuống đĩa (userData và baseFolder)
   */
  saveSession(sessionData, baseFolder) {
    try {
      const dir = path.dirname(this.sessionFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.sessionFilePath, JSON.stringify(sessionData, null, 2), 'utf8');
    } catch (err) {
      console.error('Lỗi khi lưu session vào userData:', err);
    }

    const backupPath = this.getBackupSessionPath(baseFolder);
    if (backupPath) {
      try {
        const dir = path.dirname(backupPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(backupPath, JSON.stringify(sessionData, null, 2), 'utf8');
      } catch (err) {
        console.error('Lỗi khi lưu session vào baseFolder:', err);
      }
    }
  }

  /**
   * Xóa session khi Đăng xuất
   */
  clearSession(baseFolder) {
    this.api = null;
    this.currentProfile = null;
    this.currentActions = null;
    this.isLoginInProgress = false;

    try {
      if (fs.existsSync(this.sessionFilePath)) {
        fs.unlinkSync(this.sessionFilePath);
      }
    } catch (err) {
      console.warn('Lỗi xóa session trong userData:', err.message);
    }

    const backupPath = this.getBackupSessionPath(baseFolder);
    if (backupPath) {
      try {
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
      } catch (err) {
        console.warn('Lỗi xóa session trong baseFolder:', err.message);
      }
    }
  }

  /**
   * Khôi phục session ngầm lúc khởi động ứng dụng
   */
  async restoreSession(baseFolder) {
    const session = this.loadSavedSession(baseFolder);
    if (!session || !session.credentials) {
      return { connected: false, profile: null };
    }

    try {
      console.log('Đang thử khôi phục phiên Zalo từ session đã lưu...');
      const api = await this.zalo.login(session.credentials);
      this.api = api;

      // Lấy thông tin tài khoản mới nhất
      let profile = session.profile || null;
      try {
        const accInfo = await api.fetchAccountInfo();
        if (accInfo && accInfo.profile) {
          profile = {
            userId: accInfo.profile.userId,
            displayName: accInfo.profile.displayName || accInfo.profile.zaloName || "Người dùng Zalo",
            avatar: accInfo.profile.avatar || "",
            phoneNumber: accInfo.profile.phoneNumber || ""
          };
          // Cập nhật lại session với profile mới
          this.saveSession({ ...session, profile }, baseFolder);
        }
      } catch (e) {
        console.warn('Không thể fetchAccountInfo khi restore session, dùng profile lưu tạm:', e.message);
      }

      this.currentProfile = profile;
      console.log('Khôi phục phiên Zalo thành công cho tài khoản:', profile ? profile.displayName : 'Unknown');
      return {
        connected: true,
        profile: this.currentProfile
      };
    } catch (err) {
      console.warn('Khôi phục session Zalo thất bại (session hết hạn hoặc lỗi mạng):', err.message);
      this.api = null;
      this.currentProfile = null;
      // Nếu session hết hạn rõ ràng, có thể xóa session cũ
      return {
        connected: false,
        profile: null,
        error: err.message
      };
    }
  }

  /**
   * Bắt đầu phiên Đăng nhập hoặc Đổi tài khoản bằng mã QR
   * @param {Electron.WebContents} webContents - Dùng để gửi event thời gian thực về renderer
   * @param {string} baseFolder - Thư mục lưu trữ người dùng
   */
  async startQrLogin(webContents, baseFolder) {
    if (this.isLoginInProgress) {
      console.log('Đang có tiến trình QR chạy dở, tiến hành hủy tiến trình cũ trước khi tạo mới...');
      this.abortQrLogin();
    }

    this.isLoginInProgress = true;
    let credentialsCaptured = null;

    const emitEvent = (type, data = null, error = null) => {
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('zalo:qr-event', { type, data, error });
      }
    };

    return new Promise(async (resolve) => {
      try {
        emitEvent('generating', { message: 'Đang tạo mã QR...' });

        const api = await this.zalo.loginQR({
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          language: "vi"
        }, (event) => {
          this.currentActions = event.actions;

          switch (event.type) {
            case LoginQRCallbackEventType.QRCodeGenerated: {
              const qrBase64 = event.data.image;
              const qrDataUrl = qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
              emitEvent('qr_generated', {
                image: qrDataUrl,
                code: event.data.code
              });
              break;
            }

            case LoginQRCallbackEventType.QRCodeScanned: {
              emitEvent('qr_scanned', {
                avatar: event.data.avatar,
                displayName: event.data.display_name
              });
              break;
            }

            case LoginQRCallbackEventType.QRCodeExpired: {
              emitEvent('qr_expired', {
                message: 'Mã QR đã hết hạn. Vui lòng bấm Tạo mã mới để tiếp tục.'
              });
              break;
            }

            case LoginQRCallbackEventType.QRCodeDeclined: {
              emitEvent('qr_declined', {
                message: 'Đăng nhập bị từ chối từ ứng dụng Zalo trên điện thoại.'
              });
              break;
            }

            case LoginQRCallbackEventType.GotLoginInfo: {
              credentialsCaptured = {
                cookie: event.data.cookie,
                imei: event.data.imei,
                userAgent: event.data.userAgent,
                language: 'vi'
              };
              emitEvent('confirming', {
                message: 'Đã xác nhận đăng nhập, đang thiết lập phiên...'
              });
              break;
            }

            default:
              break;
          }
        });

        this.api = api;
        this.isLoginInProgress = false;
        this.currentActions = null;

        // Lấy thông tin tài khoản vừa đăng nhập thành công
        let profile = {
          displayName: 'Tài khoản Zalo',
          avatar: '',
          phoneNumber: ''
        };

        try {
          const accInfo = await api.fetchAccountInfo();
          if (accInfo && accInfo.profile) {
            profile = {
              userId: accInfo.profile.userId,
              displayName: accInfo.profile.displayName || accInfo.profile.zaloName || "Người dùng Zalo",
              avatar: accInfo.profile.avatar || "",
              phoneNumber: accInfo.profile.phoneNumber || ""
            };
          }
        } catch (e) {
          console.warn('Lỗi khi fetchAccountInfo sau khi login QR:', e);
        }

        this.currentProfile = profile;

        // Lưu session xuống file
        if (credentialsCaptured) {
          this.saveSession({
            credentials: credentialsCaptured,
            profile: profile,
            savedAt: Date.now()
          }, baseFolder);
        }

        emitEvent('success', {
          profile: profile
        });

        resolve({
          success: true,
          profile: profile
        });
      } catch (err) {
        this.isLoginInProgress = false;
        this.currentActions = null;

        if (err instanceof ZaloApiLoginQRAborted || (err.message && err.message.includes('aborted'))) {
          console.log('Người dùng đã hủy phiên quét QR Zalo.');
          emitEvent('aborted', { message: 'Đã hủy đăng nhập.' });
          resolve({ canceled: true });
        } else if (err instanceof ZaloApiLoginQRDeclined || (err.message && err.message.includes('declined'))) {
          console.log('Phiên QR bị từ chối.');
          emitEvent('qr_declined', { message: 'Yêu cầu đăng nhập bị từ chối.' });
          resolve({ error: 'TU_CHOI_DANG_NHAP', message: 'Bạn đã từ chối đăng nhập trên điện thoại.' });
        } else {
          console.error('Lỗi trong quá trình đăng nhập QR Zalo:', err);
          let userMsg = 'Không thể kết nối tới máy chủ Zalo. Vui lòng kiểm tra lại kết nối Internet!';
          if (err.message && (err.message.includes('locked') || err.message.includes('banned') || err.message.includes('block'))) {
            userMsg = 'Tài khoản Zalo này hiện đang bị tạm khóa hoặc hạn chế tính năng.';
          }
          emitEvent('error', {
            error: err.message,
            message: userMsg
          });
          resolve({ error: 'LOI_DANG_NHAP', message: userMsg, rawError: err.message });
        }
      }
    });
  }

  /**
   * Hủy tiến trình đăng nhập QR hiện tại (khi bấm x hoặc Hủy)
   */
  abortQrLogin() {
    if (this.currentActions && typeof this.currentActions.abort === 'function') {
      try {
        this.currentActions.abort();
      } catch (e) {
        console.warn('Lỗi khi gọi actions.abort():', e.message);
      }
    }
    this.currentActions = null;
    this.isLoginInProgress = false;
  }

  /**
   * Thử lại / Tạo mã mới khi QR hết hạn hoặc bị từ chối
   */
  retryQrLogin(webContents, baseFolder) {
    if (this.currentActions && typeof this.currentActions.retry === 'function') {
      try {
        this.currentActions.retry();
        return { retrying: true };
      } catch (e) {
        console.warn('Lỗi khi gọi actions.retry(), sẽ tạo lại phiên mới:', e.message);
      }
    }
    return this.startQrLogin(webContents, baseFolder);
  }

  /**
   * Lấy trạng thái hiện tại
   */
  getStatus() {
    return {
      connected: !!this.api,
      profile: this.currentProfile,
      isLoginInProgress: this.isLoginInProgress
    };
  }

  /**
   * Tải ảnh VietQR về file tạm
   */
  async downloadVietQrImage(url, destPath) {
    const https = require('https');
    const http = require('http');
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return this.downloadVietQrImage(response.headers.location, destPath).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`Tải mã VietQR thất bại (HTTP ${response.statusCode})`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(destPath));
        });
      });
      req.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
      req.setTimeout(10000, () => {
        req.destroy(new Error('Timeout khi tải ảnh VietQR (quá 10s)'));
      });
    });
  }

  /**
   * Gửi phiếu thu tự động cho các phòng đã chọn qua Zalo
   * @param {Object} payload { monthKey, baseFolder, roomTasks, appSettings }
   * @param {Function} onProgress Callback cập nhật tiến trình ({ current, total, phong })
   */
  async sendReceipts({ monthKey, baseFolder, roomTasks, appSettings }, onProgress) {
    if (!this.api) {
      throw new Error('Chưa kết nối tài khoản Zalo hoặc phiên đăng nhập đã hết hạn!');
    }

    if (!Array.isArray(roomTasks) || roomTasks.length === 0) {
      return { total: 0, successCount: 0, failedCount: 0, results: [] };
    }

    const [yyyy, mm] = monthKey.split('-');
    const monthFolderName = `Thang_${mm}_${yyyy}`;
    const phieuThuDir = path.join(baseFolder, 'PhieuThu', monthFolderName);

    // Tra cứu thông tin ngân hàng
    let banksMap = {};
    try {
      banksMap = require('../src/shared/banks-data.js');
    } catch (e) {
      console.warn('Không thể load banks-data.js:', e.message);
    }

    let bankInfo = null;
    if (appSettings && appSettings.bankName) {
      bankInfo = banksMap[appSettings.bankName] || Object.values(banksMap).find(b =>
        b.id === appSettings.bankName || b.code === appSettings.bankName || b.bin === appSettings.bankName
      );
    }

    const hasBankConfig = bankInfo && appSettings.bankAccount && appSettings.bankOwner;
    const bankShortName = bankInfo ? (bankInfo.shortName || bankInfo.name || appSettings.bankName) : (appSettings.bankName || '');
    const bankBin = bankInfo ? (bankInfo.bin || bankInfo.code || appSettings.bankName) : (appSettings.bankName || '');
    const bankAccount = appSettings ? (appSettings.bankAccount || '') : '';
    const bankOwner = appSettings ? (appSettings.bankOwner || '') : '';

    const results = [];
    const total = roomTasks.length;

    for (let i = 0; i < roomTasks.length; i++) {
      const task = roomTasks[i];
      const current = i + 1;

      if (typeof onProgress === 'function') {
        onProgress({ current, total, phong: task.phong });
      }

      console.log(`[Zalo Send] (${current}/${total}) Bắt đầu gửi cho Phòng ${task.phong}...`);

      const sendSingleRoomTask = async () => {
        // 1. Tìm người dùng Zalo qua SĐT
        let cleanPhone = String(task.sdtZalo || task.sdtGoi || '').replace(/\D/g, '');
        if (!cleanPhone) {
          throw new Error('Chủ phòng chưa có Số điện thoại Zalo hợp lệ.');
        }

        const user = await this.api.findUser(cleanPhone);
        if (!user || (!user.uid && !user.userId)) {
          throw new Error(`SĐT [${cleanPhone}] chưa đăng ký tài khoản Zalo hoặc không tìm thấy.`);
        }
        const targetUid = String(user.uid || user.userId);

        // 2. Kiểm tra file ảnh phiếu thu đã xuất
        const receiptImgPath = path.join(phieuThuDir, `Phong-${task.phong}.jpg`);
        if (!fs.existsSync(receiptImgPath)) {
          throw new Error(`Chưa tìm thấy file ảnh phiếu thu (Phong-${task.phong}.jpg). Vui lòng bấm 'Lưu & Xuất' trước khi gửi Zalo.`);
        }

        // Bước 1: Gửi ảnh phiếu thu
        console.log(`[Zalo Send] Phòng ${task.phong}: Gửi ảnh phiếu thu...`);
        await this.api.sendMessage({ msg: "", attachments: [receiptImgPath] }, targetUid);

        // Delay nhỏ giữa các bước (0.2s - 1.0s)
        const intraDelay1 = Math.floor(Math.random() * 800) + 200;
        await new Promise(r => setTimeout(r, intraDelay1));

        // Bước 2: Gửi ảnh mã VietQR (nếu có cấu hình ngân hàng)
        if (hasBankConfig && task.tongCong > 0) {
          let tempQrPath = null;
          try {
            const noiDungCK = `${task.tenChuPhong || ''} phong ${task.phong} thang ${mm}/${yyyy}`;
            const qrUrl = `https://img.vietqr.io/image/${bankBin}-${bankAccount}-compact2.png?amount=${task.tongCong}&addInfo=${encodeURIComponent(noiDungCK)}&accountName=${encodeURIComponent(bankOwner)}`;
            
            tempQrPath = path.join(app.getPath('temp'), `vietqr_${task.phong}_${Date.now()}.png`);
            console.log(`[Zalo Send] Phòng ${task.phong}: Tải và gửi mã VietQR...`);
            await this.downloadVietQrImage(qrUrl, tempQrPath);
            await this.api.sendMessage({ msg: "", attachments: [tempQrPath] }, targetUid);
          } catch (qrErr) {
            console.warn(`[Zalo Send] Lỗi khi tạo/gửi VietQR cho phòng ${task.phong}:`, qrErr.message);
            // Tiếp tục gửi tin nhắn text dù VietQR gặp lỗi tải
          } finally {
            if (tempQrPath && fs.existsSync(tempQrPath)) {
              try { fs.unlinkSync(tempQrPath); } catch (e) { }
            }
          }

          // Delay nhỏ giữa các bước (0.2s - 1.0s)
          const intraDelay2 = Math.floor(Math.random() * 800) + 200;
          await new Promise(r => setTimeout(r, intraDelay2));
        }

        // Bước 3: Gửi tin nhắn text theo đúng mẫu
        const formatMoney = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);
        let textMsg = "";

        if (hasBankConfig) {
          textMsg = `📋 HÓA ĐƠN PHÒNG ${task.phong} - THÁNG ${mm}/${yyyy}

💰 TỔNG: ${formatMoney(task.tongCong)} đ

💳 THÔNG TIN CHUYỂN KHOẢN
- Ngân hàng: ${bankShortName}
- Số tài khoản: ${bankAccount}
- Chủ tài khoản: ${bankOwner}
- ND CK: ${task.tenChuPhong || ''} phòng ${task.phong} tháng ${mm}/${yyyy}

(Chi tiết xem ảnh phiếu thu đính kèm)`;
        } else {
          textMsg = `📋 HÓA ĐƠN PHÒNG ${task.phong} - THÁNG ${mm}/${yyyy}

💰 TỔNG: ${formatMoney(task.tongCong)} đ

(Chi tiết xem ảnh phiếu thu đính kèm)`;
        }

        console.log(`[Zalo Send] Phòng ${task.phong}: Gửi tin nhắn text...`);
        await this.api.sendMessage({ msg: textMsg }, targetUid);
      };

      // Bảo vệ timeout 15 giây cho mỗi phòng
      try {
        await Promise.race([
          sendSingleRoomTask(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Hết thời gian chờ xử lý (Timeout 15s)')), 15000))
        ]);

        results.push({
          phong: task.phong,
          tenChuPhong: task.tenChuPhong,
          sdt: task.sdtZalo || task.sdtGoi,
          tongCong: task.tongCong,
          success: true
        });
        console.log(`[Zalo Send] ✅ Gửi thành công cho Phòng ${task.phong}!`);
      } catch (err) {
        console.error(`[Zalo Send] ❌ Gửi thất bại cho Phòng ${task.phong}:`, err.message);
        results.push({
          phong: task.phong,
          tenChuPhong: task.tenChuPhong,
          sdt: task.sdtZalo || task.sdtGoi,
          tongCong: task.tongCong,
          success: false,
          error: err.message
        });
      }

      // Anti-ban delay giữa các phòng (3.0s - 4.5s) nếu còn phòng tiếp theo
      if (i < roomTasks.length - 1) {
        const antiBanDelay = Math.floor(Math.random() * 1500) + 3000;
        console.log(`[Zalo Send] Nghỉ an toàn ${antiBanDelay}ms trước khi gửi phòng tiếp theo...`);
        await new Promise(r => setTimeout(r, antiBanDelay));
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return {
      total,
      successCount,
      failedCount,
      results
    };
  }
}

module.exports = new ZaloManager();

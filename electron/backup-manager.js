const fs = require('fs');
const path = require('path');

const {
  loadBackupConfig,
  saveBackupConfig,
  getOAuthClientCredentials
} = require('./backup-config');

const {
  generateUniqueZipFileName,
  createFullBackupZip,
  verifyZipIntegrity
} = require('./zip-service');

const {
  checkInternetConnectivity,
  checkDriveHealth,
  ensureDriveBackupDataFolder,
  uploadZipFileToDrive,
  verifyUploadedZipOnDrive
} = require('./google-drive-service');

let isBackupRunning = false;

/**
 * Định dạng hiển thị dung lượng (KB / MB / GB)
 * @param {number} bytes
 */
function formatBytes(bytes) {
  const num = Number(bytes) || 0;
  if (num <= 0) return '0 B';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam DD/MM/YYYY HH:mm:ss
 * @param {Date} [date]
 */
function formatVnDateTime(date = new Date()) {
  /** @param {number | string} n */
  const pad2 = (n) => String(n).padStart(2, '0');
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/**
 * Kiểm tra dung lượng ổ cứng local còn đủ không
 * @param {string} dirPath
 * @param {number} [minRequiredBytes]
 */
function checkLocalDiskSpace(dirPath, minRequiredBytes = 20 * 1024 * 1024) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(dirPath);
      const freeBytes = Number(stats.bavail) * Number(stats.bsize);
      if (freeBytes > 0 && freeBytes < minRequiredBytes) {
        return {
          ok: false,
          freeBytes,
          message: `Ổ đĩa máy tính chỉ còn trống ${formatBytes(freeBytes)}, không đủ dung lượng để tạo file nén ZIP.`
        };
      }
      return { ok: true, freeBytes };
    }
  } catch (_) {}
  return { ok: true, freeBytes: null };
}

/**
 * Lấy trạng thái tổng hợp hiện tại của hệ thống Backup để hiển thị lên UI Settings
 * @param {string} [currentBaseFolder]
 * @param {boolean} [runHealthCheck]
 */
async function getBackupSystemState(currentBaseFolder = '', runHealthCheck = false) {
  const config = loadBackupConfig(currentBaseFolder);
  const creds = getOAuthClientCredentials();
  const hasOAuthClient = Boolean(creds && creds.clientId);

  /** @type {any} */
  let health = null;
  if (runHealthCheck) {
    health = await checkDriveHealth().catch((err) => ({
      status: 'error',
      statusText: 'Kết nối thất bại',
      healthy: false,
      email: '',
      displayName: '',
      targetDriveFolderName: '',
      warnings: [err.message]
    }));
  }

  return {
    isBackupRunning,
    hasOAuthClient,
    oauthClientIdPreview: hasOAuthClient ? `${creds.clientId.slice(0, 14)}...` : '',
    baseFolder: currentBaseFolder || '',
    localBackupFolderPath: config.localBackupFolderPath || (currentBaseFolder ? path.join(currentBaseFolder, 'BackupData') : ''),
    connectedEmail: (health && health.email) || config.connectedEmail || '',
    connectedName: (health && health.displayName) || config.connectedName || '',
    targetDriveFolderId: config.targetDriveFolderId || '',
    targetDriveFolderName: (health && health.targetDriveFolderName) || config.targetDriveFolderName || '',
    driveBackupDataFolderId: config.driveBackupDataFolderId || '',
    lastBackupInfo: config.lastBackupInfo || null,
    health
  };
}

/**
 * Quy trình Backup Data hoàn chỉnh 7 giai đoạn:
 * 1. Đang kiểm tra cấu hình
 * 2. Đang chuẩn bị dữ liệu (Tạo/Kiểm tra BaseFolder/BackupData)
 * 3. Đang nén ZIP (Loại trừ tuyệt đối BaseFolder/BackupData)
 * 4. Đang lưu ZIP local & Kiểm tra CRC32
 * 5. Đang kết nối Google Drive & Kiểm tra/Tạo thư mục BackupData trên Drive
 * 6. Đang upload (Resumable Upload trực tiếp)
 * 7. Đang xác minh -> Thành công / Thất bại
 */
async function executeFullBackup({ baseFolder, sendProgress }) {
  if (isBackupRunning) {
    return {
      ok: false,
      code: 'ALREADY_RUNNING',
      message: 'Đang có một tiến trình sao lưu dữ liệu đang chạy. Vui lòng đợi hoàn tất.'
    };
  }

  isBackupRunning = true;
  const startedAtDate = new Date();
  const startedAtText = formatVnDateTime(startedAtDate);

  /**
   * @param {string} stepKey
   * @param {string} stepLabel
   * @param {string} detailText
   * @param {number} percent
   */
  const emitStep = (stepKey, stepLabel, detailText, percent) => {
    if (typeof sendProgress === 'function') {
      sendProgress({
        stepKey,
        stepLabel,
        detailText,
        percent: Math.max(0, Math.min(100, Math.round(percent)))
      });
    }
  };

  let createdZipInfo = null;

  try {
    // =========================================================================
    // GIAI ĐOẠN 1: ĐANG KIỂM TRA CẤU HÌNH
    // =========================================================================
    emitStep('checking_config', 'Đang kiểm tra cấu hình', 'Đang kiểm tra thư mục dữ liệu gốc (BaseFolder) và dung lượng ổ đĩa...', 5);

    if (!baseFolder || typeof baseFolder !== 'string' || !baseFolder.trim()) {
      throw new Error('Chưa cấu hình thư mục dữ liệu gốc (BaseFolder). Vui lòng chọn "Thư mục lưu ảnh & PDF phiếu thu" trước khi Backup.');
    }

    const resolvedBaseFolder = path.resolve(baseFolder.trim());
    if (!fs.existsSync(resolvedBaseFolder) || !fs.statSync(resolvedBaseFolder).isDirectory()) {
      throw new Error(`Thư mục dữ liệu gốc không tồn tại hoặc không hợp lệ: "${resolvedBaseFolder}". Vui lòng chọn lại thư mục.`);
    }

    const diskSpace = checkLocalDiskSpace(resolvedBaseFolder);
    if (!diskSpace.ok) {
      throw new Error(diskSpace.message);
    }

    // =========================================================================
    // GIAI ĐOẠN 2: ĐANG CHUẨN BỊ DỮ LIỆU & THƯ MỤC BACKUPDATA LOCAL
    // =========================================================================
    emitStep('preparing_data', 'Đang chuẩn bị dữ liệu', 'Đang kiểm tra và khởi tạo thư mục BaseFolder/BackupData...', 12);

    const localBackupDataDir = path.join(resolvedBaseFolder, 'BackupData');
    if (!fs.existsSync(localBackupDataDir)) {
      fs.mkdirSync(localBackupDataDir, { recursive: true });
    }

    saveBackupConfig({ localBackupFolderPath: localBackupDataDir });
    const zipFileName = generateUniqueZipFileName(localBackupDataDir, startedAtDate);

    // =========================================================================
    // GIAI ĐOẠN 3: ĐANG NÉN ZIP TOÀN BỘ DỮ LIỆU (LOẠI TRỪ BACKUPDATA)
    // =========================================================================
    emitStep('compressing_zip', 'Đang nén ZIP', `Đang tạo bản sao nhất quán và nén dữ liệu vào ${zipFileName}...`, 18);

    createdZipInfo = await createFullBackupZip({
      baseFolder: resolvedBaseFolder,
      backupDataDir: localBackupDataDir,
      zipFileName,
      onProgress: ({ currentFileIndex, totalFiles, currentFile, percent }) => {
        const mappedPercent = 18 + Math.round((percent / 100) * 27); // 18% -> 45%
        emitStep(
          'compressing_zip',
          'Đang nén ZIP',
          `Đang nén (${currentFileIndex}/${totalFiles}): ${currentFile}`,
          mappedPercent
        );
      }
    });

    // =========================================================================
    // GIAI ĐOẠN 4: ĐANG LƯU ZIP LOCAL & KIỂM TRA TÍNH TOÀN VẸN CRC32
    // =========================================================================
    emitStep(
      'saving_local',
      'Đang lưu ZIP local',
      `Đang kiểm tra tính toàn vẹn CRC32 của ${createdZipInfo.zipFileName} (${formatBytes(createdZipInfo.zipSizeBytes)})...`,
      48
    );

    const integrity = await verifyZipIntegrity(createdZipInfo.zipFilePath);
    if (!integrity || !integrity.valid) {
      throw new Error('File ZIP sau khi nén không vượt qua bài kiểm tra toàn vẹn CRC32.');
    }

    // Lưu ngay thông tin bản ZIP local vừa tạo thành công
    const baseLastInfo = {
      lastBackupAt: startedAtText,
      zipFileName: createdZipInfo.zipFileName,
      zipSizeBytes: createdZipInfo.zipSizeBytes,
      zipSizeFormatted: formatBytes(createdZipInfo.zipSizeBytes),
      localZipPath: createdZipInfo.zipFilePath,
      uploadStatus: 'Đã lưu ZIP tại máy (Đang chuẩn bị upload Google Drive...)',
      completedAt: formatVnDateTime(new Date()),
      driveFileId: ''
    };
    saveBackupConfig({ lastBackupInfo: baseLastInfo });

    // =========================================================================
    // GIAI ĐOẠN 5: ĐANG KẾT NỐI GOOGLE DRIVE & KIỂM TRA CẤU HÌNH CLOUD
    // =========================================================================
    emitStep(
      'connecting_drive',
      'Đang kết nối Google Drive',
      'Đang kiểm tra kết nối mạng Internet, tài khoản Google và thư mục đích...',
      54
    );

    const net = await checkInternetConnectivity();
    if (!net.online) {
      const msg = `Không có kết nối mạng Internet. File ZIP "${createdZipInfo.zipFileName}" (${formatBytes(createdZipInfo.zipSizeBytes)}) đã được lưu an toàn tại máy tính (${localBackupDataDir}). Vui lòng kết nối mạng và thử lại để tải lên Google Drive.`;
      const offlineInfo = {
        ...baseLastInfo,
        uploadStatus: 'Chỉ lưu tại máy (Không có kết nối mạng Internet)',
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: offlineInfo });
      emitStep('failed', 'Thất bại (Chưa thể upload do mất mạng)', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: 'NO_INTERNET',
        message: msg,
        lastBackupInfo: offlineInfo
      };
    }

    const health = await checkDriveHealth(createdZipInfo.zipSizeBytes);

    if (health.status === 'disconnected') {
      const msg = `Bạn chưa đăng nhập tài khoản Google Drive. Bản sao lưu "${createdZipInfo.zipFileName}" đã được lưu an toàn trên máy tính tại ${localBackupDataDir}. Hãy đăng nhập Google Drive và chọn thư mục để tải lên đám mây.`;
      const unauthInfo = {
        ...baseLastInfo,
        uploadStatus: 'Chỉ lưu tại máy (Chưa kết nối Google Drive)',
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: unauthInfo });
      emitStep('failed', 'Thất bại (Chưa đăng nhập Google Drive)', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: 'NOT_CONNECTED',
        message: msg,
        lastBackupInfo: unauthInfo
      };
    }

    if (health.status === 'auth_failed' || health.status === 'error' || health.status === 'offline') {
      const reason = (health.warnings && health.warnings[0]) || 'Không thể xác thực tài khoản Google Drive.';
      const msg = `${reason} File ZIP "${createdZipInfo.zipFileName}" vẫn được giữ nguyên an toàn trên máy tính tại ${localBackupDataDir}.`;
      const failInfo = {
        ...baseLastInfo,
        uploadStatus: `Chỉ lưu tại máy (${health.statusText || 'Lỗi kết nối Drive'})`,
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: failInfo });
      emitStep('failed', 'Thất bại', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: health.status.toUpperCase(),
        message: msg,
        lastBackupInfo: failInfo
      };
    }

    if (health.storageFull) {
      const reason = (health.warnings && health.warnings[0]) || 'Google Drive đã hết dung lượng lưu trữ.';
      const msg = `${reason} File ZIP "${createdZipInfo.zipFileName}" đã được lưu an toàn trên máy tính tại ${localBackupDataDir}.`;
      const fullInfo = {
        ...baseLastInfo,
        uploadStatus: 'Chỉ lưu tại máy (Google Drive hết dung lượng)',
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: fullInfo });
      emitStep('failed', 'Thất bại (Google Drive đầy)', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: 'DRIVE_FULL',
        message: msg,
        lastBackupInfo: fullInfo
      };
    }

    const config = loadBackupConfig(resolvedBaseFolder);
    if (!config.targetDriveFolderId) {
      const msg = `Chưa chọn thư mục đích trên Google Drive. File ZIP "${createdZipInfo.zipFileName}" đã được lưu an toàn tại máy tính (${localBackupDataDir}). Vui lòng chọn hoặc tạo thư mục Google Drive trong phần Cài đặt.`;
      const noFolderInfo = {
        ...baseLastInfo,
        uploadStatus: 'Chỉ lưu tại máy (Chưa chọn thư mục Drive)',
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: noFolderInfo });
      emitStep('failed', 'Thất bại (Chưa chọn thư mục Drive)', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: 'NO_DRIVE_FOLDER',
        message: msg,
        lastBackupInfo: noFolderInfo
      };
    }

    if (health.folderStatus !== 'ok') {
      const reason = (health.warnings && health.warnings[0]) || 'Thư mục đích trên Google Drive không còn tồn tại hoặc không có quyền truy cập.';
      const msg = `${reason} File ZIP "${createdZipInfo.zipFileName}" vẫn được giữ an toàn tại máy tính (${localBackupDataDir}).`;
      const badFolderInfo = {
        ...baseLastInfo,
        uploadStatus: 'Chỉ lưu tại máy (Lỗi thư mục Google Drive)',
        completedAt: formatVnDateTime(new Date()),
        errorMessage: msg
      };
      saveBackupConfig({ lastBackupInfo: badFolderInfo });
      emitStep('failed', 'Thất bại (Lỗi thư mục Drive)', msg, 100);
      return {
        ok: false,
        localSaved: true,
        code: 'INVALID_DRIVE_FOLDER',
        message: msg,
        lastBackupInfo: badFolderInfo
      };
    }

    // Kiểm tra hoặc tạo thư mục con BackupData bên trong thư mục đích trên Drive
    emitStep(
      'connecting_drive',
      'Đang kết nối Google Drive',
      `Đang kiểm tra thư mục "${config.targetDriveFolderName}/BackupData" trên Google Drive...`,
      58
    );

    const driveBackupSubfolder = await ensureDriveBackupDataFolder(config.targetDriveFolderId);

    // =========================================================================
    // GIAI ĐOẠN 6: ĐANG UPLOAD ZIP TRỰC TIẾP LÊN GOOGLE DRIVE
    // =========================================================================
    emitStep(
      'uploading',
      'Đang upload',
      `Đang tải ${createdZipInfo.zipFileName} (${formatBytes(createdZipInfo.zipSizeBytes)}) lên Google Drive...`,
      62
    );

    const uploadedFile = await uploadZipFileToDrive({
      localZipPath: createdZipInfo.zipFilePath,
      zipFileName: createdZipInfo.zipFileName,
      backupDataFolderId: driveBackupSubfolder.id,
      onProgress: ({ uploadedBytes, totalBytes, percent }) => {
        const mappedPercent = 62 + Math.round((percent / 100) * 30); // 62% -> 92%
        emitStep(
          'uploading',
          'Đang upload',
          `Đang tải lên Google Drive: ${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`,
          mappedPercent
        );
      }
    });

    // =========================================================================
    // GIAI ĐOẠN 7: ĐANG XÁC MINH & HOÀN TẤT
    // =========================================================================
    emitStep(
      'verifying',
      'Đang xác minh',
      'Đang xác minh File ID, kích thước và thư mục lưu trữ trên Google Drive...',
      95
    );

    const verified = await verifyUploadedZipOnDrive({
      fileId: uploadedFile && uploadedFile.id,
      expectedFileName: createdZipInfo.zipFileName,
      expectedSizeBytes: createdZipInfo.zipSizeBytes,
      expectedParentFolderId: driveBackupSubfolder.id
    });

    const completedAtText = formatVnDateTime(new Date());
    const finalBackupInfo = {
      lastBackupAt: startedAtText,
      zipFileName: createdZipInfo.zipFileName,
      zipSizeBytes: createdZipInfo.zipSizeBytes,
      zipSizeFormatted: formatBytes(createdZipInfo.zipSizeBytes),
      localZipPath: createdZipInfo.zipFilePath,
      uploadStatus: 'Thành công (Đã lưu tại máy & Tải lên Google Drive)',
      completedAt: completedAtText,
      driveFileId: verified.fileId,
      driveFolderId: driveBackupSubfolder.id,
      driveWebViewLink: verified.webViewLink,
      errorMessage: ''
    };

    saveBackupConfig({
      driveBackupDataFolderId: driveBackupSubfolder.id,
      lastBackupInfo: finalBackupInfo
    });

    emitStep(
      'success',
      'Thành công',
      `Backup dữ liệu thành công! File ${createdZipInfo.zipFileName} (${formatBytes(createdZipInfo.zipSizeBytes)}) đã được lưu tại máy và tải lên Google Drive.`,
      100
    );

    return {
      ok: true,
      localSaved: true,
      cloudUploaded: true,
      message: 'Backup dữ liệu thành công!',
      lastBackupInfo: finalBackupInfo
    };
  } catch (err) {
    const errMsg = err.message || 'Đã xảy ra lỗi không xác định trong quá trình sao lưu.';
    const completedAtText = formatVnDateTime(new Date());

    let failBackupInfo = null;
    if (createdZipInfo && createdZipInfo.zipFilePath && fs.existsSync(createdZipInfo.zipFilePath)) {
      failBackupInfo = {
        lastBackupAt: startedAtText,
        zipFileName: createdZipInfo.zipFileName,
        zipSizeBytes: createdZipInfo.zipSizeBytes,
        zipSizeFormatted: formatBytes(createdZipInfo.zipSizeBytes),
        localZipPath: createdZipInfo.zipFilePath,
        uploadStatus: `Chỉ lưu tại máy (Upload thất bại: ${errMsg})`,
        completedAt: completedAtText,
        driveFileId: '',
        errorMessage: errMsg
      };
      saveBackupConfig({ lastBackupInfo: failBackupInfo });
    }

    emitStep('failed', 'Thất bại', errMsg, 100);

    return {
      ok: false,
      localSaved: Boolean(failBackupInfo),
      cloudUploaded: false,
      code: err.code || 'BACKUP_FAILED',
      message: failBackupInfo
        ? `${errMsg} (Lưu ý: Bản ZIP "${createdZipInfo.zipFileName}" vẫn được giữ nguyên an toàn trên máy tính tại ${path.dirname(createdZipInfo.zipFilePath)}).`
        : errMsg,
      lastBackupInfo: failBackupInfo
    };
  } finally {
    isBackupRunning = false;
  }
}

module.exports = {
  formatBytes,
  formatVnDateTime,
  getBackupSystemState,
  executeFullBackup
};


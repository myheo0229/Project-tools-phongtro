const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_LOG_ENTRIES = 2000;
const LOG_FILE_NAME = 'activity-logs.json';

// Hàng đợi ghi tuần tự duy nhất tại Main Process (Single Writer Queue)
let writeQueue = Promise.resolve();
let lastLogTimestampMs = 0;
let sameMsCounter = 0;

/**
 * Tạo ID duy nhất cho từng bản ghi Log (VD: log_1794050123456)
 * Nếu có nhiều log trong cùng 1ms thì gắn thêm hậu tố ngẫu nhiên để đảm bảo không bao giờ trùng
 */
function generateLogId() {
  const now = Date.now();
  if (now === lastLogTimestampMs) {
    sameMsCounter++;
    const rand = crypto.randomBytes(2).toString('hex');
    return `log_${now}_${sameMsCounter}${rand}`;
  }
  lastLogTimestampMs = now;
  sameMsCounter = 0;
  return `log_${now}`;
}

/**
 * Định dạng thời gian chuẩn Việt Nam: "HH:mm:ss - DD/MM/YYYY"
 * @param {Date} [date]
 */
function formatTimeVn(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const dd = pad(d.getDate());
  const mo = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${hh}:${mm}:${ss} - ${dd}/${mo}/${yyyy}`;
}

/**
 * Định dạng hậu tố tên file backup khi phát hiện file bị hỏng
 * @param {Date} [date]
 */
function formatFileTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Lấy đường dẫn file activity-logs.json từ pointer
 * @param {object} pointer
 */
function getLogFilePath(pointer) {
  if (!pointer) return '';
  if (typeof pointer === 'string') {
    return path.join(pointer, 'data', LOG_FILE_NAME);
  }
  if (!pointer.baseFolder) return '';
  return path.join(pointer.baseFolder, pointer.dataFolderName || 'data', LOG_FILE_NAME);
}

/**
 * Đưa một tác vụ vào hàng đợi ghi tuần tự
 * @param {Function} taskFn
 */
function enqueueWrite(taskFn) {
  const nextTask = writeQueue.then(() => taskFn());
  // Đảm bảo nếu 1 task lỗi thì hàng đợi không bị kẹt cho các task sau
  writeQueue = nextTask.catch((err) => {
    console.error('[ActivityLogger] Lỗi trong hàng đợi ghi log:', err);
  });
  return nextTask;
}

/**
 * Chuẩn hóa đối tượng dữ liệu Log lưu trên đĩa
 * @param {any} raw
 */
function normalizeLogStore(raw) {
  const store = {
    version: 1,
    updatedAt: new Date().toISOString(),
    corruptedNotice: null,
    logs: []
  };

  if (!raw) return store;

  if (Array.isArray(raw)) {
    store.logs = raw.filter(item => item && typeof item === 'object' && item.id);
    return store;
  }

  if (typeof raw === 'object') {
    if (raw.corruptedNotice && typeof raw.corruptedNotice === 'string') {
      store.corruptedNotice = raw.corruptedNotice;
    }
    if (Array.isArray(raw.logs)) {
      store.logs = raw.logs.filter(item => item && typeof item === 'object' && item.id);
    }
  }

  return store;
}

/**
 * Đọc file Log an toàn kèm cơ chế tự phục hồi từ .tmp hoặc cứu hộ file .corrupted
 * @param {string} filePath
 */
function readLogStoreSafeSync(filePath) {
  if (!filePath) {
    return normalizeLogStore(null);
  }

  const tmpPath = `${filePath}.tmp`;

  // Trường hợp 1: File chính không tồn tại nhưng có file .tmp hợp lệ từ lần tắt máy đột ngột trước
  if (!fs.existsSync(filePath) && fs.existsSync(tmpPath)) {
    try {
      const tmpContent = fs.readFileSync(tmpPath, 'utf8');
      const parsedTmp = JSON.parse(tmpContent);
      fs.renameSync(tmpPath, filePath);
      return normalizeLogStore(parsedTmp);
    } catch (_) {
      // Nếu file .tmp cũng hỏng thì bỏ qua
    }
  }

  if (!fs.existsSync(filePath)) {
    return normalizeLogStore(null);
  }

  // Trường hợp 2: Đọc file chính
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    // Nếu đọc file chính thành công mà vẫn còn file .tmp cũ sót lại thì dọn dẹp .tmp
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    return normalizeLogStore(parsed);
  } catch (parseErr) {
    console.error('[ActivityLogger] Phát hiện file activity-logs.json bị lỗi định dạng:', parseErr);

    // Thử xem có file .tmp hợp lệ không trước khi cô lập file lỗi
    if (fs.existsSync(tmpPath)) {
      try {
        const tmpContent = fs.readFileSync(tmpPath, 'utf8');
        const parsedTmp = JSON.parse(tmpContent);
        const corruptedName = `activity-logs.corrupted_${formatFileTimestamp()}.json`;
        const corruptedPath = path.join(path.dirname(filePath), corruptedName);
        try { fs.renameSync(filePath, corruptedPath); } catch (_) {}
        try { fs.renameSync(tmpPath, filePath); } catch (_) {}
        const recoveredStore = normalizeLogStore(parsedTmp);
        recoveredStore.corruptedNotice = `Phát hiện file nhật ký bị gián đoạn trước đó. Hệ thống đã tự động khôi phục từ bản tạm và lưu bản gốc tại ${corruptedName}.`;
        return recoveredStore;
      } catch (_) {}
    }

    // Tuyệt đối KHÔNG xóa file cũ: Đổi tên thành file .corrupted để bảo toàn dữ liệu gốc
    const corruptedName = `activity-logs.corrupted_${formatFileTimestamp()}.json`;
    const corruptedPath = path.join(path.dirname(filePath), corruptedName);
    try {
      fs.renameSync(filePath, corruptedPath);
    } catch (renameErr) {
      console.error('[ActivityLogger] Không thể đổi tên file log lỗi:', renameErr);
    }

    const freshStore = normalizeLogStore(null);
    freshStore.corruptedNotice = `File nhật ký cũ gặp lỗi định dạng và đã được giữ lại an toàn dưới tên "${corruptedName}".`;
    return freshStore;
  }
}

/**
 * Ghi store xuống đĩa theo cơ chế Atomic Write (.tmp -> kiểm tra -> rename)
 * @param {string} filePath
 * @param {object} store
 */
function writeLogStoreSafeSync(filePath, store) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Giới hạn số lượng log tối đa (giữ lại các log mới nhất)
  if (Array.isArray(store.logs) && store.logs.length > MAX_LOG_ENTRIES) {
    // Sắp xếp mới nhất trước khi cắt
    store.logs.sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
    store.logs = store.logs.slice(0, MAX_LOG_ENTRIES);
  }

  store.updatedAt = new Date().toISOString();
  const jsonString = JSON.stringify(store, null, 2);

  // Kiểm tra parse thử trước khi ghi xuống đĩa
  JSON.parse(jsonString);

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, jsonString, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Chuẩn hóa 1 bản ghi Log trước khi thêm vào danh sách
 * @param {object} payload
 * @param {string} appVersion
 */
function buildLogEntry(payload = {}, appVersion = 'v4.0.0') {
  const now = new Date();
  const isoTimestamp = (payload.timestamp && !isNaN(new Date(payload.timestamp).getTime()))
    ? new Date(payload.timestamp).toISOString()
    : now.toISOString();
  const dateObj = new Date(isoTimestamp);

  const validCategories = ['PRICING', 'MONTH_DATA', 'RESIDENTS', 'ZALO', 'BACKUP', 'SYSTEM'];
  const category = validCategories.includes(payload.category) ? payload.category : 'SYSTEM';

  const validLevels = ['info', 'warning', 'critical'];
  const level = validLevels.includes(payload.level) ? payload.level : 'info';

  const validResults = ['success', 'failed', 'partial'];
  const result = validResults.includes(payload.result) ? payload.result : 'success';

  const verStr = String(payload.appVersion || appVersion || 'v4.0.0');
  const formattedVer = verStr.startsWith('v') ? verStr : `v${verStr}`;

  return {
    id: (payload.id && typeof payload.id === 'string' && payload.id.startsWith('log_'))
      ? payload.id
      : generateLogId(),
    timestamp: isoTimestamp,
    timeVn: payload.timeVn || formatTimeVn(dateObj),
    category,
    action: String(payload.action || 'UNKNOWN_ACTION'),
    level,
    title: String(payload.title || 'Hoạt động hệ thống'),
    summary: String(payload.summary || ''),
    result,
    appVersion: formattedVer,
    reason: payload.reason ? String(payload.reason) : '',
    metadata: (payload.metadata && typeof payload.metadata === 'object') ? payload.metadata : { target: 'system' }
  };
}

/**
 * Ghi thêm 1 bản ghi Log mới (xếp hàng tuần tự qua writeQueue)
 * @param {object} pointer
 * @param {object} payload
 * @param {string} appVersion
 */
async function appendActivityLog(pointer, payload, appVersion) {
  return enqueueWrite(async () => {
    try {
      const filePath = getLogFilePath(pointer);
      if (!filePath) {
        return { ok: false, error: 'CHUA_CHON_THU_MUC' };
      }

      const store = readLogStoreSafeSync(filePath);
      const entry = buildLogEntry(payload, appVersion);

      // Thêm vào đầu mảng (mới nhất đứng đầu)
      store.logs.unshift(entry);

      writeLogStoreSafeSync(filePath, store);
      return { ok: true, entry, corruptedNotice: store.corruptedNotice };
    } catch (err) {
      console.error('[ActivityLogger] Lỗi khi ghi thêm log:', err);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Đọc toàn bộ danh sách Log hiện tại
 * @param {object} pointer
 */
async function loadActivityLogs(pointer) {
  // Đợi các lệnh ghi đang chờ hoàn tất trước khi đọc để luôn lấy dữ liệu mới nhất
  await writeQueue;
  try {
    const filePath = getLogFilePath(pointer);
    if (!filePath) {
      return { ok: true, logs: [], corruptedNotice: null, total: 0 };
    }
    const store = readLogStoreSafeSync(filePath);
    // Đảm bảo sắp xếp mới nhất trước
    const sorted = [...store.logs].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
    return {
      ok: true,
      logs: sorted,
      corruptedNotice: store.corruptedNotice || null,
      total: sorted.length
    };
  } catch (err) {
    console.error('[ActivityLogger] Lỗi khi đọc danh sách log:', err);
    return { ok: false, error: err.message, logs: [], corruptedNotice: null, total: 0 };
  }
}

/**
 * Hợp nhất danh sách Log từ hai nguồn (không trùng ID, giữ tối đa 2.000 dòng mới nhất)
 * Phục vụ cho:
 * 1. Đổi thư mục lưu trữ BaseFolder (di chuyển và gộp log từ thư mục cũ sang thư mục mới)
 * 2. Phục hồi Backup (bảo toàn các log hiện tại không bị bản backup cũ ghi đè làm mất)
 * @param {Array} logsA
 * @param {Array} logsB
 */
function mergeLogArrays(logsA = [], logsB = []) {
  const map = new Map();
  [...logsA, ...logsB].forEach(item => {
    if (item && typeof item === 'object' && item.id) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  return merged.slice(0, MAX_LOG_ENTRIES);
}

/**
 * Đọc nhanh danh sách log từ một thư mục data cụ thể (dùng trước khi copyDirSync)
 * @param {string} dataDir
 */
function readLogsFromDataDirSync(dataDir) {
  if (!dataDir) return [];
  const filePath = path.join(dataDir, LOG_FILE_NAME);
  if (!fs.existsSync(filePath)) return [];
  const store = readLogStoreSafeSync(filePath);
  return Array.isArray(store.logs) ? store.logs : [];
}

/**
 * Di chuyển và hợp nhất Log khi người dùng thay đổi BaseFolder
 * @param {string} oldDataDir
 * @param {string} newDataDir
 * @param {string} oldBaseFolder
 * @param {string} newBaseFolder
 * @param {string} appVersion
 * @param {Array} [preTargetLogs] - Các log vốn có ở thư mục đích trước khi copyDirSync
 */
async function migrateLogsOnBaseFolderChange(oldDataDir, newDataDir, oldBaseFolder, newBaseFolder, appVersion, preTargetLogs = []) {
  return enqueueWrite(async () => {
    try {
      const oldLogFile = oldDataDir ? path.join(oldDataDir, LOG_FILE_NAME) : '';
      const newLogFile = path.join(newDataDir, LOG_FILE_NAME);

      const oldStore = (oldLogFile && fs.existsSync(oldLogFile))
        ? readLogStoreSafeSync(oldLogFile)
        : normalizeLogStore(null);

      const newStore = fs.existsSync(newLogFile)
        ? readLogStoreSafeSync(newLogFile)
        : normalizeLogStore(null);

      const combinedTargetLogs = mergeLogArrays(preTargetLogs, newStore.logs);
      const mergedLogs = mergeLogArrays(oldStore.logs, combinedTargetLogs);

      // Nếu thực sự có thay đổi đường dẫn thư mục, ghi nhận thêm log đổi BaseFolder
      if (oldBaseFolder && newBaseFolder && path.normalize(oldBaseFolder) !== path.normalize(newBaseFolder)) {
        const moveEntry = buildLogEntry({
          category: 'PRICING',
          action: 'CHANGE_BASE_FOLDER',
          level: 'warning',
          result: 'success',
          title: 'Thay đổi thư mục lưu trữ dữ liệu',
          summary: `Đã chuyển thư mục lưu trữ sang: ${newBaseFolder}`,
          metadata: {
            target: 'baseFolder',
            oldFolder: oldBaseFolder,
            newFolder: newBaseFolder,
            migratedLogsCount: mergedLogs.length
          }
        }, appVersion);
        mergedLogs.unshift(moveEntry);
      }

      const finalStore = {
        version: 1,
        updatedAt: new Date().toISOString(),
        corruptedNotice: newStore.corruptedNotice || oldStore.corruptedNotice || null,
        logs: mergedLogs.slice(0, MAX_LOG_ENTRIES)
      };

      writeLogStoreSafeSync(newLogFile, finalStore);

      // Xác minh file sau khi di chuyển
      const verifyStore = readLogStoreSafeSync(newLogFile);
      if (!verifyStore || !Array.isArray(verifyStore.logs)) {
        throw new Error('Không thể xác minh file nhật ký tại thư mục mới.');
      }

      return { ok: true, count: verifyStore.logs.length };
    } catch (err) {
      console.error('[ActivityLogger] Lỗi khi di chuyển log sang BaseFolder mới:', err);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Bảo toàn lịch sử Log hiện tại khi thực hiện Phục hồi Backup (Restore)
 * @param {object} pointer
 * @param {Array} preRestoreLogsSnapshot - Bản chụp danh sách log trước khi giải nén đè
 * @param {object} restoreMetadata - Thông tin bản backup vừa phục hồi
 * @param {string} appVersion
 */
async function preserveLogsAfterBackupRestore(pointer, preRestoreLogsSnapshot = [], restoreMetadata = {}, appVersion = 'v4.0.0') {
  return enqueueWrite(async () => {
    try {
      const filePath = getLogFilePath(pointer);
      if (!filePath) return { ok: false, error: 'CHUA_CHON_THU_MUC' };

      // Đọc log từ bản backup vừa giải nén (nếu có)
      const restoredStore = readLogStoreSafeSync(filePath);
      const mergedLogs = mergeLogArrays(preRestoreLogsSnapshot, restoredStore.logs);

      const backupName = restoreMetadata.backupFileName || 'Bản sao lưu';
      const restoreEntry = buildLogEntry({
        category: 'BACKUP',
        action: 'RESTORE_BACKUP',
        level: 'warning',
        result: restoreMetadata.result || 'success',
        title: 'Phục hồi dữ liệu từ bản sao lưu',
        summary: `Đã phục hồi dữ liệu từ: ${backupName} (Bảo toàn ${mergedLogs.length} sự kiện nhật ký)`,
        metadata: {
          target: 'backup_restore',
          backupFileName: backupName,
          preservedLogsCount: mergedLogs.length,
          ...restoreMetadata
        }
      }, appVersion);

      mergedLogs.unshift(restoreEntry);

      const finalStore = {
        version: 1,
        updatedAt: new Date().toISOString(),
        corruptedNotice: restoredStore.corruptedNotice || null,
        logs: mergedLogs.slice(0, MAX_LOG_ENTRIES)
      };

      writeLogStoreSafeSync(filePath, finalStore);
      return { ok: true, entry: restoreEntry };
    } catch (err) {
      console.error('[ActivityLogger] Lỗi khi bảo toàn log sau Restore:', err);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Xóa cảnh báo file lỗi sau khi người dùng đã xem và đóng thông báo
 * @param {object} pointer
 */
async function dismissCorruptedLogNotice(pointer) {
  return enqueueWrite(async () => {
    try {
      const filePath = getLogFilePath(pointer);
      if (!filePath || !fs.existsSync(filePath)) return { ok: true };
      const store = readLogStoreSafeSync(filePath);
      store.corruptedNotice = null;
      writeLogStoreSafeSync(filePath, store);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = {
  MAX_LOG_ENTRIES,
  LOG_FILE_NAME,
  generateLogId,
  formatTimeVn,
  getLogFilePath,
  readLogsFromDataDirSync,
  appendActivityLog,
  loadActivityLogs,
  migrateLogsOnBaseFolderChange,
  preserveLogsAfterBackupRestore,
  dismissCorruptedLogNotice
};

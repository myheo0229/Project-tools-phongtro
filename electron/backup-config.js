const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Các file cấu hình riêng biệt cho từng Windows user trong app.getPath('userData')
function getUserDataDir() {
  return app.getPath('userData');
}

function getBackupConfigPath() {
  return path.join(getUserDataDir(), 'backup-config.json');
}

function getEncryptedTokenPath() {
  return path.join(getUserDataDir(), 'backup-tokens.enc');
}

function getUserOAuthClientPath() {
  return path.join(getUserDataDir(), 'google-oauth-client.json');
}

function getBundledOAuthClientPath() {
  return path.join(__dirname, 'google-oauth-client.json');
}

const DEFAULT_BACKUP_CONFIG = {
  connectedEmail: '',
  connectedName: '',
  userEnteredFolderInput: '',
  targetDriveFolderId: '',
  targetDriveFolderName: '',
  driveBackupDataFolderId: '',
  localBackupFolderPath: '',
  lastBackupInfo: null
};

/**
 * Đọc cấu hình backup của Windows user hiện tại
 */
function loadBackupConfig(currentBaseFolder = '') {
  let config = { ...DEFAULT_BACKUP_CONFIG };
  try {
    const cfgPath = getBackupConfigPath();
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        config = { ...DEFAULT_BACKUP_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.error('[BackupConfig] Không thể đọc backup-config.json:', err.message);
  }

  // Luôn đồng bộ lại đường dẫn localBackupFolderPath theo BaseFolder hiện tại
  if (currentBaseFolder && typeof currentBaseFolder === 'string' && currentBaseFolder.trim()) {
    const resolvedBackupPath = path.join(path.resolve(currentBaseFolder.trim()), 'BackupData');
    if (config.localBackupFolderPath !== resolvedBackupPath) {
      config.localBackupFolderPath = resolvedBackupPath;
      saveBackupConfig(config);
    }
  } else {
    config.localBackupFolderPath = '';
  }

  return config;
}

/**
 * Lưu cấu hình backup của Windows user hiện tại (Không bao giờ lưu token vào đây)
 * @param {Record<string, any>} partialOrFullConfig
 */
function saveBackupConfig(partialOrFullConfig) {
  try {
    const userDir = getUserDataDir();
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    let existing = { ...DEFAULT_BACKUP_CONFIG };
    const cfgPath = getBackupConfigPath();
    if (fs.existsSync(cfgPath)) {
      try {
        existing = { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) };
      } catch (_) {}
    }
    /** @type {Record<string, any>} */
    const merged = { ...existing, ...partialOrFullConfig };
    // Đảm bảo không vô tình lưu nhạy cảm
    delete merged.accessToken;
    delete merged.refreshToken;
    delete merged.tokens;

    const tmpPath = `${cfgPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf8');
    fs.renameSync(tmpPath, cfgPath);
    return merged;
  } catch (err) {
    console.error('[BackupConfig] Lỗi khi lưu backup-config.json:', err.message);
    return partialOrFullConfig;
  }
}

/**
 * Khóa dự phòng theo máy + user nếu safeStorage không khả dụng trên môi trường đặc biệt
 */
function getFallbackCipherKey() {
  const seed = `${process.env.USERNAME || 'user'}::${process.env.COMPUTERNAME || 'pc'}::phong-tro-backup-v1`;
  return crypto.createHash('sha256').update(seed).digest();
}

/**
 * Lưu OAuth token đã mã hóa bằng Windows DPAPI (Electron safeStorage)
 * @param {Record<string, any>} tokenObj
 */
function saveEncryptedTokens(tokenObj) {
  if (!tokenObj || typeof tokenObj !== 'object') return false;
  try {
    const userDir = getUserDataDir();
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const tokenPath = getEncryptedTokenPath();
    const jsonPayload = JSON.stringify({
      access_token: tokenObj.access_token || '',
      refresh_token: tokenObj.refresh_token || '',
      expiry_date: tokenObj.expiry_date || 0,
      scope: tokenObj.scope || '',
      token_type: tokenObj.token_type || 'Bearer',
      email: tokenObj.email || '',
      updatedAt: Date.now()
    });

    let storedData;
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encryptedBuf = safeStorage.encryptString(jsonPayload);
      storedData = JSON.stringify({
        scheme: 'dpapi',
        data: encryptedBuf.toString('base64')
      });
    } else {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', getFallbackCipherKey(), iv);
      const enc = Buffer.concat([cipher.update(jsonPayload, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      storedData = JSON.stringify({
        scheme: 'aes-gcm',
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: enc.toString('base64')
      });
    }

    const tmpPath = `${tokenPath}.tmp`;
    fs.writeFileSync(tmpPath, storedData, 'utf8');
    fs.renameSync(tmpPath, tokenPath);
    return true;
  } catch (err) {
    console.error('[BackupConfig] Không thể mã hóa và lưu token:', err.message);
    return false;
  }
}

/**
 * Đọc và giải mã OAuth token của Windows user hiện tại
 */
function loadEncryptedTokens() {
  try {
    const tokenPath = getEncryptedTokenPath();
    if (!fs.existsSync(tokenPath)) return null;
    const raw = fs.readFileSync(tokenPath, 'utf8');
    const wrapper = JSON.parse(raw);
    if (!wrapper || !wrapper.data) return null;

    let decryptedJson = '';
    if (wrapper.scheme === 'dpapi') {
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
        return null;
      }
      const buf = Buffer.from(wrapper.data, 'base64');
      decryptedJson = safeStorage.decryptString(buf);
    } else if (wrapper.scheme === 'aes-gcm') {
      const iv = Buffer.from(wrapper.iv, 'base64');
      const tag = Buffer.from(wrapper.tag, 'base64');
      const enc = Buffer.from(wrapper.data, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', getFallbackCipherKey(), iv);
      decipher.setAuthTag(tag);
      decryptedJson = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } else {
      return null;
    }

    const parsed = JSON.parse(decryptedJson);
    if (!parsed || (!parsed.access_token && !parsed.refresh_token)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('[BackupConfig] Không thể giải mã token (có thể cần đăng nhập lại):', err.message);
    return null;
  }
}

/**
 * Xóa hoàn toàn token và cấu hình phiên khi ngắt kết nối hoặc đổi tài khoản Google
 */
function clearAccountSession(clearFolderConfig = true) {
  try {
    const tokenPath = getEncryptedTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
  } catch (err) {
    console.error('[BackupConfig] Lỗi khi xóa file token:', err.message);
  }

  const updates = {
    connectedEmail: '',
    connectedName: '',
    driveBackupDataFolderId: ''
  };
  if (clearFolderConfig) {
    updates.userEnteredFolderInput = '';
    updates.targetDriveFolderId = '';
    updates.targetDriveFolderName = '';
  }
  return saveBackupConfig(updates);
}

/**
 * Trích xuất clientId và clientSecret từ cấu hình JSON (hỗ trợ cả định dạng gốc của Google Cloud credentials.json)
 * @param {Record<string, any>} obj
 */
function parseOAuthClientObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  // Định dạng trực tiếp { clientId, clientSecret }
  if (obj.clientId && typeof obj.clientId === 'string' && obj.clientId.trim()) {
    return {
      clientId: obj.clientId.trim(),
      clientSecret: (obj.clientSecret || '').trim()
    };
  }
  // Định dạng tải về từ Google Cloud Console: { installed: { client_id, client_secret } } hoặc { web: { ... } }
  const block = obj.installed || obj.web || obj;
  if (block && block.client_id && typeof block.client_id === 'string' && block.client_id.trim()) {
    return {
      clientId: block.client_id.trim(),
      clientSecret: (block.client_secret || '').trim()
    };
  }
  return null;
}

/**
 * Đọc OAuth Client ID & Secret (ưu tiên: biến môi trường -> userData -> file đóng gói kèm app)
 */
function getOAuthClientCredentials() {
  if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_ID.trim()) {
    return {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID.trim(),
      clientSecret: (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim(),
      source: 'env'
    };
  }

  // Kiểm tra trong userData
  try {
    const userClientPath = getUserOAuthClientPath();
    if (fs.existsSync(userClientPath)) {
      const parsed = parseOAuthClientObject(JSON.parse(fs.readFileSync(userClientPath, 'utf8')));
      if (parsed && parsed.clientId) {
        return { ...parsed, source: 'userData' };
      }
    }
  } catch (_) {}

  // Kiểm tra trong file đóng gói cùng ứng dụng
  try {
    const bundledPath = getBundledOAuthClientPath();
    if (fs.existsSync(bundledPath)) {
      const parsed = parseOAuthClientObject(JSON.parse(fs.readFileSync(bundledPath, 'utf8')));
      if (parsed && parsed.clientId) {
        return { ...parsed, source: 'bundled' };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Lưu cấu hình OAuth Client ID & Secret vào vùng dữ liệu người dùng (userData)
 * Tuyệt đối không ghi ngược vào thư mục mã nguồn PROJECT_ROOT theo quy chuẩn an-toan-du-lieu-va-dong-goi
 * @param {Record<string, any>} inputObj
 */
function saveOAuthClientCredentials(inputObj) {
  const parsed = parseOAuthClientObject(inputObj);
  if (!parsed || !parsed.clientId) {
    throw new Error('Không tìm thấy Client ID hợp lệ. Vui lòng kiểm tra lại thông tin hoặc file JSON.');
  }

  const content = JSON.stringify({
    clientId: parsed.clientId,
    clientSecret: parsed.clientSecret || '',
    _comment: 'Cấu hình OAuth 2.0 Desktop Client cho Google Drive Backup'
  }, null, 2);

  // Chỉ lưu vào userData của máy người dùng
  const userDir = getUserDataDir();
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  fs.writeFileSync(getUserOAuthClientPath(), content, 'utf8');

  return parsed;
}

module.exports = {
  loadBackupConfig,
  saveBackupConfig,
  saveEncryptedTokens,
  loadEncryptedTokens,
  clearAccountSession,
  getOAuthClientCredentials,
  saveOAuthClientCredentials,
  parseOAuthClientObject
};


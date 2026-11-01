const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { URL } = require('url');
const { shell } = require('electron');

const {
  loadBackupConfig,
  saveBackupConfig,
  saveEncryptedTokens,
  loadEncryptedTokens,
  clearAccountSession,
  getOAuthClientCredentials
} = require('./backup-config');

// Chỉ sử dụng Non-Sensitive Scopes chuẩn của Google để mọi tài khoản Gmail đều đăng nhập được khi Publish App
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

let activeAuthServer = null;
let activeAuthReject = null;
let activeAuthTimeout = null;

/**
 * Tạo đối tượng Error kèm mã lỗi code chuẩn
 * @param {string} message
 * @param {string} code
 */
function createDriveError(message, code) {
  return Object.assign(new Error(message), { code });
}

/**
 * Thực hiện HTTP/HTTPS request trả về Promise (không dùng thư viện ngoài nặng nề)
 * @param {string} urlStr
 * @param {{ method?: string, headers?: Record<string, any>, body?: any, timeoutMs?: number }} [options]
 */
function httpsRequestJson(urlStr, { method = 'GET', headers = {}, body = null, timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const reqHeaders = { ...headers };
    let bodyBuf = null;

    if (body !== null && body !== undefined) {
      if (Buffer.isBuffer(body)) {
        bodyBuf = body;
      } else if (typeof body === 'string') {
        bodyBuf = Buffer.from(body, 'utf8');
      } else {
        bodyBuf = Buffer.from(JSON.stringify(body), 'utf8');
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json; charset=utf-8';
        }
      }
      reqHeaders['Content-Length'] = bodyBuf.length;
    }

    const req = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const rawBuf = Buffer.concat(chunks);
          const rawText = rawBuf.toString('utf8');
          let json = null;
          try {
            if (rawText.trim()) {
              json = JSON.parse(rawText);
            }
          } catch (_) {}
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            rawText,
            data: json
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('ETIMEDOUT: Kết nối tới máy chủ Google quá thời gian chờ.'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyBuf && bodyBuf.length > 0) {
      req.write(bodyBuf);
    }
    req.end();
  });
}

/**
 * Kiểm tra xem lỗi có phải do mất kết nối mạng Internet hay không
 * @param {any} err
 */
function isNetworkError(err) {
  if (!err) return false;
  const code = err.code || '';
  const msg = String(err.message || '');
  const netCodes = ['ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'];
  return netCodes.some((c) => code === c || msg.includes(c));
}

/**
 * Kiểm tra nhanh kết nối mạng Internet tới Google API
 */
async function checkInternetConnectivity() {
  try {
    await httpsRequestJson('https://www.googleapis.com/discovery/v1/apis?name=drive&preferred=true', {
      method: 'GET',
      timeoutMs: 6000
    });
    return { online: true };
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        online: false,
        errorCode: 'NO_INTERNET',
        message: 'Không có kết nối mạng Internet. Vui lòng kiểm tra lại kết nối Wi-Fi hoặc dây mạng.'
      };
    }
    return { online: true };
  }
}

/**
 * Tạo bộ mã PKCE (code_verifier & code_challenge) cho OAuth 2.0 Desktop
 */
function generatePkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Hủy tiến trình chờ đăng nhập Google trên trình duyệt (nếu người dùng bấm Hủy hoặc tắt trình duyệt)
 */
function cancelOAuthLogin() {
  if (activeAuthTimeout) {
    clearTimeout(activeAuthTimeout);
    activeAuthTimeout = null;
  }
  if (activeAuthServer) {
    try {
      activeAuthServer.close();
    } catch (_) {}
    activeAuthServer = null;
  }
  if (activeAuthReject) {
    const rejectFn = activeAuthReject;
    activeAuthReject = null;
    rejectFn(new Error('Đã hủy phiên chờ đăng nhập Google.'));
  }
  return { cancelled: true };
}

/**
 * Đổi authorization code lấy access_token và refresh_token
 */
async function exchangeCodeForTokens({ code, redirectUri, codeVerifier, clientId, clientSecret }) {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

  const res = await httpsRequestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    timeoutMs: 15000
  });

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data || !res.data.access_token) {
    const errDesc = (res.data && (res.data.error_description || res.data.error)) || res.rawText || 'Lỗi xác thực OAuth';
    throw new Error(`Không thể lấy token từ Google (${errDesc}).`);
  }

  const expiresInMs = (Number(res.data.expires_in) || 3600) * 1000;
  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token || '',
    expiry_date: Date.now() + expiresInMs - 60000,
    scope: res.data.scope || OAUTH_SCOPES,
    token_type: res.data.token_type || 'Bearer'
  };
}

/**
 * Làm mới access_token khi hết hạn bằng refresh_token
 * @param {Record<string, any>} storedTokens
 */
async function refreshAccessToken(storedTokens) {
  if (!storedTokens || !storedTokens.refresh_token) {
    throw createDriveError('Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại.', 'AUTH_REQUIRED');
  }

  const creds = getOAuthClientCredentials();
  if (!creds || !creds.clientId) {
    throw createDriveError('Chưa cấu hình Google OAuth Client ID.', 'MISSING_CLIENT_ID');
  }

  const params = new URLSearchParams({
    client_id: creds.clientId,
    refresh_token: storedTokens.refresh_token,
    grant_type: 'refresh_token'
  });
  if (creds.clientSecret) {
    params.set('client_secret', creds.clientSecret);
  }

  let res;
  try {
    res = await httpsRequestJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      timeoutMs: 15000
    });
  } catch (netErr) {
    if (isNetworkError(netErr)) {
      throw createDriveError('Không có kết nối mạng Internet khi làm mới phiên Google Drive.', 'NO_INTERNET');
    }
    throw netErr;
  }

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data || !res.data.access_token) {
    const errCode = res.data && res.data.error ? res.data.error : '';
    throw createDriveError(
      errCode === 'invalid_grant'
        ? 'Phiên đăng nhập Google đã hết hạn hoặc quyền truy cập đã bị thu hồi. Vui lòng đăng nhập lại.'
        : 'Không thể làm mới phiên đăng nhập Google. Vui lòng đăng nhập lại.',
      'AUTH_REVOKED'
    );
  }

  const expiresInMs = (Number(res.data.expires_in) || 3600) * 1000;
  const updatedTokens = {
    ...storedTokens,
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token || storedTokens.refresh_token,
    expiry_date: Date.now() + expiresInMs - 60000
  };
  saveEncryptedTokens(updatedTokens);
  return updatedTokens.access_token;
}

/**
 * Lấy access_token hợp lệ (tự động refresh nếu đã/sắp hết hạn)
 */
async function getValidAccessToken() {
  const stored = loadEncryptedTokens();
  if (!stored || (!stored.access_token && !stored.refresh_token)) {
    throw createDriveError('Chưa kết nối tài khoản Google Drive. Vui lòng nhấn "Đăng nhập Google".', 'NOT_CONNECTED');
  }

  if (stored.access_token && stored.expiry_date && Date.now() < stored.expiry_date) {
    return stored.access_token;
  }

  return refreshAccessToken(stored);
}

/**
 * Gọi API drive/v3/about để lấy thông tin email và dung lượng trống trên Google Drive
 * @param {string} accessToken
 */
async function fetchDriveAboutInfo(accessToken) {
  const url = 'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)';
  const res = await httpsRequestJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    timeoutMs: 12000
  });

  if (res.statusCode === 401) {
    throw createDriveError('Phiên đăng nhập Google không còn hiệu lực. Vui lòng đăng nhập lại.', 'AUTH_REVOKED');
  }

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
    throw new Error('Không thể lấy thông tin tài khoản Google Drive.');
  }

  const user = res.data.user || {};
  const quota = res.data.storageQuota || {};
  const limitBytes = quota.limit !== undefined ? Number(quota.limit) : null;
  const usageBytes = quota.usage !== undefined ? Number(quota.usage) : 0;
  const freeBytes = limitBytes !== null && limitBytes > 0 ? Math.max(0, limitBytes - usageBytes) : null;

  return {
    email: user.emailAddress || '',
    displayName: user.displayName || '',
    quota: {
      limitBytes,
      usageBytes,
      freeBytes,
      isUnlimited: limitBytes === null || limitBytes === 0
    }
  };
}

/**
 * Trích xuất Google Drive Folder ID từ chuỗi người dùng nhập (hỗ trợ cả URL đầy đủ, Folder ID hoặc Tên thư mục)
 * @param {string} rawInput
 */
function extractDriveFolderId(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return { type: 'empty', value: '' };
  const trimmed = rawInput.trim();
  if (!trimmed) return { type: 'empty', value: '' };

  // Trường hợp 1: Dán link dạng https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing
  const folderUrlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderUrlMatch && folderUrlMatch[1]) {
    return { type: 'url_id', value: folderUrlMatch[1] };
  }

  // Trường hợp 2: Link có ?id=1AbCdEf...
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParamMatch && idParamMatch[1]) {
    return { type: 'url_id', value: idParamMatch[1] };
  }

  // Trường hợp 3: Chuỗi giống Folder ID của Google Drive (dài 25-60 ký tự và có chứa chữ số)
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed) && /\d/.test(trimmed)) {
    return { type: 'maybe_id', value: trimmed };
  }

  // Ngược lại là Tên thư mục người dùng muốn đặt/tạo (VD: RoomManager_Backup, PhongTro...)
  return { type: 'name', value: trimmed };
}

/**
 * Kiểm tra thông tin một thư mục trên Google Drive bằng files.get (UPLOAD-ONLY SAFE)
 * @param {string} folderId
 * @param {string | null} [accessToken]
 */
async function getDriveFolderMetadata(folderId, accessToken = null) {
  const token = accessToken || (await getValidAccessToken());
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed,parents,capabilities(canAddChildren),webViewLink`;
  const res = await httpsRequestJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 12000
  });

  if (res.statusCode === 404) {
    return { exists: false, reason: 'NOT_FOUND' };
  }
  if (res.statusCode === 403) {
    return { exists: false, reason: 'FORBIDDEN' };
  }
  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
    return { exists: false, reason: 'API_ERROR', statusCode: res.statusCode };
  }

  const file = res.data;
  if (file.trashed) {
    return { exists: false, reason: 'TRASHED', file };
  }
  if (file.mimeType !== 'application/vnd.google-apps.folder') {
    return { exists: false, reason: 'NOT_A_FOLDER', file };
  }
  if (file.capabilities && file.capabilities.canAddChildren === false) {
    return { exists: false, reason: 'NO_WRITE_PERMISSION', file };
  }

  return {
    exists: true,
    id: file.id,
    name: file.name,
    parents: file.parents || [],
    webViewLink: file.webViewLink || `https://drive.google.com/drive/folders/${file.id}`
  };
}

/**
 * Liệt kê các thư mục gốc (không phải BackupData) mà ứng dụng đã tạo trên Google Drive của người dùng
 * Dùng API files.list (UPLOAD-ONLY SAFE)
 * @param {string | null} [accessToken]
 */
async function listAppRootFolders(accessToken = null) {
  const token = accessToken || (await getValidAccessToken());
  const q = "mimeType = 'application/vnd.google-apps.folder' and trashed = false and name != 'BackupData'";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,parents)&orderBy=createdTime desc&pageSize=20`;
  const res = await httpsRequestJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 12000
  });

  if (res.statusCode >= 200 && res.statusCode < 300 && res.data && Array.isArray(res.data.files)) {
    return res.data.files;
  }
  return [];
}

/**
 * Tạo thư mục mới trên Google Drive bằng files.create (UPLOAD-ONLY SAFE)
 */
async function createDriveFolder({ name, parentId = null, accessToken = null }) {
  const token = accessToken || (await getValidAccessToken());
  const body = {
    name: name.trim(),
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const res = await httpsRequestJson('https://www.googleapis.com/drive/v3/files?fields=id,name,parents,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
    timeoutMs: 15000
  });

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data || !res.data.id) {
    const errDetail = (res.data && res.data.error && res.data.error.message) || res.rawText || 'Lỗi tạo thư mục';
    throw new Error(`Không thể tạo thư mục "${name}" trên Google Drive (${errDetail}).`);
  }

  return {
    id: res.data.id,
    name: res.data.name,
    parents: res.data.parents || [],
    webViewLink: res.data.webViewLink || `https://drive.google.com/drive/folders/${res.data.id}`
  };
}

/**
 * Kiểm tra hoặc tạo thư mục con BackupData bên trong thư mục đích do người dùng chọn
 * Đảm bảo KHÔNG BAO GIỜ tạo trùng nhiều thư mục BackupData trong cùng thư mục cha
 * @param {string} parentFolderId
 * @param {string | null} [accessToken]
 */
async function ensureDriveBackupDataFolder(parentFolderId, accessToken = null) {
  const token = accessToken || (await getValidAccessToken());
  const config = loadBackupConfig();

  // 1. Nếu đã lưu driveBackupDataFolderId trước đó, kiểm tra xem nó còn tồn tại và nằm trong đúng parentFolderId không
  if (config.driveBackupDataFolderId) {
    const checkCached = await getDriveFolderMetadata(config.driveBackupDataFolderId, token);
    if (
      checkCached.exists &&
      checkCached.name === 'BackupData' &&
      Array.isArray(checkCached.parents) &&
      checkCached.parents.includes(parentFolderId)
    ) {
      return {
        id: checkCached.id,
        name: checkCached.name,
        reused: true
      };
    }
  }

  // 2. Tìm kiếm thư mục con tên BackupData bên trong parentFolderId bằng files.list
  const q = `'${parentFolderId.replace(/'/g, "\\'")}' in parents and name = 'BackupData' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&pageSize=5`;
  const listRes = await httpsRequestJson(listUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 12000
  });

  if (
    listRes.statusCode >= 200 &&
    listRes.statusCode < 300 &&
    listRes.data &&
    Array.isArray(listRes.data.files) &&
    listRes.data.files.length > 0
  ) {
    const existingFolder = listRes.data.files[0];
    saveBackupConfig({ driveBackupDataFolderId: existingFolder.id });
    return {
      id: existingFolder.id,
      name: existingFolder.name,
      reused: true
    };
  }

  // 3. Chưa tồn tại -> Tạo mới thư mục BackupData bên trong parentFolderId bằng files.create
  const created = await createDriveFolder({
    name: 'BackupData',
    parentId: parentFolderId,
    accessToken: token
  });

  saveBackupConfig({ driveBackupDataFolderId: created.id });
  return {
    id: created.id,
    name: created.name,
    reused: false
  };
}

/**
 * Xử lý khi người dùng nhập Tên thư mục muốn lưu trên Drive (hoặc dán Link thư mục Drive)
 * CAM KẾT AN TOÀN DỮ LIỆU (APPEND-ONLY / NO-NEW-FOLDER ON RENAME):
 * - Nếu đã có thư mục đích trên Drive (targetDriveFolderId) thì khi đổi tên sẽ ĐỔI TÊN TRỰC TIẾP (in-place)
 *   trên đúng Folder ID đó, tuyệt đối KHÔNG tạo thêm thư mục mới và KHÔNG làm mất bất kỳ file nào bên trong.
 * @param {string} rawUserInput
 */
async function configureTargetDriveFolder(rawUserInput) {
  const net = await checkInternetConnectivity();
  if (!net.online) {
    throw new Error(net.message);
  }

  const token = await getValidAccessToken();
  const parsed = extractDriveFolderId(rawUserInput);

  if (parsed.type === 'empty') {
    throw new Error('Vui lòng nhập Tên thư mục muốn tạo hoặc dán Google Drive Folder ID / Link thư mục.');
  }

  const existingCfg = loadBackupConfig();

  // Nếu đã có targetDriveFolderId trên Drive và người dùng nhập tên mới (không phải dán URL thư mục khác)
  // -> Luôn đổi tên trực tiếp trên đúng Folder ID hiện tại, tuyệt đối không tạo thư mục mới!
  if (existingCfg.targetDriveFolderId && parsed.type !== 'url_id') {
    const existingMeta = await getDriveFolderMetadata(existingCfg.targetDriveFolderId, token);
    if (existingMeta.exists) {
      return await renameTargetDriveFolder(rawUserInput.trim());
    }
  }

  // Trường hợp 1: Người dùng dán Folder ID hoặc Link thư mục Google Drive
  if (parsed.type === 'url_id' || parsed.type === 'maybe_id') {
    const meta = await getDriveFolderMetadata(parsed.value, token);
    if (meta.exists) {
      // Đảm bảo thư mục con BackupData tồn tại bên trong
      const backupSub = await ensureDriveBackupDataFolder(meta.id, token);

      const updated = saveBackupConfig({
        userEnteredFolderInput: rawUserInput.trim(),
        targetDriveFolderId: meta.id,
        targetDriveFolderName: meta.name,
        driveBackupDataFolderId: backupSub.id
      });

      return {
        folderId: meta.id,
        folderName: meta.name,
        backupDataFolderId: backupSub.id,
        mode: 'verified_id',
        config: updated
      };
    }

    // Nếu người dùng dán Link URL mà không truy cập được -> báo lỗi rõ ràng
    if (parsed.type === 'url_id') {
      if (meta.reason === 'TRASHED') {
        throw new Error('Thư mục tương ứng với đường link này đã bị xóa vào Thùng rác trên Google Drive. Vui lòng khôi phục hoặc nhập Tên thư mục mới.');
      }
      if (meta.reason === 'NOT_A_FOLDER') {
        throw new Error('Đường link bạn nhập là một tập tin, không phải là thư mục trên Google Drive.');
      }
      if (meta.reason === 'NO_WRITE_PERMISSION') {
        throw new Error('Tài khoản Google của bạn không có quyền ghi vào thư mục này.');
      }
      throw new Error(
        'Không thể truy cập đường link thư mục tạo từ bên ngoài ứng dụng. Hãy nhập Tên thư mục muốn lưu (ví dụ: PhongTro_Backup) rồi bấm "Chọn thư mục" để phần mềm khởi tạo thư mục trên Drive của bạn.'
      );
    }
    // Nếu parsed.type === 'maybe_id' mà không tìm thấy ID -> coi đó là Tên thư mục và xử lý bên dưới!
  }

  // Trường hợp 2: Người dùng nhập Tên thư mục (VD: "RoomManager_Backup" hoặc "PhongTro_Backup")
  const desiredName = parsed.value;
  const escapedName = desiredName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,parents)&pageSize=5`;
  const listRes = await httpsRequestJson(listUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 12000
  });

  let rootFolder = null;
  let wasCreated = false;

  if (
    listRes.statusCode >= 200 &&
    listRes.statusCode < 300 &&
    listRes.data &&
    Array.isArray(listRes.data.files) &&
    listRes.data.files.length > 0
  ) {
    rootFolder = listRes.data.files[0];
  } else {
    // Kiểm tra xem app đã từng tạo thư mục gốc nào trên Drive chưa để tái sử dụng & đổi tên thay vì tạo mới tràn lan
    const existingAppFolders = await listAppRootFolders(token).catch(() => []);
    if (existingAppFolders.length > 0) {
      const existingRoot = existingAppFolders[0];
      saveBackupConfig({
        targetDriveFolderId: existingRoot.id,
        targetDriveFolderName: existingRoot.name
      });
      return await renameTargetDriveFolder(desiredName);
    }

    rootFolder = await createDriveFolder({
      name: desiredName,
      parentId: null,
      accessToken: token
    });
    wasCreated = true;
  }

  const backupSub = await ensureDriveBackupDataFolder(rootFolder.id, token);

  const updated = saveBackupConfig({
    userEnteredFolderInput: rootFolder.id,
    targetDriveFolderId: rootFolder.id,
    targetDriveFolderName: rootFolder.name,
    driveBackupDataFolderId: backupSub.id
  });

  return {
    folderId: rootFolder.id,
    folderName: rootFolder.name,
    backupDataFolderId: backupSub.id,
    mode: wasCreated ? 'created_new' : 'reused_existing',
    config: updated
  };
}

/**
 * Đổi tên thư mục đích hiện tại trên Google Drive:
 * - Giữ nguyên 100% Folder ID cũ (targetDriveFolderId) và thư mục con BackupData (driveBackupDataFolderId)
 * - Tuyệt đối KHÔNG tạo thêm thư mục mới trên Google Drive
 * - Tuyệt đối KHÔNG xóa, KHÔNG ghi đè và KHÔNG làm mất bất kỳ file sao lưu nào đã có trên Google Drive
 * @param {string} newFolderName
 */
async function renameTargetDriveFolder(newFolderName) {
  const trimmedName = (newFolderName || '').trim();
  if (!trimmedName) {
    throw new Error('Tên thư mục không được để trống.');
  }

  const net = await checkInternetConnectivity();
  if (!net.online) {
    throw new Error(net.message);
  }

  const config = loadBackupConfig();
  if (!config.targetDriveFolderId) {
    return await configureTargetDriveFolder(trimmedName);
  }

  const token = await getValidAccessToken();
  const folderId = config.targetDriveFolderId;

  // Kiểm tra thư mục hiện tại còn tồn tại không
  const meta = await getDriveFolderMetadata(folderId, token);
  if (!meta.exists) {
    throw new Error('Thư mục hiện tại trên Google Drive không còn tồn tại hoặc đã bị xóa.');
  }

  // Nếu tên mới trùng hệt tên đang có trên Drive -> giữ nguyên không cần gọi PATCH
  if (meta.name === trimmedName) {
    const backupSub = await ensureDriveBackupDataFolder(folderId, token);
    const updatedSame = saveBackupConfig({
      userEnteredFolderInput: folderId,
      targetDriveFolderId: folderId,
      targetDriveFolderName: meta.name,
      driveBackupDataFolderId: backupSub.id
    });
    return {
      folderId,
      folderName: meta.name,
      backupDataFolderId: backupSub.id,
      mode: 'unchanged',
      config: updatedSame
    };
  }

  // Chỉ cập nhật duy nhất trường metadata `name` của đúng Folder ID hiện tại (giữ nguyên toàn bộ cây thư mục và file bên trong)
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name`;
  const res = await httpsRequestJson(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: { name: trimmedName },
    timeoutMs: 15000
  });

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data || !res.data.id) {
    const errDetail = (res.data && res.data.error && res.data.error.message) || res.rawText || 'Lỗi đổi tên thư mục';
    throw new Error(`Không thể đổi tên thư mục trên Google Drive (${errDetail}).`);
  }

  // Đảm bảo thư mục con BackupData bên trong vẫn giữ nguyên ID cũ
  const backupSub = await ensureDriveBackupDataFolder(res.data.id, token);

  const updated = saveBackupConfig({
    userEnteredFolderInput: res.data.id,
    targetDriveFolderId: res.data.id,
    targetDriveFolderName: res.data.name,
    driveBackupDataFolderId: backupSub.id
  });

  return {
    folderId: res.data.id,
    folderName: res.data.name,
    backupDataFolderId: backupSub.id,
    mode: 'renamed_existing',
    config: updated
  };
}

/**
 * Kiểm tra sức khỏe toàn diện của Tài khoản Google & Google Drive (Health Check)
 * Phát hiện: mất mạng, hết hạn/thu hồi token, hết dung lượng Google Drive, thư mục đích bị xóa vào thùng rác
 */
async function checkDriveHealth(expectedZipSizeBytes = 0) {
  const storedTokens = loadEncryptedTokens();
  const config = loadBackupConfig();

  if (!storedTokens || (!storedTokens.access_token && !storedTokens.refresh_token)) {
    return {
      status: 'disconnected',
      statusText: 'Chưa kết nối',
      healthy: false,
      email: '',
      quota: null,
      folderStatus: 'unconfigured',
      warnings: []
    };
  }

  // 1. Kiểm tra kết nối mạng Internet
  const net = await checkInternetConnectivity();
  if (!net.online) {
    return {
      status: 'offline',
      statusText: 'Kết nối thất bại (Không có mạng)',
      healthy: false,
      email: config.connectedEmail || storedTokens.email || '',
      quota: null,
      folderStatus: 'unknown',
      warnings: [net.message]
    };
  }

  // 2. Kiểm tra OAuth token & làm mới nếu cần
  let accessToken;
  try {
    accessToken = await getValidAccessToken();
  } catch (authErr) {
    return {
      status: 'auth_failed',
      statusText: 'Kết nối thất bại (Cần đăng nhập lại)',
      healthy: false,
      email: config.connectedEmail || storedTokens.email || '',
      quota: null,
      folderStatus: 'unknown',
      warnings: [authErr.message || 'Phiên đăng nhập đã hết hạn hoặc bị thu hồi.']
    };
  }

  // 3. Kiểm tra tài khoản & dung lượng Google Drive
  let aboutInfo;
  try {
    aboutInfo = await fetchDriveAboutInfo(accessToken);
  } catch (err) {
    if (isNetworkError(err)) {
      return {
        status: 'offline',
        statusText: 'Kết nối thất bại (Mất mạng)',
        healthy: false,
        email: config.connectedEmail || '',
        quota: null,
        folderStatus: 'unknown',
        warnings: ['Không thể kết nối tới máy chủ Google Drive. Vui lòng kiểm tra mạng Internet.']
      };
    }
    return {
      status: 'error',
      statusText: 'Kết nối thất bại',
      healthy: false,
      email: config.connectedEmail || '',
      quota: null,
      folderStatus: 'unknown',
      warnings: [err.message || 'Lỗi khi kiểm tra trạng thái tài khoản Google Drive.']
    };
  }

  const warnings = [];
  let storageFull = false;

  if (aboutInfo.quota && !aboutInfo.quota.isUnlimited && aboutInfo.quota.freeBytes !== null) {
    const minRequired = Math.max(expectedZipSizeBytes, 2 * 1024 * 1024); // Tối thiểu 2MB
    if (aboutInfo.quota.freeBytes <= 0) {
      storageFull = true;
      warnings.push('Google Drive của bạn đã đầy 100% dung lượng! Không thể tải thêm bản sao lưu mới lên Drive.');
    } else if (aboutInfo.quota.freeBytes < minRequired) {
      storageFull = true;
      warnings.push('Dung lượng trống trên Google Drive không đủ để chứa file sao lưu ZIP.');
    } else if (aboutInfo.quota.freeBytes < 100 * 1024 * 1024) {
      warnings.push('Dung lượng trống trên Google Drive còn dưới 100 MB. Bạn nên lưu ý dọn bớt các file không cần thiết.');
    }
  }

  // Đồng bộ lại email nếu thay đổi
  if (aboutInfo.email && aboutInfo.email !== config.connectedEmail) {
    saveBackupConfig({
      connectedEmail: aboutInfo.email,
      connectedName: aboutInfo.displayName || ''
    });
  }

  // 4. Kiểm tra thư mục đích trên Google Drive
  let folderStatus = 'unconfigured';
  let folderName = config.targetDriveFolderName || '';
  let folderId = config.targetDriveFolderId || '';

  if (folderId) {
    const meta = await getDriveFolderMetadata(folderId, accessToken);
    if (meta.exists) {
      folderStatus = 'ok';
      folderName = meta.name;
      if (meta.name !== config.targetDriveFolderName) {
        saveBackupConfig({ targetDriveFolderName: meta.name });
      }
    } else if (meta.reason === 'TRASHED') {
      folderStatus = 'trashed';
      warnings.push(`Thư mục đích "${folderName || folderId}" trên Google Drive đã bị chuyển vào Thùng rác! Vui lòng khôi phục trên Drive hoặc chọn/tạo thư mục mới.`);
    } else if (meta.reason === 'NO_WRITE_PERMISSION' || meta.reason === 'FORBIDDEN') {
      folderStatus = 'no_permission';
      warnings.push(`Không còn quyền ghi vào thư mục "${folderName || folderId}" trên Google Drive. Vui lòng chọn lại thư mục.`);
    } else {
      folderStatus = 'missing';
      warnings.push(`Thư mục đích "${folderName || folderId}" trên Google Drive không còn tồn tại. Vui lòng chọn hoặc tạo lại thư mục mới.`);
    }
  }

  const appFolders = await listAppRootFolders(accessToken).catch(() => []);

  return {
    status: 'connected',
    statusText: 'Đã kết nối',
    healthy: !storageFull && (folderStatus === 'ok' || folderStatus === 'unconfigured'),
    storageFull,
    email: aboutInfo.email || config.connectedEmail || '',
    displayName: aboutInfo.displayName || config.connectedName || '',
    quota: aboutInfo.quota,
    folderStatus,
    targetDriveFolderId: folderId,
    targetDriveFolderName: folderName,
    availableAppFolders: appFolders,
    warnings
  };
}

/**
 * Khởi chạy luồng đăng nhập OAuth 2.0 cho Desktop App qua Loopback IP (http://127.0.0.1:{port})
 */
async function startOAuthLogin() {
  cancelOAuthLogin();

  const creds = getOAuthClientCredentials();
  if (!creds || !creds.clientId) {
    throw createDriveError('Chưa cấu hình Google OAuth Client ID. Vui lòng nhập Client ID hoặc nạp file JSON cấu hình OAuth.', 'MISSING_CLIENT_ID');
  }

  const net = await checkInternetConnectivity();
  if (!net.online) {
    throw new Error(net.message);
  }

  const { verifier, challenge } = generatePkcePair();
  const stateToken = crypto.randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    activeAuthReject = reject;

    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        if (reqUrl.pathname !== '/oauth2callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }

        const errorParam = reqUrl.searchParams.get('error');
        const codeParam = reqUrl.searchParams.get('code');
        const returnedState = reqUrl.searchParams.get('state');

        if (errorParam) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Đăng nhập thất bại</title></head>
            <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;">
              <div style="background:#fff;padding:32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);text-align:center;max-width:460px;">
                <h2 style="color:#dc2626;margin-top:0;">Đăng nhập Google bị hủy hoặc từ chối</h2>
                <p style="color:#475569;">Bạn có thể đóng tab trình duyệt này và thử lại trong phần mềm Quản Lý Phòng Trọ.</p>
              </div>
            </body></html>`);
          cancelOAuthLogin();
          reject(new Error('Người dùng đã hủy hoặc từ chối cấp quyền đăng nhập Google.'));
          return;
        }

        if (!codeParam || returnedState !== stateToken) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Mã xác thực không hợp lệ.');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Kết nối Google Drive thành công</title></head>
          <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4;">
            <div style="background:#fff;padding:36px;border-radius:14px;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;max-width:480px;border:1px solid #bbf7d0;">
              <div style="font-size:48px;margin-bottom:12px;">✅</div>
              <h2 style="color:#15803d;margin:0 0 10px;">Kết nối Google Drive thành công!</h2>
              <p style="color:#334155;line-height:1.5;margin:0;">Tài khoản của bạn đã được liên kết với phần mềm <strong>Quản Lý Phòng Trọ</strong>.<br>Bạn có thể đóng tab trình duyệt này và quay lại phần mềm.</p>
            </div>
          </body></html>`);

        const addressInfo = server.address();
        const srvPort = addressInfo && typeof addressInfo === 'object' ? addressInfo.port : 0;
        const redirectUri = `http://127.0.0.1:${srvPort}/oauth2callback`;

        if (activeAuthTimeout) {
          clearTimeout(activeAuthTimeout);
          activeAuthTimeout = null;
        }
        activeAuthReject = null;
        try {
          server.close();
        } catch (_) {}
        activeAuthServer = null;

        // Đổi code lấy token
        const tokenData = await exchangeCodeForTokens({
          code: codeParam,
          redirectUri,
          codeVerifier: verifier,
          clientId: creds.clientId,
          clientSecret: creds.clientSecret
        });

        // Lấy thông tin email & dung lượng của tài khoản mới
        const aboutInfo = await fetchDriveAboutInfo(tokenData.access_token);
        const prevConfig = loadBackupConfig();
        const isDifferentAccount = prevConfig.connectedEmail && prevConfig.connectedEmail !== aboutInfo.email;

        // Lưu token đã mã hóa của tài khoản mới
        saveEncryptedTokens({
          ...tokenData,
          email: aboutInfo.email
        });

        // Nếu đổi sang tài khoản Google khác, xóa Folder ID cũ để tránh nhầm với tài khoản trước
        let nextFolderId = isDifferentAccount ? '' : prevConfig.targetDriveFolderId;
        let nextFolderName = isDifferentAccount ? '' : prevConfig.targetDriveFolderName;
        let nextBackupDataFolderId = isDifferentAccount ? '' : prevConfig.driveBackupDataFolderId;

        // Nếu chưa có thư mục đích (hoặc vừa đổi tài khoản), kiểm tra xem trên Drive của tài khoản này đã có thư mục nào của app tạo trước đó chưa
        if (!nextFolderId) {
          const existingFolders = await listAppRootFolders(tokenData.access_token).catch(() => []);
          if (existingFolders.length > 0) {
            nextFolderId = existingFolders[0].id;
            nextFolderName = existingFolders[0].name;
          }
        } else {
          // Kiểm tra xem Folder ID cũ có truy cập được bằng tài khoản này không
          const checkMeta = await getDriveFolderMetadata(nextFolderId, tokenData.access_token);
          if (!checkMeta.exists) {
            nextFolderId = '';
            nextFolderName = '';
            nextBackupDataFolderId = '';
          }
        }

        saveBackupConfig({
          connectedEmail: aboutInfo.email,
          connectedName: aboutInfo.displayName || '',
          userEnteredFolderInput: nextFolderId,
          targetDriveFolderId: nextFolderId,
          targetDriveFolderName: nextFolderName,
          driveBackupDataFolderId: nextBackupDataFolderId
        });

        const health = await checkDriveHealth();
        resolve(health);
      } catch (err) {
        cancelOAuthLogin();
        reject(err);
      }
    });

    activeAuthServer = server;

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', creds.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', OAUTH_SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'select_account consent');
      authUrl.searchParams.set('state', stateToken);
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      shell.openExternal(authUrl.toString());

      // Timeout tự động sau 2 phút nếu người dùng tắt trình duyệt
      activeAuthTimeout = setTimeout(() => {
        cancelOAuthLogin();
        reject(new Error('Quá thời gian chờ đăng nhập trên trình duyệt (2 phút). Bạn có thể bấm "Đăng nhập Google" để thử lại.'));
      }, 120000);
    });

    server.on('error', (err) => {
      cancelOAuthLogin();
      reject(new Error(`Không thể khởi tạo cổng xác thực cục bộ: ${err.message}`));
    });
  });
}

/**
 * Kiểm tra xem một file ZIP cùng tên đã được tạo hoàn chỉnh trong thư mục BackupData trên Drive chưa
 * Dùng để tránh upload trùng file khi mạng bị đứt ở giây cuối cùng của lần thử trước
 * @param {string} backupDataFolderId
 * @param {string} zipFileName
 * @param {string | null} [accessToken]
 */
async function findExistingZipInDriveFolder(backupDataFolderId, zipFileName, accessToken = null) {
  const token = accessToken || (await getValidAccessToken());
  const escapedName = zipFileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `'${backupDataFolderId.replace(/'/g, "\\'")}' in parents and name = '${escapedName}' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,size,parents,trashed)&pageSize=3`;

  const res = await httpsRequestJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 12000
  });

  if (
    res.statusCode >= 200 &&
    res.statusCode < 300 &&
    res.data &&
    Array.isArray(res.data.files) &&
    res.data.files.length > 0
  ) {
    return res.data.files[0];
  }
  return null;
}

/**
 * Truy vấn số byte mà Google Drive đã nhận được trong phiên Resumable Upload khi mạng bị gián đoạn
 * @param {string} sessionUri
 * @param {number} totalSize
 */
async function queryResumableUploadOffset(sessionUri, totalSize) {
  try {
    const res = await httpsRequestJson(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Length': 0,
        'Content-Range': `bytes */${totalSize}`
      },
      timeoutMs: 15000
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      return { completed: true, fileData: res.data };
    }

    if (res.statusCode === 308) {
      const rangeHeader = res.headers['range'] || res.headers['Range'] || '';
      const match = String(rangeHeader).match(/bytes=0-(\d+)/);
      if (match && match[1]) {
        return { completed: false, offset: Number(match[1]) + 1 };
      }
      return { completed: false, offset: 0 };
    }
  } catch (_) {}
  return null;
}

/**
 * Upload trực tiếp file ZIP từ BaseFolder/BackupData lên thư mục BackupData trên Google Drive
 * Sử dụng giao thức Resumable Upload của Google Drive API v3 (UPLOAD-ONLY: chỉ dùng files.create)
 */
async function uploadZipFileToDrive({ localZipPath, zipFileName, backupDataFolderId, onProgress }) {
  if (!fs.existsSync(localZipPath)) {
    throw new Error('Không tìm thấy file ZIP tại máy tính để upload.');
  }

  const stat = fs.statSync(localZipPath);
  const totalBytes = stat.size;
  if (totalBytes <= 0) {
    throw new Error('File ZIP rỗng (0 byte), đã hủy upload để bảo vệ dữ liệu.');
  }

  const accessToken = await getValidAccessToken();

  // Kiểm tra xem file có tên duy nhất này đã tồn tại hoàn chỉnh trong thư mục đích chưa (chống trùng khi retry)
  const existingFile = await findExistingZipInDriveFolder(backupDataFolderId, zipFileName, accessToken);
  if (existingFile && Number(existingFile.size) === totalBytes) {
    return existingFile;
  }

  // Khởi tạo phiên Resumable Upload (POST /upload/drive/v3/files?uploadType=resumable)
  const initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,parents,trashed,webViewLink';
  const metadata = {
    name: zipFileName,
    parents: [backupDataFolderId],
    mimeType: 'application/zip'
  };

  let initRes;
  try {
    initRes = await httpsRequestJson(initUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Upload-Content-Type': 'application/zip',
        'X-Upload-Content-Length': String(totalBytes)
      },
      body: metadata,
      timeoutMs: 20000
    });
  } catch (err) {
    if (isNetworkError(err)) {
      throw createDriveError('Mất kết nối mạng Internet khi bắt đầu tải file lên Google Drive.', 'NO_INTERNET');
    }
    throw err;
  }

  if (initRes.statusCode < 200 || initRes.statusCode >= 300) {
    const errMsg = (initRes.data && initRes.data.error && initRes.data.error.message) || initRes.rawText || '';
    if (errMsg.toLowerCase().includes('storagequotaexceeded') || errMsg.toLowerCase().includes('quota')) {
      throw createDriveError('Google Drive của bạn đã hết dung lượng lưu trữ! Bản ZIP vẫn được giữ an toàn tại máy tính.', 'DRIVE_FULL');
    }
    throw new Error(`Không thể khởi tạo phiên upload lên Google Drive (HTTP ${initRes.statusCode}: ${errMsg}).`);
  }

  const sessionUri = initRes.headers['location'] || initRes.headers['Location'];
  if (!sessionUri) {
    throw new Error('Máy chủ Google Drive không trả về đường dẫn phiên Resumable Upload.');
  }

  // Upload theo từng chunk (2 MB = 8 * 256 KB, bội số chuẩn của 256 KB theo Google Resumable Upload spec)
  const CHUNK_SIZE = 2 * 1024 * 1024;
  const fd = fs.openSync(localZipPath, 'r');
  let offset = 0;
  let uploadedFileResponse = null;

  try {
    while (offset < totalBytes) {
      const remaining = totalBytes - offset;
      const currentChunkSize = Math.min(CHUNK_SIZE, remaining);
      const chunkBuf = Buffer.allocUnsafe(currentChunkSize);
      const bytesRead = fs.readSync(fd, chunkBuf, 0, currentChunkSize, offset);
      const slice = bytesRead < currentChunkSize ? chunkBuf.subarray(0, bytesRead) : chunkBuf;
      const endByte = offset + slice.length - 1;

      let chunkSuccess = false;
      let lastChunkErr = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const putRes = await httpsRequestJson(sessionUri, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/zip',
              'Content-Length': slice.length,
              'Content-Range': `bytes ${offset}-${endByte}/${totalBytes}`
            },
            body: slice,
            timeoutMs: 45000
          });

          if (putRes.statusCode === 200 || putRes.statusCode === 201) {
            offset = totalBytes;
            uploadedFileResponse = putRes.data;
            chunkSuccess = true;
            break;
          }

          if (putRes.statusCode === 308) {
            offset += slice.length;
            chunkSuccess = true;
            break;
          }

          if (putRes.statusCode === 403 && String(putRes.rawText).toLowerCase().includes('quota')) {
            throw createDriveError('Google Drive của bạn đã hết dung lượng lưu trữ!', 'DRIVE_FULL');
          }

          throw new Error(`Upload chunk trả về mã HTTP ${putRes.statusCode}.`);
        } catch (chunkErr) {
          lastChunkErr = chunkErr;
          if (chunkErr && chunkErr.code === 'DRIVE_FULL') {
            throw chunkErr;
          }

          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, attempt * 1500));
            const statusCheck = await queryResumableUploadOffset(sessionUri, totalBytes);
            if (statusCheck && statusCheck.completed && statusCheck.fileData) {
              offset = totalBytes;
              uploadedFileResponse = statusCheck.fileData;
              chunkSuccess = true;
              break;
            }
            if (statusCheck && typeof statusCheck.offset === 'number') {
              offset = statusCheck.offset;
              chunkSuccess = true;
              break;
            }
          }
        }
      }

      if (!chunkSuccess) {
        if (isNetworkError(lastChunkErr)) {
          throw createDriveError('Mất kết nối mạng Internet trong quá trình tải file ZIP lên Google Drive.', 'NO_INTERNET');
        }
        throw lastChunkErr || new Error('Tải file ZIP lên Google Drive thất bại sau 3 lần thử lại.');
      }

      if (typeof onProgress === 'function') {
        const percent = Math.min(100, Math.round((offset / totalBytes) * 100));
        onProgress({
          uploadedBytes: offset,
          totalBytes,
          percent
        });
      }
    }
  } finally {
    try {
      fs.closeSync(fd);
    } catch (_) {}
  }

  return uploadedFileResponse;
}

/**
 * Xác minh file ZIP sau khi upload lên Google Drive bằng files.get
 * Kiểm tra: File ID tồn tại, tên file khớp, dung lượng khớp 100%, parent Folder ID khớp, không nằm trong thùng rác
 */
async function verifyUploadedZipOnDrive({ fileId, expectedFileName, expectedSizeBytes, expectedParentFolderId }) {
  if (!fileId) {
    throw new Error('Không nhận được File ID từ Google Drive sau khi upload.');
  }

  const accessToken = await getValidAccessToken();
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,parents,trashed,webViewLink`;
  const res = await httpsRequestJson(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    timeoutMs: 15000
  });

  if (res.statusCode < 200 || res.statusCode >= 300 || !res.data) {
    throw new Error('Không thể xác minh file vừa tải lên trên Google Drive.');
  }

  const remoteFile = res.data;
  if (remoteFile.trashed) {
    throw new Error('File vừa tải lên Google Drive nằm trong trạng thái bị xóa (trashed).');
  }
  if (remoteFile.name !== expectedFileName) {
    throw new Error(`Tên file trên Google Drive không khớp (${remoteFile.name} != ${expectedFileName}).`);
  }
  if (Number(remoteFile.size) !== Number(expectedSizeBytes)) {
    throw new Error(`Dung lượng file trên Google Drive không khớp (${remoteFile.size} != ${expectedSizeBytes} bytes).`);
  }
  if (
    expectedParentFolderId &&
    Array.isArray(remoteFile.parents) &&
    !remoteFile.parents.includes(expectedParentFolderId)
  ) {
    throw new Error('Thư mục chứa file trên Google Drive không khớp với thư mục BackupData đã cấu hình.');
  }

  return {
    verified: true,
    fileId: remoteFile.id,
    fileName: remoteFile.name,
    sizeBytes: Number(remoteFile.size),
    parentFolderId: expectedParentFolderId,
    webViewLink: remoteFile.webViewLink || `https://drive.google.com/file/d/${remoteFile.id}/view`
  };
}

/**
 * Ngắt kết nối tài khoản Google hiện tại
 */
function disconnectGoogleAccount() {
  cancelOAuthLogin();
  clearAccountSession(true);
  return {
    status: 'disconnected',
    statusText: 'Chưa kết nối',
    email: '',
    targetDriveFolderId: '',
    targetDriveFolderName: ''
  };
}

module.exports = {
  checkInternetConnectivity,
  startOAuthLogin,
  cancelOAuthLogin,
  disconnectGoogleAccount,
  checkDriveHealth,
  extractDriveFolderId,
  configureTargetDriveFolder,
  renameTargetDriveFolder,
  ensureDriveBackupDataFolder,
  uploadZipFileToDrive,
  verifyUploadedZipOnDrive,
  listAppRootFolders
};


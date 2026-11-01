const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Bảng CRC32 dự phòng nếu môi trường thiếu zlib.crc32
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Buffer} buffer
 */
function computeCrc32(buffer) {
  if (typeof zlib.crc32 === 'function') {
    return zlib.crc32(buffer) >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Chuẩn hóa đường dẫn trên Windows để so sánh chính xác tuyệt đối
 * @param {string} p
 */
function normalizeWinPath(p) {
  const resolved = path.resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Kiểm tra một đường dẫn có phải là thư mục BaseFolder/BackupData cần loại trừ hay không.
 * Lưu ý: Chỉ loại trừ đúng BaseFolder/BackupData (và nội dung bên trong nó).
 * Nếu có thư mục con khác tên BackupData ở tầng sâu hơn (VD: BaseFolder/data/BackupData) thì KHÔNG loại trừ.
 * @param {string} candidatePath
 * @param {string} baseFolder
 */
function isExcludedBackupDataPath(candidatePath, baseFolder) {
  const normCandidate = normalizeWinPath(candidatePath);
  const normMainBackupDir = normalizeWinPath(path.join(baseFolder, 'BackupData'));
  if (normCandidate === normMainBackupDir) return true;
  if (normCandidate.startsWith(normMainBackupDir + path.sep)) return true;
  return false;
}

/**
 * Tạo chuỗi thời gian YYYYMMDD_HHmmss theo giờ local của máy (múi giờ Việt Nam UTC+7)
 * @param {Date} [date]
 */
function formatBackupTimestamp(date = new Date()) {
  /** @param {number | string} n */
  const pad2 = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

/**
 * Tạo tên file ZIP duy nhất: Backup_YYYYMMDD_HHmmss.zip
 * Nếu có 2 lần backup trong cùng 1 giây -> thêm hậu tố _01, _02... không bao giờ ghi đè file cũ
 * @param {string} backupDataDir
 * @param {Date} [date]
 */
function generateUniqueZipFileName(backupDataDir, date = new Date()) {
  const ts = formatBackupTimestamp(date);
  const baseName = `Backup_${ts}`;
  let candidate = `${baseName}.zip`;
  let counter = 1;

  while (
    fs.existsSync(path.join(backupDataDir, candidate)) ||
    fs.existsSync(path.join(backupDataDir, `${candidate}.tmp`))
  ) {
    const suffix = String(counter).padStart(2, '0');
    candidate = `${baseName}_${suffix}.zip`;
    counter++;
  }
  return candidate;
}

/**
 * Dọn dẹp các file .zip.tmp bị bỏ dở do máy tính tắt đột ngột ở lần chạy trước
 * @param {string} backupDataDir
 */
function cleanupIncompleteTempZips(backupDataDir) {
  try {
    if (!fs.existsSync(backupDataDir)) return;
    const entries = fs.readdirSync(backupDataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.zip.tmp')) {
        try {
          fs.unlinkSync(path.join(backupDataDir, entry.name));
        } catch (_) {}
      }
    }
  } catch (_) {}
}

/**
 * Quét đệ quy toàn bộ dữ liệu trong BaseFolder (loại trừ chính xác BaseFolder/BackupData và các file tạm .tmp)
 * @param {string} baseFolder
 */
function collectSourceEntries(baseFolder) {
  const files = [];
  const emptyDirs = [];

  /** @param {string} currentDir */
  function walk(currentDir) {
    if (isExcludedBackupDataPath(currentDir, baseFolder)) {
      return;
    }

    const dirents = fs.readdirSync(currentDir, { withFileTypes: true });
    let validChildCount = 0;

    for (const dirent of dirents) {
      const fullPath = path.join(currentDir, dirent.name);

      // Loại trừ chính xác BaseFolder/BackupData
      if (isExcludedBackupDataPath(fullPath, baseFolder)) {
        continue;
      }

      // Loại trừ file tạm của quá trình ghi/nén
      if (dirent.name.endsWith('.tmp') || dirent.name.endsWith('.zip.tmp')) {
        continue;
      }

      validChildCount++;
      const relPath = path.relative(baseFolder, fullPath).split(path.sep).join('/');

      if (dirent.isDirectory()) {
        walk(fullPath);
      } else if (dirent.isFile()) {
        const stat = fs.statSync(fullPath);
        files.push({
          fullPath,
          relPath,
          size: stat.size,
          mtime: stat.mtime
        });
      }
    }

    if (validChildCount === 0 && normalizeWinPath(currentDir) !== normalizeWinPath(baseFolder)) {
      const relDir = path.relative(baseFolder, currentDir).split(path.sep).join('/') + '/';
      emptyDirs.push({
        fullPath: currentDir,
        relPath: relDir,
        mtime: new Date()
      });
    }
  }

  walk(baseFolder);
  return { files, emptyDirs };
}

/**
 * Chuyển đổi Date sang DOS Time & Date dùng trong header ZIP
 * @param {Date} dateObj
 */
function dateToDosDateTime(dateObj) {
  const d = dateObj instanceof Date && !isNaN(dateObj.getTime()) ? dateObj : new Date();
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);

  const dosTime = ((hours & 0x1F) << 11) | ((minutes & 0x3F) << 5) | (seconds & 0x1F);
  const dosDate = (((year - 1980) & 0x7F) << 9) | ((month & 0x0F) << 5) | (day & 0x1F);
  return { dosTime, dosDate };
}

/**
 * Kiểm tra xem định dạng file đã được nén sẵn chưa (ảnh JPG/PNG, PDF...) để chọn Store (0) hay Deflate (8)
 * @param {string} relPath
 * @param {number} fileSize
 */
function shouldStoreWithoutRecompress(relPath, fileSize) {
  if (fileSize === 0) return true;
  const ext = path.extname(relPath).toLowerCase();
  const preCompressedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.zip', '.gz', '.7z', '.rar']);
  return preCompressedExts.has(ext);
}

/**
 * Nhường luồng sự kiện để không khóa giao diện Electron
 */
function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Đọc file an toàn với cơ chế thử lại ngắn nếu file JSON đang được ghi đồng thời
 * @param {string} filePath
 */
async function readConsistentFileBuffer(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const buf = await fs.promises.readFile(filePath);
    if (ext === '.json' && buf.length > 0) {
      try {
        JSON.parse(buf.toString('utf8'));
        return buf;
      } catch (err) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 80));
          continue;
        }
        // Nếu file JSON vốn là file người dùng tự đặt không chuẩn JSON, vẫn trả về nguyên vẹn buffer
        return buf;
      }
    }
    return buf;
  }
  return fs.promises.readFile(filePath);
}

/**
 * Tạo snapshot cho các file cấu hình/JSON quan trọng trước khi nén để đảm bảo tính nhất quán 100%
 * @param {Array<{ fullPath: string, relPath: string, size: number, mtime: Date }>} files
 */
async function createJsonSnapshotMap(files) {
  const snapshotMap = new Map();
  for (const fileInfo of files) {
    if (path.extname(fileInfo.relPath).toLowerCase() === '.json') {
      const buf = await readConsistentFileBuffer(fileInfo.fullPath);
      snapshotMap.set(fileInfo.fullPath, buf);
    }
  }
  return snapshotMap;
}

/**
 * Nén toàn bộ dữ liệu trong BaseFolder thành file ZIP chuẩn PKZIP (UTF-8 flag 0x0800)
 * Lưu vào BaseFolder/BackupData/Backup_YYYYMMDD_HHmmss.zip
 */
async function createFullBackupZip({ baseFolder, backupDataDir, zipFileName, onProgress }) {
  cleanupIncompleteTempZips(backupDataDir);

  if (!fs.existsSync(backupDataDir)) {
    fs.mkdirSync(backupDataDir, { recursive: true });
  }

  const finalZipPath = path.join(backupDataDir, zipFileName);
  const tempZipPath = `${finalZipPath}.tmp`;

  // Bước 1: Quét toàn bộ file nguồn (đã loại trừ BaseFolder/BackupData)
  const { files, emptyDirs } = collectSourceEntries(baseFolder);
  const totalFiles = files.length;

  // Bước 2: Chụp snapshot đồng bộ toàn bộ các file JSON để tránh đọc phải file đang ghi dở
  const jsonSnapshots = await createJsonSnapshotMap(files);

  const centralDirectoryEntries = [];
  let currentOffset = 0;
  const fd = fs.openSync(tempZipPath, 'w');

  try {
    // Ghi các thư mục rỗng (nếu có) để giữ nguyên cấu trúc thư mục
    for (const dirEntry of emptyDirs) {
      const nameBuf = Buffer.from(dirEntry.relPath, 'utf8');
      const { dosTime, dosDate } = dateToDosDateTime(dirEntry.mtime);
      const flags = 0x0800; // UTF-8 filename flag

      const localHeader = Buffer.alloc(30 + nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
      localHeader.writeUInt16LE(flags, 6);      // General purpose bit flag (UTF-8)
      localHeader.writeUInt16LE(0, 8);          // Compression method (0 = Store)
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(0, 14);         // CRC-32
      localHeader.writeUInt32LE(0, 18);         // Compressed size
      localHeader.writeUInt32LE(0, 22);         // Uncompressed size
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);         // Extra field length
      nameBuf.copy(localHeader, 30);

      const headerOffset = currentOffset;
      fs.writeSync(fd, localHeader);
      currentOffset += localHeader.length;

      centralDirectoryEntries.push({
        nameBuf,
        flags,
        method: 0,
        dosTime,
        dosDate,
        crc32: 0,
        compressedSize: 0,
        uncompressedSize: 0,
        headerOffset,
        externalAttr: 0x10 // DOS directory attribute
      });
    }

    // Ghi từng file dữ liệu
    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];

      // Chốt chặn kép: Tuyệt đối không đưa bất kỳ đường dẫn nào thuộc BackupData gốc vào ZIP
      if (isExcludedBackupDataPath(fileInfo.fullPath, baseFolder)) {
        continue;
      }

      const rawBuffer = jsonSnapshots.has(fileInfo.fullPath)
        ? jsonSnapshots.get(fileInfo.fullPath)
        : await fs.promises.readFile(fileInfo.fullPath);

      const uncompressedSize = rawBuffer.length;
      const crc = computeCrc32(rawBuffer);
      const useStore = shouldStoreWithoutRecompress(fileInfo.relPath, uncompressedSize);

      let method = 0;
      let payloadBuffer = rawBuffer;
      if (!useStore && uncompressedSize > 0) {
        const deflated = zlib.deflateRawSync(rawBuffer, { level: 6 });
        if (deflated.length < uncompressedSize) {
          method = 8; // Deflate
          payloadBuffer = deflated;
        }
      }

      const compressedSize = payloadBuffer.length;
      const nameBuf = Buffer.from(fileInfo.relPath, 'utf8');
      const { dosTime, dosDate } = dateToDosDateTime(fileInfo.mtime);
      const flags = 0x0800; // UTF-8 flag

      const localHeader = Buffer.alloc(30 + nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(flags, 6);
      localHeader.writeUInt16LE(method, 8);
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc >>> 0, 14);
      localHeader.writeUInt32LE(compressedSize >>> 0, 18);
      localHeader.writeUInt32LE(uncompressedSize >>> 0, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);
      nameBuf.copy(localHeader, 30);

      const headerOffset = currentOffset;
      fs.writeSync(fd, localHeader);
      currentOffset += localHeader.length;

      if (compressedSize > 0) {
        fs.writeSync(fd, payloadBuffer);
        currentOffset += compressedSize;
      }

      centralDirectoryEntries.push({
        nameBuf,
        flags,
        method,
        dosTime,
        dosDate,
        crc32: crc >>> 0,
        compressedSize: compressedSize >>> 0,
        uncompressedSize: uncompressedSize >>> 0,
        headerOffset,
        externalAttr: 0x20 // Archive attribute
      });

      if (typeof onProgress === 'function') {
        const percent = totalFiles > 0 ? Math.round(((i + 1) / totalFiles) * 100) : 100;
        onProgress({
          currentFileIndex: i + 1,
          totalFiles,
          currentFile: fileInfo.relPath,
          percent
        });
      }

      if (i % 8 === 0) {
        await yieldEventLoop();
      }
    }

    // Ghi Central Directory
    const centralDirOffset = currentOffset;
    let centralDirSize = 0;

    for (const entry of centralDirectoryEntries) {
      const cdHeader = Buffer.alloc(46 + entry.nameBuf.length);
      cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory file header signature
      cdHeader.writeUInt16LE(20, 4);         // Version made by
      cdHeader.writeUInt16LE(20, 6);         // Version needed to extract
      cdHeader.writeUInt16LE(entry.flags, 8);
      cdHeader.writeUInt16LE(entry.method, 10);
      cdHeader.writeUInt16LE(entry.dosTime, 12);
      cdHeader.writeUInt16LE(entry.dosDate, 14);
      cdHeader.writeUInt32LE(entry.crc32 >>> 0, 16);
      cdHeader.writeUInt32LE(entry.compressedSize >>> 0, 20);
      cdHeader.writeUInt32LE(entry.uncompressedSize >>> 0, 24);
      cdHeader.writeUInt16LE(entry.nameBuf.length, 28);
      cdHeader.writeUInt16LE(0, 30);         // Extra field length
      cdHeader.writeUInt16LE(0, 32);         // File comment length
      cdHeader.writeUInt16LE(0, 34);         // Disk number start
      cdHeader.writeUInt16LE(0, 36);         // Internal file attributes
      cdHeader.writeUInt32LE(entry.externalAttr, 38); // External file attributes
      cdHeader.writeUInt32LE(entry.headerOffset >>> 0, 42);
      entry.nameBuf.copy(cdHeader, 46);

      fs.writeSync(fd, cdHeader);
      centralDirSize += cdHeader.length;
      currentOffset += cdHeader.length;
    }

    // Ghi End of Central Directory Record (EOCD)
    const eocd = Buffer.alloc(22);
    const totalEntries = centralDirectoryEntries.length;
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(totalEntries, 8);
    eocd.writeUInt16LE(totalEntries, 10);
    eocd.writeUInt32LE(centralDirSize >>> 0, 12);
    eocd.writeUInt32LE(centralDirOffset >>> 0, 16);
    eocd.writeUInt16LE(0, 20);

    fs.writeSync(fd, eocd);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  } catch (err) {
    try {
      fs.closeSync(fd);
    } catch (_) {}
    try {
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
    } catch (_) {}
    throw err;
  }

  // Đổi tên nguyên tử từ .zip.tmp sang tên file ZIP chính thức
  fs.renameSync(tempZipPath, finalZipPath);

  const stat = fs.statSync(finalZipPath);
  return {
    zipFilePath: finalZipPath,
    zipFileName,
    zipSizeBytes: stat.size,
    totalFiles,
    totalEntries: centralDirectoryEntries.length
  };
}

/**
 * Kiểm tra tính toàn vẹn của file ZIP sau khi tạo:
 * - File tồn tại & kích thước > 0
 * - Mở được cấu trúc EOCD & Central Directory
 * - Kiểm tra CRC32 và kích thước giải nén của từng entry trong ZIP
 * - Đảm bảo không có entry nào thuộc thư mục BackupData gốc bị lọt vào
 * @param {string} zipFilePath
 */
async function verifyZipIntegrity(zipFilePath) {
  if (!zipFilePath || !fs.existsSync(zipFilePath)) {
    throw new Error('File ZIP không tồn tại trên ổ cứng sau khi nén.');
  }

  const stat = fs.statSync(zipFilePath);
  if (!stat.isFile() || stat.size < 22) {
    throw new Error('Dung lượng file ZIP không hợp lệ (nhỏ hơn kích thước tối thiểu).');
  }

  const fileBuf = await fs.promises.readFile(zipFilePath);

  // Tìm chữ ký End of Central Directory (0x06054b50) từ cuối file
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, fileBuf.length - 65557);
  for (let i = fileBuf.length - 22; i >= minEocdOffset; i--) {
    if (fileBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('File ZIP bị hỏng: Không tìm thấy cấu trúc End of Central Directory.');
  }

  const totalEntries = fileBuf.readUInt16LE(eocdOffset + 10);
  const centralDirSize = fileBuf.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = fileBuf.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset + centralDirSize > eocdOffset) {
    throw new Error('File ZIP bị hỏng: Vùng Central Directory bị cắt cụt.');
  }

  let ptr = centralDirOffset;
  const entryNames = [];

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > fileBuf.length || fileBuf.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error(`File ZIP bị hỏng tại Central Directory entry #${i + 1}.`);
    }

    const method = fileBuf.readUInt16LE(ptr + 10);
    const expectedCrc = fileBuf.readUInt32LE(ptr + 16) >>> 0;
    const compressedSize = fileBuf.readUInt32LE(ptr + 20) >>> 0;
    const uncompressedSize = fileBuf.readUInt32LE(ptr + 24) >>> 0;
    const nameLen = fileBuf.readUInt16LE(ptr + 28);
    const extraLen = fileBuf.readUInt16LE(ptr + 30);
    const commentLen = fileBuf.readUInt16LE(ptr + 32);
    const localHeaderOffset = fileBuf.readUInt32LE(ptr + 42) >>> 0;

    const entryName = fileBuf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    entryNames.push(entryName);

    // Kiểm tra chống lồng thư mục BackupData gốc
    const normEntry = entryName.replace(/\\/g, '/').toLowerCase();
    if (normEntry === 'backupdata' || normEntry.startsWith('backupdata/')) {
      throw new Error(`Phát hiện thư mục BackupData lọt vào trong ZIP (${entryName}). Đã chặn để tránh backup lồng nhau.`);
    }

    // Kiểm tra Local File Header
    if (localHeaderOffset + 30 > fileBuf.length || fileBuf.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`File ZIP bị hỏng tại Local Header của "${entryName}".`);
    }

    const localNameLen = fileBuf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = fileBuf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > centralDirOffset) {
      throw new Error(`Dữ liệu của file "${entryName}" trong ZIP bị tràn hoặc cắt cụt.`);
    }

    const compressedSlice = fileBuf.subarray(dataStart, dataEnd);
    let uncompressedBuf;
    if (method === 0) {
      uncompressedBuf = compressedSlice;
    } else if (method === 8) {
      uncompressedBuf = zlib.inflateRawSync(compressedSlice);
    } else {
      throw new Error(`Phương thức nén không hỗ trợ (${method}) tại file "${entryName}".`);
    }

    if (uncompressedBuf.length !== uncompressedSize) {
      throw new Error(`Kích thước giải nén không khớp tại "${entryName}" (${uncompressedBuf.length} != ${uncompressedSize}).`);
    }

    const actualCrc = computeCrc32(uncompressedBuf);
    if (actualCrc !== expectedCrc) {
      throw new Error(`Lỗi kiểm tra CRC32 tại "${entryName}" (expected ${expectedCrc.toString(16)}, got ${actualCrc.toString(16)}).`);
    }

    ptr += 46 + nameLen + extraLen + commentLen;
    if (i % 15 === 0) {
      await yieldEventLoop();
    }
  }

  return {
    valid: true,
    sizeBytes: stat.size,
    totalEntries,
    entryNames
  };
}

module.exports = {
  isExcludedBackupDataPath,
  formatBackupTimestamp,
  generateUniqueZipFileName,
  cleanupIncompleteTempZips,
  collectSourceEntries,
  createFullBackupZip,
  verifyZipIntegrity
};


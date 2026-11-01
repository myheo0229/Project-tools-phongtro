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
 * Tính CRC32 cho Buffer
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
 * Đóng gói danh sách các entry trong bộ nhớ thành một Buffer ZIP chuẩn OpenXML (.xlsx)
 * @param {Array<{ name: string, content: string | Buffer }>} entries
 * @returns {Buffer}
 */
function buildZipBuffer(entries) {
  const now = new Date();
  const { dosTime, dosDate } = dateToDosDateTime(now);
  const localParts = [];
  const centralParts = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const rawBuffer = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(String(entry.content), 'utf8');

    const uncompressedSize = rawBuffer.length;
    const crc = computeCrc32(rawBuffer);
    const deflated = zlib.deflateRawSync(rawBuffer, { level: 6 });

    const useDeflate = deflated.length < uncompressedSize;
    const method = useDeflate ? 8 : 0;
    const payloadBuffer = useDeflate ? deflated : rawBuffer;
    const compressedSize = payloadBuffer.length;

    const nameBuf = Buffer.from(entry.name, 'utf8');
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
    localParts.push(localHeader, payloadBuffer);
    currentOffset += localHeader.length + payloadBuffer.length;

    const cdHeader = Buffer.alloc(46 + nameBuf.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(flags, 8);
    cdHeader.writeUInt16LE(method, 10);
    cdHeader.writeUInt16LE(dosTime, 12);
    cdHeader.writeUInt16LE(dosDate, 14);
    cdHeader.writeUInt32LE(crc >>> 0, 16);
    cdHeader.writeUInt32LE(compressedSize >>> 0, 20);
    cdHeader.writeUInt32LE(uncompressedSize >>> 0, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0x20, 38);
    cdHeader.writeUInt32LE(headerOffset >>> 0, 42);
    nameBuf.copy(cdHeader, 46);

    centralParts.push(cdHeader);
  }

  const centralDirectoryBuffer = Buffer.concat(centralParts);
  const centralDirOffset = currentOffset;
  const centralDirSize = centralDirectoryBuffer.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize >>> 0, 12);
  eocd.writeUInt32LE(centralDirOffset >>> 0, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectoryBuffer, eocd]);
}

/**
 * Escape ký tự đặc biệt trong XML và lọc bỏ control characters không hợp lệ trong XML 1.0
 * @param {any} val
 */
function escapeXml(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Chuẩn hóa chuỗi ngày tháng về đúng định dạng dd/mm/yyyy (nếu rỗng trả về chuỗi rỗng)
 * @param {any} rawDate
 */
function formatExcelDateStr(rawDate) {
  if (rawDate === undefined || rawDate === null) return '';
  const str = String(rawDate).trim();
  if (!str) return '';

  // Trường hợp dd/mm/yyyy hoặc d/m/yyyy hoặc dd-mm-yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${dd}/${mm}/${yyyy}`;
  }

  // Trường hợp yyyy-mm-dd
  const ymdMatch = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  return str;
}

/**
 * Tạo chuỗi thời gian YYYYMMDD_HHmmss theo giờ local của máy tính
 * @param {Date} [date]
 */
function formatLocalTimestamp(date = new Date()) {
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
 * Sinh tên file duy nhất trực tiếp trong BaseFolder:
 * DanhSachNguoiThue_YYYYMMDD_HHmmss.xlsx
 * Nếu trùng tên trong cùng 1 giây -> thêm hậu tố _01, _02... tuyệt đối không ghi đè file cũ
 * @param {string} baseFolder
 * @param {Date} [date]
 */
function generateUniqueExcelFileName(baseFolder, date = new Date()) {
  const ts = formatLocalTimestamp(date);
  const baseName = `DanhSachNguoiThue_${ts}`;
  let candidate = `${baseName}.xlsx`;
  let counter = 1;

  while (
    fs.existsSync(path.join(baseFolder, candidate)) ||
    fs.existsSync(path.join(baseFolder, `${candidate}.tmp`))
  ) {
    const suffix = String(counter).padStart(2, '0');
    candidate = `${baseName}_${suffix}.xlsx`;
    counter++;
  }
  return candidate;
}

/**
 * Xây dựng nội dung file .xlsx (OpenXML SpreadsheetML) cho Danh Sách Người Thuê (9 cột)
 * @param {Array<any>} residents
 * @param {Array<any>} [rooms]
 * @returns {Buffer}
 */
function buildResidentsExcelBuffer(residents, rooms = []) {
  // Tạo map tra cứu phòng từ rooms.json phòng trường hợp bản ghi người thuê chưa đồng bộ trường phong
  const residentIdToRoomMap = new Map();
  if (Array.isArray(rooms)) {
    for (const rm of rooms) {
      if (!rm || !rm.phong) continue;
      const roomName = String(rm.phong).trim();
      if (rm.chuPhong) {
        residentIdToRoomMap.set(String(rm.chuPhong), roomName);
      }
      if (Array.isArray(rm.thanhVien)) {
        for (const memId of rm.thanhVien) {
          if (memId) residentIdToRoomMap.set(String(memId), roomName);
        }
      }
    }
  }

  // 9 cột tiêu đề bắt buộc theo đúng thứ tự
  const headers = [
    'STT',
    'Họ Và Tên',
    'SĐT Gọi',
    'SĐT Zalo',
    'Số CCCD',
    'Ngày Sinh',
    'Giới Tính',
    'Phòng Ở',
    'Ngày Vào Ở'
  ];

  // Độ rộng tối thiểu mặc định cho từng cột (đơn vị ký tự Excel)
  const minColWidths = [7, 24, 15, 15, 18, 14, 12, 12, 14];
  const colMaxLengths = headers.map((h, i) => Math.max(h.length + 4, minColWidths[i]));

  // Chuẩn bị dữ liệu từng dòng
  const rowsData = residents.map((r, index) => {
    const stt = index + 1;
    const hoTen = r && r.hoTen !== undefined && r.hoTen !== null ? String(r.hoTen).trim() : '';
    const sdtGoi = r && r.sdtGoi !== undefined && r.sdtGoi !== null ? String(r.sdtGoi).trim() : '';
    const sdtZalo = r && r.sdtZalo !== undefined && r.sdtZalo !== null ? String(r.sdtZalo).trim() : '';
    const cccd = r && r.cccd !== undefined && r.cccd !== null ? String(r.cccd).trim() : '';
    const ngaySinh = formatExcelDateStr(r ? r.ngaySinh : '');
    const gioiTinh = r && r.gioiTinh !== undefined && r.gioiTinh !== null ? String(r.gioiTinh).trim() : '';

    let phongO = r && r.phong !== undefined && r.phong !== null ? String(r.phong).trim() : '';
    if (!phongO && r && r.id && residentIdToRoomMap.has(String(r.id))) {
      phongO = residentIdToRoomMap.get(String(r.id)) || '';
    }

    const ngayVaoO = formatExcelDateStr(r ? r.ngayVaoO : '');

    const rowValues = [
      String(stt),
      hoTen,
      sdtGoi,
      sdtZalo,
      cccd,
      ngaySinh,
      gioiTinh,
      phongO,
      ngayVaoO
    ];

    rowValues.forEach((val, colIdx) => {
      const len = val ? val.length + 4 : 0;
      if (len > colMaxLengths[colIdx]) {
        colMaxLengths[colIdx] = Math.min(len, 50);
      }
    });

    return {
      stt,
      hoTen,
      sdtGoi,
      sdtZalo,
      cccd,
      ngaySinh,
      gioiTinh,
      phongO,
      ngayVaoO
    };
  });

  // Khai báo độ rộng cột tự động (<cols>)
  const colsXml = colMaxLengths
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  // Dòng tiêu đề (Row 1) - Style s="1" (Header in đậm, nền nhẹ, căn giữa, có viền)
  const headerCellsXml = headers
    .map((title, colIdx) => {
      const ref = `${colLetters[colIdx]}1`;
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(title)}</t></is></c>`;
    })
    .join('');

  const allRowsXml = [
    `<row r="1" ht="26" customHeight="1">${headerCellsXml}</row>`
  ];

  // Các dòng dữ liệu (Row 2..N+1)
  // Style map:
  // s="2": Căn giữa + Viền (dùng cho STT, Giới Tính, Phòng Ở)
  // s="3": Căn trái + Viền + Định dạng Text '@' (numFmtId=49) (dùng cho Họ Và Tên, SĐT Gọi, SĐT Zalo, Số CCCD, Ngày Sinh, Ngày Vào Ở)
  // s="4": Căn giữa + Viền + Định dạng Text '@' (numFmtId=49) (dùng cho Giới Tính, Phòng Ở dạng Text)
  rowsData.forEach((row, idx) => {
    const rNum = idx + 2;
    const cells = [
      // 1. STT (Căn giữa)
      `<c r="A${rNum}" s="2" t="n"><v>${row.stt}</v></c>`,
      // 2. Họ Và Tên (Căn trái, Text)
      `<c r="B${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.hoTen)}</t></is></c>`,
      // 3. SĐT Gọi (Căn trái, Text '@')
      `<c r="C${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.sdtGoi)}</t></is></c>`,
      // 4. SĐT Zalo (Căn trái, Text '@')
      `<c r="D${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.sdtZalo)}</t></is></c>`,
      // 5. Số CCCD (Căn trái, Text '@' giữ số 0 ở đầu)
      `<c r="E${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.cccd)}</t></is></c>`,
      // 6. Ngày Sinh (Căn trái, Text dd/mm/yyyy)
      `<c r="F${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.ngaySinh)}</t></is></c>`,
      // 7. Giới Tính (Căn giữa, Text)
      `<c r="G${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(row.gioiTinh)}</t></is></c>`,
      // 8. Phòng Ở (Căn giữa, Text)
      `<c r="H${rNum}" s="4" t="inlineStr"><is><t>${escapeXml(row.phongO)}</t></is></c>`,
      // 9. Ngày Vào Ở (Căn trái, Text dd/mm/yyyy)
      `<c r="I${rNum}" s="3" t="inlineStr"><is><t>${escapeXml(row.ngayVaoO)}</t></is></c>`
    ];

    allRowsXml.push(`<row r="${rNum}" ht="21" customHeight="1">${cells.join('')}</row>`);
  });

  const lastRowNum = rowsData.length + 1;
  const dimensionRef = `A1:I${lastRowNum}`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Danh Sach Nguoi Thue" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color rgb="FF000000"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FF1E293B"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFE2EFDA"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFBFBFBF"/></left>
      <right style="thin"><color rgb="FFBFBFBF"/></right>
      <top style="thin"><color rgb="FFBFBFBF"/></top>
      <bottom style="thin"><color rgb="FFBFBFBF"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="0"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>${allRowsXml.join('')}</sheetData>
</worksheet>`;

  return buildZipBuffer([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml }
  ]);
}

/**
 * Xuất danh sách toàn bộ người thuê hiện có ra file Excel (.xlsx) lưu trực tiếp vào BaseFolder
 * @param {{ baseFolder: string, dataFolderName?: string }} options
 */
async function exportResidentsToExcel(options) {
  const rawBaseFolder = options && options.baseFolder ? String(options.baseFolder).trim() : '';
  if (!rawBaseFolder) {
    return {
      success: false,
      code: 'NO_BASE_FOLDER',
      message: 'Chưa thiết lập thư mục gốc (BaseFolder). Vui lòng vào Phần 2: Cài Đặt Chung để chọn thư mục lưu dữ liệu trước khi xuất Excel!'
    };
  }

  const baseFolder = path.normalize(rawBaseFolder);

  // 1. Kiểm tra BaseFolder có tồn tại và là thư mục hợp lệ không
  try {
    if (!fs.existsSync(baseFolder)) {
      return {
        success: false,
        code: 'BASE_FOLDER_NOT_FOUND',
        message: `Thư mục lưu dữ liệu (BaseFolder) không tồn tại trên ổ đĩa:\n${baseFolder}`
      };
    }
    const stat = fs.statSync(baseFolder);
    if (!stat.isDirectory()) {
      return {
        success: false,
        code: 'BASE_FOLDER_NOT_DIR',
        message: `Đường dẫn BaseFolder không phải là thư mục hợp lệ:\n${baseFolder}`
      };
    }
    fs.accessSync(baseFolder, fs.constants.W_OK);
  } catch (err) {
    return {
      success: false,
      code: 'BASE_FOLDER_NO_PERMISSION',
      message: `Không có quyền ghi vào thư mục BaseFolder:\n${baseFolder}\nChi tiết: ${err && err.message ? err.message : String(err)}`
    };
  }

  // 2. Đọc toàn bộ danh sách người thuê từ nguồn dữ liệu hiện tại (BaseFolder/data/residents.json)
  const dataFolderName = (options && options.dataFolderName) || 'data';
  const dataDir = path.join(baseFolder, dataFolderName);
  const residentsFilePath = path.join(dataDir, 'residents.json');
  const roomsFilePath = path.join(dataDir, 'rooms.json');

  let residents = [];
  try {
    if (fs.existsSync(residentsFilePath)) {
      const parsed = JSON.parse(fs.readFileSync(residentsFilePath, 'utf8'));
      if (Array.isArray(parsed)) {
        residents = parsed;
      }
    }
  } catch (err) {
    return {
      success: false,
      code: 'READ_DATA_ERROR',
      message: `Không thể đọc dữ liệu người thuê từ file residents.json: ${err && err.message ? err.message : String(err)}`
    };
  }

  // Nếu danh sách rỗng -> thông báo chưa có dữ liệu để xuất, không tạo file Excel rỗng
  if (!Array.isArray(residents) || residents.length === 0) {
    return {
      success: false,
      code: 'EMPTY_RESIDENTS',
      message: 'Chưa có dữ liệu người thuê để xuất Excel!'
    };
  }

  let rooms = [];
  try {
    if (fs.existsSync(roomsFilePath)) {
      const parsedRooms = JSON.parse(fs.readFileSync(roomsFilePath, 'utf8'));
      if (Array.isArray(parsedRooms)) {
        rooms = parsedRooms;
      }
    }
  } catch (_) {}

  // 3. Tạo tên file duy nhất trong BaseFolder (không ghi đè file cũ, không tạo thư mục con)
  const fileName = generateUniqueExcelFileName(baseFolder, new Date());
  const filePath = path.join(baseFolder, fileName);
  const tempFilePath = `${filePath}.tmp`;

  // 4. Tạo nội dung .xlsx và ghi xuống BaseFolder
  try {
    const excelBuffer = buildResidentsExcelBuffer(residents, rooms);
    fs.writeFileSync(tempFilePath, excelBuffer);
    fs.renameSync(tempFilePath, filePath);

    // 5. Kiểm tra file đã được tạo thành công trên đĩa
    if (!fs.existsSync(filePath)) {
      throw new Error('File Excel không tồn tại sau khi lưu.');
    }
    const fileStat = fs.statSync(filePath);
    if (!fileStat.isFile() || fileStat.size <= 0) {
      throw new Error('File Excel được tạo có kích thước 0 byte.');
    }

    return {
      success: true,
      fileName,
      filePath,
      baseFolder,
      totalExported: residents.length,
      fileSize: fileStat.size
    };
  } catch (err) {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (_) {}

    return {
      success: false,
      code: 'WRITE_EXCEL_FAILED',
      message: `Lỗi khi tạo hoặc lưu file Excel vào BaseFolder:\n${err && err.message ? err.message : String(err)}`
    };
  }
}

module.exports = {
  exportResidentsToExcel,
  buildResidentsExcelBuffer,
  generateUniqueExcelFileName,
  formatExcelDateStr
};


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
 * Escape ký tự đặc biệt trong XML và loại bỏ ký tự điều khiển không hợp lệ
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
 * Định dạng dung lượng byte thành chuỗi KB / MB dễ đọc
 * @param {number} bytes
 */
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Tạo chuỗi thời gian YYYYMMDD_HHmmss theo giờ địa phương
 * @param {Date} [date]
 */
function formatLocalTimestamp(date = new Date()) {
  const pad2 = (/** @type {number | string} */ n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

/**
 * Tạo chuỗi thời gian YYYY_MM_DD_HH_MM_SS theo giờ địa phương
 * @param {Date} [date]
 */
function formatOutputTimeTimestamp(date = new Date()) {
  const pad2 = (/** @type {number | string} */ n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}_${mm}_${dd}_${hh}_${mi}_${ss}`;
}

/**
 * Sinh tên file duy nhất trực tiếp trong BaseFolder theo đúng yêu cầu:
 * "BangDuLieu_MM_YYYY - Output Time YYYY_MM_DD_HH_MM_SS.xlsx"
 * (Ví dụ: BangDuLieu_07_2026 - Output Time 2026_11_08_23_36_15.xlsx)
 * Nếu trùng tên trong cùng 1 giây -> thêm hậu tố _01, _02... để tuyệt đối không ghi đè dữ liệu cũ.
 * @param {string} baseFolder
 * @param {string} monthKey - Dạng YYYY-MM (VD: 2026-07)
 * @param {Date} [date]
 */
function generateMonthExcelFileName(baseFolder, monthKey, date = new Date()) {
  let monthPart = '00_0000';
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const [yyyy, mm] = monthKey.split('-');
    monthPart = `${mm}_${yyyy}`;
  } else if (monthKey) {
    monthPart = String(monthKey).replace(/[\/\\:*?"<>|\s-]/g, '_');
  }

  const outputTimeStr = formatOutputTimeTimestamp(date);
  const baseName = `BangDuLieu_${monthPart} - Output Time ${outputTimeStr}`;
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
 * Xây dựng nội dung file .xlsx (OpenXML SpreadsheetML) cho Bảng Dữ Liệu Tháng (16 cột)
 * @param {Array<any>} roomsData - Danh sách 12 phòng đã tính toán tiền
 * @param {string} monthKey - Tháng tính tiền (VD: 2026-07)
 * @returns {Buffer}
 */
function buildMonthDataExcelBuffer(roomsData, monthKey = '') {
  // 16 cột tiêu đề theo đúng thứ tự hiển thị của bảng chính
  const headers = [
    'STT',
    'Số Phòng',
    'Điện Cũ',
    'Điện Mới',
    'Số Điện TT',
    'Nước Cũ',
    'Nước Mới',
    'Số Nước TT',
    'Tiền Điện',
    'Tiền Nước',
    'Tiền Phòng',
    'Rác',
    'Internet',
    'Điện Hao Tải',
    'Tiền Hao Tải',
    'Tổng Cộng'
  ];

  // Khai báo độ rộng mặc định từng cột
  const minColWidths = [6, 12, 13, 13, 14, 13, 13, 14, 15, 15, 15, 12, 12, 14, 15, 18];
  const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

  // Chuẩn bị dữ liệu từng dòng phòng
  const rows = Array.isArray(roomsData) ? roomsData : [];

  let sumDienKwh = 0;
  let sumNuocKhoi = 0;
  let sumTienDien = 0;
  let sumTienNuoc = 0;
  let sumTienPhong = 0;
  let sumRac = 0;
  let sumInternet = 0;
  let sumHaoTaiKwh = 0;
  let sumTienHaoTai = 0;
  let sumTongCong = 0;

  const dataRowsXml = rows.map((r, index) => {
    const rNum = index + 2; // Dòng 1 là tiêu đề
    const stt = index + 1;
    const phong = r.phong || '';

    const dienCu = (r.dienCu !== '' && r.dienCu !== null && r.dienCu !== undefined) ? Number(r.dienCu) : null;
    const dienMoi = (r.dienMoi !== '' && r.dienMoi !== null && r.dienMoi !== undefined) ? Number(r.dienMoi) : null;
    const dienKwh = Number(r.dienKwh) || 0;

    const nuocCu = (r.nuocCu !== '' && r.nuocCu !== null && r.nuocCu !== undefined) ? Number(r.nuocCu) : null;
    const nuocMoi = (r.nuocMoi !== '' && r.nuocMoi !== null && r.nuocMoi !== undefined) ? Number(r.nuocMoi) : null;
    const nuocKhoi = Number(r.nuocKhoi) || 0;

    const tienDien = Number(r.tienDien) || 0;
    const tienNuoc = Number(r.tienNuoc) || 0;
    const tienPhong = Number(r.tienPhong) || 0;
    const rac = Number(r.rac) || 0;
    const internet = Number(r.internet) || 0;
    const haoTaiKwh = Number(r.haoTaiKwh) || 0;
    const tienHaoTai = Number(r.tienHaoTai) || 0;
    const tongCong = Number(r.tongCong) || 0;

    sumDienKwh += dienKwh;
    sumNuocKhoi += nuocKhoi;
    sumTienDien += tienDien;
    sumTienNuoc += tienNuoc;
    sumTienPhong += tienPhong;
    sumRac += rac;
    sumInternet += internet;
    sumHaoTaiKwh += haoTaiKwh;
    sumTienHaoTai += tienHaoTai;
    sumTongCong += tongCong;

    // Cell XML format:
    // s="2": Center
    // s="3": Number integer #,##0
    // s="4": Decimal 1 digit #,##0.0
    // s="5": Center text
    const cStt = `<c r="A${rNum}" s="2" t="n"><v>${stt}</v></c>`;
    const cPhong = `<c r="B${rNum}" s="5" t="inlineStr"><is><t>${escapeXml(phong)}</t></is></c>`;
    const cDienCu = dienCu !== null ? `<c r="C${rNum}" s="3" t="n"><v>${dienCu}</v></c>` : `<c r="C${rNum}" s="2" t="inlineStr"><is><t>-</t></is></c>`;
    const cDienMoi = dienMoi !== null ? `<c r="D${rNum}" s="3" t="n"><v>${dienMoi}</v></c>` : `<c r="D${rNum}" s="2" t="inlineStr"><is><t>-</t></is></c>`;
    const cDienKwh = `<c r="E${rNum}" s="3" t="n"><v>${dienKwh}</v></c>`;

    const cNuocCu = nuocCu !== null ? `<c r="F${rNum}" s="3" t="n"><v>${nuocCu}</v></c>` : `<c r="F${rNum}" s="2" t="inlineStr"><is><t>-</t></is></c>`;
    const cNuocMoi = nuocMoi !== null ? `<c r="G${rNum}" s="3" t="n"><v>${nuocMoi}</v></c>` : `<c r="G${rNum}" s="2" t="inlineStr"><is><t>-</t></is></c>`;
    const cNuocKhoi = `<c r="H${rNum}" s="3" t="n"><v>${nuocKhoi}</v></c>`;

    const cTienDien = `<c r="I${rNum}" s="3" t="n"><v>${tienDien}</v></c>`;
    const cTienNuoc = `<c r="J${rNum}" s="3" t="n"><v>${tienNuoc}</v></c>`;
    const cTienPhong = `<c r="K${rNum}" s="3" t="n"><v>${tienPhong}</v></c>`;
    const cRac = `<c r="L${rNum}" s="3" t="n"><v>${rac}</v></c>`;
    const cInternet = `<c r="M${rNum}" s="3" t="n"><v>${internet}</v></c>`;
    const cHaoTaiKwh = `<c r="N${rNum}" s="4" t="n"><v>${haoTaiKwh}</v></c>`;
    const cTienHaoTai = `<c r="O${rNum}" s="3" t="n"><v>${tienHaoTai}</v></c>`;
    const cTongCong = `<c r="P${rNum}" s="3" t="n"><v>${tongCong}</v></c>`;

    return `<row r="${rNum}" ht="22" customHeight="1">${cStt}${cPhong}${cDienCu}${cDienMoi}${cDienKwh}${cNuocCu}${cNuocMoi}${cNuocKhoi}${cTienDien}${cTienNuoc}${cTienPhong}${cRac}${cInternet}${cHaoTaiKwh}${cTienHaoTai}${cTongCong}</row>`;
  });

  // Dòng TỔNG CỘNG (Footer Row)
  const sumRowNum = rows.length + 2;
  const lastDataRow = rows.length + 1;
  const startRow = 2;

  // Style cho dòng tổng cộng:
  // s="6": Bold, Center, Top/Bottom border, nền xám/xanh nhẹ
  // s="7": Bold, Right, #,##0, Top/Bottom border
  // s="8": Bold, Right, #,##0.0, Top/Bottom border
  const sumCells = [
    `<c r="A${sumRowNum}" s="6" t="inlineStr"><is><t>TỔNG CỘNG</t></is></c>`,
    `<c r="B${sumRowNum}" s="6" t="inlineStr"><is><t></t></is></c>`,
    `<c r="C${sumRowNum}" s="6" t="inlineStr"><is><t>-</t></is></c>`,
    `<c r="D${sumRowNum}" s="6" t="inlineStr"><is><t>-</t></is></c>`,
    `<c r="E${sumRowNum}" s="7"><f>SUM(E${startRow}:E${lastDataRow})</f><v>${sumDienKwh}</v></c>`,
    `<c r="F${sumRowNum}" s="6" t="inlineStr"><is><t>-</t></is></c>`,
    `<c r="G${sumRowNum}" s="6" t="inlineStr"><is><t>-</t></is></c>`,
    `<c r="H${sumRowNum}" s="7"><f>SUM(H${startRow}:H${lastDataRow})</f><v>${sumNuocKhoi}</v></c>`,
    `<c r="I${sumRowNum}" s="7"><f>SUM(I${startRow}:I${lastDataRow})</f><v>${sumTienDien}</v></c>`,
    `<c r="J${sumRowNum}" s="7"><f>SUM(J${startRow}:J${lastDataRow})</f><v>${sumTienNuoc}</v></c>`,
    `<c r="K${sumRowNum}" s="7"><f>SUM(K${startRow}:K${lastDataRow})</f><v>${sumTienPhong}</v></c>`,
    `<c r="L${sumRowNum}" s="7"><f>SUM(L${startRow}:L${lastDataRow})</f><v>${sumRac}</v></c>`,
    `<c r="M${sumRowNum}" s="7"><f>SUM(M${startRow}:M${lastDataRow})</f><v>${sumInternet}</v></c>`,
    `<c r="N${sumRowNum}" s="8"><f>SUM(N${startRow}:N${lastDataRow})</f><v>${Math.round(sumHaoTaiKwh * 10) / 10}</v></c>`,
    `<c r="O${sumRowNum}" s="7"><f>SUM(O${startRow}:O${lastDataRow})</f><v>${sumTienHaoTai}</v></c>`,
    `<c r="P${sumRowNum}" s="7"><f>SUM(P${startRow}:P${lastDataRow})</f><v>${sumTongCong}</v></c>`
  ];

  const sumRowXml = `<row r="${sumRowNum}" ht="26" customHeight="1">${sumCells.join('')}</row>`;

  // Khai báo độ rộng cột
  const colsXml = minColWidths
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  // Dòng tiêu đề (Row 1)
  const headerCellsXml = headers
    .map((title, colIdx) => `<c r="${colLetters[colIdx]}1" s="1" t="inlineStr"><is><t>${escapeXml(title)}</t></is></c>`)
    .join('');
  const headerRowXml = `<row r="1" ht="26" customHeight="1">${headerCellsXml}</row>`;

  const dimensionRef = `A1:P${sumRowNum}`;

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

  const sheetTitle = monthKey ? `Thang_${monthKey.replace('-', '_')}` : 'Bang_Du_Lieu';
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetTitle)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // Styles definitions:
  // numFmtId 164: "#,##0"
  // numFmtId 165: "#,##0.0"
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0"/>
    <numFmt numFmtId="165" formatCode="#,##0.0"/>
  </numFmts>
  <fonts count="3">
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
    <font>
      <b/>
      <sz val="11"/>
      <color rgb="FF0F172A"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFE2EFDA"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF1F5F9"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="3">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="medium"><color rgb="FF475569"/></top>
      <bottom style="double"><color rgb="FF475569"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="9">
    <!-- 0: Default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Header (Bold, Center, Green fill, Border) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="0"/>
    </xf>
    <!-- 2: Center, Border -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 3: Right, Number #,##0, Border -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 4: Right, Decimal #,##0.0, Border -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 5: Center text (Phong), Border -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 6: Summary label / dash, Bold, Center, Gray fill, Border double bottom -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 7: Summary formula number, Bold, Right, #,##0, Gray fill, Border double bottom -->
    <xf numFmtId="164" fontId="2" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 8: Summary formula decimal, Bold, Right, #,##0.0, Gray fill, Border double bottom -->
    <xf numFmtId="165" fontId="2" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

  const mergeCellXml = `<mergeCells count="1"><mergeCell ref="A${sumRowNum}:B${sumRowNum}"/></mergeCells>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>
    ${headerRowXml}
    ${dataRowsXml.join('')}
    ${sumRowXml}
  </sheetData>
  ${mergeCellXml}
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
 * Xuất Bảng Dữ Liệu Tháng ra file Excel (.xlsx) lưu trực tiếp vào BaseFolder
 * @param {{ baseFolder: string, monthKey: string, roomsData: Array<any> }} options
 */
async function exportMonthDataToExcel(options) {
  const rawBaseFolder = options && options.baseFolder ? String(options.baseFolder).trim() : '';
  if (!rawBaseFolder) {
    return {
      success: false,
      code: 'NO_BASE_FOLDER',
      message: 'Chưa thiết lập thư mục gốc (BaseFolder). Vui lòng vào Phần 2: Cài Đặt Chung để chọn thư mục lưu dữ liệu trước khi xuất dữ liệu Excel!'
    };
  }

  const baseFolder = path.normalize(rawBaseFolder);

  // 1. Kiểm tra BaseFolder có tồn tại không
  try {
    if (!fs.existsSync(baseFolder)) {
      return {
        success: false,
        code: 'BASE_FOLDER_NOT_FOUND',
        message: `Thư mục lưu dữ liệu (BaseFolder) không tồn tại trên ổ đĩa:\n${baseFolder}`
      };
    }
  } catch (err) {
    return {
      success: false,
      code: 'BASE_FOLDER_CHECK_ERROR',
      message: `Không thể kiểm tra thư mục lưu trữ: ${err && err.message ? err.message : String(err)}`
    };
  }

  const monthKey = options.monthKey || '';
  const roomsData = Array.isArray(options.roomsData) ? options.roomsData : [];

  if (roomsData.length === 0) {
    return {
      success: false,
      code: 'EMPTY_ROOMS_DATA',
      message: 'Bảng dữ liệu tháng hiện chưa có phòng nào để xuất!'
    };
  }

  // 2. Tạo Buffer nội dung file Excel
  let zipBuffer;
  try {
    zipBuffer = buildMonthDataExcelBuffer(roomsData, monthKey);
  } catch (err) {
    console.error('[MonthExcelService] Lỗi khi tạo buffer Excel:', err);
    return {
      success: false,
      code: 'EXCEL_BUILD_ERROR',
      message: `Lỗi trong quá trình tạo cấu trúc file Excel: ${err && err.message ? err.message : String(err)}`
    };
  }

  // 3. Sinh tên file duy nhất trực tiếp trong BaseFolder
  const fileName = generateMonthExcelFileName(baseFolder, monthKey);
  const targetFilePath = path.join(baseFolder, fileName);
  const tempFilePath = path.join(baseFolder, `${fileName}.tmp`);

  // 4. Ghi file an toàn (Safe Atomic Write qua .tmp rồi rename)
  try {
    await fs.promises.writeFile(tempFilePath, zipBuffer);
    await fs.promises.rename(tempFilePath, targetFilePath);

    let statSize = zipBuffer.length;
    try {
      const stat = await fs.promises.stat(targetFilePath);
      statSize = stat.size;
    } catch (e) { }

    return {
      success: true,
      fileName,
      filePath: targetFilePath,
      fileSizeBytes: statSize,
      fileSizeFormatted: formatFileSize(statSize),
      totalRooms: roomsData.length,
      monthKey
    };
  } catch (err) {
    console.error('[MonthExcelService] Lỗi khi ghi file Excel xuống đĩa:', err);
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
      }
    } catch (cleanupErr) { }

    return {
      success: false,
      code: 'FILE_WRITE_ERROR',
      message: `Không thể ghi file Excel vào thư mục:\n${targetFilePath}\nChi tiết lỗi: ${err && err.message ? err.message : String(err)}`
    };
  }
}

module.exports = {
  buildMonthDataExcelBuffer,
  exportMonthDataToExcel,
  generateMonthExcelFileName
};


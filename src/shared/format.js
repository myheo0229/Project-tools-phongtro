/* ============================================================
   FORMAT.JS - ĐỊNH DẠNG DỮ LIỆU PHIẾU THU KHỜI TẠO DÀNH CHO RENDERROOM
   ============================================================ */

/**
 * Định dạng số tiền theo kiểu Việt Nam: dấu CHẤM ngăn cách hàng nghìn, không có phần thập phân.
 * VD: formatMoney(2200000) -> "2.200.000"
 */
function formatMoney(number) {
  if (number === null || number === undefined || isNaN(number)) return '0';
  return Math.round(Number(number)).toLocaleString('vi-VN');
}

/**
 * Định dạng số thập phân kiểu Việt Nam: dấu PHẨY ngăn phần thập phân, luôn đúng 1 chữ số
 * sau dấu phẩy. VD: formatDecimalVN(5.4) -> "5,4", formatDecimalVN(5) -> "5,0"
 */
function formatDecimalVN(number) {
  if (number === null || number === undefined || isNaN(number)) return '0,0';
  return Number(number).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Từ monthKey dạng "YYYY-MM" (VD "2026-07") suy ra ngày/tháng/năm để hiển thị trên phiếu.
 * Ngày LUÔN cố định là "01".
 * Tháng/Năm lấy đúng theo tháng đang được xử lý (monthKey).
 */
function getNgayThangNam(monthKey) {
  if (!monthKey || !monthKey.includes('-')) {
    return { ngay: '01', thang: '07', nam: '2026' };
  }
  const [nam, thang] = monthKey.split('-');
  return { ngay: '01', thang, nam };
}

/**
 * Chuyển đổi ngày YYYY-MM-DD sang DD/MM/YYYY để hiển thị tiếng Việt
 * @param {string} isoDateStr
 * @returns {string}
 */
function formatMcDateVN(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const trimmed = isoDateStr.trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return '';
}

function getMcSegmentLimit(digits, defaultLimit) {
  const d = Number(digits);
  if (!isNaN(d) && d >= 3 && d <= 7) {
    return Math.pow(10, Math.floor(d));
  }
  return defaultLimit;
}

/**
 * Diễn giải chi tiết thay đổi đồng hồ cho 1 loại (Điện hoặc Nước) khi đã chốt đủ (status === 'completed')
 * @param {any} typeRecord
 * @param {'elec' | 'water'} type
 */
function buildMeterChangeDetailForType(typeRecord, type) {
  if (
    !typeRecord ||
    typeRecord.status !== 'completed' ||
    !Array.isArray(typeRecord.changes) ||
    typeRecord.changes.length === 0 ||
    typeRecord.monthEndIndex === null ||
    typeRecord.monthEndIndex === undefined
  ) {
    return {
      completed: false,
      receiptLines: [],
      singleLineSummary: '',
      latestDateVN: ''
    };
  }

  const unit = type === 'elec' ? 'kWh' : 'm³';
  const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
  const defaultDigits = type === 'elec' ? 5 : 4;
  const oldDigits = Number(typeRecord.oldDigits) || defaultDigits;
  const newDigits = Number(typeRecord.newDigits) || defaultDigits;

  const changes = typeRecord.changes;
  const count = changes.length;
  const segments = [];
  let sumConsumed = 0;
  let latestDateVN = '';

  for (let i = 0; i < count; i++) {
    const chg = changes[i] || {};
    const dateVN = formatMcDateVN(chg.date || '');
    if (dateVN) latestDateVN = dateVN;

    const startVal = i === 0
      ? (Number(typeRecord.initialIndex) || 0)
      : (Number(changes[i - 1] && changes[i - 1].newStart !== null && changes[i - 1].newStart !== undefined ? changes[i - 1].newStart : 0) || 0);
    const oldEndVal = Number(chg.oldEnd) || 0;
    const newStartVal = (chg.newStart !== null && chg.newStart !== undefined && chg.newStart !== '') ? (Number(chg.newStart) || 0) : 0;

    const segDigits = i === 0 ? oldDigits : newDigits;
    const segLimit = getMcSegmentLimit(segDigits, Math.pow(10, defaultDigits));
    const isRollover = oldEndVal < startVal;
    const segUsed = isRollover ? ((segLimit + oldEndVal) - startVal) : (oldEndVal - startVal);
    sumConsumed += segUsed;

    segments.push({
      index: i + 1,
      dateVN,
      startVal,
      oldEndVal,
      newStartVal,
      isRollover,
      segUsed
    });
  }

  const lastSeg = segments[count - 1];
  const lastNewStart = lastSeg.newStartVal;
  const monthEndVal = Number(typeRecord.monthEndIndex) || 0;
  const newLimit = getMcSegmentLimit(newDigits, Math.pow(10, defaultDigits));
  const isEndRollover = monthEndVal < lastNewStart;
  const finalUsed = isEndRollover ? ((newLimit + monthEndVal) - lastNewStart) : (monthEndVal - lastNewStart);
  sumConsumed += finalUsed;

  const totalVal = (typeRecord.totalConsumption !== null && typeRecord.totalConsumption !== undefined && !isNaN(Number(typeRecord.totalConsumption)))
    ? Number(typeRecord.totalConsumption)
    : sumConsumed;

  const receiptLines = [];
  let singleLineSummary = '';

  if (count === 1) {
    const s = segments[0];
    const datePart = s.dateVN ? ` (${s.dateVN})` : '';
    const roll1 = s.isRollover ? ' [quay vòng]' : '';
    const roll2 = isEndRollover ? ' [quay vòng]' : '';
    receiptLines.push(
      `(*) Thay ĐH ${typeLabel}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} (${s.segUsed} ${unit}) + ĐH mới ${lastNewStart}→${monthEndVal}${roll2} (${finalUsed} ${unit}) = ${totalVal} ${unit}`
    );
    singleLineSummary = `${typeLabel}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} (${s.segUsed} ${unit}) + ĐH mới ${lastNewStart}→${monthEndVal}${roll2} (${finalUsed} ${unit}) = ${totalVal} ${unit}`;
  } else {
    const summaryParts = [];
    for (let i = 0; i < count; i++) {
      const s = segments[i];
      const datePart = s.dateVN ? ` (${s.dateVN})` : '';
      const roll1 = s.isRollover ? ' [quay vòng]' : '';
      if (i < count - 1) {
        receiptLines.push(
          `(*) Thay ĐH ${typeLabel} lần ${s.index}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} = ${s.segUsed} ${unit}`
        );
        summaryParts.push(`Lần ${s.index}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} (${s.segUsed} ${unit})`);
      } else {
        const roll2 = isEndRollover ? ' [quay vòng]' : '';
        const lastLineTotal = s.segUsed + finalUsed;
        receiptLines.push(
          `(*) Thay ĐH ${typeLabel} lần ${s.index}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} (${s.segUsed} ${unit}) + ĐH mới ${lastNewStart}→${monthEndVal}${roll2} (${finalUsed} ${unit}) = ${lastLineTotal} ${unit}`
        );
        summaryParts.push(`Lần ${s.index}${datePart}: ĐH cũ ${s.startVal}→${s.oldEndVal}${roll1} (${s.segUsed} ${unit}) + ĐH mới ${lastNewStart}→${monthEndVal}${roll2} (${finalUsed} ${unit})`);
      }
    }
    singleLineSummary = `${typeLabel}: ${summaryParts.join('; ')} = ${totalVal} ${unit}`;
  }

  return {
    completed: true,
    receiptLines,
    singleLineSummary,
    latestDateVN
  };
}

/**
 * Tạo đầy đủ các chuỗi ghi chú thay đổi đồng hồ của 1 phòng (Phiếu thu, Zalo, Excel)
 * @param {any} roomMcRecord
 */
function formatRoomMeterChangeNotes(roomMcRecord) {
  const elecDetail = buildMeterChangeDetailForType(roomMcRecord && roomMcRecord.elec, 'elec');
  const waterDetail = buildMeterChangeDetailForType(roomMcRecord && roomMcRecord.water, 'water');

  const lines = [];
  if (elecDetail.completed && elecDetail.singleLineSummary) {
    lines.push(`- ${elecDetail.singleLineSummary}`);
  }
  if (waterDetail.completed && waterDetail.singleLineSummary) {
    lines.push(`- ${waterDetail.singleLineSummary}`);
  }

  const hasCompletedAny = lines.length > 0;
  const noteBlock = hasCompletedAny
    ? `Ghi chú thay đổi đồng hồ:\n${lines.join('\n')}`
    : '';

  return {
    hasCompletedAny,
    dienReceiptLines: elecDetail.receiptLines,
    nuocReceiptLines: waterDetail.receiptLines,
    ghiChuThayDien: elecDetail.completed ? `- ${elecDetail.singleLineSummary}` : '',
    ghiChuThayNuoc: waterDetail.completed ? `- ${waterDetail.singleLineSummary}` : '',
    ngayThayDien: elecDetail.latestDateVN,
    ngayThayNuoc: waterDetail.latestDateVN,
    excelNote: noteBlock,
    zaloNoteBlock: noteBlock
  };
}

/**
 * Tạo chuỗi ghi chú Break chỉ số (cho cột Q Excel tháng — style thường, không emoji)
 * @param {any} roomMbRecord
 */
function formatRoomMeterBreakNotes(roomMbRecord) {
  const buildLine = (typeRec, type) => {
    if (
      !typeRec ||
      typeof typeRec !== 'object' ||
      typeRec.breakEnd === null ||
      typeRec.breakEnd === undefined ||
      typeRec.breakStart === null ||
      typeRec.breakStart === undefined
    ) {
      return '';
    }
    const label = type === 'elec' ? 'Điện' : 'Nước';
    const dateVN = formatMcDateVN(typeRec.date || '');
    const datePart = dateVN ? ` (${dateVN})` : '';
    const initStr = (typeRec.initialIndex !== null && typeRec.initialIndex !== undefined && typeRec.initialIndex !== '')
      ? String(Number(typeRec.initialIndex))
      : '?';
    const endRoll = typeRec.confirmedEndRollover ? ' [quay vòng]' : '';
    const startRoll = typeRec.confirmedStartRollover ? ' [quay vòng]' : '';
    return `- ${label}${datePart}: Đầu kỳ ${initStr} → Break kết thúc ${Number(typeRec.breakEnd)}${endRoll} | Break bắt đầu ${Number(typeRec.breakStart)}${startRoll}`;
  };

  const elecLine = buildLine(roomMbRecord && roomMbRecord.elec, 'elec');
  const waterLine = buildLine(roomMbRecord && roomMbRecord.water, 'water');
  const lines = [];
  if (elecLine) lines.push(elecLine);
  if (waterLine) lines.push(waterLine);

  const hasAny = lines.length > 0;
  return {
    hasAny,
    elecLine,
    waterLine,
    lines,
    excelNote: hasAny ? `Ghi chú Break chỉ số:\n${lines.join('\n')}` : ''
  };
}

/**
 * Gộp kết quả calcRoom() (từ calc.js) + ngày tháng + định dạng tiền, ra đúng shape mà
 * renderRoom(data) của src/receipt đang cần.
 */
function toReceiptData(calcResult, monthKey, dienThoai, roomMcRecord = null) {
  const { ngay, thang, nam } = getNgayThangNam(monthKey);
  const phoneStr = dienThoai || "0982 141 407";
  const mcNotes = formatRoomMeterChangeNotes(roomMcRecord || calcResult.meterChangeRecord || null);

  return {
    dienThoai: phoneStr,
    phong: calcResult.phong,
    ngay,
    thang,
    nam,

    tienPhong: formatMoney(calcResult.tienPhong),

    dienMoi: String(calcResult.dienMoi !== undefined ? calcResult.dienMoi : 0),
    dienCu: String(calcResult.dienCu !== undefined ? calcResult.dienCu : 0),
    dienKwh: String(calcResult.dienKwh !== undefined ? calcResult.dienKwh : 0),
    giaDien: formatMoney(calcResult.giaDien),
    tienDien: formatMoney(calcResult.tienDien),

    nuocMoi: String(calcResult.nuocMoi !== undefined ? calcResult.nuocMoi : 0),
    nuocCu: String(calcResult.nuocCu !== undefined ? calcResult.nuocCu : 0),
    nuocKhoi: String(calcResult.nuocKhoi !== undefined ? calcResult.nuocKhoi : 0),
    giaNuoc: formatMoney(calcResult.giaNuoc),
    tienNuoc: formatMoney(calcResult.tienNuoc),

    rac: formatMoney(calcResult.rac),
    internet: formatMoney(calcResult.internet),

    haoTaiKwh: formatDecimalVN(calcResult.haoTaiKwh),
    giaHaoTai: formatMoney(calcResult.giaHaoTai),
    tienHaoTai: formatMoney(calcResult.tienHaoTai),

    dienMcLines: mcNotes.dienReceiptLines,
    nuocMcLines: mcNotes.nuocReceiptLines,

    tongCong: formatMoney(calcResult.tongCong)
  };
}

/**
 * Render mẫu tin nhắn Zalo và tự dọn dòng trống nếu biến thay ĐH ({ghiChuThayDien}, {ghiChuThayNuoc}) rỗng.
 * Không tự động chèn thêm ghi chú nếu trong mẫu không có biến.
 * @param {string} template
 * @param {Record<string, any>} values
 * @returns {string}
 */
function renderZaloTemplateWithMeterChange(template, values) {
  if (!template || typeof template !== 'string') return '';
  const safeValues = (values && typeof values === 'object') ? values : {};
  const rawLines = template.split(/\r?\n/);
  const outLines = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const hasMcVarOnLine = /\{(ghiChuThayDien|ghiChuThayNuoc)\}/.test(line);
    const replaced = line.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(safeValues, key)) {
        return String(safeValues[key] ?? '');
      }
      return match;
    });
    if (hasMcVarOnLine && replaced.trim() === '') {
      continue;
    }
    outLines.push(replaced);
  }

  return outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Chuẩn hóa tin nhắn Zalo sau khi thay biến (không tự động chèn thêm nếu mẫu không đặt biến).
 * @param {string} renderedMsg
 * @param {string} _rawTemplate
 * @param {string} _noteBlock
 * @param {boolean} _shouldInclude
 * @returns {string}
 */
function applyZaloMeterChangeNote(renderedMsg, _rawTemplate, _noteBlock, _shouldInclude) {
  return String(renderedMsg || '').replace(/\n{3,}/g, '\n\n').trim();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatMoney,
    formatDecimalVN,
    getNgayThangNam,
    toReceiptData,
    formatMcDateVN,
    buildMeterChangeDetailForType,
    formatRoomMeterChangeNotes,
    formatRoomMeterBreakNotes,
    renderZaloTemplateWithMeterChange,
    applyZaloMeterChangeNote
  };
}

if (typeof window !== 'undefined') {
  const win = /** @type {any} */ (window);
  win.formatMoney = formatMoney;
  win.formatDecimalVN = formatDecimalVN;
  win.getNgayThangNam = getNgayThangNam;
  win.toReceiptData = toReceiptData;
  win.formatMcDateVN = formatMcDateVN;
  win.buildMeterChangeDetailForType = buildMeterChangeDetailForType;
  win.formatRoomMeterChangeNotes = formatRoomMeterChangeNotes;
  win.formatRoomMeterBreakNotes = formatRoomMeterBreakNotes;
  win.renderZaloTemplateWithMeterChange = renderZaloTemplateWithMeterChange;
  win.applyZaloMeterChangeNote = applyZaloMeterChangeNote;
}

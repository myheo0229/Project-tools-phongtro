/**
 * ============================================================================
 * MODULE NHẬT KÝ HOẠT ĐỘNG (ACTIVITY LOG) - src/input/activity-log.js
 * ============================================================================
 * Quản lý toàn bộ việc ghi nhận sự kiện (Append-only), bảo vệ dữ liệu nhạy cảm (PII Masking),
 * và hiển thị giao diện Nhật Ký Hoạt Động (Timeline UI chữ to, rõ ràng, trực quan).
 */

let activityLogsList = [];
let activityLogCorruptedNotice = null;
let currentLogFilterCategory = 'ALL';
let currentLogFilterLevel = 'ALL';
let currentLogFilterDateRange = 'ALL';
let currentLogSearchQuery = '';
let currentLogSortNewestFirst = true;
let expandedLogIds = new Set();

// ============================================================================
// 1. CÁC HÀM BẢO MẬT & CHE MỜ THÔNG TIN CÁ NHÂN (PII DATA MASKING)
// ============================================================================

/**
 * Che mờ số điện thoại (VD: "0982 141 407" -> "098***1407")
 */
function maskPhoneForLog(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return '***';
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

/**
 * Che mờ số CCCD (VD: "079123456789" -> "079******789")
 */
function maskCccdForLog(cccd) {
  if (!cccd) return '';
  const digits = String(cccd).replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 3)}******${digits.slice(-3)}`;
}

/**
 * Che mờ số tài khoản ngân hàng (chỉ giữ tối đa 4 số cuối)
 */
function maskBankAccountForLog(acc) {
  if (!acc) return '';
  const clean = String(acc).trim();
  if (clean.length <= 4) return '****';
  return `****${clean.slice(-4)}`;
}

/**
 * Định dạng tiền tệ ngắn gọn cho Log (VD: 2900 -> "2.900đ")
 */
function formatMoneyForLog(num) {
  const n = Number(num) || 0;
  return `${n.toLocaleString('vi-VN')}đ`;
}

// ============================================================================
// 2. GIAO TIẾP IPC GHI VÀ ĐỌC NHẬT KÝ AN TOÀN
// ============================================================================

/**
 * Ghi thêm 1 dòng nhật ký xuống Main Process (Không bao giờ làm gián đoạn luồng chính)
 * @param {object} payload
 * @param {boolean} [warnOnFailure=false] - Cảnh báo nếu thao tác quan trọng không ghi được log
 */
async function recordActivityLog(payload, warnOnFailure = false) {
  if (!window.api || typeof window.api.appendActivityLog !== 'function') {
    return null;
  }
  try {
    const res = await window.api.appendActivityLog(payload);
    if (!res || !res.ok) {
      console.warn('[ActivityLog] Không thể ghi nhật ký:', res && res.error);
      if (warnOnFailure && typeof showToast === 'function' && res && res.error !== 'CHUA_CHON_THU_MUC') {
        showToast('Cảnh báo: Không thể ghi nhận vào Nhật Ký Hoạt Động!', 'warning');
      }
      return null;
    }
    if (res.entry) {
      activityLogsList.unshift(res.entry);
    }
    if (res.corruptedNotice) {
      activityLogCorruptedNotice = res.corruptedNotice;
    }
    return res.entry;
  } catch (err) {
    console.warn('[ActivityLog] Lỗi ngoại lệ khi ghi nhật ký:', err);
    return null;
  }
}

/**
 * Tải danh sách nhật ký từ đĩa thông qua Main Process
 */
async function fetchActivityLogsFromDisk() {
  if (!window.api || typeof window.api.loadActivityLogs !== 'function') {
    return [];
  }
  try {
    const res = await window.api.loadActivityLogs();
    if (res && res.ok) {
      activityLogsList = Array.isArray(res.logs) ? res.logs : [];
      activityLogCorruptedNotice = res.corruptedNotice || null;
    } else if (res && res.error && typeof showToast === 'function') {
      showToast(`Lỗi đọc file Nhật ký: ${res.error}`, 'error');
    }
    return activityLogsList;
  } catch (err) {
    console.error('[ActivityLog] Lỗi khi tải nhật ký:', err);
    return [];
  }
}

// ============================================================================
// 3. CÁC HÀM GHI LOG NGHIỆP VỤ CHO 5 NHÓM CHỨC NĂNG
// ============================================================================

/**
 * [NHÓM 1 - PRICING]: Ghi nhận thay đổi cài đặt giá, tỷ lệ hao tải, tùy chọn cảnh báo & Zalo
 */
async function logSettingsAndPricingChanges(oldSettings, newSettings) {
  if (!oldSettings || !newSettings) return;

  const changes = [];
  const summaryParts = [];

  const priceFields = [
    { key: 'giaPhong', label: 'Tiền phòng mặc định', unit: '/tháng' },
    { key: 'giaDien', label: 'Đơn giá điện', unit: '/kWh' },
    { key: 'giaNuoc', label: 'Đơn giá nước', unit: '/m³' },
    { key: 'tienRac', label: 'Tiền rác', unit: '/tháng' },
    { key: 'tienInternet', label: 'Tiền Internet', unit: '/tháng' }
  ];

  priceFields.forEach(item => {
    const oldVal = Number(oldSettings[item.key]) || 0;
    const newVal = Number(newSettings[item.key]) || 0;
    if (oldVal !== newVal) {
      changes.push({
        field: item.key,
        label: item.label,
        oldVal,
        newVal,
        displayOld: formatMoneyForLog(oldVal),
        displayNew: `${formatMoneyForLog(newVal)}${item.unit}`
      });
      summaryParts.push(`${item.label}: ${formatMoneyForLog(oldVal)} → ${formatMoneyForLog(newVal)}${item.unit}`);
    }
  });

  // Tỷ lệ điện hao tải (%)
  const oldHaoTaiPct = Math.round((Number(oldSettings.tyLeHaoTai) || 0) * 100);
  const newHaoTaiPct = Math.round((Number(newSettings.tyLeHaoTai) || 0) * 100);
  if (oldHaoTaiPct !== newHaoTaiPct) {
    changes.push({
      field: 'tyLeHaoTai',
      label: 'Tỷ lệ điện hao tải',
      oldVal: oldHaoTaiPct,
      newVal: newHaoTaiPct,
      displayOld: `${oldHaoTaiPct}%`,
      displayNew: `${newHaoTaiPct}%`
    });
    summaryParts.push(`Tỷ lệ điện hao tải: ${oldHaoTaiPct}% → ${newHaoTaiPct}%`);
  }

  // Số điện thoại hiển thị trên phiếu thu (Mask bảo mật)
  const oldPhone = String(oldSettings.dienThoai || '').trim();
  const newPhone = String(newSettings.dienThoai || '').trim();
  if (oldPhone !== newPhone) {
    changes.push({
      field: 'dienThoai',
      label: 'SĐT trên phiếu thu',
      changed: true,
      displayOld: maskPhoneForLog(oldPhone),
      displayNew: maskPhoneForLog(newPhone)
    });
    summaryParts.push(`SĐT phiếu thu: ${maskPhoneForLog(oldPhone)} → ${maskPhoneForLog(newPhone)}`);
  }

  // Tùy chọn bật/tắt popup cảnh báo
  if (Boolean(oldSettings.enableRolloverPopup) !== Boolean(newSettings.enableRolloverPopup)) {
    const stateText = newSettings.enableRolloverPopup ? 'Bật' : 'Tắt';
    changes.push({
      field: 'enableRolloverPopup',
      label: 'Cảnh báo công tơ quay vòng',
      oldVal: Boolean(oldSettings.enableRolloverPopup),
      newVal: Boolean(newSettings.enableRolloverPopup),
      displayOld: oldSettings.enableRolloverPopup ? 'Bật' : 'Tắt',
      displayNew: stateText
    });
    summaryParts.push(`Cảnh báo quay vòng: ${stateText}`);
  }

  if (Boolean(oldSettings.enableAnomalyPopup) !== Boolean(newSettings.enableAnomalyPopup)) {
    const stateText = newSettings.enableAnomalyPopup ? 'Bật' : 'Tắt';
    changes.push({
      field: 'enableAnomalyPopup',
      label: 'Cảnh báo điện lệch ≥ 40%',
      oldVal: Boolean(oldSettings.enableAnomalyPopup),
      newVal: Boolean(newSettings.enableAnomalyPopup),
      displayOld: oldSettings.enableAnomalyPopup ? 'Bật' : 'Tắt',
      displayNew: stateText
    });
    summaryParts.push(`Cảnh báo lệch 40%: ${stateText}`);
  }

  // Tùy chọn thành phần gửi Zalo
  const zaloToggleFields = [
    { key: 'zaloSendReceiptImage', label: 'Gửi hình phiếu thu Zalo' },
    { key: 'zaloSendPaymentQr', label: 'Gửi mã QR thanh toán Zalo' },
    { key: 'zaloSendMessageText', label: 'Gửi tin nhắn văn bản Zalo' }
  ];
  zaloToggleFields.forEach(item => {
    const oldBool = oldSettings[item.key] !== false;
    const newBool = newSettings[item.key] !== false;
    if (oldBool !== newBool) {
      const stateText = newBool ? 'Bật' : 'Tắt';
      changes.push({
        field: item.key,
        label: item.label,
        oldVal: oldBool,
        newVal: newBool,
        displayOld: oldBool ? 'Bật' : 'Tắt',
        displayNew: stateText
      });
      summaryParts.push(`${item.label}: ${stateText}`);
    }
  });

  if (String(oldSettings.zaloMessageTemplate || '').trim() !== String(newSettings.zaloMessageTemplate || '').trim()) {
    changes.push({
      field: 'zaloMessageTemplate',
      label: 'Mẫu tin nhắn Zalo',
      changed: true
    });
    summaryParts.push('Cập nhật mẫu tin nhắn Zalo');
  }

  if (changes.length === 0) return;

  const summaryText = `${summaryParts.join('; ')}.`;
  await recordActivityLog({
    category: 'PRICING',
    action: 'UPDATE_PRICING',
    level: 'warning',
    result: 'success',
    title: 'Thay đổi cài đặt giá',
    summary: summaryText,
    metadata: {
      target: 'settings',
      changes
    }
  });
}

/**
 * [NHÓM 1 - PRICING]: Ghi nhận thay đổi tài khoản ngân hàng VietQR (Không lưu full STK)
 */
async function logBankSettingsChange(oldBank, newBank) {
  if (!oldBank || !newBank) return;
  const changes = [];
  const parts = [];

  if ((oldBank.bankName || '') !== (newBank.bankName || '')) {
    changes.push({
      field: 'bankName',
      label: 'Ngân hàng',
      oldVal: oldBank.bankName || 'Chưa chọn',
      newVal: newBank.bankName || 'Chưa chọn'
    });
    parts.push(`Ngân hàng: ${oldBank.bankName || 'Trống'} → ${newBank.bankName || 'Trống'}`);
  }

  if ((oldBank.bankAccount || '') !== (newBank.bankAccount || '')) {
    changes.push({
      field: 'bankAccount',
      label: 'Số tài khoản',
      changed: true,
      displayOld: maskBankAccountForLog(oldBank.bankAccount),
      displayNew: maskBankAccountForLog(newBank.bankAccount)
    });
    parts.push(`Số TK: ${maskBankAccountForLog(newBank.bankAccount)}`);
  }

  if ((oldBank.bankOwner || '') !== (newBank.bankOwner || '')) {
    changes.push({
      field: 'bankOwner',
      label: 'Chủ tài khoản',
      changed: true
    });
    parts.push('Cập nhật tên chủ tài khoản');
  }

  if (changes.length === 0) return;

  await recordActivityLog({
    category: 'PRICING',
    action: 'UPDATE_BANK_ACCOUNT',
    level: 'warning',
    result: 'success',
    title: 'Cập nhật tài khoản ngân hàng QR',
    summary: `${parts.join('; ')}.`,
    metadata: {
      target: 'bank_settings',
      changes
    }
  });
}

/**
 * [NHÓM 2 - MONTH_DATA]: Mở khóa tháng đã xuất để chỉnh sửa (Tách riêng biệt)
 */
async function logUnlockMonthEvent(monthKey, reason = 'Người dùng xác nhận mở khóa để chỉnh sửa chỉ số') {
  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  await recordActivityLog({
    category: 'MONTH_DATA',
    action: 'UNLOCK_MONTH',
    level: 'warning',
    result: 'success',
    title: 'Mở khóa chỉnh sửa tháng',
    summary: `Đã mở khóa ${monthLabel} để chỉnh sửa số liệu.`,
    reason,
    metadata: {
      target: monthKey,
      monthKey,
      monthLabel,
      previousLockState: 'locked',
      newLockState: 'editing'
    }
  }, true);
}

/**
 * [NHÓM 2 - MONTH_DATA]: Hủy chỉnh sửa tháng và giữ nguyên dữ liệu cũ (Tách riêng biệt)
 */
async function logCancelMonthEditEvent(monthKey, currentRooms = [], backupRooms = []) {
  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  const diffRooms = computeChangedRoomsList(backupRooms, currentRooms);
  const diffText = diffRooms.length > 0
    ? ` (Đã khôi phục ${diffRooms.length} phòng: ${diffRooms.map(r => r.phong).join(', ')})`
    : '';

  await recordActivityLog({
    category: 'MONTH_DATA',
    action: 'CANCEL_MONTH_EDIT',
    level: 'info',
    result: 'success',
    title: 'Hủy chỉnh sửa tháng',
    summary: `Đã hủy thay đổi và giữ nguyên dữ liệu gốc của ${monthLabel}${diffText}.`,
    metadata: {
      target: monthKey,
      monthKey,
      monthLabel,
      revertedRoomsCount: diffRooms.length,
      revertedRooms: diffRooms.map(r => r.phong),
      lockStateAfter: 'locked'
    }
  });
}

/**
 * So sánh 2 danh sách phòng để tìm các phòng có thay đổi chỉ số điện/nước
 */
function computeChangedRoomsList(oldRooms = [], newRooms = []) {
  if (!Array.isArray(oldRooms) || !Array.isArray(newRooms) || oldRooms.length === 0) {
    return [];
  }
  const changed = [];
  newRooms.forEach((nr, idx) => {
    const or = oldRooms.find(item => item && item.phong === nr.phong) || oldRooms[idx];
    if (!or || !nr) return;
    const fields = ['dienCu', 'dienMoi', 'nuocCu', 'nuocMoi'];
    const roomDiffs = [];
    fields.forEach(f => {
      const vOld = or[f] === '' || or[f] === null || or[f] === undefined ? '' : Number(or[f]);
      const vNew = nr[f] === '' || nr[f] === null || nr[f] === undefined ? '' : Number(nr[f]);
      if (vOld !== vNew) {
        roomDiffs.push({
          field: f,
          oldVal: vOld === '' ? 'Trống' : vOld,
          newVal: vNew === '' ? 'Trống' : vNew
        });
      }
    });
    if (roomDiffs.length > 0) {
      changed.push({
        phong: nr.phong,
        changes: roomDiffs
      });
    }
  });
  return changed;
}

/**
 * [NHÓM 2 - MONTH_DATA]: Lưu & Xuất phiếu thu tháng (Ghi rõ tháng, các phòng thay đổi, kết quả xuất)
 */
async function logMonthSaveAndExportEvent({
  monthKey,
  wasEditingLockedMonth = false,
  backupRoomsBeforeEdit = null,
  currentRooms = [],
  jpgCount = 12,
  pdfFile = '',
  result = 'success',
  errorMsg = ''
}) {
  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  const changedRooms = backupRoomsBeforeEdit
    ? computeChangedRoomsList(backupRoomsBeforeEdit, currentRooms)
    : [];

  if (result !== 'success') {
    await recordActivityLog({
      category: 'MONTH_DATA',
      action: 'SAVE_AND_EXPORT_FAILED',
      level: 'critical',
      result: 'failed',
      title: 'Lưu & Xuất phiếu thu thất bại',
      summary: `${monthLabel}: Xuất phiếu thu thất bại (${errorMsg || 'Lỗi không xác định'}).`,
      metadata: {
        target: monthKey,
        monthKey,
        monthLabel,
        error: errorMsg
      }
    }, true);
    return;
  }

  let summary = `${monthLabel}: Đã lưu và xuất ${jpgCount} ảnh JPG + 1 PDF (${pdfFile}).`;
  if (wasEditingLockedMonth) {
    if (changedRooms.length > 0) {
      const roomNames = changedRooms.map(r => r.phong).join(', ');
      summary = `${monthLabel}: Đã chỉnh sửa ${changedRooms.length} phòng (${roomNames}), xuất lại ${jpgCount} ảnh JPG + 1 PDF (${pdfFile}) và khóa lại tháng.`;
    } else {
      summary = `${monthLabel}: Đã xuất lại ${jpgCount} ảnh JPG + 1 PDF (${pdfFile}) và khóa lại tháng (không có chỉ số nào thay đổi).`;
    }
  }

  await recordActivityLog({
    category: 'MONTH_DATA',
    action: wasEditingLockedMonth ? 'UPDATE_LOCKED_MONTH' : 'EXPORT_MONTH',
    level: wasEditingLockedMonth ? 'warning' : 'info',
    result: 'success',
    title: wasEditingLockedMonth ? 'Cập nhật & Xuất lại tháng đã khóa' : 'Lưu & Xuất phiếu thu tháng',
    summary,
    metadata: {
      target: monthKey,
      monthKey,
      monthLabel,
      wasEditingLockedMonth,
      changedRoomsCount: changedRooms.length,
      changedRooms,
      jpgCount,
      pdfFile,
      stateBefore: wasEditingLockedMonth ? 'editing' : 'unlocked',
      stateAfter: 'locked'
    }
  }, true);
}

/**
 * [NHÓM 2 - MONTH_DATA]: Xác nhận công tơ điện quay vòng (Rollover)
 */
async function logRolloverConfirmedEvent({ monthKey, phong, dienCu, dienMoi, kwh }) {
  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  await recordActivityLog({
    category: 'MONTH_DATA',
    action: 'CONFIRM_ROLLOVER',
    level: 'warning',
    result: 'success',
    title: `Xác nhận công tơ quay vòng (Phòng ${phong})`,
    summary: `Phòng ${phong} (${monthLabel}): Điện cũ ${dienCu} → Điện mới ${dienMoi} (Tính tiêu thụ: ${kwh} kWh).`,
    metadata: {
      target: `room_${phong}`,
      monthKey,
      phong,
      dienCu,
      dienMoi,
      calculatedKwh: kwh
    }
  });
}

/**
 * [NHÓM 2 - MONTH_DATA]: Xác nhận biến động điện >= 40%
 */
async function logAnomalyConfirmedEvent({ monthKey, phong, prevKwh, currKwh, diffPercent }) {
  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  const diffStr = String(diffPercent || '').endsWith('%') ? String(diffPercent) : `${diffPercent}%`;
  await recordActivityLog({
    category: 'MONTH_DATA',
    action: 'CONFIRM_ANOMALY',
    level: 'warning',
    result: 'success',
    title: `Xác nhận biến động điện (Phòng ${phong})`,
    summary: `Phòng ${phong} (${monthLabel}): Tiêu thụ ${currKwh} kWh (Chênh lệch ${diffStr} so với tháng trước: ${prevKwh} kWh).`,
    metadata: {
      target: `room_${phong}`,
      monthKey,
      phong,
      prevKwh,
      currKwh,
      diffPercent: diffStr
    }
  });
}

/**
 * [NHÓM 3 - RESIDENTS]: Thêm hồ sơ người thuê mới (Không lưu full CCCD/SĐT)
 */
async function logAddResidentEvent(resident, roomName = '') {
  if (!resident) return;
  const roomText = roomName ? ` · Phòng ${roomName}` : ' · Chưa xếp phòng';
  await recordActivityLog({
    category: 'RESIDENTS',
    action: 'ADD_RESIDENT',
    level: 'info',
    result: 'success',
    title: 'Thêm hồ sơ người thuê',
    summary: `Đã thêm: ${resident.hoTen} (Mã: ${resident.id})${roomText}.`,
    metadata: {
      target: resident.id,
      residentId: resident.id,
      hoTen: resident.hoTen,
      phong: roomName || '',
      ngayVaoO: resident.ngayVaoO || ''
    }
  });
}

/**
 * [NHÓM 3 - RESIDENTS]: Cập nhật hồ sơ người thuê & Chuyển phòng (TRANSFER_RESIDENT)
 * Với thông tin nhạy cảm (CCCD, SĐT) chỉ ghi nhận changed: true, không lưu giá trị gốc
 */
async function logUpdateResidentEvent(oldResident, newResident, oldRoom = '', newRoom = '') {
  if (!oldResident || !newResident) return;

  // 1. Kiểm tra nếu có chuyển phòng -> Tạo log TRANSFER_RESIDENT riêng biệt
  if ((oldRoom || '') !== (newRoom || '')) {
    const fromLabel = oldRoom ? `Phòng ${oldRoom}` : 'Chưa xếp phòng';
    const toLabel = newRoom ? `Phòng ${newRoom}` : 'Rời phòng';
    await recordActivityLog({
      category: 'RESIDENTS',
      action: 'TRANSFER_RESIDENT',
      level: 'warning',
      result: 'success',
      title: 'Chuyển phòng người thuê',
      summary: `${newResident.hoTen} (Mã: ${newResident.id}): ${fromLabel} → ${toLabel}.`,
      metadata: {
        target: newResident.id,
        residentId: newResident.id,
        hoTen: newResident.hoTen,
        fromRoom: oldRoom || '',
        toRoom: newRoom || ''
      }
    });
  }

  // 2. Kiểm tra các trường thông tin cá nhân thay đổi
  const changes = [];
  const changedLabels = [];

  if ((oldResident.hoTen || '') !== (newResident.hoTen || '')) {
    changes.push({
      field: 'hoTen',
      label: 'Họ và tên',
      oldVal: oldResident.hoTen || '',
      newVal: newResident.hoTen || ''
    });
    changedLabels.push(`Họ tên (${oldResident.hoTen} → ${newResident.hoTen})`);
  }

  if ((oldResident.gioiTinh || '') !== (newResident.gioiTinh || '')) {
    changes.push({
      field: 'gioiTinh',
      label: 'Giới tính',
      oldVal: oldResident.gioiTinh || '',
      newVal: newResident.gioiTinh || ''
    });
    changedLabels.push('Giới tính');
  }

  if ((oldResident.ngayVaoO || '') !== (newResident.ngayVaoO || '')) {
    changes.push({
      field: 'ngayVaoO',
      label: 'Ngày vào ở',
      oldVal: oldResident.ngayVaoO || 'Trống',
      newVal: newResident.ngayVaoO || 'Trống'
    });
    changedLabels.push('Ngày vào ở');
  }

  // Các trường nhạy cảm: chỉ ghi nhận trường đã thay đổi (changed: true)
  const sensitiveFields = [
    { key: 'cccd', label: 'Số CCCD' },
    { key: 'sdtGoi', label: 'SĐT Gọi' },
    { key: 'sdtZalo', label: 'SĐT Zalo' },
    { key: 'ngaySinh', label: 'Ngày sinh' },
    { key: 'anhCccdMatTruoc', label: 'Ảnh CCCD mặt trước' },
    { key: 'anhCccdMatSau', label: 'Ảnh CCCD mặt sau' }
  ];

  sensitiveFields.forEach(item => {
    if (String(oldResident[item.key] || '') !== String(newResident[item.key] || '')) {
      changes.push({
        field: item.key,
        label: item.label,
        changed: true
      });
      changedLabels.push(item.label);
    }
  });

  if (changes.length === 0) return;

  await recordActivityLog({
    category: 'RESIDENTS',
    action: 'UPDATE_RESIDENT',
    level: 'info',
    result: 'success',
    title: 'Cập nhật hồ sơ người thuê',
    summary: `${newResident.hoTen} (Mã: ${newResident.id}): Đã thay đổi ${changedLabels.join(', ')}.`,
    metadata: {
      target: newResident.id,
      residentId: newResident.id,
      hoTen: newResident.hoTen,
      phong: newRoom || '',
      changes
    }
  });
}

/**
 * [NHÓM 3 - RESIDENTS]: Xóa hồ sơ người thuê (Giữ nguyên tên + mã người thuê tại thời điểm xóa)
 */
async function logDeleteResidentEvent(residentSnapshot, roomName = '') {
  if (!residentSnapshot) return;
  const roomText = roomName ? `, Phòng ${roomName}` : '';
  await recordActivityLog({
    category: 'RESIDENTS',
    action: 'DELETE_RESIDENT',
    level: 'warning',
    result: 'success',
    title: 'Xóa hồ sơ người thuê',
    summary: `Đã xóa hồ sơ: ${residentSnapshot.hoTen || 'Không tên'} (Mã: ${residentSnapshot.id}${roomText}).`,
    metadata: {
      target: residentSnapshot.id,
      residentId: residentSnapshot.id,
      deletedNameSnapshot: residentSnapshot.hoTen || '',
      lastRoomSnapshot: roomName || '',
      ngayVaoOSnapshot: residentSnapshot.ngayVaoO || ''
    }
  });
}

/**
 * [NHÓM 3 - RESIDENTS]: Cập nhật phân bổ thành viên & chủ phòng trong Modal chi tiết phòng
 */
async function logRoomDetailAssignmentEvent({
  phong,
  oldHostName = '',
  newHostName = '',
  oldRepresentativeName = '',
  newRepresentativeName = '',
  addedResidents = [],
  removedResidents = []
}) {
  const oldRep = oldHostName || oldRepresentativeName || '';
  const newRep = newHostName || newRepresentativeName || '';
  const parts = [];
  if ((oldRep || '') !== (newRep || '')) {
    parts.push(`Chủ phòng: ${oldRep || 'Chưa chọn'} → ${newRep || 'Chưa chọn'}`);
  }
  if (addedResidents.length > 0) {
    parts.push(`Thêm vào phòng: ${addedResidents.map(r => `${r.hoTen} (${r.id})`).join(', ')}`);
  }
  if (removedResidents.length > 0) {
    parts.push(`Rời phòng: ${removedResidents.map(r => `${r.hoTen} (${r.id})`).join(', ')}`);
  }
  if (parts.length === 0) return;

  await recordActivityLog({
    category: 'RESIDENTS',
    action: 'ASSIGN_ROOM_MEMBERS',
    level: 'info',
    result: 'success',
    title: `Cập nhật người ở Phòng ${phong}`,
    summary: `Phòng ${phong}: ${parts.join('; ')}.`,
    metadata: {
      target: `room_${phong}`,
      phong,
      oldRepresentativeName: oldRep || '',
      newRepresentativeName: newRep || '',
      addedResidents,
      removedResidents
    }
  });
}

/**
 * [NHÓM 3 - RESIDENTS]: Xuất danh sách người thuê ra file Excel
 */
async function logExportResidentsExcelEvent({ count, fileName }) {
  await recordActivityLog({
    category: 'RESIDENTS',
    action: 'EXPORT_RESIDENTS_EXCEL',
    level: 'info',
    result: 'success',
    title: 'Xuất Excel danh sách người thuê',
    summary: `Đã xuất ${count} người thuê ra file ${fileName}.`,
    metadata: {
      target: 'residents_excel',
      exportedCount: count,
      fileName
    }
  });
}

/**
 * [NHÓM 4 - ZALO]: Ghi nhận kết quả gửi phiếu thu qua Zalo chi tiết từng phòng
 */
async function logZaloSendBatchEvent({
  monthKey,
  results = [],
  sendReceiptImg = true,
  sendPaymentQr = true,
  sendMessageText = true
}) {
  if (!Array.isArray(results) || results.length === 0) return;

  const monthLabel = typeof formatMonthLabel === 'function' ? formatMonthLabel(monthKey) : monthKey;
  const sentParts = [];
  if (sendReceiptImg) sentParts.push('ảnh phiếu');
  if (sendPaymentQr) sentParts.push('QR');
  if (sendMessageText) sentParts.push('nội dung');
  const defaultSuccessDetail = `Đã gửi ${sentParts.join(' + ')}`;

  let successCount = 0;
  let failCount = 0;

  const roomResults = results.map(item => {
    const isOk = Boolean(item.success || item.status === 'success');
    if (isOk) {
      successCount++;
    } else {
      failCount++;
    }
    return {
      phong: item.phong,
      tenKhach: item.tenChuPhong || item.tenKhach || '',
      status: isOk ? 'success' : 'failed',
      statusText: isOk ? 'Thành công' : 'Thất bại',
      details: isOk ? defaultSuccessDetail : (item.error || item.reason || 'Lỗi không xác định')
    };
  });

  const total = results.length;
  let overallResult = 'success';
  let level = 'info';
  if (failCount > 0 && successCount > 0) {
    overallResult = 'partial';
    level = 'warning';
  } else if (failCount > 0 && successCount === 0) {
    overallResult = 'failed';
    level = 'critical';
  }

  const failedRoomCodes = roomResults.filter(r => r.status === 'failed').map(r => r.phong).join(', ');
  const summary = failCount === 0
    ? `${monthLabel}: Đã gửi Zalo thành công ${successCount}/${total} phòng (${defaultSuccessDetail}).`
    : `${monthLabel}: Thành công ${successCount}/${total} phòng, thất bại ${failCount} phòng (${failedRoomCodes}).`;

  await recordActivityLog({
    category: 'ZALO',
    action: 'SEND_ZALO_RECEIPTS',
    level,
    result: overallResult,
    title: 'Gửi phiếu thu qua Zalo',
    summary,
    metadata: {
      target: monthKey,
      monthKey,
      monthLabel,
      totalRooms: total,
      successCount,
      failCount,
      componentsSent: sentParts,
      roomResults
    }
  });
}

/**
 * [NHÓM 5 - BACKUP]: Phân biệt rõ 4 loại hành động:
 * - CREATE_LOCAL_BACKUP
 * - UPLOAD_DRIVE_BACKUP
 * - RESTORE_BACKUP
 * - BACKUP_FAILED
 */
async function logBackupExecutionResult(result) {
  if (!result) return;
  const info = result.lastBackupInfo || {};
  const zipFileName = info.zipFileName || '';
  const zipSizeFormatted = info.zipSizeFormatted || '';

  // Trường hợp 1: Thành công trọn vẹn (Tạo ZIP local + Tải lên Google Drive thành công)
  if (result.ok) {
    await recordActivityLog({
      category: 'BACKUP',
      action: 'CREATE_LOCAL_BACKUP',
      level: 'info',
      result: 'success',
      title: 'Tạo bản sao lưu',
      summary: zipFileName || 'Đã tạo bản sao lưu ZIP tại máy thành công.',
      metadata: {
        target: 'local_backup',
        zipFileName,
        zipSizeFormatted,
        zipSizeBytes: info.zipSizeBytes || 0
      }
    });

    await recordActivityLog({
      category: 'BACKUP',
      action: 'UPLOAD_DRIVE_BACKUP',
      level: 'info',
      result: 'success',
      title: 'Tải sao lưu lên Google Drive',
      summary: `Đã tải ${zipFileName} (${zipSizeFormatted}) lên Google Drive thành công.`,
      metadata: {
        target: 'google_drive_backup',
        zipFileName,
        zipSizeFormatted,
        driveFileId: info.driveFileId || ''
      }
    });
    return;
  }

  // Trường hợp 2: Tạo ZIP tại máy thành công nhưng tải lên Google Drive thất bại
  if (zipFileName) {
    await recordActivityLog({
      category: 'BACKUP',
      action: 'CREATE_LOCAL_BACKUP',
      level: 'info',
      result: 'success',
      title: 'Tạo bản sao lưu tại máy',
      summary: zipFileName,
      metadata: {
        target: 'local_backup',
        zipFileName,
        zipSizeFormatted,
        zipSizeBytes: info.zipSizeBytes || 0
      }
    });

    await recordActivityLog({
      category: 'BACKUP',
      action: 'BACKUP_FAILED',
      level: 'warning',
      result: 'partial',
      title: 'Tải sao lưu lên Google Drive thất bại',
      summary: `Đã lưu ${zipFileName} tại máy, nhưng tải lên Google Drive thất bại: ${result.message || 'Lỗi kết nối'}.`,
      metadata: {
        target: 'google_drive_backup',
        zipFileName,
        zipSizeFormatted,
        stageFailed: 'upload_drive',
        errorMessage: result.message || ''
      }
    });
    return;
  }

  // Trường hợp 3: Thất bại ngay từ bước kiểm tra hoặc nén ZIP
  await recordActivityLog({
    category: 'BACKUP',
    action: 'BACKUP_FAILED',
    level: 'critical',
    result: 'failed',
    title: 'Sao lưu dữ liệu thất bại',
    summary: result.message || 'Không thể tạo bản sao lưu dữ liệu.',
    metadata: {
      target: 'backup_system',
      stageFailed: 'create_zip',
      errorMessage: result.message || ''
    }
  });
}

// ============================================================================
// 4. GIAO DIỆN NHẬT KÝ HOẠT ĐỘNG (UI TIMELINE MODAL)
// ============================================================================

/**
 * Mở Modal Nhật Ký Hoạt Động
 */
async function openActivityLogModal() {
  const modal = document.getElementById('activity-log-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  await refreshActivityLogUI(false);
}

/**
 * Đóng Modal Nhật Ký Hoạt Động
 */
function closeActivityLogModal() {
  const modal = document.getElementById('activity-log-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Làm mới dữ liệu Nhật ký từ đĩa và vẽ lại giao diện
 */
async function refreshActivityLogUI(showToastFeedback = true) {
  await fetchActivityLogsFromDisk();
  renderActivityLogNotice();
  renderActivityLogList();
  if (showToastFeedback && typeof showToast === 'function') {
    showToast('Đã làm mới Nhật ký hoạt động!', 'success');
  }
}

/**
 * Hiển thị cảnh báo nếu file Log từng bị lỗi và đã được hệ thống cứu hộ
 */
function renderActivityLogNotice() {
  const banner = document.getElementById('activity-log-corrupted-banner');
  const textEl = document.getElementById('activity-log-corrupted-text');
  if (!banner || !textEl) return;

  if (activityLogCorruptedNotice) {
    textEl.textContent = activityLogCorruptedNotice;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

/**
 * Đóng cảnh báo file lỗi
 */
async function handleDismissCorruptedLogNotice() {
  activityLogCorruptedNotice = null;
  renderActivityLogNotice();
  if (window.api && typeof window.api.dismissCorruptedLogNotice === 'function') {
    await window.api.dismissCorruptedLogNotice();
  }
}

/**
 * Chọn tab lọc Category
 */
function setActivityLogCategoryFilter(category) {
  currentLogFilterCategory = category || 'ALL';
  document.querySelectorAll('.alog-pill-btn').forEach(btn => {
    const btnCat = btn.getAttribute('data-category');
    if (btnCat === currentLogFilterCategory) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderActivityLogList();
}

/**
 * Xử lý khi gõ tìm kiếm hoặc đổi bộ lọc phụ (Mức độ / Khoảng thời gian)
 */
function handleActivityLogFilterChange() {
  const searchInput = document.getElementById('activity-log-search-input');
  const levelSelect = document.getElementById('activity-log-level-select');
  const dateSelect = document.getElementById('activity-log-date-select');

  currentLogSearchQuery = searchInput ? searchInput.value.trim() : '';
  currentLogFilterLevel = levelSelect ? levelSelect.value : 'ALL';
  currentLogFilterDateRange = dateSelect ? dateSelect.value : 'ALL';

  renderActivityLogList();
}

/**
 * Đảo thứ tự sắp xếp Mới nhất trước / Cũ nhất trước
 */
function toggleActivityLogSortOrder() {
  currentLogSortNewestFirst = !currentLogSortNewestFirst;
  const sortBtn = document.getElementById('activity-log-sort-btn');
  if (sortBtn) {
    sortBtn.textContent = currentLogSortNewestFirst ? 'Mới nhất trước' : 'Cũ nhất trước';
  }
  renderActivityLogList();
}

/**
 * Mở rộng / Thu gọn khung chi tiết của 1 dòng Log khi click vào
 */
function toggleActivityLogDetail(logId) {
  if (!logId) return;
  if (expandedLogIds.has(logId)) {
    expandedLogIds.delete(logId);
  } else {
    expandedLogIds.add(logId);
  }
  renderActivityLogList();
}

/**
 * Xuất toàn bộ Nhật ký ra file JSON
 */
async function handleExportActivityLogsJson() {
  if (!window.api || typeof window.api.exportActivityLogsJson !== 'function') return;
  try {
    const res = await window.api.exportActivityLogsJson();
    if (res && res.canceled) return;
    if (res && res.ok) {
      if (typeof showToast === 'function') {
        showToast(`Đã xuất ${res.count} sự kiện nhật ký ra file JSON thành công!`, 'success');
      }
    } else if (res && res.error && typeof showToast === 'function') {
      showToast(`Lỗi khi xuất nhật ký: ${res.error}`, 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Lỗi khi xuất nhật ký: ${err.message}`, 'error');
    }
  }
}

/**
 * Lấy icon SVG và class màu sắc theo từng Category giống minh họa UI
 */
function getCategoryIconAndStyle(category) {
  switch (category) {
    case 'PRICING':
      return {
        boxClass: 'alog-icon-box pricing',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>`
      };
    case 'BACKUP':
      return {
        boxClass: 'alog-icon-box backup',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 12h-6l-2 3h-4l-2-3H2"></path>
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
        </svg>`
      };
    case 'MONTH_DATA':
      return {
        boxClass: 'alog-icon-box month',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>`
      };
    case 'RESIDENTS':
      return {
        boxClass: 'alog-icon-box residents',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>`
      };
    case 'ZALO':
      return {
        boxClass: 'alog-icon-box zalo',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>`
      };
    default:
      return {
        boxClass: 'alog-icon-box system',
        svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>`
      };
  }
}

/**
 * Tách thông tin ngày và giờ từ bản ghi Log
 */
function extractDateAndTimeParts(logItem) {
  const d = new Date(logItem.timestamp || Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const dateStr = `${dd}/${mm}/${yyyy}`;
  const timeFull = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const timeShort = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // Kiểm tra Hôm nay / Hôm qua
  const now = new Date();
  const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${pad(yesterday.getDate())}/${pad(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;

  let dayHeaderLabel = `Ngày ${dateStr}`;
  if (dateStr === todayStr) {
    dayHeaderLabel = `Hôm nay · ${dateStr}`;
  } else if (dateStr === yesterdayStr) {
    dayHeaderLabel = `Hôm qua · ${dateStr}`;
  }

  return {
    dateKey: `${yyyy}-${mm}-${dd}`,
    dateStr,
    dayHeaderLabel,
    timeFull,
    timeShort
  };
}

/**
 * Tạo HTML khung chi tiết khi người dùng nhấn vào 1 dòng Log
 */
function buildExpandedDetailHtml(item) {
  const meta = item.metadata || {};
  let detailBlocks = '';

  // 1. Bảng thay đổi Trước -> Sau (Pricing / Settings / Resident fields)
  if (Array.isArray(meta.changes) && meta.changes.length > 0) {
    const rowsHtml = meta.changes.map(ch => {
      if (ch.changed && ch.displayOld === undefined && ch.oldVal === undefined) {
        return `<tr>
          <td><strong>${escapeHtmlForLog(ch.label || ch.field)}</strong></td>
          <td colspan="2" class="alog-detail-muted">Đã cập nhật thông tin (Được ẩn bảo mật)</td>
        </tr>`;
      }
      const oldText = ch.displayOld !== undefined ? ch.displayOld : (ch.oldVal !== undefined ? ch.oldVal : '-');
      const newText = ch.displayNew !== undefined ? ch.displayNew : (ch.newVal !== undefined ? ch.newVal : '-');
      return `<tr>
        <td><strong>${escapeHtmlForLog(ch.label || ch.field)}</strong></td>
        <td class="alog-val-old">${escapeHtmlForLog(String(oldText))}</td>
        <td class="alog-val-new">${escapeHtmlForLog(String(newText))}</td>
      </tr>`;
    }).join('');

    detailBlocks += `
      <div class="alog-detail-section">
        <div class="alog-detail-section-title">Chi tiết các mục thay đổi:</div>
        <table class="alog-detail-table">
          <thead>
            <tr>
              <th>Mục thông tin</th>
              <th>Giá trị trước</th>
              <th>Giá trị mới</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // 2. Bảng các phòng thay đổi chỉ số trong tháng
  if (Array.isArray(meta.changedRooms) && meta.changedRooms.length > 0) {
    const fieldNames = {
      dienCu: 'Điện Cũ',
      dienMoi: 'Điện Mới',
      nuocCu: 'Nước Cũ',
      nuocMoi: 'Nước Mới'
    };
    const roomRows = meta.changedRooms.map(rm => {
      const desc = (rm.changes || []).map(c => `${fieldNames[c.field] || c.field}: ${c.oldVal} → ${c.newVal}`).join(' | ');
      return `<tr>
        <td><strong>Phòng ${escapeHtmlForLog(rm.phong)}</strong></td>
        <td>${escapeHtmlForLog(desc)}</td>
      </tr>`;
    }).join('');

    detailBlocks += `
      <div class="alog-detail-section">
        <div class="alog-detail-section-title">Danh sách phòng có thay đổi số liệu (${meta.changedRooms.length} phòng):</div>
        <table class="alog-detail-table">
          <thead>
            <tr>
              <th style="width: 110px;">Phòng</th>
              <th>Chi tiết chỉ số thay đổi</th>
            </tr>
          </thead>
          <tbody>${roomRows}</tbody>
        </table>
      </div>
    `;
  }

  // 3. Bảng kết quả gửi Zalo từng phòng
  if (Array.isArray(meta.roomResults) && meta.roomResults.length > 0) {
    const zaloRows = meta.roomResults.map(r => {
      const badgeClass = r.status === 'success' ? 'alog-status-inline success' : 'alog-status-inline failed';
      return `<tr>
        <td><strong>Phòng ${escapeHtmlForLog(r.phong)}</strong></td>
        <td><span class="${badgeClass}">${escapeHtmlForLog(r.statusText || (r.status === 'success' ? 'Thành công' : 'Thất bại'))}</span></td>
        <td>${escapeHtmlForLog(r.details || '')}</td>
      </tr>`;
    }).join('');

    detailBlocks += `
      <div class="alog-detail-section">
        <div class="alog-detail-section-title">Kết quả gửi Zalo từng phòng:</div>
        <table class="alog-detail-table">
          <thead>
            <tr>
              <th style="width: 100px;">Phòng</th>
              <th style="width: 130px;">Kết quả</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>${zaloRows}</tbody>
        </table>
      </div>
    `;
  }

  // 4. Thông tin 메타 bổ sung (Hành động, Thời gian VN, Phiên bản, Đối tượng)
  const levelLabelMap = {
    info: 'Thông tin (Info)',
    warning: 'Cảnh báo / Quan trọng (Warning)',
    critical: 'Nghiêm trọng (Critical)'
  };

  return `
    <div class="alog-expanded-panel" onclick="event.stopPropagation()">
      <div class="alog-meta-grid">
        <div class="alog-meta-cell">
          <span class="alog-meta-label">Mã hành động:</span>
          <span class="alog-meta-val">${escapeHtmlForLog(item.action || '-')}</span>
        </div>
        <div class="alog-meta-cell">
          <span class="alog-meta-label">Thời gian chuẩn VN:</span>
          <span class="alog-meta-val">${escapeHtmlForLog(item.timeVn || '-')}</span>
        </div>
        <div class="alog-meta-cell">
          <span class="alog-meta-label">Mức độ:</span>
          <span class="alog-meta-val">${escapeHtmlForLog(levelLabelMap[item.level] || item.level || 'Thông tin')}</span>
        </div>
        <div class="alog-meta-cell">
          <span class="alog-meta-label">Phiên bản ứng dụng:</span>
          <span class="alog-meta-val">${escapeHtmlForLog(item.appVersion || 'v4.0.0')}</span>
        </div>
      </div>
      ${item.reason ? `<div class="alog-reason-line"><strong>Ghi chú / Lý do:</strong> ${escapeHtmlForLog(item.reason)}</div>` : ''}
      ${detailBlocks}
    </div>
  `;
}

function escapeHtmlForLog(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render danh sách Nhật Ký Hoạt Động theo đúng bố cục minh họa UI
 */
function renderActivityLogList() {
  const container = document.getElementById('activity-log-timeline-container');
  const countLabel = document.getElementById('activity-log-count-text');
  if (!container) return;

  const totalCount = activityLogsList.length;
  const nowMs = Date.now();
  const queryNorm = typeof removeVietnameseTones === 'function'
    ? removeVietnameseTones(currentLogSearchQuery.toLowerCase())
    : currentLogSearchQuery.toLowerCase();

  // Lọc danh sách
  let filtered = activityLogsList.filter(item => {
    if (!item) return false;

    // 1. Lọc theo Category
    if (currentLogFilterCategory !== 'ALL' && item.category !== currentLogFilterCategory) {
      return false;
    }

    // 2. Lọc theo Level
    if (currentLogFilterLevel !== 'ALL' && item.level !== currentLogFilterLevel) {
      return false;
    }

    // 3. Lọc theo khoảng thời gian
    if (currentLogFilterDateRange !== 'ALL') {
      const itemTime = new Date(item.timestamp || 0).getTime();
      if (currentLogFilterDateRange === 'TODAY') {
        const d1 = new Date(itemTime);
        const d2 = new Date();
        if (
          d1.getDate() !== d2.getDate() ||
          d1.getMonth() !== d2.getMonth() ||
          d1.getFullYear() !== d2.getFullYear()
        ) {
          return false;
        }
      } else if (currentLogFilterDateRange === '7DAYS') {
        if (nowMs - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (currentLogFilterDateRange === '30DAYS') {
        if (nowMs - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
      }
    }

    // 4. Lọc theo từ khóa tìm kiếm
    if (queryNorm) {
      const searchableText = [
        item.id,
        item.title,
        item.summary,
        item.category,
        item.action,
        item.timeVn,
        JSON.stringify(item.metadata || {})
      ].join(' ').toLowerCase();

      const normText = typeof removeVietnameseTones === 'function'
        ? removeVietnameseTones(searchableText)
        : searchableText;

      if (!normText.includes(queryNorm) && !searchableText.includes(currentLogSearchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Sắp xếp
  filtered.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return currentLogSortNewestFirst ? (tb - ta) : (ta - tb);
  });

  if (countLabel) {
    countLabel.textContent = `Hiển thị ${filtered.length} / ${totalCount} sự kiện`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="alog-empty-state">
        <div class="alog-empty-icon">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <div class="alog-empty-title">Chưa có sự kiện nhật ký nào phù hợp</div>
        <div class="alog-empty-sub">Mọi thao tác thay đổi đơn giá, khóa/mở khóa tháng, quản lý người thuê, gửi Zalo và sao lưu sẽ tự động lưu vết tại đây.</div>
      </div>
    `;
    return;
  }

  // Nhóm các sự kiện theo Ngày (giống hệt bố cục "Hôm nay · 07/11/2026" trên ảnh mẫu)
  const dayGroups = [];
  const groupMap = new Map();

  filtered.forEach(item => {
    const parts = extractDateAndTimeParts(item);
    let group = groupMap.get(parts.dateKey);
    if (!group) {
      group = {
        dateKey: parts.dateKey,
        dayHeaderLabel: parts.dayHeaderLabel,
        firstTimeShort: parts.timeShort,
        items: []
      };
      groupMap.set(parts.dateKey, group);
      dayGroups.push(group);
    }
    group.items.push({ item, parts });
  });

  const htmlGroups = dayGroups.map(group => {
    const itemsHtml = group.items.map(({ item, parts }) => {
      const iconInfo = getCategoryIconAndStyle(item.category);
      const isExpanded = expandedLogIds.has(item.id);
      const meta = item.metadata || {};

      // Trạng thái Thành công / Thất bại / Một phần (+ thông tin dung lượng nếu là Backup)
      let statusLabel = 'Thành công';
      let statusClass = 'alog-result-line success';
      if (item.result === 'failed') {
        statusLabel = 'Thất bại';
        statusClass = 'alog-result-line failed';
      } else if (item.result === 'partial') {
        statusLabel = 'Hoàn thành một phần';
        statusClass = 'alog-result-line partial';
      }

      if (item.category === 'BACKUP' && meta.zipSizeFormatted) {
        statusLabel = `${statusLabel} · ${meta.zipSizeFormatted}`;
      }

      const expandedHtml = isExpanded ? buildExpandedDetailHtml(item) : '';

      return `
        <div class="alog-event-row ${isExpanded ? 'expanded' : ''}" onclick="toggleActivityLogDetail('${escapeHtmlForLog(item.id)}')">
          <div class="alog-event-main">
            <div class="${iconInfo.boxClass}">
              ${iconInfo.svg}
            </div>
            <div class="alog-event-content">
              <div class="alog-event-top-line">
                <h4 class="alog-event-title">${escapeHtmlForLog(item.title)}</h4>
                <span class="alog-event-chevron ${isExpanded ? 'rotated' : ''}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
              </div>
              <div class="alog-event-submeta">${escapeHtmlForLog(item.category)} · ${escapeHtmlForLog(parts.timeFull)}</div>
              <div class="alog-event-summary">${escapeHtmlForLog(item.summary)}</div>
              <div class="${statusClass}">${escapeHtmlForLog(statusLabel)}</div>
              <div class="alog-event-id">Mã: ${escapeHtmlForLog(item.id)}</div>
            </div>
          </div>
          ${expandedHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="alog-day-group">
        <div class="alog-day-header">
          <span class="alog-day-title">${escapeHtmlForLog(group.dayHeaderLabel)}</span>
          <span class="alog-day-time">${escapeHtmlForLog(group.firstTimeShort)}</span>
        </div>
        <div class="alog-day-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = htmlGroups;
}

// Phơi các hàm ra global window để HTML và renderer.js gọi trực tiếp
window.openActivityLogModal = openActivityLogModal;
window.closeActivityLogModal = closeActivityLogModal;
window.refreshActivityLogUI = refreshActivityLogUI;
window.handleDismissCorruptedLogNotice = handleDismissCorruptedLogNotice;
window.setActivityLogCategoryFilter = setActivityLogCategoryFilter;
window.handleActivityLogFilterChange = handleActivityLogFilterChange;
window.toggleActivityLogSortOrder = toggleActivityLogSortOrder;
window.toggleActivityLogDetail = toggleActivityLogDetail;
window.handleExportActivityLogsJson = handleExportActivityLogsJson;

window.recordActivityLog = recordActivityLog;
window.logSettingsAndPricingChanges = logSettingsAndPricingChanges;
window.logBankSettingsChange = logBankSettingsChange;
window.logUnlockMonthEvent = logUnlockMonthEvent;
window.logCancelMonthEditEvent = logCancelMonthEditEvent;
window.logMonthSaveAndExportEvent = logMonthSaveAndExportEvent;
window.logRolloverConfirmedEvent = logRolloverConfirmedEvent;
window.logAnomalyConfirmedEvent = logAnomalyConfirmedEvent;
window.logAddResidentEvent = logAddResidentEvent;
window.logUpdateResidentEvent = logUpdateResidentEvent;
window.logDeleteResidentEvent = logDeleteResidentEvent;
window.logRoomDetailAssignmentEvent = logRoomDetailAssignmentEvent;
window.logExportResidentsExcelEvent = logExportResidentsExcelEvent;
window.logZaloSendBatchEvent = logZaloSendBatchEvent;
window.logBackupExecutionResult = logBackupExecutionResult;

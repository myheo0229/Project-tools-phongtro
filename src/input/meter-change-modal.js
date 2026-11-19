/// <reference path="./globals.d.ts" />
/**
 * ============================================================================
 * MODULE XỬ LÝ LOGIC & UI THAY ĐỔI ĐỒNG HỒ ĐIỆN / NƯỚC
 * src/input/meter-change-modal.js
 * ============================================================================
 * - Lưu trữ lịch sử chi tiết vào <baseFolder>/data/meter-changes.json qua IPC
 * - Hỗ trợ 3 cấp độ: "Đang theo dõi" -> "Hãy nhập ô 4" (nền xanh) -> "Đã đủ"
 * - Chỉ cho nhập số nguyên không âm (0-9) tuần tự Ô 1 -> Ô 2 -> Ô 3 (ngoại lệ mặc định 0) -> Ô 4
 * - Hỗ trợ đồng hồ quay vòng (Ô 2 < Ô 1 hoặc Ô 4 < Ô 3), thiếu dữ liệu tháng trước (!)
 *   và popup xác nhận số chữ số đồng hồ mới đồng bộ trực tiếp sang Cài Đặt Chung
 * - Đồng bộ 2 chiều với bảng Phần 1 (renderer.js) và ghi Activity Log
 */

const MC_FALLBACK_ROOMS = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B', '5B', '6B'];
const MC_LOCALSTORAGE_KEY = 'phongtro_meter_changes';
const MC_FIRST_SYSTEM_MONTH = '2026-07';

/**
 * Kho lưu trữ lịch sử thay đồng hồ trong bộ nhớ (đồng bộ với meter-changes.json)
 * @type {{ version: number, months: Record<string, Record<string, any>> }}
 */
window.meterChangesStore = window.meterChangesStore || { version: 1, months: {} };

let mcRoomsSnapshot = [];
let mcSelectedRoom = null;
let mcCurrentStep = 1;
let mcIsTransitioning = false;
let mcTransitionTimer = null;
let mcSuppressBlurUntil = 0;

/** Trạng thái tháng mục tiêu & chế độ khóa / chỉnh sửa ở Bước 2 */
let mcActiveMonthKey = null;
let mcIsRecordLocked = false;
let mcIsRecordEditing = false;
let mcRecordBackupState = null;
let mcStagedDeletes = { elec: false, water: false };

function cloneMcJson(obj) {
  return (obj === undefined || obj === null) ? obj : JSON.parse(JSON.stringify(obj));
}

function suppressMcBlurBriefly(ms = 350) {
  mcSuppressBlurUntil = Date.now() + ms;
}

function isMcBlurSuppressed() {
  return Date.now() < mcSuppressBlurUntil;
}

/** Context cho 3 popup con xếp tầng */
let mcMissingPrevCtx = null;
let mcRolloverCtx = null;
let mcDigitsCtx = null;
let mcMissingPrevAutoPrompted = { elec: false, water: false };

/**
 * Trạng thái nhập liệu tạm thời trong Modal (tách riêng Điện & Nước)
 * @type {{ elec: any, water: any }}
 */
let mcState = {
  elec: null,
  water: null
};

/**
 * Lấy monthKey đang thao tác trong Modal (ưu tiên tháng được chọn từ Mục 3, mặc định theo bảng chính)
 */
function getMcTargetMonthKey() {
  if (mcActiveMonthKey) {
    return mcActiveMonthKey;
  }
  if (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth) {
    return currentLoadedMonth;
  }
  const sel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'));
  return (sel && sel.value) ? sel.value : MC_FIRST_SYSTEM_MONTH;
}

/**
 * Kiểm tra tháng `monthKey` có đang bị khóa ở cấp độ Tháng (Lưu & Xuất ngoài Phần 1) hay không
 * @param {string} monthKey
 */
function isMcMonthLocked(monthKey) {
  const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || '');
  if (monthKey && loadedMonth && monthKey !== loadedMonth) {
    const entry = (typeof monthLocksState !== 'undefined' && monthLocksState && monthLocksState.months)
      ? monthLocksState.months[monthKey]
      : null;
    return Boolean(entry && entry.isLocked);
  }
  const locked = (typeof isCurrentMonthLocked !== 'undefined') && Boolean(isCurrentMonthLocked);
  const editing = (typeof isCurrentMonthEditing !== 'undefined') && Boolean(isCurrentMonthEditing);
  return locked && !editing;
}

/**
 * Tính monthKey tháng liền trước (VD: 2026-08 -> 2026-07)
 * @param {string} monthKey
 */
function getMcPrevMonthKey(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return '';
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function formatMcMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [y, m] = monthKey.split('-');
  return `Tháng ${m}/${y}`;
}

/**
 * Kiểm tra Bước 2 có đang ở chế độ chỉ xem (tháng khóa HOẶC bản ghi phòng đang khóa chưa bấm Chỉnh Sửa)
 */
function isMcReadonlyMode() {
  if (isMcMonthLocked(getMcTargetMonthKey())) return true;
  return Boolean(mcIsRecordLocked && !mcIsRecordEditing);
}

/**
 * Lấy số chữ số mặt đồng hồ của 1 phòng từ Cài Đặt Chung (3 - 7 số)
 * @param {string} phong
 * @param {'elec' | 'water'} type
 * @returns {number}
 */
function getMcRoomMeterDigits(phong, type) {
  const defaultVal = type === 'elec' ? 5 : 4;
  const fieldKey = type === 'elec' ? 'dien' : 'nuoc';
  if (typeof appSettings !== 'undefined' && appSettings && appSettings.meterDigits && appSettings.meterDigits[phong]) {
    const raw = Number(appSettings.meterDigits[phong][fieldKey]);
    if (!isNaN(raw) && raw >= 3 && raw <= 7) {
      return Math.floor(raw);
    }
  }
  return defaultVal;
}

/**
 * Tính mốc quay vòng tối đa từ số chữ số (10^digits)
 * @param {number} digits
 */
function getMcMeterMaxLimit(digits) {
  const d = Math.max(3, Math.min(7, Math.floor(Number(digits) || 5)));
  if (typeof getMeterLimitByDigits === 'function') {
    return getMeterLimitByDigits(d, Math.pow(10, d));
  }
  return Math.pow(10, d);
}

/**
 * Đọc toàn bộ kho meter-changes.json vào bộ nhớ
 */
async function loadMeterChangesStore() {
  if (window.api && typeof window.api.loadMeterChanges === 'function') {
    try {
      const res = await window.api.loadMeterChanges();
      if (res && res.data && typeof res.data === 'object') {
        window.meterChangesStore = {
          version: 1,
          months: (res.data.months && typeof res.data.months === 'object') ? res.data.months : {}
        };
        return window.meterChangesStore;
      }
    } catch (err) {
      console.warn('Lỗi khi đọc meter-changes qua IPC:', err);
    }
  }

  try {
    const raw = localStorage.getItem(MC_LOCALSTORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        window.meterChangesStore = {
          version: 1,
          months: (parsed.months && typeof parsed.months === 'object') ? parsed.months : {}
        };
        return window.meterChangesStore;
      }
    }
  } catch (e) { }

  window.meterChangesStore = { version: 1, months: {} };
  return window.meterChangesStore;
}

/**
 * Lấy bản ghi thay đồng hồ của 1 phòng trong tháng
 * @param {string} monthKey
 * @param {string} phong
 */
function getRoomMeterChangeRecord(monthKey, phong) {
  if (!monthKey || !phong || !window.meterChangesStore || !window.meterChangesStore.months) {
    return null;
  }
  const monthEntry = window.meterChangesStore.months[monthKey];
  if (!monthEntry || typeof monthEntry !== 'object') return null;
  return monthEntry[phong] || null;
}

/**
 * Liệt kê tất cả phòng/loại đồng hồ chưa lên trạng thái "completed" (Đã đủ) trong 1 tháng
 * @param {string} monthKey
 * @returns {Array<{ phong: string, type: 'elec' | 'water', typeLabel: string, status: string, statusLabel: string }>}
 */
function getUnfinishedMeterChangesForMonth(monthKey) {
  const result = [];
  if (!monthKey || !window.meterChangesStore || !window.meterChangesStore.months) return result;
  const monthEntry = window.meterChangesStore.months[monthKey];
  if (!monthEntry || typeof monthEntry !== 'object') return result;

  MC_FALLBACK_ROOMS.forEach(phong => {
    const rec = monthEntry[phong];
    if (!rec || typeof rec !== 'object') return;
    if (rec.elec && rec.elec.status !== 'completed') {
      result.push({
        phong,
        type: 'elec',
        typeLabel: 'Điện',
        status: rec.elec.status,
        statusLabel: rec.elec.status === 'need_box4' ? 'Hãy nhập ô 4' : 'Đang theo dõi'
      });
    }
    if (rec.water && rec.water.status !== 'completed') {
      result.push({
        phong,
        type: 'water',
        typeLabel: 'Nước',
        status: rec.water.status,
        statusLabel: rec.water.status === 'need_box4' ? 'Hãy nhập ô 4' : 'Đang theo dõi'
      });
    }
  });
  return result;
}

/**
 * Lưu 1 phòng vào meter-changes.json (hoặc xóa nếu cả elec & water đều null)
 * @param {string} monthKey
 * @param {string} phong
 * @param {any} roomData
 */
async function persistRoomMeterChange(monthKey, phong, roomData) {
  if (!window.meterChangesStore) window.meterChangesStore = { version: 1, months: {} };
  if (!window.meterChangesStore.months) window.meterChangesStore.months = {};
  if (!window.meterChangesStore.months[monthKey]) window.meterChangesStore.months[monthKey] = {};

  const hasAny = Boolean(roomData && (roomData.elec || roomData.water));
  if (hasAny) {
    const clean = {};
    if (roomData.elec) clean.elec = roomData.elec;
    if (roomData.water) clean.water = roomData.water;
    window.meterChangesStore.months[monthKey][phong] = clean;
  } else {
    delete window.meterChangesStore.months[monthKey][phong];
    if (Object.keys(window.meterChangesStore.months[monthKey]).length === 0) {
      delete window.meterChangesStore.months[monthKey];
    }
  }

  if (window.api && typeof window.api.saveRoomMeterChange === 'function') {
    const res = await window.api.saveRoomMeterChange({
      monthKey,
      phong,
      roomData: hasAny ? window.meterChangesStore.months[monthKey][phong] : null
    });
    if (res && res.error) {
      throw new Error(res.error);
    }
    if (res && res.data && typeof res.data === 'object') {
      window.meterChangesStore = res.data;
    }
    return true;
  }

  try {
    localStorage.setItem(MC_LOCALSTORAGE_KEY, JSON.stringify(window.meterChangesStore));
  } catch (e) { }
  return true;
}

/**
 * Lấy danh sách 12 phòng & trạng thái tháng trước từ dữ liệu bảng chính
 */
function getRoomsForMeterChangeModal() {
  const monthKey = getMcTargetMonthKey();
  const baseList = (typeof roomsData !== 'undefined' && Array.isArray(roomsData) && roomsData.length > 0)
    ? roomsData
    : MC_FALLBACK_ROOMS.map(phong => ({ phong }));

  return baseList.map(r => {
    const phong = String(r.phong || '');
    const hasPrevElec = Boolean(r.isDienCuLocked);
    const hasPrevWater = Boolean(r.isNuocCuLocked);
    const prevElec = (r.dienCu !== '' && r.dienCu !== null && r.dienCu !== undefined && !isNaN(Number(r.dienCu)))
      ? Number(r.dienCu)
      : null;
    const prevWater = (r.nuocCu !== '' && r.nuocCu !== null && r.nuocCu !== undefined && !isNaN(Number(r.nuocCu)))
      ? Number(r.nuocCu)
      : null;
    const savedRec = getRoomMeterChangeRecord(monthKey, phong);

    return {
      phong,
      hasPrevElec,
      hasPrevWater,
      prevElec,
      prevWater,
      savedElec: savedRec && savedRec.elec ? savedRec.elec : null,
      savedWater: savedRec && savedRec.water ? savedRec.water : null
    };
  });
}

function formatMcNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

function escapeMcAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Tạo state mặc định cho 1 loại đồng hồ khi vào Bước 2 (nạp từ DB nếu đã từng lưu)
 * @param {any} room
 * @param {'elec' | 'water'} type
 */
function buildInitialTypeState(room, type) {
  const saved = type === 'elec' ? room.savedElec : room.savedWater;
  const hasPrevData = type === 'elec' ? room.hasPrevElec : room.hasPrevWater;
  const currentSettingDigits = getMcRoomMeterDigits(room.phong, type);

  const prevValRaw = type === 'elec' ? room.prevElec : room.prevWater;
  const initialFromTable = prevValRaw !== null && prevValRaw !== undefined ? String(Math.max(0, Math.floor(prevValRaw))) : '';

  if (saved && Array.isArray(saved.changes) && saved.changes.length > 0) {
    const oldDigits = Number(saved.oldDigits) >= 3 && Number(saved.oldDigits) <= 7
      ? Number(saved.oldDigits)
      : currentSettingDigits;
    const newDigits = Number(saved.newDigits) >= 3 && Number(saved.newDigits) <= 7
      ? Number(saved.newDigits)
      : currentSettingDigits;

    // Nếu phòng nay đã có số chốt từ tháng trước -> luôn ưu tiên mốc đầu kỳ khóa theo tháng trước
    const firstStart = hasPrevData
      ? initialFromTable
      : (saved.initialIndex !== undefined && saved.initialIndex !== null && saved.initialIndex !== ''
        ? String(saved.initialIndex)
        : initialFromTable);

    const rows = saved.changes.map((chg, idx) => {
      const startStr = idx === 0
        ? firstStart
        : (saved.changes[idx - 1].newStart !== undefined ? String(saved.changes[idx - 1].newStart) : '0');
      const isLast = idx === saved.changes.length - 1;
      const monthEndStr = (isLast && saved.monthEndIndex !== undefined && saved.monthEndIndex !== null && saved.monthEndIndex !== '')
        ? String(saved.monthEndIndex)
        : '';

      return {
        date: chg.date || '',
        start: startStr,
        oldEnd: chg.oldEnd !== undefined && chg.oldEnd !== null ? String(chg.oldEnd) : '',
        newStart: chg.newStart !== undefined && chg.newStart !== null ? String(chg.newStart) : '0',
        monthEnd: monthEndStr,
        confirmedRollover: Boolean(chg.confirmedRollover),
        digitsAsked: chg.digitsAsked !== undefined ? Boolean(chg.digitsAsked) : true
      };
    });

    return {
      existsSaved: true,
      hasPrevData,
      manualInitUnlocked: !hasPrevData && Boolean(saved.isInitialManual || firstStart !== ''),
      oldDigits,
      newDigits,
      confirmedMonthEndRollover: Boolean(saved.confirmedMonthEndRollover),
      rows
    };
  }

  return {
    existsSaved: false,
    hasPrevData,
    manualInitUnlocked: false,
    oldDigits: currentSettingDigits,
    newDigits: currentSettingDigits,
    confirmedMonthEndRollover: false,
    rows: [
      {
        date: '',
        start: initialFromTable,
        oldEnd: '',
        newStart: '0',
        monthEnd: '',
        confirmedRollover: false,
        digitsAsked: false
      }
    ]
  };
}

/**
 * Mở Modal Ghi nhận thay đổi đồng hồ
 * @param {string} [preselectPhong]
 * @param {'elec' | 'water'} [preselectType]
 */
function openMeterChangeModal(preselectPhong, preselectType) {
  const modal = document.getElementById('meter-change-modal');
  if (!modal) return;

  mcActiveMonthKey = null;
  mcIsRecordLocked = false;
  mcIsRecordEditing = false;
  mcRecordBackupState = null;
  mcStagedDeletes = { elec: false, water: false };
  mcRoomsSnapshot = getRoomsForMeterChangeModal();
  mcSelectedRoom = null;
  mcCurrentStep = 1;
  mcIsTransitioning = false;
  mcSuppressBlurUntil = 0;
  mcMissingPrevAutoPrompted = { elec: false, water: false };

  if (mcTransitionTimer) {
    clearTimeout(mcTransitionTimer);
    mcTransitionTimer = null;
  }

  const targetMonth = getMcTargetMonthKey();
  const monthLabelEl = document.getElementById('mc-current-month-label');
  if (monthLabelEl) {
    monthLabelEl.textContent = formatMcMonthLabel(targetMonth) || 'Tháng hiện tại';
  }

  const p1 = document.getElementById('mc-page1');
  const p2 = document.getElementById('mc-page2');
  const stepBadge = document.getElementById('mc-step-badge');
  if (p1 && p2) {
    p1.classList.remove('page-in', 'page-out');
    p2.classList.remove('active', 'page-in', 'page-out');
    p1.classList.add('active');
  }
  if (stepBadge) {
    stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';
  }

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const lblElec = document.getElementById('mc-lbl-elec');
  const lblWater = document.getElementById('mc-lbl-water');

  let defaultElec = true;
  let defaultWater = false;

  if (preselectPhong) {
    const matched = mcRoomsSnapshot.find(r => r.phong === preselectPhong);
    if (matched) {
      mcSelectedRoom = matched;
      if (matched.savedElec || matched.savedWater) {
        defaultElec = Boolean(matched.savedElec) || preselectType === 'elec';
        defaultWater = Boolean(matched.savedWater) || preselectType === 'water';
      } else if (preselectType === 'water') {
        defaultElec = false;
        defaultWater = true;
      }
    }
  }

  const mbConflict = (mcSelectedRoom && typeof getRoomMeterBreakRecord === 'function')
    ? getRoomMeterBreakRecord(targetMonth, mcSelectedRoom.phong)
    : null;
  if (mbConflict && mbConflict.elec && !mcSelectedRoom?.savedElec) {
    defaultElec = false;
    if (!mbConflict.water && preselectType !== 'elec') defaultWater = true;
  }
  if (mbConflict && mbConflict.water && !mcSelectedRoom?.savedWater) {
    defaultWater = false;
  }

  if (chkElec) {
    chkElec.disabled = Boolean(mbConflict && mbConflict.elec);
    chkElec.checked = chkElec.disabled ? false : defaultElec;
  }
  if (chkWater) {
    chkWater.disabled = Boolean(mbConflict && mbConflict.water);
    chkWater.checked = chkWater.disabled ? false : defaultWater;
  }
  if (lblElec && chkElec) lblElec.classList.toggle('checked', chkElec.checked);
  if (lblWater && chkWater) lblWater.classList.toggle('checked', chkWater.checked);

  renderMeterChangeRoomGrid();
  renderMeterChangeHistoryList();
  validateMeterChangeStep1();

  modal.style.display = 'flex';

  // Nếu mở trực tiếp từ badge của 1 phòng -> nhảy thẳng vào Bước 2 ngay không cần chờ
  if (mcSelectedRoom && preselectPhong) {
    mcCurrentStep = 2;
    if (p1 && p2) {
      p1.classList.remove('active');
      p2.classList.add('active');
    }
    if (stepBadge) stepBadge.textContent = 'Bước 2/2: Nhập chỉ số thay đổi';
    initMeterChangeStep2State();
    prepareMcStep2LockMode();
    renderMeterChangeStep2Form();
    maybePromptMissingPrevOnEnter();
  }
}

/**
 * Dựng backup tạm thời của Bước 2 để hỗ trợ hoàn tác khi bấm Hủy thay đổi & Giữ nguyên hoặc đóng/quay lại chưa lưu
 */
function createMcStep2Backup() {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const hasMeterDigits = typeof appSettings !== 'undefined' && appSettings && appSettings.meterDigits;
  mcRecordBackupState = {
    monthKey: getMcTargetMonthKey(),
    phong: mcSelectedRoom ? mcSelectedRoom.phong : '',
    selectedRoom: cloneMcJson(mcSelectedRoom),
    mcState: cloneMcJson(mcState),
    chkElec: Boolean(chkElec && chkElec.checked),
    chkWater: Boolean(chkWater && chkWater.checked),
    stagedDeletes: cloneMcJson(mcStagedDeletes),
    meterDigits: hasMeterDigits ? cloneMcJson(appSettings.meterDigits) : null
  };
}

/**
 * Khôi phục bản sao lưu trước khi Chỉnh Sửa và quay về chế độ Đã khóa ngay tại Bước 2
 * @param {boolean} [silent]
 */
function restoreMcStep2FromBackup(silent = false) {
  if (!mcRecordBackupState) return;
  const bak = mcRecordBackupState;
  mcSelectedRoom = cloneMcJson(bak.selectedRoom);
  mcState = cloneMcJson(bak.mcState);
  mcStagedDeletes = cloneMcJson(bak.stagedDeletes || { elec: false, water: false });

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const lblElec = document.getElementById('mc-lbl-elec');
  const lblWater = document.getElementById('mc-lbl-water');
  if (chkElec) chkElec.checked = Boolean(bak.chkElec);
  if (chkWater) chkWater.checked = Boolean(bak.chkWater);
  if (lblElec) lblElec.classList.toggle('checked', Boolean(bak.chkElec));
  if (lblWater) lblWater.classList.toggle('checked', Boolean(bak.chkWater));

  if (bak.meterDigits && typeof appSettings !== 'undefined' && appSettings) {
    const changed = JSON.stringify(appSettings.meterDigits) !== JSON.stringify(bak.meterDigits);
    if (changed) {
      appSettings.meterDigits = cloneMcJson(bak.meterDigits);
      if (typeof saveSettingsFile === 'function') {
        saveSettingsFile(true);
      }
      if (typeof renderMeterDigitsSettingsList === 'function') {
        renderMeterDigitsSettingsList();
      }
    }
  }

  mcIsRecordLocked = Boolean(mcSelectedRoom && (mcSelectedRoom.savedElec || mcSelectedRoom.savedWater));
  mcIsRecordEditing = false;
  mcRecordBackupState = null;

  if (!silent) {
    renderMeterChangeStep2Form();
  }
}

/**
 * Xác định trạng thái khóa Bước 2 khi vừa bước vào (phòng đã có bản lưu -> khóa; nếu tích thêm loại ĐH chưa lưu -> mở edit kèm backup)
 */
function prepareMcStep2LockMode() {
  mcStagedDeletes = { elec: false, water: false };
  if (!mcSelectedRoom) {
    mcIsRecordLocked = false;
    mcIsRecordEditing = false;
    mcRecordBackupState = null;
    return;
  }

  const hasSavedAny = Boolean(mcSelectedRoom.savedElec || mcSelectedRoom.savedWater);
  if (!hasSavedAny) {
    mcIsRecordLocked = false;
    mcIsRecordEditing = false;
    mcRecordBackupState = null;
    return;
  }

  const monthLocked = isMcMonthLocked(getMcTargetMonthKey());
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const wantElec = Boolean(chkElec && chkElec.checked);
  const wantWater = Boolean(chkWater && chkWater.checked);
  const addedNewUnsavedType = !monthLocked && ((wantElec && !mcSelectedRoom.savedElec) || (wantWater && !mcSelectedRoom.savedWater));

  if (addedNewUnsavedType) {
    const hasMeterDigits = typeof appSettings !== 'undefined' && appSettings && appSettings.meterDigits;
    mcRecordBackupState = {
      monthKey: getMcTargetMonthKey(),
      phong: mcSelectedRoom.phong,
      selectedRoom: cloneMcJson(mcSelectedRoom),
      mcState: {
        elec: buildInitialTypeState(mcSelectedRoom, 'elec'),
        water: buildInitialTypeState(mcSelectedRoom, 'water')
      },
      chkElec: Boolean(mcSelectedRoom.savedElec),
      chkWater: Boolean(mcSelectedRoom.savedWater),
      stagedDeletes: { elec: false, water: false },
      meterDigits: hasMeterDigits ? cloneMcJson(appSettings.meterDigits) : null
    };
    mcIsRecordLocked = true;
    mcIsRecordEditing = true;
  } else {
    mcIsRecordLocked = true;
    mcIsRecordEditing = false;
    mcRecordBackupState = null;
  }
}

/**
 * Đóng Modal Thay đổi đồng hồ và các popup con (tự động hủy bản sửa chưa lưu nếu có)
 */
function closeMeterChangeModal() {
  if (mcIsRecordEditing && mcRecordBackupState) {
    restoreMcStep2FromBackup(true);
  }
  closeMcUnlockEditModal();
  closeMcMissingPrevModal();
  closeMcRolloverModalUI();
  closeMcDigitsModalUI();

  const modal = document.getElementById('meter-change-modal');
  if (!modal) return;
  if (mcTransitionTimer) {
    clearTimeout(mcTransitionTimer);
    mcTransitionTimer = null;
  }
  mcIsTransitioning = false;
  mcActiveMonthKey = null;
  mcIsRecordLocked = false;
  mcIsRecordEditing = false;
  mcRecordBackupState = null;
  mcStagedDeletes = { elec: false, water: false };
  modal.style.display = 'none';
}

/**
 * Quay lại Trang 1 từ Trang 2 (nếu đang mở sửa chưa lưu thì tự động khôi phục bản cũ)
 */
function handleMcStep2Back() {
  if (mcIsTransitioning) return;
  if (mcIsRecordEditing && mcRecordBackupState) {
    restoreMcStep2FromBackup(true);
    if (typeof showToast === 'function') {
      showToast('Đã hủy thay đổi chưa lưu và giữ nguyên dữ liệu cũ.', 'info');
    }
  }
  closeMcUnlockEditModal();

  const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || MC_FIRST_SYSTEM_MONTH);
  const wasOtherMonth = Boolean(mcActiveMonthKey && mcActiveMonthKey !== loadedMonth);
  const prevSelectedPhong = (!wasOtherMonth && mcSelectedRoom) ? mcSelectedRoom.phong : '';

  mcActiveMonthKey = null;
  mcIsRecordLocked = false;
  mcIsRecordEditing = false;
  mcRecordBackupState = null;
  mcStagedDeletes = { elec: false, water: false };
  mcRoomsSnapshot = getRoomsForMeterChangeModal();
  mcSelectedRoom = prevSelectedPhong
    ? (mcRoomsSnapshot.find(r => r.phong === prevSelectedPhong) || null)
    : null;

  renderMeterChangeRoomGrid();
  renderMeterChangeHistoryList();
  validateMeterChangeStep1();
  goToMeterChangeStep(1, -1);
}

/**
 * Bấm nút Chỉnh Sửa / Hủy thay đổi & Giữ nguyên ở Bước 2
 */
function handleToggleEditMcRecordClick() {
  if (!mcSelectedRoom || isMcMonthLocked(getMcTargetMonthKey())) return;
  if (!mcIsRecordEditing) {
    openMcUnlockEditModal();
    return;
  }
  restoreMcStep2FromBackup(false);
  if (typeof showToast === 'function') {
    showToast('Đã hủy thay đổi và khôi phục dữ liệu đã khóa.', 'info');
  }
}

function openMcUnlockEditModal() {
  if (!mcSelectedRoom) return;
  const subEl = document.getElementById('mc-unlock-edit-subtitle');
  if (subEl) {
    subEl.textContent = `Phòng ${mcSelectedRoom.phong} • ${formatMcMonthLabel(getMcTargetMonthKey())}`;
  }
  const modal = document.getElementById('mc-unlock-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMcUnlockEditModal() {
  const modal = document.getElementById('mc-unlock-edit-modal');
  if (modal) modal.style.display = 'none';
}

function confirmUnlockMcRecordForEditing() {
  closeMcUnlockEditModal();
  if (!mcSelectedRoom || isMcMonthLocked(getMcTargetMonthKey())) return;
  createMcStep2Backup();
  mcIsRecordLocked = true;
  mcIsRecordEditing = true;
  renderMeterChangeStep2Form();
}

/**
 * Dựng danh sách dòng (*) ngắn gọn cho 1 phòng trong Mục 3 (Mới nhất -> Cũ nhất)
 * @param {any} rec
 * @returns {string[]}
 */
function buildHistoryCardLinesForRoom(rec) {
  if (!rec || typeof rec !== 'object') return [];
  /** @type {string[]} */
  const lines = [];

  /**
   * @param {any} typeRec
   * @param {'elec' | 'water'} type
   */
  const appendTypeLines = (typeRec, type) => {
    if (!typeRec || typeof typeRec !== 'object') return;
    if (typeof buildMeterChangeDetailForType === 'function') {
      const detail = buildMeterChangeDetailForType(typeRec, type);
      if (detail && detail.completed && Array.isArray(detail.receiptLines) && detail.receiptLines.length > 0) {
        detail.receiptLines.forEach(line => lines.push(line));
        return;
      }
    }

    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    const changes = Array.isArray(typeRec.changes) ? typeRec.changes : [];
    const statusLabel = typeRec.status === 'need_box4' ? 'Hãy nhập ô 4' : 'Đang theo dõi';

    if (changes.length === 0) {
      lines.push(`(*) Thay ĐH ${typeLabel}: ${statusLabel}`);
      return;
    }

    changes.forEach((chg, idx) => {
      const dateVN = (typeof formatMcDateVN === 'function' && chg.date) ? formatMcDateVN(chg.date) : (chg.date || '');
      const datePart = dateVN ? ` (${dateVN})` : '';
      const startVal = idx === 0
        ? (typeRec.initialIndex !== null && typeRec.initialIndex !== undefined ? formatMcNumber(Number(typeRec.initialIndex)) : '?')
        : formatMcNumber(Number(changes[idx - 1]?.newStart ?? 0));
      const oldEndStr = (chg.oldEnd !== null && chg.oldEnd !== undefined) ? formatMcNumber(Number(chg.oldEnd)) : '?';
      const newStartStr = (chg.newStart !== null && chg.newStart !== undefined) ? formatMcNumber(Number(chg.newStart)) : '0';
      const multiPrefix = changes.length > 1 ? ` lần ${idx + 1}` : '';

      if (idx < changes.length - 1) {
        lines.push(`(*) Thay ĐH ${typeLabel}${multiPrefix}${datePart}: ĐH cũ ${startVal}→${oldEndStr}`);
      } else {
        lines.push(`(*) Thay ĐH ${typeLabel}${multiPrefix}${datePart}: ĐH cũ ${startVal}→${oldEndStr} + ĐH mới ${newStartStr}→... (${statusLabel})`);
      }
    });
  };

  appendTypeLines(rec.elec, 'elec');
  appendTypeLines(rec.water, 'water');
  return lines;
}

/**
 * Trả về nhãn trạng thái tổng hợp của 1 phòng
 * @param {any} rec
 */
function getMcRoomCombinedStatusInfo(rec) {
  const statuses = [rec?.elec?.status, rec?.water?.status].filter(Boolean);
  if (statuses.includes('tracking')) {
    return { cls: 'tracking', text: '⏳ Đang theo dõi' };
  }
  if (statuses.includes('need_box4')) {
    return { cls: 'need-box4', text: '📝 Hãy nhập ô 4' };
  }
  return { cls: 'completed', text: '✅ Đã đủ' };
}

/**
 * Render Mục 3: Danh sách các tháng đã thay đồng hồ (Mới nhất -> Cũ nhất), dùng chung thanh cuộn Trang 1
 */
function renderMeterChangeHistoryList() {
  const container = document.getElementById('mc-history-list');
  if (!container) return;

  const storeMonths = (window.meterChangesStore && window.meterChangesStore.months) || {};
  const monthKeys = Object.keys(storeMonths)
    .filter(mk => {
      const mEntry = storeMonths[mk];
      if (!mEntry || typeof mEntry !== 'object') return false;
      return Object.keys(mEntry).some(p => mEntry[p] && (mEntry[p].elec || mEntry[p].water));
    })
    .sort((a, b) => b.localeCompare(a));

  if (monthKeys.length === 0) {
    container.innerHTML = '<div class="mc-history-empty">Chưa có tháng nào ghi nhận thay đổi đồng hồ Điện / Nước.</div>';
    return;
  }

  container.innerHTML = '';
  monthKeys.forEach(mk => {
    const mEntry = storeMonths[mk];
    const roomNames = [
      ...MC_FALLBACK_ROOMS.filter(p => mEntry[p] && (mEntry[p].elec || mEntry[p].water)),
      ...Object.keys(mEntry).filter(p => !MC_FALLBACK_ROOMS.includes(p) && mEntry[p] && (mEntry[p].elec || mEntry[p].water))
    ];
    if (roomNames.length === 0) return;

    const monthLocked = isMcMonthLocked(mk);
    const groupEl = document.createElement('div');
    groupEl.className = 'mc-history-month-group';
    groupEl.setAttribute('data-month-key', mk);

    const headerEl = document.createElement('div');
    headerEl.className = 'mc-history-month-header';
    headerEl.innerHTML = `
      <span class="mc-history-month-tag">📅 ${escapeMcAttr(formatMcMonthLabel(mk))}</span>
      <span class="mc-history-lock-chip ${monthLocked ? '' : 'editable'}">${monthLocked ? '🔒 Đã xuất (Chỉ xem)' : '🟢 Chưa khóa / Đang sửa'}</span>
    `;
    groupEl.appendChild(headerEl);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'mc-history-month-cards';

    roomNames.forEach(phong => {
      const rec = mEntry[phong];
      const statusInfo = getMcRoomCombinedStatusInfo(rec);
      const noteLines = buildHistoryCardLinesForRoom(rec);

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'mc-history-card';
      cardBtn.setAttribute('data-month-key', mk);
      cardBtn.setAttribute('data-phong', phong);
      cardBtn.onclick = () => openMeterChangeHistoryCard(mk, phong);

      const linesHtml = noteLines
        .map(line => `<div class="mc-history-line">${escapeMcAttr(line)}</div>`)
        .join('');

      cardBtn.innerHTML = `
        <div class="mc-history-card-head">
          <div class="mc-history-room-left">
            <span class="mc-history-room-name">🏠 Phòng ${escapeMcAttr(phong)}</span>
            <span class="mc-history-status-pill ${statusInfo.cls}">${statusInfo.text}</span>
          </div>
          <span class="mc-history-open-cue">Xem chi tiết ➔</span>
        </div>
        <div class="mc-history-lines">${linesHtml}</div>
      `;
      cardsWrap.appendChild(cardBtn);
    });

    groupEl.appendChild(cardsWrap);
    container.appendChild(groupEl);
  });
}

/**
 * Dựng snapshot cho 1 phòng thuộc 1 tháng bất kỳ (hỗ trợ mở thẻ lịch sử của tháng khác)
 * @param {string} monthKey
 * @param {string} phong
 */
async function buildRoomSnapshotForMonth(monthKey, phong) {
  const curMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || MC_FIRST_SYSTEM_MONTH);

  if (monthKey === curMonth) {
    mcRoomsSnapshot = getRoomsForMeterChangeModal();
    return mcRoomsSnapshot.find(r => r.phong === phong) || null;
  }

  const savedRec = getRoomMeterChangeRecord(monthKey, phong);
  const prevMonth = getMcPrevMonthKey(monthKey);
  let currRoom = null;
  let prevRoom = null;

  if (typeof readHistoryFile === 'function' && typeof extractHistoryPayload === 'function') {
    try {
      const [rawCurr, rawPrev] = await Promise.all([
        readHistoryFile(monthKey),
        prevMonth ? readHistoryFile(prevMonth) : Promise.resolve(null)
      ]);
      const currPayload = extractHistoryPayload(rawCurr);
      const prevPayload = extractHistoryPayload(rawPrev);
      currRoom = (currPayload.rooms || []).find(r => r.phong === phong) || null;
      prevRoom = (prevPayload.rooms || []).find(r => r.phong === phong) || null;
    } catch (err) {
      console.warn('Không thể đọc dữ liệu tháng lịch sử khi mở thẻ:', err);
    }
  }

  const hasPrevElec = Boolean(prevRoom && prevRoom.dienMoi !== '' && prevRoom.dienMoi !== null && prevRoom.dienMoi !== undefined);
  const hasPrevWater = Boolean(prevRoom && prevRoom.nuocMoi !== '' && prevRoom.nuocMoi !== null && prevRoom.nuocMoi !== undefined);

  const prevElec = hasPrevElec
    ? Number(prevRoom.dienMoi)
    : (currRoom && currRoom.dienCu !== '' && currRoom.dienCu !== null && currRoom.dienCu !== undefined && !isNaN(Number(currRoom.dienCu))
      ? Number(currRoom.dienCu)
      : (savedRec?.elec?.initialIndex ?? null));

  const prevWater = hasPrevWater
    ? Number(prevRoom.nuocMoi)
    : (currRoom && currRoom.nuocCu !== '' && currRoom.nuocCu !== null && currRoom.nuocCu !== undefined && !isNaN(Number(currRoom.nuocCu))
      ? Number(currRoom.nuocCu)
      : (savedRec?.water?.initialIndex ?? null));

  return {
    phong,
    hasPrevElec,
    hasPrevWater,
    prevElec: prevElec !== null && !isNaN(Number(prevElec)) ? Number(prevElec) : null,
    prevWater: prevWater !== null && !isNaN(Number(prevWater)) ? Number(prevWater) : null,
    savedElec: savedRec && savedRec.elec ? savedRec.elec : null,
    savedWater: savedRec && savedRec.water ? savedRec.water : null
  };
}

/**
 * Mở chi tiết 1 phòng từ Mục 3 trực tiếp sang Bước 2 trên cùng Modal
 * @param {string} monthKey
 * @param {string} phong
 */
async function openMeterChangeHistoryCard(monthKey, phong) {
  if (mcIsTransitioning) return;
  const targetRoom = await buildRoomSnapshotForMonth(monthKey, phong);
  if (!targetRoom) return;

  mcActiveMonthKey = monthKey;
  mcSelectedRoom = targetRoom;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const lblElec = document.getElementById('mc-lbl-elec');
  const lblWater = document.getElementById('mc-lbl-water');
  if (chkElec) chkElec.checked = Boolean(targetRoom.savedElec);
  if (chkWater) chkWater.checked = Boolean(targetRoom.savedWater);
  if (lblElec && chkElec) lblElec.classList.toggle('checked', chkElec.checked);
  if (lblWater && chkWater) lblWater.classList.toggle('checked', chkWater.checked);

  if (mcCurrentStep === 2) {
    mcMissingPrevAutoPrompted = { elec: false, water: false };
    initMeterChangeStep2State();
    prepareMcStep2LockMode();
    renderMeterChangeStep2Form();
    return;
  }

  goToMeterChangeStep(2, 1);
}

/**
 * Chọn card phòng ở Bước 1 và tự đồng bộ checkbox theo dữ liệu đã lưu (nếu có)
 */
function selectMcRoomCard(room, roomGrid, card) {
  roomGrid.querySelectorAll('.mc-room-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  card.classList.add('selected');
  card.setAttribute('aria-checked', 'true');
  mcSelectedRoom = room;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const lblElec = document.getElementById('mc-lbl-elec');
  const lblWater = document.getElementById('mc-lbl-water');
  const mbRec = (typeof getRoomMeterBreakRecord === 'function')
    ? getRoomMeterBreakRecord(getMcTargetMonthKey(), room.phong)
    : null;
  const breakElec = Boolean(mbRec && mbRec.elec);
  const breakWater = Boolean(mbRec && mbRec.water);

  if (chkElec) chkElec.disabled = breakElec;
  if (chkWater) chkWater.disabled = breakWater;

  if (room.savedElec || room.savedWater) {
    if (chkElec) chkElec.checked = Boolean(room.savedElec) && !breakElec;
    if (chkWater) chkWater.checked = Boolean(room.savedWater) && !breakWater;
  } else {
    if (chkElec) chkElec.checked = !breakElec;
    if (chkWater) chkWater.checked = breakElec && !breakWater;
  }
  if (lblElec && chkElec) lblElec.classList.toggle('checked', chkElec.checked);
  if (lblWater && chkWater) lblWater.classList.toggle('checked', chkWater.checked);

  if (breakElec || breakWater) {
    const names = [];
    if (breakElec) names.push('Điện');
    if (breakWater) names.push('Nước');
    if (typeof showToast === 'function') {
      showToast(`Phòng ${room.phong} đang dùng Break chỉ số (${names.join(' & ')}) trong tháng này — hãy Hủy Break trước nếu muốn Thay đổi đồng hồ.`, 'info');
    }
  }

  validateMeterChangeStep1();
}

/**
 * Render lưới 12 phòng tại Bước 1
 */
function renderMeterChangeRoomGrid() {
  const roomGrid = document.getElementById('mc-room-grid');
  if (!roomGrid) return;

  roomGrid.innerHTML = '';
  mcRoomsSnapshot.forEach(room => {
    const card = document.createElement('div');
    const isSelected = Boolean(mcSelectedRoom && mcSelectedRoom.phong === room.phong);
    card.className = `mc-room-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    card.tabIndex = 0;

    let statusClass = '';
    let statusText = '';

    if (room.hasPrevElec && room.hasPrevWater) {
      statusText = `Đ: ${formatMcNumber(room.prevElec)} | N: ${formatMcNumber(room.prevWater)}`;
    } else if (!room.hasPrevElec && !room.hasPrevWater) {
      statusClass = 'new';
      statusText = 'Chưa có dữ liệu cũ';
    } else {
      statusClass = 'partial';
      const eText = room.hasPrevElec ? `Đ: ${formatMcNumber(room.prevElec)}` : 'Đ: chưa cũ';
      const wText = room.hasPrevWater ? `N: ${formatMcNumber(room.prevWater)}` : 'N: chưa cũ';
      statusText = `${eText} | ${wText}`;
    }

    let savedPillHtml = '';
    if (room.savedElec || room.savedWater) {
      const statuses = [room.savedElec?.status, room.savedWater?.status].filter(Boolean);
      let worstStatus = 'completed';
      let pillTxt = '✅ Đã đủ';
      if (statuses.includes('tracking')) {
        worstStatus = 'tracking';
        pillTxt = '⏳ Đang theo dõi';
      } else if (statuses.includes('need_box4')) {
        worstStatus = 'need-box4';
        pillTxt = '📝 Hãy nhập ô 4';
      }
      savedPillHtml = `<div class="mc-r-mc-pill ${worstStatus}">${pillTxt}</div>`;
    }

    card.innerHTML = `
      <div class="mc-r-name">Phòng ${escapeMcAttr(room.phong)}</div>
      <div class="mc-r-status ${statusClass}">${statusText}</div>
      ${savedPillHtml}
    `;

    card.onclick = () => selectMcRoomCard(room, roomGrid, card);
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMcRoomCard(room, roomGrid, card);
      }
    };

    roomGrid.appendChild(card);
  });
}

function toggleMeterChangeType(labelId, checkbox) {
  if (checkbox && checkbox.disabled) {
    checkbox.checked = false;
    if (typeof showToast === 'function') {
      showToast('Loại đồng hồ này đang dùng Break chỉ số trong tháng. Hãy Hủy Break trước nếu muốn Thay đồng hồ.', 'warning');
    }
    return;
  }
  const lbl = document.getElementById(labelId);
  if (lbl) lbl.classList.toggle('checked', Boolean(checkbox && checkbox.checked));
  validateMeterChangeStep1();
}

function validateMeterChangeStep1() {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const btnNext = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-next'));
  const hasType = Boolean((chkElec && chkElec.checked && !chkElec.disabled) || (chkWater && chkWater.checked && !chkWater.disabled));
  if (btnNext) {
    btnNext.disabled = !(mcSelectedRoom && hasType);
  }
}

function initMeterChangeStep2State() {
  if (!mcSelectedRoom) return;
  mcState = {
    elec: buildInitialTypeState(mcSelectedRoom, 'elec'),
    water: buildInitialTypeState(mcSelectedRoom, 'water')
  };
}

/**
 * Hiệu ứng chuyển tiếp push-in / push-out (--dir)
 * @param {1 | 2} step
 * @param {1 | -1} dir
 */
function goToMeterChangeStep(step, dir) {
  if (mcIsTransitioning || step === mcCurrentStep) return;

  const p1 = document.getElementById('mc-page1');
  const p2 = document.getElementById('mc-page2');
  const viewport = document.getElementById('mc-viewport');
  const stepBadge = document.getElementById('mc-step-badge');
  if (!p1 || !p2 || !viewport) return;

  mcIsTransitioning = true;
  mcCurrentStep = step;
  viewport.style.setProperty('--dir', String(dir));

  const outEl = step === 2 ? p1 : p2;
  const inEl = step === 2 ? p2 : p1;

  if (step === 2) {
    mcMissingPrevAutoPrompted = { elec: false, water: false };
    initMeterChangeStep2State();
    prepareMcStep2LockMode();
    renderMeterChangeStep2Form();
    if (stepBadge) stepBadge.textContent = 'Bước 2/2: Nhập chỉ số thay đổi';
  } else {
    renderMeterChangeHistoryList();
    if (stepBadge) stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';
  }

  outEl.classList.remove('active', 'page-in', 'page-out');
  inEl.classList.remove('active', 'page-in', 'page-out');

  void outEl.offsetWidth;
  outEl.classList.add('page-out');
  inEl.classList.add('page-in');

  mcTransitionTimer = setTimeout(() => {
    outEl.classList.remove('page-out');
    inEl.classList.remove('page-in');
    inEl.classList.add('active');
    mcIsTransitioning = false;
    mcTransitionTimer = null;

    if (step === 2) {
      maybePromptMissingPrevOnEnter();
    }
  }, 700);
}

/**
 * Nếu bước vào Bước 2 ở tháng > 2026-07 và phòng thiếu dữ liệu tháng trước -> hiện nhẹ popup lựa chọn 1 lần
 */
function maybePromptMissingPrevOnEnter() {
  if (!mcSelectedRoom || isMcReadonlyMode()) return;
  const monthKey = getMcTargetMonthKey();
  if (monthKey <= MC_FIRST_SYSTEM_MONTH) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (needElec && mcState.elec && !mcState.elec.hasPrevData && !mcState.elec.manualInitUnlocked && mcState.elec.rows[0].start === '' && !mcMissingPrevAutoPrompted.elec) {
    mcMissingPrevAutoPrompted.elec = true;
    openMcMissingPrevModal('elec');
    return;
  }
  if (needWater && mcState.water && !mcState.water.hasPrevData && !mcState.water.manualInitUnlocked && mcState.water.rows[0].start === '' && !mcMissingPrevAutoPrompted.water) {
    mcMissingPrevAutoPrompted.water = true;
    openMcMissingPrevModal('water');
  }
}

/**
 * Thêm 1 lần thay mới (chỉ cho bấm khi các lần trước đã nhập đủ tới Ô 3)
 * @param {'elec' | 'water'} type
 */
function addMeterChangeRow(type) {
  if (isMcReadonlyMode()) return;
  const sec = mcState[type];
  if (!sec || !Array.isArray(sec.rows) || sec.rows.length === 0) return;

  const evalRes = evaluateMeterChangeSection(type);
  if (!evalRes.allRowsReadyToBox3) {
    if (typeof showToast === 'function') {
      showToast('Vui lòng nhập hợp lệ Ô 2 và Ô 3 của lần hiện tại trước khi thêm lần thay mới!', 'warning');
    }
    return;
  }

  const lastRow = sec.rows[sec.rows.length - 1];
  const carriedMonthEnd = lastRow.monthEnd || '';
  lastRow.monthEnd = '';

  const prevNewStart = lastRow.newStart !== undefined && lastRow.newStart !== '' ? String(lastRow.newStart) : '0';
  sec.rows.push({
    date: '',
    start: prevNewStart,
    oldEnd: '',
    newStart: '0',
    monthEnd: carriedMonthEnd,
    confirmedRollover: false,
    digitsAsked: false
  });

  renderMeterChangeStep2Form();
}

/**
 * Xóa một lần thay đồng hồ (từ lần 2 trở đi)
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function removeMeterChangeRow(type, idx) {
  if (isMcReadonlyMode()) return;
  const sec = mcState[type];
  if (!sec || !Array.isArray(sec.rows) || idx <= 0 || idx >= sec.rows.length) return;

  const wasLast = idx === sec.rows.length - 1;
  const removedMonthEnd = sec.rows[idx].monthEnd || '';
  sec.rows.splice(idx, 1);

  if (wasLast && removedMonthEnd && sec.rows.length > 0) {
    sec.rows[sec.rows.length - 1].monthEnd = removedMonthEnd;
  }

  for (let i = 1; i < sec.rows.length; i++) {
    sec.rows[i].start = sec.rows[i - 1].newStart !== undefined ? String(sec.rows[i - 1].newStart) : '0';
  }

  renderMeterChangeStep2Form();
}

/**
 * Render toàn bộ khối nhập liệu ở cột trái Bước 2
 */
function renderMeterChangeStep2Form() {
  if (!mcSelectedRoom) return;

  const monthKey = getMcTargetMonthKey();
  const monthLocked = isMcMonthLocked(monthKey);
  const readonlyMode = isMcReadonlyMode();
  const hasSavedAny = Boolean(mcSelectedRoom.savedElec || mcSelectedRoom.savedWater);

  const lockedBanner = document.getElementById('mc-locked-banner');
  if (lockedBanner) {
    lockedBanner.style.display = monthLocked ? 'flex' : 'none';
  }

  const saveBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-save'));
  if (saveBtn) {
    saveBtn.disabled = readonlyMode;
    saveBtn.style.display = readonlyMode ? 'none' : 'inline-flex';
  }

  const toggleEditBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-toggle-edit'));
  if (toggleEditBtn) {
    if (!monthLocked && hasSavedAny) {
      toggleEditBtn.style.display = 'inline-flex';
      if (mcIsRecordEditing) {
        toggleEditBtn.className = 'btn btn-edit-month cancel-mode';
        toggleEditBtn.innerHTML = '✖️ Hủy thay đổi &amp; Giữ nguyên';
      } else {
        toggleEditBtn.className = 'btn btn-edit-month';
        toggleEditBtn.innerHTML = '✏️ Chỉnh Sửa';
      }
    } else {
      toggleEditBtn.style.display = 'none';
    }
  }

  const delAllBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-delete-all'));
  if (delAllBtn) {
    delAllBtn.style.display = (hasSavedAny && !readonlyMode) ? 'inline-flex' : 'none';
  }

  const footerNote = document.getElementById('mc-left-footer-note');
  if (footerNote) {
    footerNote.textContent = (readonlyMode && !monthLocked && hasSavedAny)
      ? "Dữ liệu đã lưu & khóa. Bấm '✏️ Chỉnh Sửa' nếu muốn thay đổi chỉ số."
      : 'Chỉ nhập số nguyên không âm (0–9) lần lượt từ Ô 2 ➔ Ô 3 ➔ Ô 4.';
  }

  const titleEl = document.getElementById('mc-selected-room-title');
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (titleEl) {
    let badgeText = '';
    let badgeCls = '';
    const checkElecMissing = needElec && !mcSelectedRoom.hasPrevElec;
    const checkWaterMissing = needWater && !mcSelectedRoom.hasPrevWater;

    if (!checkElecMissing && !checkWaterMissing) {
      badgeText = 'Đã có số tháng trước (Ô 1 tự động khóa)';
      badgeCls = 'has-data';
    } else if (checkElecMissing && checkWaterMissing) {
      badgeText = 'Chưa có dữ liệu tháng trước';
      badgeCls = 'no-data';
    } else {
      badgeText = checkElecMissing ? 'Điện chưa có số tháng trước' : 'Nước chưa có số tháng trước';
      badgeCls = 'no-data';
    }

    const lockBadgeHtml = (!monthLocked && hasSavedAny)
      ? (mcIsRecordEditing
        ? '<span class="month-lock-badge editing">✏️ Đang mở chỉnh sửa</span>'
        : '<span class="month-lock-badge locked">🔒 Đã khóa dữ liệu</span>')
      : (monthLocked ? '<span class="month-lock-badge locked">🔒 Tháng đã khóa</span>' : '');
    const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
      ? currentLoadedMonth
      : (document.getElementById('month-year-select')?.value || '');
    const monthChipHtml = (monthKey && loadedMonth && monthKey !== loadedMonth)
      ? `<span class="mc-room-month-chip">📅 ${escapeMcAttr(formatMcMonthLabel(monthKey))}</span>`
      : '';

    titleEl.innerHTML = `
      <span>🏠 Phòng ${escapeMcAttr(mcSelectedRoom.phong)}</span>
      ${monthChipHtml}
      <span class="mc-room-prev-badge ${badgeCls}">${badgeText}</span>
      ${lockBadgeHtml}
    `;
  }

  const container = document.getElementById('mc-dynamic-form-area');
  if (!container) return;

  let html = '';
  if (needElec) {
    html += buildMeterChangeSectionHtml('elec', '⚡ Đồng hồ Điện (kWh)', 'Thay đổi đồng hồ điện');
  }
  if (needWater) {
    html += buildMeterChangeSectionHtml('water', '💧 Đồng hồ Nước (m³)', 'Thay đổi đồng hồ nước');
  }
  container.innerHTML = html;

  if (needElec) updateMeterChangeLiveSection('elec');
  if (needWater) updateMeterChangeLiveSection('water');
}

/**
 * Tạo HTML cho 1 khối đồng hồ (Điện hoặc Nước)
 * @param {'elec' | 'water'} type
 * @param {string} mainLabel
 * @param {string} subLabelBase
 */
function buildMeterChangeSectionHtml(type, mainLabel, subLabelBase) {
  const sec = mcState[type];
  if (!sec) return '';

  const readonlyMode = isMcReadonlyMode();
  const monthKey = getMcTargetMonthKey();
  const isFirstSystemMonth = monthKey <= MC_FIRST_SYSTEM_MONTH;
  const list = sec.rows || [];
  const isMultiple = list.length > 1;
  const hasPrevData = sec.hasPrevData;

  const rowsHtml = list.map((row, idx) => {
    const titleText = isMultiple ? `${subLabelBase} - Lần ${idx + 1}` : subLabelBase;
    const isFirst = idx === 0;
    const isLast = idx === list.length - 1;

    const maxOld = idx === 0 ? sec.oldDigits : sec.newDigits;
    const maxNew = sec.newDigits;

    let box1Attr = '';
    let box1Tooltip = '';
    let missingBangHtml = '';
    let box1OnClick = '';

    if (isFirst) {
      if (hasPrevData) {
        box1Attr = 'readonly';
        box1Tooltip = 'Hệ thống tự động lấy từ chỉ số chốt cuối tháng trước (Không thể sửa)';
      } else if (isFirstSystemMonth) {
        box1Attr = readonlyMode ? 'readonly' : 'placeholder="Nhập số đầu"';
        box1Tooltip = 'Tháng đầu tiên của hệ thống: Nhập số nguyên khởi điểm ban đầu';
      } else if (sec.manualInitUnlocked || row.start !== '') {
        box1Attr = readonlyMode ? 'readonly' : 'placeholder="Nhập số đầu"';
        box1Tooltip = 'Đã mở khóa nhập tay chỉ số đầu kỳ (trường hợp tháng trước phòng nghỉ)';
        missingBangHtml = `<button type="button" class="mc-missing-prev-btn" onmousedown="suppressMcBlurBriefly()" onclick="openMcMissingPrevModal('${type}')" title="Chưa có dữ liệu tháng trước — Bấm để xem lựa chọn quay lại tháng trước hoặc nhập tay">!</button>`;
      } else {
        box1Attr = 'readonly placeholder="Bấm !"';
        box1Tooltip = 'Tháng trước chưa có dữ liệu! Bấm biểu tượng ! màu tím chàm để chọn nhập tay hoặc quay lại tháng trước';
        missingBangHtml = `<button type="button" class="mc-missing-prev-btn" onmousedown="suppressMcBlurBriefly()" onclick="openMcMissingPrevModal('${type}')" title="Chưa có dữ liệu tháng trước — Bấm để chọn quay lại tháng trước hoặc tự nhập tay">!</button>`;
        box1OnClick = `onclick="if(!isMcReadonlyMode()) openMcMissingPrevModal('${type}')"`;
      }
    } else {
      box1Attr = 'readonly placeholder="Theo Ô 3"';
      box1Tooltip = 'Tự động lấy theo Số đầu ĐH mới (Ô 3) của lần thay trước đó';
    }

    const rowDisabledAttr = readonlyMode ? 'disabled' : '';
    const box4BaseAttr = isLast ? 'placeholder="Tùy chọn"' : 'disabled placeholder="—"';

    return `
      <div class="mc-change-row-block" id="mc-${type}-row-${idx}">
        <div class="mc-sub-header">
          <span>${titleText}</span>
          <input type="date" class="mc-date-input"
            value="${escapeMcAttr(row.date || '')}"
            ${readonlyMode ? 'disabled' : ''}
            onchange="onMeterChangeDateInput('${type}', ${idx}, this.value)"
            title="Ngày thay đổi đồng hồ (Không bắt buộc)">
          ${idx > 0 && !readonlyMode
        ? `<button type="button" class="mc-btn-remove" onmousedown="suppressMcBlurBriefly()" onclick="removeMeterChangeRow('${type}', ${idx})">✕ Xóa lần này</button>`
        : ''}
        </div>
        <div class="mc-four-boxes-row">
          <div class="mc-box-unit mc-box-1">
            <div class="mc-box-1-label-row">
              <label for="mc-${type}-${idx}-start">Ô 1: Đầu kỳ</label>
              ${missingBangHtml}
            </div>
            <input type="text" inputmode="numeric" maxlength="${maxOld}"
              id="mc-${type}-${idx}-start"
              value="${escapeMcAttr(row.start)}"
              ${box1Attr}
              ${box1OnClick}
              onkeydown="return onMcIntKeyDown(event)"
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'start', this)"
              title="${escapeMcAttr(box1Tooltip)}">
          </div>
          <span class="mc-separator-semi">;</span>
          <div class="mc-box-unit mc-box-2">
            <label for="mc-${type}-${idx}-oldEnd">Ô 2: Cuối ĐH cũ</label>
            <div class="mc-box-2-wrap">
              <input type="text" inputmode="numeric" maxlength="${maxOld}"
                id="mc-${type}-${idx}-oldEnd"
                value="${escapeMcAttr(row.oldEnd)}"
                placeholder="Lúc tháo"
                ${rowDisabledAttr}
                onkeydown="return onMcIntKeyDown(event)"
                oninput="onMeterChangeNumInput('${type}', ${idx}, 'oldEnd', this)"
                onblur="onMcOldEndBlur('${type}', ${idx})"
                title="Nhập chỉ số nguyên trên mặt ĐH CŨ ngay trước khi tháo (hỗ trợ quay vòng nếu nhỏ hơn Ô 1)">
              <button type="button" class="mc-rollover-tag-btn" id="mc-${type}-${idx}-rollover-tag"
                style="display:none;" onmousedown="suppressMcBlurBriefly()"
                onclick="openMcRolloverForRow('${type}', ${idx})"
                title="Đã xác nhận đồng hồ cũ quay vòng. Nhấn để xem lại.">!</button>
            </div>
          </div>
          <span class="mc-separator-arrow">➔</span>
          <div class="mc-box-unit mc-box-3">
            <label for="mc-${type}-${idx}-newStart">Ô 3: Đầu ĐH mới</label>
            <input type="text" inputmode="numeric" maxlength="${maxNew}"
              id="mc-${type}-${idx}-newStart"
              value="${escapeMcAttr(row.newStart)}"
              placeholder="0"
              ${rowDisabledAttr}
              onkeydown="return onMcIntKeyDown(event)"
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'newStart', this)"
              title="Chỉ số khởi điểm ĐH MỚI lúc lắp (mặc định là 0, có thể bỏ qua nếu là 0 hoặc sửa lại)">
          </div>
          <span class="mc-separator-semi">;</span>
          <div class="mc-box-unit mc-box-4">
            <label for="mc-${type}-${idx}-monthEnd">Ô 4: Cuối tháng</label>
            <input type="text" inputmode="numeric" maxlength="${maxNew}"
              id="mc-${type}-${idx}-monthEnd"
              value="${isLast ? escapeMcAttr(row.monthEnd) : ''}"
              ${box4BaseAttr}
              onkeydown="return onMcIntKeyDown(event)"
              oninput="onMeterChangeNumInput('${type}', ${idx}, 'monthEnd', this)"
              onblur="onMcMonthEndBlur('${type}', ${idx})"
              title="${isLast ? 'Số chốt cuối tháng (Mở sau khi Ô 2 và Ô 3 hợp lệ; có thể để trống lúc mới thay giữa tháng)' : 'Chỉ nhập chốt cuối tháng ở lần thay cuối cùng'}">
          </div>
        </div>
        <div class="mc-row-feedback" id="mc-${type}-${idx}-feedback"></div>
      </div>
    `;
  }).join('');

  return `
    <div class="mc-meter-section" id="mc-section-${type}">
      <div class="mc-meter-main-title">
        <div class="mc-meter-title-left">
          <span>${mainLabel}</span>
          <span class="mc-status-pill tracking" id="mc-status-pill-${type}">⏳ Đang theo dõi</span>
        </div>
        <div class="mc-section-actions-right">
          <button type="button" class="mc-digits-badge-btn" id="mc-digits-badge-${type}"
            onmousedown="suppressMcBlurBriefly()"
            onclick="openMcDigitsModalManual('${type}')"
            ${readonlyMode ? 'disabled' : ''}
            title="Số chữ số đồng hồ mới đang cấu hình (bấm để thay đổi & đồng bộ sang Cài Đặt Chung)">
            🔢 ĐH mới: ${sec.newDigits} số
          </button>
          ${sec.existsSaved && !readonlyMode
        ? `<button type="button" class="mc-btn-clear-section" onmousedown="suppressMcBlurBriefly()" onclick="handleDeleteSectionMeterChange('${type}')" title="Gỡ bỏ ghi nhận thay đổi ${type === 'elec' ? 'Điện' : 'Nước'} cho phòng này">✕ Gỡ</button>`
        : ''}
          <button type="button" class="mc-btn-add-change" id="mc-btn-add-${type}"
            onmousedown="suppressMcBlurBriefly()"
            onclick="addMeterChangeRow('${type}')"
            ${readonlyMode ? 'disabled' : ''}>+ Thêm lần thay</button>
        </div>
      </div>
      ${rowsHtml}
      <div class="mc-section-summary" id="mc-summary-${type}">
        <span style="color:#64748b;">Nhập chỉ số lúc tháo (Ô 2) để xem kết quả tạm tính</span>
        <span class="mc-summary-val">—</span>
      </div>
    </div>
  `;
}

/**
 * Chặn tuyệt đối các ký tự không phải số nguyên không âm (e, E, +, -, ., ,, chữ cái)
 * @param {KeyboardEvent} event
 */
function onMcIntKeyDown(event) {
  if (!event) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const allowedKeys = [
    'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Home', 'End'
  ];
  if (allowedKeys.includes(event.key)) return true;
  if (/^[0-9]$/.test(event.key)) return true;
  event.preventDefault();
  return false;
}

function onMeterChangeDateInput(type, idx, val) {
  if (mcState[type] && mcState[type].rows && mcState[type].rows[idx]) {
    mcState[type].rows[idx].date = val;
  }
}

/**
 * Xử lý nhập số nguyên thời gian thực (tuần tự & không làm mất focus)
 * @param {'elec' | 'water'} type
 * @param {number} idx
 * @param {'start' | 'oldEnd' | 'newStart' | 'monthEnd'} field
 * @param {HTMLInputElement} inputEl
 */
function onMeterChangeNumInput(type, idx, field, inputEl) {
  const sec = mcState[type];
  if (!sec || !sec.rows || !sec.rows[idx]) return;

  // Chỉ giữ lại các ký tự chữ số 0-9
  let cleanVal = String(inputEl.value || '').replace(/\D/g, '');
  const maxLen = (field === 'start' || field === 'oldEnd')
    ? (idx === 0 ? sec.oldDigits : sec.newDigits)
    : sec.newDigits;
  if (cleanVal.length > maxLen) {
    cleanVal = cleanVal.slice(0, maxLen);
  }
  if (inputEl.value !== cleanVal) {
    inputEl.value = cleanVal;
  }

  const row = sec.rows[idx];
  row[field] = cleanVal;

  // Nếu sửa Ô 1 hoặc Ô 2 sao cho Ô 2 >= Ô 1 -> tự động gỡ cờ quay vòng
  if (field === 'start' || field === 'oldEnd') {
    const s = row.start !== '' ? Number(row.start) : NaN;
    const o = row.oldEnd !== '' ? Number(row.oldEnd) : NaN;
    if (row.oldEnd === '' || (!isNaN(s) && !isNaN(o) && o >= s)) {
      row.confirmedRollover = false;
    }
  }

  // Nếu sửa Ô 3 hoặc Ô 4 sao cho Ô 4 >= Ô 3 -> tự động gỡ cờ quay vòng cuối tháng
  if (field === 'newStart' || field === 'monthEnd') {
    const ns = row.newStart !== '' ? Number(row.newStart) : NaN;
    const lastRow = sec.rows[sec.rows.length - 1];
    const me = lastRow && lastRow.monthEnd !== '' ? Number(lastRow.monthEnd) : NaN;
    if (!lastRow || lastRow.monthEnd === '' || (!isNaN(ns) && !isNaN(me) && me >= ns)) {
      sec.confirmedMonthEndRollover = false;
    }
  }

  // Nếu sửa Ô 3 (newStart) của lần i -> tự động nối tiếp sang Ô 1 của lần i + 1
  if (field === 'newStart' && idx + 1 < sec.rows.length) {
    sec.rows[idx + 1].start = cleanVal;
    const nextStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${idx + 1}-start`));
    if (nextStartEl) {
      nextStartEl.value = cleanVal;
    }
    const nextRow = sec.rows[idx + 1];
    const nextOldEndNum = nextRow.oldEnd !== '' ? Number(nextRow.oldEnd) : NaN;
    const nextStartNum = cleanVal !== '' ? Number(cleanVal) : NaN;
    if (isNaN(nextOldEndNum) || (!isNaN(nextStartNum) && nextOldEndNum >= nextStartNum)) {
      nextRow.confirmedRollover = false;
    }
  }

  updateMeterChangeLiveSection(type);
}

/**
 * Khi người dùng rời khỏi Ô 2 -> Kiểm tra quay vòng (nếu < Ô 1) rồi kiểm tra Popup hỏi số chữ số ĐH mới
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function onMcOldEndBlur(type, idx) {
  if (isMcBlurSuppressed()) return;
  if (isMcReadonlyMode() || mcCurrentStep !== 2) return;

  setTimeout(() => {
    const modal = document.getElementById('meter-change-modal');
    if (!modal || modal.style.display !== 'flex' || mcCurrentStep !== 2) return;
    if (isMcBlurSuppressed()) return;

    const sec = mcState[type];
    if (!sec || !sec.rows || !sec.rows[idx]) return;
    const row = sec.rows[idx];

    const startRaw = String(row.start || '').trim();
    const oldEndRaw = String(row.oldEnd || '').trim();
    if (startRaw === '' || oldEndRaw === '') {
      updateMeterChangeLiveSection(type);
      return;
    }

    const startNum = Number(startRaw);
    const oldEndNum = Number(oldEndRaw);
    if (isNaN(startNum) || isNaN(oldEndNum)) return;

    updateMeterChangeLiveSection(type);

    // Bước 1: Nếu nhỏ hơn mốc đầu và chưa xác nhận quay vòng -> bật popup xác nhận quay vòng
    if (oldEndNum < startNum && !row.confirmedRollover) {
      openMcRolloverModal('oldEnd', type, idx);
      return;
    }

    // Bước 2: Đã hợp lệ -> nếu chưa hỏi số chữ số đồng hồ mới cho lần thay này thì bật popup xác nhận
    if (!row.digitsAsked) {
      openMcDigitsModal(type, idx);
    }
  }, 60);
}

/**
 * Khi rời khỏi Ô 4 -> Nếu nhỏ hơn Ô 3 cuối mà chưa xác nhận quay vòng thì bật popup xác nhận
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function onMcMonthEndBlur(type, idx) {
  if (isMcBlurSuppressed()) return;
  if (isMcReadonlyMode() || mcCurrentStep !== 2) return;

  setTimeout(() => {
    const modal = document.getElementById('meter-change-modal');
    if (!modal || modal.style.display !== 'flex' || mcCurrentStep !== 2) return;
    if (isMcBlurSuppressed()) return;
    const sec = mcState[type];
    if (!sec || !sec.rows || idx !== sec.rows.length - 1) return;
    const row = sec.rows[idx];

    const newStartRaw = String(row.newStart || '').trim();
    const monthEndRaw = String(row.monthEnd || '').trim();
    if (newStartRaw === '' || monthEndRaw === '') {
      updateMeterChangeLiveSection(type);
      return;
    }

    const ns = Number(newStartRaw);
    const me = Number(monthEndRaw);
    updateMeterChangeLiveSection(type);
    if (!isNaN(ns) && !isNaN(me) && me < ns && !sec.confirmedMonthEndRollover) {
      openMcRolloverModal('monthEnd', type, idx);
    }
  }, 60);
}

/**
 * Tính toán toàn bộ trạng thái 3 cấp độ, khóa tuần tự Ô 2 -> Ô 3 -> Ô 4 và tổng tiêu thụ
 * @param {'elec' | 'water'} type
 */
function evaluateMeterChangeSection(type) {
  const sec = mcState[type];
  if (!sec || !Array.isArray(sec.rows) || sec.rows.length === 0) {
    return {
      valid: false,
      status: 'tracking',
      total: 0,
      allRowsReadyToBox3: false,
      firstErrorEl: null,
      errorMsg: '',
      needsRolloverConfirm: null
    };
  }

  const list = sec.rows;
  const readonlyMode = isMcReadonlyMode();
  const unit = type === 'elec' ? 'kWh' : 'm³';
  let firstErrorEl = null;
  let firstErrorMsg = '';
  let hasUnconfirmedLess = false;
  let needsRolloverConfirm = null;
  let allRowsReadyToBox3 = true;
  let totalUsed = 0;

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const isLast = i === list.length - 1;
    const segDigits = i === 0 ? sec.oldDigits : sec.newDigits;
    const segMaxLimit = getMcMeterMaxLimit(segDigits);

    const startEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-start`));
    const oldEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-oldEnd`));
    const newStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-newStart`));
    const monthEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${i}-monthEnd`));
    const rolloverTagBtn = document.getElementById(`mc-${type}-${i}-rollover-tag`);

    [startEl, oldEndEl, newStartEl, monthEndEl].forEach(el => {
      if (el) el.classList.remove('mc-input-error');
    });

    const startRaw = row.start !== undefined ? String(row.start).trim() : '';
    const oldEndRaw = row.oldEnd !== undefined ? String(row.oldEnd).trim() : '';
    const newStartRaw = row.newStart !== undefined ? String(row.newStart).trim() : '';
    const monthEndRaw = isLast && row.monthEnd !== undefined ? String(row.monthEnd).trim() : '';

    const startOk = startRaw !== '' && /^\d+$/.test(startRaw);
    const startNum = startOk ? Number(startRaw) : NaN;

    const oldEndEntered = oldEndRaw !== '' && /^\d+$/.test(oldEndRaw);
    const oldEndNum = oldEndEntered ? Number(oldEndRaw) : NaN;
    const isOldEndRolloverCase = startOk && oldEndEntered && oldEndNum < startNum;
    const isOldEndAccepted = startOk && oldEndEntered && (!isOldEndRolloverCase || row.confirmedRollover === true);

    if (rolloverTagBtn) {
      rolloverTagBtn.style.display = (isOldEndRolloverCase && row.confirmedRollover === true) ? 'inline-flex' : 'none';
    }

    const newStartOk = newStartRaw !== '' && /^\d+$/.test(newStartRaw);
    const newStartNum = newStartOk ? Number(newStartRaw) : NaN;

    // Áp dụng khóa tuần tự Ô 1 -> Ô 2 -> Ô 3 -> Ô 4 (không tạo lại thẻ input)
    if (oldEndEl) {
      oldEndEl.disabled = readonlyMode || !startOk;
    }
    if (newStartEl) {
      newStartEl.disabled = readonlyMode || !isOldEndAccepted;
    }

    const isThisRow3Ready = startOk && isOldEndAccepted && newStartOk;
    if (!isThisRow3Ready) {
      allRowsReadyToBox3 = false;
    }

    let rowMsg = '';
    let rowType = '';

    if (isOldEndRolloverCase && !row.confirmedRollover) {
      hasUnconfirmedLess = true;
      const isTypingOldEnd = Boolean(oldEndEl && document.activeElement === oldEndEl);
      if (!isTypingOldEnd) {
        rowType = 'error';
        rowMsg = `Số cuối ĐH cũ (${formatMcNumber(oldEndNum)}) < mốc đầu (${formatMcNumber(startNum)}). Rời ô để xác nhận quay vòng!`;
        if (oldEndEl) {
          oldEndEl.classList.add('mc-input-error');
        }
      } else {
        rowType = '';
        rowMsg = `Đang nhập nhỏ hơn mốc đầu (${formatMcNumber(startNum)}) — rời ô để xác nhận quay vòng nếu ĐH quay vòng`;
      }
      if (oldEndEl && !firstErrorEl) {
        firstErrorEl = oldEndEl;
        firstErrorMsg = `Số cuối ĐH cũ (${formatMcNumber(oldEndNum)}) < mốc đầu (${formatMcNumber(startNum)}). Vui lòng xác nhận quay vòng hoặc sửa lại!`;
      }
      if (!needsRolloverConfirm) {
        needsRolloverConfirm = { kind: 'oldEnd', type, idx: i };
      }
    }

    let segUsed = 0;
    if (isOldEndAccepted) {
      segUsed = isOldEndRolloverCase
        ? (segMaxLimit + oldEndNum) - startNum
        : oldEndNum - startNum;
      totalUsed += segUsed;
    }

    // Kiểm tra Ô 4 ở lần cuối
    let finalAdded = 0;
    let hasMonthEnd = false;
    let isMonthEndValid = true;

    if (isLast && monthEndRaw !== '') {
      hasMonthEnd = true;
      const monthEndNum = Number(monthEndRaw);
      const isEndRollover = newStartOk && monthEndNum < newStartNum;

      if (isEndRollover && !sec.confirmedMonthEndRollover) {
        isMonthEndValid = false;
        hasUnconfirmedLess = true;
        const isTypingMonthEnd = Boolean(monthEndEl && document.activeElement === monthEndEl);
        if (!isTypingMonthEnd) {
          rowType = 'error';
          rowMsg = `Số chốt cuối tháng (${formatMcNumber(monthEndNum)}) < đầu ĐH mới (${formatMcNumber(newStartNum)}). Rời ô để xác nhận quay vòng!`;
          if (monthEndEl) {
            monthEndEl.classList.add('mc-input-error');
          }
        } else {
          rowType = '';
          rowMsg = `Đang nhập nhỏ hơn đầu ĐH mới (${formatMcNumber(newStartNum)}) — rời ô để xác nhận quay vòng nếu ĐH quay vòng`;
        }
        if (monthEndEl && !firstErrorEl) {
          firstErrorEl = monthEndEl;
          firstErrorMsg = `Số chốt cuối tháng (${formatMcNumber(monthEndNum)}) < đầu ĐH mới (${formatMcNumber(newStartNum)}). Vui lòng xác nhận quay vòng hoặc sửa lại!`;
        }
        if (!needsRolloverConfirm) {
          needsRolloverConfirm = { kind: 'monthEnd', type, idx: i };
        }
      } else if (newStartOk) {
        const newMaxLimit = getMcMeterMaxLimit(sec.newDigits);
        finalAdded = isEndRollover
          ? (newMaxLimit + monthEndNum) - newStartNum
          : monthEndNum - newStartNum;
        totalUsed += finalAdded;
      }
    }

    if (rowType !== 'error' && isOldEndAccepted) {
      rowType = 'valid';
      const rolloverTagTxt = isOldEndRolloverCase ? ' (quay vòng)' : '';
      if (isLast && hasMonthEnd && isMonthEndValid && newStartOk) {
        rowMsg = `ĐH cũ${rolloverTagTxt}: +${formatMcNumber(segUsed)} ${unit}  |  ĐH mới: +${formatMcNumber(finalAdded)} ${unit}`;
      } else {
        rowMsg = `ĐH cũ${rolloverTagTxt} đã dùng: +${formatMcNumber(segUsed)} ${unit}`;
      }
    }

    const fbEl = document.getElementById(`mc-${type}-${i}-feedback`);
    if (fbEl) {
      fbEl.className = `mc-row-feedback ${rowType}`;
      fbEl.textContent = rowMsg;
    }
  }

  // Mở khóa Ô 4 cuối cùng và nút "+ Thêm lần thay" khi toàn bộ các lần thay đã đạt tới Ô 3
  const lastIdx = list.length - 1;
  const lastMonthEndEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${lastIdx}-monthEnd`));
  if (lastMonthEndEl) {
    lastMonthEndEl.disabled = readonlyMode || !allRowsReadyToBox3;
  }
  const addBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById(`mc-btn-add-${type}`));
  if (addBtn) {
    addBtn.disabled = readonlyMode || !allRowsReadyToBox3;
  }

  const lastRow = list[lastIdx];
  const lastMonthEndRaw = lastRow && lastRow.monthEnd !== undefined ? String(lastRow.monthEnd).trim() : '';

  if (hasUnconfirmedLess) {
    return {
      valid: false,
      status: 'error',
      total: totalUsed,
      allRowsReadyToBox3,
      firstErrorEl,
      errorMsg: firstErrorMsg,
      needsRolloverConfirm
    };
  }

  if (!allRowsReadyToBox3) {
    return {
      valid: true, // Vẫn cho phép Lưu nháp ở cấp "Đang theo dõi" (nếu không lỗi toán học)
      canSavePartial: true,
      status: 'tracking',
      total: totalUsed,
      allRowsReadyToBox3: false,
      firstErrorEl: null,
      errorMsg: '',
      needsRolloverConfirm: null
    };
  }

  if (lastMonthEndRaw === '') {
    return {
      valid: true,
      canSavePartial: true,
      status: 'need_box4',
      total: totalUsed,
      allRowsReadyToBox3: true,
      firstErrorEl: null,
      errorMsg: '',
      needsRolloverConfirm: null
    };
  }

  return {
    valid: true,
    canSavePartial: true,
    status: 'completed',
    total: totalUsed,
    allRowsReadyToBox3: true,
    firstErrorEl: null,
    errorMsg: '',
    needsRolloverConfirm: null
  };
}

/**
 * Cập nhật badge 3 cấp độ & tổng kết cho khối Điện / Nước
 * @param {'elec' | 'water'} type
 */
function updateMeterChangeLiveSection(type) {
  const unit = type === 'elec' ? 'kWh' : 'm³';
  const evalRes = evaluateMeterChangeSection(type);

  const pillEl = document.getElementById(`mc-status-pill-${type}`);
  const summaryEl = document.getElementById(`mc-summary-${type}`);

  if (pillEl) {
    if (evalRes.status === 'error') {
      pillEl.className = 'mc-status-pill error';
      pillEl.textContent = '⚠️ Cần xác nhận số';
    } else if (evalRes.status === 'completed') {
      pillEl.className = 'mc-status-pill completed';
      pillEl.textContent = '✅ Đã đủ';
    } else if (evalRes.status === 'need_box4') {
      pillEl.className = 'mc-status-pill need-box4';
      pillEl.textContent = '📝 Hãy nhập ô 4';
    } else {
      pillEl.className = 'mc-status-pill tracking';
      pillEl.textContent = '⏳ Đang theo dõi';
    }
  }

  if (summaryEl) {
    if (evalRes.status === 'error') {
      summaryEl.innerHTML = `
        <span style="color:#dc2626; font-weight:600;">${escapeMcAttr(evalRes.errorMsg)}</span>
        <span class="mc-summary-val" style="color:#dc2626;">Chờ xác nhận</span>
      `;
    } else if (evalRes.status === 'completed') {
      summaryEl.innerHTML = `
        <span style="color:#166534; font-weight:600;">Đã đủ Ô 2, Ô 3, Ô 4 — Tổng tiêu thụ tính tiền:</span>
        <span class="mc-summary-val" style="color:#15803d; font-size:15px;">${formatMcNumber(evalRes.total)} ${unit}</span>
      `;
    } else if (evalRes.status === 'need_box4') {
      summaryEl.innerHTML = `
        <span style="color:#15803d; font-weight:600;">Đã nhập xong ĐH mới — Đợi cuối tháng chốt Ô 4 (tạm tính: +${formatMcNumber(evalRes.total)} ${unit})</span>
        <span class="mc-summary-val" style="color:#15803d; font-size:15px;">Hãy nhập ô 4</span>
      `;
    } else {
      summaryEl.innerHTML = `
        <span style="color:#92400e; font-weight:600;">Đang theo dõi — Nhập lần lượt Ô 1 (nếu mới) ➔ Ô 2 ➔ Ô 3:</span>
        <span class="mc-summary-val">${evalRes.total > 0 ? `+${formatMcNumber(evalRes.total)} ${unit}` : '—'}</span>
      `;
    }
  }
}

/* ============================================================================
   POPUP CON 1: THIẾU DỮ LIỆU THÁNG TRƯỚC (BIỂU TƯỢNG ! TÍM CHÀM)
   ============================================================================ */

/**
 * @param {'elec' | 'water'} type
 */
function openMcMissingPrevModal(type) {
  if (!mcSelectedRoom) return;
  const monthKey = getMcTargetMonthKey();
  const prevMonthKey = getMcPrevMonthKey(monthKey);
  const labelType = type === 'elec' ? 'Đồng hồ Điện' : 'Đồng hồ Nước';

  mcMissingPrevCtx = { type, prevMonthKey };

  const subEl = document.getElementById('mc-missing-prev-subtitle');
  const descEl = document.getElementById('mc-missing-prev-desc');
  const targetEl = document.getElementById('mc-missing-prev-target');
  const prevMonthEl = document.getElementById('mc-missing-prev-month');
  const btnPrevMonth = /** @type {HTMLButtonElement | null} */ (document.getElementById('mc-btn-go-prev-month'));

  if (subEl) subEl.textContent = `Phòng ${mcSelectedRoom.phong} chưa có chốt ở ${formatMcMonthLabel(prevMonthKey)}`;
  if (descEl) descEl.textContent = `Tháng trước (${formatMcMonthLabel(prevMonthKey)}) hiện chưa có chỉ số ${labelType.toLowerCase()} của phòng ${mcSelectedRoom.phong} (có thể do tháng trước phòng nghỉ hoặc bạn chưa nhập liệu).`;
  if (targetEl) targetEl.textContent = `Phòng ${mcSelectedRoom.phong} · ${labelType}`;
  if (prevMonthEl) prevMonthEl.textContent = formatMcMonthLabel(prevMonthKey);
  if (btnPrevMonth) {
    btnPrevMonth.style.display = monthKey > MC_FIRST_SYSTEM_MONTH ? 'inline-flex' : 'none';
    btnPrevMonth.textContent = `⬅ Quay lại ${formatMcMonthLabel(prevMonthKey)}`;
  }

  const modal = document.getElementById('mc-missing-prev-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMcMissingPrevModal() {
  const modal = document.getElementById('mc-missing-prev-modal');
  if (modal) modal.style.display = 'none';
}

function confirmManualInitFromMc() {
  if (!mcMissingPrevCtx) {
    closeMcMissingPrevModal();
    return;
  }
  const { type } = mcMissingPrevCtx;
  closeMcMissingPrevModal();

  if (mcState[type]) {
    mcState[type].manualInitUnlocked = true;
    renderMeterChangeStep2Form();
    const startEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-0-start`));
    if (startEl) {
      startEl.focus();
      startEl.select();
    }
  }
}

async function confirmGoToPrevMonthFromMc() {
  if (!mcMissingPrevCtx || !mcMissingPrevCtx.prevMonthKey) {
    closeMcMissingPrevModal();
    return;
  }
  const targetPrevMonth = mcMissingPrevCtx.prevMonthKey;
  closeMcMissingPrevModal();
  closeMeterChangeModal();

  const selectEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'));
  if (selectEl && selectEl.querySelector(`option[value="${targetPrevMonth}"]`)) {
    selectEl.value = targetPrevMonth;
    if (typeof onMonthYearChange === 'function') {
      await onMonthYearChange();
    } else if (typeof loadRoomsForMonth === 'function') {
      await loadRoomsForMonth(targetPrevMonth);
    }
    if (typeof isCurrentMonthLocked !== 'undefined' && isCurrentMonthLocked && typeof showToast === 'function') {
      showToast(`${formatMcMonthLabel(targetPrevMonth)} đang khóa — hãy bấm "Chỉnh Sửa" để điền thêm số cho phòng thiếu/nghỉ.`, 'info');
    }
  } else if (typeof showToast === 'function') {
    showToast(`Không tìm thấy ${formatMcMonthLabel(targetPrevMonth)} trong danh sách tháng.`, 'warning');
  }
}

/* ============================================================================
   POPUP CON 2: XÁC NHẬN ĐỒNG HỒ QUAY VÒNG TRONG MODAL THAY ĐỒNG HỒ
   ============================================================================ */

/**
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function openMcRolloverForRow(type, idx) {
  openMcRolloverModal('oldEnd', type, idx);
}

/**
 * @param {'oldEnd' | 'monthEnd'} kind
 * @param {'elec' | 'water'} type
 * @param {number} idx
 * @param {Function} [onAfterConfirm]
 */
function openMcRolloverModal(kind, type, idx, onAfterConfirm) {
  const sec = mcState[type];
  if (!sec || !sec.rows || !sec.rows[idx] || !mcSelectedRoom) return;
  const row = sec.rows[idx];

  const isOldEnd = kind === 'oldEnd';
  const startNum = isOldEnd ? Number(row.start) : Number(row.newStart);
  const endNum = isOldEnd ? Number(row.oldEnd) : Number(row.monthEnd);
  const digits = isOldEnd ? (idx === 0 ? sec.oldDigits : sec.newDigits) : sec.newDigits;
  const maxLimit = getMcMeterMaxLimit(digits);
  const used = (maxLimit + endNum) - startNum;
  const unit = type === 'elec' ? 'kWh' : 'm³';
  const typeLabel = type === 'elec' ? 'ĐỒNG HỒ ĐIỆN' : 'ĐỒNG HỒ NƯỚC';

  mcRolloverCtx = { kind, type, idx, onAfterConfirm: onAfterConfirm || null };

  const titleEl = document.getElementById('mc-rollover-title');
  const subEl = document.getElementById('mc-rollover-subtitle');
  const descEl = document.getElementById('mc-rollover-desc');
  const formulaEl = document.getElementById('mc-rollover-formula');
  const calcValEl = document.getElementById('mc-rollover-calc-val');

  if (titleEl) titleEl.textContent = `Xác nhận đồng hồ quay vòng (${typeLabel})`;
  if (subEl) subEl.textContent = isOldEnd ? 'Số cuối ĐH cũ (Ô 2) nhỏ hơn Mốc đầu (Ô 1)' : 'Số chốt cuối tháng (Ô 4) nhỏ hơn Đầu ĐH mới (Ô 3)';
  if (descEl) {
    descEl.innerHTML = isOldEnd
      ? `Phòng <strong>${escapeMcAttr(mcSelectedRoom.phong)}</strong> (Lần ${idx + 1}) vừa nhập Số cuối ĐH cũ (<strong>${formatMcNumber(endNum)}</strong>) <span class="text-danger">nhỏ hơn</span> Mốc đầu kỳ (<strong>${formatMcNumber(startNum)}</strong>).`
      : `Phòng <strong>${escapeMcAttr(mcSelectedRoom.phong)}</strong> vừa nhập Số chốt cuối tháng (<strong>${formatMcNumber(endNum)}</strong>) <span class="text-danger">nhỏ hơn</span> Số đầu ĐH mới (<strong>${formatMcNumber(startNum)}</strong>).`;
  }
  if (formulaEl) {
    formulaEl.textContent = `(${formatMcNumber(maxLimit)} [${digits} số] + ${formatMcNumber(endNum)}) - ${formatMcNumber(startNum)}`;
  }
  if (calcValEl) {
    calcValEl.textContent = `${formatMcNumber(used)} ${unit}`;
  }

  const modal = document.getElementById('mc-rollover-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMcRolloverModalUI() {
  const modal = document.getElementById('mc-rollover-modal');
  if (modal) modal.style.display = 'none';
}

function cancelMcRolloverModal() {
  const ctx = mcRolloverCtx;
  mcRolloverCtx = null;
  closeMcRolloverModalUI();
  if (ctx) {
    const field = ctx.kind === 'oldEnd' ? 'oldEnd' : 'monthEnd';
    const el = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${ctx.type}-${ctx.idx}-${field}`));
    if (el) {
      el.focus();
      el.select();
    }
  }
}

function confirmMcRolloverModal() {
  const ctx = mcRolloverCtx;
  mcRolloverCtx = null;
  closeMcRolloverModalUI();
  if (!ctx) return;

  const sec = mcState[ctx.type];
  if (!sec || !sec.rows || !sec.rows[ctx.idx]) return;

  if (ctx.kind === 'oldEnd') {
    sec.rows[ctx.idx].confirmedRollover = true;
    updateMeterChangeLiveSection(ctx.type);
    if (ctx.onAfterConfirm) {
      ctx.onAfterConfirm();
    } else if (!sec.rows[ctx.idx].digitsAsked) {
      openMcDigitsModal(ctx.type, ctx.idx);
    }
  } else {
    sec.confirmedMonthEndRollover = true;
    updateMeterChangeLiveSection(ctx.type);
    if (ctx.onAfterConfirm) {
      ctx.onAfterConfirm();
    }
  }
}

/* ============================================================================
   POPUP CON 3: XÁC NHẬN SỐ CHỮ SỐ ĐỒNG HỒ MỚI (ĐỒNG BỘ CÀI ĐẶT CHUNG)
   ============================================================================ */

function openMcDigitsModalManual(type) {
  if (!mcState[type] || isMcReadonlyMode()) return;
  const lastIdx = Math.max(0, (mcState[type].rows || []).length - 1);
  openMcDigitsModal(type, lastIdx);
}

/**
 * @param {'elec' | 'water'} type
 * @param {number} idx
 */
function openMcDigitsModal(type, idx) {
  if (!mcSelectedRoom || !mcState[type]) return;
  const sec = mcState[type];
  const prevConfiguredDigits = getMcRoomMeterDigits(mcSelectedRoom.phong, type);
  const currentChosen = sec.newDigits || prevConfiguredDigits;
  const labelType = type === 'elec' ? 'ĐIỆN' : 'NƯỚC';

  mcDigitsCtx = { type, idx, prevDigits: prevConfiguredDigits };

  const titleEl = document.getElementById('mc-digits-modal-title');
  const questionEl = document.getElementById('mc-digits-question-text');
  const dotEl = document.getElementById('mc-digits-dot');
  const labelEl = document.getElementById('mc-digits-input-label');
  const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-new-meter-digits-input'));

  if (titleEl) titleEl.textContent = `Số chữ số đồng hồ ${labelType} mới (Phòng ${mcSelectedRoom.phong})`;
  if (questionEl) {
    questionEl.innerHTML = `Tháng trước phòng <strong>${escapeMcAttr(mcSelectedRoom.phong)}</strong> đang sử dụng đồng hồ <strong>${labelType.toLowerCase()}</strong> loại <strong>${prevConfiguredDigits} chữ số</strong>. Đồng hồ mới vừa lắp có giữ nguyên số chữ số này không?`;
  }
  if (dotEl) {
    dotEl.className = `meter-dot ${type === 'elec' ? 'meter-dot-dien' : 'meter-dot-nuoc'}`;
  }
  if (labelEl) {
    labelEl.textContent = `Số chữ số ĐH ${labelType} mới (3 - 7):`;
  }
  if (inputEl) {
    inputEl.value = String(currentChosen);
  }
  updateMcDigitsModalHint(currentChosen);

  const modal = document.getElementById('mc-digits-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMcDigitsModalUI() {
  const modal = document.getElementById('mc-digits-modal');
  if (modal) modal.style.display = 'none';
}

function updateMcDigitsModalHint(val) {
  const hintEl = document.getElementById('mc-digits-max-hint');
  if (!hintEl) return;
  const d = Math.max(3, Math.min(7, Number(val) || 5));
  const maxVal = getMcMeterMaxLimit(d) - 1;
  hintEl.innerHTML = `<span>Tối đa trên mặt số: <strong>${maxVal.toLocaleString('vi-VN')}</strong> (${d} chữ số)</span>`;
}

function stepMcNewMeterDigits(delta) {
  const el = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-new-meter-digits-input'));
  if (!el) return;
  let val = parseInt(el.value, 10);
  if (isNaN(val)) val = 5;
  val = Math.max(3, Math.min(7, val + delta));
  el.value = String(val);
  updateMcDigitsModalHint(val);
}

function validateMcDigitInputRealtime(inputEl) {
  if (!inputEl) return;
  let val = String(inputEl.value || '').replace(/\D/g, '');
  if (val.length > 1) val = val.slice(0, 1);
  if (val !== '') {
    let num = Number(val);
    if (num < 3) num = 3;
    if (num > 7) num = 7;
    val = String(num);
  }
  inputEl.value = val;
  if (val !== '') updateMcDigitsModalHint(Number(val));
}

function enforceMcDigitRange(inputEl) {
  if (!inputEl) return;
  const fallback = mcDigitsCtx ? mcDigitsCtx.prevDigits : 5;
  let num = parseInt(inputEl.value, 10);
  if (isNaN(num) || num < 3 || num > 7) num = fallback;
  inputEl.value = String(num);
  updateMcDigitsModalHint(num);
}

async function confirmMcNewMeterDigits() {
  const ctx = mcDigitsCtx;
  mcDigitsCtx = null;
  const inputEl = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-new-meter-digits-input'));
  let chosen = inputEl ? parseInt(inputEl.value, 10) : (ctx ? ctx.prevDigits : 5);
  if (isNaN(chosen) || chosen < 3 || chosen > 7) {
    chosen = ctx ? ctx.prevDigits : 5;
  }

  closeMcDigitsModalUI();
  if (!ctx || !mcSelectedRoom) return;

  const { type, idx, prevDigits } = ctx;
  const sec = mcState[type];
  if (!sec) return;

  if (sec.rows && sec.rows[idx]) {
    sec.rows[idx].digitsAsked = true;
  }
  sec.newDigits = chosen;

  // Cập nhật maxlength & chuẩn hóa độ dài các ô của đồng hồ mới ngay lập tức
  if (sec.rows) {
    sec.rows.forEach((r, rIdx) => {
      if (rIdx > 0) {
        if (String(r.start || '').length > chosen) r.start = String(r.start).slice(0, chosen);
        if (String(r.oldEnd || '').length > chosen) r.oldEnd = String(r.oldEnd).slice(0, chosen);
        const sEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${rIdx}-start`));
        const oEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${rIdx}-oldEnd`));
        if (sEl) { sEl.maxLength = chosen; sEl.value = String(r.start || ''); }
        if (oEl) { oEl.maxLength = chosen; oEl.value = String(r.oldEnd || ''); }
      }
      if (String(r.newStart || '').length > chosen) r.newStart = String(r.newStart).slice(0, chosen);
      if (String(r.monthEnd || '').length > chosen) r.monthEnd = String(r.monthEnd).slice(0, chosen);
      const nEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${rIdx}-newStart`));
      const mEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mc-${type}-${rIdx}-monthEnd`));
      if (nEl) { nEl.maxLength = chosen; nEl.value = String(r.newStart !== undefined ? r.newStart : '0'); }
      if (mEl) { mEl.maxLength = chosen; mEl.value = String(r.monthEnd || ''); }
    });
  }

  const badgeBtn = document.getElementById(`mc-digits-badge-${type}`);
  if (badgeBtn) {
    badgeBtn.textContent = `🔢 ĐH mới: ${chosen} số`;
  }

  // Nếu có thay đổi số chữ số so với Cài Đặt Chung -> tự động cập nhật & lưu ngay sang Cài Đặt Chung
  if (chosen !== prevDigits && typeof appSettings !== 'undefined' && appSettings) {
    if (!appSettings.meterDigits || typeof appSettings.meterDigits !== 'object') {
      appSettings.meterDigits = {};
    }
    const phong = mcSelectedRoom.phong;
    if (!appSettings.meterDigits[phong]) {
      appSettings.meterDigits[phong] = {
        dien: getMcRoomMeterDigits(phong, 'elec'),
        nuoc: getMcRoomMeterDigits(phong, 'water')
      };
    }
    const fieldKey = type === 'elec' ? 'dien' : 'nuoc';
    appSettings.meterDigits[phong][fieldKey] = chosen;

    if (typeof renderMeterDigitsSettingsList === 'function') {
      renderMeterDigitsSettingsList();
    }
    if (typeof saveSettingsFile === 'function') {
      await saveSettingsFile(true);
    }
    if (typeof showToast === 'function') {
      const lbl = type === 'elec' ? 'Điện' : 'Nước';
      showToast(`Đã cập nhật đồng hồ ${lbl} phòng ${phong} sang loại ${chosen} chữ số trong Cài Đặt Chung.`, 'info');
    }
  }

  updateMeterChangeLiveSection(type);
}

/* ============================================================================
   LƯU & ĐỒNG BỘ DỮ LIỆU RA BẢNG PHẦN 1 + ACTIVITY LOG
   ============================================================================ */

/**
 * Chuyển đổi state UI của 1 loại đồng hồ sang object chuẩn lưu trữ trong meter-changes.json
 * @param {'elec' | 'water'} type
 */
function serializeMcSectionForSave(type) {
  const sec = mcState[type];
  if (!sec || !Array.isArray(sec.rows) || sec.rows.length === 0) return null;

  const evalRes = evaluateMeterChangeSection(type);
  const firstStartRaw = String(sec.rows[0].start || '').trim();
  const initialIndex = firstStartRaw !== '' && /^\d+$/.test(firstStartRaw) ? Number(firstStartRaw) : null;
  const lastRow = sec.rows[sec.rows.length - 1];
  const monthEndRaw = lastRow && lastRow.monthEnd !== undefined ? String(lastRow.monthEnd).trim() : '';
  const monthEndIndex = monthEndRaw !== '' && /^\d+$/.test(monthEndRaw) ? Number(monthEndRaw) : null;

  return {
    status: evalRes.status,
    initialIndex,
    isInitialManual: !sec.hasPrevData,
    oldDigits: sec.oldDigits,
    newDigits: sec.newDigits,
    confirmedMonthEndRollover: Boolean(sec.confirmedMonthEndRollover),
    changes: sec.rows.map(r => ({
      date: r.date || '',
      oldEnd: r.oldEnd !== '' && /^\d+$/.test(String(r.oldEnd)) ? Number(r.oldEnd) : null,
      newStart: r.newStart !== '' && /^\d+$/.test(String(r.newStart)) ? Number(r.newStart) : null,
      confirmedRollover: Boolean(r.confirmedRollover),
      digitsAsked: Boolean(r.digitsAsked)
    })),
    monthEndIndex,
    totalConsumption: evalRes.total,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Đồng bộ dữ liệu vừa lưu/xóa xuống roomsData, file history/YYYY-MM.json và bảng Phần 1
 * @param {string} monthKey
 * @param {string} phong
 */
async function syncMeterChangeToMainTable(monthKey, phong) {
  const rec = getRoomMeterChangeRecord(monthKey, phong);
  const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || '');

  if (monthKey === loadedMonth && typeof roomsData !== 'undefined' && Array.isArray(roomsData)) {
    const idx = roomsData.findIndex(r => r.phong === phong);
    if (idx !== -1) {
      const room = roomsData[idx];

      // Điện
      if (rec && rec.elec) {
        room.hasMcElec = true;
        room.mcElecStatus = rec.elec.status;
        if (rec.elec.initialIndex !== null && rec.elec.initialIndex !== undefined && !room.isDienCuLocked) {
          room.dienCu = rec.elec.initialIndex;
        }
        if (rec.elec.status === 'completed' && rec.elec.monthEndIndex !== null && rec.elec.monthEndIndex !== undefined) {
          room.dienMoi = rec.elec.monthEndIndex;
          room.dienKwhOverride = rec.elec.totalConsumption;
          room.confirmedRollover = false;
        } else {
          room.dienMoi = '';
          room.dienKwhOverride = null;
          room.confirmedRollover = false;
        }
      } else if (room.hasMcElec) {
        room.hasMcElec = false;
        room.mcElecStatus = null;
        room.dienKwhOverride = null;
        room.dienMoi = '';
      }

      // Nước
      if (rec && rec.water) {
        room.hasMcWater = true;
        room.mcWaterStatus = rec.water.status;
        if (rec.water.initialIndex !== null && rec.water.initialIndex !== undefined && !room.isNuocCuLocked) {
          room.nuocCu = rec.water.initialIndex;
        }
        if (rec.water.status === 'completed' && rec.water.monthEndIndex !== null && rec.water.monthEndIndex !== undefined) {
          room.nuocMoi = rec.water.monthEndIndex;
          room.nuocKhoiOverride = rec.water.totalConsumption;
        } else {
          room.nuocMoi = '';
          room.nuocKhoiOverride = null;
        }
      } else if (room.hasMcWater) {
        room.hasMcWater = false;
        room.mcWaterStatus = null;
        room.nuocKhoiOverride = null;
        room.nuocMoi = '';
      }
    }

    if (typeof autoSaveCurrentMonthData === 'function') {
      await autoSaveCurrentMonthData(monthKey);
    }
    if (typeof renderInitialTable === 'function') {
      renderInitialTable();
    }
    if (typeof populateMonthSelect === 'function') {
      await populateMonthSelect();
    }
    return;
  }

  // Nếu sửa/gỡ bản ghi của tháng khác (mở từ Mục 3) -> ghi trực tiếp vào history/YYYY-MM.json của tháng đó, không đụng roomsData hiện tại
  if (typeof readHistoryFile === 'function' && typeof writeHistoryFile === 'function' && typeof extractHistoryPayload === 'function') {
    const raw = await readHistoryFile(monthKey);
    const payload = extractHistoryPayload(raw);
    const existingList = Array.isArray(payload.rooms) ? payload.rooms : [];
    const baseList = MC_FALLBACK_ROOMS.map(pName => {
      const found = existingList.find(item => item.phong === pName);
      return found ? { ...found } : { phong: pName, dienCu: '', dienMoi: '', nuocCu: '', nuocMoi: '', confirmedRollover: false, confirmedAnomaly: false };
    });
    const targetRoom = baseList.find(item => item.phong === phong);
    if (targetRoom) {
      if (rec && rec.elec) {
        if (rec.elec.initialIndex !== null && rec.elec.initialIndex !== undefined && (targetRoom.dienCu === '' || targetRoom.dienCu === null || targetRoom.dienCu === undefined || rec.elec.isInitialManual)) {
          targetRoom.dienCu = rec.elec.initialIndex;
        }
        targetRoom.dienMoi = (rec.elec.status === 'completed' && rec.elec.monthEndIndex !== null && rec.elec.monthEndIndex !== undefined)
          ? rec.elec.monthEndIndex
          : '';
        targetRoom.confirmedRollover = false;
      } else {
        targetRoom.dienMoi = '';
      }

      if (rec && rec.water) {
        if (rec.water.initialIndex !== null && rec.water.initialIndex !== undefined && (targetRoom.nuocCu === '' || targetRoom.nuocCu === null || targetRoom.nuocCu === undefined || rec.water.isInitialManual)) {
          targetRoom.nuocCu = rec.water.initialIndex;
        }
        targetRoom.nuocMoi = (rec.water.status === 'completed' && rec.water.monthEndIndex !== null && rec.water.monthEndIndex !== undefined)
          ? rec.water.monthEndIndex
          : '';
      } else {
        targetRoom.nuocMoi = '';
      }

      const dataToSave = (raw && !Array.isArray(raw) && typeof raw === 'object' && Array.isArray(raw.rooms))
        ? { ...raw, rooms: baseList }
        : baseList;
      await writeHistoryFile(monthKey, dataToSave);
    }
    if (typeof populateMonthSelect === 'function') {
      await populateMonthSelect();
    }
  }
}

/**
 * Lưu ghi nhận thay đổi đồng hồ từ Bước 2 (Sau khi lưu tự động khóa ngay tại Bước 2, không đóng Modal)
 */
async function handleSaveMeterChange() {
  mcSuppressBlurUntil = 0;
  if (!mcSelectedRoom || isMcReadonlyMode()) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (!needElec && !needWater) {
    if (typeof showToast === 'function') showToast('Vui lòng chọn ít nhất 1 loại đồng hồ!', 'warning');
    return;
  }

  const mbConflictSave = (typeof getRoomMeterBreakRecord === 'function')
    ? getRoomMeterBreakRecord(getMcTargetMonthKey(), mcSelectedRoom.phong)
    : null;
  if ((needElec && mbConflictSave && mbConflictSave.elec) || (needWater && mbConflictSave && mbConflictSave.water)) {
    if (typeof showToast === 'function') {
      showToast('Phòng này đang có Break chỉ số ở loại đồng hồ đã chọn, không thể lưu Thay đổi đồng hồ cùng lúc!', 'warning');
    }
    return;
  }

  // Kiểm tra xem có ô nào đang có số nhỏ hơn chưa xác nhận quay vòng không
  /** @type {Array<{ type: 'elec' | 'water', label: string }>} */
  const typesToCheck = [];
  if (needElec) typesToCheck.push({ type: 'elec', label: '⚡ Điện' });
  if (needWater) typesToCheck.push({ type: 'water', label: '💧 Nước' });

  for (const item of typesToCheck) {
    const evalRes = evaluateMeterChangeSection(item.type);
    if (evalRes.status === 'error' && evalRes.needsRolloverConfirm) {
      const c = evalRes.needsRolloverConfirm;
      openMcRolloverModal(c.kind, c.type, c.idx, () => handleSaveMeterChange());
      return;
    }
    if (evalRes.status === 'error') {
      if (evalRes.firstErrorEl) evalRes.firstErrorEl.focus();
      if (typeof showToast === 'function') showToast(evalRes.errorMsg || 'Vui lòng kiểm tra lại số liệu!', 'warning');
      return;
    }
  }

  const monthKey = getMcTargetMonthKey();
  const phong = mcSelectedRoom.phong;
  const existingRec = getRoomMeterChangeRecord(monthKey, phong) || {};
  const isAfterEdit = Boolean(mcIsRecordEditing);

  const nextRoomData = {
    elec: needElec ? serializeMcSectionForSave('elec') : (mcStagedDeletes.elec ? null : (existingRec.elec || null)),
    water: needWater ? serializeMcSectionForSave('water') : (mcStagedDeletes.water ? null : (existingRec.water || null))
  };

  try {
    await persistRoomMeterChange(monthKey, phong, nextRoomData);
    await syncMeterChangeToMainTable(monthKey, phong);

    // Ghi Nhật ký hoạt động
    if (typeof recordActivityLog === 'function') {
      const statusTextMap = {
        tracking: 'Đang theo dõi',
        need_box4: 'Hãy nhập ô 4',
        completed: 'Đã đủ'
      };
      const parts = [];
      if (needElec && nextRoomData.elec) {
        parts.push(`Điện: ${statusTextMap[nextRoomData.elec.status] || nextRoomData.elec.status} (${formatMcNumber(nextRoomData.elec.totalConsumption)} kWh)`);
      } else if (mcStagedDeletes.elec) {
        parts.push('Đã gỡ đồng hồ Điện');
      }
      if (needWater && nextRoomData.water) {
        parts.push(`Nước: ${statusTextMap[nextRoomData.water.status] || nextRoomData.water.status} (${formatMcNumber(nextRoomData.water.totalConsumption)} m³)`);
      } else if (mcStagedDeletes.water) {
        parts.push('Đã gỡ đồng hồ Nước');
      }
      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_CHANGE_SAVE',
        level: 'info',
        result: 'success',
        title: isAfterEdit
          ? `Cập nhật thay đổi đồng hồ phòng ${phong}`
          : `Ghi nhận thay đổi đồng hồ phòng ${phong}`,
        summary: `${formatMcMonthLabel(monthKey)} · Phòng ${phong}: ${parts.join(' | ')}`,
        metadata: { target: `${monthKey}_${phong}`, monthKey, phong }
      });
    }

    // Chuyển ngay Bước 2 sang trạng thái Đã khóa dữ liệu (không đóng Modal, không khóa Phần 1)
    const freshRec = getRoomMeterChangeRecord(monthKey, phong);
    mcSelectedRoom = {
      ...mcSelectedRoom,
      savedElec: freshRec && freshRec.elec ? freshRec.elec : null,
      savedWater: freshRec && freshRec.water ? freshRec.water : null
    };

    const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth) ? currentLoadedMonth : monthKey;
    if (monthKey === loadedMonth) {
      const snapIdx = mcRoomsSnapshot.findIndex(r => r.phong === phong);
      if (snapIdx !== -1) {
        mcRoomsSnapshot[snapIdx] = cloneMcJson(mcSelectedRoom);
      }
    }

    const lblElec = document.getElementById('mc-lbl-elec');
    const lblWater = document.getElementById('mc-lbl-water');
    if (chkElec) chkElec.checked = Boolean(mcSelectedRoom.savedElec);
    if (chkWater) chkWater.checked = Boolean(mcSelectedRoom.savedWater);
    if (lblElec && chkElec) lblElec.classList.toggle('checked', chkElec.checked);
    if (lblWater && chkWater) lblWater.classList.toggle('checked', chkWater.checked);

    mcStagedDeletes = { elec: false, water: false };
    mcIsRecordLocked = true;
    mcIsRecordEditing = false;
    mcRecordBackupState = null;

    initMeterChangeStep2State();
    renderMeterChangeStep2Form();
    renderMeterChangeRoomGrid();
    renderMeterChangeHistoryList();

    if (typeof showToast === 'function') {
      showToast(`Đã lưu & khóa ghi nhận đồng hồ phòng ${phong} (${formatMcMonthLabel(monthKey)})!`, 'success');
    }
  } catch (err) {
    console.error('Lỗi khi lưu meter-changes:', err);
    if (typeof showToast === 'function') {
      showToast(`Không thể lưu thay đổi đồng hồ: ${err.message}`, 'error');
    }
  }
}

/**
 * Gỡ bỏ ghi nhận thay đồng hồ của riêng Điện hoặc Nước trong phòng đang mở
 * (Nếu đang ở chế độ Chỉnh Sửa và vẫn còn loại ĐH kia -> tạm gỡ trên UI để hoàn tác được cho tới khi bấm Lưu)
 * @param {'elec' | 'water'} type
 */
async function handleDeleteSectionMeterChange(type) {
  if (!mcSelectedRoom || isMcReadonlyMode()) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mc-chk-water'));
  const otherType = type === 'elec' ? 'water' : 'elec';
  const otherChecked = otherType === 'elec'
    ? Boolean(chkElec && chkElec.checked)
    : Boolean(chkWater && chkWater.checked);

  if (mcIsRecordEditing && otherChecked) {
    mcStagedDeletes[type] = true;
    const targetChk = type === 'elec' ? chkElec : chkWater;
    const targetLbl = document.getElementById(type === 'elec' ? 'mc-lbl-elec' : 'mc-lbl-water');
    if (targetChk) targetChk.checked = false;
    if (targetLbl) targetLbl.classList.remove('checked');

    mcSelectedRoom[type === 'elec' ? 'savedElec' : 'savedWater'] = null;
    mcState[type] = buildInitialTypeState(mcSelectedRoom, type);
    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    renderMeterChangeStep2Form();
    if (typeof showToast === 'function') {
      showToast(`Đã tạm gỡ đồng hồ ${typeLabel}. Bấm '💾 Lưu ghi nhận' để xác nhận hoặc 'Hủy thay đổi & Giữ nguyên' để hoàn tác.`, 'info');
    }
    return;
  }

  const monthKey = getMcTargetMonthKey();
  const phong = mcSelectedRoom.phong;
  const existingRec = getRoomMeterChangeRecord(monthKey, phong);
  if (!existingRec || !existingRec[type]) return;

  const nextRoomData = {
    elec: type === 'elec' ? null : (existingRec.elec || null),
    water: type === 'water' ? null : (existingRec.water || null)
  };

  try {
    await persistRoomMeterChange(monthKey, phong, nextRoomData);
    await syncMeterChangeToMainTable(monthKey, phong);

    mcSelectedRoom[type === 'elec' ? 'savedElec' : 'savedWater'] = null;
    mcState[type] = buildInitialTypeState(mcSelectedRoom, type);
    const targetChk = type === 'elec' ? chkElec : chkWater;
    const targetLbl = document.getElementById(type === 'elec' ? 'mc-lbl-elec' : 'mc-lbl-water');
    if (targetChk) targetChk.checked = false;
    if (targetLbl) targetLbl.classList.remove('checked');

    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    if (typeof recordActivityLog === 'function') {
      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_CHANGE_DELETE',
        level: 'warning',
        result: 'success',
        title: `Gỡ thay đổi đồng hồ ${typeLabel} phòng ${phong}`,
        summary: `${formatMcMonthLabel(monthKey)} · Đã trả đồng hồ ${typeLabel} phòng ${phong} về chế độ nhập bình thường.`,
        metadata: { target: `${monthKey}_${phong}`, monthKey, phong, type }
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Đã gỡ thay đổi đồng hồ ${typeLabel} phòng ${phong}. Ô ngoài bảng đã mở khóa nhập bình thường.`, 'info');
    }

    renderMeterChangeRoomGrid();
    renderMeterChangeHistoryList();

    if (!nextRoomData.elec && !nextRoomData.water) {
      mcRecordBackupState = null;
      mcIsRecordEditing = false;
      mcIsRecordLocked = false;
      closeMeterChangeModal();
    } else {
      mcIsRecordLocked = true;
      mcIsRecordEditing = false;
      mcRecordBackupState = null;
      renderMeterChangeStep2Form();
    }
  } catch (err) {
    console.error('Lỗi khi gỡ thay đổi đồng hồ:', err);
    if (typeof showToast === 'function') showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Hủy toàn bộ thay đổi đồng hồ của phòng đang mở (trả cả Điện/Nước về bảng chính bình thường)
 */
async function handleDeleteRoomMeterChanges() {
  if (!mcSelectedRoom || isMcReadonlyMode()) return;
  const monthKey = getMcTargetMonthKey();
  const phong = mcSelectedRoom.phong;

  try {
    await persistRoomMeterChange(monthKey, phong, null);
    await syncMeterChangeToMainTable(monthKey, phong);

    if (typeof recordActivityLog === 'function') {
      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_CHANGE_DELETE',
        level: 'warning',
        result: 'success',
        title: `Hủy toàn bộ thay đổi đồng hồ phòng ${phong}`,
        summary: `${formatMcMonthLabel(monthKey)} · Đã hủy ghi nhận thay đồng hồ phòng ${phong}.`,
        metadata: { target: `${monthKey}_${phong}`, monthKey, phong }
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Đã hủy toàn bộ thay đổi đồng hồ phòng ${phong}.`, 'info');
    }
    mcRecordBackupState = null;
    mcIsRecordEditing = false;
    mcIsRecordLocked = false;
    mcStagedDeletes = { elec: false, water: false };
    renderMeterChangeRoomGrid();
    renderMeterChangeHistoryList();
    closeMeterChangeModal();
  } catch (err) {
    console.error('Lỗi khi hủy thay đổi đồng hồ phòng:', err);
    if (typeof showToast === 'function') showToast(`Lỗi: ${err.message}`, 'error');
  }
}

// Đóng Modal theo đúng thứ tự xếp tầng (popup con trước -> modal chính sau)
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const unlockEditModal = document.getElementById('mc-unlock-edit-modal');
    if (unlockEditModal && unlockEditModal.style.display === 'flex') {
      closeMcUnlockEditModal();
      return;
    }
    const digitsModal = document.getElementById('mc-digits-modal');
    if (digitsModal && digitsModal.style.display === 'flex') {
      mcDigitsCtx = null;
      closeMcDigitsModalUI();
      return;
    }
    const rollModal = document.getElementById('mc-rollover-modal');
    if (rollModal && rollModal.style.display === 'flex') {
      cancelMcRolloverModal();
      return;
    }
    const missingModal = document.getElementById('mc-missing-prev-modal');
    if (missingModal && missingModal.style.display === 'flex') {
      closeMcMissingPrevModal();
      return;
    }
    const mainModal = document.getElementById('meter-change-modal');
    if (mainModal && mainModal.style.display === 'flex') {
      closeMeterChangeModal();
    }
  });

  document.addEventListener('click', e => {
    const mainModal = document.getElementById('meter-change-modal');
    if (mainModal && mainModal.style.display === 'flex' && e.target === mainModal) {
      closeMeterChangeModal();
    }
  });
}

// Phơi các hàm ra window
if (typeof window !== 'undefined') {
  window.loadMeterChangesStore = loadMeterChangesStore;
  window.getRoomMeterChangeRecord = getRoomMeterChangeRecord;
  window.getUnfinishedMeterChangesForMonth = getUnfinishedMeterChangesForMonth;
  window.openMeterChangeModal = openMeterChangeModal;
  window.closeMeterChangeModal = closeMeterChangeModal;
  window.toggleMeterChangeType = toggleMeterChangeType;
  window.goToMeterChangeStep = goToMeterChangeStep;
  window.handleMcStep2Back = handleMcStep2Back;
  window.handleToggleEditMcRecordClick = handleToggleEditMcRecordClick;
  window.closeMcUnlockEditModal = closeMcUnlockEditModal;
  window.confirmUnlockMcRecordForEditing = confirmUnlockMcRecordForEditing;
  window.openMeterChangeHistoryCard = openMeterChangeHistoryCard;
  window.addMeterChangeRow = addMeterChangeRow;
  window.removeMeterChangeRow = removeMeterChangeRow;
  window.onMcIntKeyDown = onMcIntKeyDown;
  window.onMeterChangeDateInput = onMeterChangeDateInput;
  window.onMeterChangeNumInput = onMeterChangeNumInput;
  window.onMcOldEndBlur = onMcOldEndBlur;
  window.onMcMonthEndBlur = onMcMonthEndBlur;
  window.openMcMissingPrevModal = openMcMissingPrevModal;
  window.closeMcMissingPrevModal = closeMcMissingPrevModal;
  window.confirmManualInitFromMc = confirmManualInitFromMc;
  window.confirmGoToPrevMonthFromMc = confirmGoToPrevMonthFromMc;
  window.openMcRolloverForRow = openMcRolloverForRow;
  window.cancelMcRolloverModal = cancelMcRolloverModal;
  window.confirmMcRolloverModal = confirmMcRolloverModal;
  window.openMcDigitsModalManual = openMcDigitsModalManual;
  window.stepMcNewMeterDigits = stepMcNewMeterDigits;
  window.validateMcDigitInputRealtime = validateMcDigitInputRealtime;
  window.enforceMcDigitRange = enforceMcDigitRange;
  window.confirmMcNewMeterDigits = confirmMcNewMeterDigits;
  window.handleSaveMeterChange = handleSaveMeterChange;
  window.handleDeleteSectionMeterChange = handleDeleteSectionMeterChange;
  window.handleDeleteRoomMeterChanges = handleDeleteRoomMeterChanges;
  window.suppressMcBlurBriefly = suppressMcBlurBriefly;
}

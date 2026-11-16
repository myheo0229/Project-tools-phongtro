/// <reference path="./globals.d.ts" />
/**
 * ============================================================================
 * MODULE XỬ LÝ LOGIC & UI BREAK CHỈ SỐ ĐIỆN / NƯỚC GIỮA THÁNG
 * src/input/meter-break-modal.js
 * ============================================================================
 * - Lưu trữ lịch sử tách biệt vào <baseFolder>/data/meter-breaks.json qua IPC
 * - Khi đổi người thuê giữa tháng: ghi nhận Đầu kỳ gốc -> Break kết thúc (lưu lịch sử)
 *   -> Break bắt đầu (cập nhật làm Số cũ / đầu kỳ mới của tháng hiện tại & Phiếu Thu)
 * - Chặn trùng lặp với Thay đổi đồng hồ trên cùng 1 loại đồng hồ của 1 phòng trong tháng
 * - Hỗ trợ quay vòng (Break kết thúc < Đầu kỳ gốc, Break bắt đầu < Break kết thúc,
 *   hoặc Số mới ngoài bảng < Break bắt đầu) với popup xác nhận #mb-rollover-modal
 * - Khóa tự động sau Lưu + Chỉnh Sửa / Hoàn tác ngay tại Bước 2 + Mục 3 Lịch sử
 */

const MB_FALLBACK_ROOMS = ['1A', '2A', '3A', '4A', '5A', '6A', '1B', '2B', '3B', '4B', '5B', '6B'];
const MB_LOCALSTORAGE_KEY = 'phongtro_meter_breaks';
const MB_FIRST_SYSTEM_MONTH = '2026-07';

/**
 * Kho lưu trữ lịch sử Break trong bộ nhớ (đồng bộ với meter-breaks.json)
 * @type {{ version: number, months: Record<string, Record<string, any>> }}
 */
window.meterBreaksStore = window.meterBreaksStore || { version: 1, months: {} };

let mbRoomsSnapshot = [];
let mbSelectedRoom = null;
let mbCurrentStep = 1;
let mbIsTransitioning = false;
let mbTransitionTimer = null;
let mbSuppressBlurUntil = 0;

let mbActiveMonthKey = null;
let mbIsRecordLocked = false;
let mbIsRecordEditing = false;
let mbRecordBackupState = null;
let mbStagedDeletes = { elec: false, water: false };

let mbMissingPrevCtx = null;
let mbRolloverCtx = null;
let mbMissingPrevAutoPrompted = { elec: false, water: false };

/**
 * State nhập liệu tạm thời trong Modal Break (tách riêng Điện & Nước)
 * @type {{ elec: any, water: any }}
 */
let mbState = {
  elec: null,
  water: null
};

function cloneMbJson(obj) {
  return (obj === undefined || obj === null) ? obj : JSON.parse(JSON.stringify(obj));
}

function suppressMbBlurBriefly(ms = 350) {
  mbSuppressBlurUntil = Date.now() + ms;
}

function isMbBlurSuppressed() {
  return Date.now() < mbSuppressBlurUntil;
}

function formatMbNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

function escapeMbAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getMbTargetMonthKey() {
  if (mbActiveMonthKey) {
    return mbActiveMonthKey;
  }
  if (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth) {
    return currentLoadedMonth;
  }
  const sel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'));
  return (sel && sel.value) ? sel.value : MB_FIRST_SYSTEM_MONTH;
}

function getMbPrevMonthKey(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return '';
  const [y, m] = monthKey.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return '';
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function formatMbMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [y, m] = monthKey.split('-');
  return `Tháng ${m}/${y}`;
}

/**
 * Kiểm tra tháng `monthKey` có đang bị khóa ở cấp độ Tháng (Lưu & Xuất ngoài Phần 1) hay không
 * @param {string} monthKey
 */
function isMbMonthLocked(monthKey) {
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

function isMbReadonlyMode() {
  if (isMbMonthLocked(getMbTargetMonthKey())) return true;
  return Boolean(mbIsRecordLocked && !mbIsRecordEditing);
}

function getMbRoomMeterDigits(phong, type) {
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

function getMbMeterMaxLimit(digits) {
  const d = Math.max(3, Math.min(7, Math.floor(Number(digits) || 5)));
  if (typeof getMeterLimitByDigits === 'function') {
    return getMeterLimitByDigits(d, Math.pow(10, d));
  }
  return Math.pow(10, d);
}

/* ============================================================================
   IPC ĐỌC / GHI METER-BREAKS.JSON
   ============================================================================ */

async function loadMeterBreaksStore() {
  if (window.api && typeof window.api.loadMeterBreaks === 'function') {
    try {
      const res = await window.api.loadMeterBreaks();
      if (res && res.data && typeof res.data === 'object') {
        window.meterBreaksStore = {
          version: 1,
          months: (res.data.months && typeof res.data.months === 'object') ? res.data.months : {}
        };
        return window.meterBreaksStore;
      }
    } catch (err) {
      console.warn('Lỗi khi đọc meter-breaks qua IPC:', err);
    }
  }

  try {
    const raw = localStorage.getItem(MB_LOCALSTORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        window.meterBreaksStore = {
          version: 1,
          months: (parsed.months && typeof parsed.months === 'object') ? parsed.months : {}
        };
        return window.meterBreaksStore;
      }
    }
  } catch (e) { }

  window.meterBreaksStore = { version: 1, months: {} };
  return window.meterBreaksStore;
}

/**
 * Lấy bản ghi Break của 1 phòng trong tháng
 * @param {string} monthKey
 * @param {string} phong
 */
function getRoomMeterBreakRecord(monthKey, phong) {
  if (!monthKey || !phong || !window.meterBreaksStore || !window.meterBreaksStore.months) {
    return null;
  }
  const monthEntry = window.meterBreaksStore.months[monthKey];
  if (!monthEntry || typeof monthEntry !== 'object') return null;
  return monthEntry[phong] || null;
}

/**
 * Lưu 1 phòng vào meter-breaks.json (hoặc xóa nếu cả elec & water đều null)
 * @param {string} monthKey
 * @param {string} phong
 * @param {any} roomData
 */
async function persistRoomMeterBreak(monthKey, phong, roomData) {
  if (!window.meterBreaksStore) window.meterBreaksStore = { version: 1, months: {} };
  if (!window.meterBreaksStore.months) window.meterBreaksStore.months = {};
  if (!window.meterBreaksStore.months[monthKey]) window.meterBreaksStore.months[monthKey] = {};

  const hasAny = Boolean(roomData && (roomData.elec || roomData.water));
  if (hasAny) {
    const clean = {};
    if (roomData.elec) clean.elec = roomData.elec;
    if (roomData.water) clean.water = roomData.water;
    window.meterBreaksStore.months[monthKey][phong] = clean;
  } else {
    delete window.meterBreaksStore.months[monthKey][phong];
    if (Object.keys(window.meterBreaksStore.months[monthKey]).length === 0) {
      delete window.meterBreaksStore.months[monthKey];
    }
  }

  if (window.api && typeof window.api.saveRoomMeterBreak === 'function') {
    const res = await window.api.saveRoomMeterBreak({
      monthKey,
      phong,
      roomData: hasAny ? window.meterBreaksStore.months[monthKey][phong] : null
    });
    if (res && res.error) {
      throw new Error(res.error);
    }
    if (res && res.data && typeof res.data === 'object') {
      window.meterBreaksStore = res.data;
    }
    return true;
  }

  try {
    localStorage.setItem(MB_LOCALSTORAGE_KEY, JSON.stringify(window.meterBreaksStore));
  } catch (e) { }
  return true;
}

/**
 * Kiểm tra xung đột với Thay đổi đồng hồ trong cùng tháng/phòng (Phương án 1: không dùng chung)
 * @param {string} monthKey
 * @param {string} phong
 */
function getMbConflictWithMeterChange(monthKey, phong) {
  const mcRec = typeof getRoomMeterChangeRecord === 'function'
    ? getRoomMeterChangeRecord(monthKey, phong)
    : null;
  return {
    elec: Boolean(mcRec && mcRec.elec),
    water: Boolean(mcRec && mcRec.water)
  };
}

/**
 * Đọc danh sách 12 phòng cho Bước 1 Modal Break từ bảng chính
 */
function getRoomsForMeterBreakModal() {
  const monthKey = getMbTargetMonthKey();
  const baseList = (typeof roomsData !== 'undefined' && Array.isArray(roomsData) && roomsData.length > 0)
    ? roomsData
    : MB_FALLBACK_ROOMS.map(phong => ({ phong }));

  return baseList.map(r => {
    const phong = String(r.phong || '');
    const savedRec = getRoomMeterBreakRecord(monthKey, phong);
    const conflict = getMbConflictWithMeterChange(monthKey, phong);

    const hasPrevElec = Boolean(r.hadOriginalPrevDien !== undefined ? r.hadOriginalPrevDien : r.isDienCuLocked);
    const hasPrevWater = Boolean(r.hadOriginalPrevNuoc !== undefined ? r.hadOriginalPrevNuoc : r.isNuocCuLocked);

    const rawOrigElec = (r.originalPrevDien !== undefined && r.originalPrevDien !== null && r.originalPrevDien !== '')
      ? Number(r.originalPrevDien)
      : ((!r.hasMbElec && r.dienCu !== '' && r.dienCu !== null && r.dienCu !== undefined)
        ? Number(r.dienCu)
        : (savedRec?.elec?.initialIndex !== undefined && savedRec?.elec?.initialIndex !== null ? Number(savedRec.elec.initialIndex) : null));

    const rawOrigWater = (r.originalPrevNuoc !== undefined && r.originalPrevNuoc !== null && r.originalPrevNuoc !== '')
      ? Number(r.originalPrevNuoc)
      : ((!r.hasMbWater && r.nuocCu !== '' && r.nuocCu !== null && r.nuocCu !== undefined)
        ? Number(r.nuocCu)
        : (savedRec?.water?.initialIndex !== undefined && savedRec?.water?.initialIndex !== null ? Number(savedRec.water.initialIndex) : null));

    const tableElecEnd = (r.dienMoi !== '' && r.dienMoi !== null && r.dienMoi !== undefined && !isNaN(Number(r.dienMoi)))
      ? Number(r.dienMoi)
      : null;
    const tableWaterEnd = (r.nuocMoi !== '' && r.nuocMoi !== null && r.nuocMoi !== undefined && !isNaN(Number(r.nuocMoi)))
      ? Number(r.nuocMoi)
      : null;

    return {
      phong,
      hasPrevElec,
      hasPrevWater,
      prevElec: rawOrigElec !== null && !isNaN(Number(rawOrigElec)) ? Number(rawOrigElec) : null,
      prevWater: rawOrigWater !== null && !isNaN(Number(rawOrigWater)) ? Number(rawOrigWater) : null,
      tableElecEnd,
      tableWaterEnd,
      tableConfirmedElecRollover: Boolean(r.confirmedRollover),
      savedElec: savedRec && savedRec.elec ? savedRec.elec : null,
      savedWater: savedRec && savedRec.water ? savedRec.water : null,
      conflictElec: conflict.elec,
      conflictWater: conflict.water
    };
  });
}

function buildInitialBreakTypeState(room, type) {
  const saved = type === 'elec' ? room.savedElec : room.savedWater;
  const hasPrevData = type === 'elec' ? room.hasPrevElec : room.hasPrevWater;
  const digits = getMbRoomMeterDigits(room.phong, type);
  const prevValRaw = type === 'elec' ? room.prevElec : room.prevWater;
  const initialFromTable = prevValRaw !== null && prevValRaw !== undefined ? String(Math.max(0, Math.floor(prevValRaw))) : '';
  const tableRoll = type === 'elec' ? Boolean(room.tableConfirmedElecRollover) : false;

  if (saved && typeof saved === 'object') {
    const firstStart = hasPrevData
      ? initialFromTable
      : (saved.initialIndex !== undefined && saved.initialIndex !== null && saved.initialIndex !== ''
        ? String(saved.initialIndex)
        : initialFromTable);

    return {
      existsSaved: true,
      hasPrevData,
      manualInitUnlocked: !hasPrevData && Boolean(saved.isInitialManual || firstStart !== ''),
      digits: (Number(saved.digits) >= 3 && Number(saved.digits) <= 7) ? Number(saved.digits) : digits,
      date: saved.date || '',
      start: firstStart,
      breakEnd: (saved.breakEnd !== undefined && saved.breakEnd !== null) ? String(saved.breakEnd) : '',
      breakStart: (saved.breakStart !== undefined && saved.breakStart !== null) ? String(saved.breakStart) : '',
      confirmedEndRollover: Boolean(saved.confirmedEndRollover),
      confirmedStartRollover: Boolean(saved.confirmedStartRollover),
      confirmedTableEndRollover: Boolean(saved.confirmedTableEndRollover || tableRoll)
    };
  }

  return {
    existsSaved: false,
    hasPrevData,
    manualInitUnlocked: false,
    digits,
    date: '',
    start: initialFromTable,
    breakEnd: '',
    breakStart: '',
    confirmedEndRollover: false,
    confirmedStartRollover: false,
    confirmedTableEndRollover: tableRoll
  };
}

/* ============================================================================
   MỞ / ĐÓNG MODAL BREAK CHỈ SỐ & XỬ LÝ XUNG ĐỘT THAY ĐỔI ĐỒNG HỒ
   ============================================================================ */

function syncMbStep1ConflictCheckboxes(room, preselectType) {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const lblElec = document.getElementById('mb-lbl-elec');
  const lblWater = document.getElementById('mb-lbl-water');
  const confElecEl = document.getElementById('mb-conflict-elec');
  const confWaterEl = document.getElementById('mb-conflict-water');

  const conflictElec = Boolean(room && room.conflictElec);
  const conflictWater = Boolean(room && room.conflictWater);

  if (chkElec) chkElec.disabled = conflictElec;
  if (chkWater) chkWater.disabled = conflictWater;
  if (lblElec) lblElec.classList.toggle('conflict-disabled', conflictElec);
  if (lblWater) lblWater.classList.toggle('conflict-disabled', conflictWater);
  if (confElecEl) confElecEl.style.display = conflictElec ? 'inline' : 'none';
  if (confWaterEl) confWaterEl.style.display = conflictWater ? 'inline' : 'none';

  let wantElec = true;
  let wantWater = false;

  if (room && (room.savedElec || room.savedWater)) {
    wantElec = Boolean(room.savedElec) && !conflictElec;
    wantWater = Boolean(room.savedWater) && !conflictWater;
    if (preselectType === 'elec' && !conflictElec) wantElec = true;
    if (preselectType === 'water' && !conflictWater) wantWater = true;
  } else if (preselectType === 'water' && !conflictWater) {
    wantElec = false;
    wantWater = true;
  } else {
    if (conflictElec && !conflictWater) {
      wantElec = false;
      wantWater = true;
    } else if (conflictElec && conflictWater) {
      wantElec = false;
      wantWater = false;
    }
  }

  if (chkElec) chkElec.checked = wantElec;
  if (chkWater) chkWater.checked = wantWater;
  if (lblElec) lblElec.classList.toggle('checked', wantElec);
  if (lblWater) lblWater.classList.toggle('checked', wantWater);
}

/**
 * Mở Modal Break chỉ số (nếu truyền preselectPhong từ bảng chính -> mở thẳng Bước 2)
 * @param {string} [preselectPhong]
 * @param {'elec' | 'water'} [preselectType]
 */
function openMeterBreakModal(preselectPhong, preselectType) {
  const modal = document.getElementById('meter-break-modal');
  if (!modal) return;

  mbActiveMonthKey = null;
  mbIsRecordLocked = false;
  mbIsRecordEditing = false;
  mbRecordBackupState = null;
  mbStagedDeletes = { elec: false, water: false };
  mbRoomsSnapshot = getRoomsForMeterBreakModal();
  mbSelectedRoom = null;
  mbCurrentStep = 1;
  mbIsTransitioning = false;
  mbSuppressBlurUntil = 0;
  mbMissingPrevAutoPrompted = { elec: false, water: false };

  const monthPill = document.getElementById('mb-current-month-label');
  if (monthPill) monthPill.textContent = formatMbMonthLabel(getMbTargetMonthKey());

  const p1 = document.getElementById('mb-page1');
  const p2 = document.getElementById('mb-page2');
  if (p1 && p2) {
    p1.className = 'mb-page active';
    p2.className = 'mb-page';
  }
  const stepBadge = document.getElementById('mb-step-badge');
  if (stepBadge) stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';

  if (preselectPhong) {
    const matched = mbRoomsSnapshot.find(r => r.phong === preselectPhong);
    if (matched) {
      mbSelectedRoom = matched;
    }
  }

  syncMbStep1ConflictCheckboxes(mbSelectedRoom, preselectType);
  renderMeterBreakRoomGrid();
  renderMeterBreakHistoryList();
  validateMeterBreakStep1();

  modal.style.display = 'flex';

  if (mbSelectedRoom && preselectPhong) {
    mbCurrentStep = 2;
    if (p1 && p2) {
      p1.classList.remove('active');
      p2.classList.add('active');
    }
    if (stepBadge) stepBadge.textContent = 'Bước 2/2: Nhập chỉ số Break';
    initMeterBreakStep2State();
    prepareMbStep2LockMode();
    renderMeterBreakStep2Form();
    maybePromptMbMissingPrevOnEnter();
  }
}

function createMbStep2Backup() {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  mbRecordBackupState = {
    monthKey: getMbTargetMonthKey(),
    phong: mbSelectedRoom ? mbSelectedRoom.phong : '',
    selectedRoom: cloneMbJson(mbSelectedRoom),
    mbState: cloneMbJson(mbState),
    chkElec: Boolean(chkElec && chkElec.checked),
    chkWater: Boolean(chkWater && chkWater.checked),
    stagedDeletes: cloneMbJson(mbStagedDeletes)
  };
}

function restoreMbStep2FromBackup(silent = false) {
  if (!mbRecordBackupState) return;
  const bak = mbRecordBackupState;
  mbSelectedRoom = cloneMbJson(bak.selectedRoom);
  mbState = cloneMbJson(bak.mbState);
  mbStagedDeletes = cloneMbJson(bak.stagedDeletes || { elec: false, water: false });

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const lblElec = document.getElementById('mb-lbl-elec');
  const lblWater = document.getElementById('mb-lbl-water');
  if (chkElec) chkElec.checked = Boolean(bak.chkElec);
  if (chkWater) chkWater.checked = Boolean(bak.chkWater);
  if (lblElec) lblElec.classList.toggle('checked', Boolean(bak.chkElec));
  if (lblWater) lblWater.classList.toggle('checked', Boolean(bak.chkWater));

  mbIsRecordLocked = Boolean(mbSelectedRoom && (mbSelectedRoom.savedElec || mbSelectedRoom.savedWater));
  mbIsRecordEditing = false;
  mbRecordBackupState = null;

  if (!silent) {
    renderMeterBreakStep2Form();
  }
}

function prepareMbStep2LockMode() {
  mbStagedDeletes = { elec: false, water: false };
  if (!mbSelectedRoom) {
    mbIsRecordLocked = false;
    mbIsRecordEditing = false;
    mbRecordBackupState = null;
    return;
  }

  const hasSavedAny = Boolean(mbSelectedRoom.savedElec || mbSelectedRoom.savedWater);
  if (!hasSavedAny) {
    mbIsRecordLocked = false;
    mbIsRecordEditing = false;
    mbRecordBackupState = null;
    return;
  }

  const monthLocked = isMbMonthLocked(getMbTargetMonthKey());
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const wantElec = Boolean(chkElec && chkElec.checked);
  const wantWater = Boolean(chkWater && chkWater.checked);
  const addedNewUnsavedType = !monthLocked && ((wantElec && !mbSelectedRoom.savedElec) || (wantWater && !mbSelectedRoom.savedWater));

  if (addedNewUnsavedType) {
    mbRecordBackupState = {
      monthKey: getMbTargetMonthKey(),
      phong: mbSelectedRoom.phong,
      selectedRoom: cloneMbJson(mbSelectedRoom),
      mbState: {
        elec: buildInitialBreakTypeState(mbSelectedRoom, 'elec'),
        water: buildInitialBreakTypeState(mbSelectedRoom, 'water')
      },
      chkElec: Boolean(mbSelectedRoom.savedElec),
      chkWater: Boolean(mbSelectedRoom.savedWater),
      stagedDeletes: { elec: false, water: false }
    };
    mbIsRecordLocked = true;
    mbIsRecordEditing = true;
  } else {
    mbIsRecordLocked = true;
    mbIsRecordEditing = false;
    mbRecordBackupState = null;
  }
}

function closeMeterBreakModal() {
  if (mbIsRecordEditing && mbRecordBackupState) {
    restoreMbStep2FromBackup(true);
  }
  closeMbUnlockEditModal();
  closeMbMissingPrevModal();
  closeMbRolloverModalUI();

  const modal = document.getElementById('meter-break-modal');
  if (!modal) return;
  if (mbTransitionTimer) {
    clearTimeout(mbTransitionTimer);
    mbTransitionTimer = null;
  }
  mbIsTransitioning = false;
  mbActiveMonthKey = null;
  mbIsRecordLocked = false;
  mbIsRecordEditing = false;
  mbRecordBackupState = null;
  mbStagedDeletes = { elec: false, water: false };
  modal.style.display = 'none';
}

function handleMbStep2Back() {
  if (mbIsTransitioning) return;
  if (mbIsRecordEditing && mbRecordBackupState) {
    restoreMbStep2FromBackup(true);
    if (typeof showToast === 'function') {
      showToast('Đã hủy thay đổi Break chưa lưu và giữ nguyên dữ liệu cũ.', 'info');
    }
  }
  closeMbUnlockEditModal();

  const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || MB_FIRST_SYSTEM_MONTH);
  const wasOtherMonth = Boolean(mbActiveMonthKey && mbActiveMonthKey !== loadedMonth);
  const prevSelectedPhong = (!wasOtherMonth && mbSelectedRoom) ? mbSelectedRoom.phong : '';

  mbActiveMonthKey = null;
  mbIsRecordLocked = false;
  mbIsRecordEditing = false;
  mbRecordBackupState = null;
  mbStagedDeletes = { elec: false, water: false };
  mbRoomsSnapshot = getRoomsForMeterBreakModal();
  mbSelectedRoom = prevSelectedPhong
    ? (mbRoomsSnapshot.find(r => r.phong === prevSelectedPhong) || null)
    : null;

  syncMbStep1ConflictCheckboxes(mbSelectedRoom);
  renderMeterBreakRoomGrid();
  renderMeterBreakHistoryList();
  validateMeterBreakStep1();
  goToMeterBreakStep(1, -1);
}

function handleToggleEditMbRecordClick() {
  if (!mbSelectedRoom || isMbMonthLocked(getMbTargetMonthKey())) return;
  if (!mbIsRecordEditing) {
    openMbUnlockEditModal();
    return;
  }
  restoreMbStep2FromBackup(false);
  if (typeof showToast === 'function') {
    showToast('Đã hủy thay đổi và khôi phục dữ liệu Break đã khóa.', 'info');
  }
}

function openMbUnlockEditModal() {
  if (!mbSelectedRoom) return;
  const subEl = document.getElementById('mb-unlock-edit-subtitle');
  if (subEl) {
    subEl.textContent = `Phòng ${mbSelectedRoom.phong} • ${formatMbMonthLabel(getMbTargetMonthKey())}`;
  }
  const modal = document.getElementById('mb-unlock-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMbUnlockEditModal() {
  const modal = document.getElementById('mb-unlock-edit-modal');
  if (modal) modal.style.display = 'none';
}

function confirmUnlockMbRecordForEditing() {
  closeMbUnlockEditModal();
  if (!mbSelectedRoom || isMbMonthLocked(getMbTargetMonthKey())) return;
  createMbStep2Backup();
  mbIsRecordLocked = true;
  mbIsRecordEditing = true;
  renderMeterBreakStep2Form();
}

/* ============================================================================
   MỤC 3 TRÊN TRANG 1: LỊCH SỬ CÁC THÁNG ĐÃ BREAK
   ============================================================================ */

function buildBreakHistoryCardLinesForRoom(rec) {
  if (!rec || typeof rec !== 'object') return [];
  /** @type {string[]} */
  const lines = [];

  const appendType = (typeRec, type) => {
    if (!typeRec || typeof typeRec !== 'object') return;
    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    const dateVN = (typeof formatMcDateVN === 'function' && typeRec.date) ? formatMcDateVN(typeRec.date) : (typeRec.date || '');
    const datePart = dateVN ? ` (${dateVN})` : '';
    const initStr = (typeRec.initialIndex !== null && typeRec.initialIndex !== undefined && typeRec.initialIndex !== '')
      ? formatMbNumber(Number(typeRec.initialIndex))
      : '?';
    const endStr = (typeRec.breakEnd !== null && typeRec.breakEnd !== undefined) ? formatMbNumber(Number(typeRec.breakEnd)) : '?';
    const startStr = (typeRec.breakStart !== null && typeRec.breakStart !== undefined) ? formatMbNumber(Number(typeRec.breakStart)) : '?';
    const roll1 = typeRec.confirmedEndRollover ? ' [quay vòng]' : '';
    const roll2 = typeRec.confirmedStartRollover ? ' [quay vòng]' : '';
    lines.push(`(*) Break ĐH ${typeLabel}${datePart}: Đầu kỳ ${initStr} → Break kết thúc ${endStr}${roll1} | Break bắt đầu ${startStr}${roll2}`);
  };

  appendType(rec.elec, 'elec');
  appendType(rec.water, 'water');
  return lines;
}

function renderMeterBreakHistoryList() {
  const container = document.getElementById('mb-history-list');
  if (!container) return;

  const storeMonths = (window.meterBreaksStore && window.meterBreaksStore.months) || {};
  const monthKeys = Object.keys(storeMonths)
    .filter(mk => {
      const mEntry = storeMonths[mk];
      if (!mEntry || typeof mEntry !== 'object') return false;
      return Object.keys(mEntry).some(p => mEntry[p] && (mEntry[p].elec || mEntry[p].water));
    })
    .sort((a, b) => b.localeCompare(a));

  if (monthKeys.length === 0) {
    container.innerHTML = '<div class="mb-history-empty">Chưa có tháng nào ghi nhận Break chỉ số Điện / Nước.</div>';
    return;
  }

  container.innerHTML = '';
  monthKeys.forEach(mk => {
    const mEntry = storeMonths[mk];
    const roomNames = [
      ...MB_FALLBACK_ROOMS.filter(p => mEntry[p] && (mEntry[p].elec || mEntry[p].water)),
      ...Object.keys(mEntry).filter(p => !MB_FALLBACK_ROOMS.includes(p) && mEntry[p] && (mEntry[p].elec || mEntry[p].water))
    ];
    if (roomNames.length === 0) return;

    const monthLocked = isMbMonthLocked(mk);
    const groupEl = document.createElement('div');
    groupEl.className = 'mb-history-month-group';
    groupEl.setAttribute('data-month-key', mk);

    const headerEl = document.createElement('div');
    headerEl.className = 'mb-history-month-header';
    headerEl.innerHTML = `
      <span class="mb-history-month-tag">📅 ${escapeMbAttr(formatMbMonthLabel(mk))}</span>
      <span class="mb-history-lock-chip ${monthLocked ? '' : 'editable'}">${monthLocked ? '🔒 Đã xuất (Chỉ xem)' : '🟢 Chưa khóa / Đang sửa'}</span>
    `;
    groupEl.appendChild(headerEl);

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'mb-history-month-cards';

    roomNames.forEach(phong => {
      const rec = mEntry[phong];
      const noteLines = buildBreakHistoryCardLinesForRoom(rec);

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = 'mb-history-card';
      cardBtn.setAttribute('data-month-key', mk);
      cardBtn.setAttribute('data-phong', phong);
      cardBtn.onclick = () => openMeterBreakHistoryCard(mk, phong);

      const linesHtml = noteLines
        .map(line => `<div class="mb-history-line">${escapeMbAttr(line)}</div>`)
        .join('');

      cardBtn.innerHTML = `
        <div class="mb-history-card-head">
          <div class="mb-history-room-left">
            <span class="mb-history-room-name">🏠 Phòng ${escapeMbAttr(phong)}</span>
            <span class="mb-history-status-pill">✂️ Đã Break</span>
          </div>
          <span class="mb-history-open-cue">Xem chi tiết ➔</span>
        </div>
        <div class="mb-history-lines">${linesHtml}</div>
      `;
      cardsWrap.appendChild(cardBtn);
    });

    groupEl.appendChild(cardsWrap);
    container.appendChild(groupEl);
  });
}

async function buildBreakRoomSnapshotForMonth(monthKey, phong) {
  const curMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || MB_FIRST_SYSTEM_MONTH);

  if (monthKey === curMonth) {
    mbRoomsSnapshot = getRoomsForMeterBreakModal();
    return mbRoomsSnapshot.find(r => r.phong === phong) || null;
  }

  const savedRec = getRoomMeterBreakRecord(monthKey, phong);
  const conflict = getMbConflictWithMeterChange(monthKey, phong);
  const prevMonth = getMbPrevMonthKey(monthKey);
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
      console.warn('Không thể đọc history tháng khi mở thẻ Break:', err);
    }
  }

  const hasPrevElec = Boolean(prevRoom && prevRoom.dienMoi !== '' && prevRoom.dienMoi !== null && prevRoom.dienMoi !== undefined);
  const hasPrevWater = Boolean(prevRoom && prevRoom.nuocMoi !== '' && prevRoom.nuocMoi !== null && prevRoom.nuocMoi !== undefined);

  const prevElec = hasPrevElec
    ? Number(prevRoom.dienMoi)
    : (savedRec?.elec?.initialIndex !== undefined && savedRec?.elec?.initialIndex !== null
      ? Number(savedRec.elec.initialIndex)
      : (currRoom && currRoom.dienCu !== '' && currRoom.dienCu !== null && currRoom.dienCu !== undefined ? Number(currRoom.dienCu) : null));

  const prevWater = hasPrevWater
    ? Number(prevRoom.nuocMoi)
    : (savedRec?.water?.initialIndex !== undefined && savedRec?.water?.initialIndex !== null
      ? Number(savedRec.water.initialIndex)
      : (currRoom && currRoom.nuocCu !== '' && currRoom.nuocCu !== null && currRoom.nuocCu !== undefined ? Number(currRoom.nuocCu) : null));

  const tableElecEnd = (currRoom && currRoom.dienMoi !== '' && currRoom.dienMoi !== null && currRoom.dienMoi !== undefined && !isNaN(Number(currRoom.dienMoi)))
    ? Number(currRoom.dienMoi)
    : null;
  const tableWaterEnd = (currRoom && currRoom.nuocMoi !== '' && currRoom.nuocMoi !== null && currRoom.nuocMoi !== undefined && !isNaN(Number(currRoom.nuocMoi)))
    ? Number(currRoom.nuocMoi)
    : null;

  return {
    phong,
    hasPrevElec,
    hasPrevWater,
    prevElec: prevElec !== null && !isNaN(Number(prevElec)) ? Number(prevElec) : null,
    prevWater: prevWater !== null && !isNaN(Number(prevWater)) ? Number(prevWater) : null,
    tableElecEnd,
    tableWaterEnd,
    tableConfirmedElecRollover: Boolean(currRoom && currRoom.confirmedRollover),
    savedElec: savedRec && savedRec.elec ? savedRec.elec : null,
    savedWater: savedRec && savedRec.water ? savedRec.water : null,
    conflictElec: conflict.elec,
    conflictWater: conflict.water
  };
}

async function openMeterBreakHistoryCard(monthKey, phong) {
  if (mbIsTransitioning) return;
  const targetRoom = await buildBreakRoomSnapshotForMonth(monthKey, phong);
  if (!targetRoom) return;

  mbActiveMonthKey = monthKey;
  mbSelectedRoom = targetRoom;
  syncMbStep1ConflictCheckboxes(targetRoom);

  if (mbCurrentStep === 2) {
    mbMissingPrevAutoPrompted = { elec: false, water: false };
    initMeterBreakStep2State();
    prepareMbStep2LockMode();
    renderMeterBreakStep2Form();
    return;
  }

  goToMeterBreakStep(2, 1);
}

/* ============================================================================
   CHỌN PHÒNG, CHỌN LOẠI & CHUYỂN TRANG BƯỚC 1 <-> BƯỚC 2
   ============================================================================ */

function selectMbRoomCard(room, roomGrid, card) {
  roomGrid.querySelectorAll('.mb-room-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-checked', 'false');
  });
  card.classList.add('selected');
  card.setAttribute('aria-checked', 'true');
  mbSelectedRoom = room;

  syncMbStep1ConflictCheckboxes(room);
  validateMeterBreakStep1();
}

function renderMeterBreakRoomGrid() {
  const roomGrid = document.getElementById('mb-room-grid');
  if (!roomGrid) return;

  roomGrid.innerHTML = '';
  mbRoomsSnapshot.forEach(room => {
    const card = document.createElement('div');
    const isSelected = Boolean(mbSelectedRoom && mbSelectedRoom.phong === room.phong);
    card.className = `mb-room-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    card.tabIndex = 0;

    let statusClass = '';
    let statusText = '';
    if (room.hasPrevElec && room.hasPrevWater) {
      statusText = `Đ: ${formatMbNumber(room.prevElec)} | N: ${formatMbNumber(room.prevWater)}`;
    } else if (!room.hasPrevElec && !room.hasPrevWater) {
      statusClass = 'new';
      statusText = 'Chưa có dữ liệu cũ';
    } else {
      statusClass = 'partial';
      const eText = room.hasPrevElec ? `Đ: ${formatMbNumber(room.prevElec)}` : 'Đ: chưa cũ';
      const wText = room.hasPrevWater ? `N: ${formatMbNumber(room.prevWater)}` : 'N: chưa cũ';
      statusText = `${eText} | ${wText}`;
    }

    let pillHtml = '';
    if (room.savedElec || room.savedWater) {
      const tags = [];
      if (room.savedElec) tags.push('Điện');
      if (room.savedWater) tags.push('Nước');
      pillHtml = `<div class="mb-r-pill">✂️ Đã Break (${tags.join(' & ')})</div>`;
    } else if (room.conflictElec || room.conflictWater) {
      pillHtml = `<div class="mb-r-pill">🔄 Đang Thay ĐH</div>`;
    }

    card.innerHTML = `
      <div class="mb-r-name">Phòng ${escapeMbAttr(room.phong)}</div>
      <div class="mb-r-status ${statusClass}">${statusText}</div>
      ${pillHtml}
    `;

    card.onclick = () => selectMbRoomCard(room, roomGrid, card);
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMbRoomCard(room, roomGrid, card);
      }
    };

    roomGrid.appendChild(card);
  });
}

function toggleMeterBreakType(labelId, checkbox) {
  if (checkbox && checkbox.disabled) {
    checkbox.checked = false;
    return;
  }
  const lbl = document.getElementById(labelId);
  if (lbl) lbl.classList.toggle('checked', Boolean(checkbox && checkbox.checked));
  validateMeterBreakStep1();
}

function validateMeterBreakStep1() {
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const btnNext = /** @type {HTMLButtonElement | null} */ (document.getElementById('mb-btn-next'));
  const hasType = Boolean((chkElec && chkElec.checked && !chkElec.disabled) || (chkWater && chkWater.checked && !chkWater.disabled));
  if (btnNext) {
    btnNext.disabled = !(mbSelectedRoom && hasType);
  }
}

function initMeterBreakStep2State() {
  if (!mbSelectedRoom) return;
  mbState = {
    elec: buildInitialBreakTypeState(mbSelectedRoom, 'elec'),
    water: buildInitialBreakTypeState(mbSelectedRoom, 'water')
  };
}

/**
 * Hiệu ứng chuyển tiếp push-in / push-out Bước 1 <-> Bước 2
 * @param {1 | 2} step
 * @param {1 | -1} dir
 */
function goToMeterBreakStep(step, dir) {
  if (mbIsTransitioning || step === mbCurrentStep) return;

  if (step === 2 && mbSelectedRoom) {
    const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
    const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
    if (chkElec && chkElec.checked && mbSelectedRoom.conflictElec) {
      chkElec.checked = false;
      if (typeof showToast === 'function') showToast('Phòng này đang dùng Thay đổi đồng hồ Điện trong tháng nên không thể Break Điện.', 'warning');
      validateMeterBreakStep1();
      return;
    }
    if (chkWater && chkWater.checked && mbSelectedRoom.conflictWater) {
      chkWater.checked = false;
      if (typeof showToast === 'function') showToast('Phòng này đang dùng Thay đổi đồng hồ Nước trong tháng nên không thể Break Nước.', 'warning');
      validateMeterBreakStep1();
      return;
    }
  }

  const p1 = document.getElementById('mb-page1');
  const p2 = document.getElementById('mb-page2');
  const viewport = document.getElementById('mb-viewport');
  const stepBadge = document.getElementById('mb-step-badge');
  if (!p1 || !p2 || !viewport) return;

  mbIsTransitioning = true;
  mbCurrentStep = step;
  viewport.style.setProperty('--dir', String(dir));

  const outEl = step === 2 ? p1 : p2;
  const inEl = step === 2 ? p2 : p1;

  if (step === 2) {
    mbMissingPrevAutoPrompted = { elec: false, water: false };
    initMeterBreakStep2State();
    prepareMbStep2LockMode();
    renderMeterBreakStep2Form();
    if (stepBadge) stepBadge.textContent = 'Bước 2/2: Nhập chỉ số Break';
  } else {
    renderMeterBreakHistoryList();
    if (stepBadge) stepBadge.textContent = 'Bước 1/2: Chọn phòng & loại';
  }

  outEl.classList.remove('active', 'page-in', 'page-out');
  inEl.classList.remove('active', 'page-in', 'page-out');

  void outEl.offsetWidth;
  outEl.classList.add('page-out');
  inEl.classList.add('page-in');

  mbTransitionTimer = setTimeout(() => {
    outEl.classList.remove('page-out');
    inEl.classList.remove('page-in');
    inEl.classList.add('active');
    mbIsTransitioning = false;
    mbTransitionTimer = null;

    if (step === 2) {
      maybePromptMbMissingPrevOnEnter();
    }
  }, 700);
}

function maybePromptMbMissingPrevOnEnter() {
  if (!mbSelectedRoom || isMbReadonlyMode()) return;
  const monthKey = getMbTargetMonthKey();
  if (monthKey <= MB_FIRST_SYSTEM_MONTH) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (needElec && mbState.elec && !mbState.elec.hasPrevData && !mbState.elec.manualInitUnlocked && mbState.elec.start === '' && !mbMissingPrevAutoPrompted.elec) {
    mbMissingPrevAutoPrompted.elec = true;
    openMbMissingPrevModal('elec');
    return;
  }
  if (needWater && mbState.water && !mbState.water.hasPrevData && !mbState.water.manualInitUnlocked && mbState.water.start === '' && !mbMissingPrevAutoPrompted.water) {
    mbMissingPrevAutoPrompted.water = true;
    openMbMissingPrevModal('water');
  }
}

/* ============================================================================
   RENDER & NHẬP LIỆU BƯỚC 2 (RÀNG BUỘC SỐ NGUYÊN + QUAY VÒNG)
   ============================================================================ */

function renderMeterBreakStep2Form() {
  if (!mbSelectedRoom) return;

  const monthKey = getMbTargetMonthKey();
  const monthLocked = isMbMonthLocked(monthKey);
  const readonlyMode = isMbReadonlyMode();
  const hasSavedAny = Boolean(mbSelectedRoom.savedElec || mbSelectedRoom.savedWater);

  const lockedBanner = document.getElementById('mb-locked-banner');
  if (lockedBanner) {
    lockedBanner.style.display = monthLocked ? 'flex' : 'none';
  }

  const saveBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mb-btn-save'));
  if (saveBtn) {
    saveBtn.disabled = readonlyMode;
    saveBtn.style.display = readonlyMode ? 'none' : 'inline-flex';
  }

  const toggleEditBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mb-btn-toggle-edit'));
  if (toggleEditBtn) {
    if (!monthLocked && hasSavedAny) {
      toggleEditBtn.style.display = 'inline-flex';
      if (mbIsRecordEditing) {
        toggleEditBtn.className = 'btn btn-edit-month cancel-mode mb-btn-ui';
        toggleEditBtn.innerHTML = '✖️ Hủy thay đổi &amp; Giữ nguyên';
      } else {
        toggleEditBtn.className = 'btn btn-edit-month mb-btn-ui';
        toggleEditBtn.innerHTML = '✏️ Chỉnh Sửa';
      }
    } else {
      toggleEditBtn.style.display = 'none';
    }
  }

  const delAllBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mb-btn-delete-all'));
  if (delAllBtn) {
    delAllBtn.style.display = (hasSavedAny && !readonlyMode) ? 'inline-flex' : 'none';
  }

  const footerNote = document.getElementById('mb-left-footer-note');
  if (footerNote) {
    footerNote.textContent = (readonlyMode && !monthLocked && hasSavedAny)
      ? "Dữ liệu đã lưu & khóa. Bấm '✏️ Chỉnh Sửa' nếu muốn cập nhật."
      : 'Nhập số nguyên không âm (0–9): Break kết thúc ➔ Break bắt đầu.';
  }

  const titleEl = document.getElementById('mb-selected-room-title');
  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (titleEl) {
    let badgeText = '';
    let badgeCls = '';
    const checkElecMissing = needElec && !mbSelectedRoom.hasPrevElec;
    const checkWaterMissing = needWater && !mbSelectedRoom.hasPrevWater;

    if (!checkElecMissing && !checkWaterMissing) {
      badgeText = 'Đã có số đầu kỳ gốc';
      badgeCls = 'has-data';
    } else if (checkElecMissing && checkWaterMissing) {
      badgeText = 'Chưa có dữ liệu tháng trước';
      badgeCls = 'no-data';
    } else {
      badgeText = checkElecMissing ? 'Điện chưa có số tháng trước' : 'Nước chưa có số tháng trước';
      badgeCls = 'no-data';
    }

    const lockBadgeHtml = (!monthLocked && hasSavedAny)
      ? (mbIsRecordEditing
        ? '<span class="month-lock-badge editing">✏️ Đang mở chỉnh sửa</span>'
        : '<span class="month-lock-badge locked">🔒 Đã khóa dữ liệu</span>')
      : (monthLocked ? '<span class="month-lock-badge locked">🔒 Tháng đã khóa</span>' : '');
    const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
      ? currentLoadedMonth
      : (document.getElementById('month-year-select')?.value || '');
    const monthChipHtml = (monthKey && loadedMonth && monthKey !== loadedMonth)
      ? `<span class="mb-room-month-chip">📅 ${escapeMbAttr(formatMbMonthLabel(monthKey))}</span>`
      : '';

    titleEl.innerHTML = `
      <span>🏠 Phòng ${escapeMbAttr(mbSelectedRoom.phong)}</span>
      ${monthChipHtml}
      <span class="mb-room-prev-badge ${badgeCls}">${badgeText}</span>
      ${lockBadgeHtml}
    `;
  }

  const container = document.getElementById('mb-dynamic-form-area');
  if (!container) return;

  let html = '';
  if (needElec) {
    html += buildMeterBreakSectionHtml('elec', '⚡ Break đồng hồ Điện (kWh)');
  }
  if (needWater) {
    html += buildMeterBreakSectionHtml('water', '💧 Break đồng hồ Nước (m³)');
  }
  container.innerHTML = html;

  if (needElec) updateMeterBreakLiveSection('elec');
  if (needWater) updateMeterBreakLiveSection('water');
}

function buildMeterBreakSectionHtml(type, mainLabel) {
  const sec = mbState[type];
  if (!sec) return '';
  const readonlyMode = isMbReadonlyMode();
  const monthKey = getMbTargetMonthKey();
  const isFirstSystemMonth = monthKey <= MB_FIRST_SYSTEM_MONTH;
  const maxDigits = sec.digits || (type === 'elec' ? 5 : 4);

  let box1Attr = '';
  let box1Tooltip = '';
  let missingBangHtml = '';
  let box1OnClick = '';

  if (sec.hasPrevData) {
    box1Attr = 'readonly';
    box1Tooltip = 'Tự lấy theo chốt cuối tháng trước';
  } else if (isFirstSystemMonth) {
    box1Attr = readonlyMode ? 'readonly' : 'placeholder="Nhập số đầu"';
    box1Tooltip = 'Tháng đầu hệ thống: Nhập số nguyên đầu kỳ gốc';
  } else if (sec.manualInitUnlocked || sec.start !== '') {
    box1Attr = readonlyMode ? 'readonly' : 'placeholder="Nhập số đầu"';
    box1Tooltip = 'Đã mở nhập tay đầu kỳ gốc';
    missingBangHtml = `<button type="button" class="mb-missing-prev-btn" onmousedown="suppressMbBlurBriefly()" onclick="openMbMissingPrevModal('${type}')" title="Chưa có dữ liệu tháng trước">!</button>`;
  } else {
    box1Attr = 'readonly placeholder="Bấm !"';
    box1Tooltip = 'Chưa có dữ liệu tháng trước — bấm ! để chọn';
    missingBangHtml = `<button type="button" class="mb-missing-prev-btn" onmousedown="suppressMbBlurBriefly()" onclick="openMbMissingPrevModal('${type}')" title="Chưa có dữ liệu tháng trước">!</button>`;
    box1OnClick = `onclick="if(!isMbReadonlyMode()) openMbMissingPrevModal('${type}')"`;
  }

  const startValid = sec.start !== '' && /^\d+$/.test(String(sec.start));
  const endValid = sec.breakEnd !== '' && /^\d+$/.test(String(sec.breakEnd));

  const endDisabledAttr = (readonlyMode || !startValid) ? 'disabled' : '';
  const startDisabledAttr = (readonlyMode || !endValid) ? 'disabled' : '';

  const typeLabel = type === 'elec' ? 'Điện' : 'Nước';

  return `
    <div class="mb-section-card" id="mb-section-${type}">
      <div class="mb-section-card-head">
        <span class="mb-section-card-title">${mainLabel}</span>
        ${sec.existsSaved && !readonlyMode
      ? `<button type="button" class="mb-btn-remove-sec" onmousedown="suppressMbBlurBriefly()" onclick="handleDeleteSectionMeterBreak('${type}')">✕ Gỡ Break ${typeLabel}</button>`
      : ''}
      </div>

      <div class="mb-date-row">
        <label for="mb-${type}-date">Ngày Break (không bắt buộc):</label>
        <input type="date" id="mb-${type}-date" class="mb-date-input"
          value="${escapeMbAttr(sec.date || '')}"
          ${readonlyMode ? 'disabled' : ''}
          onchange="onMeterBreakDateInput('${type}', this.value)">
      </div>

      <div class="mb-three-boxes-row">
        <div class="mb-box-unit mb-box-1">
          <div class="mb-box-1-label-row">
            <label for="mb-${type}-start">Ô 1: Đầu kỳ gốc</label>
            ${missingBangHtml}
          </div>
          <input type="text" inputmode="numeric" maxlength="${maxDigits}"
            id="mb-${type}-start"
            value="${escapeMbAttr(sec.start)}"
            ${box1Attr}
            ${box1OnClick}
            onkeydown="return onMbIntKeyDown(event)"
            oninput="onMeterBreakNumInput('${type}', 'start', this)"
            title="${escapeMbAttr(box1Tooltip)}">
        </div>

        <div class="mb-box-unit mb-box-2">
          <label for="mb-${type}-breakEnd">Ô 2: Break kết thúc</label>
          <div class="mb-box-wrap">
            <input type="text" inputmode="numeric" maxlength="${maxDigits}"
              id="mb-${type}-breakEnd"
              value="${escapeMbAttr(sec.breakEnd)}"
              placeholder="Người cũ rời"
              ${endDisabledAttr}
              onkeydown="return onMbIntKeyDown(event)"
              oninput="onMeterBreakNumInput('${type}', 'breakEnd', this)"
              onblur="onMbBreakEndBlur('${type}')"
              title="Chỉ số lúc người cũ rời đi (lưu lịch sử)">
            <button type="button" class="mb-rollover-tag-btn" id="mb-${type}-end-rollover-tag"
              style="display:none;" onmousedown="suppressMbBlurBriefly()"
              onclick="openMbRolloverPopup('endRollover', '${type}')"
              title="Đã xác nhận quay vòng Ô 2 < Ô 1">!</button>
          </div>
        </div>

        <div class="mb-box-unit mb-box-3">
          <label for="mb-${type}-breakStart">Ô 3: Break bắt đầu</label>
          <div class="mb-box-wrap">
            <input type="text" inputmode="numeric" maxlength="${maxDigits}"
              id="mb-${type}-breakStart"
              value="${escapeMbAttr(sec.breakStart)}"
              placeholder="Người mới vào"
              ${startDisabledAttr}
              onkeydown="return onMbIntKeyDown(event)"
              oninput="onMeterBreakNumInput('${type}', 'breakStart', this)"
              onblur="onMbBreakStartBlur('${type}')"
              title="Chỉ số đầu mới (sẽ thay thế Số cũ tháng này & Phiếu Thu)">
            <button type="button" class="mb-rollover-tag-btn" id="mb-${type}-start-rollover-tag"
              style="display:none;" onmousedown="suppressMbBlurBriefly()"
              onclick="openMbRolloverPopup('startRollover', '${type}')"
              title="Đã xác nhận quay vòng Ô 3 < Ô 2">!</button>
          </div>
        </div>
      </div>

      <div class="mb-live-summary" id="mb-${type}-summary"></div>
    </div>
  `;
}

function onMbIntKeyDown(event) {
  if (!event) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter'];
  if (allowedKeys.includes(event.key)) return true;
  if (/^\d$/.test(event.key)) return true;
  event.preventDefault();
  return false;
}

function onMeterBreakDateInput(type, val) {
  if (isMbReadonlyMode() || !mbState[type]) return;
  mbState[type].date = val || '';
}

function onMeterBreakNumInput(type, field, inputEl) {
  if (isMbReadonlyMode() || !mbState[type]) return;
  const raw = String(inputEl.value || '').replace(/\D/g, '');
  if (inputEl.value !== raw) {
    inputEl.value = raw;
  }
  const sec = mbState[type];
  sec[field] = raw;

  if (field === 'start' || field === 'breakEnd') {
    const startNum = (sec.start !== '' && /^\d+$/.test(sec.start)) ? Number(sec.start) : null;
    const endNum = (sec.breakEnd !== '' && /^\d+$/.test(sec.breakEnd)) ? Number(sec.breakEnd) : null;
    if (startNum !== null && endNum !== null && endNum >= startNum) {
      sec.confirmedEndRollover = false;
    }
  }
  if (field === 'breakEnd' || field === 'breakStart') {
    const endNum = (sec.breakEnd !== '' && /^\d+$/.test(sec.breakEnd)) ? Number(sec.breakEnd) : null;
    const newStartNum = (sec.breakStart !== '' && /^\d+$/.test(sec.breakStart)) ? Number(sec.breakStart) : null;
    if (endNum !== null && newStartNum !== null && newStartNum >= endNum) {
      sec.confirmedStartRollover = false;
    }
    if (field === 'breakStart') {
      sec.confirmedTableEndRollover = false;
    }
  }

  // Cập nhật khóa tuần tự Ô 1 -> Ô 2 -> Ô 3
  const endEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mb-${type}-breakEnd`));
  const newStartEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mb-${type}-breakStart`));
  const startValid = sec.start !== '' && /^\d+$/.test(String(sec.start));
  const endValid = sec.breakEnd !== '' && /^\d+$/.test(String(sec.breakEnd));

  if (endEl) {
    endEl.disabled = !startValid;
    if (!startValid) {
      endEl.value = '';
      sec.breakEnd = '';
      sec.confirmedEndRollover = false;
    }
  }
  if (newStartEl) {
    newStartEl.disabled = !(startValid && endValid);
    if (!(startValid && endValid)) {
      newStartEl.value = '';
      sec.breakStart = '';
      sec.confirmedStartRollover = false;
    }
  }

  updateMeterBreakLiveSection(type);
}

function onMbBreakEndBlur(type) {
  if (isMbBlurSuppressed() || isMbReadonlyMode()) return;
  const sec = mbState[type];
  if (!sec) return;
  if (sec.start === '' || sec.breakEnd === '') return;
  const s = Number(sec.start);
  const e = Number(sec.breakEnd);
  if (e < s && !sec.confirmedEndRollover) {
    openMbRolloverPopup('endRollover', type);
  }
}

function onMbBreakStartBlur(type) {
  if (isMbBlurSuppressed() || isMbReadonlyMode()) return;
  const sec = mbState[type];
  if (!sec) return;
  if (sec.breakEnd === '' || sec.breakStart === '') return;
  const e = Number(sec.breakEnd);
  const bs = Number(sec.breakStart);
  if (bs < e && !sec.confirmedStartRollover) {
    openMbRolloverPopup('startRollover', type);
  }
}

/**
 * Đánh giá hợp lệ của một loại đồng hồ khi Break chỉ số.
 * @param {'elec' | 'water'} type
 * @returns {{ ok: boolean, errorMsg: string, needsRollover: { kind: 'endRollover' | 'startRollover' | 'tableEndRollover', type: 'elec' | 'water' } | null, firstErrorEl: HTMLElement | null }}
 */
function evaluateMeterBreakSection(type) {
  const sec = mbState[type];
  if (!sec) return { ok: false, errorMsg: 'Thiếu dữ liệu.', needsRollover: null, firstErrorEl: null };

  const startEl = document.getElementById(`mb-${type}-start`);
  const endEl = document.getElementById(`mb-${type}-breakEnd`);
  const bsEl = document.getElementById(`mb-${type}-breakStart`);

  const startValid = sec.start !== '' && /^\d+$/.test(String(sec.start));
  if (!startValid) {
    return {
      ok: false,
      errorMsg: 'Vui lòng nhập hoặc chọn Đầu kỳ gốc (Ô 1) hợp lệ!',
      needsRollover: null,
      firstErrorEl: startEl
    };
  }
  const endValid = sec.breakEnd !== '' && /^\d+$/.test(String(sec.breakEnd));
  if (!endValid) {
    return {
      ok: false,
      errorMsg: 'Vui lòng nhập Số Break kết thúc (Ô 2)!',
      needsRollover: null,
      firstErrorEl: endEl
    };
  }
  const bsValid = sec.breakStart !== '' && /^\d+$/.test(String(sec.breakStart));
  if (!bsValid) {
    return {
      ok: false,
      errorMsg: 'Vui lòng nhập Số Break bắt đầu (Ô 3)!',
      needsRollover: null,
      firstErrorEl: bsEl
    };
  }

  const startNum = Number(sec.start);
  const endNum = Number(sec.breakEnd);
  const bsNum = Number(sec.breakStart);

  if (endNum < startNum && !sec.confirmedEndRollover) {
    return {
      ok: false,
      errorMsg: 'Số Break kết thúc đang nhỏ hơn Đầu kỳ gốc (cần xác nhận quay vòng hoặc nhập lại)!',
      needsRollover: { kind: 'endRollover', type },
      firstErrorEl: endEl
    };
  }
  if (bsNum < endNum && !sec.confirmedStartRollover) {
    return {
      ok: false,
      errorMsg: 'Số Break bắt đầu đang nhỏ hơn Break kết thúc (cần xác nhận quay vòng hoặc nhập lại)!',
      needsRollover: { kind: 'startRollover', type },
      firstErrorEl: bsEl
    };
  }

  // Kiểm tra nếu ngoài bảng chính đã nhập sẵn Số mới mà Số mới < Break bắt đầu
  if (mbSelectedRoom) {
    const tableEnd = type === 'elec' ? mbSelectedRoom.tableElecEnd : mbSelectedRoom.tableWaterEnd;
    if (tableEnd !== null && tableEnd !== undefined && !isNaN(Number(tableEnd))) {
      const tableEndNum = Number(tableEnd);
      if (tableEndNum < bsNum && !sec.confirmedTableEndRollover) {
        return {
          ok: false,
          errorMsg: `Số mới đã nhập trên bảng (${tableEndNum}) đang nhỏ hơn Break bắt đầu (${bsNum})!`,
          needsRollover: { kind: 'tableEndRollover', type },
          firstErrorEl: bsEl
        };
      }
    }
  }

  return { ok: true, errorMsg: '', needsRollover: null, firstErrorEl: null };
}

function updateMeterBreakLiveSection(type) {
  const sec = mbState[type];
  if (!sec) return;

  const endRollBtn = document.getElementById(`mb-${type}-end-rollover-tag`);
  if (endRollBtn) {
    const isEndSmaller = sec.start !== '' && sec.breakEnd !== '' && Number(sec.breakEnd) < Number(sec.start);
    endRollBtn.style.display = (isEndSmaller && sec.confirmedEndRollover) ? 'inline-flex' : 'none';
  }

  const startRollBtn = document.getElementById(`mb-${type}-start-rollover-tag`);
  if (startRollBtn) {
    const isStartSmaller = sec.breakEnd !== '' && sec.breakStart !== '' && Number(sec.breakStart) < Number(sec.breakEnd);
    startRollBtn.style.display = (isStartSmaller && sec.confirmedStartRollover) ? 'inline-flex' : 'none';
  }

  const summaryEl = document.getElementById(`mb-${type}-summary`);
  if (!summaryEl) return;

  const unit = type === 'elec' ? 'kWh' : 'm³';
  const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
  const colLabel = type === 'elec' ? 'Điện Cũ' : 'Nước Cũ';

  if (sec.breakStart !== '' && /^\d+$/.test(String(sec.breakStart))) {
    const bsNum = Number(sec.breakStart);
    const oldEndTxt = (sec.breakEnd !== '' && /^\d+$/.test(String(sec.breakEnd))) ? sec.breakEnd : '?';
    let tableNote = '';
    if (mbSelectedRoom) {
      const tableEnd = type === 'elec' ? mbSelectedRoom.tableElecEnd : mbSelectedRoom.tableWaterEnd;
      if (tableEnd !== null && tableEnd !== undefined) {
        const limit = getMbMeterMaxLimit(sec.digits || (type === 'elec' ? 5 : 4));
        const used = tableEnd >= bsNum ? (tableEnd - bsNum) : ((limit + tableEnd) - bsNum);
        tableNote = `<br>• Đã có Số mới ngoài bảng = <strong>${formatMbNumber(tableEnd)}</strong> ➔ Tiêu thụ tạm tính lại = <strong>${formatMbNumber(used)} ${unit}</strong>`;
      }
    }
    summaryEl.innerHTML = `📌 Khi lưu: <strong>${colLabel}</strong> của tháng &amp; Phiếu Thu sẽ đổi thành <strong>${formatMbNumber(bsNum)}</strong> (lịch sử lưu Break kết thúc ${typeLabel}: <strong>${escapeMbAttr(oldEndTxt)}</strong>).${tableNote}`;
  } else {
    summaryEl.innerHTML = `💡 Nhập <strong>Break kết thúc</strong> (lưu lịch sử) và <strong>Break bắt đầu</strong> để làm <strong>${colLabel}</strong> mới.`;
  }
}

/* ============================================================================
   POPUP CON 1: XỬ LÝ THIẾU DỮ LIỆU THÁNG TRƯỚC (!)
   ============================================================================ */

function openMbMissingPrevModal(type) {
  if (!mbSelectedRoom || isMbReadonlyMode()) return;
  const monthKey = getMbTargetMonthKey();
  const prevMonthKey = getMbPrevMonthKey(monthKey);
  const labelType = type === 'elec' ? 'ĐIỆN' : 'NƯỚC';

  mbMissingPrevCtx = { type, monthKey, prevMonthKey };

  const sub = document.getElementById('mb-missing-prev-subtitle');
  const target = document.getElementById('mb-missing-prev-target');
  const prevMonthEl = document.getElementById('mb-missing-prev-month');
  const goBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('mb-btn-go-prev-month'));

  if (sub) sub.textContent = `Phòng ${mbSelectedRoom.phong} - chưa có số ${labelType.toLowerCase()} chốt tháng trước`;
  if (target) target.textContent = `Phòng ${mbSelectedRoom.phong} (${labelType})`;
  if (prevMonthEl) prevMonthEl.textContent = formatMbMonthLabel(prevMonthKey);
  if (goBtn) {
    goBtn.style.display = (monthKey <= MB_FIRST_SYSTEM_MONTH) ? 'none' : 'inline-flex';
  }

  const modal = document.getElementById('mb-missing-prev-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMbMissingPrevModal() {
  const modal = document.getElementById('mb-missing-prev-modal');
  if (modal) modal.style.display = 'none';
}

function confirmManualInitFromMb() {
  const ctx = mbMissingPrevCtx;
  mbMissingPrevCtx = null;
  closeMbMissingPrevModal();
  if (!ctx || !mbState[ctx.type]) return;

  mbState[ctx.type].manualInitUnlocked = true;
  renderMeterBreakStep2Form();

  const startEl = /** @type {HTMLInputElement | null} */ (document.getElementById(`mb-${ctx.type}-start`));
  if (startEl) {
    startEl.focus();
    startEl.select();
  }
}

async function confirmGoToPrevMonthFromMb() {
  const ctx = mbMissingPrevCtx;
  mbMissingPrevCtx = null;
  closeMbMissingPrevModal();
  if (!ctx || !ctx.prevMonthKey) return;

  closeMeterBreakModal();
  const sel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-year-select'));
  if (sel) {
    const hasOption = Array.from(sel.options).some(o => o.value === ctx.prevMonthKey);
    if (hasOption) {
      sel.value = ctx.prevMonthKey;
      if (typeof onMonthYearChange === 'function') {
        await onMonthYearChange();
      }
      if (typeof showToast === 'function') {
        showToast(`Đã chuyển về ${formatMbMonthLabel(ctx.prevMonthKey)} để bạn bổ sung số chốt tháng trước.`, 'info');
      }
    }
  }
}

/* ============================================================================
   POPUP CON 2: XÁC NHẬN ĐỒNG HỒ QUAY VÒNG KHI BREAK
   ============================================================================ */

/**
 * @param {'endRollover' | 'startRollover' | 'tableEndRollover'} kind
 * @param {'elec' | 'water'} type
 * @param {(() => void) | null} [onAfterConfirm]
 */
function openMbRolloverPopup(kind, type, onAfterConfirm = null) {
  const sec = mbState[type];
  if (!sec || !mbSelectedRoom) return;

  const unit = type === 'elec' ? 'kWh' : 'm³';
  const digits = sec.digits || getMbRoomMeterDigits(mbSelectedRoom.phong, type);
  const maxLimit = getMbMeterMaxLimit(digits);

  let fromLabel = 'Số mốc trước:';
  let toLabel = 'Số nhập mới:';
  let fromVal = 0;
  let toVal = 0;
  let descText = '';

  if (kind === 'endRollover') {
    fromLabel = 'Ô 1 (Đầu kỳ gốc):';
    toLabel = 'Ô 2 (Break kết thúc):';
    fromVal = Number(sec.start) || 0;
    toVal = Number(sec.breakEnd) || 0;
    descText = 'Số Break kết thúc đang nhỏ hơn Đầu kỳ gốc. Chỉ hợp lệ nếu đồng hồ đã quay hết một vòng rồi tiếp tục chạy.';
  } else if (kind === 'startRollover') {
    fromLabel = 'Ô 2 (Break kết thúc):';
    toLabel = 'Ô 3 (Break bắt đầu):';
    fromVal = Number(sec.breakEnd) || 0;
    toVal = Number(sec.breakStart) || 0;
    descText = 'Số Break bắt đầu đang nhỏ hơn Break kết thúc. Chỉ hợp lệ nếu đồng hồ vừa qua mốc quay vòng giữa 2 lần giao nhận.';
  } else {
    const tableEnd = type === 'elec' ? mbSelectedRoom.tableElecEnd : mbSelectedRoom.tableWaterEnd;
    fromLabel = 'Ô 3 (Break bắt đầu):';
    toLabel = 'Số mới đã nhập ngoài bảng:';
    fromVal = Number(sec.breakStart) || 0;
    toVal = Number(tableEnd) || 0;
    descText = 'Số chốt cuối tháng đã nhập sẵn ngoài bảng đang nhỏ hơn Break bắt đầu. Xác nhận đồng hồ đã quay vòng qua mốc tối đa?';
  }

  const diffUsed = (maxLimit + toVal) - fromVal;
  mbRolloverCtx = { kind, type, onAfterConfirm };

  const titleEl = document.getElementById('mb-rollover-title');
  const subEl = document.getElementById('mb-rollover-subtitle');
  const descEl = document.getElementById('mb-rollover-desc');
  const fLbl = document.getElementById('mb-rollover-from-label');
  const fVal = document.getElementById('mb-rollover-from-val');
  const tLbl = document.getElementById('mb-rollover-to-label');
  const tVal = document.getElementById('mb-rollover-to-val');
  const calcEl = document.getElementById('mb-rollover-calc-val');

  if (titleEl) titleEl.textContent = `Xác nhận quay vòng (${type === 'elec' ? '⚡ Điện' : '💧 Nước'} · ${digits} số)`;
  if (subEl) subEl.textContent = `Phòng ${mbSelectedRoom.phong} • Mốc quay vòng ${formatMbNumber(maxLimit)}`;
  if (descEl) descEl.textContent = descText;
  if (fLbl) fLbl.textContent = fromLabel;
  if (fVal) fVal.textContent = formatMbNumber(fromVal);
  if (tLbl) tLbl.textContent = toLabel;
  if (tVal) tVal.textContent = formatMbNumber(toVal);
  if (calcEl) calcEl.textContent = `${formatMbNumber(diffUsed)} ${unit}`;

  const modal = document.getElementById('mb-rollover-modal');
  if (modal) modal.style.display = 'flex';
}

function closeMbRolloverModalUI() {
  const modal = document.getElementById('mb-rollover-modal');
  if (modal) modal.style.display = 'none';
}

function cancelMbRolloverModal() {
  const ctx = mbRolloverCtx;
  mbRolloverCtx = null;
  closeMbRolloverModalUI();
  if (!ctx) return;

  const field = ctx.kind === 'endRollover' ? 'breakEnd' : 'breakStart';
  const el = /** @type {HTMLInputElement | null} */ (document.getElementById(`mb-${ctx.type}-${field}`));
  if (el) {
    el.focus();
    el.select();
  }
}

function confirmMbRolloverModal() {
  const ctx = mbRolloverCtx;
  mbRolloverCtx = null;
  closeMbRolloverModalUI();
  if (!ctx || !mbState[ctx.type]) return;

  if (ctx.kind === 'endRollover') {
    mbState[ctx.type].confirmedEndRollover = true;
  } else if (ctx.kind === 'startRollover') {
    mbState[ctx.type].confirmedStartRollover = true;
  } else if (ctx.kind === 'tableEndRollover') {
    mbState[ctx.type].confirmedTableEndRollover = true;
  }

  updateMeterBreakLiveSection(ctx.type);
  if (typeof ctx.onAfterConfirm === 'function') {
    ctx.onAfterConfirm();
  }
}

/* ============================================================================
   LƯU, GỠ & ĐỒNG BỘ XUỐNG BẢNG PHẦN 1 + ACTIVITY LOG
   ============================================================================ */

function serializeMbSectionForSave(type) {
  const sec = mbState[type];
  if (!sec || !mbSelectedRoom) return null;

  const firstStartRaw = String(sec.start || '').trim();
  const initialIndex = firstStartRaw !== '' && /^\d+$/.test(firstStartRaw) ? Number(firstStartRaw) : null;
  const breakEnd = (sec.breakEnd !== '' && /^\d+$/.test(String(sec.breakEnd))) ? Number(sec.breakEnd) : null;
  const breakStart = (sec.breakStart !== '' && /^\d+$/.test(String(sec.breakStart))) ? Number(sec.breakStart) : null;

  return {
    date: sec.date || '',
    initialIndex,
    isInitialManual: !sec.hasPrevData,
    breakEnd,
    breakStart,
    digits: sec.digits || getMbRoomMeterDigits(mbSelectedRoom.phong, type),
    confirmedEndRollover: Boolean(sec.confirmedEndRollover),
    confirmedStartRollover: Boolean(sec.confirmedStartRollover),
    confirmedTableEndRollover: Boolean(sec.confirmedTableEndRollover),
    updatedAt: new Date().toISOString()
  };
}

async function syncMeterBreakToMainTable(monthKey, phong) {
  const rec = getRoomMeterBreakRecord(monthKey, phong);
  const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth)
    ? currentLoadedMonth
    : (document.getElementById('month-year-select')?.value || '');

  if (monthKey === loadedMonth && typeof roomsData !== 'undefined' && Array.isArray(roomsData)) {
    const idx = roomsData.findIndex(r => r.phong === phong);
    if (idx !== -1) {
      const room = roomsData[idx];

      // Điện
      if (rec && rec.elec) {
        room.hasMbElec = true;
        room.mbElecDate = rec.elec.date || '';
        room.dienCu = Number(rec.elec.breakStart);
        room.isDienCuLocked = true;
        if (rec.elec.confirmedTableEndRollover) {
          room.confirmedRollover = true;
        } else if (room.dienMoi !== '' && room.dienMoi !== null && room.dienMoi !== undefined && Number(room.dienMoi) >= Number(rec.elec.breakStart)) {
          room.confirmedRollover = false;
        }
      } else if (room.hasMbElec) {
        room.hasMbElec = false;
        room.mbElecDate = '';
        room.dienCu = (room.originalPrevDien !== undefined && room.originalPrevDien !== null) ? room.originalPrevDien : '';
        room.isDienCuLocked = Boolean(room.hadOriginalPrevDien);
        if (room.dienMoi !== '' && room.dienMoi !== null && room.dienMoi !== undefined && Number(room.dienMoi) >= (Number(room.dienCu) || 0)) {
          room.confirmedRollover = false;
        }
      }

      // Nước
      if (rec && rec.water) {
        room.hasMbWater = true;
        room.mbWaterDate = rec.water.date || '';
        room.nuocCu = Number(rec.water.breakStart);
        room.isNuocCuLocked = true;
      } else if (room.hasMbWater) {
        room.hasMbWater = false;
        room.mbWaterDate = '';
        room.nuocCu = (room.originalPrevNuoc !== undefined && room.originalPrevNuoc !== null) ? room.originalPrevNuoc : '';
        room.isNuocCuLocked = Boolean(room.hadOriginalPrevNuoc);
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

  // Nếu sửa/gỡ Break của tháng khác (từ Mục 3) -> ghi trực tiếp vào history/YYYY-MM.json của đúng tháng đó
  if (typeof readHistoryFile === 'function' && typeof writeHistoryFile === 'function' && typeof extractHistoryPayload === 'function') {
    const prevMonth = getMbPrevMonthKey(monthKey);
    const [rawCurr, rawPrev] = await Promise.all([
      readHistoryFile(monthKey),
      prevMonth ? readHistoryFile(prevMonth) : Promise.resolve(null)
    ]);
    const payload = extractHistoryPayload(rawCurr);
    const prevPayload = extractHistoryPayload(rawPrev);
    const existingList = Array.isArray(payload.rooms) ? payload.rooms : [];
    const prevList = Array.isArray(prevPayload.rooms) ? prevPayload.rooms : [];
    const baseList = MB_FALLBACK_ROOMS.map(pName => {
      const found = existingList.find(item => item.phong === pName);
      return found ? { ...found } : { phong: pName, dienCu: '', dienMoi: '', nuocCu: '', nuocMoi: '', confirmedRollover: false, confirmedAnomaly: false };
    });
    const targetRoom = baseList.find(item => item.phong === phong);
    const prevRoom = prevList.find(item => item.phong === phong);
    if (targetRoom) {
      if (rec && rec.elec) {
        targetRoom.dienCu = Number(rec.elec.breakStart);
        if (rec.elec.confirmedTableEndRollover) targetRoom.confirmedRollover = true;
      } else {
        targetRoom.dienCu = (prevRoom && prevRoom.dienMoi !== '' && prevRoom.dienMoi !== null && prevRoom.dienMoi !== undefined)
          ? Number(prevRoom.dienMoi)
          : targetRoom.dienCu;
      }

      if (rec && rec.water) {
        targetRoom.nuocCu = Number(rec.water.breakStart);
      } else {
        targetRoom.nuocCu = (prevRoom && prevRoom.nuocMoi !== '' && prevRoom.nuocMoi !== null && prevRoom.nuocMoi !== undefined)
          ? Number(prevRoom.nuocMoi)
          : targetRoom.nuocCu;
      }

      const dataToSave = (rawCurr && !Array.isArray(rawCurr) && typeof rawCurr === 'object' && Array.isArray(rawCurr.rooms))
        ? { ...rawCurr, rooms: baseList }
        : baseList;
      await writeHistoryFile(monthKey, dataToSave);
    }
    if (typeof populateMonthSelect === 'function') {
      await populateMonthSelect();
    }
  }
}

/**
 * Tạo mảng metadata.changes (Trước -> Sau) và tóm tắt chi tiết (kèm nhãn [quay vòng]) cho Nhật Ký Hoạt Động.
 * @param {'elec' | 'water'} type
 * @param {any} prevSec
 * @param {any} nextSec
 * @returns {{ summaryPart: string, changes: Array<{ field: string, label: string, displayOld: string, displayNew: string }> }}
 */
function buildMbActivityLogDiff(type, prevSec, nextSec) {
  const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
  /** @type {Array<{ field: string, label: string, displayOld: string, displayNew: string }>} */
  const changes = [];
  const rollTag = (flag, label = '[quay vòng]') => (flag ? ` ${label}` : '');
  const fmtVal = (v) => (v !== null && v !== undefined && v !== '' ? String(v) : '-');

  if (prevSec && !nextSec) {
    const prevEndRoll = rollTag(prevSec.confirmedEndRollover);
    const prevStartRoll = rollTag(prevSec.confirmedStartRollover);
    changes.push({
      field: `mb_${type}_breakEnd`,
      label: `${typeLabel} — Break kết thúc (người cũ)`,
      displayOld: `${fmtVal(prevSec.breakEnd)}${prevEndRoll}`,
      displayNew: 'Đã gỡ'
    });
    changes.push({
      field: `mb_${type}_breakStart`,
      label: `${typeLabel} — Số cũ áp dụng tháng`,
      displayOld: `${fmtVal(prevSec.breakStart)}${prevStartRoll} (Break bắt đầu)`,
      displayNew: `${fmtVal(prevSec.initialIndex)} (Đầu kỳ gốc)`
    });
    return {
      summaryPart: `Đã gỡ Break ${typeLabel} (trả Số cũ về ${fmtVal(prevSec.initialIndex)})`,
      changes
    };
  }

  if (!prevSec && nextSec) {
    const endRoll = rollTag(nextSec.confirmedEndRollover);
    const startRoll = rollTag(nextSec.confirmedStartRollover);
    const tblRoll = rollTag(nextSec.confirmedTableEndRollover, '[quay vòng cuối tháng]');
    changes.push({
      field: `mb_${type}_initial`,
      label: `${typeLabel} — Đầu kỳ gốc`,
      displayOld: nextSec.initialIndex !== null && nextSec.initialIndex !== undefined ? String(nextSec.initialIndex) : 'Chưa có',
      displayNew: fmtVal(nextSec.initialIndex)
    });
    changes.push({
      field: `mb_${type}_breakEnd`,
      label: `${typeLabel} — Break kết thúc (người cũ)`,
      displayOld: 'Chưa có',
      displayNew: `${fmtVal(nextSec.breakEnd)}${endRoll}`
    });
    changes.push({
      field: `mb_${type}_breakStart`,
      label: `${typeLabel} — Break bắt đầu / Số cũ mới`,
      displayOld: nextSec.initialIndex !== null && nextSec.initialIndex !== undefined ? String(nextSec.initialIndex) : 'Chưa có',
      displayNew: `${fmtVal(nextSec.breakStart)}${startRoll}${tblRoll}`
    });
    if (nextSec.date) {
      changes.push({
        field: `mb_${type}_date`,
        label: `${typeLabel} — Ngày Break`,
        displayOld: 'Không ghi',
        displayNew: String(nextSec.date)
      });
    }
    return {
      summaryPart: `${typeLabel}: Kết thúc ${fmtVal(nextSec.breakEnd)}${endRoll} → Bắt đầu mới ${fmtVal(nextSec.breakStart)}${startRoll}${tblRoll}`,
      changes
    };
  }

  if (prevSec && nextSec) {
    const prevEndStr = `${fmtVal(prevSec.breakEnd)}${rollTag(prevSec.confirmedEndRollover)}`;
    const nextEndStr = `${fmtVal(nextSec.breakEnd)}${rollTag(nextSec.confirmedEndRollover)}`;
    const prevStartStr = `${fmtVal(prevSec.breakStart)}${rollTag(prevSec.confirmedStartRollover)}${rollTag(prevSec.confirmedTableEndRollover, '[quay vòng cuối tháng]')}`;
    const nextStartStr = `${fmtVal(nextSec.breakStart)}${rollTag(nextSec.confirmedStartRollover)}${rollTag(nextSec.confirmedTableEndRollover, '[quay vòng cuối tháng]')}`;

    if (prevSec.initialIndex !== nextSec.initialIndex) {
      changes.push({
        field: `mb_${type}_initial`,
        label: `${typeLabel} — Đầu kỳ gốc`,
        displayOld: fmtVal(prevSec.initialIndex),
        displayNew: fmtVal(nextSec.initialIndex)
      });
    }
    if (prevEndStr !== nextEndStr) {
      changes.push({
        field: `mb_${type}_breakEnd`,
        label: `${typeLabel} — Break kết thúc (người cũ)`,
        displayOld: prevEndStr,
        displayNew: nextEndStr
      });
    }
    if (prevStartStr !== nextStartStr || changes.length === 0) {
      changes.push({
        field: `mb_${type}_breakStart`,
        label: `${typeLabel} — Break bắt đầu / Số cũ mới`,
        displayOld: prevStartStr,
        displayNew: nextStartStr
      });
    }
    if ((prevSec.date || '') !== (nextSec.date || '')) {
      changes.push({
        field: `mb_${type}_date`,
        label: `${typeLabel} — Ngày Break`,
        displayOld: prevSec.date || 'Không ghi',
        displayNew: nextSec.date || 'Không ghi'
      });
    }
    return {
      summaryPart: `${typeLabel}: Kết thúc ${nextEndStr} → Bắt đầu mới ${nextStartStr}`,
      changes
    };
  }

  return { summaryPart: '', changes };
}

async function handleSaveMeterBreak() {
  mbSuppressBlurUntil = 0;
  if (!mbSelectedRoom || isMbReadonlyMode()) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const needElec = Boolean(chkElec && chkElec.checked);
  const needWater = Boolean(chkWater && chkWater.checked);

  if (!needElec && !needWater) {
    if (typeof showToast === 'function') showToast('Vui lòng chọn ít nhất 1 loại đồng hồ để Break!', 'warning');
    return;
  }

  const monthKey = getMbTargetMonthKey();
  const phong = mbSelectedRoom.phong;
  const conflict = getMbConflictWithMeterChange(monthKey, phong);
  if ((needElec && conflict.elec) || (needWater && conflict.water)) {
    if (typeof showToast === 'function') showToast('Phòng này đang dùng Thay đổi đồng hồ ở loại ĐH đã chọn, không thể Break cùng lúc!', 'warning');
    return;
  }

  /** @type {Array<'elec' | 'water'>} */
  const typesToCheck = [];
  if (needElec) typesToCheck.push('elec');
  if (needWater) typesToCheck.push('water');

  for (const type of typesToCheck) {
    const evalRes = evaluateMeterBreakSection(type);
    if (!evalRes.ok && evalRes.needsRollover) {
      openMbRolloverPopup(evalRes.needsRollover.kind, evalRes.needsRollover.type, () => handleSaveMeterBreak());
      return;
    }
    if (!evalRes.ok) {
      if (evalRes.firstErrorEl) evalRes.firstErrorEl.focus();
      if (typeof showToast === 'function') showToast(evalRes.errorMsg || 'Vui lòng kiểm tra lại chỉ số Break!', 'warning');
      return;
    }
  }

  const existingRec = cloneMbJson(getRoomMeterBreakRecord(monthKey, phong) || {});
  const isAfterEdit = Boolean(mbIsRecordEditing);

  const nextRoomData = {
    elec: needElec ? serializeMbSectionForSave('elec') : (mbStagedDeletes.elec ? null : (existingRec.elec || null)),
    water: needWater ? serializeMbSectionForSave('water') : (mbStagedDeletes.water ? null : (existingRec.water || null))
  };

  try {
    await persistRoomMeterBreak(monthKey, phong, nextRoomData);
    await syncMeterBreakToMainTable(monthKey, phong);

    if (typeof recordActivityLog === 'function') {
      const parts = [];
      /** @type {Array<{ field: string, label: string, displayOld: string, displayNew: string }>} */
      const detailChanges = [];
      /** @type {Array<'elec' | 'water'>} */
      const meterTypes = ['elec', 'water'];
      meterTypes.forEach(t => {
        const hadPrev = Boolean(existingRec[t]);
        const hasNext = Boolean(nextRoomData[t]);
        const needThis = t === 'elec' ? needElec : needWater;
        const stagedDel = Boolean(mbStagedDeletes[t]);
        if (needThis || stagedDel || hadPrev !== hasNext) {
          const diff = buildMbActivityLogDiff(t, existingRec[t] || null, nextRoomData[t] || null);
          if (diff.summaryPart) parts.push(diff.summaryPart);
          if (diff.changes.length > 0) detailChanges.push(...diff.changes);
        }
      });

      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_BREAK_SAVE',
        level: 'info',
        result: 'success',
        title: isAfterEdit
          ? `Cập nhật Break chỉ số phòng ${phong}`
          : `Break chỉ số giữa tháng phòng ${phong}`,
        summary: `${formatMbMonthLabel(monthKey)} · Phòng ${phong}: ${parts.join(' | ')}`,
        metadata: {
          target: `${monthKey}_${phong}`,
          monthKey,
          phong,
          changes: detailChanges
        }
      });
    }

    const freshRec = getRoomMeterBreakRecord(monthKey, phong);
    mbSelectedRoom = {
      ...mbSelectedRoom,
      savedElec: freshRec && freshRec.elec ? freshRec.elec : null,
      savedWater: freshRec && freshRec.water ? freshRec.water : null
    };

    const loadedMonth = (typeof currentLoadedMonth !== 'undefined' && currentLoadedMonth) ? currentLoadedMonth : monthKey;
    if (monthKey === loadedMonth) {
      const snapIdx = mbRoomsSnapshot.findIndex(r => r.phong === phong);
      if (snapIdx !== -1) {
        mbRoomsSnapshot[snapIdx] = cloneMbJson(mbSelectedRoom);
      }
    }

    const lblElec = document.getElementById('mb-lbl-elec');
    const lblWater = document.getElementById('mb-lbl-water');
    if (chkElec) chkElec.checked = Boolean(mbSelectedRoom.savedElec);
    if (chkWater) chkWater.checked = Boolean(mbSelectedRoom.savedWater);
    if (lblElec && chkElec) lblElec.classList.toggle('checked', chkElec.checked);
    if (lblWater && chkWater) lblWater.classList.toggle('checked', chkWater.checked);

    mbStagedDeletes = { elec: false, water: false };
    mbIsRecordLocked = true;
    mbIsRecordEditing = false;
    mbRecordBackupState = null;

    initMeterBreakStep2State();
    renderMeterBreakStep2Form();
    renderMeterBreakRoomGrid();
    renderMeterBreakHistoryList();

    if (typeof showToast === 'function') {
      showToast(`Đã lưu & khóa Break chỉ số phòng ${phong} (${formatMbMonthLabel(monthKey)})!`, 'success');
    }
  } catch (err) {
    console.error('Lỗi khi lưu meter-breaks:', err);
    if (typeof showToast === 'function') {
      showToast(`Không thể lưu Break chỉ số: ${err.message}`, 'error');
    }
  }
}

async function handleDeleteSectionMeterBreak(type) {
  if (!mbSelectedRoom || isMbReadonlyMode()) return;

  const chkElec = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-elec'));
  const chkWater = /** @type {HTMLInputElement | null} */ (document.getElementById('mb-chk-water'));
  const otherType = type === 'elec' ? 'water' : 'elec';
  const otherChecked = otherType === 'elec'
    ? Boolean(chkElec && chkElec.checked)
    : Boolean(chkWater && chkWater.checked);

  if (mbIsRecordEditing && otherChecked) {
    mbStagedDeletes[type] = true;
    const targetChk = type === 'elec' ? chkElec : chkWater;
    const targetLbl = document.getElementById(type === 'elec' ? 'mb-lbl-elec' : 'mb-lbl-water');
    if (targetChk) targetChk.checked = false;
    if (targetLbl) targetLbl.classList.remove('checked');

    mbSelectedRoom[type === 'elec' ? 'savedElec' : 'savedWater'] = null;
    mbState[type] = buildInitialBreakTypeState(mbSelectedRoom, type);
    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    renderMeterBreakStep2Form();
    if (typeof showToast === 'function') {
      showToast(`Đã tạm gỡ Break ${typeLabel}. Bấm '💾 Lưu ghi nhận' để xác nhận hoặc 'Hủy thay đổi & Giữ nguyên' để hoàn tác.`, 'info');
    }
    return;
  }

  const monthKey = getMbTargetMonthKey();
  const phong = mbSelectedRoom.phong;
  const existingRec = cloneMbJson(getRoomMeterBreakRecord(monthKey, phong) || {});
  if (!existingRec || !existingRec[type]) return;

  const nextRoomData = {
    elec: type === 'elec' ? null : (existingRec.elec || null),
    water: type === 'water' ? null : (existingRec.water || null)
  };

  try {
    await persistRoomMeterBreak(monthKey, phong, nextRoomData);
    await syncMeterBreakToMainTable(monthKey, phong);

    mbSelectedRoom[type === 'elec' ? 'savedElec' : 'savedWater'] = null;
    mbState[type] = buildInitialBreakTypeState(mbSelectedRoom, type);
    const targetChk = type === 'elec' ? chkElec : chkWater;
    const targetLbl = document.getElementById(type === 'elec' ? 'mb-lbl-elec' : 'mb-lbl-water');
    if (targetChk) targetChk.checked = false;
    if (targetLbl) targetLbl.classList.remove('checked');

    const typeLabel = type === 'elec' ? 'Điện' : 'Nước';
    if (typeof recordActivityLog === 'function') {
      const diff = buildMbActivityLogDiff(type, existingRec[type], null);
      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_BREAK_DELETE',
        level: 'warning',
        result: 'success',
        title: `Gỡ Break chỉ số ${typeLabel} phòng ${phong}`,
        summary: `${formatMbMonthLabel(monthKey)} · Phòng ${phong}: ${diff.summaryPart}`,
        metadata: {
          target: `${monthKey}_${phong}`,
          monthKey,
          phong,
          type,
          changes: diff.changes
        }
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Đã gỡ Break ${typeLabel} phòng ${phong}.`, 'info');
    }

    renderMeterBreakRoomGrid();
    renderMeterBreakHistoryList();

    if (!nextRoomData.elec && !nextRoomData.water) {
      mbRecordBackupState = null;
      mbIsRecordEditing = false;
      mbIsRecordLocked = false;
      closeMeterBreakModal();
    } else {
      mbIsRecordLocked = true;
      mbIsRecordEditing = false;
      mbRecordBackupState = null;
      renderMeterBreakStep2Form();
    }
  } catch (err) {
    console.error('Lỗi khi gỡ Break chỉ số:', err);
    if (typeof showToast === 'function') showToast(`Lỗi: ${err.message}`, 'error');
  }
}

async function handleDeleteRoomMeterBreaks() {
  if (!mbSelectedRoom || isMbReadonlyMode()) return;
  const monthKey = getMbTargetMonthKey();
  const phong = mbSelectedRoom.phong;
  const existingRec = cloneMbJson(getRoomMeterBreakRecord(monthKey, phong) || {});

  try {
    await persistRoomMeterBreak(monthKey, phong, null);
    await syncMeterBreakToMainTable(monthKey, phong);

    if (typeof recordActivityLog === 'function') {
      const parts = [];
      /** @type {Array<{ field: string, label: string, displayOld: string, displayNew: string }>} */
      const detailChanges = [];
      /** @type {Array<'elec' | 'water'>} */
      const meterTypes = ['elec', 'water'];
      meterTypes.forEach(t => {
        if (existingRec[t]) {
          const diff = buildMbActivityLogDiff(t, existingRec[t], null);
          if (diff.summaryPart) parts.push(diff.summaryPart);
          if (diff.changes.length > 0) detailChanges.push(...diff.changes);
        }
      });

      await recordActivityLog({
        category: 'MONTH_DATA',
        action: 'METER_BREAK_DELETE',
        level: 'warning',
        result: 'success',
        title: `Hủy toàn bộ Break chỉ số phòng ${phong}`,
        summary: parts.length > 0
          ? `${formatMbMonthLabel(monthKey)} · Phòng ${phong}: ${parts.join(' | ')}`
          : `${formatMbMonthLabel(monthKey)} · Đã hủy Break chỉ số và khôi phục Số cũ ban đầu cho phòng ${phong}.`,
        metadata: {
          target: `${monthKey}_${phong}`,
          monthKey,
          phong,
          changes: detailChanges
        }
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Đã hủy toàn bộ Break chỉ số phòng ${phong}.`, 'info');
    }
    mbRecordBackupState = null;
    mbIsRecordEditing = false;
    mbIsRecordLocked = false;
    mbStagedDeletes = { elec: false, water: false };
    renderMeterBreakRoomGrid();
    renderMeterBreakHistoryList();
    closeMeterBreakModal();
  } catch (err) {
    console.error('Lỗi khi hủy Break chỉ số phòng:', err);
    if (typeof showToast === 'function') showToast(`Lỗi: ${err.message}`, 'error');
  }
}

// Đóng Modal theo đúng thứ tự xếp tầng
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const unlockEditModal = document.getElementById('mb-unlock-edit-modal');
    if (unlockEditModal && unlockEditModal.style.display === 'flex') {
      closeMbUnlockEditModal();
      return;
    }
    const rollModal = document.getElementById('mb-rollover-modal');
    if (rollModal && rollModal.style.display === 'flex') {
      cancelMbRolloverModal();
      return;
    }
    const missingModal = document.getElementById('mb-missing-prev-modal');
    if (missingModal && missingModal.style.display === 'flex') {
      closeMbMissingPrevModal();
      return;
    }
    const mainModal = document.getElementById('meter-break-modal');
    if (mainModal && mainModal.style.display === 'flex') {
      closeMeterBreakModal();
    }
  });

  document.addEventListener('click', e => {
    const mainModal = document.getElementById('meter-break-modal');
    if (mainModal && mainModal.style.display === 'flex' && e.target === mainModal) {
      closeMeterBreakModal();
    }
  });
}

if (typeof window !== 'undefined') {
  window.loadMeterBreaksStore = loadMeterBreaksStore;
  window.getRoomMeterBreakRecord = getRoomMeterBreakRecord;
  window.openMeterBreakModal = openMeterBreakModal;
  window.closeMeterBreakModal = closeMeterBreakModal;
  window.toggleMeterBreakType = toggleMeterBreakType;
  window.goToMeterBreakStep = goToMeterBreakStep;
  window.handleMbStep2Back = handleMbStep2Back;
  window.handleToggleEditMbRecordClick = handleToggleEditMbRecordClick;
  window.closeMbUnlockEditModal = closeMbUnlockEditModal;
  window.confirmUnlockMbRecordForEditing = confirmUnlockMbRecordForEditing;
  window.openMeterBreakHistoryCard = openMeterBreakHistoryCard;
  window.onMbIntKeyDown = onMbIntKeyDown;
  window.onMeterBreakDateInput = onMeterBreakDateInput;
  window.onMeterBreakNumInput = onMeterBreakNumInput;
  window.onMbBreakEndBlur = onMbBreakEndBlur;
  window.onMbBreakStartBlur = onMbBreakStartBlur;
  window.openMbMissingPrevModal = openMbMissingPrevModal;
  window.closeMbMissingPrevModal = closeMbMissingPrevModal;
  window.confirmManualInitFromMb = confirmManualInitFromMb;
  window.confirmGoToPrevMonthFromMb = confirmGoToPrevMonthFromMb;
  window.openMbRolloverPopup = openMbRolloverPopup;
  window.cancelMbRolloverModal = cancelMbRolloverModal;
  window.confirmMbRolloverModal = confirmMbRolloverModal;
  window.handleSaveMeterBreak = handleSaveMeterBreak;
  window.handleDeleteSectionMeterBreak = handleDeleteSectionMeterBreak;
  window.handleDeleteRoomMeterBreaks = handleDeleteRoomMeterBreaks;
  window.suppressMbBlurBriefly = suppressMbBlurBriefly;
  window.isMbReadonlyMode = isMbReadonlyMode;
}

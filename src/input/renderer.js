/* ============================================================
   RENDERER.JS - LOGIC MÀN HÌNH NHẬP LIỆU
   ============================================================ */

// Cấu hình mặc định
let appSettings = {
  baseFolder: "",
  dienThoai: "0982 141 407",
  giaPhong: 2200000,
  giaDien: 2900,
  giaNuoc: 12000,
  tienRac: 40000,
  tienInternet: 24000,
  tyLeHaoTai: 0.07,
  enableRolloverPopup: true,
  enableAnomalyPopup: true,
  bankName: "",
  bankAccount: "",
  bankOwner: ""
};

// Dữ liệu ban đầu mặc định cho Tháng 07/2026
const INITIAL_JULY_2026_DATA = [
  { phong: "1A", dienCu: 5302, dienMoi: 5379, nuocCu: 577, nuocMoi: 583 },
  { phong: "2A", dienCu: 20406, dienMoi: 20599, nuocCu: 609, nuocMoi: 612 },
  { phong: "3A", dienCu: 10897, dienMoi: 11040, nuocCu: 581, nuocMoi: 585 },
  { phong: "4A", dienCu: 7987, dienMoi: 8098, nuocCu: 644, nuocMoi: 650 },
  { phong: "5A", dienCu: 10773, dienMoi: 10849, nuocCu: 720, nuocMoi: 726 },
  { phong: "6A", dienCu: 7885, dienMoi: 8048, nuocCu: 563, nuocMoi: 578 },
  { phong: "1B", dienCu: 10936, dienMoi: 11024, nuocCu: 806, nuocMoi: 811 },
  { phong: "2B", dienCu: 2172, dienMoi: 2551, nuocCu: 487, nuocMoi: 495 },
  { phong: "3B", dienCu: 10054, dienMoi: 10154, nuocCu: 650, nuocMoi: 654 },
  { phong: "4B", dienCu: 8428, dienMoi: 8571, nuocCu: 681, nuocMoi: 689 },
  { phong: "5B", dienCu: 9800, dienMoi: 9835, nuocCu: 791, nuocMoi: 797 },
  { phong: "6B", dienCu: 13336, dienMoi: 13449, nuocCu: 760, nuocMoi: 768 }
];

// Danh sách cố định 12 phòng (1-6 là 1A-6A, 7-12 là 1B-6B)
const DEFAULT_ROOM_NAMES = [
  "1A", "2A", "3A", "4A", "5A", "6A",
  "1B", "2B", "3B", "4B", "5B", "6B"
];

// Dữ liệu làm việc hiện tại của 12 phòng
let roomsData = [];

/**
 * Kiểm tra một giá trị xem có khác rỗng, khác null/undefined, khác 0 và là số hợp lệ không
 */
function isNotEmpty(val) {
  if (val === '' || val === null || val === undefined) return false;
  const num = Number(val);
  if (isNaN(num) || num === 0) return false;
  return true;
}

/**
 * Format số có dấu chấm phân cách hàng nghìn (VD: 14110 -> 14.110)
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num) || num === '') return '0';
  return Number(num).toLocaleString('vi-VN');
}

const MIN_MONTH = '2026-07'; // Mốc cố định 2026-07

/**
 * Kiểm tra xem 1 tháng đã nhập đủ dữ liệu 12 phòng hay chưa
 */
function isMonthFullyComplete(monthData) {
  if (!monthData) return false;
  const rooms = Array.isArray(monthData) ? monthData : (monthData && monthData.rooms ? monthData.rooms : null);
  if (!rooms || !Array.isArray(rooms) || rooms.length !== 12) {
    return false;
  }
  return rooms.every(r => r.dienMoi != null && r.nuocMoi != null && r.dienMoi !== '' && r.nuocMoi !== '');
}

/**
 * Tính tháng liền sau dạng YYYY-MM
 */
function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Tính tháng mới nhất có thể chọn trong dropdown dựa trên tiến độ nhập liệu thực tế
 */
async function computeMaxSelectableMonth() {
  let month = MIN_MONTH;
  while (isMonthFullyComplete(await readHistoryFile(month))) {
    month = nextMonthKey(month);
  }
  return month;
}

/**
 * Tạo danh sách Tháng/Năm động trong dropdown:
 * min = cố định 2026-07
 * max = tháng kế tiếp ngay sau tháng gần nhất đã nhập đủ dữ liệu cả 12 phòng
 */
async function populateMonthSelect() {
  const select = document.getElementById('month-year-select');
  if (!select) return;

  const currentSelectedValue = select.value;
  const maxMonthKey = await computeMaxSelectableMonth();

  const list = [];
  let curr = MIN_MONTH;
  while (curr <= maxMonthKey || curr === maxMonthKey) {
    const [y, m] = curr.split('-');
    list.push({
      key: curr,
      label: `Tháng ${m}/${y}`
    });
    if (curr === maxMonthKey) break;
    curr = nextMonthKey(curr);
  }

  select.innerHTML = '';
  list.forEach(item => {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = item.label;
    select.appendChild(option);
  });

  if (currentSelectedValue && select.querySelector(`option[value="${currentSelectedValue}"]`)) {
    select.value = currentSelectedValue;
  } else {
    select.value = maxMonthKey;
  }
}

/**
 * Tính ra tháng liền trước dạng YYYY-MM (VD: 2026-08 -> 2026-07)
 */
function getPreviousMonthStr(monthYearStr) {
  if (!monthYearStr || !monthYearStr.includes('-')) return '';
  const [yearStr, monthStr] = monthYearStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  const formattedMonth = String(month).padStart(2, '0');
  return `${year}-${formattedMonth}`;
}

/**
 * Đọc file settings qua IPC (window.api.loadSettingsData hoặc loadSettings)
 */
async function loadSettingsFile() {
  if (window.api) {
    const loadFn = window.api.loadSettings || window.api.loadSettingsData;
    if (typeof loadFn === 'function') {
      try {
        const data = await loadFn();
        if (data && !data.error) {
          appSettings = {
            baseFolder: data.baseFolder || "",
            dienThoai: data.dienThoai || appSettings.dienThoai,
            giaPhong: data.giaPhong || appSettings.giaPhong,
            giaDien: data.giaDien || appSettings.giaDien,
            giaNuoc: data.giaNuoc || appSettings.giaNuoc,
            tienRac: data.tienRac || data.rac || appSettings.tienRac,
            tienInternet: data.tienInternet || data.internet || appSettings.tienInternet,
            tyLeHaoTai: data.tyLeHaoTai || data.tileHaoTai || appSettings.tyLeHaoTai,
            enableRolloverPopup: data.enableRolloverPopup !== undefined ? data.enableRolloverPopup : true,
            enableAnomalyPopup: data.enableAnomalyPopup !== undefined ? data.enableAnomalyPopup : true,
            bankName: data.bankName || "",
            bankAccount: data.bankAccount || "",
            bankOwner: data.bankOwner || ""
          };
          return;
        }
      } catch (e) {
        console.error('Lỗi khi đọc settings qua IPC:', e);
      }
    }
    return;
  }

  // Backup từ localStorage (chỉ dùng khi không có window.api)
  try {
    const local = localStorage.getItem('phongtro_settings');
    if (local) {
      const data = JSON.parse(local);
      appSettings = { ...appSettings, ...data };
    }
  } catch (e) { }
}

/**
 * Ghi file settings qua IPC (window.api.saveSettingsData hoặc saveSettings)
 */
async function saveSettingsFile() {
  const saveData = {
    baseFolder: appSettings.baseFolder,
    dienThoai: appSettings.dienThoai,
    giaPhong: appSettings.giaPhong,
    giaDien: appSettings.giaDien,
    giaNuoc: appSettings.giaNuoc,
    tienRac: appSettings.tienRac,
    rac: appSettings.tienRac,
    tienInternet: appSettings.tienInternet,
    internet: appSettings.tienInternet,
    tyLeHaoTai: appSettings.tyLeHaoTai,
    tileHaoTai: appSettings.tyLeHaoTai,
    enableRolloverPopup: appSettings.enableRolloverPopup !== false,
    enableAnomalyPopup: appSettings.enableAnomalyPopup !== false,
    bankName: appSettings.bankName || "",
    bankAccount: appSettings.bankAccount || "",
    bankOwner: appSettings.bankOwner || ""
  };

  if (window.api) {
    const saveFn = window.api.saveSettings || window.api.saveSettingsData;
    if (typeof saveFn === 'function') {
      try {
        const res = await saveFn(saveData);
        if (res && res.error) {
          showToast(`Lỗi: ${res.error}`, 'error');
          return false;
        }
        if (res && res.baseFolder) {
          appSettings.baseFolder = res.baseFolder;
        }
        return res && !res.error;
      } catch (e) {
        console.error('Lỗi khi ghi settings qua IPC:', e);
        return false;
      }
    }
  }

  try {
    localStorage.setItem('phongtro_settings', JSON.stringify(saveData));
  } catch (e) { }

  return true;
}

/**
 * Đọc file history qua IPC (window.api.loadMonthData)
 */
async function readHistoryFile(monthYearStr) {
  if (!monthYearStr) return null;

  if (window.api && typeof window.api.loadMonthData === 'function') {
    try {
      const res = await window.api.loadMonthData(monthYearStr);
      if (res && !res.error) {
        return res;
      }
    } catch (e) {
      console.error('Lỗi khi đọc dữ liệu qua IPC:', e);
    }
    // Khi chạy trên Electron mà chưa chọn folder hoặc chưa có file,
    // nếu là tháng 2026-07 thì trả về dữ liệu mẫu 2026-07, không dùng localStorage
    if (monthYearStr === '2026-07') {
      return INITIAL_JULY_2026_DATA;
    }
    return null;
  }

  // Backup từ localStorage (chỉ dùng khi không có window.api, tức chạy thuần Web browser)
  try {
    const local = localStorage.getItem(`history_${monthYearStr}`);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) { }

  if (monthYearStr === '2026-07') {
    return INITIAL_JULY_2026_DATA;
  }

  return null;
}

/**
 * Ghi dữ liệu tháng qua IPC (window.api.saveMonthData)
 */
async function writeHistoryFile(monthYearStr, data) {
  if (!monthYearStr) return false;

  if (window.api && typeof window.api.saveMonthData === 'function') {
    try {
      const res = await window.api.saveMonthData(monthYearStr, data);
      return res && !res.error;
    } catch (e) {
      console.error('Lỗi khi ghi dữ liệu qua IPC:', e);
      return false;
    }
  }

  try {
    localStorage.setItem(`history_${monthYearStr}`, JSON.stringify(data));
  } catch (e) { }

  return true;
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettingsFile();
  initBankSelectDropdown();
  initSettingsForm();

  const baseFolderInput = document.getElementById('set-baseFolder');

  // Kiểm tra nếu chưa thiết lập thư mục ngay từ lần mở đầu tiên
  if (!appSettings.baseFolder || appSettings.baseFolder.trim() === '') {
    if (baseFolderInput) baseFolderInput.classList.add('input-error');
    switchTab('settings');
    showToast('Chào mừng! Vui lòng chọn "Thư mục lưu ảnh & PDF phiếu thu" để bắt đầu.', 'warning');
  } else {
    if (baseFolderInput) baseFolderInput.classList.remove('input-error');
  }

  await populateMonthSelect();
  await loadRoomsForMonth(document.getElementById('month-year-select').value);
  await loadResidentsData();
  await loadRoomsData();
  initResidentsSection();

  // Khởi tạo DatePicker cho Ngày Sinh & Ngày Vào Ở
  initDatePickers();

  // Ràng buộc nhập số 0-9 cho CCCD & Số điện thoại
  const cccdInput = document.getElementById('res-cccd');
  const sdtGoiInput = document.getElementById('res-sdtGoi');
  const sdtZaloInput = document.getElementById('res-sdtZalo');
  restrictDigitsOnly(cccdInput, 12);
  restrictDigitsOnly(sdtGoiInput, 10);
  restrictDigitsOnly(sdtZaloInput, 10);

  // Ràng buộc nhập số cho Số Tài Khoản Ngân Hàng & Tự động viết hoa không dấu cho Tên Chủ Sở Hữu
  const bankAccountInput = document.getElementById('set-bankAccount');
  const bankOwnerInput = document.getElementById('set-bankOwner');
  if (bankAccountInput) {
    restrictDigitsOnly(bankAccountInput, 24);
  }
  if (bankOwnerInput) {
    bankOwnerInput.addEventListener('input', () => {
      const start = bankOwnerInput.selectionStart;
      bankOwnerInput.value = removeVietnameseTones(bankOwnerInput.value).toUpperCase();
      bankOwnerInput.setSelectionRange(start, start);
    });
  }

  // Tự động xóa lỗi đỏ khi người dùng gõ
  ['res-hoTen', 'res-cccd', 'res-sdtGoi', 'res-sdtZalo', 'res-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => clearFieldError(id));
    }
  });

  // Hiển thị phiên bản app lấy từ package.json qua IPC
  if (window.api && typeof window.api.getAppVersion === 'function') {
    try {
      const ver = await window.api.getAppVersion();
      const verTag = document.getElementById('app-version-tag');
      if (verTag && ver) {
        verTag.textContent = `v${ver}`;
      }
      const settingsVerTag = document.getElementById('settings-app-version');
      if (settingsVerTag && ver) {
        settingsVerTag.textContent = `v${ver}`;
      }
      document.title = `Màn Hình Nhập Liệu - Quản Lý Phòng Trọ v${ver}`;
    } catch (e) {
      console.error('Lỗi khi lấy version app:', e);
    }
  }

  // Khởi tạo các sự kiện Tự động cập nhật
  initAutoUpdaterListeners();

  // Đăng ký lắng nghe tiến trình xuất ảnh/PDF
  if (window.api && typeof window.api.onExportProgress === 'function') {
    window.api.onExportProgress((data) => {
      const btnText = document.getElementById('btn-save-export-text');
      if (btnText && data && data.current) {
        btnText.textContent = `Đang xuất... ${data.current}/${data.total}`;
      }
    });
  }

  // Lắng nghe sự kiện bàn phím phím Enter & Tab kiểu Excel cho toàn bảng
  document.getElementById('rooms-table-body').addEventListener('keydown', handleTableKeyDown);

  // Khởi tạo trạng thái và sự kiện Tích hợp Zalo
  initZaloIntegration();
});

/**
 * Đổi tab giữa Nhập Dữ Liệu, Cài Đặt Chung và Quản Lý Phòng & Người Ở
 */
function switchTab(tabName) {
  const sectionSettings = document.getElementById('section-settings');
  const isCurrentSettings = sectionSettings && sectionSettings.classList.contains('active');

  if (isCurrentSettings && tabName !== 'settings' && (isSettingsDirty || isBankDirty)) {
    if (isBankDirty) {
      highlightUnsavedBankFields();
    }
    pendingActionAfterUnsavedModal = () => forceSwitchTab(tabName);
    showUnsavedSettingsModal();
    return;
  }

  forceSwitchTab(tabName);
}

function forceSwitchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabName === 'data') {
    document.getElementById('tab-btn-data').classList.add('active');
    document.getElementById('section-data').classList.add('active');
  } else if (tabName === 'settings') {
    document.getElementById('tab-btn-settings').classList.add('active');
    document.getElementById('section-settings').classList.add('active');
  } else if (tabName === 'residents') {
    document.getElementById('tab-btn-residents').classList.add('active');
    document.getElementById('section-residents').classList.add('active');
    initResidentsSection();
  }
}

/**
 * Load form Cài đặt
 */
function initSettingsForm() {
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm && !settingsForm.dataset.dirtyBound) {
    settingsForm.dataset.dirtyBound = 'true';
    settingsForm.addEventListener('input', markSettingsDirty);
    settingsForm.addEventListener('change', markSettingsDirty);
  }

  const baseFolderInput = document.getElementById('set-baseFolder');
  if (baseFolderInput) {
    baseFolderInput.value = appSettings.baseFolder || "";
    if (!appSettings.baseFolder || appSettings.baseFolder.trim() === '') {
      baseFolderInput.classList.add('input-error');
    } else {
      baseFolderInput.classList.remove('input-error');
    }
  }
  document.getElementById('set-giaPhong').value = appSettings.giaPhong;
  document.getElementById('set-giaDien').value = appSettings.giaDien;
  document.getElementById('set-giaNuoc').value = appSettings.giaNuoc;
  document.getElementById('set-rac').value = appSettings.tienRac;
  document.getElementById('set-internet').value = appSettings.tienInternet;
  document.getElementById('set-tileHaoTai').value = (appSettings.tyLeHaoTai * 100).toFixed(1);
  document.getElementById('set-dienThoai').value = appSettings.dienThoai;

  const rolloverCheck = document.getElementById('set-enableRolloverPopup');
  if (rolloverCheck) {
    rolloverCheck.checked = appSettings.enableRolloverPopup !== false;
  }
  const anomalyCheck = document.getElementById('set-enableAnomalyPopup');
  if (anomalyCheck) {
    anomalyCheck.checked = appSettings.enableAnomalyPopup !== false;
  }

  const bankAccountInput = document.getElementById('set-bankAccount');
  if (bankAccountInput) {
    bankAccountInput.value = appSettings.bankAccount || "";
    bankAccountInput.classList.remove('input-error');
    if (!bankAccountInput.dataset.dirtyBound) {
      bankAccountInput.dataset.dirtyBound = 'true';
      bankAccountInput.addEventListener('input', () => {
        bankAccountInput.classList.remove('input-error');
        markBankDirty();
      });
      bankAccountInput.addEventListener('change', () => {
        bankAccountInput.classList.remove('input-error');
        markBankDirty();
      });
    }
  }

  const bankOwnerInput = document.getElementById('set-bankOwner');
  if (bankOwnerInput) {
    bankOwnerInput.value = appSettings.bankOwner || "";
    bankOwnerInput.classList.remove('input-error');
    if (!bankOwnerInput.dataset.dirtyBound) {
      bankOwnerInput.dataset.dirtyBound = 'true';
      bankOwnerInput.addEventListener('input', () => {
        bankOwnerInput.classList.remove('input-error');
        markBankDirty();
      });
      bankOwnerInput.addEventListener('change', () => {
        bankOwnerInput.classList.remove('input-error');
        markBankDirty();
      });
    }
  }

  const customBankSelect = document.getElementById('custom-bank-select');
  if (customBankSelect) {
    customBankSelect.classList.remove('input-error');
  }

  setSelectedBank(appSettings.bankName || "");

  isSettingsDirty = false;
  isBankDirty = false;
}

/**
 * Khởi tạo Custom Bank Select Dropdown với logo ngân hàng và tính năng tìm kiếm
 */
function initBankSelectDropdown() {
  const container = document.getElementById('custom-bank-select');
  const trigger = document.getElementById('bank-select-trigger');
  const dropdown = document.getElementById('bank-select-dropdown');
  const searchInput = document.getElementById('bank-search-input');
  const clearBtn = document.getElementById('bank-search-clear');
  const optionsList = document.getElementById('bank-options-list');
  const hiddenInput = document.getElementById('set-bankName');

  if (!container || !trigger || !dropdown || !optionsList) return;

  const banksList = window.VIETNAM_BANKS_LIST || [];

  function renderBankOptions(filterText = '') {
    optionsList.innerHTML = '';
    const cleanQuery = typeof removeVietnameseTones === 'function'
      ? removeVietnameseTones(filterText.trim().toLowerCase())
      : filterText.trim().toLowerCase();

    const filtered = banksList.filter(b => {
      if (!cleanQuery) return true;
      const codeMatch = (b.code || '').toLowerCase().includes(cleanQuery);
      const binMatch = (b.bin || '').toLowerCase().includes(cleanQuery);
      const shortMatch = typeof removeVietnameseTones === 'function'
        ? removeVietnameseTones((b.shortName || '').toLowerCase()).includes(cleanQuery)
        : (b.shortName || '').toLowerCase().includes(cleanQuery);
      const nameMatch = typeof removeVietnameseTones === 'function'
        ? removeVietnameseTones((b.name || '').toLowerCase()).includes(cleanQuery)
        : (b.name || '').toLowerCase().includes(cleanQuery);
      return codeMatch || binMatch || shortMatch || nameMatch;
    });

    if (filtered.length === 0) {
      optionsList.innerHTML = `<div class="bank-options-empty">Không tìm thấy ngân hàng phù hợp với "${filterText}"</div>`;
      return;
    }

    const currentVal = hiddenInput ? hiddenInput.value : '';

    filtered.forEach(b => {
      const item = document.createElement('div');
      item.className = `bank-option-item ${currentVal === b.id || currentVal === b.code ? 'selected' : ''}`;
      item.setAttribute('role', 'option');
      item.setAttribute('data-id', b.id);
      item.setAttribute('data-code', b.code);

      const localLogo = `../../assets/bank_napas_payment/Bank/${b.code}.png`;
      const fallbackLogo = b.bankLogoUrl || '';

      item.innerHTML = `
        <div class="bank-item-left">
          <img src="${localLogo}" alt="${b.shortName}" class="bank-item-logo" onerror="this.onerror=null; if('${fallbackLogo}') this.src='${fallbackLogo}';">
          <div class="bank-item-info">
            <div class="bank-item-top">
              <span class="bank-item-name">${b.shortName}</span>
              <span class="bank-bin-badge">${b.code} · ${b.bin}</span>
            </div>
            <span class="bank-item-sub">${b.name}</span>
          </div>
        </div>
        <div class="bank-check-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedBank(b.id, true);
        closeBankDropdown();
      });

      optionsList.appendChild(item);
    });
  }

  function openBankDropdown() {
    dropdown.style.display = 'flex';
    trigger.classList.add('active');
    trigger.setAttribute('aria-expanded', 'true');
    searchInput.value = '';
    clearBtn.style.display = 'none';
    renderBankOptions('');
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeBankDropdown() {
    dropdown.style.display = 'none';
    trigger.classList.remove('active');
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.style.display === 'none' || !dropdown.style.display) {
      openBankDropdown();
    } else {
      closeBankDropdown();
    }
  });

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearBtn.style.display = val ? 'block' : 'none';
    renderBankOptions(val);
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    searchInput.value = '';
    clearBtn.style.display = 'none';
    renderBankOptions('');
    searchInput.focus();
  });

  // Đóng khi click ngoài
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      closeBankDropdown();
    }
  });

  // Phím Esc để đóng
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.style.display !== 'none') {
      closeBankDropdown();
      trigger.focus();
    }
  });

  // Render danh sách ban đầu
  renderBankOptions('');
}

/**
 * Cập nhật hiển thị Ngân hàng đang chọn
 */
function setSelectedBank(bankIdOrCode, isUserAction = false) {
  const hiddenInput = document.getElementById('set-bankName');
  const triggerContent = document.getElementById('bank-trigger-content');
  if (!triggerContent) return;

  const banksMap = window.VIETNAM_BANKS_MAP || {};
  let bank = null;

  if (bankIdOrCode) {
    bank = banksMap[bankIdOrCode] || Object.values(banksMap).find(b => b.id === bankIdOrCode || b.code === bankIdOrCode || b.bin === bankIdOrCode);
  }

  if (bank) {
    if (hiddenInput) hiddenInput.value = bank.id;
    const localLogo = `../../assets/bank_napas_payment/Bank/${bank.code}.png`;
    const fallbackLogo = bank.bankLogoUrl || '';

    triggerContent.innerHTML = `
      <div class="bank-trigger-selected">
        <img src="${localLogo}" alt="${bank.shortName}" class="bank-trigger-logo" onerror="this.onerror=null; if('${fallbackLogo}') this.src='${fallbackLogo}';">
        <div class="bank-trigger-info">
          <div class="bank-trigger-name">
            <span>${bank.shortName}</span>
            <span class="bank-bin-badge">${bank.code} · ${bank.bin}</span>
          </div>
          <span class="bank-trigger-sub">${bank.name}</span>
        </div>
      </div>
    `;
  } else {
    if (hiddenInput) hiddenInput.value = '';
    triggerContent.innerHTML = `
      <div class="bank-trigger-placeholder">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
        <span>-- Chọn Ngân Hàng Nhận Tiền --</span>
      </div>
    `;
  }

  // Highlight trong dropdown nếu đang mở
  document.querySelectorAll('.bank-option-item').forEach(el => {
    const id = el.getAttribute('data-id');
    const code = el.getAttribute('data-code');
    if (bank && (id === bank.id || code === bank.code)) {
      el.classList.add('selected');
    } else {
      el.classList.remove('selected');
    }
  });

  if (isUserAction) {
    const customBankSelect = document.getElementById('custom-bank-select');
    if (customBankSelect) customBankSelect.classList.remove('input-error');
    markBankDirty();
  }
}

/**
 * Chọn thư mục lưu xuất phiếu thu qua Windows dialog native
 */
async function pickBaseFolder() {
  const baseFolderInput = document.getElementById('set-baseFolder');
  if (window.api && typeof window.api.pickFolder === 'function') {
    const selectedFolder = await window.api.pickFolder();
    if (selectedFolder) {
      appSettings.baseFolder = selectedFolder;
      if (baseFolderInput) {
        baseFolderInput.value = selectedFolder;
        baseFolderInput.classList.remove('input-error');
      }
      markSettingsDirty();
      showToast('Đã chọn thư mục! Bấm "Lưu Cài Đặt Giá" để áp dụng.', 'info');
    }
  } else {
    showToast('Chức năng chọn thư mục chỉ hoạt động trên ứng dụng Electron!', 'error');
  }
}

/**
 * Tải và tính toán tự động khóa/điền dữ liệu phòng cho tháng/năm được chọn
 */
async function loadRoomsForMonth(currentMonthYearStr) {
  const currentMonthData = await readHistoryFile(currentMonthYearStr);
  const prevMonthStr = getPreviousMonthStr(currentMonthYearStr);
  const prevMonthData = await readHistoryFile(prevMonthStr);

  roomsData = DEFAULT_ROOM_NAMES.map(phongName => {
    const currRoom = currentMonthData
      ? currentMonthData.find(r => r.phong === phongName)
      : null;

    const prevRoom = prevMonthData
      ? prevMonthData.find(r => r.phong === phongName)
      : null;

    let dienCu = currRoom && isNotEmpty(currRoom.dienCu) ? Number(currRoom.dienCu) : '';
    let isDienCuLocked = false;

    if (prevRoom && isNotEmpty(prevRoom.dienMoi)) {
      dienCu = Number(prevRoom.dienMoi);
      isDienCuLocked = true;
    }

    let nuocCu = currRoom && isNotEmpty(currRoom.nuocCu) ? Number(currRoom.nuocCu) : '';
    let isNuocCuLocked = false;

    if (prevRoom && isNotEmpty(prevRoom.nuocMoi)) {
      nuocCu = Number(prevRoom.nuocMoi);
      isNuocCuLocked = true;
    }

    let prevDienKwh = 0;
    if (prevRoom) {
      if (isNotEmpty(prevRoom.dienKwh)) {
        prevDienKwh = Number(prevRoom.dienKwh);
      } else if (isNotEmpty(prevRoom.dienMoi) && isNotEmpty(prevRoom.dienCu)) {
        const dienCuP = Number(prevRoom.dienCu);
        const dienMoiP = Number(prevRoom.dienMoi);
        if (typeof calcRoom === 'function') {
          const res = calcRoom({ dienCu: dienCuP, dienMoi: dienMoiP }, appSettings);
          prevDienKwh = res ? res.dienKwh : Math.max(0, dienMoiP - dienCuP);
        } else {
          prevDienKwh = Math.max(0, dienMoiP - dienCuP);
        }
      }
    }

    const dienMoi = currRoom && isNotEmpty(currRoom.dienMoi) ? Number(currRoom.dienMoi) : '';
    const nuocMoi = currRoom && isNotEmpty(currRoom.nuocMoi) ? Number(currRoom.nuocMoi) : '';

    return {
      phong: phongName,
      dienCu: dienCu,
      dienMoi: dienMoi,
      nuocCu: nuocCu,
      nuocMoi: nuocMoi,
      prevDienKwh: prevDienKwh,
      tienPhong: appSettings.giaPhong,
      isDienCuLocked,
      isNuocCuLocked
    };
  });

  renderInitialTable();
}

/**
 * Render cấu trúc 12 dòng vào Bảng nhập dữ liệu
 */
function renderInitialTable() {
  const tbody = document.getElementById('rooms-table-body');
  tbody.innerHTML = '';

  roomsData.forEach((room, index) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-index', index);

    const dienCuVal = room.dienCu !== undefined && room.dienCu !== null ? room.dienCu : '';
    const nuocCuVal = room.nuocCu !== undefined && room.nuocCu !== null ? room.nuocCu : '';
    const dienMoiVal = room.dienMoi !== undefined && room.dienMoi !== null ? room.dienMoi : '';
    const nuocMoiVal = room.nuocMoi !== undefined && room.nuocMoi !== null ? room.nuocMoi : '';

    tr.innerHTML = `
      <td class="col-stt">${index + 1}</td>
      <td class="col-phong"><span class="room-badge">${room.phong}</span></td>
      
      <!-- Điện Cũ (Tự động điền & khóa nếu có lịch sử tháng trước) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input ${room.isDienCuLocked ? 'locked-input' : ''}" 
               data-row="${index}" 
               data-field="dienCu" 
               value="${dienCuVal}" 
               ${room.isDienCuLocked ? 'readonly' : ''} 
               oninput="handleInputChange(${index}, 'dienCu', this.value)" 
               onfocus="this.select()">
      </td>

      <!-- Điện Mới (Luôn mở khóa cho người dùng nhập tay, mặc định rỗng) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input editable-meter" 
               data-row="${index}" 
               data-field="dienMoi" 
               placeholder="Nhập số mới"
               value="${dienMoiVal}" 
               oninput="handleInputChange(${index}, 'dienMoi', this.value)" 
               onblur="handleDienMoiBlur(${index})"
               onfocus="this.select()">
      </td>
      <!-- Số Điện Tiêu Thụ -->
      <td class="col-kwh val-calc cell-dien-kwh">-</td>

      <!-- Nước Cũ (Tự động điền & khóa nếu có lịch sử tháng trước) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input ${room.isNuocCuLocked ? 'locked-input' : ''}" 
               data-row="${index}" 
               data-field="nuocCu" 
               value="${nuocCuVal}" 
               ${room.isNuocCuLocked ? 'readonly' : ''} 
               oninput="handleInputChange(${index}, 'nuocCu', this.value)" 
               onfocus="this.select()">
      </td>

      <!-- Nước Mới (Luôn mở khóa cho người dùng nhập tay, mặc định rỗng) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input editable-meter" 
               data-row="${index}" 
               data-field="nuocMoi" 
               placeholder="Nhập số mới"
               value="${nuocMoiVal}" 
               oninput="handleInputChange(${index}, 'nuocMoi', this.value)" 
               onfocus="this.select()">
      </td>
      <!-- Số Nước Tiêu Thụ -->
      <td class="col-kwh val-calc cell-nuoc-khoi">-</td>

      <!-- Kết quả tính từ calc.js -->
      <td class="col-money val-calc cell-tien-dien">-</td>
      <td class="col-money val-calc cell-tien-nuoc">-</td>
      <td class="col-money val-calc cell-tien-phong">0 đ</td>
      <td class="col-money val-calc cell-rac">0 đ</td>
      <td class="col-money val-calc cell-internet">0 đ</td>
      <td class="col-kwh val-calc cell-hao-tai-kwh">-</td>
      <td class="col-money val-calc cell-tien-hao-tai">-</td>

      <!-- Tổng Cộng -->
      <td class="col-total val-total cell-tong-cong">-</td>
    `;
    tbody.appendChild(tr);

    updateRowUI(index);
  });

  updateFooterTotals();
}

/**
 * Xử lý khi người dùng nhập số
 */
function handleInputChange(index, field, value) {
  const numVal = isNotEmpty(value) ? Number(value) : '';
  const oldVal = roomsData[index][field];
  roomsData[index][field] = numVal;

  if (field === 'dienMoi') {
    const dienCuNum = isNotEmpty(roomsData[index].dienCu) ? Number(roomsData[index].dienCu) : 0;
    if (numVal === '' || (typeof numVal === 'number' && numVal >= dienCuNum)) {
      roomsData[index].confirmedRollover = false;
    } else if (oldVal !== numVal) {
      roomsData[index].confirmedRollover = false;
    }
    if (oldVal !== numVal) {
      roomsData[index].confirmedAnomaly = false;
    }
  }

  updateRowUI(index);
  updateFooterTotals();
}

/**
 * Cập nhật giá trị tính toán trực tiếp trên các node HTML của dòng index
 */
function updateRowUI(index) {
  const tr = document.querySelector(`tr[data-row-index="${index}"]`);
  if (!tr) return;

  const room = roomsData[index];
  const hasDienMoiInput = isNotEmpty(room.dienMoi);
  const hasNuocMoi = isNotEmpty(room.nuocMoi);

  const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
  const dienMoiNum = hasDienMoiInput ? Number(room.dienMoi) : dienCuNum;
  const nuocCuNum = isNotEmpty(room.nuocCu) ? Number(room.nuocCu) : 0;
  const nuocMoiNum = hasNuocMoi ? Number(room.nuocMoi) : nuocCuNum;

  // Nếu điện mới nhỏ hơn điện cũ và chưa xác nhận quay vòng -> tạm thời chưa tính
  const isRolloverUnconfirmed = (appSettings.enableRolloverPopup !== false) && hasDienMoiInput && (dienMoiNum < dienCuNum) && !room.confirmedRollover;

  // Kiểm tra bất thường >= 40% so với tháng trước (nếu đã qua bước quay vòng)
  const prevKwh = Number(room.prevDienKwh) || 0;
  let isAnomalyUnconfirmed = false;
  if ((appSettings.enableAnomalyPopup !== false) && hasDienMoiInput && prevKwh > 0 && !isRolloverUnconfirmed) {
    const surrogateR = { ...room, dienCu: dienCuNum, dienMoi: dienMoiNum };
    const rCalc = typeof calcRoom === 'function' ? calcRoom(surrogateR, appSettings) : null;
    const currKwh = rCalc ? rCalc.dienKwh : Math.max(0, dienMoiNum - dienCuNum);
    const diff = currKwh - prevKwh;
    const percentChange = (diff / prevKwh) * 100;
    if (Math.abs(percentChange) >= 40 && !room.confirmedAnomaly) {
      isAnomalyUnconfirmed = true;
    }
  }

  const hasDienMoi = hasDienMoiInput && !isRolloverUnconfirmed && !isAnomalyUnconfirmed;

  const surrogateRoom = {
    ...room,
    dienCu: dienCuNum,
    dienMoi: dienMoiNum,
    nuocCu: nuocCuNum,
    nuocMoi: nuocMoiNum
  };

  const roomCalc = typeof calcRoom === 'function'
    ? calcRoom(surrogateRoom, appSettings)
    : {
      dienKwh: Math.max(0, dienMoiNum - dienCuNum),
      nuocKhoi: Math.max(0, nuocMoiNum - nuocCuNum),
      tienDien: 0, tienNuoc: 0, tienPhong: appSettings.giaPhong,
      rac: appSettings.tienRac, internet: appSettings.tienInternet,
      haoTaiKwh: 0, tienHaoTai: 0, tongCong: 0
    };

  // Cột Điện (chỉ hiển thị khi đã nhập dienMoi hợp lệ)
  tr.querySelector('.cell-dien-kwh').textContent = hasDienMoi ? (formatNumber(roomCalc.dienKwh) + ' kWh') : '-';
  tr.querySelector('.cell-tien-dien').textContent = hasDienMoi ? (formatNumber(roomCalc.tienDien) + ' đ') : '-';
  tr.querySelector('.cell-hao-tai-kwh').textContent = hasDienMoi ? formatNumber(roomCalc.haoTaiKwh) : '-';
  tr.querySelector('.cell-tien-hao-tai').textContent = hasDienMoi ? (formatNumber(roomCalc.tienHaoTai) + ' đ') : '-';

  // Cột Nước (chỉ hiển thị khi đã nhập nuocMoi)
  tr.querySelector('.cell-nuoc-khoi').textContent = hasNuocMoi ? (formatNumber(roomCalc.nuocKhoi) + ' m³') : '-';
  tr.querySelector('.cell-tien-nuoc').textContent = hasNuocMoi ? (formatNumber(roomCalc.tienNuoc) + ' đ') : '-';

  // Chi phí cố định
  tr.querySelector('.cell-tien-phong').textContent = formatNumber(roomCalc.tienPhong) + ' đ';
  tr.querySelector('.cell-rac').textContent = formatNumber(roomCalc.rac) + ' đ';
  tr.querySelector('.cell-internet').textContent = formatNumber(roomCalc.internet) + ' đ';

  // TỔNG CỘNG (chỉ hiển thị khi ĐÃ CÓ ĐỦ CẢ 2: dienMoi VÀ nuocMoi hợp lệ)
  if (hasDienMoi && hasNuocMoi) {
    tr.querySelector('.cell-tong-cong').textContent = formatNumber(roomCalc.tongCong) + ' đ';
  } else {
    tr.querySelector('.cell-tong-cong').textContent = '-';
  }
}

/**
 * Cập nhật dòng tổng cộng Footer & Stats Overview Cards
 */
function updateFooterTotals() {
  let totalDienKwh = 0;
  let totalNuocKhoi = 0;
  let sumTienDien = 0;
  let sumTienNuoc = 0;
  let sumTienPhong = 0;
  let sumRac = 0;
  let sumInternet = 0;
  let sumHaoTaiKwh = 0;
  let sumTienHaoTai = 0;
  let totalRevenue = 0;
  let fullRoomsCount = 0;

  roomsData.forEach(room => {
    const hasDienMoiInput = isNotEmpty(room.dienMoi);
    const hasNuocMoi = isNotEmpty(room.nuocMoi);

    const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
    const dienMoiNum = hasDienMoiInput ? Number(room.dienMoi) : dienCuNum;
    const nuocCuNum = isNotEmpty(room.nuocCu) ? Number(room.nuocCu) : 0;
    const nuocMoiNum = hasNuocMoi ? Number(room.nuocMoi) : nuocCuNum;

    const isRolloverUnconfirmed = (appSettings.enableRolloverPopup !== false) && hasDienMoiInput && (dienMoiNum < dienCuNum) && !room.confirmedRollover;

    const prevKwh = Number(room.prevDienKwh) || 0;
    let isAnomalyUnconfirmed = false;
    if ((appSettings.enableAnomalyPopup !== false) && hasDienMoiInput && prevKwh > 0 && !isRolloverUnconfirmed) {
      const surrogateR = { ...room, dienCu: dienCuNum, dienMoi: dienMoiNum };
      const rCalc = typeof calcRoom === 'function' ? calcRoom(surrogateR, appSettings) : null;
      const currKwh = rCalc ? rCalc.dienKwh : Math.max(0, dienMoiNum - dienCuNum);
      const diff = currKwh - prevKwh;
      const percentChange = (diff / prevKwh) * 100;
      if (Math.abs(percentChange) >= 40 && !room.confirmedAnomaly) {
        isAnomalyUnconfirmed = true;
      }
    }

    const hasDienMoi = hasDienMoiInput && !isRolloverUnconfirmed && !isAnomalyUnconfirmed;

    const surrogateRoom = {
      ...room,
      dienCu: dienCuNum,
      dienMoi: dienMoiNum,
      nuocCu: nuocCuNum,
      nuocMoi: nuocMoiNum
    };

    const r = typeof calcRoom === 'function'
      ? calcRoom(surrogateRoom, appSettings)
      : { dienKwh: 0, nuocKhoi: 0, tienDien: 0, tienNuoc: 0, tienPhong: 0, rac: 0, internet: 0, haoTaiKwh: 0, tienHaoTai: 0, tongCong: 0 };

    if (hasDienMoi) {
      totalDienKwh += r.dienKwh;
      sumTienDien += r.tienDien;
      sumHaoTaiKwh += r.haoTaiKwh;
      sumTienHaoTai += r.tienHaoTai;
    }

    if (hasNuocMoi) {
      totalNuocKhoi += r.nuocKhoi;
      sumTienNuoc += r.tienNuoc;
    }

    if (hasDienMoi && hasNuocMoi) {
      fullRoomsCount++;
      sumTienPhong += r.tienPhong;
      sumRac += r.rac;
      sumInternet += r.internet;
      totalRevenue += r.tongCong;
    }
  });

  document.getElementById('sum-dien-kwh').textContent = formatNumber(totalDienKwh) + ' kWh';
  document.getElementById('sum-nuoc-khoi').textContent = formatNumber(totalNuocKhoi) + ' m³';
  document.getElementById('sum-tien-dien').textContent = formatNumber(sumTienDien) + ' đ';
  document.getElementById('sum-tien-nuoc').textContent = formatNumber(sumTienNuoc) + ' đ';
  document.getElementById('sum-tien-phong').textContent = formatNumber(sumTienPhong) + ' đ';
  document.getElementById('sum-rac').textContent = formatNumber(sumRac) + ' đ';
  document.getElementById('sum-internet').textContent = formatNumber(sumInternet) + ' đ';
  document.getElementById('sum-hao-tai-kwh').textContent = formatNumber(sumHaoTaiKwh.toFixed(1)) + ' kWh';
  document.getElementById('sum-tien-hao-tai').textContent = formatNumber(sumTienHaoTai) + ' đ';
  document.getElementById('grand-total-revenue').textContent = formatNumber(totalRevenue) + ' đ';

  // Stats cards
  document.getElementById('stat-total-revenue').textContent = formatNumber(totalRevenue) + ' đ';
  document.getElementById('stat-total-kwh').textContent = formatNumber(totalDienKwh) + ' kWh';
  document.getElementById('stat-total-water').textContent = formatNumber(totalNuocKhoi) + ' m³';
  document.getElementById('stat-total-rooms').textContent = `${fullRoomsCount} / ${roomsData.length}`;
}

/**
 * Xử lý phím điều hướng Excel (Enter: Xuống phòng dưới, Shift+Enter: Lên phòng trên, Tab: Sang ô kế)
 */
function handleTableKeyDown(event) {
  const input = event.target;
  if (!input.classList.contains('table-input')) return;

  const rowIndex = parseInt(input.getAttribute('data-row'), 10);
  const field = input.getAttribute('data-field');

  if (event.key === 'Enter') {
    event.preventDefault();
    const targetRowIndex = event.shiftKey ? rowIndex - 1 : rowIndex + 1;
    const targetInput = document.querySelector(`.table-input[data-row="${targetRowIndex}"][data-field="${field}"]`);

    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    } else if (!event.shiftKey && targetRowIndex >= roomsData.length) {
      const nextField = getNextField(field);
      if (nextField) {
        const firstInput = document.querySelector(`.table-input[data-row="0"][data-field="${nextField}"]`);
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
      }
    }
  } else if (event.key === 'Tab') {
    setTimeout(() => {
      if (document.activeElement && document.activeElement.classList.contains('table-input')) {
        document.activeElement.select();
      }
    }, 10);
  }
}

/**
 * Lấy tên cột tiếp theo để chuyển ô khi Enter ở cuối danh sách
 */
function getNextField(currentField) {
  const fields = ['dienCu', 'dienMoi', 'nuocCu', 'nuocMoi'];
  const idx = fields.indexOf(currentField);
  if (idx >= 0 && idx < fields.length - 1) {
    return fields[idx + 1];
  }
  return null;
}

/**
 * Sự kiện chọn Tháng - Năm
 */
async function onMonthYearChange() {
  const monthYear = document.getElementById('month-year-select').value;
  await loadRoomsForMonth(monthYear);
  showToast(`Đã chuyển sang ${monthYear}`, 'success');
}

/**
 * Lưu Cài Đặt Giá & Thư mục
 */
async function saveSettings(event) {
  event.preventDefault();
  const baseFolderInput = document.getElementById('set-baseFolder');
  const selectedPath = baseFolderInput ? baseFolderInput.value.trim() : "";

  // Kiểm tra thư mục trước tiên: Nếu chưa nhập/chọn thư mục
  if (!selectedPath) {
    if (baseFolderInput) {
      baseFolderInput.classList.add('input-error');
      baseFolderInput.focus();
    }
    showToast('Vui lòng chọn "Thư mục lưu ảnh & PDF phiếu thu" trước khi lưu cài đặt!', 'error');
    return;
  }

  appSettings.baseFolder = selectedPath;
  appSettings.giaPhong = Number(document.getElementById('set-giaPhong').value) || 0;
  appSettings.giaDien = Number(document.getElementById('set-giaDien').value) || 0;
  appSettings.giaNuoc = Number(document.getElementById('set-giaNuoc').value) || 0;
  appSettings.tienRac = Number(document.getElementById('set-rac').value) || 0;
  appSettings.tienInternet = Number(document.getElementById('set-internet').value) || 0;
  appSettings.tyLeHaoTai = (Number(document.getElementById('set-tileHaoTai').value) || 0) / 100;
  appSettings.dienThoai = document.getElementById('set-dienThoai').value;

  const rolloverCheck = document.getElementById('set-enableRolloverPopup');
  if (rolloverCheck) appSettings.enableRolloverPopup = rolloverCheck.checked;

  const anomalyCheck = document.getElementById('set-enableAnomalyPopup');
  if (anomalyCheck) appSettings.enableAnomalyPopup = anomalyCheck.checked;

  const bankNameInput = document.getElementById('set-bankName');
  if (bankNameInput) appSettings.bankName = bankNameInput.value.trim();

  const bankAccountInput = document.getElementById('set-bankAccount');
  if (bankAccountInput) appSettings.bankAccount = bankAccountInput.value.trim();

  const bankOwnerInput = document.getElementById('set-bankOwner');
  if (bankOwnerInput) appSettings.bankOwner = bankOwnerInput.value.trim();

  const ok = await saveSettingsFile();

  if (!ok) {
    if (baseFolderInput) baseFolderInput.classList.add('input-error');
    return false; // Đã báo lỗi trong saveSettingsFile, dừng tại đây
  }

  isSettingsDirty = false;
  isBankDirty = false;
  clearBankFieldsError();

  // Đã lưu thành công
  if (baseFolderInput) baseFolderInput.classList.remove('input-error');

  roomsData.forEach(r => {
    r.tienPhong = appSettings.giaPhong;
  });

  roomsData.forEach((_, idx) => updateRowUI(idx));
  updateFooterTotals();
  showToast("Đã lưu cài đặt giá và thư mục lưu thành công!", 'success');
  return true;
}

/**
 * Nút duy nhất "Lưu & Xuất":
 * 0. Lưu dữ liệu tháng hiện tại -> xong mới tiếp tục
 * 1. Kiểm tra baseFolder -> chưa chọn thì báo lỗi dừng lại
 * 2. Gọi IPC exportReceipts -> mở BrowserWindow ẩn, render 12 phòng, xuất 12 JPG + 1 PDF gộp
 * 3. Tự động mở thư mục xuất
 */
async function saveAndExport() {
  if (isSettingsDirty || isBankDirty) {
    if (isBankDirty) {
      highlightUnsavedBankFields();
    }
    pendingActionAfterUnsavedModal = () => saveAndExport();
    showUnsavedSettingsModal();
    return;
  }

  const btn = document.getElementById('btn-save-export');
  const btnText = document.getElementById('btn-save-export-text');
  const currentMonthYear = document.getElementById('month-year-select').value;

  // Khóa nút tránh bấm trùng lập
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Đang lưu dữ liệu...";

  try {
    // Bước 0: Lưu dữ liệu tháng hiện tại
    const saveDataArray = roomsData.map(r => ({
      phong: r.phong,
      dienCu: isNotEmpty(r.dienCu) ? Number(r.dienCu) : '',
      dienMoi: isNotEmpty(r.dienMoi) ? Number(r.dienMoi) : '',
      nuocCu: isNotEmpty(r.nuocCu) ? Number(r.nuocCu) : '',
      nuocMoi: isNotEmpty(r.nuocMoi) ? Number(r.nuocMoi) : ''
    }));

    const saveSuccess = await writeHistoryFile(currentMonthYear, saveDataArray);
    if (!saveSuccess) {
      showToast(`Không thể lưu file lịch sử ${currentMonthYear}.json!`, 'error');
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = "Lưu & Xuất";
      return;
    }

    // Bước 1: Kiểm tra thư mục baseFolder
    if (!appSettings.baseFolder || appSettings.baseFolder.trim() === '') {
      const baseFolderInput = document.getElementById('set-baseFolder');
      if (baseFolderInput) {
        baseFolderInput.classList.add('input-error');
        baseFolderInput.focus();
      }
      showToast('Vui lòng vào Cài đặt chung để chọn "Thư mục lưu ảnh/PDF" trước khi xuất!', 'error');
      switchTab('settings');
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = "Lưu & Xuất";
      return;
    }

    // Lấy dữ liệu đã qua tính toán calcRoom của 12 phòng
    const surrogateRoomsData = roomsData.map(r => {
      const hasDienMoi = isNotEmpty(r.dienMoi);
      const hasNuocMoi = isNotEmpty(r.nuocMoi);
      const dienCuNum = isNotEmpty(r.dienCu) ? Number(r.dienCu) : 0;
      const dienMoiNum = hasDienMoi ? Number(r.dienMoi) : dienCuNum;
      const nuocCuNum = isNotEmpty(r.nuocCu) ? Number(r.nuocCu) : 0;
      const nuocMoiNum = hasNuocMoi ? Number(r.nuocMoi) : nuocCuNum;

      return {
        ...r,
        dienCu: dienCuNum,
        dienMoi: dienMoiNum,
        nuocCu: nuocCuNum,
        nuocMoi: nuocMoiNum
      };
    });

    const calcResult = typeof calcAllRooms === 'function'
      ? calcAllRooms(surrogateRoomsData, appSettings)
      : { rooms: [] };

    // Bước 2: Gọi IPC xuất ảnh & PDF
    if (btnText) btnText.textContent = "Đang xuất... 0/12";

    if (window.api && typeof window.api.exportReceipts === 'function') {
      const res = await window.api.exportReceipts(currentMonthYear, calcResult.rooms);

      if (res && res.canceled) {
        showToast("Đã hủy xuất theo yêu cầu.", 'info');
      } else if (res && res.error) {
        if (res.error === 'CHUA_CHON_THU_MUC') {
          showToast(res.message, 'error');
          switchTab('settings');
        } else {
          showToast(`Lỗi khi xuất ảnh/PDF: ${res.error}`, 'error');
        }
      } else if (res && res.success) {
        showToast(`Đã lưu và xuất thành công ${res.jpgCount} ảnh JPG + 1 file PDF (${res.pdfFile})!`, 'success');
        await populateMonthSelect();
      }
    } else {
      showToast("Chức năng xuất ảnh JPG & PDF gộp chỉ khả dụng trên Electron app!", 'error');
    }
  } catch (err) {
    console.error('Lỗi trong saveAndExport:', err);
    showToast(`Có lỗi xảy ra: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Lưu & Xuất";
  }
}

/**
 * Hiển thị thông báo Toast ở góc dưới phải mượt mà
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Xóa toast cũ có cùng nội dung để tránh trùng lặp
  const existingToasts = Array.from(container.querySelectorAll('.toast'));
  for (const t of existingToasts) {
    if (t.textContent.trim() === message.trim()) {
      t.remove();
    }
  }

  // Giới hạn tối đa 2 toast cùng hiển thị
  while (container.children.length >= 2) {
    container.firstElementChild.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === 'warning' || type === 'info') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }

  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      ${iconSvg}
      <span>${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ============================================================
   XỬ LÝ MODAL XÁC NHẬN ĐỒNG HỒ ĐIỆN QUAY VÒNG (ĐIỆN MỚI < ĐIỆN CŨ)
   ============================================================ */
let currentRolloverIndex = null;

/**
 * Kiểm tra khi người dùng rời khỏi ô nhập Điện Mới (blur)
 */
function handleDienMoiBlur(index) {
  const room = roomsData[index];
  if (!room) return;

  const hasDienMoi = isNotEmpty(room.dienMoi);
  if (!hasDienMoi) return;

  const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
  const dienMoiNum = Number(room.dienMoi);

  // 1. Kiểm tra đồng hồ quay vòng (Điện Mới < Điện Cũ) - Chỉ chạy khi BẬT toggle
  if (appSettings.enableRolloverPopup !== false && dienMoiNum < dienCuNum && !room.confirmedRollover) {
    showRolloverModal(index);
    return;
  }

  // 2. Kiểm tra bất thường >= 40% so với tháng trước - Chỉ chạy khi BẬT toggle
  const prevKwh = Number(room.prevDienKwh) || 0;
  if (appSettings.enableAnomalyPopup !== false && prevKwh > 0 && (dienMoiNum >= dienCuNum || room.confirmedRollover)) {
    const surrogate = { ...room, dienCu: dienCuNum, dienMoi: dienMoiNum };
    const roomCalc = typeof calcRoom === 'function' ? calcRoom(surrogate, appSettings) : null;
    const currKwh = roomCalc ? roomCalc.dienKwh : Math.max(0, dienMoiNum - dienCuNum);

    const diff = currKwh - prevKwh;
    const percentChange = (diff / prevKwh) * 100;

    if (Math.abs(percentChange) >= 40 && !room.confirmedAnomaly) {
      showAnomalyModal(index);
    }
  }
}

/**
 * Hiển thị Modal xác nhận quay vòng
 */
function showRolloverModal(index) {
  const room = roomsData[index];
  if (!room) return;

  const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
  const dienMoiNum = isNotEmpty(room.dienMoi) ? Number(room.dienMoi) : 0;
  const maxDongHo = typeof MAX_DONG_HO_DIEN !== 'undefined' ? MAX_DONG_HO_DIEN : 10000;
  const dienTieuThu = (maxDongHo + dienMoiNum) - dienCuNum;

  currentRolloverIndex = index;

  const roomNameEl = document.getElementById('modal-room-name');
  const dienCuEl = document.getElementById('modal-dien-cu');
  const dienMoiEl = document.getElementById('modal-dien-moi');
  const dienTieuThuEl = document.getElementById('modal-dien-tieu-thu');
  const modalEl = document.getElementById('rollover-modal');

  if (roomNameEl) roomNameEl.textContent = room.phong;
  if (dienCuEl) dienCuEl.textContent = formatNumber(dienCuNum);
  if (dienMoiEl) dienMoiEl.textContent = formatNumber(dienMoiNum);
  if (dienTieuThuEl) dienTieuThuEl.textContent = formatNumber(dienTieuThu) + ' kWh';

  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

/**
 * Nút Xác nhận trên Modal: Chấp nhận tính theo đồng hồ quay vòng
 */
function confirmRolloverModal() {
  if (currentRolloverIndex !== null && roomsData[currentRolloverIndex]) {
    const idx = currentRolloverIndex;
    roomsData[idx].confirmedRollover = true;
    updateRowUI(idx);
    updateFooterTotals();
    showToast(`Đã áp dụng phương pháp đồng hồ quay vòng cho phòng ${roomsData[idx].phong}`, 'success');

    // Sau khi xác nhận quay vòng, kiểm tra tiếp xem có bị bất thường >= 40% không
    closeRolloverModal();

    const room = roomsData[idx];
    const prevKwh = Number(room.prevDienKwh) || 0;
    if (prevKwh > 0) {
      const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
      const dienMoiNum = isNotEmpty(room.dienMoi) ? Number(room.dienMoi) : 0;
      const surrogate = { ...room, dienCu: dienCuNum, dienMoi: dienMoiNum };
      const roomCalc = typeof calcRoom === 'function' ? calcRoom(surrogate, appSettings) : null;
      const currKwh = roomCalc ? roomCalc.dienKwh : Math.max(0, dienMoiNum - dienCuNum);
      const diff = currKwh - prevKwh;
      const percentChange = (diff / prevKwh) * 100;

      if (Math.abs(percentChange) >= 40 && !room.confirmedAnomaly) {
        setTimeout(() => showAnomalyModal(idx), 100);
      }
    }
  } else {
    closeRolloverModal();
  }
}

/**
 * Nút Hủy trên Modal: Xóa dữ liệu ô vừa nhập sai và focus lại
 */
function cancelRolloverModal() {
  if (currentRolloverIndex !== null && roomsData[currentRolloverIndex]) {
    const idx = currentRolloverIndex;
    roomsData[idx].dienMoi = '';
    roomsData[idx].confirmedRollover = false;

    const inputEl = document.querySelector(`input[data-row="${idx}"][data-field="dienMoi"]`);
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => inputEl.focus(), 50);
    }

    updateRowUI(idx);
    updateFooterTotals();
    showToast(`Đã xóa số điện mới nhập sai của phòng ${roomsData[idx].phong}`, 'warning');
  }
  closeRolloverModal();
}

/**
 * Đóng Modal quay vòng
 */
function closeRolloverModal() {
  currentRolloverIndex = null;
  const modalEl = document.getElementById('rollover-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
}

/* ============================================================
   XỬ LÝ MODAL CẢNH BÁO SỐ ĐIỆN TIÊU THỤ BẤT THƯỜNG (CHÊNH LỆCH ≥ 40%)
   ============================================================ */
let currentAnomalyIndex = null;

/**
 * Hiển thị Modal Cảnh báo số điện bất thường
 */
function showAnomalyModal(index) {
  const room = roomsData[index];
  if (!room) return;

  const dienCuNum = isNotEmpty(room.dienCu) ? Number(room.dienCu) : 0;
  const dienMoiNum = isNotEmpty(room.dienMoi) ? Number(room.dienMoi) : 0;
  const surrogate = { ...room, dienCu: dienCuNum, dienMoi: dienMoiNum };
  const roomCalc = typeof calcRoom === 'function' ? calcRoom(surrogate, appSettings) : null;
  const currKwh = roomCalc ? roomCalc.dienKwh : Math.max(0, dienMoiNum - dienCuNum);
  const prevKwh = Number(room.prevDienKwh) || 0;

  const diff = currKwh - prevKwh;
  const percentChange = prevKwh > 0 ? (diff / prevKwh) * 100 : 0;
  const signStr = percentChange > 0 ? '+' : '';
  const percentStr = `${signStr}${percentChange.toFixed(1)}%`;

  currentAnomalyIndex = index;

  const roomNameEl = document.getElementById('anomaly-room-name');
  const prevKwhEl = document.getElementById('anomaly-prev-kwh');
  const currKwhEl = document.getElementById('anomaly-curr-kwh');
  const percentDiffEl = document.getElementById('anomaly-percent-diff');
  const modalEl = document.getElementById('anomaly-modal');

  if (roomNameEl) roomNameEl.textContent = room.phong;
  if (prevKwhEl) prevKwhEl.textContent = `${formatNumber(prevKwh)} kWh`;
  if (currKwhEl) currKwhEl.textContent = `${formatNumber(currKwh)} kWh`;
  if (percentDiffEl) {
    percentDiffEl.textContent = percentStr;
    if (percentChange > 0) {
      percentDiffEl.className = 'text-danger';
    } else {
      percentDiffEl.className = 'text-warning';
    }
  }

  if (modalEl) {
    modalEl.style.display = 'flex';
  }
}

/**
 * Nút Xác nhận trên Modal Bất thường: Giữ nguyên số liệu vừa nhập
 */
function confirmAnomalyModal() {
  if (currentAnomalyIndex !== null && roomsData[currentAnomalyIndex]) {
    roomsData[currentAnomalyIndex].confirmedAnomaly = true;
    updateRowUI(currentAnomalyIndex);
    updateFooterTotals();
    showToast(`Đã xác nhận số điện phòng ${roomsData[currentAnomalyIndex].phong} bình thường`, 'success');
  }
  closeAnomalyModal();
}

/**
 * Nút Hủy trên Modal Bất thường: Xóa ô nhập và focus lại
 */
function cancelAnomalyModal() {
  if (currentAnomalyIndex !== null && roomsData[currentAnomalyIndex]) {
    const idx = currentAnomalyIndex;
    roomsData[idx].dienMoi = '';
    roomsData[idx].confirmedAnomaly = false;

    const inputEl = document.querySelector(`input[data-row="${idx}"][data-field="dienMoi"]`);
    if (inputEl) {
      inputEl.value = '';
      setTimeout(() => {
        inputEl.focus();
        if (typeof inputEl.select === 'function') inputEl.select();
      }, 50);
    }

    updateRowUI(idx);
    updateFooterTotals();
    showToast(`Đã xóa số điện mới nhập của phòng ${roomsData[idx].phong}`, 'warning');
  }
  closeAnomalyModal();
}

/**
 * Đóng Modal Bất thường
 */
function closeAnomalyModal() {
  currentAnomalyIndex = null;
  const modalEl = document.getElementById('anomaly-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
}

/* ============================================================
   XỬ LÝ MODAL CẢNH BÁO THAY ĐỔI CÀI ĐẶT CHƯA LƯU & LƯU TÀI KHOẢN NGÂN HÀNG
   ============================================================ */
let isSettingsDirty = false;
let isBankDirty = false;
let pendingActionAfterUnsavedModal = null;

function markSettingsDirty() {
  isSettingsDirty = true;
}

function markBankDirty() {
  isBankDirty = true;
}

function highlightUnsavedBankFields() {
  const customBankSelect = document.getElementById('custom-bank-select');
  const bankAccountInput = document.getElementById('set-bankAccount');
  const bankOwnerInput = document.getElementById('set-bankOwner');

  if (customBankSelect) customBankSelect.classList.add('input-error');
  if (bankAccountInput) bankAccountInput.classList.add('input-error');
  if (bankOwnerInput) bankOwnerInput.classList.add('input-error');
}

function clearBankFieldsError() {
  const customBankSelect = document.getElementById('custom-bank-select');
  const bankAccountInput = document.getElementById('set-bankAccount');
  const bankOwnerInput = document.getElementById('set-bankOwner');

  if (customBankSelect) customBankSelect.classList.remove('input-error');
  if (bankAccountInput) bankAccountInput.classList.remove('input-error');
  if (bankOwnerInput) bankOwnerInput.classList.remove('input-error');
}

/**
 * Lưu Cài Đặt Tài Khoản Ngân Hàng (My Bank) vào settings.json
 */
async function saveBankSettings(event) {
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const bankNameInput = document.getElementById('set-bankName');
  const bankAccountInput = document.getElementById('set-bankAccount');
  const bankOwnerInput = document.getElementById('set-bankOwner');

  const bankName = bankNameInput ? bankNameInput.value.trim() : "";
  const bankAccount = bankAccountInput ? bankAccountInput.value.trim() : "";
  const bankOwner = bankOwnerInput ? bankOwnerInput.value.trim().toUpperCase() : "";

  appSettings.bankName = bankName;
  appSettings.bankAccount = bankAccount;
  appSettings.bankOwner = bankOwner;

  const ok = await saveSettingsFile();
  if (!ok) {
    showToast("Lỗi khi lưu thông tin tài khoản ngân hàng!", "error");
    return false;
  }

  isBankDirty = false;
  clearBankFieldsError();
  showToast("Đã lưu thông tin tài khoản ngân hàng thành công!", "success");
  return true;
}

function showUnsavedSettingsModal() {
  const modalEl = document.getElementById('unsaved-settings-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

async function confirmSaveUnsavedSettingsModal() {
  closeUnsavedSettingsModal();
  let ok = true;
  if (isSettingsDirty) {
    const fakeEvent = { preventDefault: () => {} };
    const res = await saveSettings(fakeEvent);
    if (res === false) ok = false;
  }
  if (isBankDirty) {
    const res = await saveBankSettings();
    if (res === false) ok = false;
  }
  if (ok && typeof pendingActionAfterUnsavedModal === 'function') {
    const action = pendingActionAfterUnsavedModal;
    pendingActionAfterUnsavedModal = null;
    action();
  }
}

function discardUnsavedSettingsModal() {
  closeUnsavedSettingsModal();
  initSettingsForm();
  isSettingsDirty = false;
  isBankDirty = false;
  clearBankFieldsError();
  if (typeof pendingActionAfterUnsavedModal === 'function') {
    const action = pendingActionAfterUnsavedModal;
    pendingActionAfterUnsavedModal = null;
    action();
  }
}

function cancelUnsavedSettingsModal() {
  pendingActionAfterUnsavedModal = null;
  closeUnsavedSettingsModal();
}

function closeUnsavedSettingsModal() {
  const modalEl = document.getElementById('unsaved-settings-modal');
  if (modalEl) modalEl.style.display = 'none';
}

/* ============================================================
   XỬ LÝ TỰ ĐỘNG CẬP NHẬT (ELECTRON UPDATER)
   ============================================================ */
let isManualUpdateCheck = false;

function initAutoUpdaterListeners() {
  if (!window.api) return;

  if (typeof window.api.onUpdateAvailable === 'function') {
    window.api.onUpdateAvailable((info) => {
      resetCheckUpdateBtnUI();
      showUpdateModal(info);
    });
  }

  if (typeof window.api.onUpdateNotAvailable === 'function') {
    window.api.onUpdateNotAvailable((info) => {
      resetCheckUpdateBtnUI();
      if (isManualUpdateCheck) {
        const ver = info ? info.version : '';
        showToast(ver ? `Bạn đang sử dụng phiên bản mới nhất (v${ver})!` : 'Bạn đang sử dụng phiên bản mới nhất!', 'success');
        isManualUpdateCheck = false;
      }
    });
  }

  if (typeof window.api.onDownloadProgress === 'function') {
    window.api.onDownloadProgress((progressObj) => {
      updateDownloadProgressUI(progressObj);
    });
  }

  if (typeof window.api.onUpdateDownloaded === 'function') {
    window.api.onUpdateDownloaded((info) => {
      // Ẩn state tải, hiện state 3 Đã tải xong & đếm ngược
      const promptState = document.getElementById('update-state-prompt');
      const downloadState = document.getElementById('update-state-downloading');
      const installingState = document.getElementById('update-state-installing');
      const footerEl = document.getElementById('update-modal-footer');

      if (promptState) promptState.style.display = 'none';
      if (downloadState) downloadState.style.display = 'none';
      if (footerEl) footerEl.style.display = 'none';
      if (installingState) installingState.style.display = 'block';

      const modalTitle = document.getElementById('update-modal-title');
      const modalSubtitle = document.getElementById('update-modal-subtitle');
      if (modalTitle) modalTitle.textContent = 'Đang chuẩn bị nâng cấp...';
      if (modalSubtitle) modalSubtitle.textContent = 'Hệ thống sẽ tự động khởi động lại';

      // Chạy hiệu ứng đếm ngược 3 giây
      let count = 3;
      const countEl = document.getElementById('update-countdown-text');
      if (countEl) countEl.textContent = '3 giây';

      const interval = setInterval(() => {
        count--;
        if (countEl) {
          if (count > 0) {
            countEl.textContent = `${count} giây`;
          } else {
            countEl.textContent = `giây lát...`;
            clearInterval(interval);
          }
        }
      }, 1000);

      showToast('Đã tải xong bản mới 100%! Ứng dụng sẽ tự động mở lại sau giây lát...', 'success');
    });
  }

  if (typeof window.api.onUpdateError === 'function') {
    window.api.onUpdateError((err) => {
      resetCheckUpdateBtnUI();
      if (isManualUpdateCheck) {
        showToast(`Lỗi kiểm tra cập nhật: ${err.message || 'Không kết nối được máy chủ'}`, 'error');
        isManualUpdateCheck = false;
      }
    });
  }

  // Tự động kiểm tra bản mới ngầm sau khi mở app 3.5 giây
  setTimeout(() => {
    if (window.api && typeof window.api.checkForUpdates === 'function') {
      window.api.checkForUpdates().catch(() => {});
    }
  }, 3500);
}

/**
 * Nút Kiểm Tra Cập Nhật thủ công trong tab Cài Đặt Chung
 */
async function checkUpdateManual() {
  if (!window.api || typeof window.api.checkForUpdates !== 'function') {
    showToast('Chức năng kiểm tra cập nhật chỉ khả dụng trên bản cài đặt Electron!', 'error');
    return;
  }

  const btnText = document.getElementById('btn-check-update-text');
  const btn = document.getElementById('btn-check-update');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Đang kiểm tra...';

  isManualUpdateCheck = true;

  try {
    const res = await window.api.checkForUpdates();
    if (res && res.error) {
      resetCheckUpdateBtnUI();
      showToast(`Lỗi kiểm tra cập nhật: ${res.error}`, 'error');
      isManualUpdateCheck = false;
    }
  } catch (err) {
    resetCheckUpdateBtnUI();
    showToast(`Không thể kết nối máy chủ cập nhật: ${err.message}`, 'error');
    isManualUpdateCheck = false;
  }
}

function resetCheckUpdateBtnUI() {
  const btnText = document.getElementById('btn-check-update-text');
  const btn = document.getElementById('btn-check-update');
  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = 'Kiểm Tra Cập Nhật';
}

/**
 * Hiển thị Pop-up Cảnh báo phát hiện phiên bản mới
 */
function showUpdateModal(info) {
  const modalEl = document.getElementById('update-modal');
  if (!modalEl) return;

  const currentVerTag = document.getElementById('app-version-tag');
  const currentVerStr = currentVerTag ? currentVerTag.textContent.replace('v', '') : '2.3.7';

  const targetVer = info && info.version ? info.version : 'mới';

  const modalTitle = document.getElementById('update-modal-title');
  const modalSubtitle = document.getElementById('update-modal-subtitle');
  if (modalTitle) modalTitle.textContent = 'Phát hiện phiên bản mới';
  if (modalSubtitle) modalSubtitle.textContent = 'Đã có bản cập nhật mới trên hệ thống';

  document.getElementById('update-curr-version').textContent = `v${currentVerStr}`;
  document.getElementById('update-new-version').textContent = `v${targetVer}`;
  document.getElementById('update-target-version').textContent = `v${targetVer}`;
  document.getElementById('update-download-version').textContent = `v${targetVer}`;

  document.getElementById('update-state-prompt').style.display = 'block';
  document.getElementById('update-state-downloading').style.display = 'none';
  const installingState = document.getElementById('update-state-installing');
  if (installingState) installingState.style.display = 'none';

  document.getElementById('update-modal-footer').style.display = 'flex';

  modalEl.style.display = 'flex';
}

/**
 * Nút "Cập nhật ngay" trên Pop-up
 */
async function startDownloadUpdateNow() {
  document.getElementById('update-state-prompt').style.display = 'none';
  document.getElementById('update-state-downloading').style.display = 'block';
  document.getElementById('update-modal-footer').style.display = 'none';

  const fillEl = document.getElementById('update-progress-fill');
  const percentEl = document.getElementById('update-progress-percent');
  const speedEl = document.getElementById('update-progress-speed');
  if (fillEl) fillEl.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (speedEl) speedEl.textContent = '0 MB/s';

  if (window.api && typeof window.api.startDownloadUpdate === 'function') {
    const res = await window.api.startDownloadUpdate();
    if (res && res.error) {
      showToast(`Không thể tải bản cập nhật: ${res.error}`, 'error');
      cancelUpdateModal();
    }
  }
}

/**
 * Cập nhật giao diện thanh phần trăm % và tốc độ MB/s
 */
function updateDownloadProgressUI(progressObj) {
  const percent = progressObj.percent || 0;
  const bytesPerSec = progressObj.bytesPerSecond || 0;

  const fillEl = document.getElementById('update-progress-fill');
  const percentEl = document.getElementById('update-progress-percent');
  const speedEl = document.getElementById('update-progress-speed');

  if (fillEl) fillEl.style.width = `${percent}%`;
  if (percentEl) percentEl.textContent = `${percent}%`;

  let speedText = '0 KB/s';
  if (bytesPerSec >= 1024 * 1024) {
    speedText = `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  } else if (bytesPerSec > 0) {
    speedText = `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }

  if (speedEl) speedEl.textContent = speedText;
}

function cancelUpdateModal() {
  const modalEl = document.getElementById('update-modal');
  if (modalEl) modalEl.style.display = 'none';
  isManualUpdateCheck = false;
}

/* ============================================================
   PHẦN 3: QUẢN LÝ PHÒNG & NGƯỜI Ở
   ============================================================ */

let residentsList = []; // Danh sách người thuê từ residents.json
let roomsList = [];     // Danh sách 12 phòng từ rooms.json
let selectedResidentIds = new Set(); // Set các ID người được chọn trong bảng để xóa hàng loạt
let editingResidentId = null; // null: Thêm mới, string ID: Sửa
let currentDetailRoomName = null; // Tên phòng đang mở modal chi tiết (vd: '1A')
let residentSearchTerm = ''; // Từ khóa tìm kiếm người thuê
let residentsToDelete = []; // Danh sách ID người chuẩn bị xóa

// Date pickers cho Form Người thuê
let pickerNgaySinh = null;
let pickerNgayVaoO = null;

/**
 * Khởi tạo DatePicker cho Ngày Sinh & Ngày Vào Ở
 */
function initDatePickers() {
  try {
    const wrapNgaySinh = document.getElementById('wrap-res-ngaySinh');
    const wrapNgayVaoO = document.getElementById('wrap-res-ngayVaoO');
    if (wrapNgaySinh && typeof DatePicker !== 'undefined') {
      if (!pickerNgaySinh) {
        pickerNgaySinh = new DatePicker(wrapNgaySinh, { yearsBack: 110, yearsForward: 10 });
        pickerNgaySinh.onChange(() => clearFieldError('res-ngaySinh'));
      }
    }
    if (wrapNgayVaoO && typeof DatePicker !== 'undefined') {
      if (!pickerNgayVaoO) {
        pickerNgayVaoO = new DatePicker(wrapNgayVaoO, { yearsBack: 50, yearsForward: 10 });
        pickerNgayVaoO.onChange(() => clearFieldError('res-ngayVaoO'));
      }
    }
  } catch (err) {
    console.error('Lỗi khởi tạo DatePicker:', err);
  }
}

// Quản lý trạng thái Lightbox xem ảnh CCCD
let currentLightboxResidentId = null;
let currentLightboxType = 'mat_truoc';

// Bộ đệm ảnh CCCD khi thao tác trên Form modal
let resFormCccdImages = {
  mat_truoc: null, // { dataUrl, path, changed: boolean, removed: boolean }
  mat_sau: null
};

/**
 * Hiển thị dòng chữ đỏ thông báo lỗi dưới ô nhập cụ thể và viền đỏ ô đó
 */
function setFieldError(fieldId, message) {
  const inputEl = document.getElementById(fieldId);
  const wrapEl = fieldId.startsWith('res-ngay') ? document.getElementById('wrap-' + fieldId) : null;
  const fieldContainer = inputEl ? inputEl.closest('.field') : (wrapEl ? wrapEl.closest('.field') : null);
  const errEl = document.getElementById('err-' + fieldId);

  if (fieldContainer) fieldContainer.classList.add('has-error');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.add('visible');
  }
}

/**
 * Xóa thông báo lỗi đỏ cho một ô nhập
 */
function clearFieldError(fieldId) {
  const inputEl = document.getElementById(fieldId);
  const wrapEl = fieldId.startsWith('res-ngay') ? document.getElementById('wrap-' + fieldId) : null;
  const fieldContainer = inputEl ? inputEl.closest('.field') : (wrapEl ? wrapEl.closest('.field') : null);
  const errEl = document.getElementById('err-' + fieldId);

  if (fieldContainer) fieldContainer.classList.remove('has-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.remove('visible');
  }
}

/**
 * Xóa toàn bộ các dòng thông báo lỗi đỏ trên form
 */
function clearAllFieldErrors() {
  document.querySelectorAll('#resident-form-modal .field.has-error').forEach(el => el.classList.remove('has-error'));
  document.querySelectorAll('#resident-form-modal .field-error-msg.visible').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
}

/**
 * Ràng buộc chỉ cho phép nhập số 0-9, chặn triệt để chữ cái và ký tự đặc biệt,
 * KHÔNG làm mất các số đã gõ trước đó khi gõ nhầm chữ (kể cả khi bật bộ gõ tiếng Việt Unikey/EVKey)
 */
function restrictDigitsOnly(inputEl, maxLength) {
  if (!inputEl) return;

  // 1. Chặn ngay trước khi ký tự được đưa vào input
  inputEl.addEventListener('beforeinput', (e) => {
    if (e.data && !/^\d+$/.test(e.data)) {
      e.preventDefault();
    }
  });

  // 2. Chặn các phím chữ cái thông thường trên keydown mà KHÔNG chặn phím điều hướng hay phím điều khiển
  inputEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Bỏ qua các phím điều khiển dài hơn 1 ký tự (Backspace, Delete, Tab, Arrow, Process, v.v.)
    if (e.key.length > 1) return;

    // Nếu là ký tự đơn lẻ nhưng không phải chữ số 0-9 thì chặn
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  });

  // 3. Fallback khi input thay đổi: loại bỏ ký tự không phải số mà giữ nguyên các số đã nhập
  inputEl.addEventListener('input', (e) => {
    const raw = inputEl.value;
    const clean = raw.replace(/\D/g, '');
    const finalVal = maxLength ? clean.slice(0, maxLength) : clean;
    if (raw !== finalVal) {
      const cursor = inputEl.selectionStart || 0;
      inputEl.value = finalVal;
      const newCursor = Math.min(cursor - (raw.length - finalVal.length), finalVal.length);
      inputEl.setSelectionRange(Math.max(0, newCursor), Math.max(0, newCursor));
    }
  });

  // 4. Xử lý khi dán (paste)
  inputEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasteText = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const clean = pasteText.replace(/\D/g, '');
    if (!clean) return;

    const current = inputEl.value;
    const start = inputEl.selectionStart || 0;
    const end = inputEl.selectionEnd || 0;
    let nextVal = current.slice(0, start) + clean + current.slice(end);
    if (maxLength && nextVal.length > maxLength) {
      nextVal = nextVal.slice(0, maxLength);
    }
    inputEl.value = nextVal;
    const newPos = Math.min(start + clean.length, nextVal.length);
    inputEl.setSelectionRange(newPos, newPos);
    inputEl.dispatchEvent(new Event('input'));
  });
}

/**
 * Kiểm tra định dạng ngày VN (dd/mm/yyyy) và tính hợp lệ lịch
 */
function isValidDateVN(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;
  const d = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
  const testDate = new Date(y, m - 1, d);
  return testDate.getFullYear() === y && testDate.getMonth() === (m - 1) && testDate.getDate() === d;
}

/**
 * Chuẩn hóa ngày dạng d/m/yyyy sang dd/mm/yyyy
 */
function normalizeDateVN(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return dateStr.trim();
  const d = String(parseInt(match[1], 10)).padStart(2, '0');
  const m = String(parseInt(match[2], 10)).padStart(2, '0');
  const y = match[3];
  return `${d}/${m}/${y}`;
}

/**
 * Kiểm tra định dạng SĐT Việt Nam (10 số, bắt đầu 03, 05, 07, 08, 09)
 */
function isValidPhoneVN(phoneStr) {
  if (!phoneStr) return false;
  const clean = String(phoneStr).replace(/[\s.-]/g, '');
  return /^(0[35789])[0-9]{8}$/.test(clean);
}

/**
 * Kiểm tra định dạng CCCD Việt Nam (đúng 12 chữ số)
 */
function isValidCccd(cccdStr) {
  if (!cccdStr) return false;
  const clean = String(cccdStr).replace(/\s+/g, '');
  return /^\d{12}$/.test(clean);
}

/**
 * Escape HTML để ngăn ngừa lỗi hiển thị hoặc XSS
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Chuyển chuỗi tiếng Việt có dấu thành không dấu để phục vụ tìm kiếm thông minh
 */
function removeVietnameseTones(str) {
  if (!str) return '';
  str = String(str).toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '');
  str = str.replace(/\u02C6|\u0306|\u031B/g, '');
  return str.trim();
}

/**
 * Đọc dữ liệu người ở từ residents.json qua IPC
 */
async function loadResidentsData() {
  if (window.api && typeof window.api.loadResidents === 'function') {
    try {
      const res = await window.api.loadResidents();
      residentsList = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Lỗi nạp residents.json:', e);
      residentsList = [];
    }
  } else {
    residentsList = [];
  }
}

/**
 * Đọc dữ liệu phòng từ rooms.json qua IPC và chuẩn hóa 12 phòng
 */
async function loadRoomsData() {
  if (window.api && typeof window.api.loadRooms === 'function') {
    try {
      const res = await window.api.loadRooms();
      const rawRooms = Array.isArray(res) ? res : [];

      roomsList = DEFAULT_ROOM_NAMES.map(phong => {
        const found = rawRooms.find(r => r.phong === phong);
        if (found) {
          return {
            phong,
            tenKhach: found.tenKhach || '',
            cmnd: found.cmnd || '',
            chuPhong: found.chuPhong || null,
            thanhVien: Array.isArray(found.thanhVien) ? found.thanhVien : []
          };
        }
        return {
          phong,
          tenKhach: '',
          cmnd: '',
          chuPhong: null,
          thanhVien: []
        };
      });
    } catch (e) {
      console.error('Lỗi nạp rooms.json:', e);
      roomsList = DEFAULT_ROOM_NAMES.map(phong => ({
        phong,
        tenKhach: '',
        cmnd: '',
        chuPhong: null,
        thanhVien: []
      }));
    }
  } else {
    roomsList = DEFAULT_ROOM_NAMES.map(phong => ({
      phong,
      tenKhach: '',
      cmnd: '',
      chuPhong: null,
      thanhVien: []
    }));
  }
}

/**
 * Khởi tạo và làm mới toàn bộ giao diện phần 3
 */
function initResidentsSection() {
  renderResidentsStats();
  renderRoomCards();
  renderResidentsTable();
}

/**
 * Hiển thị thống kê nhanh trên đầu trang Quản lý Phòng & Người ở
 */
function renderResidentsStats() {
  const totalRoomsEl = document.getElementById('stat-res-total-rooms');
  const totalTenantsEl = document.getElementById('stat-res-total-tenants');
  const occupiedRoomsEl = document.getElementById('stat-res-occupied-rooms');
  const emptyRoomsEl = document.getElementById('stat-res-empty-rooms');

  if (totalRoomsEl) totalRoomsEl.textContent = '12 Phòng';

  // Tổng số người thuê = tổng số người đang được gán vào các phòng
  const tenantsInRooms = residentsList.filter(r => r.phong && String(r.phong).trim() !== '');
  if (totalTenantsEl) totalTenantsEl.textContent = `${tenantsInRooms.length} Người`;

  let occupiedCount = 0;
  DEFAULT_ROOM_NAMES.forEach(phong => {
    const room = roomsList.find(r => r.phong === phong);
    const hasHost = room && room.chuPhong;
    const hasMembers = room && Array.isArray(room.thanhVien) && room.thanhVien.length > 0;
    if (hasHost || hasMembers) {
      occupiedCount++;
    }
  });

  if (occupiedRoomsEl) occupiedRoomsEl.textContent = `${occupiedCount} / 12`;
  if (emptyRoomsEl) emptyRoomsEl.textContent = `${12 - occupiedCount} Phòng`;
}

/**
 * Kết xuất lưới 12 card phòng (1A - 6A, 1B - 6B)
 */
function renderRoomCards() {
  const grid = document.getElementById('rooms-cards-grid');
  if (!grid) return;

  grid.innerHTML = '';

  DEFAULT_ROOM_NAMES.forEach(phong => {
    const room = roomsList.find(r => r.phong === phong) || { phong, chuPhong: null, thanhVien: [] };
    const host = room.chuPhong ? residentsList.find(res => res.id === room.chuPhong) : null;
    const memberIds = Array.isArray(room.thanhVien) ? room.thanhVien : [];
    const members = residentsList.filter(res => memberIds.includes(res.id) && (!host || res.id !== host.id));
    const totalPeople = (host ? 1 : 0) + members.length;
    const isOccupied = totalPeople > 0;

    const card = document.createElement('div');
    card.className = `room-card ${isOccupied ? 'occupied' : 'empty'}`;
    card.onclick = () => openRoomDetailModal(phong);

    if (isOccupied) {
      card.innerHTML = `
        <div class="room-card__top">
          <div class="room-card__name">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 11.5 12 4l9 7.5" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9v-5.5h6V20h2.5a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.7"/></svg>
            Phòng ${phong}
          </div>
          <span class="badge occupied">Có Người</span>
        </div>
        <div class="room-card__owner">Chủ: <b>${escapeHtml(host ? host.hoTen : 'Chưa chỉ định')}</b></div>
        <div class="room-card__members">${totalPeople} thành viên</div>
      `;
    } else {
      card.innerHTML = `
        <div class="room-card__top">
          <div class="room-card__name">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 11.5 12 4l9 7.5" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9v-5.5h6V20h2.5a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.7"/></svg>
            Phòng ${phong}
          </div>
          <span class="badge empty">Phòng Trống</span>
        </div>
        <div class="room-card__owner">Chủ: Chưa chỉ định</div>
        <div class="room-card__hint">Nhấp để xếp người vào phòng</div>
      `;
    }

    grid.appendChild(card);
  });
}

/**
 * Mở Modal Chi tiết & Phân bổ phòng
 */
function openRoomDetailModal(roomName) {
  currentDetailRoomName = roomName;
  const titleEl = document.getElementById('modal-room-detail-title');
  if (titleEl) titleEl.textContent = roomName;

  let room = roomsList.find(r => r.phong === roomName);
  if (!room) {
    room = { phong: roomName, chuPhong: null, thanhVien: [], tenKhach: '', cmnd: '' };
    roomsList.push(room);
  }

  // Người khả dụng: Chưa ở phòng nào HOẶC đang ở chính phòng này
  const eligibleResidents = residentsList.filter(r => !r.phong || r.phong === roomName);

  const hostSelect = document.getElementById('room-host-select');
  if (hostSelect) {
    hostSelect.innerHTML = '<option value="">-- Chưa chọn chủ phòng (Để trống) --</option>';
    eligibleResidents.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.hoTen} (CCCD: ${r.cccd || 'Chưa có'}${r.sdtGoi ? ' - ' + r.sdtGoi : ''})`;
      if (r.id === room.chuPhong) {
        opt.selected = true;
      }
      hostSelect.appendChild(opt);
    });
  }

  renderRoomMembersChecklist(room.chuPhong, room.thanhVien || []);

  const modalEl = document.getElementById('room-detail-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Đóng Modal Chi tiết phòng
 */
function closeRoomDetailModal() {
  const modalEl = document.getElementById('room-detail-modal');
  if (modalEl) modalEl.style.display = 'none';
  currentDetailRoomName = null;
}

/**
 * Khi thay đổi chủ phòng trong dropdown -> tự động cập nhật lại danh sách chọn thành viên khác
 */
function onRoomHostChange() {
  const hostSelect = document.getElementById('room-host-select');
  const selectedHostId = hostSelect ? hostSelect.value : null;

  // Lấy các thành viên đang được tích hiện tại
  const checkedBoxes = document.querySelectorAll('#room-members-checklist input[type="checkbox"]:checked');
  const currentCheckedIds = Array.from(checkedBoxes).map(cb => cb.value);

  // Loại trừ selectedHostId nếu trùng
  const filteredCheckedIds = currentCheckedIds.filter(id => id !== selectedHostId);
  renderRoomMembersChecklist(selectedHostId, filteredCheckedIds);
}

/**
 * Kết xuất danh sách checkbox thành viên cùng phòng (đã loại trừ người ở phòng khác & chủ phòng)
 */
function renderRoomMembersChecklist(selectedHostId, currentMemberIds) {
  const container = document.getElementById('room-members-checklist');
  if (!container) return;

  container.innerHTML = '';

  // Chỉ hiển thị người chưa ở phòng khác HOẶC đang ở phòng này, VÀ không phải là chủ phòng đã chọn
  const eligibleMembers = residentsList.filter(r => (!r.phong || r.phong === currentDetailRoomName) && r.id !== selectedHostId);

  if (eligibleMembers.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
        Không có người thuê nào khả dụng để chọn làm thành viên (người khác đã thuộc các phòng khác hoặc đã được chỉ định làm chủ phòng).
      </div>
    `;
    return;
  }

  eligibleMembers.forEach(r => {
    const item = document.createElement('label');
    item.className = 'member-check-item';
    const isChecked = Array.isArray(currentMemberIds) && currentMemberIds.includes(r.id);

    item.innerHTML = `
      <input type="checkbox" value="${r.id}" ${isChecked ? 'checked' : ''}>
      <div class="member-check-info">
        <span class="member-check-name">${escapeHtml(r.hoTen)}</span>
        <span class="member-check-sub">CCCD: ${escapeHtml(r.cccd)} | SĐT: ${escapeHtml(r.sdtGoi || 'Chưa có')}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

/**
 * Lưu phân bổ phòng (Chủ phòng & Thành viên khác)
 */
async function saveRoomDetailAssignment() {
  if (!currentDetailRoomName) return;

  const hostSelect = document.getElementById('room-host-select');
  const selectedHostId = hostSelect && hostSelect.value ? hostSelect.value : null;

  const checkedBoxes = document.querySelectorAll('#room-members-checklist input[type="checkbox"]:checked');
  const selectedMemberIds = Array.from(checkedBoxes).map(cb => cb.value);

  // Tập hợp tất cả ID người sẽ ở phòng này
  const newResidentIdsInRoom = new Set();
  if (selectedHostId) newResidentIdsInRoom.add(selectedHostId);
  selectedMemberIds.forEach(id => newResidentIdsInRoom.add(id));

  // 1. Xử lý những người trước đây ở phòng này nhưng nay bị gỡ
  const previousResidentsInRoom = residentsList.filter(r => r.phong === currentDetailRoomName);
  for (const prev of previousResidentsInRoom) {
    if (!newResidentIdsInRoom.has(prev.id)) {
      if (prev.anhCccdMatTruoc || prev.anhCccdMatSau) {
        try {
          const moveRes = await window.api.moveCccdFolder({
            oldRoom: currentDetailRoomName,
            newRoom: null,
            personName: prev.hoTen,
            cccd: prev.cccd
          });
          if (moveRes && moveRes.newRelativeFolder) {
            if (prev.anhCccdMatTruoc) {
              const fn = prev.anhCccdMatTruoc.split(/[/\\]/).pop();
              prev.anhCccdMatTruoc = `${moveRes.newRelativeFolder}/${fn}`;
            }
            if (prev.anhCccdMatSau) {
              const fn = prev.anhCccdMatSau.split(/[/\\]/).pop();
              prev.anhCccdMatSau = `${moveRes.newRelativeFolder}/${fn}`;
            }
          }
        } catch (e) {
          console.error('Lỗi di chuyển thư mục ảnh khi gỡ người khỏi phòng:', e);
        }
      }
      prev.phong = null;
    }
  }

  // 2. Xử lý những người mới được gán vào phòng này
  for (const resId of newResidentIdsInRoom) {
    const person = residentsList.find(r => r.id === resId);
    if (person && person.phong !== currentDetailRoomName) {
      const oldRoom = person.phong;
      if (person.anhCccdMatTruoc || person.anhCccdMatSau) {
        try {
          const moveRes = await window.api.moveCccdFolder({
            oldRoom: oldRoom,
            newRoom: currentDetailRoomName,
            personName: person.hoTen,
            cccd: person.cccd
          });
          if (moveRes && moveRes.newRelativeFolder) {
            if (person.anhCccdMatTruoc) {
              const fn = person.anhCccdMatTruoc.split(/[/\\]/).pop();
              person.anhCccdMatTruoc = `${moveRes.newRelativeFolder}/${fn}`;
            }
            if (person.anhCccdMatSau) {
              const fn = person.anhCccdMatSau.split(/[/\\]/).pop();
              person.anhCccdMatSau = `${moveRes.newRelativeFolder}/${fn}`;
            }
          }
        } catch (e) {
          console.error('Lỗi di chuyển thư mục ảnh khi gán người vào phòng:', e);
        }
      }
      person.phong = currentDetailRoomName;
    }
  }

  // 3. Cập nhật đối tượng phòng trong roomsList
  let room = roomsList.find(r => r.phong === currentDetailRoomName);
  if (!room) {
    room = { phong: currentDetailRoomName, chuPhong: null, thanhVien: [], tenKhach: '', cmnd: '' };
    roomsList.push(room);
  }
  room.chuPhong = selectedHostId;
  room.thanhVien = selectedMemberIds;

  const hostPerson = selectedHostId ? residentsList.find(r => r.id === selectedHostId) : null;
  room.tenKhach = hostPerson ? hostPerson.hoTen : '';
  room.cmnd = hostPerson ? hostPerson.cccd : '';

  // 4. Lưu dữ liệu ra file JSON
  await window.api.saveRooms(roomsList);
  await window.api.saveResidents(residentsList);

  // 5. Cập nhật lại UI
  initResidentsSection();
  closeRoomDetailModal();
  showToast(`Đã lưu phân bổ phòng ${currentDetailRoomName} thành công!`, 'success');
}

/**
 * Lọc bảng người thuê theo từ khóa tìm kiếm
 */
function filterResidentsTable() {
  const input = document.getElementById('resident-search-input');
  residentSearchTerm = input ? input.value.trim() : '';
  renderResidentsTable();
}

/**
 * Kết xuất bảng danh sách người thuê
 */
function renderResidentsTable() {
  const tbody = document.getElementById('residents-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const searchClean = removeVietnameseTones(residentSearchTerm);
  const filtered = residentsList.filter(r => {
    if (!searchClean) return true;
    const nameMatch = removeVietnameseTones(r.hoTen).includes(searchClean);
    const phoneMatch = (r.sdtGoi && r.sdtGoi.includes(searchClean)) || (r.sdtZalo && r.sdtZalo.includes(searchClean));
    const cccdMatch = r.cccd && r.cccd.includes(searchClean);
    const roomMatch = r.phong && removeVietnameseTones(r.phong).includes(searchClean);
    const originMatch = r.queQuan && removeVietnameseTones(r.queQuan).includes(searchClean);
    return nameMatch || phoneMatch || cccdMatch || roomMatch || originMatch;
  });

  if (filtered.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="12" class="empty-state">
        ${residentSearchTerm ? 'Không tìm thấy người thuê nào phù hợp với từ khóa.' : 'Chưa có người thuê nào trong hệ thống. Nhấp "Thêm Người Mới" để tạo hồ sơ.'}
      </td>
    `;
    tbody.appendChild(tr);
    updateResidentsBulkActionUI(0, 0);
    return;
  }

  filtered.forEach((r, idx) => {
    const tr = document.createElement('tr');
    const isChecked = selectedResidentIds.has(r.id);
    const initial = (r.hoTen || '?').trim().charAt(0).toUpperCase();

    const hasFrontPhoto = !!r.anhCccdMatTruoc;
    const hasBackPhoto = !!r.anhCccdMatSau;
    const photoCount = (hasFrontPhoto ? 1 : 0) + (hasBackPhoto ? 1 : 0);

    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="resident-row-checkbox" value="${r.id}" ${isChecked ? 'checked' : ''} onchange="onResidentCheckboxChange('${r.id}', this.checked)">
      </td>
      <td style="text-align: center; color: var(--ink-muted); font-weight: 500;">${idx + 1}</td>
      <td>
        <div class="avatar-name">
          <div class="avatar">${escapeHtml(initial)}</div>
          <span>${escapeHtml(r.hoTen)}</span>
        </div>
      </td>
      <td>${escapeHtml(r.sdtGoi || '-')}</td>
      <td>${escapeHtml(r.sdtZalo || '-')}</td>
      <td>${escapeHtml(r.cccd || '-')}</td>
      <td>${escapeHtml(r.ngaySinh || '-')}</td>
      <td style="text-align: center;">${escapeHtml(r.gioiTinh || '-')}</td>
      <td style="text-align: center;">
        <span class="mini-badge ${r.phong ? '' : 'empty'}">
          ${r.phong ? 'Phòng ' + escapeHtml(r.phong) : 'Chưa xếp'}
        </span>
      </td>
      <td>${escapeHtml(r.ngayVaoO || '-')}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-cccd-pill ${photoCount > 0 ? 'has-photo' : 'none'}" ${photoCount > 0 ? `onclick="viewCccdPhoto('${r.id}', 'mat_truoc')"` : ''} title="${photoCount > 0 ? 'Nhấp để xem ảnh CCCD' : 'Chưa có ảnh'}">
          ${photoCount}/2 ảnh
        </button>
      </td>
      <td style="text-align: center; white-space: nowrap;">
        <button type="button" class="btn-action-text" onclick="openEditResidentModal('${r.id}')">Sửa</button>
        <span style="color: var(--ink-muted); margin: 0 4px;">·</span>
        <button type="button" class="btn-action-text danger" onclick="confirmDeleteSingleResident('${r.id}')">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateResidentsBulkActionUI(filtered.length, selectedResidentIds.size);
}

/**
 * Cập nhật trạng thái nút "Xóa đã chọn" và Checkbox Chọn tất cả
 */
function updateResidentsBulkActionUI(visibleCount, selectedCount) {
  const btnDelete = document.getElementById('btn-delete-selected-residents');
  const btnText = document.getElementById('btn-delete-selected-text');
  const thSelectAll = document.getElementById('th-select-all-residents');

  if (selectedCount > 0) {
    if (btnDelete) btnDelete.disabled = false;
    if (btnText) btnText.textContent = `Xóa đã chọn (${selectedCount})`;
  } else {
    if (btnDelete) btnDelete.disabled = true;
    if (btnText) btnText.textContent = 'Xóa đã chọn';
  }

  if (thSelectAll) {
    thSelectAll.checked = visibleCount > 0 && selectedCount >= visibleCount;
    thSelectAll.indeterminate = selectedCount > 0 && selectedCount < visibleCount;
  }
}

/**
 * Checkbox Chọn / Bỏ chọn tất cả người thuê
 */
function toggleSelectAllResidents(checked) {
  const checkboxes = document.querySelectorAll('.resident-row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    if (checked) {
      selectedResidentIds.add(cb.value);
    } else {
      selectedResidentIds.delete(cb.value);
    }
  });
  updateResidentsBulkActionUI(checkboxes.length, selectedResidentIds.size);
}

/**
 * Checkbox chọn từng dòng người thuê
 */
function onResidentCheckboxChange(residentId, checked) {
  if (checked) {
    selectedResidentIds.add(residentId);
  } else {
    selectedResidentIds.delete(residentId);
  }
  const checkboxes = document.querySelectorAll('.resident-row-checkbox');
  updateResidentsBulkActionUI(checkboxes.length, selectedResidentIds.size);
}

/**
 * Mở Modal tạo người thuê mới
 */
function openAddResidentModal() {
  initDatePickers();
  editingResidentId = null;
  document.getElementById('res-modal-title').textContent = 'Thêm Người Thuê Mới';
  document.getElementById('res-modal-subtitle').textContent = 'Điền thông tin cá nhân và ảnh CCCD';

  document.getElementById('res-hoTen').value = '';
  document.getElementById('res-cccd').value = '';
  document.getElementById('res-sdtGoi').value = '';
  document.getElementById('res-sdtZalo').value = '';
  document.getElementById('res-gioiTinh').value = 'Nam';
  document.getElementById('res-email').value = '';
  document.getElementById('res-queQuan').value = '';

  if (pickerNgaySinh) pickerNgaySinh.clear();
  if (pickerNgayVaoO) pickerNgayVaoO.clear();
  clearAllFieldErrors();

  resetCccdPreviewUI('mat_truoc');
  resetCccdPreviewUI('mat_sau');

  resFormCccdImages = { mat_truoc: null, mat_sau: null };

  switchFormTab('info');
  document.getElementById('resident-form-modal').style.display = 'flex';
}

/**
 * Mở Modal chỉnh sửa thông tin người thuê
 */
async function openEditResidentModal(id) {
  initDatePickers();
  const person = residentsList.find(r => r.id === id);
  if (!person) return;

  editingResidentId = id;
  document.getElementById('res-modal-title').textContent = 'Chỉnh Sửa Thông Tin Người Thuê';
  document.getElementById('res-modal-subtitle').textContent = `Mã: ${person.id} | Phòng: ${person.phong ? 'Phòng ' + person.phong : 'Chưa xếp'}`;

  document.getElementById('res-hoTen').value = person.hoTen || '';
  document.getElementById('res-cccd').value = person.cccd || '';
  document.getElementById('res-sdtGoi').value = person.sdtGoi || '';
  document.getElementById('res-sdtZalo').value = person.sdtZalo || '';
  document.getElementById('res-gioiTinh').value = person.gioiTinh || 'Nam';
  document.getElementById('res-email').value = person.email || '';
  document.getElementById('res-queQuan').value = person.queQuan || '';

  clearAllFieldErrors();

  if (pickerNgaySinh) {
    if (person.ngaySinh) pickerNgaySinh.setValue(person.ngaySinh);
    else pickerNgaySinh.clear();
  }
  if (pickerNgayVaoO) {
    if (person.ngayVaoO) pickerNgayVaoO.setValue(person.ngayVaoO);
    else pickerNgayVaoO.clear();
  }

  resetCccdPreviewUI('mat_truoc');
  resetCccdPreviewUI('mat_sau');
  resFormCccdImages = { mat_truoc: null, mat_sau: null };

  if (person.anhCccdMatTruoc) {
    try {
      const dataUrl = await window.api.readCccdImageAsDataUrl(person.anhCccdMatTruoc);
      if (dataUrl) {
        setCccdPreviewUI('mat_truoc', dataUrl);
        resFormCccdImages.mat_truoc = { path: person.anhCccdMatTruoc, changed: false };
      }
    } catch (e) {
      console.error('Lỗi nạp ảnh mặt trước:', e);
    }
  }

  if (person.anhCccdMatSau) {
    try {
      const dataUrl = await window.api.readCccdImageAsDataUrl(person.anhCccdMatSau);
      if (dataUrl) {
        setCccdPreviewUI('mat_sau', dataUrl);
        resFormCccdImages.mat_sau = { path: person.anhCccdMatSau, changed: false };
      }
    } catch (e) {
      console.error('Lỗi nạp ảnh mặt sau:', e);
    }
  }

  switchFormTab('info');
  document.getElementById('resident-form-modal').style.display = 'flex';
}

/**
 * Đóng Form Modal Người thuê
 */
function closeResidentFormModal() {
  document.getElementById('resident-form-modal').style.display = 'none';
  editingResidentId = null;
  resFormCccdImages = { mat_truoc: null, mat_sau: null };
}

/**
 * Chuyển tab giữa "1. Thông tin cá nhân" và "2. Ảnh CCCD" trong form
 */
function switchFormTab(tab) {
  const tabInfoBtn = document.getElementById('form-tab-btn-info');
  const tabCccdBtn = document.getElementById('form-tab-btn-cccd');
  const contentInfo = document.getElementById('form-tab-content-info');
  const contentCccd = document.getElementById('form-tab-content-cccd');

  if (tab === 'info') {
    if (tabInfoBtn) tabInfoBtn.classList.add('active');
    if (tabCccdBtn) tabCccdBtn.classList.remove('active');
    if (contentInfo) contentInfo.classList.add('active');
    if (contentCccd) contentCccd.classList.remove('active');
  } else {
    if (tabCccdBtn) tabCccdBtn.classList.add('active');
    if (tabInfoBtn) tabInfoBtn.classList.remove('active');
    if (contentCccd) contentCccd.classList.add('active');
    if (contentInfo) contentInfo.classList.remove('active');
  }
}

/**
 * Nút tiện ích "Giống SĐT Gọi" -> sao chép SĐT Gọi sang SĐT Zalo
 */
function copyPhoneToZalo(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  const sdtGoi = document.getElementById('res-sdtGoi').value.trim();
  if (sdtGoi) {
    const sdtZaloInput = document.getElementById('res-sdtZalo');
    if (sdtZaloInput) {
      sdtZaloInput.value = sdtGoi;
      clearFieldError('res-sdtZalo');
    }
  }
}

/**
 * Nút tiện ích "Hôm nay" trên nhãn Ngày Vào Ở -> tự động điền ngày hiện tại
 */
function setMoveInDateToday(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  initDatePickers();
  if (pickerNgayVaoO) {
    pickerNgayVaoO.setToday();
  } else {
    const wrap = document.getElementById('wrap-res-ngayVaoO');
    if (wrap && wrap._datePicker) {
      wrap._datePicker.setToday();
    } else {
      const today = new Date();
      const d = String(today.getDate()).padStart(2, '0');
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const y = today.getFullYear();
      const inputEl = document.getElementById('res-ngayVaoO');
      if (inputEl) {
        if (inputEl._dateMaskInput) {
          inputEl._dateMaskInput.setDate(today.getDate(), today.getMonth() + 1, today.getFullYear());
        } else {
          inputEl.value = `${d}/${m}/${y}`;
          inputEl.classList.add('filled');
        }
      }
    }
  }
  clearFieldError('res-ngayVaoO');
}

/**
 * Reset khung ảnh CCCD về trạng thái trống
 */
function resetCccdPreviewUI(type) {
  const isFront = type === 'mat_truoc';
  const areaEl = document.getElementById(isFront ? 'frontArea' : 'backArea');
  const imgEl = document.getElementById(isFront ? 'cccd-front-img' : 'cccd-back-img');
  const emptySvg = document.getElementById(isFront ? 'cccd-front-svg' : 'cccd-back-svg');
  const emptyText = document.getElementById(isFront ? 'cccd-front-empty' : 'cccd-back-empty');
  const removeBtn = document.getElementById(isFront ? 'btn-remove-front-cccd' : 'btn-remove-back-cccd');

  if (areaEl) areaEl.classList.remove('has-image');
  if (imgEl) {
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
  if (emptySvg) emptySvg.style.display = 'block';
  if (emptyText) emptyText.style.display = 'inline';
  if (removeBtn) removeBtn.style.display = 'none';
}

/**
 * Thiết lập preview ảnh CCCD
 */
function setCccdPreviewUI(type, dataUrl) {
  const isFront = type === 'mat_truoc';
  const areaEl = document.getElementById(isFront ? 'frontArea' : 'backArea');
  const imgEl = document.getElementById(isFront ? 'cccd-front-img' : 'cccd-back-img');
  const emptySvg = document.getElementById(isFront ? 'cccd-front-svg' : 'cccd-back-svg');
  const emptyText = document.getElementById(isFront ? 'cccd-front-empty' : 'cccd-back-empty');
  const removeBtn = document.getElementById(isFront ? 'btn-remove-front-cccd' : 'btn-remove-back-cccd');

  if (areaEl) areaEl.classList.add('has-image');
  if (imgEl) {
    imgEl.src = dataUrl;
    imgEl.style.display = 'block';
  }
  if (emptySvg) emptySvg.style.display = 'none';
  if (emptyText) emptyText.style.display = 'none';
  if (removeBtn) removeBtn.style.display = 'flex';
}

/**
 * Click vào khung Upload CCCD -> mở dialog chọn ảnh
 */
async function onCccdAreaClick(type, event) {
  if (event && event.target && event.target.closest('.upload-box__remove')) {
    return;
  }
  await pickCccdImage(type);
}

/**
 * Click nút xóa ảnh CCCD
 */
function onCccdRemoveClick(type, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  removeCccdImage(type);
}

/**
 * Fallback xử lý input file tiêu chuẩn nếu chạy ngoài môi trường Electron
 */
function onNativeFileChange(type, input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    setCccdPreviewUI(type, dataUrl);
    resFormCccdImages[type] = {
      dataUrl,
      changed: true,
      removed: false
    };
  };
  reader.readAsDataURL(file);
}

/**
 * Chọn file ảnh CCCD qua Dialog native
 */
async function pickCccdImage(type) {
  if (window.api && typeof window.api.pickImage === 'function') {
    const result = await window.api.pickImage();
    if (result && result.dataUrl) {
      setCccdPreviewUI(type, result.dataUrl);
      resFormCccdImages[type] = {
        dataUrl: result.dataUrl,
        changed: true,
        removed: false
      };
    }
  } else {
    // Trình duyệt web fallback
    const inputEl = document.getElementById(type === 'mat_truoc' ? 'input-file-front' : 'input-file-back');
    if (inputEl) inputEl.click();
  }
}

/**
 * Xóa ảnh CCCD trong form
 */
function removeCccdImage(type) {
  resetCccdPreviewUI(type);
  resFormCccdImages[type] = {
    changed: true,
    removed: true,
    dataUrl: null
  };
}

/**
 * Lưu Form Người Thuê (Validate đầy đủ, upload ảnh, lưu JSON)
 */
async function submitResidentForm() {
  clearAllFieldErrors();

  const hoTen = document.getElementById('res-hoTen').value.trim();
  let cccd = document.getElementById('res-cccd').value.trim().replace(/\s+/g, '');
  let sdtGoi = document.getElementById('res-sdtGoi').value.trim().replace(/[\s.-]/g, '');
  let sdtZalo = document.getElementById('res-sdtZalo').value.trim().replace(/[\s.-]/g, '');
  const gioiTinh = document.getElementById('res-gioiTinh').value;
  const email = document.getElementById('res-email').value.trim();
  const queQuan = document.getElementById('res-queQuan').value.trim();

  const ngaySinh = pickerNgaySinh ? pickerNgaySinh.getValue() : document.getElementById('res-ngaySinh').value.trim();
  const ngayVaoO = pickerNgayVaoO ? pickerNgayVaoO.getValue() : document.getElementById('res-ngayVaoO').value.trim();

  let hasError = false;
  let firstErrorField = null;

  // 1. Họ và tên (bắt buộc)
  if (!hoTen) {
    setFieldError('res-hoTen', 'Vui lòng nhập Họ và Tên người thuê!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-hoTen';
  }

  // 2. CCCD (bắt buộc, 12 chữ số)
  if (!cccd) {
    setFieldError('res-cccd', 'Số CCCD là trường bắt buộc!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-cccd';
  } else if (!isValidCccd(cccd)) {
    setFieldError('res-cccd', 'Số CCCD phải bao gồm đúng 12 chữ số!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-cccd';
  } else {
    // Kiểm tra trùng CCCD với người khác trong danh sách
    const duplicateCccd = residentsList.find(r => r.id !== editingResidentId && r.cccd === cccd);
    if (duplicateCccd) {
      setFieldError('res-cccd', `Số CCCD này đã thuộc về "${duplicateCccd.hoTen}"!`);
      hasError = true;
      if (!firstErrorField) firstErrorField = 'res-cccd';
    }
  }

  // 3. SĐT Gọi (bắt buộc, 10 chữ số)
  if (!sdtGoi) {
    setFieldError('res-sdtGoi', 'Số điện thoại gọi là trường bắt buộc!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-sdtGoi';
  } else if (!isValidPhoneVN(sdtGoi)) {
    setFieldError('res-sdtGoi', 'Số ĐT không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09)!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-sdtGoi';
  }

  // 4. SĐT Zalo (bắt buộc, 10 chữ số)
  if (!sdtZalo) {
    setFieldError('res-sdtZalo', 'Số điện thoại Zalo là trường bắt buộc!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-sdtZalo';
  } else if (!isValidPhoneVN(sdtZalo)) {
    setFieldError('res-sdtZalo', 'Số ĐT Zalo không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09)!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-sdtZalo';
  }

  // 5. Ngày Sinh (Bắt buộc)
  if (!ngaySinh || (pickerNgaySinh && pickerNgaySinh.isEmpty())) {
    setFieldError('res-ngaySinh', 'Ngày sinh là trường bắt buộc!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-ngaySinh';
  } else if (pickerNgaySinh && (!pickerNgaySinh.isComplete() || !pickerNgaySinh.isValid())) {
    setFieldError('res-ngaySinh', 'Ngày sinh không hợp lệ (Định dạng dd/mm/yyyy)!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-ngaySinh';
  } else if (!isValidDateVN(ngaySinh)) {
    setFieldError('res-ngaySinh', 'Ngày sinh không hợp lệ (Định dạng dd/mm/yyyy)!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-ngaySinh';
  }

  // 6. Email (Tùy chọn)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('res-email', 'Địa chỉ email không đúng định dạng!');
    hasError = true;
    if (!firstErrorField) firstErrorField = 'res-email';
  }

  // 7. Ngày Vào Ở (Tùy chọn)
  if (ngayVaoO) {
    if (pickerNgayVaoO && !pickerNgayVaoO.isEmpty() && (!pickerNgayVaoO.isComplete() || !pickerNgayVaoO.isValid())) {
      setFieldError('res-ngayVaoO', 'Ngày vào ở không hợp lệ (Định dạng dd/mm/yyyy)!');
      hasError = true;
      if (!firstErrorField) firstErrorField = 'res-ngayVaoO';
    } else if (!isValidDateVN(ngayVaoO)) {
      setFieldError('res-ngayVaoO', 'Ngày vào ở không hợp lệ (Định dạng dd/mm/yyyy)!');
      hasError = true;
      if (!firstErrorField) firstErrorField = 'res-ngayVaoO';
    }
  }

  if (hasError) {
    switchFormTab('info');
    if (firstErrorField) {
      const targetInput = document.getElementById(firstErrorField);
      if (targetInput) targetInput.focus();
    }
    showToast('Vui lòng kiểm tra và sửa các thông tin bị thiếu hoặc sai màu đỏ!', 'error');
    return;
  }

  let person = null;
  if (editingResidentId) {
    person = residentsList.find(r => r.id === editingResidentId);
    if (!person) return;

    // Đổi tên thư mục nếu người này đổi họ tên hoặc CCCD
    if ((person.hoTen !== hoTen || person.cccd !== cccd) && (person.anhCccdMatTruoc || person.anhCccdMatSau)) {
      try {
        const moveRes = await window.api.moveCccdFolder({
          oldRoom: person.phong || null,
          newRoom: person.phong || null,
          personName: hoTen,
          cccd: cccd,
          oldPersonName: person.hoTen,
          oldCccd: person.cccd
        });
        if (moveRes && moveRes.newRelativeFolder) {
          if (person.anhCccdMatTruoc) {
            const fn = person.anhCccdMatTruoc.split(/[/\\]/).pop();
            person.anhCccdMatTruoc = `${moveRes.newRelativeFolder}/${fn}`;
          }
          if (person.anhCccdMatSau) {
            const fn = person.anhCccdMatSau.split(/[/\\]/).pop();
            person.anhCccdMatSau = `${moveRes.newRelativeFolder}/${fn}`;
          }
        }
      } catch (e) {
        console.error('Lỗi đổi tên thư mục ảnh khi sửa thông tin:', e);
      }
    }

    person.hoTen = hoTen;
    person.cccd = cccd;
    person.sdtGoi = sdtGoi;
    person.sdtZalo = sdtZalo;
    person.ngaySinh = normalizeDateVN(ngaySinh);
    person.gioiTinh = gioiTinh;
    person.email = email;
    person.ngayVaoO = normalizeDateVN(ngayVaoO);
    person.queQuan = queQuan;

    // Đồng bộ tên khách & CMND nếu người này đang làm chủ phòng
    if (person.phong) {
      const room = roomsList.find(rm => rm.phong === person.phong && rm.chuPhong === person.id);
      if (room) {
        room.tenKhach = hoTen;
        room.cmnd = cccd;
        await window.api.saveRooms(roomsList);
      }
    }
  } else {
    // Thêm mới người thuê
    person = {
      id: 'person_' + Date.now(),
      hoTen,
      cccd,
      sdtGoi,
      sdtZalo,
      ngaySinh: normalizeDateVN(ngaySinh),
      gioiTinh,
      email,
      ngayVaoO: normalizeDateVN(ngayVaoO),
      queQuan,
      phong: null,
      anhCccdMatTruoc: null,
      anhCccdMatSau: null
    };
    residentsList.push(person);
  }

  // Xử lý lưu ảnh CCCD mới
  const roomNameForPhoto = person.phong || null;

  if (resFormCccdImages.mat_truoc && resFormCccdImages.mat_truoc.changed) {
    if (resFormCccdImages.mat_truoc.removed) {
      person.anhCccdMatTruoc = null;
    } else if (resFormCccdImages.mat_truoc.dataUrl) {
      try {
        const saveRes = await window.api.saveCccdImage({
          roomName: roomNameForPhoto,
          personName: hoTen,
          cccd,
          type: 'mat_truoc',
          dataUrl: resFormCccdImages.mat_truoc.dataUrl
        });
        if (saveRes && saveRes.relativePath) {
          person.anhCccdMatTruoc = saveRes.relativePath;
        }
      } catch (e) {
        console.error('Lỗi lưu ảnh mặt trước:', e);
      }
    }
  }

  if (resFormCccdImages.mat_sau && resFormCccdImages.mat_sau.changed) {
    if (resFormCccdImages.mat_sau.removed) {
      person.anhCccdMatSau = null;
    } else if (resFormCccdImages.mat_sau.dataUrl) {
      try {
        const saveRes = await window.api.saveCccdImage({
          roomName: roomNameForPhoto,
          personName: hoTen,
          cccd,
          type: 'mat_sau',
          dataUrl: resFormCccdImages.mat_sau.dataUrl
        });
        if (saveRes && saveRes.relativePath) {
          person.anhCccdMatSau = saveRes.relativePath;
        }
      } catch (e) {
        console.error('Lỗi lưu ảnh mặt sau:', e);
      }
    }
  }

  await window.api.saveResidents(residentsList);

  initResidentsSection();
  closeResidentFormModal();
  showToast(editingResidentId ? 'Đã cập nhật thông tin người thuê!' : 'Đã thêm người thuê mới thành công!', 'success');
}

/**
 * Xem ảnh CCCD kích thước lớn trong Modal Lightbox với tab chuyển Mặt Trước / Mặt Sau
 */
async function viewCccdPhoto(residentId, initialType = 'mat_truoc') {
  const person = residentsList.find(r => r.id === residentId);
  if (!person) return;

  const hasFront = !!person.anhCccdMatTruoc;
  const hasBack = !!person.anhCccdMatSau;

  if (!hasFront && !hasBack) {
    showToast('Người này chưa có ảnh CCCD nào được lưu!', 'warning');
    return;
  }

  currentLightboxResidentId = residentId;

  // Cập nhật nhãn trạng thái các tab
  const tagFront = document.getElementById('lightbox-tag-front');
  const tagBack = document.getElementById('lightbox-tag-back');
  if (tagFront) {
    tagFront.textContent = hasFront ? 'Có ảnh' : 'Chưa có';
    tagFront.className = 'photo-tab-pill ' + (hasFront ? 'has' : 'none');
  }
  if (tagBack) {
    tagBack.textContent = hasBack ? 'Có ảnh' : 'Chưa có';
    tagBack.className = 'photo-tab-pill ' + (hasBack ? 'has' : 'none');
  }

  // Tự động chuyển tab nếu phía được yêu cầu không có ảnh mà phía kia có ảnh
  let targetType = initialType;
  if (targetType === 'mat_truoc' && !hasFront && hasBack) {
    targetType = 'mat_sau';
  } else if (targetType === 'mat_sau' && !hasBack && hasFront) {
    targetType = 'mat_truoc';
  }

  document.getElementById('lightbox-subtitle').textContent = `${person.hoTen} — CCCD: ${person.cccd || 'Chưa có'} | ${person.phong ? 'Phòng ' + person.phong : 'Chưa xếp phòng'}`;
  document.getElementById('cccd-preview-modal').style.display = 'flex';

  await switchLightboxPhoto(targetType);
}

/**
 * Chuyển đổi hiển thị giữa Ảnh Mặt Trước và Mặt Sau trong Modal Lightbox
 */
async function switchLightboxPhoto(type) {
  currentLightboxType = type;
  const person = residentsList.find(r => r.id === currentLightboxResidentId);
  if (!person) return;

  const tabFront = document.getElementById('lightbox-tab-front');
  const tabBack = document.getElementById('lightbox-tab-back');
  const titleEl = document.getElementById('lightbox-title');
  const statusEl = document.getElementById('lightbox-status-text');
  const imgEl = document.getElementById('lightbox-img');
  const emptyNotice = document.getElementById('lightbox-empty-notice');
  const emptyText = document.getElementById('lightbox-empty-text');

  const isFront = type === 'mat_truoc';

  if (tabFront) tabFront.classList.toggle('active', isFront);
  if (tabBack) tabBack.classList.toggle('active', !isFront);

  if (titleEl) {
    titleEl.textContent = isFront ? 'Ảnh CCCD Mặt Trước' : 'Ảnh CCCD Mặt Sau';
  }
  if (statusEl) {
    statusEl.textContent = isFront ? 'Ảnh 1 / 2: Mặt trước' : 'Ảnh 2 / 2: Mặt sau';
  }

  const relPath = isFront ? person.anhCccdMatTruoc : person.anhCccdMatSau;

  if (!relPath) {
    if (imgEl) {
      imgEl.style.display = 'none';
      imgEl.src = '';
    }
    if (emptyNotice) emptyNotice.style.display = 'block';
    if (emptyText) emptyText.textContent = `Người này chưa tải lên ảnh CCCD ${isFront ? 'mặt trước' : 'mặt sau'}.`;
    return;
  }

  try {
    const dataUrl = await window.api.readCccdImageAsDataUrl(relPath);
    if (dataUrl) {
      if (emptyNotice) emptyNotice.style.display = 'none';
      if (imgEl) {
        imgEl.src = dataUrl;
        imgEl.style.display = 'block';
      }
    } else {
      if (imgEl) {
        imgEl.style.display = 'none';
        imgEl.src = '';
      }
      if (emptyNotice) emptyNotice.style.display = 'block';
      if (emptyText) emptyText.textContent = 'Không tìm thấy file ảnh trên ổ đĩa!';
    }
  } catch (e) {
    console.error('Lỗi khi mở ảnh CCCD:', e);
    if (imgEl) {
      imgEl.style.display = 'none';
      imgEl.src = '';
    }
    if (emptyNotice) emptyNotice.style.display = 'block';
    if (emptyText) emptyText.textContent = 'Lỗi khi đọc file ảnh!';
  }
}

/**
 * Đóng Modal Lightbox xem ảnh CCCD
 */
function closeCccdLightbox() {
  document.getElementById('cccd-preview-modal').style.display = 'none';
  const imgEl = document.getElementById('lightbox-img');
  if (imgEl) {
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
  currentLightboxResidentId = null;
}

/**
 * Mở modal xác nhận xóa 1 người thuê
 */
function confirmDeleteSingleResident(id) {
  const person = residentsList.find(r => r.id === id);
  if (!person) return;

  residentsToDelete = [id];
  document.getElementById('delete-resident-count-text').textContent = '1 người thuê';

  const listEl = document.getElementById('delete-resident-list');
  listEl.innerHTML = `
    <div class="delete-name-item">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      ${escapeHtml(person.hoTen)} (CCCD: ${escapeHtml(person.cccd)}${person.phong ? ' - Phòng ' + escapeHtml(person.phong) : ' - Chưa xếp phòng'})
    </div>
  `;

  document.getElementById('delete-resident-modal').style.display = 'flex';
}

/**
 * Mở modal xác nhận xóa hàng loạt người thuê đã chọn
 */
function confirmDeleteSelectedResidents() {
  if (selectedResidentIds.size === 0) return;

  residentsToDelete = Array.from(selectedResidentIds);
  document.getElementById('delete-resident-count-text').textContent = `${residentsToDelete.length} người thuê`;

  const listEl = document.getElementById('delete-resident-list');
  listEl.innerHTML = '';
  residentsToDelete.forEach(id => {
    const person = residentsList.find(r => r.id === id);
    if (person) {
      const item = document.createElement('div');
      item.className = 'delete-name-item';
      item.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        ${escapeHtml(person.hoTen)} (CCCD: ${escapeHtml(person.cccd)}${person.phong ? ' - Phòng ' + escapeHtml(person.phong) : ' - Chưa xếp phòng'})
      `;
      listEl.appendChild(item);
    }
  });

  document.getElementById('delete-resident-modal').style.display = 'flex';
}

/**
 * Đóng Modal xác nhận xóa
 */
function closeDeleteResidentModal() {
  document.getElementById('delete-resident-modal').style.display = 'none';
  residentsToDelete = [];
}

/**
 * Thực hiện xóa vĩnh viễn người thuê (Gỡ khỏi phòng + Xóa ảnh CCCD trên đĩa + Xóa JSON)
 */
async function executeDeleteResidents() {
  if (!residentsToDelete || residentsToDelete.length === 0) return;

  let roomsModified = false;

  for (const id of residentsToDelete) {
    const person = residentsList.find(r => r.id === id);
    if (!person) continue;

    // Gỡ khỏi phòng nếu đang ở
    if (person.phong) {
      const room = roomsList.find(rm => rm.phong === person.phong);
      if (room) {
        if (room.chuPhong === id) {
          room.chuPhong = null;
          room.tenKhach = '';
          room.cmnd = '';
          roomsModified = true;
        }
        if (Array.isArray(room.thanhVien) && room.thanhVien.includes(id)) {
          room.thanhVien = room.thanhVien.filter(mId => mId !== id);
          roomsModified = true;
        }
      }
    }

    // Xóa vĩnh viễn thư mục ảnh CCCD trên đĩa
    try {
      await window.api.deleteCccdFolder({
        roomName: person.phong || null,
        personName: person.hoTen,
        cccd: person.cccd
      });
    } catch (e) {
      console.error('Lỗi khi xóa thư mục ảnh CCCD:', e);
    }

    selectedResidentIds.delete(id);
  }

  const deletedCount = residentsToDelete.length;
  residentsList = residentsList.filter(r => !residentsToDelete.includes(r.id));

  if (roomsModified) {
    await window.api.saveRooms(roomsList);
  }
  await window.api.saveResidents(residentsList);

  closeDeleteResidentModal();
  initResidentsSection();
  showToast(`Đã xóa vĩnh viễn ${deletedCount} người thuê khỏi hệ thống!`, 'success');
}

/**
 * Nút "Gửi Zalo" trên tiêu đề Bảng nhập chỉ số (Phần 1: Nhập Dữ Liệu)
 * Kích hoạt gửi phiếu thu qua Zalo cho tháng đang chọn
 */
let pendingActionAfterZaloLogin = null;
let selectedZaloRooms = new Set();
let eligibleZaloRooms = [];

/**
 * Nút "Gửi Zalo" trên tiêu đề Bảng nhập chỉ số (Phần 1: Nhập Dữ Liệu)
 * Kích hoạt gửi phiếu thu qua Zalo cho tháng đang chọn
 */
async function handleSendZaloMonthClick() {
  if (isSettingsDirty || isBankDirty) {
    if (isBankDirty) {
      highlightUnsavedBankFields();
    }
    pendingActionAfterUnsavedModal = () => handleSendZaloMonthClick();
    showUnsavedSettingsModal();
    return;
  }

  // 1. Kiểm tra session Zalo trước khi mở popup
  if (!window.api || typeof window.api.getZaloStatus !== 'function') {
    showToast('Chức năng Gửi Zalo chỉ khả dụng trên ứng dụng Electron!', 'error');
    return;
  }

  try {
    const status = await window.api.getZaloStatus();
    if (!status || !status.connected) {
      showToast('Phiên đăng nhập Zalo đã hết hạn hoặc chưa kết nối. Vui lòng quét mã QR để tiếp tục!', 'warning');
      pendingActionAfterZaloLogin = () => openZaloSelectRoomsModal();
      openZaloQrModal(false);
      return;
    }

    await openZaloSelectRoomsModal();
  } catch (err) {
    console.error('Lỗi khi kiểm tra trạng thái Zalo:', err);
    showToast(`Lỗi kiểm tra Zalo: ${err.message}`, 'error');
  }
}

/**
 * Mở Popup Chọn Phòng Để Gửi Zalo
 */
async function openZaloSelectRoomsModal() {
  if (!residentsList || residentsList.length === 0) {
    await loadResidentsData();
  }
  if (!roomsList || roomsList.length === 0) {
    await loadRoomsData();
  }

  const monthYearSelect = document.getElementById('month-year-select');
  const monthKey = monthYearSelect ? monthYearSelect.value : '';
  const [yyyy, mm] = monthKey ? monthKey.split('-') : ['', ''];

  const titleEl = document.getElementById('zalo-select-modal-title');
  const subtitleEl = document.getElementById('zalo-select-modal-subtitle');
  if (titleEl) titleEl.textContent = `Gửi Phiếu Thu Qua Zalo - Tháng ${mm}/${yyyy}`;
  if (subtitleEl) subtitleEl.textContent = `Chọn danh sách các phòng muốn gửi phiếu thu tự động cho Tháng ${mm}/${yyyy}`;

  selectedZaloRooms.clear();
  eligibleZaloRooms = [];

  const gridEl = document.getElementById('zalo-rooms-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const formatMoney = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);

  roomsData.forEach(room => {
    // 1. Tìm thông tin chủ phòng từ roomsList và residentsList
    const roomInfo = (roomsList || []).find(r => r.phong === room.phong);
    let hostResident = null;
    if (roomInfo) {
      if (roomInfo.chuPhong) {
        hostResident = (residentsList || []).find(res => res.id === roomInfo.chuPhong);
      }
      if (!hostResident && roomInfo.cmnd) {
        hostResident = (residentsList || []).find(res => res.cccd === roomInfo.cmnd);
      }
    }

    const hasDienMoi = isNotEmpty(room.dienMoi);
    const hasNuocMoi = isNotEmpty(room.nuocMoi);
    const isFullyEntered = hasDienMoi && hasNuocMoi;
    const calc = isFullyEntered ? calcRoom(room, appSettings) : null;

    let disabledReason = null;

    // Điều kiện 1: Phòng trống / Chưa có chủ phòng
    if (!hostResident || !hostResident.hoTen || hostResident.hoTen.trim() === '') {
      disabledReason = 'Phòng trống, chưa có chủ phòng';
    }
    // Điều kiện 2: Chưa có SĐT Zalo hợp lệ
    else {
      const rawPhone = String(hostResident.sdtZalo || hostResident.sdtGoi || '').replace(/\D/g, '');
      if (!rawPhone || rawPhone.length < 10) {
        disabledReason = 'Chủ phòng chưa có SĐT Zalo';
      }
      // Điều kiện 3: Chưa nhập đủ điện nước / tổng tiền <= 0
      else if (!isFullyEntered || !calc || calc.tongCong <= 0) {
        disabledReason = 'Chưa nhập đủ chỉ số điện/nước tháng này';
      }
    }

    const isEligible = !disabledReason;
    if (isEligible) {
      eligibleZaloRooms.push(room.phong);
      selectedZaloRooms.add(room.phong); // Mặc định chọn tất cả phòng đủ điều kiện
    }

    const guestName = hostResident ? hostResident.hoTen : (roomInfo?.tenKhach || 'Chưa gán người ở');
    const phoneVal = hostResident ? (hostResident.sdtZalo || hostResident.sdtGoi || '') : '';
    const phoneDisplay = phoneVal ? phoneVal : 'Chưa có SĐT';
    const amountDisplay = (isFullyEntered && calc && calc.tongCong > 0) ? `${formatMoney(calc.tongCong)} đ` : 'Chưa tính tiền';

    const card = document.createElement('div');
    card.className = `zalo-room-card ${isEligible ? 'selected' : 'disabled'}`;
    card.id = `zalo-room-card-${room.phong}`;

    card.innerHTML = `
      <input type="checkbox" class="zalo-room-checkbox" id="zalo-chk-${room.phong}" 
        ${isEligible ? 'checked' : 'disabled'} 
        onclick="event.stopPropagation(); toggleZaloRoomSelection('${room.phong}')">
      <div class="zalo-room-info">
        <div class="zalo-room-top">
          <span class="zalo-room-name">Phòng ${room.phong}</span>
          <span class="zalo-room-amount">${amountDisplay}</span>
        </div>
        <span class="zalo-room-guest" title="${escapeHtml(guestName)}">Chủ phòng: <strong>${escapeHtml(guestName)}</strong></span>
        <span class="zalo-room-phone">SĐT Zalo: ${escapeHtml(phoneDisplay)}</span>
        ${disabledReason ? `<div class="zalo-room-reason-badge">⚠ ${disabledReason}</div>` : ''}
      </div>
    `;

    if (isEligible) {
      card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          toggleZaloRoomSelection(room.phong);
        }
      });
    }

    gridEl.appendChild(card);
  });

  updateZaloSelectRoomsUI();

  const modalEl = document.getElementById('zalo-select-rooms-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Chọn tất cả hoặc bỏ chọn tất cả các phòng đủ điều kiện
 */
function toggleSelectAllZaloRooms(selectAll) {
  if (selectAll) {
    eligibleZaloRooms.forEach(phong => selectedZaloRooms.add(phong));
  } else {
    selectedZaloRooms.clear();
  }
  updateZaloSelectRoomsUI();
}

/**
 * Bật/tắt chọn 1 phòng cụ thể
 */
function toggleZaloRoomSelection(phong) {
  if (!eligibleZaloRooms.includes(phong)) return;

  if (selectedZaloRooms.has(phong)) {
    selectedZaloRooms.delete(phong);
  } else {
    selectedZaloRooms.add(phong);
  }
  updateZaloSelectRoomsUI();
}

/**
 * Cập nhật giao diện đếm số và nút bấm trong Popup chọn phòng
 */
function updateZaloSelectRoomsUI() {
  const selectedCount = selectedZaloRooms.size;
  const eligibleCount = eligibleZaloRooms.length;

  const selectedCountEl = document.getElementById('zalo-selected-count');
  const eligibleCountEl = document.getElementById('zalo-eligible-count');
  if (selectedCountEl) selectedCountEl.textContent = selectedCount;
  if (eligibleCountEl) eligibleCountEl.textContent = eligibleCount;

  // Cập nhật từng checkbox và class selected
  eligibleZaloRooms.forEach(phong => {
    const cardEl = document.getElementById(`zalo-room-card-${phong}`);
    const chkEl = document.getElementById(`zalo-chk-${phong}`);
    const isChecked = selectedZaloRooms.has(phong);

    if (chkEl) chkEl.checked = isChecked;
    if (cardEl) {
      if (isChecked) {
        cardEl.classList.add('selected');
      } else {
        cardEl.classList.remove('selected');
      }
    }
  });

  // Cập nhật nút Xác Nhận Gửi
  const confirmBtn = document.getElementById('btn-confirm-send-zalo');
  const confirmBtnText = document.getElementById('btn-confirm-send-zalo-text');
  if (confirmBtn) {
    confirmBtn.disabled = selectedCount === 0;
  }
  if (confirmBtnText) {
    confirmBtnText.textContent = `Xác Nhận Gửi (${selectedCount} phòng)`;
  }
}

/**
 * Đóng Popup Chọn Phòng
 */
function closeZaloSelectRoomsModal() {
  const modalEl = document.getElementById('zalo-select-rooms-modal');
  if (modalEl) modalEl.style.display = 'none';
}

/**
 * Thực hiện gửi phiếu thu cho các phòng đã chọn
 */
async function executeSendZaloReceipts() {
  if (selectedZaloRooms.size === 0) return;

  const monthYearSelect = document.getElementById('month-year-select');
  const monthKey = monthYearSelect ? monthYearSelect.value : '';

  // Thu thập danh sách tác vụ gửi cho các phòng đã chọn
  const roomTasks = [];
  for (const phong of selectedZaloRooms) {
    const room = roomsData.find(r => r.phong === phong);
    if (!room) continue;

    const roomInfo = (roomsList || []).find(r => r.phong === room.phong);
    let hostResident = null;
    if (roomInfo) {
      if (roomInfo.chuPhong) {
        hostResident = (residentsList || []).find(res => res.id === roomInfo.chuPhong);
      }
      if (!hostResident && roomInfo.cmnd) {
        hostResident = (residentsList || []).find(res => res.cccd === roomInfo.cmnd);
      }
    }

    const hasDienMoi = isNotEmpty(room.dienMoi);
    const hasNuocMoi = isNotEmpty(room.nuocMoi);
    const isFullyEntered = hasDienMoi && hasNuocMoi;
    const calc = isFullyEntered ? calcRoom(room, appSettings) : null;

    roomTasks.push({
      phong: room.phong,
      tenChuPhong: hostResident ? hostResident.hoTen : (roomInfo?.tenKhach || ''),
      sdtZalo: hostResident ? (hostResident.sdtZalo || hostResident.sdtGoi || '') : '',
      sdtGoi: hostResident ? (hostResident.sdtGoi || '') : '',
      tongCong: (isFullyEntered && calc) ? calc.tongCong : 0
    });
  }

  // Đóng modal chọn phòng
  closeZaloSelectRoomsModal();

  // Khóa nút Gửi Zalo ở header và cập nhật text tiến trình
  const sendBtn = document.getElementById('btn-send-zalo-month');
  const originalBtnHTML = sendBtn ? sendBtn.innerHTML : '';

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      <span>Đang gửi 1/${roomTasks.length}...</span>
    `;
  }

  // Lắng nghe stream tiến trình từ backend
  if (window.api && typeof window.api.onZaloSendProgress === 'function') {
    window.api.onZaloSendProgress(({ current, total, phong }) => {
      if (sendBtn) {
        const spanEl = sendBtn.querySelector('span');
        if (spanEl) spanEl.textContent = `Đang gửi ${current}/${total}...`;
      }
    });
  }

  try {
    const result = await window.api.sendZaloReceipts({
      monthKey,
      roomTasks,
      appSettings
    });

    if (result && result.error) {
      showToast(`Lỗi gửi Zalo: ${result.message || result.error}`, 'error');
    } else if (result) {
      showZaloSummaryReportModal(result, monthKey);
    }
  } catch (err) {
    console.error('Lỗi khi thực thi gửi Zalo:', err);
    showToast(`Lỗi khi gửi Zalo: ${err.message}`, 'error');
  } finally {
    // Khôi phục nút Gửi Zalo ở header
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = originalBtnHTML;
    }
  }
}

/**
 * Hiển thị Modal Báo Cáo Tổng Kết Kết Quả
 */
function showZaloSummaryReportModal(result, monthKey) {
  const [yyyy, mm] = monthKey ? monthKey.split('-') : ['', ''];
  const formatMoney = (val) => new Intl.NumberFormat('vi-VN').format(val || 0);

  const titleEl = document.getElementById('zalo-summary-modal-title');
  const subtitleEl = document.getElementById('zalo-summary-modal-subtitle');
  if (titleEl) titleEl.textContent = `Kết Quả Gửi Phiếu Thu Zalo - Tháng ${mm}/${yyyy}`;
  if (subtitleEl) subtitleEl.textContent = `Tổng kết quá trình gửi phiếu thu tự động cho ${result.total} phòng`;

  const successCountEl = document.getElementById('zalo-stat-success-count');
  const failedCountEl = document.getElementById('zalo-stat-failed-count');
  const failedCardEl = document.getElementById('zalo-stat-card-failed');

  if (successCountEl) successCountEl.textContent = `${result.successCount} / ${result.total}`;
  if (failedCountEl) failedCountEl.textContent = result.failedCount;

  if (failedCardEl) {
    if (result.failedCount === 0) {
      failedCardEl.className = 'zalo-summary-stat-card failed zero';
    } else {
      failedCardEl.className = 'zalo-summary-stat-card failed';
    }
  }

  // Danh sách thất bại
  const failedSection = document.getElementById('zalo-summary-failed-section');
  const failedList = document.getElementById('zalo-summary-failed-list');
  const failedItems = (result.results || []).filter(r => !r.success);

  if (failedSection && failedList) {
    if (failedItems.length > 0) {
      failedSection.style.display = 'flex';
      failedList.innerHTML = failedItems.map(item => `
        <div class="zalo-summary-item failed">
          <div class="zalo-summary-item-left">
            <span class="zalo-summary-item-title">Phòng ${item.phong} · ${item.tenChuPhong || 'Chưa rõ'}</span>
            <span class="zalo-summary-item-sub">SĐT: ${item.sdt || 'Chưa có SĐT'}</span>
            <span class="zalo-summary-item-error">❌ ${item.error || 'Lỗi không xác định'}</span>
          </div>
          <span class="zalo-summary-item-badge failed">Thất Bại</span>
        </div>
      `).join('');
    } else {
      failedSection.style.display = 'none';
      failedList.innerHTML = '';
    }
  }

  // Danh sách thành công
  const successSection = document.getElementById('zalo-summary-success-section');
  const successList = document.getElementById('zalo-summary-success-list');
  const successItems = (result.results || []).filter(r => r.success);

  if (successSection && successList) {
    if (successItems.length > 0) {
      successSection.style.display = 'flex';
      successList.innerHTML = successItems.map(item => `
        <div class="zalo-summary-item success">
          <div class="zalo-summary-item-left">
            <span class="zalo-summary-item-title">Phòng ${item.phong} · ${item.tenChuPhong}</span>
            <span class="zalo-summary-item-sub">SĐT: ${item.sdt} · ${formatMoney(item.tongCong)} đ</span>
          </div>
          <span class="zalo-summary-item-badge success">Thành Công</span>
        </div>
      `).join('');
    } else {
      successSection.style.display = 'none';
      successList.innerHTML = '';
    }
  }

  const modalEl = document.getElementById('zalo-summary-report-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Đóng Modal Báo Cáo Tổng Kết
 */
function closeZaloSummaryReportModal() {
  const modalEl = document.getElementById('zalo-summary-report-modal');
  if (modalEl) modalEl.style.display = 'none';
}

/* ============================================================
   TÍCH HỢP TÀI KHOẢN ZALO (ZCA-JS)
   ============================================================ */
let isZaloConnected = false;
let currentZaloProfile = null;
let isZaloLoginInProgress = false;
let zaloCountdownInterval = null;
let zaloCountdownSeconds = 120;

/**
 * Bắt đầu đếm ngược thời gian hiệu lực mã QR (2 phút = 120s)
 */
function startZaloCountdown(duration = 120) {
  stopZaloCountdown();
  zaloCountdownSeconds = duration;
  const countdownEl = document.getElementById('zalo-qr-countdown');

  if (countdownEl) {
    countdownEl.className = 'zalo-qr-countdown';
    countdownEl.style.display = 'inline-flex';
  }
  updateCountdownDisplay(zaloCountdownSeconds);

  zaloCountdownInterval = setInterval(() => {
    zaloCountdownSeconds--;
    if (zaloCountdownSeconds <= 0) {
      handleZaloQrTimeoutExpired();
    } else {
      updateCountdownDisplay(zaloCountdownSeconds);
    }
  }, 1000);
}

/**
 * Cập nhật hiển thị số giây đếm ngược dạng mm:ss
 */
function updateCountdownDisplay(seconds) {
  const timerEl = document.getElementById('zalo-countdown-timer');
  const countdownEl = document.getElementById('zalo-qr-countdown');
  if (!timerEl) return;

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  if (countdownEl) {
    if (seconds <= 15) {
      countdownEl.className = 'zalo-qr-countdown danger';
    } else if (seconds <= 40) {
      countdownEl.className = 'zalo-qr-countdown warning';
    } else {
      countdownEl.className = 'zalo-qr-countdown';
    }
  }
}

/**
 * Dừng đếm ngược và ẩn badge
 */
function stopZaloCountdown() {
  if (zaloCountdownInterval) {
    clearInterval(zaloCountdownInterval);
    zaloCountdownInterval = null;
  }
  const countdownEl = document.getElementById('zalo-qr-countdown');
  if (countdownEl) {
    countdownEl.style.display = 'none';
  }
}

/**
 * Xóa sạch ảnh QR trong bộ nhớ và DOM khi thoát hoặc hoàn tất
 */
function clearZaloQrImage() {
  const qrImgEl = document.getElementById('zalo-qr-image');
  if (qrImgEl) {
    qrImgEl.src = '';
  }
  const imgWrapEl = document.getElementById('zalo-qr-image-wrap');
  if (imgWrapEl) {
    imgWrapEl.style.display = 'none';
  }
}

/**
 * Xử lý khi hết hạn 2 phút đếm ngược
 */
async function handleZaloQrTimeoutExpired() {
  stopZaloCountdown();
  clearZaloQrImage();

  if (window.api && typeof window.api.abortZaloQrLogin === 'function') {
    try {
      await window.api.abortZaloQrLogin();
    } catch (e) {}
  }
  isZaloLoginInProgress = false;

  const overlayEl = document.getElementById('zalo-qr-overlay');
  const overlayContentEl = document.getElementById('zalo-overlay-content');
  const statusTextEl = document.getElementById('zalo-qr-status-text');
  const actionsEl = document.getElementById('zalo-qr-actions');

  if (overlayEl) overlayEl.style.display = 'flex';
  if (overlayContentEl) {
    overlayContentEl.innerHTML = `
      <div class="zalo-overlay-icon warning">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <h4 class="zalo-overlay-title">Mã QR Đã Hết Hạn</h4>
      <p class="zalo-overlay-subtitle">Đã quá thời gian chờ quét mã (2 phút)</p>
    `;
  }
  if (actionsEl) actionsEl.style.display = 'flex';
  if (statusTextEl) statusTextEl.textContent = 'Mã QR đã hết hạn sau 2 phút. Vui lòng bấm "Tạo Mã QR Mới" để tiếp tục.';
}

/**
 * Khởi tạo kiểm tra trạng thái Zalo và đăng ký lắng nghe sự kiện
 */
async function initZaloIntegration() {
  if (!window.api) return;

  // Lắng nghe sự kiện QR stream từ Main Process
  if (typeof window.api.onZaloQrEvent === 'function') {
    window.api.onZaloQrEvent((event) => {
      handleZaloQrStreamEvent(event);
    });
  }

  // Khôi phục trạng thái ngầm lúc mở app
  if (typeof window.api.getZaloStatus === 'function') {
    try {
      const res = await window.api.getZaloStatus();
      if (res && res.connected && res.profile) {
        updateZaloProfileUI(true, res.profile);
      } else {
        updateZaloProfileUI(false, null);
      }
    } catch (e) {
      console.warn('Lỗi khi lấy trạng thái Zalo ban đầu:', e);
      updateZaloProfileUI(false, null);
    }
  }
}

/**
 * Cập nhật giao diện Profile Card Zalo trong tab Cài Đặt Chung
 */
function updateZaloProfileUI(isConnected, profile) {
  isZaloConnected = !!isConnected;
  currentZaloProfile = profile || null;

  const placeholderEl = document.getElementById('zalo-avatar-placeholder');
  const avatarImgEl = document.getElementById('zalo-avatar-img');
  const badgeEl = document.getElementById('zalo-status-badge');
  const statusTextEl = document.getElementById('zalo-status-text');
  const nameEl = document.getElementById('zalo-display-name');
  const phoneEl = document.getElementById('zalo-display-phone');
  const btnLogin = document.getElementById('btn-zalo-qr-login');
  const btnSwitch = document.getElementById('btn-zalo-switch');
  const btnLogout = document.getElementById('btn-zalo-logout');

  if (isConnected && profile) {
    if (badgeEl) {
      badgeEl.className = 'zalo-status-badge connected';
    }
    if (statusTextEl) {
      statusTextEl.textContent = 'Đã Kết Nối Zalo';
    }
    if (nameEl) {
      nameEl.textContent = profile.displayName || 'Tài khoản Zalo';
    }
    if (phoneEl) {
      if (profile.phoneNumber) {
        phoneEl.textContent = `SĐT: ${profile.phoneNumber}`;
      } else if (profile.userId) {
        phoneEl.textContent = `ID Zalo: ${profile.userId}`;
      } else {
        phoneEl.textContent = 'Đang sẵn sàng gửi phiếu thu tự động';
      }
    }

    if (avatarImgEl) {
      if (profile.avatar) {
        avatarImgEl.src = profile.avatar;
        avatarImgEl.style.display = 'block';
        if (placeholderEl) placeholderEl.style.display = 'none';
        avatarImgEl.onerror = () => {
          avatarImgEl.style.display = 'none';
          if (placeholderEl) placeholderEl.style.display = 'flex';
        };
      } else {
        avatarImgEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = 'flex';
      }
    }

    if (btnLogin) btnLogin.style.display = 'none';
    if (btnSwitch) btnSwitch.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
  } else {
    if (badgeEl) {
      badgeEl.className = 'zalo-status-badge disconnected';
    }
    if (statusTextEl) {
      statusTextEl.textContent = 'Chưa kết nối Zalo';
    }
    if (nameEl) {
      nameEl.textContent = 'Chưa Đăng Nhập';
    }
    if (phoneEl) {
      phoneEl.textContent = 'Bấm "Đăng Nhập Bằng Mã QR" để quét mã kết nối';
    }

    if (avatarImgEl) {
      avatarImgEl.style.display = 'none';
      avatarImgEl.src = '';
    }
    if (placeholderEl) {
      placeholderEl.style.display = 'flex';
    }

    if (btnLogin) btnLogin.style.display = 'inline-flex';
    if (btnSwitch) btnSwitch.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
  }
}

/**
 * Nút "Đăng Nhập Bằng Mã QR"
 */
async function handleZaloQrLoginClick() {
  if (isZaloLoginInProgress) {
    showToast('Tiến trình quét mã QR đang diễn ra!', 'warning');
    return;
  }
  openZaloQrModal(false);
}

/**
 * Nút "Đổi Tài Khoản"
 */
async function handleZaloSwitchAccountClick() {
  if (isZaloLoginInProgress) {
    showToast('Tiến trình quét mã QR đang diễn ra!', 'warning');
    return;
  }
  openZaloQrModal(true);
}

/**
 * Mở modal quét mã QR Zalo và khởi chạy backend
 */
async function openZaloQrModal(isSwitchMode = false) {
  if (!window.api || typeof window.api.startZaloQrLogin !== 'function') {
    showToast('Chức năng Zalo chỉ khả dụng trên ứng dụng Electron!', 'error');
    return;
  }

  isZaloLoginInProgress = true;
  stopZaloCountdown();
  clearZaloQrImage();

  const modalEl = document.getElementById('zalo-qr-modal');
  const titleEl = document.getElementById('zalo-qr-modal-title');
  const subtitleEl = document.getElementById('zalo-qr-modal-subtitle');
  const loadingEl = document.getElementById('zalo-qr-loading');
  const loadingTextEl = document.getElementById('zalo-qr-loading-text');
  const imgWrapEl = document.getElementById('zalo-qr-image-wrap');
  const overlayEl = document.getElementById('zalo-qr-overlay');
  const statusTextEl = document.getElementById('zalo-qr-status-text');
  const actionsEl = document.getElementById('zalo-qr-actions');

  if (titleEl) {
    titleEl.textContent = isSwitchMode ? 'Đổi Tài Khoản Zalo' : 'Đăng Nhập Zalo Bằng Mã QR';
  }
  if (subtitleEl) {
    subtitleEl.textContent = isSwitchMode
      ? 'Dùng ứng dụng Zalo trên điện thoại quét mã bằng tài khoản mới'
      : 'Dùng ứng dụng Zalo trên điện thoại để quét mã kết nối';
  }

  if (loadingEl) loadingEl.style.display = 'flex';
  if (loadingTextEl) loadingTextEl.textContent = 'Đang tạo mã QR đăng nhập...';
  if (imgWrapEl) imgWrapEl.style.display = 'none';
  if (overlayEl) overlayEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';
  if (statusTextEl) statusTextEl.textContent = 'Mở Zalo trên điện thoại > Chọn biểu tượng Quét mã QR';

  if (modalEl) modalEl.style.display = 'flex';

  try {
    const res = await window.api.startZaloQrLogin();
    if (res && res.error && res.error !== 'TU_CHOI_DANG_NHAP' && res.error !== 'LOI_DANG_NHAP') {
      console.warn('Kết quả startZaloQrLogin:', res);
    }
  } catch (err) {
    console.error('Lỗi khi bắt đầu quét QR Zalo:', err);
    showToast(`Lỗi kết nối Zalo: ${err.message}`, 'error');
    isZaloLoginInProgress = false;
    stopZaloCountdown();
    clearZaloQrImage();
  }
}

/**
 * Xử lý các sự kiện thời gian thực từ luồng QR backend (zca-js)
 */
function handleZaloQrStreamEvent(event) {
  if (!event) return;

  const loadingEl = document.getElementById('zalo-qr-loading');
  const loadingTextEl = document.getElementById('zalo-qr-loading-text');
  const imgWrapEl = document.getElementById('zalo-qr-image-wrap');
  const qrImgEl = document.getElementById('zalo-qr-image');
  const overlayEl = document.getElementById('zalo-qr-overlay');
  const overlayContentEl = document.getElementById('zalo-overlay-content');
  const statusTextEl = document.getElementById('zalo-qr-status-text');
  const actionsEl = document.getElementById('zalo-qr-actions');

  switch (event.type) {
    case 'generating': {
      stopZaloCountdown();
      clearZaloQrImage();
      if (loadingEl) loadingEl.style.display = 'flex';
      if (loadingTextEl) loadingTextEl.textContent = event.data?.message || 'Đang tạo mã QR...';
      if (imgWrapEl) imgWrapEl.style.display = 'none';
      if (overlayEl) overlayEl.style.display = 'none';
      if (actionsEl) actionsEl.style.display = 'none';
      if (statusTextEl) statusTextEl.textContent = 'Vui lòng chờ trong giây lát...';
      break;
    }

    case 'qr_generated': {
      if (loadingEl) loadingEl.style.display = 'none';
      if (imgWrapEl) imgWrapEl.style.display = 'flex';
      if (qrImgEl && event.data && event.data.image) {
        qrImgEl.src = event.data.image;
      }
      if (overlayEl) overlayEl.style.display = 'none';
      if (actionsEl) actionsEl.style.display = 'none';
      if (statusTextEl) statusTextEl.textContent = 'Mở Zalo trên điện thoại > Chọn biểu tượng Quét mã QR';

      // Khởi động đồng hồ đếm ngược 2 phút (120s)
      startZaloCountdown(120);
      break;
    }

    case 'qr_scanned': {
      if (overlayEl) overlayEl.style.display = 'flex';
      if (overlayContentEl) {
        let iconOrAvatar = '';
        if (event.data && event.data.avatar) {
          iconOrAvatar = `<img src="${event.data.avatar}" alt="Avatar" class="zalo-overlay-avatar">`;
        } else {
          iconOrAvatar = `
            <div class="zalo-overlay-icon scanned">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          `;
        }
        const name = event.data?.displayName ? event.data.displayName : 'Đã Quét Mã QR';
        overlayContentEl.innerHTML = `
          ${iconOrAvatar}
          <h4 class="zalo-overlay-title">${name}</h4>
          <p class="zalo-overlay-subtitle">Đang chờ bạn xác nhận Đăng nhập trên điện thoại...</p>
        `;
      }
      if (actionsEl) actionsEl.style.display = 'none';
      if (statusTextEl) statusTextEl.textContent = 'Vui lòng bấm "Đăng nhập" trên ứng dụng Zalo điện thoại';
      break;
    }

    case 'qr_expired': {
      stopZaloCountdown();
      clearZaloQrImage();
      if (overlayEl) overlayEl.style.display = 'flex';
      if (overlayContentEl) {
        overlayContentEl.innerHTML = `
          <div class="zalo-overlay-icon warning">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <h4 class="zalo-overlay-title">Mã QR Đã Hết Hạn</h4>
          <p class="zalo-overlay-subtitle">Mã QR đã quá thời gian hiệu lực</p>
        `;
      }
      if (actionsEl) actionsEl.style.display = 'flex';
      if (statusTextEl) statusTextEl.textContent = 'Mã QR đã hết hạn. Bấm "Tạo Mã QR Mới" để tiếp tục.';
      break;
    }

    case 'qr_declined': {
      stopZaloCountdown();
      clearZaloQrImage();
      if (overlayEl) overlayEl.style.display = 'flex';
      if (overlayContentEl) {
        overlayContentEl.innerHTML = `
          <div class="zalo-overlay-icon danger">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
          </div>
          <h4 class="zalo-overlay-title">Bị Từ Chối Đăng Nhập</h4>
          <p class="zalo-overlay-subtitle">Bạn đã chọn từ chối trên điện thoại</p>
        `;
      }
      if (actionsEl) actionsEl.style.display = 'flex';
      if (statusTextEl) statusTextEl.textContent = 'Yêu cầu đăng nhập bị từ chối. Bấm nút bên dưới để thử lại.';
      break;
    }

    case 'confirming': {
      if (overlayEl) overlayEl.style.display = 'flex';
      if (overlayContentEl) {
        overlayContentEl.innerHTML = `
          <div class="zalo-overlay-icon success">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <h4 class="zalo-overlay-title">Xác Nhận Thành Công!</h4>
          <p class="zalo-overlay-subtitle">Đang lưu thông tin phiên đăng nhập...</p>
        `;
      }
      if (actionsEl) actionsEl.style.display = 'none';
      if (statusTextEl) statusTextEl.textContent = 'Đang thiết lập phiên làm việc Zalo...';
      break;
    }

    case 'success': {
      stopZaloCountdown();
      clearZaloQrImage();
      isZaloLoginInProgress = false;
      const profile = event.data?.profile;
      updateZaloProfileUI(true, profile);
      setTimeout(() => {
        const modalEl = document.getElementById('zalo-qr-modal');
        if (modalEl) modalEl.style.display = 'none';

        if (typeof pendingActionAfterZaloLogin === 'function') {
          const action = pendingActionAfterZaloLogin;
          pendingActionAfterZaloLogin = null;
          action();
        }
      }, 500);
      showToast(`Đăng nhập Zalo thành công: ${profile?.displayName || 'Tài khoản Zalo'}!`, 'success');
      break;
    }

    case 'aborted': {
      stopZaloCountdown();
      clearZaloQrImage();
      isZaloLoginInProgress = false;
      pendingActionAfterZaloLogin = null;
      const modalEl = document.getElementById('zalo-qr-modal');
      if (modalEl) modalEl.style.display = 'none';
      break;
    }

    case 'error': {
      stopZaloCountdown();
      clearZaloQrImage();
      isZaloLoginInProgress = false;
      pendingActionAfterZaloLogin = null;
      if (overlayEl) overlayEl.style.display = 'flex';
      const errMsg = event.data?.message || 'Không thể kết nối tới Zalo. Vui lòng kiểm tra lại mạng!';
      if (overlayContentEl) {
        overlayContentEl.innerHTML = `
          <div class="zalo-overlay-icon danger">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h4 class="zalo-overlay-title">Lỗi Kết Nối</h4>
          <p class="zalo-overlay-subtitle">${errMsg}</p>
        `;
      }
      if (actionsEl) actionsEl.style.display = 'flex';
      if (statusTextEl) statusTextEl.textContent = errMsg;
      break;
    }

    default:
      break;
  }
}

/**
 * Hủy bỏ tiến trình đăng nhập QR (nút X hoặc Hủy)
 */
async function cancelZaloQrLogin() {
  stopZaloCountdown();
  clearZaloQrImage();
  pendingActionAfterZaloLogin = null;

  const modalEl = document.getElementById('zalo-qr-modal');
  if (modalEl) modalEl.style.display = 'none';

  if (window.api && typeof window.api.abortZaloQrLogin === 'function') {
    try {
      await window.api.abortZaloQrLogin();
    } catch (e) {
      console.warn('Lỗi khi hủy phiên QR Zalo:', e);
    }
  }

  isZaloLoginInProgress = false;
}

/**
 * Thử lại / Tạo mã mới
 */
async function retryZaloQrLogin() {
  stopZaloCountdown();
  clearZaloQrImage();

  const loadingEl = document.getElementById('zalo-qr-loading');
  const loadingTextEl = document.getElementById('zalo-qr-loading-text');
  const imgWrapEl = document.getElementById('zalo-qr-image-wrap');
  const overlayEl = document.getElementById('zalo-qr-overlay');
  const statusTextEl = document.getElementById('zalo-qr-status-text');
  const actionsEl = document.getElementById('zalo-qr-actions');

  if (loadingEl) loadingEl.style.display = 'flex';
  if (loadingTextEl) loadingTextEl.textContent = 'Đang tạo lại mã QR mới...';
  if (imgWrapEl) imgWrapEl.style.display = 'none';
  if (overlayEl) overlayEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';
  if (statusTextEl) statusTextEl.textContent = 'Đang tải mã QR mới từ máy chủ Zalo...';

  isZaloLoginInProgress = true;

  if (window.api && typeof window.api.retryZaloQrLogin === 'function') {
    try {
      await window.api.retryZaloQrLogin();
    } catch (err) {
      console.error('Lỗi khi tạo lại mã QR Zalo:', err);
      showToast(`Không thể tạo lại mã QR: ${err.message}`, 'error');
      isZaloLoginInProgress = false;
    }
  }
}

/**
 * Đăng xuất tài khoản Zalo
 */
async function handleZaloLogoutClick() {
  if (!window.api || typeof window.api.logoutZalo !== 'function') {
    showToast('Chức năng Đăng xuất Zalo chỉ khả dụng trên ứng dụng Electron!', 'error');
    return;
  }

  try {
    await window.api.logoutZalo();
    updateZaloProfileUI(false, null);
    showToast('Đã đăng xuất tài khoản Zalo thành công!', 'success');
  } catch (err) {
    console.error('Lỗi khi đăng xuất Zalo:', err);
    showToast(`Lỗi khi đăng xuất: ${err.message}`, 'error');
  }
}

/**
 * Loại bỏ dấu tiếng Việt (chuyển thành chữ không dấu)
 */
function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, m => (m === 'đ' ? 'd' : 'D'));
  return str;
}

// Gắn các hàm lên window để các thuộc tính onclick trong HTML gọi được trực tiếp
window.switchTab = switchTab;
window.openAddResidentModal = openAddResidentModal;
window.openEditResidentModal = openEditResidentModal;
window.closeResidentFormModal = closeResidentFormModal;
window.switchFormTab = switchFormTab;
window.copyPhoneToZalo = copyPhoneToZalo;
window.setMoveInDateToday = setMoveInDateToday;
window.pickCccdImage = pickCccdImage;
window.removeCccdImage = removeCccdImage;
window.submitResidentForm = submitResidentForm;
window.openRoomDetailModal = openRoomDetailModal;
window.closeRoomDetailModal = closeRoomDetailModal;
window.onRoomHostChange = onRoomHostChange;
window.saveRoomDetailAssignment = saveRoomDetailAssignment;
window.filterResidentsTable = filterResidentsTable;
window.toggleSelectAllResidents = toggleSelectAllResidents;
window.onResidentCheckboxChange = onResidentCheckboxChange;
window.viewCccdPhoto = viewCccdPhoto;
window.switchLightboxPhoto = switchLightboxPhoto;
window.closeCccdLightbox = closeCccdLightbox;
window.confirmDeleteSingleResident = confirmDeleteSingleResident;
window.confirmDeleteSelectedResidents = confirmDeleteSelectedResidents;
window.closeDeleteResidentModal = closeDeleteResidentModal;
window.executeDeleteResidents = executeDeleteResidents;
window.handleSendZaloMonthClick = handleSendZaloMonthClick;
window.openZaloSelectRoomsModal = openZaloSelectRoomsModal;
window.closeZaloSelectRoomsModal = closeZaloSelectRoomsModal;
window.toggleSelectAllZaloRooms = toggleSelectAllZaloRooms;
window.toggleZaloRoomSelection = toggleZaloRoomSelection;
window.executeSendZaloReceipts = executeSendZaloReceipts;
window.showZaloSummaryReportModal = showZaloSummaryReportModal;
window.closeZaloSummaryReportModal = closeZaloSummaryReportModal;
window.handleZaloQrLoginClick = handleZaloQrLoginClick;
window.handleZaloSwitchAccountClick = handleZaloSwitchAccountClick;
window.handleZaloLogoutClick = handleZaloLogoutClick;
window.cancelZaloQrLogin = cancelZaloQrLogin;
window.retryZaloQrLogin = retryZaloQrLogin;
window.removeVietnameseTones = removeVietnameseTones;
window.saveBankSettings = saveBankSettings;





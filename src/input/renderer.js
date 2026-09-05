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
  enableAnomalyPopup: true
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
            enableAnomalyPopup: data.enableAnomalyPopup !== undefined ? data.enableAnomalyPopup : true
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
    enableAnomalyPopup: appSettings.enableAnomalyPopup !== false
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

  // Tải danh sách phòng & người ở cho 2 module mới
  await loadRoomsAndPersons();

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
});

/**
 * Đổi tab giữa 4 phần
 */
function switchTab(tabName) {
  const sectionSettings = document.getElementById('section-settings');
  const isCurrentSettings = sectionSettings && sectionSettings.classList.contains('active');

  if (isCurrentSettings && tabName !== 'settings' && isSettingsDirty) {
    pendingActionAfterUnsavedModal = () => forceSwitchTab(tabName);
    showUnsavedSettingsModal();
    return;
  }

  forceSwitchTab(tabName);
}

function forceSwitchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabName}`);
  const sec = document.getElementById(`section-${tabName}`);
  if (btn) btn.classList.add('active');
  if (sec) sec.classList.add('active');

  if (tabName === 'rooms') {
    renderRoomsGrid();
  } else if (tabName === 'persons') {
    renderPersonsTable();
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

  isSettingsDirty = false;
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

  const ok = await saveSettingsFile();

  if (!ok) {
    if (baseFolderInput) baseFolderInput.classList.add('input-error');
    return false; // Đã báo lỗi trong saveSettingsFile, dừng tại đây
  }

  isSettingsDirty = false;

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
  if (isSettingsDirty) {
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
   XỬ LÝ MODAL CẢNH BÁO THAY ĐỔI CÀI ĐẶT CHƯA LƯU
   ============================================================ */
let isSettingsDirty = false;
let pendingActionAfterUnsavedModal = null;

function markSettingsDirty() {
  isSettingsDirty = true;
}

function showUnsavedSettingsModal() {
  const modalEl = document.getElementById('unsaved-settings-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

async function confirmSaveUnsavedSettingsModal() {
  closeUnsavedSettingsModal();
  const fakeEvent = { preventDefault: () => {} };
  const saved = await saveSettings(fakeEvent);
  if (saved !== false && typeof pendingActionAfterUnsavedModal === 'function') {
    const action = pendingActionAfterUnsavedModal;
    pendingActionAfterUnsavedModal = null;
    action();
  }
}

function discardUnsavedSettingsModal() {
  closeUnsavedSettingsModal();
  initSettingsForm();
  isSettingsDirty = false;
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

/**
 * Nút "Để sau (Hủy)" đóng Pop-up Cập Nhật
 */
function cancelUpdateModal() {
  const modalEl = document.getElementById('update-modal');
  if (modalEl) modalEl.style.display = 'none';
  isManualUpdateCheck = false;
}

/* ============================================================
   MODULE 1: QUẢN LÝ PHÒNG & THÔNG TIN NGƯỜI Ở (STATE & LOGIC)
   ============================================================ */

let allRooms = [];
let allPersons = [];
let selectedPersonIds = new Set();
let currentRoomDetail = null;
let selectedRoomMemberIds = new Set();
let activePersonPhotoForm = {
  frontBase64: null,
  backBase64: null,
  removeFront: false,
  removeBack: false
};
let personSearchQuery = '';
let personFilterRoom = '';
let currentLightboxPerson = null;
let currentLightboxSide = 'front';

/**
 * Tải toàn bộ dữ liệu Phòng và Người ở từ IPC
 */
async function loadRoomsAndPersons() {
  if (!window.api) return;
  try {
    const res = await window.api.getRooms();
    if (res) {
      allRooms = res.rooms || [];
      allPersons = res.persons || [];
    } else {
      const pRes = await window.api.getPersons();
      allPersons = pRes || [];
    }
    
    renderRoomsGrid();
    renderPersonsTable();
    updateRoomFilterDropdown();
    updatePersonRoomDropdown();

    // Nếu Modal Chi Tiết Phòng đang mở, cập nhật lại giao diện modal đó theo dữ liệu mới
    if (currentRoomDetail) {
      const updatedRoom = allRooms.find(r => r.phong === currentRoomDetail.phong || r.id === currentRoomDetail.id);
      if (updatedRoom) {
        currentRoomDetail = updatedRoom;
        populateRoomOwnerSelect();
        renderRoomMembersTable();
      }
    }
  } catch (err) {
    console.error('Lỗi khi tải dữ liệu phòng & người ở:', err);
  }
}

/**
 * Cập nhật danh sách phòng trong dropdown lọc của trang Thông tin người ở
 */
function updateRoomFilterDropdown() {
  const select = document.getElementById('person-filter-room');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `
    <option value="">Tất cả phòng</option>
    <option value="_unassigned">Chưa xếp phòng</option>
  `;

  DEFAULT_ROOM_NAMES.forEach(roomName => {
    const opt = document.createElement('option');
    opt.value = roomName;
    opt.textContent = `Phòng ${roomName}`;
    select.appendChild(opt);
  });

  if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
    select.value = currentVal;
  }
}

/**
 * Cập nhật danh sách phòng trong form Thêm/Sửa Người ở
 */
function updatePersonRoomDropdown() {
  const select = document.getElementById('person-phongId');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">Chưa xếp phòng</option>`;

  DEFAULT_ROOM_NAMES.forEach(roomName => {
    const opt = document.createElement('option');
    opt.value = roomName;
    opt.textContent = `Phòng ${roomName}`;
    select.appendChild(opt);
  });

  if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
    select.value = currentVal;
  }
}

/* ============================================================
   PHẦN 2: QUẢN LÝ PHÒNG (RENDER & ACTIONS)
   ============================================================ */

/**
 * Render lưới 12 Card Phòng & Thống kê tổng quan
 */
function renderRoomsGrid() {
  const container = document.getElementById('rooms-grid-container');
  if (!container) return;

  // 1. Thống kê
  const totalRooms = 12;
  const occupiedRoomsList = allRooms.filter(r => r.chuPhongId || (r.thanhVienIds && r.thanhVienIds.length > 0));
  const occupiedCount = occupiedRoomsList.length;
  const emptyCount = totalRooms - occupiedCount;
  const totalTenants = allPersons.filter(p => p.phongId && p.phongId.trim() !== '').length;

  const statTotalEl = document.getElementById('stat-rooms-total');
  const statTenantsEl = document.getElementById('stat-rooms-tenants');
  const statOccupiedEl = document.getElementById('stat-rooms-occupied');
  const statEmptyEl = document.getElementById('stat-rooms-empty');

  if (statTotalEl) statTotalEl.textContent = `${totalRooms} Phòng`;
  if (statTenantsEl) statTenantsEl.textContent = `${totalTenants} Người`;
  if (statOccupiedEl) statOccupiedEl.textContent = `${occupiedCount} / ${totalRooms}`;
  if (statEmptyEl) statEmptyEl.textContent = `${emptyCount} Phòng`;

  // 2. Render 12 Cards
  container.innerHTML = DEFAULT_ROOM_NAMES.map(roomName => {
    let room = allRooms.find(r => r.phong === roomName || r.id === roomName);
    if (!room) {
      room = { id: roomName, phong: roomName, chuPhongId: null, thanhVienIds: [] };
    }

    const allMemberIds = Array.from(new Set([room.chuPhongId, ...(room.thanhVienIds || [])].filter(Boolean)));
    const totalMembers = allMemberIds.length;
    const isOccupied = totalMembers > 0;

    let ownerPerson = room.chuPhongId ? allPersons.find(p => p.id === room.chuPhongId) : null;
    let otherMembers = (room.thanhVienIds || []).map(id => allPersons.find(p => p.id === id)).filter(Boolean);

    return `
      <div class="room-card ${isOccupied ? '' : 'empty'}" onclick="openRoomDetailModal('${roomName}')">
        <div class="room-card-header">
          <span class="room-number-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            </svg>
            Phòng ${roomName}
          </span>
          <span class="badge-status ${isOccupied ? 'occupied' : 'empty'}">
            ${isOccupied ? `Đang thuê (${totalMembers})` : 'Phòng trống'}
          </span>
        </div>

        <div class="room-card-body">
          <div class="room-owner-row">
            <span>👑 Chủ phòng:</span>
            ${ownerPerson 
              ? `<span class="room-owner-name">${ownerPerson.hoTen}</span>` 
              : `<span class="room-owner-empty">Chưa có chủ phòng</span>`}
          </div>

          <div class="room-members-preview">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 2px;">
              Thành viên khác (${otherMembers.length}):
            </div>
            <div class="room-members-list-preview">
              ${otherMembers.length > 0 
                ? otherMembers.map(m => `<span class="member-chip">${m.hoTen}</span>`).join('')
                : `<span style="font-size: 12px; color: #94a3b8; font-style: italic;">Không có</span>`}
            </div>
          </div>
        </div>

        <div class="room-card-footer">
          <span>Chi tiết phòng & thành viên</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Mở Modal Chi Tiết Phòng
 */
function openRoomDetailModal(roomId) {
  let room = allRooms.find(r => r.phong === roomId || r.id === roomId);
  if (!room) {
    room = { id: roomId, phong: roomId, chuPhongId: null, thanhVienIds: [] };
  }

  currentRoomDetail = { ...room, thanhVienIds: [...(room.thanhVienIds || [])] };
  selectedRoomMemberIds.clear();

  const titleEl = document.getElementById('room-modal-title');
  const badgeEl = document.getElementById('room-modal-status-badge');
  const selectAllCb = document.getElementById('room-member-select-all');

  if (titleEl) titleEl.textContent = `Chi Tiết Phòng ${roomId}`;
  if (selectAllCb) selectAllCb.checked = false;

  const allMemberIds = Array.from(new Set([currentRoomDetail.chuPhongId, ...(currentRoomDetail.thanhVienIds || [])].filter(Boolean)));
  if (badgeEl) {
    if (allMemberIds.length > 0) {
      badgeEl.className = 'badge-status occupied';
      badgeEl.textContent = `Đang thuê (${allMemberIds.length} người)`;
    } else {
      badgeEl.className = 'badge-status empty';
      badgeEl.textContent = 'Phòng trống';
    }
  }

  populateRoomOwnerSelect();
  renderRoomMembersTable();

  const modalEl = document.getElementById('room-detail-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Đóng Modal Chi Tiết Phòng
 */
function closeRoomDetailModal() {
  const modalEl = document.getElementById('room-detail-modal');
  if (modalEl) modalEl.style.display = 'none';
  currentRoomDetail = null;
  selectedRoomMemberIds.clear();
}

/**
 * Điền danh sách chọn Chủ phòng trong Modal
 */
function populateRoomOwnerSelect() {
  const select = document.getElementById('room-owner-select');
  if (!select || !currentRoomDetail) return;

  // Lấy danh sách người hợp lệ: người chưa có phòng hoặc đang ở phòng này
  const validCandidates = allPersons.filter(p => !p.phongId || p.phongId.trim() === '' || p.phongId === currentRoomDetail.phong);

  select.innerHTML = '<option value="">-- Chưa có chủ phòng đại diện --</option>';
  validCandidates.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const cccdSuffix = p.soCCCD ? ` (CCCD: ${p.soCCCD})` : '';
    const phoneSuffix = p.sdtGoi ? ` - SĐT: ${p.sdtGoi}` : '';
    opt.textContent = `${p.hoTen}${cccdSuffix}${phoneSuffix}`;
    if (currentRoomDetail.chuPhongId === p.id) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

/**
 * Xử lý khi người dùng chọn chủ phòng khác trong dropdown
 */
function onRoomOwnerSelectChange() {
  const select = document.getElementById('room-owner-select');
  if (!select || !currentRoomDetail) return;

  const newOwnerId = select.value || null;
  currentRoomDetail.chuPhongId = newOwnerId;

  // Nếu người này trước đó là thành viên, gỡ khỏi thanhVienIds
  if (newOwnerId && currentRoomDetail.thanhVienIds.includes(newOwnerId)) {
    currentRoomDetail.thanhVienIds = currentRoomDetail.thanhVienIds.filter(id => id !== newOwnerId);
  }

  renderRoomMembersTable();
}

/**
 * Bỏ chọn chủ phòng
 */
function clearRoomOwner() {
  const select = document.getElementById('room-owner-select');
  if (select) select.value = '';
  if (currentRoomDetail) {
    currentRoomDetail.chuPhongId = null;
  }
  renderRoomMembersTable();
}

/**
 * Render bảng thành viên trong Modal Chi Tiết Phòng
 */
function renderRoomMembersTable() {
  const tbody = document.getElementById('room-members-table-body');
  const countEl = document.getElementById('room-members-count');
  if (!tbody || !currentRoomDetail) return;

  const memberIds = Array.from(new Set([currentRoomDetail.chuPhongId, ...(currentRoomDetail.thanhVienIds || [])].filter(Boolean)));
  const members = memberIds.map(id => allPersons.find(p => p.id === id)).filter(Boolean);

  if (countEl) countEl.textContent = members.length;

  if (members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 24px;">Phòng hiện chưa có thành viên nào</td></tr>`;
    updateRoomMemberActionButtons();
    return;
  }

  tbody.innerHTML = members.map(m => {
    const isOwner = m.id === currentRoomDetail.chuPhongId;
    const isChecked = selectedRoomMemberIds.has(m.id);
    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="onRoomMemberCheckboxChange('${m.id}', this.checked)">
        </td>
        <td>
          <div class="person-name-cell">
            <span class="gender-avatar ${m.gioiTinh === 'Nữ' ? 'female' : 'male'}">${m.gioiTinh === 'Nữ' ? '👩' : '👨'}</span>
            <span>${m.hoTen}</span>
          </div>
        </td>
        <td>
          <span class="badge-status ${isOwner ? 'occupied' : 'empty'}">${isOwner ? '👑 Chủ phòng' : 'Thành viên'}</span>
        </td>
        <td>${m.sdtGoi || '-'}</td>
        <td>${m.soCCCD || '-'}</td>
        <td style="text-align: center;">${m.ngaySinh ? `<div class="dob-stacked-cell"><span class="dob-date-main">${m.ngaySinh}</span>${calculateAge(m.ngaySinh) !== null ? `<span class="dob-age-sub">(${calculateAge(m.ngaySinh)} tuổi)</span>` : ''}</div>` : '-'}</td>
        <td style="text-align: center;">${m.ngayVaoO || '-'}</td>
        <td style="text-align: center;">
          <div class="table-actions-group">
            <button type="button" class="btn-icon-action" onclick="openEditPersonModal('${m.id}')" title="Sửa thông tin">✏️</button>
            <button type="button" class="btn-icon-action delete" onclick="removeSingleMemberFromRoom('${m.id}')" title="Gỡ khỏi phòng">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateRoomMemberActionButtons();
}

/**
 * Chọn / Bỏ chọn tất cả thành viên trong Modal Chi Tiết Phòng
 */
function toggleSelectAllRoomMembers(checked) {
  if (!currentRoomDetail) return;
  const memberIds = Array.from(new Set([currentRoomDetail.chuPhongId, ...(currentRoomDetail.thanhVienIds || [])].filter(Boolean)));
  
  if (checked) {
    memberIds.forEach(id => selectedRoomMemberIds.add(id));
  } else {
    selectedRoomMemberIds.clear();
  }

  renderRoomMembersTable();
}

/**
 * Xử lý checkbox từng thành viên trong Modal Chi Tiết Phòng
 */
function onRoomMemberCheckboxChange(personId, checked) {
  if (checked) {
    selectedRoomMemberIds.add(personId);
  } else {
    selectedRoomMemberIds.delete(personId);
  }
  updateRoomMemberActionButtons();
}

/**
 * Cập nhật trạng thái các nút Xóa / Gỡ thành viên đã chọn
 */
function updateRoomMemberActionButtons() {
  const count = selectedRoomMemberIds.size;
  const btnRemove = document.getElementById('btn-room-remove-selected');
  const btnDelete = document.getElementById('btn-room-delete-selected');
  const countRemoveSpan = document.getElementById('room-selected-remove-count');

  if (countRemoveSpan) countRemoveSpan.textContent = count;
  if (btnRemove) btnRemove.disabled = count === 0;
  if (btnDelete) btnDelete.disabled = count === 0;

  const selectAllCb = document.getElementById('room-member-select-all');
  if (selectAllCb && currentRoomDetail) {
    const memberIds = Array.from(new Set([currentRoomDetail.chuPhongId, ...(currentRoomDetail.thanhVienIds || [])].filter(Boolean)));
    selectAllCb.checked = memberIds.length > 0 && memberIds.every(id => selectedRoomMemberIds.has(id));
  }
}

/**
 * Lưu thay đổi phân bổ phòng (Chủ phòng & Thành viên)
 */
async function saveRoomAssignmentModal() {
  if (!currentRoomDetail || !window.api) return;

  const roomId = currentRoomDetail.phong;
  const chuPhongId = document.getElementById('room-owner-select').value || null;
  const thanhVienIds = (currentRoomDetail.thanhVienIds || []).filter(id => id !== chuPhongId);

  try {
    const res = await window.api.saveRoomAssignment({ roomId, chuPhongId, thanhVienIds });
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã lưu thông tin phòng ${roomId} thành công!`, 'success');
    closeRoomDetailModal();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi khi lưu phòng: ${err.message}`, 'error');
  }
}

/**
 * Gỡ các thành viên đã chọn khỏi phòng (chuyển về Chưa xếp phòng)
 */
async function removeSelectedMembersFromRoom() {
  if (!currentRoomDetail || selectedRoomMemberIds.size === 0 || !window.api) return;

  const count = selectedRoomMemberIds.size;
  const roomId = currentRoomDetail.phong;
  const ids = Array.from(selectedRoomMemberIds);

  try {
    const res = await window.api.removeRoomMembers(roomId, ids);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã gỡ ${count} người khỏi phòng ${roomId}`, 'success');
    selectedRoomMemberIds.clear();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Gỡ 1 thành viên đơn lẻ khỏi phòng
 */
async function removeSingleMemberFromRoom(personId) {
  if (!currentRoomDetail || !window.api) return;
  const roomId = currentRoomDetail.phong;

  try {
    const res = await window.api.removeRoomMembers(roomId, [personId]);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã gỡ người khỏi phòng ${roomId}`, 'success');
    selectedRoomMemberIds.delete(personId);
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Xóa vĩnh viễn các thành viên đã chọn khỏi toàn hệ thống (Hard Delete)
 */
async function deleteSelectedMembersFromSystem() {
  if (selectedRoomMemberIds.size === 0 || !window.api) return;
  const count = selectedRoomMemberIds.size;

  if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} người này khỏi toàn bộ hệ thống (bao gồm xóa ảnh CCCD)? Hành động này không thể hoàn tác!`)) {
    return;
  }

  try {
    const ids = Array.from(selectedRoomMemberIds);
    const res = await window.api.deletePersons(ids);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã xóa vĩnh viễn ${count} người khỏi hệ thống`, 'success');
    selectedRoomMemberIds.clear();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Mở Modal Chọn Nhanh Người Vào Phòng
 */
function openAddMemberToRoomModal() {
  if (!currentRoomDetail) return;

  const modalEl = document.getElementById('add-member-modal');
  const titleEl = document.getElementById('add-member-modal-title');
  const listEl = document.getElementById('unassigned-persons-list');

  if (titleEl) titleEl.textContent = `Thêm Thành Viên Vào Phòng ${currentRoomDetail.phong}`;

  // Lấy những người chưa xếp phòng
  const unassigned = allPersons.filter(p => !p.phongId || p.phongId.trim() === '');

  if (listEl) {
    if (unassigned.length === 0) {
      listEl.innerHTML = `<div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">Không có người nào đang ở trạng thái "Chưa xếp phòng"</div>`;
    } else {
      listEl.innerHTML = unassigned.map(p => `
        <div class="unassigned-item">
          <input type="checkbox" id="unassigned-p-${p.id}" value="${p.id}">
          <label for="unassigned-p-${p.id}">
            <strong>${p.hoTen}</strong> - SĐT: ${p.sdtGoi || 'N/A'} (CCCD: ${p.soCCCD || 'N/A'})
          </label>
        </div>
      `).join('');
    }
  }

  if (modalEl) modalEl.style.display = 'flex';
}

function closeAddMemberToRoomModal() {
  const modalEl = document.getElementById('add-member-modal');
  if (modalEl) modalEl.style.display = 'none';
}

/**
 * Xác nhận gán các người đã chọn vào phòng hiện tại
 */
async function confirmAddSelectedPersonsToRoom() {
  if (!currentRoomDetail || !window.api) return;

  const checkboxes = document.querySelectorAll('#unassigned-persons-list input[type="checkbox"]:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.value);

  if (selectedIds.length === 0) {
    showToast('Vui lòng chọn ít nhất 1 người để gán vào phòng', 'warning');
    return;
  }

  const roomId = currentRoomDetail.phong;
  const chuPhongId = currentRoomDetail.chuPhongId;
  const existingMembers = currentRoomDetail.thanhVienIds || [];
  const newMemberList = Array.from(new Set([...existingMembers, ...selectedIds]));

  try {
    const res = await window.api.saveRoomAssignment({
      roomId,
      chuPhongId,
      thanhVienIds: newMemberList
    });

    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã thêm ${selectedIds.length} thành viên vào phòng ${roomId}!`, 'success');
    closeAddMemberToRoomModal();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Tạo mới người thuê và gán luôn vào phòng hiện tại
 */
function createAndAssignNewPerson() {
  const roomId = currentRoomDetail ? currentRoomDetail.phong : '';
  closeAddMemberToRoomModal();
  openAddPersonModal(roomId);
}

/* ============================================================
   PHẦN 3: QUẢN LÝ THÔNG TIN NGƯỜI Ở (RENDER, FORM & SEARCH)
   ============================================================ */

/**
 * Render Bảng danh sách người ở
 */
function renderPersonsTable() {
  const tbody = document.getElementById('persons-table-body');
  if (!tbody) return;

  // Lọc dữ liệu theo search và theo room
  let filtered = allPersons.filter(p => {
    // 1. Filter theo Search Query
    if (personSearchQuery) {
      const q = personSearchQuery.toLowerCase();
      const matchName = (p.hoTen || '').toLowerCase().includes(q);
      const matchPhone = (p.sdtGoi || '').toLowerCase().includes(q);
      const matchZalo = (p.sdtZalo || '').toLowerCase().includes(q);
      const matchCCCD = (p.soCCCD || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchZalo && !matchCCCD) {
        return false;
      }
    }

    // 2. Filter theo Phòng
    if (personFilterRoom) {
      if (personFilterRoom === '_unassigned') {
        if (p.phongId && p.phongId.trim() !== '') return false;
      } else {
        if (p.phongId !== personFilterRoom) return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #94a3b8; padding: 30px;">Không tìm thấy người ở nào phù hợp</td></tr>`;
    updatePersonsTableSelectAll();
    updateDeleteSelectedPersonsBtn();
    return;
  }

  tbody.innerHTML = filtered.map((p, idx) => {
    const isChecked = selectedPersonIds.has(p.id);
    const hasFront = !!p.anhCCCDMatTruoc;
    const hasBack = !!p.anhCCCDMatSau;
    const cccdCount = (hasFront ? 1 : 0) + (hasBack ? 1 : 0);

    let cccdBadgeClass = 'badge-cccd-count';
    let cccdBadgeText = 'Chưa có ảnh';
    if (cccdCount === 2) {
      cccdBadgeClass += ' full';
      cccdBadgeText = '💳 Đủ 2/2 ảnh';
    } else if (cccdCount === 1) {
      cccdBadgeClass += ' partial';
      cccdBadgeText = '💳 1/2 ảnh';
    }

    const age = calculateAge(p.ngaySinh);
    const dobHtml = p.ngaySinh 
      ? `<div class="dob-stacked-cell"><span class="dob-date-main">${p.ngaySinh}</span>${age !== null ? `<span class="dob-age-sub">(${age} tuổi)</span>` : ''}</div>`
      : '-';

    return `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="onPersonRowCheckboxChange('${p.id}', this.checked)">
        </td>
        <td style="text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
        <td>
          <div class="person-name-cell">
            <span class="gender-avatar ${p.gioiTinh === 'Nữ' ? 'female' : 'male'}">${p.gioiTinh === 'Nữ' ? '👩' : '👨'}</span>
            <span style="font-weight: 700;">${p.hoTen}</span>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="badge-room ${p.phongId ? 'assigned' : 'unassigned'}">
            ${p.phongId ? `Phòng ${p.phongId}` : 'Chưa xếp'}
          </span>
        </td>
        <td>${p.sdtGoi || '-'}</td>
        <td>${p.sdtZalo || '-'}</td>
        <td><strong style="letter-spacing: 0.5px;">${p.soCCCD || '-'}</strong></td>
        <td style="text-align: center;">${dobHtml}</td>
        <td style="text-align: center;">${p.ngayVaoO || '-'}</td>
        <td style="text-align: center;">
          <button type="button" class="${cccdBadgeClass}" onclick="openLightbox('${p.id}')">
            ${cccdBadgeText}
          </button>
        </td>
        <td style="text-align: center;">
          <div class="table-actions-group">
            <button type="button" class="btn-icon-action" onclick="openEditPersonModal('${p.id}')" title="Sửa thông tin">✏️</button>
            <button type="button" class="btn-icon-action delete" onclick="deleteSinglePerson('${p.id}')" title="Xóa người này">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updatePersonsTableSelectAll();
  updateDeleteSelectedPersonsBtn();
}

/**
 * Tìm kiếm thời gian thực
 */
function onPersonSearchInput() {
  const input = document.getElementById('person-search-input');
  const clearBtn = document.getElementById('person-search-clear');
  personSearchQuery = input ? input.value.trim() : '';

  if (clearBtn) {
    clearBtn.style.display = personSearchQuery ? 'block' : 'none';
  }

  renderPersonsTable();
}

function clearPersonSearch() {
  const input = document.getElementById('person-search-input');
  const clearBtn = document.getElementById('person-search-clear');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  personSearchQuery = '';
  renderPersonsTable();
}

/**
 * Thay đổi bộ lọc phòng
 */
function onPersonFilterChange() {
  const select = document.getElementById('person-filter-room');
  personFilterRoom = select ? select.value : '';
  renderPersonsTable();
}

/**
 * Chọn / Bỏ chọn tất cả người trong bảng
 */
function toggleSelectAllPersons(checked) {
  if (checked) {
    allPersons.forEach(p => selectedPersonIds.add(p.id));
  } else {
    selectedPersonIds.clear();
  }
  renderPersonsTable();
}

function onPersonRowCheckboxChange(personId, checked) {
  if (checked) {
    selectedPersonIds.add(personId);
  } else {
    selectedPersonIds.delete(personId);
  }
  updatePersonsTableSelectAll();
  updateDeleteSelectedPersonsBtn();
}

function updatePersonsTableSelectAll() {
  const selectAllCb = document.getElementById('person-select-all');
  if (selectAllCb) {
    selectAllCb.checked = allPersons.length > 0 && allPersons.every(p => selectedPersonIds.has(p.id));
  }
}

function updateDeleteSelectedPersonsBtn() {
  const btn = document.getElementById('btn-delete-selected-persons');
  const countSpan = document.getElementById('selected-person-count');
  const count = selectedPersonIds.size;

  if (countSpan) countSpan.textContent = count;
  if (btn) btn.disabled = count === 0;
}

/**
 * Xóa các người đã chọn trong bảng
 */
async function deleteSelectedPersons() {
  if (selectedPersonIds.size === 0 || !window.api) return;
  const count = selectedPersonIds.size;

  if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} người này khỏi toàn bộ hệ thống (kèm xóa thư mục ảnh CCCD)?`)) {
    return;
  }

  try {
    const ids = Array.from(selectedPersonIds);
    const res = await window.api.deletePersons(ids);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã xóa thành công ${count} người!`, 'success');
    selectedPersonIds.clear();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/**
 * Xóa 1 người đơn lẻ
 */
async function deleteSinglePerson(personId) {
  const p = allPersons.find(item => item.id === personId);
  const name = p ? p.hoTen : 'người này';

  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn "${name}" khỏi hệ thống (kèm xóa ảnh CCCD)?`)) {
    return;
  }

  try {
    const res = await window.api.deletePersons([personId]);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã xóa "${name}" thành công!`, 'success');
    selectedPersonIds.delete(personId);
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi: ${err.message}`, 'error');
  }
}

/* ============================================================
   MODAL THÊM / SỬA NGƯỜI Ở & VALIDATE & UPLOAD CCCD
   ============================================================ */

/**
 * Mở Modal Thêm Người Thuê Mới
 */
function openAddPersonModal(preselectedRoomId = '') {
  document.getElementById('person-form-id').value = '';
  const titleEl = document.getElementById('person-modal-title');
  if (titleEl) titleEl.textContent = 'Thêm Người Thuê Mới';

  // Reset form inputs
  document.getElementById('person-hoTen').value = '';
  document.getElementById('person-sdtGoi').value = '';
  document.getElementById('person-sdtZalo').value = '';
  document.getElementById('person-email').value = '';
  document.getElementById('person-soCCCD').value = '';
  document.getElementById('person-ngaySinh').value = '';
  document.getElementById('person-gioiTinh').value = 'Nam';
  document.getElementById('person-phongId').value = preselectedRoomId || '';
  document.getElementById('person-queQuan').value = '';
  document.getElementById('person-ngayVaoO').value = '';

  clearPersonFormErrors();
  setupDateInputAutoMask('person-ngaySinh');
  setupDateInputAutoMask('person-ngayVaoO');

  // Reset photo form state
  activePersonPhotoForm = {
    frontBase64: null,
    backBase64: null,
    removeFront: false,
    removeBack: false
  };

  resetCCCDPreviewBoxes();
  switchPersonFormTab('info');

  const modalEl = document.getElementById('person-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Mở Modal Chỉnh Sửa Thông Tin Người Thuê
 */
async function openEditPersonModal(personId) {
  const person = allPersons.find(p => p.id === personId);
  if (!person) return;

  document.getElementById('person-form-id').value = person.id;
  const titleEl = document.getElementById('person-modal-title');
  if (titleEl) titleEl.textContent = 'Chỉnh Sửa Thông Tin Người Thuê';

  document.getElementById('person-hoTen').value = person.hoTen || '';
  document.getElementById('person-sdtGoi').value = person.sdtGoi || '';
  document.getElementById('person-sdtZalo').value = person.sdtZalo || '';
  document.getElementById('person-email').value = person.email || '';
  document.getElementById('person-soCCCD').value = person.soCCCD || '';
  document.getElementById('person-ngaySinh').value = person.ngaySinh || '';
  document.getElementById('person-gioiTinh').value = person.gioiTinh || 'Nam';
  document.getElementById('person-phongId').value = person.phongId || '';
  document.getElementById('person-queQuan').value = person.queQuan || '';
  document.getElementById('person-ngayVaoO').value = person.ngayVaoO || '';

  clearPersonFormErrors();

  activePersonPhotoForm = {
    frontBase64: null,
    backBase64: null,
    removeFront: false,
    removeBack: false
  };

  resetCCCDPreviewBoxes();

  // Load existing photos if available
  if (person.anhCCCDMatTruoc && window.api) {
    try {
      const base64 = await window.api.readImageBase64(person.anhCCCDMatTruoc);
      if (base64) {
        showCCCDPreview('front', base64);
      }
    } catch (e) {}
  }

  if (person.anhCCCDMatSau && window.api) {
    try {
      const base64 = await window.api.readImageBase64(person.anhCCCDMatSau);
      if (base64) {
        showCCCDPreview('back', base64);
      }
    } catch (e) {}
  }

  updateCCCDStatusBadge();
  switchPersonFormTab('info');

  const modalEl = document.getElementById('person-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

function closePersonModal() {
  const modalEl = document.getElementById('person-modal');
  if (modalEl) modalEl.style.display = 'none';
}

/**
 * Đổi tab trong Form Người ở (Thông tin / Ảnh CCCD)
 */
function switchPersonFormTab(tabName) {
  const btnInfo = document.getElementById('person-tab-btn-info');
  const btnCCCD = document.getElementById('person-tab-btn-cccd');
  const tabInfo = document.getElementById('person-form-tab-info');
  const tabCCCD = document.getElementById('person-form-tab-cccd');

  if (tabName === 'info') {
    if (btnInfo) btnInfo.classList.add('active');
    if (btnCCCD) btnCCCD.classList.remove('active');
    if (tabInfo) tabInfo.style.display = 'block';
    if (tabCCCD) tabCCCD.style.display = 'none';
  } else {
    if (btnInfo) btnInfo.classList.remove('active');
    if (btnCCCD) btnCCCD.classList.add('active');
    if (tabInfo) tabInfo.style.display = 'none';
    if (tabCCCD) tabCCCD.style.display = 'block';
  }
}

/**
 * Chọn file ảnh CCCD qua Dialog Native Windows
 */
async function pickCCCDFile(side) {
  if (!window.api || typeof window.api.pickImage !== 'function') return;

  try {
    const res = await window.api.pickImage();
    if (res && res.base64) {
      if (side === 'front') {
        activePersonPhotoForm.frontBase64 = res.base64;
        activePersonPhotoForm.removeFront = false;
      } else {
        activePersonPhotoForm.backBase64 = res.base64;
        activePersonPhotoForm.removeBack = false;
      }
      showCCCDPreview(side, res.base64);
      updateCCCDStatusBadge();
    }
  } catch (err) {
    showToast(`Lỗi chọn ảnh: ${err.message}`, 'error');
  }
}

function showCCCDPreview(side, base64Url) {
  const emptyEl = document.getElementById(`cccd-${side}-empty`);
  const previewEl = document.getElementById(`cccd-${side}-preview`);
  const imgEl = document.getElementById(`cccd-${side}-img`);

  if (emptyEl) emptyEl.style.display = 'none';
  if (previewEl) previewEl.style.display = 'block';
  if (imgEl) imgEl.src = base64Url;
}

function removeCCCDImage(side) {
  const emptyEl = document.getElementById(`cccd-${side}-empty`);
  const previewEl = document.getElementById(`cccd-${side}-preview`);
  const imgEl = document.getElementById(`cccd-${side}-img`);

  if (emptyEl) emptyEl.style.display = 'flex';
  if (previewEl) previewEl.style.display = 'none';
  if (imgEl) imgEl.src = '';

  if (side === 'front') {
    activePersonPhotoForm.frontBase64 = null;
    activePersonPhotoForm.removeFront = true;
  } else {
    activePersonPhotoForm.backBase64 = null;
    activePersonPhotoForm.removeBack = true;
  }

  updateCCCDStatusBadge();
}

function resetCCCDPreviewBoxes() {
  ['front', 'back'].forEach(side => {
    const emptyEl = document.getElementById(`cccd-${side}-empty`);
    const previewEl = document.getElementById(`cccd-${side}-preview`);
    const imgEl = document.getElementById(`cccd-${side}-img`);
    if (emptyEl) emptyEl.style.display = 'flex';
    if (previewEl) previewEl.style.display = 'none';
    if (imgEl) imgEl.src = '';
  });
  updateCCCDStatusBadge();
}

function updateCCCDStatusBadge() {
  const frontImg = document.getElementById('cccd-front-img');
  const backImg = document.getElementById('cccd-back-img');
  const badge = document.getElementById('cccd-status-badge');
  if (!badge) return;

  const hasFront = frontImg && frontImg.src && !frontImg.src.endsWith('index.html') && frontImg.src !== '';
  const hasBack = backImg && backImg.src && !backImg.src.endsWith('index.html') && backImg.src !== '';

  const count = (hasFront ? 1 : 0) + (hasBack ? 1 : 0);

  if (count === 2) {
    badge.className = 'badge-status-pill success';
    badge.textContent = '✓ Đã có đủ 2 ảnh CCCD';
  } else if (count === 1) {
    badge.className = 'badge-status-pill warning';
    badge.textContent = 'Còn thiếu 1 ảnh CCCD';
  } else {
    badge.className = 'badge-status-pill';
    badge.textContent = 'Còn thiếu 2 ảnh CCCD';
  }
}

function clearPersonFormErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('input-error'));
}

/**
 * Mở picker ngày native khi click vào icon 📅
 */
function openNativeDatePicker(inputId) {
  const textInput = document.getElementById(inputId);
  const pickerInput = document.getElementById(`${inputId}-picker`);
  if (!pickerInput) return;

  if (textInput && textInput.value) {
    const parts = textInput.value.trim().split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      pickerInput.value = `${year}-${month}-${day}`;
    }
  }

  if (typeof pickerInput.showPicker === 'function') {
    try {
      pickerInput.showPicker();
    } catch (e) {
      pickerInput.click();
    }
  } else {
    pickerInput.click();
  }
}

/**
 * Xử lý khi chọn ngày trên Lịch native -> Format dd/mm/yyyy
 */
function onDatePickerChange(inputId, dateVal) {
  if (!dateVal) return;
  const parts = dateVal.split('-');
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    const textInput = document.getElementById(inputId);
    if (textInput) {
      textInput.value = `${dd}/${mm}/${yyyy}`;
      textInput.dispatchEvent(new Event('input'));
    }
  }
}

/**
 * Tự động chèn / và nhảy dd -> mm -> yyyy khi gõ số (Auto Masking)
 */
function setupDateInputAutoMask(inputId) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl || inputEl.dataset.maskAttached === 'true') return;
  inputEl.dataset.maskAttached = 'true';

  let isBackspacing = false;

  inputEl.addEventListener('keydown', function(e) {
    isBackspacing = e.key === 'Backspace';
  });

  inputEl.addEventListener('input', function(e) {
    if (isBackspacing) return;

    let v = this.value.replace(/\D/g, ''); // Chỉ giữ số
    if (v.length > 8) v = v.substring(0, 8);

    let formatted = '';
    if (v.length > 0) {
      formatted += v.substring(0, 2);
      if (v.length >= 2) {
        formatted += '/';
        formatted += v.substring(2, 4);
        if (v.length >= 4) {
          formatted += '/';
          formatted += v.substring(4, 8);
        }
      }
    }
    this.value = formatted;
  });
}

// Khởi tạo mask tự động cho các ô nhập ngày tháng
document.addEventListener('DOMContentLoaded', () => {
  setupDateInputAutoMask('person-ngaySinh');
  setupDateInputAutoMask('person-ngayVaoO');
});

// Chạy luôn nếu DOM đã ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    setupDateInputAutoMask('person-ngaySinh');
    setupDateInputAutoMask('person-ngayVaoO');
  }, 100);
}

/**
 * Tính tuổi chính xác theo Luật Việt Nam (Năm hiện tại - Năm sinh, trừ 1 nếu chưa tới ngày/tháng sinh trong năm nay)
 */
function calculateAge(dobStr) {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const parts = dobStr.trim().split('/');
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed (1-12)
  const currentDay = today.getDate();

  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Validate định dạng ngày tháng dd/mm/yyyy
 */
function isValidDateStr(str) {
  if (!str || typeof str !== 'string') return false;
  const match = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return false;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  // Check ngày thực tế
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * Validate và Submit Form Người ở
 */
async function submitPersonForm(e) {
  if (e) e.preventDefault();
  clearPersonFormErrors();

  const id = document.getElementById('person-form-id').value.trim() || null;
  const hoTen = document.getElementById('person-hoTen').value.trim();
  const sdtGoi = document.getElementById('person-sdtGoi').value.trim();
  let sdtZalo = document.getElementById('person-sdtZalo') ? document.getElementById('person-sdtZalo').value.trim() : '';
  const email = document.getElementById('person-email') ? document.getElementById('person-email').value.trim() : '';
  const soCCCD = document.getElementById('person-soCCCD').value.trim();
  const ngaySinh = document.getElementById('person-ngaySinh').value.trim();
  const gioiTinh = document.getElementById('person-gioiTinh') ? document.getElementById('person-gioiTinh').value : 'Nam';
  const phongId = document.getElementById('person-phongId') ? document.getElementById('person-phongId').value.trim() || null : null;
  const queQuan = document.getElementById('person-queQuan') ? document.getElementById('person-queQuan').value.trim() : '';
  const ngayVaoO = document.getElementById('person-ngayVaoO') ? document.getElementById('person-ngayVaoO').value.trim() : '';

  let hasError = false;

  // 1. Validate Họ tên
  if (!hoTen) {
    document.getElementById('err-person-hoTen').textContent = 'Vui lòng nhập họ và tên';
    document.getElementById('person-hoTen').classList.add('input-error');
    hasError = true;
  }

  // 2. Validate SĐT gọi (chuẩn VN 10 số)
  const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
  if (!sdtGoi) {
    document.getElementById('err-person-sdtGoi').textContent = 'Vui lòng nhập số điện thoại';
    document.getElementById('person-sdtGoi').classList.add('input-error');
    hasError = true;
  } else if (!phoneRegex.test(sdtGoi)) {
    document.getElementById('err-person-sdtGoi').textContent = 'Số điện thoại không hợp lệ (VD: 0982141407)';
    document.getElementById('person-sdtGoi').classList.add('input-error');
    hasError = true;
  }

  // 3. Validate SĐT Zalo (optional, tự động lấy SĐT gọi nếu để trống)
  if (!sdtZalo && sdtGoi) {
    sdtZalo = sdtGoi;
  } else if (sdtZalo && !phoneRegex.test(sdtZalo)) {
    const errZalo = document.getElementById('err-person-sdtZalo');
    if (errZalo) errZalo.textContent = 'Số điện thoại Zalo không hợp lệ';
    const inputZalo = document.getElementById('person-sdtZalo');
    if (inputZalo) inputZalo.classList.add('input-error');
    hasError = true;
  }

  // 4. Validate Số CCCD (đúng 12 chữ số)
  const cccdRegex = /^[0-9]{12}$/;
  if (!soCCCD) {
    document.getElementById('err-person-soCCCD').textContent = 'Vui lòng nhập số CCCD';
    document.getElementById('person-soCCCD').classList.add('input-error');
    hasError = true;
  } else if (!cccdRegex.test(soCCCD)) {
    document.getElementById('err-person-soCCCD').textContent = 'Số CCCD phải đúng 12 chữ số';
    document.getElementById('person-soCCCD').classList.add('input-error');
    hasError = true;
  }

  // 5. Validate Ngày sinh (bắt buộc, dd/mm/yyyy)
  if (!ngaySinh) {
    document.getElementById('err-person-ngaySinh').textContent = 'Vui lòng nhập ngày sinh';
    document.getElementById('person-ngaySinh').classList.add('input-error');
    hasError = true;
  } else if (!isValidDateStr(ngaySinh)) {
    document.getElementById('err-person-ngaySinh').textContent = 'Ngày sinh phải đúng định dạng dd/mm/yyyy';
    document.getElementById('person-ngaySinh').classList.add('input-error');
    hasError = true;
  }

  // 6. Validate Ngày vào ở (optional, nếu có thì phải đúng dd/mm/yyyy)
  if (ngayVaoO && !isValidDateStr(ngayVaoO)) {
    document.getElementById('err-person-ngayVaoO').textContent = 'Ngày vào ở phải đúng định dạng dd/mm/yyyy';
    document.getElementById('person-ngayVaoO').classList.add('input-error');
    hasError = true;
  }

  // 7. Validate Email (optional)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-person-email').textContent = 'Email không hợp lệ';
    document.getElementById('person-email').classList.add('input-error');
    hasError = true;
  }

  if (hasError) {
    switchPersonFormTab('info');
    showToast('Vui lòng kiểm tra lại các trường thông tin bị lỗi', 'error');
    return;
  }

  const payload = {
    id,
    hoTen,
    sdtGoi,
    sdtZalo,
    email,
    soCCCD,
    ngaySinh,
    gioiTinh,
    queQuan,
    ngayVaoO,
    phongId,
    frontImageBase64: activePersonPhotoForm.frontBase64,
    backImageBase64: activePersonPhotoForm.backBase64,
    removeFrontImage: activePersonPhotoForm.removeFront,
    removeBackImage: activePersonPhotoForm.removeBack
  };

  const btnSave = document.getElementById('btn-save-person');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Đang lưu...';
  }

  try {
    const res = await window.api.savePerson(payload);
    if (res && res.error) {
      showToast(`Lỗi: ${res.error}`, 'error');
      return;
    }

    showToast(`Đã lưu thông tin "${hoTen}" thành công!`, 'success');
    closePersonModal();
    await loadRoomsAndPersons();
  } catch (err) {
    showToast(`Lỗi khi lưu thông tin: ${err.message}`, 'error');
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = 'Lưu Thông Tin';
    }
  }
}

/* ============================================================
   MODAL 4: LIGHTBOX XEM ẢNH CCCD PHÓNG TO
   ============================================================ */

let currentLightboxSource = 'person'; // 'person' hoặc 'form'

/**
 * Mở Lightbox từ bảng bên ngoài -> Mặc định luôn mở xem Mặt trước trước
 */
async function openLightbox(personId, initialSide = 'front') {
  const person = allPersons.find(p => p.id === personId);
  if (!person) return;

  currentLightboxSource = 'person';
  currentLightboxPerson = person;

  const titleEl = document.getElementById('lightbox-title');
  if (titleEl) titleEl.textContent = `Ảnh CCCD - ${person.hoTen}`;

  // Switch tab hiển thị (mặc định 'front') và load ảnh
  switchLightboxTab(initialSide || 'front');

  const modalEl = document.getElementById('lightbox-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Xem preview phóng to khi click vào icon con mắt 👁 trong form chỉnh sửa/thêm người ở
 */
function previewImageZoom(side = 'front') {
  const hoTenInput = document.getElementById('person-hoTen');
  const hoTen = hoTenInput ? hoTenInput.value.trim() : '';

  currentLightboxSource = 'form';
  currentLightboxPerson = null;

  const titleEl = document.getElementById('lightbox-title');
  if (titleEl) titleEl.textContent = `Ảnh CCCD - ${hoTen || 'Người thuê'}`;

  // Switch tab hiển thị ('front' hoặc 'back') và load ảnh từ form
  switchLightboxTab(side);

  const modalEl = document.getElementById('lightbox-modal');
  if (modalEl) modalEl.style.display = 'flex';
}

/**
 * Đổi tab Mặt trước / Mặt sau trong Lightbox
 */
function switchLightboxTab(side) {
  currentLightboxSide = side || 'front';

  const btnFront = document.getElementById('lb-tab-front');
  const btnBack = document.getElementById('lb-tab-back');

  if (currentLightboxSide === 'front') {
    if (btnFront) btnFront.classList.add('active');
    if (btnBack) btnBack.classList.remove('active');
  } else {
    if (btnFront) btnFront.classList.remove('active');
    if (btnBack) btnBack.classList.add('active');
  }

  updateLightboxImage();
}

/**
 * Cập nhật hiển thị ảnh trong Lightbox dựa theo nguồn (person/form) và side (front/back)
 */
async function updateLightboxImage() {
  const imgEl = document.getElementById('lightbox-img');
  const emptyNotice = document.getElementById('lightbox-empty-notice');
  const sideName = currentLightboxSide === 'front' ? 'mặt trước' : 'mặt sau';

  // 1. Nguồn mở từ Form thêm/sửa người ở (preview box)
  if (currentLightboxSource === 'form') {
    const formImgEl = document.getElementById(`cccd-${currentLightboxSide}-img`);
    if (formImgEl && formImgEl.src && formImgEl.src !== '' && !formImgEl.src.endsWith('index.html')) {
      if (imgEl) {
        imgEl.src = formImgEl.src;
        imgEl.style.display = 'block';
      }
      if (emptyNotice) emptyNotice.style.display = 'none';
    } else {
      if (imgEl) imgEl.style.display = 'none';
      if (emptyNotice) {
        emptyNotice.style.display = 'block';
        emptyNotice.textContent = `Chưa có ảnh CCCD ${sideName}`;
      }
    }
    return;
  }

  // 2. Nguồn mở từ Bảng danh sách người ở
  if (currentLightboxSource === 'person' && currentLightboxPerson) {
    const relPath = currentLightboxSide === 'front' 
      ? currentLightboxPerson.anhCCCDMatTruoc 
      : currentLightboxPerson.anhCCCDMatSau;

    if (relPath && window.api) {
      try {
        const base64 = await window.api.readImageBase64(relPath);
        if (base64) {
          if (imgEl) {
            imgEl.src = base64;
            imgEl.style.display = 'block';
          }
          if (emptyNotice) emptyNotice.style.display = 'none';
          return;
        }
      } catch (e) {}
    }

    if (imgEl) imgEl.style.display = 'none';
    if (emptyNotice) {
      emptyNotice.style.display = 'block';
      emptyNotice.textContent = `Chưa có ảnh CCCD ${sideName}`;
    }
  }
}

/**
 * Đóng Lightbox Modal
 */
function closeLightboxModal(e) {
  if (e && e.target !== e.currentTarget && !e.target.classList.contains('lightbox-close')) return;
  const modalEl = document.getElementById('lightbox-modal');
  if (modalEl) modalEl.style.display = 'none';
}




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
  tyLeHaoTai: 0.07
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
            tyLeHaoTai: data.tyLeHaoTai || data.tileHaoTai || appSettings.tyLeHaoTai
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
    tileHaoTai: appSettings.tyLeHaoTai
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

  // Hiển thị phiên bản app lấy từ package.json qua IPC
  if (window.api && typeof window.api.getAppVersion === 'function') {
    try {
      const ver = await window.api.getAppVersion();
      const verTag = document.getElementById('app-version-tag');
      if (verTag && ver) {
        verTag.textContent = `v${ver}`;
      }
      document.title = `Màn Hình Nhập Liệu - Quản Lý Phòng Trọ v${ver}`;
    } catch (e) {
      console.error('Lỗi khi lấy version app:', e);
    }
  }

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
 * Đổi tab giữa Nhập Dữ Liệu và Cài Đặt Chung
 */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabName === 'data') {
    document.getElementById('tab-btn-data').classList.add('active');
    document.getElementById('section-data').classList.add('active');
  } else if (tabName === 'settings') {
    document.getElementById('tab-btn-settings').classList.add('active');
    document.getElementById('section-settings').classList.add('active');
  }
}

/**
 * Load form Cài đặt
 */
function initSettingsForm() {
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
  const isRolloverUnconfirmed = hasDienMoiInput && (dienMoiNum < dienCuNum) && !room.confirmedRollover;

  // Kiểm tra bất thường >= 40% so với tháng trước (nếu đã qua bước quay vòng)
  const prevKwh = Number(room.prevDienKwh) || 0;
  let isAnomalyUnconfirmed = false;
  if (hasDienMoiInput && prevKwh > 0 && !isRolloverUnconfirmed) {
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

    const isRolloverUnconfirmed = hasDienMoiInput && (dienMoiNum < dienCuNum) && !room.confirmedRollover;

    const prevKwh = Number(room.prevDienKwh) || 0;
    let isAnomalyUnconfirmed = false;
    if (hasDienMoiInput && prevKwh > 0 && !isRolloverUnconfirmed) {
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

  const ok = await saveSettingsFile();

  if (!ok) {
    if (baseFolderInput) baseFolderInput.classList.add('input-error');
    return; // Đã báo lỗi trong saveSettingsFile, dừng tại đây
  }

  // Đã lưu thành công
  if (baseFolderInput) baseFolderInput.classList.remove('input-error');

  roomsData.forEach(r => {
    r.tienPhong = appSettings.giaPhong;
  });

  roomsData.forEach((_, idx) => updateRowUI(idx));
  updateFooterTotals();
  showToast("Đã lưu cài đặt giá và thư mục lưu thành công!", 'success');
}

/**
 * Nút duy nhất "Lưu & Xuất":
 * 0. Lưu dữ liệu tháng hiện tại -> xong mới tiếp tục
 * 1. Kiểm tra baseFolder -> chưa chọn thì báo lỗi dừng lại
 * 2. Gọi IPC exportReceipts -> mở BrowserWindow ẩn, render 12 phòng, xuất 12 JPG + 1 PDF gộp
 * 3. Tự động mở thư mục xuất
 */
async function saveAndExport() {
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

  // 1. Kiểm tra đồng hồ quay vòng (Điện Mới < Điện Cũ)
  if (dienMoiNum < dienCuNum && !room.confirmedRollover) {
    showRolloverModal(index);
    return;
  }

  // 2. Kiểm tra bất thường >= 40% so với tháng trước
  const prevKwh = Number(room.prevDienKwh) || 0;
  if (prevKwh > 0 && (dienMoiNum >= dienCuNum || room.confirmedRollover)) {
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



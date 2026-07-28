/* ============================================================
   RENDERER.JS - LOGIC MÀN HÌNH NHẬP LIỆU
   Lưu & Đọc dữ liệu chỉ số điện nước qua IPC (Electron Bridge window.api)
   ============================================================ */

// Cấu hình mặc định
let appSettings = {
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
  { phong: "1A", dienCu: 5302,  dienMoi: 5379,  nuocCu: 577, nuocMoi: 583 },
  { phong: "1B", dienCu: 10936, dienMoi: 11024, nuocCu: 806, nuocMoi: 811 },
  { phong: "2A", dienCu: 20406, dienMoi: 20599, nuocCu: 609, nuocMoi: 612 },
  { phong: "2B", dienCu: 2172,  dienMoi: 2551,  nuocCu: 487, nuocMoi: 495 },
  { phong: "3A", dienCu: 10897, dienMoi: 11040, nuocCu: 581, nuocMoi: 585 },
  { phong: "3B", dienCu: 10054, dienMoi: 10154, nuocCu: 650, nuocMoi: 654 },
  { phong: "4A", dienCu: 7987,  dienMoi: 8098,  nuocCu: 644, nuocMoi: 650 },
  { phong: "4B", dienCu: 8428,  dienMoi: 8571,  nuocCu: 681, nuocMoi: 689 },
  { phong: "5A", dienCu: 10773, dienMoi: 10849, nuocCu: 720, nuocMoi: 726 },
  { phong: "5B", dienCu: 9800,  dienMoi: 9835,  nuocCu: 791, nuocMoi: 797 },
  { phong: "6A", dienCu: 7885,  dienMoi: 8048,  nuocCu: 563, nuocMoi: 578 },
  { phong: "6B", dienCu: 13336, dienMoi: 13449, nuocCu: 760, nuocMoi: 768 }
];

// Danh sách cố định 12 phòng
const DEFAULT_ROOM_NAMES = [
  "1A", "1B", "2A", "2B", "3A", "3B",
  "4A", "4B", "5A", "5B", "6A", "6B"
];

// Dữ liệu làm việc hiện tại của 12 phòng
let roomsData = [];

/**
 * Format số có dấu chấm phân cách hàng nghìn (VD: 14110 -> 14.110)
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num) || num === '') return '0';
  return Number(num).toLocaleString('vi-VN');
}

/**
 * Tính ra tháng liền trước dạng YYYY-MM (VD: 2026-08 -> 2026-07, 2026-01 -> 2025-12)
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
 * Đọc file settings qua IPC (window.api.loadSettingsData)
 */
async function loadSettingsFile() {
  if (window.api && typeof window.api.loadSettingsData === 'function') {
    try {
      const data = await window.api.loadSettingsData();
      if (data && !data.error) {
        appSettings = {
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

  // Backup từ localStorage
  try {
    const local = localStorage.getItem('phongtro_settings');
    if (local) {
      const data = JSON.parse(local);
      appSettings = { ...appSettings, ...data };
    }
  } catch (e) {}
}

/**
 * Ghi file settings qua IPC (window.api.saveSettingsData)
 */
async function saveSettingsFile() {
  const saveData = {
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

  try {
    localStorage.setItem('phongtro_settings', JSON.stringify(saveData));
  } catch (e) {}

  if (window.api && typeof window.api.saveSettingsData === 'function') {
    try {
      const res = await window.api.saveSettingsData(saveData);
      return res && !res.error;
    } catch (e) {
      console.error('Lỗi khi ghi settings qua IPC:', e);
    }
  }
  return true;
}

/**
 * Đọc file history qua IPC (window.api.loadMonthData)
 */
async function readHistoryFile(monthYearStr) {
  if (!monthYearStr) return null;

  // 1. Thử đọc từ Electron IPC
  if (window.api && typeof window.api.loadMonthData === 'function') {
    try {
      const res = await window.api.loadMonthData(monthYearStr);
      if (res && !res.error) {
        return res;
      }
    } catch (e) {
      console.error('Lỗi khi đọc dữ liệu qua IPC:', e);
    }
  }

  // 2. Thử đọc từ localStorage
  try {
    const local = localStorage.getItem(`history_${monthYearStr}`);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {}

  // 3. Fallback dữ liệu ban đầu cho Tháng 07/2026
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

  // 1. Backup vào localStorage
  try {
    localStorage.setItem(`history_${monthYearStr}`, JSON.stringify(data));
  } catch (e) {}

  // 2. Gửi IPC lên Electron Main Process
  if (window.api && typeof window.api.saveMonthData === 'function') {
    try {
      const res = await window.api.saveMonthData(monthYearStr, data);
      return res && !res.error;
    } catch (e) {
      console.error('Lỗi khi ghi dữ liệu qua IPC:', e);
      return false;
    }
  }
  return true;
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettingsFile();
  initSettingsForm();
  await loadRoomsForMonth(document.getElementById('month-year-select').value);

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
  document.getElementById('set-giaPhong').value = appSettings.giaPhong;
  document.getElementById('set-giaDien').value = appSettings.giaDien;
  document.getElementById('set-giaNuoc').value = appSettings.giaNuoc;
  document.getElementById('set-rac').value = appSettings.tienRac;
  document.getElementById('set-internet').value = appSettings.tienInternet;
  document.getElementById('set-tileHaoTai').value = (appSettings.tyLeHaoTai * 100).toFixed(1);
  document.getElementById('set-dienThoai').value = appSettings.dienThoai;
}

/**
 * Tải và tính toán tự động khóa/điền dữ liệu phòng cho tháng/năm được chọn
 */
async function loadRoomsForMonth(currentMonthYearStr) {
  // 1. Đọc dữ liệu lịch sử của chính tháng hiện tại (qua IPC)
  const currentMonthData = await readHistoryFile(currentMonthYearStr);

  // 2. Tính ra tháng liền trước và đọc file lịch sử tháng liền trước (qua IPC)
  const prevMonthStr = getPreviousMonthStr(currentMonthYearStr);
  const prevMonthData = await readHistoryFile(prevMonthStr);

  // 3. Xây dựng mảng dữ liệu 12 phòng với logic điền & khóa riêng từng phòng
  roomsData = DEFAULT_ROOM_NAMES.map(phongName => {
    const currRoom = currentMonthData
      ? currentMonthData.find(r => r.phong === phongName)
      : null;

    const prevRoom = prevMonthData
      ? prevMonthData.find(r => r.phong === phongName)
      : null;

    let dienCu = currRoom && currRoom.dienCu !== undefined ? currRoom.dienCu : '';
    let isDienCuLocked = false;

    if (prevRoom && prevRoom.dienMoi !== undefined && prevRoom.dienMoi !== null && prevRoom.dienMoi !== '') {
      dienCu = prevRoom.dienMoi;
      isDienCuLocked = true;
    }

    let nuocCu = currRoom && currRoom.nuocCu !== undefined ? currRoom.nuocCu : '';
    let isNuocCuLocked = false;

    if (prevRoom && prevRoom.nuocMoi !== undefined && prevRoom.nuocMoi !== null && prevRoom.nuocMoi !== '') {
      nuocCu = prevRoom.nuocMoi;
      isNuocCuLocked = true;
    }

    const dienMoi = currRoom && currRoom.dienMoi !== undefined ? currRoom.dienMoi : '';
    const nuocMoi = currRoom && currRoom.nuocMoi !== undefined ? currRoom.nuocMoi : '';

    return {
      phong: phongName,
      dienCu: dienCu,
      dienMoi: dienMoi,
      nuocCu: nuocCu,
      nuocMoi: nuocMoi,
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

      <!-- Điện Mới (Luôn mở khóa cho người dùng nhập tay) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input editable-meter" 
               data-row="${index}" 
               data-field="dienMoi" 
               value="${room.dienMoi !== undefined && room.dienMoi !== null ? room.dienMoi : ''}" 
               oninput="handleInputChange(${index}, 'dienMoi', this.value)" 
               onfocus="this.select()">
      </td>
      <!-- Số Điện Tiêu Thụ -->
      <td class="col-kwh val-calc cell-dien-kwh">0 kWh</td>

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

      <!-- Nước Mới (Luôn mở khóa cho người dùng nhập tay) -->
      <td class="col-meter">
        <input type="number" 
               class="table-input editable-meter" 
               data-row="${index}" 
               data-field="nuocMoi" 
               value="${room.nuocMoi !== undefined && room.nuocMoi !== null ? room.nuocMoi : ''}" 
               oninput="handleInputChange(${index}, 'nuocMoi', this.value)" 
               onfocus="this.select()">
      </td>
      <!-- Số Nước Tiêu Thụ -->
      <td class="col-kwh val-calc cell-nuoc-khoi">0 m³</td>

      <!-- Kết quả tính từ calc.js -->
      <td class="col-money val-calc cell-tien-dien">0 đ</td>
      <td class="col-money val-calc cell-tien-nuoc">0 đ</td>
      <td class="col-money val-calc cell-tien-phong">0 đ</td>
      <td class="col-money val-calc cell-rac">0 đ</td>
      <td class="col-money val-calc cell-internet">0 đ</td>
      <td class="col-kwh val-calc cell-hao-tai-kwh">0</td>
      <td class="col-money val-calc cell-tien-hao-tai">0 đ</td>

      <!-- Tổng Cộng -->
      <td class="col-total val-total cell-tong-cong">0 đ</td>
    `;
    tbody.appendChild(tr);

    // Cập nhật giá trị hiển thị ban đầu cho dòng
    updateRowUI(index);
  });

  updateFooterTotals();
}

/**
 * Xử lý khi người dùng nhập số
 */
function handleInputChange(index, field, value) {
  const numVal = value !== '' ? Number(value) : '';
  roomsData[index][field] = numVal;

  // Cập nhật UI riêng dòng đó & Footer
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
  const roomCalc = typeof calcRoom === 'function' 
    ? calcRoom(room, appSettings)
    : {
        dienKwh: Math.max(0, (Number(room.dienMoi) || 0) - (Number(room.dienCu) || 0)),
        nuocKhoi: Math.max(0, (Number(room.nuocMoi) || 0) - (Number(room.nuocCu) || 0)),
        tienDien: 0, tienNuoc: 0, tienPhong: appSettings.giaPhong,
        rac: appSettings.tienRac, internet: appSettings.tienInternet,
        haoTaiKwh: 0, tienHaoTai: 0, tongCong: 0
      };

  tr.querySelector('.cell-dien-kwh').textContent = formatNumber(roomCalc.dienKwh) + ' kWh';
  tr.querySelector('.cell-nuoc-khoi').textContent = formatNumber(roomCalc.nuocKhoi) + ' m³';
  tr.querySelector('.cell-tien-dien').textContent = formatNumber(roomCalc.tienDien) + ' đ';
  tr.querySelector('.cell-tien-nuoc').textContent = formatNumber(roomCalc.tienNuoc) + ' đ';
  tr.querySelector('.cell-tien-phong').textContent = formatNumber(roomCalc.tienPhong) + ' đ';
  tr.querySelector('.cell-rac').textContent = formatNumber(roomCalc.rac) + ' đ';
  tr.querySelector('.cell-internet').textContent = formatNumber(roomCalc.internet) + ' đ';
  tr.querySelector('.cell-hao-tai-kwh').textContent = formatNumber(roomCalc.haoTaiKwh);
  tr.querySelector('.cell-tien-hao-tai').textContent = formatNumber(roomCalc.tienHaoTai) + ' đ';
  tr.querySelector('.cell-tong-cong').textContent = formatNumber(roomCalc.tongCong) + ' đ';
}

/**
 * Cập nhật dòng tổng cộng Footer & Stats Overview Cards
 */
function updateFooterTotals() {
  const calcResult = typeof calcAllRooms === 'function'
    ? calcAllRooms(roomsData, appSettings)
    : { rooms: [], tongDoanhThu: 0 };

  let totalDienKwh = 0;
  let totalNuocKhoi = 0;
  let sumTienDien = 0;
  let sumTienNuoc = 0;
  let sumTienPhong = 0;
  let sumRac = 0;
  let sumInternet = 0;
  let sumHaoTaiKwh = 0;
  let sumTienHaoTai = 0;

  calcResult.rooms.forEach(r => {
    totalDienKwh += r.dienKwh;
    totalNuocKhoi += r.nuocKhoi;
    sumTienDien += r.tienDien;
    sumTienNuoc += r.tienNuoc;
    sumTienPhong += r.tienPhong;
    sumRac += r.rac;
    sumInternet += r.internet;
    sumHaoTaiKwh += r.haoTaiKwh;
    sumTienHaoTai += r.tienHaoTai;
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
  document.getElementById('grand-total-revenue').textContent = formatNumber(calcResult.tongDoanhThu) + ' đ';

  // Stats cards
  document.getElementById('stat-total-revenue').textContent = formatNumber(calcResult.tongDoanhThu) + ' đ';
  document.getElementById('stat-total-kwh').textContent = formatNumber(totalDienKwh) + ' kWh';
  document.getElementById('stat-total-water').textContent = formatNumber(totalNuocKhoi) + ' m³';
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
 * Lưu Cài Đặt Giá
 */
async function saveSettings(event) {
  event.preventDefault();
  appSettings.giaPhong = Number(document.getElementById('set-giaPhong').value) || 0;
  appSettings.giaDien = Number(document.getElementById('set-giaDien').value) || 0;
  appSettings.giaNuoc = Number(document.getElementById('set-giaNuoc').value) || 0;
  appSettings.tienRac = Number(document.getElementById('set-rac').value) || 0;
  appSettings.tienInternet = Number(document.getElementById('set-internet').value) || 0;
  appSettings.tyLeHaoTai = (Number(document.getElementById('set-tileHaoTai').value) || 0) / 100;
  appSettings.dienThoai = document.getElementById('set-dienThoai').value;

  const ok = await saveSettingsFile();

  roomsData.forEach(r => {
    r.tienPhong = appSettings.giaPhong;
  });

  roomsData.forEach((_, idx) => updateRowUI(idx));
  updateFooterTotals();
  if (ok) {
    showToast("Đã lưu cài đặt giá vào file thành công!", 'success');
  } else {
    showToast("Đã cập nhật cài đặt giá!", 'success');
  }
}

/**
 * Nút Lưu Dữ Liệu
 */
async function saveData() {
  const currentMonthYear = document.getElementById('month-year-select').value;
  const saveDataArray = roomsData.map(r => ({
    phong: r.phong,
    dienCu: Number(r.dienCu) || 0,
    dienMoi: Number(r.dienMoi) || 0,
    nuocCu: Number(r.nuocCu) || 0,
    nuocMoi: Number(r.nuocMoi) || 0
  }));

  const success = await writeHistoryFile(currentMonthYear, saveDataArray);
  if (success) {
    showToast(`Đã lưu dữ liệu file data/history/${currentMonthYear}.json thành công!`, 'success');
  } else {
    showToast(`Có lỗi xảy ra khi lưu file ${currentMonthYear}.json!`, 'error');
  }
}

/**
 * Nút Lưu & Xuất Hình Ảnh
 */
async function exportReceipts() {
  await saveData();
  showToast("Đang tạo & xuất hình ảnh phiếu thu cho 12 phòng...", 'success');
}

/**
 * Hiển thị thông báo Toast
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

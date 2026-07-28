/* ============================================================
   RENDERER.JS - LOGIC MÀN HÌNH NHẬP LIỆU (EXCEL-STYLE KEYBOARD & DIRECT DOM UPDATES)
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

// Dữ liệu mẫu 12 phòng
let roomsData = [];

/**
 * Format số có dấu chấm phân cách hàng nghìn (VD: 14110 -> 14.110)
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('vi-VN');
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', () => {
  initSettingsForm();
  loadRoomsForMonth(document.getElementById('month-year-select').value);

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
 * Tải dữ liệu phòng cho tháng/năm được chọn
 */
function loadRoomsForMonth(monthYearStr) {
  const sampleData = [
    { phong: "1A", dienCu: 12100, dienMoi: 12210, nuocCu: 640, nuocMoi: 648 },
    { phong: "1B", dienCu: 9800,  dienMoi: 9915,  nuocCu: 510, nuocMoi: 517 },
    { phong: "2A", dienCu: 15400, dienMoi: 15530, nuocCu: 810, nuocMoi: 820 },
    { phong: "2B", dienCu: 11200, dienMoi: 11305, nuocCu: 600, nuocMoi: 606 },
    { phong: "3A", dienCu: 8900,  dienMoi: 9020,  nuocCu: 430, nuocMoi: 438 },
    { phong: "3B", dienCu: 14100, dienMoi: 14210, nuocCu: 720, nuocMoi: 727 },
    { phong: "4A", dienCu: 17300, dienMoi: 17440, nuocCu: 910, nuocMoi: 920 },
    { phong: "4B", dienCu: 10500, dienMoi: 10610, nuocCu: 580, nuocMoi: 586 },
    { phong: "5A", dienCu: 13300, dienMoi: 13415, nuocCu: 690, nuocMoi: 698 },
    { phong: "5B", dienCu: 16200, dienMoi: 16325, nuocCu: 850, nuocMoi: 859 },
    { phong: "6A", dienCu: 12800, dienMoi: 12910, nuocCu: 670, nuocMoi: 676 },
    { phong: "6B", dienCu: 13336, dienMoi: 13449, nuocCu: 760, nuocMoi: 768 }
  ];

  roomsData = sampleData.map(r => ({
    ...r,
    tienPhong: r.tienPhong || appSettings.giaPhong
  }));

  renderInitialTable();
}

/**
 * Render khởi tạo cấu trúc 12 dòng vào Bảng (Chỉ dựng DOM 1 lần duy nhất)
 */
function renderInitialTable() {
  const tbody = document.getElementById('rooms-table-body');
  tbody.innerHTML = '';

  roomsData.forEach((room, index) => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row-index', index);

    tr.innerHTML = `
      <td class="col-stt">${index + 1}</td>
      <td class="col-phong"><span class="room-badge">${room.phong}</span></td>
      
      <!-- Điện Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" data-row="${index}" data-field="dienCu" value="${room.dienCu}" oninput="handleInputChange(${index}, 'dienCu', this.value)" onfocus="this.select()">
      </td>
      <!-- Điện Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" data-row="${index}" data-field="dienMoi" value="${room.dienMoi}" oninput="handleInputChange(${index}, 'dienMoi', this.value)" onfocus="this.select()">
      </td>
      <!-- Số Điện Tiêu Thụ -->
      <td class="col-kwh val-calc cell-dien-kwh">0 kWh</td>

      <!-- Nước Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" data-row="${index}" data-field="nuocCu" value="${room.nuocCu}" oninput="handleInputChange(${index}, 'nuocCu', this.value)" onfocus="this.select()">
      </td>
      <!-- Nước Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" data-row="${index}" data-field="nuocMoi" value="${room.nuocMoi}" oninput="handleInputChange(${index}, 'nuocMoi', this.value)" onfocus="this.select()">
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
 * Xử lý khi người dùng nhập số (Không hủy/dựng lại DOM => Không bao giờ mất focus)
 */
function handleInputChange(index, field, value) {
  const numVal = Number(value) || 0;
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
        dienKwh: Math.max(0, room.dienMoi - room.dienCu),
        nuocKhoi: Math.max(0, room.nuocMoi - room.nuocCu),
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
    // Di chuyển xuống phòng tiếp theo (Enter) hoặc lên phòng trước (Shift + Enter)
    const targetRowIndex = event.shiftKey ? rowIndex - 1 : rowIndex + 1;
    const targetInput = document.querySelector(`.table-input[data-row="${targetRowIndex}"][data-field="${field}"]`);

    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    } else if (!event.shiftKey && targetRowIndex >= roomsData.length) {
      // Nếu hết phòng cuối, di chuyển sang cột tiếp theo của phòng đầu tiên (1A)
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
    // Tự động select nội dung ô tiếp theo khi nhấn Tab
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
function onMonthYearChange() {
  const monthYear = document.getElementById('month-year-select').value;
  loadRoomsForMonth(monthYear);
  showToast(`Đã chuyển sang ${monthYear}`, 'success');
}

/**
 * Lưu Cài Đặt Giá
 */
function saveSettings(event) {
  event.preventDefault();
  appSettings.giaPhong = Number(document.getElementById('set-giaPhong').value) || 0;
  appSettings.giaDien = Number(document.getElementById('set-giaDien').value) || 0;
  appSettings.giaNuoc = Number(document.getElementById('set-giaNuoc').value) || 0;
  appSettings.tienRac = Number(document.getElementById('set-rac').value) || 0;
  appSettings.tienInternet = Number(document.getElementById('set-internet').value) || 0;
  appSettings.tyLeHaoTai = (Number(document.getElementById('set-tileHaoTai').value) || 0) / 100;
  appSettings.dienThoai = document.getElementById('set-dienThoai').value;

  roomsData.forEach(r => {
    r.tienPhong = appSettings.giaPhong;
  });

  // Re-render UI
  roomsData.forEach((_, idx) => updateRowUI(idx));
  updateFooterTotals();
  showToast("Đã lưu thiết lập giá thành công!", 'success');
}

/**
 * Nút Lưu Dữ Liệu
 */
function saveData() {
  showToast("Đã lưu dữ liệu chỉ số thành công!", 'success');
}

/**
 * Nút Lưu & Xuất Hình Ảnh
 */
function exportReceipts() {
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

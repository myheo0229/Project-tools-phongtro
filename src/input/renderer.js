/* ============================================================
   RENDERER.JS - LOGIC MÀN HÌNH NHẬP LIỆU
   ============================================================ */

// Cấu hình mặc định nếu chưa có file
let appSettings = {
  dienThoai: "0982 141 407",
  giaPhong: 2200000,
  giaDien: 2900,
  giaNuoc: 12000,
  rac: 40000,
  internet: 24000,
  tileHaoTai: 0.07
};

// Danh sách 12 phòng mặc định
const DEFAULT_ROOM_NAMES = [
  "1A", "1B", "2A", "2B", "3A", "3B",
  "4A", "4B", "5A", "5B", "6A", "6B"
];

// Dữ liệu chỉ số các phòng hiện tại
let roomsData = [];

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', () => {
  initSettingsForm();
  loadRoomsForMonth(document.getElementById('month-year-select').value);
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
  document.getElementById('set-rac').value = appSettings.rac;
  document.getElementById('set-internet').value = appSettings.internet;
  document.getElementById('set-tileHaoTai').value = (appSettings.tileHaoTai * 100).toFixed(1);
  document.getElementById('set-dienThoai').value = appSettings.dienThoai;
}

/**
 * Tải dữ liệu phòng cho tháng/năm được chọn
 */
function loadRoomsForMonth(monthYearStr) {
  const sampleData = [
    { phong: "1A", dienCu: 12100, dienMoi: 12210, nuocCu: 640, nuocMoi: 648, noCu: 0 },
    { phong: "1B", dienCu: 9800,  dienMoi: 9915,  nuocCu: 510, nuocMoi: 517, noCu: 0 },
    { phong: "2A", dienCu: 15400, dienMoi: 15530, nuocCu: 810, nuocMoi: 820, noCu: 150000 },
    { phong: "2B", dienCu: 11200, dienMoi: 11305, nuocCu: 600, nuocMoi: 606, noCu: 0 },
    { phong: "3A", dienCu: 8900,  dienMoi: 9020,  nuocCu: 430, nuocMoi: 438, noCu: 0 },
    { phong: "3B", dienCu: 14100, dienMoi: 14210, nuocCu: 720, nuocMoi: 727, noCu: 0 },
    { phong: "4A", dienCu: 17300, dienMoi: 17440, nuocCu: 910, nuocMoi: 920, noCu: 0 },
    { phong: "4B", dienCu: 10500, dienMoi: 10610, nuocCu: 580, nuocMoi: 586, noCu: 0 },
    { phong: "5A", dienCu: 13300, dienMoi: 13415, nuocCu: 690, nuocMoi: 698, noCu: 0 },
    { phong: "5B", dienCu: 16200, dienMoi: 16325, nuocCu: 850, nuocMoi: 859, noCu: 0 },
    { phong: "6A", dienCu: 12800, dienMoi: 12910, nuocCu: 670, nuocMoi: 676, noCu: 0 },
    { phong: "6B", dienCu: 13336, dienMoi: 13449, nuocCu: 760, nuocMoi: 768, noCu: 0 }
  ];

  roomsData = sampleData;
  renderTableRows();
}

/**
 * Render 12 dòng vào Bảng nhập dữ liệu
 */
function renderTableRows() {
  const tbody = document.getElementById('rooms-table-body');
  tbody.innerHTML = '';

  let grandTotalRevenue = 0;
  let totalDienKwh = 0;
  let totalNuocKhoi = 0;

  let sumTienDien = 0;
  let sumTienNuoc = 0;
  let sumTienPhong = 0;
  let sumRac = 0;
  let sumInternet = 0;
  let sumHaoTaiKwh = 0;
  let sumTienHaoTai = 0;
  let sumNoCu = 0;

  roomsData.forEach((room, index) => {
    // Gọi calc.js để tính toán
    const calc = calculateRoom(room, appSettings);

    grandTotalRevenue += calc.tongCong;
    totalDienKwh += calc.dienKwh;
    totalNuocKhoi += calc.nuocKhoi;

    sumTienDien += calc.tienDien;
    sumTienNuoc += calc.tienNuoc;
    sumTienPhong += calc.tienPhong;
    sumRac += calc.rac;
    sumInternet += calc.internet;
    sumHaoTaiKwh += calc.haoTaiKwh;
    sumTienHaoTai += calc.tienHaoTai;
    sumNoCu += (calc.noCu || 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-stt center">${index + 1}</td>
      <td class="col-phong center"><span class="room-badge">${calc.phong}</span></td>
      
      <!-- Điện Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" value="${calc.dienCu}" onchange="updateRoomData(${index}, 'dienCu', this.value)">
      </td>
      <!-- Điện Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" value="${calc.dienMoi}" onchange="updateRoomData(${index}, 'dienMoi', this.value)" onkeyup="updateRoomData(${index}, 'dienMoi', this.value)">
      </td>
      <!-- Số Điện Tiêu Thụ -->
      <td class="col-kwh right val-calc">${calc.dienKwh} kWh</td>

      <!-- Nước Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" value="${calc.nuocCu}" onchange="updateRoomData(${index}, 'nuocCu', this.value)">
      </td>
      <!-- Nước Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" value="${calc.nuocMoi}" onchange="updateRoomData(${index}, 'nuocMoi', this.value)" onkeyup="updateRoomData(${index}, 'nuocMoi', this.value)">
      </td>
      <!-- Số Nước Tiêu Thụ -->
      <td class="col-kwh right val-calc">${calc.nuocKhoi} m³</td>

      <!-- Kết quả tính toán thành tiền -->
      <td class="col-money right val-calc">${formatCurrency(calc.tienDien)} đ</td>
      <td class="col-money right val-calc">${formatCurrency(calc.tienNuoc)} đ</td>
      <td class="col-money right val-calc">${formatCurrency(calc.tienPhong)} đ</td>
      <td class="col-money right val-calc">${formatCurrency(calc.rac)} đ</td>
      <td class="col-money right val-calc">${formatCurrency(calc.internet)} đ</td>
      <td class="col-kwh right val-calc">${calc.haoTaiKwh}</td>
      <td class="col-money right val-calc">${formatCurrency(calc.tienHaoTai)} đ</td>
      
      <!-- Nợ Cũ -->
      <td class="col-money">
        <input type="number" class="table-input" value="${calc.noCu || 0}" onchange="updateRoomData(${index}, 'noCu', this.value)">
      </td>

      <!-- Tổng Cộng -->
      <td class="col-total right val-total">${formatCurrency(calc.tongCong)} đ</td>
    `;
    tbody.appendChild(tr);
  });

  // Cập nhật dòng DOANH THU THÁNG (Footer)
  document.getElementById('sum-dien-kwh').textContent = totalDienKwh + ' kWh';
  document.getElementById('sum-nuoc-khoi').textContent = totalNuocKhoi + ' m³';
  document.getElementById('sum-tien-dien').textContent = formatCurrency(sumTienDien) + ' đ';
  document.getElementById('sum-tien-nuoc').textContent = formatCurrency(sumTienNuoc) + ' đ';
  document.getElementById('sum-tien-phong').textContent = formatCurrency(sumTienPhong) + ' đ';
  document.getElementById('sum-rac').textContent = formatCurrency(sumRac) + ' đ';
  document.getElementById('sum-internet').textContent = formatCurrency(sumInternet) + ' đ';
  document.getElementById('sum-hao-tai-kwh').textContent = sumHaoTaiKwh.toFixed(1) + ' kWh';
  document.getElementById('sum-tien-hao-tai').textContent = formatCurrency(sumTienHaoTai) + ' đ';
  document.getElementById('sum-no-cu').textContent = formatCurrency(sumNoCu) + ' đ';
  document.getElementById('grand-total-revenue').textContent = formatCurrency(grandTotalRevenue) + ' đ';

  // Cập nhật các thẻ thông số nhanh (Stats Cards)
  document.getElementById('stat-total-revenue').textContent = formatCurrency(grandTotalRevenue) + ' đ';
  document.getElementById('stat-total-kwh').textContent = totalDienKwh + ' kWh';
  document.getElementById('stat-total-water').textContent = totalNuocKhoi + ' m³';
}

/**
 * Cập nhật biến khi người dùng gõ chỉ số
 */
function updateRoomData(index, field, value) {
  const numVal = Number(value) || 0;
  roomsData[index][field] = numVal;
  renderTableRows();
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
  appSettings.rac = Number(document.getElementById('set-rac').value) || 0;
  appSettings.internet = Number(document.getElementById('set-internet').value) || 0;
  appSettings.tileHaoTai = (Number(document.getElementById('set-tileHaoTai').value) || 0) / 100;
  appSettings.dienThoai = document.getElementById('set-dienThoai').value;

  renderTableRows();
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

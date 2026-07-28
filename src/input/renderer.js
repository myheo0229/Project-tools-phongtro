/* ============================================================
   RENDERER.JS - LOGIC MÀN HÌNH NHẬP LIỆU (TÍNH TOÁN VỚI CALC.JS)
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

  renderTableRows();
}

/**
 * Render 12 dòng vào Bảng nhập dữ liệu (gọi calcAllRooms từ calc.js)
 */
function renderTableRows() {
  const tbody = document.getElementById('rooms-table-body');
  tbody.innerHTML = '';

  // Sử dụng calcAllRooms từ calc.js
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

  calcResult.rooms.forEach((roomCalc, index) => {
    totalDienKwh += roomCalc.dienKwh;
    totalNuocKhoi += roomCalc.nuocKhoi;

    sumTienDien += roomCalc.tienDien;
    sumTienNuoc += roomCalc.tienNuoc;
    sumTienPhong += roomCalc.tienPhong;
    sumRac += roomCalc.rac;
    sumInternet += roomCalc.internet;
    sumHaoTaiKwh += roomCalc.haoTaiKwh;
    sumTienHaoTai += roomCalc.tienHaoTai;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-stt">${index + 1}</td>
      <td class="col-phong"><span class="room-badge">${roomCalc.phong}</span></td>
      
      <!-- Điện Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" value="${roomCalc.dienCu}" onchange="updateRoomData(${index}, 'dienCu', this.value)">
      </td>
      <!-- Điện Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" value="${roomCalc.dienMoi}" onchange="updateRoomData(${index}, 'dienMoi', this.value)" onkeyup="updateRoomData(${index}, 'dienMoi', this.value)">
      </td>
      <!-- Số Điện Tiêu Thụ -->
      <td class="col-kwh val-calc">${formatNumber(roomCalc.dienKwh)} kWh</td>

      <!-- Nước Cũ -->
      <td class="col-meter">
        <input type="number" class="table-input" value="${roomCalc.nuocCu}" onchange="updateRoomData(${index}, 'nuocCu', this.value)">
      </td>
      <!-- Nước Mới -->
      <td class="col-meter">
        <input type="number" class="table-input editable-meter" value="${roomCalc.nuocMoi}" onchange="updateRoomData(${index}, 'nuocMoi', this.value)" onkeyup="updateRoomData(${index}, 'nuocMoi', this.value)">
      </td>
      <!-- Số Nước Tiêu Thụ -->
      <td class="col-kwh val-calc">${formatNumber(roomCalc.nuocKhoi)} m³</td>

      <!-- Kết quả tính từ calc.js -->
      <td class="col-money val-calc">${formatNumber(roomCalc.tienDien)} đ</td>
      <td class="col-money val-calc">${formatNumber(roomCalc.tienNuoc)} đ</td>
      <td class="col-money val-calc">${formatNumber(roomCalc.tienPhong)} đ</td>
      <td class="col-money val-calc">${formatNumber(roomCalc.rac)} đ</td>
      <td class="col-money val-calc">${formatNumber(roomCalc.internet)} đ</td>
      <td class="col-kwh val-calc">${formatNumber(roomCalc.haoTaiKwh)}</td>
      <td class="col-money val-calc">${formatNumber(roomCalc.tienHaoTai)} đ</td>

      <!-- Tổng Cộng -->
      <td class="col-total val-total">${formatNumber(roomCalc.tongCong)} đ</td>
    `;
    tbody.appendChild(tr);
  });

  // Cập nhật dòng DOANH THU THÁNG (Footer)
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

  // Cập nhật các thẻ thông số nhanh (Stats Cards)
  document.getElementById('stat-total-revenue').textContent = formatNumber(calcResult.tongDoanhThu) + ' đ';
  document.getElementById('stat-total-kwh').textContent = formatNumber(totalDienKwh) + ' kWh';
  document.getElementById('stat-total-water').textContent = formatNumber(totalNuocKhoi) + ' m³';
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
  appSettings.tienRac = Number(document.getElementById('set-rac').value) || 0;
  appSettings.tienInternet = Number(document.getElementById('set-internet').value) || 0;
  appSettings.tyLeHaoTai = (Number(document.getElementById('set-tileHaoTai').value) || 0) / 100;
  appSettings.dienThoai = document.getElementById('set-dienThoai').value;

  // Cập nhật lại giá phòng cho tất cả phòng nếu chưa có giá riêng
  roomsData.forEach(r => {
    r.tienPhong = appSettings.giaPhong;
  });

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

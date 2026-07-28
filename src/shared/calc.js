/* ============================================================
   SRC/SHARED/CALC.JS
   Logic tính tiền điện nước cho ứng dụng Quản lý phòng trọ
   ============================================================ */

// Giới hạn max công tơ điện (dùng khi công tơ quay vòng)
const MAX_DONG_HO_DIEN = 10000;

/**
 * Làm tròn số đến hàng nghìn gần nhất (≥500 lên, <500 xuống)
 * @param {number} x 
 * @returns {number}
 */
function round1000(x) {
  return Math.round(x / 1000) * 1000;
}

/**
 * Làm tròn số đến 1 chữ số thập phân
 * @param {number} x 
 * @returns {number}
 */
function round1(x) {
  return Math.round(x * 10) / 10;
}

/**
 * Tính toán số liệu tiền trọ cho 1 phòng
 * @param {Object} input - Thông tin phòng { phong, dienCu, dienMoi, nuocCu, nuocMoi, tienPhong }
 * @param {Object} settings - Cài đặt chung { giaDien, giaNuoc, tyLeHaoTai, tienRac, tienInternet }
 * @returns {Object} Số liệu chi tiết cho phòng
 */
function calcRoom(input, settings) {
  const phong = input.phong;
  const dienCu = Number(input.dienCu) || 0;
  const dienMoi = Number(input.dienMoi) || 0;
  const nuocCu = Number(input.nuocCu) || 0;
  const nuocMoi = Number(input.nuocMoi) || 0;
  const tienPhong = Number(input.tienPhong) || 0;

  const giaDien = Number(settings.giaDien) || 0;
  const giaNuoc = Number(settings.giaNuoc) || 0;
  const tyLeHaoTai = Number(settings.tyLeHaoTai) || 0;
  const tienRac = Number(settings.tienRac) || 0;
  const tienInternet = Number(settings.tienInternet) || 0;

  // 1. Số điện tiêu thụ — dienTieuThu (xử lý công tơ quay vòng)
  let dienTieuThu = 0;
  if (dienMoi >= dienCu) {
    dienTieuThu = dienMoi - dienCu;
  } else {
    dienTieuThu = (MAX_DONG_HO_DIEN + dienMoi) - dienCu;
  }

  // 2. Số nước tiêu thụ — nuocTieuThu
  const nuocTieuThu = Math.max(0, nuocMoi - nuocCu);

  // 3. Tiền điện — tienDien
  const tienDien = round1000(dienTieuThu * giaDien);

  // 4. Tiền nước — tienNuoc
  const tienNuoc = round1000(nuocTieuThu * giaNuoc);

  // 5. Điện hao tải — dienHaoTai (kWh, 1 chữ số thập phân)
  const dienHaoTai = round1(dienTieuThu * tyLeHaoTai);

  // 6. Tiền điện hao tải — tienDienHaoTai
  const tienDienHaoTai = round1000(dienHaoTai * giaDien);

  // 7. Tổng cộng mỗi phòng — tongCong
  const tongCong = tienDien + tienNuoc + tienDienHaoTai + tienPhong + tienRac + tienInternet;

  return {
    phong,
    dienMoi,
    dienCu,
    dienKwh: dienTieuThu,
    giaDien,
    tienDien,

    nuocMoi,
    nuocCu,
    nuocKhoi: nuocTieuThu,
    giaNuoc,
    tienNuoc,

    rac: tienRac,
    internet: tienInternet,

    haoTaiKwh: dienHaoTai,
    giaHaoTai: giaDien,
    tienHaoTai: tienDienHaoTai,

    tienPhong,
    tongCong
  };
}

/**
 * Tính toán cho toàn bộ danh sách phòng và tổng doanh thu tháng
 * @param {Array} rooms - Mảng danh sách các phòng
 * @param {Object} settings - Cài đặt giá chung
 * @returns {Object} { rooms: [...], tongDoanhThu: number }
 */
function calcAllRooms(rooms, settings) {
  let tongDoanhThu = 0;
  const calculatedRooms = (rooms || []).map(room => {
    const res = calcRoom(room, settings);
    tongDoanhThu += res.tongCong;
    return res;
  });

  return {
    rooms: calculatedRooms,
    tongDoanhThu
  };
}

// Export cho môi trường Node / CommonJS và Trình duyệt
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcRoom,
    calcAllRooms,
    round1000,
    round1,
    MAX_DONG_HO_DIEN,
  };
}

if (typeof window !== 'undefined') {
  window.calcRoom = calcRoom;
  window.calcAllRooms = calcAllRooms;
  window.round1000 = round1000;
  window.round1 = round1;
  window.MAX_DONG_HO_DIEN = MAX_DONG_HO_DIEN;
}

/* ============================================================
   SRC/SHARED/CALC.JS
   Logic tính tiền điện nước cho ứng dụng Quản lý phòng trọ
   ============================================================ */

// Giới hạn max công tơ điện mặc định (khi không truyền cấu hình chữ số)
const MAX_DONG_HO_DIEN = 10000;

/**
 * Lấy giới hạn tối đa của đồng hồ dựa trên số chữ số (10^digits)
 * Ví dụ: 4 chữ số -> 10.000, 5 chữ số -> 100.000
 * @param {number|string} digits - Số chữ số (3 - 7)
 * @param {number} defaultVal - Giá trị fallback nếu không hợp lệ
 * @returns {number}
 */
function getMeterLimitByDigits(digits, defaultVal = 100000) {
  const d = Number(digits);
  if (!isNaN(d) && d >= 3 && d <= 7) {
    return Math.pow(10, Math.floor(d));
  }
  return defaultVal;
}

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
    // Xác định giới hạn vòng quay công tơ điện dựa trên cấu hình từng phòng (nếu có)
    let maxDongHoDien = MAX_DONG_HO_DIEN;
    if (settings && settings.meterDigits && settings.meterDigits[phong] && settings.meterDigits[phong].dien) {
      maxDongHoDien = getMeterLimitByDigits(settings.meterDigits[phong].dien, 100000);
    } else if (input && input.maxDongHoDien) {
      maxDongHoDien = Number(input.maxDongHoDien) || MAX_DONG_HO_DIEN;
    }
    dienTieuThu = (maxDongHoDien + dienMoi) - dienCu;
  }

  // 2. Số nước tiêu thụ — nuocTieuThu (xử lý an toàn cả trường hợp đồng hồ nước quay vòng)
  let nuocTieuThu = 0;
  if (nuocMoi >= nuocCu) {
    nuocTieuThu = nuocMoi - nuocCu;
  } else {
    let maxDongHoNuoc = 10000;
    if (settings && settings.meterDigits && settings.meterDigits[phong] && settings.meterDigits[phong].nuoc) {
      maxDongHoNuoc = getMeterLimitByDigits(settings.meterDigits[phong].nuoc, 10000);
    } else if (input && input.maxDongHoNuoc) {
      maxDongHoNuoc = Number(input.maxDongHoNuoc) || 10000;
    }
    nuocTieuThu = (maxDongHoNuoc + nuocMoi) - nuocCu;
  }

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
    getMeterLimitByDigits
  };
}

if (typeof window !== 'undefined') {
  window.calcRoom = calcRoom;
  window.calcAllRooms = calcAllRooms;
  window.round1000 = round1000;
  window.round1 = round1;
  window.MAX_DONG_HO_DIEN = MAX_DONG_HO_DIEN;
  window.getMeterLimitByDigits = getMeterLimitByDigits;
}

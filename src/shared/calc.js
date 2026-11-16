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
 * @param {number} [defaultVal=100000] - Giá trị fallback nếu không hợp lệ
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
 * @param {Record<string, any>} [input] - Thông tin phòng { phong, dienCu, dienMoi, nuocCu, nuocMoi, tienPhong, dienKwhOverride, nuocKhoiOverride }
 * @param {Record<string, any>} [settings] - Cài đặt chung { giaDien, giaNuoc, tyLeHaoTai, tienRac, tienInternet, meterDigits }
 * @returns {Record<string, any>} Số liệu chi tiết cho phòng
 */
function calcRoom(input, settings) {
  const safeInput = input || {};
  const safeSettings = settings || {};

  const phong = safeInput.phong;
  const dienCu = Number(safeInput.dienCu) || 0;
  const dienMoi = Number(safeInput.dienMoi) || 0;
  const nuocCu = Number(safeInput.nuocCu) || 0;
  const nuocMoi = Number(safeInput.nuocMoi) || 0;
  const tienPhong = Number(safeInput.tienPhong) || 0;

  const giaDien = Number(safeSettings.giaDien) || 0;
  const giaNuoc = Number(safeSettings.giaNuoc) || 0;
  const tyLeHaoTai = Number(safeSettings.tyLeHaoTai) || 0;
  const tienRac = Number(safeSettings.tienRac) || 0;
  const tienInternet = Number(safeSettings.tienInternet) || 0;

  // 1. Số điện tiêu thụ — dienTieuThu (hỗ trợ override khi thay đồng hồ, hoặc xử lý công tơ quay vòng)
  const hasDienOverride = safeInput.dienKwhOverride !== undefined && safeInput.dienKwhOverride !== null && safeInput.dienKwhOverride !== '' && !isNaN(Number(safeInput.dienKwhOverride));
  let dienTieuThu = 0;
  if (hasDienOverride) {
    dienTieuThu = Math.max(0, Number(safeInput.dienKwhOverride));
  } else if (dienMoi >= dienCu) {
    dienTieuThu = dienMoi - dienCu;
  } else {
    // Xác định giới hạn vòng quay công tơ điện dựa trên cấu hình từng phòng (nếu có)
    let maxDongHoDien = MAX_DONG_HO_DIEN;
    if (safeSettings.meterDigits && phong && safeSettings.meterDigits[phong] && safeSettings.meterDigits[phong].dien) {
      maxDongHoDien = getMeterLimitByDigits(safeSettings.meterDigits[phong].dien, 100000);
    } else if (safeInput.maxDongHoDien) {
      maxDongHoDien = Number(safeInput.maxDongHoDien) || MAX_DONG_HO_DIEN;
    }
    dienTieuThu = (maxDongHoDien + dienMoi) - dienCu;
  }

  // 2. Số nước tiêu thụ — nuocTieuThu (hỗ trợ override khi thay đồng hồ, hoặc xử lý đồng hồ nước quay vòng)
  const hasNuocOverride = safeInput.nuocKhoiOverride !== undefined && safeInput.nuocKhoiOverride !== null && safeInput.nuocKhoiOverride !== '' && !isNaN(Number(safeInput.nuocKhoiOverride));
  let nuocTieuThu = 0;
  if (hasNuocOverride) {
    nuocTieuThu = Math.max(0, Number(safeInput.nuocKhoiOverride));
  } else if (nuocMoi >= nuocCu) {
    nuocTieuThu = nuocMoi - nuocCu;
  } else {
    let maxDongHoNuoc = 10000;
    if (safeSettings.meterDigits && phong && safeSettings.meterDigits[phong] && safeSettings.meterDigits[phong].nuoc) {
      maxDongHoNuoc = getMeterLimitByDigits(safeSettings.meterDigits[phong].nuoc, 10000);
    } else if (safeInput.maxDongHoNuoc) {
      maxDongHoNuoc = Number(safeInput.maxDongHoNuoc) || 10000;
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
 * @param {Array<Record<string, any>>} rooms - Mảng danh sách các phòng
 * @param {Record<string, any>} [settings] - Cài đặt giá chung
 * @returns {{ rooms: Array<Record<string, any>>, tongDoanhThu: number }}
 */
function calcAllRooms(rooms, settings) {
  let tongDoanhThu = 0;
  const calculatedRooms = (rooms || []).map(room => {
    const res = calcRoom(room, settings);
    tongDoanhThu += Number(res.tongCong) || 0;
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
  const win = /** @type {any} */ (window);
  win.calcRoom = calcRoom;
  win.calcAllRooms = calcAllRooms;
  win.round1000 = round1000;
  win.round1 = round1;
  win.MAX_DONG_HO_DIEN = MAX_DONG_HO_DIEN;
  win.getMeterLimitByDigits = getMeterLimitByDigits;
}

/* ============================================================
   FORMAT.JS - ĐỊNH DẠNG DỮ LIỆU PHIẾU THU KHỜI TẠO DÀNH CHO RENDERROOM
   ============================================================ */

/**
 * Định dạng số tiền theo kiểu Việt Nam: dấu CHẤM ngăn cách hàng nghìn, không có phần thập phân.
 * VD: formatMoney(2200000) -> "2.200.000"
 */
function formatMoney(number) {
  if (number === null || number === undefined || isNaN(number)) return '0';
  return Math.round(Number(number)).toLocaleString('vi-VN');
}

/**
 * Từ monthKey dạng "YYYY-MM" (VD "2026-07") suy ra ngày/tháng/năm để hiển thị trên phiếu.
 * Ngày LUÔN cố định là "01".
 * Tháng/Năm lấy đúng theo tháng đang được xử lý (monthKey).
 */
function getNgayThangNam(monthKey) {
  if (!monthKey || !monthKey.includes('-')) {
    return { ngay: '01', thang: '07', nam: '2026' };
  }
  const [nam, thang] = monthKey.split('-');
  return { ngay: '01', thang, nam };
}

/**
 * Gộp kết quả calcRoom() (từ calc.js) + ngày tháng + định dạng tiền, ra đúng shape mà
 * renderRoom(data) của src/receipt đang cần.
 */
function toReceiptData(calcResult, monthKey, dienThoai) {
  const { ngay, thang, nam } = getNgayThangNam(monthKey);
  const phoneStr = dienThoai || "0982 141 407";

  return {
    dienThoai: phoneStr,
    phong: calcResult.phong,
    ngay,
    thang,
    nam,

    tienPhong: formatMoney(calcResult.tienPhong),

    dienMoi: String(calcResult.dienMoi !== undefined ? calcResult.dienMoi : 0),
    dienCu: String(calcResult.dienCu !== undefined ? calcResult.dienCu : 0),
    dienKwh: String(calcResult.dienKwh !== undefined ? calcResult.dienKwh : 0),
    giaDien: formatMoney(calcResult.giaDien),
    tienDien: formatMoney(calcResult.tienDien),

    nuocMoi: String(calcResult.nuocMoi !== undefined ? calcResult.nuocMoi : 0),
    nuocCu: String(calcResult.nuocCu !== undefined ? calcResult.nuocCu : 0),
    nuocKhoi: String(calcResult.nuocKhoi !== undefined ? calcResult.nuocKhoi : 0),
    giaNuoc: formatMoney(calcResult.giaNuoc),
    tienNuoc: formatMoney(calcResult.tienNuoc),

    rac: formatMoney(calcResult.rac),
    internet: formatMoney(calcResult.internet),

    haoTaiKwh: String(calcResult.haoTaiKwh !== undefined ? calcResult.haoTaiKwh : 0),
    giaHaoTai: formatMoney(calcResult.giaHaoTai),
    tienHaoTai: formatMoney(calcResult.tienHaoTai),

    tongCong: formatMoney(calcResult.tongCong)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatMoney, getNgayThangNam, toReceiptData };
}

if (typeof window !== 'undefined') {
  window.formatMoney = formatMoney;
  window.getNgayThangNam = getNgayThangNam;
  window.toReceiptData = toReceiptData;
}

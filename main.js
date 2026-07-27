/* ============================================================
   MAIN.JS
   - `room`: dữ liệu 1 phòng (sau này thay bằng dữ liệu tính toán thật,
      hoặc gọi renderRoom(data) nhiều lần với data khác nhau)
   - `renderRoom(data)`: đổ dữ liệu vào các thẻ tương ứng trong index.html
   ============================================================ */

const room = {
  dienThoai: "0982 141 407",
  phong: "6B",
  ngay: "01", thang: "07", nam: "2026",

  tienPhong: "2,200,000",

  dienMoi: "13449", dienCu: "13336",
  dienKwh: "113", giaDien: "2.900", tienDien: "328,000",

  nuocMoi: "768", nuocCu: "760",
  nuocKhoi: "8", giaNuoc: "12.000", tienNuoc: "96,000",

  rac: "40,000",
  internet: "24,000",

  haoTaiKwh: "7.9", giaHaoTai: "2.900", tienHaoTai: "23,000",

  noCu: null, // null hoặc "0" thì ẩn dòng nợ cũ, có số thì hiện

  tongCong: "2,711,000"
};

function renderRoom(data) {
  document.getElementById('f-dienThoai').textContent = data.dienThoai;
  document.getElementById('f-phong').textContent = data.phong;
  document.getElementById('f-ngay').textContent = `Ngày ${data.ngay} tháng ${data.thang} năm ${data.nam}`;

  document.getElementById('f-tienPhong').textContent = data.tienPhong;

  document.getElementById('f-dienMoi').textContent = data.dienMoi;
  document.getElementById('f-dienCu').textContent = data.dienCu;
  document.getElementById('f-dienKwh').textContent = data.dienKwh;
  document.getElementById('f-giaDien').textContent = data.giaDien;
  document.getElementById('f-tienDien').textContent = data.tienDien;

  document.getElementById('f-nuocMoi').textContent = data.nuocMoi;
  document.getElementById('f-nuocCu').textContent = data.nuocCu;
  document.getElementById('f-nuocKhoi').textContent = data.nuocKhoi;
  document.getElementById('f-giaNuoc').textContent = data.giaNuoc;
  document.getElementById('f-tienNuoc').textContent = data.tienNuoc;

  document.getElementById('f-rac').textContent = data.rac;
  document.getElementById('f-internet').textContent = data.internet;

  document.getElementById('f-haoTaiKwh').textContent = data.haoTaiKwh;
  document.getElementById('f-giaHaoTai').textContent = data.giaHaoTai;
  document.getElementById('f-tienHaoTai').textContent = data.tienHaoTai;

  const rowNoCu = document.getElementById('row-noCu');
  if (data.noCu && Number(String(data.noCu).replace(/\D/g, '')) > 0) {
    document.getElementById('f-noCu').textContent = data.noCu;
    rowNoCu.style.display = 'flex';
  } else {
    rowNoCu.style.display = 'none';
  }

  document.getElementById('f-tongCong').textContent = data.tongCong;
}

renderRoom(room);
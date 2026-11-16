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

function applyMeterChangeRow(normalRowId, mcRowId, linesContainerId, lines) {
  const normalRow = document.getElementById(normalRowId);
  const mcRow = document.getElementById(mcRowId);
  const container = document.getElementById(linesContainerId);
  const validLines = Array.isArray(lines) ? lines.filter(l => typeof l === 'string' && l.trim() !== '') : [];

  if (validLines.length > 0 && mcRow && container) {
    if (normalRow) normalRow.style.display = 'none';
    mcRow.style.display = 'flex';
    container.innerHTML = '';
    validLines.forEach(line => {
      const item = document.createElement('div');
      item.className = 'mc-line-item';
      item.textContent = line;
      container.appendChild(item);
    });
    return true;
  }

  if (normalRow) normalRow.style.display = 'flex';
  if (mcRow) mcRow.style.display = 'none';
  if (container) container.innerHTML = '';
  return false;
}

/**
 * Thuật toán tự co chữ CHỈ CHO VÙNG GHI CHÚ THAY ĐỒNG HỒ (.mc-lines-box)
 * để đảm bảo nội dung luôn nằm gọn trong 1 trang A4 ngang, không tràn hay mất chữ,
 * đồng thời giữ nguyên 100% font-size của mọi dòng chữ khác trên phiếu thu.
 */
function fitReceiptMeterChangeNotes(hasMcLines) {
  const pageEl = /** @type {HTMLElement | null} */ (document.querySelector('.page'));
  const contentEl = /** @type {HTMLElement | null} */ (document.querySelector('.content'));
  if (!pageEl || !contentEl) return;

  pageEl.style.removeProperty('--row-gap');
  pageEl.style.removeProperty('--mc-note-font-size');
  pageEl.classList.remove('mc-allow-wrap');

  if (!hasMcLines) return;

  const boxes = Array.from(document.querySelectorAll('#row-dien-mc .mc-lines-box, #row-nuoc-mc .mc-lines-box'))
    .filter(box => {
      const row = box.closest('.mc-replace-row');
      return row && window.getComputedStyle(row).display !== 'none' && box.children.length > 0;
    });

  if (boxes.length === 0) return;

  const pageRect = pageEl.getBoundingClientRect();
  const padBottom = parseFloat(window.getComputedStyle(pageEl).paddingBottom) || 0;
  const safeBottom = pageRect.bottom - padBottom + 2;

  const isHorizontallyOverflowing = () => {
    for (const box of boxes) {
      const boxWidth = box.clientWidth;
      if (boxWidth <= 0) continue;
      if (box.scrollWidth > boxWidth + 1) return true;
      const items = Array.from(box.querySelectorAll('.mc-line-item'));
      for (const item of items) {
        if (item.scrollWidth > boxWidth + 1) return true;
      }
    }
    return false;
  };

  const isVerticallyOverflowing = () => {
    const contentRect = contentEl.getBoundingClientRect();
    return contentRect.bottom > safeBottom || pageEl.scrollHeight > pageEl.clientHeight + 2;
  };

  let currentFont = 23;

  // Bước 1: Thu dần --mc-note-font-size theo dòng dài nhất (cả Điện & Nước) sao cho mỗi lần thay luôn nằm gọn trên 1 dòng;
  // mọi dòng ngắn hơn đều dùng chung đúng cỡ chữ này.
  while (isHorizontallyOverflowing() && currentFont > 10.0) {
    currentFont = Math.round((currentFont - 0.5) * 10) / 10;
    pageEl.style.setProperty('--mc-note-font-size', `${currentFont}px`);
  }

  // Bước 2: Nếu tràn chiều cao trang A4 -> ưu tiên thu nhẹ khoảng cách dòng (--row-gap) để giữ chữ to nhất
  let currentGap = 30;
  while (isVerticallyOverflowing() && currentGap > 14) {
    currentGap -= 1;
    pageEl.style.setProperty('--row-gap', `${currentGap}px`);
  }

  // Bước 3: Nếu nhiều lần quá vẫn tràn dọc mới giảm thêm --mc-note-font-size xuống tối thiểu 10px
  while (isVerticallyOverflowing() && currentFont > 10.0) {
    currentFont = Math.round((currentFont - 0.5) * 10) / 10;
    pageEl.style.setProperty('--mc-note-font-size', `${currentFont}px`);
  }

  // Bước 4 (phòng hờ chuỗi quá dài): chỉ bật wrap nếu ở 10px vẫn tràn ngang, rồi nén nhẹ gap
  if (isHorizontallyOverflowing()) {
    pageEl.classList.add('mc-allow-wrap');
  }
  while (isVerticallyOverflowing() && currentGap > 8) {
    currentGap -= 1;
    pageEl.style.setProperty('--row-gap', `${currentGap}px`);
  }
}

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

  const hasDienMc = applyMeterChangeRow('row-dien-normal', 'row-dien-mc', 'f-dien-mc-lines', data.dienMcLines);
  const hasNuocMc = applyMeterChangeRow('row-nuoc-normal', 'row-nuoc-mc', 'f-nuoc-mc-lines', data.nuocMcLines);

  const rowNoCu = document.getElementById('row-noCu');
  if (data.noCu && Number(String(data.noCu).replace(/\D/g, '')) > 0) {
    document.getElementById('f-noCu').textContent = data.noCu;
    rowNoCu.style.display = 'flex';
  } else {
    rowNoCu.style.display = 'none';
  }

  document.getElementById('f-tongCong').textContent = data.tongCong;

  fitReceiptMeterChangeNotes(hasDienMc || hasNuocMc);
}

renderRoom(room);
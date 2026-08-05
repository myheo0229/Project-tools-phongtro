# Prompt: Tối ưu khởi động app + sửa logic dropdown Tháng/Năm

## Bối cảnh
Đã rà lại toàn bộ quy trình khởi động (`electron/main.js`, `preload.js`,
`src/input/renderer.js`) và chốt 3 việc cần sửa dưới đây. **2 vấn đề KHÔNG cần sửa, giữ
nguyên không đụng tới:**
- Font Inter qua Google Fonts CDN — có sẵn fallback `system-ui, -apple-system, sans-serif`
  nên không cần tải font cục bộ.
- Hàm xử lý đổi tháng — đã xác nhận KHÔNG load lại Cài Đặt Chung mỗi lần đổi tháng, đúng
  như mong muốn, không cần sửa.

## KHÔNG được sửa
- `src/shared/calc.js`, nội dung `src/receipt` — không đụng.
- Toàn bộ logic tính tiền, IPC lưu/đọc dữ liệu tháng, IPC settings/folder đã có — chỉ sửa
  đúng 3 phần mô tả bên dưới.

---

## VIỆC 1 — Preload ẩn `pdf-lib` trong lúc người dùng đang thao tác, không chặn lúc khởi động

**Mục tiêu:** KHÔNG `require('pdf-lib')` ngay khi `main.js` khởi động (tốn thời gian mở
app), nhưng cũng KHÔNG đợi tới lúc bấm "Lưu & Xuất" mới bắt đầu nạp (tốn thời gian ngay
lúc xuất). Thay vào đó: nạp NGẦM trong lúc người dùng đã thấy giao diện và đang thao tác
(nhập liệu, xem cài đặt...), đảm bảo lúc thực sự bấm "Lưu & Xuất" thì `pdf-lib` gần như
chắc chắn đã sẵn sàng.

### Cách làm
Trong `electron/main.js`:

```js
let pdfLibModule = null; // cache module sau khi nạp xong

// Nạp NGẦM, không chặn luồng chính — gọi ngay sau khi cửa sổ chính đã hiện ra
// (đặt trong sự kiện 'ready-to-show' hoặc ngay sau mainWindow.show(), xem VIỆC 3)
function preloadPdfLibInBackground() {
  setTimeout(() => {
    try {
      pdfLibModule = require('pdf-lib');
    } catch (err) {
      console.error('Preload pdf-lib thất bại (không sao, sẽ thử lại lúc xuất):', err);
    }
  }, 1500); // trễ 1.5s sau khi cửa sổ hiện, tránh giành tài nguyên với lúc app đang khởi động
}

// Hàm AN TOÀN dùng trong handler xuất — nếu preload ngầm chưa kịp xong (trường hợp bấm
// xuất rất nhanh) thì nạp luôn tại chỗ, ĐẢM BẢO 100% có pdf-lib trước khi xuất, không bao
// giờ xuất thất bại vì thiếu thư viện.
function getPdfLib() {
  if (!pdfLibModule) {
    pdfLibModule = require('pdf-lib'); // Node.js tự cache, gọi lại không tốn thêm chi phí
  }
  return pdfLibModule;
}
```

Trong handler `export:receipts` (chỗ đang dùng `PDFDocument` từ `pdf-lib`): đổi từ dùng
biến `require('pdf-lib')` ở đầu file sang gọi `const { PDFDocument } = getPdfLib();` ngay
tại đầu hàm xử lý export.

Gọi `preloadPdfLibInBackground()` 1 lần duy nhất, đúng vị trí mô tả ở VIỆC 3 bên dưới.

---

## VIỆC 2 — Sửa dropdown Tháng/Năm: giới hạn theo DỮ LIỆU ĐÃ HOÀN THÀNH, không theo ngày hệ thống

**Bỏ hoàn toàn** cách tính `max` cũ (hiện đang sai, liệt kê cứng tới 12/2056). Thay bằng
logic mới: `max` tự động là **tháng kế tiếp ngay sau tháng gần nhất đã nhập đủ dữ liệu cả
12 phòng** — không liên quan gì tới ngày giờ hệ thống thật.

### Định nghĩa "1 tháng đã đủ dữ liệu"
1 tháng được coi là ĐỦ khi file `history/YYYY-MM.json` tồn tại VÀ có đủ 12 phòng, mỗi
phòng đều đã có cả `dienMoi` LẪN `nuocMoi` (không rỗng) — đúng tiêu chí "đã nhập" đã áp
dụng ở phần tính điện/nước độc lập trước đó.

### Cách tính `max`
```js
const MIN_MONTH = '2026-07'; // giữ nguyên mốc cố định đã chốt từ trước

function isMonthFullyComplete(monthData) {
  if (!monthData || !Array.isArray(monthData.rooms) || monthData.rooms.length !== 12) {
    return false;
  }
  return monthData.rooms.every(r => r.dienMoi != null && r.nuocMoi != null && r.dienMoi !== '' && r.nuocMoi !== '');
}

function nextMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1); // m (0-11 sau khi -1) tự động qua năm mới khi cần
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function computeMaxSelectableMonth() {
  let month = MIN_MONTH;
  while (isMonthFullyComplete(await loadMonthDataInternal(month))) {
    month = nextMonthKey(month);
  }
  return month; // tháng đầu tiên CHƯA hoàn thành = tháng mới nhất được phép chọn
}
```

- `min` dropdown vẫn giữ cố định `2026-07` như đã chốt, không đổi.
- `max` gọi hàm `computeMaxSelectableMonth()` ở trên để tính, KHÔNG dùng `new Date()` của
  hệ thống nữa.
- **Tính lại `max` ở 2 thời điểm:** (1) lúc app khởi động (populate dropdown lần đầu), và
  (2) ngay sau mỗi lần "Lưu & Xuất" thành công — vì hành động đó có thể vừa làm tháng hiện
  tại trở nên "đủ dữ liệu", cần mở thêm 1 tháng mới vào dropdown ngay lập tức, không cần
  khởi động lại app mới thấy.

---

## VIỆC 3 — Chỉ hiện cửa sổ sau khi render xong, tránh giật/trắng màn hình

Trong `electron/main.js`, khi tạo `BrowserWindow`:

```js
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  show: false, // KHÔNG hiện ngay
  // ... giữ nguyên các option khác (icon, webPreferences...)
});

mainWindow.once('ready-to-show', () => {
  mainWindow.show();
  preloadPdfLibInBackground(); // gọi đúng ở đây, SAU KHI cửa sổ đã hiện cho người dùng thấy
});

mainWindow.loadFile('src/input/index.html');
```

---

## Kết quả mong đợi
- Cửa sổ hiện ra mượt, không còn khoảng trắng/giật trước khi render xong.
- `pdf-lib` được nạp ngầm trong lúc người dùng đang thao tác, không làm chậm lúc mở app,
  và KHÔNG BAO GIỜ làm lỗi bước xuất dù bấm xuất rất nhanh ngay sau khi mở app.
- Dropdown Tháng/Năm mở rộng dần theo đúng tiến độ nhập liệu thực tế (đủ 12 phòng 1 tháng
  mới mở tháng tiếp theo), không phụ thuộc ngày giờ máy tính, không còn liệt kê sai tới
  tận 2056.

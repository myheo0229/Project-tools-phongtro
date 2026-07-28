# Prompt: Fix giao diện chọn Tháng/Năm + lỗi dữ liệu ngày tháng & định dạng tiền

## Phạm vi prompt này
Chỉ sửa 2 nhóm lỗi bên dưới. **KHÔNG đụng tới việc xuất ảnh JPG bị lệch/dính scrollbar**
— vấn đề đó để bàn riêng sau, chưa đưa vào prompt này.

## KHÔNG được sửa
- `src/shared/calc.js` — giữ nguyên logic tính tiền, không đụng.
- Nội dung HTML/CSS/JS bên trong `src/receipt` (kể cả `main.js` của receipt) — file này
  chỉ nhận dữ liệu qua `renderRoom(data)`, không được sửa cách nó nhận/hiển thị dữ liệu.
  Toàn bộ việc sửa lỗi bên dưới đều nằm ở **chỗ chuẩn bị dữ liệu trước khi gọi
  `renderRoom(data)`**, không phải trong bản thân `src/receipt`.

---

## VẤN ĐỀ 1 — Giao diện chọn Tháng/Năm: đổi từ ô chọn đơn sang danh sách (dropdown)

**Hiện tại:** đang dùng 1 ô chọn kiểu lịch đơn (VD `<input type="month">`), chỉ hiện được
đúng 1 giá trị, không thấy được các tháng khác để chọn nhanh.

**Cần đổi thành:** 1 `<select>` (dropdown) liệt kê sẵn toàn bộ các tháng hợp lệ, người
dùng bấm mở ra là thấy hết danh sách, chọn thẳng, không cần gõ/lịch.

**Cách tạo danh sách option:**
- Danh sách chạy từ `2026-07` (mốc cố định, đã chốt trước đó) đến **tháng hiện tại của hệ
  thống** (tính động bằng `new Date()` mỗi lần mở app — giữ nguyên logic giới hạn min/max
  đã có, chỉ đổi loại control hiển thị).
- Mỗi option: `value="2026-07"`, nội dung hiển thị dạng `Tháng 07/2026`.
- Sắp xếp theo thứ tự thời gian (từ cũ đến mới, hoặc mới đến cũ đều được — ưu tiên **mới
  nhất lên đầu danh sách** để đỡ phải cuộn xuống mỗi lần vào app, vì tháng mới nhất là
  tháng hay dùng nhất).
- Toàn bộ logic khóa cột Điện cũ/Nước cũ theo tháng đã chọn (đã code ở prompt trước) giữ
  nguyên, chỉ đổi cách người dùng chọn tháng (từ input lịch sang dropdown), sự kiện
  `onChange` vẫn trigger y như cũ.

---

## VẤN ĐỀ 2 — Dữ liệu ngày/tháng/năm bị `undefined`, số tiền không có dấu phân cách

**Xem ảnh đính kèm (Phong-1A.jpg) để thấy rõ lỗi:**
- Dòng ngày tháng hiện `Ngày undefined tháng undefined năm undefined` — vì khi gọi
  `renderRoom(data)`, object `data` KHÔNG có field `ngay`/`thang`/`nam` (bản thân
  `calc.js` không hề tính/trả về 3 field này — đây là điều đúng theo thiết kế ban đầu, chỉ
  là bước "chuẩn bị dữ liệu trước khi gọi renderRoom" đang thiếu, chưa tự thêm 3 field
  này vào).
- Toàn bộ số tiền hiển thị dính liền không dấu phân cách (`2200000` thay vì `2.200.000`) —
  vì `calc.js` trả về number thô (đúng thiết kế), nhưng bước chuẩn bị dữ liệu trước khi gọi
  `renderRoom` chưa format lại các số này thành chuỗi có dấu chấm trước khi gán vào `data`.
- Lỗi này ảnh hưởng **cả 3 nơi cùng lúc**: màn hình xem trước, ảnh JPG xuất ra, và PDF xuất
  ra — vì cả 3 đều dùng chung `renderRoom(data)` của `src/receipt`. Sửa đúng 1 chỗ (nơi
  chuẩn bị `data`) là tự động hết lỗi ở cả 3 nơi, không cần sửa riêng từng nơi.

### Cách sửa — tạo 1 hàm "chuẩn bị dữ liệu" dùng chung

Tạo file mới `src/shared/format.js` (không đụng `calc.js`, không đụng `src/receipt`),
export các hàm:

```js
// Định dạng số tiền theo kiểu Việt Nam: dấu CHẤM ngăn cách hàng nghìn, không có phần thập phân.
// VD: formatMoney(2200000) -> "2.200.000"
function formatMoney(number) {
  return Math.round(number).toLocaleString('vi-VN');
}

// Từ monthKey dạng "YYYY-MM" (VD "2026-07") suy ra ngày/tháng/năm để hiển thị trên phiếu.
// Ngày LUÔN cố định là "01" (không lấy theo ngày thực tế lúc bấm xuất).
// Tháng/Năm lấy đúng theo tháng đang được xử lý (monthKey), KHÔNG lấy theo ngày giờ hệ
// thống lúc chạy.
function getNgayThangNam(monthKey) {
  const [nam, thang] = monthKey.split('-');
  return { ngay: '01', thang, nam };
}

// Gộp kết quả calcRoom() (từ calc.js) + ngày tháng + định dạng tiền, ra đúng shape mà
// renderRoom(data) của src/receipt đang cần.
function toReceiptData(calcResult, monthKey, dienThoai) {
  const { ngay, thang, nam } = getNgayThangNam(monthKey);
  return {
    dienThoai: dienThoai,
    phong: calcResult.phong,
    ngay, thang, nam,

    tienPhong: formatMoney(calcResult.tienPhong),

    dienMoi: String(calcResult.dienMoi),
    dienCu: String(calcResult.dienCu),
    dienKwh: String(calcResult.dienKwh),
    giaDien: formatMoney(calcResult.giaDien),
    tienDien: formatMoney(calcResult.tienDien),

    nuocMoi: String(calcResult.nuocMoi),
    nuocCu: String(calcResult.nuocCu),
    nuocKhoi: String(calcResult.nuocKhoi),
    giaNuoc: formatMoney(calcResult.giaNuoc),
    tienNuoc: formatMoney(calcResult.tienNuoc),

    rac: formatMoney(calcResult.rac),
    internet: formatMoney(calcResult.internet),

    haoTaiKwh: String(calcResult.haoTaiKwh), // số thập phân (VD "5.4"), KHÔNG format tiền
    giaHaoTai: formatMoney(calcResult.giaHaoTai),
    tienHaoTai: formatMoney(calcResult.tienHaoTai),

    tongCong: formatMoney(calcResult.tongCong),
  };
}

module.exports = { formatMoney, getNgayThangNam, toReceiptData };
```

**Lưu ý quan trọng khi áp dụng:**
- Các trường là **chỉ số đồng hồ / số lượng tiêu thụ** (`dienMoi`, `dienCu`, `dienKwh`,
  `nuocMoi`, `nuocCu`, `nuocKhoi`, `haoTaiKwh`) **KHÔNG được format dấu chấm** — chỉ các
  trường **số tiền** (`tienPhong`, `giaDien`, `tienDien`, `giaNuoc`, `tienNuoc`, `rac`,
  `internet`, `giaHaoTai`, `tienHaoTai`, `tongCong`) mới format bằng `formatMoney()`.
- Ở TẤT CẢ những chỗ trong code hiện tại đang gọi `renderRoom(...)` trực tiếp bằng kết quả
  thô của `calcRoom()` (màn xem trước, vòng lặp xuất JPG, vòng lặp xuất PDF) — đổi lại
  thành gọi `renderRoom(toReceiptData(calcResult, monthKey, dienThoai))` thay vì truyền
  thẳng `calcResult`.
- `dienThoai` lấy từ `settings.json` — nếu `settings.json` hiện chưa có field này, thêm
  field `dienThoai` vào Cài đặt chung (mặc định `"0982 141 407"`, cho sửa được), lưu/đọc
  bằng đúng cơ chế IPC `settings:save`/`settings:load` đã có sẵn.

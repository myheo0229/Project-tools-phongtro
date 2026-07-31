# Prompt: Fix 4 vấn đề (giao diện nhập liệu + định dạng số thập phân)

## KHÔNG được sửa
- `src/shared/calc.js` — không đụng công thức tính tiền.
- Bất kỳ file nào trong `src/receipt` — không sửa gì trong đó.
- `src/input` được phép sửa bình thường (chưa từng bị khoá như `src/receipt`).

---

## VẤN ĐỀ 1 — Width ô "Số phòng" trong bảng nhập liệu không đều nhau

Các ô hiển thị số phòng (badge nền đen, chữ trắng, VD `1A`, `2A`...) hiện đang co giãn
theo độ dài chữ, nhìn lệch hàng không đều.

**Cách fix:** đặt cố định `width: 48px` (hoặc `min-width: 48px` + `text-align: center` nếu
class hiện tại dùng `display: inline-block`/`flex`) cho class đang style badge số phòng
này. Giữ nguyên toàn bộ style khác (màu nền, bo góc, cỡ chữ...), chỉ thêm width cố định.

---

## VẤN ĐỀ 2 — Hiển thị version app ở góc phải trên

Thêm 1 dòng chữ nhỏ, màu xám nhạt, dạng `v1.0.0`, đặt ở góc phải trên của khu vực nội
dung app (cạnh chỗ chọn "Tháng/Năm" và nút "Lưu & Xuất").

**Lấy version từ đâu:** dùng đúng field `"version"` trong `package.json` — KHÔNG hardcode
số version trong code JS. Cách lấy:

1. `electron/main.js`: thêm handler
   ```js
   ipcMain.handle('app:get-version', () => app.getVersion());
   ```
   (`app.getVersion()` là API có sẵn của Electron, tự động đọc đúng field `version` trong
   `package.json` của app.)
2. `electron/preload.js`: thêm vào `window.api`:
   ```js
   getAppVersion: () => ipcRenderer.invoke('app:get-version'),
   ```
3. `src/input/renderer.js`: lúc app khởi động, gọi `window.api.getAppVersion()`, hiển thị
   kết quả (thêm chữ `v` phía trước) vào phần tử version ở góc phải trên.

---

## VẤN ĐỀ 3 (QUAN TRỌNG NHẤT) — Đang tự tính toán dù chưa nhập số liệu tháng mới

**Hiện tượng:** khi sang tháng mới, ô "ĐIỆN MỚI"/"NƯỚC MỚI" đang mặc định hiển thị `0`
(thay vì để trống) — hệ thống coi `0` là 1 giá trị hợp lệ đã nhập, nên tự động chạy
`calcRoom()` ngay cả khi người dùng CHƯA nhập gì, ra các số vô nghĩa (âm rất lớn, do công
thức trừ số cũ cho `0` hoặc rơi vào nhánh xử lý quay vòng công tơ).

**Yêu cầu sửa — theo đúng 3 phần:**

### 3a. Đổi giá trị mặc định của ô nhập
Ô "ĐIỆN MỚI" và "NƯỚC MỚI" mặc định phải là **RỖNG** (không phải số `0`), có thể thêm
placeholder mờ kiểu "Nhập số mới" cho dễ nhìn. Không tự điền sẵn `0`.

### 3b. Tính điện và nước ĐỘC LẬP với nhau — không cần chờ nhập đủ cả 2
Với từng dòng (phòng) trong bảng, điện và nước tính riêng, không phụ thuộc nhau:
- **Đã nhập `dienMoi`** (không rỗng) → tính ngay: `SỐ ĐIỆN TT`, `TIỀN ĐIỆN`,
  `ĐIỆN HAO TẢI`, `TIỀN HAO TẢI`. Chưa nhập `dienMoi` → 4 cột này hiện `"-"`.
- **Đã nhập `nuocMoi`** (không rỗng) → tính ngay: `SỐ NƯỚC TT`, `TIỀN NƯỚC`. Chưa nhập
  `nuocMoi` → 2 cột này hiện `"-"`.
- **`TỔNG CỘNG`** là tổng gộp của cả điện lẫn nước (`tienDien + tienNuoc + tienDienHaoTai
  + tienPhong + tienRac + tienInternet`) nên CHỈ tính khi ĐÃ CÓ ĐỦ CẢ 2 (`dienMoi` VÀ
  `nuocMoi` đều không rỗng) — nếu chỉ mới nhập 1 trong 2, `TỔNG CỘNG` vẫn hiện `"-"` (tránh
  hiển thị 1 con số tổng bị thiếu, dễ gây hiểu lầm là số tiền thật phải thu).
- Không sửa `calc.js`: khi 1 trong 2 ô (`dienMoi`/`nuocMoi`) chưa nhập, vẫn gọi
  `calcRoom()` bình thường nhưng **tạm thay giá trị của ô chưa nhập bằng đúng số cũ**
  (VD chưa nhập `nuocMoi` thì truyền `nuocMoi = nuocCu` khi gọi `calcRoom()`, ra
  `nuocTieuThu = 0`, `tienNuoc = 0`) — chỉ dùng kết quả của phần ĐÃ nhập thật để hiển thị
  (VD vẫn hiện đúng `TIỀN ĐIỆN` tính từ `dienMoi` thật), còn cột của phần chưa nhập thì
  hiển thị `"-"` (bỏ qua giá trị `0` giả lập đó, không hiện ra màn hình), và `TỔNG CỘNG`
  cũng ẩn theo quy tắc ở trên. Cách này giữ nguyên `calc.js`, chỉ xử lý ở tầng hiển thị.
- Việc kiểm tra "rỗng hay không" thực hiện lại mỗi lần người dùng gõ (`onInput`/
  `onChange`), cập nhật lại dòng đó ngay lập tức — không cần bấm gì thêm, không cần chờ
  nhập đủ cả điện lẫn nước mới thấy kết quả từng phần.

### 3c. Sửa lại các ô tổng hợp (card phía trên + dòng "DOANH THU THÁNG" cuối bảng)
Các số tổng hợp hiện tại đang cộng luôn cả những phòng chưa nhập (vì đang coi `0` là dữ
liệu hợp lệ) — cần sửa để chỉ cộng dữ liệu THẬT SỰ đã có, theo đúng logic độc lập điện/
nước ở mục 3b:
- `Tổng Điện Tiêu Thụ` → chỉ cộng `dienKwh` của các phòng ĐÃ nhập `dienMoi` (bỏ qua phòng
  chưa nhập điện, không tính là `0`).
- `Tổng Nước Tiêu Thụ` → chỉ cộng `nuocKhoi` của các phòng ĐÃ nhập `nuocMoi` (bỏ qua phòng
  chưa nhập nước, không tính là `0`).
- `Doanh Thu Tháng này` (và dòng `DOANH THU THÁNG` cuối bảng) → chỉ cộng `TỔNG CỘNG` của
  các phòng ĐÃ có đủ cả điện lẫn nước (đúng theo điều kiện `TỔNG CỘNG` ở mục 3b), bỏ qua
  phòng chỉ mới nhập 1 trong 2 hoặc chưa nhập gì.
- `Số Phòng Hoạt Động` → đổi ý nghĩa thành **số phòng đã có đủ cả điện lẫn nước / tổng số
  phòng** (VD nếu mới có 3/12 phòng đủ cả điện lẫn nước thì hiển thị `3 / 12`), không phải
  luôn cố định `12/12`.

---

## VẤN ĐỀ 4 — Số thập phân "Điện hao tải" đang dùng dấu chấm, cần đổi sang dấu phẩy

**Hiện tượng:** trên phiếu thu, dòng "Tiền điện hao tải" hiện `= 5.4 x 2.900đ` — số `5.4`
dùng dấu CHẤM ngăn phần thập phân, sai chuẩn Việt Nam (phải là dấu PHẨY: `5,4`).

**Nguyên nhân:** trong `src/shared/format.js`, hàm `toReceiptData()` đang gán
`haoTaiKwh: String(calcResult.haoTaiKwh)` — `String()` của JavaScript luôn ra dấu chấm
mặc định (`"5.4"`), không tự đổi sang chuẩn Việt Nam.

**Cách fix:** thêm 1 hàm mới trong `src/shared/format.js`:
```js
// Định dạng số thập phân kiểu Việt Nam: dấu PHẨY ngăn phần thập phân, luôn đúng 1 chữ số
// sau dấu phẩy. VD: formatDecimalVN(5.4) -> "5,4", formatDecimalVN(5) -> "5,0"
function formatDecimalVN(number) {
  return number.toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
```
Rồi export thêm hàm này (`module.exports = { ..., formatDecimalVN }`), và trong
`toReceiptData()`, đổi dòng:
```js
haoTaiKwh: String(calcResult.haoTaiKwh),
```
thành:
```js
haoTaiKwh: formatDecimalVN(calcResult.haoTaiKwh),
```

**Lưu ý phạm vi:** CHỈ áp dụng `formatDecimalVN` cho `haoTaiKwh` — đây là số thập phân
duy nhất trong toàn bộ phiếu thu. Các trường chỉ số khác (`dienMoi`, `dienCu`, `dienKwh`,
`nuocMoi`, `nuocCu`, `nuocKhoi`) đều là số nguyên, GIỮ NGUYÊN dùng `String(...)`, không
đổi gì ở các trường đó. Không đụng `src/receipt`.

---

## Kết quả mong đợi sau khi fix
- Bảng nhập liệu: các ô số phòng đều nhau, có hiển thị version góc phải trên.
- Tháng mới chưa nhập gì → toàn bộ cột tính toán hiện `-`, không còn số âm vô lý.
- Nhập điện thì tính ngay điện tiêu thụ + tiền điện + điện hao tải + tiền hao tải; nhập
  nước thì tính ngay nước tiêu thụ + tiền nước — độc lập nhau, không cần bấm gì thêm.
- `TỔNG CỘNG` của 1 phòng chỉ hiện khi phòng đó đã có ĐỦ cả điện lẫn nước.
- Các ô tổng hợp (doanh thu, điện/nước tiêu thụ, số phòng hoạt động) phản ánh đúng số
  phòng đã thực sự có dữ liệu, không cộng nhầm phòng trống hoặc phòng nhập thiếu.
- Phiếu thu hiển thị đúng `5,4` (dấu phẩy) thay vì `5.4` (dấu chấm) ở dòng điện hao tải.

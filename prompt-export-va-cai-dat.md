# Prompt: Giới hạn tháng, Cài đặt thư mục lưu, Xuất ảnh JPG + PDF

## Bối cảnh — các phần ĐÃ XONG, KHÔNG được đụng vào
- `src/shared/calc.js` — logic tính tiền, đã hoàn thành, không sửa.
- `src/receipt/*` (index.html, style.css, reset.css, main.js) — UI phiếu thu đã hoàn thiện
  100% theo ý người dùng, có sẵn hàm `renderRoom(data)` nhận object dữ liệu và đổ vào các
  `<span id="f-...">` tương ứng. `.page` có kích thước cố định 1123×794px (landscape).
  TUYỆT ĐỐI không sửa nội dung HTML/CSS/JS bên trong `src/receipt` — chỉ được GỌI
  `renderRoom(data)` từ bên ngoài.
- `src/input/*` — UI nhập liệu đã có giao diện, đã có tính năng khóa cột Điện cũ/Nước cũ
  theo tháng trước, và đã lưu/đọc dữ liệu tháng qua IPC (`month-data:save`, `month-data:load`).

---

## VIỆC 1 — Giới hạn ô chọn Tháng/Năm (trong `src/input`)
- `min` = cố định `2026-07` (tháng đầu tiên có dữ liệu, không đổi).
- `max` = tháng hiện tại của hệ thống, **tính động** mỗi lần mở app bằng `new Date()`
  (KHÔNG hardcode 1 con số cố định như hiện tại — đây chính là lỗi cần sửa).
- Không cho chọn tháng nằm ngoài khoảng `[min, max]`.

---

## VIỆC 2 — Cài đặt chung: thêm chọn thư mục lưu (Browse)
- Thêm 1 trường trong màn Cài đặt chung: **"Thư mục lưu ảnh/PDF"**, kèm nút **Browse**.
- Bấm Browse → gọi IPC tới main process, dùng
  `dialog.showOpenDialog({ properties: ['openDirectory'] })` để mở hộp thoại chọn thư mục
  thật của Windows.
- Đường dẫn chọn được lưu vào `data/settings.json` (thêm field `baseFolder`).
- Nếu người dùng bấm nút "Xuất" (Việc 3+4) mà **chưa từng chọn thư mục** → hiện thông báo
  yêu cầu vào Cài đặt chọn thư mục trước, KHÔNG cho xuất.

### IPC cần thêm
**preload.js** (bổ sung vào `window.api` đã có sẵn):
```js
pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
saveSettings: (data) => ipcRenderer.invoke('settings:save', data),
loadSettings: () => ipcRenderer.invoke('settings:load'),
```

**main.js**:
- `ipcMain.handle('dialog:pick-folder', ...)` → mở `dialog.showOpenDialog`, trả về path đã
  chọn, hoặc `null` nếu người dùng bấm Cancel.
- `ipcMain.handle('settings:save', (event, data) => ...)` → ghi `data` ra
  `data/settings.json` (dùng cùng kiểu try/catch + tạo thư mục nếu chưa có, giống cách đã
  làm với `month-data:save`).
- `ipcMain.handle('settings:load', ...)` → đọc `data/settings.json`, trả về `null` nếu
  chưa tồn tại (chưa cấu hình lần nào).

---

## VIỆC 3 & 4 — Xuất ảnh JPG (đủ 12 file, 1 file/phòng) và PDF (1 file gộp) mỗi tháng

### Nguyên lý chung
- Electron mở 1 `BrowserWindow` **ẩn** (`show: false, width: 1123, height: 794`), load
  `src/receipt/index.html`.
- Đợi sự kiện `did-finish-load`, sau đó với **từng phòng trong 12 phòng**:
  1. Gọi `renderRoom(data)` (hàm có sẵn) qua `webContents.executeJavaScript(...)` để bơm
     dữ liệu phòng đó vào trang đang mở.
  2. Đợi thêm ~150ms để chắc chắn DOM/layout đã cập nhật xong trước khi chụp/xuất.
  3. Dùng `webContents.capturePage()` (trả về 1 `NativeImage`), sau đó gọi
     `.toJPEG(90)` (không dùng `.toPNG()`) để lấy buffer JPG, lưu file:
     `Phong-<tên phòng>.jpg`. Xuất **đủ 12 file JPG, mỗi phòng 1 file**, không gộp
     nhiều phòng vào 1 ảnh.
  4. Dùng `webContents.printToPDF()` → giữ lại buffer PDF 1 trang của phòng đó (chưa lưu
     file ngay, để gộp ở bước sau).
- Sau khi xử lý xong cả 12 phòng: **gộp 12 buffer PDF 1 trang** thành 1 file PDF nhiều
  trang, dùng thư viện `pdf-lib` (đọc từng PDF, copy trang vào 1 file PDF tổng). Lý do phải
  gộp: `printToPDF()` chỉ xuất đúng nội dung đang hiển thị tại thời điểm gọi, tức mỗi lần
  gọi chỉ ra 1 trang tương ứng với dữ liệu đang render lúc đó.
- Cài thêm thư viện: `npm install pdf-lib`

### Thứ tự thực hiện khi bấm nút "Lưu & Xuất"
0. **GỘP CHUNG 1 NÚT DUY NHẤT** (sửa lại so với bản trước) — không còn tách riêng
   "Lưu dữ liệu" và "Xuất ảnh & PDF" nữa. Bấm 1 nút là chạy tuần tự: lưu dữ liệu
   tháng đó (`month-data:save`, cơ chế đã có sẵn) → xong mới chạy tiếp các bước xuất
   ảnh/PDF bên dưới. Nếu bước lưu dữ liệu lỗi thì dừng lại luôn, không chạy xuất ảnh/PDF.
1. Kiểm tra `settings.baseFolder` đã có chưa (Việc 2) → chưa có thì báo lỗi, dừng lại.
2. Tính đường dẫn thư mục tháng: `<baseFolder>/PhieuThu/Thang_<MM>_<YYYY>/`
   (chuyển đổi từ `monthKey` dạng `YYYY-MM` đã dùng ở nơi khác sang định dạng thư mục này).
3. Kiểm tra thư mục đó đã có sẵn file ảnh/PDF của tháng này chưa (`fs.existsSync`). Nếu có
   ít nhất 1 file trùng → hỏi xác nhận **1 lần duy nhất**
   (`dialog.showMessageBox` loại yes/no: "Đã có dữ liệu xuất của tháng này, ghi đè toàn
   bộ?"). Chọn Không → dừng lại, không xuất gì cả.
4. Tạo thư mục nếu chưa có (`fs.mkdirSync` với `recursive: true`).
5. Mở cửa sổ ẩn (nếu chưa mở) như mô tả ở trên.
6. Lặp qua 12 phòng theo đúng thứ tự mô tả ở "Nguyên lý chung". Sau mỗi phòng xử lý xong,
   gửi tiến trình về renderer qua IPC (kênh `export:progress`, kèm số thứ tự hiện tại, VD
   `{ current: 3, total: 12 }`) để giao diện cập nhật.
7. Gộp 12 PDF 1 trang thành 1 file `Thang_<MM>_<YYYY>.pdf`, lưu vào cùng thư mục với ảnh.
8. Đóng cửa sổ ẩn.
9. Dùng `shell.openPath()` mở thư mục vừa xuất ra cho người dùng xem ngay.
10. Gửi thông báo hoàn tất về renderer (VD "Đã lưu và xuất xong 12 ảnh JPG + 1 PDF").

### UI nhập liệu (`src/input`) cần thêm
- CHỈ 1 nút duy nhất, đặt tên ví dụ **"Lưu & Xuất"** (thay cho 2 nút riêng "Lưu dữ liệu" và
  "Xuất ảnh & PDF" trước đây — nay gộp làm một, xem bước 0 ở trên).
- Trong lúc xử lý: disable nút này (tránh bấm 2 lần), hiển thị tiến trình dạng text đơn giản
  cập nhật theo `export:progress`, VD: `Đang xuất... 3/12`.
- Khi xong: hiện dòng "Đã lưu và xuất xong", bật lại nút, thư mục đã tự mở sẵn (main lo việc
  mở, renderer không cần làm gì thêm).

---

## Phạm vi — KHÔNG LÀM
- Không sửa `calc.js`.
- Không sửa nội dung bên trong `src/receipt` (chỉ gọi `renderRoom` từ ngoài vào).
- Không tự động gửi Zalo (chưa tới bước này).
- Không thêm chức năng chỉnh sửa lại ảnh/PDF sau khi đã xuất.

## Quy ước đặt tên (giữ đúng, không tự đổi)
- Tên file ảnh: `Phong-<tên phòng>.jpg` (VD `Phong-1A.jpg`, `Phong-6B.jpg`) — đủ 12 file,
  mỗi phòng đúng 1 file.
- Tên file PDF: `Thang_<MM>_<YYYY>.pdf` (VD `Thang_07_2026.pdf`)
- Tên thư mục tháng: `Thang_<MM>_<YYYY>` (VD `Thang_07_2026`)

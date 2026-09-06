---
name: phong-tro-conventions
description: Quy ước code và kiến trúc cho project quản lý phòng trọ — đọc trước khi thêm/sửa tính năng cho project này
---

# Quy Ước Code & Kiến Trúc Dự Án Quản Lý Phòng Trọ

Tài liệu này ghi lại toàn bộ quy ước, kiến trúc, luồng dữ liệu và các điều cấm kỵ được rút ra từ mã nguồn thực tế của dự án. Mọi AI Agent hoặc lập trình viên khi tiếp nhận task cần đọc và tuân thủ nghiêm ngặt các quy tắc dưới đây.

---

## 1. Tech Stack & Ràng Buộc Công Nghệ

- **Nền tảng chính**: Electron (v43.2.0), Electron Builder (v25.1.8), Electron Updater (v6.8.9), PDF-Lib (v1.17.1), PDF.js Dist (v3.11.174).
- **Phân tách các tiến trình (Process Architecture)**:
  - **Main Process (`electron/main.js`)**: Entry point quản lý vòng đời ứng dụng, tạo cửa sổ `BrowserWindow`, đăng ký tất cả các `ipcMain.handle`, tích hợp `autoUpdater`, xuất PDF/JPG chạy ngầm bằng `printToPDF` và `rasterizer.html`.
  - **Preload Script (`electron/preload.js`)**: Cầu nối bảo mật qua `contextBridge.exposeInMainWorld('api', {...})`. Bắt buộc duy trì cấu hình an toàn: `contextIsolation: true`, `nodeIntegration: false`.
  - **Renderer Process (`src/input/`)**: Màn hình nhập liệu chính gồm `index.html`, `renderer.js` và `style.css`.
  - **Receipt Template (`src/receipt/`)**: Template phiếu thu (cửa sổ ẩn dùng để kết xuất dữ liệu sang ảnh/PDF) gồm `index.html`, `main.js`, `style.css`, `reset.css`.
  - **Rasterizer (`electron/rasterizer.html`)**: Cửa sổ ngầm chuyển đổi trang PDF sang buffer JPG chất lượng cao (3x scale) thông qua thư viện `pdfjs-dist`.
- **Ràng buộc công nghệ bắt buộc**:
  - **100% HTML/CSS/JavaScript thuần (Vanilla)**: KHÔNG sử dụng bất kỳ framework giao diện nào (như React, Vue, Angular, Svelte, TailwindCSS, Bootstrap, jQuery...) trừ khi có yêu cầu bằng văn bản rõ ràng từ người dùng.
  - **JavaScript thuần (ES6+)**: KHÔNG tự ý đưa TypeScript, JSX, hoặc thiết lập thêm các công cụ đóng gói/bundler phức tạp (Webpack, Vite, Rollup, Babel...).
  - **Hệ thống module**:
    - Phía Electron Main/Preload: Dùng CommonJS (`require`, `module.exports`).
    - Phía Shared (`src/shared/`): Sử dụng pattern kép (Dual-module) tương thích đồng thời cả CommonJS (Node.js) và Trình duyệt (`window.*`).

---

## 2. Lưu Trữ Dữ Liệu & Giao Tiếp IPC

### 2.1. Kiến trúc lưu trữ JSON cục bộ & Cơ chế Con trỏ (Pointer)
- Dự án lưu trữ dữ liệu bằng file JSON cục bộ, **tuyệt đối không dùng cơ sở dữ liệu server hay SQLite**.
- **Cơ chế thư mục động qua `pointer.json`**:
  - File con trỏ `pointer.json` nằm tại thư mục người dùng của hệ điều hành: `app.getPath('userData')/pointer.json`.
  - Cấu trúc: `{ "baseFolder": "<đường dẫn do user chọn>", "dataFolderName": "data", "phieuThuFolderName": "PhieuThu" }`.
  - Toàn bộ dữ liệu thực tế và ảnh/PDF phiếu thu xuất ra nằm trong `baseFolder`:
    - `<baseFolder>/data/`: Chứa file cài đặt và lịch sử các tháng.
    - `<baseFolder>/PhieuThu/Thang_<MM>_<YYYY>/`: Chứa 12 ảnh `Phong-<phong>.jpg` và 1 file PDF gộp `Thang_<MM>_<YYYY>.pdf`.
  - Thư mục `data/` ở gốc dự án đóng vai trò dữ liệu mẫu/dự phòng ban đầu khi người dùng chưa chọn thư mục.

### 2.2. Danh mục các file JSON trong `data/` và vai trò
1. **`data/settings.json` (hoặc `<baseFolder>/data/settings.json`)**:
   - Lưu cấu hình giá cả và tùy chọn hệ thống:
     ```json
     {
       "appId": "phong-tro-app",
       "baseFolder": "...",
       "dienThoai": "0982 141 407",
       "giaPhong": 2200000,
       "giaDien": 2900,
       "giaNuoc": 12000,
       "tienRac": 40000,
       "rac": 40000,
       "tienInternet": 24000,
       "internet": 24000,
       "tyLeHaoTai": 0.07,
       "tileHaoTai": 0.07,
       "enableRolloverPopup": true,
       "enableAnomalyPopup": true
     }
     ```
2. **`data/rooms.json`**:
   - Danh sách gốc cố định 12 phòng trọ: `1A` đến `6A` và `1B` đến `6B` kèm thông tin khách thuê (`phong`, `tenKhach`, `cmnd`).
3. **`data/history/YYYY-MM.json` (ví dụ: `2026-07.json`)**:
   - Lưu lịch sử chỉ số điện nước theo từng tháng. Mỗi file là một mảng 12 object:
     ```json
     [
       { "phong": "1A", "dienCu": 5302, "dienMoi": 5379, "nuocCu": 577, "nuocMoi": 583 }
     ]
     ```

### 2.3. Danh sách IPC Channels (Giao tiếp Main ↔ Renderer)
Tất cả các API được phơi ra renderer thông qua `window.api`:
- **Quản lý phiên bản**:
  - `app:get-version` (invoke): Lấy phiên bản từ `package.json`.
- **Dữ liệu lịch sử tháng**:
  - `month-data:load` (invoke, params: `monthKey`): Đọc file JSON lịch sử tháng từ thư mục `history/`.
  - `month-data:save` (invoke, params: `monthKey`, `data`): Ghi dữ liệu tháng vào file JSON lịch sử.
- **Cài đặt & Thư mục**:
  - `settings:load` (invoke): Đọc cài đặt từ `settings.json` thông qua đường dẫn con trỏ `pointer.json`.
  - `settings:save` (invoke, params: `data`): Lưu settings, tự động sao chép toàn bộ thư mục dữ liệu sang vị trí mới nếu `baseFolder` thay đổi và ghi lại `pointer.json`.
  - `dialog:pick-folder` (invoke): Mở Open Dialog native của Windows để chọn thư mục lưu.
- **Xuất phiếu thu**:
  - `export:receipts` (invoke, params: `monthKey`, `roomDataList`): Mở BrowserWindow ẩn, render lần lượt 12 phòng, xuất 12 ảnh JPG và 1 file PDF gộp, tự động mở thư mục sau khi hoàn thành.
  - `export:progress` (on): Lắng nghe tiến trình xuất phiếu `{ current, total }`.
- **Tự động cập nhật (Auto Updater)**:
  - `updater:check` (invoke): Kiểm tra phiên bản mới trên GitHub Releases.
  - `updater:start-download` (invoke): Tải bản cập nhật ngầm.
  - `updater:update-available` (on): Báo có bản mới.
  - `updater:update-not-available` (on): Đang ở bản mới nhất.
  - `updater:download-progress` (on): Báo tiến độ tải `{ percent, bytesPerSecond, transferred, total }`.
  - `updater:update-downloaded` (on): Đã tải xong, chuẩn bị tự động đóng và cập nhật ngầm.
  - `updater:error` (on): Báo lỗi kết nối máy chủ cập nhật.

---

## 3. Logic Tính Tiền (Khu Vực Nhạy Cảm)

- **Vị trí file cốt lõi**:
  - [`src/shared/calc.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/calc.js): Chứa toàn bộ công thức tính toán.
  - [`src/shared/format.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/format.js): Định dạng tiền tệ VNĐ, số thập phân, ngày tháng, và ánh xạ dữ liệu cho phiếu thu (`toReceiptData`).
- **NGUYÊN TẮC BẤT DI BẤT DỊCH**:
  - **TUYỆT ĐỐI KHÔNG SỬA 2 file này** trừ khi người dùng có yêu cầu rõ ràng về việc thay đổi công thức tính tiền.
  - Cả 2 file là **Pure JavaScript Functions** — KHÔNG đụng tới DOM, KHÔNG import Electron.
  - **Đã xóa bỏ hoàn toàn trường "Nợ cũ"** khỏi hệ thống; không được thêm lại vào bất kỳ công thức tính tổng nào.
- **Tóm tắt công thức chuẩn trong `calc.js`**:
  1. `dienTieuThu`: Nếu `dienMoi >= dienCu` tính `dienMoi - dienCu`. Nếu `dienMoi < dienCu` (công tơ quay vòng) tính `(MAX_DONG_HO_DIEN + dienMoi) - dienCu` với hằng số `MAX_DONG_HO_DIEN = 10000`.
  2. `nuocTieuThu`: `Math.max(0, nuocMoi - nuocCu)`.
  3. `tienDien`: `round1000(dienTieuThu * giaDien)` (làm tròn hàng nghìn gần nhất).
  4. `tienNuoc`: `round1000(nuocTieuThu * giaNuoc)` (làm tròn hàng nghìn gần nhất).
  5. `dienHaoTai`: `round1(dienTieuThu * tyLeHaoTai)` (làm tròn 1 chữ số thập phân).
  6. `tienDienHaoTai`: `round1000(dienHaoTai * giaDien)` (làm tròn hàng nghìn gần nhất).
  7. `tongCong`: `tienDien + tienNuoc + tienDienHaoTai + tienPhong + tienRac + tienInternet` (không làm tròn thêm vì các thành phần đều đã là bội số của 1000).

---

## 4. Cấu Trúc Giao Diện (UI) & Pattern Tái Sử Dụng

### 4.1. Các Tab ("Phần") trong giao diện nhập liệu
- **Phần 1: Nhập Dữ Liệu (`#section-data`)**:
  - **Cards thống kê nhanh (Stats Cards)**: Doanh Thu Tháng này, Tổng Điện Tiêu Thụ, Tổng Nước Tiêu Thụ, Số Phòng Đã Nhập.
  - **Bảng dữ liệu 12 phòng (`#rooms-table`)**:
    - Cố định 12 phòng: `1A` đến `6A`, `1B` đến `6B`.
    - Cột: STT, Số Phòng, Điện Cũ, Điện Mới, Số Điện TT, Nước Cũ, Nước Mới, Số Nước TT, Tiền Điện, Tiền Nước, Tiền Phòng, Rác, Internet, Điện Hao Tải, Tiền Hao Tải, Tổng Cộng.
    - Cơ chế kế thừa: Số mới tháng trước tự động điền vào số cũ tháng này và bị khóa (`locked-input`, `readonly`).
    - Điều hướng phím kiểu Excel: Phím `Enter` (xuống phòng dưới), `Shift+Enter` (lên phòng trên), `Tab` (sang ô kế tiếp).
- **Phần 2: Cài Đặt Chung (`#section-settings`)**:
  - Thiết lập thư mục lưu ảnh/PDF với nút Browse native (`#set-baseFolder`). Bắt buộc thiết lập ngay lần đầu mở ứng dụng.
  - Bảng giá mặc định: Tiền phòng, đơn giá điện, đơn giá nước, tiền rác, tiền internet, tỷ lệ điện hao tải, số điện thoại chủ trọ.
  - Cấu hình bật/tắt Pop-up bằng công tắc Toggle Switch.
  - Thông tin phiên bản & nút "Kiểm Tra Cập Nhật" thủ công.
- **Thanh Header**:
  - Dropdown chọn Tháng / Năm (`#month-year-select`): Khởi đầu từ mốc `2026-07`. Chỉ tự động mở thêm tháng mới khi tháng trước đó đã nhập đủ dữ liệu cả 12 phòng.
  - Nút duy nhất **"Lưu & Xuất"** (`#btn-save-export`): Gộp lưu lịch sử tháng và tiến hành xuất 12 ảnh JPG + 1 file PDF.

### 4.2. Quy ước đặt tên tiếng Việt trên UI
- Toàn bộ nhãn, tiêu đề, nút bấm, thông báo đều sử dụng **Tiếng Việt có dấu, chuẩn mực, đúng ngữ cảnh chủ nhà trọ**:
  - "Phần 1: Nhập Dữ Liệu", "Phần 2: Cài Đặt Chung"
  - "Lưu & Xuất", "Lưu Cài Đặt Giá", "Kiểm Tra Cập Nhật"
  - Đơn vị tiền tệ: hiển thị dấu chấm ngăn cách hàng nghìn kèm đuôi `đ` (ví dụ: `2.200.000 đ`).
  - Đơn vị tiêu thụ: `kWh`, `m³`.

### 4.3. Pattern Pop-up / Modal chuẩn để tái sử dụng
Giao diện sử dụng cấu trúc Modal Overlay đồng nhất:
```html
<div id="modal-id" class="modal-overlay" style="display: none;">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-icon [warning|info|danger]">...svg icon...</div>
      <div class="modal-title-group">
        <h3>Tiêu đề Modal</h3>
        <p class="modal-subtitle">Phụ đề mô tả</p>
      </div>
    </div>
    <div class="modal-body">
      <!-- Nội dung chi tiết hoặc box thông số .modal-info-box -->
      <p class="modal-question">Câu hỏi xác nhận hành động?</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="...">Hủy</button>
      <button type="button" class="btn btn-primary" onclick="...">Xác nhận</button>
    </div>
  </div>
</div>
```
- **4 Modal hiện có trong hệ thống**:
  1. `#rollover-modal`: Xác nhận công tơ điện quay vòng khi `dienMoi < dienCu`.
  2. `#anomaly-modal`: Cảnh báo biến động điện tiêu thụ $\ge 40\%$ so với tháng trước.
  3. `#unsaved-settings-modal`: Cảnh báo người dùng khi chuyển tab hoặc xuất dữ liệu mà chưa lưu cài đặt giá.
  4. `#update-modal`: Modal hiển thị tiến trình kiểm tra, tải và tự động cài đặt phiên bản mới (hỗ trợ 3 trạng thái: prompt, downloading kèm thanh % và tốc độ MB/s, installing với đếm ngược 3s).
- **Pattern thông báo Toast (`showToast`)**:
  - Hàm `showToast(message, type = 'success' | 'error' | 'warning' | 'info')`.
  - Hiển thị cố định góc dưới bên phải màn hình, tự động lọc tin nhắn trùng, tối đa 2 toast hiển thị đồng thời, tự biến mất sau 3.5 giây.

---

## 5. Quy Ước Code Style

- **Cách tổ chức file (Modular Architecture)**:
  - **Tách biệt rõ ràng theo module & nhiệm vụ**, không gom tất cả vào một file lớn:
    - `electron/`: Tiến trình chính (`main.js`), cầu nối an toàn (`preload.js`), rasterizer chuyển PDF sang ảnh (`rasterizer.html`).
    - `src/input/`: Toàn bộ logic giao diện bảng tính, tương tác form, xử lý modal và hiển thị (`index.html`, `renderer.js`, `style.css`).
    - `src/receipt/`: Template phiếu thu độc lập phục vụ việc kết xuất in ấn (`index.html`, `main.js`, `style.css`, `reset.css`).
    - `src/shared/`: Các hàm thuần túy (pure functions) dùng chung giữa Main Process và Renderer (`calc.js`, `format.js`).
    - `data/`: Nơi lưu trữ cấu hình tĩnh và lịch sử các tháng.
  - Khi thêm tính năng mới: Giữ nguyên cách phân tách này, logic tính toán đưa vào module dùng chung hoặc hàm tiện ích, không nhồi nhét mã nghiệp vụ vào HTML.

- **Quy tắc đặt tên biến & hàm**:
  - **Biến & Hàm**: Sử dụng kiểu `camelCase`, dùng **tiếng Việt không dấu** phản ánh đúng ngữ cảnh và nghiệp vụ nhà trọ (ví dụ: `dienCu`, `dienMoi`, `dienTieuThu`, `giaDien`, `tienPhong`, `tyLeHaoTai`, `loadRoomsForMonth`, `saveAndExport`, `calcRoom`, `formatMoney`).
  - **Hằng số**: Sử dụng `UPPER_SNAKE_CASE` (ví dụ: `MAX_DONG_HO_DIEN`, `MIN_MONTH`, `DEFAULT_ROOM_NAMES`, `PROJECT_ROOT`, `POINTER_FILE`).
  - **HTML ID & CSS Class**: Sử dụng `kebab-case` mang ý nghĩa rõ ràng (ví dụ: `tab-btn`, `stat-card`, `btn-save-export`, `rooms-table-body`, `rollover-modal`, `update-progress-bar`).

- **Xử lý bất đồng bộ & an toàn**:
  - Sử dụng `async/await` cho toàn bộ các thao tác file I/O, IPC invoke và hiển thị dialog của hệ thống.
  - Luôn kiểm tra sự tồn tại của `window.api` trước khi gọi IPC để tránh lỗi khi mở file trực tiếp trên trình duyệt web thông thường.
  - Luôn bọc các khối xử lý quan trọng trong `try/catch` và thông báo lỗi rõ ràng cho người dùng thông qua `showToast(err.message, 'error')`.

---

## 6. Những Điều TUYỆT ĐỐI KHÔNG TỰ Ý LÀM (Quan Trọng Nhất)

Đây là các nguyên tắc an toàn cao nhất của dự án. Mọi sự vi phạm đều có thể gây lỗi nghiêm trọng hoặc làm hỏng dữ liệu quản lý của chủ trọ:

1. **KHÔNG tự thêm framework hoặc thư viện lớn mà không hỏi trước**:
   - Tuyệt đối không tự ý cài đặt hoặc import React, Vue, Angular, Svelte, TailwindCSS, Bootstrap, jQuery...
   - Dự án là **HTML/CSS/JS thuần (Vanilla)**. Bất kỳ thư viện nào muốn thêm đều phải được sự đồng ý trước của người dùng.
2. **KHÔNG tự ý đổi kiến trúc lưu trữ dữ liệu**:
   - Giữ nguyên cơ chế file JSON (`pointer.json`, `settings.json`, `history/YYYY-MM.json`).
   - Tuyệt đối không tự ý chuyển sang SQLite, IndexedDB, Lowdb hay bất kỳ hệ quản trị CSDL nào khác.
3. **KHÔNG tự ý sửa `src/shared/calc.js` và `src/shared/format.js` khi task không yêu cầu**:
   - Hai file này chứa công thức tính tiền cốt lõi đã được kiểm định kỹ lưỡng.
   - Chỉ được phép sửa khi task yêu cầu rõ ràng, đích danh về việc thay đổi công thức tính tiền.
4. **KHÔNG tự ý đụng chạm nhạy cảm đến `src/shared/` khi chưa có sự đồng ý**:
   - Các module trong `src/shared/` dùng chung cho cả tiến trình chính và renderer. Bất kỳ thay đổi nào tại đây đều phải trao đổi và được xác nhận trước.
5. **KHÔNG tự đổi cấu trúc thư mục hiện có mà không báo trước**:
   - Giữ nguyên cấu trúc phân bổ hiện tại (`electron/`, `src/input/`, `src/receipt/`, `src/shared/`, `data/`, `assets/`, `release/`).
   - Không tự ý di chuyển, đổi tên các thư mục hoặc file cốt lõi.
6. **KHÔNG tự ý khôi phục trường "Nợ cũ"**:
   - Trường nợ cũ đã bị loại bỏ hoàn toàn khỏi hệ thống, không được tự ý thêm lại vào bảng tính hay công thức tính tổng.
7. **KHÔNG tự ý thêm TypeScript hoặc Bundler**:
   - Không cấu hình thêm TypeScript (`tsconfig.json`), Webpack, Vite hay Babel khi không có yêu cầu rõ ràng.

# Quy Trình Khởi Động Ứng Dụng (Startup Lifecycle)

Tài liệu liệt kê ngắn gọn, theo đúng thứ tự toàn bộ các bước ứng dụng thực thi từ lúc mở file `.exe` cho tới khi giao diện hiển thị đầy đủ và sẵn sàng sử dụng.

---

## BƯỚC 1: Khởi chạy Executable (.exe) & Main Process
1. Người dùng mở file `.exe` (Electron Portable).
2. Electron runtime giải nén môi trường tạm và đọc file `package.json`.
3. Xác định entrypoint chính của ứng dụng: `"main": "electron/main.js"`.

---

## BƯỚC 2: Nạp Main Process (`electron/main.js`)
1. **Require các thư viện Node.js & Electron**:
   - `electron` (`app`, `BrowserWindow`, `ipcMain`, `dialog`, `shell`)
   - `path`, `fs`
   - `pdf-lib` (`PDFDocument`)
   - `src/shared/format.js` (`toReceiptData`)
2. **Khởi tạo hằng số & hàm helper hệ thống**:
   - `PROJECT_ROOT = path.join(__dirname, '..')`
   - `POINTER_FILE = path.join(app.getPath('userData'), 'pointer.json')`
   - Khai báo các hàm helper: `getPointer()`, `savePointer()`, `isValidDataFolder()`, `findAvailableFolderName()`, `copyDirSync()`.
3. **Đăng ký lắng nghe các kênh IPC (Inter-Process Communication)**:
   - `app:get-version` — Lấy phiên bản app
   - `dialog:pick-folder` — Mở hộp thoại chọn thư mục Windows native
   - `settings:load` — Đọc cài đặt giá & thư mục gốc thông qua `pointer.json`
   - `settings:save` — Lưu cài đặt & tự động sao chép toàn bộ dữ liệu sang thư mục mới
   - `month-data:load` — Đọc dữ liệu lịch sử chỉ số tháng (`baseFolder/data/history/YYYY-MM.json`)
   - `month-data:save` — Lưu dữ liệu chỉ số tháng
   - `export:receipts` — Tiến hành render & xuất 12 ảnh JPG + 1 file PDF gộp
4. **Đợi sự kiện Electron sẵn sàng**: `app.whenReady().then(...)` kích hoạt hàm `createWindow()`.

---

## BƯỚC 3: Khởi tạo Cửa Sổ Chính (`BrowserWindow`)
1. Hàm `createWindow()` tạo cửa sổ `BrowserWindow`:
   - Kích thước: `1400 x 900`
   - Tiêu đề: `Màn Hình Nhập Liệu - Quản Lý Phòng Trọ v1.4.2`
   - Icon: `assets/icon/icon32x32.ico`
   - Cấu hình `webPreferences`:
     - `preload`: `electron/preload.js`
     - `contextIsolation: true`
     - `nodeIntegration: false`
2. Gọi `mainWindow.loadFile('src/input/index.html')`.

---

## BƯỚC 4: Thực thi Preload Script (`electron/preload.js`)
1. Require `contextBridge` và `ipcRenderer` từ `electron`.
2. Tạo cầu nối an toàn `contextBridge.exposeInMainWorld('api', { ... })`, chiếu các hàm IPC từ main process ra đối tượng `window.api` cho Renderer Process sử dụng:
   - `getAppVersion()`
   - `saveMonthData()`, `loadMonthData()`
   - `saveSettings()`, `loadSettings()`
   - `pickFolder()`
   - `exportReceipts()`, `onExportProgress()`

---

## BƯỚC 5: Nạp & Dựng Giao Diện Renderer (`src/input/index.html`)
1. Nạp file CSS `src/input/style.css` và phông chữ Google Fonts (Inter).
2. Dựng cấu trúc HTML DOM: Header (Tiêu đề, Navigation Tabs, Dropdown Tháng/Năm, Nút Lưu & Xuất), Khối thống kê Doanh thu/Điện/Nước, Bảng nhập dữ liệu 12 phòng trọ, Form Cài Đặt Chung, Khung Toast thông báo.
3. Nạp các file JavaScript theo thứ tự thẻ `<script>`:
   - Thẻ 1: `<script src="../shared/calc.js"></script>` — Nạp hàm tính toán tiền phòng, điện, nước, hao tải (`calcRoom`, `calcAllRooms`).
   - Thẻ 2: `<script src="../shared/format.js"></script>` — Nạp hàm định dạng dữ liệu phiếu thu (`toReceiptData`).
   - Thẻ 3: `<script src="renderer.js"></script>` — Nạp toàn bộ logic tương tác giao diện.

---

## BƯỚC 6: Thực thi Logic Khởi Tạo Renderer (`src/input/renderer.js`)
Khi sự kiện `DOMContentLoaded` kích hoạt, ứng dụng thực hiện tuần tự các hàm:
1. `populateMonthSelect()`: Tạo danh sách Tháng/Năm trong dropdown (từ Tháng 07/2026 đến Tháng 12/2056), mặc định chọn Tháng hiện tại của hệ thống.
2. `await loadSettingsFile()`: Gọi `window.api.loadSettings()` -> Main process đọc `pointer.json` -> Tìm đọc `settings.json` tại `<baseFolder>/data/settings.json`. Nạp đơn giá phòng, điện, nước, rác, internet, hao tải, sđt vào biến `appSettings`.
3. `initSettingsForm()`: Điền dữ liệu từ `appSettings` vào các ô nhập trong phần Cài Đặt Chung.
4. `await loadRoomsForMonth(currentMonthKey)`:
   - Gọi `window.api.loadMonthData(currentMonthKey)` đọc dữ liệu chỉ số tháng hiện tại.
   - Gọi `window.api.loadMonthData(prevMonthKey)` đọc dữ liệu tháng trước.
   - Tổng hợp dữ liệu 12 phòng (`1A-6A`, `1B-6B`). Tự động khóa số điện/nước cũ nếu có dữ liệu tháng trước.
   - `renderInitialTable()`: Render 12 dòng dữ liệu phòng vào bảng HTML `rooms-table-body`.
   - `calcAllRooms()` & `updateFooterTotals()`: Tính toán toàn bộ thành tiền và cập nhật 4 thẻ thống kê cũng như dòng tổng cộng cuối bảng.
5. Gọi `window.api.getAppVersion()`: Cập nhật thẻ hiển thị version (`#app-version-tag`) và tiêu đề cửa sổ (`document.title`).
6. `window.api.onExportProgress(...)`: Đăng ký nhận sự kiện cập nhật tiến trình khi xuất phiếu thu.
7. Đăng ký sự kiện bàn phím điều hướng Excel (`Enter`, `Shift+Enter`, `Tab`) cho các ô nhập liệu trong bảng.

---

## BƯỚC 7: Hoàn tất
Giao diện ứng dụng hiển thị đầy đủ thông tin 12 phòng trọ của tháng hiện tại, các ô số liệu được tính toán chính xác và sẵn sàng cho người dùng nhập liệu hoặc xuất phiếu.

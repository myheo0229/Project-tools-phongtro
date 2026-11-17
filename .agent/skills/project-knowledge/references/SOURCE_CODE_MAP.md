# 🗺️ Bản Đồ Mã Nguồn Chi Tiết (Source Code Map)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Phạm vi phân tích:** Toàn bộ các file mã nguồn, template, stylesheet và cấu hình thực tế trong dự án.

---

## 1. Sơ Đồ Cây Thư Mục Tổng Thể

```
Project-tools-phongtro/
├── electron/                         # Tiến trình chính & dịch vụ nền (Main Process)
│   ├── main.js                       # ⭐ Entry point chính: Quản lý vòng đời, IPC Handlers, AutoUpdater & Xuất file
│   ├── preload.js                    # ⭐ Context Bridge an toàn: Phơi bày window.api cho Renderer
│   ├── zalo-manager.js               # ⭐ Quản lý kết nối Zalo qua zca-js: QR login, session, convert VietQR SVG sang PNG bitmap & gửi tin
│   ├── rasterizer.html               # Cửa sổ ẩn chuyển đổi trang PDF sang JPEG qua pdfjs-dist (3x scale)
│   └── vendor/pdfjs/                 # Thư viện PDF.js offline (pdf.js, pdf.worker.js)
│
├── src/
│   ├── input/                        # Phân hệ giao diện chính (Main Renderer Process)
│   │   ├── index.html                # Cấu trúc DOM chính: 3 Tab + 10 Pop-up Modals + Stats Grid + Data Table
│   │   ├── renderer.js               # ⭐ Não bộ UI: State management, tính toán realtime, CRUD cư dân, auto-save & lưu confirmedAlerts
│   │   └── style.css                 # ⭐ Toàn bộ Design System, tokens, biến CSS, responsive & animation
│   │
│   ├── receipt/                      # Phân hệ mẫu phiếu thu (Dùng để in ấn & kết xuất tự động)
│   │   ├── index.html                # HTML mẫu phiếu thu tiền nhà (khổ A4 ngang, chuẩn in ấn)
│   │   ├── main.js                   # Hàm renderRoom(data) điền số liệu vào DOM phiếu thu
│   │   ├── style.css                 # CSS định dạng trang in A4, font Times New Roman, dòng chấm chấm
│   │   └── reset.css                 # CSS reset tiêu chuẩn cho phiếu thu
│   │
│   └── shared/                       # Các module thuần túy dùng chung (Dual Module: Node.js & Browser)
│       ├── calc.js                   # ⭐ Toàn bộ logic toán học tính tiền (calcRoom, round1000, round1)
│       ├── format.js                 # Định dạng tiền tệ VNĐ, số thập phân, ngày tháng, toReceiptData
│       ├── date-picker.js            # Custom Masked Input (dd/mm/yyyy) + Calendar Popup độc lập
│       ├── date-picker.css           # CSS giao diện ô nhập ngày tháng và popup lịch
│       ├── banks-data.js             # Danh mục hơn 50 ngân hàng Việt Nam (MoMo Bank Codes, VietQR, Logo URLs)
│       └── banks.json                # Dữ liệu ngân hàng dạng JSON nguyên bản
│
├── data/                             # Dữ liệu mẫu trắng (Seed Data) đi kèm bản đóng gói
│   ├── settings.json                 # Cấu hình giá mặc định và cờ bật/tắt popup
│   ├── rooms.json                    # Cấu trúc trắng 12 phòng mặc định (1A-6A, 1B-6B)
│   ├── residents.json                # Danh sách cư dân trắng ban đầu ([])
│   ├── banks.json                    # Bản sao danh mục ngân hàng
│   └── history/2026-07.json          # File lịch sử mẫu mốc khởi đầu của hệ thống
│
├── assets/icon/                      # Bộ Icon nhận diện ứng dụng (32x32 -> 512x512 .ico và .png)
├── .agent/skills/                    # Tri thức dành cho AI Agent
│   ├── project-knowledge/            # ⭐ Bộ tài liệu toàn diện này
│   ├── phong-tro-conventions/        # Quy ước code & kiến trúc dự án
│   ├── zalo-gui-hoa-don-an-toan/     # Quy tắc gửi hóa đơn Zalo an toàn
│   ├── an-toan-du-lieu-va-dong-goi/  # Quy tắc cách ly dữ liệu và đóng gói
│   └── quy-trinh-nang-cap-phien-ban/ # Quy trình bump version 5 file
│
├── date-input-picker-template.html   # File prototype mẫu thiết kế Date Picker
├── modal-them-nguoi-thue.html        # File prototype mẫu thiết kế Modal Người thuê
├── phong-nguoi-o-page.html           # File prototype mẫu thiết kế Màn hình Quản lý Người ở
├── package.json                      # Cấu hình dự án, dependencies và script build electron-builder
├── README.md                         # Hướng dẫn sử dụng và giới thiệu dự án
└── liệt kê thay đổi.txt              # Changelog chi tiết qua các phiên bản
```

---

## 2. Chi Tiết Từng Module & Phân Tích Tác Động (Impact Analysis)

### 2.1. Phân Hệ Electron Backend (`electron/`)

#### 📄 `electron/main.js` (881 dòng)
- **Nhiệm vụ**: Entry point chính của ứng dụng Electron. Quản lý cửa sổ, điều phối giao tiếp IPC, cấu hình AutoUpdater, kết xuất file ảnh/PDF hàng loạt và quản lý đường dẫn dữ liệu qua `pointer.json`.
- **Các hàm & thành phần cốt lõi**:
  - `createWindow()`: Khởi tạo cửa sổ chính `1400x900`, áp dụng kỹ thuật ẩn ban đầu (`show: false`) và chỉ hiển thị khi nhận sự kiện `ready-to-show`.
  - `preloadPdfLibInBackground()`: Nạp ngầm thư viện nặng `pdf-lib` sau 1.5 giây kể từ khi app mở để tránh chặn luồng khởi động.
  - `getPointer()` / `savePointer(pointerObj)`: Đọc và ghi file con trỏ `pointer.json` trong `app.getPath('userData')`.
  - `copyDirSync(src, dest)`: Sao chép đệ quy dữ liệu từ thư mục cũ sang mới khi người dùng đổi `baseFolder`.
  - `setupAutoUpdater(mainWindow)`: Đăng ký các sự kiện `electron-updater` (`update-available`, `download-progress`, `update-downloaded`, `error`), hiển thị Windows Native Notification và tự động nâng cấp ngầm sau 3.5 giây đếm ngược.
  - `getDefaultRooms()`: Khởi tạo mảng 12 phòng trắng từ `1A` đến `6B`.
  - `getActiveDataDir()`: Xác định chính xác thư mục dữ liệu hiện hành dựa theo con trỏ `pointer.json`.
- **Các kênh IPC chính xử lý**:
  - `app:get-version`, `dialog:pick-folder`, `dialog:pick-image`
  - `settings:load`, `settings:save`
  - `month-data:load`, `month-data:save`
  - `rooms:load`, `rooms:save`, `residents:load`, `residents:save`
  - `cccd:save-image`, `cccd:move-folder`, `cccd:delete-folder`, `cccd:read-image`
  - `export:receipts`: Mở 2 cửa sổ ẩn `receiptWin` và `rasterWin`, lặp 12 phòng, tạo 12 ảnh JPG và 1 file PDF gộp.
  - `zalo:*`: Chuyển tiếp tới `zaloManager`.
- **Dependencies**: `electron`, `path`, `fs`, `electron-updater`, `pdf-lib`, `./zalo-manager`, `../src/shared/format.js`.
- **Callers**: Được kích hoạt tự động bởi `electron .` và nhận cuộc gọi từ `electron/preload.js`.
- **Tác động nếu sửa**: Đây là file quan trọng nhất của hệ thống backend. Bất kỳ lỗi cú pháp nào sẽ làm sập ứng dụng ngay khi khởi động. Sửa logic `settings:save` hoặc `pointer.json` có thể dẫn đến mất liên kết dữ liệu của người dùng.

#### 📄 `electron/preload.js` (75 dòng)
- **Nhiệm vụ**: Cầu nối bảo mật qua `contextBridge.exposeInMainWorld('api', {...})`. Phơi bày các hàm gọi IPC an toàn cho `src/input/renderer.js`.
- **Các API phơi ra**:
  - Nhóm cấu hình: `getAppVersion()`, `pickFolder()`, `loadSettings()`, `saveSettings(data)`
  - Nhóm tháng: `loadMonthData(monthKey)`, `saveMonthData(monthKey, data)`
  - Nhóm xuất file: `exportReceipts(monthKey, roomDataList)`, `onExportProgress(callback)`
  - Nhóm cập nhật: `checkForUpdates()`, `startDownloadUpdate()`, `onUpdateAvailable()`, `onDownloadProgress()`, `onUpdateDownloaded()`, `onUpdateError()`
  - Nhóm người ở & CCCD: `loadResidents()`, `saveResidents()`, `loadRooms()`, `saveRooms()`, `pickImage()`, `saveCccdImage()`, `moveCccdFolder()`, `deleteCccdFolder()`, `readCccdImageAsDataUrl()`
  - Nhóm Zalo: `getZaloStatus()`, `startZaloQrLogin()`, `abortZaloQrLogin()`, `retryZaloQrLogin()`, `logoutZalo()`, `onZaloQrEvent()`, `sendZaloReceipts()`, `onZaloSendProgress()`
- **Tác động nếu sửa**: Thay đổi tên hàm hoặc tham số ở đây sẽ gây lỗi `window.api.<func> is not a function` ngay lập tức trên giao diện `renderer.js`.

#### 📄 `electron/zalo-manager.js` (584 dòng)
- **Nhiệm vụ**: Đóng gói toàn bộ logic tương tác với máy chủ Zalo thông qua `zca-js`.
- **Các phương thức chính**:
  - `loadSavedSession(baseFolder)` / `saveSession(data, baseFolder)` / `clearSession(baseFolder)`: Quản lý cookie và token xác thực.
  - `restoreSession(baseFolder)`: Tự động đăng nhập lại từ session đã lưu mà không cần quét lại mã QR.
  - `startQrLogin(webContents, baseFolder)`: Mở luồng quét QR, stream event qua IPC `zalo:qr-event`.
  - `abortQrLogin()` / `retryQrLogin()`: Hủy an toàn hoặc tạo lại mã QR khi hết hạn.
  - `downloadVietQrImage(url, destPath)`: Tải ảnh mã thanh toán VietQR động về thư mục tạm.
  - `renderZaloTemplate(template, task, context)`: Phân tích cú pháp chuỗi mẫu tin nhắn tùy biến, thay thế toàn bộ biến số (`{phong}`, `{tongCong}`, `{dienKwh}`, `{bankName}`, cùng nhóm biến thay ĐH `{ghiChuThayDongHo}`, `{ghiChuThayDien}`, `{ghiChuThayNuoc}`, `{ngayThayDien}`, `{ngayThayNuoc}`...) và chỉ tự động chèn ghi chú thay đồng hồ khi `appSettings.zaloIncludeMeterChangeNote === true` và phòng/tháng đó có thay đổi ĐH (`hasMeterChange`).
  - `sendReceipts({ monthKey, baseFolder, roomTasks, appSettings }, onProgress)`: Thực hiện gửi hóa đơn tự động tuần tự từng phòng theo tùy chọn:
    1. Tìm UID người nhận qua `api.findUser(cleanPhone)`.
    2. Kiểm tra `appSettings.zaloSendReceiptImage !== false`: Gửi ảnh phiếu thu `Phong-XX.jpg`.
    3. Kiểm tra `appSettings.zaloSendPaymentQr !== false`: Tải và gửi ảnh mã VietQR (nếu có đủ thông tin ngân hàng).
    4. Kiểm tra `appSettings.zaloSendMessageText !== false`: Gửi tin nhắn văn bản (render theo `appSettings.zaloMessageTemplate` tùy biến nếu có, hoặc gửi mẫu mặc định; chỉ kèm ghi chú thay ĐH nếu `zaloIncludeMeterChangeNote === true` và phòng có thay ĐH).
    5. Áp dụng độ trễ ngẫu nhiên từ 3.0s – 4.5s để chống spam.
    6. Áp dụng timeout 15s cho từng phòng.
- **Dependencies**: `zca-js`, `sharp`, `electron`, `path`, `fs`, `https`, `http`, `../src/shared/banks-data.js`, `../src/shared/format.js`.
- **Tác động nếu sửa**: Cần hết sức cẩn trọng khi sửa các tham số độ trễ gửi tin hoặc luồng quét QR vì có thể dẫn đến việc tài khoản Zalo của chủ trọ bị khóa hoặc bị đánh dấu spam.

#### 📄 `electron/rasterizer.html` (32 dòng)
- **Nhiệm vụ**: Cửa sổ ẩn chạy `pdfjs-dist` để chuyển đổi buffer PDF sang ảnh JPEG chất lượng cao (3x scale) thông qua thẻ `<canvas>` ngầm.
- **Dependencies**: `./vendor/pdfjs/pdf.js`, `./vendor/pdfjs/pdf.worker.js`.
- **Tác động nếu sửa**: Lỗi tại đây sẽ khiến quá trình xuất ảnh JPG bị treo hoặc sinh ra file ảnh rỗng 0 bytes.

#### 📄 `electron/excel-service.js` (607 dòng)
- **Nhiệm vụ**: Tạo và xuất báo cáo danh sách toàn bộ người thuê ra file Excel chuẩn OpenXML SpreadsheetML (`.xlsx`) độc lập, không phụ thuộc thư viện ngoài.
- **Các hàm chính**:
  - `exportResidentsToExcel({ baseFolder, dataFolderName })`: Kiểm tra `BaseFolder`, đọc `residents.json` và `rooms.json`, tạo file `.xlsx` và lưu trực tiếp vào `BaseFolder`.
  - `buildResidentsExcelBuffer(residents, rooms)`: Ánh xạ 9 cột chuẩn (`STT`, `Họ Và Tên`, `SĐT Gọi`, `SĐT Zalo`, `Số CCCD`, `Ngày Sinh`, `Giới Tính`, `Phòng Ở`, `Ngày Vào Ở`), ép kiểu Text (`@` / `inlineStr`) cho SĐT và CCCD, định dạng viền, màu nền header và độ rộng cột.
  - `generateUniqueExcelFileName(baseFolder, date)`: Sinh tên file `DanhSachNguoiThue_YYYYMMDD_HHmmss.xlsx` (kèm hậu tố `_01`, `_02` nếu trùng giây).
- **Dependencies**: `fs`, `path`, `zlib` (Node.js built-ins).

#### 📄 `electron/month-excel-service.js`
- **Nhiệm vụ**: Tạo và xuất báo cáo bảng dữ liệu chỉ số và tính tiền phòng của tháng ra file Excel chuẩn OpenXML SpreadsheetML (`.xlsx`) độc lập, không phụ thuộc thư viện ngoài.
- **Các hàm chính**:
  - `exportMonthDataToExcel({ baseFolder, monthKey, roomsData })`: Kiểm tra `BaseFolder`, tạo buffer `.xlsx` và ghi file an toàn nguyên tử (atomic write qua `.tmp` rồi rename).
  - `buildMonthDataExcelBuffer(roomsData, monthKey)`: Xây dựng bảng **17 cột (`A–Q`)** chuẩn tương ứng giao diện (bổ sung cột `Q: Ghi Chú` ngoài cùng bên phải với style thường `s="9"` có `wrapText="1"`, tự giãn chiều cao dòng theo nội dung), định dạng số `#,#00` cho tiền tệ và chỉ số, thêm dòng TỔNG CỘNG tích hợp sẵn công thức `=SUM(...)`, định dạng màu header xanh lá `#E2EFDA` và viền đôi cho dòng tổng.
  - `generateMonthExcelFileName(baseFolder, monthKey, date)`: Sinh tên file theo định dạng `BangDuLieu_MM_YYYY - Output Time YYYY_MM_DD_HH_MM_SS.xlsx` (kèm hậu tố `_01`, `_02` nếu phát sinh xuất trùng giây).
- **Dependencies**: `fs`, `path`, `zlib` (Node.js built-ins).

---

### 2.2. Phân Hệ Giao Diện Người Dùng (`src/input/`)

#### 📄 `src/input/index.html` (1460 dòng)
- **Nhiệm vụ**: Cấu trúc HTML chính của ứng dụng.
- **Các khối chính**:
  - Header: Logo, Version tag, Thanh Tab (`data`, `settings`, `residents`), Dropdown Tháng/Năm, Nút "Lưu & Xuất".
  - Section 1: Stats Grid (4 thẻ thống kê), Header thanh tác vụ có nút "Gửi Zalo", Bảng 12 phòng (16 cột), Bảng chân trang tính tổng.
  - Section 2: Card Chọn thư mục lưu, Card Bảng giá mặc định, Card Cài đặt ngân hàng (kèm dropdown tìm kiếm có logo), Card Kết nối Zalo (avatar thật + trạng thái), Card Toggle switch bật/tắt popup, Card Kiểm tra cập nhật.
  - Section 3: 4 Thẻ thống kê cư dân, Lưới 12 thẻ phòng (Occupancy cards), Thanh tìm kiếm & lọc theo phòng, Bảng danh sách cư dân (có chọn nhiều để xóa hàng loạt).
  - 10 Pop-up Modals:
    1. `#rollover-modal`: Xác nhận công tơ điện quay vòng.
    2. `#anomaly-modal`: Cảnh báo biến động điện $\ge 40\%$.
    3. `#unsaved-settings-modal`: Cảnh báo thay đổi chưa lưu khi đổi tab.
    4. `#update-modal`: Tiến trình tải & cài đặt bản cập nhật mới.
    5. `#room-detail-modal`: Phân bổ chủ phòng và checklist thành viên.
    6. `#resident-form-modal`: Thêm/Sửa hồ sơ cư dân (Tab Thông tin cá nhân + Tab Upload ảnh CCCD).
    7. `#cccd-preview-modal`: Xem phóng to ảnh CCCD (Lightbox).
    8. `#delete-resident-modal`: Xác nhận xóa cư dân (đơn lẻ hoặc hàng loạt).
    9. `#zalo-qr-modal`: Quét mã QR đăng nhập Zalo kèm đồng hồ đếm ngược 120s.
    10. `#zalo-select-rooms-modal`: Chọn phòng để gửi hóa đơn Zalo.
    11. `#zalo-summary-report-modal`: Báo cáo kết quả gửi Zalo.
- **Tác động nếu sửa**: Thay đổi các thuộc tính `id` sẽ gây lỗi cho JavaScript trong `renderer.js`. Cần tuân thủ quy ước đặt tên `kebab-case`.

#### 📄 `src/input/renderer.js` (4463 dòng)
- **Nhiệm vụ**: Trọng tâm điều khiển toàn bộ tương tác giao diện, logic nghiệp vụ, đồng bộ dữ liệu với Main Process và tính toán tự động.
- **Các nhóm hàm chính**:
  - **Điều hướng Phân hệ & Chuyển cảnh (Blur Transition)**: `switchTab(tabName)`, `forceSwitchTab(tabName)` điều phối hiệu ứng nhòe mờ 700ms (`.page-out`, `.page-in`), tính toán hướng chuyển cảnh (`--dir = 1` tiến hoặc `-1` lùi) và dọn dẹp timeout chống xung đột.
  - **Quản lý Tháng & Khởi tạo**: `computeMaxSelectableMonth()`, `populateMonthSelect()`, `onMonthYearChange()`, `loadRoomsForMonth()`.
  - **Nhập liệu & Điều hướng Excel**: `renderInitialTable()`, `handleInputChange()`, `updateRowUI()`, `updateFooterTotals()`, `handleTableKeyDown()`, `getNextField()`.
  - **Pop-up Cảnh báo Nghiệp vụ & Badge (!)**: `handleDienMoiBlur()`, `showRolloverModal()`, `showAnomalyModal()`, `handleAlertBadgeClick()`, `showUnsavedSettingsModal()`. Quản lý cờ `confirmedRollover`, `confirmedAnomaly` và lưu trữ trạng thái vào file lịch sử tháng.
  - **Lưu & Xuất Phiếu Thu**: `saveAndExport()`, `saveSettings()`.
  - **Quản lý Phòng & Cư dân (Phần 3)**: `loadResidentsData()`, `loadRoomsData()`, `renderResidentsStats()`, `renderRoomCards()`, `openRoomDetailModal()`, `saveRoomDetailAssignment()`, `filterResidentsTable()`, `renderResidentsTable()`, `openAddResidentModal()`, `openEditResidentModal()`, `submitResidentForm()`, `executeDeleteResidents()`.
  - **Xử lý Ảnh CCCD**: `onCccdAreaClick()`, `pickCccdImage()`, `removeCccdImage()`, `viewCccdPhoto()`, `closeCccdLightbox()`.
  - **Tích hợp Zalo & Gửi Phiếu Thu**: `initZaloIntegration()`, `handleZaloQrLoginClick()`, `handleZaloLogoutClick()`, `openZaloSelectRoomsModal()`, `toggleSelectAllZaloRooms()`, `toggleZaloRoomSelection()`, `executeSendZaloReceipts()`, `showZaloSummaryReportModal()`.
  - **Tùy chọn Gửi & Soạn thảo Mẫu Tin Nhắn Zalo**: `toggleZaloSendOption()`, `onZaloOptionCheckboxChange()`, `onZaloOptionChange()`, `insertVariableIntoTemplate()`, `onZaloTemplateInput()`, `syncZaloEditorScroll()`, `validateZaloTemplateVariables()`, `resetZaloTemplateToDefault()`, `initZaloTemplateCustomizerUI()`, `updateZaloLivePreview()`, cùng hằng số `DEFAULT_ZALO_TEMPLATE`, `ZALO_VALID_VARIABLES`.
  - **Auto Updater**: `initAutoUpdaterListeners()`, `checkUpdateManual()`, `startDownloadUpdateNow()`, `updateDownloadProgressUI()`.
- **Tác động nếu sửa**: File chứa rất nhiều logic tương tác chặt chẽ. Cần lưu ý các biến trạng thái toàn cục (`roomsData`, `residentsList`, `roomsList`, `isSettingsDirty`, `isBankDirty`, `selectedZaloRooms`).

#### 📄 `src/input/month-excel.js`
- **Nhiệm vụ**: Phân hệ xử lý sự kiện bấm nút "Xuất dữ liệu" trên thanh tác vụ Bảng nhập chỉ số (Phần 1), tách file độc lập chống phình to `renderer.js`.
- **Các hàm chính**:
  - `handleExportMonthExcelClick()`: Tính toán lại dữ liệu 12 phòng qua `calcRoom`, kiểm tra `BaseFolder`, gọi IPC `month:export-excel`, xử lý Toast và mở Modal kết quả.
  - `showMonthExcelExportResultModal(result, monthKey)`: Tái sử dụng modal `#excel-export-result-modal` để hiển thị tên file, đường dẫn, nút mở file và nút mở thư mục chứa file.
  - `handleOpenExportedExcelFile()`: Mở trực tiếp file Excel vừa xuất bằng ứng dụng mặc định trên máy tính qua IPC `excel:open-file` (`shell.openPath`).

#### 📄 `src/input/meter-change-modal.js`
- **Nhiệm vụ**: Phân hệ UI & Backend Logic cho Modal **"Ghi nhận thay đổi đồng hồ Điện / Nước"** 2 bước (`#meter-change-modal`), kết nối `<baseFolder>/data/meter-changes.json` qua IPC, đồng bộ 2 chiều với bảng Phần 1 (`roomsData`), Cài Đặt Chung (`meterDigits`) và Nhật ký hoạt động.
- **Các hàm chính**:
  - `loadMeterChangesStore()`, `getRoomMeterChangeRecord()`, `getUnfinishedMeterChangesForMonth()`, `persistRoomMeterChange()`: Quản lý kho `meterChangesStore` trong bộ nhớ và ghi/đọc atomic xuống `meter-changes.json`.
  - `openMeterChangeModal(preselectPhong, preselectType)`, `closeMeterChangeModal()`, `renderMeterChangeRoomGrid()`, `renderMeterChangeHistoryList()`, `openMeterChangeHistoryCard(monthKey, phong)`: Nạp 12 phòng kèm trạng thái tháng trước/trạng thái thay ĐH đang lưu, hiển thị Mục 3 các tháng đã thay ĐH mới nhất $\rightarrow$ cũ nhất trên cùng thanh cuộn Trang 1, hỗ trợ mở thẳng Bước 2 cho bất kỳ tháng nào từ thẻ lịch sử hoặc badge trên bảng chính.
  - `prepareMcStep2LockMode()`, `createMcStep2Backup()`, `restoreMcStep2FromBackup()`, `handleToggleEditMcRecordClick()`, `confirmUnlockMcRecordForEditing()`, `handleMcStep2Back()`: Quản lý khóa tự động sau khi lưu (`🔒 Đã khóa dữ liệu` chỉ trong Bước 2, không khóa bảng Phần 1), popup xác nhận `#mc-unlock-edit-modal`, hoàn tác `Hủy thay đổi & Giữ nguyên` về chế độ khóa ngay tại Bước 2 và tự động khôi phục khi quay lại/đóng lúc chưa lưu.
  - `goToMeterChangeStep(step, dir)`, `addMeterChangeRow(type)`, `removeMeterChangeRow(type, idx)`: Chuyển trang trượt ngang (`--dir`), quản lý chuỗi $n$ lần thay.
  - `onMcIntKeyDown()`, `onMeterChangeNumInput()`, `onMcOldEndBlur()`, `onMcMonthEndBlur()`: Ràng buộc chỉ số nguyên không âm `0–9`, tuần tự Ô 1 $\rightarrow$ Ô 2 $\rightarrow$ Ô 3 (mặc định `0`) $\rightarrow$ Ô 4, xử lý quay vòng và bật popup xác nhận số chữ số ĐH mới.
  - `evaluateMeterChangeSection(type)`, `updateMeterChangeLiveSection(type)`: Tính tiêu thụ qua $n$ lần thay (kể cả quay vòng) và cập nhật 3 cấp độ (`⏳ Đang theo dõi` / `📝 Hãy nhập ô 4` / `✅ Đã đủ`).
  - `handleSaveMeterChange()`, `handleDeleteSectionMeterChange(type)`, `handleDeleteRoomMeterChanges()`, `syncMeterChangeToMainTable()`: Lưu (rồi tự khóa ngay tại Bước 2 thay vì đóng Modal), tạm gỡ/gỡ hoàn toàn thay đổi ĐH, đồng bộ `dienKwhOverride` / `nuocKhoiOverride` ra bảng Phần 1 hoặc `history/YYYY-MM.json` của tháng lịch sử tương ứng và ghi `activity-logs`.

#### 📄 `src/input/style.css` (3570 dòng)
- **Nhiệm vụ**: Toàn bộ hệ thống giao diện trực quan, định nghĩa biến màu sắc, kích thước, hiệu ứng đổ bóng, responsive breakpoints và hiệu ứng chuyển động.
- **Tác động nếu sửa**: Không sửa các biến `:root` đã được định nghĩa nếu không có yêu cầu rõ ràng từ người dùng.

---

### 2.3. Phân Hệ Mẫu Phiếu Thu In Ấn (`src/receipt/`)

#### 📄 `src/receipt/index.html`
- **Nhiệm vụ**: Khung HTML mẫu phiếu thu chuẩn in ấn khổ A4 ngang. Chứa các thẻ `<span>` có id tiền tố `f-` (ví dụ: `f-dienThoai`, `f-phong`, `f-tienPhong`, `f-dienMoi`, `f-dienCu`, `f-tongCong`...), kèm cặp dòng thay thế `#row-dien-mc` / `#row-nuoc-mc` hiển thị chi tiết thay ĐH khi phòng có thay đồng hồ.

#### 📄 `src/receipt/main.js`
- **Nhiệm vụ**: Cung cấp hàm `renderRoom(data)` cập nhật dữ liệu vào các thẻ tương ứng, tự động ẩn dòng "Nợ cũ" nếu không có nợ, dùng `applyMeterChangeRow()` ẩn `Số mới / Số cũ` khi có `dienMcLines`/`nuocMcLines`, và chạy `fitReceiptMeterChangeNotes()` tự thu nhỏ `font-size` vùng ghi chú ĐH nếu nhiều dòng để bảo đảm vừa khít 1 trang A4 ngang.

#### 📄 `src/receipt/style.css` & `reset.css`
- **Nhiệm vụ**: Định nghĩa kích thước trang in `@page { size: A4 landscape; margin: 0; }`, font chữ Times New Roman, khoảng cách dòng, các dấu chấm lấp đầy (`.row-fill`), và style riêng `.mc-replace-row` / `.mc-lines-box` với `--mc-note-font-size` dùng khi phòng có thay ĐH.

---

### 2.4. Module Dùng Chung Thuần Túy (`src/shared/`)

#### 📄 `src/shared/calc.js` (136 dòng)
- **Nhiệm vụ**: Chứa 100% công thức toán học tính tiền của ứng dụng.
- **Các hàm export**:
  - `calcRoom(input, settings)`: Tính toán tiền điện, tiền nước, tiền hao tải và tổng cộng cho 1 phòng.
  - `calcAllRooms(rooms, settings)`: Tính toán cho cả 12 phòng và trả về tổng doanh thu tháng.
  - `round1000(x)`: Làm tròn đến hàng nghìn gần nhất (`Math.round(x / 1000) * 1000`).
  - `round1(x)`: Làm tròn 1 chữ số thập phân (`Math.round(x * 10) / 10`).
- **Hằng số**: `MAX_DONG_HO_DIEN = 10000`.
- **Nguyên tắc an toàn**: **TUYỆT ĐỐI KHÔNG TỰ Ý SỬA**. Đây là khu vực nhạy cảm nhất của toàn bộ hệ thống.

#### 📄 `src/shared/format.js`
- **Nhiệm vụ**: Định dạng dữ liệu hiển thị dùng chung (Node & Browser).
- **Các hàm export**:
  - `formatMoney(number)`: Trả về chuỗi định dạng dấu chấm phân cách hàng nghìn (VD: `2.200.000`).
  - `formatDecimalVN(number)`: Trả về số thập phân 1 chữ số có dấu phẩy (VD: `5,4`).
  - `getNgayThangNam(monthKey)`: Trích xuất `{ ngay: "01", thang, nam }`.
  - `formatMcDateVN(isoDateStr)`, `buildMeterChangeDetailForType(typeRecord, type)`, `formatRoomMeterChangeNotes(roomMcRecord)`: Diễn giải chi tiết thay đổi ĐH (`status === 'completed'`) dùng chung cho Phiếu thu, Zalo và Excel.
  - `renderZaloTemplateWithMeterChange(template, values)` & `applyZaloMeterChangeNote(...)`: Render tin nhắn Zalo với `{ghiChuThayDien}` / `{ghiChuThayNuoc}` và tự dọn dòng trống thừa khi thiếu dữ liệu (không tự động chèn nếu mẫu không đặt biến).
  - `toReceiptData(calcResult, monthKey, dienThoai, roomMcRecord)`: Ánh xạ kết quả tính toán (và ghi chú thay ĐH nếu có) thành cấu trúc dữ liệu hiển thị trên phiếu thu.

#### 📄 `src/shared/date-picker.js` (573 dòng) & `date-picker.css` (215 dòng)
- **Nhiệm vụ**: Cung cấp component nhập ngày tháng định dạng mặt nạ `dd/mm/yyyy` (`DateMaskInput`) và Popup lịch chọn ngày (`DatePickerPopup`) độc lập hoàn toàn, hỗ trợ chọn năm từ quá khứ đến tương lai hơn 100 năm.

#### 📄 `src/shared/banks-data.js` (840 dòng) & `banks.json`
- **Nhiệm vụ**: Cung cấp từ điển `VIETNAM_BANKS_MAP` và mảng `VIETNAM_BANKS_LIST` gồm hơn 50 ngân hàng Việt Nam hỗ trợ VietQR và Napas.

---

### 2.5. Các File Prototype & Tham Khảo Giao Diện

- `phong-nguoi-o-page.html`: Bản thiết kế giao diện ban đầu của Phần 3 (Quản lý Phòng & Người ở).
- `modal-them-nguoi-thue.html`: Bản thiết kế giao diện mẫu của Modal Thêm/Sửa Người Thuê (tỉ lệ 1.5x).
- `date-input-picker-template.html`: Bản thiết kế mẫu của bộ Date Mask Input và Calendar Popup.
- **Lưu ý**: Cả 3 file này là các file thiết kế mẫu độc lập (static mockups) được người phát triển dùng làm quy chuẩn khi code vào `src/input/index.html`, `style.css` và `renderer.js`. Không xóa hoặc sửa các file này.

---

## 6. Các Module Hệ Thống Sao Lưu Dữ Liệu (Backup Data)

| File | Vai trò & Các hàm chính |
|---|---|
| `electron/backup-config.js` | Quản lý cấu hình backup riêng cho từng Windows user tại `userData/backup-config.json` và mã hóa OAuth token bằng `safeStorage` (Windows DPAPI) tại `userData/backup-tokens.enc`. Các hàm: `loadBackupConfig`, `saveBackupConfig`, `saveEncryptedTokens`, `loadEncryptedTokens`, `clearAccountSession`, `getOAuthClientCredentials`, `saveOAuthClientCredentials`. |
| `electron/zip-service.js` | Tạo snapshot dữ liệu nhất quán, nén toàn bộ `BaseFolder` thành file ZIP chuẩn PKZIP (UTF-8 flag `0x0800`), loại trừ chính xác `BaseFolder/BackupData` và kiểm tra toàn vẹn `CRC32`. Các hàm: `isExcludedBackupDataPath`, `generateUniqueZipFileName`, `createFullBackupZip`, `verifyZipIntegrity`. |
| `electron/google-drive-service.js` | Thực thi OAuth 2.0 Desktop Loopback + PKCE, kiểm tra kết nối mạng (`checkInternetConnectivity`), kiểm tra sức khỏe tài khoản & dung lượng Drive (`checkDriveHealth`), chọn/tạo thư mục đích (`configureTargetDriveFolder`, `ensureDriveBackupDataFolder`), tải lên bằng Resumable Upload (`uploadZipFileToDrive`) và xác minh sau upload (`verifyUploadedZipOnDrive`). |
| `electron/backup-manager.js` | Điều phối quy trình sao lưu 7 giai đoạn (`executeFullBackup`), khóa chống chạy trùng (`isBackupRunning`), và tổng hợp trạng thái (`getBackupSystemState`). |
| `electron/google-oauth-client.json` | File cấu hình chứa `clientId` và `clientSecret` (Desktop OAuth 2.0) để đóng gói cùng ứng dụng. |
| `src/input/renderer.js` (`tokenizeSearchQuery`, `highlightSearchText`, `getFilteredAndRankedResidents`, `clearResidentSearch`) | Bộ máy tìm kiếm cư dân tức thì kiểu Google Search (đa từ khóa, xếp hạng điểm ưu tiên, tô sáng `<mark>` không phân biệt dấu và đồng bộ sáng thẻ phòng). |

---

### 2.5. Cơ Chế Khóa Dữ Liệu Tháng Đã Xuất & 2 Popup Chữ To (`month-locks`)

- **Backend (`electron/main.js`)**:
  - `month-locks:load`: Đọc file `<baseFolder>/data/month-locks.json` (chuẩn hóa schema) và tự động quét `PhieuThu/Thang_MM_YYYY` bằng hàm `listExportedMonthKeys` (đối chiếu kèm `data/history/YYYY-MM.json` đảm bảo chỉ tính tháng thực sự đã nhập chỉ số mới) để khóa tự động các tháng đã xuất từ trước.
  - `month-locks:save`: Ghi atomic qua file tạm `.tmp` rồi đổi tên để tránh hỏng file. Giữ nguyên 100% định dạng mảng JSON `[...]` của `history/YYYY-MM.json`.
- **Preload (`electron/preload.js`)**:
  - `api.loadMonthLocks()`, `api.saveMonthLocks(data)`.
- **Frontend (`src/input/renderer.js`)**:
  - Quản lý trạng thái: `isCurrentMonthLocked`, `isCurrentMonthEditing`, `currentMonthSnapshotSettings`, `lockedMonthBackupState`, `monthLocksState`.
  - Hàm tiện ích: `hasMonthEnteredNewData()`, `createPricingSnapshot()`, `getActiveMonthSettings()`, `extractHistoryPayload()`, `formatMonthLabel()`.
  - Điều khiển UI & Modal: `updateMonthLockUI()`, `handleToggleEditMonthClick()`, `confirmUnlockMonthForEditing()`, `restoreLockedMonthFromBackup()`, `showUnsavedMonthEditModal()`, `stayInMonthEditingModal()`, `discardMonthEditingAndProceed()`, `saveAndExportFromMonthEditModal()`.

---

## 7. Các Module Hệ Thống Nhật Ký Hoạt Động (Activity Log)

| File | Vai trò & Các hàm chính |
|---|---|
| `electron/activity-logger.js` | Quản lý đọc/ghi file `<BaseFolder>/data/activity-logs.json` tại Main Process với hàng đợi tuần tự (`writeQueue`), Atomic Write qua `.tmp`, tự khôi phục hoặc đổi tên file lỗi thành `.corrupted_<timestamp>.json`, giới hạn 2.000 bản ghi, định dạng `timeVn` (`"HH:mm:ss - DD/MM/YYYY"`). Các hàm: `appendActivityLog`, `loadActivityLogs`, `migrateLogsOnBaseFolderChange`, `preserveLogsAfterBackupRestore`, `dismissCorruptedLogNotice`. |
| `src/input/activity-log.js` | Module độc lập tại Renderer Process phụ trách ẩn thông tin nhạy cảm (PII masking), ghi nhận sự kiện cho 5 phân nhóm (`logSettingsAndPricingChanges`, `logBankSettingsChange`, `logUnlockMonthEvent`, `logCancelMonthEditEvent`, `logMonthSaveAndExportEvent`, `logRolloverConfirmedEvent`, `logAnomalyConfirmedEvent`, `logAddResidentEvent`, `logUpdateResidentEvent`, `logDeleteResidentEvent`, `logRoomDetailAssignmentEvent`, `logExportResidentsExcelEvent`, `logZaloSendBatchEvent`, `logBackupExecutionResult`) và điều khiển giao diện Modal Nhật Ký Hoạt Động (`openActivityLogModal`, `renderActivityLogList`, `toggleActivityLogDetail`). |

---

## 8. Phân Hệ Break Chỉ Số Giữa Tháng (`meter-breaks`)

| File | Vai trò & Các hàm / Ký hiệu chính |
|---|---|
| `src/input/meter-break-modal.js` | Module UI & Logic 2 bước cho Modal **Break chỉ số Điện / Nước** (`#meter-break-modal`, font chữ tối thiểu `16px`). Quản lý store `window.meterBreaksStore`, hàm `loadMeterBreaksStore`, `getRoomMeterBreakRecord`, `openMeterBreakModal`, `closeMeterBreakModal`, `goToMeterBreakStep`, `handleMbStep2Back`, `evaluateMeterBreakSection`, `openMbMissingPrevModal`, `openMbRolloverPopup`, `cancelMbRolloverModal`, `confirmMbRolloverModal`, `handleToggleEditMbRecordClick`, `confirmUnlockMbRecordForEditing`, `buildMbActivityLogDiff`, `handleSaveMeterBreak`, `handleDeleteSectionMeterBreak`, `handleDeleteRoomMeterBreaks`, `syncMeterBreakToMainTable`, `renderMeterBreakHistoryList`, `openMeterBreakHistoryCard`. |
| `electron/main.js` & `electron/preload.js` | Bổ sung `getMeterBreaksFilePath`, `normalizeMeterBreaksData`, `writeMeterBreaksAtomic` và các IPC `meter-breaks:load`, `meter-breaks:save-room`, `meter-breaks:save-month` (Preload API: `loadMeterBreaks`, `saveRoomMeterBreak`, `saveMonthMeterBreaks`). |
| `src/shared/format.js` & `src/input/month-excel.js` | Bổ sung `formatRoomMeterBreakNotes(roomMbRecord)` tạo chuỗi ghi chú Break; `month-excel.js` kết hợp `mcNotes.excelNote` và `mbNotes.excelNote` vào cột `Q: Ghi Chú`. |
| `src/input/renderer.js` & `src/input/meter-change-modal.js` | Tích hợp nạp `loadMeterBreaksStore()`, lưu `originalPrevDien` / `hadOriginalPrevDien` / `originalPrevNuoc` / `hadOriginalPrevNuoc` + `hasMbElec` / `hasMbWater` khi tải tháng; đồng bộ hoàn tác `meterBreaksStore` trong `confirmUnlockMonthForEditing` & `restoreLockedMonthFromBackup`; hiển thị pill `✂️` (`.meter-mb-pill`, `.mb-locked-input`); bỏ qua ẩn bất thường 40% khi `hasMbElec`; chặn trùng loại ĐH (Phương án 1) hai chiều với `#meter-change-modal`. |
| `e2e/test-meter-break-e2e.js` | Bộ kiểm thử E2E trên app Electron thật (CDP, cô lập hoàn toàn trong `os.tmpdir()`) kiểm tra vị trí nút, cỡ chữ `>= 16px`, khóa tuần tự, popup quay vòng, đồng bộ bảng chính, loại trừ lẫn nhau, xuất Phiếu Thu / Excel Cột Q / Zalo và khôi phục tháng khóa. |
| `electron/main.js` (vòng đời cửa sổ) | Bổ sung khóa đơn tiến trình (`app.requestSingleInstanceLock()`, `second-instance`, `mainWindowRef`), tắt menu hệ thống (`Menu.setApplicationMenu(null)`, `removeMenu()`, `autoHideMenuBar: true`), giữ `F5`/`Ctrl+R` và phím Zoom (`Ctrl++`/`=`, `Ctrl+Shift++`, `Ctrl+-`, `Ctrl+Shift+-`, `Ctrl+0`) trong `before-input-event`, chặn `setWindowOpenHandler`, và khóa `devTools: !app.isPackaged` + chặn phím tắt DevTools khi đóng gói (giữ `F12` / `Ctrl+Shift+I` / `Ctrl+Shift+J` gọi `toggleDevTools()` khi chạy dev). |
| `src/input/resident-search.js` | Module tìm kiếm người thuê thuần Vanilla JS (dùng chung Browser & Node). Các hàm chính: `normalizeCharVi`, `normalizeSearchWithTone`, `normalizeSearchNoTone`, `damerauLevenshtein`, `getFuzzyWordMatch`, `parseResidentSearchQuery`, `tokenizeSearchQuery`, `buildResidentSearchEntry`, `getIndexedResidents`, `invalidateResidentSearchCache`, `getFilteredAndRankedResidents`, `highlightSearchText`. |
| `src/input/renderer.js` (tìm kiếm Phần 3) | Loại bỏ định nghĩa `removeVietnameseTones` trùng lặp (giữ duy nhất bản không `.trim()` cho Chủ TK ngân hàng), tích hợp `compositionstart`/`compositionend` cho bộ gõ Unikey/EVKey, và cập nhật `updateResidentSearchBoxUI`, `filterResidentsTable`, `renderResidentsTable` hỗ trợ trạng thái `isFuzzyFallback` và highlight từ khóa Pha 2. |
| `src/input/renderer.js` (Freeze Panes Phần 1 & Phần 3) | Bổ sung `initTableFreezePanes()` (gắn trên `.app-main` `scroll`, `.table-wrapper` `scroll`, `.table-sticky-scrollbar` `scroll`, `window` `resize` và `ResizeObserver`), `syncStickyTableHeaders()` (tính `--sticky-head-y`, `--rooms-col-stt-w`, `--res-col-stt-left`, `--res-col-name-left`, `.is-scrolled-x` / `.is-scrolled-y` và đồng bộ 2 chiều thanh cuộn ngang ghim đáy `#rooms-sticky-scrollbar` / `#residents-sticky-scrollbar`) và `syncHeaderCompactMode()` co gọn Header theo ngưỡng (`header-compact-log`, `header-compact-minmax`, `header-compact-ultra`); gọi đồng bộ trong `forceSwitchTab()`, `renderInitialTable()`, `handleInputChange()` và `renderResidentsTable()`. |
| `electron/month-excel-service.js` & `electron/excel-service.js` | Bổ sung phần tử OpenXML `<pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/>` và `<selection pane="bottomRight" activeCell="C2" sqref="C2"/>` trong `<sheetView>` để đóng băng Hàng 1 và Cột A:B ở cả 2 file `.xlsx` xuất ra. |

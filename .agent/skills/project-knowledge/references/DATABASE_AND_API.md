# 💾 Cấu Trúc Dữ Liệu & Danh Mục Kênh IPC (Database & API)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Kiểu lưu trữ:** File JSON Cục Bộ (Local JSON Storage) + Cấu Trúc Thư Mục Phân Cấp  
> **Giao thức kết nối:** Electron IPC (`ipcRenderer.invoke` ↔ `ipcMain.handle`, `webContents.send` ↔ `ipcRenderer.on`)

---

## 1. Kiến Trúc Lưu Trữ Dữ Liệu Cục Bộ (Local Storage Schema)

Ứng dụng không sử dụng bất kỳ hệ quản trị cơ sở dữ liệu server nào (như MySQL, MongoDB hay SQLite). Toàn bộ dữ liệu được tổ chức dưới dạng các tệp JSON có cấu trúc chặt chẽ và thư mục tệp tin trên ổ đĩa.

```
<Hệ Thống Máy Tính>
├── app.getPath('userData')/
│   ├── pointer.json                          # Con trỏ điều hướng thư mục
│   └── zalo_session.json                     # Thông tin phiên đăng nhập Zalo (Chính)
│
└── <baseFolder>/                             # Thư mục người dùng chọn (D:\QuanLyPhongTro)
    ├── data/
    │   ├── settings.json                     # Cài đặt giá, tùy chọn popup & ngân hàng
    │   ├── rooms.json                        # Danh mục 12 phòng & phân bổ người ở
    │   ├── residents.json                    # Hồ sơ toàn bộ người thuê trọ
    │   ├── zalo_session.json                 # Bản sao lưu phiên Zalo
    │   ├── history/
    │   │   ├── 2026-07.json                  # Chỉ số điện nước tháng 07/2026
    │   │   └── YYYY-MM.json                  # Lịch sử các tháng tiếp theo
    │   └── Thông tin người ở/                # Thư mục lưu trữ ảnh CCCD
    │       ├── 1A/
    │       │   └── Le Cong Ba Nhan_0152/
    │       │       ├── front.jpg             # Ảnh CCCD mặt trước
    │       │       └── back.jpg              # Ảnh CCCD mặt sau
    │       └── [Số phòng]/[Tên]_[4 số cuối CCCD]/
    │
    └── PhieuThu/
        ├── Thang_07_2026/
        │   ├── Phong-1A.jpg                  # Ảnh phiếu thu phòng 1A (3x scale)
        │   ├── Phong-XX.jpg                  # 12 file ảnh của 12 phòng
        │   └── Thang_07_2026.pdf             # File PDF gộp 12 trang A4 ngang
        └── Thang_MM_YYYY/
```

---

## 2. Chi Tiết Schema Của Các Tệp JSON

### 2.1. Tệp Con Trỏ: `pointer.json`
- **Vị trí**: `app.getPath('userData')/pointer.json` (VD: `C:\Users\<User>\AppData\Roaming\Quản Lý Phòng Trọ\pointer.json`).
- **Mục đích**: Lưu con trỏ tới thư mục làm việc thực tế do người dùng chỉ định.
- **Cấu trúc JSON**:
```json
{
  "baseFolder": "D:\\QuanLyNhaTro",
  "dataFolderName": "data",
  "phieuThuFolderName": "PhieuThu"
}
```

### 2.2. Tệp Cài Đặt Hệ Thống: `settings.json`
- **Vị trí**: `<baseFolder>/data/settings.json`.
- **Mục đích**: Lưu trữ thông tin đơn giá, cờ bật/tắt popup cảnh báo, thông tin liên hệ và tài khoản ngân hàng.
- **Cấu trúc JSON**:
```json
{
  "appId": "phong-tro-app",
  "baseFolder": "D:\\QuanLyNhaTro",
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
  "enableAnomalyPopup": true,
  "bankName": "MB",
  "bankAccount": "0982141407",
  "bankOwner": "LE CONG BA NHAN",
  "zaloSendReceiptImage": true,
  "zaloSendPaymentQr": true,
  "zaloSendMessageText": true,
  "zaloMessageTemplate": "",
  "confirmedAlerts": {
    "2026-07": {
      "1A": { "rollover": true, "dienMoi": 5200 },
      "2A": { "anomaly": true, "dienMoi": 20599 }
    }
  }
}
```
*Lưu ý:*
- `confirmedAlerts`: Lưu trữ vĩnh viễn các trạng thái xác nhận cảnh báo công tơ quay vòng (`rollover: true`) hoặc tiêu thụ bất thường (\ge 40%, `anomaly: true`) cho từng phòng theo từng chu kỳ tháng (`YYYY-MM`). Nhờ đó, khi chuyển đổi qua lại giữa các tháng hoặc khởi động lại ứng dụng, hệ thống không bao giờ bị quên trạng thái xác nhận và giữ nguyên biểu tượng badge `(!)`.
- `rac`, `internet`, `tileHaoTai` được lưu đồng thời để tương thích ngược với các phiên bản cũ.
- Các trường tùy chọn gửi Zalo (`zaloSendReceiptImage`, `zaloSendPaymentQr`, `zaloSendMessageText`) mặc định là `true` nếu chưa từng lưu.
- Trường `zaloMessageTemplate` lưu chuỗi mẫu tin nhắn tùy biến; nếu chuỗi rỗng (`""`), hệ thống tự động sử dụng mẫu tin nhắn mặc định ban đầu.

### 2.3. Tệp Danh Mục Phòng: `rooms.json`
- **Vị trí**: `<baseFolder>/data/rooms.json`.
- **Mục đích**: Quản lý cố định 12 phòng (`1A`–`6A`, `1B`–`6B`), người đại diện nhận hóa đơn (`chuPhong`) và danh sách các thành viên cùng phòng (`thanhVien`).
- **Cấu trúc JSON**:
```json
[
  {
    "phong": "1A",
    "tenKhach": "Lê Công Bá Nhân",
    "cmnd": "051209000152",
    "chuPhong": "person_1788676064549",
    "thanhVien": [
      "person_1788676064550"
    ]
  },
  {
    "phong": "2A",
    "tenKhach": "",
    "cmnd": "",
    "chuPhong": null,
    "thanhVien": []
  }
]
```

### 2.4. Tệp Hồ Sơ Cư Dân: `residents.json`
- **Vị trí**: `<baseFolder>/data/residents.json`.
- **Mục đích**: Lưu thông tin chi tiết của tất cả người thuê trọ trong hệ thống.
- **Cấu trúc JSON**:
```json
[
  {
    "id": "person_1788676064549",
    "hoTen": "Lê Công Bá Nhân",
    "cccd": "051209000152",
    "sdtGoi": "0978141407",
    "sdtZalo": "0978141407",
    "ngaySinh": "31/01/2009",
    "gioiTinh": "Nam",
    "email": "nhan@example.com",
    "ngayVaoO": "06/09/2026",
    "phong": "1A",
    "cccdFront": "Thông tin người ở/1A/Le Cong Ba Nhan_0152/front.jpg",
    "cccdBack": "Thông tin người ở/1A/Le Cong Ba Nhan_0152/back.jpg"
  }
]
```

### 2.5. Tệp Lịch Sử Chỉ Số Tháng: `history/YYYY-MM.json`
- **Vị trí**: `<baseFolder>/data/history/YYYY-MM.json` (VD: `2026-07.json`).
- **Mục đích**: Lưu chỉ số điện và nước ghi nhận trong tháng của 12 phòng.
- **Cấu trúc JSON**:
```json
[
  {
    "phong": "1A",
    "dienCu": 5302,
    "dienMoi": 5379,
    "nuocCu": 577,
    "nuocMoi": 583,
    "confirmedRollover": false,
    "confirmedAnomaly": true
  },
  {
    "phong": "2A",
    "dienCu": 10936,
    "dienMoi": 11024,
    "nuocCu": 806,
    "nuocMoi": 811
  }
]
```

### 2.6. Tệp Phiên Đăng Nhập Zalo: `zalo_session.json`
- **Vị trí**: `app.getPath('userData')/zalo_session.json` và sao lưu tại `<baseFolder>/data/zalo_session.json`.
- **Mục đích**: Lưu cookie, IMEI và thông tin xác thực để khôi phục phiên Zalo tự động.
- **Cấu trúc JSON**:
```json
{
  "credentials": {
    "cookie": "zpw_sek=...; _zlang=vi; ...",
    "imei": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "userAgent": "Mozilla/5.0 ...",
    "language": "vi"
  },
  "profile": {
    "userId": "1234567890",
    "displayName": "Chủ Nhà Trọ",
    "avatar": "https://s120-ava-talk.zadn.vn/...",
    "phoneNumber": "0982141407"
  },
  "savedAt": 1788676064000
}
```

---

### 2.7. Tệp Khóa Dữ Liệu Tháng & Snapshot Đơn Giá: `month-locks.json`
- **Vị trí**: `<baseFolder>/data/month-locks.json`.
- **Mục đích**: Quản lý trạng thái khóa các tháng đã Lưu & Xuất, lưu snapshot bộ đơn giá lịch sử tại thời điểm xuất để bảo toàn số tiền cũ khi Cài Đặt Chung thay đổi, giữ nguyên 100% cấu trúc mảng JSON thuần `[...]` của `history/YYYY-MM.json`.
- **Cấu trúc JSON**:
```json
{
  "version": 1,
  "months": {
    "2026-07": {
      "isLocked": true,
      "exportedAt": "2026-11-05T14:30:00.000Z",
      "settingsSnapshot": {
        "giaPhong": 2200000,
        "giaDien": 2900,
        "giaNuoc": 12000,
        "tienRac": 40000,
        "tienInternet": 24000,
        "tyLeHaoTai": 0.07,
        "dienThoai": "0982 141 407"
      }
    }
  },
  "legacyScanned": ["2026-07"]
}
```

## 3. Danh Mục Toàn Bộ Kênh Giao Tiếp IPC (IPC Channels Map)

Các kênh IPC được phơi ra thông qua `window.api` trong `electron/preload.js` và xử lý tại `electron/main.js`.

### 3.1. Nhóm Quản Lý Hệ Thống & Cài Đặt

| Tên Channel | Kiểu | Tham số đầu vào | Kết quả trả về | Mô tả chức năng |
|---|---|---|---|---|
| `app:get-version` | `invoke` | Không | `string` (VD: `"3.0.1"`) | Lấy phiên bản từ `package.json` |
| `dialog:pick-folder` | `invoke` | Không | `string` (đường dẫn) hoặc `null` | Mở hộp thoại chọn thư mục Windows |
| `dialog:pick-image` | `invoke` | Không | `{ filePath, fileName, dataUrl }` hoặc `null` | Mở hộp thoại chọn ảnh CCCD |
| `settings:load` | `invoke` | Không | `Object` (settings) hoặc `null` | Đọc cài đặt từ file `settings.json` qua `pointer.json` |
| `settings:save` | `invoke` | `data` (Object cài đặt) | `{ success: true, baseFolder }` hoặc `{ error }` | Lưu cài đặt, tự động sao chép toàn bộ dữ liệu nếu đổi thư mục |

### 3.2. Nhóm Quản Lý Lịch Sử Tháng & Xuất Phiếu

| Tên Channel | Kiểu | Tham số đầu vào | Kết quả trả về | Mô tả chức năng |
|---|---|---|---|---|
| `month-data:load` | `invoke` | `monthKey` (VD: `"2026-07"`) | `Array[12]` hoặc `null` | Đọc dữ liệu tháng từ thư mục `history/` |
| `month-data:save` | `invoke` | `monthKey`, `data` (Array[12]) | `{ success: true, filePath }` hoặc `{ error }` | Ghi dữ liệu tháng vào thư mục `history/` |
| `export:receipts` | `invoke` | `monthKey`, `roomDataList` | `{ success: true, jpgCount, pdfFile, targetDir }` | Render 12 ảnh JPG (3x) + 1 file PDF gộp, tự mở Explorer |
| `export:progress` | `on (event)` | Callback | `{ current, total }` | Stream tiến trình xuất file (1 đến 12) |
| `month-locks:load` | `invoke` | Không | `{ ok, data, exportedMonths }` | Đọc trạng thái khóa các tháng + danh sách tháng đã xuất |
| `month-locks:save` | `invoke` | `data` (Object) | `{ success: true }` hoặc `{ error }` | Lưu trạng thái khóa và snapshot đơn giá (ghi atomic qua .tmp) |

### 3.3. Nhóm Quản Lý Phòng, Cư Dân & Ảnh CCCD

| Tên Channel | Kiểu | Tham số đầu vào | Kết quả trả về | Mô tả chức năng |
|---|---|---|---|---|
| `residents:load` | `invoke` | Không | `Array` danh sách cư dân | Đọc danh sách người thuê từ `residents.json` |
| `residents:save` | `invoke` | `data` (Array cư dân) | `{ success: true }` hoặc `{ error }` | Lưu danh sách người thuê vào `residents.json` |
| `rooms:load` | `invoke` | Không | `Array[12]` danh sách phòng | Đọc danh sách 12 phòng từ `rooms.json` |
| `rooms:save` | `invoke` | `data` (Array phòng) | `{ success: true }` hoặc `{ error }` | Lưu phân bổ chủ phòng & thành viên vào `rooms.json` |
| `cccd:save-image` | `invoke` | `{ roomName, personName, cccd, type, dataUrl }` | `{ success: true, relativePath, fileName }` | Lưu file ảnh CCCD vào thư mục chuẩn |
| `cccd:move-folder` | `invoke` | `{ oldRoom, newRoom, personName, cccd, ... }` | `{ success: true, newRelativeFolder }` | Đổi tên/di chuyển thư mục ảnh khi người đổi phòng/tên |
| `cccd:delete-folder` | `invoke` | `{ roomName, personName, cccd }` | `{ success: true }` | Xóa vĩnh viễn thư mục ảnh CCCD khi xóa người thuê |
| `cccd:read-image` | `invoke` | `relativePath` (string) | `string` (Base64 Data URL) hoặc `null` | Đọc ảnh CCCD từ đĩa trả về Data URL phục vụ Lightbox |
| `residents:export-excel` | `invoke` | `{ baseFolder }` | `{ success, fileName, filePath, totalExported }` | Xuất toàn bộ danh sách người thuê ra file `.xlsx` lưu trực tiếp tại `BaseFolder` |
| `residents:show-excel-in-folder` | `invoke` | `filePath` (string) | `{ ok: true }` hoặc `{ ok: false, message }` | Mở Windows Explorer và bôi đen file Excel vừa xuất |

### 3.4. Nhóm Tích Hợp Zalo (`zca-js`)

| Tên Channel | Kiểu | Tham số đầu vào | Kết quả trả về | Mô tả chức năng |
|---|---|---|---|---|
| `zalo:get-status` | `invoke` | Không | `{ connected, profile, isLoginInProgress }` | Lấy trạng thái đăng nhập, tự restore nếu có session |
| `zalo:start-qr-login` | `invoke` | Không | `{ success: true, profile }` hoặc `{ error }` | Bắt đầu phiên quét mã QR đăng nhập |
| `zalo:abort-qr-login` | `invoke` | Không | `{ success: true }` | Hủy bỏ phiên quét mã QR an toàn |
| `zalo:retry-qr-login` | `invoke` | Không | `{ retrying: true }` | Tạo lại mã QR mới khi mã cũ hết hạn |
| `zalo:logout` | `invoke` | Không | `{ success: true }` | Đăng xuất và xóa sạch session trên đĩa |
| `zalo:qr-event` | `on (event)` | Callback | `{ type, ...data }` | Stream sự kiện QR (`qr_generated`, `qr_scanned`, `expired`, `success`) |
| `zalo:send-receipts` | `invoke` | `{ monthKey, roomTasks, appSettings }` | `{ total, successCount, failedCount, results }` | Thực hiện gửi tuần tự phiếu thu + VietQR + text cho các phòng |
| `zalo:send-progress` | `on (event)` | Callback | `{ current, total, phong }` | Stream tiến trình gửi từng phòng |

### 3.5. Nhóm Tự Động Cập Nhật (Auto Updater)

| Tên Channel | Kiểu | Tham số đầu vào | Kết quả trả về | Mô tả chức năng |
|---|---|---|---|---|
| `updater:check` | `invoke` | Không | `{ success: true, updateInfo }` hoặc `{ error }` | Kiểm tra bản mới trên GitHub Releases |
| `updater:start-download` | `invoke` | Không | `{ success: true }` hoặc `{ error }` | Bắt đầu tải bản cập nhật ngầm |
| `updater:update-available` | `on (event)` | Callback | `{ version, releaseDate, releaseNotes }` | Sự kiện có phiên bản mới |
| `updater:update-not-available`| `on (event)` | Callback | `{ version }` | Sự kiện đang ở phiên bản mới nhất |
| `updater:download-progress` | `on (event)` | Callback | `{ percent, bytesPerSecond, transferred, total }` | Sự kiện tiến trình tải (%) |
| `updater:update-downloaded` | `on (event)` | Callback | `{ version }` | Sự kiện tải xong 100%, chuẩn bị tự cài ngầm |
| `updater:error` | `on (event)` | Callback | `{ message }` | Sự kiện lỗi kết nối máy chủ GitHub |

---

## 4. Tích Hợp Dịch Vụ Bên Ngoài (Third-Party Integrations)

1. **GitHub Releases API**:
   - Tự động kết nối qua `electron-updater` tới repo: `https://github.com/myheo0229/Project-tools-phongtro`.
   - File cấu hình: `release/latest.yml` và `package.json` (`build.publish`).
2. **VietQR API (`https://img.vietqr.io/image/...`)**:
   - Tạo mã VietQR chuẩn Napas247 động theo URL:
     `https://img.vietqr.io/image/{bankBin}-{bankAccount}-compact2.png?amount={tongCong}&addInfo={noiDung}&accountName={bankOwner}`
   - Định dạng nội dung chuyển khoản tự động:
     `[Tên chủ phòng] phong [Số phòng] thang [MM/YYYY]`
3. **MoMo CDN Logo Ngân Hàng**:
   - Địa chỉ: `https://img.mservice.com.vn/momo_app_v2/img/{BANK_CODE}.png`.
   - Nạp tự động vào dropdown tìm kiếm ngân hàng trong Tab Cài Đặt Chung.

---

## 7. Cấu Trúc Lưu Trữ & Kênh IPC Hệ Thống Backup Data

### 7.1. File cấu hình & Token tại `app.getPath('userData')`
1. **`backup-config.json`**:
   - `connectedEmail`, `connectedName`: Thông tin tài khoản Google đang kết nối.
   - `targetDriveFolderId`, `targetDriveFolderName`: Folder ID và tên thư mục đích trên Google Drive.
   - `driveBackupDataFolderId`: Folder ID của thư mục con `BackupData` trên Google Drive.
   - `localBackupFolderPath`: Đường dẫn `BaseFolder/BackupData` trên máy tính.
   - `lastBackupInfo`: Thông tin lần sao lưu gần nhất (`lastBackupAt`, `zipFileName`, `zipSizeBytes`, `zipSizeFormatted`, `uploadStatus`, `completedAt`, `driveFileId`).
2. **`backup-tokens.enc`**:
   - Lưu `access_token`, `refresh_token`, `expiry_date` đã được mã hóa qua `safeStorage` (Windows DPAPI).

### 7.2. Danh sách kênh IPC Backup
- `backup:get-state`: Lấy trạng thái tổng hợp của hệ thống Backup.
- `backup:check-health`: Kiểm tra kết nối mạng, tài khoản Google, dung lượng trống trên Drive và tình trạng thư mục đích.
- `backup:google-login` / `backup:google-cancel-login` / `backup:google-logout`: Đăng nhập, hủy chờ đăng nhập và ngắt kết nối Google OAuth 2.0.
- `backup:configure-folder`: Kiểm tra/lưu Folder ID hoặc tạo thư mục backup trên Google Drive.
- `backup:save-oauth-client` / `backup:pick-oauth-json`: Cấu hình hoặc chọn file JSON OAuth Client ID.
- `backup:start` & sự kiện `backup:progress`: Thực thi quy trình Backup Data 7 giai đoạn và phát tiến độ thời gian thực về Renderer.
- `backup:open-local-folder` / `backup:open-drive-folder`: Mở nhanh thư mục `BaseFolder/BackupData` trên máy tính hoặc trên Google Drive.

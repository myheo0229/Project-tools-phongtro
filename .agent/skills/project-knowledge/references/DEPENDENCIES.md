# 📦 Quản Lý Thư Viện & Phụ Thuộc (Dependencies)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Mục tiêu:** Phân tích chi tiết toàn bộ các thư viện bên thứ ba đang sử dụng, phiên bản, mục đích và mức độ ảnh hưởng đến hệ thống.

---

## 1. Bảng Tổng Hợp Thư Viện Sản Xuất (Runtime Dependencies)

Khai báo tại khối `"dependencies"` trong [`package.json`](file:///d:/2.%20GauGau/Project-tools-phongtro/package.json):

| Thư viện | Phiên bản | Mức độ ảnh hưởng | Mục đích sử dụng trong dự án | Vị trí sử dụng chính |
|---|---|---|---|---|
| **`electron-updater`** | `^6.8.9` | 🔴 Rất cao | Tự động kiểm tra bản phát hành mới trên GitHub Releases, tải bản nâng cấp ngầm và tự động đóng app để cài đặt bản mới (NSIS Silent Install). | `electron/main.js` |
| **`pdf-lib`** | `^1.17.1` | 🔴 Rất cao | Tạo tài liệu PDF mới và gộp 12 trang PDF đơn lẻ (xuất từ 12 phòng) thành một tệp PDF tổng duy nhất (`Thang_MM_YYYY.pdf`). | `electron/main.js` |
| **`pdfjs-dist`** | `^3.11.174` | 🔴 Rất cao | Đọc buffer tài liệu PDF và kết xuất (render) từng trang lên thẻ Canvas để chuyển đổi sang ảnh JPEG độ nét cao (tỷ lệ phóng đại 3x scale). | `electron/rasterizer.html`, `electron/vendor/pdfjs/` |
| **`sharp`** | `^0.35.4` | 🟡 Trung bình | Trích xuất thông số metadata của hình ảnh (chiều cao `height`, chiều rộng `width`, dung lượng `size`) phục vụ hàm `imageMetadataGetter` của `zca-js` v2+. | `electron/zalo-manager.js` |
| **`zca-js`** | `2.1.2` | 🔴 Rất cao | Giao thức kết nối tới máy chủ Zalo (Zalo Web Protocol): Quản lý luồng quét mã QR đăng nhập thời gian thực, lưu trữ cookie session và gửi tin nhắn/ảnh hóa đơn tự động. | `electron/zalo-manager.js` |

---

## 2. Bảng Tổng Hợp Thư Viện Phát Triển (Development Dependencies)

Khai báo tại khối `"devDependencies"` trong [`package.json`](file:///d:/2.%20GauGau/Project-tools-phongtro/package.json):

| Thư viện | Phiên bản | Mục đích sử dụng |
|---|---|---|
| **`electron`** | `^43.2.0` | Nền tảng desktop framework chứa Chromium và Node.js, cung cấp API quản lý cửa sổ và tiến trình. |
| **`electron-builder`** | `^25.1.8` | Công cụ đóng gói ứng dụng thành file cài đặt Windows NSIS (`.exe`) và tự động xuất bản (publish) lên GitHub Releases. |

---

## 3. Phân Tích Chuyên Sâu Từng Thư Viện

### 3.1. `electron-updater` (`^6.8.9`)
- **Vai trò**: Cung cấp tính năng Tự Động Cập Nhật (Auto Update) mà không cần người dùng tải lại phần mềm thủ công.
- **Cách thức hoạt động**:
  - Khi khởi động, gọi `autoUpdater.checkForUpdates()`.
  - Kết nối tới GitHub repository `myheo0229/Project-tools-phongtro`.
  - So sánh phiên bản trong `package.json` với phiên bản trên file `latest.yml` của GitHub Release mới nhất.
  - Cấu hình quan trọng:
    - `autoUpdater.autoDownload = false`: Không tự ý tải ngầm làm chậm mạng của người dùng, chỉ tải khi người dùng bấm "Cập nhật ngay".
    - `autoUpdater.autoInstallOnAppQuit = true`: Tự động cài đặt khi ứng dụng thoát.
  - Khi tải hoàn tất (sự kiện `update-downloaded`), hệ thống phát thông báo Windows Native Notification, đếm ngược 3.5 giây trên giao diện rồi gọi:
    `autoUpdater.quitAndInstall(true, true)`
    để cài đặt ngầm hoàn toàn (Silent Install).

### 3.2. `pdf-lib` (`^1.17.1`)
- **Vai trò**: Thư viện xử lý PDF thuần JavaScript không phụ thuộc môi trường C++.
- **Tối ưu hóa hiệu năng**:
  - File `pdf-lib` có dung lượng tương đối lớn. Nếu `require('pdf-lib')` ngay đầu file `main.js`, ứng dụng sẽ bị giật trắng khoảng 0.5s – 1s khi mở.
  - Do đó, dự án áp dụng kỹ thuật **Preload ngầm có độ trễ**:
    ```javascript
    function preloadPdfLibInBackground() {
      setTimeout(() => {
        try { pdfLibModule = require('pdf-lib'); } catch (err) {}
      }, 1500); // Nạp ngầm sau 1.5 giây
    }
    ```
  - Khi người dùng bấm xuất phiếu, hàm `getPdfLib()` sẽ lấy ngay instance đã được cache sẵn trong bộ nhớ.

### 3.3. `pdfjs-dist` (`^3.11.174`)
- **Vai trò**: Thư viện kết xuất PDF chính thức của Mozilla.
- **Vị trí đóng gói**:
  - Để đảm bảo ứng dụng hoạt động ngoại tuyến 100% không cần kết nối mạng để nạp worker, dự án lưu trực tiếp bản build vào:
    `electron/vendor/pdfjs/pdf.js` và `electron/vendor/pdfjs/pdf.worker.js`.
  - Trong `rasterizer.html`, worker được trỏ cục bộ:
    `pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.js';`
- **Tỷ lệ phóng đại (Scale = 3)**:
  - Bản xuất từ `webContents.printToPDF` có độ phân giải gốc của khổ in A4. Khi vẽ lên Canvas với `scale: 3`, ảnh JPEG đầu ra có kích thước xấp xỉ `3369 x 2382 px`, đảm bảo các chữ số tiền, số điện in trên hóa đơn cực kỳ sắc nét.

### 3.4. `sharp` (`^0.35.4`)
- **Vai trò**: Thư viện C++ Native Module chuyên xử lý ảnh tốc độ cao.
- **Ràng buộc quan trọng**:
  - `zca-js` từ phiên bản 2.x trở lên yêu cầu cung cấp hàm `imageMetadataGetter` trả về `{ width, height, size }` của ảnh đính kèm trước khi tải lên Zalo.
  - Vì `sharp` chứa mã nhị phân C++ (prebuild native binary), khi chạy trên Windows bắt buộc phải dùng phiên bản tương thích với kiến trúc CPU (x64) và phiên bản Node/Electron tương ứng.
  - Khi build ứng dụng qua `electron-builder`, công cụ sẽ tự động chạy `electron-rebuild` để khớp ABI nhị phân của `sharp` với phiên bản Electron `v43.2.0`.

### 3.5. `zca-js` (`2.1.2`)
- **Vai trò**: Thư viện JavaScript không chính thức (Unofficial) mô phỏng giao thức của ứng dụng Zalo Web.
- **Đặc điểm kỹ thuật**:
  - Cho phép người dùng quét mã QR trực tiếp trên màn hình máy tính bằng ứng dụng Zalo trên điện thoại.
  - Thu thập cookie phiên làm việc (`cookie`, `imei`, `userAgent`) và lưu vào tệp JSON mã hóa nhẹ.
  - Hỗ trợ các API: `findUser(phone)` (tìm UID từ số điện thoại), `sendMessage({ msg, attachments }, targetUid)` (gửi tin nhắn kèm ảnh phiếu thu).
- **Lưu ý bảo trì & rủi ro**:
  - Giao thức Zalo Web có thể thay đổi cấu trúc cookie hoặc API từ phía máy chủ Zalo theo thời gian. Khi đó, cần cập nhật phiên bản mới của `zca-js` nếu xuất hiện lỗi đăng nhập.
  - Bắt buộc phải duy trì độ trễ ngẫu nhiên (Anti-ban Delay: 3.0s – 4.5s) khi gửi hàng loạt để tránh tài khoản của chủ trọ bị Zalo hạn chế tính năng nhắn tin cho người lạ.

---

## 4. Ràng Buộc Công Nghệ Frontend (Zero Frontend Dependencies)

> [!IMPORTANT]
> **Điểm đặc biệt của dự án**: Tầng giao diện người dùng (Renderer Process) **HOÀN TOÀN KHÔNG CÓ THƯ VIỆN BÊN NGOÀI**.
> - Không React, Vue, Angular, Svelte.
> - Không jQuery, Axios, Lodash.
> - Không Bootstrap, Tailwind CSS, Ant Design.
> - Toàn bộ DOM manipulation đều viết bằng Vanilla JavaScript thuần (ES6+).
> - Toàn bộ kiểu dáng đều viết bằng CSS3 nguyên bản.
> 
> **Mọi AI Agent tuyệt đối không tự ý cài đặt thêm các thư viện frontend vào dự án này.**


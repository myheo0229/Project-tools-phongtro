# 🛠️ Hướng Dẫn Phát Triển & Quy Chuẩn Lập Trình (Development Guide)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Mục tiêu:** Hướng dẫn toàn diện quy trình thiết lập môi trường, quy chuẩn code, quy trình kiểm thử, quy trình nâng cấp phiên bản (Bump Version) và đóng gói phát hành.

---

## 1. Thiết Lập Môi Trường Làm Việc (Environment Setup)

### 1.1. Yêu cầu tiên quyết
- **Hệ điều hành**: Windows 10/11 (64-bit).
- **Node.js**: Phiên bản LTS $\ge 18.x$ (Kiểm tra: `node -v`).
- **npm**: Phiên bản $\ge 9.x$ (Kiểm tra: `npm -v`).
- **Git**: Đã cài đặt Git for Windows.

### 1.2. Khởi tạo dự án
```bash
# Cài đặt tất cả các dependencies
npm install

# Khởi chạy ứng dụng trong môi trường phát triển (Hot restart)
npm start
```

---

## 2. Quy Chuẩn Lập Trình Bắt Buộc (Coding Standards)

### 2.1. Kiến Trúc Thuần Túy (Pure Vanilla Architecture)
- **Tuyệt đối không đưa framework vào giao diện**: Không sử dụng React, Vue, Angular, Svelte, Tailwind CSS, Bootstrap hay jQuery.
- **Tương tác DOM nguyên bản**: Sử dụng các API chuẩn `document.getElementById()`, `document.querySelector()`, `addEventListener()`, `classList`.
- **An toàn chuỗi HTML**: Luôn sử dụng hàm `escapeHtml()` khi render chuỗi do người dùng nhập vào thuộc tính HTML hoặc `innerHTML` để chống tấn công XSS.

### 2.2. Quy Ước Đặt Tên (Naming Conventions)
1. **Biến & Hàm nghiệp vụ**: Sử dụng kiểu `camelCase`, đặt tên bằng **Tiếng Việt không dấu** phản ánh chính xác nghiệp vụ quản lý nhà trọ:
   - *Ví dụ đúng*: `dienCu`, `dienMoi`, `dienTieuThu`, `giaDien`, `tienPhong`, `tyLeHaoTai`, `loadRoomsForMonth`, `saveAndExport`, `calcRoom`, `formatMoney`.
   - *Tránh*: Đặt tên tiếng Anh lai tạp khó hiểu (`oldElectricity`, `newPower`, `housePrice`).
2. **Hằng số**: Sử dụng kiểu `UPPER_SNAKE_CASE`:
   - `MAX_DONG_HO_DIEN = 10000`, `DEFAULT_ROOM_NAMES`, `PROJECT_ROOT`, `POINTER_FILE`.
3. **HTML ID & CSS Class**: Sử dụng kiểu `kebab-case`:
   - `tab-btn`, `stat-card`, `btn-save-export`, `rollover-modal`, `update-progress-bar`.

### 2.3. Mô Hình Dual-Module Cho `src/shared/`
Mọi file trong `src/shared/` (`calc.js`, `format.js`, `banks-data.js`) bắt buộc phải tương thích đồng thời cả hai môi trường:
```javascript
// Dành cho Node.js / Electron Main Process
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { myFunction };
}

// Dành cho Trình duyệt / Electron Renderer Process
if (typeof window !== 'undefined') {
  window.myFunction = myFunction;
}
```

### 2.4. Nguyên Tắc An Toàn Dữ Liệu (Data Isolation)
1. 🚫 **Không bao giờ ghi dữ liệu người dùng ngược vào thư mục mã nguồn (`PROJECT_ROOT/data`)**. Mọi thao tác lưu đều phải đi qua `getActiveDataDir()` trỏ vào `baseFolder`.
2. 🚫 **Không đọc fallback dữ liệu dev sang máy khách**. Nếu file trong `baseFolder` không tồn tại, trả về mảng rỗng `[]` hoặc danh sách phòng mặc định trắng.

---

## 3. Quy Trình Kiểm Thử Độc Lập (Testing Procedures)

Vì dự án không sử dụng các framework test cồng kềnh (như Jest hay Mocha), việc kiểm thử logic tính toán được thực hiện trực tiếp thông qua lệnh thực thi Node.js:

### 3.1. Kiểm thử Công thức Tính Tiền (`calc.js`)
Mở PowerShell tại thư mục dự án và chạy:
```powershell
node -e "const { calcRoom } = require('./src/shared/calc.js'); const settings = { giaDien: 2900, giaNuoc: 12000, tyLeHaoTai: 0.07, tienRac: 40000, tienInternet: 24000 }; console.log('Bình thường:', calcRoom({ phong: '1A', dienCu: 500, dienMoi: 600, nuocCu: 10, nuocMoi: 15, tienPhong: 2200000 }, settings)); console.log('Quay vòng:', calcRoom({ phong: '2A', dienCu: 9950, dienMoi: 30, nuocCu: 10, nuocMoi: 15, tienPhong: 2200000 }, settings));"
```
*Kết quả kỳ vọng*:
- Bình thường: Điện tiêu thụ = 100 kWh.
- Quay vòng: Điện tiêu thụ = $(10.000 + 30) - 9.950 = 80$ kWh.

### 3.2. Kiểm thử Định Dạng Hiển Thị (`format.js`)
```powershell
node -e "const { formatMoney, formatDecimalVN } = require('./src/shared/format.js'); console.log(formatMoney(2200000)); console.log(formatDecimalVN(5.43));"
```
*Kết quả kỳ vọng*: `2.200.000` và `5,4`.

---

## 4. Quy Trình Nâng Cấp Phiên Bản (Bump Version) Chuẩn

Khi nâng cấp lên phiên bản mới `vX.Y.Z`, lập trình viên hoặc AI Agent **bắt buộc phải cập nhật đồng bộ đủ 5 file sau**:

### 📄 1. `package.json`
- Cập nhật dòng `"version"` ở đầu file: `"version": "X.Y.Z"`.

### 📄 2. `package-lock.json`
- Cập nhật 2 vị trí `"version": "X.Y.Z"` ở đầu file (khối root và khối `packages[""]`).

### 📄 3. `src/input/index.html` (Đúng 4 vị trí tĩnh)
1. Thẻ `<title>`: `<title>Màn Hình Nhập Liệu - Quản Lý Phòng Trọ vX.Y.Z</title>`
2. Thẻ hiển thị cạnh tiêu đề Header: `<span id="app-version-tag" class="title-version-tag">vX.Y.Z</span>`
3. Thẻ hiển thị trong Card Thông Tin Phiên Bản tab Cài Đặt Chung: `<strong id="settings-app-version" class="update-version-val">vX.Y.Z</strong>`
4. Thẻ hiển thị phiên bản đang dùng trong Modal Cập Nhật: `<strong id="update-curr-version">vX.Y.Z</strong>`

### 📄 4. `README.md`
- Cập nhật dòng: `**Phiên bản:** X.Y.Z`
- Cập nhật tên file installer: `Quản Lý Phòng Trọ_Setup_vX.Y.Z.exe`
- Cập nhật đường dẫn file output: `release/Quản Lý Phòng Trọ_Setup_vX.Y.Z.exe`

### 📄 5. `liệt kê thay đổi.txt`
- Thêm một khối mới ở cuối file tóm tắt các tính năng và sửa lỗi của phiên bản mới:
  ```text
  vX.Y.Z
  - Tóm tắt thay đổi 1
  - Tóm tắt thay đổi 2
  ```

---

## 5. Quy Trình Git & Đóng Gói Phát Hành (Build & Release)

### Bước 1: Git Commit & Tạo Tag
```powershell
git add .
git commit -m "vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

### Bước 2: Đóng Gói & Tự Động Xuất Bản Lên GitHub Releases
Mở PowerShell tại thư mục dự án và chạy:
```powershell
$env:GH_TOKEN="<GITHUB_PERSONAL_ACCESS_TOKEN>"
npx electron-builder --win --publish always
```

*Lệnh trên sẽ tự động biên dịch, ký mã (nếu có), đóng gói file cài đặt `.exe` trong thư mục `release/` và upload trực tiếp lên mục Releases của GitHub repo `myheo0229/Project-tools-phongtro`.*


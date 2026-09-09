---
name: quy-trinh-nang-cap-phien-ban
description: Quy trình chuẩn và danh sách tất cả các vị trí bắt buộc cập nhật mỗi khi nâng cấp phiên bản (bump version) cho ứng dụng Quản Lý Phòng Trọ, kèm lệnh build, commit và tạo git tag
---

# Quy Trình Nâng Cấp Phiên Bản (Bump Version)

Tài liệu này hướng dẫn chi tiết và đầy đủ toàn bộ các vị trí cần cập nhật, cú pháp và quy trình thực hiện mỗi khi AI Agent hoặc lập trình viên tiến hành nâng cấp phiên bản (Release / Bump Version) cho dự án **Quản Lý Phòng Trọ**.

---

## 1. Nguyên Tắc Đánh Số Phiên Bản (SemVer)

- Dự án tuân theo chuẩn **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
  - `MAJOR` (ví dụ: `3.0.0`): Khi có các thay đổi kiến trúc lớn, bổ sung toàn bộ phân hệ mới (như thêm tab Quản lý Người ở, tích hợp Zalo...).
  - `MINOR` (ví dụ: `2.4.0`): Khi thêm tính năng mới tương thích ngược (như thêm modal cảnh báo, tùy chỉnh cài đặt...).
  - `PATCH` (ví dụ: `2.3.8`): Khi sửa lỗi nhỏ (bugfix), tinh chỉnh UI hoặc cập nhật tài liệu.
- **Quy ước định dạng**:
  - Trong `package.json` và `package-lock.json`: Dùng số thuần túy không có chữ `v` (ví dụ: `3.0.0`).
  - Trong giao diện HTML, commit message và git tag: Có tiền tố `v` (ví dụ: `v3.0.0`, tag `v3.0.0` hoặc `3.0.0`).

---

## 2. Danh Sách Các Vị Trí BẮT BUỘC Phải Thay Đổi

Mỗi khi nâng cấp lên phiên bản mới `X.Y.Z` (ví dụ `3.0.0`), Agent **phải rà soát và cập nhật đủ 5 file** sau:

### 📄 1. `package.json`
- Đường dẫn: `package.json`
- Vị trí: dòng `"version"` ở đầu file:
  ```json
  {
    "name": "project-tools-phongtro",
    "version": "X.Y.Z",
    ...
  }
  ```

### 📄 2. `package-lock.json`
- Đường dẫn: `package-lock.json`
- Vị trí: Có 2 vị trí ở đầu file:
  ```json
  {
    "name": "project-tools-phongtro",
    "version": "X.Y.Z",
    "lockfileVersion": 3,
    "packages": {
      "": {
        "name": "project-tools-phongtro",
        "version": "X.Y.Z",
        ...
      }
    }
  }
  ```

### 📄 3. `src/input/index.html` (Đúng 4 vị trí)
- Đường dẫn: `src/input/index.html`
- Cần thay đổi cả 4 vị trí hiển thị tĩnh để tránh việc giật giao diện hoặc hiện version cũ trước khi JavaScript nạp:
  1. **Thẻ Title của trang (khoảng dòng 7)**:
     ```html
     <title>Màn Hình Nhập Liệu - Quản Lý Phòng Trọ vX.Y.Z</title>
     ```
  2. **Thẻ hiển thị bên cạnh tiêu đề Header (khoảng dòng 30)**:
     ```html
     <h1>MÀN HÌNH NHẬP LIỆU - QUẢN LÝ PHÒNG TRỌ <span id="app-version-tag" class="title-version-tag">vX.Y.Z</span></h1>
     ```
  3. **Thẻ hiển thị trong Card Thông Tin Phiên Bản tab Cài Đặt Chung (khoảng dòng 365-370)**:
     ```html
     <strong id="settings-app-version" class="update-version-val">vX.Y.Z</strong>
     ```
  4. **Thẻ hiển thị phiên bản đang dùng trong Modal Cập Nhật (khoảng dòng 820-825)**:
     ```html
     <strong id="update-curr-version">vX.Y.Z</strong>
     ```

### 📄 4. `README.md`
- Đường dẫn: `README.md`
- Cập nhật số phiên bản và tên file setup installer:
  - Dòng thông tin đầu file: `**Phiên bản:** X.Y.Z`
  - Sơ đồ cây thư mục: `├── package.json # Cấu hình npm + electron-builder (vX.Y.Z)`
  - Hướng dẫn cài đặt & build: `Quản Lý Phòng Trọ_Setup_vX.Y.Z.exe`
  - File output: `release/Quản Lý Phòng Trọ_Setup_vX.Y.Z.exe`

### 📄 5. `liệt kê thay đổi.txt`
- Đường dẫn: `liệt kê thay đổi.txt`
- Thêm một khối mới ở cuối file tóm tắt các tính năng/sửa lỗi của bản mới:
  ```text
  vX.Y.Z
  - Tóm tắt thay đổi 1
  - Tóm tắt thay đổi 2
  - ...
  ```

---

## 3. Quy Trình Git: Commit & Tạo Tag

Sau khi hoàn tất chỉnh sửa mã nguồn và đồng bộ 5 vị trí trên:

```bash
# 1. Thêm tất cả thay đổi vào Staging
git add .

# 2. Tạo commit với tên phiên bản
git commit -m "vX.Y.Z"

# 3. Tạo Git Tag cho phiên bản (để GitHub Releases và Auto Updater nhận diện)
git tag vX.Y.Z

# 4. Đẩy code và tags lên GitHub Remote (khi cần)
git push origin main --tags
```

---

## 4. Quy Trình Đóng Gói & Phát Hành Lên GitHub Releases

Để ứng dụng tự động phân phối bản cập nhật tới người dùng qua `electron-updater`:

1. **Lấy GitHub Token**: Xem tại file `rember.txt`.
2. **Mở PowerShell tại thư mục gốc dự án** và chạy lần lượt:

```powershell
# Gán biến môi trường Token (lấy mã token từ file rember.txt)
$env:GH_TOKEN="<DÁN_TOKEN_TỪ_REMBER_TXT>"

# Đóng gói NSIS Installer và tự động upload bản phát hành lên GitHub
npx electron-builder --win --publish always
```

> [!TIP]
> Quá trình build sẽ tự sinh ra file installer trong thư mục `release/` (ví dụ `Quản Lý Phòng Trọ_Setup_vX.Y.Z.exe`) kèm `latest.yml` và đẩy thẳng lên GitHub Releases tương ứng với `repo: "Project-tools-phongtro"`, `owner: "myheo0229"`.

---

## 5. Bảng Tổng Hợp Nhanh (Quick Cheat Sheet)

| Bước | Hành động | Vị trí / Lệnh |
|---|---|---|
| 1 | Cập nhật `package.json` | `"version": "X.Y.Z"` |
| 2 | Cập nhật `package-lock.json` | 2 chỗ `"version": "X.Y.Z"` |
| 3 | Cập nhật `src/input/index.html` | `<title>`, `#app-version-tag`, `#settings-app-version`, `#update-curr-version` |
| 4 | Cập nhật `README.md` | `**Phiên bản:** X.Y.Z` & các link Setup `.exe` |
| 5 | Ghi log vào `liệt kê thay đổi.txt` | Khối `vX.Y.Z` ở cuối file |
| 6 | Git commit & Tag | `git commit -m "vX.Y.Z"` & `git tag vX.Y.Z` |
| 7 | Build & Publish Release | `$env:GH_TOKEN="..."` -> `npx electron-builder --win --publish always` |

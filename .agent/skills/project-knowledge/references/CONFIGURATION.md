# ⚙️ Cấu Hình Hệ Thống & Đóng Gói Ứng Dụng (Configuration & Deployment)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Mục tiêu:** Hướng dẫn chi tiết cấu hình đóng gói, biến môi trường, thiết lập Git và các tham số vận hành của ứng dụng.

---

## 1. Yêu Cầu Môi Trường Phát Triển & Vận Hành

- **Hệ điều hành**: Windows 10 / Windows 11 (64-bit).
- **Môi trường Node.js**: Phiên bản `18.x` hoặc `20.x` LTS (khuyến nghị `Node.js >= 18.17.0`).
- **Trình quản lý gói**: `npm >= 9.x`.
- **Cấu hình phần cứng tối thiểu**: RAM 4GB, ổ cứng trống ít nhất 1GB để build NSIS installer.

---

## 2. Cấu Hình Đóng Gói `package.json`

Toàn bộ cấu hình đóng gói installer và phát hành tự động được định nghĩa trong khối `"build"` của [`package.json`](file:///d:/2.%20GauGau/Project-tools-phongtro/package.json):

```json
{
  "name": "project-tools-phongtro",
  "version": "3.0.1",
  "description": "Phần mềm quản lý và xuất phiếu thu tiền nhà trọ",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win"
  },
  "build": {
    "appId": "com.lecongba.quanlyphongtro",
    "productName": "Quản Lý Phòng Trọ",
    "directories": {
      "output": "release"
    },
    "publish": [
      {
        "provider": "github",
        "owner": "myheo0229",
        "repo": "Project-tools-phongtro",
        "releaseType": "release"
      }
    ],
    "win": {
      "icon": "assets/icon/icon256x256.ico",
      "target": [
        "nsis"
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Quản Lý Phòng Trọ",
      "artifactName": "${productName}_Setup_v${version}.${ext}"
    },
    "files": [
      "assets/**/*",
      "data/**/*",
      "electron/**/*",
      "src/**/*",
      "package.json"
    ]
  }
}
```

### Giải nghĩa các tham số build quan trọng:
1. **`appId: "com.lecongba.quanlyphongtro"`**: Định danh duy nhất của ứng dụng trên hệ điều hành Windows, giúp Registry và Shortcut quản lý đúng ứng dụng khi nâng cấp.
2. **`publish`**: Khai báo nguồn phát hành GitHub Releases (`myheo0229/Project-tools-phongtro`) phục vụ `electron-updater`.
3. **`nsis.oneClick: false`**: Không cài đặt kiểu 1-click ngầm lúc cài lần đầu; hiển thị trình hướng dẫn để người dùng chọn thư mục cài đặt (`Program Files` hoặc ổ đĩa tùy chọn).
4. **`nsis.allowToChangeInstallationDirectory: true`**: Cho phép người dùng tùy chọn ổ đĩa (C:, D:) khi cài đặt.
5. **`nsis.artifactName: "${productName}_Setup_v${version}.${ext}"`**: Tự động sinh tên file setup chuẩn:
   `Quản Lý Phòng Trọ_Setup_v3.0.1.exe`.
6. **`files`**: Danh sách các thư mục đóng gói vào file ASAR (`app.asar`). Lưu ý: Chỉ đóng gói `assets/`, `data/` (template trắng), `electron/`, `src/` và `package.json`. Tuyệt đối loại bỏ các file tạm hoặc dữ liệu dev.

---

## 3. Quản Lý Biến Môi Trường (Environment Variables)

Hệ thống chỉ sử dụng 01 biến môi trường duy nhất khi phát hành phiên bản mới:

| Tên biến môi trường | Mục đích sử dụng | Nơi sử dụng | Lưu ý bảo mật |
|---|---|---|---|
| **`GH_TOKEN`** | Xác thực quyền phát hành (GitHub Personal Access Token với scope `repo`) để `electron-builder` tự động tạo GitHub Release và upload file `.exe` lên repo `myheo0229/Project-tools-phongtro`. | Terminal / CI/CD khi chạy lệnh `npx electron-builder --win --publish always` | **TUYỆT ĐỐI KHÔNG commit giá trị token thật vào Git**. Chỉ thiết lập trong phiên làm việc hiện tại bằng lệnh PowerShell hoặc biến môi trường hệ thống. |

---

## 4. Cấu Hình Bỏ Qua Trong Git (`.gitignore`)

File [`.gitignore`](file:///d:/2.%20GauGau/Project-tools-phongtro/.gitignore) được thiết lập nhằm ngăn chặn tuyệt đối rò rỉ dữ liệu cá nhân của cư dân:

```gitignore
node_modules/
release/
dist/
.env

# Bảo vệ quyền riêng tư & An toàn dữ liệu
**/Thông tin người ở/**
**/zalo_session.json
*.log
```

### Nguyên tắc bảo mật bắt buộc:
1. Thư mục ảnh CCCD (`Thông tin người ở/`) không bao giờ được phép xuất hiện trên Git.
2. File session Zalo (`zalo_session.json`) không bao giờ được commit lên GitHub để bảo vệ tài khoản cá nhân của chủ trọ.
3. Thư mục `release/` chứa các bộ cài đặt `.exe` lớn (hơn 100MB) được bỏ qua để tránh phình dung lượng kho mã nguồn.

---

## 5. Quy Trình Khởi Động & Build Cài Đặt

### 5.1. Chạy ở môi trường phát triển (Development)
```bash
npm install
npm start
```

### 5.2. Đóng gói bộ cài đặt nội bộ (Local Build)
```bash
npm run build
```
File kết quả: `release/Quản Lý Phòng Trọ_Setup_v3.0.1.exe`.

### 5.3. Đóng gói & Tự động xuất bản lên GitHub Releases
```powershell
$env:GH_TOKEN="<GITHUB_PERSONAL_ACCESS_TOKEN_CUA_BAN>"
npx electron-builder --win --publish always
```
Lệnh này sẽ tự động:
1. Đóng gói file cài đặt `.exe` vào `release/`.
2. Tạo file `latest.yml` chứa mã SHA512 hash và kích thước file.
3. Tạo draft release trên GitHub và tải cả file `.exe` cùng `latest.yml` lên.
4. Xuất bản chính thức release để các máy khách (Client) tự động nhận diện và cập nhật.


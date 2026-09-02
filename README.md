# 🏠 Quản Lý Phòng Trọ

> Phần mềm quản lý và xuất phiếu thu tiền nhà trọ — Xây dựng trên nền tảng Electron.

**Tác giả:** Lê Công Bá Nhân  
**Phiên bản:** 2.3.6  
**Nền tảng:** Windows (NSIS Installer — Tự động cập nhật qua GitHub Releases)

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng chính](#-tính-năng-chính)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Công thức tính tiền](#-công-thức-tính-tiền)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cài đặt & Phát triển](#-cài-đặt--phát-triển)
- [Build bản Cài Đặt (NSIS)](#-build-bản-cài-đặt-nsis)
- [Dữ liệu & Lưu trữ](#-dữ-liệu--lưu-trữ)

---

## 📖 Giới thiệu

**Quản Lý Phòng Trọ** là ứng dụng desktop dành cho chủ trọ, giúp:

- Nhập chỉ số điện/nước hàng tháng cho **12 phòng** (1A–6A, 1B–6B).
- **Tự động tính toán** tiền điện, tiền nước, tiền hao tải, tiền rác, internet và tổng cộng.
- **Phát hiện bất thường & quay vòng**: Tự động hiển thị Pop-up Modal xác nhận khi công tơ điện quay vòng (`dienMoi < dienCu`) hoặc khi điện tiêu thụ biến động $\ge 40\%$ so với tháng trước.
- **Tự động Cập Nhật (Auto Updater)**: Tích hợp `electron-updater` + GitHub Releases. Tự động kiểm tra bản mới, hiển thị Pop-up tùy chọn "Cập nhật ngay" hoặc "Để sau", thanh phần trăm % và tốc độ MB/s.
- **Tùy chỉnh bật/tắt Pop-up**: Quản lý bằng công tắc Toggle Switch thiết kế hiện đại trong Cài Đặt Chung.
- **Cảnh báo thay đổi chưa lưu**: Tự động nhắc nhở khi người dùng điều chỉnh Cài Đặt Chung nhưng quên bấm Lưu Cài Đặt.
- **Xuất phiếu thu** dưới dạng **12 file ảnh JPG** (mỗi phòng 1 ảnh) + **1 file PDF gộp** tất cả phiếu.
- Lưu lịch sử dữ liệu theo từng tháng, tự động kế thừa chỉ số cũ sang tháng mới.
- Quản lý linh hoạt thư mục dữ liệu bằng file con trỏ `pointer.json`.

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Tự Động Cập Nhật** | Tích hợp Electron Updater + GitHub Releases (`myheo0229/Project-tools-phongtro`), hiển thị Pop-up nâng cấp bản mới kèm thanh tiến trình % |
| **Kiểm Tra Cập Nhật Thủ Công** | Bổ sung nút Kiểm Tra Cập Nhật trực tiếp trong tab Cài Đặt Chung |
| **Nhập liệu 12 phòng** | Bảng nhập chỉ số điện cũ/mới, nước cũ/mới cho 12 phòng |
| **Tính toán tự động** | Tất cả khoản phí được tính realtime ngay khi nhập số |
| **Xác nhận công tơ quay vòng** | Tự động mở Pop-up Modal 1.5x xác nhận khi `Điện Mới < Điện Cũ` để áp dụng công thức `(10.000 + Điện Mới) - Điện Cũ` |
| **Cảnh báo biến động $\ge 40\%$** | Tự động so sánh số điện tiêu thụ với tháng trước và hiển thị Pop-up Cảnh báo khi chênh lệch $\ge 40\%$ (tăng/giảm) |
| **Toggle Switch Bật/Tắt Pop-up** | Cho phép chủ trọ chủ động Bật/Tắt 2 tính năng Pop-up cảnh báo ngay trong tab Cài Đặt Chung |
| **Cảnh báo Chưa Lưu Cài Đặt** | Tự động chặn và hiện Pop-up nhắc nhở khi chuyển tab mà quên bấm Lưu Cài Đặt Giá |
| **Kế thừa chỉ số** | Chỉ số mới tháng trước → tự động điền vào chỉ số cũ tháng sau (khóa không cho sửa) |
| **Xuất phiếu thu JPG** | Mỗi phòng xuất 1 ảnh JPG chất lượng cao (3x scale) |
| **Xuất PDF gộp** | Gộp 12 phiếu thu vào 1 file PDF duy nhất (khổ A4 ngang) |
| **Cài đặt giá linh hoạt** | Tùy chỉnh giá phòng, giá điện, giá nước, phí rác, internet, tỷ lệ hao tải |
| **Điều hướng kiểu Excel** | Enter ↓ / Shift+Enter ↑ / Tab → để di chuyển giữa các ô nhanh |
| **Lưu lịch sử theo tháng** | Dữ liệu mỗi tháng lưu thành file JSON riêng biệt |
| **Quản lý thư mục động** | Dữ liệu `data/` gộp chung cấp với `PhieuThu/` trong `baseFolder`, quản lý qua `pointer.json` |

---

## 📁 Cấu trúc thư mục

```
Project-tools-phongtro/
├── electron/                    # Electron main process
│   ├── main.js                  # Entry point chính (IPC handlers, autoUpdater, xuất PDF/JPG)
│   ├── preload.js               # Context bridge giữa main ↔ renderer
│   ├── rasterizer.html          # Chuyển đổi PDF → JPG bằng pdfjs-dist
│   └── vendor/                  # Thư viện bên thứ 3 (pdfjs-dist worker)
│
├── src/
│   ├── input/                   # Màn hình nhập liệu chính
│   │   ├── index.html           # Giao diện bảng nhập + cài đặt + 4 Pop-up Modal
│   │   ├── renderer.js          # Logic UI, lưu/đọc dữ liệu, modal xác nhận, autoUpdater & xuất phiếu
│   │   └── style.css            # CSS giao diện nhập liệu & Pop-up 1.5x / Toggle Switch / Progress Bar
│   │
│   ├── receipt/                 # Template phiếu thu (ẩn, dùng để xuất)
│   │   ├── index.html           # HTML mẫu phiếu thu tiền nhà
│   │   ├── main.js              # Hàm renderRoom() điền dữ liệu vào phiếu
│   │   ├── style.css            # CSS phiếu thu
│   │   └── reset.css            # CSS reset
│   │
│   └── shared/                  # Module dùng chung (Node + Browser)
│       ├── calc.js              # ⭐ Logic tính tiền (công thức chính)
│       └── format.js            # Định dạng số tiền, ngày tháng
│
├── assets/                      # Icon ứng dụng (.ico, .png)
├── release/                     # Thư mục chứa file Setup .exe sau khi build
├── package.json                 # Cấu hình npm + electron-builder (v2.3.0)
└── README.md                    # File hướng dẫn này
```

---

## 🧮 Công thức tính tiền

> File chứa logic tính toán: [`src/shared/calc.js`](src/shared/calc.js)

### Các thông số cài đặt (Settings)

| Thông số | Ký hiệu | Giá trị mặc định | Đơn vị |
|---|---|---|---|
| Giá phòng | `giaPhong` | 2.200.000 | đ/tháng |
| Giá điện | `giaDien` | 2.900 | đ/kWh |
| Giá nước | `giaNuoc` | 12.000 | đ/m³ |
| Tiền rác | `tienRac` | 40.000 | đ/tháng |
| Tiền internet | `tienInternet` | 24.000 | đ/tháng |
| Tỷ lệ hao tải điện | `tyLeHaoTai` | 7% | % |

### Bước 1 — Số điện tiêu thụ (kWh)

```
Điện tiêu thụ = Chỉ số điện MỚI − Chỉ số điện CŨ
```

> **Lưu ý đồng hồ quay vòng (`dienMoi < dienCu`):** Khi nhập chỉ số mới nhỏ hơn cũ, ứng dụng sẽ hiện Pop-up Modal 1.5x xác nhận. Nếu đồng ý áp dụng, công thức là:
> ```
> Điện tiêu thụ = (10.000 + Chỉ số điện MỚI) − Chỉ số điện CŨ
> ```
> Giới hạn max công tơ: **10.000**

---

## 📘 Hướng dẫn sử dụng

### 1. Mở ứng dụng

- Chạy file `Quản Lý Phòng Trọ_Setup_v2.3.0.exe` để cài đặt lần đầu.
- Giao diện chính hiện ra với **2 tab**: `Nhập Dữ Liệu` và `Cài Đặt Chung`.

### 2. Tự Động Cập Nhật (Auto Update)

- Khi khởi động ứng dụng, phần mềm sẽ tự động kiểm tra phiên bản mới trên GitHub Releases (`myheo0229/Project-tools-phongtro`).
- Nếu có phiên bản mới hơn, Pop-up Modal sẽ xuất hiện với 2 nút:
  - **Cập nhật ngay**: Tự động tải ngầm kèm thanh phần trăm % và tốc độ MB/s, khi đạt 100% ứng dụng tự tắt và tự mở lại ở phiên bản mới.
  - **Để sau (Hủy)**: Đóng Pop-up, tiếp tục sử dụng phiên bản hiện tại bình thường.
- Bạn cũng có thể vào tab **Cài Đặt Chung** và bấm nút **"Kiểm Tra Cập Nhật"** bất cứ lúc nào.

---

## ⚙️ Cài đặt & Phát triển

### Yêu cầu hệ thống

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows** 10/11

### Cài đặt dependencies

```bash
npm install
```

### Chạy ứng dụng (Development)

```bash
npm start
```

---

## 📦 Build & Phát hành bản Cài Đặt (NSIS)

```bash
npm run build
```

> Lệnh này chạy `electron-builder --win` — tạo file `.exe` cài đặt trong thư mục `release/`.

File output: `release/Quản Lý Phòng Trọ_Setup_v2.3.0.exe`

Để tự động phát hành bản mới lên GitHub Releases cho người nhà:
```bash
npx electron-builder --win --publish always
```

---

## 📄 License

ISC © Lê Công Bá Nhân

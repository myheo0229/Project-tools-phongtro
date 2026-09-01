# 🏠 Quản Lý Phòng Trọ

> Phần mềm quản lý và xuất phiếu thu tiền nhà trọ — Xây dựng trên nền tảng Electron.

**Tác giả:** Lê Công Bá Nhân  
**Phiên bản:** 2.2.2  
**Nền tảng:** Windows (Portable — không cần cài đặt)

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng chính](#-tính-năng-chính)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Công thức tính tiền](#-công-thức-tính-tiền)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cài đặt & Phát triển](#-cài-đặt--phát-triển)
- [Build bản Portable](#-build-bản-portable)
- [Dữ liệu & Lưu trữ](#-dữ-liệu--lưu-trữ)

---

## 📖 Giới thiệu

**Quản Lý Phòng Trọ** là ứng dụng desktop dành cho chủ trọ, giúp:

- Nhập chỉ số điện/nước hàng tháng cho **12 phòng** (1A–6A, 1B–6B).
- **Tự động tính toán** tiền điện, tiền nước, tiền hao tải, tiền rác, internet và tổng cộng.
- **Phát hiện bất thường & quay vòng**: Tự động hiển thị Pop-up Modal xác nhận khi công tơ điện quay vòng (`dienMoi < dienCu`) hoặc khi điện tiêu thụ biến động $\ge 40\%$ so với tháng trước.
- **Xuất phiếu thu** dưới dạng **12 file ảnh JPG** (mỗi phòng 1 ảnh) + **1 file PDF gộp** tất cả phiếu.
- Lưu lịch sử dữ liệu theo từng tháng, tự động kế thừa chỉ số cũ sang tháng mới.
- Quản lý linh hoạt thư mục dữ liệu bằng file con trỏ `pointer.json`.

Ứng dụng được đóng gói dạng **Portable** (`.exe` chạy trực tiếp, không cần cài đặt).

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Nhập liệu 12 phòng** | Bảng nhập chỉ số điện cũ/mới, nước cũ/mới cho 12 phòng |
| **Tính toán tự động** | Tất cả khoản phí được tính realtime ngay khi nhập số |
| **Xác nhận công tơ quay vòng** | Tự động mở Pop-up Modal 1.5x xác nhận khi `Điện Mới < Điện Cũ` để áp dụng công thức `(10.000 + Điện Mới) - Điện Cũ` |
| **Cảnh báo biến động $\ge 40\%$** | Tự động so sánh số điện tiêu thụ với tháng trước và hiển thị Pop-up Cảnh báo khi chênh lệch $\ge 40\%$ (tăng/giảm) |
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
│   ├── main.js                  # Entry point chính (IPC handlers, xuất PDF/JPG)
│   ├── preload.js               # Context bridge giữa main ↔ renderer
│   ├── rasterizer.html          # Chuyển đổi PDF → JPG bằng pdfjs-dist
│   └── vendor/                  # Thư viện bên thứ 3 (pdfjs-dist worker)
│
├── src/
│   ├── input/                   # Màn hình nhập liệu chính
│   │   ├── index.html           # Giao diện bảng nhập + cài đặt + 3 Pop-up Modal
│   │   ├── renderer.js          # Logic UI, lưu/đọc dữ liệu, modal xác nhận & xuất phiếu
│   │   └── style.css            # CSS giao diện nhập liệu & Pop-up 1.5x / Toggle Switch
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
├── release/                     # Thư mục chứa file Portable .exe sau khi build
├── package.json                 # Cấu hình npm + electron-builder (v2.2.2)
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

### Bước 2 — Số nước tiêu thụ (m³)

```
Nước tiêu thụ = Chỉ số nước MỚI − Chỉ số nước CŨ
```

> Kết quả tối thiểu là **0** (không cho âm).

### Bước 3 — Tiền điện

```
Tiền điện = Điện tiêu thụ × Giá điện
```

> Kết quả được **làm tròn đến hàng nghìn** (≥500 làm tròn lên, <500 làm tròn xuống).

### Bước 4 — Tiền nước

```
Tiền nước = Nước tiêu thụ × Giá nước
```

> Kết quả được **làm tròn đến hàng nghìn**.

### Bước 5 — Điện hao tải (kWh)

```
Điện hao tải = Điện tiêu thụ × Tỷ lệ hao tải
```

> Kết quả được **làm tròn đến 1 chữ số thập phân**.

### Bước 6 — Tiền điện hao tải

```
Tiền điện hao tải = Điện hao tải × Giá điện
```

> Kết quả được **làm tròn đến hàng nghìn**.

### Bước 7 — Tổng cộng mỗi phòng

```
Tổng cộng = Tiền điện + Tiền nước + Tiền điện hao tải + Tiền phòng + Tiền rác + Tiền internet
```

---

## 📘 Hướng dẫn sử dụng

### 1. Mở ứng dụng

- Chạy file `Quản Lý Phòng Trọ_Portable_v2.2.2.exe` (không cần cài đặt).
- Giao diện chính hiện ra với **2 tab**: `Nhập Dữ Liệu` và `Cài Đặt Chung`.

### 2. Cài đặt ban đầu (Tab "Cài Đặt Chung")

Trước khi sử dụng lần đầu, bạn bắt buộc vào tab **Cài Đặt Chung** để chọn **Thư mục lưu ảnh & PDF phiếu thu**:

- Khi chọn thư mục `baseFolder`, ứng dụng tự động khởi tạo 2 thư mục con bên trong:
  - `<baseFolder>/data/` — Chứa cài đặt và lịch sử các tháng.
  - `<baseFolder>/PhieuThu/` — Chứa các file ảnh JPG và PDF phiếu thu xuất ra.
- Đường dẫn trỏ tới `baseFolder` được lưu trong file `pointer.json` thuộc `userData` hệ thống.
- **Tùy chỉnh Pop-up**: Có thể gạt tắt công tắc Toggle Switch nếu không muốn hiển thị Pop-up quay vòng hoặc bất thường.

### 3. Nhập chỉ số điện/nước (Tab "Nhập Dữ Liệu")

1. **Chọn tháng/năm** ở dropdown phía trên (Dropdown tự động mở rộng tháng mới khi đã nhập đủ 12 phòng tháng liền trước).
2. **Xử lý cảnh báo thông minh**:
   - Nếu `Điện Mới < Điện Cũ` $\rightarrow$ Mở Modal xác nhận tính theo đồng hồ quay vòng.
   - Nếu Điện tiêu thụ chênh lệch $\ge 40\%$ so với tháng trước $\rightarrow$ Mở Modal cảnh báo biến động bất thường.
   - Bấm **Xác nhận** để áp dụng / Bấm **Hủy** để tự động xóa sạch số vừa gõ và con trỏ focus/select lại ô đó.

### 4. Lưu & Xuất phiếu thu

Nhấn nút **"Lưu & Xuất"** ở góc trên để:

1. **Lưu dữ liệu** tháng hiện tại $\rightarrow$ file `<baseFolder>/data/history/YYYY-MM.json`.
2. **Xuất 12 ảnh JPG** — mỗi phòng 1 phiếu thu dạng ảnh.
3. **Xuất 1 file PDF gộp** — 12 trang A4 ngang, mỗi trang 1 phiếu.

Cấu trúc thư mục xuất:

```
<Thư mục đã chọn>/
├── data/
│   ├── settings.json
│   └── history/
│       ├── 2026-07.json
│       └── 2026-08.json
└── PhieuThu/
    └── Thang_07_2026/
        ├── Phong-1A.jpg
        ├── ...
        ├── Phong-6B.jpg
        └── Thang_07_2026.pdf    ← File PDF gộp 12 phiếu
```

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

## 📦 Build bản Portable

```bash
npm run build
```

> Lệnh này chạy `electron-builder --win` — tạo file `.exe` Portable trong thư mục `release/`.

File output: `release/Quản Lý Phòng Trọ_Portable_v2.2.2.exe`

---

## 📄 License

ISC © Lê Công Bá Nhân

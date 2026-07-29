# 🏠 Quản Lý Phòng Trọ

> Phần mềm quản lý và xuất phiếu thu tiền nhà trọ — Xây dựng trên nền tảng Electron.

**Tác giả:** Lê Công Bá Nhân  
**Phiên bản:** 1.0.0  
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
- **Xuất phiếu thu** dưới dạng **12 file ảnh JPG** (mỗi phòng 1 ảnh) + **1 file PDF gộp** tất cả phiếu.
- Lưu lịch sử dữ liệu theo từng tháng, tự động kế thừa chỉ số cũ sang tháng mới.

Ứng dụng được đóng gói dạng **Portable** (`.exe` chạy trực tiếp, không cần cài đặt).

---

## ✨ Tính năng chính

| Tính năng | Mô tả |
|---|---|
| **Nhập liệu 12 phòng** | Bảng nhập chỉ số điện cũ/mới, nước cũ/mới cho 12 phòng |
| **Tính toán tự động** | Tất cả khoản phí được tính realtime ngay khi nhập số |
| **Kế thừa chỉ số** | Chỉ số mới tháng trước → tự động điền vào chỉ số cũ tháng sau (khóa không cho sửa) |
| **Xuất phiếu thu JPG** | Mỗi phòng xuất 1 ảnh JPG chất lượng cao (3x scale) |
| **Xuất PDF gộp** | Gộp 12 phiếu thu vào 1 file PDF duy nhất (khổ A4 ngang) |
| **Cài đặt giá linh hoạt** | Tùy chỉnh giá phòng, giá điện, giá nước, phí rác, internet, tỷ lệ hao tải |
| **Điều hướng kiểu Excel** | Enter ↓ / Shift+Enter ↑ / Tab → để di chuyển giữa các ô nhanh |
| **Lưu lịch sử theo tháng** | Dữ liệu mỗi tháng lưu thành file JSON riêng biệt |
| **Chọn thư mục xuất** | Chọn thư mục lưu ảnh/PDF qua dialog native Windows |

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
│   │   ├── index.html           # Giao diện bảng nhập + cài đặt
│   │   ├── renderer.js          # Logic UI, lưu/đọc dữ liệu, xuất phiếu
│   │   └── style.css            # CSS giao diện nhập liệu
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
├── data/
│   ├── rooms.json               # Danh sách 12 phòng (tên, khách thuê)
│   ├── settings.json            # Cài đặt giá (điện, nước, phòng, hao tải...)
│   └── history/                 # Lịch sử chỉ số theo tháng
│       ├── 2026-07.json         # Dữ liệu tháng 07/2026
│       ├── 2026-08.json         # Dữ liệu tháng 08/2026
│       └── ...
│
├── dist/                        # Thư mục output khi build
├── logo.ico                     # Icon ứng dụng
├── package.json                 # Cấu hình npm + electron-builder
└── README.md                    # File này
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

> **Lưu ý:** Nếu công tơ điện quay vòng (chỉ số mới < chỉ số cũ), công thức là:
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

**Ví dụ:**  
`77 kWh × 2.900 đ/kWh = 223.300 đ` → Làm tròn → **223.000 đ**

### Bước 4 — Tiền nước

```
Tiền nước = Nước tiêu thụ × Giá nước
```

> Kết quả được **làm tròn đến hàng nghìn**.

**Ví dụ:**  
`6 m³ × 12.000 đ/m³ = 72.000 đ` → Làm tròn → **72.000 đ**

### Bước 5 — Điện hao tải (kWh)

```
Điện hao tải = Điện tiêu thụ × Tỷ lệ hao tải
```

> Kết quả được **làm tròn đến 1 chữ số thập phân**.

**Ví dụ:**  
`77 kWh × 7% = 5.39 kWh` → Làm tròn → **5.4 kWh**

### Bước 6 — Tiền điện hao tải

```
Tiền điện hao tải = Điện hao tải × Giá điện
```

> Kết quả được **làm tròn đến hàng nghìn**.

**Ví dụ:**  
`5.4 kWh × 2.900 đ/kWh = 15.660 đ` → Làm tròn → **16.000 đ**

### Bước 7 — Tổng cộng mỗi phòng

```
Tổng cộng = Tiền điện + Tiền nước + Tiền điện hao tải + Tiền phòng + Tiền rác + Tiền internet
```

**Ví dụ tổng hợp cho 1 phòng:**

| Khoản | Số liệu | Thành tiền |
|---|---|---|
| Tiền phòng | — | 2.200.000 đ |
| Tiền điện | 77 kWh × 2.900 đ | 223.000 đ |
| Tiền nước | 6 m³ × 12.000 đ | 72.000 đ |
| Tiền rác | — | 40.000 đ |
| Internet | — | 24.000 đ |
| Điện hao tải | 5.4 kWh × 2.900 đ | 16.000 đ |
| **Tổng cộng** | | **2.575.000 đ** |

### Quy tắc làm tròn

| Hàm | Cách làm tròn | Ví dụ |
|---|---|---|
| `round1000(x)` | Làm tròn đến **hàng nghìn** gần nhất | `223.300 → 223.000`, `223.500 → 224.000` |
| `round1(x)` | Làm tròn đến **1 chữ số thập phân** | `5.39 → 5.4`, `5.35 → 5.4` |

### Tổng doanh thu tháng

```
Tổng doanh thu = Tổng cộng Phòng 1A + Tổng cộng Phòng 1B + ... + Tổng cộng Phòng 6B
```

---

## 📘 Hướng dẫn sử dụng

### 1. Mở ứng dụng

- Chạy file `Quản Lý Phòng Trọ_Portable_v1.0.0.exe` (không cần cài đặt).
- Giao diện chính hiện ra với **2 tab**: `Nhập Dữ Liệu` và `Cài Đặt Chung`.

### 2. Cài đặt ban đầu (Tab "Cài Đặt Chung")

Trước khi sử dụng lần đầu, vào tab **Cài Đặt Chung** để thiết lập:

| Mục | Ý nghĩa |
|---|---|
| **Thư mục lưu ảnh/PDF** | Nơi lưu file phiếu thu khi xuất (bấm nút `Chọn thư mục`) |
| **Giá phòng** | Tiền thuê phòng cố định mỗi tháng (VD: 2.200.000 đ) |
| **Giá điện** | Đơn giá điện mỗi kWh (VD: 2.900 đ) |
| **Giá nước** | Đơn giá nước mỗi m³ (VD: 12.000 đ) |
| **Tiền rác** | Phí thu rác cố định mỗi tháng (VD: 40.000 đ) |
| **Tiền internet** | Phí internet cố định mỗi tháng (VD: 24.000 đ) |
| **Tỷ lệ hao tải** | Phần trăm hao tải điện (VD: 7%) |
| **Số điện thoại** | Số ĐT hiển thị trên phiếu thu |

> **Nhấn "Lưu cài đặt"** sau khi điền xong. Cài đặt được lưu vào file `data/settings.json`.

### 3. Nhập chỉ số điện/nước (Tab "Nhập Dữ Liệu")

1. **Chọn tháng/năm** ở dropdown phía trên.
2. Bảng hiển thị **12 phòng** với các cột:

   | Cột | Mô tả |
   |---|---|
   | Điện Cũ | Chỉ số công tơ điện đầu tháng (tự động lấy từ tháng trước — **khóa**) |
   | Điện Mới | Chỉ số công tơ điện cuối tháng (**bạn nhập**) |
   | Số Điện TT | Số kWh tiêu thụ (tự tính) |
   | Nước Cũ | Chỉ số đồng hồ nước đầu tháng (tự động — **khóa**) |
   | Nước Mới | Chỉ số đồng hồ nước cuối tháng (**bạn nhập**) |
   | Số Nước TT | Số m³ tiêu thụ (tự tính) |
   | Các cột tiền | Tự động tính theo công thức ở mục trên |

3. **Điều hướng nhanh kiểu Excel:**
   - `Enter` — Nhảy xuống phòng kế tiếp (cùng cột)
   - `Shift + Enter` — Nhảy lên phòng phía trên
   - `Tab` — Chuyển sang ô kế tiếp bên phải
   - `Click vào ô` — Tự động chọn toàn bộ số để ghi đè nhanh

### 4. Lưu & Xuất phiếu thu

Nhấn nút **"Lưu & Xuất"** ở cuối bảng để:

1. **Lưu dữ liệu** tháng hiện tại → file `data/history/YYYY-MM.json`
2. **Xuất 12 ảnh JPG** — mỗi phòng 1 phiếu thu dạng ảnh (phóng to 3x cho rõ nét)
3. **Xuất 1 file PDF gộp** — 12 trang A4 ngang, mỗi trang 1 phiếu

Cấu trúc thư mục xuất:

```
<Thư mục đã chọn>/
└── PhieuThu/
    └── Thang_07_2026/
        ├── Phong-1A.jpg
        ├── Phong-1B.jpg
        ├── Phong-2A.jpg
        ├── ...
        ├── Phong-6B.jpg
        └── Thang_07_2026.pdf    ← File PDF gộp 12 phiếu
```

> Sau khi xuất xong, ứng dụng **tự động mở thư mục** chứa kết quả.

### 5. Chuyển tháng

- Chọn tháng mới ở dropdown → dữ liệu tháng trước được tải lên (nếu có).
- **Chỉ số cũ** tự động điền = **chỉ số mới** của tháng liền trước (khóa không cho sửa).
- Nếu chưa có dữ liệu tháng trước, các ô chỉ số cũ sẽ trống để bạn nhập tay.

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

> Lệnh này chạy `electron .` — mở cửa sổ ứng dụng với DevTools.

---

## 📦 Build bản Portable

```bash
npm run build
```

> Lệnh này chạy `electron-builder --win` — tạo file `.exe` Portable trong thư mục `dist/`.

File output: `dist/Quản Lý Phòng Trọ_Portable_v1.0.0.exe`

### Lưu ý khi chạy bản Portable

- Dữ liệu (`data/settings.json`, `data/history/`) được lưu **cùng thư mục** với file `.exe`.
- Không cần cài đặt, không cần quyền admin.
- Có thể copy file `.exe` và thư mục `data/` sang máy khác để sử dụng.

---

## 💾 Dữ liệu & Lưu trữ

### `data/settings.json` — Cài đặt giá

```json
{
  "baseFolder": "C:\\Users\\pc\\Desktop\\PhieuThu",
  "dienThoai": "0982 141 407",
  "giaPhong": 2200000,
  "giaDien": 2900,
  "giaNuoc": 12000,
  "tienRac": 40000,
  "tienInternet": 24000,
  "tyLeHaoTai": 0.07
}
```

### `data/history/YYYY-MM.json` — Dữ liệu chỉ số tháng

```json
[
  { "phong": "1A", "dienCu": 5302, "dienMoi": 5379, "nuocCu": 577, "nuocMoi": 583 },
  { "phong": "2A", "dienCu": 20406, "dienMoi": 20599, "nuocCu": 609, "nuocMoi": 612 },
  ...
]
```

### `data/rooms.json` — Danh sách phòng

```json
[
  { "phong": "1A", "tenKhach": "", "cmnd": "" },
  { "phong": "1B", "tenKhach": "", "cmnd": "" },
  ...
]
```

---

## 🛠️ Công nghệ sử dụng

| Công nghệ | Vai trò |
|---|---|
| [Electron](https://www.electronjs.org/) v43 | Framework ứng dụng desktop |
| [pdf-lib](https://pdf-lib.js.org/) | Gộp nhiều trang PDF thành 1 file |
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) | Chuyển đổi PDF → ảnh JPG (rasterizer) |
| [electron-builder](https://www.electron.build/) | Đóng gói thành file Portable `.exe` |
| Vanilla HTML/CSS/JS | Giao diện người dùng |

---

## 📄 License

ISC © Lê Công Bá Nhân

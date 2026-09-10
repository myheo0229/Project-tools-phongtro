---
name: an-toan-du-lieu-va-dong-goi
description: Quy tắc và kiến trúc bảo vệ dữ liệu người dùng, cách ly môi trường phát triển với ứng dụng đóng gói, chống rò rỉ dữ liệu cá nhân khi release/commit và bảo toàn dữ liệu hiện có trên máy người dùng
---

# Quy Tắc Bảo Vệ Dữ Liệu & Đóng Gói Ứng Dụng An Toàn

Tài liệu này quy định nghiêm ngặt về cách xử lý dữ liệu, cách ly môi trường phát triển (Dev) và bản phát hành (Production / Release) nhằm mục đích:
1. **Tuyệt đối không rò rỉ dữ liệu cá nhân** (họ tên, CCCD, số điện thoại, ảnh thẻ, lịch sử phòng...) vào Git, GitHub Repository hay bộ cài đặt `.exe`.
2. **Không làm mất / ghi đè dữ liệu** của người dùng trên các máy khác khi họ nhận bản cập nhật mới (Auto Update).

---

## 1. Nguyên Tắc Cốt Lõi: Phân Tách 2 Vùng Dữ Liệu

| Vùng dữ liệu | Vị trí | Mục đích & Quy tắc |
|---|---|---|
| **Vùng Mã Nguồn / Bản Build (App Bundle)** | Thư mục source code (`PROJECT_ROOT`) hoặc file đóng gói ASAR / `resources/app/` | **Chỉ chứa khung code và template trắng (Seed Data)**. Tuyệt đối không chứa bất kỳ dữ liệu thực tế nào của nhà trọ (CCCD, SĐT, danh sách người ở, lịch sử số điện nước thật). |
| **Vùng Dữ Liệu Người Dùng (User Runtime Data)** | `baseFolder/data/` (do người dùng tự chọn) hoặc `app.getPath('userData')` | **Nơi duy nhất lưu trữ dữ liệu thật**. Mọi thao tác thêm/sửa/xóa phòng, người ở, cài đặt giá, ảnh CCCD đều CHỈ ĐƯỢC PHÉP ghi vào đây. |

---

## 2. Các Điều CẤM KỴ Trong Mã Nguồn (Strict Code Rules)

1. 🚫 **CẤM ghi dữ liệu runtime ngược về `PROJECT_ROOT`**:
   - Tuyệt đối không viết bất kỳ hàm nào lưu ngược dữ liệu vào `PROJECT_ROOT/data/` (ví dụ `residents.json`, `rooms.json`, `settings.json`...).
   - Bất kỳ thao tác `fs.writeFileSync` vào thư mục mã nguồn trong lúc chạy app đều bị coi là lỗi nghiêm trọng.

2. 🚫 **CẤM fallback dữ liệu từ thư mục dev sang máy người dùng**:
   - Khi hàm đọc dữ liệu (như `residents:load`, `rooms:load`) không tìm thấy file trong `baseFolder`, phải trả về **dữ liệu mặc định trắng** (mảng rỗng `[]` hoặc 12 phòng trắng không có tên khách / CMND).
   - Tuyệt đối không đọc fallback từ `path.join(PROJECT_ROOT, 'data', ...)` nếu file đó có nguy cơ chứa dữ liệu dev.

3. 🚫 **CẤM tự ý xóa / reset dữ liệu khi người dùng cập nhật phiên bản**:
   - Khi cập nhật phiên bản mới (ví dụ từ v3.0.0 lên v3.0.1), file con trỏ `pointer.json` và thư mục `baseFolder/data/` trên máy người dùng phải được giữ nguyên vẹn 100%.
   - Không được chạy bất kỳ script dọn dẹp hoặc ghi đè thư mục `baseFolder` của người dùng mà không có sự đồng ý rõ ràng.

4. 🚫 **CẤM sao chép dữ liệu dev khi người dùng khởi tạo thư mục lần đầu**:
   - Trong `settings:save`: Khi người dùng chọn `baseFolder` lần đầu, hệ thống chỉ tạo cấu trúc thư mục rỗng và khởi tạo các file mẫu trắng ban đầu nếu file chưa tồn tại.
   - Tuyệt đối không dùng `copyDirSync(PROJECT_ROOT/data, targetDataDir)`.

---

## 3. Quy Chuẩn File Mẫu Trắng (Default Blank Templates) Trong Mã Nguồn

Mọi file trong thư mục `data/` của mã nguồn phải luôn duy trì ở trạng thái "sạch":

### 1. `data/residents.json`
Luôn là mảng rỗng:
```json
[]
```

### 2. `data/rooms.json`
Luôn là 12 phòng từ `1A` đến `6B` với thông tin trắng:
```json
[
  { "phong": "1A", "tenKhach": "", "cmnd": "", "chuPhong": null, "thanhVien": [] },
  { "phong": "2A", "tenKhach": "", "cmnd": "", "chuPhong": null, "thanhVien": [] },
  ...
  { "phong": "6B", "tenKhach": "", "cmnd": "", "chuPhong": null, "thanhVien": [] }
]
```

### 3. `data/settings.json`
Chứa các thiết lập giá mặc định phổ thông, không chứa đường dẫn `baseFolder` cá nhân:
```json
{
  "appId": "phong-tro-app",
  "baseFolder": "",
  "dienThoai": "",
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
  "enableAnomalyPopup": true
}
```

---

## 4. Quy Chuẩn Git & Đóng Gói (Git & Build Rules)

1. **`.gitignore`**:
   - Bắt buộc bỏ qua thư mục ảnh CCCD (`data/Thông tin người ở/` hoặc `**/Thông tin người ở/**`).
   - Bỏ qua các file session Zalo (`**/zalo_session.json`).
   - Bỏ qua các file backup/log tạm thời.

2. **Rà soát trước khi Commit (`git diff`)**:
   - Trước khi chạy `git commit`, bắt buộc chạy `git status` và `git diff -- data/` để đảm bảo không có thông tin cá nhân nào bị lọt vào staging.

3. **Cấu hình Đóng Gói `package.json`**:
   - Chỉ đóng gói các tài nguyên cần thiết.
   - Đảm bảo các template đi kèm bản build đều là template trắng.

---

## 5. Quy Trình Vá Lỗi Khi Phát Hiện Lộ Dữ Liệu

1. **Bước 1**: Sửa mã nguồn loại bỏ toàn bộ các điểm đồng bộ ngược (`sync to PROJECT_ROOT`) và các điểm fallback không an toàn.
2. **Bước 2**: Đưa các file trong `data/` về template trắng chuẩn.
3. **Bước 3**: Cập nhật `.gitignore` để ngăn chặn rò rỉ trong tương lai.
4. **Bước 4**: Nâng version (`PATCH` ví dụ `v3.0.1`) theo đúng 5 vị trí trong `quy-trinh-nang-cap-phien-ban`.
5. **Bước 5**: Build và phát hành bản cập nhật sạch lên GitHub Releases.

# 🎨 Hướng Dẫn Quy Chuẩn Giao Diện & Design System (UI Guide)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Quy chuẩn bắt buộc:** Mọi AI Agent hoặc lập trình viên khi thiết kế mới hoặc chỉnh sửa giao diện BẮT BUỘC phải tuân thủ nghiêm ngặt tài liệu này để duy trì tính nhất quán 100% của hệ thống.

---

## 1. Project UI Overview (Tổng Quan Giao Diện)

- **Phong cách thiết kế tổng thể**: Dashboard quản trị hiện đại (Modern SaaS / Desktop Admin), giao diện phẳng tinh gọn (Flat & Clean), sử dụng thẻ (Card-based Layout) và lưới (Grid Layout).
- **Mục đích & Đối tượng**: Phục vụ chủ nhà trọ nhập liệu hàng tháng. Giao diện ưu tiên **tính rõ ràng, tương phản cao, kích thước ô bấm to rộng, chữ lớn dễ đọc cho người lớn tuổi**, tối ưu thao tác bàn phím tương tự Microsoft Excel.
- **Nguyên tắc thiết kế chủ đạo**:
  1. *Clarity over Decoration*: Thông tin số tiền, chỉ số điện nước và tên khách thuê phải luôn nổi bật, không dùng hiệu ứng rườm rà che khuất nội dung.
  2. *Predictable Interactions*: Phím tắt Excel quen thuộc (`Enter`, `Shift+Enter`, `Tab`).
  3. *Error Prevention & Safety*: Cảnh báo ngay lập tức các bất thường (công tơ quay vòng, biến động $\ge 40\%$, thay đổi chưa lưu) bằng Pop-up kích thước lớn 1.5x.
  4. *Zero Layout Shifts*: Chiều cao hàng, độ rộng cột bảng và vị trí các khối luôn cố định, không co giật khi nhập số.

---

## 2. Color System (Hệ Thống Màu Sắc)

Toàn bộ mã màu được khai báo tại `:root` trong [`src/input/style.css`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/style.css) và các mẫu prototype:

| Nhóm màu | Tên biến CSS | Mã HEX | Mục đích sử dụng |
|---|---|---|---|
| **Primary (Chủ đạo)** | `--primary`<br/>`--primary-hover`<br/>`--primary-light`<br/>`--primary-dark` | `#0284c7`<br/>`#0369a1`<br/>`#e0f2fe`<br/>`#075985` | Nút bấm chính, viền focus, tiêu đề icon, badge phiên bản, liên kết chính |
| **Accent Deep (Thứ cấp)** | `--accent`<br/>`--accent-dark`<br/>`--accent-tint` | `#1D4E89`<br/>`#163D6D`<br/>`#EAF1FB` | Header bar phân hệ Quản lý người ở, viền thẻ card, icon nổi bật |
| **Success (Thành công/Đang ở)** | `--accent-success`<br/>`--accent-success-light`<br/>`--occupied`<br/>`--occupied-tint` | `#059669`<br/>`#d1fae5`<br/>`#15803D`<br/>`#E8F5EC` | Nút "Lưu & Xuất", trạng thái phòng đang có người ở, thông báo thành công |
| **Warning (Cảnh báo)** | `--accent-warning`<br/>`--accent-warning-light` | `#d97706`<br/>`#fef3c7` | Pop-up cảnh báo công tơ quay vòng, biến động $\ge 40\%$, badge nhắc nhở |
| **Danger (Nguy hiểm/Lỗi)** | `--accent-danger`<br/>`--danger` | `#dc2626`<br/>`#D92D20` | Nút xóa cư dân, thông báo lỗi, viền ô nhập sai dữ liệu |
| **Background (Nền)** | `--bg-app`<br/>`--page-bg`<br/>`--bg-card`<br/>`--surface`<br/>`--bg-table-header` | `#f1f5f9`<br/>`#F3F5F8`<br/>`#ffffff`<br/>`#ffffff`<br/>`#f8fafc` | Nền tổng thể ứng dụng, nền thẻ card, nền hàng tiêu đề bảng tính |
| **Inputs (Ô nhập liệu)** | `--bg-input`<br/>`--bg-input-locked`<br/>`--field-bg` | `#ffffff`<br/>`#e2e8f0`<br/>`#FBFBFC` | Nền ô cho phép nhập, nền ô khóa (readonly kế thừa tháng trước) |
| **Text (Chữ)** | `--text-main`<br/>`--ink`<br/>`--text-muted`<br/>`--ink-soft`<br/>`--ink-muted`<br/>`--text-white` | `#0f172a`<br/>`#101828`<br/>`#64748b`<br/>`#475467`<br/>`#98A2B3`<br/>`#ffffff` | Chữ tiêu đề và nội dung chính, chữ phụ/mô tả mờ, placeholder, chữ trên nền đậm |
| **Border (Đường viền)** | `--border-color`<br/>`--border-light`<br/>`--border`<br/>`--border-strong` | `#cbd5e1`<br/>`#e2e8f0`<br/>`#E4E7EC`<br/>`#D0D5DD` | Viền ô nhập liệu, đường phân cách bảng, viền thẻ card |

---

## 3. Typography (Hệ Thống Kiểu Chữ)

### 3.1. Ứng dụng Quản trị (Renderer)
- **Font Family**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Thang kích thước chuẩn**:
  - `11px - 12px`: Chú thích phụ (Caption), nhãn mô tả nhỏ (`.help-text`, `.stat-label`, `.title-version-tag`).
  - `13px`: Nhãn form, tab điều hướng (`.tab-btn`), nút bấm tiêu chuẩn (`.btn`), hàng dữ liệu bảng (`.data-table td`).
  - `14px`: Kích thước chữ cơ sở (`body`), nội dung thông báo Toast.
  - `15px - 16px`: Tiêu đề thẻ card phụ, nhãn phòng trong lưới Occupancy.
  - `18px`: Tiêu đề trang Header Brand (`.brand-text h1`), tiêu đề Modal thường.
  - `20px - 22px`: Tiêu đề Modal 1.5x (`.modal-title-group h3`).
  - `24px - 28px`: Số liệu thống kê lớn (`.stat-value`).
- **Font Weight**: `400` (Regular), `500` (Medium), `600` (Semi-bold), `700` (Bold).
- **Line Height**: `1.4` – `1.5` cho văn bản thông thường; `1.2` cho các khối tiêu đề lớn.

### 3.2. Mẫu Phiếu Thu In Ấn (`src/receipt/`)
- **Font Family**: `"Times New Roman", Times, serif` (quy chuẩn bắt buộc cho chứng từ in ấn truyền thống tại Việt Nam).
- **Kích thước cố định**:
  - Tiêu đề "PHIẾU THU TIỀN NHÀ": `29px` (Bold).
  - Phòng số: `25px` (Bold).
  - Nội dung các dòng thu tiền: `23px` (Regular/Bold).
  - Tổng cộng: `30px` (Bold).

---

## 4. Design Tokens & Kích Thước Tiêu Chuẩn

### 4.1. Bo Góc (Border Radius)
- `--radius-sm: 6px`: Ô nhập liệu, nút bấm nhỏ, badge trạng thái, tag phiên bản.
- `--radius-field: 7px`: Các ô input trong modal người thuê.
- `--radius-md: 10px`: Card thống kê nhỏ, dropdown menu, icon container.
- `--radius-lg: 14px` / `--radius-card: 14px`: Thẻ card lớn, Modal card phóng to.

### 4.2. Hiệu Ứng Đổ Bóng (Box Shadows)
- `--shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (Thẻ card phẳng, tab active).
- `--shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (Dropdown menu, hover card).
- `--shadow-lg`: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` (Modal overlay card, Lightbox preview).
- **Nút bấm Gradient Shadow**: `0 2px 4px rgba(2, 132, 199, 0.2)` nâng lên `0 4px 8px rgba(2, 132, 199, 0.3)` khi hover.

### 4.3. Kích Thước Thành Phần (Standard Heights & Sizes)
- **Header Bar**: `height: 64px`, `position: sticky; top: 0; z-index: 100`.
- **Ô Input tiêu chuẩn**: `height: 38px`, padding `8px 12px`, font-size `13px`.
- **Hàng bảng tính (`tr`)**: `height: 48px`, đảm bảo con trỏ chuột dễ nhắm và click.
- **Modal thường**: Chiều rộng `540px – 660px`.
- **Modal cảnh báo 1.5x (`#rollover-modal`, `#anomaly-modal`)**: Chiều rộng `720px – 780px`.
- **Modal Form Người thuê (`#resident-form-modal`)**: Chiều rộng `740px`.

### 4.4. Điểm Ngắt Giao Diện (Responsive Breakpoints)
- `@media (max-width: 1180px)`: Lưới phòng Quản lý người ở chuyển từ 6 cột sang 4 cột.
- `@media (max-width: 860px)`: Thống kê chuyển thành 2 cột; Lưới phòng chuyển thành 3 cột.
- `@media (max-width: 680px)`: Form thêm người thuê chuyển thành 1 cột đơn.
- `@media (max-width: 640px)`: Modal chọn phòng Zalo chuyển sang 1 cột.
- `@media (max-width: 560px)`: Lưới phòng chuyển thành 2 cột.

---

## 5. Bố Cục Không Gian (Layout System)

Ứng dụng chia làm 3 phân vùng dọc chính:
```
+-----------------------------------------------------------------------------------+
|  [Logo] QUẢN LÝ PHÒNG TRỌ v3.0.1  |  [Tab 1] [Tab 2] [Tab 3]  | [Tháng/Năm] [Lưu&Xuất] |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   <MAIN CONTENT AREA>                                                            |
|   - Phần 1: Bảng 12 phòng + Stats Cards + Nút Gửi Zalo                           |
|   - Phần 2: Cài Đặt Chung (Thư mục, Bảng giá, Ngân hàng, Zalo, Toggle Switch)    |
|   - Phần 3: Quản Lý Phòng & Người Ở (Lưới phòng, Bảng cư dân, Ảnh CCCD)          |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|  [Toast Notifications - Cố định góc dưới bên phải màn hình]                       |
+-----------------------------------------------------------------------------------+
```

---

## 6. Thư Viện Thành Phần Chuẩn (Component Library)

### 6.1. Nút Bấm (Buttons)
1. **Nút Primary (`.btn.btn-primary`)**:
   - Nền: Gradient `linear-gradient(135deg, #0284c7, #0369a1)`.
   - Chữ: Trắng, `font-weight: 600`.
   - Hover: Dịch chuyển nhẹ lên `translateY(-1px)` kèm bóng đổ đậm hơn.
2. **Nút Lưu & Xuất (`.btn.btn-save-export`)**:
   - Nền: Gradient xanh lá `linear-gradient(135deg, #059669, #047857)`.
   - Nổi bật nhất trên Header Bar để thu hút sự chú ý.
3. **Nút Secondary (`.btn.btn-secondary`)**:
   - Nền trắng, viền `#cbd5e1`, chữ đen `#0f172a`.
   - Hover: Nền xám nhạt `#f8fafc`.
4. **Trạng thái Disabled (`.btn:disabled`)**:
   - `opacity: 0.6`, `cursor: not-allowed`, không nhận hiệu ứng hover dịch chuyển.

### 6.2. Ô Nhập Liệu & Form Fields
1. **Ô Nhập Số Liệu Thường (`.cell-input`)**:
   - Nền trắng, căn phải cho số tiền/chỉ số, căn giữa cho số phòng/STT.
   - Khi focus: Viền đổi sang `#0284c7` kèm bóng focus `0 0 0 3px rgba(2, 132, 199, 0.15)`.
2. **Ô Số Liệu Bị Khóa (`.locked-input`)**:
   - Thuộc tính `readonly`, nền xám nhạt `#e2e8f0`, chữ xám `#64748b`.
   - Con trỏ `not-allowed`.
3. **Bộ Chọn Ngày Mặt Nạ (`DateMaskInput` - `src/shared/date-picker.js`)**:
   - Định dạng hiển thị mặt nạ tự động: `dd/mm/yyyy`.
   - Tự động nhảy ô qua dấu gạch chéo `/`, chặn ký tự không phải số.
   - Nút icon lịch nhỏ bên phải mở Popup chọn lịch 100+ năm.
4. **Loại bỏ Hoàn Toàn Nút Tăng/Giảm (Spinners/Steppers) Trên Ô Số**:
   - Ẩn hoàn toàn 2 nút mũi tên tăng/giảm 1 đơn vị trên tất cả ô số (`input[type="number"]`) ở Phần 1 (bảng điện nước) và Phần 2 (cài đặt giá) bằng `::-webkit-inner-spin-button { -webkit-appearance: none; }` và `appearance: textfield`.
   - Chặn sự kiện cuộn con lăn chuột (`wheel`) khi trỏ vào ô số để tránh vô tình làm nhảy số.
   - Chặn phím mũi tên Lên/Xuống (`ArrowUp`/`ArrowDown`) làm thay đổi số trong ô; riêng ở bảng nhập liệu Phần 1, phím mũi tên Lên/Xuống được chuyển thành phím điều hướng di chuyển giữa các hàng phòng như Excel.

### 6.3. Bảng Chọn Ngân Hàng Tùy Biến (Custom Searchable Bank Select)
- Vị trí: Tab Cài Đặt Chung.
- Giao diện: Hiển thị logo chính thức của ngân hàng (từ MoMo CDN), tên viết tắt (Short Name) và tên đầy đủ.
- Có ô tìm kiếm tức thì theo tên viết tắt, mã BIN hoặc tên đầy đủ không phân biệt dấu tiếng Việt.

### 6.4. Công Tắc Bật / Tắt (Toggle Switch)
- Thiết kế dạng nút trượt phong cách iOS hiện đại:
  - Vỏ bọc: Rộng `48px`, cao `26px`, bo tròn hoàn toàn `radius: 13px`.
  - Nút trượt: Tròn `20px`, màu trắng, đổ bóng nhẹ.
  - Trạng thái Tắt (Off): Nền xám `#cbd5e1`.
  - Trạng thái Bật (On): Nền xanh dương `#0284c7`, nút trượt dịch chuyển sang phải `22px`.

### 6.5. Cấu Trúc Hộp Thoại (Modal Dialog Pattern)
Tất cả các Modal trong dự án bắt buộc dùng khung cấu trúc chuẩn:
```html
<div id="modal-id" class="modal-overlay" style="display: none;">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-icon [warning|info|danger|success]">...SVG Icon...</div>
      <div class="modal-title-group">
        <h3>Tiêu đề Modal</h3>
        <p class="modal-subtitle">Phụ đề giải thích</p>
      </div>
      <button class="modal-close-btn" onclick="...">✕</button>
    </div>
    <div class="modal-body">
      <!-- Nội dung tương tác hoặc bảng thông số .modal-info-box -->
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="...">Hủy Bỏ</button>
      <button type="button" class="btn btn-primary" onclick="...">Xác Nhận</button>
    </div>
  </div>
</div>
```

### 6.6. Thông Báo Nổi (Toast Notification System)
- Vị trí: Cố định góc dưới bên phải (`bottom: 24px; right: 24px; z-index: 9999`).
- Hàm kích hoạt: `showToast(message, type = 'success' | 'error' | 'warning' | 'info')`.
- Hành vi:
  - Tự động lọc các thông báo trùng lặp đang hiển thị.
  - Tối đa hiển thị cùng lúc 2 thông báo xếp chồng lên nhau.
  - Tự biến mất êm dịu sau `3.5 giây`.

---

## 7. Tài Liệu Chi Tiết Từng Màn Hình (Page-by-Page Documentation)

### 7.1. Màn Hình 1: Phần 1 — Nhập Dữ Liệu (`#section-data`)
- **Mục đích**: Nhập chỉ số điện mới, nước mới hàng tháng cho 12 phòng và xuất phiếu.
- **Các vùng chức năng**:
  1. *Thẻ thống kê nhanh*: Doanh thu tháng này (xanh lá), Tổng điện tiêu thụ (vàng cam), Tổng nước tiêu thụ (xanh biển), Số phòng đã nhập (xanh dương).
  2. *Thanh thao tác bảng*: Tiêu đề "BẢNG CHỈ SỐ VÀ TÍNH TIỀN ĐIỆN NƯỚC" kèm nút **"Gửi Zalo"** màu xanh dương ở góc phải.
  3. *Bảng tính chính 12 phòng (16 cột)*:
     - STT, Số Phòng.
     - Cụm Điện: Điện Cũ (khóa), Điện Mới, Điện Tiêu Thụ.
     - Cụm Nước: Nước Cũ (khóa), Nước Mới, Nước Tiêu Thụ.
     - Cụm Tiền dịch vụ: Tiền Điện, Tiền Nước, Tiền Phòng, Rác, Internet, Hao Tải (kWh), Tiền Hao Tải.
     - Cột Tổng Cộng: Chữ đậm, to rõ, nền nổi bật.
     - **Biểu tượng cảnh báo bất thường (`!`)**: Badge tròn `.meter-alert-badge` nằm gọn phía góc phải của ô Điện Mới khi người dùng đã xác nhận đồng hồ quay vòng (màu cam `.badge-rollover`), tiêu thụ $\ge 40\%$ (màu hổ phách `.badge-anomaly`), hoặc cả hai (màu đỏ `.badge-both`). Click vào badge mở lại modal để xem thông số so sánh hoặc hủy bỏ. Trạng thái được lưu vĩnh viễn vào `settings.json` (`confirmedAlerts`).
     - **Vô hiệu hóa bộ tăng/giảm đơn vị (Steppers)**: Ẩn nút mũi tên và chặn cuộn chuột/phím mũi tên Lên/Xuống trên tất cả các ô điền số.
  4. *Hàng tính tổng chân bảng (`tfoot`)*: Hiển thị tổng số điện tiêu thụ, tổng số nước và tổng doanh thu toàn bộ dãy trọ.

### 7.2. Màn Hình 2: Phần 2 — Cài Đặt Chung (`#section-settings`)
- **Mục đích**: Cấu hình các tham số hệ thống, thông tin thanh toán và tích hợp tài khoản.
- **Các khối chức năng (Cards)**:
  1. *Thư mục lưu trữ*: Ô hiển thị đường dẫn `baseFolder` kèm nút "Chọn Thư Mục" (Browse dialog).
  2. *Bảng giá mặc định*: Giá phòng, giá điện, giá nước, tiền rác, internet, tỷ lệ hao tải điện, SĐT chủ trọ kèm nút "Lưu Cài Đặt Giá".
  3. *Cài đặt ngân hàng & VietQR*: Chọn ngân hàng (dropdown có logo), số tài khoản, tên chủ tài khoản viết hoa không dấu, nút "Lưu Tài Khoản Ngân Hàng".
  4. *Tùy chọn thành phần gửi Zalo (`.zalo-send-options-card`)*: 3 hàng lựa chọn độc lập (Hình phiếu tiền, Mã QR thanh toán, Tin nhắn Zalo) với custom checkmark hình tròn xanh lá (`.custom-check-circle`), có thể click trực tiếp vào dòng để bật/tắt.
  5. *Trình tùy chỉnh mẫu tin nhắn Zalo & Live Preview (`#zalo-template-customizer`)*:
     - Nút "Khôi phục mẫu gốc" đặt lại về nội dung chuẩn.
     - Toolbar danh sách thẻ biến (Chips) phân loại màu sắc: Cơ bản, Ngân hàng, Phí & Dịch vụ, Điện & Nước.
     - Khung soạn thảo 2 lớp: Backdrop (`.zalo-editor-backdrop`) làm nổi bật các thẻ biến `.editor-var-chip` (sử dụng `padding: 0; margin: 0; border: none; box-shadow: 0 0 0 1px #93c5fd` để loại bỏ hoàn toàn việc lệch vị trí chữ giữa textarea và backdrop) (hoặc đỏ `.editor-var-invalid`) bên dưới textarea trong suốt, giữ trọn vẹn 100% trải nghiệm gõ tiếng Việt có dấu.
     - Banner cảnh báo biến không hợp lệ tự động nhận diện cú pháp sai.
     - Bong bóng mô phỏng tin nhắn Zalo trên điện thoại (Live Preview) với dropdown chọn xem trước theo từng phòng (`1A`–`6B`) và theo tháng thực tế.
  6. *Tài khoản Zalo*: Avatar người dùng, Tên hiển thị, SĐT, Badge kết nối (Xanh: Đã kết nối / Đỏ: Chưa kết nối) và các nút thao tác (Đăng Nhập QR, Đổi Tài Khoản, Đăng Xuất).
  7. *Cấu hình Pop-up cảnh báo*: 2 công tắc Toggle switch bật/tắt cảnh báo quay vòng và biến động $\ge 40\%$.
  8. *Thông tin phiên bản*: Hiển thị version hiện tại và nút "Kiểm Tra Cập Nhật".

### 7.3. Màn Hình 3: Phần 3 — Quản Lý Phòng & Người Ở (`#section-residents`)
- **Mục đích**: Quản lý thông tin cư dân, tình trạng phòng và ảnh CCCD.
- **Các vùng chức năng**:
  1. *4 Thẻ tổng quan*: Tổng số phòng (12), Phòng đang có người ở, Phòng trống, Tổng số người thuê.
  2. *Lưới 12 thẻ phòng (Occupancy Grid)*:
     - Thẻ phòng: Tên phòng (VD: `Phòng 1A`), Badge trạng thái ("Đang ở" xanh lá / "Phòng trống" xám).
     - Thông tin: Tên chủ phòng (đại diện) và số lượng người ở (`X người`).
     - Nút "Chi Tiết": Mở `#room-detail-modal` để phân bổ chủ phòng và chọn thành viên.
  3. *Thanh công cụ danh sách cư dân*: Ô tìm kiếm tức thì theo tên/CCCD/SĐT, Dropdown lọc theo phòng (`Tất cả các phòng`, `1A` đến `6B`), Nút "Thêm Người Thuê", Nút "Xóa Đã Chọn".
  4. *Bảng danh sách cư dân*: Cột Checkbox chọn nhiều, STT, Họ và tên, Phòng, CCCD/CMND, Số điện thoại, Ngày sinh, Ngày vào ở, Trạng thái ảnh CCCD (icon ảnh có thể bấm xem), Cột Thao tác (Nút Sửa, Nút Xóa).

---

## 8. Trạng Thái Giao Diện & Tương Tác (Interactions & States)

- **Hover**: Nút bấm nâng nhẹ `translateY(-1px)`, thẻ card nâng bóng đổ.
- **Focus**: Ô nhập liệu có viền màu xanh primary `#0284c7` và vòng hào quang `box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15)`.
- **Loading / Busy**: Nút bấm bị vô hiệu hóa (`disabled`), xuất hiện icon vòng xoay chuyển động tròn (`.spin-icon` với `animation: spin 1s linear infinite`).
- **Empty State**: Khi phòng chưa có người ở hiển thị "Phòng trống" kèm viền nét đứt; khi bảng cư dân rỗng hiển thị dòng thông báo *"Chưa có dữ liệu người thuê trọ nào"*.
- **Error State**: Viền đỏ rực `#dc2626`, hiển thị dòng chữ báo lỗi nhỏ màu đỏ bên dưới ô nhập liệu.
- **Page Transition (Hiệu Ứng Chuyển Đổi Phân Hệ Nhòe Mờ - Blur Transition)**:
  - Khi chuyển đổi giữa Phần 1, Phần 2 và Phần 3, giao diện áp dụng animation nhòe mờ cinematic:
    - Tab cũ rời đi: `.page-out` (`animation: blur-out 700ms cubic-bezier(.65, 0, .35, 1) both; z-index: 1;`).
    - Tab mới xuất hiện: `.page-in` (`animation: blur-in 700ms cubic-bezier(.65, 0, .35, 1) both; z-index: 2;`).
    - Biến hướng CSS `--dir`: `1` (khi chuyển tiến: Phần 1 $\rightarrow$ 2 $\rightarrow$ 3) hoặc `-1` (khi chuyển lùi).
    - Cấu trúc xếp chồng CSS Grid: `.app-main` sử dụng `display: grid; grid-template-columns: 100%;` kết hợp `.tab-content { grid-area: 1 / 1 / 2 / 2; }` cho phép hai trang hiển thị đè khớp nhau trong suốt 700ms mà không bị đẩy lệch layout hay giật chiều cao.
- **Cơ chế Khóa Chuyển Tab (Navigation Lock - `.nav-locked`)**: Trong suốt 700ms hiệu ứng đang diễn ra, thanh `.nav-tabs` được gán class `.nav-locked` (`pointer-events: none !important; cursor: default;`) và biến cờ `isTabTransitioning = true` chặn toàn bộ thao tác click tiếp theo cho đến khi trang mới chuyển cảnh hoàn tất 100%, ngăn ngừa triệt để lỗi click nhanh gây đè chồng các phân hệ lên nhau.

---

## 9. Thư Viện Biểu Tượng & Tài Nguyên (Assets & Icons)

- **Thư viện Icon**: Toàn bộ icon trong ứng dụng sử dụng mã **SVG thuần (SVG Inlined)** theo chuẩn thiết kế Lucide / Feather Icons:
  - Cấu hình chuẩn: `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.
  - Kích thước chuẩn: `16px x 16px` (trong nút bấm/bảng), `18px x 18px` (trên tab/thanh tác vụ), `24px x 24px` (trong thẻ thống kê và tiêu đề modal).
- **Bộ Icon Ứng Dụng**: Đặt tại `assets/icon/` với đầy đủ kích thước Windows: `icon32x32.ico`, `icon48x48.ico`, `icon64x64.ico`, `icon128x128.ico`, `icon256x256.ico`, `icon512x512.ico`.

---

## 10. Những Quy Chuẩn BẮT BUỘC Phải Tuân Thủ Khi Phát Triển Mới

1. 🚫 **CẤM tự ý đổi font chữ hoặc đưa font lạ vào hệ thống**:
   - Màn hình quản trị: Bắt buộc dùng `'Inter'`.
   - Mẫu in phiếu thu: Bắt buộc dùng `"Times New Roman"`.
2. 🚫 **CẤM thay đổi bảng màu chủ đạo `:root`**:
   - Tuyệt đối không thay đổi mã HEX của `--primary` (`#0284c7`), `--accent-success` (`#059669`), `--accent-warning` (`#d97706`), `--accent-danger` (`#dc2626`).
3. 🚫 **CẤM làm mất định dạng tiền tệ Việt Nam**:
   - Toàn bộ số tiền hiển thị trên giao diện phải qua hàm `formatMoney()`: dấu CHẤM phân cách hàng nghìn kèm ký hiệu `đ` ở cuối (VD: `2.200.000 đ`). Tuyệt đối không dùng dấu phẩy kiểu Mỹ (`2,200,000`).
4. 🚫 **CẤM tự ý xóa bỏ hoặc thu nhỏ các Modal Cảnh báo 1.5x**:
   - Các modal `#rollover-modal` và `#anomaly-modal` được thiết kế phóng to có chủ đích để người lớn tuổi đọc rõ số liệu, không được thu nhỏ lại.
5. 🚫 **Luôn duy trì tính nhất quán khi tạo Component mới**:
   - Sử dụng lại các class CSS có sẵn: `.btn`, `.btn-primary`, `.btn-secondary`, `.stat-card`, `.modal-overlay`, `.modal-card`, `.custom-select`. Không tự tạo class mới có cùng mục đích.

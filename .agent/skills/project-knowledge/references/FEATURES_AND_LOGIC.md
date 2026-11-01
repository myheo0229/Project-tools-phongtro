# ⚙️ Danh Sách Tính Năng & Logic Nghiệp Vụ (Features & Business Logic)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Mục tiêu:** Mô tả chi tiết toàn bộ các tính năng, quy trình xử lý, công thức toán học và các trường hợp biên (edge cases).

---

## 1. Danh Mục Toàn Bộ Tính Năng Hiện Có

| STT | Tên tính năng | Phân hệ / Tab | Vị trí mã nguồn chính | Trạng thái |
|---|---|---|---|---|
| 1 | Khởi động & Quản lý thư mục qua con trỏ `pointer.json` | Hệ thống | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 2 | Bảng nhập chỉ số 12 phòng & Điều hướng kiểu Excel | Phần 1: Nhập Dữ Liệu | `src/input/index.html`, `renderer.js` | ✅ Hoàn thành |
| 3 | Tự động kế thừa chỉ số cũ từ tháng trước & Khóa ô | Phần 1: Nhập Dữ Liệu | `src/input/renderer.js` (`loadRoomsForMonth`) | ✅ Hoàn thành |
| 4 | Tính toán tự động thời gian thực (Realtime Calc) | Phần 1: Nhập Dữ Liệu | `src/shared/calc.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 5 | Phát hiện & Xác nhận Công tơ điện quay vòng (Rollover) | Phần 1: Nhập Dữ Liệu | `src/input/renderer.js`, `calc.js` | ✅ Hoàn thành |
| 6 | Cảnh báo biến động tiêu thụ điện $\ge 40\%$ | Phần 1: Nhập Dữ Liệu | `src/input/renderer.js` (`handleDienMoiBlur`) | ✅ Hoàn thành |
| 7 | Cảnh báo thay đổi Cài đặt chưa lưu (Unsaved Warning) | Phần 2 & Điều hướng | `src/input/renderer.js` (`switchTab`) | ✅ Hoàn thành |
| 8 | Quản lý chu kỳ Tháng/Năm mở rộng theo tiến độ | Header Bar | `src/input/renderer.js` (`populateMonthSelect`) | ✅ Hoàn thành |
| 9 | Lưu lịch sử tháng vào file JSON | Phần 1 & Header | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 10 | Xuất hàng loạt 12 ảnh JPG (3x scale) + 1 file PDF gộp | Phần 1 & Header | `electron/main.js`, `src/receipt/` | ✅ Hoàn thành |
| 11 | Cấu hình Bảng giá & Tự động sao chép khi đổi thư mục | Phần 2: Cài Đặt Chung | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 12 | Công tắc Toggle Switch Bật/Tắt Pop-up Cảnh báo | Phần 2: Cài Đặt Chung | `src/input/index.html`, `renderer.js` | ✅ Hoàn thành |
| 13 | Cấu hình Tài khoản Ngân hàng & Tích hợp VietQR | Phần 2: Cài Đặt Chung | `src/input/renderer.js`, `banks-data.js` | ✅ Hoàn thành |
| 14 | Xác thực Zalo quét mã QR thời gian thực | Phần 2: Cài Đặt Chung | `electron/zalo-manager.js`, `renderer.js` | ✅ Hoàn thành |
| 15 | Khôi phục phiên Zalo ngầm lúc khởi động | Phần 2 & Nền | `electron/main.js`, `zalo-manager.js` | ✅ Hoàn thành |
| 16 | Tự động Gửi Phiếu Thu qua Zalo theo danh sách phòng | Phần 1 & Nền | `src/input/renderer.js`, `zalo-manager.js` | ✅ Hoàn thành |
| 17 | Báo cáo Tổng kết Kết quả Gửi Zalo | Phần 1: Pop-up | `src/input/renderer.js` (`showZaloSummary...`) | ✅ Hoàn thành |
| 18 | Tùy chọn 3 thành phần gửi Zalo (Ảnh phiếu, Mã QR, Tin nhắn) | Phần 2: Cài Đặt Chung | `src/input/renderer.js`, `zalo-manager.js` | ✅ Hoàn thành |
| 19 | Trình chỉnh sửa mẫu tin nhắn Zalo tùy biến & Live Preview | Phần 2: Cài Đặt Chung | `src/input/renderer.js`, `zalo-manager.js` | ✅ Hoàn thành |
| 20 | Thẻ trạng thái 12 phòng trọ & Thống kê cư dân | Phần 3: Người Ở | `src/input/renderer.js` (`renderRoomCards`) | ✅ Hoàn thành |
| 21 | Phân bổ phòng: Chọn chủ phòng & Checklist thành viên | Phần 3: Pop-up | `src/input/renderer.js` (`openRoomDetail...`) | ✅ Hoàn thành |
| 22 | Quản lý Hồ sơ Người thuê (CRUD, Tìm kiếm, Lọc) | Phần 3: Người Ở | `src/input/renderer.js` (`renderResidentsTable`) | ✅ Hoàn thành |
| 23 | Quản lý & Xem Lightbox Ảnh CCCD 2 mặt | Phần 3: Pop-up | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 24 | Masked Date Input (`dd/mm/yyyy`) & Calendar Popup | Phần 3: Form | `src/shared/date-picker.js`, `date-picker.css` | ✅ Hoàn thành |
| 25 | Tự động Cập nhật ứng dụng (Auto Updater + GitHub) | Toàn hệ thống | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 24 | Thông báo Toast góc màn hình | Toàn hệ thống | `src/input/renderer.js` (`showToast`) | ✅ Hoàn thành |

---

## 2. Mô Tả Chi Tiết Từng Tính Năng & Logic Nghiệp Vụ

### 2.1. Logic Tính Tiền Cốt Lõi (`src/shared/calc.js`)

#### Thông số đầu vào của 1 phòng:
- `phong`: Mã phòng (VD: `"1A"` đến `"6B"`).
- `dienCu`, `dienMoi`: Chỉ số điện cũ và mới (kWh, số nguyên không âm).
- `nuocCu`, `nuocMoi`: Chỉ số nước cũ và mới ($m^3$, số nguyên không âm).
- `tienPhong`: Đơn giá thuê phòng riêng biệt của phòng này (VNĐ).

#### Thông số Cài đặt chung:
- `giaDien`: Đơn giá điện (VNĐ/kWh, mặc định `2.900`).
- `giaNuoc`: Đơn giá nước (VNĐ/$m^3$, mặc định `12.000`).
- `tyLeHaoTai`: Tỷ lệ điện hao tải (dạng thập phân, mặc định `0.07` = 7%).
- `tienRac`: Tiền rác sinh hoạt (VNĐ/tháng, mặc định `40.000`).
- `tienInternet`: Tiền mạng internet (VNĐ/tháng, mặc định `24.000`).

#### Các bước tính toán toán học chuẩn:
1. **Số điện tiêu thụ (`dienTieuThu`)**:
   - Nếu `dienMoi >= dienCu`:
     $$\text{dienTieuThu} = \text{dienMoi} - \text{dienCu}$$
   - Nếu `dienMoi < dienCu` (Công tơ quay vòng):
     $$\text{dienTieuThu} = (10000 + \text{dienMoi}) - \text{dienCu}$$
     *(Hằng số `MAX_DONG_HO_DIEN = 10000`)*.
2. **Số nước tiêu thụ (`nuocTieuThu`)**:
   $$\text{nuocTieuThu} = \max(0, \text{nuocMoi} - \text{nuocCu})$$
3. **Tiền điện (`tienDien`)**:
   $$\text{tienDien} = \text{round1000}(\text{dienTieuThu} \times \text{giaDien})$$
   *(Quy tắc làm tròn: $\ge 500$ làm tròn lên, $< 500$ làm tròn xuống)*.
4. **Tiền nước (`tienNuoc`)**:
   $$\text{tienNuoc} = \text{round1000}(\text{nuocTieuThu} \times \text{giaNuoc})$$
5. **Điện hao tải (`dienHaoTai`)**:
   $$\text{dienHaoTai} = \text{round1}(\text{dienTieuThu} \times \text{tyLeHaoTai})$$
   *(Làm tròn đúng 1 chữ số thập phân)*.
6. **Tiền điện hao tải (`tienDienHaoTai`)**:
   $$\text{tienDienHaoTai} = \text{round1000}(\text{dienHaoTai} \times \text{giaDien})$$
7. **Tổng cộng từng phòng (`tongCong`)**:
   $$\text{tongCong} = \text{tienDien} + \text{tienNuoc} + \text{tienDienHaoTai} + \text{tienPhong} + \text{tienRac} + \text{tienInternet}$$
   *(Không làm tròn thêm ở bước này vì mọi thành phần cộng vào đều đã là bội số của 1.000)*.
8. **Tổng doanh thu tháng (`tongDoanhThu`)**:
   Tổng `tongCong` của cả 12 phòng cộng lại.

> [!IMPORTANT]
> **Tuyệt đối không có trường "Nợ cũ"**: Khoản nợ cũ đã bị loại bỏ hoàn toàn khỏi hệ thống, không cộng vào `tongCong` và mặc định ẩn trên phiếu thu.

---

### 2.2. Xử Lý Công Tơ Điện Quay Vòng (Rollover Modal)
- **Kích hoạt khi**: Người dùng nhập xong ô `Điện Mới` và rời khỏi ô (`blur`), nếu `dienMoi < dienCu` và tính năng được bật trong cài đặt (`enableRolloverPopup === true`).
- **Giao diện Modal 1.5x (`#rollover-modal`)**:
  - Tiêu đề: *Xác Nhận Công Tơ Điện Quay Vòng*.
  - Nội dung: Hiển thị rõ số phòng, số cũ, số mới và công thức áp dụng: `(10.000 + Mới) - Cũ = [Số điện tiêu thụ] kWh`.
- **Hành vi lựa chọn**:
  - Bấm **"Đồng ý (Áp dụng công thức)"**: Lưu cờ `room._rolloverConfirmed = true`, áp dụng công thức quay vòng và tính toán lại tiền.
  - Bấm **"Hủy bỏ (Nhập lại)"**: Reset giá trị ô `Điện Mới` về rỗng, focus lại vào ô để người dùng gõ lại số đúng.

---

### 2.3. Cảnh Báo Tiêu Thụ Điện Bất Thường $\ge 40\%$ (Anomaly Modal)
- **Kích hoạt khi**: Người dùng nhập xong ô `Điện Mới` (`blur`), số điện tiêu thụ tháng này chênh lệch tăng hoặc giảm $\ge 40\%$ so với số điện tiêu thụ của chính phòng đó trong tháng liền trước, và cờ `enableAnomalyPopup === true`.
- **Giao diện Modal 1.5x (`#anomaly-modal`)**:
  - Tiêu đề: *Cảnh Báo Tiêu Thụ Điện Bất Thường*.
  - Thể hiện: Số điện tiêu thụ tháng trước ($A$ kWh), tháng này ($B$ kWh), tỷ lệ chênh lệch $\%$ kèm màu sắc cảnh báo (màu cam/đỏ).
- **Hành vi lựa chọn**:
  - Bấm **"Xác nhận số liệu đúng"**: Đánh dấu đã xác nhận cho phòng này trong phiên làm việc, giữ nguyên số liệu.
  - Bấm **"Kiểm tra lại"**: Focus lại ô `Điện Mới` để người dùng rà soát lại chỉ số thực tế trên đồng hồ.

---

### 2.4. Điều Hướng Bàn Phím Kiểu Excel (Keyboard Navigation)
- Bảng 12 phòng hỗ trợ phím tắt điều hướng nhanh trong hàm `handleTableKeyDown`:
  - **Phím `Enter`**: Di chuyển con trỏ xuống ô cùng loại của phòng bên dưới (ví dụ từ ô `Điện Mới 1A` xuống `Điện Mới 2A`). Khi ở phòng cuối cùng (`6B`), chuyển sang ô đầu tiên của cột tiếp theo (`Nước Mới 1A`).
  - **Phím `Shift + Enter`**: Di chuyển con trỏ lên ô cùng loại của phòng bên trên.
  - **Phím `Tab`**: Di chuyển sang ô nhập liệu tiếp theo của cùng một hàng phòng.
- Ô số cũ (`dienCu`, `nuocCu`) mang class `.locked-input` và thuộc tính `readonly`, con trỏ bàn phím sẽ tự động bỏ qua các ô này.

---

### 2.5. Tự Động Kế Thừa Chỉ Số & Quản Lý Chu Kỳ Tháng
- **Khởi tạo chu kỳ tháng**: Khởi đầu từ mốc `2026-07`.
- **Nguyên tắc mở rộng dropdown tháng (`populateMonthSelect`)**:
  - Ứng dụng đọc file lịch sử tháng hiện tại.
  - **Chỉ khi nào cả 12 phòng của tháng hiện tại đã được nhập đầy đủ chỉ số mới** (`dienMoi` và `nuocMoi` đều có giá trị), hệ thống mới tự động sinh thêm tháng tiếp theo vào dropdown lựa chọn.
  - Không tự ý sinh tháng mới dựa theo ngày giờ máy tính để tránh việc người dùng nhảy cóc tháng gây đứt gãy dữ liệu kế thừa.
- **Kế thừa chỉ số (`loadRoomsForMonth`)**:
  - Khi người dùng chọn tháng $T$, hệ thống đọc file lịch sử tháng $T-1$.
  - Lấy `dienMoi` của tháng $T-1$ điền tự động vào `dienCu` của tháng $T$.
  - Lấy `nuocMoi` của tháng $T-1$ điền tự động vào `nuocCu` của tháng $T$.
  - Khóa ô số cũ không cho người dùng sửa tay nhằm bảo đảm tính liên tục của đồng hồ.

---

### 2.6. Quy Trình Xuất Phiếu Thu Tự Động (Lưu & Xuất)
- **Nút bấm duy nhất**: `#btn-save-export` ("Lưu & Xuất").
- **Tiến trình thực thi**:
  1. Kiểm tra thư mục lưu trữ `baseFolder`: Nếu chưa thiết lập, dừng lại và thông báo lỗi.
  2. Ghi đè file lịch sử tháng hiện tại `<baseFolder>/data/history/YYYY-MM.json`.
  3. Gọi IPC `exportReceipts(monthKey, roomDataList)` sang Main Process.
  4. Nếu tháng này đã từng xuất phiếu trước đó, hiển thị Dialog hỏi xác nhận ghi đè: *"Đã có dữ liệu xuất của tháng này, ghi đè toàn bộ?"*.
  5. Mở 2 cửa sổ ẩn `receiptWin` và `rasterWin`.
  6. Lần lượt render từng phòng, kết xuất PDF và chuyển sang JPEG (tỉ lệ phóng đại 3x siêu nét).
  7. Gộp 12 trang thành 1 file PDF tổng bằng `pdf-lib`.
  8. Lưu vào thư mục: `<baseFolder>/PhieuThu/Thang_<MM>_<YYYY>/`.
  9. Tự động mở cửa sổ Windows Explorer trỏ tới thư mục vừa xuất.
  10. Báo Toast thành công.

---

### 2.7. Tích Hợp Zalo & Gửi Phiếu Thu Tự Động

#### A. Xác thực và quản lý tài khoản:
- Đăng nhập bằng mã QR thời gian thực thông qua `zca-js`.
- Bấm "Đăng Nhập Bằng Mã QR" $\rightarrow$ Mở `#zalo-qr-modal` $\rightarrow$ Tự động đếm ngược 120s.
- Nếu mã hết hạn $\rightarrow$ Bấm "Tạo Mã Mới" để retry.
- Sau khi quét thành công: Lưu session vào `userData/zalo_session.json` và cập nhật Avatar thật, Tên thật, SĐT của chủ trọ trên giao diện.

#### B. Quy trình gửi phiếu thu tự động (`executeSendZaloReceipts`):
1. **Kiểm tra phiên**: Gọi `getZaloStatus()`. Nếu chưa đăng nhập hoặc session hết hạn, tự động mở modal QR để đăng nhập lại trước.
2. **Mở Popup Chọn Phòng (`#zalo-select-rooms-modal`)**:
   - Hiển thị danh sách 12 phòng dạng card trực quan.
   - **Tự động Khóa (Disable checkbox) các phòng không đủ điều kiện** kèm badge lý do:
     - `Phòng trống, chưa có chủ phòng`.
     - `Chủ phòng chưa có SĐT Zalo`.
     - `Chưa nhập đủ chỉ số điện/nước tháng này`.
   - Các phòng đủ điều kiện được tick chọn mặc định. Có nút "Chọn Tất Cả" và "Bỏ Chọn Tất Cả".
3. **Thực thi gửi tuần tự**:
   - Bấm "Xác Nhận Gửi" $\rightarrow$ Đóng popup chọn phòng, khóa nút gửi ngoài header và hiển thị `Đang gửi {current}/{total}...`.
   - **Gửi tuần tự từng phòng (`for...of`)**, tuyệt đối không gửi song song.
   - **Nội dung gửi cho mỗi phòng**:
     1. Gửi file ảnh phiếu thu: `Phong-XX.jpg`.
     2. Gửi file ảnh thanh toán VietQR động (chứa sẵn số tiền chính xác và cú pháp chuyển khoản: `[Tên chủ phòng] phong [XX] thang [MM/YYYY]`).
     3. Gửi tin nhắn text chi tiết tóm tắt số tiền và thông tin tài khoản ngân hàng.
   - **Cơ chế an toàn (Anti-Ban & Timeout)**:
     - Nghỉ ngẫu nhiên giữa các phòng từ **3.0s đến 4.5s** (`Math.random()`).
     - Nghỉ nhỏ giữa các file gửi trong cùng 1 phòng từ 200ms đến 1.000ms.
     - Timeout tối đa 15 giây cho mỗi phòng; nếu quá thời gian sẽ ghi nhận lỗi phòng đó và tự động chuyển sang phòng kế tiếp.
4. **Báo cáo tổng kết (`#zalo-summary-report-modal`)**:
   - Hiển thị bảng tổng kết: Tổng số phòng gửi, Số phòng thành công (xanh), Số phòng thất bại (đỏ) kèm lý do chi tiết.

#### C. Tùy chọn 3 thành phần gửi Zalo độc lập (Settings):
- Bổ sung khối cấu hình `.zalo-send-options-card` vào card bên trái của tab **Cài Đặt Chung**:
  - **Hình phiếu tiền** (`zaloSendReceiptImage`): Gửi ảnh phiếu thu chi tiết của từng phòng (`Phong-XX.jpg`).
  - **Mã QR thanh toán** (`zaloSendPaymentQr`): Tải và gửi ảnh mã VietQR thanh toán tự động.
  - **Tin nhắn Zalo** (`zaloSendMessageText`): Gửi tin nhắn văn bản tóm tắt hóa đơn và thông tin chuyển khoản.
- Người dùng có thể bật/tắt tự do bất kỳ thành phần nào bằng cách click trực tiếp vào dòng hoặc ô check tròn xanh lá.
- Các tùy chọn được lưu tự động vào `data/settings.json` khi bấm "Lưu Cài Đặt Giá" (`saveSettings`).
- Cơ chế an toàn: Nếu tắt cả 3 thành phần, hệ thống sẽ chặn gửi và hiện toast cảnh báo người dùng vào Settings bật lại ít nhất 1 thành phần.

#### D. Trình chỉnh sửa mẫu tin nhắn Zalo tùy biến & Live Preview:
- **Hiển thị có điều kiện**: Chỉ xuất hiện khi tùy chọn "Tin nhắn Zalo" được bật; tự động ẩn gọn gàng khi tắt.
- **Mẫu tin nhắn mặc định nguyên bản**: Nếu người dùng chưa từng tùy chỉnh, hệ thống sử dụng chính xác 100% mẫu tin nhắn hiện tại mà không làm thay đổi bất kỳ câu chữ nào:
  ```text
  📋 HÓA ĐƠN PHÒNG {phong} - THÁNG {thang}/{nam}

  💰 TỔNG: {tongCong} đ

  💳 THÔNG TIN CHUYỂN KHOẢN
  - Ngân hàng: {bankName}
  - Số tài khoản: {bankAccount}
  - Chủ tài khoản: {bankOwner}
  - ND CK: {noiDungCK}

  (Chi tiết xem ảnh phiếu thu đính kèm)
  ```
- **Thanh chèn biến tự động (Toolbar)**: Phân loại theo nhóm màu sắc trực quan:
  - *Cơ bản*: `{phong}`, `{thang}`, `{nam}`, `{tongCong}`, `{tenChuPhong}`, `{sdt}`, `{sdtZalo}`
  - *Ngân hàng*: `{bankName}`, `{bankAccount}`, `{bankOwner}`, `{noiDungCK}`
  - *Phí & Dịch vụ*: `{tienPhong}`, `{tienRac}`, `{tienInternet}`
  - *Điện*: `{dienCu}`, `{dienMoi}`, `{dienKwh}`, `{giaDien}`, `{tienDien}`, `{haoTaiKwh}`, `{tienHaoTai}`
  - *Nước*: `{nuocCu}`, `{nuocMoi}`, `{nuocKhoi}`, `{giaNuoc}`, `{tienNuoc}`
  - Khi click vào bất kỳ chip biến nào, biến `{tenBien}` sẽ được chèn ngay vào vị trí con trỏ trong ô soạn thảo và tự động focus lại.
- **Kiến trúc làm nổi bật biến 2 lớp (Backdrop Highlighter)**:
  - Lớp nền `.zalo-editor-backdrop` nằm bên dưới textarea trong suốt `.zalo-editor-textarea`.
  - Tự động bọc biến hợp lệ vào thẻ tag pill xanh lá `.editor-var-chip` và biến sai vào thẻ cảnh báo đỏ `.editor-var-invalid`.
  - Đồng bộ cuộn (`syncZaloEditorScroll`).
  - Giữ nguyên 100% khả năng gõ bộ gõ tiếng Việt (Unikey/EVKey), selection và undo/redo của thẻ `<textarea>` gốc.
- **Kiểm tra và cảnh báo biến sai cú pháp**: Tự động regex quét toàn bộ chuỗi `{...}`, nếu có biến không thuộc danh sách `ZALO_VALID_VARIABLES` sẽ lập tức hiển thị banner màu hổ phách `#zalo-var-warning-banner` cảnh báo chi tiết tên biến sai.
- **Xem trước trực tiếp (Live Preview)**:
  - Khung mô phỏng bong bóng tin nhắn Zalo trên điện thoại thời gian thực (`#zalo-preview-bubble`).
  - Hỗ trợ dropdown chọn phòng xem trước (`1A` đến `6B`) và chọn tháng chu kỳ để lấy đúng dữ liệu tính toán thực tế của phòng đó.
- **Nút "Khôi phục mẫu gốc"**: Bấm để đặt lại nội dung mẫu tin nhắn về mẫu mặc định ban đầu bất kỳ lúc nào.

---

### 2.8. Quản Lý Phòng & Cư Dân (Phần 3)
1. **Lưới 12 thẻ phòng (Occupancy Grid)**:
   - Thể hiện trực quan phòng nào đang có người ở (badge xanh `.status-pill.active`) và phòng nào đang trống (badge xám `.status-pill.empty`).
   - Hiển thị tên người đại diện (Chủ phòng) và số lượng thành viên đang cùng ở.
2. **Phân bổ phòng (Room Detail Modal — `#room-detail-modal`)**:
   - Cho phép chọn 1 người làm "Chủ phòng" (người đứng tên hợp đồng và nhận hóa đơn).
   - Danh sách checklist để tick chọn các thành viên khác đang ở cùng phòng.
   - Tự động cập nhật `chuPhong` và `thanhVien` trong `rooms.json`.
3. **Hồ sơ Người thuê (Resident CRUD)**:
   - Thêm/Sửa cư dân qua `#resident-form-modal` gồm 2 tab:
     - **Tab 1: Thông tin cá nhân**: Họ tên, CCCD/CMND (kiểm tra 9 hoặc 12 số), Số điện thoại gọi, Số điện thoại Zalo (có nút sao chép nhanh từ SĐT gọi), Ngày sinh, Giới tính, Email, Ngày vào ở (có nút "Hôm nay"), Phòng đang ở.
     - **Tab 2: Ảnh CCCD 2 mặt**: Upload ảnh mặt trước và mặt sau CCCD bằng kéo thả hoặc chọn file.
   - Xóa cư dân: Hỗ trợ xóa đơn lẻ hoặc tick chọn nhiều người để xóa hàng loạt kèm modal xác nhận an toàn. Tự động xóa thư mục ảnh CCCD liên quan.
4. **Quản lý Ảnh CCCD (Lightbox)**:
   - Lưu trữ tự động theo cấu trúc thư mục chuẩn:
     `<baseFolder>/data/Thông tin người ở/[Số phòng]/[Tên người]_[4 số cuối CCCD]/`
   - Bấm vào thumbnail ảnh trên bảng để mở Modal Lightbox phóng to xem chi tiết, có nút chuyển qua lại giữa mặt trước và mặt sau.

---

### 2.9. Tự Động Cập Nhật (Auto Updater)
- Tích hợp `electron-updater` kết nối với GitHub Releases repo `myheo0229/Project-tools-phongtro`.
- Khi khởi động, app tự kiểm tra bản mới. Ngoài ra có nút "Kiểm Tra Cập Nhật" thủ công trong Cài Đặt Chung.
- Khi có bản mới: Hiện Pop-up `#update-modal` với thông tin phiên bản mới và 2 nút: "Cập nhật ngay" hoặc "Để sau".
- Khi bấm "Cập nhật ngay":
  - Tải ngầm bản cài đặt kèm thanh tiến trình $\%$ và tốc độ MB/s thời gian thực.
  - Khi đạt 100%: Phát Windows Native Notification góc màn hình.
  - Đếm ngược 3.5 giây trên giao diện rồi tự động gọi `quitAndInstall(true, true)` để nâng cấp ngầm (Silent Install) và tự khởi động lại vào phiên bản mới.


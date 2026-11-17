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
| 26 | Thông báo Toast góc màn hình | Toàn hệ thống | `src/input/renderer.js` (`showToast`) | ✅ Hoàn thành |
| 27 | Khóa Dữ Liệu Tháng Đã Xuất & 2 Popup Bảo Vệ | Phần 1: Bảng nhập | `electron/main.js`, `src/input/renderer.js` | ✅ Hoàn thành |
| 28 | Định Dạng Phân Cách Hàng Nghìn Realtime & Chuẩn Hóa Tỷ Lệ Hao Tải | Phần 2: Cài Đặt Chung | `src/input/index.html`, `renderer.js` | ✅ Hoàn thành |
| 29 | Xuất Dữ Liệu Bảng Tháng Ra File Excel (.xlsx) | Phần 1: Bảng nhập | `electron/month-excel-service.js`, `src/input/month-excel.js` | ✅ Hoàn thành |

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

### 2.2. Xử Lý Công Tơ Điện Quay Vòng (Rollover Modal) & Cơ Chế Xác Nhận 1 Lần
- **Kích hoạt khi**: Người dùng nhập xong ô `Điện Mới` và rời khỏi ô (`blur`), nếu `dienMoi < dienCu`, tính năng được bật (`enableRolloverPopup === true`) và phòng chưa từng được xác nhận (`!room.confirmedRollover`).
- **Giao diện Modal 1.5x (`#rollover-modal`)**:
  - Tiêu đề: *Xác Nhận Công Tơ Điện Quay Vòng*.
  - Nội dung: Hiển thị rõ số phòng, số cũ, số mới và công thức áp dụng: `(10.000 + Mới) - Cũ = [Số điện tiêu thụ] kWh`.
- **Hành vi lựa chọn**:
  - Bấm **"Đồng ý (Áp dụng công thức)"**:
    * Gán `room.confirmedRollover = true`.
    * Lưu ngay lập tức vào `settings.json` (`confirmedAlerts[monthKey][room] = { rollover: true, dienMoi }`) và tự động lưu file lịch sử tháng (`history/YYYY-MM.json`).
    * Hiển thị biểu tượng badge tròn `(!)` màu cam (`.badge-rollover`) kế bên ô Điện Mới.
    * Sau khi xác nhận quay vòng, nếu số điện tiêu thụ sau công thức tiếp tục chênh lệch $\ge 40\%$, hệ thống sẽ tự động hiển thị tiếp Anomaly Modal.
  - Bấm **"Hủy bỏ (Nhập lại)"**: Reset giá trị ô `Điện Mới` về rỗng, xóa cờ khỏi `settings.json` và history, focus lại vào ô để người dùng gõ lại số đúng.

---

### 2.3. Cảnh Báo Tiêu Thụ Điện Bất Thường $\ge 40\%$ (Anomaly Modal) & Biểu Tượng Cảnh Báo (!)
- **Kích hoạt khi**: Người dùng nhập xong ô `Điện Mới` (`blur`), số điện tiêu thụ tháng này chênh lệch tăng hoặc giảm $\ge 40\%$ so với số điện tiêu thụ của chính phòng đó trong tháng liền trước, cờ `enableAnomalyPopup === true`, và phòng chưa từng được xác nhận (`!room.confirmedAnomaly`).
- **Giao diện Modal 1.5x (`#anomaly-modal`)**:
  - Tiêu đề: *Cảnh Báo Tiêu Thụ Điện Bất Thường*.
  - Thể hiện: Số điện tiêu thụ tháng trước ($A$ kWh), tháng này ($B$ kWh), tỷ lệ chênh lệch $%$ kèm màu sắc cảnh báo (màu cam/đỏ).
- **Hành vi lựa chọn**:
  - Bấm **"Xác nhận số liệu đúng"**:
    * Gán `room.confirmedAnomaly = true`.
    * Lưu ngay lập tức vào `settings.json` (`confirmedAlerts[monthKey][room] = { anomaly: true, dienMoi }`) và tự động lưu file lịch sử tháng.
    * Hiển thị biểu tượng badge tròn `(!)` màu hổ phách (`.badge-anomaly`) hoặc màu đỏ (`.badge-both` nếu phòng đồng thời có cả 2 cảnh báo).
  - Bấm **"Kiểm tra lại / Hủy"**: Reset ô `Điện Mới` về rỗng, xóa cờ cảnh báo khỏi `settings.json` và history, focus lại vào ô.
- **Tính năng Duy Trì Bền Vững & Xem Lại Bất Cứ Lúc Nào**:
  - **Lưu trữ đa tầng**: Trạng thái xác nhận được lưu đồng thời trong `settings.json` (`confirmedAlerts`) và file history tháng (`history/YYYY-MM.json`). Khi chuyển tháng qua lại hoặc đóng mở lại ứng dụng, trạng thái xác nhận và biểu tượng `(!)` được phục hồi nguyên vẹn mà không hỏi lại.
  - **Tự động lưu khi chuyển tháng / chuyển tab**: Khi người dùng đổi tháng trên dropdown hoặc bấm chuyển sang Phần 2/3, dữ liệu tháng hiện tại và các xác nhận được tự động lưu ngay lập tức (`autoSaveCurrentMonthData`).
  - **Click vào biểu tượng `(!)` để xem lại hoặc đổi ý**: Người dùng có thể click vào icon `(!)` bất cứ lúc nào để mở lại Modal xem chi tiết số liệu hoặc bấm Hủy để nhập lại.
  - **Tự động gỡ bỏ thông minh**: Khi người dùng tự tay sửa số mới thành số bình thường (không còn nhỏ hơn số cũ và chênh lệch $< 40\%$), hệ thống tự động gỡ trạng thái và ẩn biểu tượng `(!)`.

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
     2. Gửi file ảnh thanh toán VietQR động (chứa sẵn số tiền chính xác và cú pháp chuyển khoản: `[Tên chủ phòng] phong [XX] thang [MM/YYYY]`), tự động biên dịch dữ liệu vector SVG từ máy chủ VietQR thành ảnh bitmap PNG chuẩn 150 DPI qua sharp, bảo đảm Zalo client hiển thị ảnh sắc nét ngay lập tức, loại bỏ hoàn toàn lỗi màn hình đen tải ảnh.
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

---

## 7. Hệ Thống Sao Lưu Dữ Liệu (Local ZIP + Google Drive API Upload-Only)

### 7.1. Mục tiêu & Kiến trúc
- Cho phép người dùng chủ động sao lưu toàn bộ dữ liệu trong `BaseFolder` theo luồng một chiều an toàn:
  `Dữ liệu BaseFolder → Tạo Snapshot & Nén ZIP Local → Lưu tại BaseFolder/BackupData/ → Kiểm tra toàn vẹn CRC32 → Google Drive API Upload → Xác minh hoàn tất`.
- Không sử dụng Google Drive for Desktop, không dùng ổ `G:`, không đồng bộ 2 chiều, chỉ chạy khi người dùng nhấn nút **Backup Data**.

### 7.2. Cơ chế nén ZIP & Chống lồng BackupData
- Định dạng tên file chuẩn: `Backup_YYYYMMDD_HHmmss.zip` (nếu có 2 lần backup trong cùng 1 giây sẽ tự thêm hậu tố `_01`, `_02`... tuyệt đối không ghi đè file cũ).
- Loại trừ chính xác thư mục `BaseFolder/BackupData/` (so sánh đường dẫn chuẩn hóa `path.resolve`) để ngăn chặn hiện tượng nén chồng các bản ZIP cũ vào ZIP mới.
- Giữ nguyên cấu trúc tương đối ở gốc file ZIP (`data/`, `PhieuThu/`, `settings.json`...), hỗ trợ cờ UTF-8 (`0x0800`) bảo toàn tên thư mục/file tiếng Việt có dấu.
- Kiểm tra tính toàn vẹn của file ZIP (tồn tại, `size > 0`, đọc cấu trúc Central Directory và kiểm tra mã băm `CRC32` của từng entry) trước khi upload lên Google Drive.

### 7.3. Google OAuth 2.0 & Kiểm tra sức khỏe Tài khoản / Drive (Health Check)
- Mỗi Windows user đăng nhập tài khoản Google riêng qua OAuth 2.0 Desktop Loopback (`127.0.0.1:<port>`) + PKCE với Non-Sensitive Scope (`drive.file` + `userinfo.email`), giúp mọi khách hàng đăng nhập Gmail trực tiếp mà không cần thêm vào danh sách Test Users.
- Token được mã hóa bằng `safeStorage` (Windows DPAPI) tại `app.getPath('userData')/backup-tokens.enc`.
- Hàm `checkDriveHealth()` kiểm tra: kết nối mạng Internet, tình trạng token (phát hiện đổi mật khẩu/thu hồi quyền), dung lượng trống thực tế trên Google Drive (`storageQuota`), và tình trạng thư mục đích (phát hiện nếu thư mục bị xóa vào Thùng rác hoặc mất quyền truy cập).
- Hỗ trợ chọn thư mục đích bằng cách nhập tên thư mục muốn tạo mới trên Drive hoặc dán trực tiếp `Folder ID` / đường link thư mục Google Drive, tự động tạo/dùng lại thư mục con `BackupData/` bên trong.
- **Upload-Only tuyệt đối**: Chỉ gọi `about.get`, `files.get`, `files.list`, `files.create`. Tuyệt đối không xóa, không sửa, không ghi đè bất kỳ file nào trên Google Drive.


---

## 9. Tìm Kiếm Cư Dân Tức Thì Thông Minh Kiểu Google Search (Phần 3)

- **Vị trí**: Ô tìm kiếm `#resident-search-input` (`.search-box`) tại phân hệ **Phần 3: Quản Lý Phòng & Người Ở**.
- **Cơ chế xử lý (`getFilteredAndRankedResidents`, `tokenizeSearchQuery`, `highlightSearchText`)**:
  1. **Tách đa từ khóa (Multi-token AND matching)**: Tự động chuẩn hóa tiếng Việt không dấu (`NFC`), tách chuỗi nhập theo khoảng trắng thành các token độc lập. Một hồ sơ cư dân được tính là khớp khi thỏa mãn tất cả các token (cho phép gõ rời chữ hoặc kết hợp nhiều trường như `"nguyen anh 1a 090"`).
  2. **Chỉ mục tìm kiếm toàn diện**: Hỗ trợ tìm theo Họ và tên (cả có dấu, không dấu, chữ cái đầu viết tắt), SĐT Gọi, SĐT Zalo, Số CCCD, Phòng ở (`"1A"`, `"Phòng 1A"`, `"P1A"`, `"Chưa xếp"`), Vai trò (`"Chủ phòng"`, `"Thành viên"`), Ngày/Năm sinh, Giới tính, Ngày vào ở, Quê quán và Email.
  3. **Xếp hạng độ ưu tiên (Relevance Scoring)**: Chấm điểm ưu tiên đưa kết quả khớp chính xác Tên gọi, Số phòng hoặc đầu số SĐT/CCCD lên đầu danh sách.
  4. **Tô sáng từ khóa trực tiếp (`<mark class="search-hl">`) trên bảng danh sách người thuê**: Tự động bôi vàng đúng đoạn ký tự/chữ số trùng khớp (không phân biệt chữ hoa/thường và có dấu/không dấu) chỉ trên bảng danh sách tất cả người thuê bên dưới (giữ nguyên hiển thị bình thường của 12 thẻ phòng phía trên).
  5. **Tiện ích thao tác nhanh**: Hiển thị bộ đếm số kết quả (`#resident-search-count`), nút xóa nhanh `✕` (`#resident-search-clear`), phím `Esc` để xóa trắng từ khóa và phím tắt `Ctrl + F` để nhảy con trỏ vào ô tìm kiếm.

---

## 10. Xuất Excel Danh Sách Người Thuê (`.xlsx`) (Phần 3)

- **Vị trí**: Nút **Xuất Excel** (`#btn-export-residents-excel`) nằm ngay bên trái ô tìm kiếm nhanh trong khu vực **Danh Sách Tất Cả Người Thuê** (`#section-residents`).
- **Module xử lý**: `electron/excel-service.js` (`exportResidentsToExcel`, `buildResidentsExcelBuffer`, `generateUniqueExcelFileName`, `formatExcelDateStr`).
- **Đặc tả dữ liệu & Định dạng**:
  1. **9 cột bắt buộc theo đúng thứ tự**: `STT | Họ Và Tên | SĐT Gọi | SĐT Zalo | Số CCCD | Ngày Sinh | Giới Tính | Phòng Ở | Ngày Vào Ở`.
  2. **Kiểu dữ liệu Text (`@` / `inlineStr`)**: Các cột `SĐT Gọi`, `SĐT Zalo`, `Số CCCD` được lưu dưới dạng Text (`t="inlineStr"` kết hợp `numFmtId="49"`) để bảo toàn 100% chữ số `0` ở đầu và không bao giờ bị Excel chuyển thành số khoa học.
  3. **Phạm vi dữ liệu độc lập bộ lọc**: Đọc trực tiếp toàn bộ danh sách người thuê hiện có từ `<BaseFolder>/data/residents.json` (kèm đối chiếu phòng từ `rooms.json`), hoàn toàn không phụ thuộc vào từ khóa đang nhập trong ô tìm kiếm nhanh.
  4. **Định dạng bảng chuẩn**: 1 sheet duy nhất (`Danh Sach Nguoi Thue`), dòng tiêu đề in đậm nền xanh nhạt (`#E2EFDA`), có kẻ viền mảnh toàn bảng, căn giữa `STT`, `Giới Tính`, `Phòng Ở`, căn trái các cột còn lại và tự động co giãn độ rộng cột (`<cols>`).
  5. **Vị trí lưu & Chống ghi đè**: Lưu trực tiếp tại `<BaseFolder>/DanhSachNguoiThue_YYYYMMDD_HHmmss.xlsx` theo giờ máy tính local (không tạo thư mục con, không gọi Backup hay Google Drive). Nếu xuất nhiều lần trong cùng một giây sẽ tự động thêm hậu tố `_01`, `_02`... để không ghi đè file cũ. Nếu danh sách trống sẽ thông báo chưa có dữ liệu và không tạo file rỗng.

---

## 11. Khóa Dữ Liệu Tháng Đã Xuất & Luồng Chỉnh Sửa Lại An Toàn (Phần 1)

- **Mục tiêu**: Ngăn chặn người dùng vô tình bấm sửa chỉ số hoặc thay đổi cài đặt đơn giá làm sai lệch số tiền và phiếu thu của các tháng đã xuất trước đó.
- **Vị trí**: Tiêu đề Bảng nhập chỉ số (Phần 1: Nhập Dữ Liệu), gồm huy hiệu trạng thái `#month-lock-status-badge`, nút `#btn-toggle-edit-month` (kế bên trái nút `#btn-send-zalo-month`), và 2 popup chữ to (`#unlock-month-modal`, `#unsaved-month-edit-modal`).
- **Cơ chế hoạt động**:
  1. **Tự động nhận diện & Khóa (Chỉ khóa tháng đã có dữ liệu và đã xuất)**:
     - Khi chọn một tháng trong dropdown: Hệ thống kiểm tra trước tiên xem tháng đó đã có nhập chỉ số mới nào hay chưa (`hasMonthEnteredNewData`). Nếu tháng mới chưa nhập gì thì **tuyệt đối không khóa** (đồng thời tự dọn cờ khóa cũ nếu có và đánh dấu `legacyScanned`).
     - Với các tháng đã nhập dữ liệu: Kiểm tra trạng thái trong `data/month-locks.json` (hoặc quét một lần `PhieuThu/Thang_MM_YYYY` kết hợp đối chiếu dữ liệu lịch sử đối với các tháng cũ).
     - Nếu đã xuất dữ liệu: Tự động khóa 4 ô chỉ số (`dienCu`, `dienMoi`, `nuocCu`, `nuocMoi`) sang `readonly` (`.month-locked-input`, giữ nguyên màu vàng `#fffbe6` của ô nhập mới), khóa nút `Lưu & Xuất`, hiện badge `🔒 Đã khóa dữ liệu` và hiện nút `✏️ Chỉnh Sửa`.
  2. **Bảo toàn đơn giá lịch sử (`settingsSnapshot`)**:
     - Bộ đơn giá (`giaPhong`, `giaDien`, `giaNuoc`, `tienRac`, `tienInternet`, `tyLeHaoTai`, `dienThoai`) tại thời điểm xuất được lưu snapshot vào `month-locks.json`.
     - Mọi tính toán hiển thị trên bảng, tổng tiền footer, xem lại cảnh báo và gửi Zalo cho tháng đã khóa đều sử dụng `getActiveMonthSettings()` (lấy từ snapshot). Việc đổi đơn giá ở Phần 2 không làm đổi số tiền các tháng cũ.
  3. **Mở khóa chỉnh sửa an toàn (Popup 1)**:
     - Bấm nút `✏️ Chỉnh Sửa`: Hiện Popup 1 (`#unlock-month-modal`) chữ to (`21px / 16.5px / 16px`) nhắc nhở người dùng: nếu muốn tính lại tháng này theo đơn giá/tiền phòng mới thì hãy đóng popup, qua Cài Đặt Chung chỉnh đơn giá trước rồi quay lại mở khóa sau.
     - Bấm `🔓 Mở Khóa Chỉnh Sửa`: Bảng mở khóa cho nhập, nút chuyển thành `✕ Hủy thay đổi & Giữ nguyên`, nút `Lưu & Xuất` mở lại. Lưu bản sao lưu tạm `lockedMonthBackupState` trong bộ nhớ.
  4. **Hủy thay đổi tức thì**:
     - Bấm `✕ Hủy thay đổi & Giữ nguyên`: Khôi phục nguyên vẹn 100% số liệu ban đầu từ `lockedMonthBackupState` và khóa lại bảng ngay lập tức.
  5. **Bảo vệ chống mất dữ liệu khi chưa lưu (Popup 2)**:
     - Khi đang mở chỉnh sửa mà người dùng chuyển sang Tab khác (`switchTab`), đổi sang Tháng khác (`onMonthYearChange`), hoặc bấm `Gửi Zalo`: Bị chặn lại lập tức và hiện Popup 2 (`#unsaved-month-edit-modal`) chữ to bắt buộc chọn 1 trong 3 hành động:
       + `Ở Lại Chỉnh Sửa Tiếp`: Đóng popup, tiếp tục chỉnh sửa.
       + `✕ Hủy Thay Đổi & Giữ Nguyên`: Khôi phục số cũ, khóa lại tháng rồi chuyển tiếp sang tab/tháng đã chọn.
       + `💾 Lưu & Xuất Ngay`: Lưu số mới, xuất lại 12 ảnh JPG + 1 PDF, khóa lại bảng an toàn rồi chuyển tiếp.

### 2.14. Định Dạng Tiền Phân Cách Hàng Nghìn Realtime & Chuẩn Hóa Tỷ Lệ Hao Tải

- **Vị trí**: Phần 2: Cài Đặt Chung (`THIẾT LẬP GIÁ & THÔNG TIN CHUNG`).
- **Nghiệp vụ chi tiết**:
  1. **Định dạng tiền tệ theo thời gian thực (Realtime Thousand Separator)**:
     - Áp dụng cho 5 ô nhập tiền và đơn giá: Tiền Phòng mặc định (`#set-giaPhong`), Đơn giá Điện (`#set-giaDien`), Đơn giá Nước (`#set-giaNuoc`), Tiền Rác (`#set-rac`), Tiền Internet (`#set-internet`).
     - Khi người dùng gõ từng ký tự, hệ thống tự động chèn dấu chấm phân cách hàng nghìn theo chuẩn Việt Nam (ví dụ: `200` -> `2.000` -> `20.000` -> `2.200.000`).
     - Tự động ghi nhớ và tính toán lại vị trí con trỏ chuột (`selectionStart`) dựa trên số lượng chữ số nằm trước con trỏ, đảm bảo người dùng có thể đặt chuột vào giữa chuỗi số để thêm/xóa chữ số mà con trỏ không bị nhảy giật về cuối chuỗi.
  2. **Hiển thị tỷ lệ điện hao tải dạng số nguyên**:
     - Ô `#set-tileHaoTai` loại bỏ hoàn toàn phần thập phân `.0` phía sau (ví dụ: hiển thị `7` thay vì `7.0`).
  3. **Tự động nhận diện và chuẩn hóa tỷ lệ hao tải thông minh**:
     - Khi người dùng nhập `7`, `0.7`, `0,7`, `0.07`, hoặc `0,07` -> Hệ thống đều tự động hiểu là `7%` và chuẩn hóa hiển thị thành số nguyên `7` ngay khi người dùng nhấn Enter hoặc click chuột ra ngoài (blur).
     - Khi lưu cài đặt, giá trị được quy đổi chính xác về hệ số thập phân lưu trữ (`tyLeHaoTai = 7 / 100 = 0.07`) và tự động định dạng lại giao diện chuẩn sau khi lưu.

---

## 13. Cấu Hình Số Chữ Số Đồng Hồ Điện & Nước Cho Từng Phòng

- **Vị trí**: Phần 2: Cài Đặt Chung, nằm ngay dưới trường "Số điện thoại hiển thị trên phiếu thu" và trên khối "SAO LƯU DỮ LIỆU (BACKUP DATA)".
- **Đặc điểm & Nghiệp vụ**:
  1. **Bố cục 2 dãy phòng đối xứng**:
     - Cột trái: Dãy phòng `1A` đến `6A`.
     - Cột phải: Dãy phòng `1B` đến `6B`.
     - Đường kẻ dọc phân cách sắc nét ở giữa 2 dãy.
     - Mỗi hàng phòng gồm nhãn tên phòng dạng badge và 2 ô số: Điện và Nước.
  2. **Giá trị mặc định**: Điện mặc định là `5` chữ số (tối đa $99.999$, quay vòng ở $100.000$), Nước mặc định là `4` chữ số (tối đa $9.999$, quay vòng ở $10.000$).
  3. **Ràng buộc nhập liệu (3 - 7 chữ số)**:
     - Chặn ký tự phi số, chỉ cho nhập số nguyên duy nhất từ `3` đến `7`.
     - Nếu gõ số ngoài khoảng sẽ tự động chặn về giá trị hợp lệ; nếu xóa trống khi blur sẽ tự động khôi phục giá trị mặc định (`Điện: 5`, `Nước: 4`).
  4. **Nút tiện ích "Áp dụng tất cả"**:
     - Mở Modal `#apply-all-meter-digits-modal` cho phép nhập 1 lần số chữ số Điện và Nước để đồng loạt áp dụng cho toàn bộ 12 phòng chỉ bằng 1 cú click.
  5. **Tác động sang tính toán & giao diện nhập**:
     - Hàm toán học `calcRoom` (`src/shared/calc.js`) và popup cảnh báo quay vòng xác định mốc quay vòng theo công thức $10^{\text{meterDigits}}$ của từng phòng.
     - Ô nhập chỉ số ở Phần 1 tự động giới hạn độ dài ký tự tối đa (`slice(0, maxDigits)`) theo đúng số chữ số đã cấu hình cho phòng đó.
  6. **Nhật Ký Hoạt Động**:
     - Khi có thay đổi chữ số đồng hồ của bất kỳ phòng nào, hệ thống tự động ghi log nhóm `PRICING` lưu chi tiết phòng nào thay đổi từ bao nhiêu số sang bao nhiêu số.

---

## 12. Hệ Thống Nhật Ký Hoạt Động (Activity / Audit Log)

- **Vị trí**: Nút **Nhật Ký** (`#btn-open-activity-log`) trên thanh Header chính mở Modal `#activity-log-modal`.
- **Module xử lý**: Tách biệt hoàn toàn tại `electron/activity-logger.js` (Main Process) và `src/input/activity-log.js` (Renderer Process).
- **5 Nhóm hành động ghi nhận**:
  1. `PRICING` (Đơn giá & Cài đặt): Thay đổi đơn giá điện/nước/phòng/rác/internet/hao tải, cài đặt tài khoản ngân hàng (chỉ lưu 4 số cuối STK), cấu hình Zalo, đổi thư mục `BaseFolder`.
  2. `MONTH_DATA` (Dữ liệu tháng & Khóa sổ): Lưu & Xuất phiếu thu lần đầu (`EXPORT_MONTH`), Mở khóa chỉnh sửa tháng đã khóa (`UNLOCK_MONTH`), Lưu & Xuất lại sau khi chỉnh sửa kèm đối chiếu từng phòng thay đổi (`REEXPORT_EDITED_MONTH`), Hủy chỉnh sửa & Khôi phục số gốc (`CANCEL_MONTH_EDIT`), Xác nhận công tơ quay vòng (`CONFIRM_ROLLOVER`), Xác nhận biến động điện $\ge 40\%$ (`CONFIRM_ANOMALY`).
  3. `RESIDENTS` (Người thuê & Phân bổ phòng): Thêm mới (`ADD_RESIDENT`), Cập nhật hồ sơ (`UPDATE_RESIDENT`), Chuyển phòng (`TRANSFER_RESIDENT`), Xóa hồ sơ (`DELETE_RESIDENT`), Phân bổ chủ phòng & thành viên (`ASSIGN_ROOM_MEMBERS`), Xuất Excel danh sách cư dân (`EXPORT_RESIDENTS_EXCEL`).
  4. `ZALO` (Gửi hóa đơn Zalo): Ghi nhận từng đợt gửi phiếu thu Zalo (`SEND_ZALO_BATCH`) kèm kết quả từng phòng, số tiền, SĐT đã che và nguyên nhân lỗi chi tiết.
  5. `BACKUP` (Sao lưu & Phục hồi): Tạo bản sao lưu ZIP & tải lên Google Drive (`CREATE_BACKUP`), Phục hồi dữ liệu (`RESTORE_BACKUP`).
- **4 Cơ chế an toàn cốt lõi**:
  1. **Bảo vệ PII**: Không lưu full CCCD, SĐT hay STK ngân hàng; với các trường nhạy cảm của người thuê chỉ lưu `{ field, label, changed: true }`.
  2. **Single-Writer Queue & Atomic Write**: Xếp hàng tuần tự tại Main Process, ghi qua `.tmp`, tự khôi phục từ `.tmp` hoặc đổi tên file lỗi thành `activity-logs.corrupted_<timestamp>.json` (không bao giờ tự xóa file cũ), giới hạn tối đa 2.000 dòng.
  3. **Bảo toàn khi đổi BaseFolder**: Tự động di chuyển và hợp nhất log từ thư mục cũ sang thư mục mới trong `settings:save`.
  4. **Bảo toàn khi Phục hồi Backup**: Hợp nhất log hiện tại và log trong bản sao lưu để không mất lịch sử gần nhất.

---

## 13. Xuất Dữ Liệu Bảng Tháng Ra File Excel (.xlsx)

- **Vị trí**: Nút **"Xuất dữ liệu"** (`#btn-export-month-excel`) trên thanh tiêu đề Bảng chính (Phần 1), nằm ngay **bên trái nút "Gửi Zalo"**.
- **Style giao diện**: Thừa hưởng quy chuẩn thiết kế của nút Xuất Excel Phần 3 (nền xanh lá nhạt `#f0fdf4`, viền `#86efac`, chữ xanh đậm `#15803d`, icon bảng tính SVG).
- **Module xử lý**:
  - Backend: `electron/month-excel-service.js` (Tạo OpenXML thuần qua `zlib`, không phụ thuộc thư viện bên ngoài).
  - Frontend: `src/input/month-excel.js` (Gọi IPC `month:export-excel`, xử lý UI và ghi Nhật Ký Hoạt Động).
- **Quy tắc đặt tên file an toàn**:
  - Định dạng: `BangDuLieu_MM_YYYY - Output Time YYYY_MM_DD_HH_MM_SS.xlsx` (Ví dụ: `BangDuLieu_07_2026 - Output Time 2026_11_08_23_36_15.xlsx`).
  - Tên file không chứa ký tự cấm của hệ điều hành Windows (`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`) tránh tuyệt đối lỗi `ENOENT`.
  - Nếu đã có file cùng tên trong cùng 1 giây, tự động thêm hậu tố `_01`, `_02`... để tuyệt đối không ghi đè dữ liệu cũ.
  - Cơ chế ghi file an toàn nguyên tử (Atomic write qua `.tmp` rồi rename).
- **Cấu trúc bảng tính Excel**:
  - Gồm đúng **17 cột** tương ứng giao diện + cột ghi chú bên phải ngoài cùng: STT, Số Phòng, Điện Cũ, Điện Mới, Số Điện TT, Nước Cũ, Nước Mới, Số Nước TT, Tiền Điện, Tiền Nước, Tiền Phòng, Rác, Internet, Điện Hao Tải, Tiền Hao Tải, Tổng Cộng, **Ghi Chú** (cột `Q`).
  - Cột `Ghi Chú` định dạng bình thường đồng bộ với các cột khác (`Calibri 11`, nền trắng, viền mỏng, căn trái, bật `wrapText="1"`, tự giãn chiều cao dòng theo nội dung), không màu mè, không emoji; chỉ ghi nội dung chi tiết cho các phòng có thay đổi đồng hồ đã chốt đủ Ô 4 (`status === 'completed'`).
  - **Dòng TỔNG CỘNG (Footer Row)**: Nằm ở hàng 14 (dưới 12 phòng), tích hợp sẵn công thức tính tổng chuẩn Excel `=SUM(...)` và giá trị tiền tính toán sẵn cho từng cột tiêu thụ và chi phí, dòng in đậm có viền đôi nổi bật (ô `Q` để trống khớp viền đáy).
  - Định dạng số: Định dạng phân tách hàng nghìn `#,##0` cho toàn bộ số tiền và chỉ số, `0.0` cho hao tải.
- **Tương tác sau khi xuất**:
  - Hiển thị Toast thông báo thành công.
  - Mở Modal kết quả `#excel-export-result-modal`: Kích thước mở rộng (`max-width: 680px`), kiểu chữ to (`21px` tiêu đề, `15px` phụ đề, `16.5px` trạng thái & số lượng, `15px` tên file, `14px` đường dẫn, `15.5px` nút thao tác, icon badge `52x52px`) hiển thị chi tiết tên file, đường dẫn, nút **"📂 Mở vị trí lưu file"**, nút **"📊 Mở file"** (mở trực tiếp bằng Excel/WPS/Calc) và nút **"Đóng"**. Hỗ trợ đồng bộ cho cả Phần 1 và Phần 3.
  - Tự động ghi 1 bản ghi vào hệ thống Nhật Ký Hoạt Động (`category: 'MONTH_DATA'`, `action: 'EXPORT_MONTH_EXCEL'`).

---

## 14. Modal & Backend Ghi Nhận Thay Đổi Đồng Hồ Điện / Nước

- **Vị trí kích hoạt**: Nút **"Thay đổi đồng hồ"** (`#btn-open-meter-change-modal`) trên thanh tiêu đề Bảng chính (Phần 1), hoặc bấm trực tiếp vào thẻ trạng thái ngay trên ô nhập liệu của phòng đang thay đồng hồ.
- **Kiến trúc lưu trữ tách biệt (`<baseFolder>/data/meter-changes.json`)**:
  - Lưu độc lập theo `months[monthKey][phong] = { elec, water }` thông qua các IPC `meter-changes:load`, `meter-changes:save-room`, `meter-changes:save-month` (ghi atomic `.tmp`), giữ nguyên 100% cấu trúc mảng JSON 12 phòng của `history/YYYY-MM.json`.
  - Hỗ trợ đọc qua [calc.js](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/calc.js) bằng tham số tùy chọn `dienKwhOverride` / `nuocKhoiOverride` để toàn bộ bảng, tổng doanh thu và kiểm tra bất thường tính đúng theo tổng tiêu thụ thực tế qua $n$ lần thay.
- **3 Cấp độ trạng thái & Luồng nhập tuần tự số nguyên**:
  1. **`⏳ Đang theo dõi`** *(nền cam)*: Chưa nhập Ô 2 hoặc chưa đủ đến Ô 3.
  2. **`📝 Hãy nhập ô 4`** *(nền xanh lá nhạt `#dcfce7`)*: Đã nhập đủ & hợp lệ tới Ô 3, chờ chốt số cuối tháng ở Ô 4.
  3. **`✅ Đã đủ`** *(nền xanh lá đậm `#16a34a`)*: Đã nhập đủ & hợp lệ Ô 2, Ô 3 và Ô 4.
  - Chỉ cho nhập **số nguyên không âm (`0–9`)**, khóa tuần tự Ô 1 (nếu mở) $\rightarrow$ Ô 2 $\rightarrow$ Ô 3 $\rightarrow$ Ô 4. Ô 3 là ngoại lệ giữ mặc định `0` để không cần bấm vào gõ lại khi ĐH mới bắt đầu từ 0.
- **Các popup con xử lý nghiệp vụ thực tế**:
  - **Thiếu dữ liệu tháng trước (`#mc-missing-prev-modal`)**: Từ tháng `2026-08` trở đi nếu tháng trước phòng chưa có số (phòng nghỉ hoặc quên nhập), hiển thị dấu **`!`** tím chàm (`#4f46e5`, khác hoàn toàn màu vàng) cho phép chọn **"Quay lại tháng trước"** để điền bổ sung hoặc **"Tự nhập đầu kỳ"** tại chỗ.
  - **Đồng hồ quay vòng (`#mc-rollover-modal`)**: Khi Ô 2 `<` Ô 1 (hoặc Ô 4 `<` Ô 3), bật popup xác nhận tính theo giới hạn chữ số $10^d$.
  - **Xác nhận số chữ số ĐH mới (`#mc-digits-modal`)**: Khi rời Ô 2 hợp lệ lần đầu, hỏi nhanh số chữ số ĐH mới (control `- / +` giống Cài Đặt Chung) và tự động đồng bộ sang `appSettings.meterDigits` + `settings.json` (Cài Đặt Chung) nếu có thay đổi.
  - **Xác nhận mở khóa chỉnh sửa (`#mc-unlock-edit-modal`)**: Khớp phong cách `#unlock-month-modal`, hỏi xác nhận trước khi mở khóa lại ghi nhận đã lưu ở Bước 2.
- **Mục 3 Lịch sử thay đổi trên Trang 1 & Quy trình Khóa / Chỉnh Sửa sau Lưu trên Trang 2**:
  - **Mục 3 (`#mc-history-section`, `#mc-history-list`)**: Đặt ngay dưới Mục 2 trong `.mc-step1-body`, liệt kê **từ tháng mới nhất đến cũ nhất** các phòng đã thay đồng hồ trong khung bo viền (`.mc-history-card`) kèm tóm tắt `(*)` và nhãn trạng thái. Toàn bộ Trang 1 dùng chung 1 thanh cuộn duy nhất của `.mc-step1-wrapper` (không tạo box cuộn lồng). Bấm vào thẻ bất kỳ sẽ mở thẳng Trang 2 trên cùng Modal (tháng đã xuất mở chỉ xem; tháng chưa khóa hoặc đang Chỉnh Sửa mở chế độ đã khóa kèm nút `✏️ Chỉnh Sửa`). Nếu cập nhật bản ghi của tháng khác tháng đang mở, hệ thống ghi thẳng vào `history/YYYY-MM.json` của đúng tháng đó mà không ghi đè `roomsData` hiện tại.
  - **Khóa tự động sau Lưu (`💾 Lưu ghi nhận`)**: Sau khi lưu (mọi cấp độ `tracking` / `need_box4` / `completed`), Trang 2 **không tự đóng Modal** mà chuyển ngay sang trạng thái **`🔒 Đã khóa dữ liệu`** (chỉ khóa bên trong Modal cho phòng đó, **không khóa bảng nhập liệu Phần 1** cho các phòng/cột khác). Bấm **`✏️ Chỉnh Sửa`** $\rightarrow$ xác nhận `#mc-unlock-edit-modal` để mở sửa và đổi nút thành **`✖️ Hủy thay đổi & Giữ nguyên`**. Nếu bấm Hủy thay đổi, hệ thống khôi phục toàn bộ snapshot (chỉ số, mục ĐH tạm gỡ ở `✕ Gỡ ĐH`, kể cả số chữ số ĐH trong cài đặt nếu vừa đổi) và khóa lại ngay tại Bước 2 mà không đóng Modal.
  - **Điều hướng `⬅ Quay lại` & Đóng (`✕`)**: Nút `Đóng` ở Trang 2 được thay thành `⬅ Quay lại` (và topbar đổi thành `⬅ Quay lại`, bỏ chữ "chọn phòng"); cả `⬅ Quay lại` và nút `✕` / `Escape` đều tự động hủy & khôi phục bản cũ nếu đang mở sửa nhưng chưa bấm `💾 Lưu ghi nhận`. Khi phòng đang Khóa mà ở Trang 1 người dùng tích chọn thêm loại ĐH còn lại chưa lưu, Trang 2 mở sẵn ở chế độ đang chỉnh sửa kèm backup để có thể hủy quay về bản 1 ĐH cũ bất cứ lúc nào.
- **Đồng bộ Bảng Phần 1, Khóa tháng & Quy tắc Gửi Zalo**:
  - Khóa `readonly` cặp ô của loại ĐH đang ghi nhận thay ở phòng đó trên bảng chính; cho phép gỡ bỏ (`✕ Gỡ` / `🗑️ Hủy thay đổi ĐH`) để hoàn tác về nhập tay bình thường; đồng bộ snapshot khi khóa/mở khóa chỉnh sửa tháng và ghi Nhật ký hoạt động (`MONTH_DATA`).
  - **Chặn Lưu & Xuất + Mở tháng mới**: Không cho xuất phiếu thu/mở tháng kế tiếp khi vẫn còn phòng ở mức `Đang theo dõi` hoặc `Hãy nhập ô 4`.
  - **Quy tắc nút Gửi Zalo (`#btn-send-zalo-month`)**: Chỉ kích hoạt ở các tháng **đã Lưu & Xuất (đang khóa)** và **không trong chế độ đang Chỉnh Sửa** (`isCurrentMonthLocked && !isCurrentMonthEditing`).
- **Phiếu Thu (JPG & PDF), Tin Nhắn Zalo & Cột Ghi Chú Excel khi có thay ĐH**:
  - **Phiếu thu (`src/receipt/*`, `format.js`, `export:receipts`)**: Phòng bình thường giữ nguyên 100% bố cục cũ. Phòng có thay đồng hồ đã chốt Ô 4 (`completed`) ẩn dòng `Số mới / Số cũ` của loại ĐH tương ứng và thay trực tiếp bằng các dòng `(*) Thay ĐH ...` (`white-space: nowrap`) dùng cỡ chữ mặc định `23px` (`var(--font-size-body)`). Thuật toán `fitReceiptMeterChangeNotes()` đo theo dòng dài nhất trên phiếu (cả Điện và Nước) để đảm bảo mọi lần thay đều nằm gọn đúng **1 dòng** và các dòng ngắn hơn đều dùng chung đúng `--mc-note-font-size` (tối thiểu `10px`), đồng thời ưu tiên thu `--row-gap` (`30px` $\rightarrow$ `14px`) trước khi giảm tiếp chữ nếu tràn dọc để luôn vừa khít 1 trang A4 ngang.
  - **Cài đặt & Tin nhắn Zalo (`zaloIncludeMeterChangeNote`, `zalo-manager.js`)**: Tùy chọn `Ghi chú thay đổi đồng hồ` mặc định **TẮT (`false`)** trong Phần 2; hệ thống **không tự động chèn** vào tin nhắn nếu mẫu không đặt biến. Giao diện chỉ cung cấp **đúng 2 chip biến** `{ghiChuThayDien}` và `{ghiChuThayNuoc}` (`1` lần không ghi chữ `Lần`, dạng `- Điện (dd/mm/yyyy): ...`; `>= 2` lần ghi `- Điện: Lần 1 ...; Lần 2 ...`). Khi bật công tắc và phòng có thay ĐH `completed`, `renderZaloTemplateWithMeterChange()` thay đúng giá trị và tự động thu gọn dòng trống của biến không có dữ liệu.
  - **Cảnh báo trực quan chưa lưu ở Cài Đặt (`#btn-save-settings`, `#btn-save-settings-floating`, `#btn-save-bank-settings`)**: Khi người dùng sửa trường trong Cài đặt chung (`isSettingsDirty`) hoặc Cài đặt ngân hàng (`isBankDirty`), nút Lưu tương ứng tự đổi sang **màu đỏ** (`.btn-save-dirty`) kèm hiệu ứng **lắc nhẹ** điều chỉnh bằng đúng 1 biến CSS `--save-btn-shake-intensity`; nếu đứng yên tại tab Cài Đặt đủ **5 giây** chưa bấm Lưu sẽ bật Tooltip **"Đừng quên lưu cài đặt nhé!"** (`.show-reminder`). Đổi lựa chọn ở Live Preview (`#preview-room-select` / `#preview-month-select`) không làm kích hoạt trạng thái đỏ.
  - **Xuất Excel tháng (`month:export-excel`)**: Bổ sung cột `Q: Ghi Chú` ngoài cùng bên phải (tổng 17 cột `A–Q`), style thường không màu mè/không emoji, tự giãn chiều cao dòng `ht` và chỉ ghi chú cho các phòng có thay ĐH `completed`.

## 15. Modal & Backend Break Chỉ Số Điện / Nước (Đổi Người Thuê Giữa Tháng)

- **Mục đích nghiệp vụ**: Khi có người thuê cũ dọn đi và người thuê mới dọn vào trong **cùng một tháng**, hệ thống cần lưu lại chỉ số **Break kết thúc** của người trước (để đối chiếu lịch sử & xuất Excel) và chốt chỉ số **Break bắt đầu** của người mới làm **Số cũ** tính tiền mới cho tháng đó (tránh tính cộng dồn phần chênh lệch hoặc điều chỉnh giữa hai khách).
- **Vị trí nút bấm**: Nút **"Break chỉ số"** (`#btn-open-meter-break-modal`, class `.btn.btn-meter-break`, tông **tím chàm**) nằm ngay bên **trái** nút **"Thay đổi đồng hồ"** trong `.table-card-header-actions` tại Phần 1.
- **Lưu trữ tách biệt (`<baseFolder>/data/meter-breaks.json`)**:
  - Lưu độc lập theo cấu trúc `{ version: 1, months: { [monthKey]: { [phong]: { elec, water } } } }` qua IPC `meter-breaks:load`, `meter-breaks:save-room`, `meter-breaks:save-month` (ghi atomic `.tmp`, fallback `localStorage` key `phongtro_meter_breaks`), không phá vỡ định dạng mảng `[...]` của `history/YYYY-MM.json`.
  - Hỗ trợ đầy đủ hoàn tác khi mở khóa chỉnh sửa tháng đã khóa rồi Hủy (`confirmUnlockMonthForEditing` + `restoreLockedMonthFromBackup`).
- **Quy tắc ràng buộc & Khóa tuần tự**:
  - **Tối đa 1 lần Break / loại đồng hồ / phòng / tháng** (không hỗ trợ thêm nhiều lần Break).
  - **Loại trừ lẫn nhau (Phương án 1)**: Trên cùng phòng và cùng loại đồng hồ (`elec` hoặc `water`) trong 1 tháng, **không thể** dùng đồng thời cả **Break chỉ số** và **Thay đổi đồng hồ** (checkbox bên còn lại tự disable và hiển thị cảnh báo xung đột). Vẫn cho phép Break Điện kết hợp Thay đổi đồng hồ Nước (hoặc ngược lại) trên cùng một phòng.
  - **Khóa nhập tuần tự Ô 1 → Ô 2 → Ô 3**:
    - *Ô 1 (`Đầu kỳ gốc`)*: Tự động khóa từ số chốt tháng trước (`originalPrevDien` / `originalPrevNuoc`). Nếu tháng trước phòng nghỉ hoặc thiếu số, nút `!` mở popup `#mb-missing-prev-modal` cho phép tự nhập đầu kỳ hoặc quay lại tháng trước.
    - *Ô 2 (`Break kết thúc`)*: Mở sẵn cho đến khi có Ô 1 hợp lệ; chỉ nhận số nguyên không âm.
    - *Ô 3 (`Break bắt đầu`)*: Khóa cho tới khi Ô 2 hợp lệ; sau khi lưu trở thành `dienCu` / `nuocCu` mới của tháng.
  - **Xác nhận quay vòng (`#mb-rollover-modal`)**: Chặn không cho lưu nếu `Ô 2 < Ô 1` (`endRollover`), `Ô 3 < Ô 2` (`startRollover`), hoặc trường hợp ngoài bảng chính đã nhập sẵn `Số mới` mà `Số mới < Ô 3` (`tableEndRollover`) — **trừ khi** người dùng xác nhận đồng hồ đã quay vòng qua hộp thoại `#mb-rollover-modal`.
- **Đồng bộ Bảng Chính, Khóa Sau Lưu & Đầu Ra**:
  - **Bảng Phần 1 (`syncMeterBreakToMainTable`)**: Ghi đè `dienCu` / `nuocCu = breakStart`, gắn pill `✂️` (`.meter-mb-pill`), khóa chỉnh trực tiếp ô `Số cũ` (`.mb-locked-input`), tính lại tiêu thụ/thành tiền ngay lập tức nếu `Số mới` đã nhập sẵn, và bỏ qua cảnh báo bất thường `±40%` ở loại đồng hồ đã Break (`hasMbElec`) để không ẩn tiền oan. Hủy Break (`handleDeleteRoomMeterBreaks` / `handleDeleteSectionMeterBreak`) trả lại nguyên vẹn `originalPrevDien` / `originalPrevNuoc`.
  - **Khóa tự động sau Lưu tại Bước 2**: Sau khi bấm `💾 Lưu ghi nhận`, Bước 2 tự khóa (`🔒 Đã khóa dữ liệu`), muốn sửa phải bấm `✏️ Chỉnh Sửa` → xác nhận qua `#mb-unlock-edit-modal`, kèm nút `Hủy thay đổi & Giữ nguyên` và `🗑️ Hủy Break`. Mục 3 ở Trang 1 (`#mb-history-list`) liệt kê lịch sử Break theo thứ tự **Mới nhất → Cũ nhất**.
  - **Phiếu Thu (JPG/PDF), Zalo & Excel Tháng**:
    - *Phiếu Thu*: Không chèn dòng ghi chú `(*)` Break; hiển thị bình thường với `Số cũ = Break bắt đầu` và `Số mới = Số chốt cuối tháng`.
    - *Tin nhắn Zalo*: Không chèn ghi chú Break; sử dụng số `dienCu` / `nuocCu` mới (`Break bắt đầu`).
    - *Excel Tháng (`month-excel.js`, cột `Q: Ghi Chú`)*: Ghi đầy đủ ghi chú Break qua `formatRoomMeterBreakNotes()` (`Ghi chú Break chỉ số:\n- Điện/Nước: Đầu kỳ ... → Break kết thúc ... | Break bắt đầu ...`), tự gộp sạch nếu phòng đồng thời có Thay đổi đồng hồ ở loại còn lại.
  - **Activity Log**: Ghi nhận các thao tác `METER_BREAK_SAVE` và `METER_BREAK_DELETE` vào `activity-logs.json` qua `buildMbActivityLogDiff()`, kèm đầy đủ bảng chi tiết Trước → Sau (`metadata.changes`: Đầu kỳ gốc, Break kết thúc, Break bắt đầu / Số cũ mới, Ngày Break) và nhãn `[quay vòng]` / `[quay vòng cuối tháng]` trong cả `summary` lẫn bảng chi tiết mở rộng.

## 16. Bảo Mật Cửa Sổ & Đơn Tiến Trình (`electron/main.js`)

- **Đơn tiến trình (Single Instance)**: Dùng `app.requestSingleInstanceLock()` kết hợp `second-instance` để bảo đảm tại một thời điểm chỉ mở tối đa **1 cửa sổ ứng dụng** (nếu người dùng mở thêm sẽ tự khôi phục/focus lại cửa sổ đang chạy) và chặn mở cửa sổ con bằng `setWindowOpenHandler(() => ({ action: 'deny' }))`.
- **Ẩn thanh menu mặc định**: Gọi `Menu.setApplicationMenu(null)` kết hợp `autoHideMenuBar: true` và `removeMenu()` để ẩn hoàn toàn dải `File - Edit - View - Window`; vẫn giữ nguyên thao tác `F5` / `Ctrl+R` tải lại trang, phím phóng to/thu nhỏ (`Ctrl + +`/`=`, `Ctrl + Shift + +`, `Ctrl + -`, `Ctrl + Shift + -`, `Ctrl + 0` với `setZoomLevel` trong khoảng `-4..4`) qua `before-input-event` và Copy/Paste bình thường.
- **Khóa DevTools bản phát hành (Phương án A)**: Đặt `webPreferences.devTools = !app.isPackaged` cho `mainWindow`, `receiptWin` và `rasterWin`. Khi đóng gói (`.exe`), chặn thêm `F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`, `Ctrl+U` và tự đóng qua sự kiện `devtools-opened`; khi chạy dev (`npm start`, `!app.isPackaged`) tự gọi `mainWindow.webContents.toggleDevTools()` khi bấm `F12`, `Ctrl+Shift+I` hoặc `Ctrl+Shift+J`.

## 17. Thuật Toán Tìm Kiếm Người Thuê 2 Pha (`src/input/resident-search.js`)

- **Sửa lỗi trùng tên hàm gốc**: Tách bộ chuẩn hóa tìm kiếm (`normalizeSearchWithTone`, `normalizeSearchNoTone`, `normalizeCharVi`) sang module riêng `src/input/resident-search.js` — tách biệt khỏi hàm `removeVietnameseTones` dùng viết hoa Chủ TK ngân hàng (loại bỏ triệt để lỗi ghi đè mất `.toLowerCase()` trước đây).
- **Pre-indexed Cache (`getIndexedResidents`, `buildResidentSearchEntry`)**: Tiền xử lý danh sách hồ sơ + phân bổ phòng 1 lần mỗi khi dữ liệu thay đổi thay vì chạy lại chuẩn hóa chuỗi trên từng phím gõ.
- **Pha 1 — Tìm chuẩn đa tầng & 2 lớp dấu**:
  - Giữ song song bản **Có dấu (NFC)** và **Không dấu**: khớp chuẩn dấu tiếng Việt luôn đạt điểm cao hơn chỉ khớp không dấu.
  - **Ưu tiên tuyệt đối phòng (`1A`..`6B`, `p1a`, `p.1a`, `phòng 1A`)**: cộng `+2000` điểm (Chủ phòng `+80` trước Thành viên) và chặn nhiễu sang chuỗi con email ngắn.
  - **Chỉ thị ngữ nghĩa (`parseResidentSearchQuery`)**: hỗ trợ `chủ phòng`, `thành viên`, `chủ 1A`, `thành viên 2B`, `chưa xếp` / `trống` (phân biệt `trống` có dấu với tên riêng `Trọng`), đồng thời yêu cầu độ dài `>= 3` cho khớp `.includes` tự do để tránh nhiễu từ 2 ký tự (như `"an"` dính `"Văn"` / `"Trần"`).
  - **Số & Ngày**: SĐT / CCCD hỗ trợ đầu số, 4 số cuối hoặc cụm `>= 3` số (bỏ qua `.`, `-`, khoảng trắng); Ngày sinh / Ngày vào ở (`buildDateVariants`) hỗ trợ `DD/MM/YYYY`, `DD-MM-YYYY`, `MM/YYYY`, `YYYY`.
- **Pha 2 — Fuzzy Damerau–Levenshtein tự động (`damerauLevenshtein`, `getFuzzyWordMatch`)**:
  - **Chỉ kích hoạt khi Pha 1 trả về 0 kết quả**. Nếu Pha 1 có người khớp chuẩn, không trộn thêm kết quả gần đúng.
  - Chỉ áp dụng cho token chữ cái `>= 3` ký tự trên **Họ tên** và **Quê quán** (`maxDist = 1` cho từ 3–6 ký tự, `maxDist = 2` cho từ ≥ 7 ký tự, có hỗ trợ đảo phím cạnh nhau); tuyệt đối **không** fuzzy mã phòng, SĐT và CCCD.
- **UI & Unikey IME (`src/input/renderer.js`)**: Hỗ trợ `compositionstart` / `compositionend` khi gõ dấu tiếng Việt, tô vàng `<mark class="search-hl">` bảo toàn dấu và số SĐT có dấu chấm/gạch, và hiển thị nhãn `Gợi ý gần đúng: N / M` (`.search-result-badge.fuzzy`) khi chạy Pha 2.

## 18. Freeze Panes Bảng Dữ Liệu & File Xuất Excel (Phần 1 & Phần 3)

- **Bảng Phần 1 (`#rooms-table`)**:
  - Đóng băng hàng tiêu đề `thead th` khi cuộn dọc vùng nội dung `.app-main` (bằng CSS `--sticky-head-y` cập nhật đồng bộ qua `syncStickyTableHeaders()`).
  - Đóng băng cố định bên trái 2 cột **`STT`** (`col-stt`, `45px`) và **`Số Phòng`** (`col-phong`, `85px`) kèm nhãn chân bảng **`DOANH THU THÁNG`** (`td.summary-label`, `colspan="2"`, nền tối đục đồng bộ) khi cuộn ngang `.table-wrapper`.
- **Bảng Phần 3 (`#residents-table`)**:
  - Đóng băng hàng tiêu đề `thead th` khi cuộn dọc `.app-main`.
  - Đóng băng cố định bên trái 3 cột **`Checkbox`** (`col-res-check`, `44px`), **`STT`** (`col-res-stt`, `50px`), và **`Họ Và Tên`** (`col-res-name`, `220px..240px`) khi cuộn ngang `.table-wrapper`.
  - Bảo vệ các dòng trạng thái trống (`td.empty-state` với `colspan="12"`) bằng selector `td:not([colspan])` để không bị thu hẹp hoặc dính cột trái.
- **File Xuất Excel (`electron/month-excel-service.js` & `electron/excel-service.js`)**:
  - Cả hai workbook xuất `.xlsx` (Excel bảng tháng Phần 1 & Excel danh sách người thuê Phần 3) đều gắn OpenXML `<pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/>` và `<selection pane="bottomRight" activeCell="C2" sqref="C2"/>` trong `<sheetView>`, cố định **Hàng 1** và **2 cột A:B** (`STT`, `Số Phòng` / `Họ Và Tên`).
- **Thanh Cuộn Ngang Ghim Đáy Khung Nhìn (`.table-sticky-scrollbar`)**:
  - Bổ sung thanh cuộn ngang ghim đáy (`#rooms-sticky-scrollbar` ở Phần 1 và `#residents-sticky-scrollbar` ở Phần 3, `position: sticky; bottom: 0; z-index: 35`) bên trong `.table-card` / `#section-residents .section` (chuyển từ `overflow: hidden` sang `overflow: clip`), đồng thời ẩn thanh cuộn ngang gốc trên `.table-wrapper` mà không đặt `max-height` lên bảng (bảo toàn chiều cao tự nhiên khi Zoom).
  - Đồng bộ 2 chiều `scrollLeft` giữa `.table-wrapper` và `.table-sticky-scrollbar` kèm tự ẩn khi không tràn ngang (`scrollWidth > clientWidth + 1`).

## 19. Header Chống Rớt Dòng & Co Gọn 2 Bước Khi Phóng Zoom (`.app-header`)

- **Chống rớt dòng (Anti-wrap)**: Áp dụng `white-space: nowrap` cho `.brand-text h1`, `.brand-text p`, `.tab-btn`, `.month-select-wrapper`, `.custom-select`, `.btn-activity-log-header` và `.btn-save-export`, giữ font nút tab tối thiểu `16px`.
- **Co gọn 2 bước (`syncHeaderCompactMode()`) & ngưỡng `min–max` (`clamp`)**:
  - **Bước 1 (`.header-compact-log` / `<= 1560px`)**: Tự động ẩn chữ `"Nhật Ký"` trong `#btn-open-activity-log`, chỉ giữ biểu tượng SVG và khung viền ngoài.
  - **Bước 2 (`.header-compact-minmax` / `<= 1360px` & dự phòng `.header-compact-ultra`)**: Điều chỉnh khoảng đệm, khoảng cách, cỡ logo/tiêu đề theo ngưỡng `clamp`, ẩn mô tả phụ, tag phiên bản, nhãn `Tháng / Năm:` (và chữ brand/SVG tab khi cực hẹp) để giữ toàn bộ Header trên **1 hàng ngang duy nhất** ở nhiều mức phóng Zoom.

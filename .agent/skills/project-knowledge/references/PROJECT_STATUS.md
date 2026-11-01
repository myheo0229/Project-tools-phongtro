# 📊 Hiện Trạng Dự Án & Đánh Giá Kỹ Thuật (Project Status)

> **Tài liệu tham khảo thuộc Bộ Tri Thức Dự Án (Project Knowledge Base)**  
> **Ứng dụng:** Quản Lý Phòng Trọ (v3.0.1)  
> **Đánh giá kiểm định:** Thực hiện trên toàn bộ source code thực tế ngày 31/10/2026.

---

## 1. Phân Loại Trạng Thái Tính Năng

### 1.1. Các Tính Năng Đã Hoàn Thành (100% Verified in Code)

| Phân hệ | Tính năng | Bằng chứng kiểm tra trong mã nguồn |
|---|---|---|
| **Cốt lõi** | Công thức tính tiền & làm tròn hàng nghìn | [`src/shared/calc.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/calc.js): Kiểm thử độc lập qua Node.js, khớp 100% logic |
| **Cốt lõi** | Định dạng hiển thị tiền tệ VNĐ & ánh xạ phiếu | [`src/shared/format.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/format.js): Đã xác minh hàm `formatMoney`, `toReceiptData` |
| **Nhập liệu** | Bảng nhập 12 phòng & điều hướng phím Excel | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `handleTableKeyDown` xử lý Enter/Shift+Enter/Tab |
| **Nhập liệu** | Kế thừa chỉ số cũ từ tháng trước & Khóa ô | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `loadRoomsForMonth` đọc tháng $T-1$ điền sang tháng $T$ |
| **Cảnh báo** | Pop-up Xác nhận Công tơ điện quay vòng 1.5x | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `handleDienMoiBlur`, `#rollover-modal` |
| **Cảnh báo** | Pop-up Cảnh báo biến động điện $\ge 40\%$ | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `handleDienMoiBlur`, `#anomaly-modal` |
| **Cảnh báo** | Cảnh báo chưa lưu thay đổi cài đặt giá | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Cờ `isSettingsDirty`, `#unsaved-settings-modal` |
| **Xuất file** | Xuất 12 ảnh JPG (3x scale) + 1 file PDF gộp | [`electron/main.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/main.js): Kênh IPC `export:receipts`, dùng `printToPDF` và `pdfjs-dist` |
| **Cài đặt** | Chọn thư mục lưu trữ & Tự sao chép dữ liệu | [`electron/main.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/main.js): Kênh IPC `settings:save`, dùng `pointer.json` |
| **Cài đặt** | Công tắc Toggle Switch bật/tắt pop-up | [`src/input/index.html`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/index.html), [`src/input/style.css`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/style.css): Hoạt động chuẩn xác |
| **Cài đặt** | Dropdown tìm kiếm ngân hàng có Logo | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Danh mục 50+ ngân hàng từ `banks-data.js` |
| **Zalo** | Đăng nhập QR, lưu session & khôi phục tự động | [`electron/zalo-manager.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/zalo-manager.js): Hoàn chỉnh luồng quét QR, avatar thật và restore ngầm |
| **Zalo** | Gửi hóa đơn tự động kèm ảnh phiếu thu + VietQR | [`electron/zalo-manager.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/zalo-manager.js) & [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hoàn chỉnh `executeSendZaloReceipts` |
| **Zalo** | Báo cáo tổng kết gửi hóa đơn | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `showZaloSummaryReportModal` |
| **Người ở** | Lưới thẻ phòng 12 phòng & Thống kê cư dân | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `renderRoomCards`, `renderResidentsStats` |
| **Người ở** | Phân bổ chủ phòng & danh sách thành viên | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Hàm `openRoomDetailModal`, `saveRoomDetailAssignment` |
| **Người ở** | Quản lý cư dân: Thêm, Sửa, Xóa đơn lẻ & Xóa chọn | [`src/input/renderer.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/input/renderer.js): Form modal, tìm kiếm tức thì, lọc theo phòng |
| **CCCD** | Upload, lưu theo thư mục chuẩn & Xem Lightbox | [`electron/main.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/main.js): Kênh IPC `cccd:*`, lưu ảnh vào `Thông tin người ở/` |
| **Date Picker**| Masked Date Input (`dd/mm/yyyy`) + Calendar Popup | [`src/shared/date-picker.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/date-picker.js): Thuần JS độc lập, tích hợp mượt mà |
| **Auto Update**| Cập nhật tự động ngầm qua GitHub Releases | [`electron/main.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/main.js): Đã tích hợp `electron-updater`, Windows Native Notification |
| **Bảo mật** | Cách ly dữ liệu người dùng khỏi mã nguồn (v3.0.1) | [`electron/main.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/electron/main.js): Không ghi đè về `PROJECT_ROOT`, dữ liệu mẫu trắng sạch |

---

## 2. Các Giới Hạn Kỹ Thuật Cố Hữu & Điểm Cần Lưu Ý

1. **Cố định 12 phòng trọ (`1A`–`6A`, `1B`–`6B`)**:
   - Hiện tại toàn bộ hệ thống (bảng nhập dữ liệu, vòng lặp xuất phiếu thu, dropdown lọc, danh sách phòng) đều đang cấu hình cố định cho mô hình 12 phòng.
   - Nếu trong tương lai người dùng muốn thêm phòng (ví dụ `7A`, `7B`...) hoặc giảm phòng, cần phải refactor động danh sách `DEFAULT_ROOM_NAMES` và cơ chế tạo bảng.
2. **Thư viện Zalo bên thứ ba (`zca-js`)**:
   - `zca-js` hoạt động dựa trên việc mô phỏng ứng dụng web Zalo Web. Zalo không cung cấp API chính thức miễn phí cho tài khoản cá nhân.
   - Do đó, nếu máy chủ Zalo thay đổi cấu trúc xác thực, phiên đăng nhập có thể bị ngắt hoặc không tìm thấy người dùng.
   - Luôn duy trì Anti-ban random delay (3.0s – 4.5s) và không bao giờ giảm con số này xuống để tránh rủi ro cho tài khoản của chủ trọ.
3. **Module C++ Native `sharp` khi đóng gói**:
   - Khi chạy lệnh build đóng gói trên máy phát triển, cần đảm bảo môi trường Node.js và Python hỗ trợ biên dịch node-gyp nếu `sharp` yêu cầu rebuild.
4. **Quyền ghi tệp trên Windows**:
   - Nếu người dùng chọn `baseFolder` tại thư mục được hệ điều hành bảo vệ cao (như `C:\Program Files\` hoặc thư mục gốc `C:\`), ứng dụng có thể gặp lỗi `EACCES / EPERM` do không đủ quyền Admin. Khuyến nghị người dùng chọn thư mục trong `D:\`, `E:\` hoặc `Documents`.

---

## 3. Các Tính Năng Có Thể Nâng Cấp Trong Tương Lai (Backlog Gợi Ý)

- [ ] **Báo cáo tài chính nhiều tháng**: Biểu đồ so sánh doanh thu và điện nước tiêu thụ qua các tháng (sử dụng SVG Canvas thuần).
- [ ] **Tùy biến số lượng phòng động**: Cho phép chủ trọ thêm, sửa, xóa số lượng và tên phòng trọ linh hoạt thay vì cố định 12 phòng.
- [ ] **In hợp đồng thuê phòng**: Tạo mẫu in hợp đồng thuê nhà theo thông tin cư dân và điều khoản thỏa thuận.
- [ ] **Sao lưu đám mây 1-click**: Nén toàn bộ thư mục dữ liệu thành file `.zip` để xuất ra USB hoặc tải lên Google Drive.


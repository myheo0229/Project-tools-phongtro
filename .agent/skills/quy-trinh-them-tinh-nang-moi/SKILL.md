---
name: quy-trinh-them-tinh-nang-moi
description: Quy trình bắt buộc và tự động cập nhật tài liệu dự án mỗi khi thêm mới hoặc sửa đổi tính năng — bảo đảm tài liệu tri thức (Project Knowledge Base) luôn đồng bộ với mã nguồn thực tế
---

# Quy Trình Thêm / Sửa Đổi Tính Năng & Tự Động Cập Nhật Tài Liệu

Tài liệu này định nghĩa quy chuẩn **BẮT BUỘC** áp dụng cho mọi AI Agent và lập trình viên làm việc trên dự án **Quản Lý Phòng Trọ**.

> [!IMPORTANT]
> **NGUYÊN TẮC CỐT LÕI: "CODE THAY ĐỔI ĐẾN ĐÂU, TÀI LIỆU ĐỒNG BỘ ĐẾN ĐÓ"**
> Mọi thay đổi trong mã nguồn (thêm tính năng mới, chỉnh sửa logic cũ, thêm trường cấu hình, thay đổi giao diện, bổ sung IPC...) **phải được ghi nhận vào hệ thống tài liệu tri thức dự án ngay trong cùng một lượt thực hiện**. Tuyệt đối không chờ người dùng nhắc nhở mới cập nhật tài liệu.

---

## 1. Khi Nào Quy Trình Này Được Kích Hoạt?

Quy trình này tự động kích hoạt mỗi khi:
- Thêm một tính năng mới (dù lớn hay nhỏ).
- Thay đổi logic tính toán, validate hoặc nghiệp vụ hiện có.
- Bổ sung hoặc chỉnh sửa giao diện người dùng (HTML / CSS / Component UI).
- Mở rộng cấu trúc dữ liệu (`settings.json`, `data.json`, `rooms.json`, `residents.json`).
- Thêm mới hoặc sửa đổi kênh IPC (`ipcRenderer.send`, `ipcMain.handle`...).
- Thay đổi quy trình cài đặt, môi trường hoặc thư viện phụ thuộc.

---

## 2. Danh Sách 5 Vị Trí Tài Liệu BẮT BUỘC Phải Rà Soát & Cập Nhật

Sau khi viết code và kiểm tra chạy thử (test) thành công, Agent phải rà soát và cập nhật nội dung tương ứng tại các tài liệu sau:

### 📄 1. `FEATURES_AND_LOGIC.md`
- **Đường dẫn**: `.agent/skills/project-knowledge/references/FEATURES_AND_LOGIC.md`
- **Nội dung cần cập nhật**:
  - Tên tính năng mới và mục đích giải quyết.
  - Vị trí trên giao diện và cách người dùng tương tác.
  - Quy trình xử lý chi tiết từng bước.
  - Input, Output và các trường hợp đặc biệt (Edge Cases) / Xử lý ngoại lệ (Error Handling).
  - Trạng thái mặc định và giá trị fallback nếu người dùng chưa thiết lập.

### 📄 2. `SOURCE_CODE_MAP.md`
- **Đường dẫn**: `.agent/skills/project-knowledge/references/SOURCE_CODE_MAP.md`
- **Nội dung cần cập nhật**:
  - File mới tạo (nếu có).
  - Hàm mới, hằng số mới hoặc biến toàn cục mới được định nghĩa (kèm mục đích).
  - Các hàm hiện có bị sửa đổi hành vi hoặc chữ ký tham số (signature).
  - Mối quan hệ gọi hàm giữa Renderer, Preload và Main Process.

### 📄 3. `DATABASE_AND_API.md`
- **Đường dẫn**: `.agent/skills/project-knowledge/references/DATABASE_AND_API.md`
- **Nội dung cần cập nhật**:
  - Các trường dữ liệu mới trong các file JSON (ví dụ trường mới trong `settings.json`).
  - Kênh giao tiếp IPC mới (`ipcRenderer.invoke`, `ipcMain.handle`, `webContents.send`).
  - Định dạng payload dữ liệu trao đổi giữa các tiến trình.

### 📄 4. `UI_GUIDE.md`
- **Đường dẫn**:
  - `.agent/skills/project-knowledge/references/UI_GUIDE.md`
  - `.agent/skills/ui-guidelines/references/UI_GUIDE.md`
- **Nội dung cần cập nhật**:
  - Mô tả component giao diện mới hoặc thay đổi bố cục.
  - Các class CSS mới, biến màu, spacing hoặc icon SVG được thêm vào.
  - Trạng thái tương tác (Hover, Focus, Checked, Disabled, Live Preview).
  - Lưu ý về trải nghiệm gõ phím tiếng Việt (Unikey/EVKey) nếu có ô nhập liệu văn bản/textarea.

### 📄 5. `liệt kê thay đổi.txt` (Changelog)
- **Đường dẫn**: `liệt kê thay đổi.txt` (ở thư mục gốc)
- **Nội dung cần cập nhật**:
  - Thêm mục ghi nhận tính năng/sửa đổi mới vào cuối file hoặc phiên bản tương ứng.
  - Ghi rõ ngày giờ, nội dung cập nhật, các file đã tác động và kết quả nghiệm thu.

---

## 3. Checklist Thực Hiện Trước Khi Báo Cáo Người Dùng

Mỗi lượt lập trình kết thúc bằng việc kiểm tra lại danh sách checklist này:

- [ ] Code đã chạy đúng yêu cầu, không có lỗi runtime hay console error.
- [ ] Tuân thủ quy chuẩn kích thước chữ Header: Nút điều hướng phân hệ (`.tab-btn`) tối thiểu `font-size: 16px`, nút hành động chính tối thiểu `15px` - `16px`.
- [ ] Nếu có ô soạn thảo highlight biến 2 lớp (Backdrop): Thẻ biến span trong backdrop phải `padding: 0; margin: 0; border: none` để tránh lệch chữ.
- [ ] Kiểm tra cú pháp (`node --check <file>`) đối với các file JS/Node.
- [ ] Đã cập nhật `FEATURES_AND_LOGIC.md` đầy đủ chi tiết nghiệp vụ.
- [ ] Đã cập nhật `SOURCE_CODE_MAP.md` với các hàm và biến mới.
- [ ] Đã cập nhật `DATABASE_AND_API.md` với các trường dữ liệu / API mới.
- [ ] Đã cập nhật `UI_GUIDE.md` nếu có can thiệp giao diện.
- [ ] Đã ghi nhận tóm tắt vào `liệt kê thay đổi.txt`.
- [ ] Kiểm tra `git status` đảm bảo chỉ sửa đúng các file liên quan, không dư thừa file rác.


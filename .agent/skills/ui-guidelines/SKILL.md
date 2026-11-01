---
name: ui-guidelines
description: Quy chuẩn thiết kế giao diện (Design System & UI Guidelines) cho ứng dụng Quản Lý Phòng Trọ — đọc trước khi tạo mới component, sửa CSS hoặc chỉnh sửa giao diện
---

# 🎨 Hướng Dẫn Quy Chuẩn Giao Diện (UI Guidelines Skill)

Tài liệu này là chỉ dẫn bắt buộc dành cho mọi AI Agent khi thực hiện bất kỳ công việc nào liên quan đến giao diện người dùng (UI), tạo component mới, chỉnh sửa CSS hoặc cấu trúc trang trong dự án **Quản Lý Phòng Trọ**.

---

## 📖 Hướng Dẫn Sử Dụng

Trước khi thực hiện bất kỳ thay đổi giao diện nào, Agent **BẮT BUỘC** phải đọc tài liệu chi tiết tại:

👉 [`references/UI_GUIDE.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/ui-guidelines/references/UI_GUIDE.md)

---

## ⚠️ Các Nguyên Tắc Bắt Buộc

1. **Tuân thủ Design System hiện tại**:
   - Sử dụng đúng bảng mã màu `:root` trong `src/input/style.css` (`--primary: #0284c7`, `--accent-success: #059669`, `--accent-warning: #d97706`, `--accent-danger: #dc2626`, `--bg-app: #f1f5f9`, `--bg-card: #ffffff`, `--text-main: #0f172a`).
   - Sử dụng đúng font `'Inter'` cho ứng dụng quản trị và `"Times New Roman"` cho mẫu in phiếu thu.
2. **Không tự ý thay đổi màu sắc, font chữ, spacing, component style hoặc layout** nếu không được người dùng yêu cầu rõ ràng.
3. **Ưu tiên tái sử dụng**: Khi tạo component mới, phải ưu tiên tái sử dụng các class có sẵn (`.btn`, `.btn-primary`, `.btn-secondary`, `.stat-card`, `.modal-overlay`, `.modal-card`, `.custom-select`).
4. **Đảm bảo tính nhất quán**: Khi chỉnh sửa một trang hoặc modal, phải đảm bảo kiểu dáng đồng bộ 100% với các trang và modal còn lại trong hệ thống.
5. **Định dạng tiền tệ Việt Nam**: Mọi số tiền trên UI bắt buộc hiển thị theo chuẩn `formatMoney()`: dấu chấm phân cách hàng nghìn kèm đuôi `đ` (ví dụ: `2.200.000 đ`).
6. **Kích thước chữ thanh điều hướng Header & Nút chức năng chính**:
   - Tất cả các nút điều hướng tab phân hệ ở Header (`.tab-btn` cho Phần 1: Nhập Dữ Liệu, Phần 2: Cài Đặt Chung, Phần 3: Quản Lý Người Ở...) **bắt buộc phải có cỡ chữ tối thiểu `font-size: 16px`** (kèm icon `20x20px`, padding `10px 20px`) để tránh bị bé, bảo đảm dễ nhìn và bấm chuẩn xác trên mọi màn hình.
   - Các nút hành động chính như nút Gửi Zalo ở Phần 1 (`.btn-zalo-send`) cũng bắt buộc font-size từ `15px` - `16px`.
7. **Quy chuẩn ô soạn thảo 2 lớp (Backdrop Highlighter)**:
   - Các thẻ `span` bọc biến làm nổi bật trong lớp nền (`.editor-var-chip`, `.editor-var-invalid`) tuyệt đối **không được có padding ngang hoặc border ngang** (`padding: 0; margin: 0; border: none; box-shadow: 0 0 0 1px ...; display: inline;`). Điều này bảo đảm không làm giãn chiều rộng layout của ký tự và loại bỏ 100% hiện tượng lệch chữ giữa textarea và backdrop.


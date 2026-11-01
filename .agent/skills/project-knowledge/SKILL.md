---
name: project-knowledge
description: Bộ tri thức toàn diện và bản đồ kỹ thuật dự án Quản Lý Phòng Trọ (Electron) — tra cứu kiến trúc, source code map, logic nghiệp vụ, UI guide, database và hướng dẫn phát triển
---

# 🧠 Bộ Tri Thức Dự Án Quản Lý Phòng Trọ (Project Knowledge Master Skill)

Tài liệu này là chỉ dẫn định tuyến trung tâm (Knowledge Routing Guide) dành cho mọi AI Agent khi tiếp nhận công việc trong dự án **Quản Lý Phòng Trọ** (phiên bản `v3.0.1`).

Dự án này là một ứng dụng Desktop xây dựng trên nền tảng **Electron (v43.2.0)** kết hợp **HTML5/CSS3/JavaScript thuần (Vanilla ES6+)**, hoạt động theo cơ chế lưu trữ tệp cục bộ (Local JSON Storage) và không sử dụng cơ sở dữ liệu máy chủ hay frontend framework.

---

## 🧭 Hướng Dẫn Định Tuyến Tài Liệu Tham Khảo (Task Routing Guide)

> [!TIP]
> **Quy tắc hiệu quả**: Không cần nạp toàn bộ các tài liệu vào mọi tác vụ. Tùy theo ngữ cảnh công việc được giao, Agent hãy tra cứu chính xác tài liệu liên quan theo bảng chỉ dẫn dưới đây:

| Ngữ cảnh công việc / Mục tiêu tác vụ | Tài liệu bắt buộc phải đọc trước |
|---|---|
| **Bắt đầu tiếp nhận dự án / Tìm hiểu tổng quan bài toán** | [`references/PROJECT_OVERVIEW.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/PROJECT_OVERVIEW.md) |
| **Tìm hiểu luồng hệ thống, tiến trình Main/Renderer/IPC, luồng xuất PDF/ảnh** | [`references/ARCHITECTURE.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/ARCHITECTURE.md) |
| **Tìm vị trí code của một hàm, một class, một component hoặc phân tích tác động** | [`references/SOURCE_CODE_MAP.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/SOURCE_CODE_MAP.md) |
| **Sửa đổi, thêm mới hoặc kiểm tra logic nghiệp vụ, tính tiền, Zalo, modal cảnh báo** | [`references/FEATURES_AND_LOGIC.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/FEATURES_AND_LOGIC.md) |
| **Thao tác với dữ liệu (cài đặt, phòng, cư dân, lịch sử tháng, con trỏ pointer, kênh IPC)** | [`references/DATABASE_AND_API.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/DATABASE_AND_API.md) |
| **Thêm component mới, chỉnh sửa CSS, đổi màu sắc, typography hoặc bố cục trang** | [`references/UI_GUIDE.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/UI_GUIDE.md) |
| **Kiểm tra phiên bản thư viện, bảo mật, native modules (sharp, zca-js, pdf-lib)** | [`references/DEPENDENCIES.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/DEPENDENCIES.md) |
| **Cấu hình đóng gói package.json, biến môi trường GH_TOKEN, Git config** | [`references/CONFIGURATION.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/CONFIGURATION.md) |
| **Kiểm tra tiến độ tính năng, tránh làm lại những thứ đã hoàn thành, kiểm tra rủi ro** | [`references/PROJECT_STATUS.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/PROJECT_STATUS.md) |
| **Nâng cấp phiên bản (Bump version), đóng gói installer, release GitHub, test code** | [`references/DEVELOPMENT_GUIDE.md`](file:///d:/2.%20GauGau/Project-tools-phongtro/.agent/skills/project-knowledge/references/DEVELOPMENT_GUIDE.md) |

---

## ⚠️ Những Nguyên Tắc Bất Di Bất Dịch (Strict Golden Rules)

Mọi AI Agent khi làm việc trong dự án bắt buộc phải tuân thủ nghiêm ngặt 7 điều răn sau:

1. 🚫 **KHÔNG tự ý đưa Framework vào dự án**:
   - Dự án là **100% Vanilla JS, HTML5, CSS3**. Tuyệt đối không cài đặt hoặc import React, Vue, Angular, Svelte, Tailwind CSS, Bootstrap hay jQuery trừ khi có yêu cầu bằng văn bản rõ ràng từ người dùng.
2. 🚫 **KHÔNG tự ý sửa công thức tính tiền trong [`src/shared/calc.js`](file:///d:/2.%20GauGau/Project-tools-phongtro/src/shared/calc.js)**:
   - File này chứa công thức toán học thuần túy cốt lõi đã được kiểm định kỹ lưỡng. Chỉ sửa khi task yêu cầu đích danh về việc thay đổi công thức tính tiền.
   - Khoản "Nợ cũ" đã bị loại bỏ hoàn toàn khỏi hệ thống, không được tự ý thêm lại.
3. 🚫 **KHÔNG thay đổi kiến trúc lưu trữ JSON cục bộ**:
   - Giữ nguyên cơ chế file JSON (`pointer.json`, `settings.json`, `rooms.json`, `residents.json`, `history/YYYY-MM.json`). Không tự chuyển sang SQLite, IndexedDB hay server database.
4. 🚫 **KHÔNG ghi dữ liệu người dùng ngược vào mã nguồn (`PROJECT_ROOT/data`)**:
   - Dữ liệu người dùng phải luôn được lưu vào `baseFolder/data/` thông qua con trỏ `pointer.json`. Thư mục `data/` trong source code chỉ chứa template trắng.
5. 🚫 **KHÔNG tự ý thay đổi Design System & Typography**:
   - Giữ nguyên font `'Inter'` cho ứng dụng quản trị và `"Times New Roman"` cho mẫu in phiếu thu.
   - Giữ nguyên các mã màu `:root` (`--primary`, `--accent-success`, `--accent-warning`, `--accent-danger`).
6. 🚫 **Bảo vệ tài khoản Zalo của chủ trọ**:
   - Mọi tiến trình gửi tin tự động phải duy trì cơ chế gửi tuần tự (`for...of`), độ trễ ngẫu nhiên (3.0s – 4.5s) và timeout 15s cho từng phòng để tránh bị Zalo chặn tài khoản.
7. 🚫 **Luôn kiểm tra mã nguồn thực tế trước khi đưa ra kết luận**:
   - Mã nguồn thực tế là sự thật duy nhất (Single Source of Truth). Luôn đọc file nguồn để kiểm chứng thay vì suy diễn.


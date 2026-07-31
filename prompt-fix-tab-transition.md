# Prompt: Tích hợp hiệu ứng chuyển tab kiểu "Push" cho 2 tab Nhập Dữ Liệu / Cài Đặt Chung

## Bối cảnh
Màn hình `src/input` hiện có 2 tab: **"Phần 1: Nhập Dữ Liệu"** (bảng 12 phòng) và
**"Phần 2: Cài Đặt Chung"** (giá điện/nước, thư mục lưu...), chuyển qua lại bằng 2 nút ở
header. Hiện tại lúc chuyển tab không có hiệu ứng mượt (hoặc có nhưng đơn giản, nội dung
mới hiện lên đột ngột, nội dung cũ biến mất ngay lập tức, không có animation).

**Yêu cầu:** thêm hiệu ứng chuyển tab kiểu **"Push"** giống PowerPoint — nội dung tab CŨ
trượt ra 1 bên, nội dung tab MỚI trượt vào từ phía ngược lại, **chạy đồng thời**, tạo cảm
giác "đẩy" thay vì "chồng đè" hay "hiện đột ngột".

## KHÔNG được sửa
- `src/shared/calc.js`, `src/shared/format.js` — không đụng.
- Bất kỳ file nào trong `src/receipt` — không sửa.
- Chỉ sửa trong phạm vi `src/input` (HTML/CSS/JS của màn hình nhập liệu).

---

## BƯỚC A — Thêm file CSS mới `src/input/tab-transition.css`

Tạo file mới, dán đúng nguyên nội dung sau (đã được viết và duyệt sẵn, không tự ý đổi
giá trị thời gian/easing/khoảng cách trong này):

```css
.tab-panel-container {
  position: relative;
  overflow: hidden;
}

.tab-content {
  will-change: transform, opacity;
}

.tab-content.is-transitioning {
  position: absolute;
  inset: 0;
}

.tab-content.push-left-in {
  animation: pushLeftIn 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.tab-content.push-left-out {
  animation: pushLeftOut 380ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
}

.tab-content.push-right-in {
  animation: pushRightIn 380ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.tab-content.push-right-out {
  animation: pushRightOut 380ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
}

@keyframes pushLeftIn {
  from { opacity: 0; transform: translateX(48px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pushLeftOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-48px); }
}
@keyframes pushRightIn {
  from { opacity: 0; transform: translateX(-48px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pushRightOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(48px); }
}
```

Trong `src/input/index.html`, link file này **SAU** `style.css` hiện có:
```html
<link rel="stylesheet" href="./style.css" />
<link rel="stylesheet" href="./tab-transition.css" />
```

## BƯỚC B — Đảm bảo cấu trúc HTML đúng yêu cầu để hiệu ứng chạy được

- Tìm phần tử đang bọc ngoài cả 2 tab-panel ("Phần 1: Nhập Dữ Liệu" và "Phần 2: Cài Đặt
  Chung") — thêm class `tab-panel-container` vào phần tử bọc ngoài đó.
- Mỗi tab-panel bên trong (panel Nhập Dữ Liệu, panel Cài Đặt Chung) cần có class
  `tab-content` (nếu code hiện tại đặt tên class khác cho 2 panel này, đổi/thêm cho khớp
  đúng tên `tab-content`, giữ nguyên các class khác đang có).

## BƯỚC C — Sửa logic chuyển tab trong `src/input/renderer.js`

Tìm đúng đoạn code hiện đang xử lý sự kiện click vào 2 nút chuyển tab ("Phần 1: Nhập Dữ
Liệu" / "Phần 2: Cài Đặt Chung") — thay phần logic ẩn/hiện panel bằng hàm sau:

```js
// direction: 'left' khi chuyển từ Nhập Dữ Liệu -> Cài Đặt Chung
//            'right' khi chuyển từ Cài Đặt Chung -> Nhập Dữ Liệu
function switchTab(oldPanel, newPanel, direction) {
  const inClass  = direction === 'left' ? 'push-left-in'  : 'push-right-in';
  const outClass = direction === 'left' ? 'push-left-out' : 'push-right-out';

  oldPanel.classList.add('is-transitioning', outClass);
  newPanel.classList.add('is-transitioning', inClass);
  newPanel.hidden = false;

  oldPanel.addEventListener('animationend', () => {
    oldPanel.hidden = true;
    oldPanel.classList.remove('is-transitioning', outClass);
    newPanel.classList.remove('is-transitioning', inClass);
  }, { once: true });
}
```

**Quy ước hướng (chỉ có 2 tab, cố định):**
- Bấm nút "Phần 2: Cài Đặt Chung" trong khi đang ở tab Nhập Dữ Liệu →
  `switchTab(panelNhapLieu, panelCaiDat, 'left')`
- Bấm nút "Phần 1: Nhập Dữ Liệu" trong khi đang ở tab Cài Đặt Chung →
  `switchTab(panelCaiDat, panelNhapLieu, 'right')`
- Nếu bấm vào tab đang đứng sẵn (VD đang ở Nhập Dữ Liệu mà bấm lại nút Nhập Dữ Liệu) →
  không làm gì cả, không chạy lại animation.

**Giữ nguyên** toàn bộ logic khác đã có (style active/highlight cho nút đang chọn, việc
tải/lưu dữ liệu khi chuyển tab, dropdown Tháng/Năm...) — chỉ thay đúng phần animation
chuyển đổi hiển thị giữa 2 panel.

---

## Kết quả mong đợi
- Chuyển từ "Nhập Dữ Liệu" sang "Cài Đặt Chung": nội dung Nhập Dữ Liệu trượt mờ dần sang
  trái, đồng thời nội dung Cài Đặt Chung trượt vào từ bên phải — mượt, khoảng 380ms.
- Chuyển ngược lại: hướng animation đảo ngược tương ứng.
- Không có hiện tượng nội dung "biến mất đột ngột" hay 2 panel bị chồng đè lệch layout.

# Prompt: Fix lỗi xuất ảnh JPG bị lệch/dính scrollbar (bổ sung/patch cho luồng xuất đã có)

## Bối cảnh
Luồng xuất ảnh JPG + PDF đã được code theo prompt trước đó (mở `BrowserWindow` ẩn
1123×794 chứa `src/receipt`, lặp qua 12 phòng: `renderRoom()` → đợi ~150ms → `capturePage()`
→ `.toJPEG(90)` lưu file, và `printToPDF()` → gộp bằng `pdf-lib`).

**Lỗi hiện tại:** ảnh JPG xuất ra bị lệch bố cục, dính viền xám, có thanh cuộn — trong khi
PDF xuất ra thì đúng, đẹp.

**Nguyên nhân đã xác định rõ:** `src/style.css` (của `src/receipt`) có 2 tầng style khác
nhau cho `body`/`.page` — 1 tầng cho hiển thị bình thường (nền xám, có đệm `padding: 24px 0`,
canh giữa bằng `flex`) và 1 tầng riêng trong khối `@media print` (nền trắng, không đệm,
đúng kích thước `297mm × 210mm`).
- `webContents.printToPDF()` **tự động** áp dụng `@media print` (mô phỏng hành động in) →
  ra đúng.
- `webContents.capturePage()` thì **luôn dùng kiểu hiển thị bình thường** ("screen" media),
  KHÔNG tự áp dụng `@media print` → cộng thêm phần đệm + nền xám → bị lệch, tràn, sinh
  thanh cuộn.

## KHÔNG được sửa
- `src/shared/calc.js`, `src/shared/format.js` — không đụng.
- Bất kỳ file nào trong `src/receipt` (`index.html`, `style.css`, `reset.css`, `main.js`)
  — khối `@media print` trong đó **đã đúng, không sửa gì cả**. Toàn bộ fix nằm ở phía
  code Electron (nơi điều khiển việc chụp ảnh), không đụng CSS/HTML.

## Cách fix — ép cửa sổ chụp cũng "nhìn" theo `@media print`

Dùng Chrome DevTools Protocol (CDP) để ép cửa sổ ẩn render theo kiểu in ấn trước khi chụp,
để `capturePage()` cho ra kết quả khớp với `printToPDF()`.

### Thay đổi khi tạo `BrowserWindow` ẩn dùng để xuất
Thêm option `useContentSize: true` (đảm bảo `width`/`height` tính đúng theo vùng nội dung
trang, không lẫn viền cửa sổ hệ điều hành):
```js
const win = new BrowserWindow({
  show: false,
  width: 1123,
  height: 794,
  useContentSize: true,
  webPreferences: { /* giữ nguyên như đã cấu hình trước đó */ },
});
```

### Ngay sau khi cửa sổ load xong (`did-finish-load`), TRƯỚC vòng lặp 12 phòng
Attach debugger và ép media thành `print` — chỉ làm **1 lần duy nhất** cho cửa sổ đó (không
lặp lại trong vòng lặp từng phòng):
```js
await win.webContents.debugger.attach('1.3');
await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
```
Sau dòng này, mọi lần `renderRoom()` + `capturePage()` tiếp theo trong vòng lặp 12 phòng
đều tự động render đúng theo `@media print` — không cần sửa gì thêm trong vòng lặp hiện có.

### Sau khi xử lý xong cả 12 phòng (trước khi đóng cửa sổ)
Gỡ debugger ra:
```js
await win.webContents.debugger.detach();
```

### Bọc an toàn bằng try/catch/finally
```js
try {
  await win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });

  // ... vòng lặp 12 phòng: renderRoom -> capturePage -> toJPEG -> lưu file
  //                         renderRoom -> printToPDF -> giữ buffer -> gộp pdf-lib

} finally {
  if (win.webContents.debugger.isAttached()) {
    await win.webContents.debugger.detach();
  }
  win.close();
}
```

### Về việc tái sử dụng cửa sổ ẩn giữa các lần bấm "Lưu & Xuất"
Để tránh lỗi "debugger already attached" nếu người dùng bấm xuất nhiều lần trong 1 phiên
làm việc: **mỗi lần bấm "Lưu & Xuất", tạo `BrowserWindow` ẩn MỚI từ đầu, và đóng hẳn
(`win.close()`) sau khi xong** (như code mẫu ở trên) — không giữ lại cửa sổ cũ để dùng lại
cho lần xuất sau. Cách này đơn giản, an toàn, không cần quản lý trạng thái attach/detach
qua nhiều lần export.

## Kết quả mong đợi sau khi fix
- Ảnh JPG và PDF xuất ra có bố cục giống hệt nhau (cùng nền trắng, cùng không có phần đệm
  dư thừa, không còn thanh cuộn/lệch).
- Không có thay đổi nào trong `src/receipt`.
- Không ảnh hưởng tới các phần khác đã hoàn thành (`calc.js`, `format.js`, lưu/đọc dữ liệu
  tháng, giới hạn tháng/năm, chọn thư mục lưu).

# Prompt: Xuất ảnh JPG bằng printToPDF() + pdfjs-dist rasterize (thay thế hoàn toàn capturePage/CDP)

## QUAN TRỌNG — Prompt này THAY THẾ HOÀN TOÀN 2 prompt xuất ảnh cũ
- Bỏ hẳn toàn bộ đoạn code dùng `webContents.capturePage()` để lấy JPG.
- Bỏ hẳn toàn bộ đoạn code CDP (`webContents.debugger.attach/sendCommand
  Emulation.setEmulatedMedia/detach`) — không cần nữa với cách làm mới.
- Giữ nguyên mọi phần khác đã hoàn thành: `calc.js`, `format.js`, IPC lưu/đọc dữ liệu
  tháng, IPC settings + chọn thư mục, dropdown chọn Tháng/Năm, nút "Lưu & Xuất" gộp 1
  nút, hiển thị tiến trình `x/12`, hỏi xác nhận ghi đè, tự mở thư mục sau khi xuất xong,
  quy ước tên file (`Phong-<tên>.jpg`, `Thang_MM_YYYY.pdf`, thư mục `Thang_MM_YYYY`).

## Lý do đổi cách làm (để hiểu bối cảnh, không cần làm lại các bước debug)
`capturePage()` bị ảnh hưởng bởi tỉ lệ scale màn hình Windows, làm mất/mờ đường viền
`border-bottom: 1px dotted` trong `src/receipt`, dù `printToPDF()` luôn ra đúng. Giải pháp
mới: **dùng chính PDF đã đúng làm nguồn duy nhất**, chuyển PDF đó thành ảnh JPG bằng
`pdfjs-dist` (thư viện JS thuần, không phải native module, không phụ thuộc scale màn
hình) — thay vì chụp màn hình theo cách cũ.

---

## KHÔNG được sửa
- `src/shared/calc.js`, `src/shared/format.js` — không đụng.
- Bất kỳ file nào trong `src/receipt` (`index.html`, `style.css`, `reset.css`, `main.js`)
  — không thêm `<script>` nào vào đó, không sửa gì cả.

---

## BƯỚC A — Cài thư viện

```
npm install pdfjs-dist@3.11.174
```
Dùng đúng bản `3.11.174` (bản legacy, load bằng `<script>` thường, tạo biến toàn cục
`pdfjsLib`) — KHÔNG dùng bản mới hơn (4.x/5.x) vì bản mới bắt buộc ES module + bundler,
không hợp với cách load file tĩnh đơn giản trong prompt này.

## BƯỚC B — Copy 2 file thư viện vào thư mục riêng của app (để chạy offline, không phụ thuộc mạng)

Copy 2 file sau từ `node_modules/pdfjs-dist/legacy/build/`:
- `pdf.js` → `electron/vendor/pdfjs/pdf.js`
- `pdf.worker.js` → `electron/vendor/pdfjs/pdf.worker.js`

(Nếu bản cài về có sẵn file `.min.js` thì dùng bản `.min.js` cho nhẹ, không bắt buộc.)

## BƯỚC C — Tạo file mới `electron/rasterizer.html` (KHÔNG đặt trong `src/receipt`)

File này có 1 nhiệm vụ duy nhất: nhận dữ liệu PDF (dạng base64), trả về ảnh JPG (dạng
base64). Không liên quan gì tới giao diện phiếu thu.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="./vendor/pdfjs/pdf.js"></script>
</head>
<body>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.js';

  // scale càng cao ảnh càng nét, mặc định 3 (đã test ổn ở bản test độc lập trước đó)
  window.rasterizePdfToJpeg = async function (base64Pdf, scale) {
    const binary = atob(base64Pdf);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1); // mỗi PDF ở đây luôn chỉ có 1 trang (1 phòng)
    const viewport = page.getViewport({ scale: scale || 3 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    return canvas.toDataURL('image/jpeg', 0.92); // trả về dạng "data:image/jpeg;base64,...."
  };
</script>
</body>
</html>
```

## BƯỚC D — Sửa lại luồng xuất trong `electron/main.js`

### D1. Khi bắt đầu xuất (trong hàm xử lý nút "Lưu & Xuất"), mở THÊM 1 cửa sổ ẩn thứ 2

Bên cạnh cửa sổ ẩn có sẵn chứa `src/receipt` (gọi là `receiptWin`), mở thêm 1 cửa sổ ẩn
mới load `electron/rasterizer.html` (gọi là `rasterWin`). Cửa sổ này **dùng chung cho cả
12 phòng**, chỉ mở 1 lần, đóng sau khi xuất xong toàn bộ:

```js
const rasterWin = new BrowserWindow({ show: false });
await rasterWin.loadFile(path.join(__dirname, 'rasterizer.html'));
```

### D2. Vòng lặp qua 12 phòng — thay thế đoạn capturePage cũ

Với từng phòng:
```js
// 1. Bơm dữ liệu vào receiptWin (giữ nguyên như cũ)
await receiptWin.webContents.executeJavaScript(`renderRoom(${JSON.stringify(receiptData)})`);
await new Promise(r => setTimeout(r, 150)); // đợi DOM ổn định, giữ nguyên như cũ

// 2. Xuất PDF 1 trang từ receiptWin (giữ nguyên như cũ, KHÔNG cần CDP/emulateMedia nữa)
const pdfBuffer = await receiptWin.webContents.printToPDF({
  pageSize: 'A4',
  landscape: true,
  printBackground: true,   // đảm bảo in đủ màu nền/viền, không bị thiếu chi tiết
  margins: { marginType: 'none' },
});

// 3. Rasterize CHÍNH buffer PDF vừa có thành JPG, dùng rasterWin (KHÔNG gọi printToPDF
//    lần 2, tái sử dụng đúng buffer đã xuất ở bước 2 để đảm bảo JPG và PDF giống hệt nhau)
const base64Pdf = pdfBuffer.toString('base64');
const dataUrl = await rasterWin.webContents.executeJavaScript(
  `window.rasterizePdfToJpeg(${JSON.stringify(base64Pdf)}, 3)`
);
const base64Jpg = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

// 4. Ghi file JPG trực tiếp ra đĩa (không qua hộp thoại tải nào cả)
fs.writeFileSync(
  path.join(monthDir, `Phong-${room.phong}.jpg`),
  Buffer.from(base64Jpg, 'base64')
);

// 5. Giữ lại pdfBuffer để gộp PDF tổng tháng (bước này đã có sẵn từ prompt trước,
//    dùng pdf-lib, không đổi gì — chỉ nhắc lại để không bị bỏ sót khi ráp code)
pdfBuffers.push(pdfBuffer);

// 6. Gửi tiến trình về renderer (giữ nguyên cơ chế export:progress đã có)
```

### D3. Sau khi xử lý xong cả 12 phòng
- Gộp `pdfBuffers` thành 1 file `Thang_MM_YYYY.pdf` bằng `pdf-lib` (giữ nguyên logic đã
  có từ trước, không đổi).
- Đóng cả `receiptWin` và `rasterWin`.
- Mở thư mục kết quả (`shell.openPath`), báo hoàn tất (giữ nguyên).

### D4. Bọc an toàn bằng try/catch/finally
Đảm bảo cả 2 cửa sổ ẩn (`receiptWin`, `rasterWin`) đều được đóng dù giữa chừng có lỗi,
tránh rò rỉ cửa sổ ẩn chạy ngầm mãi không tắt.

---

## BƯỚC E — Đóng gói: nhớ giữ lại thư mục `electron/vendor/pdfjs`

Khi cấu hình `electron-builder` (phần `build.files` trong `package.json`), đảm bảo
`electron/vendor/pdfjs/*.js` và `electron/rasterizer.html` **được đóng gói kèm theo app**
— đây là lỗi hay gặp nếu cấu hình mặc định lọc bớt file tĩnh không cần thiết. Có thể test
nhanh: sau khi build `.exe`, mở app, thử xuất 1 tháng — nếu báo lỗi không tìm thấy
`pdf.js`/`rasterizer.html` thì chính là do bị lọc mất lúc đóng gói.

---

## Kết quả mong đợi
- Ảnh JPG có đường chấm chấm rõ nét, khớp gần như tuyệt đối với PDF (vì cùng xuất phát từ
  1 buffer PDF duy nhất, không còn 2 nhánh xuất riêng biệt như cách cũ).
- Không phụ thuộc tỉ lệ scale màn hình Windows.
- Không cần thư viện native (không rủi ro lỗi cài đặt kiểu `node-canvas`/`better-sqlite3`).
- Không có bước "chọn file"/"tải xuống" nào xuất hiện cho người dùng — toàn bộ tự động từ
  lúc bấm "Lưu & Xuất" tới lúc thư mục kết quả tự mở ra.

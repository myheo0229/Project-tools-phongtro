# Prompt: Gộp thư mục `data/` vào chung `baseFolder` với `PhieuThu/`, tự phát hiện & xử lý dữ liệu sẵn có

## Bối cảnh & vấn đề cần giải quyết trước tiên (đọc kỹ trước khi code)

Hiện tại `settings.json` (chứa đường dẫn `baseFolder` người dùng chọn qua Browse) đang nằm
ở 1 vị trí CỐ ĐỊNH (`DATA_DIR` hardcode theo prompt cũ). Giờ cần chuyển `data/` (gồm
`settings.json`, `history/`) vào BÊN TRONG `baseFolder` (cùng cấp với `PhieuThu/`) — nhưng
nếu làm vậy, lần mở app sau sẽ không còn nơi cố định nào để tra ra `baseFolder` nữa (vòng
lặp không lối ra: cần đọc `settings.json` để biết `baseFolder`, nhưng `settings.json` lại
nằm trong `baseFolder`).

**Giải pháp bắt buộc phải làm trước tiên:** dùng 1 file "con trỏ" rất nhỏ, đặt ở
`app.getPath('userData')` (thư mục hệ thống cố định của Electron, không cần người dùng
chọn) — file này là `pointer.json`, CHỈ chứa 3 field. Ví dụ minh hoạ SAU KHI người dùng đã
tự chọn xong (KHÔNG phải giá trị mặc định có sẵn — xem lưu ý quan trọng ngay dưới đây):
```json
{
  "baseFolder": "<đường dẫn do người dùng tự chọn qua Browse, VD D:\\GauGau\\Phòng trọ>",
  "dataFolderName": "data",
  "phieuThuFolderName": "PhieuThu"
}
```

**LƯU Ý QUAN TRỌNG — không được hardcode/tự gán sẵn `baseFolder`:** ở lần mở app ĐẦU TIÊN
trên bất kỳ máy nào, `pointer.json` **KHÔNG hề tồn tại** — không có bất kỳ giá trị
`baseFolder` mặc định nào (không phải `D:\GauGau\Phòng trọ`, không phải Documents, không
phải bất kỳ đường dẫn có sẵn nào). App PHẢI bắt buộc người dùng tự vào Cài Đặt Chung, tự
bấm Browse chọn 1 thư mục thật trên máy họ, rồi bấm "Lưu" thì `pointer.json` mới được tạo
ra lần đầu tiên (xem đúng hành vi bắt buộc này ở BƯỚC D bên dưới). Lý do bắt buộc như vậy:
nếu đem app sang cài ở máy khác, ổ đĩa `D:` hay đường dẫn cũ có thể không tồn tại trên máy
mới — để an toàn, luôn để trống, luôn bắt người dùng tự thiết lập từ đầu, không tự động
đoán hay gán sẵn bất kỳ đường dẫn nào.

Mọi lần mở app: đọc `pointer.json` này trước → suy ra đường dẫn thật:
- `dataDir = path.join(baseFolder, dataFolderName)`
- `phieuThuDir = path.join(baseFolder, phieuThuFolderName)`

`dataFolderName`/`phieuThuFolderName` thường là `"data"`/`"PhieuThu"`, nhưng có thể khác
(VD `"data (1)"`) tuỳ theo kết quả xử lý va chạm mô tả bên dưới.

## KHÔNG được sửa
- `src/shared/calc.js`, nội dung `src/receipt` — không đụng.
- Toàn bộ phần khác đã hoàn thiện (dropdown tháng, IPC `month-data:*`, IPC xuất ảnh/PDF,
  tab transition...) giữ nguyên, chỉ đổi cách xác định `dataDir`/`phieuThuDir`.

---

## BƯỚC A — Đánh dấu nhận diện `settings.json` là của đúng app này

Thêm 1 field cố định vào `settings.json` mỗi khi ghi ra:
```json
{ "appId": "phong-tro-app", "...": "... các field khác giữ nguyên" }
```
Dùng để về sau nhận diện chính xác 1 thư mục `data` có phải do chính app này tạo ra hay
không (tránh nhận nhầm 1 thư mục tên `data` bất kỳ, không liên quan).

## BƯỚC B — 2 hàm tiện ích cần viết trước

```js
// Kiểm tra 1 thư mục có phải "data" hợp lệ của app này không:
// đọc <dir>/settings.json, phải tồn tại, parse được JSON, và có đúng appId.
function isValidDataFolder(dir) {
  try {
    const settingsPath = path.join(dir, 'settings.json');
    if (!fs.existsSync(settingsPath)) return false;
    const content = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return content.appId === 'phong-tro-app';
  } catch {
    return false;
  }
}

// Tìm tên thư mục con KHÔNG bị trùng bên trong `parentDir`, bắt đầu từ `baseName`.
// VD baseName="data": thử "data" trống thì lấy luôn "data (1)", "data (2)"... tới khi
// tìm được tên chưa tồn tại.
function findAvailableFolderName(parentDir, baseName) {
  let candidate = baseName;
  let i = 1;
  while (fs.existsSync(path.join(parentDir, candidate))) {
    candidate = `${baseName} (${i})`;
    i++;
  }
  return candidate;
}
```

---

## BƯỚC C — Luồng xử lý đầy đủ khi bấm "Lưu" trong Cài Đặt Chung (sau khi chọn folder qua Browse)

Thứ tự thực hiện, làm đúng từng bước, không đảo thứ tự:

### C1. Đọc `pointer.json` cũ (nếu có) để biết `oldBaseFolder`
Nếu không có `pointer.json` (lần đầu mở app) → coi như không có `oldBaseFolder`.

### C2. Nếu `newBaseFolder` (vừa chọn) === `oldBaseFolder` (không đổi gì)
→ Không cần chạy các bước kiểm tra/hỏi bên dưới, chỉ lưu `settings.json` bình thường như
cách đã làm trước đây, DỪNG LẠI Ở ĐÂY.

### C3. Xác định có "dữ liệu cũ cần mang theo" hay không
`hasOldData = (oldBaseFolder tồn tại) VÀ (oldBaseFolder khác newBaseFolder)`

### C4. Xử lý `data/` tại `newBaseFolder`
- Kiểm tra `newBaseFolder/data` có tồn tại VÀ `isValidDataFolder()` trả về `true` không:
  - **Có, hợp lệ** → hiện hộp thoại xác nhận (dialog 1):
    > "Đã phát hiện dữ liệu có sẵn tại `<newBaseFolder>/data`. Bạn có muốn dùng dữ liệu
    > này không?"
    - **Đồng ý** → `dataFolderName = "data"`. KHÔNG copy gì từ `oldBaseFolder` sang (dữ
      liệu cũ ở `oldBaseFolder` giữ nguyên, không đụng tới, không xoá).
    - **Từ chối** → `dataFolderName = findAvailableFolderName(newBaseFolder, "data")`
      (VD ra `"data (1)"`), tạo thư mục rỗng đó → NẾU `hasOldData` → copy toàn bộ nội dung
      `oldBaseFolder/data/*` vào `newBaseFolder/<dataFolderName>/`.
  - **Không tồn tại / không hợp lệ** → KHÔNG hỏi gì cả, tự động: `dataFolderName = "data"`
    → tạo thư mục (nếu chưa có) → NẾU `hasOldData` → copy toàn bộ nội dung
    `oldBaseFolder/data/*` vào `newBaseFolder/data/`. Nếu không có dữ liệu cũ (lần đầu
    dùng app) → chỉ tạo thư mục rỗng bình thường.

### C5. Xử lý `PhieuThu/` tại `newBaseFolder` (SAU KHI xong bước C4, hỏi tuần tự, không gộp chung 1 màn hình)
- Kiểm tra `newBaseFolder/PhieuThu` có tồn tại không (không cần kiểm tra "hợp lệ" phức tạp
  như `data`, chỉ cần tồn tại thư mục tên đúng `PhieuThu` là đủ):
  - **Có tồn tại** → hiện hộp thoại xác nhận (dialog 2, SAU KHI dialog 1 đã xử lý xong):
    > "Đã có sẵn thư mục `PhieuThu` tại `<newBaseFolder>/PhieuThu`. Bạn có muốn tiếp tục
    > dùng thư mục này để lưu ảnh/PDF không?"
    - **Đồng ý** → `phieuThuFolderName = "PhieuThu"`. Không copy gì từ `oldBaseFolder`.
    - **Từ chối** → `phieuThuFolderName = findAvailableFolderName(newBaseFolder,
      "PhieuThu")` (VD `"PhieuThu (1)"`), tạo thư mục rỗng → NẾU `hasOldData` → copy toàn
      bộ nội dung `oldBaseFolder/PhieuThu/*` vào thư mục vừa tạo.
  - **Không tồn tại** → không hỏi, tự động: `phieuThuFolderName = "PhieuThu"` → tạo thư
    mục → NẾU `hasOldData` → copy toàn bộ nội dung `oldBaseFolder/PhieuThu/*` vào đó.

### C6. Ghi lại `pointer.json` mới
```json
{
  "baseFolder": "<newBaseFolder>",
  "dataFolderName": "<kết quả bước C4>",
  "phieuThuFolderName": "<kết quả bước C5>"
}
```

### C7. Ghi `settings.json` (kèm `appId`) vào đúng
`newBaseFolder/<dataFolderName>/settings.json`

### C8. KHÔNG xoá bất kỳ thứ gì ở `oldBaseFolder`
Dù đã copy dữ liệu sang chỗ mới, thư mục cũ (`oldBaseFolder`) giữ nguyên, không tự động
xoá — đề phòng người dùng chọn nhầm hoặc muốn quay lại.

---

## BƯỚC D — Lần mở app đầu tiên (chưa từng có `pointer.json`)
Giữ nguyên hành vi bắt buộc đã có (chưa chọn folder thì không cho vào phần Nhập Dữ Liệu/
Xuất) — khi người dùng chọn folder lần đầu và bấm "Lưu", chạy đúng luồng ở BƯỚC C (lúc này
`hasOldData = false` vì chưa từng có `oldBaseFolder`, nên chỉ chạy phần kiểm tra đích ở
C4/C5, không có gì để copy).

## BƯỚC E — Cập nhật lại mọi chỗ đang dùng `DATA_DIR` cứng
Toàn bộ code đang tham chiếu `DATA_DIR` hardcode (IPC `month-data:save/load`,
`settings:save/load`...) đổi sang đọc động: đọc `pointer.json` 1 lần lúc app khởi động,
cache lại `dataDir = path.join(baseFolder, dataFolderName)` dùng xuyên suốt phiên chạy đó
(không cần đọc lại `pointer.json` mỗi lần thao tác, chỉ đọc lại khi người dùng bấm "Lưu" ở
Cài Đặt Chung với folder mới, theo đúng luồng BƯỚC C ở trên).

---

## Kết quả mong đợi
- `data/` và `PhieuThu/` luôn nằm cùng cấp trong đúng 1 `baseFolder` do người dùng chọn.
- Đổi sang folder mới, có dữ liệu cũ → tự động mang dữ liệu cũ theo, không cần copy tay.
- Đổi sang 1 folder đã từng dùng trước đó (có sẵn `data`/`PhieuThu` hợp lệ) → được hỏi rõ
  ràng có muốn dùng lại không, không bị ghi đè âm thầm.
- Không bao giờ mất dữ liệu do bị đè lên nhau — luôn có `(1)`, `(2)`... khi có va chạm tên.

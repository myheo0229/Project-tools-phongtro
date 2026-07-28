# Prompt: Viết file `calc.js` cho dự án "Phòng trọ app" (Electron)

## Bối cảnh
Đây là 1 phần của app Electron quản lý tiền trọ. File `calc.js` đặt tại `src/shared/calc.js`, chứa **toàn bộ logic tính tiền điện nước hàng tháng cho từng phòng**, dùng chung giữa màn hình nhập liệu (`src/input`) và tiến trình chính Electron (`electron/main.js`). File này **không được đụng tới DOM, không import Electron** — chỉ là các hàm JavaScript thuần (pure function), để dùng lại được ở nhiều nơi khác nhau trong app.

Dùng CommonJS (`module.exports`), không dùng ES module.

---

## Input của 1 phòng

```js
{
  phong: "1A",          // tên/số phòng
  dienCu: number,        // chỉ số điện cũ (kWh)
  dienMoi: number,       // chỉ số điện mới (kWh)
  nuocCu: number,        // chỉ số nước cũ (m3)
  nuocMoi: number,       // chỉ số nước mới (m3)
  tienPhong: number,     // giá phòng riêng của phòng này (VNĐ), có thể khác nhau giữa các phòng
}
```

## Cài đặt chung (áp dụng cho tất cả các phòng)

```js
{
  giaDien: number,        // đơn giá điện, VNĐ/kWh
  giaNuoc: number,        // đơn giá nước, VNĐ/m3
  tyLeHaoTai: number,     // tỷ lệ hao tải điện, dạng thập phân, VD 0.07 = 7%
  tienRac: number,        // tiền rác, VNĐ, giống nhau mọi phòng
  tienInternet: number,   // tiền internet, VNĐ, giống nhau mọi phòng
}
```

**Lưu ý quan trọng:** KHÔNG có trường "Nợ cũ" ở bất kỳ đâu trong logic này — đã bỏ hoàn toàn khỏi hệ thống, không tính, không hiển thị, không truyền vào công thức tổng.

---

## Công thức tính (thực hiện đúng theo thứ tự sau)

### 1. Số điện tiêu thụ — `dienTieuThu`
Có xử lý trường hợp công tơ quay vòng (chỉ số mới nhỏ hơn chỉ số cũ):

- Nếu `dienMoi >= dienCu`:
  `dienTieuThu = dienMoi - dienCu`
- Nếu `dienMoi < dienCu` (coi như công tơ đã quay về 0):
  `dienTieuThu = (MAX_DONG_HO_DIEN + dienMoi) - dienCu`

Trong đó `MAX_DONG_HO_DIEN = 10000` — khai báo thành hằng số riêng ở đầu file (dễ chỉnh sau này), áp dụng tạm thời cho **tất cả các phòng** vì hiện tại chỉ xác nhận chắc chắn con số này đúng cho 1 phòng, các phòng khác dùng tạm chung giá trị này.

```js
const MAX_DONG_HO_DIEN = 10000;
```

### 2. Số nước tiêu thụ — `nuocTieuThu`
Không có trường hợp âm / quay vòng cần xử lý (đồng hồ nước không quay vòng kiểu này):

```
nuocTieuThu = nuocMoi - nuocCu
```

### 3. Tiền điện — `tienDien`
```
tienDien = round1000(dienTieuThu * giaDien)
```

### 4. Tiền nước — `tienNuoc`
```
tienNuoc = round1000(nuocTieuThu * giaNuoc)
```
(Có làm tròn đến hàng nghìn, giống tiền điện — đây là thay đổi có chủ đích so với bản Excel gốc.)

### 5. Điện hao tải — `dienHaoTai` (đơn vị kWh, làm tròn 1 chữ số thập phân)
```
dienHaoTai = round1(dienTieuThu * tyLeHaoTai)
```

### 6. Tiền điện hao tải — `tienDienHaoTai`
```
tienDienHaoTai = round1000(dienHaoTai * giaDien)
```

### 7. Tổng cộng mỗi phòng — `tongCong`
```
tongCong = tienDien + tienNuoc + tienDienHaoTai + tienPhong + tienRac + tienInternet
```
**Không** làm tròn thêm ở bước này (các thành phần cộng vào đều đã là bội số của 1000 sẵn).

### 8. Tổng doanh thu tháng — `tongDoanhThu`
Tổng `tongCong` của toàn bộ (thường 12) phòng cộng lại.

---

## Hàm làm tròn dùng chung (viết riêng, export luôn để test độc lập được)

- **`round1000(x)`** — làm tròn đến hàng nghìn gần nhất, kiểu làm tròn thông thường (≥500 lên, <500 xuống):
  ```js
  function round1000(x) {
    return Math.round(x / 1000) * 1000;
  }
  ```
- **`round1(x)`** — làm tròn đến 1 chữ số thập phân:
  ```js
  function round1(x) {
    return Math.round(x * 10) / 10;
  }
  ```

---

## Hàm chính cần viết

### `calcRoom(input, settings)`
Nhận vào 1 object input của 1 phòng + object settings chung, trả về 1 object **đầy đủ mọi số liệu cần cho phiếu thu**, khớp đúng tên field mà `src/receipt/main.js` đang dùng (hàm `renderRoom(data)`), để không phải tính toán lại ở nơi khác:

```js
{
  phong,
  dienMoi, dienCu, dienKwh,        // dienKwh = dienTieuThu
  giaDien, tienDien,
  nuocMoi, nuocCu, nuocKhoi,       // nuocKhoi = nuocTieuThu
  giaNuoc, tienNuoc,
  rac,                              // = tienRac
  internet,                         // = tienInternet
  haoTaiKwh,                        // = dienHaoTai
  giaHaoTai,                        // = giaDien (dùng chung 1 đơn giá điện)
  tienHaoTai,                       // = tienDienHaoTai
  tienPhong,
  tongCong,
}
```

Lưu ý: tất cả số trả về là **number thô, không định dạng dấu phẩy ngăn cách hàng nghìn** — việc format hiển thị (VD "2,200,000") làm ở nơi khác (bên `src/receipt/main.js`), không làm trong `calc.js`.

### `calcAllRooms(rooms, settings)`
Nhận vào mảng nhiều phòng (mỗi phần tử đúng format input ở trên) + settings chung, chạy `calcRoom` cho từng phòng, trả về:

```js
{
  rooms: [ /* mảng kết quả calcRoom của từng phòng */ ],
  tongDoanhThu: number   // tổng tongCong của tất cả các phòng
}
```

---

## Export

```js
module.exports = {
  calcRoom,
  calcAllRooms,
  round1000,
  round1,
  MAX_DONG_HO_DIEN,
};
```

## Yêu cầu chất lượng code
- Có comment tiếng Việt ngắn gọn cho từng bước tính, theo đúng thứ tự công thức đã liệt kê ở trên.
- Không được tự ý thêm bước làm tròn nào khác ngoài những gì đã nêu.
- Không tự ý thêm field "Nợ cũ" hay bất kỳ field nào không có trong danh sách trên.
- Đặt tên biến/hàm bằng tiếng Việt không dấu, camelCase, đúng như các tên đã liệt kê trong prompt này (để khớp với các file khác trong dự án).

# Design Spec: Cổng nhà cung cấp LTTP

**Date:** 2026-10-08  
**Status:** Draft for review  
**Feature:** Loại user `lttp_supplier`, superadmin gắn vào nhà cung cấp đã có, một trang xem đặt hàng trong ngày trên app Next riêng

## 1. Problem

Nhà cung cấp LTTP là danh mục của đơn vị cấp 1 (`LttpSupplier`, gắn `unitId`). Danh mục này chưa có tài khoản đăng nhập. Đơn vị kho xem tổng hợp đặt hàng trong tab nhập xuất. Nhà cung cấp cần xem đúng phần đặt hàng của mình, theo từng đơn vị cấp 1, mà không vào các trang đơn vị.

## 2. Locked decisions

| # | Quyết định |
|---|---|
| 1 | Loại hệ thống mới `lttp_supplier`. Không tự đăng ký |
| 2 | Superadmin tạo user và gắn các `LttpSupplier` đã có. Mỗi gắn là một cặp đơn vị cấp 1 + nhà cung cấp |
| 3 | Đơn vị cấp 1 là `Unit.depth === 0`. Nhà cung cấp thuộc đơn vị khác thì không gắn được |
| 4 | Hai nhà cung cấp của cùng một đơn vị cấp 1 trên một tài khoản vẫn là hai cặp. Người dùng chọn một cặp. Không gộp dòng |
| 5 | Hai đơn vị cấp 1 trên một tài khoản cũng chọn một cặp. Không gộp dữ liệu đặt hàng |
| 6 | Đăng nhập ở cổng app chính. Có session loại này thì sang app nhà cung cấp, bỏ qua `from` |
| 7 | App Next `apps/supplier`. Dev cổng `3002`. Production cổng `8082`. Không có trang đăng nhập riêng |
| 8 | Sau đăng nhập chỉ một trang đặt hàng trong ngày |
| 9 | Bảng và ảnh dùng cùng tổng hợp tab đặt hàng, khóa đúng nhà cung cấp đang chọn |
| 10 | Lọc đơn vị nhận trên trình duyệt. Mặc định chọn mọi đơn vị nhận có phiếu trong ngày |
| 11 | Trang chỉ xem. Không sửa phiếu, không copy, không tải, không chia sẻ Zalo |
| 12 | Hai route API chỉ nhận loại `lttp_supplier`. Không đưa vào ma trận quyền |
| 13 | `unitId` và `jobTitleId` của user loại này là null |

## 3. Login and app boundary

Mật khẩu và Google đều kết thúc bằng session trên app chính. `resolvePostLoginPath` với loại `lttp_supplier` trả về origin app nhà cung cấp + `/dat-hang`, và bỏ `from`.

App chính, kể cả trang chủ và trang đăng nhập khi đã có session `lttp_supplier`, chuyển tới `/dat-hang` của app nhà cung cấp. App superadmin làm cùng việc đó. Đăng nhập Google cũng rơi vào luật này sau khi session đã có trên app chính.

App nhà cung cấp chưa có session thì mở cổng đăng nhập app chính. Session thuộc loại khác thì về trang chủ app chính.

Cookie và API base dùng chung với app chính, cùng cách app superadmin. Origin cấu hình bằng `NEXT_PUBLIC_SUPPLIER_ORIGIN`, song song với `NEXT_PUBLIC_SUPERADMIN_ORIGIN`.

## 4. Data

`ensureSystemTypes` thêm loại `lttp_supplier`, `isSystem: true`.

Bảng `UserLttpSupplier`:

| Cột | Ý nghĩa |
|---|---|
| `userId` | User loại `lttp_supplier` |
| `lttpSupplierId` | Nhà cung cấp đã có |

Cặp (`userId`, `lttpSupplierId`) là duy nhất. Xóa user thì xóa các dòng gắn.

Khi tạo hoặc sửa user:

- Loại `lttp_supplier` thì body có `supplierIds`, mảng id, ít nhất một phần tử.
- Mỗi id phải tồn tại và `unit.depth === 0`.
- Lưu `unitId` và `jobTitleId` là null.
- Danh sách gắn được thay bằng đúng tập id gửi lên. Id lặp trong một request chỉ lưu một dòng.
- Đổi sang loại khác thì xóa hết dòng gắn của user đó.
- Loại khác gửi `supplierIds` thì bỏ qua mảng đó.

Ô chọn trên màn user superadmin chỉ hiện khi loại đang chọn là `lttp_supplier`. Danh sách nhóm theo tên đơn vị cấp 1, mỗi dòng là tên nhà cung cấp. Nguồn là mọi `LttpSupplier` có đơn vị `depth === 0`, đọc bởi superadmin.

## 5. API

Middleware: đã đăng nhập, rồi đúng loại `lttp_supplier`. Loại khác nhận `403`.

`GET /api/lttp-supplier/links`

Payload nằm trong envelope thành công hiện có, field `data`. `data` của route links là:

```json
{
  "links": [
    {
      "supplierId": 1,
      "supplierName": "Công ty A",
      "level1UnitId": 10,
      "level1UnitName": "Kho 1"
    }
  ]
}
```

Chưa gắn nhà cung cấp thì `links` là mảng rỗng.

`GET /api/lttp-supplier/orders?date=YYYY-MM-DD&supplierId=`

`supplierId` phải nằm trong các cặp của user hiện tại. Không nằm thì `404`, câu «Không thấy nhà cung cấp của tài khoản này.»

`date` không hợp lệ thì `400`.

Handler gọi hàm tổng hợp tab đặt hàng với đơn vị kho là `unitId` của nhà cung cấp đó và lọc đối tác khóa bằng `supplierId` đó. Không dùng `unitId` của user, vì user loại này không có đơn vị. `data` giữ dạng tổng hợp hiện có (`slipColumns`, `grandTotals`, tên đơn vị kho, ngày). Không thêm trường giá, công nợ, hay phiếu của nhà cung cấp khác.

## 6. Page

Đường dẫn `/dat-hang` trên `apps/supplier`.

- Chọn ngày. Mặc định là hôm nay theo `Asia/Ho_Chi_Minh`.
- Một cặp thì dùng cặp đó, không hiện ô chọn.
- Nhiều cặp thì hiện ô chọn. Nhãn là `{tên đơn vị cấp 1} — {tên nhà cung cấp}`. Chưa chọn thì chưa gọi API đặt hàng. Tải lại trang thì chọn lại.
- `links` rỗng thì hiện «Superadmin chưa gắn nhà cung cấp.» và không gọi API đặt hàng.
- Section đơn vị nhận lấy từ `slipColumns` của lần gọi đó. Mặc định chọn tất cả. Bỏ một đơn vị thì cột của đơn vị đó ra khỏi bảng và ra khỏi ảnh.
- Bỏ chọn hết thì bảng và ảnh trống, dòng «Chọn ít nhất một đơn vị nhận.»
- Ngày không có dòng thì bảng trống, không có ảnh, dòng «Không có đặt hàng trong ngày này.»
- Bảng là ma trận đặt hàng đang dùng ở tab nhập xuất.
- Ảnh là bản chụp bảng đã lọc, bằng `captureElementToPngBlob`, tạo lại khi đổi ngày, đổi cặp, hoặc đổi đơn vị nhận. Ảnh hiện trên trang. Không nút tải, copy, hay chia sẻ.

## 7. Errors

| Tình huống | Kết quả |
|---|---|
| Loại user khác gọi hai route | `403` |
| `supplierId` không thuộc tài khoản | `404` «Không thấy nhà cung cấp của tài khoản này.» |
| `date` sai | `400` |
| Gắn nhà cung cấp không tồn tại hoặc đơn vị không phải cấp 1 | `400` |
| Loại `lttp_supplier` mà `supplierIds` rỗng hoặc thiếu | `400` |
| Tài khoản chưa gắn, mở trang | Câu ở mục 6, không gọi orders |

## 8. Tests

- Sau đăng nhập mật khẩu, loại `lttp_supplier` sang origin nhà cung cấp + `/dat-hang`, kể cả khi có `from` trỏ vào trang đơn vị.
- Tạo user loại này với nhà cung cấp thuộc `depth !== 0` thì `400`, không tạo dòng gắn.
- Đổi user sang loại khác thì xóa dòng gắn.
- `GET /links` chỉ trả cặp của user gọi.
- `GET /orders` với `supplierId` không thuộc tài khoản thì `404` và không gọi tổng hợp.
- `GET /orders` với cặp hợp lệ gọi tổng hợp bằng `unitId` của nhà cung cấp và đúng `supplierId`.
- Loại `admin` gọi hai route thì `403`.
- Trang: một cặp thì không có ô chọn. Hai cặp thì chưa chọn chưa gọi orders.

## 9. Out of scope

Công nợ, thanh toán, xác nhận đơn, sửa phiếu, copy text, tải PNG, chia sẻ Zalo, tự đăng ký, và trang nào khác ngoài `/dat-hang`.

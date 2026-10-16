# Design Spec: Đăng nhập Zalo

**Date:** 2026-10-11  
**Status:** Draft for review  
**Feature:** Đăng nhập bằng Zalo (OAuth, mã QR của Zalo), liên kết tài khoản cũ, đăng ký bằng số điện thoại đã xác minh

## 1. Problem

Đăng nhập hiện dùng tên đăng nhập, email và mật khẩu. Email là bắt buộc và phải xác minh. Số điện thoại chỉ nằm trên hồ sơ, chưa dùng để vào hệ thống. Google đã có OAuth redirect. Zalo chưa có.

Người dùng muốn quét mã Zalo để vào app chính và cổng nhà cung cấp, gắn Zalo vào tài khoản cũ, và đăng ký tài khoản mới bằng số điện thoại Zalo đã chia sẻ.

## 2. Locked decisions

| # | Quyết định |
|---|---|
| 1 | Dùng Zalo Login OAuth v4, PKCE. Mã QR là trang cấp quyền của Zalo trên máy tính. App không tự vẽ mã |
| 2 | Số điện thoại lấy bằng Zalo Mini App `getPhoneNumber`, server đổi token một lần. Trang OAuth website không trả số |
| 3 | App chính và cổng nhà cung cấp có nút. Cổng superadmin không có nút. Superadmin không đăng nhập và không gắn qua Zalo |
| 4 | Callback giống Google: API nhớ cổng đã bấm, đổi mã lấy hồ sơ, rồi đưa người dùng về đúng cổng |
| 5 | Token OAuth và token số điện thoại chỉ dùng một lần. Không lưu token |
| 6 | Không có số điện thoại, hoặc người dùng từ chối chia sẻ số: dừng, không tạo tài khoản. Ngoại lệ: mã Zalo đã gắn sẵn thì vào thẳng, không hỏi số lại |
| 7 | Mã Zalo đã gắn tài khoản hoạt động và đã duyệt: cấp phiên, về trang sau đăng nhập của cổng đã bấm |
| 8 | Số trùng đúng một tài khoản đã duyệt, chưa gắn Zalo, không phải superadmin: nhập mật khẩu tại chỗ để gắn |
| 9 | Số trùng một hồ sơ đang chờ duyệt: không tạo thêm, về trang chờ duyệt của hồ sơ đó |
| 10 | Chưa trùng ai, mở từ app chính: đăng ký loại `user`, hỏi tên đăng nhập và đơn vị. Tên và số lấy từ Zalo |
| 11 | Chưa trùng ai, mở từ cổng nhà cung cấp: đăng ký loại `lttp_supplier`, chỉ hỏi tên đăng nhập |
| 12 | Tài khoản tạo từ Zalo không có mật khẩu. Email để trống cũng được. Sau khi duyệt, chỉ vào bằng Zalo |
| 13 | Đăng ký nhân viên theo cờ duyệt hiện tại. Đăng ký nhà cung cấp luôn chờ duyệt, kể cả khi cờ duyệt chung đang tắt |
| 14 | Chỉ superadmin thấy đăng ký nhà cung cấp đang chờ. Chấp nhận thì bắt chọn một đối tác LTTP đang có và tạo `UserLttpSupplier` |
| 15 | Người đã đăng nhập gắn Zalo từ hồ sơ vào chính tài khoản đó. Mã Zalo đang thuộc người khác thì từ chối |
| 16 | Form tạo người dùng của quản trị có ô số điện thoại. Số này chưa xác minh cho đến khi liên kết Zalo thành công |
| 17 | Số trùng từ hai tài khoản trở lên: không gắn tự động, báo liên hệ quản trị |

## 3. Callback

Nút chuyển sang `https://oauth.zaloapp.com/v4/permission` với `app_id`, `redirect_uri`, `code_challenge`, `state`. Session API giữ `state`, `code_verifier`, cổng (`main` hoặc `supplier`), đường dẫn `from`, và chế độ (`login` hoặc `link`).

Redirect URI là một URL callback của API, khai báo trong ứng dụng Zalo. Cả hai cổng dùng chung URI đó.

Callback kiểm tra `state`, đổi mã tại `https://oauth.zaloapp.com/v4/access_token`, rồi lấy `id` và `name` từ `https://graph.zalo.me/v2.0/me?fields=id,name`. Gọi từ server thì gửi kèm `appsecret_proof` theo Social API. Access token OAuth dùng xong thì bỏ.

Nếu `id` đã gắn một tài khoản chưa xóa, đã duyệt và đang hoạt động, không phải superadmin: cấp phiên ngay. Không mở Mini App. Cùng `id` trên hồ sơ `PENDING_APPROVAL`: về trang chờ duyệt, không mở Mini App.

Các trường hợp còn lại tạo phiếu khoảng 10 phút và đưa trình duyệt về trang «Xác minh số điện thoại» trên đúng cổng đã bấm. Trang đó mở Zalo Mini App kèm ticket. Mini App chỉ có một màn: gọi `getPhoneNumber`, gửi `ticket`, token số và access token của Mini App lên API, rồi báo người dùng quay lại trình duyệt. Mini App không có nghiệp vụ khác.

API đổi token số bằng `GET https://graph.zalo.me/v2.0/me/info`, header `access_token`, `code` (token số, hết hạn sau khoảng 2 phút, dùng một lần) và `secret_key`. Số nằm ở `data.number`. API cũng lấy `id` từ access token của Mini App. `id` này phải trùng `id` trên phiếu. Client không được gửi sẵn số điện thoại.

Từ chối quyền, hết hạn token số, hoặc không có `data.number`: phiếu kết thúc, không tạo tài khoản. Trình duyệt đang mở trang xác minh thấy lỗi và nút quét lại.

Số được chuẩn hóa về `84` + số nội hạt trước khi lưu và so khớp. `0987654321`, `+84987654321` và `84987654321` là một số.

Sau khi có số, trình duyệt đọc phiếu và hiện đúng nhánh. Nhập sai mật khẩu thì nhập lại đến khi phiếu hết hạn. Hết hạn thì quét lại.

### Nhánh

1. `zaloUserId` khớp tài khoản đã duyệt và đang hoạt động: đã cấp phiên ở bước OAuth, trước Mini App.
2. Không khớp mã Zalo, số khớp đúng một tài khoản đã duyệt, đang hoạt động, chưa xóa, chưa có `zaloUserId`, không phải superadmin: trang nhập mật khẩu. Đúng mật khẩu thì ghi `zaloUserId`, ghi số đã xác minh, cấp phiên.
3. Số khớp đúng một hồ sơ `PENDING_APPROVAL`: về trang chờ duyệt, không tạo hồ sơ mới.
4. Còn lại: form đăng ký của cổng đã bấm.
5. `REJECTED`, tài khoản khóa, hoặc loại `superadmin`: báo lỗi, không cấp phiên, không tạo tài khoản.

Chế độ `link` chỉ chạy khi đã có phiên. OAuth xong vẫn phải qua Mini App để lấy số. Gắn `zaloUserId` vào người đang đăng nhập và ghi số Zalo là số đã xác minh. Không đổi sang tài khoản khác.

## 4. Dữ liệu

Trên `User`:

- `zaloUserId` chuỗi, unique, nullable
- `phoneVerifiedAt` datetime, nullable
- `email` nullable. Unique giữ nguyên. MariaDB cho nhiều `NULL`
- `password` nullable

`Profile.phoneNumber` vẫn là chỗ chứa số. Khi so khớp, tìm user chưa xóa có số chuẩn hóa trùng. Tài khoản tạo tay có số nhưng `phoneVerifiedAt` null vẫn nằm trong tập so khớp, để lần đăng nhập Zalo sau nhập mật khẩu và xác minh.

Đăng nhập mật khẩu: `password` null thì từ chối bằng lỗi đăng nhập chung, không gọi `bcrypt.compare` với giá trị null. Tài khoản có email vẫn phải xác minh email như hiện tại. Cấp phiên sau Zalo bỏ qua bước xác minh email khi tài khoản không có email và đã có `phoneVerifiedAt`.

Đăng ký Zalo ghi `profile.fullName` từ tên Zalo, `phoneNumber` đã chuẩn hóa, `phoneVerifiedAt` tại thời điểm tạo, `zaloUserId`, `email` null, `password` null.

Nhân viên: `type` = `user`, `unitId` là đơn vị đang hoạt động đã chọn, `registrationStatus` theo `registrationRequiresApproval`. Cờ duyệt tắt thì tạo xong cấp phiên ngay. Nhà cung cấp: `type` = `lttp_supplier`, `unitId` null, `registrationStatus` = `PENDING_APPROVAL` dù cờ duyệt chung đang tắt. Chưa có dòng `UserLttpSupplier` cho đến khi duyệt.

Duyệt nhân viên giữ API hiện tại. Duyệt nhà cung cấp nhận `lttpSupplierId`. Thiếu id, hoặc đối tác không tồn tại: từ chối. Có id: duyệt và tạo liên kết. Danh sách chờ của admin đơn vị không gồm hồ sơ `unitId` null. Superadmin (scope tất cả đơn vị) thấy các hồ sơ đó.

Form tạo và sửa người dùng của quản trị lưu số vào hồ sơ, không set `phoneVerifiedAt`.

## 5. Màn hình

- Trang đăng nhập dùng chung: nút **Đăng nhập bằng Zalo** khi app đang chạy là app chính hoặc nhà cung cấp. Ẩn trên superadmin.
- Mã Zalo đã gắn: về trang sau đăng nhập, không hiện bước số điện thoại.
- Chưa gắn: trang **Xác minh số điện thoại** mở Mini App. Trang này chờ phiếu đổi trạng thái.
- Sau khi có số, cùng cổng đã bấm: trang nhập mật khẩu, trang chờ duyệt, hoặc form đăng ký.
- Form app chính: tên đăng nhập, đơn vị. Tên và số hiện sẵn, số không sửa.
- Form cổng nhà cung cấp: tên đăng nhập. Tên và số hiện sẵn, số không sửa.
- Hồ sơ: nút **Liên kết Zalo**. Liên kết cũng đi qua Mini App.
- Form tạo người dùng: ô số điện thoại.
- Tab duyệt đăng ký: hồ sơ nhà cung cấp có ô chọn đối tác. Chưa chọn thì không gửi chấp nhận.
- Mini App: một màn xin số, báo xong hoặc báo lỗi. Không có menu, không có đăng ký.

Lỗi hiện một câu tiếng Việt trên trang, không tạo tài khoản: Zalo chưa cấu hình, từ chối quyền hoặc không có số, `id` Mini App lệch phiếu, `state` lệch, phiếu hết hạn, mật khẩu sai, mã Zalo đã thuộc tài khoản khác, số trùng nhiều tài khoản, chưa chọn đối tác.

## 6. Cấu hình

Trong env, không có trang sửa env:

- `ZALO_APP_ID`
- `ZALO_APP_SECRET`
- `ZALO_LOGIN_REDIRECT_URI` — URL callback của API, trùng URI đã khai báo trên ứng dụng Zalo
- `ZALO_MINI_APP_DEEPLINK` — link mở Mini App, trang xác minh gắn ticket vào link này

Mini App và đăng nhập website dùng cùng ứng dụng Zalo, cùng app id và secret. Quyền số điện thoại của Mini App phải được Zalo duyệt.

Thiếu một trong các biến trên: nút báo chưa cấu hình, API trả 503.

## 7. Kiểm tra

Test giả lập đổi mã OAuth, hồ sơ `/me`, và `me/info`, không gọi mạng.

- Chuẩn hóa `0...`, `+84...`, `84...` về một dạng.
- Mã Zalo đã gắn thì cấp phiên trước Mini App.
- Bốn nhánh sau khi có số. App chính tạo `user`. Cổng nhà cung cấp tạo `lttp_supplier` ở trạng thái chờ duyệt.
- Superadmin bị từ chối. Nhiều tài khoản cùng số thì dừng. Không có số, từ chối quyền, hoặc `id` Mini App lệch phiếu thì không tạo tài khoản.
- Duyệt nhà cung cấp thiếu đối tác thì từ chối. Đủ đối tác thì có `UserLttpSupplier`.
- `password` null không đăng nhập bằng mật khẩu. Liên kết hồ sơ bị từ chối khi `zaloUserId` đã thuộc người khác.

Quét mã và mở Mini App trên máy làm sau khi ứng dụng Zalo đã được duyệt quyền số điện thoại.

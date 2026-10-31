# Đặc tả bản in sổ sách bếp ăn: in ra giống hệt mẫu của trợ lý "Sổ sách bếp ăn"

Ngày lập: 28/10/2026 (giờ Việt Nam, UTC+7). Người lập: Grok Bot (chỉ đọc và sao chép file mẫu, không sửa file và không nhắn gì cho trợ lý kia).

## 0. Nguồn mẫu chuẩn (bản sao nằm trong `docs/print-templates/mau/`)

| File | Là gì | Sinh bằng |
|---|---|---|
| `1. So nhap xuat LTTP.pdf` | Sổ nhập xuất LTTP tháng 10/2026 đã in: 109 trang = 1 bìa lót + 27 ngày × 4 trang | Excel `cktc_DD.xlsx` → LibreOffice → PDF, ghép bằng pypdf |
| `cktc_01.xlsx`, `cktc_03.xlsx` | File nguồn của ngày 01 (45 mặt hàng, sang 2 tờ) và ngày 03 (38 mặt hàng, chia 36 + 2) | openpyxl |
| `cktc_ngay.xlsx` | Mẫu trống một ngày (bản trong `/workspace/template/`) | |
| `bia_lot_snx.docx` | Bìa lót sổ nhập xuất | python-docx |
| `mau_duoi_so_nhap_xuat.pdf` | Mẫu đuôi sổ, 9 trang | ReportLab |
| `Duoi so T10 (nhap).pdf/.xlsx` | Bản nháp đuôi sổ tháng 10 do trợ lý điền số tạm tính đến 27/10 | openpyxl → PDF |
| `ref/trang-trai.png`, `ref/trang-phai.png` | Ảnh scan trang trái và trang phải của sổ giấy | |

Quy tắc liên quan của trợ lý: `Quy tắc/04_dien_so.md` (in sổ), `02_soan_thao_dinh_dang.md` (giữ nguyên font, cỡ chữ, lề của mẫu), `06_file_dat_ten.md` (thứ tự ghép PDF), `08_cac_so_khac.md` dòng 256–266 (đuôi sổ).

Ảnh so sánh (110 dpi):
- Mẫu ở `ref/`. Sổ: `snx-001` là bìa, `snx-002..005` là ngày 01, `snx-day03-*` là ngày 03 (trang PDF 10–13). Đuôi sổ: `mau_duoi_so-*` và `duoi_so_t10-*`.
- Bản app in ra ở `app/app-1..7.png`. Đây là kết quả chạy thật `buildMonthBook` (Node) và `render_kitchen_ledger_book` (ReportLab), dùng số liệu ngày 01 và 03 của chính sổ mẫu.

Đơn vị: pt = 1/72 inch (1 mm = 2,835 pt). Mọi số "đo" lấy từ PDF mẫu bằng pdfplumber, nên đã gồm cả tỉ lệ in 97 %.

---

## 1. Thứ tự trang trong sổ

1. **Bìa lót**: 1 trang.
2. **Từng ngày, từ ngày 01 đến ngày cuối có số liệu.** Mỗi tờ gồm trang trái (cột A–K) rồi trang phải (cột L–U). Excel đặt `pageOrder = overThenDown`, nên thứ tự là: Trái tờ 1, Phải tờ 1, Trái tờ 2, Phải tờ 2…
   - Một ngày có thể dài 2, 4 hoặc 6 trang. Trong tháng 10, cả 27 ngày đều dài 4 trang.
   - Không chèn trang trắng.
3. **Đuôi sổ**: ghép vào cuối, theo đúng thứ tự trang ở mục 6.

Không có số trang, tiêu đề trang (header) hay chân trang (footer) trên các trang sổ ngày.

## 2. Trang sổ ngày: thiết lập trang

| Thuộc tính | Mẫu |
|---|---|
| Khổ giấy | A4 dọc (595,3 × 841,9 pt) |
| Tỉ lệ in | 97 % (`scale=97`). Số đo trong file này đã nhân sẵn 0,97 |
| Lề | Trái/phải 1,1 cm (0,4331 in). Trên/dưới 0,6 in = 15,24 mm = 43,2 pt. Header/footer 0,3 in |
| Vùng in | A1:U(dòng cuối), ngắt cột thủ công sau cột K |
| Tiêu đề lặp | Dòng 2–6 (`$2:$6`) lặp lại trên mọi trang |
| Ô có giá trị 0 | Để trống (`showZeros=0`) |
| Font | Times New Roman (app dùng Tinos, cùng số đo chữ, chấp nhận được) |

**Vị trí khung bảng (đo trên PDF):**
- Tờ đầu của ngày có thêm dòng 1 (cao 15,1 pt). Dòng này trống ở trang trái, còn trang phải có chữ "ĐVT: Đồng". Mép trên bảng y = 57,7 pt.
- Tờ tiếp theo không in dòng 1, mép trên bảng y = 43,1 pt.
- Đáy vùng in là y = 798,7 pt.
- Trang trái: x từ 31,2 đến 563,5 pt. Trang phải: x từ 31,2 đến 560,2 pt.

## 3. Trang trái (cột A–K)

### 3.1 Cột

| Cột | Nội dung | Rộng Excel (ký tự) | Rộng in (pt) | (mm) | Căn lề | Cỡ chữ in (gốc → ×0,97) |
|---|---|---|---|---|---|---|
| A | TT | 4,55 | 24,5 | 8,6 | giữa | 12 → 11,6 |
| B | Tên LTTP-Chất đốt | 29,6 | 159,3 | 56,2 | trái | 12 → 11,6 |
| C | ĐVT | 4,89 | 26,3 | 9,3 | giữa | 12 → 11,6 |
| D | Đơn giá | 7,89 | 42,5 | 15,0 | phải | 11 → 10,7 |
| E | Ngày trước chuyển qua: Số lượng | 5,89 | 31,6 | 11,1 | giữa | 11 |
| F | Ngày trước chuyển qua: Thành tiền | 10,89 | 58,6 | 20,7 | phải | 11 |
| G | Nhập trong ngày, Trên BĐ: Mua TT | 6,55 | 35,3 | 12,5 | giữa | 11 |
| H | Nhập trong ngày, Trên BĐ: TG CB | 6,55 | 35,3 | 12,5 | giữa | 11 |
| I | Nhập trong ngày, Đơn vị BĐ: Mua TT | 6,11 | 32,8 | 11,6 | giữa | 11 |
| J | Nhập trong ngày, Đơn vị BĐ: TG CB | 6,11 | 32,9 | 11,6 | giữa | 11 |
| K | Nhập trong ngày: Thành tiền | 9,89 | 53,2 | 18,8 | phải | 10 → 9,7 |

Các đường dọc đo được (x, pt): 31,2 · 55,7 · 215,0 · 241,3 · 283,8 · 315,4 · 374,0 · 409,3 · 444,6 · 477,4 · 510,3 · 563,5.

### 3.2 Phần tiêu đề bảng (dòng Excel 2–6, cao tổng 89,4 pt)

Chiều cao các dòng tiêu đề:
- Dòng 2 cao 32,4 pt (in ra 31,2).
- Dòng 3, 4, 5, 6 mỗi dòng cao 15,6 pt (in ra 14,55).

Đường ngang đo được (y, tờ đầu): 57,7 · 88,9 · 103,5 · 118,0 · 147,1.

| Ô gộp | Chữ (đúng từng ký tự, `\n` là xuống dòng) | Font |
|---|---|---|
| A2:A6 | `TT` | 12 đậm |
| B2:B6 | `Tên LTTP-Chất đốt` | 11 đậm |
| C2:C6 | `ĐVT` | 10 đậm |
| D2:D6 | `Đơn giá` | 10 đậm |
| E2:F2 | `Ngày trước \nchuyển qua` (2 dòng) | 12 đậm |
| E3:E6 / F3:F6 | `Số lượng` / `Thành tiền` | 10 đậm |
| G2:K2 | `Nhập trong ngày` | 12 đậm |
| G3:J3 | `Số lượng` | 12 đậm |
| K3:K6 | `Thành\n tiền` (2 dòng) | 10 đậm |
| G4:H4 / I4:J4 | `Trên BĐ` / `Đơn vị BĐ` | 10 đậm |
| G5:G6 và I5:I6 | `Mua TT` (tự xuống dòng thành "Mua / TT") | 10 đậm |
| H5 + H6, J5 + J6 | `TG` ở dòng 5 và `CB` ở dòng 6. Hai ô riêng nhưng không kẻ đường giữa, nên nhìn như một ô 2 dòng | 10 đậm |

Mọi ô tiêu đề đều căn giữa theo cả chiều ngang và chiều dọc, có tự xuống dòng.

### 3.3 Dòng dữ liệu
- Chiều cao mặc định 14,4 pt, in ra **14,55 pt**. Dòng tự cao lên khi tên hàng phải xuống dòng.
- Tên hàng (B) căn trái, cỡ 12. TT và ĐVT căn giữa, cỡ 12. Đơn giá căn phải, cỡ 11.
- **Số lượng luôn căn giữa. Thành tiền căn phải.**
- Định dạng số:
  - Thành tiền và đơn giá dùng `[$-42A]#,##0;-#,##0;;@`: dấu "." ngăn hàng nghìn, không có phần lẻ, số 0 để trống.
  - Số lượng dùng dạng General kiểu Việt Nam: dấu "," cho phần lẻ (ví dụ `75,15`, `0,4`), số 0 để trống.
- Chất đốt: ĐVT ghi `đ`, đơn giá để trống. Ô số lượng ghi "–" (gạch ngang) ở những cột có thành tiền khác 0.

### 3.4 Dòng chuyển trang và dòng Cộng (trang trái)

**Dòng "Cộng sang trang"** (dòng cuối của tờ chưa phải tờ cuối):
- Chữ ở cột B căn trái, đậm nghiêng 12.
- Chỉ cộng các cột tiền F và K, ghi đậm nghiêng 11 (cỡ chữ bằng ô dữ liệu cùng cột).
- Các ô số lượng để trống.

**Dòng "Mang sang"** (dòng đầu của tờ tiếp theo, ngay dưới tiêu đề): định dạng giống hệt dòng "Cộng sang trang".

**Dòng "Cộng"** (sau mặt hàng cuối của ngày):
- Chữ "Cộng" ở cột B **đậm, không nghiêng, cỡ 11, căn giữa**.
- F và K đậm, cỡ 10.
- Kẻ thin cả 4 cạnh.

**Ngắt tờ:** tính theo chiều cao thực, không đếm số dòng.
- Tờ đầu chứa được khoảng 44 dòng cao 14,55 pt (từ 147,1 đến 798,7 pt), tức tối đa khoảng 43 mặt hàng cộng dòng "Cộng sang trang". Tờ tiếp theo chứa khoảng 45 dòng.
- Một ngày nằm gọn một tờ khi: mặt hàng + dòng Cộng + khối ký tên (1 dòng trống 15,1 + tiêu đề 17,4 + 3 dòng trống 15,1 + tên 17,4 ≈ 95 pt) vẫn lọt vùng in.
- Nếu không lọt thì ngắt tờ, nhưng tờ sau phải còn **ít nhất 2 mặt hàng**.
- Ví dụ trong mẫu:
  - Ngày 01 có 45 mặt hàng, chia 43 + 2.
  - Ngày 03 có 38 mặt hàng, chia 36 + 2, vì 38 + Cộng + ký tên không lọt một tờ.
  - Ngày 04 có 46 mặt hàng nhưng chia 41 + 5, vì có tên hàng xuống dòng làm dòng cao hơn.
- Dòng ngắt của từng ngày (số dòng Excel): 01:50, 02:50, 03:43, 04:48, 05:48, 06:45, 07:50, 08:50, 09:50, 10:48, 11:50, 12:50, 13:50, 14:50, 15:50, 16:50, 17:47, 18:50, 19:48, 20:50, 21:48, 22:50, 23:48, 24:48, 25:48, 26:48, 27:48.
- Tờ đầu luôn có **ít nhất 28 dòng hàng** (dòng 7–34), để khối công khai tài chính ở cột T/U nằm gọn. Ngày nào ít hàng hơn thì thêm dòng trống có kẻ.

### 3.5 Kẻ khung
- Đường dọc giữa các cột và viền ngoài: **thin**, nét 0,73 pt khi in.
- Đường ngang giữa các dòng dữ liệu: **hair**, nét 0,1 pt (rất mảnh).
- Đường ngang trên và dưới phần tiêu đề, dòng "Cộng" và dòng "Cộng sang trang": thin.

### 3.6 Ký tên trang trái
Chỉ có ở tờ cuối của ngày. Cách dòng "Cộng" đúng 1 dòng trống.
- Dòng tiêu đề, cao 17,4 pt, chữ **đậm 14 in hoa**:
  - `QUẢN LÝ ĐƠN VỊ` căn giữa trên A:D.
  - `TRỰC BAN` căn giữa trên G:K.
- Ba dòng trống cao 15,6 pt.
- Dòng tên, cao 17,4 pt, đậm 14:
  - `1// CN Nguyễn Văn Khánh` căn giữa trên A:D.
  - Tên trực ban để trống.
- Không ghi ngày và không có "(đóng dấu)".
- Đo ở ngày 01: tiêu đề ở y = 206,9 pt, tên ở y = 267,2 pt (cách nhau khoảng 60 pt).

### 3.7 Phần đầu trang trái
Trên đầu trang trái **không có gì** (dòng 1 trống). Ngày tháng chỉ in ở trang phải, trong ô tiêu đề "CÔNG KHAI TÀI CHÍNH".

## 4. Trang phải (cột L–U)

### 4.1 Cột

| Cột | Nội dung | Rộng Excel | In (pt) | mm | Căn | Cỡ (gốc) |
|---|---|---|---|---|---|---|
| L | Cộng nhập: Số lượng | 6,11 | 32,8 | 11,6 | giữa | 10 |
| M | Cộng nhập: Thành tiền | 9,66 | 52,0 | 18,3 | phải | 10 |
| N | Xuất ăn trong ngày: Số lượng | 6,22 | 33,5 | 11,8 | giữa | 11 |
| O | Xuất ăn trong ngày: Thành tiền | 9,89 | 53,2 | 18,8 | phải | 11 |
| P | Xuất khác: Số lượng | 5,89 | 31,6 | 11,1 | giữa | 11 |
| Q | Xuất khác: Thành tiền | 6,11 | 32,9 | 11,6 | phải | 11 |
| R | Cộng xuất: Số lượng | 5,89 | 31,6 | 11,1 | giữa | 11 |
| S | Cộng xuất: Thành tiền | 9,66 | 52,1 | 18,4 | phải | 11 |
| T | CKTC: nhãn | 17,6 | khoảng 95,0 | khoảng 33,5 | trái | 12 |
| U | CKTC: giá trị | 21,3 | khoảng 114,3 | khoảng 40,3 | xem 4.4 | 12 |

Các đường dọc đo được: 31,2 · 64,0 · 116,0 · 149,5 · 202,7 · 234,3 · 267,2 · 298,8 · 350,9 · 560,2. Giữa T và U **không có đường dọc**.

### 4.2 Tiêu đề
- Dòng 1 (chỉ ở tờ đầu của ngày): `ĐVT: Đồng`, gộp T1:U1, **nghiêng 12**, căn phải.
- Dòng 2, các ô đậm 12:
  - L2:M2 `Cộng nhập`
  - N2:O2 `Xuất ăn \ntrong ngày` (2 dòng)
  - P2:Q2 `Xuất khác`
  - R2:S2 `Cộng xuất`
  - T2:U2 `CÔNG KHAI TÀI CHÍNH`
- Dòng 3–6:
  - L3:L6 đến S3:S6 xen kẽ `Số lượng` và `Thành tiền`, đậm 10.
  - T3:U3 `Ngày 01 tháng 10 năm 2026`, đậm 12 (không nghiêng).
  - T4:U6 để trống, không kẻ đường bên trong.
- Phần tiêu đề (dòng 2–6) lặp lại trên tờ tiếp theo, kể cả dòng ngày.

### 4.3 Dòng dữ liệu, chuyển trang, Cộng (trang phải)
- Dòng dữ liệu dùng cùng các dòng Excel với trang trái, nên chiều cao giống hệt trang trái.
- Dòng "Cộng sang trang" và "Mang sang" **không có chữ nhãn** ở trang phải. Chỉ có số tiền M, O, Q, S, đậm nghiêng 11 (M cỡ 10).
- Dòng "Cộng": chỉ có số tiền M, O, S, đậm 10, không nghiêng. Kẻ thin.

### 4.4 Khối công khai tài chính (T/U, dòng 7–34, cỡ 12)
Chỉ in ở **tờ đầu** của ngày, dòng 1:1 cạnh các dòng hàng. Ở tờ tiếp theo, cột T/U chỉ còn tiêu đề và các ô trống có kẻ.

| Dòng | T (nhãn) | U (giá trị) | Kiểu |
|---|---|---|---|
| 7 | `Thu` | (gộp T:U) | đậm, căn giữa |
| 8 | `- Thừa hôm trước` | số | thường |
| 9 | `- Mức:` | `72.000` | **giá trị căn giữa** |
| 10 | `+ Sáng: ` | `59 x 14.400 =    849.600` | thường |
| 11–12 | `+ Trưa: `, `+ Chiều: ` | dạng `a x b = c` | thường |
| … | (mức thứ hai 130.000, Ăn thêm, Lễ, tết…) | | |
| 16 | `Ăn thêm` | (gộp T:U) | đậm, căn giữa |
| 21 | `Cộng thu:` | `   7.431.900` | **đậm cả T và U** |
| | `Chi` | (gộp T:U) | đậm, căn giữa |
| | `- Tiền chi LTTP:` | số | thường |
| | `Cộng chi:` | số | đậm cả T và U |
| | `So sánh` | (gộp T:U) | đậm, căn giữa |
| | `- Thừa trong ngày:` / `- Thiếu trong ngày:` | số | thường |

- Nhãn căn trái.
- Giá trị dạng `a x b = c` được chèn khoảng trắng để các dấu "x" và "=" thẳng cột giữa các dòng. Trong xlsx ô có thuộc tính căn giữa, nhưng nhờ khoảng trắng đệm nên các dấu thẳng hàng. App phải đệm khoảng trắng hoặc tự vẽ "a", "x b", "=", "c" ở các mốc x cố định.
- Số tổng có khoảng trắng đầu dòng để nằm lệch phải.
- Kẻ khung khối: chỉ có đường ngang hair giữa các dòng và một đường thin bên phải U. **Không kẻ đường dọc giữa nhãn và giá trị, không kẻ từng ô riêng.** Các dòng sau dòng 34 vẫn giữ đường ngang hair và đường thin bên phải đến hết bảng.

### 4.5 Ký tên trang phải
Chỉ có ở tờ cuối của ngày, cùng hàng với ký tên trang trái.
- `CHỈ HUY ĐƠN VỊ` gộp T:U, căn giữa, đậm 14.
- Ba dòng trống.
- `2//  Nguyễn Minh Tuấn` gộp T:U, căn giữa, đậm 14.
- **Không có "(đóng dấu)".**

## 5. Bìa lót (bia_lot_snx.docx)
- A4 dọc. Lề trái 35,0 mm, phải 15,0 mm, trên 35,0 mm, dưới 25,4 mm.
- **Toàn bộ nội dung căn giữa theo chiều dọc trang** (section vAlign = center).
- Times New Roman 14. Hai đoạn **căn đều hai bên** (justify, không căn giữa):
  1. `Chỉ huy đơn vị: ` + **`Trung tá Nguyễn Minh Tuấn`** (đậm) + ` chứng nhận`
  2. `Giao sổ này cho đồng chí: ` + **`1//CN Nguyễn Văn Khánh`** (đậm) + ` – Nhân viên quản lý để làm sổ nhập – xuất lương thực, thực phẩm, chất đốt, tiền ăn hằng ngày, hằng tháng của bộ đội và công khai trước đơn vị`
- Bên dưới là bảng 2 cột không kẻ (79,7 mm và 80,3 mm). Cột trái trống. Cột phải căn giữa, gồm:
  - *`Ngày 01 tháng 10 năm 2026`* (nghiêng 14)
  - **`CHỈ HUY ĐƠN VỊ`** (đậm 14)
  - các dòng trống
  - **`Trung tá Nguyễn Minh Tuấn`** (đậm 14, có cấp bậc, không phải dạng "2//")
- Đo trên PDF:
  - Chữ bắt đầu ở x = 99,3 pt.
  - Đoạn 1 ở y = 316,6. Đoạn 2 gồm các dòng 341,9 / 359,3 / 376,6.
  - Ngày ở y = 427,3, "CHỈ HUY ĐƠN VỊ" ở y = 443,4, tên ở y = 540,0.

## 6. Đuôi sổ (theo `mau_duoi_so_nhap_xuat.pdf`, 9 trang A4 dọc)
Lề nội dung trái/phải khoảng 8 mm. Font serif.
- Đề mục lớn "I., II., …": đậm 13, căn trái tại x = 8,5 mm.
- Tiêu đề biên bản: đậm 11–11,5, căn giữa.
- Chữ trong bảng: 5,5–9 pt tùy trang.
- Chân trang góc phải dưới có nhãn tên sheet, cỡ 7, y = 291 mm. Đây là dấu vết của Excel, có thể bỏ.

| Trang | Nội dung (giữ đúng chữ) | Cột (mép dọc, mm) |
|---|---|---|
| 1 | `BIÊN BẢN TỊNH KHO CUỐI THÁNG……` (đậm 11, giữa); đoạn "Hôm nay, ngày … tháng …. năm 20…. Chúng tôi đã cân đong lại lương thực, thực phẩm, chất đốt tồn kho tháng"; `I. KẾT QUẢ TỊNH KHO`; bảng TT, TÊN LƯƠNG THỰC THỰC PHẨM CHẤT ĐỐT, ĐVT, Giá lẻ (đồng), CÒN TRÊN SỔ (SL/TT), THỰC KIỂM KHO (SL/TT), SO SÁNH Thừa (SL/TT) Thiếu (SL/TT), GHI CHÚ, dòng Tổng cộng (dòng cao 5,6 mm); `II. LÝ DO THỪA, THIẾU VÀ Ý KIẾN GIẢI QUYẾT` và các dòng chấm | 8,1 · 15,2 · 53,3 · 61,0 · 74,1 · 88,2 · 105,1 · 117,5 · 134,8 · 147,1 · 159,5 · 171,8 · 184,1 · 202,1 |
| 2 | Dòng chấm (tiếp); "Chúng tôi đã kiểm tra và xác nhận phần ghi chép này là đúng."; "Ngày ….. tháng ….. năm 20…."; ký `QUẢN LÝ` / `TỔ KINH TẾ` / `CHỈ HUY ĐƠN VỊ` (đậm 13), tên cỡ 12 | |
| 3 | `BÁO CÁO CÔNG KHAI SỬ DỤNG TIỀN ĂN` / `VÀ BẢO ĐẢM LƯƠNG THỰC THỰC PHẨM` (đậm 11,5); `I. SỬ DỤNG TIỀN ĂN`: A. PHẦN THU 1–8 + Cộng thu; B. PHẦN CHI 1–6 + Cộng chi; C. SO SÁNH (chữ 9 pt) | 8,1 · 16,6 · 128,4 · 165,8 · 202,1 |
| 4 | `II. TIẾP NHẬN VÀ BẢO ĐẢM LƯƠNG THỰC` (7,5 pt) | 8,1 · 19,8 · 51,2 · 66,0 · 82,2 · 103,0 · 114,7 · 131,2 · 153,5 · 167,6 · 179,9 · 202,1 |
| 5 | `III. SỬ DỤNG THỰC PHẨM - CHẤT ĐỐT` (17 nhóm, 6,5 pt) | 15 cột, từ 8,1 đến 202,1 |
| 6 | `IV. KẾT QUẢ TỰ TÚC THỰC PHẨM THÁNG…` (7,5 pt) | 12 cột |
| 7 | `V.1 KẾT QUẢ BẢO ĐẢM ĐỊNH LƯỢNG LT THỰC PHẨM-CHẤT ĐỐT` / `MỨC ĂN ………. đồng/người`; cột ngày 1–31 và BQ (5,5 pt). Mỗi mức ăn một trang (bản nháp T10 có 2 trang: 72.000 và 130.000) | 24 cột |
| 8 | `VI - BÁO CÁO TÌNH HÌNH TRANG BỊ, DỤNG CỤ CẤP DƯỠNG` (5,5 pt) | 26 cột |
| 9 | `VII. NHẬN XÉT CỦA TỔ KINH TẾ` (các mục 1–… đậm 11,5, dòng chấm 13); ký `TỔ KINH TẾ` / `QUÂN Y` / `QUẢN LÝ` và `CHỈ HUY ĐƠN VỊ` ở giữa | |

Theo quy tắc 08: tên người ký trong mẫu ("3/CN Trần Văn Tâm"…) **phải thay bằng tên của đơn vị**. Bản nháp của trợ lý dùng Times New Roman, lề 0,45 / 0,60 / 0,55 in, co vừa chiều ngang trang, căn giữa ngang. Tiêu đề trang ghi "BẢN NHÁP – Số liệu tạm tính đến ngày …". Bản chính thức không có dòng này.

---

## 7. Danh sách khác biệt giữa app và mẫu (xếp theo mức ưu tiên)

Đường dẫn tính từ gốc repo. Số dòng theo commit fe8b8e3 (nhánh `cursor/so-trang-ngay-khung-e6be`).

Viết tắt: KLB = `services/document-service/app/render/kitchen_ledger_book.py`, LAY = `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-layout.js` (phải sửa giống hệt cả `packages/shared/src/pages/kitchen-books/ledgerPageLayout.js`, vì có test so hai bản), CMP = `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-compute.js`, MB = `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-month-book.js`.

### Ưu tiên 1: nhìn qua là thấy khác

1. **Cỡ chữ quá nhỏ.** App in số liệu cỡ 7 và tiêu đề 6,5. Mẫu in 10–12 (ra 9,7–11,6).
   - Sửa LAY dòng 6–7 và KLB dòng 31–32, 173: bỏ một cỡ chung, dùng cỡ theo từng cột như bảng 3.1 và 4.1 (A, B, C = 12; D–J = 11; K, L, M = 10; N–S = 11; T/U = 12), nhân 0,97.
   - Cỡ tiêu đề theo từng ô như bảng 3.2 (12, 11 hoặc 10 đậm).
2. **Dòng thấp và tiêu đề thấp.** App: ROW_H 12 pt, HEADER_H 54 pt chia đều 4 dòng. Mẫu: dòng 14,55 pt, tiêu đề 89,4 pt (31,2 + 4 × 14,55).
   - Sửa KLB dòng 29–30 và 168: ROW_H = 14.55, chiều cao từng dòng tiêu đề = [31.2, 14.55, 14.55, 14.55, 14.55].
   - Dòng tự cao lên khi tên hàng xuống dòng: đo bằng `stringWidth` theo bề rộng cột B.
3. **Tiêu đề 4 dòng, mẫu 5 dòng.** Sửa LAY dòng 9–45: `headerRowCount: 5`.
   - E2:F2 và G2:K2 ở dòng 0. G3:J3 "Số lượng" ở dòng 1. G4:H4 và I4:J4 ở dòng 2. G5:G6 và I5:I6 "Mua TT" (rowspan 2).
   - "TG" và "CB" thành hai ô ở dòng 3 và dòng 4, không vẽ cạnh chung.
   - Giữ xuống dòng `Ngày trước \nchuyển qua`, `Xuất ăn \ntrong ngày`, `Thành\n tiền`.
   - Trang phải: T3:U3 là ô ngày (`dateCell` [8,1,2,1] giữ nguyên, nay ứng với dòng Excel 3 của tiêu đề 5 dòng; T2:U2 là [8,0,2,1]; thêm ô trống [8,2,2,3] không kẻ). T4:U6 để trống, không kẻ.
4. **Bề rộng cột lệch.** App LEFT_WIDTHS cho TT 5,7 mm (mẫu 8,6) và Tên 71,5 mm (mẫu 56,2). Trang phải: app P/Q/R/S = 10,6/18,3/10,6/18,4 mm, mẫu Q chỉ 11,6 mm.
   - Sửa KLB dòng 35–36 sang số pt tuyệt đối, không co theo tỉ lệ:
     - `LEFT_WIDTHS = [24.5,159.3,26.3,42.5,31.6,58.6,35.3,35.3,32.8,32.9,53.2]`
     - `RIGHT_WIDTHS = [32.8,52.0,33.5,53.2,31.6,32.9,31.6,52.1,95.0,114.3]`
   - Vẽ từ x = 31.2.
5. **Lề trên và dưới sai.** App PAGE có margin top/bottom 22. Mẫu: 43,2 pt (0,6 in). Bảng tờ đầu bắt đầu ở y = 57,7 vì có dòng 1 cao 15,1, tờ sau ở y = 43,1. Đáy vùng in 798,7. Lề trái 31,2 pt.
   - Sửa KLB dòng 20–27: `margin_top=43.2, margin_bottom=43.2, margin_left=31.2, margin_right=31.2`. Thêm dòng 1 cao 15.1 chỉ ở tờ đầu.
6. **Khối công khai tài chính sai kiểu.** App: chia 0,48/0,52, kẻ từng ô, chữ 6,2 thường, giá trị căn phải. Mẫu: 12 pt; "Thu/Ăn thêm/Chi/So sánh" đậm căn giữa trên T:U; "Cộng:/Cộng thu:/Cộng chi:" đậm cả nhãn và số; không kẻ dọc giữa T và U; chỉ có đường ngang hair; giá trị "- Mức:" căn giữa; biểu thức thẳng cột "x" và "=".
   - Sửa KLB dòng 310–320: vẽ theo `row.kind` (MB đã có "line", cần thêm "heading"/"total"). Rộng T = 95.0 và U = 114.3. Bỏ khung từng ô.
   - Sửa MB dòng 93–99: `expr` trả về các phần riêng (count, price, amount) để renderer đặt ở các mốc x cố định, hoặc đệm khoảng trắng như mẫu.
7. **Khối tài chính lặp lại ở mọi tờ.** KLB dòng 368–379 vẽ khối ở mọi trang phải, và khi ít dòng hàng thì khối thò xuống dưới bảng.
   - Sửa: chỉ vẽ ở tờ đầu (sheet index 0). Tờ đầu có ít nhất 28 dòng hàng: thêm dòng trống có kẻ để khối nằm trong bảng.
   - Tờ sau: cột T/U để trống, có kẻ ngang hair.
   - Ký tên lấy mốc từ đáy bảng, không lấy `min(y, finance_bottom)` (dòng 381).
8. **Có dòng ngày ở đầu trang trái.** KLB dòng 331–333 vẽ `dateLine` ở góc trái trên. Mẫu không có (ngày chỉ nằm trong T3:U3).
   - Sửa: xóa dòng 333.
   - "ĐVT: Đồng" (dòng 335): đổi sang nghiêng 11,6 (12 × 0,97), căn phải tại x = 560,2, và **chỉ in ở tờ đầu**.
9. **Chữ ký có "(đóng dấu)" và cỡ chữ sai.** KLB dòng 382 dùng `"Chỉ huy đơn vị\n(đóng dấu)"`. Mẫu chỉ ghi `CHỈ HUY ĐƠN VỊ`.
   - Tiêu đề và tên đều đậm 14 (ra 13,6), in hoa. Căn giữa trên A:D (Quản lý), G:K (Trực ban), T:U (Chỉ huy).
   - Cách dòng Cộng 1 dòng (15,1). Từ tiêu đề đến tên khoảng 60 pt. Không có dòng ngày.
   - Sửa: không đi qua `draw_signature_block` chung (cỡ 8). Vẽ riêng theo mốc cột.
10. **Trang phải in nhãn "Cộng sang trang/Mang sang/Cộng".** KLB dòng 346 `label_index = 1 if left else 0` làm app nhét nhãn vào cột L, co chữ còn 4,5 pt.
    - Sửa: `label_index = 1 if left else None`. Trang phải chỉ in số.
11. **Dòng "Cộng" sai kiểu.** App in qua `_money_row` (KLB dòng 189–203, 364–366): nhãn đậm nghiêng 6,5 căn trái.
    - Mẫu: "Cộng" **đậm thường 11 căn giữa** ở cột B; số đậm 10 (F, K, M, O, S); kẻ thin.
    - Sửa: thêm tham số `style="total"` cho `_money_row`.
12. **Dòng "Cộng sang trang/Mang sang"**: nhãn phải là đậm nghiêng 12 (app 6,5); số đậm nghiêng 11, riêng K và M cỡ 10 (app 7). Sửa KLB dòng 196, 199.
13. **Ngắt tờ đếm theo số dòng.** CMP dòng 258–287 (`splitLedgerPages`): ≤ 28 dòng thì một tờ, còn lại 40 dòng mỗi tờ. Ngày 01 app chia 40 + 5 (mẫu 43 + 2). Ngày 03 app để 1 tờ (mẫu 36 + 2).
    - Sửa: tính theo chiều cao (mục 3.4).
      - Một tờ nếu `Σ cao dòng + Cộng + 95 pt ký tên ≤ 798.7 − 147.1`.
      - Nếu không thì tờ đầu lấy tối đa số dòng lọt `651.6 − 14.55` (chừa dòng Cộng sang trang), tờ sau phải còn ít nhất 2 mặt hàng.
      - Tờ sau có vùng 798.7 − 132.6.
    - Cập nhật LAY dòng 10–12 (`singlePageMax`, `pageCapacity`) hoặc thay bằng các giá trị chiều cao.
14. **Bìa lót sai bố cục.** KLB dòng 263–307 căn giữa từng dòng, cỡ 13 thường, không có chữ đậm, ngày ở giữa trang, chữ ký qua `_draw_signatures` cỡ 8, và tên chỉ huy theo dạng "2// …".
    - Sửa theo mục 5: lề 35/15/35/25,4 mm, căn giữa dọc, 2 đoạn justify cỡ 14 có tên đậm.
    - Khối ký là cột phải rộng 80,3 mm, căn giữa: ngày nghiêng, "CHỈ HUY ĐƠN VỊ" đậm, tên đậm có cấp bậc ("Trung tá …").
    - Cần thêm `cover.commanderRankName` trong MB (`buildMonthBook`, dòng 167–205).
15. **Thiếu đuôi sổ.** KLB dòng 386–392 chỉ in chữ "Đuôi sổ". MB đặt `tail: null`.
    - Sửa: dựng 9 trang theo mục 6, gồm biên bản tịnh kho, công khai tài chính, tiếp nhận LT, sử dụng TP-CĐ, tự túc, định lượng (mỗi mức một trang), DCCD, nhận xét.
    - Số liệu theo `Duoi so T10 (nhap) - so lieu.json`.

### Ưu tiên 2: chi tiết nhỏ hơn

16. **Nét kẻ.** KLB dòng 109 dùng `setLineWidth(0.3)` cho mọi đường. Mẫu: thin 0,73 pt cho đường dọc, viền ngoài, tiêu đề và dòng Cộng; hair 0,1 pt cho đường ngang giữa các dòng dữ liệu. Sửa: `_draw_cell` nhận kiểu cho từng cạnh.
17. **"Mua TT" và "TG CB"** phải xuống dòng ("Mua / TT", "TG / CB"). LAY dòng 27–30.
18. **Tiêu đề cột "Thành tiền" của K** phải là `Thành\n tiền` (2 dòng). LAY dòng 24.
19. **Ô ngày trong tiêu đề CKTC** phải đậm 12, không nghiêng. Kiểm tra KLB dòng 173 khi đổi cỡ chữ.
20. **Ngày ít hàng** (dưới 28 dòng) phải có thêm dòng trống có kẻ tới dòng 34. App kết thúc bảng ngay.
21. **Giá trị "- Mức:"** phải căn giữa (MB dòng 109 thêm `align: "center"`). Số tổng "Cộng thu/Cộng chi" lệch phải bằng khoảng trắng.
22. **Chữ ký trực ban:** mẫu để trống tên, app cũng phải để trống (không ghi "………"). Kiểm tra `book.signatures.truc_ban`.
23. **Hình mờ "NHÁP" và chữ cảnh báo đỏ ở bìa** (KLB dòng 209–216, 302–306) không có trong mẫu. Chỉ giữ khi còn là bản nháp. Bản chính thức phải giống mẫu 100 %.
24. **Bảng xem trước trên web** (`packages/shared/.../ledgerPageLayout.js` dòng 5–25, `LEDGER_BODY_COLUMNS`) để cột số lượng `align: "right"`. Mẫu căn giữa. Đây không phải bản in, sửa để màn hình giống bản in.
25. **Font**: app dùng Tinos, mẫu dùng Times New Roman. Số đo chữ giống nhau nên giữ Tinos, nếu máy chủ có Times New Roman thì dùng.
26. **Đuôi sổ, chân trang**: mẫu có nhãn tên sheet cỡ 7 ở góc phải dưới. Khi dựng đuôi sổ, tùy chọn có in hay không (bản nháp của trợ lý có in).

## 8. Kiểm tra sau khi sửa
- Render lại ngày 01 và ngày 03 bằng `/workspace/print-render/render.py`. So từng trang với `ref/snx-002..005` và `ref/snx-day03-*` ở 110 dpi.
- Mép đường kẻ phải trùng trong khoảng ±0,5 pt (đo bằng pdfplumber `lines` x/top như mục 3.1, 3.2 và 4.1).
- Ngắt tờ phải đúng bảng dòng ngắt ở mục 3.4 cho cả 27 ngày.

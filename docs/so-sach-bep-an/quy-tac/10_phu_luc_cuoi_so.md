# 10 – Phụ lục cuối Sổ nhập xuất LTTP (bộ rule chung)
> Tổng hợp từ buổi làm việc 05/11/2026 với chủ sổ (sổ tháng 10/2026). Viết chung cho MỌI trợ lý làm sổ bếp ăn. Các giá trị riêng của một đơn vị nằm ở mục **12. Cấu hình đơn vị (ví dụ)**. Mục ghi **(cần xác nhận)** là chủ chưa chốt, phải hỏi.

## 0. Nguyên tắc chung
- Chỉ điền số lấy được từ sổ ngày (khối công khai/cktc) hoặc chủ sổ cung cấp. **Không bịa số, không suy diễn.** Không có số thì để trống (hoặc dòng chấm) và hỏi chủ.
- Web Quân lương (nếu có) chỉ **xem**, không Lưu/Tạo/Sửa/Xóa.
- Mỗi phụ lục một thư mục `Tháng MM-YYYY/<tên>/` gồm mẫu chủ gửi (`mau.ods`), script dựng, file xlsx/docx, PDF và ảnh PNG xem trước. Dựng mới bằng script, lưu JSON số liệu trung gian để đối chiếu.
- Mỗi lần sửa xong: xuất PDF bằng LibreOffice, render PNG, **tự nhìn PNG** (chữ bị che, ###, kẻ chéo, số xuống dòng) trước khi báo chủ.

## 1. Thứ tự trang (sau trang ngày cuối tháng)
1. Biên bản tịnh kho cuối tháng
2. **I.** Báo cáo công khai sử dụng tiền ăn (phụ lục tiền ăn)
3. **II.** Tiếp nhận và bảo đảm lương thực (chỉ gạo)
4. **III.** Sử dụng thực phẩm – chất đốt
5. **IV.** Kết quả tự túc thực phẩm tháng
6. **V.1, V.2, …** Kết quả bảo đảm định lượng LTTP – chất đốt, mỗi mức ăn một trang
7. **VI.** Báo cáo tình hình trang bị, dụng cụ cấp dưỡng
8. **VII.** Nhận xét của tổ kinh tế (trang cuối, làm bằng Word)

## 2. Quy tắc trình bày chung (mọi phụ lục)
- **Khổ giấy:** A4 dọc, mỗi phụ lục gọn **1 trang** (V: 1 trang/mức). Font Times New Roman.
- **Cỡ chữ:** chữ 12pt; số trong bảng III/IV 11pt; tiêu đề III/IV 11pt; VI toàn bộ 11pt, **không** shrink chữ ở VI. Tiêu đề bảng **in đậm**.
- **Căn lề ô:** tiền → phải; tên LTTP/mặt hàng → trái; mọi ô khác (STT, ĐVT, số lượng, ngày, header, dấu "-") → giữa. Đoạn văn/nhãn mục ("I. KẾT QUẢ…", "Hôm nay…") → trái.
- **Số 0** ghi "-" và căn giữa.
- **Số không bao giờ** xuống dòng, bị cắt, hay hiện `###`: `wrap_text=False`, cột đủ rộng theo chuỗi dài nhất (cột tổng/thành tiền/chênh lệch rộng hơn cột SL); `shrink_to_fit` chỉ là dự phòng (không dùng ở VI).
- **Chữ** (tên, ĐVT, header) được wrap; hàng có chữ wrap **tự giãn chiều cao**.
- **Cột tên LTTP/mặt hàng là cột rộng nhất** bảng.
- **Chiều cao hàng:** dòng dữ liệu ~18–21pt; header/tiêu đề đủ cao để không che chữ (kể cả chữ xoay dọc); không kéo cao quá so với trang (chủ chê "quá cao"). Điều chỉnh theo phản hồi từng trang (xem mục 4–10).
- **Khung bảng:** xoá **hết** border/hình vẽ cũ của mẫu (mẫu ODS có kẻ chéo diagonal và draw:line gây 2 đường chéo lỗi) → dựng workbook sạch từ chữ từng ô → vẽ lưới **thin** 4 cạnh, **một độ dày duy nhất**, merge-aware (mỗi cạnh vẽ 1 lần). Cấm medium/double/hair/diagonal. Tiêu đề ngoài bảng **không border**.
- **Lề:** trái ≥ **1,5 cm** và **lớn hơn** lề phải (ví dụ L 1,5 / R 0,5 cm). Ngoại lệ **VI: L = 1 cm, R ≈ 0,25 cm** (nhỏ nhất có thể).
- **Khối ký** (tịnh kho và các trang có ký): QUẢN LÝ – TỔ KINH TẾ – CHỈ HUY ĐƠN VỊ (VII thêm QUÂN Y); tên theo mục 12. Tên trên mẫu là của bếp khác, phải thay.

## 3. Biên bản tịnh kho
- Cột: Tên LTTP–chất đốt | ĐVT | Giá lẻ | Còn theo sổ sách (SL, TT) | Thực kiểm kho (SL, TT) | Chênh lệch Thừa/Thiếu (SL, TT). II. Lý do thừa thiếu, ý kiến giải quyết.
- Còn theo sổ sách = tồn cuối ngày cuối tháng trên sổ (Cộng nhập − Cộng xuất); thành tiền theo **đơn giá cuối kỳ**.
- Thực kiểm kho, lý do, ý kiến: **chủ cung cấp**. Không có chênh lệch → ghi "Không có".
- 12pt, tự co cho vừa cột, cột tên rộng & wrap, hàng tối thiểu ~21pt, **vừa 1 trang**; lề phải nhỏ.
- Trả lại chủ các tổng số (tổng tiền tồn) sau khi dựng.

## 4. I. Phụ lục tiền ăn
- Tiêu đề có tiền tố **"I."** ("I. BÁO CÁO CÔNG KHAI SỬ DỤNG TIỀN ĂN…").
- Giữ đủ 8 mục THU, 6 mục CHI theo mẫu (đã sửa chính tả). (cần xác nhận: CHI 5 hay 6 mục — hiện giữ 6.)
- **Chỉ điền 6 mục từ sổ:** tiền ăn của khách; tiền ăn thừa tháng trước chuyển qua; tiền bù giá lương thực; tiền LTTP sử dụng trong tháng (= Σ xuất cho bộ đội ăn − chất đốt); tiền chất đốt sử dụng trong tháng; tiền ăn thiếu tháng trước chuyển qua. Bằng 0 → trống.
- Mọi mục khác **để trống**, cuối tháng hỏi chủ số liệu.
- Cộng thu/Cộng chi chỉ in khi mọi mục trong phần có số.
- Phần C "SO SÁNH THỪA THIẾU TRONG THÁNG": đủ số → 1 dòng "Thừa/Thiếu trong tháng: <số>"; thiếu số → in cả 2 dòng trống để viết tay.
- 12pt, 1 trang. Khối ký: (cần xác nhận).

## 5. II. Báo cáo lương thực (chỉ gạo)
- Tiêu đề "II. TIẾP NHẬN VÀ BẢO ĐẢM LƯƠNG THỰC" + dòng tháng; không phụ đề.
- **A. Phần có:** chỉ loại gạo có trong sổ (vd "Gạo tẻ thường"), không ghi ngày. Tồn tháng trước (SL, giá ngày 01); Nhận của trên ← cột Trên BĐ Mua TT; Tự khai thác ← Đơn vị BĐ Mua TT; TGSX ← cột TG-CB. Giá bình quân gia quyền.
- **B1. Bảo đảm ăn:** 1 dòng/mức gạo.
  - Tiêu chuẩn: quân số **chủ cung cấp** (trống đến khi có); ngày ăn = QS × số ngày tháng; thành gạo = ngày ăn × mức/1000.
  - Sử dụng tại bếp: QS = **max** trong tháng của mức đó; ngày ăn = Σ ngày (S×g_s + T×g_t + C×g_c)/mức_g, làm tròn 1 số lẻ; thành gạo = ngày ăn × mức/1000, **làm tròn xuống** 1 số lẻ. Thanh toán bằng tiền: trống.
- **B2. Khoản khác:** nhượng bán (hỏi chủ); khách (hỏi chủ từng ngày có khách); dòng "Chênh lệch do làm tròn" = Σ gạo xuất sổ − Σ thành gạo tại bếp, **chỉ in khi ≠ 0**.
- **B3. Tổng hợp:** tại bếp + nhượng bán + khách (+ chênh lệch). Dòng **Cộng** của bảng 2 và bảng 3 nằm **cùng một hàng** (chèn hàng trống bên bảng ngắn).
- **C:** "Số lượng: … Kg. Thành tiền: … đồng" (= tồn cuối/tịnh kho).
- Một hàng trống giữa A, B, C; hàng nội dung ~21pt; 1 trang.
- Kiểm tra: phần có − đã dùng = tồn tịnh kho.

## 6. III. Sử dụng thực phẩm – chất đốt
- Cột: STT | Tên | ĐVT | Tháng trước chuyển sang | Nhập (Trên cấp, Mua, TGSX, SX CB, Cộng) | Xuất (Ăn tại bếp, Trả không ăn, Cộng) — **bỏ cột Nhượng** | Thừa thiếu chuyển tháng sau | Ghi chú (**để trống**).
- Map cột sổ: Trên BĐ → Trên cấp; Đơn vị BĐ Mua TT → Mua; TG-CB → TGSX; Xuất ăn → Ăn tại bếp; tồn cuối tháng → chuyển sang (khớp tịnh kho). Trả không ăn: trống chờ chủ.
- **Phân nhóm:**
  - Thịt lợn nạc: thịt vai, nạc vai, thịt xay, thịt mông, giò nạc (giò lụa), sườn thăn, sườn thẻ, **chả quế**. (III không tách vai.)
  - Thịt bò loại 1,2: bò L2, L3. Cá (tôm): gồm chả cá. Gia cầm N1 gà ta L1, N2 gà công nghiệp.
  - Rau **Nhóm 1** = không tinh bột (rau lá, quả làm rau: dưa chuột, bí xanh, cà chua…, lá khoai lang, đậu cove); **Nhóm 2** = có tinh bột (khoai tây, khoai lang củ, sắn, khoai môn, ngô, đậu Hà Lan, bí đỏ, hạt sen…). Mặt hàng biên mặc định N1, phân vân thì hỏi.
  - Sữa hộp 180 ml → Sữa tươi, lít = hộp × 0,18.
  - **Gia vị** (tiêu, ớt bột, hành khô, tỏi, gia vị khác), **Vệ sinh**, **Chất đốt → dòng "+ Điện"**: tính **tiền**, ĐVT **1.000đ** (= đồng ÷ 1000). Gia vị tồn cuối dùng **đơn giá cuối kỳ**.
  - **Chanh loại trừ**; mặt hàng không thuộc nhóm (bột mỳ, lòng gà…) không đưa vào.
- Gạo 1 số lẻ, khớp II. Ô SL và "-" căn giữa.

## 7. IV. Kết quả tự túc thực phẩm
- Nguồn: TGSX,CB = cột H+J (Trên BĐ TG-CB + Đơn vị BĐ TG-CB); Mua TT = G+I. Đơn giá = bình quân gia quyền từng phần.
- Công thức: (3)=(4)+(5); (6)=(4)/(3) %; (9)=(4)×(7); (10)=(5)×(8); **(11)=((8)−(7))×(4)**. Dòng TỔNG cộng (9)(10)(11).
- Nhóm như III, **khác**: dòng riêng Giò chả (giò lụa), Giá đỗ, Rau củ quả muối nén (dưa chua), Sườn thẻ; giữ **Thịt xô lọc**; **thịt vai = ½ nạc + ½ xô lọc** (chỉ IV và V); chả quế → nạc; thêm dòng Hoa quả (dưa hấu, chuối; không chanh), Sữa tươi (lít), Đường, Vừng lạc, Mỳ chính, Gia vị (1.000đ, đơn giá/CL "-", thành tiền bằng đồng). **Không có gạo**, bỏ dòng Củi. Bột mỳ, lòng gà: không cần.
- Làm tròn khi chia ½ vai: (cần xác nhận — nạc + xô lọc có thể lệch 0,1 kg so với tổng vai).
- Bố cục đã chốt: cột TT rộng hơn mặc định (đã nới +50%), lề hai bên hẹp (L ≥1,5 cm), hàng ~1,7× bình thường, dòng header thứ 2 đủ cao, vẫn 1 trang.

## 8. V.1, V.2 – Kết quả bảo đảm định lượng (mỗi mức ăn 1 trang)
- Đánh số **V.1, V.2…** theo mức (vd V.1 = mức thấp, V.2 = mức cao). Mỗi dòng một ngày, cuối dòng **BQ**.
- **Quân số lấy hằng ngày** theo mức: QS ngày = 0,2·S + 0,4·T + 0,4·C (từ khối công khai).
- **Chỉ LTTP có xuất ăn trong ngày mới có định lượng**; ngày QS=0 → "-" ở quân số, ĐL trống.
- **Cân đối:** phân bổ lượng thực xuất trong ngày giữa các mức sao cho **BQ cuối tháng ≥ định lượng quy định** của từng mức (ưu tiên đủ ĐL từng mức, phần còn lại trải theo xuất × QS). Tổng phân bổ không vượt lượng xuất thực. **Không bịa số** khi xuất không đủ → báo thiếu.
- Gạo, chất đốt: ghi đúng ĐL quy định. Sữa: theo đối tượng được cấp (đơn vị mẫu: chỉ mức cao, (hộp − bệnh nhân)×180/QS). Thịt vai ½ nạc ½ xô lọc (khớp IV).
- **BQ** = Σ ĐL các ngày có QS ÷ **số ngày có quân số** (không ÷ số ngày tháng).
- **Đường:** ghi theo xuất thực (không có ĐL quy định).
- **Nhiệt lượng chuẩn (đã biết):** mức **72.000 = 3200** kcal; mức **130.000 = 3500** kcal. **Mức ăn khác → hỏi chủ** trước, không tự suy (cũng ghi ở `07_dinh_luong_muc_an.md`).
- **Cột Nhiệt lượng IN trên V.n (chủ 05/11/2026):** mỗi ngày có QS ghi số **≥ chuẩn** và **gần chuẩn** (chuẩn hoặc hơi trên một chút); **không** hiện thừa lớn; **không đổi ĐL LTTP**. Công thức in: `actual = Σ(ĐL_g × kcal/100g)/100` (FCT VN 2007; N1+N2; không chất đốt); `printed = std` nếu actual < std, else `printed = std + min(80, round((actual−std)×0.05))`. BQ = trung bình các ngày có QS của số *printed*. Kcal thực (actual) chỉ lưu nội bộ/JSON đối chiếu.
- **Việc hằng ngày:** sau mỗi ngày tính lại ĐL ngày + BQ lũy kế, **báo chủ các loại chưa đạt** (tên, BQ hiện tại / chuẩn, từng mức) để chủ cân đối.
- Bố cục: dựng workbook sạch (không copy style/shape ODS), header đủ cao cho chữ dọc, hàng dữ liệu đã tăng gấp đôi theo chủ, vẫn 1 trang/mức.

## 9. VI. Trang bị, dụng cụ cấp dưỡng
- Số liệu do **chủ cung cấp** (ảnh/bảng); chép đúng, chỗ lệch logic (vd tồn ≠ còn lại mà không có tăng/giảm) thì báo chủ, không tự sửa.
- Cột: Mặt hàng | ĐVT | Tồn tháng trước | Tăng | Giảm | Còn lại (mỗi nhóm: Tổng + phân hạng) | Chênh lệch Thừa/Thiếu | Lý do tăng giảm. **Bỏ hạng 1**, chỉ giữ hạng 2, 3, 4. Còn lại = tồn + tăng − giảm.
- Cột Thừa, Thiếu, đặc biệt **Lý do tăng giảm** phải rộng (để ghi sau); tên mặt hàng một dòng; chữ "Tổng" không xuống dòng.
- 11pt không shrink; lề L 1 cm, R ~0,25 cm; hàng cao vừa phải (+30% so với mặc định), không kéo cho kín trang; không `###`.

## 10. VII. Nhận xét của tổ kinh tế (Word → PDF)
- Làm bằng **Word (.docx)** rồi xuất PDF. A4, 12pt, lề trái ≥1,5 cm > phải.
- Tiêu đề căn giữa; thân **căn đều hai lề (Justify)**; **không căn giữa theo chiều dọc** (bắt đầu từ đầu trang).
- Mục 1–4 giữ lời mẫu; dưới mỗi mục có các dòng chấm "……" để chủ viết tay.
- Câu kết: "Báo cáo công khai ăn uống tại bếp <tên bếp> tháng MM năm YYYY, Tổ kinh tế đã biểu quyết thông qua vào hồi … giờ … ngày …" — **giờ/ngày hỏi chủ**, chưa có thì để chấm.
- Ký: TỔ KINH TẾ, QUÂN Y, QUẢN LÝ, CHỈ HUY ĐƠN VỊ. Dòng "Ngày … tháng … năm …" nằm ngang **ngay trên QUẢN LÝ**. Chỗ ký của **chỉ huy đơn vị phải rộng** (đã nới ~3,5 cm). Ngày ký, tên người ký: hỏi chủ mỗi tháng.

## 11. Hỏi chủ mỗi tháng (để trống đến khi có)
- Thực kiểm kho, lý do thừa thiếu, ý kiến giải quyết (tịnh kho).
- Phụ lục I: mọi mục ngoài 6 mục lấy từ sổ.
- II: quân số tiêu chuẩn từng mức; nhượng bán; gạo của khách (theo ngày).
- III: trả không ăn.
- VI: toàn bộ số trang bị/dụng cụ.
- VII: giờ/ngày biểu quyết, ngày ký, tên người ký nếu thay đổi.
- Hằng ngày: loại LTTP chưa đạt định lượng (V).

## 12. Ghép sổ và kiểm tra
1. Dựng/cập nhật từng phụ lục → PDF; render PNG và soát từng trang.
2. Ghép theo thứ tự mục 1 vào sau trang ngày cuối cùng (vd `pypdf`/`pdfunite`) thành `1. Sổ nhập xuất LTTP.pdf` của tháng; tất cả A4 dọc.
3. Kiểm tra: số trang = trang ngày + 1 + 1 + 1 + 1 + 1 + số mức + 1 + 1 (vd T10/2026: 125 + 9 = 134); `pdfinfo` khổ A4; tịnh kho = tồn II/III; Σ III khớp sổ; IV TỔNG khớp; ghi MD5.
4. File Excel/Word giữ ở máy trợ lý; chỉ PDF ghép chép sang máy chủ (khi máy online).

## 13. Cấu hình đơn vị (VÍ DỤ – bếp Tiểu đoàn KTHCSB, tháng 10/2026; thay theo bếp của bạn)
- Tên bếp: Tiểu đoàn KTHCSB.
- Người ký: Quản lý 1//CN Nguyễn Văn Khánh; Tổ kinh tế 2// Phùng Anh Nghĩa; Quân y 1//CN Nguyễn Ngọc Tuấn; Chỉ huy đơn vị 2// Nguyễn Minh Tuấn.
- Mức ăn: 72.000 đ (HSQ-CS bộ binh; gạo 680 g = S140/T270/C270; tiền S14.400/T28.800/C28.800) và 130.000 đ (cơ vụ sân bay; gạo 700 g = S140/T280/C280). Kcal chuẩn 3.200 / 3.500. Chất đốt 2.200 đ/người/ngày (20/40/40).
- Cột sổ ngày: G Trên BĐ Mua TT, H Trên BĐ TG-CB, I Đơn vị BĐ Mua TT, J Đơn vị BĐ TG-CB, N gạo/xuất ăn.
- Script tham khảo: `Tháng 10-2026/{tinh_kho/build_tk.py, phu_luc/build_pl.py, bc_luong_thuc/build_bclt.py, bc_thuc_pham/build_bctp.py, bc_tu_tuc/build_bctt.py, bc_dinh_luong/build_bcdl.py, bc_trang_bi/build_bctb.py, nhan_xet/build_nhanxet.py}`, helper `_layout_helpers.py`, `/workspace/align_rule.py`.

## Nhật ký
- 05/11/2026: tạo file từ buổi làm việc tháng 10/2026.
- 05/11/2026 (bổ sung): cột Nhiệt lượng V.n in gần chuẩn (≥3200/≥3500); mức khác hỏi chủ; không đổi ĐL.

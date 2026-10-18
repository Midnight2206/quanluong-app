# Nghiệp vụ chung (baseline) — sổ sách bếp ăn
Phiên bản **2026-10-17b**. Nguồn: đơn vị gốc (Bếp Tiểu đoàn KTHCSB), tháng 10/2026 + tài liệu chuẩn chủ gửi 17/10/2026 (giáo trình *Nghiệp vụ quân lương ở bếp ăn*, dẫn **HD 755/HD-QN 03/8/2011** của Cục Quân nhu + điều chỉnh văn kiện quân nhu 10/2016). **Độ tin cậy:** `XN-1` = đã xác nhận tại 1 đơn vị (tất cả quy tắc dưới đây đang ở mức này trừ khi ghi khác); `SUY` = suy luận, chưa xác nhận; **`TL`** = có trong tài liệu chuẩn → quy định toàn quân, **giả định chung cho mọi đơn vị** (đơn vị vẫn đánh dấu Giống/Khác vì được tự làm sổ theo mẫu); `TL⚠` = tài liệu chuẩn nói khác thực hành của đơn vị gốc. Tham chiếu `Đ n` / `B n` = đoạn / bảng trong tài liệu chuẩn.

## A. Danh mục sổ (CHUNG-01 … 08)
| ID | Sổ | Tần suất | Hiện trạng ở đơn vị gốc | Tin cậy |
|---|---|---|---|---|
| CHUNG-01 | Sổ nhập xuất LTTP & công khai tài chính (bìa lót + file ngày; phần cuối tháng xem H) | Hằng ngày, gộp PDF tháng | Có mẫu + quy trình | XN-1 · **TL** mẫu 17 NX-KH/QN 17 (Đ768) |
| CHUNG-02 | Sổ thực đơn tuần (+ kế hoạch bảo đảm thực phẩm tuần) | Hằng tuần (đơn vị gốc: chiều CN cho tuần sau) | Có quy tắc, chưa có mẫu | XN-1 · **TL** mẫu 18 TĐ-KH/QN 17 (Đ1111) |
| CHUNG-03 | Sổ theo dõi LTTP tại bếp | ? | Chưa có mẫu | SUY · **không có trong danh mục TL** (có thể là RIENG) |
| CHUNG-04 | Phiếu nhập kho | Theo phiếu | Chưa làm | **TL** mẫu 22 PNX-KH/QN17 (B17) |
| CHUNG-05 | Phiếu xuất kho (tải PDF từ Quân lương, 3 phiếu/ngày) | Hằng ngày | Đã tải, chưa gộp | XN-1 · **TL** mẫu 22 (B18) |
| CHUNG-06 | Sổ chấm cơm | Hằng ngày | Có mẫu cũ, chưa làm | **TL** (B14; xem CHUNG-90) |
| CHUNG-07 | Nhật ký vận hành bếp điện (≈ nhật ký vận hành nồi hơi) | Hằng ngày, theo ca | Chưa có | **TL** mẫu 21 NK-KT/QN 17 cho nồi hơi (B16); bếp điện = SUY |
| CHUNG-08 | Sổ theo dõi bàn giao DCCD | Hằng ngày, giữa các ca trực | Chưa có | **TL** mẫu 20 TD-KH/QN 17 (B15; xem CHUNG-91) |
| CHUNG-09 | Sổ nhật ký tài chính | ? | Chưa thấy ở đơn vị gốc | **TL** (chỉ có tên trong danh mục, Đ754) |

## B. Dữ liệu đầu vào (CHUNG-10 …)
- **CHUNG-10** Quân số ngày mai hỏi lúc 18h00: 6 số = mức 1 (sáng, trưa, chiều) + mức 2 (sáng, trưa, chiều); chấp nhận "như hôm nay". (XN-1; TL: quân số theo từng bữa, từng mức là căn cứ thu/xuất — Đ802; xem CHUNG-16)
- **CHUNG-11** Suất ăn thêm: bệnh xá, bệnh nhân, ốm tại trại, lễ tết — có đơn giá riêng, **không** tính vào gạo/gia vị/chất đốt. (XN-1; **TL** loại ăn thêm: lễ tết, bồi dưỡng, ốm, bệnh nhân… Đ217, 242, 896; phần "không tính gạo/gia vị" là của đơn vị)
- **CHUNG-12** Hàng đơn vị tự bảo đảm (mua TT / TGSX) hỏi lúc 8h00.
- **CHUNG-13** Nhập Trên BĐ lấy từ Quân lương (Phiếu nhập kho › Tổng hợp, nhóm "Trên BĐ"), chỉ xem/tải, không sửa. (XN-1; **TL** cột "Trên cấp" = hàng cấp trên cấp xuống, Đ789; tiếp nhận căn cứ phiếu, Đ464–465)
- **CHUNG-14** Đơn giá theo bảng giá hiệu lực theo ngày của đơn vị (`/api/lttp/prices/effective`). (XN-1; **TL** giá lẻ theo hiệp đồng/phiếu, Đ1232)
- **CHUNG-15** Ngày 01 lấy tịnh kho tháng trước (tên, ĐVT, đơn giá, SL, tiền, nguồn) + thừa/thiếu tiền tháng trước. (XN-1 · **TL** Đ1034, 897)
- **CHUNG-16** *(mới, TL)* Quân số ghi sổ là **quân số ăn thực tế** từng bữa, lấy từ sổ chấm cơm / sổ báo cắt cơm (Đ274, 1048, 1319). Đơn vị gốc dùng số dự kiến báo 18h hôm trước → cần hỏi.
- **CHUNG-17** *(mới, TL)* Tiếp nhận theo phiếu nhập/xuất kho; cân đong đo đếm; **giao nhận tay ba** (thủ kho – nuôi quân – trực ban); **kiểm thực 3 bước** (nhập kho, xuất kho, trước khi ăn) + lưu nghiệm thức ăn mỗi bữa; hàng kém chất lượng: từ chối hoặc nhận có điều kiện + biên bản (Đ352–353, 429–430, 488, 496).

## C. Sổ nhập xuất LTTP — 13 bước (CHUNG-20 … 32)
- **CHUNG-20** Chép mẫu ngày → `cktc_DD`; ghi "Ngày dd tháng mm năm yyyy".
- **CHUNG-21** Tồn đầu (B–F) = tồn cuối hôm trước. (XN-1 · **TL** "Ngày trước còn lại" = Cộng nhập − Cộng xuất hôm trước, Đ787)
- **CHUNG-22** Nhập G/H = Trên BĐ (Mua TT/TGSX), I/J = Đơn vị BĐ (Mua TT/TGSX); gộp dòng chỉ khi trùng **tên và đơn giá**. (XN-1; **TL** mẫu chuẩn 3 cột Trên cấp / Mua / T.Gia, Đ789 — 4 cột là biến thể; một dòng một giá lẻ chung cho nhập và xuất, Đ783)
- **CHUNG-23** K=(G+H+I+J)×D; L=E+nhập; M=F+K. (XN-1 · **TL** Đ790–791: Cộng nhập = ngày trước còn lại + nhập trong ngày)
- **CHUNG-24** Xuất ăn N/O (TL: "Xuất cho bộ đội ăn" = dùng chế biến, nấu ăn trong ngày, Đ794): hàng tươi = nhập trong ngày; gạo = Σ quân số × g/bữa; gia vị, chất đốt theo suất; sữa theo đối tượng.
- **CHUNG-25** Xuất theo **FIFO** (lô cũ trước), mỗi lô giá một dòng. (XN-1; TL không quy định FIFO; báo cáo tháng dùng giá bình quân gia quyền cho gạo, Đ948)
- **CHUNG-26** Xuất khác P/Q khi chủ chỉ định; R=N+P, S=O+Q; tồn cuối = L−R / M−S → ngày sau. (XN-1 · **TL** Đ793–795: "Các khoản khác" = xuất nhưng **không dùng nấu ăn cho bộ đội**)
- **CHUNG-27** Sắp âm kho: báo ngày bắt đầu âm + số đề nghị (làm tròn: lít/kg theo 1; tiêu/ớt/hành/tỏi 0,5 kg; chất đốt 100.000 đ); nhập vào cột I đúng ngày khi chủ cho phép. (XN-1; **TL⚠** "nhập trong ngày" = hàng nhập mới trong ngày, phiếu có ngày giao nhận, Đ788, 1236 → ghi lùi ngày cần hỏi)
- **CHUNG-28** Khối công khai tài chính (xem E). (XN-1 · **TL** Đ796–826, B2)
- **CHUNG-29** Cân đối chênh lệch ngày (xem E).
- **CHUNG-30** Chủ xác nhận → chốt ngày, xoá dòng trống. (XN-1; **TL** ký Quản lý đơn vị – Trực ban – Chỉ huy đơn vị, đóng dấu, Đ844 — xem CHUNG-35)
- **CHUNG-31** Xuất PDF, gộp bìa + các ngày, chép đè PDF sổ trên máy chủ.
- **CHUNG-32** Chốt tháng: tồn cuối = tịnh kho, thừa/thiếu chuyển tháng sau; thư mục → "Đã hoàn thành". (XN-1; **TL** đầy đủ hơn: biên bản tịnh kho + báo cáo tháng, xem H)
- **CHUNG-33** *(mới, TL)* Thứ tự dòng: vật phẩm dùng thường xuyên ghi trước, không thường xuyên ghi sau; **giữ nguyên thứ tự giữa các trang/ngày** (Đ781).
- **CHUNG-34** *(mới, TL)* Khối công khai có **Phần gạo (kg)**: thu = Σ QS bữa × tiêu chuẩn gạo bữa + gạo của khách + thừa hôm trước; chi = gạo đã xuất ăn + thiếu hôm trước; thừa/thiếu gạo chuyển ngày sau (Đ827–843, B2). Đơn vị gốc không có khối này.
- **CHUNG-35** *(mới, TL)* Hạn: **sau khi xuất ăn bữa chiều** phải ghi, cộng sổ, xác định số chuyển hôm sau, công khai lên bảng, báo cáo chỉ huy; cuối bảng ngày ký Quản lý đơn vị – Trực ban – Chỉ huy đơn vị (đóng dấu) (Đ844–845).
- **CHUNG-36** *(mới, TL)* Nguồn nhập trong ngày: **trên cấp / mua / tăng gia sản xuất (+ sản xuất chế biến)**; thành tiền nhập = giá lẻ × tổng SL các nguồn (Đ789–790, B7). Đơn vị map cột của mình về 3–4 nguồn chuẩn này.

## D. Định lượng (CHUNG-40 …)
- **CHUNG-40** Mức ăn: 72.000 = 14.400/28.800/28.800; 130.000 = 14.400/86.800/28.800. (XN-1; **TL** cơ cấu chuẩn ví dụ **2/4/4**, Đ807 — mức 72k khớp; giá trị mức là tham số theo đối tượng/thời kỳ)
- **CHUNG-41** Gạo/bữa: mức 72k 140/270/270 g; mức 130k 140/280/280 g. (XN-1; **TL⚠** 6 mức chuẩn 770/750/720/700/650/600 g/người/ngày — 700 g ✔, **680 g không có trong danh sách**, Đ229)
- **CHUNG-42** Suất quy đổi = 20% sáng + 40% trưa + 40% chiều. (XN-1; TL 2/4/4 cho tiền ăn, Đ807; áp cho gia vị/chất đốt là của đơn vị)
- **CHUNG-43** Chất đốt = suất × 2.200 đ; nguồn Đơn vị BĐ–Mua TT; ô SL ghi "–".
- **CHUNG-44** Gia vị (theo suất, làm tròn 1 chữ số): dầu 1 l/25; mắm 1 l/20; đường 1 kg/200; mỳ chính 1 kg/250; tiêu, ớt 0,1 kg/40; muối 1 kg/80; hành, tỏi khô 0,4 kg/ngày; bột nghệ không hằng ngày.
- **CHUNG-45** Sữa 180 ml: 1 hộp/người/ngày cho bệnh nhân và mức 130k.
- **CHUNG-46** *(mới, TL)* Mức tiền ăn, lương thực, định lượng do BQP ban hành theo **đối tượng** (bộ binh, quân binh chủng, bệnh nhân…); Cục QN/Cục TC điều chỉnh khi giá tăng ≥ 10% và hướng dẫn hằng năm → mọi tham số mức phải có **ngày hiệu lực** (Đ208, 223, 229). Người hưởng lương ăn mức nào nộp mức đó (Đ215).
- **CHUNG-47** *(mới, TL)* Ăn thêm lễ, tết = **1 ngày tiền ăn cơ bản HSQ-CS bộ binh**; ngày cho HSQ-CS: 01/01, 5 ngày Tết, 10/3 âm lịch, 30/4, 01/5, 02/9, 22/12; người hưởng lương: 2 ngày Tết, 10/3 âm lịch, 30/4, 02/9, 22/12 (Đ218–220).

## E. Tài chính & cân đối (CHUNG-50 …)
- **CHUNG-50** Thu = Σ quân số × đơn giá bữa + ăn thêm + thừa hôm trước + bù giá gạo (giá xuất > giá quy định) + thu khác. (XN-1 · **TL** Đ801–817: các mức + truy lĩnh + thu của khách + thừa hôm trước + ăn thêm; bù giá gạo, ăn ốm có trên bảng công khai B19)
- **CHUNG-51** Chi = Σ tiền xuất (cột S) + thiếu hôm trước; ra Thừa/Thiếu trong ngày, chuyển sang hôm sau. (XN-1; **TL⚠** "Tiền đã sử dụng" = Σ cột **Xuất cho bộ đội ăn** (O), không gồm Các khoản khác — Đ820, 909; phần chuyển thừa/thiếu: **TL** Đ825–826)
- **CHUNG-52** Chênh lệch ngày < 20.000 đ. (XN-1; TL không có ngưỡng — chỉ yêu cầu chi đúng, đủ từng ngày, Đ1348)
- **CHUNG-53** Thừa nhiều → nhập–xuất trong ngày 2–3 món bù (bò, gà, sườn, tôm, mực; kèm hành tây/cần tây/ớt xào khi bò/mực). ⚠ thực hành "làm đẹp sổ", xen kẽ thừa/thiếu — cần hỏi kỹ. (**TL⚠** ghi chép đầy đủ, chính xác; mọi khoản chi có chứng từ hợp lệ; trung thực — Đ750, 1348, 1438 → **không đưa vào app như quy tắc**, chỉ ghi nhận)
- **CHUNG-54** *(mới, TL)* Tiền đã sử dụng trong ngày = Σ tiền cột Xuất cho bộ đội ăn (Đ820). Xuất khác (nhượng, khách…) theo dõi riêng; bảng công khai có dòng "chi khác" (B19).
- **CHUNG-55** *(mới, TL)* Bù giá gạo: khi giá gạo thực hiện > giá quyết toán do Cục QN quy định, phần chênh của HSQ-CS quyết toán với trên, người hưởng lương (cả khách) nộp; mua thấp hơn → phần chênh bổ sung tiền mua thực phẩm (Đ228, 899–905).
- **CHUNG-56** *(mới, TL)* Định nghĩa khoản thu: **Truy lĩnh** = tiền ăn được hưởng chưa dùng nay đưa vào bữa ăn; **Thu của khách**; **Thừa hôm trước**; **Ăn thêm** = ngoài tiêu chuẩn (quỹ đơn vị, lễ tết…) (Đ813–816).
- **CHUNG-57** *(mới, TL)* Kiểm quỹ tiền mặt hằng ngày, đối chiếu sổ; mất mát, hư hỏng không lý do chính đáng bồi thường 100% (Đ1341, 1348, 1360).

## F. Thực đơn tuần (CHUNG-60 …)
- **CHUNG-60** Đăng ký chiều CN cho tuần sau; chọn món từ bộ thực đơn mẫu. (XN-1; **TL** tuần trên mẫu = **Thứ Hai → Chủ nhật**, B12–B13; giờ đăng ký là của đơn vị)
- **CHUNG-61** Mỗi mức ăn một thực đơn; ghi tên món + định lượng thực phẩm chính mỗi bữa. (XN-1; **TL** một bảng cho 1 đối tượng, hoặc 2–3 đối tượng nếu không khác nhau nhiều, Đ1123)
- **CHUNG-62** Trừ tiền gạo trước; thành tiền bữa lệch ≤ ±5% tiền ăn bữa. (XN-1; **TL** tiền mua thực phẩm = tiền ăn − tiền gạo − **tiền chất đốt**, Đ423; ±5% là của đơn vị)
- **CHUNG-63** TB nhóm thực phẩm trong tuần sát tiêu chuẩn (ngưỡng chưa rõ). (**TL** nhóm theo bảng định lượng tháng B8: gạo, thịt xô lọc, thịt nạc, bò, gia cầm, cá tôm quy tươi, trứng, đậu phụ, dầu mỡ, vừng lạc, đậu hạt, rau củ quả, nước mắm, hoa quả, đường, sữa, chất đốt + nhiệt lượng)
- **CHUNG-64** Quy tắc món: sáng chỉ heo & trứng; bò ~50 g/người/bữa; heo ≥ 65 g; 1 trứng/người; không trứng luộc.
- **CHUNG-65** Thực đơn phải khớp hàng đã xuất ở sổ nhập xuất (SUY từ yêu cầu gia vị kèm món). (**TL** không tự ý đổi thực đơn; đổi vì thiếu TP → báo chỉ huy + công khai, thay TP giá trị tương đương — Đ350, 419, 427)
- **CHUNG-66** *(mới, TL)* Thực đơn do **kế toán nhà ăn lập**, bếp trưởng góp ý; báo cáo **chỉ huy nhà ăn và quân nhu cấp trên thông qua** trước khi thực hiện; sổ có chữ ký người làm thực đơn + **chỉ huy đơn vị (ký, đóng dấu)**; sau duyệt ghi lên bảng thực đơn (Đ376, 415, 427, 1127, 1300).
- **CHUNG-67** *(mới, TL)* **Kế hoạch bảo đảm thực phẩm tuần** (mẫu 18, liền sau thực đơn): quân số + mức tiền ăn từng mức; Nhu cầu / Hiện có / **Bổ sung = Nhu cầu − Hiện có** (SL, tiền), chia Thứ 2 → CN; nguồn I. Trên bảo đảm, II. Đơn vị tự khai thác (mua sản phẩm tăng gia, SXCB) (B13, Đ1129–1139).
- **CHUNG-68** *(mới, TL)* Các bước xây dựng thực đơn: xác định số món từng bữa → chọn món theo chủng loại TP quy định → sắp xếp **tránh trùng lặp** → ghi sổ → báo cáo thông qua; rút kinh nghiệm sau mỗi ngày/kỳ (Đ408–415, 435).

## G. Bố cục & in (CHUNG-70 …)
- **CHUNG-70** Font Times New Roman; giữ nguyên lề, cỡ chữ, khổ giấy của mẫu.
- **CHUNG-71** Sổ nhập xuất: A4 dọc, 2 tờ ghép = 1 trang (A–K | L–U), lề T/P 1,1 cm, tỉ lệ 97%, lặp tiêu đề.
- **CHUNG-72** Cộng sang trang / Mang sang: đậm nghiêng, chỉ cộng cột tiền; sau ngắt còn ≥ 2 dòng hàng.
- **CHUNG-73** Số kiểu VN ("," thập phân, "." nghìn); ô 0 để trống; SL căn giữa, tiền căn phải.
- **CHUNG-74** In 2 mặt liên tục, không chèn trang trắng sau bìa; mỗi sổ 1 PDF gộp trên máy chủ.
- **CHUNG-75** Bìa lót: mỗi tháng chỉ đổi dòng "Ngày 01 tháng MM năm YYYY".

## H. Cuối tháng & báo cáo (CHUNG-80 …) — *mới, TL*
- **CHUNG-80** **Biên bản tịnh kho cuối tháng** sau bữa chiều ngày cuối tháng: tổ kinh tế + quản lý cân đong thực tế; cột Còn theo sổ sách · Thực kiểm kho · Chênh lệch Thừa/Thiếu (SL, tiền) · Lý do và ý kiến giải quyết; ký Quản lý – Tổ kinh tế – Chỉ huy đơn vị (Đ847–867, B3).
- **CHUNG-81** Báo cáo công khai tháng — **I. Sử dụng tiền ăn**: thu (tiêu chuẩn HSQ-CS = QS × tiêu chuẩn × số ngày; người hưởng lương; khách; trích quỹ TGSX; bồi dưỡng; thừa tháng trước; thừa tịnh kho/bồi thường; bù giá lương thực) − chi (LTTP = Σ xuất ăn − chất đốt; chất đốt; **trả tiền không ăn**; thiếu tháng trước; thiếu tịnh kho; trả bù giá cho HSQ-CS không ăn) → thừa/thiếu tháng (B4, Đ881–935).
- **CHUNG-82** **II. Tiếp nhận & bảo đảm lương thực**: phần có theo nguồn/đợt + **giá bình quân gia quyền**; đã sử dụng: tiêu chuẩn (QS, ngày ăn = QS × số ngày, thành gạo) vs thực tế (sử dụng tại bếp = Σ QS ăn từng ngày × mức; thanh toán bằng tiền cho người không ăn); khoản khác (nhượng, khách); thực tồn chuyển tháng sau (B5–B6, Đ936–1020).
- **CHUNG-83** **III. Sử dụng thực phẩm, chất đốt**: bảng 1 nhập–xuất–tồn tháng theo nhóm TP (nhập: trên cấp, mua, TGSX, SXCB; xuất: ăn tại bếp, trả không ăn, nhượng); bảng 2 **định lượng bảo đảm g/người/ngày** = khối lượng bảo đảm ngày ÷ QS ăn, mỗi trang một mức ăn, + **nhiệt lượng** Σ(định lượng × kcal/g), dòng BQ tháng; bảng 3 sản phẩm TGSX/chế biến (giá lẻ do chỉ huy duyệt) (B7–B9, Đ1021–1076).
- **CHUNG-84** **IV. Tình hình DCCD**: tồn tháng trước, tăng, giảm, còn lại (theo hạng 1–4), chênh lệch sổ/kiểm kê, lý do (B10).
- **CHUNG-85** **V. Nhận xét tổ kinh tế** (định lượng, tài chính, vệ sinh, quân số khoẻ, việc đã giải quyết, kiến nghị); tổ kinh tế biểu quyết; ký Quản lý – Tổ kinh tế – Quân y – Chỉ huy; đọc tại **hội nghị dân chủ kinh tế tháng** (B11, Đ360).

## I. Sổ khác, chứng từ, bảng biểu (CHUNG-90 …) — *mới, TL*
- **CHUNG-90** Sổ chấm cơm: họ tên, cấp bậc; ngày 1–31 × S/T/C; **cách 1** chấm người ăn (X) cho bếp nhỏ, **cách 2** chấm người không ăn (0) cho bếp đại đội/tiểu đoàn; tổng → quân số ăn (B14, Đ1153–1157). ⚠ Có tên người — hồ sơ BA chỉ ghi cách làm, không chép danh sách.
- **CHUNG-91** Sổ bàn giao DCCD hằng ngày giữa ca: tổ giao/nhận; SL theo sổ (= tồn theo sổ hôm trước); thực tế bàn giao theo hạng; thừa/thiếu (tổ giao giải quyết trước khi giao); nhập trong ngày; tồn theo sổ = thực tế bàn giao + nhập trong ngày (B15, Đ1169–1183).
- **CHUNG-92** Nhật ký vận hành nồi hơi/bếp: mỗi ngày 1 trang (QS ăn, nhiên liệu); ca S/T/C: giờ, tình trạng thiết bị, mức nước, nhiên liệu tiêu hao, ký giao/nhận; người phụ trách ký; A4 ngang, đóng theo tháng (B16, Đ1189–1206).
- **CHUNG-93** Phiếu nhập kho: số, kho nhận, hạn hiệu lực, nhập của… theo lệnh…, vận chuyển; SL phải nhập / **thực nhập (thủ kho ghi)**, giá lẻ, thành tiền; tổng mặt hàng, tổng tiền; ngày giao nhận, ngày lập; ký người viết – người giao – người nhận – **người duyệt** (B17, Đ1223–1238).
- **CHUNG-94** Phiếu xuất kho: quyển số, số, người nhận, đơn vị, lý do, kho; SL phải xuất / thực xuất; tổng tiền bằng chữ; ký người viết – người nhận – thủ kho – người duyệt (B18, Đ1239–1252).
- **CHUNG-95** Bảng biểu tại nhà ăn: **Bảng tài chính công khai** (ghi hằng ngày sau bữa chiều; TGSX-CB vs mua thị trường, tiền chênh lệch, khối tiền ăn thu/chi/so sánh; 1,4×2 m), **Bảng thực đơn tuần** (theo sổ đã duyệt; 1,4×2 m), **Bảng phân công lao động & quân số ăn** (quân số + số mâm theo mức, theo đơn vị; 1×1,2 m); 4 biểu: chức trách, 10 nguyên tắc vàng ATTP, nội quy, quy trình vận hành bếp lò hơi (Đ1254–1321, B19–B21).
- **CHUNG-96** Nguyên tắc chung: mọi nhập–xuất, thu–chi ghi **đầy đủ, kịp thời, chính xác, đúng quy định**; chứng từ lưu giữ, bảo mật (Đ499, 750).

## Nhật ký thay đổi
- 2026-10-17b: đối chiếu tài liệu chuẩn (giáo trình *Nghiệp vụ quân lương ở bếp ăn*, HD 755/HD-QN 2011 + điều chỉnh 10/2016). Thêm mức tin cậy `TL`/`TL⚠`; gắn TL cho CHUNG-01, 02, 04–08, 10, 11, 13–15, 21–28, 30, 32, 40–42, 50–53, 60–63, 65; TL⚠ ở CHUNG-27 (ghi lùi ngày nhập), 41 (680 g), 51 (Σ S vs Σ O), 53 (làm đẹp sổ). Thêm mới CHUNG-09, 16, 17, 33–36, 46, 47, 54–57, 66–68, nhóm H (80–85), nhóm I (90–96). Không đánh số lại.
- trước 2026-10-17: bản đầu (đơn vị gốc).


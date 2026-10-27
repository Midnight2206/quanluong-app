# Review sổ sách bếp ăn — 27/10/2026

Đối chiếu tài liệu yêu cầu v0.5 (125 mã YC-NT, IN, SL, DL, UI, TR, DV, NL, AI, NF; khoảng trống G-01..G-22; backlog BL-01..BL-03) với mã đang chạy.

Người review không sửa mã ứng dụng và không mở pull request. Máy của chủ đang ở đúng `cursor/so-trang-ngay-khung-e6be` commit `b30e442`, khớp remote. Không có diff nguồn chưa commit cần đọc thêm (chỉ ghi chú `.superpowers/sdd`, `.DS_Store`, file `.env` / `.tmp` / `.venv` không theo dõi).

## 1. Phạm vi đã đọc

| Nhánh | Commit | Vai trò |
|---|---|---|
| `cursor/so-trang-ngay-khung-e6be` (PR #17) | `b30e442` | Sổ đang chạy trên máy chủ. Mọi dòng `file:dòng` bên dưới là nhánh này, trừ khi ghi nhánh khác. |
| `cursor/dsh-ai-platform-860c` (PR #18) | `60bc8d0` | Dịch vụ DSH và cổng AI. Cùng gốc `main` `d50c282`. |
| `cursor/anthropic-skills-mcp-c317` (PR #19) | `2e4106a` | Skill Cursor và `mcp.json`. Không có mã sổ. |
| `main` | `d50c282` | Gốc của cả ba PR. |

Nguyên tắc dùng để chấm: mọi số do JS tất định tính; AI chỉ nháp theo đúng hàm nhập tay; user xác nhận mới ghi. Quyết định 27/10 (tối, 21:57, 22:08, 22:13) thắng mô tả cũ trong code và trong test.

Trạng thái: **Đạt** / **Một phần** / **Chưa có** / **Trái yêu cầu**.

## 2. Kết luận

Năm điểm làm sổ đang chạy trái quyết định 27/10:

1. **Thiếu phiếu hoặc thiếu giá vẫn chặn cả ngày.** `assembleLedgerInput` đẩy `missing_issue_slip`, `missing_price_table`, `missing_price`. Ngày bị chặn trả `lines: []`. PDF in tờ trống ghi "Chưa đủ phiếu hoặc bảng giá". Cột khác user đã nhập không được tính.
2. **`planRations` vẫn tự tính xuất gạo, chất đốt, sữa, gia vị** trong `computeLedger`, rồi `ensureRuleLots` tự tạo dòng nếu chưa có hàng. Không có trường nhập số lượng xuất ăn.
3. **Âm kho không chặn chốt và không chặn xuất.** Cảnh báo và tô đỏ có. `canLock` chỉ cần đã lưu quân số. `lockLedger` chỉ xem `blockers`, không xem `negative_stock`. Nút xuất PDF không khóa. Câu trong G-19 "âm kho hiện chặn chốt" **không đúng** với `b30e442`.
4. **Phiếu cấp 1 thêm/sửa/xóa không tự đồng bộ.** Ngày đã chốt giữ `snapshotJson` và bảo user mở khóa. `POST /ledger/slip-sync` từ chối ngày đã chốt và **ghi cân đối vào phiếu xuất cấp 1**.
5. **Gạo chỉ vào cột G.** Hàng khác không bị cấm G/H theo cấp tài khoản vì chưa tách cấp 1 / cấp 2. Danh mục `LttpCommodity` không có `sourceKind` hay hạng. Không lưu được khi thiếu hạng là chưa có.

In và màn hình là hai nguồn bố cục. Chưa có animation chuyển ngày, chưa có phím tắt sổ, chưa có lịch tháng. Đuôi sổ, phiếu xuất kho bếp, sổ theo dõi kho, nhật ký bếp điện, bàn giao DCCD chưa có.

PR #17 và PR #18 **merge được cả hai chiều, không conflict**. File chung duy nhất là `kitchen-ledger-assistant.service.js`, git tự gộp. PR #19 không đụng file của hai PR kia.

## 3. Thứ tự merge

`git merge-tree --write-tree` (git 2.38+) cho kết quả sạch:

| Chiều | Kết quả |
|---|---|
| PR #18 vào PR #17 | Sạch. Cây `6461f704`. Chỉ auto-merge `kitchen-ledger-assistant.service.js`. |
| PR #17 vào PR #18 | Sạch. Cùng một cây. |
| PR #19 vào PR #17 | Sạch. Không file giao. |
| PR #17 ∩ PR #18 | Một file: `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-assistant.service.js`. |
| PR #17 ∩ PR #19, PR #18 ∩ PR #19 | Không file giao. |

Hai hunk không đè nhau. PR #17 đổi `loadSettings` theo ngày, loại bản nháp và lịch làm việc. PR #18 thêm `dshCallFields` trong `callExtract`.

Thứ tự an toàn:

1. **Merge PR #17 trước.** Đây là sổ máy chủ đang chạy. Đưa `main` lên đúng hành vi bếp trước khi gắn AI.
2. **Merge PR #18 sau.** Patch DSH áp lên trợ lý đã có lịch và mức ăn theo ngày. Không rebase lại PR #17.
3. **PR #19 lúc nào cũng được**, trước hoặc sau. Chỉ skill, không đổi runtime.

Sau khi gộp #18, DSH đọc `getLedger` của PR #17. Số AI đọc vẫn là số `planRations` và ngày thiếu phiếu vẫn bị chặn, cho tới khi làm hết P0. Gộp xong chưa phải xong yêu cầu AI.

## 4. Test đã chạy

Không có `node_modules` của backend (thiếu `@prisma/adapter-mariadb`). Không cài nguyên cây phụ thuộc. Các test thuần và test có `zod@3.24.2` được chạy. Test đụng Prisma client không load được.

### PR #17 `b30e442` (máy chủ)

| Lệnh | Kết quả |
|---|---|
| `node --test` compute, line-order, meal-rates, month-book, `ledgerPageLayout`, `ledgerNumberFormat`, `kitchenBooksUnifiedScroll` | **23 pass, 0 fail** |
| `node --test` ai-headcount, assistant-core, records, frame (cần `zod`) | **22 pass, 0 fail** |
| `pytest tests/test_kitchen_ledger_book.py` trong `services/document-service` | **3 pass, 1 skip** — skip dòng 161: không có PDF tháng mẫu trên máy |
| `kitchen-ledger-assistant.service.test.js`, `kitchen-ledger-month-pdf.service.test.js` | **Không chạy.** `ERR_MODULE_NOT_FOUND: @prisma/adapter-mariadb` |

Các test đang **khóa hành vi cũ**, sẽ phải sửa cùng P0:

- `kitchen-ledger-compute.test.js:93` kỳ vọng gạo 72,97 kg và chất đốt 234.080 do quân số.
- `kitchen-ledger-compute.test.js:220` "âm kho chỉ thành đề nghị".
- `kitchen-ledger-compute.test.js:282` "thiếu phiếu thì chặn".
- `kitchen-ledger-frame.test.js:179` gạo trên phiếu bị bỏ (`rice_on_slip_ignored`).
- `kitchen-ledger-month-book.test.js` kỳ vọng `tail: null` — giữ đến khi làm đuôi sổ.

### `main` `d50c282` và PR #18 `60bc8d0`

Cùng bộ test sổ có trên `main` (chưa có line-order, meal-rates, frame, page-layout của PR #17): compute, month-book, assistant-core, ai-headcount, records, `ledgerNumberFormat`.

| Nhánh | Kết quả |
|---|---|
| `main` | **29 pass, 0 fail** sau khi có `zod` |
| PR #18, cùng bộ cộng `ai-gateway/tools.service.test.js` | **31 pass, 0 fail** |
| PR #18 `kitchen-books-menu-ai-llm.test.js` | **11 pass** |
| PR #18 `kitchen-ledger-assistant.service.test.js` | **Không load** — thiếu `@prisma/adapter-mariadb` |
| PR #18 `dsh-service` `npm test` | **11 pass, 0 fail** (policy chặn commit, MCP chỉ tool đọc/nháp) |

### PR #19

Không có suite ứng dụng. Diff là `.cursor/skills/*` và `.cursor/mcp.json`. Không chạy test runtime.

Chưa chạy giao diện trên trình duyệt. Chưa đo p95, chưa chạy axe, chưa đối chiếu PDF với `cktc_ngay.xlsx` bằng mắt.

## 5. Từng yêu cầu

Bằng chứng PR #17 là `b30e442`. "Việc cần làm" là việc của agent code, không làm trong review này.

### 5.1 Nguyên tắc YC-NT

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-NT-01 | Một phần | Trợ lý trong app ánh xạ quân số, dòng I/J, gạo, xuất khác, lịch, cài đặt qua `applyDraft` (`kitchen-ledger-assistant.service.js:528`). Chưa có thao tác tay cho xuất ăn, tịnh kho CSV, hạng hàng, phiếu xuất kho bếp. | Mỗi bản nháp mới phải trỏ tới một form đã có trên màn hình. Không thêm tool ghi riêng. |
| YC-NT-02 | Một phần | Apply trong app gọi `saveLedger` / `saveLedgerSettings` (`assistant.service.js:572`, `:603`, `:713`). PR #18 `proposeLedgerDraft` chỉ `mapLedgerRecords`, không gọi `PUT /ledger` (`tools.service.js:152` trên `60bc8d0`). `proposeIssueSlipDraft` chỉ echo dòng (`:190`). | Apply DSH phải dựng đúng body `saveLedger` / API phiếu cấp 1 rồi đi cùng validator. Propose không được ghi. |
| YC-NT-03 | Đạt | Apply cần bản nháp đã lưu và user gửi lại (`assistant.service.js:528`). Policy PR #18 từ chối `commit/save/apply === true` (`quanluong-policy/index.js:37`). | Giữ. Test: tool DSH không có đường ghi. |
| YC-NT-04 | Một phần | Tiền, tồn, CKTC trong `computeLedger` / `lineFromLot` (`kitchen-ledger-compute.js:279`, `:399`) bằng BigInt thang 10^6 (`kitchen-ledger-decimal.js:4`). PR #18 `ledgerChecks` cộng bằng `Number` (`tools.service.js:34`). | Bỏ mọi cộng tiền bằng float, kể cả bước kiểm tra. AI không gửi thành tiền cột sổ. |
| YC-NT-05 | Chưa có | `dataChangeLog` chỉ khi xuất PDF (`kitchen-ledger-month-pdf.service.js:123`). Lưu/chốt/mở khóa/áp nháp không ghi trước–sau. | Nhật ký ngày sổ: ai, lúc, nguồn (tay / id nháp), trước–sau. |
| YC-NT-06 | Trái yêu cầu | `planRations` (`compute.js:51`) được gọi trong `computeLedger` (`:401`). `ensureRuleLots` (`:561`) tự thêm dòng. `POST /ledger/balance` ghi dòng `balance` (`service.js:551`). | Gỡ khỏi lõi. User nhập số lượng. AI sau này chỉ nháp theo quy tắc user (BL-02, BL-03). |
| YC-NT-07 | Trái yêu cầu | G/H từ phiếu (`assemble.js:93`). Gạo tay bị ép `source: "G"` (`service.js:434`, `records.js:88`). Không có kiểm tra cấp 2. Không nhãn "nhập tay – tạm thời". | Cấp 2 không ghi G/H trừ gạo. Gạo chọn G/H/I/J. Phiếu cấp 1 là nguồn G/H còn lại. |

### 5.2 In YC-IN

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-IN-01 | Một phần | A4 dọc, lề 31pt (`kitchen_ledger_book.py:20`). Không thấy tỉ lệ 97%. | Đặt scale 97% hoặc ghi rõ hệ số trong một nguồn bố cục. Đối chiếu lệch ≤ 1 mm khi có mẫu. |
| YC-IN-02 | Đạt | Comment và thứ tự trái rồi phải (`kitchen_ledger_book.py:1`). `countBookPages` nhân 2 tờ/sheet (`month-book.js:206`). | Giữ test 1 ngày ra tờ lẻ A–K, tờ chẵn L–U, đủ tiêu đề. |
| YC-IN-03 | Một phần | Nhãn "Tên LTTP-Chất đốt", "Ngày trước chuyển qua" (`kitchen_ledger_book.py:54`, `ledgerPageLayout.js:38`). PDF tách "TG" / "CB" hai hàng (`:68`). Chưa đối chiếu QN25. | Một bảng nhãn dùng chung. Khi có mẫu QN25 thì so từng chữ hàng 1–6. |
| YC-IN-04 | Một phần | Thứ tự Thu, mức, ăn thêm, cộng, thừa, bù gạo, truy lĩnh, thu khách, chi, so sánh (`month-book.js:104`). Mức không dùng vẫn in nếu nằm trong `finance.levels`. | Giữ thứ tự. Tham số ẩn hay in trống khi chủ trả lời Q-C. |
| YC-IN-05 | Một phần | Hàng Cộng lấy `moneyFields`: F, K, M, O, Q, S (`month-book.js:40`, `:87`). Không cộng SL cột P. | Chờ Q-D. Nếu in tổng P thì thêm vào cùng hàm tổng, không tính lại ở Python. |
| YC-IN-06 | Đạt | `splitLedgerPages` chỉ mang 6 cột tiền (`compute.js:349`). Nhãn "Mang sang" / "Cộng sang trang" (`kitchen_ledger_book.py:318`). | Giữ test 40 dòng: mang sang tờ 2 bằng cộng sang tờ 1. |
| YC-IN-07 | Đạt | `minTail = 2` (`compute.js:352`). | Giữ test không tờ chỉ còn 1 dòng hàng. |
| YC-IN-08 | Đạt | `singlePageMax = 28`, `pageCapacity = 40` (`compute.js:350`). | Giữ test 28 dòng = 2 tờ, 29 dòng = 4 tờ. |
| YC-IN-09 | Một phần | Số 0 để trống, vi-VN (`month-book.js:14`, `ledgerNumberFormat.js`). Cỡ PDF `FONT_DATA = 7`, `FONT_HEAD = 6.5` (`kitchen_ledger_book.py:31`) và `_fit_size` co tiếp (`:99`). | Chờ Q-E. Một hàm format. Không nhân bản công thức. |
| YC-IN-10 | Đạt | `displayDash` khi role chất đốt (`compute.js:429`). `qtyCell` in gạch (`month-book.js:35`). Test "chất đốt: đơn giá trống, số lượng có tiền thì gạch". | Giữ. |
| YC-IN-11 | Đạt | Chữ ký từ `settings.signatures` (`month-pdf.service.js:39`, `settings.js:50`). Tên trống thì lấy hồ sơ người in, không mã cứng họ tên. | Giữ. Đổi tên trong cài đặt phải ra PDF mới. |
| YC-IN-12 | Một phần | Renderer không chèn trang trắng (`kitchen_ledger_book.py:1`). Có bìa. Chưa render cả tháng để đếm trang. | Test PDF tháng: số trang chẵn, không trang trắng giữa ngày. |
| YC-IN-13 | Đạt | Watermark "NHÁP" (`kitchen_ledger_book.py:182`). Bìa lấy `draftDays` (`month-book.js:190`, python `:250`). `draft = status !== "locked"`. | Giữ. Ngày locked không có watermark. |
| YC-IN-14 | Đạt | PDF vẽ chuỗi đã format, không đọc ô Excel. | Giữ test PDF không chứa `#REF!` hay `#N/A`. |
| YC-IN-15 | Đạt | `GET /ledger/month-pdf` (`routes.js:368`, `month-pdf.service.js:79`). | Giữ. Thêm chặn âm kho (YC-IN-19) trước khi tải file. |
| YC-IN-16 | Chưa có | `tail: null` và comment móc (`month-book.js:200`). Python không vẽ 9 trang đuôi. | Làm đuôi theo `mau_duoi_so_nhap_xuat.pdf` khi có tên người ký (câu 27). Số lấy từ tổng ngày. |
| YC-IN-17 | Một phần | Phiếu nhập kho có (`KitchenReceiptSlipWorkspace.jsx`). Phiếu xuất kho và sổ theo dõi là placeholder (`KitchenPhieuXuatKhoTab.jsx:6`, `KitchenSoTheoDoiLttpTab.jsx:6`). Không có tab nhật ký bếp điện, bàn giao DCCD (`KitchenBooksPage.jsx:249`). | Mỗi mẫu một test so khung. Chờ mẫu QN25 (G-13). |
| YC-IN-18 | Một phần | Màn hình: `ledgerPageLayout.js`. PDF: `kitchen_ledger_book.py`. Hai mảng cột, hai cỡ chữ. | Một nguồn cột, tiêu đề, ngắt trang, format số. Python và React chỉ vẽ. |
| YC-IN-19 | Chưa có | Xuất tháng không đọc `negative` (`month-pdf.service.js:79`). UI nút xuất không nhìn cảnh báo (`KitchenSoNhapXuatLttpTab.jsx:430`). Không banner PDF lỗi thời. | `409` kèm mặt hàng, ngày, số âm. Hết âm thì xuất được. Sau đồng bộ phiếu thì banner. |

### 5.3 Số liệu YC-SL

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-SL-01 | Một phần | UI lưới chỉ hiện số (`KitchenLedgerGrid.jsx`). PDF chỉ format (`month-book.js:51`). Công thức nằm trong `computeLedger`. PR #18 cộng lại bằng float để so tổng. | Cấm hàm tiền thứ hai. Kiểm tra tổng phải dùng cùng `toScaled`. |
| YC-SL-02 | Đạt | Thang `SCALE = 1000000n` (`kitchen-ledger-decimal.js:4`). `mul` chia nguyên. | Giữ. Test 1000 dòng: tổng in bằng tổng dòng, không lệch 1 đồng. `ponytail` đã ghi trần 6 số lẻ. |
| YC-SL-03 | Một phần | K = (G+H+I+J)×D, L = E+G+H+I+J, M = F+K, R = N+P, S = O+Q, tồn = L−R (`compute.js:208`, `:279`). Test ngày 13/10 (`compute.test.js:93`), không phải bộ 01/10 (cộng 10.172.400). | Thêm fixture 01/10 nếu số mẫu còn hiệu lực. Không tính lại ở UI. |
| YC-SL-04 | Một phần | Ngày nháp lấy lô ngày trước (`service.js:230`). Test frame `:151`. Ngày chốt trả snapshot, không tính lại (`service.js:265`). | Sửa ngày N−1 thì ngày N nháp tính lại. Ngày N chốt bị gắn cờ số đầu đã đổi, hoặc đồng bộ theo YC-SL-18. |
| YC-SL-05 | Đạt | Thừa/thiếu ngày trước lấy từ `snapshotJson.finance` (`service.js:209`). `computeFinance` (`compute.js:143`). | Giữ test thừa ngày N = thừa hôm trước ngày N+1. |
| YC-SL-06 | Một phần | Tồn âm vẫn lưu (`lineFromLot` `negative`, `compute.js:319`). Cảnh báo `negative_stock` (`:507`). Dòng tô đỏ (`KitchenLedgerGrid.jsx:120`). **Không** chặn chốt: `canLock` (`service.js:320`), `lockLedger` (`:520`). **Không** chặn PDF. | Lưu được. Chốt và xuất trả `409` mã `negative_stock`. Bỏ nút tự sinh dòng bù. |
| YC-SL-07 | Trái yêu cầu | `balanceLedger` ghi kind `balance` khi `confirm` (`service.js:551`). UI "Cân đối tồn âm" (`KitchenSoNhapXuatLttpTab.jsx:557`). | Xóa route cân đối khỏi lõi. User gõ dòng I/J như nhập thường. AI sau này chỉ nháp. |
| YC-SL-08 | Trái yêu cầu | Blocker `missing_issue_slip` và `missing_price_table` (`assemble.js:68`). `missing_price` (`:111`, `:169`). `ledgerBlocked` xóa dòng (`service.js:285`). UI nói chưa lập sổ (`KitchenSoNhapXuatLttpTab.jsx:508`). | Bỏ ba blocker ngày. Không phiếu thì G/H trống. Giá lấy bảng hiệu lực. Thiếu giá một dòng thì cảnh báo dòng đó. |
| YC-SL-09 | Một phần | `riceManualOnGuarantee` bỏ gạo trên phiếu (`assemble.js:101`, mặc định `settings.js:14`). Gạo tay chỉ cột G (`service.js:434`). | Gạo chọn G/H/I/J từng đợt, nhãn nhập tay tạm thời. Đồng bộ phiếu không xóa dòng gạo tay. Hàng khác từ chối G/H tay. |
| YC-SL-10 | Đạt | `balanceWarnThreshold` 20.000 (`settings.js:8`). `balanceWarn` (`compute.js:174`). | Giữ test chênh bằng ngưỡng và vượt 1 đồng. |
| YC-SL-11 | Đạt | Khóa lô tên+giá (`compute.js:204`). FIFO giá cũ trước (`:227`). | Giữ test hai giá, giá cũ đứng trước. |
| YC-SL-12 | Trái yêu cầu | `planRations` trong `computeLedger` (`compute.js:401`, `:461`). UI hiện suất, gạo, chất đốt (`KitchenSoNhapXuatLttpTab.jsx:462`). | Bỏ lời gọi. Đổi quân số không đổi SL xuất. Thành tiền xuất vẫn FIFO. |
| YC-SL-13 | Một phần | Quân số lấy từ `headcountJson` (`service.js:57`). Không đọc sổ chấm cơm trong `buildView`. | Khi cài `headcount.source = roster`, CKTC ngày chưa chốt đọc quân số thực ăn. Không tự điền. |
| YC-SL-14 | Một phần | Phiếu nhập kho có. Phiếu xuất kho bếp là placeholder. Khung `buildDayFrame` (`kitchen-ledger-frame.js:40`) chưa nuôi các sổ kia. | Cùng một khung. Σ phiếu xuất kho = cột N/O. |
| YC-SL-15 | Chưa có | `tail: null` (`month-book.js:200`). | Đuôi sổ = tổng các ngày đã lưu. |
| YC-SL-16 | Đạt | Quân số do user lưu từng ngày. Không có lịch ngày bay sinh quân số. | Xóa câu "sữa theo ngày bay" (`settings.js:3`) và regex trợ lý (`assistant-core.js:83`) — đó là G-18, không phải tự điền quân số. |
| YC-SL-17 | Một phần | Blocker và cảnh báo là danh sách chữ (`KitchenSoNhapXuatLttpTab.jsx:471`). Không màn đối soát, không nhảy tới dòng, không PDF lỗi thời, không lệch phiếu–sổ. | Một danh sách mã, bấm thì cuộn tới dòng. |
| YC-SL-18 | Trái yêu cầu | Ngày chốt không tính lại (`service.js:265`). Lời nhắn bảo mở khóa (`:271`). `syncLedgerSlip` gọi `assertDraft` (`:658`) rồi ghi phiếu (`:593`). | Hook thêm/sửa/xóa phiếu cấp 1 gọi đồng bộ G/H cả ngày nháp và ngày chốt, lan truyền tồn, nhật ký, banner PDF. |
| YC-SL-19 | Một phần | Self-supply bắt cột I hoặc J (`validator.js:39`). Không có hạng. `LttpCommodity` không có `sourceKind` (`schema.prisma:827`). | Không có loại/hạng trên dòng và không có trên danh mục thì `400`. AI không đoán. |
| YC-SL-20 | Chưa có | `unlockLedger` chỉ khi user bấm (`service.js:532`). Không đường "âm sau đồng bộ thì về nháp". | Sau đồng bộ, ngày chốt bị âm thì `status = draft`, xóa `lockedAt/By`, giữ snapshot cũ trong nhật ký, báo danh sách ngày. |

### 5.4 Dữ liệu YC-DL

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-DL-01 | Đạt | `@@unique([unitId, ledgerDate])` (`schema.prisma:1483`). | Giữ. |
| YC-DL-02 | Một phần | Một ngày một bản ghi. Sổ thực đơn, theo dõi, phiếu xuất kho, đuôi sổ không đọc khung. | Các view chỉ đọc `buildDayFrame` / `computeLedger`. |
| YC-DL-03 | Một phần | `editSlipLines` / `mergeSlipDraft` (`kitchen-ledger-slip-roundtrip.js`, test frame `:179`). UI phiếu xuất kho chưa có. Hàm này đang sửa phiếu **cấp 1**. | Sửa SL trên phiếu xuất **bếp** thì ghi movement. Không sửa G/H. |
| YC-DL-04 | Trái yêu cầu | `writeSlipQuantities` tạo/sửa `lttpIssueSlipLine`, kể cả `lineNote` (`service.js:593`). Mô tả route: ghi cân đối vào phiếu (`route-definitions.js:410`). | Xóa ghi ngược. Cấp 2 không tạo dòng phiếu cấp 1. |
| YC-DL-05 | Một phần | `PUT` ngày chốt → `409` (`assertDraft`, `service.js:379`). Chốt lưu snapshot và fingerprint (`:357`). Chốt vẫn chết vì thiếu phiếu (`:520`) và **không** chết vì âm kho. | Bỏ blocker phiếu/giá. Thêm blocker âm kho. Giữ `409` khi sửa ngày đã chốt bằng tay. |
| YC-DL-06 | Một phần | Có `slipFingerprint` và cờ `slipMismatch` (`service.js:266`). Không tự ghi. Nút UI ghi ngược phiếu (`KitchenSoNhapXuatLttpTab.jsx:565`). | Thay bằng đồng bộ một chiều phiếu → sổ. Nút chạy lại tay là tùy chọn, không phải cửa ngõ. |
| YC-DL-07 | Một phần | Mở khóa đặt `needsResignature` (`service.js:546`). UI hiện câu ký lại (`KitchenSoNhapXuatLttpTab.jsx:473`). PDF không in cờ này. Mở khóa không hỏi lý do (`validator.js:110`). | Bìa và màn hình cùng cờ. Lý do bắt buộc. Quyền mở khóa tách riêng khi có ma trận (Q-A). |
| YC-DL-08 | Một phần | Có `LedgerAssistantUsage` và `dataChangeLog` lúc xuất PDF. Không lịch sử ngày sổ. | Bảng lịch sử ngày: lưu, chốt, mở, đồng bộ, áp nháp. Giờ hiển thị UTC+7. |
| YC-DL-09 | Một phần | Nháp tính lại từ lô trước. Chốt không gắn cờ "số đầu đã đổi". | Cờ trên ngày chốt khi tồn chuyển đổi mà chưa đồng bộ. Chủ chưa chốt cơ chế ký lại (XĐ-6). |
| YC-DL-10 | Đạt | `sortLedgerLines` (`kitchen-ledger-line-order.js`, gọi ở `compute.js:480`). | Giữ test đổi `sortOrder` thì đổi thứ tự in. |
| YC-DL-11 | Một phần | Form tồn đầu ngày 01 (`KitchenSoNhapXuatLttpTab.jsx:601`, `service.js:196`). Không có CSV. | CSV hoặc giữ form. Cùng validator danh mục và đơn giá. |
| YC-DL-12 | Một phần | Bảng `KitchenLedger*` nằm trong `schema.prisma`. Không thấy job sao lưu liệt kê riêng từng bảng. | Xác nhận dump hệ thống gồm các bảng này. Không nhân bản số ra file lệch. |

### 5.5 Giao diện YC-UI

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-UI-01 | Một phần | Tab và `menuDate` dùng chung (`KitchenBooksPage.jsx:177`, `:249`). Thiếu nhật ký bếp điện và bàn giao. Hai tab placeholder. | Thêm tab khi có sổ. Giữ một state đơn vị và ngày. |
| YC-UI-02 | Một phần | Nháp / Đã chốt, cần ký lại, phiếu đổi, âm kho (`KitchenSoNhapXuatLttpTab.jsx:451`). Không "PDF lỗi thời". Âm kho không nói "không xuất được". | Một thanh trạng thái, chữ kèm màu, đủ sáu trạng thái. |
| YC-UI-03 | Đạt | `KitchenLedgerDayAside.jsx` nhập quân số, ăn thêm, thu khác. Thừa/thiếu hôm trước hiện từ finance. | Giữ. Xem trước CKTC trước khi bấm Lưu. |
| YC-UI-04 | Một phần | Dòng âm nền đỏ (`KitchenLedgerGrid.jsx:120`). Danh sách cảnh báo không cuộn tới dòng. | Bấm cảnh báo thì `scrollIntoView` đúng dòng. Tooltip số thiếu. Không đề xuất SL tự tính. |
| YC-UI-05 | Một phần | Chốt gửi `confirmHeadcount: true`. Cân đối có `confirm`. Mở khóa không ô lý do (`validator.js:110`). | Hộp thoại mở khóa và đồng bộ: hậu quả + lý do bắt buộc. |
| YC-UI-06 | Đạt | Bong bóng, modal, Esc (`KitchenLedgerAssistant.jsx:469`). Apply gọi API thủ công. | Giữ diff trước/sau từng ô trước khi ghi. |
| YC-UI-07 | Một phần | Nhãn tab và sổ là tiếng Việt. Chưa rà hết chuỗi. | Rà chuỗi người dùng. Số `vi-VN`, ngày `dd/mm/yyyy`, giờ UTC+7. |
| YC-UI-08 | Một phần | Lưới `xl:grid-cols` và bảng ngang (`KitchenSoNhapXuatLttpTab.jsx:487`). Chưa xem 1280 / 768 / điện thoại. | Kiểm ba khổ. Điện thoại ít nhất xem và nhập quân số. |
| YC-UI-09 | Một phần | Một số `aria-label` (`KitchenSoNhapXuatLttpTab.jsx:628`). Chưa chạy axe. | Bàn phím đủ, focus thấy, tương phản, nhãn ô. |
| YC-UI-10 | Một phần | Chữ "Đang tải sổ…" (`:446`). Đổi ngày không hỏi lưu. | Skeleton. "Đã lưu lúc hh:mm". Đổi ngày khi đang gõ thì hỏi lưu hoặc bỏ. |

### 5.6 Trang sổ YC-TR

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-TR-01 | Một phần | `KitchenLedgerGrid` + `ledgerHeaderRows` (`ledgerPageLayout.js:32`). Chưa chụp so `trang-trai.png`. | So ảnh khi có mẫu. Cột và thứ tự lấy từ một nguồn với PDF. |
| YC-TR-02 | Chưa có | Không nút "Trang trái / Trang phải". Lưới luôn A–U. | Hai chế độ xem, cùng dữ liệu trang in. |
| YC-TR-03 | Một phần | Nút ngày trước/sau và `input type="date"` (`KitchenSoNhapXuatLttpTab.jsx:490`). URL chỉ có `tab`, không `date` (`KitchenBooksPage.jsx:285`). Không "Hôm nay", không chuyển tờ. | `?date=` sống sau F5. Nút Hôm nay. Tờ 1/2 khi ngày dài. |
| YC-TR-04 | Chưa có | Không animation chuyển ngày. Không prefetch ±1. CSS chỉ có nudge bong bóng trợ lý (`index.css:250`). | Trượt 150–250 ms ease-out theo hướng. Tải ngày mới trước khi đổi. |
| YC-TR-05 | Đạt | `@media (prefers-reduced-motion: reduce)` tắt animation (`index.css:265`). | Khi có trượt ngày, nhánh reduce-motion không trượt. |
| YC-TR-06 | Chưa có | Esc chỉ đóng trợ lý (`KitchenLedgerAssistant.jsx:474`). Không ←/→, PageUp/Down, Alt+mũi tên, Ctrl/Cmd+S, Ctrl/Cmd+P, `?`. | Bộ phím khi focus không nằm trong ô nhập. Bảng `?`. |
| YC-TR-07 | Đạt | Cột ghim `pin`, `sticky`, `print:static` (`KitchenLedgerGrid.jsx:129`). | Giữ. Cuộn dòng 40 còn tiêu đề; cuộn tới cột S còn cột tên. |
| YC-TR-08 | Một phần | Ô lưới không sửa được. Nhập nằm form riêng. Không tooltip "M = F + K". | Ô tính `readOnly` + tooltip công thức. Ô nhập chỉ những cột user được gõ. |
| YC-TR-09 | Chưa có | Không lịch tháng trên sổ. | Lịch chấm nháp / chốt / ký lại / âm kho / PDF lỗi thời. |

### 5.7 Đơn vị YC-DV

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-DV-01 | Một phần | Không thấy `if (unitId === …)` trong nghiệp vụ sổ. Khóa định mức vẫn trong `DEFAULT_LEDGER_SETTINGS` (`settings.js:6`). Thiếu khóa rau, nước rửa, chữ ký đậm, giờ lấy phiếu. | Không thêm định mức vào lõi. Khóa đặc thù không phải định mức mới thành cài đặt. Cấm nhánh theo `unitId`. |
| YC-DV-02 | Một phần | Mức ăn theo `validFrom` (`kitchen-ledger-meal-rates.js:144`). `configJson` một bản hiện tại (`service.js:81`). Ngày chốt giữ số trong snapshot, không giữ bản cài đặt. | Cài đặt hiệu lực theo ngày. Ngày chốt không đổi khi sửa ngưỡng sau. |
| YC-DV-03 | Một phần | `KitchenLedgerSettingsPanel.jsx`. `saveLedgerSettings` (`service.js:703`) không ghi nhật ký trước–sau. | Mỗi khóa có giải thích. Lưu thì có audit. |
| YC-DV-04 | Đạt | `percentsToAmounts` phần dư lớn nhất (`kitchen-ledger-meal-rates.js:12`). Test 72.000 × 20/40/40. | Giữ. |
| YC-DV-05 | Một phần | Hồ sơ và quy tắc trợ lý (`LedgerAssistantProfile` trong schema). Không thấy cảnh báo khi hồ sơ trái cài đặt. | Cài đặt thắng. Hiện cảnh báo mâu thuẫn. |
| YC-DV-06 | Một phần | Sổ theo `unitId`, không nhánh mã từng đơn vị. Chưa tạo đơn vị thử. | Tạo đơn vị mới chỉ bằng cài đặt, chữ ký, danh mục, làm một ngày. |
| YC-DV-07 | Một phần | Giá lấy bảng `effectiveDate <= ngày` (`service.js:116`). Nhập I/J không kiểm hạng. | Kết hợp YC-SL-19. Không giá tạm. |

### 5.8 Nhập liệu YC-NL

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-NL-01 | Đạt | DayAside + `headcount` trong `saveLedgerBodySchema` (`validator.js:65`). Apply gọi `saveLedger` (`assistant.service.js:609`). | Giữ. Mức lạ thì 400. |
| YC-NL-02 | Một phần | Tab sổ chấm cơm (`KitchenBooksPage.jsx:237`). Nút chép quân số hôm trước trên sổ (`KitchenSoNhapXuatLttpTab.jsx:539`), không phải API meal-roster. | Chấm cơm ghi qua API roster. Chép sang sổ chỉ khi user bấm. Không chấm ngày đã chốt. |
| YC-NL-03 | Trái yêu cầu | Form "Gạo — Trên BĐ mua TT" (`KitchenSoNhapXuatLttpTab.jsx:578`). Body không có cột (`validator.js:44`). Server gán G. | Thêm cột G/H/I/J trên dòng gạo. AI không nói cột thì để trống, bắt user chọn. |
| YC-NL-04 | Một phần | Form tự mua I/J (`DayAside`, schema `:37`). `placeLine` thiếu danh mục thì `savable: false` (`records.js:96`). Không hạng. | Bắt loại và hạng trước khi `saveLedger` nhận dòng. |
| YC-NL-05 | Một phần | `otherOut` (`validator.js:75`, UI `:589`). `allocateOther` dồn phần vượt vào lô cuối (`compute.js:248`) nên vẫn âm, không 400. | Giữ nhập P/Q. Không tự cắt. Cảnh báo âm là YC-SL-06, không chặn lưu. |
| YC-NL-06 | Một phần | Ô truy lĩnh, thu khách, ăn thêm (`DayAside.jsx:262`). Bù giá gạo chỉ đọc `finance.riceSubsidy` (`:259`), server tự tính từ chênh giá (`compute.js:486`). | Ô nhập bù giá gạo ≥ 0. Bỏ tự tính, trừ khi chủ giữ công thức. |
| YC-NL-07 | Một phần | API phiếu nhập kho (`routes` receipt-slip, `schema` unique đơn vị+ngày `schema.prisma:1413`). Chưa thấy bản nháp AI phiếu nhập đi cùng API đó. | Bản nháp phiếu nhập apply qua đúng route phiếu nhập. |
| YC-NL-08 | Một phần | API phiếu xuất LTTP (`lttp.routes.js:249`) không gắn depth cấp 1 trong sổ. Sửa phiếu không gọi đồng bộ sổ. PR #18 propose không tạo phiếu. | Chỉ cấp 1 ghi phiếu. Mỗi ghi kích hoạt YC-SL-18. Propose không `create`. |
| YC-NL-09 | Chưa có | UI placeholder (`KitchenPhieuXuatKhoTab.jsx:6`). | Màn phiếu xuất bếp sửa N và I/J, ghi movement. G/H đọc. |
| YC-NL-10 | Trái yêu cầu | Cùng YC-SL-07. Nút cân đối không phải dòng I/J user gõ. | Bỏ nút. Dòng bù là self-supply I/J, ghi chú tùy user. |
| YC-NL-11 | Trái yêu cầu | Nút "Ghi cân đối vào phiếu xuất" (`KitchenSoNhapXuatLttpTab.jsx:565`). Không banner, không tự đồng bộ. | Xóa nút ghi ngược. Đồng bộ server-side. Banner rồi nút xuất PDF mới. |
| YC-NL-12 | Một phần | `POST /ledger/lock` và `/unlock` (`routes.js:391`). Trợ lý không có tool chốt. Mở khóa không lý do, cùng quyền với lưu. | Giữ AI không chốt. Tách quyền. Lý do khi mở khóa. |
| YC-NL-13 | Một phần | `PUT /ledger/settings` (`routes.js:360`). Trợ lý áp `saveLedgerSettings` trong modal, không bắt mở SettingsPanel. Schema còn `fuelPerServing`, `milk`, `spices` (`validator.js:142`). | Bỏ khóa định mức khỏi API cài đặt. Đề xuất cài đặt chỉ ghi khi user lưu ở màn cài đặt. |
| YC-NL-14 | Một phần | Tab sổ thực đơn có. Không thấy test ±5%/bữa trong module sổ ngày. | Thực đơn tuần từ khung định lượng. Lệch quá 5% thì báo. |
| YC-NL-15 | Một phần | Form tồn đầu, không CSV, không bản nháp ảnh biên bản. | CSV/form dùng một API. AI chỉ nháp. |
| YC-NL-16 | Đạt | Route profile, memory, rules (`routes.js:432`). | Giữ. Chỉ chủ hồ sơ sửa. |
| YC-NL-17 | Một phần | Lưới không có ô G/H. Liên kết chung `/lttp-nhap-xuat` (`KitchenSoNhapXuatLttpTab.jsx:519`), không tới phiếu nguồn. Gạo lại có form ghi G. | G/H đọc, link từng dòng tới phiếu. Ngoại lệ gạo có nhãn tạm thời. |
| YC-NL-18 | Chưa có | Danh mục món bếp không phải `sourceKind` trên `LttpCommodity`. | API danh mục hàng: Mua TT / TGSX và hạng. AI chỉ đề xuất, user xác nhận trên màn danh mục. |
| YC-NL-19 | Trái yêu cầu | `saveLedgerBodySchema` không có `mealOut` (`validator.js:65`). SL cột N do `planRations` và `freshMealQty` (`compute.js:220`, `:461`). | Thêm `mealOut.lines`. Bỏ tự điền. FIFO chỉ tính thành tiền. |

### 5.9 Trợ lý YC-AI

PR #17 có trợ lý OpenRouter trong backend. PR #18 có DSH, chưa nằm trên máy chủ.

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-AI-01 | Một phần | Apply không chốt/mở khóa. `placeLine` không cho hàng thường vào G (`records.js:75`). Policy PR #18 chặn host tool và `apply: true` (`quanluong-policy/index.js:28`). Chưa cấm AI gửi thành tiền vì server không nhận cột tiền từ record — tốt — nhưng lõi vẫn tự tính xuất. | Giữ deny list. Test gọi tool lạ và `apply:true` → deny. Không tool sửa G/H, cài đặt trực tiếp, ngày chốt. |
| YC-AI-02 | Một phần | Trợ lý PR #17 dùng session + `assertScope` (`assistant.service.js:47`). Grant chỉ có trên PR #18 (`tools.service.js:16`, `grants.js`). | Sau merge: grant giả → 403. Grant không tự tạo. |
| YC-AI-03 | Một phần | Server đặt cột (`records.js:75`). Gạo luôn G. Thiếu hạng vẫn `savable` nếu khớp một mặt hàng. | Từ chối record hàng thường vào G/H. Thiếu loại/hạng thì nháp không apply được. |
| YC-AI-04 | Một phần | Câu hỏi đọc view đã tính (`assistant.service.js` `renderTool` quanh `:521`). PR #18 `trimLedger` bỏ gần hết cột tiền (`tools.service.js:107`). | Tool đọc trả đúng số `computeLedger`, gồm tiền và CKTC. Model không tính lại. |
| YC-AI-05 | Một phần | Record có `confidence` và `source` (`ledgerRecords.js:8`). Ngưỡng `LOW = 0.8` (`assistant-core.js:4`). Chưa thấy tô vàng theo ngưỡng trên diff. | Tô trường dưới ngưỡng. Ngưỡng là tham số (Q-G). |
| YC-AI-06 | Một phần | `negative_stock` có trong assistant-core test. Chưa đủ mã: PDF lỗi thời, lệch phiếu, thiếu hạng. Mức 130k = 0 không bị coi là lỗi ở compute — đúng hướng. | Mỗi mã kiểm tra trả dòng liên quan. Không báo 130k = 0. |
| YC-AI-07 | Một phần | Nhiều mặt hàng trùng tên thì không lưu (`records.js:98`). Không hỏi hạng. Trợ lý đoán sữa từ chữ "ngày bay" (`assistant-core.js:83`). | Thiếu hạng thì hỏi, không chọn L2. Bỏ đoán sữa theo ngày bay. |
| YC-AI-08 | Một phần | `LedgerAssistantUsage` và `writeUsage` trong assistant service. Chưa đọc từng cột để chứng minh không lưu token. | Một dòng usage mỗi lượt. Cấm secret trong log. |
| YC-AI-09 | Đạt | Thiếu khóa thì câu "AI đang tắt… Nhập tay ở bảng phía trên" (assistant service, chuỗi `disabledMessage`). Form tay không đi qua LLM. | Giữ. Tắt DSH thì màn tay vẫn lưu. |
| YC-AI-10 | Đạt | Không có mã sinh quân số từ lịch. Chép hôm trước là nút (`KitchenSoNhapXuatLttpTab.jsx:539`). | Giữ. Không bản nháp quân số khi user chưa báo. |
| YC-AI-11 | Chưa có | Không màn quy tắc BL-03. Lõi đang làm việc của AI tương lai (`planRations`, `balanceLedger`). | Không làm AI cân đối trong đợt này. Gỡ lõi trước. Khi làm: không quy tắc thì không nháp; nháp ghi mã quy tắc và phiên bản; dòng ngoài I/J bị từ chối. |

### 5.10 Phi chức năng YC-NF

| Mã | Trạng thái | Bằng chứng | Việc cần làm |
|---|---|---|---|
| YC-NF-01 | Chưa có | Mọi key sổ dùng một code `kitchenBooks.access` (`route-definitions.js:360`, `:372`, `:384`, `:396`, `:408`). | Tách xem, lưu, chốt, mở khóa, cài đặt, xuất. User chỉ xem gọi `PUT /ledger` → 403. |
| YC-NF-02 | Đạt | `assertScope` (`service.js:34`) gọi `assertKitchenLogicalMatchesDataScope` và `assertKitchenWriteUnit`. | Giữ test user đơn vị A đọc ngày đơn vị B → 403/404. |
| YC-NF-03 | Chưa có | Không số đo trong mã. | Đo sau khi P0 xong. Không chặn đợt sửa nghiệp vụ. |
| YC-NF-04 | Một phần | Cùng input `computeLedger` ra cùng snapshot. PDF ReportLab có metadata thời gian. Chưa so hash hai lần. | Test hash snapshot. PDF so sau khi bỏ metadata. |
| YC-NF-05 | Một phần | Có test compute, cắt trang, format, frame, PDF renderer. Chưa có bộ 01/10. Chưa đo coverage 80%. Hai file service test không chạy nếu thiếu Prisma. | Sửa test cũ trong P0. CI chạy được không cần DB cho compute. |
| YC-NF-06 | Một phần | Khóa AI đọc env (`disabledMessage` khi thiếu `MENU_AI_API_KEY`). PR #18 token DSH qua env (`dsh-service/src/config.js`, `.env.example`). Không rà hết log. | Cấm in token. DSH chỉ mạng nội bộ. |
| YC-NF-07 | Một phần | `prisma.$transaction` khi lưu (`service.js:492`). `KitchenLedgerDay` không cột version (`schema.prisma:1460`). | `version` trên ngày. Lưu lệch version → 409, client tải lại. |
| YC-NF-08 | Đạt | `ledgerDate` kiểu `@db.Date` (`schema.prisma:1463`). `parseDateOnly` cộng ngày bằng UTC (`service.js:30`). | Giữ test 31/10 23:30 UTC+7 vẫn là ngày 31/10. |
| YC-NF-09 | Một phần | Comment đầu `settings.js` và `compute.js`. Panel cài đặt không mô tả hết khóa. | Mỗi khóa một câu. Quyết định 27/10 ghi vào `nghiep-vu-lam-so.md` khi đụng file đó. |
| YC-NF-10 | Một phần | Hai file `ledgerRecords.js` đang giống nhau (`diff -q` rỗng). Đã có test so nội dung (`kitchen-ledger-records.test.js:13`). | Giữ test đó trong CI. |
| YC-NF-11 | Chưa có | Không nhánh cấp 1 / cấp 2 trong sổ. Ai có `kitchenBooks.access` cũng lưu gạo vào G và bấm cân đối. | Cấp 2: G/H từ phiếu, trừ gạo; cân đối chỉ I/J. Cấp 1: sửa phiếu, không sửa sổ cấp 2. |

### 5.11 Backlog

| Mã | Trạng thái | Việc cần làm |
|---|---|---|
| BL-01 | Chưa có | Không làm phiếu gạo trong đợt P0. Giữ ngoại lệ gạo nhập cột đến khi có phiếu. |
| BL-02 | Chưa có | Không đưa cân đối hay định mức vào AI cho đến khi có BL-03 và P0 đã gỡ lõi. |
| BL-03 | Chưa có | Không thêm `fuelPerServing`, `spices`, `milk`, `riceGrams`, `servingWeights`, `balanceRound` lại vào cài đặt lõi. Màn quy tắc là việc sau. |

## 6. Đối chiếu G-01..G-22

| Mã | Kết luận sau khi đọc `b30e442` | Ghi chú |
|---|---|---|
| G-01 | Đúng | `month-book.js:200` `tail: null`. |
| G-02 | Đúng | Placeholder phiếu xuất kho và sổ theo dõi. Không tab nhật ký bếp điện, bàn giao DCCD. |
| G-03 | Đúng | Một permission code cho lưu, chốt, mở khóa, cân đối, đồng bộ, cài đặt. |
| G-04 | Đúng | Chưa có lịch sử trước–sau theo ngày sổ. |
| G-05 | Đúng | `/ledger/balance` và `/ledger/slip-sync` vẫn trong lõi và ghi phiếu cấp 1. |
| G-06 | Đúng | Không animation ngày, không prefetch, không phím tắt sổ, không lịch tháng. Có Esc trợ lý và CSS reduce-motion. |
| G-07 | Đúng | `ledgerPageLayout.js` và `kitchen_ledger_book.py` là hai nguồn. |
| G-08 | Đúng | PDF cỡ 7 / 6,5pt rồi co tiếp. Không thấy 97%. |
| G-09 | Đúng một nửa | Khóa rau, nước rửa, chữ ký đậm, giờ lấy phiếu chưa có. **Không** được thêm định mức vào lõi để "lấp" G-09. Phần đó là BL-03. |
| G-10 | Đúng | Có form tồn đầu, không CSV. |
| G-11 | Đúng | Nháp lấy lô hôm trước. Ngày chốt không có cờ số đầu đổi. |
| G-12 | Đúng | Không cột version. Transaction không chặn hai tab ghi đè. |
| G-13 | Đúng | Mẫu QN25 và phần gạo chưa có trong repo. Việc của chủ. |
| G-14 | Đúng | PR #18 chưa merge. Hai đường AI: trợ lý OpenRouter (PR #17) và DSH (PR #18). |
| G-15 | Đúng | `assemble.js:68` còn `missing_issue_slip` và `missing_price_table`. Thêm `missing_price` từng dòng. |
| G-16 | Đúng | Gạo tay chỉ G; gạo trên phiếu bị bỏ. |
| G-17 | Đúng | Không `sourceKind` / hạng, không chặn lưu khi thiếu. |
| G-18 | Đúng | Comment `settings.js:3`. Regex `assistant-core.js:83` còn "ngay bay". Không thấy mã sinh quân số từ lịch. |
| G-19 | Sai ở một vế | Đúng là chưa chặn PDF và chưa có banner. **Sai** câu "âm kho hiện chặn chốt". Chốt không đọc `negative_stock`. |
| G-20 | Đúng | Không tự đồng bộ. Ngày chốt đóng băng snapshot. Nút đồng bộ là ghi ngược và chỉ ngày nháp. |
| G-21 | Đúng | Chưa tách cấp 1 / cấp 2. |
| G-22 | Đúng | `planRations` trong `computeLedger` dòng 401. Thêm `ensureRuleLots` dòng 561 tự tạo dòng. |

### Khoảng trống mới

| Mã | Khoảng trống | Yêu cầu | Mức |
|---|---|---|---|
| G-23 | Âm kho không chặn chốt. G-19 nói ngược. `canLock` chỉ cần `headcountJson` (`service.js:320`). | YC-SL-06, YC-DL-05 | Cao |
| G-24 | `ensureRuleLots` tự tạo dòng gạo, gia vị, sữa, chất đốt khi quân số dương dù user chưa nhập xuất. | YC-NT-06, YC-SL-12 | Cao |
| G-25 | Ngày `ledgerBlocked` trả `lines: []` (`service.js:285`). PDF in tờ trống "Chưa đủ phiếu hoặc bảng giá" (`month-book.js:168`). Cột user đã nhập biến mất. | YC-SL-08, YC-IN-19 | Cao |
| G-26 | `slipMismatchMessage` bảo mở khóa để lấy lại phiếu (`service.js:271`), ngược tự đồng bộ. | YC-SL-18 | Cao |
| G-27 | Bù giá gạo tự tính từ chênh đơn giá (`compute.js:486`), UI chỉ đọc (`DayAside.jsx:259`). Không ô nhập. | YC-NL-06 | Trung bình |
| G-28 | PR #18 `propose_*` không đi API ghi; `ledgerChecks` dùng `Number`; `trimLedger` bỏ cột tiền. | YC-NT-02, YC-NT-04, YC-AI-04 | Cao sau khi merge #18 |
| G-29 | Test đang khóa luật cũ: thiếu phiếu thì chặn, âm kho chỉ là đề nghị, gạo phiếu bị bỏ, quân số ra 72,97 kg gạo. | YC-NF-05 | Cao, sửa cùng P0 |
| G-30 | Không `?date=` trên URL trang sổ (`KitchenBooksPage.jsx:285`). | YC-TR-03 | Trung bình |
| G-31 | Không chế độ trang trái / trang phải. | YC-TR-02 | Trung bình |
| G-32 | Mở khóa không bắt lý do (`validator.js:110`). | YC-DL-08, YC-UI-05 | Trung bình |

## 7. Kế hoạch làm việc

Agent code làm **đúng thứ tự**. Mỗi mục xong thì test của mục đó xanh trước khi sang mục sau. Không mở rộng BL-01..BL-03. Không thêm định mức vào cài đặt để "thay" `planRations`.

Quy ước test: sửa test cũ đang khóa luật 16/10–18/10. Không nới assert cho khớp code sai.

### P0

#### P0.1 — Bỏ chặn thiếu phiếu và thiếu bảng giá

Yêu cầu: YC-SL-08, YC-DL-05, YC-IN-08 (tờ không bị xóa dữ liệu), G-15, G-25.

File:

- `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-assemble.js`
- `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger.service.js` (`buildView` nhánh `ledgerBlocked`)
- `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-month-book.js` (note "Chưa đủ phiếu")
- `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger-settings.js` (`requireIssueSlip`, `requirePriceTable`)
- `quanluong-app-be/src/modules/kitchen-books/kitchen-ledger.validator.js`
- `packages/shared/src/pages/kitchen-books/KitchenSoNhapXuatLttpTab.jsx`
- `packages/shared/src/pages/kitchen-books/KitchenLedgerSettingsPanel.jsx`
- Test: `kitchen-ledger-compute.test.js` (case dòng 282), `kitchen-ledger-frame.test.js`

Việc: không phiếu thì G/H trống, cột E/F, I/J, N–Q, CKTC vẫn tính. Không nhãn "chờ phiếu". Thiếu giá một dòng là cảnh báo dòng, không chặn ngày. Bảng giá vẫn chọn bản `effectiveDate` muộn nhất không sau ngày sổ.

Nghiệm thu:

- Ngày không phiếu, có quân số và một dòng I: `ledgerBlocked === false`, có dòng I, không có G/H.
- `POST /ledger/lock` ngày đó không trả `missing_issue_slip`.
- PDF ngày đó không phải tờ trống "Chưa đủ phiếu".
- Test cũ "thiếu phiếu thì chặn" được thay bằng test trên và xanh.

#### P0.2 — Gỡ xuất theo định mức, thêm nhập số lượng xuất ăn

Yêu cầu: YC-NT-06, YC-SL-12, YC-NL-19, YC-AI-11, G-22, G-24.

File:

- `kitchen-ledger-compute.js` (`planRations`, lời gọi trong `computeLedger`, `ensureRuleLots`, nhánh fuel/rice/milk/spice của allocate)
- `kitchen-ledger-settings.js`, `kitchen-ledger.validator.js` (bỏ `fuelPerServing`, `spices`, `milk`, `servingWeights`, `riceGrams`, `balanceRound` khỏi mặc định và schema lưu)
- `kitchen-ledger.service.js` `rowsForKind` thêm kind xuất ăn
- `packages/shared` form sổ: bảng nhập SL cột N, bỏ dòng "Suất · gạo · chất đốt" tự tính
- Test compute dòng 93 và 220, records nếu gọi `planRations`

Việc: `computeLedger` không gọi hàm định mức và không tự tạo dòng. SL xuất ăn lấy từ movement user (hoặc nháp đã apply). FIFO chỉ ra thành tiền và tồn. Chất đốt vẫn `displayDash` khi user đã nhập tiền.

Nghiệm thu:

- Đổi quân số, không đổi movement: `mealQty` không đổi.
- Không có dòng "Gạo" / "Chất đốt" nếu user chưa nhập và phiếu không có.
- `saveLedger` nhận `mealOut.lines` (tên trường có thể khác nhưng phải vào cùng `PUT /ledger`).
- Test 13/10 không còn kỳ vọng 72,97 kg và 234.080 từ quân số.
- Grep `planRations` trong `computeLedger` không còn lời gọi.

#### P0.3 — Âm kho: lưu, cảnh báo, chặn chốt, chặn xuất

Yêu cầu: YC-SL-06, YC-IN-19, YC-DL-05, G-19 (sửa nhận định), G-23.

File:

- `kitchen-ledger.service.js` `canLock`, `lockLedger`
- `kitchen-ledger-month-pdf.service.js`
- `KitchenSoNhapXuatLttpTab.jsx` nút Chốt và Xuất sổ tháng
- `KitchenLedgerGrid.jsx` giữ tô đỏ

Việc: lưu ngày âm vẫn 200. Chốt trả 409 mã `negative_stock` kèm tên, ngày, số âm. Xuất PDF tháng trả 409 cùng danh sách nếu bất kỳ ngày trong tháng âm. Hết âm thì chốt và xuất được. Không gọi `suggestBalance` để ghi dòng.

Nghiệm thu:

- Ngày âm: lưu được, dòng `negative: true`, chốt 409, PDF 409.
- Sửa SL cho hết âm: chốt 200, PDF 200.
- UI nút Chốt và Xuất tắt khi còn âm, có chữ không chỉ màu.
- Test "âm kho chỉ thành đề nghị" đổi thành: có cảnh báo, không có movement `balance` tự sinh.

#### P0.4 — Tự đồng bộ phiếu, cấm ghi ngược, ngày chốt âm thì về nháp

Yêu cầu: YC-SL-18, YC-SL-20, YC-DL-04, YC-DL-06, YC-NL-11, YC-NT-07, G-05, G-20, G-26.

File:

- Chỗ tạo/sửa/xóa phiếu xuất LTTP (module `lttp`, sau `write` phiếu) gọi một hàm sổ, không để UI bấm.
- `kitchen-ledger.service.js`: bỏ `writeSlipQuantities` khỏi đường cân đối; `syncLedgerSlip` không ghi phiếu; ngày chốt vẫn được hàm đồng bộ cập nhật G/H.
- `kitchen-ledger-slip-roundtrip.js`: không `mergeSlipDraft` vào phiếu cấp 1.
- UI: xóa nút "Ghi cân đối vào phiếu xuất" và "Cân đối tồn âm".
- Route `POST /ledger/balance` trả 410 hoặc xóa hẳn. Không giữ hành vi cũ sau một cờ.

Việc: thêm, sửa, xóa phiếu của một ngày thì G/H ngày đó tính lại, kể cả `status = locked`. Lan truyền tồn sang các ngày sau. Nhật ký "Đồng bộ tự động từ phiếu số …". Nếu ngày đang chốt trở thành âm thì về `draft`, xóa `lockedAt` / `lockedById`, giữ snapshot cũ trong nhật ký, `needsResignature = true`. Ngày sau không âm thì giữ chốt và cập nhật snapshot. Banner "PDF cũ đã lỗi thời" khi fingerprint đổi sau lần xuất.

Nghiệm thu:

- Sửa SL phiếu ngày 25 đã chốt, kho không âm: G/H ngày 25 đổi ngay, E/F ngày 26 đổi, ngày 25 vẫn locked, có cờ ký lại, có nhật ký.
- Xóa phiếu làm ngày 25 và 27 âm, ngày 26 không âm: 25 và 27 về nháp, 26 vẫn chốt. Xuất tháng 409. Thông báo liệt kê 25 và 27.
- Cấp 2 gọi API cũ ghi cân đối vào phiếu → 4xx, phiếu không thêm dòng "Cân đối sổ".
- Dòng gạo nhập tay không bị đồng bộ xóa (nối với P0.5).

#### P0.5 — Gạo mọi cột, loại nguồn và hạng, cấp 1 và cấp 2

Yêu cầu: YC-NT-07, YC-SL-09, YC-SL-19, YC-NF-11, YC-NF-01, YC-NL-03, YC-NL-04, YC-NL-18, G-16, G-17, G-21.

File:

- `schema.prisma` `LttpCommodity`: `sourceKind`, hạng. Migration thêm cột, không đổ mặc định ngầm cho hàng cũ (hàng cũ chưa có thì user phải ghi khi nhập).
- `kitchen-ledger.validator.js`: dòng gạo có `source` thuộc G/H/I/J. Dòng tự mua không lưu nếu thiếu loại hoặc hạng khi danh mục trống.
- `kitchen-ledger.service.js` `rowsForKind`: bỏ ép gạo về G.
- `kitchen-ledger-assemble.js`: không bỏ gạo trên phiếu trừ khi dòng đó là gạo nhập tay cần giữ.
- `kitchen-ledger-records.js` `placeLine`: gạo không nói cột thì `savable: false`.
- `route-definitions.js`: tách code quyền xem / lưu / chốt / mở khóa / cài đặt / xuất. Phiếu xuất LTTP chỉ đơn vị depth cấp 1 (đã có `depth` trên đơn vị, `lttp-issue-slip-ai-learn.js:188` là chỗ tham khảo, không copy luật AI).
- UI form gạo: chọn cột. Bỏ checkbox "gạo nhập tay trên bảo đảm" như công tắc duy nhất.

Việc: cấp 2 gửi G/H không phải gạo → 403. Gạo G/H lưu được và có cờ nhập tay tạm thời. Dòng "cá" khi danh mục có nhiều hạng mà không ghi hạng → 400. Mặt hàng danh mục đã Mua TT và một hạng → vào I không cần gõ lại. AI thiếu loại/hạng không apply.

Nghiệm thu:

- Ba case trên có test HTTP hoặc test service có scope giả.
- `PUT /ledger` với user chỉ quyền xem → 403.
- `POST /ledger/unlock` không quyền mở khóa → 403.
- User cấp 2 không gọi được tạo phiếu xuất LTTP.

P0.5 phụ thuộc P0.1 và P0.4 (đồng bộ không được xóa gạo tay).

#### P0.6 — AI chỉ đi đường nhập tay, làm sau khi P0.1–P0.5 đã xanh

Yêu cầu: YC-NT-01, YC-NT-02, YC-NT-03, YC-AI-01, YC-AI-03, G-14, G-28.

File:

- PR #17: `kitchen-ledger-assistant.service.js`, `kitchen-ledger-records.js`
- PR #18 sau merge: `quanluong-app-be/src/modules/ai-gateway/tools.service.js`, `dsh-service/plugins/quanluong-tools/client.js`, `quanluong-policy/index.js`

Việc: propose trả nháp, `committed: false`. Apply dựng body `saveLedger` (có `mealOut`, cột gạo, loại, hạng) và gọi đúng `saveLedger`. Không hàm ghi thứ hai. `ledgerChecks` không cộng float. `trimLedger` trả số tiền server đã tính. Không tool chốt, mở khóa, sửa G/H hàng thường, sửa cài đặt trực tiếp.

Nghiệm thu:

- Cùng payload hợp lệ, apply và form tay cho cùng movement.
- Payload thiếu hạng: cả hai 400 cùng mã.
- `apply: true` trên tool DSH → deny.
- Ngày đã chốt: apply 409 như `PUT` tay.
- Tắt khóa AI: form tay vẫn lưu.

Không làm BL-02 trong mục này.

### P1

#### P1.1 — Một nguồn bố cục màn hình và PDF

Yêu cầu: YC-IN-01, YC-IN-03, YC-IN-09, YC-IN-18, YC-TR-01, YC-TR-02, G-07, G-08.

File: `packages/shared/src/pages/kitchen-books/ledgerPageLayout.js`, `services/document-service/app/render/kitchen_ledger_book.py`, `kitchen-ledger-month-book.js`.

Việc: cột, tiêu đề, ngắt trang, format số xuất từ một mô tả. Python và React chỉ vẽ. Thêm chế độ trang trái / trang phải. Cỡ chữ theo Q-E; chưa trả lời thì giữ vừa ô nhưng ghi một hằng số, không hai bộ width.

Nghiệm thu: test layout dùng chung. PDF và JSON lưới cùng số dòng, cùng "Mang sang", cùng ô trống khi giá trị 0. 28 và 29 dòng vẫn đúng YC-IN-08.

#### P1.2 — Chuyển ngày, phím, lịch

Yêu cầu: YC-TR-03, YC-TR-04, YC-TR-06, YC-TR-09, YC-UI-10, G-06, G-30, G-31.

File: `KitchenBooksPage.jsx`, `KitchenSoNhapXuatLttpTab.jsx`, `packages/shared/src/index.css`.

Việc: `?date=` và nút Hôm nay. Prefetch ±1 ngày. Trượt 150–250 ms, tắt khi `prefers-reduced-motion`. Phím khi không focus ô nhập. Đổi ngày lúc form bẩn thì hỏi. Lịch tháng với chấm trạng thái.

Nghiệm thu: test phím không cháy khi focus nằm trong input. F5 giữ ngày. Reduce-motion không còn class trượt.

#### P1.3 — Nhật ký ngày sổ và khóa phiên bản

Yêu cầu: YC-NT-05, YC-DL-08, YC-NF-07, YC-UI-05, G-04, G-12, G-32.

File: schema ngày sổ, `saveLedger`, `lockLedger`, `unlockLedger`, hàm đồng bộ P0.4, `applyDraft`.

Việc: mỗi ghi có người, thời điểm, nguồn, trước–sau. Mở khóa bắt lý do. Cột `version`. Hai lần lưu cùng version thì lần sau 409.

Nghiệm thu: một ngày qua lưu, chốt, đồng bộ, mở khóa, apply nháp thì lịch sử đủ năm dòng. Không có token trong JSON log.

#### P1.4 — Cài đặt theo ngày và quân số từ sổ chấm cơm

Yêu cầu: YC-DV-02, YC-DV-03, YC-SL-13, YC-NL-02, YC-NL-13.

File: `kitchen-ledger-settings`, `kitchen-ledger-meal-rates.js`, DayAside, module meal-roster.

Việc: ngưỡng và các khóa còn lại hiệu lực theo ngày. Ngày chốt không đọc bản sửa sau. Nguồn quân số roster chỉ khi user chọn. Bỏ khóa định mức đã gỡ ở P0.2 khỏi panel.

Nghiệm thu: đổi ngưỡng từ 01/11, ngày 31/10 đã chốt không đổi cảnh báo. Đổi một ô sổ chấm cơm thì CKTC ngày nháp đổi. Ngày chốt không đổi cho đến khi mở khóa.

#### P1.5 — Ô nhập bù giá gạo và đối soát

Yêu cầu: YC-NL-06, YC-SL-17, G-27.

File: `computeFinance`, DayAside, validator `otherIncome`.

Việc: bù giá gạo là số user nhập, không tự nhân chênh giá, trừ khi chủ xác nhận lại công thức. Danh sách kiểm tra bấm tới dòng.

Nghiệm thu: không nhập thì bù giá gạo bằng 0. Nhập 1000 thì cộng thu tăng 1000. Không còn `mul(mealQty, gap)` trừ khi có cờ chủ.

### P2

#### P2.1 — Đuôi sổ

Yêu cầu: YC-IN-16, YC-SL-15, G-01. Chờ câu 27 (họ tên ký).

File: `kitchen-ledger-month-book.js`, `kitchen_ledger_book.py`.

Việc: 9 trang từ tổng ngày, không nhập số riêng. Giữ `tail: null` đến khi vẽ thật, rồi đổi test.

Nghiệm thu: tháng mẫu ra thu, chi, thừa, tồn gạo bằng tổng `computeLedger` từng ngày.

#### P2.2 — Phiếu xuất kho bếp và sổ theo dõi

Yêu cầu: YC-IN-17, YC-DL-02, YC-DL-03, YC-NL-09, YC-SL-14, G-02.

File: `KitchenPhieuXuatKhoTab.jsx`, `KitchenSoTheoDoiLttpTab.jsx`, frame.

Việc: hai view đọc khung. Sửa SL xuất trên phiếu bếp gọi cùng `saveLedger` phần `mealOut` / I/J. Không sửa G/H.

Nghiệm thu: sửa thịt 5 → 4 trên phiếu xuất bếp thì cột N ngày đó bằng 4 và sổ NX đổi theo.

#### P2.3 — Tịnh kho CSV, nhật ký bếp điện, bàn giao DCCD

Yêu cầu: YC-DL-11, YC-NL-15, YC-IN-17 phần mẫu 21 và mẫu 20.

Chờ mẫu QN25 (G-13). Không bịa khung in.

#### P2.4 — BL-03 rồi mới BL-02

Yêu cầu: YC-AI-11, BL-02, BL-03.

Chỉ bắt đầu khi P0 xong. Màn quy tắc theo đơn vị hoặc sổ, có phiên bản. Không quy tắc thì AI trả lời chưa có quy tắc và không tạo nháp. Nháp cân đối chỉ I/J và apply qua `PUT /ledger`.

#### P2.5 — Đo và truy cập

Yêu cầu: YC-NF-03, YC-UI-08, YC-UI-09, YC-NF-04, YC-NF-06, YC-NF-09.

Đo mở ngày, prefetch, PDF tháng. Axe. Rà secret trong log. Viết một dòng mô tả cho mỗi khóa cài đặt còn lại.

## 8. Việc không làm trong các đợt trên

- Phiếu gạo riêng (BL-01).
- Tự điền quân số theo ngày bay, thứ, hoặc hôm qua.
- Giá tạm, món cân đối tạm, trạng thái chờ phiếu.
- Ghi G/H từ sổ cấp 2 vào phiếu cấp 1.
- Coi merge PR #18 là xong chính sách AI trước khi P0.6 xanh.

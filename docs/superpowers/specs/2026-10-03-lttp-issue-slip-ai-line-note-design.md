# Ghi chú dòng trên AI gợi ý phiếu xuất LTTP

Ngày: 2026-10-03  
Liên quan: `2026-09-26-lttp-issue-slip-ai-suggest-design.md`, cột Ghi chú của phiếu xuất (`lineNote`)  
Approach: **1** — phần mềm tự điền ghi chú theo luật cố định; chat chỉ bật hoặc tắt một rule chung

## Vấn đề

AI gợi ý phiếu xuất điền mặt hàng và số lượng, nhưng cột **Ghi chú** trên từng dòng để trống. Cột này in trên phiếu xuất. Ô chú thích đầu phiếu không nằm trong phạm vi này.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Ô được điền | Cột **Ghi chú** của từng dòng (`lineNote`), tối đa 500 ký tự như form hiện tại |
| Phép tính một lần | `4+6` → số lượng là tổng `10`, ghi chú là `4+6`. Không lưu rule |
| Phần trong ngoặc | `chuối 3kg (30 quả)` → số lượng giữ `3`, ghi chú là `30 quả`. Không lưu rule |
| Rule đổi đơn vị | Chưa có sẵn. User nói trong chat thì lưu một rule chung cho mọi kho cấp 1 |
| Nội dung rule | Khi đơn vị khách nhắn khác đơn vị kho, ghi chú là số lượng gốc kèm đơn vị đó, ví dụ `30 quả` |
| Phạm vi rule | Không gắn mặt hàng, không gắn một cặp đơn vị |
| Lúc nói rule | Điền ngay các dòng đang mở, và các lần gợi ý sau của mọi kho cấp 1 cũng điền |
| Va chạm | Dòng có phép tính thì ghi chú chỉ còn phép tính, kể cả khi có ngoặc hoặc rule đổi đơn vị |
| Câu ghi chú | Do hàm cố định ghép. Model không được bịa chuỗi ghi chú |

Các ví dụ quả/kg chỉ minh họa luật chung, không phải danh sách đơn vị được phép.

## Ngoài phạm vi

- Ô chú thích đầu phiếu (`slipNote`)
- Mẫu ghi chú theo từng mặt hàng hoặc câu cố định kiểu "theo định mức"
- Đổi cách in cột Ghi chú trên phiếu
- Rule cho kho không phải cấp 1

---

## 1. Hàm chọn ghi chú

Một hàm thuần, không gọi model:

```js
lineNoteForItem({
  writtenQty,   // chuỗi khách viết cho số lượng, ví dụ "4+6" hoặc "30"
  writtenUom,   // đơn vị khách nhắn, ví dụ "quả"
  parenText,    // phần trong cặp ngoặc cuối của mặt hàng đó, không gồm dấu ngoặc
  stockUom,     // đơn vị kho
  originalQtyOnConvert, // rule chung đang bật hay không
})
```

Thứ tự:

1. `writtenQty` là phép tính: các số nối bằng `+`, cho phép khoảng trắng và dấu thập phân `,` hoặc `.`. Ghi chú là phép tính sau khi xóa khoảng trắng (`4 + 6` thành `4+6`). Số lượng đưa vào quy đổi là tổng các số hạng. Phép không hợp lệ (thiếu số, chia, nhân) không đi vào nhánh này.
2. Không phải phép tính, và `parenText` sau khi trim không rỗng. Ghi chú là `parenText` cắt còn 500 ký tự. Số lượng giữ đúng số khách viết.
3. Rule `originalQtyOnConvert` đang bật, `writtenQty` là một số, và đơn vị khách nhắn khác đơn vị kho sau khi chuẩn hóa giống cách so đơn vị hiện có. Ghi chú là `{writtenQty} {writtenUom}`, một dấu cách. Thiếu đơn vị khách nhắn thì bỏ nhánh này.
4. Còn lại: ghi chú rỗng.

Cùng đơn vị thì rule không ghi gì. Rule tắt thì nhánh 3 không chạy; nhánh 1 và 2 vẫn chạy.

Khi nhánh 1 khớp và đơn vị khác nhau, tổng được quy đổi sang đơn vị kho bằng rule hệ số đang có. Ghi chú vẫn là phép tính, không phải số đã quy đổi.

## 2. Dữ liệu giữ trên dòng nháp

Parser giữ nguyên token số lượng khách viết trong `writtenQty`, kể cả chuỗi `4+6`. Cột số lượng của dòng là số đã cộng và đã quy đổi, không ghi đè `writtenQty`.

Thêm `parenText` (nullable, tối đa 500 ký tự) trên `LttpAiDraftLine`. Parser lấy cặp ngoặc cuối gắn với mặt hàng đó. `()` rỗng thì để null. Ghi chú hiển thị được tính khi đọc nháp, không lưu một cột ghi chú dẫn xuất.

## 3. Rule chung

Một bản ghi duy nhất, không theo đơn vị nhận và không theo mặt hàng:

- kind cố định: `originalQtyOnConvert`
- `enabled` boolean, mặc định không có bản ghi nghĩa là tắt

Chỉ kho cấp 1 (đơn vị lưu trữ `depth = 0`) đọc rule này, cùng điều kiện với rule quy đổi dùng chung. Kho khác bỏ qua rule dù bản ghi đang bật.

Chat không tạo thêm kind khác. `rule_suggestion.type = "note"` vẫn bị loại, như test hiện tại. Loại được nhận là `line_note` với `enabled: true | false`.

## 4. Chat và lần gợi ý sau

Model trong lượt chat chỉ được trả `rule_suggestion` kiểu `line_note`. Phần mềm không dùng chữ model viết làm ghi chú.

Khi user áp dụng lượt chat đó (hộp thoại đang tự áp dụng nếu có rule):

- Bật hoặc tắt bản ghi `originalQtyOnConvert`
- Trả lại các dòng nháp kèm `lineNote` vừa tính
- Hộp thoại hiện ghi chú mới trên các dòng đang mở

Lần gợi ý sau tính `lineNote` cùng hàm đó trước khi mở hộp thoại.

Hoàn tác lượt chat đưa `enabled` về giá trị trước lượt đó và tính lại ghi chú. Nếu lượt đó tạo bản ghi, hoàn tác xóa bản ghi, giống hoàn tác rule hệ số mới.

Nút **Áp dụng** trên hộp thoại copy `line.lineNote` vào cột Ghi chú của dòng phiếu. Hiện hàm apply đang ghi chuỗi rỗng.

## 5. Lỗi

- Chat không nhận ra rule ghi chú: giữ nháp, trả lời như một lượt chat không đổi rule.
- Phép tính không hợp lệ: không điền ghi chú theo nhánh 1, xét tiếp ngoặc rồi rule.
- Ghi chú dài hơn 500 ký tự: cắt tại 500.

## 6. Kiểm tra

Hàm thuần, mỗi ca một assert:

- `4+6` → ghi chú `4+6`, tổng `10`
- `4 + 6` → ghi chú `4+6`
- `4+6+2` → ghi chú `4+6+2`, tổng `12`
- có ngoặc, không phép tính → ghi chú là phần trong ngoặc
- vừa phép tính vừa ngoặc → ghi chú là phép tính
- rule tắt, đơn vị khác nhau, không phép tính, không ngoặc → ghi chú rỗng
- rule bật, `30` `quả` sang `kg` → ghi chú `30 quả`
- rule bật nhưng cùng đơn vị → ghi chú rỗng
- rule bật và có `4+6 quả` → ghi chú `4+6`, không phải `10 quả`

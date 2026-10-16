# Hệ số thập phân cho AI gợi ý phiếu xuất LTTP

Ngày: 2026-10-05  
Liên quan: `2026-09-26-lttp-issue-slip-ai-suggest-design.md`, `2026-10-03-lttp-issue-slip-ai-line-note-design.md`, `LttpAiUomRule`  
Approach: **1** — phần mềm tự đọc câu user nói ra tỷ lệ; model không được nghĩ ra hệ số

## Vấn đề

User nói với AI một tỷ lệ như «1 quả trứng = 0,0625 kg» hoặc «16 quả = 1 kg». Chat hiện chỉ nhận hệ số nguyên từ 1 đến 500 theo kiểu số trên phiếu = số khách viết × hệ số. 0,0625 bị bỏ, dòng thiếu đơn vị bị hiểu thành cùng con số với đơn vị kho, nên 1 quả thành 1 kg.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|--------|------------|
| Ai đọc tỷ lệ | Hàm cố định. Model không ghi đè hệ số khi hàm đã đọc được câu |
| Hai kiểu câu | «1 quả = 0,0625 kg» và «16 quả = 1 kg» ra cùng hệ số 0,0625 |
| Kết quả trên phiếu | Trứng 10 quả thành 0,625 kg |
| Dòng không ghi đơn vị | Mặc định dùng đơn vị kho. «Trứng 10» là 10 kg cho đến khi user quy định lại |
| Đơn vị ngầm | Chỉ bật khi cùng một câu vừa nói đơn vị thiếu là quả, vừa có tỷ lệ của quả |
| Lưu | Một quy tắc theo mặt hàng, mọi kho cấp 1, đổi ngay dòng đang mở |
| Lần sau | «Trứng 10» thành 0,625 kg, không hỏi lại |
| Hàng hỏi | AI hỏi các dòng nó đã đánh dấu lệch, sau khi mặt hàng đã chọn. User tích thêm dòng chưa đúng ý |
| Không tự hỏi | Dòng không ghi đơn vị không bị đưa vào hàng hỏi |
| Ghi chú dòng | Vẫn theo rule `originalQtyOnConvert` đang có. Rule tắt thì ghi chú không đổi vì tỷ lệ này |
| Số làm tròn | 4 chữ số thập phân |

Ví dụ trứng, quả, kg chỉ minh họa. Mọi mặt hàng dùng cùng luật.

## Ngoài phạm vi

- Tự hỏi mọi dòng thiếu đơn vị
- Ô chú thích đầu phiếu
- Đổi rule học hệ số lúc chốt phiếu (`proposeUomFactor` vẫn chỉ đề xuất hệ số nguyên)
- Kho không phải cấp 1 không đọc quy tắc dùng chung này

---

## 1. Hàm đọc câu

Một hàm thuần:

```js
parseSpokenQtyRule(text, stockUom)
```

`stockUom` là đơn vị kho của mặt hàng đã chọn. Hàm trả `{ fromUom, factor, omitUsesFromUom }` hoặc `null`.

Chuẩn hóa trước khi đọc: gộp khoảng trắng, đổi dấu phẩy thập phân thành dấu chấm, so đơn vị bằng cách bỏ dấu như `normUom` hiện có.

Nhận các dạng, hai vế mỗi vế là một số và một đơn vị:

- `1 quả = 0,0625 kg`
- `16 quả = 1 kg`
- Đổi bên: `1 kg = 16 quả`

Một vế phải trùng `stockUom`. Vế kia là đơn vị khách viết. Hệ số là số lượng đơn vị kho chia cho số lượng đơn vị khách. Sau khi làm tròn 4 chữ số, hệ số phải lớn hơn 0 và không quá 500. Hai vế cùng đơn vị, thiếu số, hoặc không vế nào trùng đơn vị kho thì trả `null`.

`omitUsesFromUom` là true khi cùng một tin nhắn có tỷ lệ và có ý «không ghi đơn vị» hoặc «không có đơn vị tính» chỉ ra đúng `fromUom` (ví dụ «đơn vị tính là quả»). Dấu chấm giữa hai ý trong cùng tin nhắn không chặn cờ. Câu chỉ có tỷ lệ thì cờ là false.

## 2. Gắn mặt hàng

Thứ tự:

1. Đang có dòng trong hàng hỏi, hoặc dòng user vừa tích, và dòng đó đã chọn mặt hàng. Dùng mặt hàng đó.
2. Không có dòng đó. Tên mặt hàng đã chọn, sau khi chuẩn hóa, xuất hiện nguyên cụm trong câu, và chỉ một dòng đang mở thỏa điều kiện đó. «Trứng» không khớp mặt hàng «trứng gà». Dùng dòng đó.
3. Còn lại: không lưu, không đổi số lượng. Chat nói chưa khớp một mặt hàng.

Hai dòng cùng khớp tên thì đi vào nhánh 3.

## 3. Lưu và áp dụng

Ghi vào `LttpAiUomRule`, `sharedLevel1 = true`, `confirmed = true`, `commodityNameNorm` là tên mặt hàng đã chuẩn hóa. `fromUom` là đơn vị khách. `factor` là hệ số đã làm tròn 4 chữ số. Thêm cột boolean `omitUsesFromUom`, mặc định false.

Câu không bật cờ thì lần ghi đè không đổi cờ đang có. Câu bật cờ thì bật cờ của quy tắc `fromUom` này và tắt cờ ở các quy tắc dùng chung khác của cùng mặt hàng.

Đơn vị kho trong câu không trùng đơn vị mặt hàng thì không lưu, dòng giữ nguyên, chat nói đơn vị không khớp mặt hàng.

Số lượng dòng đang mở = số khách viết × hệ số, làm tròn 4 chữ số, đơn vị dòng thành đơn vị kho. Dòng vốn không có đơn vị và cờ vừa bật thì ghi `writtenUom` là đơn vị ngầm, giữ `writtenQty` là số khách viết. «Trứng 10» sau quy tắc quả / 0,0625 thành số lượng 0,625 kg, `writtenUom` là quả.

Quy tắc số nguyên như 1 thùng = 12 đi qua cùng hàm, hệ số 12.

Chỉ kho cấp 1 (`depth = 0`) nạp quy tắc dùng chung, cùng điều kiện `loadConfirmedQtyRules`. Khi dòng không có đơn vị và mặt hàng có đúng một quy tắc `omitUsesFromUom`, coi đơn vị khách viết là `fromUom` của quy tắc đó rồi nhân hệ số. Có hai quy tắc cùng bật cờ thì không suy đơn vị ngầm. Dòng đã ghi đúng `fromUom` cũng nhân hệ số đó. Dòng ghi sẵn đơn vị kho thì giữ nguyên số.

Ghi chú dòng không do hàm này viết. Rule ghi số lượng gốc khi đổi đơn vị, nếu đang bật, thấy `writtenQty` và `writtenUom` khác đơn vị kho thì ghi «10 quả».

## 4. Hàng hỏi và ô tích

Giữ hàng hỏi hiện có: chọn mặt hàng trước, rồi hỏi dòng AI đã đánh dấu lệch. Dòng không ghi đơn vị không được thêm vào hàng này chỉ vì thiếu đơn vị.

Mỗi dòng trong hộp gợi ý có ô «Chưa đúng». Tích thì đưa dòng vào cùng hàng, nếu chưa có. AI hỏi «{tên mặt hàng} chưa đúng chỗ nào?». User trả lời trong chat. Hàm đọc được tỷ lệ thì đổi dòng và lưu, rồi hỏi dòng kế. Hàm trả `null` thì dòng giữ nguyên và chat nói chưa nhận ra quy đổi. Các ý chat khác (bật ghi chú dòng, quy tắc hệ số nguyên model vẫn trả khi hàm không đọc được câu) giữ như hiện tại.

## 5. Hoàn tác

Lượt chat lưu `ruleId`, hệ số và cờ trước khi ghi, và cờ `ruleCreated`. Hoàn tác trả số lượng dòng về trước. Quy tắc do lượt đó tạo thì xóa. Quy tắc đã có thì trả lại hệ số và `omitUsesFromUom` trước đó, kể cả các cờ mặt hàng đã tắt ở lượt này.

## 6. Kiểm tra

- «1 quả = 0,0625 kg» và «16 quả = 1 kg» đều ra hệ số 0,0625 khi đơn vị kho là kg
- 10 quả thành 0,625, không thành 0,6
- «Trứng 10» chưa có cờ thì số lượng là 10, đơn vị kho
- Sau khi cờ bật, «trứng 10» thành 0,625 kg và `writtenUom` là quả
- «1 thùng = 12» vẫn ra hệ số 12
- Đơn vị không khớp mặt hàng, hoặc hai mặt hàng cùng khớp, thì không lưu
- Câu chỉ có tỷ lệ không bật cờ trên quy tắc đang tắt
- Hoàn tác trả hệ số và cờ cũ; lượt tạo mới thì hết bản ghi

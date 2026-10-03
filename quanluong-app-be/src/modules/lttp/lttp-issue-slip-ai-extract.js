function buildExtractPrompt({ text, examples = [] }) {
  const shots = examples
    .slice(0, 3)
    .map((example) => `Tin: ${example.rawText}\nKet qua: ${JSON.stringify(example.items || [])}`)
    .join("\n");
  return {
    system:
      "Tach tin dat hang thanh JSON {\"items\":[{\"name\":\"\",\"quantity\":\"\",\"uom\":\"\"}]}. Giu dung tu khach viet. Neu khach viet phep cong nhu 4+6, quantity giu dung chu 4+6, khong tinh tong. Neu co ngoac, giu ngoac trong name. Khong doi ten hang, khong quy doi don vi, khong them dong khach khong viet.",
    user: `${shots ? `Vi du da xac nhan:\n${shots}\n` : ""}Tin:\n${text}`,
  };
}

function buildPickPrompt({ name, choices }) {
  const lines = (choices || [])
    .map((choice) => `${choice.commodityId} | ${choice.name} | ${choice.stat || ""}`)
    .join("\n");
  return {
    system:
      "Chon dung 1 SKU trong danh sach. Tra JSON {\"sku\":number,\"conf\":number tu 0 den 1}. sku phai nam trong danh sach. Khong giai thich.",
    user: `Khach viet: ${name}\nUng vien:\n${lines}`,
  };
}

function buildDraftPatchPrompt({ rawText, lines, message }) {
  const body = (lines || [])
    .map((line) => {
      const choices = (line.choices || [])
        .map((choice) => `${choice.commodityId}:${choice.name}`)
        .join(", ");
      return `${line.id} | sku ${line.commodityId ?? ""} | ${line.commodityName || line.rawName || ""} | sl ${line.quantity ?? ""} | ${line.measureUnit || ""} | ung vien ${choices}`;
    })
    .join("\n");
  return {
    system:
      'User dang neu quy tac quy doi don vi, khong sua ten hay so luong tuy y. Tra JSON {"explanation":"","patch":[],"rule_suggestion":{"type":"qty","fromUom":"","factor":1,"line_id":null}}. fromUom la don vi khach viet. factor so nguyen 1 den 500: so luong don vi he thong = so khach ghi x factor. line_id la dong neu quy tac cho mot mat hang, null neu cho moi dong da chon. Khong doi SKU. explanation ngan, nhac don vi he thong sau quy doi. Neu user muon ghi so luong goc vao ghi chu moi khi doi don vi, hoac muon tat viec do, tra rule_suggestion {"type":"line_note","enabled":true} hoac enabled false. patch de rong. Khong tu viet cau ghi chu.',
    user: `Tin goc:\n${rawText}\nDong da chon:\n${body}\nChat:\n${message}`,
  };
}

export { buildDraftPatchPrompt, buildExtractPrompt, buildPickPrompt };

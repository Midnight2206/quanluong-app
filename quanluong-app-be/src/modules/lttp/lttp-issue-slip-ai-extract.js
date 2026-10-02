function buildExtractPrompt({ text, examples = [] }) {
  const shots = examples
    .slice(0, 3)
    .map((example) => `Tin: ${example.rawText}\nKet qua: ${JSON.stringify(example.items || [])}`)
    .join("\n");
  return {
    system:
      "Tach tin dat hang thanh JSON {\"items\":[{\"name\":\"\",\"quantity\":\"\",\"uom\":\"\"}]}. Giu dung tu khach viet. Khong doi ten hang, khong quy doi don vi, khong them dong khach khong viet.",
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
      'Sua cac dong da chon. Tra JSON {"explanation":"","patch":[{"line_id":0,"sku_id":null,"qty":null,"unit":null}],"rule_suggestion":null}. Chi dung line_id duoc gui. sku_id phai nam trong ung vien hoac sku hien tai. Ghi unit dung tu nguoi dung, khong quy doi. explanation ngan. rule_suggestion chi khi nguoi dung neu quy tac ap dung lan sau: {"type":"alias","raw":"","commodityId":0} hoac {"type":"uom","fromUom":"","factor":0,"commodityId":null}.',
    user: `Tin goc:\n${rawText}\nDong da chon:\n${body}\nChat:\n${message}`,
  };
}

export { buildDraftPatchPrompt, buildExtractPrompt, buildPickPrompt };

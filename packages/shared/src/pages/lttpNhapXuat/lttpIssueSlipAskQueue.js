export function withUserAsk(lines, index) {
  const line = lines?.[index];
  if (!line?.commodityId) {
    return lines;
  }
  return (lines || []).map((item, i) => (i === index ? { ...item, askUser: true } : item));
}

export function clearUserAsk(lines, index) {
  if (!lines?.[index]?.askUser) return lines;
  return lines.map((item, i) => (i === index ? { ...item, askUser: false } : item));
}

export function userAskQuestions(lines) {
  return (lines || []).flatMap((line, lineIndex) => {
    if (!line.askUser || !line.commodityId) return [];
    const name = line.commodityName || line.rawName || "Mặt hàng";
    return [
      {
        key: `user:${line.draftLineId ?? lineIndex}`,
        lineIndex,
        draftLineId: line.draftLineId ?? null,
        text: `${name} chưa đúng chỗ nào?`,
      },
    ];
  });
}

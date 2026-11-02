/** Khớp kitchen-ledger-meal-rates.js — phần dư lớn nhất, tổng = mức tiền ăn. */
const KEYS = ["sang", "trua", "chieu"];

export function percentsToAmounts(mucTienAn, percents) {
  const total = Math.floor(Number(mucTienAn));
  const floors = KEYS.map((key) => {
    const share = (total * Number(percents?.[key] || 0)) / 100;
    return { key, amount: Math.floor(share), frac: share - Math.floor(share) };
  });
  let remain = total - floors.reduce((sum, row) => sum + row.amount, 0);
  const order = [...floors].sort((a, b) => b.frac - a.frac || KEYS.indexOf(a.key) - KEYS.indexOf(b.key));
  for (let i = 0; i < remain; i += 1) order[i % order.length].amount += 1;
  return Object.fromEntries(floors.map((row) => [row.key, row.amount]));
}

export function percentSum(percents) {
  const nums = KEYS.map((key) => Number(percents?.[key]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return Math.round(nums.reduce((sum, n) => sum + n, 0) * 100) / 100;
}

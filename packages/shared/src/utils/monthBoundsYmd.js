/**
 * @param {string} yearMonth `YYYY-MM`
 * @returns {{ from: string, to: string, month: string }}
 */
export function monthBoundsYmd(yearMonth) {
  const month = String(yearMonth || "").slice(0, 7);
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new Error("monthBoundsYmd expects YYYY-MM");
  }
  const year = Number(match[1]);
  const mo = Number(match[2]);
  const last = new Date(Date.UTC(year, mo, 0)).getUTCDate();
  return {
    month,
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

/** Tháng hiện tại theo Asia/Ho_Chi_Minh (`YYYY-MM`). */
export function currentMonthYmd(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now).slice(0, 7);
}

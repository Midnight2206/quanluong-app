const FIELD_RE = /^(\*|\*\/\d+|\d+(-\d+)?(\/\d+)?)(,(\*|\*\/\d+|\d+(-\d+)?(\/\d+)?))*$/;

function partMatches(part, value, allowSeven) {
  if (part === "*") return true;
  const step = part.match(/^\*\/(\d+)$/);
  if (step) {
    const n = Number(step[1]);
    return n > 0 && value % n === 0;
  }
  const range = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    const every = range[3] ? Number(range[3]) : 1;
    if (every < 1 || start > end) return false;
    return value >= start && value <= end && (value - start) % every === 0;
  }
  if (/^\d+$/.test(part)) {
    const n = Number(part);
    return n === value || (allowSeven && value === 0 && n === 7);
  }
  return false;
}

function fieldMatches(field, value, allowSeven = false) {
  return String(field).split(",").some((part) => partMatches(part, value, allowSeven));
}

export function cronMatches(expr, date) {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5 || !parts.every((part) => FIELD_RE.test(part))) return false;
  const when = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(when.getTime())) return false;
  const checks = [
    [parts[0], when.getUTCMinutes(), false],
    [parts[1], when.getUTCHours(), false],
    [parts[2], when.getUTCDate(), false],
    [parts[3], when.getUTCMonth() + 1, false],
    [parts[4], when.getUTCDay(), true],
  ];
  return checks.every(([field, value, allowSeven]) => fieldMatches(field, value, allowSeven));
}

// ponytail: minute scan, 8-day ceiling. Replace with a cron library if schedules need months-long gaps.
export function nextRun(expr, from, limit = 60 * 24 * 8) {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCSeconds(0, 0);
  for (let step = 1; step <= limit; step += 1) {
    const candidate = new Date(start.getTime() + step * 60_000);
    if (cronMatches(expr, candidate)) return candidate.toISOString();
  }
  return null;
}

export function assertCron(expr) {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5 || !parts.every((part) => FIELD_RE.test(part)) || !nextRun(expr, new Date().toISOString())) {
    const error = new Error("Cron must be 5 fields and must fire within 8 days");
    error.status = 400;
    error.code = "BAD_CRON";
    throw error;
  }
}

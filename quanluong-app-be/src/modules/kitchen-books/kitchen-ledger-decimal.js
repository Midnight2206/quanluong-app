/**
 * Số sổ nhập xuất: đúng tới 6 chữ thập phân, không làm tròn khi cộng/nhân giá nguyên.
 * ponytail: thang 10^6. Giá có quá 6 số lẻ thì nâng thang hoặc chuyển decimal.js.
 */
const SCALE = 1000000n;

function toScaled(value) {
  if (typeof value === "bigint") return value;
  if (value == null || value === "") return 0n;
  let s = typeof value === "number" ? value.toFixed(6) : String(value).trim();
  s = s.replace(/\s/g, "").replace(",", ".");
  if (!s || s === "–" || s === "—" || s === "-") return 0n;
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return 0n;
  const [whole, frac = ""] = s.split(".");
  const v = BigInt(whole) * SCALE + BigInt((frac + "000000").slice(0, 6));
  return neg ? -v : v;
}

function scaledToString(value) {
  const neg = value < 0n;
  const x = neg ? -value : value;
  const whole = x / SCALE;
  const frac = (x % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : `${whole}`;
  return neg && value !== 0n ? `-${body}` : body;
}

function add(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}

/** (a/SCALE) * (b/SCALE) = (a*b)/SCALE^2, trả về thang SCALE. */
function mul(a, b) {
  return (a * b) / SCALE;
}

/** scaled / số (ví dụ kg = gram / 1000). */
function divByNumber(scaled, divisor) {
  const d = toScaled(divisor);
  if (d === 0n) return 0n;
  return (scaled * SCALE) / d;
}

function min(a, b) {
  return a < b ? a : b;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function roundHalfUpToStep(value, step) {
  if (step <= 0n) return value;
  const half = step / 2n;
  return ((value + half) / step) * step;
}

function roundUpToStep(value, step) {
  if (value <= 0n) return 0n;
  if (step <= 0n) return value;
  return ((value + step - 1n) / step) * step;
}

export {
  SCALE,
  toScaled,
  scaledToString,
  add,
  sub,
  mul,
  divByNumber,
  min,
  cmp,
  roundHalfUpToStep,
  roundUpToStep,
};

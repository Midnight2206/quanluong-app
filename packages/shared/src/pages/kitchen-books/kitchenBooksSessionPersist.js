/**
 * SessionStorage UI state cho /so-sach-bep-an — không chứa bí mật.
 */

const KEYS = {
  manualUnitId: "quanluong:kitchen-books:manual-unit-id",
  receiptDate: "quanluong:kitchen-books:receipt-date",
  menuDate: "quanluong:kitchen-books:menu-date",
  yearMonth: "quanluong:kitchen-books:year-month",
  menuAllowance: "quanluong:kitchen-books:menu-allowance",
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;

function readPositiveInt(key) {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null || raw === "") {
      return null;
    }
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeString(key, value) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    if (value == null || value === "") {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, String(value));
  } catch {
    /* ignore quota */
  }
}

function readMatchingString(key, re) {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(key);
    if (typeof raw === "string" && re.test(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readStoredKitchenManualUnitId() {
  return readPositiveInt(KEYS.manualUnitId);
}

export function writeStoredKitchenManualUnitId(unitId) {
  if (unitId == null) {
    writeString(KEYS.manualUnitId, null);
    return;
  }
  const n = Number(unitId);
  writeString(KEYS.manualUnitId, Number.isInteger(n) && n > 0 ? n : null);
}

export function readStoredKitchenReceiptDate() {
  return readMatchingString(KEYS.receiptDate, YMD_RE);
}

export function writeStoredKitchenReceiptDate(ymd) {
  writeString(KEYS.receiptDate, typeof ymd === "string" && YMD_RE.test(ymd) ? ymd : null);
}

export function readStoredKitchenMenuDate() {
  return readMatchingString(KEYS.menuDate, YMD_RE);
}

export function writeStoredKitchenMenuDate(ymd) {
  writeString(KEYS.menuDate, typeof ymd === "string" && YMD_RE.test(ymd) ? ymd : null);
}

export function readStoredKitchenYearMonth() {
  return readMatchingString(KEYS.yearMonth, YM_RE);
}

export function writeStoredKitchenYearMonth(ym) {
  writeString(KEYS.yearMonth, typeof ym === "string" && YM_RE.test(ym) ? ym : null);
}

/** @returns {{ rateId: number|null, amountPerPerson: number|null }} */
export function readStoredKitchenMenuAllowance() {
  if (typeof sessionStorage === "undefined") {
    return { rateId: null, amountPerPerson: null };
  }
  try {
    const raw = sessionStorage.getItem(KEYS.menuAllowance);
    if (!raw) {
      return { rateId: null, amountPerPerson: null };
    }
    const o = JSON.parse(raw);
    const rateId = Number(o?.rateId);
    const amountPerPerson = Number(o?.amountPerPerson);
    return {
      rateId: Number.isInteger(rateId) && rateId > 0 ? rateId : null,
      amountPerPerson: Number.isFinite(amountPerPerson) && amountPerPerson >= 0 ? amountPerPerson : null,
    };
  } catch {
    return { rateId: null, amountPerPerson: null };
  }
}

/** @param {{ rateId?: number|null, amountPerPerson?: number|null }} value */
export function writeStoredKitchenMenuAllowance(value) {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    const rateId = value?.rateId != null ? Number(value.rateId) : null;
    const amountPerPerson = value?.amountPerPerson != null ? Number(value.amountPerPerson) : null;
    if ((rateId == null || !Number.isInteger(rateId)) && (amountPerPerson == null || !Number.isFinite(amountPerPerson))) {
      sessionStorage.removeItem(KEYS.menuAllowance);
      return;
    }
    sessionStorage.setItem(
      KEYS.menuAllowance,
      JSON.stringify({
        rateId: Number.isInteger(rateId) && rateId > 0 ? rateId : null,
        amountPerPerson:
          Number.isFinite(amountPerPerson) && amountPerPerson >= 0 ? amountPerPerson : null,
      }),
    );
  } catch {
    /* ignore */
  }
}

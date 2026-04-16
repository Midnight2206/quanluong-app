import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { assertUnitIdInScope, entityUnitIdWhere } from "../../shared/units/unit-scope.service.js";

const MAX_IMPORT_ROWS = 2000;

const ROSTER_RATE_INCLUDE = {
  select: { id: true, doiTuong: true, mucTienAn: true, type: true },
};

function assertWriteUnit(unitId, scope, effectiveUnitIds) {
  assertUnitIdInScope(unitId, scope);
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.includes(Number(unitId))
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (kiểm tra X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

function normalizeDoiTuong(doiTuong) {
  return String(doiTuong ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mealTypeTag(type) {
  return type === "an_them" ? "Ăn thêm" : "Ăn tiêu chuẩn";
}

function buildRateLabelsForRows(rows) {
  const used = new Set();
  return rows.map((r) => {
    let label = `[${mealTypeTag(r.type)}] ${normalizeDoiTuong(r.doiTuong)} (${r.mucTienAn} đ)`;
    if (used.has(label)) {
      label = `[${mealTypeTag(r.type)}] ${normalizeDoiTuong(r.doiTuong)} (${r.mucTienAn} đ) [#${r.id}]`;
    }
    used.add(label);
    return { id: r.id, label, doiTuong: r.doiTuong, mucTienAn: r.mucTienAn, type: r.type };
  });
}

async function getSelectedRateIdsForUnit(unitId) {
  const rows = await prisma.unitSelectedMealRate.findMany({
    where: { unitId },
    select: { mealAllowanceRateId: true },
  });
  return rows.map((r) => r.mealAllowanceRateId);
}

/** Chia đều `totalM` (đồng) cho 3 buổi, phần dư gán S → T → C. */
function equalSplitThreePeriods(totalM) {
  const M = Math.max(0, Math.floor(Number(totalM)));
  const base = Math.floor(M / 3);
  let rem = M - base * 3;
  const out = { sang: base, trua: base, chieu: base };
  const order = ["sang", "trua", "chieu"];
  for (let i = 0; i < rem; i += 1) {
    out[order[i]] += 1;
  }
  return out;
}

function parseRawPeriodAmounts(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const sang = Math.round(Number(raw.sang));
  const trua = Math.round(Number(raw.trua));
  const chieu = Math.round(Number(raw.chieu));
  if (![sang, trua, chieu].every((n) => Number.isInteger(n) && n >= 0)) {
    return null;
  }
  return { sang, trua, chieu };
}

/** Điều chỉnh tổng = targetTotal (đồng), giữ tỉ lệ gần đúng. */
function rescalePeriodAmountsToTotal(periods, targetTotal) {
  const M = Math.max(0, Math.floor(Number(targetTotal)));
  const s = periods.sang + periods.trua + periods.chieu;
  if (s <= 0) {
    return equalSplitThreePeriods(M);
  }
  const fr = [
    { k: "sang", share: (M * periods.sang) / s },
    { k: "trua", share: (M * periods.trua) / s },
    { k: "chieu", share: (M * periods.chieu) / s },
  ];
  const floors = fr.map((x) => ({ k: x.k, f: Math.floor(x.share), frac: x.share - Math.floor(x.share) }));
  let sumF = floors.reduce((a, x) => a + x.f, 0);
  let rem = M - sumF;
  floors.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < rem; i += 1) {
    floors[i % floors.length].f += 1;
  }
  const byKey = Object.fromEntries(floors.map((x) => [x.k, x.f]));
  return { sang: byKey.sang, trua: byKey.trua, chieu: byKey.chieu };
}

function normalizePeriodAmountsFromStorage(raw, mucTienAn) {
  const M = Math.floor(Number(mucTienAn));
  if (!Number.isFinite(M) || M < 0) {
    return { sang: 0, trua: 0, chieu: 0 };
  }
  const parsed = parseRawPeriodAmounts(raw);
  if (!parsed) {
    return equalSplitThreePeriods(M);
  }
  const sum = parsed.sang + parsed.trua + parsed.chieu;
  if (sum === M) {
    return parsed;
  }
  if (sum > 0) {
    return rescalePeriodAmountsToTotal(parsed, M);
  }
  return equalSplitThreePeriods(M);
}

function assertValidPeriodAmountsForSave(periodAmounts, mucTienAn, rateId) {
  const M = Math.floor(Number(mucTienAn));
  const p = parseRawPeriodAmounts(periodAmounts);
  if (!p) {
    throw new AppError({
      message: `Mức #${rateId}: chia buổi (sang, trua, chieu) phải là số nguyên ≥ 0`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (p.sang + p.trua + p.chieu !== M) {
    throw new AppError({
      message: `Mức #${rateId}: tổng S + T + C phải bằng ${M.toLocaleString("vi-VN")} đ/ngày (theo Thông tư)`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return p;
}

function todayYmdLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastYmdOfYearMonth(ym) {
  const [yStr, mStr] = String(ym).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return todayYmdLocal();
  }
  const last = new Date(y, m, 0).getDate();
  return `${yStr}-${mStr}-${String(last).padStart(2, "0")}`;
}

function parseYmdToUtcDate(ymd) {
  const parts = String(ymd).split("-").map(Number);
  if (parts.length !== 3) {
    return null;
  }
  const [y, mo, da] = parts;
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(da)) {
    return null;
  }
  return new Date(Date.UTC(y, mo - 1, da));
}

function formatYmdUtc(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    return "1970-01-01";
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parsePeriodSplitValidFromYmd(raw) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }
  const d = parseYmdToUtcDate(raw);
  if (!d) {
    return null;
  }
  return { ymd: raw, date: d };
}

function resolvePeriodAmountsFromVersionRows(versionRows, mucTienAn, asOfYmd) {
  const sorted = [...versionRows].sort((a, b) =>
    formatYmdUtc(a.validFrom).localeCompare(formatYmdUtc(b.validFrom)),
  );
  let chosenRaw = null;
  for (const row of sorted) {
    const vf = formatYmdUtc(row.validFrom);
    if (vf <= asOfYmd) {
      chosenRaw = row.periodAmountsJson;
    }
  }
  return normalizePeriodAmountsFromStorage(chosenRaw, mucTienAn);
}

function buildPeriodSplitVersionsPayload(rowsForRate, mucTienAn) {
  return rowsForRate.map((row) => ({
    validFrom: formatYmdUtc(row.validFrom),
    periodAmounts: normalizePeriodAmountsFromStorage(row.periodAmountsJson, mucTienAn),
  }));
}

/**
 * @param {number} unitId
 * @param {{ referenceYmd?: string, versionsCutoffYmd?: string, includeVersionHistory?: boolean }} [listOptions]
 */
async function listSelectedRatesWithLabels(unitId, listOptions = {}) {
  const referenceYmd = listOptions.referenceYmd ?? todayYmdLocal();
  const versionsCutoffYmd = listOptions.versionsCutoffYmd ?? referenceYmd;
  const includeVersionHistory = listOptions.includeVersionHistory ?? false;

  const links = await prisma.unitSelectedMealRate.findMany({
    where: { unitId },
    select: { mealAllowanceRateId: true },
  });
  if (links.length === 0) {
    return [];
  }
  const ids = links.map((l) => l.mealAllowanceRateId);
  const cutoffDate = parseYmdToUtcDate(versionsCutoffYmd);
  if (!cutoffDate) {
    throw new AppError({
      message: "Ngày tham chiếu tỉ lệ không hợp lệ",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }

  const [rows, splitRows] = await Promise.all([
    prisma.mealAllowanceRate.findMany({
      where: { id: { in: ids } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.unitMealPeriodSplit.findMany({
      where: {
        unitId,
        mealAllowanceRateId: { in: ids },
        validFrom: { lte: cutoffDate },
      },
      orderBy: [{ mealAllowanceRateId: "asc" }, { validFrom: "asc" }],
    }),
  ]);

  const splitsByRate = new Map();
  for (const sid of ids) {
    splitsByRate.set(sid, []);
  }
  for (const s of splitRows) {
    const list = splitsByRate.get(s.mealAllowanceRateId);
    if (list) {
      list.push(s);
    }
  }

  const base = buildRateLabelsForRows(rows);
  return base.map((r) => {
    const rowsForRate = splitsByRate.get(r.id) ?? [];
    const periodAmounts = resolvePeriodAmountsFromVersionRows(rowsForRate, r.mucTienAn, referenceYmd);
    const out = {
      ...r,
      periodAmounts,
    };
    if (includeVersionHistory) {
      out.periodSplitVersions = buildPeriodSplitVersionsPayload(rowsForRate, r.mucTienAn);
    }
    return out;
  });
}

async function listSelectedStandardRatesWithLabels(unitId) {
  const t = todayYmdLocal();
  const all = await listSelectedRatesWithLabels(unitId, {
    referenceYmd: t,
    versionsCutoffYmd: t,
    includeVersionHistory: false,
  });
  const std = all.filter((r) => r.type === "an_tieu_chuan");
  const used = new Set();
  return std.map((r) => {
    let label = `${normalizeDoiTuong(r.doiTuong)} (${r.mucTienAn} đ)`;
    if (used.has(label)) {
      label = `${normalizeDoiTuong(r.doiTuong)} (${r.mucTienAn} đ) [#${r.id}]`;
    }
    used.add(label);
    return {
      id: r.id,
      label,
      doiTuong: r.doiTuong,
      mucTienAn: r.mucTienAn,
      type: r.type,
      periodAmounts: r.periodAmounts,
    };
  });
}

async function listAllMealRatesForCatalog() {
  const rows = await prisma.mealAllowanceRate.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return buildRateLabelsForRows(rows);
}

async function putUnitSelectedMealRates(unitId, payload, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const selectionsIn =
    Array.isArray(payload.selections) && payload.selections.length > 0
      ? payload.selections
      : Array.isArray(payload.mealAllowanceRateIds)
        ? payload.mealAllowanceRateIds.map((id) => ({ mealAllowanceRateId: id }))
        : [];
  if (selectionsIn.length === 0) {
    throw new AppError({
      message: "Chọn ít nhất một mức tiền ăn",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const byId = new Map();
  for (const s of selectionsIn) {
    const id = Number(s.mealAllowanceRateId);
    if (Number.isInteger(id) && id > 0) {
      byId.set(id, s);
    }
  }
  const uniq = [...byId.keys()];
  if (uniq.length === 0) {
    throw new AppError({
      message: "Chọn ít nhất một mức tiền ăn",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const existing = await prisma.mealAllowanceRate.findMany({
    where: { id: { in: uniq } },
    select: { id: true, mucTienAn: true },
  });
  if (existing.length !== uniq.length) {
    throw new AppError({
      message: "Có mã mức tiền ăn không tồn tại",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const mucById = new Map(existing.map((r) => [r.id, r.mucTienAn]));
  const parsedVf = parsePeriodSplitValidFromYmd(payload.periodSplitValidFrom) ?? {
    ymd: todayYmdLocal(),
    date: parseYmdToUtcDate(todayYmdLocal()),
  };
  if (!parsedVf.date) {
    throw new AppError({
      message: "periodSplitValidFrom không hợp lệ (YYYY-MM-DD)",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const validFromYmd = parsedVf.ymd;
  const vfDate = parsedVf.date;

  await prisma.$transaction(async (tx) => {
    await tx.unitMealPeriodSplit.deleteMany({
      where: { unitId, mealAllowanceRateId: { notIn: uniq } },
    });
    await tx.unitSelectedMealRate.deleteMany({ where: { unitId } });
    await tx.unitSelectedMealRate.createMany({
      data: uniq.map((mealAllowanceRateId) => ({ unitId, mealAllowanceRateId })),
    });

    for (const rateId of uniq) {
      const sel = byId.get(rateId);
      const M = mucById.get(rateId);
      const pa =
        sel.periodAmounts != null
          ? assertValidPeriodAmountsForSave(sel.periodAmounts, M, rateId)
          : equalSplitThreePeriods(M);

      const prevRow = await tx.unitMealPeriodSplit.findFirst({
        where: {
          unitId,
          mealAllowanceRateId: rateId,
          validFrom: { lt: vfDate },
        },
        orderBy: { validFrom: "desc" },
      });
      if (prevRow) {
        const prevNorm = normalizePeriodAmountsFromStorage(prevRow.periodAmountsJson, M);
        if (prevNorm.sang === pa.sang && prevNorm.trua === pa.trua && prevNorm.chieu === pa.chieu) {
          continue;
        }
      }

      await tx.unitMealPeriodSplit.upsert({
        where: {
          unitId_mealAllowanceRateId_validFrom: {
            unitId,
            mealAllowanceRateId: rateId,
            validFrom: vfDate,
          },
        },
        create: {
          unitId,
          mealAllowanceRateId: rateId,
          validFrom: vfDate,
          periodAmountsJson: pa,
        },
        update: {
          periodAmountsJson: pa,
        },
      });
    }
  });

  return listSelectedRatesWithLabels(unitId, {
    referenceYmd: validFromYmd,
    versionsCutoffYmd: validFromYmd,
    includeVersionHistory: true,
  });
}

async function assertMealAllowanceRateIdForUnit(unitId, rateId) {
  const link = await prisma.unitSelectedMealRate.findFirst({
    where: { unitId, mealAllowanceRateId: rateId },
    select: { id: true },
  });
  if (!link) {
    const count = await prisma.unitSelectedMealRate.count({ where: { unitId } });
    if (count === 0) {
      throw new AppError({
        message:
          "Đơn vị chưa chọn mức tiền ăn áp dụng — mở tab «Sổ chấm cơm» và bấm «Chọn mức tiền ăn cho đơn vị».",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    throw new AppError({
      message: "Mức tiền ăn không nằm trong tập đã chọn cho đơn vị",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function assertStandardMealRateForGuaranty(unitId, rateId) {
  await assertMealAllowanceRateIdForUnit(unitId, rateId);
  const r = await prisma.mealAllowanceRate.findUnique({
    where: { id: rateId },
    select: { type: true },
  });
  if (r?.type !== "an_tieu_chuan") {
    throw new AppError({
      message: "Danh sách bảo đảm và nhập Excel chỉ dùng mức «ăn tiêu chuẩn»",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

async function assertRateIdsInUnitSelection(unitId, ids) {
  const uniq = [...new Set(ids)].filter((x) => x != null);
  if (uniq.length === 0) {
    return;
  }
  const selected = new Set(await getSelectedRateIdsForUnit(unitId));
  if (selected.size === 0) {
    throw new AppError({
      message: "Đơn vị chưa chọn mức tiền ăn áp dụng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  for (const id of uniq) {
    if (!selected.has(id)) {
      throw new AppError({
        message: "Có mức tiền ăn ngoài tập đã chọn cho đơn vị",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }
}

function daysInMonthFromYearMonth(ym) {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return 31;
  }
  return new Date(y, m, 0).getDate();
}

const MEAL_PERIOD_ORDER = ["sang", "trua", "chieu"];
const DEFAULT_EXTRA_SPLIT_PERIODS = ["sang", "trua", "chieu"];

function sortPeriodsCanonical(periods) {
  const uniq = [...new Set(periods)];
  return uniq.sort((a, b) => MEAL_PERIOD_ORDER.indexOf(a) - MEAL_PERIOD_ORDER.indexOf(b));
}

function parsePeriodsFromJson(raw) {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_EXTRA_SPLIT_PERIODS];
  }
  const out = [];
  for (const p of raw) {
    if (p === "sang" || p === "trua" || p === "chieu") {
      out.push(p);
    }
  }
  const sorted = sortPeriodsCanonical(out);
  return sorted.length > 0 ? sorted : [...DEFAULT_EXTRA_SPLIT_PERIODS];
}

function isDefaultExtraSplitPeriods(periods) {
  const p = sortPeriodsCanonical(periods);
  return (
    p.length === 3 && p[0] === "sang" && p[1] === "trua" && p[2] === "chieu"
  );
}

function validateExtraSplitPeriodsInput(periods, label) {
  if (!Array.isArray(periods)) {
    throw new AppError({
      message: `${label}: periods phải là mảng`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const p = sortPeriodsCanonical(periods);
  if (p.length < 1 || p.length > 3) {
    throw new AppError({
      message: `${label}: chọn từ 1 đến 3 buổi (sang, trua, chieu)`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  for (const x of periods) {
    if (x !== "sang" && x !== "trua" && x !== "chieu") {
      throw new AppError({
        message: `${label}: giá trị buổi không hợp lệ`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }
  if (p.length !== new Set(p).size) {
    throw new AppError({
      message: `${label}: không trùng buổi trong cùng ngày`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return p;
}

async function listMealRosterDayMarks(unitId, yearMonth, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const entryWhere = {
    unitId,
    yearMonth,
    ...entityUnitIdWhere(scope, effectiveUnitIds),
  };
  const [marks, extraMarks, splitRows] = await Promise.all([
    prisma.mealRosterDayMark.findMany({
      where: { mealRosterEntry: entryWhere },
      select: {
        mealRosterEntryId: true,
        dayOfMonth: true,
        mealPeriod: true,
        mealAllowanceRateId: true,
      },
    }),
    prisma.mealRosterDayExtraMark.findMany({
      where: { mealRosterEntry: entryWhere },
      select: {
        mealRosterEntryId: true,
        dayOfMonth: true,
        mealAllowanceRateId: true,
      },
    }),
    prisma.mealRosterDayExtraSplit.findMany({
      where: { unitId, yearMonth },
      select: { dayOfMonth: true, periodsJson: true },
    }),
  ]);
  const extraSplits = splitRows.map((s) => ({
    dayOfMonth: s.dayOfMonth,
    periods: parsePeriodsFromJson(s.periodsJson),
  }));
  return { marks, extraMarks, extraSplits };
}

async function replaceMealRosterDayMarks(
  { unitId, yearMonth, marks, extraMarks: extraMarksRaw, extraSplits: extraSplitsRaw },
  scope,
  effectiveUnitIds,
) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const selectedIds = await getSelectedRateIdsForUnit(unitId);
  if (selectedIds.length === 0) {
    throw new AppError({
      message: "Chọn mức tiền ăn cho đơn vị trước khi lưu sổ chấm",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const selSet = new Set(selectedIds);
  const typeRows = await prisma.mealAllowanceRate.findMany({
    where: { id: { in: selectedIds } },
    select: { id: true, type: true },
  });
  const typeById = new Map(typeRows.map((r) => [r.id, r.type]));
  const entries = await prisma.mealRosterEntry.findMany({
    where: {
      unitId,
      yearMonth,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    select: { id: true },
  });
  const entryIdSet = new Set(entries.map((e) => e.id));
  const dim = daysInMonthFromYearMonth(yearMonth);
  const raw = Array.isArray(marks) ? marks : [];
  for (let i = 0; i < raw.length; i += 1) {
    const m = raw[i];
    const eid = Number(m.mealRosterEntryId);
    const day = Number(m.dayOfMonth);
    const period = m.mealPeriod;
    const rid = m.mealAllowanceRateId != null ? Number(m.mealAllowanceRateId) : null;
    if (!Number.isInteger(eid) || eid <= 0 || !entryIdSet.has(eid)) {
      throw new AppError({
        message: `marks[${i}]: mealRosterEntryId không hợp lệ`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!Number.isInteger(day) || day < 1 || day > dim) {
      throw new AppError({
        message: `marks[${i}]: dayOfMonth phải từ 1 đến ${dim}`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (period !== "sang" && period !== "trua" && period !== "chieu") {
      throw new AppError({
        message: `marks[${i}]: mealPeriod phải là sang, trua hoặc chieu`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (rid != null) {
      if (!Number.isInteger(rid) || rid <= 0 || !selSet.has(rid)) {
        throw new AppError({
          message: `marks[${i}]: mealAllowanceRateId phải thuộc tập mức đã chọn`,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      if (typeById.get(rid) !== "an_tieu_chuan") {
        throw new AppError({
          message: `marks[${i}]: ô tiêu chuẩn chỉ được ghi mức «ăn tiêu chuẩn»`,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
    }
  }
  const extras = Array.isArray(extraMarksRaw) ? extraMarksRaw : [];
  const extraKeySeen = new Set();
  for (let i = 0; i < extras.length; i += 1) {
    const x = extras[i];
    const eid = Number(x.mealRosterEntryId);
    const day = Number(x.dayOfMonth);
    const rid = Number(x.mealAllowanceRateId);
    if (!Number.isInteger(eid) || eid <= 0 || !entryIdSet.has(eid)) {
      throw new AppError({
        message: `extraMarks[${i}]: mealRosterEntryId không hợp lệ`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!Number.isInteger(day) || day < 1 || day > dim) {
      throw new AppError({
        message: `extraMarks[${i}]: dayOfMonth phải từ 1 đến ${dim}`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!Number.isInteger(rid) || rid <= 0 || !selSet.has(rid)) {
      throw new AppError({
        message: `extraMarks[${i}]: mealAllowanceRateId phải thuộc tập mức đã chọn`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (typeById.get(rid) !== "an_them") {
      throw new AppError({
        message: `extraMarks[${i}]: chỉ ghi mức «ăn thêm»`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const uk = `${eid}:${day}:${rid}`;
    if (extraKeySeen.has(uk)) {
      throw new AppError({
        message: `extraMarks: trùng cùng người, ngày và mức ăn thêm`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    extraKeySeen.add(uk);
  }
  const splitRowsIn = Array.isArray(extraSplitsRaw) ? extraSplitsRaw : [];
  const splitDaySeen = new Set();
  const normalizedSplits = [];
  for (let i = 0; i < splitRowsIn.length; i += 1) {
    const s = splitRowsIn[i];
    const day = Number(s.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > dim) {
      throw new AppError({
        message: `extraSplits[${i}]: dayOfMonth phải từ 1 đến ${dim}`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (splitDaySeen.has(day)) {
      throw new AppError({
        message: `extraSplits: trùng ngày ${day}`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    splitDaySeen.add(day);
    const periods = validateExtraSplitPeriodsInput(s.periods, `extraSplits[${i}]`);
    if (!isDefaultExtraSplitPeriods(periods)) {
      normalizedSplits.push({ unitId, yearMonth, dayOfMonth: day, periodsJson: periods });
    }
  }
  const byKey = new Map();
  for (const m of raw) {
    const eid = Number(m.mealRosterEntryId);
    const day = Number(m.dayOfMonth);
    const period = m.mealPeriod;
    byKey.set(`${eid}:${day}:${period}`, m);
  }
  const normalized = [...byKey.values()];

  const standardRatesByEntryDay = new Map();
  for (const m of normalized) {
    const rid = m.mealAllowanceRateId != null ? Number(m.mealAllowanceRateId) : null;
    if (rid == null) {
      continue;
    }
    const eid = Number(m.mealRosterEntryId);
    const day = Number(m.dayOfMonth);
    const gk = `${eid}:${day}`;
    if (!standardRatesByEntryDay.has(gk)) {
      standardRatesByEntryDay.set(gk, new Set());
    }
    standardRatesByEntryDay.get(gk).add(rid);
  }
  for (const [gk, rateSet] of standardRatesByEntryDay) {
    if (rateSet.size > 1) {
      const dayStr = gk.split(":")[1];
      throw new AppError({
        message: `Ngày ${dayStr}: cùng một người không được chấm hai mức «ăn tiêu chuẩn» khác nhau giữa sáng / trưa / chiều.`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealRosterDayExtraSplit.deleteMany({
      where: { unitId, yearMonth },
    });
    await tx.mealRosterDayExtraMark.deleteMany({
      where: {
        mealRosterEntry: {
          unitId,
          yearMonth,
          ...entityUnitIdWhere(scope, effectiveUnitIds),
        },
      },
    });
    await tx.mealRosterDayMark.deleteMany({
      where: {
        mealRosterEntry: {
          unitId,
          yearMonth,
          ...entityUnitIdWhere(scope, effectiveUnitIds),
        },
      },
    });
    const withRate = normalized.filter((m) => m.mealAllowanceRateId != null);
    if (withRate.length > 0) {
      await tx.mealRosterDayMark.createMany({
        data: withRate.map((m) => ({
          mealRosterEntryId: Number(m.mealRosterEntryId),
          dayOfMonth: Number(m.dayOfMonth),
          mealPeriod: m.mealPeriod,
          mealAllowanceRateId: Number(m.mealAllowanceRateId),
        })),
      });
    }
    if (extras.length > 0) {
      await tx.mealRosterDayExtraMark.createMany({
        data: extras.map((x) => ({
          mealRosterEntryId: Number(x.mealRosterEntryId),
          dayOfMonth: Number(x.dayOfMonth),
          mealAllowanceRateId: Number(x.mealAllowanceRateId),
        })),
      });
    }
    if (normalizedSplits.length > 0) {
      await tx.mealRosterDayExtraSplit.createMany({ data: normalizedSplits });
    }
  });
  return listMealRosterDayMarks(unitId, yearMonth, scope, effectiveUnitIds);
}

async function listUnitDisplayOptions(unitId) {
  const assigned = await prisma.assignedUnit.findMany({
    where: { unitId, isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  const names = [...new Set(assigned.map((a) => String(a.name || "").trim()).filter(Boolean))];
  if (names.length > 0) {
    return names;
  }
  const u = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { name: true },
  });
  return u?.name ? [u.name.trim()] : [];
}

async function assertUnitDisplayAllowed(unitId, unitDisplay) {
  const options = await listUnitDisplayOptions(unitId);
  const t = String(unitDisplay || "").trim();
  if (!options.includes(t)) {
    throw new AppError({
      message: `Đơn vị «${t}» không nằm trong danh sách đơn vị trực thuộc`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function prevYearMonth(ym) {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return null;
  }
  const d = new Date(y, m - 2, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function findDataSheetName(wb) {
  if (wb.SheetNames.includes("ChamCom")) {
    return "ChamCom";
  }
  return wb.SheetNames.find((n) => n !== "_DM") || wb.SheetNames[0];
}

function readDmMappings(wb) {
  const labelToRateId = new Map();
  const allowedUnits = new Set();
  if (!wb.SheetNames.includes("_DM")) {
    return { labelToRateId, allowedUnits };
  }
  const sheet = wb.Sheets._DM;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) {
      continue;
    }
    const b = String(row[1] ?? "").trim();
    const cRaw = row[2];
    const id = Number(cRaw);
    if (b && Number.isInteger(id) && id > 0) {
      labelToRateId.set(b, id);
    }
    const e = String(row[4] ?? "").trim();
    if (e) {
      allowedUnits.add(e);
    }
  }
  return { labelToRateId, allowedUnits };
}

function looksLikeHeaderRow(cell0) {
  const s = String(cell0 ?? "")
    .trim()
    .toLowerCase();
  if (!s) {
    return false;
  }
  return (
    s.includes("họ") ||
    s.includes("ho va ten") ||
    s.includes("họ và tên") ||
    s.includes("tên") ||
    s === "stt" ||
    s.includes("cấp") ||
    s.includes("cap bac") ||
    s.includes("mức") ||
    s.includes("muc") ||
    s.includes("đơn vị") ||
    s.includes("don vi")
  );
}

async function parseExcelImportRows(buffer, unitId, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const wb = XLSX.read(buffer, { type: "buffer" });
  const dataName = findDataSheetName(wb);
  if (!dataName) {
    return [];
  }
  const { labelToRateId: dmLabelMap, allowedUnits: dmUnits } = readDmMappings(wb);

  const dbRates = await listSelectedStandardRatesWithLabels(unitId);
  if (dbRates.length === 0) {
    throw new AppError({
      message:
        "Đơn vị chưa có mức «ăn tiêu chuẩn» trong tập đã chọn — bổ sung trong «Chọn mức tiền ăn cho đơn vị» rồi tải lại mẫu Excel.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const labelToRateId = new Map(dmLabelMap);
  for (const r of dbRates) {
    if (!labelToRateId.has(r.label)) {
      labelToRateId.set(r.label, r.id);
    }
  }

  const unitOptions = new Set(await listUnitDisplayOptions(unitId));
  for (const u of dmUnits) {
    unitOptions.add(u);
  }

  const sheet = wb.Sheets[dataName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  let start = 0;
  if (looksLikeHeaderRow(rows[0]?.[0])) {
    start = 1;
  }
  const out = [];
  const rateIds = [];
  for (let i = start; i < rows.length; i += 1) {
    const r = rows[i];
    if (!Array.isArray(r)) {
      continue;
    }
    const fullName = String(r[0] ?? "").trim();
    if (!fullName) {
      continue;
    }
    const rank = String(r[1] ?? "").trim();
    const rateLabel = String(r[2] ?? "").trim();
    const unitDisplay = String(r[3] ?? "").trim();
    if (!rateLabel) {
      throw new AppError({
        message: `Dòng ${i + 1}: chọn đối tượng ăn tiêu chuẩn trong danh sách (dropdown)`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const rateId = labelToRateId.get(rateLabel);
    if (!rateId) {
      throw new AppError({
        message: `Dòng ${i + 1}: không khớp đối tượng «${rateLabel}» — tải lại file mẫu hoặc chọn đúng nhãn trong dropdown`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!unitDisplay) {
      throw new AppError({
        message: `Dòng ${i + 1}: chọn đơn vị`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (!unitOptions.has(unitDisplay)) {
      throw new AppError({
        message: `Dòng ${i + 1}: đơn vị «${unitDisplay}» không hợp lệ cho đơn vị đang nhập`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    rateIds.push(rateId);
    out.push({ fullName, rank, mealAllowanceRateId: rateId, unitDisplay });
  }
  await assertRateIdsInUnitSelection(unitId, rateIds);
  return out;
}

async function buildMealRosterImportTemplateBuffer(unitId, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const rates = await listSelectedStandardRatesWithLabels(unitId);
  if (rates.length === 0) {
    throw new AppError({
      message:
        "Đơn vị chưa có mức «ăn tiêu chuẩn» trong tập đã chọn — mở tab «Sổ chấm cơm», bấm «Chọn mức tiền ăn cho đơn vị» (tích ít nhất một mức tiêu chuẩn) rồi tải lại mẫu.",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const unitOptions = await listUnitDisplayOptions(unitId);
  if (unitOptions.length === 0) {
    throw new AppError({
      message: "Không có đơn vị trực thuộc để chọn (AssignedUnit hoặc tên đơn vị).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const n = Math.max(rates.length, unitOptions.length);
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("ChamCom");
  const dm = workbook.addWorksheet("_DM", { state: "hidden" });
  dm.getRow(1).values = ["", "rateLabel", "rateId", "", "unitName"];
  dm.getRow(1).font = { bold: true };
  for (let i = 0; i < n; i += 1) {
    const rowIdx = 2 + i;
    const rate = rates[i];
    const un = unitOptions[i];
    if (rate) {
      dm.getRow(rowIdx).getCell(2).value = rate.label;
      dm.getRow(rowIdx).getCell(3).value = rate.id;
    }
    if (un) {
      dm.getRow(rowIdx).getCell(5).value = un;
    }
  }
  dm.getColumn(1).width = 4;
  dm.getColumn(2).width = 48;
  dm.getColumn(3).width = 10;
  dm.getColumn(5).width = 36;

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns = [{ width: 28 }, { width: 18 }, { width: 52 }, { width: 28 }];
  const h = ws.addRow(["Họ và tên", "Cấp bậc", "Ăn tiêu chuẩn (mức đã chọn cho đơn vị)", "Đơn vị"]);
  h.font = { bold: true };
  ws.addRow(["", "", "", ""]);

  const rateEnd = 1 + rates.length;
  const unitEnd = 1 + unitOptions.length;
  const dvLast = 502;
  ws.dataValidations.add(`C2:C${dvLast}`, {
    type: "list",
    allowBlank: false,
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Mức tiền ăn",
    error: "Chọn một dòng trong dropdown (đúng nhãn đã cấu hình cho đơn vị).",
    formulae: [`_DM!$B$2:$B$${rateEnd}`],
  });
  ws.dataValidations.add(`D2:D${dvLast}`, {
    type: "list",
    allowBlank: false,
    showErrorMessage: true,
    errorStyle: "error",
    errorTitle: "Đơn vị",
    error: "Chọn đơn vị trong danh sách đơn vị trực thuộc.",
    formulae: [`_DM!$E$2:$E$${unitEnd}`],
  });

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function getMealRosterMeta(unitId, scope, effectiveUnitIds, yearMonth) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const refYmd =
    typeof yearMonth === "string" && /^\d{4}-\d{2}$/.test(yearMonth)
      ? lastYmdOfYearMonth(yearMonth)
      : todayYmdLocal();
  const all = await listSelectedRatesWithLabels(unitId, {
    referenceYmd: refYmd,
    versionsCutoffYmd: refYmd,
    includeVersionHistory: true,
  });
  const rates = all.filter((r) => r.type === "an_tieu_chuan");
  const ratesExtra = all.filter((r) => r.type === "an_them");
  const unitOptions = await listUnitDisplayOptions(unitId);
  const needsMealRateSelection = all.length === 0;
  return { rates, ratesExtra, unitOptions, needsMealRateSelection };
}

async function listMealRosterEntries(unitId, yearMonth, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  return prisma.mealRosterEntry.findMany({
    where: {
      unitId,
      yearMonth,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: { mealAllowanceRate: ROSTER_RATE_INCLUDE },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

async function getEntryById(id, scope, effectiveUnitIds) {
  const row = await prisma.mealRosterEntry.findFirst({
    where: {
      id,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    include: { mealAllowanceRate: ROSTER_RATE_INCLUDE },
  });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy bản ghi",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return row;
}

async function createMealRosterEntry(payload, scope, effectiveUnitIds) {
  assertWriteUnit(payload.unitId, scope, effectiveUnitIds);
  await assertStandardMealRateForGuaranty(payload.unitId, payload.mealAllowanceRateId);
  await assertUnitDisplayAllowed(payload.unitId, payload.unitDisplay);
  const maxSort = await prisma.mealRosterEntry.aggregate({
    where: { unitId: payload.unitId, yearMonth: payload.yearMonth },
    _max: { sortOrder: true },
  });
  const sortOrder =
    payload.sortOrder != null ? payload.sortOrder : (maxSort._max.sortOrder ?? -1) + 1;
  return prisma.mealRosterEntry.create({
    data: {
      unitId: payload.unitId,
      yearMonth: payload.yearMonth,
      fullName: payload.fullName,
      rank: payload.rank ?? "",
      mealAllowanceRateId: payload.mealAllowanceRateId,
      unitDisplay: payload.unitDisplay.trim(),
      sortOrder,
    },
    include: { mealAllowanceRate: ROSTER_RATE_INCLUDE },
  });
}

async function patchMealRosterEntry(id, payload, scope, effectiveUnitIds) {
  const existing = await getEntryById(id, scope, effectiveUnitIds);
  if (payload.mealAllowanceRateId != null) {
    await assertStandardMealRateForGuaranty(existing.unitId, payload.mealAllowanceRateId);
  }
  if (payload.unitDisplay != null) {
    await assertUnitDisplayAllowed(existing.unitId, payload.unitDisplay);
  }
  return prisma.mealRosterEntry.update({
    where: { id },
    data: {
      ...(payload.fullName != null ? { fullName: payload.fullName } : {}),
      ...(payload.rank != null ? { rank: payload.rank } : {}),
      ...(payload.mealAllowanceRateId != null ? { mealAllowanceRateId: payload.mealAllowanceRateId } : {}),
      ...(payload.unitDisplay != null ? { unitDisplay: payload.unitDisplay.trim() } : {}),
      ...(payload.sortOrder != null ? { sortOrder: payload.sortOrder } : {}),
    },
    include: { mealAllowanceRate: ROSTER_RATE_INCLUDE },
  });
}

async function deleteMealRosterEntry(id, scope, effectiveUnitIds) {
  await getEntryById(id, scope, effectiveUnitIds);
  await prisma.mealRosterEntry.delete({ where: { id } });
  return { id };
}

async function importMealRosterFromExcel({ buffer, unitId, yearMonth }, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const parsed = await parseExcelImportRows(buffer, unitId, scope, effectiveUnitIds);
  if (parsed.length === 0) {
    throw new AppError({
      message:
        "File không có dòng dữ liệu hợp lệ. Dùng sheet «ChamCom»: A họ tên, B cấp bậc, C mức ăn (dropdown), D đơn vị (dropdown).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (parsed.length > MAX_IMPORT_ROWS) {
    throw new AppError({
      message: `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần nhập`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.mealRosterEntry.deleteMany({ where: { unitId, yearMonth } });
    await tx.mealRosterEntry.createMany({
      data: parsed.map((p, idx) => ({
        unitId,
        yearMonth,
        fullName: p.fullName,
        rank: p.rank,
        mealAllowanceRateId: p.mealAllowanceRateId,
        unitDisplay: p.unitDisplay,
        sortOrder: idx,
      })),
    });
  });
  return listMealRosterEntries(unitId, yearMonth, scope, effectiveUnitIds);
}

async function copyMealRosterFromPreviousMonth({ unitId, yearMonth }, scope, effectiveUnitIds) {
  assertWriteUnit(unitId, scope, effectiveUnitIds);
  const prev = prevYearMonth(yearMonth);
  if (!prev) {
    throw new AppError({
      message: "yearMonth không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const sources = await prisma.mealRosterEntry.findMany({
    where: {
      unitId,
      yearMonth: prev,
      ...entityUnitIdWhere(scope, effectiveUnitIds),
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (sources.length === 0) {
    throw new AppError({
      message: `Tháng trước (${prev}) chưa có dữ liệu để sao chép`,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.mealRosterEntry.deleteMany({ where: { unitId, yearMonth } });
    await tx.mealRosterEntry.createMany({
      data: sources.map((s, idx) => ({
        unitId,
        yearMonth,
        fullName: s.fullName,
        rank: s.rank,
        mealAllowanceRateId: s.mealAllowanceRateId,
        unitDisplay: s.unitDisplay,
        sortOrder: idx,
      })),
    });
  });
  return listMealRosterEntries(unitId, yearMonth, scope, effectiveUnitIds);
}

export {
  buildMealRosterImportTemplateBuffer,
  copyMealRosterFromPreviousMonth,
  createMealRosterEntry,
  deleteMealRosterEntry,
  getMealRosterMeta,
  importMealRosterFromExcel,
  listAllMealRatesForCatalog,
  listMealRosterDayMarks,
  listMealRosterEntries,
  patchMealRosterEntry,
  putUnitSelectedMealRates,
  replaceMealRosterDayMarks,
};

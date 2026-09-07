import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { CHUNG_TU_AGGREGATION_MODES } from "./chung-tu-category.constants.js";
import { formatSystemPersonName } from "./chung-tu-signature-catalog.js";

function resolveRecipientPersonName(row, slipRecipientDisplayName = "") {
  const fromSlip = String(slipRecipientDisplayName ?? "").trim();
  if (fromSlip) return fromSlip;
  const fromUser =
    String(row?.user?.profile?.fullName ?? "").trim() ||
    String(row?.user?.username ?? "").trim();
  return fromUser;
}

function buildRecipientUnitFillFields(row, donVi = "") {
  const nguoiNhanHang = resolveRecipientPersonName(row);
  const person = formatSystemPersonName(row?.user);
  return {
    nguoiNhanHang,
    nguoiNhan: nguoiNhanHang,
    donVi,
    diaChi: String(row?.user?.profile?.department ?? "").trim(),
    signatureName: person?.signatureName ?? nguoiNhanHang,
  };
}

/**
 * @param {number[]} recipientUnitIds
 * @returns {Promise<Map<number, { nguoiNhanHang: string, nguoiNhan: string, donVi: string, diaChi: string, signatureName: string }>>}
 */
export async function loadRecipientUnitFillMap(recipientUnitIds) {
  const ids = [...new Set((recipientUnitIds ?? []).map(Number).filter((id) => id > 0))];
  const map = new Map();
  if (!ids.length) return map;

  const [rows, units] = await Promise.all([
    prisma.lttpRecipientUnitDefaultUser.findMany({
      where: { recipientUnitId: { in: ids } },
      select: {
        recipientUnitId: true,
        user: {
          select: {
            username: true,
            profile: { select: { fullName: true, rankAbbr: true, department: true } },
          },
        },
      },
    }),
    prisma.unit.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    }),
  ]);

  const nameByUnitId = new Map(
    units.map((unit) => [Number(unit.id), String(unit.name ?? "").trim()]),
  );
  const rowByUnitId = new Map(rows.map((row) => [Number(row.recipientUnitId), row]));

  for (const id of ids) {
    map.set(id, buildRecipientUnitFillFields(rowByUnitId.get(id), nameByUnitId.get(id) ?? ""));
  }
  return map;
}

export function mergeRecipientUnitFillFields(target, fillFields) {
  if (!target || !fillFields) return target;
  target.nguoiNhanHang = fillFields.nguoiNhanHang ?? "";
  target.nguoiNhan = fillFields.nguoiNhan ?? fillFields.nguoiNhanHang ?? "";
  // donVi = đơn vị cấp mình from creating user profile — do not overwrite with recipient unit.
  target.diaChi = fillFields.diaChi ?? "";
  target.signatureName = fillFields.signatureName ?? "";
  if (fillFields.donVi && !String(target.recipientUnitName ?? "").trim()) {
    target.recipientUnitName = fillFields.donVi;
  }
  return target;
}

/**
 * Gắn người nhận / đơn vị cho từng sheet khi gộp theo đơn vị hoặc theo ngày.
 * @param {{ sheetContexts?: object[], aggregationMode?: string }} monthly
 */
export async function attachRecipientUnitFillToMonthlyContexts(monthly, { aggregationMode } = {}) {
  const mode = String(aggregationMode ?? "").trim();
  if (
    mode !== CHUNG_TU_AGGREGATION_MODES.BY_UNIT &&
    mode !== CHUNG_TU_AGGREGATION_MODES.BY_DAY
  ) {
    return monthly;
  }

  const unitIds = (monthly?.sheetContexts ?? [])
    .map((ctx) => Number(ctx.recipientUnitId))
    .filter((id) => id > 0);
  const fillMap = await loadRecipientUnitFillMap(unitIds);

  for (const ctx of monthly?.sheetContexts ?? []) {
    const uid = Number(ctx.recipientUnitId);
    const fill =
      fillMap.get(uid) ??
      ({
        nguoiNhanHang: "",
        nguoiNhan: "",
        donVi: "",
        diaChi: "",
        signatureName: "",
      });
    mergeRecipientUnitFillFields(ctx, fill);
    if (fill?.donVi && !String(ctx.recipientUnitName ?? "").trim()) {
      ctx.recipientUnitName = fill.donVi;
    }
  }
  return monthly;
}

/**
 * @param {{ recipientUnitId?: number|null, recipientDisplayName?: string|null, recipientUnit?: { name?: string|null }|null }} slip
 */
export async function resolveRecipientUnitFillForSlip(slip) {
  const uid = Number(slip?.recipientUnitId);
  const unitName = String(slip?.recipientUnit?.name ?? "").trim();
  if (!Number.isInteger(uid) || uid <= 0) {
    const nguoiNhanHang = String(slip?.recipientDisplayName ?? "").trim();
    return {
      nguoiNhanHang,
      nguoiNhan: nguoiNhanHang,
      diaChi: "",
      signatureName: nguoiNhanHang,
      ...(unitName ? { recipientUnitName: unitName } : {}),
    };
  }
  const fillMap = await loadRecipientUnitFillMap([uid]);
  const base = fillMap.get(uid) ?? buildRecipientUnitFillFields(undefined, unitName);
  const nguoiNhanHang =
    String(slip?.recipientDisplayName ?? "").trim() || base.nguoiNhanHang || "";
  return {
    nguoiNhanHang,
    nguoiNhan: nguoiNhanHang,
    diaChi: base.diaChi ?? "",
    signatureName: nguoiNhanHang ? base.signatureName || nguoiNhanHang : base.signatureName,
    recipientUnitName: unitName || base.donVi || "",
  };
}

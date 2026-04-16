import ExcelJS from "exceljs";
import XLSX from "xlsx";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { UNIT_ENTITY_FORK_KIND } from "../../shared/unit-data-fork/unit-entity-fork.kinds.js";
import {
  assertTargetUnitIsStrictDescendantOf,
  assertUnitIdInScope,
} from "../../shared/units/unit-scope.service.js";
import { LTTP_OTHER_GROUP_CODE } from "./lttp.constants.js";

const commodityInclude = { group: true };

async function getOtherGroupId() {
  const g = await prisma.lttpFoodGroup.findUnique({
    where: { code: LTTP_OTHER_GROUP_CODE },
  });
  if (!g) {
    throw new AppError({
      message: "Thiếu nhóm mặc định «Khác» — chạy migration hoặc liên hệ quản trị.",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  return g.id;
}

async function resolveCommodityGroupId(groupIdInput) {
  if (groupIdInput == null || groupIdInput === "") {
    return getOtherGroupId();
  }
  const id = Number(groupIdInput);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError({
      message: "groupId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const g = await prisma.lttpFoodGroup.findFirst({
    where: { id, isActive: true },
  });
  if (!g) {
    throw new AppError({
      message: "Nhóm không tồn tại hoặc đã ngưng dùng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return g.id;
}

async function assertConversionMatchesGroup(groupId, conversionRate) {
  const g = await prisma.lttpFoodGroup.findUnique({ where: { id: groupId } });
  if (!g) {
    throw new AppError({
      message: "Nhóm không tồn tại",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (g.code === LTTP_OTHER_GROUP_CODE) {
    if (conversionRate != null && conversionRate !== "") {
      throw new AppError({
        message: "Nhóm «Khác» không dùng tỷ lệ quy đổi — để trống.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    return;
  }
  const n = conversionRate == null || conversionRate === "" ? NaN : Number(conversionRate);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError({
      message: "Nhóm này bắt buộc nhập tỷ lệ quy đổi (số dương).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function assertUnitInEffectiveBranch(unitId, effectiveUnitIds) {
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.includes(unitId)
  ) {
    throw new AppError({
      message: "Đơn vị ngoài nhánh đang chọn (X-Target-Unit-Id).",
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}

/** Đối chiếu `unitId` từ query/body với `req.dataScope` từ middleware. */
function assertLttpLogicalMatchesDataScope(unitId, dataScope) {
  if (!dataScope || dataScope.storageUnitId == null) {
    throw new AppError({
      message: "Thiếu phạm vi dữ liệu LTTP",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  if (Number(unitId) !== Number(dataScope.logicalUnitId)) {
    throw new AppError({
      message: "unitId không khớp ngữ cảnh phạm vi dữ liệu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
}

function assertCommodityRowStorage(rowUnitId, dataScope) {
  if (rowUnitId !== dataScope.storageUnitId) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

function assertPriceTableRowStorage(tableUnitId, dataScope) {
  if (tableUnitId !== dataScope.storageUnitId) {
    throw new AppError({
      message: "Không tìm thấy bảng giá",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}

function parseDateOnly(input) {
  if (input == null || input === "") {
    throw new AppError({
      message: "Ngày không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (input instanceof Date) {
    return input;
  }
  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new AppError({
      message: "Ngày phải dạng YYYY-MM-DD",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function numOrNull(v) {
  if (v == null || v === "") {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapCommodity(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    groupId: row.groupId,
    group: row.group
      ? { id: row.group.id, code: row.group.code, name: row.group.name }
      : null,
    code: row.code,
    name: row.name,
    measureUnit: row.measureUnit,
    conversionRate: row.conversionRate != null ? Number(row.conversionRate) : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listCommodities({ unitId }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const rows = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ code: "asc" }],
    include: commodityInclude,
  });
  return rows.map(mapCommodity);
}

async function getCommodityById(id, scope, effectiveUnitIds, dataScope) {
  const row = await prisma.lttpCommodity.findFirst({
    where: { id },
    include: commodityInclude,
  });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(row.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  return mapCommodity(row);
}

async function createCommodity(payload, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(payload.unitId, dataScope);
  assertUnitIdInScope(payload.unitId, scope);
  assertUnitInEffectiveBranch(payload.unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const groupId = await resolveCommodityGroupId(payload.groupId);
  await assertConversionMatchesGroup(groupId, payload.conversionRate);
  const g0 = await prisma.lttpFoodGroup.findUnique({ where: { id: groupId } });
  const convFinal =
    g0?.code === LTTP_OTHER_GROUP_CODE
      ? null
      : payload.conversionRate != null && payload.conversionRate !== ""
        ? String(payload.conversionRate)
        : null;
  try {
    const row = await prisma.lttpCommodity.create({
      data: {
        unitId: storageUnitId,
        groupId,
        code: payload.code.trim(),
        name: payload.name.trim(),
        measureUnit: payload.measureUnit.trim(),
        conversionRate: convFinal,
        isActive: payload.isActive ?? true,
      },
      include: commodityInclude,
    });
    return mapCommodity(row);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "Mã mặt hàng đã tồn tại trong đơn vị",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function patchCommodity(id, payload, scope, effectiveUnitIds, dataScope) {
  const existing = await getCommodityById(id, scope, effectiveUnitIds, dataScope);
  const data = {};
  if (payload.code !== undefined) {
    data.code = payload.code.trim();
  }
  if (payload.name !== undefined) {
    data.name = payload.name.trim();
  }
  if (payload.measureUnit !== undefined) {
    data.measureUnit = payload.measureUnit.trim();
  }
  let nextGroupId = existing.groupId;
  if (payload.groupId !== undefined) {
    nextGroupId = await resolveCommodityGroupId(payload.groupId);
    data.groupId = nextGroupId;
  }
  if (payload.conversionRate !== undefined) {
    data.conversionRate = payload.conversionRate == null ? null : String(payload.conversionRate);
  }
  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive;
  }
  if (payload.groupId !== undefined || payload.conversionRate !== undefined) {
    const g = await prisma.lttpFoodGroup.findUnique({ where: { id: nextGroupId } });
    const convCheck =
      payload.conversionRate !== undefined
        ? payload.conversionRate
        : existing.conversionRate != null
          ? existing.conversionRate
          : null;
    await assertConversionMatchesGroup(
      nextGroupId,
      g?.code === LTTP_OTHER_GROUP_CODE ? null : convCheck,
    );
    if (g?.code === LTTP_OTHER_GROUP_CODE) {
      data.conversionRate = null;
    }
  }
  if (!Object.keys(data).length) {
    return getCommodityById(id, scope, effectiveUnitIds, dataScope);
  }
  try {
    const row = await prisma.lttpCommodity.update({
      where: { id },
      data,
      include: commodityInclude,
    });
    return mapCommodity(row);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "Mã mặt hàng trùng",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function deleteCommodity(id, scope, effectiveUnitIds, dataScope) {
  const row = await prisma.lttpCommodity.findFirst({
    where: { id },
  });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(row.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  const count = await prisma.lttpPriceRow.count({
    where: { commodityId: id },
  });
  if (count > 0) {
    throw new AppError({
      message:
        "Không xóa được: mặt hàng đã có trong bảng giá. Hãy ngưng sử dụng (isActive) hoặc xóa phiên bản giá trước.",
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  await prisma.lttpCommodity.delete({
    where: { id },
  });
}

async function findEffectiveTable(unitId, asOfDate) {
  return prisma.lttpPriceTable.findFirst({
    where: {
      unitId,
      effectiveDate: { lte: asOfDate },
    },
    orderBy: { effectiveDate: "desc" },
    include: {
      rows: {
        include: { commodity: { include: { group: true } } },
      },
    },
  });
}

/** Xuất file mẫu Excel: một sheet; cột «Tên nhóm» có dropdown (data validation) theo nhóm đang hiệu lực. */
async function buildPriceImportTemplateBuffer({ unitId, date }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const asOf = parseDateOnly(date);
  const table = await findEffectiveTable(storageUnitId, asOf);
  const rowByCid = new Map((table?.rows || []).map((r) => [r.commodityId, r]));
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ code: "asc" }],
    include: commodityInclude,
  });
  const groups = await prisma.lttpFoodGroup.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const groupNames = groups.map((g) => g.name);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("BangGia");

  ws.columns = [
    { width: 14 },
    { width: 28 },
    { width: 10 },
    { width: 22 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
  ];

  const header = ws.addRow(["Mã", "Tên", "DVT", "Tên nhóm", "Tỷ lệ QĐ", "Đơn giá", "Giá TGSX"]);
  header.font = { bold: true };

  for (const c of commodities) {
    const pr = rowByCid.get(c.id);
    const up = pr?.unitPrice != null ? Number(pr.unitPrice) : null;
    const tg = pr?.tgsxPrice != null ? Number(pr.tgsxPrice) : null;
    const isOther = c.group?.code === LTTP_OTHER_GROUP_CODE;
    ws.addRow([
      c.code,
      c.name,
      c.measureUnit,
      c.group?.name ?? "",
      isOther ? "" : c.conversionRate != null ? Number(c.conversionRate) : "",
      up != null && Number.isFinite(up) ? up : 0,
      tg != null && Number.isFinite(tg) ? tg : "",
    ]);
  }

  const listCol = 8;
  const listStartRow = 2;
  const listEndRow = Math.max(listStartRow, listStartRow + groupNames.length - 1);
  groupNames.forEach((name, i) => {
    ws.getRow(listStartRow + i).getCell(listCol).value = name;
  });
  ws.getColumn(listCol).hidden = true;

  const dvLastRow = Math.max(2 + commodities.length + 20, 502);
  if (groupNames.length > 0) {
    ws.dataValidations.add(`D2:D${dvLastRow}`, {
      type: "list",
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: "error",
      errorTitle: "Nhóm LTTP",
      error: "Chọn tên nhóm trong danh sách hoặc để trống (nhóm Khác).",
      formulae: [`$H$${listStartRow}:$H$${listEndRow}`],
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function getEffectivePrices({ unitId, date }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const asOf = parseDateOnly(date);
  const table = await findEffectiveTable(storageUnitId, asOf);
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    orderBy: { code: "asc" },
    include: commodityInclude,
  });
  const rowByCid = new Map((table?.rows || []).map((r) => [r.commodityId, r]));
  return {
    asOfDate: asOf.toISOString().slice(0, 10),
    appliedPriceTableId: table?.id ?? null,
    appliedEffectiveDate: table ? table.effectiveDate.toISOString().slice(0, 10) : null,
    note: table?.note ?? null,
    items: commodities.map((c) => {
      const pr = rowByCid.get(c.id);
      return {
        commodity: mapCommodity(c),
        unitPrice: pr?.unitPrice != null ? Number(pr.unitPrice) : null,
        tgsxPrice: pr?.tgsxPrice != null ? Number(pr.tgsxPrice) : null,
      };
    }),
  };
}

async function listPriceTables({ unitId, from, to }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const where = { unitId: storageUnitId };
  if (from || to) {
    where.effectiveDate = {};
    if (from) {
      where.effectiveDate.gte = parseDateOnly(from);
    }
    if (to) {
      where.effectiveDate.lte = parseDateOnly(to);
    }
  }
  const rows = await prisma.lttpPriceTable.findMany({
    where,
    orderBy: { effectiveDate: "desc" },
    include: {
      _count: { select: { rows: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    unitId: r.unitId,
    effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
    note: r.note,
    rowCount: r._count.rows,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

async function getPriceTableById(id, scope, effectiveUnitIds, dataScope) {
  const table = await prisma.lttpPriceTable.findFirst({
    where: { id },
    include: {
      rows: { include: { commodity: { include: { group: true } } } },
    },
  });
  if (!table) {
    throw new AppError({
      message: "Không tìm thấy bảng giá",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertPriceTableRowStorage(table.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  return {
    id: table.id,
    unitId: table.unitId,
    effectiveDate: table.effectiveDate.toISOString().slice(0, 10),
    note: table.note,
    rows: table.rows.map((r) => ({
      commodityId: r.commodityId,
      commodity: mapCommodity(r.commodity),
      unitPrice: Number(r.unitPrice),
      tgsxPrice: r.tgsxPrice != null ? Number(r.tgsxPrice) : null,
    })),
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}

async function createPriceTable(payload, scope, effectiveUnitIds, dataScope) {
  const { unitId, effectiveDate, note, rows } = payload;
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const ed = parseDateOnly(effectiveDate);
  if (!rows?.length) {
    throw new AppError({
      message: "Cần ít nhất một dòng giá",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const commodityIds = [...new Set(rows.map((x) => x.commodityId))];
  const commodities = await prisma.lttpCommodity.findMany({
    where: { id: { in: commodityIds }, unitId: storageUnitId },
  });
  if (commodities.length !== commodityIds.length) {
    throw new AppError({
      message: "Có mặt hàng không thuộc đơn vị hoặc không tồn tại",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  let tableId;
  await prisma.$transaction(async (tx) => {
    const table = await tx.lttpPriceTable.upsert({
      where: {
        unitId_effectiveDate: { unitId: storageUnitId, effectiveDate: ed },
      },
      create: {
        unitId: storageUnitId,
        effectiveDate: ed,
        note: note?.trim() || null,
      },
      update: {
        note: note?.trim() || null,
      },
    });
    tableId = table.id;
    await tx.lttpPriceRow.deleteMany({
      where: { priceTableId: table.id },
    });
    await tx.lttpPriceRow.createMany({
      data: rows.map((r) => ({
        priceTableId: table.id,
        commodityId: r.commodityId,
        unitPrice: String(r.unitPrice),
        tgsxPrice: r.tgsxPrice != null ? String(r.tgsxPrice) : null,
      })),
    });
  });

  return getPriceTableById(tableId, scope, effectiveUnitIds, dataScope);
}

async function patchPriceTable(id, payload, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.lttpPriceTable.findFirst({
    where: { id },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy bảng giá",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
 });
  }
  assertPriceTableRowStorage(existing.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);

  if (payload.effectiveDate !== undefined) {
    const newEd = parseDateOnly(payload.effectiveDate);
    if (newEd.getTime() !== existing.effectiveDate.getTime()) {
      const clash = await prisma.lttpPriceTable.findFirst({
        where: {
          unitId: existing.unitId,
          effectiveDate: newEd,
          NOT: { id },
        },
      });
      if (clash) {
        throw new AppError({
          message:
            "Đã có bảng giá cho ngày áp dụng này — xóa hoặc sửa phiên bản kia trước.",
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
        });
      }
      await prisma.lttpPriceTable.update({
        where: { id },
        data: { effectiveDate: newEd },
      });
    }
  }
  if (payload.note !== undefined) {
    await prisma.lttpPriceTable.update({
      where: { id },
      data: { note: payload.note?.trim() || null },
    });
  }
  if (payload.rows) {
    if (!payload.rows.length) {
      throw new AppError({
        message: "Danh sách dòng giá rỗng",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const tableRow = await prisma.lttpPriceTable.findFirst({
      where: { id },
    });
    const commodityIds = [...new Set(payload.rows.map((x) => x.commodityId))];
    const commodities = await prisma.lttpCommodity.findMany({
      where: { id: { in: commodityIds }, unitId: dataScope.storageUnitId },
    });
    if (commodities.length !== commodityIds.length) {
      throw new AppError({
        message: "Có mặt hàng không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.lttpPriceRow.deleteMany({
        where: { priceTableId: id },
      });
      await tx.lttpPriceRow.createMany({
        data: payload.rows.map((r) => ({
          priceTableId: id,
          commodityId: r.commodityId,
          unitPrice: String(r.unitPrice),
          tgsxPrice: r.tgsxPrice != null ? String(r.tgsxPrice) : null,
        })),
      });
    });
  }
  return getPriceTableById(id, scope, effectiveUnitIds, dataScope);
}

async function deletePriceTable(id, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.lttpPriceTable.findFirst({
    where: { id },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy bảng giá",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertPriceTableRowStorage(existing.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  await prisma.lttpPriceTable.delete({
    where: { id },
  });
}

function normalizeHeaderCell(v) {
  if (v == null) {
    return "";
  }
  return String(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    /** «Đơn giá» — chữ đ (U+0111) không tách thành d + dấu → cần gộp về d để khớp alias «don gia». */
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "d")
    .replace(/\s+/g, " ");
}

function pickColumnIndex(headerRow, aliases) {
  for (let i = 0; i < headerRow.length; i += 1) {
    const h = normalizeHeaderCell(headerRow[i]);
    if (!h) {
      continue;
    }
    for (const a of aliases) {
      if (h === a || h.startsWith(`${a} `) || h.endsWith(` ${a}`) || h.includes(` ${a} `)) {
        return i;
      }
    }
  }
  return -1;
}

/** Chuẩn hóa tên nhóm từ ô Excel để khớp với tên trong DB (không phân biệt hoa thường, bỏ dấu). */
function normalizeGroupMatchKey(v) {
  return normalizeHeaderCell(v);
}

/**
 * Import: ưu tiên cột «Tên nhóm»; file cũ có «Mã nhóm» vẫn đọc được theo code.
 */
function createExcelGroupResolver(activeGroups) {
  const other = activeGroups.find((g) => g.code === LTTP_OTHER_GROUP_CODE);
  if (!other) {
    throw new AppError({
      message: "Thiếu nhóm mặc định «Khác» — chạy migration hoặc liên hệ quản trị.",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
  const idByNormName = new Map();
  for (const g of activeGroups) {
    const k = normalizeGroupMatchKey(g.name);
    if (idByNormName.has(k) && idByNormName.get(k) !== g.id) {
      throw new AppError({
        message: `Hai nhóm có tên trùng sau chuẩn hóa — đổi tên hiển thị cho một trong các nhóm: «${g.name}».`,
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    idByNormName.set(k, g.id);
  }
  const idByCode = new Map(activeGroups.map((g) => [String(g.code).trim().toLowerCase(), g.id]));

  function resolve(groupNameRaw, groupCodeRaw) {
    const name = String(groupNameRaw ?? "").trim();
    const code = String(groupCodeRaw ?? "").trim();
    if (name) {
      const id = idByNormName.get(normalizeGroupMatchKey(name));
      if (!id) {
        throw new AppError({
          message: `Tên nhóm «${name}» không khớp nhóm đang hiệu lực. Chọn đúng tên trong dropdown mẫu Excel hoặc để trống nếu là nhóm Khác.`,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      return id;
    }
    if (code) {
      const id = idByCode.get(code.toLowerCase());
      if (!id) {
        throw new AppError({
          message: `Mã nhóm «${code}» không tồn tại hoặc đã ngưng. Dùng file mẫu mới (cột «Tên nhóm»).`,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      return id;
    }
    return other.id;
  }

  const byId = new Map(activeGroups.map((g) => [g.id, g]));
  return { resolve, byId };
}

function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!rows.length) {
    throw new AppError({
      message: "File Excel không có dữ liệu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const headerRow = rows[0].map((c) => c);
  const ix = {
    code: pickColumnIndex(headerRow, ["ma", "ma hang", "ma so", "sku"]),
    name: pickColumnIndex(headerRow, ["ten", "ten hang", "ten mat hang", "ten vat tu"]),
    measure: pickColumnIndex(headerRow, ["dvt", "don vi tinh", "donvitinh"]),
    unitPrice: pickColumnIndex(headerRow, ["don gia", "dongia", "gia ban"]),
    tgsx: pickColumnIndex(headerRow, ["tgsx", "gia tgsx", "gia thanh sx"]),
    groupName: pickColumnIndex(headerRow, ["ten nhom", "ten nhom lttp", "ten phan loai"]),
    groupCode: pickColumnIndex(headerRow, ["ma nhom", "manhom", "nhom ma"]),
    conversion: pickColumnIndex(headerRow, ["ty le", "ti le", "he so", "quy doi", "heso quydoi"]),
  };
  if (ix.code < 0 || ix.unitPrice < 0) {
    throw new AppError({
      message:
        "Cần cột mã hàng và đơn giá (dòng 1 là tiêu đề, ví dụ: «Mã», «Đơn giá»).",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || !row.length) {
      continue;
    }
    const code = String(row[ix.code] ?? "").trim();
    if (!code) {
      continue;
    }
    const name = ix.name >= 0 ? String(row[ix.name] ?? "").trim() : code;
    const measureUnit = ix.measure >= 0 ? String(row[ix.measure] ?? "").trim() : "—";
    const up = numOrNull(row[ix.unitPrice]);
    if (up == null) {
      continue;
    }
    const tgsx = ix.tgsx >= 0 ? numOrNull(row[ix.tgsx]) : null;
    const groupName =
      ix.groupName >= 0 ? String(row[ix.groupName] ?? "").trim() || null : null;
    const groupCode =
      ix.groupCode >= 0 ? String(row[ix.groupCode] ?? "").trim() || null : null;
    const conv = ix.conversion >= 0 ? numOrNull(row[ix.conversion]) : null;
    out.push({
      code,
      name: name || code,
      measureUnit: measureUnit || "—",
      unitPrice: up,
      tgsxPrice: tgsx,
      groupName,
      groupCode,
      conversionRate: conv,
    });
  }
  if (!out.length) {
    throw new AppError({
      message: "Không đọc được dòng dữ liệu hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return out;
}

async function importPriceTableFromExcel({ buffer, unitId, effectiveDate, note }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const rawParsed = parseExcelBuffer(buffer);
  const activeGroups = await prisma.lttpFoodGroup.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const { resolve, byId } = createExcelGroupResolver(activeGroups);
  const enriched = [];
  for (const p of rawParsed) {
    const groupId = resolve(p.groupName, p.groupCode);
    const g = byId.get(groupId);
    await assertConversionMatchesGroup(
      groupId,
      g?.code === LTTP_OTHER_GROUP_CODE ? null : p.conversionRate,
    );
    const convFinal =
      g?.code === LTTP_OTHER_GROUP_CODE
        ? null
        : p.conversionRate != null
          ? String(p.conversionRate)
          : null;
    enriched.push({ ...p, groupId, convFinal });
  }
  const parsed = enriched;
  const ed = parseDateOnly(effectiveDate);
  const codeList = [...new Set(parsed.map((p) => p.code))];
  const existingComm = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, code: { in: codeList } },
  });
  const byCode = new Map(existingComm.map((c) => [c.code, c]));

  const missingCodes = codeList.filter((c) => !byCode.has(c));
  if (missingCodes.length) {
    const seen = new Set();
    for (const p of parsed) {
      if (byCode.has(p.code) || seen.has(p.code)) {
        continue;
      }
      seen.add(p.code);
      const row = await prisma.lttpCommodity.create({
        data: {
          unitId: storageUnitId,
          groupId: p.groupId,
          code: p.code,
          name: p.name,
          measureUnit: p.measureUnit,
          conversionRate: p.convFinal,
          isActive: true,
        },
      });
      byCode.set(p.code, row);
    }
  }

  for (const p of parsed) {
    const c = byCode.get(p.code);
    if (!c) {
      continue;
    }
    await prisma.lttpCommodity.update({
      where: { id: c.id },
      data: {
        name: p.name,
        measureUnit: p.measureUnit,
        groupId: p.groupId,
        conversionRate: p.convFinal,
      },
    });
  }

  const refreshed = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, code: { in: codeList } },
  });
  const idByCode = new Map(refreshed.map((c) => [c.code, c.id]));
  const rowPayload = [];
  for (const p of parsed) {
    const cid = idByCode.get(p.code);
    if (!cid) {
      continue;
    }
    rowPayload.push({
      commodityId: cid,
      unitPrice: p.unitPrice,
      tgsxPrice: p.tgsxPrice,
    });
  }
  const lastByCid = new Map();
  for (const r of rowPayload) {
    lastByCid.set(r.commodityId, r);
  }
  return createPriceTable(
    {
      unitId,
      effectiveDate: ed,
      note: note ?? null,
      rows: [...lastByCid.values()],
    },
    scope,
    effectiveUnitIds,
    dataScope,
  );
}

function mapFoodGroup(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeGroupCode(input) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s;
}

async function listFoodGroupsForSelect() {
  const rows = await prisma.lttpFoodGroup.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(mapFoodGroup);
}

async function listFoodGroupsCatalog() {
  const rows = await prisma.lttpFoodGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(mapFoodGroup);
}

async function createFoodGroup(payload) {
  const code = normalizeGroupCode(payload.code);
  if (!code) {
    throw new AppError({
      message: "Cần mã nhóm (ví dụ: gao, thit)",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (code === LTTP_OTHER_GROUP_CODE) {
    throw new AppError({
      message: "Mã «other» dành cho nhóm mặc định — chọn mã khác",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  try {
    const row = await prisma.lttpFoodGroup.create({
      data: {
        code,
        name: payload.name.trim(),
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
    });
    return mapFoodGroup(row);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "Mã nhóm đã tồn tại",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function patchFoodGroup(id, payload) {
  const existing = await prisma.lttpFoodGroup.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy nhóm",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const data = {};
  if (payload.name !== undefined) {
    data.name = payload.name.trim();
  }
  if (payload.sortOrder !== undefined) {
    data.sortOrder = payload.sortOrder;
  }
  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive;
  }
  if (payload.code !== undefined && existing.code !== LTTP_OTHER_GROUP_CODE) {
    const code = normalizeGroupCode(payload.code);
    if (!code) {
      throw new AppError({
        message: "Mã nhóm không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (code === LTTP_OTHER_GROUP_CODE) {
      throw new AppError({
        message: "Không đổi mã thành «other»",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    data.code = code;
  }
  if (existing.code === LTTP_OTHER_GROUP_CODE && payload.isActive === false) {
    throw new AppError({
      message: "Không được ngưng nhóm «Khác»",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!Object.keys(data).length) {
    return mapFoodGroup(existing);
  }
  try {
    const row = await prisma.lttpFoodGroup.update({
      where: { id },
      data,
    });
    return mapFoodGroup(row);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message: "Mã nhóm trùng",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function deleteFoodGroup(id) {
  const existing = await prisma.lttpFoodGroup.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy nhóm",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (existing.code === LTTP_OTHER_GROUP_CODE) {
    throw new AppError({
      message: "Không xóa được nhóm mặc định «Khác»",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const cnt = await prisma.lttpCommodity.count({ where: { groupId: id } });
  if (cnt > 0) {
    throw new AppError({
      message: `Không xóa: còn ${cnt} mặt hàng gắn nhóm này`,
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
  await prisma.lttpFoodGroup.delete({ where: { id } });
}

function commodityConversionForClone(source) {
  const gCode = source.group?.code;
  if (gCode === LTTP_OTHER_GROUP_CODE) {
    return null;
  }
  if (source.conversionRate != null && source.conversionRate !== "") {
    return String(source.conversionRate);
  }
  return null;
}

/**
 * Tạo hoặc đồng bộ bản mặt hàng ở đơn vị con theo `UnitEntityFork` (LTTP_COMMODITY).
 * @returns {Promise<number>} id mặt hàng tại đơn vị đích
 */
async function resolveLttpCommodityTargetIdInTx(tx, source, targetUnitId, appliedByUserId) {
  const convFinal = commodityConversionForClone(source);
  const sourceCommodityId = source.id;
  const sourceUnitId = source.unitId;

  let existing = await tx.unitEntityFork.findUnique({
    where: {
      kind_sourceRecordId_targetUnitId: {
        kind: UNIT_ENTITY_FORK_KIND.LTTP_COMMODITY,
        sourceRecordId: sourceCommodityId,
        targetUnitId,
      },
    },
  });

  if (existing) {
    const targetRow = await tx.lttpCommodity.findFirst({
      where: { id: existing.targetRecordId, unitId: targetUnitId },
      include: commodityInclude,
    });
    if (!targetRow) {
      await tx.unitEntityFork.delete({ where: { id: existing.id } });
      existing = null;
    } else {
      await tx.lttpCommodity.update({
        where: { id: targetRow.id },
        data: {
          groupId: source.groupId,
          code: source.code.trim(),
          name: source.name.trim(),
          measureUnit: source.measureUnit.trim(),
          conversionRate: convFinal,
          isActive: source.isActive,
        },
      });
      await tx.unitEntityFork.update({
        where: { id: existing.id },
        data: { appliedByUserId: appliedByUserId ?? null },
      });
      return targetRow.id;
    }
  }

  try {
    const created = await tx.lttpCommodity.create({
      data: {
        unitId: targetUnitId,
        groupId: source.groupId,
        code: source.code.trim(),
        name: source.name.trim(),
        measureUnit: source.measureUnit.trim(),
        conversionRate: convFinal,
        isActive: source.isActive,
      },
    });
    await tx.unitEntityFork.create({
      data: {
        kind: UNIT_ENTITY_FORK_KIND.LTTP_COMMODITY,
        sourceRecordId: sourceCommodityId,
        sourceUnitId,
        targetUnitId,
        targetRecordId: created.id,
        appliedByUserId: appliedByUserId ?? null,
      },
    });
    return created.id;
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError({
        message:
          "Đơn vị đích đã có mặt hàng trùng mã (không gắn với bản nguồn) — đổi mã ở nguồn hoặc xử lý trùng ở đơn vị con.",
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
      });
    }
    throw error;
  }
}

async function applyLttpCommodityToDescendantUnit(sourceCommodityId, targetUnitId, actor, scope, effectiveUnitIds, dataScope) {
  const source = await prisma.lttpCommodity.findFirst({
    where: { id: sourceCommodityId },
    include: commodityInclude,
  });
  if (!source) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(source.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  assertUnitIdInScope(targetUnitId, scope);
  assertUnitInEffectiveBranch(targetUnitId, effectiveUnitIds);
  await assertTargetUnitIsStrictDescendantOf(targetUnitId, source.unitId);

  const appliedByUserId = actor?.id ?? null;
  const childId = await prisma.$transaction(async (tx) =>
    resolveLttpCommodityTargetIdInTx(tx, source, targetUnitId, appliedByUserId),
  );

  const row = await prisma.lttpCommodity.findFirst({
    where: { id: childId },
    include: commodityInclude,
  });
  return mapCommodity(row);
}

async function applyLttpPriceTableToDescendantUnit(
  sourcePriceTableId,
  targetUnitId,
  actor,
  scope,
  effectiveUnitIds,
  dataScope,
  targetEffectiveDateInput,
) {
  const table = await prisma.lttpPriceTable.findFirst({
    where: { id: sourcePriceTableId },
    include: {
      rows: {
        include: { commodity: { include: { group: true } } },
      },
    },
  });
  if (!table) {
    throw new AppError({
      message: "Không tìm thấy bảng giá",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!table.rows?.length) {
    throw new AppError({
      message: "Bảng giá nguồn không có dòng nào",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  assertPriceTableRowStorage(table.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  assertUnitIdInScope(targetUnitId, scope);
  assertUnitInEffectiveBranch(targetUnitId, effectiveUnitIds);
  await assertTargetUnitIsStrictDescendantOf(targetUnitId, table.unitId);

  const targetEffectiveDate =
    targetEffectiveDateInput != null && String(targetEffectiveDateInput).trim() !== ""
      ? parseDateOnly(targetEffectiveDateInput)
      : table.effectiveDate;

  const appliedByUserId = actor?.id ?? null;
  const parentCommodityIds = [...new Set(table.rows.map((r) => r.commodityId))];

  const resultId = await prisma.$transaction(async (tx) => {
    const commodityIdMap = new Map();
    for (const cid of parentCommodityIds) {
      const priceRow = table.rows.find((x) => x.commodityId === cid);
      const childCid = await resolveLttpCommodityTargetIdInTx(
        tx,
        priceRow.commodity,
        targetUnitId,
        appliedByUserId,
      );
      commodityIdMap.set(cid, childCid);
    }

    let existing = await tx.unitEntityFork.findUnique({
      where: {
        kind_sourceRecordId_targetUnitId: {
          kind: UNIT_ENTITY_FORK_KIND.LTTP_PRICE_TABLE,
          sourceRecordId: sourcePriceTableId,
          targetUnitId,
        },
      },
    });

    const note = table.note?.trim() || null;

    if (existing) {
      const targetTable = await tx.lttpPriceTable.findFirst({
        where: { id: existing.targetRecordId, unitId: targetUnitId },
      });
      if (!targetTable) {
        await tx.unitEntityFork.delete({ where: { id: existing.id } });
        existing = null;
      } else {
        await tx.lttpPriceTable.update({
          where: { id: targetTable.id },
          data: { note, effectiveDate: targetEffectiveDate },
        });
        await tx.lttpPriceRow.deleteMany({ where: { priceTableId: targetTable.id } });
        await tx.lttpPriceRow.createMany({
          data: table.rows.map((r) => ({
            priceTableId: targetTable.id,
            commodityId: commodityIdMap.get(r.commodityId),
            unitPrice: String(r.unitPrice),
            tgsxPrice: r.tgsxPrice != null ? String(r.tgsxPrice) : null,
          })),
        });
        await tx.unitEntityFork.update({
          where: { id: existing.id },
          data: { appliedByUserId },
        });
        return targetTable.id;
      }
    }

    let created;
    try {
      created = await tx.lttpPriceTable.create({
        data: {
          unitId: targetUnitId,
          effectiveDate: targetEffectiveDate,
          note,
        },
      });
    } catch (error) {
      if (error.code === "P2002") {
        throw new AppError({
          message:
            "Đơn vị đích đã có bảng giá cùng ngày — xóa hoặc đổi ngày trên đơn vị con, hoặc dùng lại thao tác áp nếu bản đó đã liên kết với chính bảng nguồn này.",
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
        });
      }
      throw error;
    }

    await tx.lttpPriceRow.createMany({
      data: table.rows.map((r) => ({
        priceTableId: created.id,
        commodityId: commodityIdMap.get(r.commodityId),
        unitPrice: String(r.unitPrice),
        tgsxPrice: r.tgsxPrice != null ? String(r.tgsxPrice) : null,
      })),
    });

    await tx.unitEntityFork.create({
      data: {
        kind: UNIT_ENTITY_FORK_KIND.LTTP_PRICE_TABLE,
        sourceRecordId: sourcePriceTableId,
        sourceUnitId: table.unitId,
        targetUnitId,
        targetRecordId: created.id,
        appliedByUserId,
      },
    });
    return created.id;
  });

  /** Bản ghi đích luôn `unitId = targetUnitId` (fork), khác phạm vi kho nguồn. */
  const targetScope = {
    dataKind: "LTTP_PRICE_TABLE",
    visibility: "private",
    logicalUnitId: targetUnitId,
    storageUnitId: targetUnitId,
    asOf: new Date(),
    via: "apply_down_target",
  };
  return getPriceTableById(resultId, scope, effectiveUnitIds, targetScope);
}

export {
  applyLttpCommodityToDescendantUnit,
  applyLttpPriceTableToDescendantUnit,
  buildPriceImportTemplateBuffer,
  createCommodity,
  createFoodGroup,
  createPriceTable,
  deleteCommodity,
  deleteFoodGroup,
  deletePriceTable,
  getCommodityById,
  getEffectivePrices,
  getPriceTableById,
  importPriceTableFromExcel,
  listCommodities,
  listFoodGroupsCatalog,
  listFoodGroupsForSelect,
  listPriceTables,
  patchCommodity,
  patchFoodGroup,
  patchPriceTable,
};

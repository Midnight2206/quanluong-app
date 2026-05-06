import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
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

const commodityInclude = {
  group: true,
  lttpCommodityDefaultSupplier: { include: { lttpSupplier: true } },
};

/** Prisma Client / schema lệch (vd. Docker mount prisma mới nhưng image cũ) → delegate undefined. */
function assertLttpPrismaDelegates() {
  if (
    typeof prisma.lttpUnitIssueFormDefaults?.upsert !== "function" ||
    typeof prisma.lttpIssueSlipSerial?.upsert !== "function" ||
    typeof prisma.lttpRecipientUnitDefaultUser?.upsert !== "function" ||
    typeof prisma.lttpCommodityDefaultSupplier?.upsert !== "function" ||
    typeof prisma.lttpPartnerDebt?.upsert !== "function" ||
    typeof prisma.lttpPartnerPayment?.create !== "function" ||
    typeof prisma.lttpPartnerPaymentTotal?.upsert !== "function"
  ) {
    throw new AppError({
      message:
        "Prisma Client chưa khớp schema LTTP. Trong thư mục `quanluong-app-be` chạy: `npx prisma generate` rồi khởi động lại API. Nếu dùng Docker dev: `docker compose ... up --build` hoặc `docker compose exec <service-api> npx prisma generate`.",
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    });
  }
}

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
  const uid =
    unitId !== null && unitId !== undefined && unitId !== "" ? Number(unitId) : unitId;
  if (
    effectiveUnitIds != null &&
    effectiveUnitIds.length > 0 &&
    !effectiveUnitIds.some((id) => Number(id) === Number(uid))
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
    defaultLttpSupplier: row.lttpCommodityDefaultSupplier?.lttpSupplier
      ? mapLttpSupplier(row.lttpCommodityDefaultSupplier.lttpSupplier)
      : null,
  };
}

function mapLttpSupplier(row) {
  return {
    id: row.id,
    unitId: row.unitId,
    name: row.name,
    representativeName: row.representativeName,
    address: row.address,
    businessLicenseNo: row.businessLicenseNo,
    taxCode: row.taxCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listLttpSuppliers({ unitId }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const rows = await prisma.lttpSupplier.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  return rows.map(mapLttpSupplier);
}

async function getLttpSupplierById(id, scope, effectiveUnitIds, dataScope) {
  const row = await prisma.lttpSupplier.findFirst({ where: { id } });
  if (!row) {
    throw new AppError({
      message: "Không tìm thấy đối tác",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(row.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  return mapLttpSupplier(row);
}

async function createLttpSupplier(payload, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(payload.unitId, dataScope);
  assertUnitIdInScope(payload.unitId, scope);
  assertUnitInEffectiveBranch(payload.unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const name = String(payload.name ?? "").trim();
  const rep = String(payload.representativeName ?? "").trim();
  if (!name || !rep) {
    throw new AppError({
      message: "Tên đối tác và tên người đại diện là bắt buộc",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const row = await prisma.lttpSupplier.create({
    data: {
      unitId: storageUnitId,
      name,
      representativeName: rep,
      address: cleanOptionalString(payload.address, 500),
      businessLicenseNo: cleanOptionalString(payload.businessLicenseNo, 64),
      taxCode: cleanOptionalString(payload.taxCode, 32),
    },
  });
  return mapLttpSupplier(row);
}

function cleanOptionalString(v, maxLen) {
  if (v == null || v === "") {
    return null;
  }
  const s = String(v).trim();
  if (!s) {
    return null;
  }
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function patchLttpSupplier(id, payload, scope, effectiveUnitIds, dataScope) {
  await getLttpSupplierById(id, scope, effectiveUnitIds, dataScope);
  const data = {};
  if (payload.name !== undefined) {
    const n = String(payload.name ?? "").trim();
    if (!n) {
      throw new AppError({
        message: "Tên đối tác không được để trống",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    data.name = n;
  }
  if (payload.representativeName !== undefined) {
    const n = String(payload.representativeName ?? "").trim();
    if (!n) {
      throw new AppError({
        message: "Tên người đại diện không được để trống",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    data.representativeName = n;
  }
  if (payload.address !== undefined) {
    data.address = cleanOptionalString(payload.address, 500);
  }
  if (payload.businessLicenseNo !== undefined) {
    data.businessLicenseNo = cleanOptionalString(payload.businessLicenseNo, 64);
  }
  if (payload.taxCode !== undefined) {
    data.taxCode = cleanOptionalString(payload.taxCode, 32);
  }
  if (!Object.keys(data).length) {
    return getLttpSupplierById(id, scope, effectiveUnitIds, dataScope);
  }
  const row = await prisma.lttpSupplier.update({
    where: { id },
    data,
  });
  return mapLttpSupplier(row);
}

async function deleteLttpSupplier(id, scope, effectiveUnitIds, dataScope) {
  await getLttpSupplierById(id, scope, effectiveUnitIds, dataScope);
  await prisma.lttpSupplier.delete({ where: { id } });
  return { ok: true };
}

async function assertLttpSupplierIdForCommodity(supplierId, storageUnitId) {
  if (supplierId == null || supplierId === "") {
    return null;
  }
  const sid = Number(supplierId);
  if (!Number.isInteger(sid) || sid <= 0) {
    throw new AppError({
      message: "Đối tác mặc định không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const s = await prisma.lttpSupplier.findFirst({
    where: { id: sid, unitId: storageUnitId },
  });
  if (!s) {
    throw new AppError({
      message: "Không tìm thấy đối tác cùng đơn vị kho",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return sid;
}

/**
 * Lưu đối tác mặc định cho một mặt hàng (bảng liên kết, upsert / xóa khi null).
 */
async function putLttpCommodityDefaultSupplier({ commodityId, lttpSupplierId }, scope, effectiveUnitIds, dataScope) {
  const cid = Number(commodityId);
  if (!Number.isInteger(cid) || cid <= 0) {
    throw new AppError({
      message: "commodityId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const existing = await prisma.lttpCommodity.findFirst({
    where: { id: cid },
    include: commodityInclude,
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(existing.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const sid = await assertLttpSupplierIdForCommodity(lttpSupplierId, storageUnitId);
  assertLttpPrismaDelegates();
  if (sid == null) {
    await prisma.lttpCommodityDefaultSupplier.deleteMany({ where: { commodityId: cid } });
    return {
      commodityId: cid,
      lttpSupplierId: null,
      lttpSupplier: null,
    };
  }
  const row = await prisma.lttpCommodityDefaultSupplier.upsert({
    where: { commodityId: cid },
    create: { commodityId: cid, lttpSupplierId: sid },
    update: { lttpSupplierId: sid },
    include: { lttpSupplier: true },
  });
  if (!row.lttpSupplier) {
    return { commodityId: cid, lttpSupplierId: null, lttpSupplier: null };
  }
  return {
    commodityId: cid,
    lttpSupplierId: row.lttpSupplierId,
    lttpSupplier: mapLttpSupplier(row.lttpSupplier),
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
  const createData = {
    unitId: storageUnitId,
    groupId,
    code: payload.code.trim(),
    name: payload.name.trim(),
    measureUnit: payload.measureUnit.trim(),
    conversionRate: convFinal,
    isActive: payload.isActive ?? true,
  };
  try {
    const row = await prisma.lttpCommodity.create({
      data: createData,
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

/** Bảng giá đối tác (bảng riêng) hiệu lực tại asOfDate — cùng thứ tự ưu tiên ngày như bảng LTTP. */
async function findEffectivePartnerTable(unitId, asOfDate) {
  return prisma.lttpPartnerPriceTable.findFirst({
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

async function findEffectivePartnerTableWithDb(db, unitId, asOfDate) {
  return db.lttpPartnerPriceTable.findFirst({
    where: {
      unitId,
      effectiveDate: { lte: asOfDate },
    },
    orderBy: { effectiveDate: "desc" },
    include: {
      rows: true,
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
  const partnerTable = await findEffectivePartnerTable(storageUnitId, asOf);
  const rowByCid = new Map((table?.rows || []).map((r) => [r.commodityId, r]));
  const partnerByCid = new Map(
    (partnerTable?.rows || []).map((r) => [r.commodityId, r.partnerUnitPrice]),
  );
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
    { width: 12 },
  ];

  // Cột 8 (H): giá đối tác (bảng tách) — cell tiêu đề H để trống, đọc khi import, cập nhật LttpPartnerPriceTable.
  const header = ws.addRow([
    "Mã",
    "Tên",
    "DVT",
    "Tên nhóm",
    "Tỷ lệ QĐ",
    "Đơn giá",
    "Giá TGSX",
  ]);
  header.font = { bold: true };
  header.getCell(8);

  for (const c of commodities) {
    const pr = rowByCid.get(c.id);
    const up = pr?.unitPrice != null ? Number(pr.unitPrice) : null;
    const tg = pr?.tgsxPrice != null ? Number(pr.tgsxPrice) : null;
    const pRaw = partnerByCid.get(c.id);
    const ptn = pRaw != null ? Number(pRaw) : null;
    const isOther = c.group?.code === LTTP_OTHER_GROUP_CODE;
    ws.addRow([
      c.code,
      c.name,
      c.measureUnit,
      c.group?.name ?? "",
      isOther ? "" : c.conversionRate != null ? Number(c.conversionRate) : "",
      up != null && Number.isFinite(up) ? up : 0,
      tg != null && Number.isFinite(tg) ? tg : "",
      ptn != null && Number.isFinite(ptn) ? ptn : "",
    ]);
  }

  // Danh sách tên nhóm (dropdown cột D) — cột I, ẩn; không trùng cột giá đối tác (H).
  const listCol = 9;
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
      formulae: [`$I$${listStartRow}:$I$${listEndRow}`],
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
        partnerUnitPrice:
          pr?.partnerUnitPrice != null ? Number(pr.partnerUnitPrice) : null,
      };
    }),
  };
}

function roundMoney2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    return 0;
  }
  return Math.round(x * 100) / 100;
}

/**
 * Gợi ý một dòng phiếu từ mã mặt hàng: tra mặt hàng trên kho + giá theo `date` (bảng hiệu lực),
 * cùng logic `getEffectivePrices`.
 */
async function resolveIssueSlipLine({ unitId, date, code }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const codeTrim = String(code ?? "").trim();
  if (!codeTrim) {
    throw new AppError({
      message: "Thiếu mã mặt hàng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const commodity = await prisma.lttpCommodity.findFirst({
    where: { unitId: storageUnitId, isActive: true, code: codeTrim },
    include: commodityInclude,
  });
  if (!commodity) {
    throw new AppError({
      message: "Không tìm thấy mặt hàng theo mã",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const eff = await getEffectivePrices({ unitId, date }, scope, effectiveUnitIds, dataScope);
  const item = eff.items.find((i) => i.commodity.id === commodity.id);
  /** Mặt hàng mới tạo từ app thường chưa có dòng trên bảng giá hiệu lực — vẫn tra được mã để điền dòng; đơn giá nhập qua cập nhật bảng giá. */
  const unitPrice = item?.unitPrice ?? null;
  const tgsxPrice = item?.tgsxPrice ?? null;
  const partnerUnitPrice = item?.partnerUnitPrice ?? null;
  return {
    commodity: mapCommodity(commodity),
    unitPrice,
    tgsxPrice,
    partnerUnitPrice,
    appliedEffectiveDate: eff.appliedEffectiveDate,
    appliedPriceTableId: eff.appliedPriceTableId,
    missingEffectivePrice: unitPrice == null,
  };
}

/**
 * Quyển số dạng MMYY theo chuỗi ngày YYYY-MM-DD.
 * @param {string} ymd
 * @returns {string}
 */
function bookMmyyFromYmd(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return "0100";
  }
  const mm = m[2];
  const y = Number(m[1]);
  const yy = String(y % 100).padStart(2, "0");
  return `${mm}${yy}`;
}

const issueSlipInclude = {
  lines: {
    include: {
      commodity: { include: commodityInclude },
      lttpSupplier: true,
    },
  },
  createdBy: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
  recipientUnit: { select: { id: true, name: true } },
  recipientUser: { select: { id: true, username: true, profile: { select: { fullName: true } } } },
};

function mapIssueSlip(slip) {
  return {
    id: slip.id,
    unitId: slip.unitId,
    issueDate: slip.issueDate.toISOString().slice(0, 10),
    note: slip.note,
    bookMmyy: slip.bookMmyy,
    slipNo: slip.slipNo,
    recipientUnitId: slip.recipientUnitId,
    recipientUserId: slip.recipientUserId,
    recipientDisplayName: slip.recipientDisplayName,
    recipientUnit: slip.recipientUnit
      ? { id: slip.recipientUnit.id, name: slip.recipientUnit.name }
      : null,
    recipientUser: slip.recipientUser
      ? {
          id: slip.recipientUser.id,
          username: slip.recipientUser.username,
          fullName: slip.recipientUser.profile?.fullName ?? null,
        }
      : null,
    printLine1: slip.printLine1,
    printLine2: slip.printLine2,
    formMauSo: slip.formMauSo,
    warehouseFrom: slip.warehouseFrom,
    signerWriter: slip.signerWriter,
    signerRecipient: slip.signerRecipient,
    signerApprover: slip.signerApprover,
    createdAt: slip.createdAt.toISOString(),
    updatedAt: slip.updatedAt.toISOString(),
    createdBy: slip.createdBy
      ? {
          id: slip.createdBy.id,
          username: slip.createdBy.username,
          fullName: slip.createdBy.profile?.fullName ?? null,
        }
      : null,
    lines: slip.lines.map((r) => ({
      id: r.id,
      commodityId: r.commodityId,
      commodity: mapCommodity(r.commodity),
      lttpSupplierId: r.lttpSupplierId,
      lttpSupplier: r.lttpSupplier
        ? {
            id: r.lttpSupplier.id,
            name: r.lttpSupplier.name,
            representativeName: r.lttpSupplier.representativeName,
          }
        : null,
      requiredQuantity: r.requiredQuantity != null ? Number(r.requiredQuantity) : null,
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
      tgsxPrice: r.tgsxPrice != null ? Number(r.tgsxPrice) : null,
      amount: Number(r.amount),
      lineNote: r.lineNote != null && String(r.lineNote).trim() !== "" ? String(r.lineNote).trim() : null,
    })),
  };
}

function mapIssueFormDefaultsRow(row) {
  if (!row) return null;
  return {
    printLine1: row.printLine1,
    printLine2: row.printLine2,
    formMauSo: row.formMauSo,
    warehouseFrom: row.warehouseFrom,
    marginTopCm: row.marginTopCm != null ? Number(row.marginTopCm) : null,
    marginRightCm: row.marginRightCm != null ? Number(row.marginRightCm) : null,
    marginBottomCm: row.marginBottomCm != null ? Number(row.marginBottomCm) : null,
    marginLeftCm: row.marginLeftCm != null ? Number(row.marginLeftCm) : null,
    printFontId: row.printFontId ?? null,
    printFontSizePt: row.printFontSizePt != null ? Number(row.printFontSizePt) : null,
    signerWriter: row.signerWriter,
    signerApprover: row.signerApprover,
    defaultRecipientUnitId: row.defaultRecipientUnitId,
    defaultRecipientUserId: row.defaultRecipientUserId,
  };
}

async function createIssueSlip(payload, userId, scope, effectiveUnitIds, dataScope) {
  const { unitId, issueDate, note, lines } = payload;
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError({
      message: "Cần ít nhất một dòng hàng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const eff = await getEffectivePrices({ unitId, date: issueDate }, scope, effectiveUnitIds, dataScope);
  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));
  const storageUnitId = dataScope.storageUnitId;
  const seen = new Set();
  const lineData = [];
  for (const raw of lines) {
    const cid = Number(raw.commodityId);
    const qty = Number(raw.quantity);
    if (!Number.isInteger(cid) || cid <= 0) {
      throw new AppError({
        message: "commodityId không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (seen.has(cid)) {
      throw new AppError({
        message: "Trùng mặt hàng trong phiếu",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    seen.add(cid);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError({
        message: "Số lượng phải lớn hơn 0",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const hit = priceByCid.get(cid);
    if (!hit || hit.unitPrice == null) {
      throw new AppError({
        message: `Chưa có đơn giá tại ngày cho mặt hàng (id: ${cid})`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const unitPrice = Number(hit.unitPrice);
    const tgsx = hit.tgsxPrice != null ? Number(hit.tgsxPrice) : null;
    const amount = roundMoney2(qty * unitPrice);
    const reqQ = raw.requiredQuantity;
    const reqQNum =
      reqQ != null && reqQ !== "" && Number.isFinite(Number(reqQ)) ? Number(reqQ) : null;

    if (raw.lttpSupplierId == null || raw.lttpSupplierId === "") {
      throw new AppError({
        message: "Mỗi dòng mặt hàng cần chọn đối tác cung cấp",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const lineSid = Number(raw.lttpSupplierId);
    if (!Number.isInteger(lineSid) || lineSid <= 0) {
      throw new AppError({
        message: "lttpSupplierId dòng phiếu không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const supRow = await prisma.lttpSupplier.findFirst({
      where: { id: lineSid, unitId: storageUnitId },
    });
    if (!supRow) {
      throw new AppError({
        message: "Đối tác ghi trên dòng phiếu không thuộc đơn vị kho",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const lineLttpSupplierId = lineSid;
    const lineNoteTrim =
      raw.lineNote != null && String(raw.lineNote).trim() !== ""
        ? String(raw.lineNote).trim().slice(0, 500)
        : null;
    lineData.push({
      commodityId: cid,
      lttpSupplierId: lineLttpSupplierId,
      requiredQuantity:
        reqQNum != null && Number.isFinite(reqQNum) && reqQNum >= 0 ? String(reqQNum) : null,
      quantity: String(qty),
      unitPrice: String(unitPrice),
      tgsxPrice: tgsx != null ? String(tgsx) : null,
      amount: String(amount),
      lineNote: lineNoteTrim,
    });
  }
  if (!lineData.length) {
    throw new AppError({
      message: "Không có dòng hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const issueD = parseDateOnly(issueDate);
  const bookMmyy = bookMmyyFromYmd(issueDate);
  const recipientUnitId =
    payload.recipientUnitId != null && payload.recipientUnitId !== ""
      ? Number(payload.recipientUnitId)
      : storageUnitId;
  if (!Number.isInteger(recipientUnitId) || recipientUnitId <= 0) {
    throw new AppError({
      message: "Đơn vị nhận không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  assertUnitInEffectiveBranch(recipientUnitId, effectiveUnitIds);

  let recipientUserId = null;
  let recipientDisplayName = payload.recipientDisplayName?.trim() || null;
  let signerRecipient = payload.signerRecipient?.trim() || null;
  if (payload.recipientUserId != null && payload.recipientUserId !== "") {
    const ruId = Number(payload.recipientUserId);
    if (!Number.isInteger(ruId) || ruId <= 0) {
      throw new AppError({
        message: "Người nhận (user) không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const ru = await prisma.user.findFirst({
      where: { id: ruId, deletedAt: null, unitId: recipientUnitId },
      include: { profile: { select: { fullName: true } } },
    });
    if (!ru) {
      throw new AppError({
        message: "Không tìm thấy user trong đơn vị nhận đã chọn",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    recipientUserId = ruId;
    const name = (ru.profile?.fullName && String(ru.profile.fullName).trim()) || ru.username;
    recipientDisplayName = recipientDisplayName || name;
    signerRecipient = signerRecipient || name;
  }

  const printLine1 = payload.printLine1?.trim() || null;
  const printLine2 = payload.printLine2?.trim() || null;
  const formMauSo = payload.formMauSo?.trim() || null;
  const warehouseFrom = payload.warehouseFrom?.trim() || null;
  const signerWriter = payload.signerWriter?.trim() || null;
  const signerApprover = payload.signerApprover?.trim() || null;

  assertLttpPrismaDelegates();

  const slip = await prisma.$transaction(
    async (tx) => {
      await tx.lttpIssueSlipSerial.upsert({
        where: { unitId_bookMmyy: { unitId: storageUnitId, bookMmyy } },
        create: { unitId: storageUnitId, bookMmyy, lastSlipNo: 0 },
        update: {},
      });
      const ser = await tx.lttpIssueSlipSerial.update({
        where: { unitId_bookMmyy: { unitId: storageUnitId, bookMmyy } },
        data: { lastSlipNo: { increment: 1 } },
      });
      const slipNo = ser.lastSlipNo;
      const created = await tx.lttpIssueSlip.create({
        data: {
          unitId: storageUnitId,
          issueDate: issueD,
          note: note?.trim() || null,
          createdById: userId,
          bookMmyy,
          slipNo,
          recipientUnitId,
          recipientUserId,
          recipientDisplayName,
          printLine1,
          printLine2,
          formMauSo,
          warehouseFrom,
          signerWriter,
          signerRecipient,
          signerApprover,
        },
      });
      await tx.lttpIssueSlipLine.createMany({
        data: lineData.map((d) => ({
          slipId: created.id,
          commodityId: d.commodityId,
          lttpSupplierId: d.lttpSupplierId,
          requiredQuantity: d.requiredQuantity,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          tgsxPrice: d.tgsxPrice,
          amount: d.amount,
          lineNote: d.lineNote,
        })),
      });
      return tx.lttpIssueSlip.findUnique({
        where: { id: created.id },
        include: issueSlipInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 },
  );
  await recalculateLttpPartnerDebtsForUnit(storageUnitId);
  return mapIssueSlip(slip);
}

async function updateIssueSlip(id, payload, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.lttpIssueSlip.findFirst({ where: { id } });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy phiếu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(existing.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);

  const { note, lines } = payload;
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError({
      message: "Cần ít nhất một dòng hàng",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const storageUnitId = existing.unitId;
  const issueDateYmd = existing.issueDate.toISOString().slice(0, 10);
  const eff = await getEffectivePrices(
    { unitId: dataScope.logicalUnitId, date: issueDateYmd },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));

  const seen = new Set();
  const lineData = [];
  for (const raw of lines) {
    const cid = Number(raw.commodityId);
    const qty = Number(raw.quantity);
    if (!Number.isInteger(cid) || cid <= 0) {
      throw new AppError({
        message: "commodityId không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (seen.has(cid)) {
      throw new AppError({
        message: "Trùng mặt hàng trong phiếu",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    seen.add(cid);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError({
        message: "Số lượng phải lớn hơn 0",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const hit = priceByCid.get(cid);
    if (!hit || hit.unitPrice == null) {
      throw new AppError({
        message: `Chưa có đơn giá tại ngày cho mặt hàng (id: ${cid})`,
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const unitPrice = Number(hit.unitPrice);
    const tgsx = hit.tgsxPrice != null ? Number(hit.tgsxPrice) : null;
    const amount = roundMoney2(qty * unitPrice);
    const reqQ = raw.requiredQuantity;
    const reqQNum =
      reqQ != null && reqQ !== "" && Number.isFinite(Number(reqQ)) ? Number(reqQ) : null;

    if (raw.lttpSupplierId == null || raw.lttpSupplierId === "") {
      throw new AppError({
        message: "Mỗi dòng mặt hàng cần chọn đối tác cung cấp",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const lineSid = Number(raw.lttpSupplierId);
    if (!Number.isInteger(lineSid) || lineSid <= 0) {
      throw new AppError({
        message: "lttpSupplierId dòng phiếu không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const supRow = await prisma.lttpSupplier.findFirst({
      where: { id: lineSid, unitId: storageUnitId },
    });
    if (!supRow) {
      throw new AppError({
        message: "Đối tác ghi trên dòng phiếu không thuộc đơn vị kho",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const lineNoteTrim =
      raw.lineNote != null && String(raw.lineNote).trim() !== ""
        ? String(raw.lineNote).trim().slice(0, 500)
        : null;
    lineData.push({
      commodityId: cid,
      lttpSupplierId: lineSid,
      requiredQuantity:
        reqQNum != null && Number.isFinite(reqQNum) && reqQNum >= 0 ? String(reqQNum) : null,
      quantity: String(qty),
      unitPrice: String(unitPrice),
      tgsxPrice: tgsx != null ? String(tgsx) : null,
      amount: String(amount),
      lineNote: lineNoteTrim,
    });
  }
  if (!lineData.length) {
    throw new AppError({
      message: "Không có dòng hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const recipientUnitId =
    payload.recipientUnitId != null && payload.recipientUnitId !== ""
      ? Number(payload.recipientUnitId)
      : storageUnitId;
  if (!Number.isInteger(recipientUnitId) || recipientUnitId <= 0) {
    throw new AppError({
      message: "Đơn vị nhận không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  assertUnitInEffectiveBranch(recipientUnitId, effectiveUnitIds);

  let recipientUserId = null;
  let recipientDisplayName = payload.recipientDisplayName?.trim() || null;
  let signerRecipient = payload.signerRecipient?.trim() || null;
  if (payload.recipientUserId != null && payload.recipientUserId !== "") {
    const ruId = Number(payload.recipientUserId);
    if (!Number.isInteger(ruId) || ruId <= 0) {
      throw new AppError({
        message: "Người nhận (user) không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const ru = await prisma.user.findFirst({
      where: { id: ruId, deletedAt: null, unitId: recipientUnitId },
      include: { profile: { select: { fullName: true } } },
    });
    if (!ru) {
      throw new AppError({
        message: "Không tìm thấy user trong đơn vị nhận đã chọn",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    recipientUserId = ruId;
    const name = (ru.profile?.fullName && String(ru.profile.fullName).trim()) || ru.username;
    recipientDisplayName = recipientDisplayName || name;
    signerRecipient = signerRecipient || name;
  }

  const printLine1 = payload.printLine1?.trim() || null;
  const printLine2 = payload.printLine2?.trim() || null;
  const formMauSo = payload.formMauSo?.trim() || null;
  const warehouseFrom = payload.warehouseFrom?.trim() || null;
  const signerWriter = payload.signerWriter?.trim() || null;
  const signerApprover = payload.signerApprover?.trim() || null;

  assertLttpPrismaDelegates();

  const slip = await prisma.$transaction(
    async (tx) => {
      await tx.lttpIssueSlipLine.deleteMany({ where: { slipId: existing.id } });
      await tx.lttpIssueSlip.update({
        where: { id: existing.id },
        data: {
          note: note?.trim() || null,
          recipientUnitId,
          recipientUserId,
          recipientDisplayName,
          printLine1,
          printLine2,
          formMauSo,
          warehouseFrom,
          signerWriter,
          signerRecipient,
          signerApprover,
        },
      });
      await tx.lttpIssueSlipLine.createMany({
        data: lineData.map((d) => ({
          slipId: existing.id,
          commodityId: d.commodityId,
          lttpSupplierId: d.lttpSupplierId,
          requiredQuantity: d.requiredQuantity,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          tgsxPrice: d.tgsxPrice,
          amount: d.amount,
          lineNote: d.lineNote,
        })),
      });
      return tx.lttpIssueSlip.findUnique({
        where: { id: existing.id },
        include: issueSlipInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 },
  );
  await recalculateLttpPartnerDebtsForUnit(storageUnitId);
  return mapIssueSlip(slip);
}

/**
 * Cập nhật lại đơn giá / TGSX / thành tiền từng dòng theo bảng giá hiệu lực tại **ngày phiếu** (giữ SL, đối tác, mặt hàng).
 * Không đổi schema — chỉ ghi đè cột snapshot trên `LttpIssueSlipLine`.
 */
async function resyncIssueSlipLinePricesFromEffectiveTable(id, scope, effectiveUnitIds, dataScope) {
  const existing = await prisma.lttpIssueSlip.findFirst({
    where: { id },
    include: { lines: true },
  });
  if (!existing) {
    throw new AppError({
      message: "Không tìm thấy phiếu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(existing.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);

  const storageUnitId = existing.unitId;
  const issueDateYmd = existing.issueDate.toISOString().slice(0, 10);
  const eff = await getEffectivePrices(
    { unitId: dataScope.logicalUnitId, date: issueDateYmd },
    scope,
    effectiveUnitIds,
    dataScope,
  );
  const priceByCid = new Map(eff.items.map((i) => [i.commodity.id, i]));

  assertLttpPrismaDelegates();

  await prisma.$transaction(async (tx) => {
    for (const line of existing.lines) {
      const hit = priceByCid.get(line.commodityId);
      if (!hit || hit.unitPrice == null) {
        throw new AppError({
          message: `Chưa có đơn giá tại ngày phiếu cho mặt hàng (id: ${line.commodityId})`,
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }
      const unitPrice = Number(hit.unitPrice);
      const tgsx = hit.tgsxPrice != null ? Number(hit.tgsxPrice) : null;
      const qty = Number(line.quantity);
      const amount = roundMoney2(qty * unitPrice);
      await tx.lttpIssueSlipLine.update({
        where: { id: line.id },
        data: {
          unitPrice: String(unitPrice),
          tgsxPrice: tgsx != null ? String(tgsx) : null,
          amount: String(amount),
        },
      });
    }
  });

  await recalculateLttpPartnerDebtsForUnit(storageUnitId);
  const slip = await prisma.lttpIssueSlip.findUnique({
    where: { id: existing.id },
    include: issueSlipInclude,
  });
  return mapIssueSlip(slip);
}

async function listIssueSlips(
  { unitId, from, to, recipientUnitId, page: pageIn, pageSize: pageSizeIn },
  scope,
  effectiveUnitIds,
  dataScope,
) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const fromD = from && String(from).trim() !== "" ? parseDateOnly(from) : null;
  const toD = to && String(to).trim() !== "" ? parseDateOnly(to) : null;
  const where = { unitId: storageUnitId };
  const ruid = recipientUnitId != null && recipientUnitId !== "" ? Number(recipientUnitId) : null;
  if (ruid != null && Number.isInteger(ruid) && ruid > 0) {
    assertUnitInEffectiveBranch(ruid, effectiveUnitIds);
    where.recipientUnitId = ruid;
  }
  if (fromD && toD) {
    where.issueDate = { gte: fromD, lte: toD };
  } else if (fromD) {
    where.issueDate = { gte: fromD };
  } else if (toD) {
    where.issueDate = { lte: toD };
  }
  const page = pageIn != null && Number.isInteger(Number(pageIn)) && Number(pageIn) > 0 ? Number(pageIn) : 1;
  const pageSize =
    pageSizeIn != null && Number.isInteger(Number(pageSizeIn)) && Number(pageSizeIn) > 0
      ? Math.min(100, Number(pageSizeIn))
      : 20;
  const [total, rows] = await Promise.all([
    prisma.lttpIssueSlip.count({ where }),
    prisma.lttpIssueSlip.findMany({
      where,
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: issueSlipInclude,
    }),
  ]);
  return {
    items: rows.map(mapIssueSlip),
    total,
    page,
    pageSize,
  };
}

function formatAggregatedQuantity(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const s = x.toFixed(4);
  const t = s.replace(/\.?0+$/, "");
  return t === "" ? "0" : t;
}

function lineMatchesSupplierOrderFilter(line, filter) {
  if (filter === "all") {
    return true;
  }
  if (filter === "none") {
    return line.lttpSupplierId == null;
  }
  return Number(line.lttpSupplierId) === Number(filter);
}

function collectAvailableSuppliersFromSlips(slips) {
  /** @type Map<string, { id: number | null; name: string }> */
  const byKey = new Map();
  for (const slip of slips) {
    for (const line of slip.lines ?? []) {
      if (line.lttpSupplierId == null) {
        if (!byKey.has("__none__")) {
          byKey.set("__none__", { id: null, name: "Chưa gán đối tác" });
        }
      } else {
        const sid = line.lttpSupplierId;
        const k = String(sid);
        if (!byKey.has(k)) {
          const nm =
            line.lttpSupplier?.name != null && String(line.lttpSupplier.name).trim() !== ""
              ? line.lttpSupplier.name
              : `Đối tác #${sid}`;
          byKey.set(k, { id: sid, name: nm });
        }
      }
    }
  }
  const list = [...byKey.values()];
  list.sort((a, b) => {
    if (a.id == null && b.id != null) return 1;
    if (a.id != null && b.id == null) return -1;
    return a.name.localeCompare(b.name, "vi");
  });
  return list;
}

/**
 * Một ngày — bảng đặt hàng từ phiếu xuất: có thể lọc theo đối tác cấp (`lttpSupplierId` trên dòng).
 * Mỗi phiếu (có ít nhất một dòng khớp) là một cột; chú thích phiếu = `LttpIssueSlip.note`.
 * Cột «Tổng» = gộp mọi phiếu trong ngày (sau lọc).
 */
async function getDailyOrderSummary(payload, scope, effectiveUnitIds, dataScope) {
  const { unitId, date } = payload;
  /** @type {"all"|"none"|number} */
  const supplierFilter = payload.supplierFilter === undefined ? "all" : payload.supplierFilter;

  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const issueDate = parseDateOnly(date);

  const unitRow =
    storageUnitId != null
      ? await prisma.unit.findUnique({
          where: { id: storageUnitId },
          select: { id: true, name: true },
        })
      : null;

  const slips = await prisma.lttpIssueSlip.findMany({
    where: {
      unitId: storageUnitId,
      issueDate,
    },
    orderBy: [{ id: "asc" }],
    include: issueSlipInclude,
  });

  const availableSuppliers = collectAvailableSuppliersFromSlips(slips);

  if (typeof supplierFilter === "number") {
    const exists = await prisma.lttpSupplier.findFirst({
      where: { id: supplierFilter, unitId: storageUnitId },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError({
        message: "Đối tác không thuộc đơn vị kho hoặc không tồn tại",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }

  /** @type {Map<number, { commodityId: number; name: string; measureUnit: string; quantity: number }>} */
  const grand = new Map();

  /** @type {Array<{ slipId: number; recipientUnitId: number|null; recipientUnitName: string; note: string|null; bookMmyy: string; slipNo: number; lines: Array<{ commodityId: number; name: string; measureUnit: string; quantity: number; quantityFormatted: string }> }>} */
  const slipColumns = [];

  let slipsWithIncludedLine = 0;

  function recipientNameForSlip(slip) {
    const rid = slip.recipientUnitId;
    const nm =
      slip.recipientUnit != null && slip.recipientUnit.name != null && String(slip.recipientUnit.name).trim() !== ""
        ? slip.recipientUnit.name
        : rid == null
          ? "Chưa gán đơn vị nhận"
          : `Đơn vị #${rid}`;
    return { rid, nm };
  }

  for (const slip of slips) {
    const matchingLines = (slip.lines ?? []).filter((ln) =>
      lineMatchesSupplierOrderFilter(ln, supplierFilter),
    );
    if (matchingLines.length === 0) {
      continue;
    }
    slipsWithIncludedLine += 1;

    const { rid, nm } = recipientNameForSlip(slip);
    const perSlipAgg = new Map();

    for (const line of matchingLines) {
      const cid = line.commodityId;
      const qty = Number(line.quantity);
      const name = line.commodity?.name ?? "?";
      const measureUnit = line.commodity?.measureUnit ?? "";
      const notePart =
        line.lineNote != null && String(line.lineNote).trim() !== ""
          ? String(line.lineNote).trim()
          : null;
      const cur = perSlipAgg.get(cid);
      if (!cur) {
        perSlipAgg.set(cid, {
          commodityId: cid,
          name,
          measureUnit,
          quantity: Number.isFinite(qty) ? qty : 0,
          lineNotes: notePart ? [notePart] : [],
        });
      } else {
        cur.quantity += Number.isFinite(qty) ? qty : 0;
        if (notePart && !cur.lineNotes.includes(notePart)) {
          cur.lineNotes.push(notePart);
        }
      }

      const gRow = grand.get(cid);
      if (!gRow) {
        grand.set(cid, {
          commodityId: cid,
          name,
          measureUnit,
          quantity: Number.isFinite(qty) ? qty : 0,
        });
      } else {
        gRow.quantity += Number.isFinite(qty) ? qty : 0;
      }
    }

    const linesSorted = [...perSlipAgg.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));

    slipColumns.push({
      slipId: slip.id,
      recipientUnitId: rid,
      recipientUnitName: nm,
      note: slip.note != null && String(slip.note).trim() !== "" ? String(slip.note).trim() : null,
      bookMmyy: slip.bookMmyy,
      slipNo: slip.slipNo,
      lines: linesSorted.map((row) => ({
        commodityId: row.commodityId,
        name: row.name,
        measureUnit: row.measureUnit,
        quantity: row.quantity,
        quantityFormatted: formatAggregatedQuantity(row.quantity),
        lineNote: row.lineNotes?.length ? row.lineNotes.join("; ") : null,
      })),
    });
  }

  slipColumns.sort((a, b) => {
    if (a.recipientUnitId == null && b.recipientUnitId != null) return 1;
    if (a.recipientUnitId != null && b.recipientUnitId == null) return -1;
    const cname = a.recipientUnitName.localeCompare(b.recipientUnitName, "vi");
    if (cname !== 0) return cname;
    const book = String(a.bookMmyy ?? "").localeCompare(String(b.bookMmyy ?? ""), "vi");
    if (book !== 0) return book;
    return (a.slipNo ?? 0) - (b.slipNo ?? 0);
  });

  const grandTotals = [...grand.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((row) => ({
      commodityId: row.commodityId,
      name: row.name,
      measureUnit: row.measureUnit,
      quantity: row.quantity,
      quantityFormatted: formatAggregatedQuantity(row.quantity),
    }));

  return {
    date: issueDate.toISOString().slice(0, 10),
    storageUnitId,
    storageUnitName: unitRow?.name ?? null,
    supplierFilter,
    availableSuppliers,
    slipCount: slipsWithIncludedLine,
    totalSlipsOnDate: slips.length,
    slipColumns,
    grandTotals,
  };
}

async function getIssueSlipById(id, scope, effectiveUnitIds, dataScope) {
  const slip = await prisma.lttpIssueSlip.findFirst({
    where: { id },
    include: issueSlipInclude,
  });
  if (!slip) {
    throw new AppError({
      message: "Không tìm thấy phiếu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(slip.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  const mapped = mapIssueSlip(slip);
  /** Cùng khóa `unitId` với `upsertIssueFormDefaults` (dataScope.storageUnitId === slip.unitId sau assertCommodityRowStorage). */
  const defaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
    where: { unitId: dataScope.storageUnitId },
  });
  let recipientNameFromUnitDefault = null;
  if (mapped.recipientUnitId != null) {
    const defRow = await prisma.lttpRecipientUnitDefaultUser.findUnique({
      where: { recipientUnitId: mapped.recipientUnitId },
      include: {
        user: { select: { username: true, profile: { select: { fullName: true } } } },
      },
    });
    const u = defRow?.user;
    if (u) {
      const fn = u.profile?.fullName?.trim();
      recipientNameFromUnitDefault = fn || u.username || null;
    }
  }
  return {
    ...mapped,
    printSettings: mapIssueFormDefaultsRow(defaults),
    recipientNameFromUnitDefault,
  };
}

async function deleteIssueSlip(id, scope, effectiveUnitIds, dataScope) {
  const slip = await prisma.lttpIssueSlip.findFirst({ where: { id } });
  if (!slip) {
    throw new AppError({
      message: "Không tìm thấy phiếu",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  assertCommodityRowStorage(slip.unitId, dataScope);
  assertUnitIdInScope(dataScope.logicalUnitId, scope);
  assertUnitInEffectiveBranch(dataScope.logicalUnitId, effectiveUnitIds);
  await prisma.lttpIssueSlip.delete({ where: { id: slip.id } });
  await recalculateLttpPartnerDebtsForUnit(slip.unitId);
  return { ok: true };
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
      partnerUnitPrice:
        r.partnerUnitPrice != null ? Number(r.partnerUnitPrice) : null,
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
        partnerUnitPrice:
          r.partnerUnitPrice != null && r.partnerUnitPrice !== ""
            ? String(r.partnerUnitPrice)
            : null,
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
          partnerUnitPrice:
            r.partnerUnitPrice != null && r.partnerUnitPrice !== ""
              ? String(r.partnerUnitPrice)
              : null,
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
  let hasPartnerColumn = false;
  for (let rr = 1; rr < rows.length; rr += 1) {
    const rowX = rows[rr];
    if (rowX && rowX.length > 7) {
      hasPartnerColumn = true;
      break;
    }
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
    /** Cột H (sau «Giá TGSX»): giá đối tác cho bảng tách; ô trống → 0 khi import. Không cột H → tất cả 0. */
    const partnerUnitPrice = row.length > 7 ? numOrNull(row[7]) : null;
    out.push({
      code,
      name: name || code,
      measureUnit: measureUnit || "—",
      unitPrice: up,
      tgsxPrice: tgsx,
      groupName,
      groupCode,
      conversionRate: conv,
      partnerUnitPrice,
    });
  }
  if (!out.length) {
    throw new AppError({
      message: "Không đọc được dòng dữ liệu hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return { items: out, hasPartnerColumn };
}

async function importPriceTableFromExcel({ buffer, unitId, effectiveDate, note }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const { items: rawParsed, hasPartnerColumn } = parseExcelBuffer(buffer);
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
      partnerUnitPrice: null,
    });
  }
  const lastByCid = new Map();
  for (const r of rowPayload) {
    lastByCid.set(r.commodityId, r);
  }
  const main = await createPriceTable(
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

  const lastParsedByCode = new Map();
  for (const p of parsed) {
    lastParsedByCode.set(p.code, p);
  }
  const partnerRows = [];
  for (const cid of lastByCid.keys()) {
    const comm = refreshed.find((c) => c.id === cid);
    const p = comm ? lastParsedByCode.get(comm.code) : null;
    const pv =
      hasPartnerColumn && p && p.partnerUnitPrice != null && Number.isFinite(p.partnerUnitPrice)
        ? p.partnerUnitPrice
        : 0;
    partnerRows.push({ commodityId: cid, partnerUnitPrice: pv });
  }
  if (partnerRows.length) {
    await putLttpPartnerPriceTableUnscoped({
      unitId,
      effectiveDate: ed.toISOString().slice(0, 10),
      note: null,
      rows: partnerRows,
    });
  }
  return main;
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
            partnerUnitPrice:
              r.partnerUnitPrice != null ? String(r.partnerUnitPrice) : null,
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
        partnerUnitPrice:
          r.partnerUnitPrice != null ? String(r.partnerUnitPrice) : null,
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

async function getNextIssueSlipSerial({ unitId, date: dateStr }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const bookMmyy = bookMmyyFromYmd(dateStr);
  const row = await prisma.lttpIssueSlipSerial.findUnique({
    where: { unitId_bookMmyy: { unitId: storageUnitId, bookMmyy } },
  });
  const last = row?.lastSlipNo ?? 0;
  return { unitId: storageUnitId, bookMmyy, lastSlipNo: last, nextSlipNo: last + 1 };
}

async function getIssueFormDefaults({ unitId }, scope, effectiveUnitIds, dataScope) {
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  const row = await prisma.lttpUnitIssueFormDefaults.findUnique({ where: { unitId: storageUnitId } });
  return { unitId: storageUnitId, defaults: mapIssueFormDefaultsRow(row) };
}

async function upsertIssueFormDefaults(body, scope, effectiveUnitIds, dataScope) {
  const { unitId, ...rest } = body;
  assertLttpLogicalMatchesDataScope(unitId, dataScope);
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const storageUnitId = dataScope.storageUnitId;
  let defaultRecipientUnitId =
    rest.defaultRecipientUnitId != null && rest.defaultRecipientUnitId !== ""
      ? Number(rest.defaultRecipientUnitId)
      : null;
  if (defaultRecipientUnitId != null) {
    assertUnitInEffectiveBranch(defaultRecipientUnitId, effectiveUnitIds);
  }
  let defaultRecipientUserId =
    rest.defaultRecipientUserId != null && rest.defaultRecipientUserId !== ""
      ? Number(rest.defaultRecipientUserId)
      : null;
  if (defaultRecipientUserId != null) {
    const u = await prisma.user.findFirst({
      where: { id: defaultRecipientUserId, deletedAt: null, isActive: true },
      select: { id: true, unitId: true },
    });
    if (!u) {
      throw new AppError({
        message: "Người nhận mặc định không tồn tại.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    assertUnitInEffectiveBranch(u.unitId, effectiveUnitIds);
    if (defaultRecipientUnitId != null && u.unitId !== defaultRecipientUnitId) {
      throw new AppError({
        message: "Người nhận mặc định phải thuộc đơn vị nhận đã chọn.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (defaultRecipientUnitId == null) {
      defaultRecipientUnitId = u.unitId;
    }
  }
  assertLttpPrismaDelegates();
  const row = await prisma.lttpUnitIssueFormDefaults.upsert({
    where: { unitId: storageUnitId },
    create: {
      unitId: storageUnitId,
      printLine1: rest.printLine1?.trim() || null,
      printLine2: rest.printLine2?.trim() || null,
      formMauSo: rest.formMauSo?.trim() || null,
      warehouseFrom: rest.warehouseFrom?.trim() || null,
      marginTopCm: rest.marginTopCm != null ? String(rest.marginTopCm) : null,
      marginRightCm: rest.marginRightCm != null ? String(rest.marginRightCm) : null,
      marginBottomCm: rest.marginBottomCm != null ? String(rest.marginBottomCm) : null,
      marginLeftCm: rest.marginLeftCm != null ? String(rest.marginLeftCm) : null,
      printFontId: rest.printFontId?.trim() || null,
      printFontSizePt: rest.printFontSizePt != null ? String(rest.printFontSizePt) : null,
      signerWriter: rest.signerWriter?.trim() || null,
      signerApprover: rest.signerApprover?.trim() || null,
      defaultRecipientUnitId,
      defaultRecipientUserId,
    },
    update: {
      printLine1: rest.printLine1?.trim() || null,
      printLine2: rest.printLine2?.trim() || null,
      formMauSo: rest.formMauSo?.trim() || null,
      warehouseFrom: rest.warehouseFrom?.trim() || null,
      marginTopCm: rest.marginTopCm != null ? String(rest.marginTopCm) : null,
      marginRightCm: rest.marginRightCm != null ? String(rest.marginRightCm) : null,
      marginBottomCm: rest.marginBottomCm != null ? String(rest.marginBottomCm) : null,
      marginLeftCm: rest.marginLeftCm != null ? String(rest.marginLeftCm) : null,
      printFontId: rest.printFontId?.trim() || null,
      printFontSizePt: rest.printFontSizePt != null ? String(rest.printFontSizePt) : null,
      signerWriter: rest.signerWriter?.trim() || null,
      signerApprover: rest.signerApprover?.trim() || null,
      defaultRecipientUnitId,
      defaultRecipientUserId,
    },
  });
  return { unitId: storageUnitId, ok: true, id: row.id };
}

async function listRecipientUsers({ unitId }, scope, effectiveUnitIds) {
  assertUnitIdInScope(unitId, scope);
  assertUnitInEffectiveBranch(unitId, effectiveUnitIds);
  const rows = await prisma.user.findMany({
    where: { unitId, deletedAt: null, isActive: true },
    select: { id: true, username: true, profile: { select: { fullName: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.profile?.fullName ?? null,
  }));
}

async function getRecipientDefaultUserByUnit({ recipientUnitId }, scope, effectiveUnitIds) {
  assertUnitIdInScope(recipientUnitId, scope);
  assertUnitInEffectiveBranch(recipientUnitId, effectiveUnitIds);
  assertLttpPrismaDelegates();
  const row = await prisma.lttpRecipientUnitDefaultUser.findUnique({
    where: { recipientUnitId },
    select: { defaultUserId: true },
  });
  return { recipientUnitId, userId: row?.defaultUserId ?? null };
}

async function listRecipientDefaultUsersInScope(effectiveUnitIds) {
  if (!Array.isArray(effectiveUnitIds) || effectiveUnitIds.length === 0) {
    return { items: [] };
  }
  assertLttpPrismaDelegates();
  const rows = await prisma.lttpRecipientUnitDefaultUser.findMany({
    where: { recipientUnitId: { in: effectiveUnitIds } },
    select: { recipientUnitId: true, defaultUserId: true },
  });
  return {
    items: rows.map((r) => ({ recipientUnitId: r.recipientUnitId, userId: r.defaultUserId })),
  };
}

async function putRecipientDefaultUser({ recipientUnitId, userId: userIdIn }, scope, effectiveUnitIds) {
  const rid = Number(recipientUnitId);
  if (!Number.isInteger(rid) || rid <= 0) {
    throw new AppError({
      message: "recipientUnitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  assertUnitIdInScope(rid, scope);
  assertUnitInEffectiveBranch(rid, effectiveUnitIds);
  const userId = userIdIn != null && userIdIn !== "" ? Number(userIdIn) : null;
  if (userId != null) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError({
        message: "userId không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    const u = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { id: true, unitId: true },
    });
    if (!u) {
      throw new AppError({
        message: "Người dùng không tồn tại.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
    if (u.unitId !== rid) {
      throw new AppError({
        message: "Người nhận mặc định phải thuộc đúng đơn vị nhận.",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }
  }
  assertLttpPrismaDelegates();
  await prisma.lttpRecipientUnitDefaultUser.upsert({
    where: { recipientUnitId: rid },
    create: { recipientUnitId: rid, defaultUserId: userId },
    update: { defaultUserId: userId },
  });
  return { ok: true, recipientUnitId: rid, userId };
}

/**
 * Tổng hợp thành tiền theo đối tác: Σ (số lượng dòng phiếu × giá từ **bảng giá đối tác** hiệu lực tại ngày phiếu,
 * tách bảng `LttpPartnerPriceTable`).
 * Chỉ tính dòng đã gán `lttpSupplierId`; dòng thiếu giá trên bảng đối tác → cộng 0 (và đếm thiếu).
 */
async function getLttpPartnerPeriodSupplierTotals({ unitId, from, to }) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const fromD = parseDateOnly(from);
  const toD = parseDateOnly(to);
  if (toD < fromD) {
    throw new AppError({
      message: "Ngày kết thúc phải sau hoặc trùng ngày bắt đầu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const u = await prisma.unit.findFirst({
    where: { id: storageUnitId, isActive: true },
    select: { id: true, name: true },
  });
  if (!u) {
    throw new AppError({
      message: "Không tìm thấy đơn vị",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const slips = await prisma.lttpIssueSlip.findMany({
    where: {
      unitId: storageUnitId,
      issueDate: { gte: fromD, lte: toD },
    },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    include: {
      lines: {
        include: {
          lttpSupplier: true,
          commodity: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  const dateCache = new Map();
  const bySupplier = new Map();
  let linesSkippedNoSupplier = 0;

  for (const slip of slips) {
    const ymd = slip.issueDate.toISOString().slice(0, 10);
    if (!dateCache.has(ymd)) {
      const table = await findEffectivePartnerTable(storageUnitId, slip.issueDate);
      const m = new Map();
      for (const r of table?.rows || []) {
        m.set(
          r.commodityId,
          r.partnerUnitPrice != null ? Number(r.partnerUnitPrice) : null,
        );
      }
      dateCache.set(ymd, m);
    }
    const priceMap = dateCache.get(ymd);
    for (const line of slip.lines) {
      if (line.lttpSupplierId == null) {
        linesSkippedNoSupplier += 1;
        continue;
      }
      const pp = priceMap.get(line.commodityId);
      const qty = Number(line.quantity);
      const partnerLineAmount =
        pp != null && Number.isFinite(pp) && Number.isFinite(qty) ? roundMoney2(qty * pp) : 0;
      const sid = line.lttpSupplierId;
      const name = line.lttpSupplier?.name ?? `Đối tác #${sid}`;
      if (!bySupplier.has(sid)) {
        bySupplier.set(sid, {
          lttpSupplierId: sid,
          name,
          totalAmount: 0,
          lineCount: 0,
          linesWithMissingPartnerPrice: 0,
        });
      }
      const cur = bySupplier.get(sid);
      cur.totalAmount = roundMoney2(cur.totalAmount + partnerLineAmount);
      cur.lineCount += 1;
      if (pp == null || !Number.isFinite(pp)) {
        cur.linesWithMissingPartnerPrice += 1;
      }
    }
  }

  const partners = Array.from(bySupplier.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
  const grandTotal = roundMoney2(partners.reduce((s, p) => s + p.totalAmount, 0));
  const linesWithMissingPartnerPrice = partners.reduce(
    (s, p) => s + p.linesWithMissingPartnerPrice,
    0,
  );

  return {
    unit: { id: u.id, name: u.name },
    from: fromD.toISOString().slice(0, 10),
    to: toD.toISOString().slice(0, 10),
    issueSlipCount: slips.length,
    lineSkippedNoSupplier: linesSkippedNoSupplier,
    linesWithMissingPartnerPrice,
    partners,
    grandTotal,
  };
}

/**
 * Màn chỉnh sửa bảng giá đối tác: mặt hàng + giá tại bảng hiệu lực tại `asOf`.
 */
async function getLttpPartnerPriceEditorData({ unitId, asOf: asOfInput }) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const u = await prisma.unit.findFirst({
    where: { id: storageUnitId, isActive: true },
    select: { id: true, name: true },
  });
  if (!u) {
    throw new AppError({
      message: "Không tìm thấy đơn vị",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  const asOf = asOfInput != null && String(asOfInput).trim() !== "" ? parseDateOnly(asOfInput) : new Date();
  const table = await findEffectivePartnerTable(storageUnitId, asOf);
  const rowByCid = new Map((table?.rows || []).map((r) => [r.commodityId, r]));
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnitId, isActive: true },
    orderBy: [{ code: "asc" }],
    include: commodityInclude,
  });
  return {
    unit: { id: u.id, name: u.name },
    asOfDate: asOf.toISOString().slice(0, 10),
    appliedTable: table
      ? {
          id: table.id,
          effectiveDate: table.effectiveDate.toISOString().slice(0, 10),
          note: table.note,
        }
      : null,
    items: commodities.map((c) => {
      const pr = rowByCid.get(c.id);
      return {
        commodity: mapCommodity(c),
        partnerUnitPrice:
          pr?.partnerUnitPrice != null && Number.isFinite(Number(pr.partnerUnitPrice))
            ? Number(pr.partnerUnitPrice)
            : null,
      };
    }),
  };
}

/**
 * Tạo/cập nhật một phiên bản bảng giá đối tác (tách bảng LTTP gốc). Chỉ dùng qua API bảo vệ bí mật.
 */
async function putLttpPartnerPriceTableUnscoped({ unitId, effectiveDate, note, rows }) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const u = await prisma.unit.findFirst({
    where: { id: storageUnitId, isActive: true },
    select: { id: true },
  });
  if (!u) {
    throw new AppError({
      message: "Không tìm thấy đơn vị",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError({
      message: "Cần ít nhất một dòng giá",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const ed = parseDateOnly(effectiveDate);
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
    const table = await tx.lttpPartnerPriceTable.upsert({
      where: { unitId_effectiveDate: { unitId: storageUnitId, effectiveDate: ed } },
      create: {
        unitId: storageUnitId,
        effectiveDate: ed,
        note: note != null && String(note).trim() !== "" ? String(note).trim() : null,
      },
      update: {
        note: note != null && String(note).trim() !== "" ? String(note).trim() : null,
      },
    });
    tableId = table.id;
    await tx.lttpPartnerPriceRow.deleteMany({ where: { priceTableId: table.id } });
    await tx.lttpPartnerPriceRow.createMany({
      data: rows.map((r) => ({
        priceTableId: table.id,
        commodityId: r.commodityId,
        partnerUnitPrice:
          r.partnerUnitPrice != null && r.partnerUnitPrice !== "" && Number.isFinite(Number(r.partnerUnitPrice))
            ? String(r.partnerUnitPrice)
            : null,
      })),
    });
  });

  const reloaded = await findEffectivePartnerTable(storageUnitId, ed);
  await recalculateLttpPartnerDebtsForUnit(storageUnitId);
  return {
    id: reloaded.id,
    unitId: storageUnitId,
    effectiveDate: reloaded.effectiveDate.toISOString().slice(0, 10),
    note: reloaded.note,
    rowCount: reloaded.rows.length,
  };
}

/**
 * Báo cáo thành tiền: mỗi ô = tổng (SL × giá bảng đối tác) theo ngày phiếu + đơn vị nhận.
 * `lttpSupplierId` bỏ trống = tất cả dòng đã gán đối tác thỏa khoảng thời gian.
 */
async function getLttpPartnerMoneyMatrix({ unitId, from, to, lttpSupplierId: supplierFilterRaw }) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const lttpSupplierId =
    supplierFilterRaw === undefined || supplierFilterRaw === null || supplierFilterRaw === ""
      ? null
      : Number(supplierFilterRaw);
  if (lttpSupplierId != null && (!Number.isInteger(lttpSupplierId) || lttpSupplierId <= 0)) {
    throw new AppError({
      message: "lttpSupplierId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const fromD = parseDateOnly(from);
  const toD = parseDateOnly(to);
  if (toD < fromD) {
    throw new AppError({
      message: "Ngày kết thúc phải sau hoặc trùng ngày bắt đầu",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const u = await prisma.unit.findFirst({
    where: { id: storageUnitId, isActive: true },
    select: { id: true, name: true },
  });
  if (!u) {
    throw new AppError({
      message: "Không tìm thấy đơn vị",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const slips = await prisma.lttpIssueSlip.findMany({
    where: { unitId: storageUnitId, issueDate: { gte: fromD, lte: toD } },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    include: {
      recipientUnit: { select: { id: true, name: true } },
      lines: { include: { lttpSupplier: { select: { id: true, name: true } } } },
    },
  });

  const dateCache = new Map();
  const recipientMeta = new Map();
  const cell = new Map();

  for (const slip of slips) {
    const ymd = slip.issueDate.toISOString().slice(0, 10);
    const rid = slip.recipientUnitId ?? 0;
    const rname =
      slip.recipientUnit?.name ?? (rid === 0 ? "Chưa gán ĐV nhận" : `Đơn vị #${rid}`);
    for (const line of slip.lines) {
      if (line.lttpSupplierId == null) {
        continue;
      }
      if (lttpSupplierId != null && line.lttpSupplierId !== lttpSupplierId) {
        continue;
      }
      if (!dateCache.has(ymd)) {
        const ptable = await findEffectivePartnerTable(storageUnitId, slip.issueDate);
        const m = new Map();
        for (const r of ptable?.rows || []) {
          m.set(
            r.commodityId,
            r.partnerUnitPrice != null ? Number(r.partnerUnitPrice) : null,
          );
        }
        dateCache.set(ymd, m);
      }
      const priceMap = dateCache.get(ymd);
      const pp = priceMap.get(line.commodityId);
      const qty = Number(line.quantity);
      const partnerLineAmount =
        pp != null && Number.isFinite(pp) && Number.isFinite(qty) ? roundMoney2(qty * pp) : 0;
      const key = `${ymd}|${rid}`;
      recipientMeta.set(rid, { id: rid, name: rname });
      cell.set(key, roundMoney2((cell.get(key) ?? 0) + partnerLineAmount));
    }
  }

  const dayList = [];
  for (let t = fromD.getTime(); t <= toD.getTime(); t += 24 * 60 * 60 * 1000) {
    dayList.push(new Date(t).toISOString().slice(0, 10));
  }

  const recipientColumns = Array.from(recipientMeta.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );
  const colIndex = new Map(recipientColumns.map((c, i) => [c.id, i]));

  const dayRows = dayList.map((d) => {
    const byRecipient = {};
    let rowTotal = 0;
    for (const r of recipientColumns) {
      const k = `${d}|${r.id}`;
      const v = cell.get(k) ?? 0;
      byRecipient[String(r.id)] = v;
      rowTotal = roundMoney2(rowTotal + v);
    }
    return { date: d, byRecipient, rowTotal };
  });

  const columnTotals = {};
  let grandTotal = 0;
  for (const r of recipientColumns) {
    let s = 0;
    for (const drow of dayRows) {
      s = roundMoney2(s + (drow.byRecipient[String(r.id)] ?? 0));
    }
    columnTotals[String(r.id)] = s;
    grandTotal = roundMoney2(grandTotal + s);
  }

  let lttpSupplierLabel = "Tất cả đối tác";
  if (lttpSupplierId != null) {
    const sup = await prisma.lttpSupplier.findFirst({
      where: { id: lttpSupplierId, unitId: storageUnitId },
      select: { name: true },
    });
    lttpSupplierLabel = sup?.name ?? `Đối tác #${lttpSupplierId}`;
  }

  return {
    unit: { id: u.id, name: u.name },
    from: fromD.toISOString().slice(0, 10),
    to: toD.toISOString().slice(0, 10),
    lttpSupplierId,
    lttpSupplierLabel,
    recipientColumns: recipientColumns.map((c) => ({ id: c.id, name: c.name })),
    days: dayRows,
    columnTotals,
    grandTotal,
  };
}

async function assertLttpSupplierInUnit(unitId, lttpSupplierId, db = prisma) {
  const supplier = await db.lttpSupplier.findFirst({
    where: { id: lttpSupplierId, unitId },
    select: { id: true, name: true },
  });
  if (!supplier) {
    throw new AppError({
      message: "Không tìm thấy đối tác trong đơn vị cấp",
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
  return supplier;
}

/**
 * Rebuild tổng công nợ từ phiếu xuất + bảng giá đối tác hiệu lực.
 * Chỉ chạy khi dữ liệu nguồn thay đổi, không chạy ở read path.
 */
async function recalculateLttpPartnerDebtsForUnit(unitId, db = prisma) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const suppliers = await db.lttpSupplier.findMany({
    where: { unitId: storageUnitId },
    select: { id: true },
  });
  const totals = new Map(suppliers.map((s) => [s.id, 0]));

  const slips = await db.lttpIssueSlip.findMany({
    where: { unitId: storageUnitId },
    orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    include: { lines: true },
  });

  const dateCache = new Map();
  for (const slip of slips) {
    const ymd = slip.issueDate.toISOString().slice(0, 10);
    if (!dateCache.has(ymd)) {
      const table = await findEffectivePartnerTableWithDb(db, storageUnitId, slip.issueDate);
      const m = new Map();
      for (const r of table?.rows || []) {
        m.set(
          r.commodityId,
          r.partnerUnitPrice != null ? Number(r.partnerUnitPrice) : null,
        );
      }
      dateCache.set(ymd, m);
    }
    const priceMap = dateCache.get(ymd);
    for (const line of slip.lines) {
      if (line.lttpSupplierId == null) {
        continue;
      }
      if (!totals.has(line.lttpSupplierId)) {
        totals.set(line.lttpSupplierId, 0);
      }
      const pp = priceMap.get(line.commodityId);
      const qty = Number(line.quantity);
      const amount =
        pp != null && Number.isFinite(pp) && Number.isFinite(qty) ? roundMoney2(qty * pp) : 0;
      totals.set(line.lttpSupplierId, roundMoney2((totals.get(line.lttpSupplierId) ?? 0) + amount));
    }
  }

  const now = new Date();
  for (const [lttpSupplierId, totalDebtAmount] of totals) {
    await db.lttpPartnerDebt.upsert({
      where: { unitId_lttpSupplierId: { unitId: storageUnitId, lttpSupplierId } },
      create: {
        unitId: storageUnitId,
        lttpSupplierId,
        totalDebtAmount: String(totalDebtAmount),
        lastRecalculatedAt: now,
      },
      update: {
        totalDebtAmount: String(totalDebtAmount),
        lastRecalculatedAt: now,
      },
    });
  }

  return { unitId: storageUnitId, supplierCount: totals.size, recalculatedAt: now };
}

async function listLttpPartnerDebtSummary({ unitId }) {
  const storageUnitId = Number(unitId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  const suppliers = await prisma.lttpSupplier.findMany({
    where: { unitId: storageUnitId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const supplierIds = suppliers.map((s) => s.id);
  const [debts, paidTotals] = await Promise.all([
    prisma.lttpPartnerDebt.findMany({
      where: { unitId: storageUnitId, lttpSupplierId: { in: supplierIds } },
    }),
    prisma.lttpPartnerPaymentTotal.findMany({
      where: { unitId: storageUnitId, lttpSupplierId: { in: supplierIds } },
    }),
  ]);
  const debtBySid = new Map(debts.map((d) => [d.lttpSupplierId, d]));
  const paidBySid = new Map(paidTotals.map((p) => [p.lttpSupplierId, p]));

  const partners = suppliers.map((s) => {
    const debt = debtBySid.get(s.id);
    const paid = paidBySid.get(s.id);
    const totalDebtAmount = debt?.totalDebtAmount != null ? Number(debt.totalDebtAmount) : 0;
    const totalPaidAmount = paid?.totalPaidAmount != null ? Number(paid.totalPaidAmount) : 0;
    return {
      lttpSupplierId: s.id,
      name: s.name,
      totalDebtAmount,
      totalPaidAmount,
      remainingAmount: roundMoney2(totalDebtAmount - totalPaidAmount),
      lastRecalculatedAt: debt?.lastRecalculatedAt ?? null,
    };
  });

  return {
    unitId: storageUnitId,
    partners,
    totals: {
      totalDebtAmount: roundMoney2(partners.reduce((sum, p) => sum + p.totalDebtAmount, 0)),
      totalPaidAmount: roundMoney2(partners.reduce((sum, p) => sum + p.totalPaidAmount, 0)),
      remainingAmount: roundMoney2(partners.reduce((sum, p) => sum + p.remainingAmount, 0)),
    },
  };
}

async function listLttpPartnerPayments({ unitId, lttpSupplierId }) {
  const storageUnitId = Number(unitId);
  const supplierId = Number(lttpSupplierId);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new AppError({
      message: "lttpSupplierId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const supplier = await assertLttpSupplierInUnit(storageUnitId, supplierId);
  const rows = await prisma.lttpPartnerPayment.findMany({
    where: { unitId: storageUnitId, lttpSupplierId: supplierId },
    orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
  });
  return {
    supplier,
    items: rows.map((r) => ({
      id: r.id,
      paymentDate: r.paymentDate.toISOString().slice(0, 10),
      amount: Number(r.amount),
      note: r.note,
      createdAt: r.createdAt,
    })),
    totalPaidAmount: roundMoney2(rows.reduce((sum, r) => sum + Number(r.amount), 0)),
  };
}

async function createLttpPartnerPayment({ unitId, lttpSupplierId, paymentDate, amount, note }) {
  const storageUnitId = Number(unitId);
  const supplierId = Number(lttpSupplierId);
  const amountNum = Number(amount);
  if (!Number.isInteger(storageUnitId) || storageUnitId <= 0) {
    throw new AppError({
      message: "unitId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new AppError({
      message: "lttpSupplierId không hợp lệ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    throw new AppError({
      message: "Số tiền thanh toán phải lớn hơn 0",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }
  const pd = parseDateOnly(paymentDate);
  const roundedAmount = roundMoney2(amountNum);
  const noteClean = note != null && String(note).trim() !== "" ? String(note).trim() : null;

  const row = await prisma.$transaction(async (tx) => {
    await assertLttpSupplierInUnit(storageUnitId, supplierId, tx);
    const created = await tx.lttpPartnerPayment.create({
      data: {
        unitId: storageUnitId,
        lttpSupplierId: supplierId,
        paymentDate: pd,
        amount: String(roundedAmount),
        note: noteClean,
      },
    });
    await tx.lttpPartnerPaymentTotal.upsert({
      where: { unitId_lttpSupplierId: { unitId: storageUnitId, lttpSupplierId: supplierId } },
      create: {
        unitId: storageUnitId,
        lttpSupplierId: supplierId,
        totalPaidAmount: String(roundedAmount),
      },
      update: {
        totalPaidAmount: { increment: String(roundedAmount) },
      },
    });
    return created;
  });

  return {
    id: row.id,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    amount: Number(row.amount),
    note: row.note,
    createdAt: row.createdAt,
  };
}

export {
  applyLttpCommodityToDescendantUnit,
  applyLttpPriceTableToDescendantUnit,
  buildPriceImportTemplateBuffer,
  createCommodity,
  createFoodGroup,
  createIssueSlip,
  createLttpPartnerPayment,
  createPriceTable,
  deleteCommodity,
  deleteFoodGroup,
  deleteIssueSlip,
  deletePriceTable,
  getCommodityById,
  getEffectivePrices,
  getLttpPartnerPeriodSupplierTotals,
  getLttpPartnerPriceEditorData,
  getLttpPartnerMoneyMatrix,
  putLttpPartnerPriceTableUnscoped,
  listLttpPartnerDebtSummary,
  listLttpPartnerPayments,
  getDailyOrderSummary,
  getIssueFormDefaults,
  getIssueSlipById,
  getNextIssueSlipSerial,
  getPriceTableById,
  importPriceTableFromExcel,
  listCommodities,
  listLttpSuppliers,
  getLttpSupplierById,
  createLttpSupplier,
  patchLttpSupplier,
  deleteLttpSupplier,
  putLttpCommodityDefaultSupplier,
  listFoodGroupsCatalog,
  listFoodGroupsForSelect,
  listIssueSlips,
  listPriceTables,
  listRecipientDefaultUsersInScope,
  listRecipientUsers,
  getRecipientDefaultUserByUnit,
  patchCommodity,
  patchFoodGroup,
  patchPriceTable,
  recalculateLttpPartnerDebtsForUnit,
  putRecipientDefaultUser,
  resolveIssueSlipLine,
  resyncIssueSlipLinePricesFromEffectiveTable,
  updateIssueSlip,
  upsertIssueFormDefaults,
};

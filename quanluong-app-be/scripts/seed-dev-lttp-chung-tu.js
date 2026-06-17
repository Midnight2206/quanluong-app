#!/usr/bin/env node
/**
 * Seed dữ liệu mẫu DEV — LTTP + chứng từ quyết toán.
 *
 * Mô hình:
 * - Kho cấp phát + danh mục LTTP: «Đơn vị mẫu cấp 2»
 * - 6 đơn vị con «LTTP kho mẫu 01» … «06» = đơn vị nhận (recipientUnitId)
 * - 30 phiếu xuất / đơn vị nhận / tháng (tổng 180 phiếu trên kho cấp 2), 20–30 dòng/phiếu
 *
 * Chạy Docker dev:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file quanluong-app-be/.env.docker \
 *     exec app node scripts/seed-dev-lttp-chung-tu.js
 *
 * DEV_SEED_FORCE=1        — xóa phiếu dev tháng hiện tại trên kho cấp 2 và tạo lại
 * DEV_SEED_SKIP_SLIPS=1   — chỉ master data
 * DEV_SEED_UNIT_ID=       — chỉ seed một đơn vị kho (bỏ qua 6 đơn vị nhận)
 */
import "dotenv/config";
import { prisma } from "../src/infra/database/prisma/prisma.client.js";
import { LTTP_OTHER_GROUP_CODE } from "../src/modules/lttp/lttp.constants.js";
import { rebuildAllUnitPaths } from "../src/shared/units/unit-scope.service.js";
import {
  DEV_SEED_EXTRA_FOOD_GROUPS,
  DEV_SEED_RECIPIENT_CHILD_COUNT,
  DEV_SEED_SLIP_LINES_MAX,
  DEV_SEED_SLIP_LINES_MIN,
  DEV_SEED_SLIP_NOTE,
  DEV_SEED_SLIPS_PER_RECIPIENT_MONTH,
  DEV_SEED_SUPPLIERS,
  SAMPLE_CHILD_UNIT_NAME,
  addDaysYmd,
  bookMmyyFromYmd,
  buildCommodityRows,
  chungTuProfileForWarehouseUnit,
  currentMonthBoundsUtc,
  listDaysInCurrentMonthUtc,
  lttpFormDefaultsForStorageUnit,
  parseDateOnlyUtc,
  randomInt,
  recipientChildUnitName,
  scheduleSlipDaysForMonth,
  unitPriceForCode,
  ymdTodayUtc,
} from "../src/modules/dev-seed/dev-lttp-chung-tu.seed-data.js";

function parseArgs() {
  const force = process.env.DEV_SEED_FORCE === "1" || process.argv.includes("--force");
  const skipSlips =
    process.env.DEV_SEED_SKIP_SLIPS === "1" || process.argv.includes("--skip-slips");
  const unitIdArg = process.argv.find((a) => a.startsWith("--unit-id="));
  const unitIdFromArg = unitIdArg ? Number(unitIdArg.split("=")[1]) : null;
  const unitIdFromEnv =
    process.env.DEV_SEED_UNIT_ID != null && String(process.env.DEV_SEED_UNIT_ID).trim() !== ""
      ? Number(process.env.DEV_SEED_UNIT_ID)
      : null;
  return {
    force,
    skipSlips,
    unitId: Number.isInteger(unitIdFromArg) && unitIdFromArg > 0 ? unitIdFromArg : unitIdFromEnv,
  };
}

async function resolveStorageUnit() {
  const row = await prisma.unit.findFirst({
    where: { name: SAMPLE_CHILD_UNIT_NAME, isActive: true },
    orderBy: { id: "asc" },
  });
  if (row) return row;
  const root = await prisma.unit.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });
  if (!root) {
    throw new Error("Chưa có đơn vị — khởi động API một lần để bootstrap đơn vị mẫu.");
  }
  return root;
}

async function resolveActorUserId() {
  const superadmin = await prisma.user.findFirst({
    where: { deletedAt: null, type: { name: "superadmin" } },
    orderBy: { id: "asc" },
  });
  if (superadmin) return superadmin.id;
  const any = await prisma.user.findFirst({ where: { deletedAt: null }, orderBy: { id: "asc" } });
  if (!any) throw new Error("Chưa có user — bật RUN_SUPERADMIN_BOOTSTRAP và khởi động API.");
  return any.id;
}

async function ensureFoodGroups() {
  const other = await prisma.lttpFoodGroup.findUnique({ where: { code: LTTP_OTHER_GROUP_CODE } });
  if (!other) {
    throw new Error('Thiếu nhóm LTTP "other" — chạy prisma migrate deploy.');
  }
  const groupIds = [other.id];
  for (const g of DEV_SEED_EXTRA_FOOD_GROUPS) {
    const row = await prisma.lttpFoodGroup.upsert({
      where: { code: g.code },
      create: { ...g, isActive: true },
      update: { name: g.name, sortOrder: g.sortOrder, isActive: true },
    });
    groupIds.push(row.id);
  }
  return groupIds;
}

async function ensureRecipientChildUnits(storageUnit) {
  const units = [];
  let created = 0;
  for (let i = 1; i <= DEV_SEED_RECIPIENT_CHILD_COUNT; i += 1) {
    const name = recipientChildUnitName(i);
    let row = await prisma.unit.findFirst({ where: { name } });
    if (!row) {
      row = await prisma.unit.create({
        data: {
          name,
          description: `Đơn vị nhận LTTP dev seed — con của «${storageUnit.name}»`,
          parentId: storageUnit.id,
          isActive: true,
        },
      });
      created += 1;
    } else if (row.parentId !== storageUnit.id) {
      row = await prisma.unit.update({
        where: { id: row.id },
        data: { parentId: storageUnit.id },
      });
    }
    units.push(row);
  }
  if (created > 0) {
    await rebuildAllUnitPaths();
  }
  console.log(
    `Unit: ${units.length} đơn vị nhận dưới «${storageUnit.name}» (${created} mới).`,
  );
  return units;
}

/** Gỡ dữ liệu seed cũ (nhầm gắn kho cấp phát lên đơn vị nhận con). */
async function cleanupLegacyWarehouseDataOnRecipientUnits(recipientUnitIds) {
  if (!recipientUnitIds.length) return;
  const removedSlips = await prisma.lttpIssueSlip.deleteMany({
    where: { unitId: { in: recipientUnitIds }, note: DEV_SEED_SLIP_NOTE },
  });
  if (removedSlips.count > 0) {
    console.log(`  Dọn ${removedSlips.count} phiếu dev cũ trên đơn vị nhận con.`);
  }
  for (const uid of recipientUnitIds) {
    const tables = await prisma.lttpPriceTable.findMany({ where: { unitId: uid }, select: { id: true } });
    if (tables.length) {
      await prisma.lttpPriceRow.deleteMany({
        where: { priceTableId: { in: tables.map((t) => t.id) } },
      });
      await prisma.lttpPriceTable.deleteMany({ where: { unitId: uid } });
    }
    const commIds = (
      await prisma.lttpCommodity.findMany({ where: { unitId: uid }, select: { id: true } })
    ).map((c) => c.id);
    if (commIds.length) {
      await prisma.lttpCommodityDefaultSupplier.deleteMany({
        where: { commodityId: { in: commIds } },
      });
      await prisma.lttpCommodity.deleteMany({ where: { unitId: uid } });
    }
    await prisma.lttpSupplier.deleteMany({ where: { unitId: uid } });
    await prisma.lttpUnitIssueFormDefaults.deleteMany({ where: { unitId: uid } }).catch(() => {});
    try {
      await prisma.chungTuUnitProfile.deleteMany({ where: { unitId: uid } });
    } catch {
      /* bảng có thể chưa migrate */
    }
  }
}

async function seedCommodities(unitId, groupIds) {
  const existingCodes = new Set(
    (
      await prisma.lttpCommodity.findMany({
        where: { unitId },
        select: { code: true },
      })
    ).map((r) => r.code),
  );
  const toCreate = buildCommodityRows(unitId, groupIds).filter((r) => !existingCodes.has(r.code));
  if (!toCreate.length) {
    const n = await prisma.lttpCommodity.count({ where: { unitId } });
    console.log(`  LttpCommodity #${unitId}: đủ ${n} mặt hàng.`);
    return;
  }
  const chunk = 50;
  for (let i = 0; i < toCreate.length; i += chunk) {
    await prisma.lttpCommodity.createMany({
      data: toCreate.slice(i, i + chunk),
      skipDuplicates: true,
    });
  }
  const total = await prisma.lttpCommodity.count({ where: { unitId } });
  console.log(`  LttpCommodity #${unitId}: +${toCreate.length} (tổng ${total}).`);
}

async function seedSuppliers(unitId) {
  for (const s of DEV_SEED_SUPPLIERS) {
    const dup = await prisma.lttpSupplier.findFirst({ where: { unitId, name: s.name } });
    if (!dup) {
      await prisma.lttpSupplier.create({ data: { unitId, ...s } });
    }
  }
  return prisma.lttpSupplier.findMany({ where: { unitId }, orderBy: { id: "asc" } });
}

async function seedDefaultSuppliers(commodities, suppliers) {
  if (!suppliers.length) return;
  for (let i = 0; i < commodities.length; i += 1) {
    const commodity = commodities[i];
    const supplier = suppliers[i % suppliers.length];
    await prisma.lttpCommodityDefaultSupplier.upsert({
      where: { commodityId: commodity.id },
      create: { commodityId: commodity.id, lttpSupplierId: supplier.id },
      update: { lttpSupplierId: supplier.id },
    });
  }
}

async function seedPriceTable(unitId, effectiveYmd) {
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId },
    select: { id: true, code: true },
  });
  if (!commodities.length) return;

  const effectiveDate = parseDateOnlyUtc(effectiveYmd);
  let table = await prisma.lttpPriceTable.findUnique({
    where: { unitId_effectiveDate: { unitId, effectiveDate } },
  });
  if (!table) {
    table = await prisma.lttpPriceTable.create({
      data: { unitId, effectiveDate, note: "[dev-seed] Bảng giá mẫu" },
    });
  }

  const existingRowIds = new Set(
    (
      await prisma.lttpPriceRow.findMany({
        where: { priceTableId: table.id },
        select: { commodityId: true },
      })
    ).map((r) => r.commodityId),
  );

  const priceRows = [];
  for (const c of commodities) {
    if (existingRowIds.has(c.id)) continue;
    const codeNum = Number(c.code);
    const price = unitPriceForCode(Number.isFinite(codeNum) ? codeNum : 1);
    priceRows.push({
      priceTableId: table.id,
      commodityId: c.id,
      unitPrice: String(price),
      tgsxPrice: null,
      partnerUnitPrice: String(Math.round(price * 0.92)),
    });
  }
  if (priceRows.length) {
    const chunk = 100;
    for (let i = 0; i < priceRows.length; i += chunk) {
      await prisma.lttpPriceRow.createMany({
        data: priceRows.slice(i, i + chunk),
        skipDuplicates: true,
      });
    }
  }
}

async function seedUnitProfiles(unit) {
  const formDefaults = lttpFormDefaultsForStorageUnit(unit.name);
  const existingDefaults = await prisma.lttpUnitIssueFormDefaults.findUnique({
    where: { unitId: unit.id },
  });
  if (!existingDefaults) {
    await prisma.lttpUnitIssueFormDefaults.create({
      data: { unitId: unit.id, ...formDefaults },
    });
  }
  const chungTuProfile = chungTuProfileForWarehouseUnit(unit.name);
  try {
    await prisma.chungTuUnitProfile.upsert({
      where: { unitId: unit.id },
      create: { unitId: unit.id, ...chungTuProfile },
      update: chungTuProfile,
    });
  } catch (e) {
    if (e?.code === "P2021") {
      console.warn(
        `  ChungTuUnitProfile #${unit.id}: bảng chưa có — chạy prisma migrate deploy rồi seed lại.`,
      );
      return;
    }
    throw e;
  }
}

async function countDevSlipsInCurrentMonth(storageUnitId) {
  const { from, to } = currentMonthBoundsUtc();
  return prisma.lttpIssueSlip.count({
    where: {
      unitId: storageUnitId,
      note: DEV_SEED_SLIP_NOTE,
      issueDate: { gte: from, lte: to },
    },
  });
}

async function clearDevSlipsInCurrentMonth(storageUnitId) {
  const { from, to } = currentMonthBoundsUtc();
  const result = await prisma.lttpIssueSlip.deleteMany({
    where: {
      unitId: storageUnitId,
      note: DEV_SEED_SLIP_NOTE,
      issueDate: { gte: from, lte: to },
    },
  });
  return result.count;
}

function pickCommodityLines(commodities, lineCount, slipIndex) {
  const startOffset = (slipIndex * 11) % Math.max(1, commodities.length);
  const picked = [];
  for (let i = 0; i < lineCount; i += 1) {
    picked.push(commodities[(startOffset + i) % commodities.length]);
  }
  return picked;
}

async function seedMonthlyIssueSlips({ storageUnit, recipientUnits, actorUserId, force }) {
  const unitId = storageUnit.id;
  const expectedTotal = recipientUnits.length * DEV_SEED_SLIPS_PER_RECIPIENT_MONTH;
  const existing = await countDevSlipsInCurrentMonth(unitId);
  if (existing >= expectedTotal && !force) {
    console.log(
      `  LttpIssueSlip #${unitId}: đã có ${existing} phiếu tháng này — bỏ qua (DEV_SEED_FORCE=1 để tạo lại).`,
    );
    return 0;
  }
  if (force && existing > 0) {
    const removed = await clearDevSlipsInCurrentMonth(unitId);
    console.log(`  LttpIssueSlip #${unitId}: xóa ${removed} phiếu dev tháng hiện tại.`);
  }

  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId, isActive: true },
    orderBy: { id: "asc" },
    include: { lttpCommodityDefaultSupplier: true },
  });
  if (commodities.length < DEV_SEED_SLIP_LINES_MIN) {
    console.warn(`  LttpIssueSlip #${unitId}: thiếu mặt hàng — bỏ qua phiếu.`);
    return 0;
  }

  const formDefaults = lttpFormDefaultsForStorageUnit(storageUnit.name);
  let created = 0;
  let totalLines = 0;
  let globalSlipIndex = 0;

  for (let rIdx = 0; rIdx < recipientUnits.length; rIdx += 1) {
    const recipient = recipientUnits[rIdx];
    const slipDays = scheduleSlipDaysForMonth(DEV_SEED_SLIPS_PER_RECIPIENT_MONTH);

    for (let slipIndex = 0; slipIndex < slipDays.length; slipIndex += 1) {
      const ymd = slipDays[slipIndex];
      const bookMmyy = bookMmyyFromYmd(ymd);
      const issueDate = parseDateOnlyUtc(ymd);
      const lineCount = randomInt(
        DEV_SEED_SLIP_LINES_MIN,
        DEV_SEED_SLIP_LINES_MAX,
        globalSlipIndex + unitId + rIdx,
      );

      await prisma.$transaction(async (tx) => {
        const serial = await tx.lttpIssueSlipSerial.upsert({
          where: { unitId_bookMmyy: { unitId, bookMmyy } },
          create: { unitId, bookMmyy, lastSlipNo: 0 },
          update: { lastSlipNo: { increment: 1 } },
        });
        const slipNo = serial.lastSlipNo;
        const picked = pickCommodityLines(commodities, lineCount, globalSlipIndex);
        const lines = picked.map((c, li) => {
          const codeNum = Number(c.code);
          const qty = 1 + ((li + globalSlipIndex) % 8);
          const unitPrice = unitPriceForCode(Number.isFinite(codeNum) ? codeNum : li + 1);
          return {
            commodityId: c.id,
            lttpSupplierId: c.lttpCommodityDefaultSupplier?.lttpSupplierId ?? null,
            requiredQuantity: String(qty),
            quantity: String(qty),
            unitPrice: String(unitPrice),
            tgsxPrice: null,
            amount: String(qty * unitPrice),
            lineNote: null,
          };
        });

        await tx.lttpIssueSlip.create({
          data: {
            unitId,
            issueDate,
            note: DEV_SEED_SLIP_NOTE,
            createdById: actorUserId,
            recipientUnitId: recipient.id,
            recipientDisplayName: recipient.name,
            bookMmyy,
            slipNo,
            printLine1: formDefaults.printLine1,
            printLine2: formDefaults.printLine2,
            formMauSo: formDefaults.formMauSo,
            warehouseFrom: formDefaults.warehouseFrom,
            signerWriter: formDefaults.signerWriter,
            signerRecipient: `Người nhận — ${recipient.name}`,
            signerApprover: formDefaults.signerApprover,
            lines: { create: lines },
          },
        });
      });

      created += 1;
      totalLines += lineCount;
      globalSlipIndex += 1;
    }
  }

  const { yearMonth } = currentMonthBoundsUtc();
  console.log(
    `  LttpIssueSlip kho #${unitId} «${storageUnit.name}»: +${created} phiếu tháng ${yearMonth} (~${Math.round(totalLines / Math.max(created, 1))} dòng/phiếu, ${recipientUnits.length} đơn vị nhận).`,
  );
  return created;
}

async function seedStorageUnit(storageUnit, groupIds, actorUserId, { force, skipSlips, recipientUnits }) {
  console.log(`\n— Kho cấp phát unitId=${storageUnit.id} «${storageUnit.name}»`);
  await seedCommodities(storageUnit.id, groupIds);
  const commodities = await prisma.lttpCommodity.findMany({
    where: { unitId: storageUnit.id },
    orderBy: { id: "asc" },
    select: { id: true, code: true },
  });
  const suppliers = await seedSuppliers(storageUnit.id);
  await seedDefaultSuppliers(commodities, suppliers);

  const monthStart = listDaysInCurrentMonthUtc()[0] ?? addDaysYmd(ymdTodayUtc(), -30);
  await seedPriceTable(storageUnit.id, monthStart);
  await seedPriceTable(storageUnit.id, ymdTodayUtc());
  await seedUnitProfiles(storageUnit);

  if (!skipSlips && recipientUnits?.length) {
    await seedMonthlyIssueSlips({ storageUnit, recipientUnits, actorUserId, force });
  }
}

async function main() {
  const { force, skipSlips, unitId: explicitUnitId } = parseArgs();
  const actorUserId = await resolveActorUserId();
  const groupIds = await ensureFoodGroups();

  let storageUnit;
  let recipientUnits = [];

  if (explicitUnitId) {
    storageUnit = await prisma.unit.findUnique({ where: { id: explicitUnitId } });
    if (!storageUnit) throw new Error(`Không tìm thấy unit id=${explicitUnitId}`);
    console.log(`\n=== Seed dev LTTP (một kho #${explicitUnitId}) ===`);
  } else {
    storageUnit = await resolveStorageUnit();
    recipientUnits = await ensureRecipientChildUnits(storageUnit);
    await cleanupLegacyWarehouseDataOnRecipientUnits(recipientUnits.map((u) => u.id));
    console.log(`\n=== Seed dev LTTP ===`);
    console.log(`Kho cấp phát: id=${storageUnit.id} «${storageUnit.name}»`);
  }

  console.log(`Actor userId: ${actorUserId}`);
  console.log(`Force slips: ${force} | Skip slips: ${skipSlips}`);
  console.log(
    `Mục tiêu: ${DEV_SEED_SLIPS_PER_RECIPIENT_MONTH} phiếu/tháng/đơn vị nhận, ${DEV_SEED_SLIP_LINES_MIN}–${DEV_SEED_SLIP_LINES_MAX} dòng/phiếu`,
  );

  await seedStorageUnit(storageUnit, groupIds, actorUserId, {
    force,
    skipSlips,
    recipientUnits,
  });

  const { yearMonth } = currentMonthBoundsUtc();
  const slipTotal = recipientUnits.length
    ? recipientUnits.length * DEV_SEED_SLIPS_PER_RECIPIENT_MONTH
    : 0;
  console.log("\nXong.");
  console.log(`- Kho cấp phát «${storageUnit.name}»: 200 mặt hàng + bảng giá`);
  if (slipTotal > 0) {
    console.log(`- ${slipTotal} phiếu tháng ${yearMonth} (${DEV_SEED_SLIPS_PER_RECIPIENT_MONTH} × ${recipientUnits.length} đơn vị nhận)`);
  }
  console.log(`- Note phiếu: ${DEV_SEED_SLIP_NOTE}`);
  console.log("- UI: chọn kho «Đơn vị mẫu cấp 2» — đơn vị nhận lọc trong tab Lịch sử xuất\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

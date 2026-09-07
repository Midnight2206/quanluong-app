import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { padDocNumber } from "./chung-tu-doc-number.util.js";

async function allocateDocNumberOnce({ unitId, categoryKey, quyenSo, sheetKey }, db) {
  const u = Number(unitId);
  const cat = String(categoryKey);
  const book = String(quyenSo).trim();
  const key = String(sheetKey).trim();

  return db.$transaction(async (tx) => {
    const existing = await tx.chungTuDocNumberAssignment.findUnique({
      where: {
        unitId_categoryKey_quyenSo_sheetKey: {
          unitId: u,
          categoryKey: cat,
          quyenSo: book,
          sheetKey: key,
        },
      },
    });
    if (existing) {
      return { quyenSo: book, seq: existing.seq, soChungTu: existing.soChungTu };
    }

    const counter = await tx.chungTuDocNumberCounter.upsert({
      where: {
        unitId_categoryKey_quyenSo: { unitId: u, categoryKey: cat, quyenSo: book },
      },
      create: { unitId: u, categoryKey: cat, quyenSo: book, nextSeq: 1 },
      update: {},
    });
    const seq = counter.nextSeq;
    await tx.chungTuDocNumberCounter.update({
      where: { id: counter.id },
      data: { nextSeq: seq + 1 },
    });

    const soChungTu = padDocNumber(seq);
    await tx.chungTuDocNumberAssignment.create({
      data: { unitId: u, categoryKey: cat, quyenSo: book, sheetKey: key, seq, soChungTu },
    });
    return { quyenSo: book, seq, soChungTu };
  });
}

export async function allocateDocNumber(
  { unitId, categoryKey, quyenSo, sheetKey },
  db = prisma,
) {
  const u = Number(unitId);
  const cat = String(categoryKey);
  const book = String(quyenSo).trim();
  const key = String(sheetKey).trim();
  if (!u || !cat || !book || !key) {
    throw new AppError({
      message: "Thiếu tham số cấp số chứng từ",
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    return await allocateDocNumberOnce({ unitId: u, categoryKey: cat, quyenSo: book, sheetKey: key }, db);
  } catch (error) {
    if (error?.code === "P2002") {
      return allocateDocNumberOnce({ unitId: u, categoryKey: cat, quyenSo: book, sheetKey: key }, db);
    }
    throw error;
  }
}

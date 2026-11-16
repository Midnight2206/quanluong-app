import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { respondSuccess } from "../../shared/utils/responders.js";
import { getDailyOrderSummary } from "../lttp/lttp.service.js";
import { exportSupplierDailyInvoicePdf } from "./lttp-supplier.daily-invoice-pdf.service.js";
import {
  getLttpSupplierMe,
  listLttpSupplierCatalog,
  listLttpSupplierLinks,
  patchLttpSupplierMe,
  readLttpSupplierDailyInvoice,
  readLttpSupplierDebt,
  readLttpSupplierLedger,
  readLttpSupplierOrders,
} from "./lttp-supplier.service.js";

async function getLttpSupplierCatalogController(_req, res) {
  const data = await listLttpSupplierCatalog(prisma);

  return respondSuccess(res, {
    message: "Danh mục nhà cung cấp",
    data,
  });
}

async function getLttpSupplierLinksForUserController(req, res) {
  const data = await listLttpSupplierLinks(Number(req.params.userId), prisma);

  return respondSuccess(res, {
    message: "Danh sách nhà cung cấp",
    data,
  });
}

async function getLttpSupplierLinksController(req, res) {
  const data = await listLttpSupplierLinks(req.user.id, prisma);

  return respondSuccess(res, {
    message: "Danh sách nhà cung cấp",
    data,
  });
}

async function getLttpSupplierOrdersController(req, res) {
  const data = await readLttpSupplierOrders({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    date: req.validatedQuery.date,
    db: prisma,
    summarize: getDailyOrderSummary,
  });

  return respondSuccess(res, {
    message: "Đặt hàng trong ngày",
    data,
  });
}

async function getLttpSupplierLedgerController(req, res) {
  const data = await readLttpSupplierLedger({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    from: req.validatedQuery.from,
    to: req.validatedQuery.to,
    db: prisma,
  });

  return respondSuccess(res, {
    message: "Sổ công nợ",
    data,
  });
}

async function getLttpSupplierMeController(req, res) {
  const data = await getLttpSupplierMe({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    db: prisma,
  });
  return respondSuccess(res, { message: "Hồ sơ nhà cung cấp", data });
}

async function patchLttpSupplierMeController(req, res) {
  const data = await patchLttpSupplierMe({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    payload: req.validatedBody,
    db: prisma,
  });
  return respondSuccess(res, { message: "Đã cập nhật hồ sơ nhà cung cấp", data });
}

async function getLttpSupplierDailyInvoiceController(req, res) {
  const data = await readLttpSupplierDailyInvoice({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    date: req.validatedQuery.date,
    db: prisma,
  });
  return respondSuccess(res, { message: "Hoá đơn hằng ngày", data });
}

async function printLttpSupplierDailyInvoiceController(req, res) {
  const { buffer, fileName } = await exportSupplierDailyInvoicePdf({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    date: req.validatedQuery.date,
    db: prisma,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  return res.send(buffer);
}

async function getLttpSupplierDebtController(req, res) {
  const data = await readLttpSupplierDebt({
    userId: req.user.id,
    supplierId: req.validatedQuery.supplierId,
    db: prisma,
  });
  return respondSuccess(res, { message: "Công nợ và thanh toán", data });
}

export {
  getLttpSupplierCatalogController,
  getLttpSupplierDailyInvoiceController,
  getLttpSupplierDebtController,
  getLttpSupplierLinksController,
  getLttpSupplierLinksForUserController,
  getLttpSupplierLedgerController,
  getLttpSupplierMeController,
  getLttpSupplierOrdersController,
  patchLttpSupplierMeController,
  printLttpSupplierDailyInvoiceController,
};

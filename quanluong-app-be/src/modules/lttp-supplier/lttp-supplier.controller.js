import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { respondSuccess } from "../../shared/utils/responders.js";
import { getDailyOrderSummary } from "../lttp/lttp.service.js";
import {
  listLttpSupplierCatalog,
  listLttpSupplierLinks,
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

export {
  getLttpSupplierCatalogController,
  getLttpSupplierLinksController,
  getLttpSupplierLinksForUserController,
  getLttpSupplierLedgerController,
  getLttpSupplierOrdersController,
};

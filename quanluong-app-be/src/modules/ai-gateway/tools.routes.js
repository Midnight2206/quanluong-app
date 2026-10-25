import { timingSafeEqual } from "node:crypto";
import express from "express";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import { logger } from "../../shared/utils/logger.js";
import {
  proposeIssueSlipDraft,
  proposeLedgerDraft,
  readLedgerDay,
  readMenuDay,
} from "./tools.service.js";

function tokenOk(header) {
  const expected = String(process.env.DSH_SERVICE_TOKEN || "").trim();
  if (!expected) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ""));
  if (!match) return false;
  const got = Buffer.from(match[1]);
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

function requireToken(req, _res, next) {
  if (!tokenOk(req.headers.authorization)) {
    next(new AppError({ message: "Unauthorized", statusCode: 401, code: ERROR_CODES.UNAUTHORIZED }));
    return;
  }
  next();
}

function ok(res, data) {
  res.json({ ok: true, data });
}

const dshInternalRouter = express.Router();
dshInternalRouter.use(requireToken);

dshInternalRouter.post("/tools/ledger/read", asyncHandler(async (req, res) => {
  ok(res, await readLedgerDay(req.body || {}));
}));

dshInternalRouter.post("/tools/ledger/propose", asyncHandler(async (req, res) => {
  ok(res, proposeLedgerDraft(req.body || {}));
}));

dshInternalRouter.post("/tools/menu/read", asyncHandler(async (req, res) => {
  ok(res, await readMenuDay(req.body || {}));
}));

dshInternalRouter.post("/tools/issue-slip/propose", asyncHandler(async (req, res) => {
  ok(res, proposeIssueSlipDraft(req.body || {}));
}));

dshInternalRouter.post("/audit", asyncHandler(async (req, res) => {
  const body = req.body || {};
  logger.info({
    msg: "dsh.audit",
    kind: body.kind || "llm",
    status: body.status || "",
    feature: body.feature || "",
    model: body.model || "",
    name: body.name || "",
    ms: body.ms,
  }, "dsh audit");
  ok(res, { logged: true });
}));

export { dshInternalRouter };

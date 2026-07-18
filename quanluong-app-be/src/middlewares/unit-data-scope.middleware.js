import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import { getDataKindDefinition } from "../shared/data-scope/data-scope.registry.js";
import { resolvePrivateStorageUnitId } from "../shared/data-scope/unit-data-policy.service.js";

/**
 * @param {import('express').Request} req
 * @param {string[]} [extraQueryKeys] — ví dụ `date` (LTTP effective)
 */
function parseAsOf(req, extraQueryKeys = []) {
  for (const key of extraQueryKeys) {
    const v =
      req.query?.[key] ??
      req.validatedBody?.[key] ??
      req.body?.[key];
    if (v != null && String(v).trim() !== "") {
      const d = new Date(String(v));
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
  }
  const raw = req.query?.asOf ?? req.headers["x-data-as-of"];
  if (raw == null || raw === "") {
    return new Date();
  }
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    return new Date();
  }
  return d;
}

/**
 * @param {import('express').Request} req
 * @returns {number | null}
 */
function resolveLogicalUnitId(req) {
  const vb = req.validatedBody?.unitId;
  if (Number.isInteger(vb) && vb > 0) {
    return vb;
  }
  const vq = req.validatedQuery?.unitId;
  if (Number.isInteger(vq) && vq > 0) {
    return vq;
  }
  const fromBody = req.body?.unitId;
  if (Number.isInteger(fromBody) && fromBody > 0) {
    return fromBody;
  }
  const q =
    req.query?.unitId != null && req.query?.unitId !== ""
      ? Number(req.query.unitId)
      : NaN;
  if (Number.isInteger(q) && q > 0) {
    return q;
  }
  const pUnit =
    req.params?.unitId != null && req.params?.unitId !== ""
      ? Number(req.params.unitId)
      : NaN;
  if (Number.isInteger(pUnit) && pUnit > 0) {
    return pUnit;
  }
  const raw = req.headers["x-target-unit-id"];
  if (raw != null && String(raw).trim() !== "") {
    const h = Number(String(raw).trim());
    if (Number.isInteger(h) && h > 0) {
      return h;
    }
  }
  const uid = req.user?.unitId;
  if (Number.isInteger(uid) && uid > 0) {
    return uid;
  }
  return null;
}

/**
 * Gắn `req.dataScope` cho handler đọc/ghi DB theo kind + chính sách đơn vị + (tùy) thời điểm `asOf`.
 *
 * @param {{ dataKind: string, recordIdParam?: string, asOfQueryKeys?: string[] }} opts
 */
function unitDataScopeMiddleware(opts) {
  const { dataKind, recordIdParam, asOfQueryKeys = [] } = opts;

  return async (req, _res, next) => {
    try {
      const def = getDataKindDefinition(dataKind);
      if (!def) {
        throw new AppError({
          message: `Không tồn tại data kind: ${dataKind}`,
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        });
      }

      const asOf = parseAsOf(req, asOfQueryKeys);

      if (def.visibility === "public") {
        req.dataScope = {
          dataKind,
          visibility: "public",
          logicalUnitId: resolveLogicalUnitId(req),
          storageUnitId: null,
          asOf,
          via: "public_kind",
        };
        return next();
      }

      const logicalUnitId = resolveLogicalUnitId(req);
      if (!logicalUnitId) {
        throw new AppError({
          message: "Thiếu đơn vị ngữ cảnh cho phạm vi dữ liệu",
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
        });
      }

      let recordId;
      const rawRecId =
        recordIdParam != null
          ? req.validatedParams?.[recordIdParam] ?? req.params?.[recordIdParam]
          : undefined;
      if (recordIdParam && rawRecId != null && rawRecId !== "") {
        const n = Number(rawRecId);
        if (Number.isInteger(n) && n > 0) {
          recordId = n;
        }
      }

      const { storageUnitId, via } = await resolvePrivateStorageUnitId({
        logicalUnitId,
        dataKind,
        recordId,
        asOf,
      });

      req.dataScope = {
        dataKind,
        visibility: def.visibility,
        logicalUnitId,
        storageUnitId,
        asOf,
        via,
      };
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

export { unitDataScopeMiddleware, resolveLogicalUnitId, parseAsOf };

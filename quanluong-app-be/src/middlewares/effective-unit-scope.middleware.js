import { AppError } from "../errors/app-error.js";
import { ERROR_CODES } from "../errors/error-codes.js";
import {
  assertUnitIdInScope,
  getSubtreeUnitIds,
  UNIT_SCOPE_MODES,
} from "../shared/units/unit-scope.service.js";

/**
 * Chuẩn hoá phạm vi đơn vị theo header tùy chọn `X-Target-Unit-Id`:
 * - Không gửi: dùng full scope (subtree admin hoặc toàn hệ thống superadmin).
 * - Có gửi: chỉ nhánh con của đơn vị đó (cấp trên xem/lọc cấp dưới).
 * Gắn `req.targetUnitId`, `req.effectiveUnitIds` cho controller/service.
 */
async function effectiveUnitScopeMiddleware(req, _res, next) {
  try {
    if (!req.user) {
      req.targetUnitId = null;
      req.effectiveUnitIds = undefined;
      return next();
    }

    const scope = req.unitScope;
    const raw = req.headers["x-target-unit-id"];
    const trimmed = raw != null ? String(raw).trim() : "";

    if (!trimmed) {
      req.targetUnitId = null;
      if (!scope || scope.mode === UNIT_SCOPE_MODES.ALL) {
        req.effectiveUnitIds = null;
      } else {
        req.effectiveUnitIds = scope.unitIds;
      }
      return next();
    }

    const targetId = Number(trimmed);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw new AppError({
        message: "X-Target-Unit-Id không hợp lệ",
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    assertUnitIdInScope(targetId, scope);
    req.targetUnitId = targetId;
    req.effectiveUnitIds = await getSubtreeUnitIds(targetId);
    return next();
  } catch (e) {
    return next(e);
  }
}

export { effectiveUnitScopeMiddleware };

import {
  resolveUnitScopeForUser,
  UNIT_SCOPE_MODES,
} from "../shared/units/unit-scope.service.js";

async function unitScopeMiddleware(req, _res, next) {
  try {
    if (!req.user) {
      req.unitScope = { mode: UNIT_SCOPE_MODES.ALL, unitIds: null };
      return next();
    }

    req.unitScope = await resolveUnitScopeForUser(req.user);
    return next();
  } catch (error) {
    return next(error);
  }
}

export { unitScopeMiddleware };

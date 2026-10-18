import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { BA_SCOPES } from "./ba-profiles.utils.js";
import {
  assertTokenCanReadUnit,
  createToken,
  getProfileById,
  listLatestProfiles,
  listTokens,
  listUnitHistory,
  pushUnitProfile,
  revokeToken,
} from "./ba-profiles.service.js";

async function pushProfileController(req, res) {
  const data = await pushUnitProfile({ token: req.baToken, body: req.validatedBody });
  return respondCreated(res, { message: "Đã lưu hồ sơ nghiệp vụ.", data });
}

async function listProfilesByTokenController(req, res) {
  const { latest, unitId } = req.validatedQuery;
  const token = req.baToken;
  if (unitId) {
    assertTokenCanReadUnit(token, unitId);
    return respondSuccess(res, { data: await listUnitHistory(unitId) });
  }
  if (latest && token.scope === BA_SCOPES.GLOBAL_READ) {
    return respondSuccess(res, { data: await listLatestProfiles() });
  }
  if (token.scope === BA_SCOPES.UNIT_PUSH) {
    return respondSuccess(res, { data: await listUnitHistory(token.unitId) });
  }
  throw new AppError({
    message: "Dùng ?latest=1 hoặc ?unitId=…",
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

async function getProfileByTokenController(req, res) {
  const row = await getProfileById(req.validatedParams.id);
  assertTokenCanReadUnit(req.baToken, row.unitId);
  return respondSuccess(res, { data: row });
}

// superadmin qua đăng nhập
async function adminListProfilesController(req, res) {
  const { unitId } = req.validatedQuery;
  const data = unitId ? await listUnitHistory(unitId) : await listLatestProfiles();
  return respondSuccess(res, { data });
}

async function adminGetProfileController(req, res) {
  return respondSuccess(res, { data: await getProfileById(req.validatedParams.id) });
}

async function createTokenController(req, res) {
  const data = await createToken({ user: req.user, ...req.validatedBody });
  return respondCreated(res, {
    message: "Đã tạo mã khóa. Mã chỉ hiện một lần, hãy lưu lại ngay.",
    data,
  });
}

async function listTokensController(req, res) {
  return respondSuccess(res, { data: await listTokens({ user: req.user }) });
}

async function revokeTokenController(req, res) {
  const data = await revokeToken({ user: req.user, id: req.validatedParams.id });
  return respondSuccess(res, { message: "Đã thu hồi mã khóa.", data });
}

export {
  adminGetProfileController,
  adminListProfilesController,
  createTokenController,
  getProfileByTokenController,
  listProfilesByTokenController,
  listTokensController,
  pushProfileController,
  revokeTokenController,
};

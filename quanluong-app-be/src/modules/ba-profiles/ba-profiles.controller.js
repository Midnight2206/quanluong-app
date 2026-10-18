import { respondCreated, respondSuccess } from "../../shared/utils/responders.js";
import { AppError } from "../../errors/app-error.js";
import { ERROR_CODES } from "../../errors/error-codes.js";
import { config } from "../../config/config.js";
import { BA_SCOPES, GLOBAL_SCOPES, buildStartGuide, detectSecrets } from "./ba-profiles.utils.js";
import { baActorLabel } from "./ba-token-auth.middleware.js";
import {
  createProposal,
  getBaselineDoc,
  getStartGuideData,
  getComparison,
  listBaselineVersions,
  listLatestBaseline,
  listProposals,
  publishBaselineDoc,
  reviewProposal,
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
  if (latest && GLOBAL_SCOPES.includes(token.scope)) {
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

// ---------- Bộ nghiệp vụ chung / so sánh / đề xuất (token hoặc superadmin) ----------

async function listBaselineController(_req, res) {
  return respondSuccess(res, { data: await listLatestBaseline() });
}

async function getBaselineDocController(req, res) {
  const { docKey } = req.validatedParams;
  return respondSuccess(res, { data: await getBaselineDoc(docKey, req.validatedQuery?.version) });
}

async function listBaselineVersionsController(req, res) {
  return respondSuccess(res, { data: await listBaselineVersions(req.validatedParams.docKey) });
}

async function publishBaselineController(req, res) {
  const data = await publishBaselineDoc({
    docKey: req.validatedParams.docKey,
    ...req.validatedBody,
    actor: baActorLabel(req.baToken),
  });
  return respondCreated(res, { message: "Đã đăng phiên bản mới.", data });
}

async function comparisonController(_req, res) {
  return respondSuccess(res, { data: await getComparison() });
}

async function createProposalController(req, res) {
  const data = await createProposal({ token: req.baToken, body: req.validatedBody });
  return respondCreated(res, { message: "Đã gửi đề xuất.", data });
}

async function listProposalsController(req, res) {
  const data = await listProposals({ token: req.baToken, status: req.validatedQuery?.status });
  return respondSuccess(res, { data });
}

async function reviewProposalController(req, res) {
  const data = await reviewProposal({
    id: req.validatedParams.id,
    ...req.validatedBody,
    actor: baActorLabel(req.baToken),
  });
  return respondSuccess(res, { message: "Đã cập nhật đề xuất.", data });
}

// ---------- Trang khởi động công khai cho trợ lý BA ----------

/** Địa chỉ gốc công khai: BA_PUBLIC_BASE_URL > PUBLIC_WEB_URL (không lấy từ Host header). */
function resolvePublicBaseUrl() {
  return process.env.BA_PUBLIC_BASE_URL || config.publicWebUrl;
}

async function startGuideController(req, res) {
  const { guide, docs } = await getStartGuideData();
  const out = buildStartGuide({ guide, docs, baseUrl: resolvePublicBaseUrl() });
  // Lưới an toàn: hướng dẫn công khai không bao giờ được chứa bí mật.
  const leaked = detectSecrets(out.markdown);
  const blocked = leaked.length > 0;
  const statusCode = !guide || blocked ? 503 : 200;
  const markdown = blocked
    ? "# Hướng dẫn trợ lý BA\n\nHướng dẫn tạm khoá vì có nội dung giống bí mật. Báo quản trị app đăng lại bản sạch.\n"
    : out.markdown;
  res.set("Cache-Control", "public, max-age=60");
  res.set("X-Robots-Tag", "noindex");
  const wantsJson = String(req.query?.format || "").toLowerCase() === "json";
  if (wantsJson) {
    return res.status(statusCode).json({
      success: statusCode === 200,
      message: statusCode === 200 ? "Success" : "Chưa có hướng dẫn công khai.",
      data: blocked ? null : { baseUrl: out.baseUrl, guide: out.guide, docs: out.docs, contentMarkdown: markdown },
    });
  }
  return res.status(statusCode).type("text/markdown; charset=utf-8").send(markdown);
}

export {
  startGuideController,
  comparisonController,
  createProposalController,
  getBaselineDocController,
  listBaselineController,
  listBaselineVersionsController,
  listProposalsController,
  publishBaselineController,
  reviewProposalController,
  adminGetProfileController,
  adminListProfilesController,
  createTokenController,
  getProfileByTokenController,
  listProfilesByTokenController,
  listTokensController,
  pushProfileController,
  revokeTokenController,
};

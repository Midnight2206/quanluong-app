import { respondSuccess } from "../../shared/utils/responders.js";
import {
  addMemory,
  applyDraft,
  getAssistant,
  postTurn,
  removeMemory,
  removeRule,
  saveProfile,
} from "./kitchen-ledger-assistant.service.js";

function ctx(req) {
  return [req.unitScope, req.effectiveUnitIds, req.dataScope];
}

function surfaceOf(req) {
  const raw = String(req.get("x-app-surface") || "web").trim().toLowerCase();
  if (raw === "superadmin" || raw === "supplier" || raw === "web") return raw;
  return "web";
}

async function getAssistantController(req, res) {
  const data = await getAssistant(req.validatedQuery, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã tải trợ lý làm sổ", data });
}

async function postAssistantTurnController(req, res) {
  const data = await postTurn(req.validatedBody, req.user, ...ctx(req), { surface: surfaceOf(req) });
  return respondSuccess(res, { message: "Đã trả lời", data });
}

async function applyAssistantController(req, res) {
  const data = await applyDraft(req.validatedBody, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã ghi từ bản nháp", data });
}

async function saveAssistantProfileController(req, res) {
  const data = await saveProfile(req.validatedBody, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã lưu tuỳ chọn trợ lý", data });
}

async function addAssistantMemoryController(req, res) {
  const data = await addMemory(req.validatedBody, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã nhớ", data });
}

async function deleteAssistantMemoryController(req, res) {
  const data = await removeMemory(req.validatedQuery, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã xóa ghi nhớ", data });
}

async function deleteAssistantRuleController(req, res) {
  const data = await removeRule(req.validatedQuery, req.user, ...ctx(req));
  return respondSuccess(res, { message: "Đã xóa quy tắc", data });
}

export {
  addAssistantMemoryController,
  applyAssistantController,
  deleteAssistantMemoryController,
  deleteAssistantRuleController,
  getAssistantController,
  postAssistantTurnController,
  saveAssistantProfileController,
};

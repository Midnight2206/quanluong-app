import { randomUUID } from "node:crypto";
import { httpError } from "../../src/http-error.js";
import { emptyBook, putUnit } from "../../src/json-doc.js";

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BLOCKED = [
  /\brm\s+-[a-zA-Z]*f/i,
  /\bcurl\b[^|\n]{0,200}\|\s*(ba)?sh\b/i,
  /\bwget\b[^|\n]{0,200}\|\s*(ba)?sh\b/i,
  /\b(sudo|mkfs|shutdown|reboot)\b/i,
  /:\(\)\s*\{/,
  /\b(DROP|TRUNCATE)\s+TABLE\b/i,
  /\b(child_process|process\.env)\b/,
  /BEGIN\s+(RSA |OPENSSH )?PRIVATE KEY/,
];

export function scanSkillBody(body) {
  const hit = BLOCKED.find((pattern) => pattern.test(String(body || "")));
  return hit ? { ok: false, reason: "Skill body contains a blocked pattern." } : { ok: true };
}

export function skillNameFromTask(task) {
  const slug = String(task || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "task-skill";
}

export function skillFromTrace({ task, toolTrace }) {
  const steps = (Array.isArray(toolTrace) ? toolTrace : [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .map((name) => String(name || "").trim())
    .filter((name) => name && !["delegate_task", "schedule_job", "capture_task_skill"].includes(name));
  if (steps.length < 2) throw httpError(400, "A skill needs at least two tool steps.", "SKILL_TOO_SHORT");
  const body = [
    "Quy trình này chỉ tạo báo cáo hoặc bản nháp. Người dùng xác nhận trước khi ghi dữ liệu.",
    "Số liệu lấy từ công cụ đọc. Không tự cộng.",
    "",
    ...steps.map((name, index) => `${index + 1}. Gọi \`${name}\`.`),
  ].join("\n");
  return {
    name: skillNameFromTask(task),
    description: String(task || "Quy trình vừa làm").trim().slice(0, 240),
    body,
  };
}

function skillsOf(doc, unitId) {
  return [...(doc.units?.[String(unitId)]?.skills || [])];
}

function withSkills(doc, unitId, skills) {
  const current = doc.units?.[String(unitId)] || {};
  return putUnit(doc, unitId, { ...current, skills });
}

function assertBody(body) {
  const scan = scanSkillBody(body);
  if (!scan.ok) throw httpError(400, scan.reason, "SKILL_BLOCKED");
}

export function listUnitSkills(doc, unitId) {
  return skillsOf(doc || emptyBook(), unitId);
}

export function draftSkill(doc, input) {
  const name = String(input.name || "").trim();
  if (!NAME_RE.test(name)) throw httpError(400, "Skill name must be kebab-case.", "BAD_SKILL_NAME");
  const body = String(input.body || "").slice(0, 12000);
  assertBody(body);
  const row = {
    id: input.id || `skl_${randomUUID()}`,
    name,
    description: String(input.description || "").slice(0, 240),
    body,
    status: "draft",
    revision: 1,
    uses: 0,
    notes: [],
    createdBy: String(input.accountId || ""),
    updatedAt: input.now || new Date().toISOString(),
    effect: "draft",
  };
  return { doc: withSkills(doc, input.unitId, [...skillsOf(doc, input.unitId), row]), skill: row };
}

export function noteSkillUse(doc, input) {
  const skills = skillsOf(doc, input.unitId);
  const current = [...skills].reverse().find((item) => item.name === input.name && item.status !== "rejected");
  if (!current) throw httpError(404, "Skill not found", "NOT_FOUND");
  const used = {
    ...current,
    uses: current.uses + 1,
    notes: [...current.notes, {
      at: input.now || new Date().toISOString(),
      outcome: String(input.outcome || "ok").slice(0, 40),
      by: String(input.accountId || ""),
    }],
  };
  let next = skills.map((item) => (item.id === current.id ? used : item));
  let revision = null;
  const improvement = String(input.improvement || "").trim();
  if (improvement) {
    const body = `${current.body}\n\n## Khi dùng lại\n${improvement}`.slice(0, 12000);
    assertBody(body);
    revision = {
      id: `skl_${randomUUID()}`,
      name: current.name,
      description: current.description,
      body,
      status: "draft",
      revision: current.revision + 1,
      uses: 0,
      notes: [],
      createdBy: String(input.accountId || ""),
      updatedAt: input.now || new Date().toISOString(),
      replacesId: current.id,
      effect: "draft",
    };
    next = [...next, revision];
  }
  return { doc: withSkills(doc, input.unitId, next), skill: used, revision };
}

export function acceptSkill(doc, input) {
  const skills = skillsOf(doc, input.unitId);
  const target = skills.find((item) => item.id === input.id);
  if (!target) throw httpError(404, "Skill not found", "NOT_FOUND");
  if (target.status !== "draft") throw httpError(409, "Only a draft can be accepted", "NOT_DRAFT");
  const now = input.now || new Date().toISOString();
  const next = skills.map((item) => {
    if (item.id === target.id) return { ...item, status: "active", updatedAt: now, effect: "active" };
    if (item.name === target.name && item.status === "active") {
      return { ...item, status: "archived", updatedAt: now };
    }
    return item;
  });
  return { doc: withSkills(doc, input.unitId, next), skill: next.find((item) => item.id === target.id) };
}

export function rejectSkill(doc, input) {
  const skills = skillsOf(doc, input.unitId);
  const target = skills.find((item) => item.id === input.id);
  if (!target) throw httpError(404, "Skill not found", "NOT_FOUND");
  const now = input.now || new Date().toISOString();
  const next = skills.map((item) => (
    item.id === target.id ? { ...item, status: "rejected", updatedAt: now } : item
  ));
  return { doc: withSkills(doc, input.unitId, next), skill: next.find((item) => item.id === target.id) };
}

import { randomUUID } from "node:crypto";
import { httpError } from "../../src/http-error.js";
import { putUnit } from "../../src/json-doc.js";

export const ROLES = {
  "ledger-reader": {
    tools: ["read_ledger_day", "load_quanluong_skill"],
    skills: ["explore-data", "validate-data", "ledger-rules", "ledger-extract"],
  },
  "menu-reader": {
    tools: ["read_menu_day", "load_quanluong_skill"],
    skills: ["menu-rules"],
  },
  "slip-drafter": {
    tools: ["propose_issue_slip_lines", "load_quanluong_skill"],
    skills: ["issue-slip-rules"],
  },
  "skill-clerk": {
    tools: ["draft_skill", "capture_task_skill", "list_learned_skills", "note_skill_use"],
    skills: [],
  },
  "memory-clerk": {
    tools: ["memory_remember", "memory_search", "memory_summarize", "memory_forget"],
    skills: [],
  },
};

const BLOCKED = new Set(["bash", "shell", "write", "edit", "execute_code", "run_code", "save_ledger"]);

export function openAssignment(input) {
  const spec = ROLES[input.role];
  if (!spec) throw httpError(400, "Unknown subagent role", "BAD_ROLE");
  return {
    id: input.id || `asg_${randomUUID()}`,
    unitId: String(input.unitId),
    accountId: String(input.accountId),
    role: input.role,
    task: String(input.task || "").slice(0, 2000),
    allowedTools: [...spec.tools],
    allowedSkills: [...spec.skills],
    status: "open",
    effect: "report-only",
    persisted: false,
    writes: 0,
    report: "",
    createdAt: input.now || new Date().toISOString(),
  };
}

export function childSystem(assignment) {
  return [
    `Bạn là subagent ${assignment.role}.`,
    `Chỉ được gọi: ${assignment.allowedTools.join(", ") || "(không có tool)"}.`,
    `Skill được đọc: ${assignment.allowedSkills.join(", ") || "(không)"}.`,
    "Chỉ trả báo cáo hoặc bản nháp. Không ghi cơ sở dữ liệu. Không tự tính số liệu.",
    "Không gọi delegate_task hay schedule_job.",
    `Việc: ${assignment.task}`,
  ].join("\n");
}

export function guardChildCall(assignment, exec) {
  const name = String(exec?.name || exec?.toolName || "");
  if (!assignment?.allowedTools?.includes(name) || BLOCKED.has(name)) {
    return { kind: "deny", reason: `Role ${assignment?.role || "subagent"} cannot call ${name}.` };
  }
  const args = exec?.arguments || exec?.args || {};
  if (args.commit === true || args.save === true || args.apply === true) {
    return { kind: "deny", reason: "Subagent may only report or draft." };
  }
  return { kind: "allow" };
}

export function finishAssignment(assignment, report) {
  return {
    ...assignment,
    status: "reported",
    report: String(report || "").slice(0, 8000),
    effect: "report-only",
    persisted: false,
    writes: 0,
  };
}

function bucket(doc, unitId) {
  return doc.units?.[String(unitId)] || { assignments: [] };
}

export function saveAssignment(doc, assignment) {
  const current = bucket(doc, assignment.unitId);
  const assignments = current.assignments || [];
  const next = assignments.some((item) => item.id === assignment.id)
    ? assignments.map((item) => (item.id === assignment.id ? assignment : item))
    : [...assignments, assignment].slice(-100);
  return { doc: putUnit(doc, assignment.unitId, { ...current, assignments: next }), assignment };
}

export function readAssignment(doc, unitId, id) {
  const row = (bucket(doc, unitId).assignments || []).find((item) => item.id === id);
  return row || null;
}

export function reserveSlot(state, max = 3) {
  const limit = Number(max) > 0 ? Number(max) : 3;
  if (state.inflight >= limit) throw httpError(429, "Subagent limit reached", "SUBAGENT_LIMIT");
  return { inflight: state.inflight + 1 };
}

export function releaseSlot(state) {
  return { inflight: Math.max(0, state.inflight - 1) };
}

export function createGate(max = 3) {
  let inflight = 0;
  return async function gate(fn) {
    inflight = reserveSlot({ inflight }, max).inflight;
    try {
      return await fn();
    } finally {
      inflight = releaseSlot({ inflight }).inflight;
    }
  };
}

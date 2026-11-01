import { guardChildCall } from "../quanluong-subagents/logic.js";
import { guardScheduledCall } from "../quanluong-schedule/logic.js";

export const TOOL_PERMISSIONS = {
  read_ledger_day: "read",
  read_menu_day: "read",
  load_quanluong_skill: "read",
  list_learned_skills: "read",
  memory_search: "read",
  memory_summarize: "read",
  list_jobs: "read",
  review_code: "read",
  propose_ledger_records: "draft",
  propose_issue_slip_lines: "draft",
  draft_skill: "draft",
  capture_task_skill: "draft",
  note_skill_use: "draft",
  memory_remember: "draft",
  memory_forget: "draft",
  delegate_task: "draft",
  schedule_job: "draft",
  disable_job: "draft",
  "mcp__quanluong__read_ledger_day": "read",
  "mcp__quanluong__read_menu_day": "read",
  "mcp__quanluong__propose_ledger_records": "draft",
  "mcp__quanluong__propose_issue_slip_lines": "draft",
};

const DENY = new Set([
  "bash",
  "shell",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "execute_code",
  "run_code",
  "web_search",
  "web_fetch",
]);

const DANGEROUS = [
  /\brm\s+(-[a-zA-Z]*f|-rf|--recursive)\b/i,
  /\bmkfs(\.\w+)?\b/i,
  /\b(shutdown|reboot|poweroff|halt)\b/i,
  /\bdd\s+if=/i,
  /\bchmod\s+(-R\s+)?777\b/i,
  /\bcurl\b[^|\n]{0,200}\|\s*(ba)?sh\b/i,
  /\bwget\b[^|\n]{0,200}\|\s*(ba)?sh\b/i,
  /:\(\)\s*\{/,
  /\bsudo\b/i,
  /\bgit\s+push\b/i,
  /\bnc\s+-e\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /\b(DROP|TRUNCATE)\s+TABLE\b/i,
  /\b(eval|Function)\s*\(/,
];

export function sandboxStrict(env = process.env) {
  const raw = env.DSH_SANDBOX_STRICT;
  if (raw == null || String(raw).trim() === "") return true;
  return !["0", "false", "off", "no"].includes(String(raw).trim().toLowerCase());
}

export function findDangerous(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return DANGEROUS.some((pattern) => pattern.test(text)) ? "Blocked dangerous command." : "";
}

function toolName(exec) {
  return String(exec?.name || exec?.toolName || "");
}

export function decideSandbox(exec, actor = null, options = {}) {
  const name = toolName(exec);
  const danger = findDangerous(exec?.arguments || exec?.args || {});
  if (danger) return { kind: "deny", reason: danger };
  if (DENY.has(name)) return { kind: "deny", reason: "Tool is not permitted." };
  const args = exec?.arguments || exec?.args || {};
  if (args.commit === true || args.save === true || args.apply === true) {
    return { kind: "deny", reason: "Sandbox allows read and draft only." };
  }
  const scheduled = guardScheduledCall(actor, exec);
  if (scheduled) return scheduled;
  if (actor?.assignment) {
    const child = guardChildCall(actor.assignment, exec);
    if (child.kind === "deny") return child;
  }
  const permission = TOOL_PERMISSIONS[name];
  if (permission === "read" || permission === "draft") return null;
  const strict = options.strict == null ? true : options.strict;
  if (!strict) return null;
  return { kind: "deny", reason: `No permission for ${name}.` };
}

export function reviewCode(source) {
  const text = String(source || "");
  const danger = findDangerous(text);
  if (danger) return { isolated: true, executed: false, allowed: false, reason: danger };
  if (/\b(require|import|process|fs|child_process|net|http)\b/.test(text)) {
    return {
      isolated: true,
      executed: false,
      allowed: false,
      reason: "Code cannot touch the host, network, or files.",
    };
  }
  // ponytail: model code is reviewed and not run. A network-free container with no DB credentials is the upgrade path.
  return { isolated: true, executed: false, allowed: true, reason: "Code was reviewed and not executed." };
}

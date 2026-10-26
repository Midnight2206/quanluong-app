export const name = "quanluong-policy";
export const inject = ["tools"];

const MCP_TOOLS = new Set([
  "mcp__quanluong__read_ledger_day",
  "mcp__quanluong__propose_ledger_records",
  "mcp__quanluong__read_menu_day",
  "mcp__quanluong__propose_issue_slip_lines",
]);

const HOST_TOOLS = new Set([
  "bash",
  "shell",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "run_code",
]);

function toolName(exec) {
  return String(exec?.name || exec?.toolName || exec?.tool?.name || "");
}

export function decide(exec) {
  const name = toolName(exec);
  if (HOST_TOOLS.has(name)) {
    return { kind: "deny", reason: "This profile cannot use host tools." };
  }
  if (name.startsWith("mcp__") && !MCP_TOOLS.has(name)) {
    return { kind: "deny", reason: "Only the Quan Luong read and draft MCP tools are allowed." };
  }
  const args = exec?.arguments || exec?.args || {};
  if (args && (args.commit === true || args.save === true || args.apply === true)) {
    return { kind: "deny", reason: "Tools may draft only. They cannot commit." };
  }
  return null;
}

export function apply(ctx) {
  try {
    ctx.on("tools/pre-execute", async (exec, next) => {
      const denied = decide(exec);
      if (denied) return denied;
      return typeof next === "function" ? next() : { kind: "allow" };
    });
  } catch (error) {
    console.error(`[quanluong-policy] tools/pre-execute unavailable: ${error?.message || error}`);
  }
  try {
    if (typeof ctx.tools?.guard === "function") {
      ctx.tools.guard((exec) => {
        const denied = decide(exec);
        return denied ? denied.reason : undefined;
      });
    }
  } catch (error) {
    console.error(`[quanluong-policy] tools.guard unavailable: ${error?.message || error}`);
  }
}

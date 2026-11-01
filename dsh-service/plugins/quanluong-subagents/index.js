import { currentActor } from "../../src/request-context.js";
import { requireActor } from "../../src/actor.js";
import { registerTextTool } from "../register-text-tool.js";
import { guardChildCall } from "./logic.js";
import { runSubagent } from "./runtime.js";

export const name = "quanluong-subagents";
export const inject = ["tools"];

export function apply(ctx) {
  try {
    ctx.on("tools/pre-execute", async (exec, next) => {
      const actor = currentActor();
      if (actor?.assignment) {
        const decision = guardChildCall(actor.assignment, exec);
        if (decision.kind === "deny") return decision;
      }
      return typeof next === "function" ? next() : { kind: "allow" };
    });
  } catch (error) {
    console.error(`[quanluong-subagents] tools/pre-execute unavailable: ${error?.message || error}`);
  }
  try {
    registerTextTool(ctx, {
      name: "delegate_task",
      description: "Hand a task to a specialist role. The child returns a report or a draft and does not save data.",
      parameters: {
        role: {
          type: "string",
          required: true,
          description: "ledger-reader, menu-reader, slip-drafter, skill-clerk, or memory-clerk",
        },
        task: { type: "string", required: true, description: "What the child should report." },
      },
      run: (args) => runSubagent(requireActor(currentActor(), args), args),
    });
  } catch (error) {
    console.error(`[quanluong-subagents] ${error?.message || error}`);
  }
}

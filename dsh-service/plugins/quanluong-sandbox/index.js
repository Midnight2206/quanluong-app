import { currentActor } from "../../src/request-context.js";
import { registerTextTool } from "../register-text-tool.js";
import { decideSandbox, reviewCode, sandboxStrict } from "./logic.js";

export const name = "quanluong-sandbox";
export const inject = ["tools"];

export function apply(ctx) {
  try {
    ctx.on("tools/pre-execute", async (exec, next) => {
      const denied = decideSandbox(exec, currentActor(), { strict: sandboxStrict() });
      if (denied) return denied;
      return typeof next === "function" ? next() : { kind: "allow" };
    });
  } catch (error) {
    console.error(`[quanluong-sandbox] tools/pre-execute unavailable: ${error?.message || error}`);
  }
  try {
    registerTextTool(ctx, {
      name: "review_code",
      description: "Check a code snippet for dangerous host access. The snippet is not executed.",
      parameters: {
        source: { type: "string", required: true, description: "Source text to review." },
      },
      run: async (args) => reviewCode(args.source),
    });
  } catch (error) {
    console.error(`[quanluong-sandbox] ${error?.message || error}`);
  }
}

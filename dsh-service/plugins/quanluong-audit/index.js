export const name = "quanluong-audit";

async function postAudit(entry) {
  const base = String(process.env.LEDGER_TOOL_BACKEND_URL || "").replace(/\/+$/, "");
  const token = process.env.DSH_SERVICE_TOKEN || "";
  if (!base || !token) return;
  try {
    const response = await fetch(`${base}/api/internal/dsh/audit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    });
    if (!response.ok) {
      console.error(`[quanluong-audit] backend HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`[quanluong-audit] ${error?.message || error}`);
  }
}

function auditStream(options, next) {
  return {
    async *[Symbol.asyncIterator]() {
      const started = Date.now();
      try {
        for await (const chunk of next()) yield chunk;
        await postAudit({
          kind: "llm",
          status: "ok",
          provider: options?.provider || "",
          model: options?.model || "",
          ms: Date.now() - started,
        });
      } catch (error) {
        await postAudit({
          kind: "llm",
          status: "error",
          provider: options?.provider || "",
          model: options?.model || "",
          ms: Date.now() - started,
          message: String(error?.message || "llm error").slice(0, 200),
        });
        throw error;
      }
    },
  };
}

export function apply(ctx) {
  try {
    ctx.on("llm/stream", (options, next) => auditStream(options, next));
  } catch (error) {
    console.error(`[quanluong-audit] llm/stream unavailable: ${error?.message || error}`);
  }
  try {
    ctx.on("tools/result", (outcome) => {
      void postAudit({
        kind: "tool",
        status: outcome?.isError ? "error" : "ok",
        name: outcome?.name || outcome?.toolName || "tool",
      });
    });
  } catch (error) {
    console.error(`[quanluong-audit] tools/result unavailable: ${error?.message || error}`);
  }
}

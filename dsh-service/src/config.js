import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function trim(value) {
  return String(value ?? "").trim();
}

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3090);
  const model = trim(env.DSH_MODEL || env.LEDGER_AI_QUESTION_MODEL) || "google/gemini-3.8-flash";
  return {
    port: Number.isFinite(port) && port > 0 ? port : 3090,
    token: trim(env.DSH_SERVICE_TOKEN),
    runtime: trim(env.DSH_RUNTIME || "sdk").toLowerCase() === "scripted" ? "scripted" : "sdk",
    profile: trim(env.DSH_PROFILE) || "sdk-minimal",
    home: trim(env.DSH_HOME) || "/var/lib/dsh",
    splitProfiles: trim(env.DSH_SPLIT_PROFILES) === "1",
    model,
    maxTokens: (() => {
      const n = Number(env.DSH_MAX_TOKENS || 8000);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 32000) : 8000;
    })(),
    initializeTimeoutMs: (() => {
      const n = Number(env.DSH_INIT_TIMEOUT_MS || 120000);
      return Number.isFinite(n) && n >= 1000 ? n : 120000;
    })(),
    pluginsDir: path.join(root, "plugins"),
    skillsDir: path.join(root, "plugins", "quanluong-skills", "skills"),
    backendUrl: trim(env.LEDGER_TOOL_BACKEND_URL).replace(/\/+$/, ""),
  };
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { featuresFor, renderProfilePatch } from "./profile-patch.js";
import { publishSkills } from "./skills-publish.js";

const HARNESS_CAP = 4;

function childEnv(config, surface) {
  const features = config.splitProfiles ? featuresFor(surface) : featuresFor("web");
  return {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "/root",
    LANG: process.env.LANG || "C.UTF-8",
    TZ: process.env.TZ || "UTC",
    DSH_HOME: config.home,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || process.env.MENU_AI_API_KEY || "",
    MENU_AI_API_KEY: process.env.MENU_AI_API_KEY || "",
    MENU_AI_BASE_URL: process.env.MENU_AI_BASE_URL || "https://openrouter.ai/api/v1",
    LEDGER_TOOL_BACKEND_URL: config.backendUrl,
    DSH_SERVICE_TOKEN: config.token,
    QUANLUONG_TOOL_FEATURES: features.join(","),
  };
}

function promptOf(request) {
  const lines = [
    request.system || "",
    request.grantId ? `Tool grant id: ${request.grantId}. Pass this exact grantId to Quan Luong tools. Do not invent another id.` : "",
    "Load a Quan Luong skill with load_quanluong_skill before you draft records.",
    `Surface: ${request.surface}. Account ${request.accountId}, unit ${request.unitId}.`,
    request.text || "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

function blocksOf(request) {
  const text = promptOf(request);
  const mime = request.image?.mime;
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  if (!request.image?.base64 || !allowed.has(mime)) return text;
  return [
    { type: "text", text },
    { type: "image", data: request.image.base64, mimeType: mime },
  ];
}

/** Boot and transport failures may fall back to the direct OpenRouter call.
 * A model error must not, or one bad reply would be billed twice.
 */
export function isBootFailure(error) {
  const text = `${error?.code || ""} ${error?.message || error}`;
  return /ECONNREFUSED|EPIPE|ENOENT|ETIMEDOUT|ECONNRESET|initialize|spawn|DSH_UNAVAILABLE|timeout/i.test(text);
}

function unavailableError(error) {
  const wrapped = new Error(String(error?.message || error).slice(0, 300));
  wrapped.code = "DSH_UNAVAILABLE";
  wrapped.status = 503;
  return wrapped;
}

/** A turn that ends with an error is a model failure, even when the text is empty.
 * The SDK resolves those turns instead of throwing.
 */
export function responseFromRun(result, model) {
  const end = [...(result?.events || [])].reverse().find((event) => event?.type === "turn/end");
  const reason = end?.data?.reason;
  if (reason?.kind === "error") {
    const modelError = new Error(String(reason.error?.message || "DSH turn failed").slice(0, 300));
    modelError.status = 500;
    modelError.code = "MODEL_ERROR";
    throw modelError;
  }
  return {
    content: result?.finalResponse || "",
    model,
    provider: "openrouter",
  };
}

/** One DeepSeekHarness per surface+model. ponytail: cap is 4 processes;
 * the upgrade is a DSH build that can change model without a new process.
 */
export function createSdkRuntime(config) {
  const harnesses = new Map();
  let bootError = "";

  async function patchFor(surface) {
    const dir = path.join(config.home, "patches");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${config.splitProfiles ? surface : "quanluong"}.yml`);
    await writeFile(file, renderProfilePatch(config.pluginsDir, config.splitProfiles ? surface : "web"), "utf8");
    return file;
  }

  async function harnessFor(request) {
    const surface = config.splitProfiles ? request.surface : "quanluong";
    const model = request.model || config.model;
    const key = `${surface}:${model}`;
    if (harnesses.has(key)) return harnesses.get(key);
    if (harnesses.size >= HARNESS_CAP) return harnesses.values().next().value;
    const { DeepSeekHarness } = await import("@deepseek-ai/dsh-sdk-client");
    const patch = await patchFor(request.surface || "web");
    await publishSkills(config.skillsDir, config.home);
    const harness = new DeepSeekHarness({
      profile: config.profile,
      patches: [patch],
      dshHome: config.home,
      cwd: config.home,
      provider: "openrouter",
      model,
      maxTokens: config.maxTokens,
      initializeTimeoutMs: config.initializeTimeoutMs,
      env: childEnv(config, request.surface || "web"),
    });
    harnesses.set(key, harness);
    return harness;
  }

  return {
    kind: "sdk",
    async status() {
      if (bootError) return { dsh: "unavailable", runtime: "sdk", message: bootError };
      return { dsh: harnesses.size ? "ready" : "starting", runtime: "sdk", harnesses: harnesses.size };
    },
    async complete(request) {
      let harness;
      try {
        harness = await harnessFor(request);
      } catch (error) {
        bootError = String(error?.message || error).slice(0, 300);
        throw unavailableError(error);
      }
      try {
        const result = await harness.run(blocksOf(request), { sessionId: request.sessionId });
        bootError = "";
        return responseFromRun(result, request.model || config.model);
      } catch (error) {
        if (isBootFailure(error)) {
          bootError = String(error?.message || error).slice(0, 300);
          throw unavailableError(error);
        }
        const modelError = new Error(String(error?.message || error).slice(0, 300));
        modelError.status = 500;
        modelError.code = "MODEL_ERROR";
        throw modelError;
      }
    },
    async close() {
      const closing = [...harnesses.values()].map((harness) => harness.close?.());
      harnesses.clear();
      await Promise.allSettled(closing);
    },
  };
}

export const PLUGIN_FLAGS = {
  "skill-loop": "DSH_PLUGIN_SKILL_LOOP",
  memory: "DSH_PLUGIN_MEMORY",
  subagents: "DSH_PLUGIN_SUBAGENTS",
  schedule: "DSH_PLUGIN_SCHEDULE",
  sandbox: "DSH_PLUGIN_SANDBOX",
};

const OFF = new Set(["0", "false", "off", "no"]);

export function pluginEnabled(id, env = process.env) {
  const key = PLUGIN_FLAGS[id];
  if (!key) return false;
  const raw = env[key];
  if (raw == null || String(raw).trim() === "") return true;
  return !OFF.has(String(raw).trim().toLowerCase());
}

export function listPluginFlags(env = process.env) {
  return Object.keys(PLUGIN_FLAGS).map((id) => ({
    id,
    enabled: pluginEnabled(id, env),
  }));
}

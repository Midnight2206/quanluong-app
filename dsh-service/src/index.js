import { loadConfig } from "./config.js";
import { createRuntime } from "./runtime.js";
import { createServer } from "./server.js";
import { publishSkills } from "./skills-publish.js";
import { pluginEnabled } from "./plugin-flags.js";
import { startScheduler } from "./scheduler.js";
import { setSubagentCompleter } from "../plugins/quanluong-subagents/runtime.js";

const config = loadConfig();
if (!config.token) {
  console.error("DSH_SERVICE_TOKEN is required");
  process.exit(1);
}

const runtime = createRuntime(config);
await publishSkills(config.skillsDir, config.home).catch((error) => {
  console.error(`[dsh] skill publish failed: ${error?.message || error}`);
});

setSubagentCompleter((request) => runtime.complete(request));

const intervalMs = Number(process.env.DSH_SCHEDULE_INTERVAL_MS || 60_000);
const stopScheduler = pluginEnabled("schedule") && intervalMs > 0
  ? startScheduler({ home: config.home, complete: (request) => runtime.complete(request), intervalMs })
  : () => {};

const server = createServer({ config, runtime });
server.listen(config.port, "0.0.0.0", () => {
  console.info(`[dsh] listening on ${config.port} runtime=${config.runtime} profile=${config.profile}`);
});

async function shutdown() {
  stopScheduler();
  server.close();
  await runtime.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});

import path from "node:path";
import { requireActor } from "./actor.js";
import { emptyBook, readDoc, updateJson } from "./json-doc.js";
import { listPluginFlags, pluginEnabled } from "./plugin-flags.js";
import { runScheduledJob } from "./schedule-run.js";
import { acceptSkill, listUnitSkills, rejectSkill } from "../plugins/quanluong-skill-loop/logic.js";
import { summarizeMemory, visibleEntries } from "../plugins/quanluong-memory/logic.js";
import { readAssignment } from "../plugins/quanluong-subagents/logic.js";
import { runSubagent } from "../plugins/quanluong-subagents/runtime.js";
import { listJobs, listRuns, tickSchedule } from "../plugins/quanluong-schedule/logic.js";

function pluginFile(home, name) {
  return path.join(home, "plugins", name);
}

function off(id) {
  return { status: 404, body: { ok: false, error: `Plugin ${id} is off`, code: "PLUGIN_DISABLED" } };
}

function actorFrom(body, searchParams) {
  return requireActor({
    unitId: body.unitId || searchParams.get("unitId"),
    accountId: body.accountId || searchParams.get("accountId"),
    surface: body.surface || "web",
    grantId: body.grantId || "",
  });
}

export async function handlePluginRoute({ method, pathname, searchParams, body = {}, config, runtime }) {
  try {
    return await dispatch({ method, pathname, searchParams, body, config, runtime });
  } catch (error) {
    return {
      status: error.status || 500,
      body: { ok: false, error: error.message || "Plugin error", code: error.code || "PLUGIN_ERROR" },
    };
  }
}

async function dispatch({ method, pathname, searchParams, body, config, runtime }) {
  if (method === "GET" && pathname === "/v1/plugins") {
    return { status: 200, body: { ok: true, data: listPluginFlags() } };
  }
  const skillAction = /^\/v1\/plugins\/skill-loop\/skills\/([^/]+)\/(accept|reject)$/.exec(pathname);
  if (skillAction) return skillDecision(skillAction, method, body, config);
  if (pathname === "/v1/plugins/skill-loop/skills") return listSkillsRoute(method, searchParams, config);
  if (pathname === "/v1/plugins/memory") return memoryRoute(method, searchParams, config);
  if (pathname === "/v1/plugins/schedule/jobs") return jobsRoute(method, searchParams, config);
  if (pathname === "/v1/plugins/schedule/runs") return runsRoute(method, searchParams, config);
  if (pathname === "/v1/plugins/schedule/tick") return tickRoute(method, body, config, runtime);
  if (pathname === "/v1/plugins/subagents/run") return subagentRoute(method, body, config, runtime);
  const assignment = /^\/v1\/plugins\/subagents\/assignments\/([^/]+)$/.exec(pathname);
  if (assignment) return assignmentRoute(assignment[1], method, searchParams, config);
  return { status: 404, body: { ok: false, error: "Not found", code: "NOT_FOUND" } };
}

async function listSkillsRoute(method, searchParams, config) {
  if (method !== "GET") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("skill-loop")) return off("skill-loop");
  const actor = actorFrom({}, searchParams);
  const doc = await readDoc(pluginFile(config.home, "skill-loop.json"), emptyBook());
  return { status: 200, body: { ok: true, data: listUnitSkills(doc, actor.unitId) } };
}

async function skillDecision(match, method, body, config) {
  if (method !== "POST") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("skill-loop")) return off("skill-loop");
  const actor = actorFrom(body, new URLSearchParams());
  const file = pluginFile(config.home, "skill-loop.json");
  const apply = match[2] === "accept" ? acceptSkill : rejectSkill;
  const result = await updateJson(file, emptyBook(), (doc) => (
    apply(doc, { unitId: actor.unitId, id: decodeURIComponent(match[1]) })
  ));
  return { status: 200, body: { ok: true, data: result.skill } };
}

async function memoryRoute(method, searchParams, config) {
  if (method !== "GET") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("memory")) return off("memory");
  const actor = actorFrom({}, searchParams);
  const doc = await readDoc(pluginFile(config.home, "memory.json"), emptyBook());
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        entries: visibleEntries(doc, actor),
        unit: summarizeMemory(doc, actor, "unit"),
        user: summarizeMemory(doc, actor, "user"),
      },
    },
  };
}

async function jobsRoute(method, searchParams, config) {
  if (method !== "GET") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("schedule")) return off("schedule");
  const actor = actorFrom({}, searchParams);
  const doc = await readDoc(pluginFile(config.home, "schedule.json"), emptyBook());
  return { status: 200, body: { ok: true, data: listJobs(doc, actor.unitId) } };
}

async function runsRoute(method, searchParams, config) {
  if (method !== "GET") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("schedule")) return off("schedule");
  const actor = actorFrom({}, searchParams);
  const doc = await readDoc(pluginFile(config.home, "schedule.json"), emptyBook());
  return { status: 200, body: { ok: true, data: listRuns(doc, actor.unitId) } };
}

async function tickRoute(method, body, config, runtime) {
  if (method !== "POST") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("schedule")) return off("schedule");
  const now = body.now || new Date().toISOString();
  const result = await updateJson(pluginFile(config.home, "schedule.json"), emptyBook(), (doc) => (
    tickSchedule(doc, now, (job) => runScheduledJob(job, (request) => runtime.complete(request)))
  ));
  return { status: 200, body: { ok: true, data: { reports: result.reports } } };
}

async function subagentRoute(method, body, config, runtime) {
  if (method !== "POST") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("subagents")) return off("subagents");
  const actor = actorFrom(body, new URLSearchParams());
  const assignment = await runSubagent(actor, body, (request) => runtime.complete(request), config.home);
  return { status: 200, body: { ok: true, data: assignment } };
}

async function assignmentRoute(id, method, searchParams, config) {
  if (method !== "GET") return { status: 404, body: { ok: false, error: "Not found" } };
  if (!pluginEnabled("subagents")) return off("subagents");
  const actor = actorFrom({}, searchParams);
  const doc = await readDoc(pluginFile(config.home, "subagents.json"), emptyBook());
  const row = readAssignment(doc, actor.unitId, decodeURIComponent(id));
  if (!row) return { status: 404, body: { ok: false, error: "Assignment not found", code: "NOT_FOUND" } };
  return { status: 200, body: { ok: true, data: row } };
}

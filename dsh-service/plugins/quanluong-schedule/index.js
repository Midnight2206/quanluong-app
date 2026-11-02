import path from "node:path";
import { currentActor } from "../../src/request-context.js";
import { requireActor } from "../../src/actor.js";
import { emptyBook, readDoc, updateJson } from "../../src/json-doc.js";
import { registerTextTool } from "../register-text-tool.js";
import { addJob, disableJob, guardScheduledCall, listJobs } from "./logic.js";

export const name = "quanluong-schedule";
export const inject = ["tools"];

function bookFile() {
  return path.join(process.env.DSH_HOME || "/var/lib/dsh", "plugins", "schedule.json");
}

async function run(args, change) {
  const bound = requireActor(currentActor(), args);
  const result = await updateJson(bookFile(), emptyBook(), (doc) => change(doc, bound));
  const { doc, ...rest } = result;
  return { ok: true, ...rest };
}

export function apply(ctx) {
  try {
    ctx.on("tools/pre-execute", async (exec, next) => {
      const denied = guardScheduledCall(currentActor(), exec);
      if (denied) return denied;
      return typeof next === "function" ? next() : { kind: "allow" };
    });
  } catch (error) {
    console.error(`[quanluong-schedule] tools/pre-execute unavailable: ${error?.message || error}`);
  }
  const tools = [
    {
      name: "schedule_job",
      description: "Schedule a report. The job logs text later. It cannot save ledger, menu, or issue-slip numbers.",
      parameters: {
        cron: { type: "string", required: true, description: "5-field UTC cron, for example 0 6 * * *" },
        prompt: { type: "string", required: true, description: "What the report should cover." },
        skillNames: { type: "string", required: false, description: "Comma-separated skill names to mention." },
      },
      run: (args) => run(args, (doc, actor) => addJob(doc, { ...actor, ...args })),
    },
    {
      name: "list_jobs",
      description: "List scheduled jobs for this unit.",
      parameters: {},
      run: async (args) => {
        const actor = requireActor(currentActor(), args);
        const doc = await readDoc(bookFile(), emptyBook());
        return { ok: true, jobs: listJobs(doc, actor.unitId) };
      },
    },
    {
      name: "disable_job",
      description: "Stop one scheduled job in this unit.",
      parameters: {
        id: { type: "string", required: true, description: "Job id" },
      },
      run: (args) => run(args, (doc, actor) => disableJob(doc, actor.unitId, args.id)),
    },
  ];
  try {
    for (const spec of tools) registerTextTool(ctx, spec);
  } catch (error) {
    console.error(`[quanluong-schedule] ${error?.message || error}`);
  }
}

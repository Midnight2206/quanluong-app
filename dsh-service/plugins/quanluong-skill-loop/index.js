import path from "node:path";
import { currentActor } from "../../src/request-context.js";
import { requireActor } from "../../src/actor.js";
import { emptyBook, readDoc, updateJson } from "../../src/json-doc.js";
import { registerTextTool } from "../register-text-tool.js";
import { draftSkill, listUnitSkills, noteSkillUse, skillFromTrace } from "./logic.js";

export const name = "quanluong-skill-loop";
export const inject = ["tools"];

function bookFile() {
  return path.join(process.env.DSH_HOME || "/var/lib/dsh", "plugins", "skill-loop.json");
}

async function change(actor, args, fn) {
  const bound = requireActor(actor, args);
  const result = await updateJson(bookFile(), emptyBook(), (doc) => fn(doc, bound));
  const { doc, ...rest } = result;
  return { ok: true, ...rest };
}

export function apply(ctx) {
  const tools = [
    {
      name: "capture_task_skill",
      description: "Draft a skill from a finished task and the tool names used. The skill stays a draft until a person accepts it. This does not write the ledger.",
      parameters: {
        task: { type: "string", required: true, description: "What was done, in one sentence." },
        toolTraceJson: { type: "string", required: true, description: "JSON array of tool names, in order." },
      },
      run: (args) => change(currentActor(), args, (doc, bound) => {
        const traced = skillFromTrace({ task: args.task, toolTrace: JSON.parse(args.toolTraceJson || "[]") });
        return draftSkill(doc, { ...traced, ...bound });
      }),
    },
    {
      name: "draft_skill",
      description: "Save a procedure as a draft skill for this unit. It is not active until a person accepts it.",
      parameters: {
        name: { type: "string", required: true, description: "kebab-case name" },
        description: { type: "string", required: true, description: "One sentence." },
        body: { type: "string", required: true, description: "Steps. Draft only. Do not include shell commands." },
      },
      run: (args) => change(currentActor(), args, (doc, bound) => draftSkill(doc, { ...bound, ...args })),
    },
    {
      name: "list_learned_skills",
      description: "List learned skills for this unit only.",
      parameters: {},
      run: async (args) => {
        const bound = requireActor(currentActor(), args);
        const doc = await readDoc(bookFile(), emptyBook());
        return {
          ok: true,
          skills: listUnitSkills(doc, bound.unitId).map((item) => ({
            id: item.id,
            name: item.name,
            status: item.status,
            revision: item.revision,
            uses: item.uses,
          })),
        };
      },
    },
    {
      name: "note_skill_use",
      description: "Record that a skill was used. An improvement becomes a new draft and does not replace the active text.",
      parameters: {
        name: { type: "string", required: true, description: "Skill name" },
        outcome: { type: "string", required: false, description: "ok or fail" },
        improvement: { type: "string", required: false, description: "What to change next time." },
      },
      run: (args) => change(currentActor(), args, (doc, bound) => noteSkillUse(doc, { ...bound, ...args })),
    },
  ];
  try {
    for (const spec of tools) registerTextTool(ctx, spec);
  } catch (error) {
    console.error(`[quanluong-skill-loop] ${error?.message || error}`);
  }
}

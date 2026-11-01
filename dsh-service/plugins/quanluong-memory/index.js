import path from "node:path";
import { currentActor } from "../../src/request-context.js";
import { requireActor } from "../../src/actor.js";
import { emptyBook, readDoc, updateJson } from "../../src/json-doc.js";
import { registerTextTool } from "../register-text-tool.js";
import { forgetMemory, remember, searchMemory, summarizeMemory } from "./logic.js";

export const name = "quanluong-memory";
export const inject = ["tools"];

function bookFile() {
  return path.join(process.env.DSH_HOME || "/var/lib/dsh", "plugins", "memory.json");
}

async function run(args, change) {
  const bound = requireActor(currentActor(), args);
  const result = await updateJson(bookFile(), emptyBook(), (doc) => change(doc, bound));
  const { doc, ...rest } = result;
  return { ok: true, ...rest };
}

export function apply(ctx) {
  const tools = [
    {
      name: "memory_remember",
      description: "Store a short fact for this unit, or for this user inside the unit. Not for ledger numbers.",
      parameters: {
        text: { type: "string", required: true, description: "The fact. No secrets." },
        scope: { type: "string", required: true, description: "unit or user" },
      },
      run: (args) => run(args, (doc, actor) => remember(doc, actor, args)),
    },
    {
      name: "memory_search",
      description: "Search facts visible to this user in this unit.",
      parameters: {
        query: { type: "string", required: true, description: "Words to find." },
      },
      run: async (args) => {
        const actor = requireActor(currentActor(), args);
        const doc = await readDoc(bookFile(), emptyBook());
        return { ok: true, hits: searchMemory(doc, actor, args.query) };
      },
    },
    {
      name: "memory_summarize",
      description: "Join visible facts into a bounded extract. Does not call a model and does not add numbers.",
      parameters: {
        scope: { type: "string", required: true, description: "unit or user" },
      },
      run: async (args) => {
        const actor = requireActor(currentActor(), args);
        const doc = await readDoc(bookFile(), emptyBook());
        return { ok: true, summary: summarizeMemory(doc, actor, args.scope) };
      },
    },
    {
      name: "memory_forget",
      description: "Remove one visible memory entry.",
      parameters: {
        id: { type: "string", required: true, description: "Entry id from search." },
      },
      run: (args) => run(args, (doc, actor) => forgetMemory(doc, actor, args.id)),
    },
  ];
  try {
    for (const spec of tools) registerTextTool(ctx, spec);
  } catch (error) {
    console.error(`[quanluong-memory] ${error?.message || error}`);
  }
}

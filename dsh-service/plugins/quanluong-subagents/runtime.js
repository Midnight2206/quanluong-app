import path from "node:path";
import { requestContext } from "../../src/request-context.js";
import { emptyBook, updateJson } from "../../src/json-doc.js";
import { childSystem, createGate, finishAssignment, openAssignment, saveAssignment } from "./logic.js";

let completeFn = null;
const gate = createGate(Number(process.env.DSH_SUBAGENT_MAX || 3));

export function setSubagentCompleter(fn) {
  completeFn = fn;
}

export function assignmentFile(home = process.env.DSH_HOME || "/var/lib/dsh") {
  return path.join(home, "plugins", "subagents.json");
}

export async function runSubagent(actor, args, complete = completeFn, home = process.env.DSH_HOME || "/var/lib/dsh") {
  const opened = openAssignment({ ...actor, role: args.role, task: args.task });
  const file = assignmentFile(home);
  await updateJson(file, emptyBook(), (doc) => saveAssignment(doc, opened));
  if (typeof complete !== "function") return opened;
  return gate(async () => {
    const result = await requestContext.run(
      { ...actor, assignment: opened, source: "subagent" },
      () => complete({
        sessionId: `subagent-${opened.id}`,
        accountId: actor.accountId,
        unitId: actor.unitId,
        surface: actor.surface || "web",
        system: childSystem(opened),
        text: opened.task,
        feature: "subagent",
        grantId: actor.grantId || "",
      }),
    );
    const finished = finishAssignment(opened, result?.content || "");
    await updateJson(file, emptyBook(), (doc) => saveAssignment(doc, finished));
    return finished;
  });
}

import assert from "node:assert/strict";
import test from "node:test";
import { emptyBook } from "../src/json-doc.js";
import {
  childSystem,
  createGate,
  finishAssignment,
  guardChildCall,
  openAssignment,
  readAssignment,
  saveAssignment,
} from "../plugins/quanluong-subagents/logic.js";

test("a child role only receives its own tools and returns a report", () => {
  const assignment = openAssignment({
    unitId: "unit-a",
    accountId: "user-1",
    role: "ledger-reader",
    task: "Doc so ngay 2026-11-01",
    id: "asg-1",
  });
  assert.deepEqual(assignment.allowedTools, ["read_ledger_day", "load_quanluong_skill"]);
  assert.equal(assignment.persisted, false);
  assert.equal(assignment.writes, 0);
  assert.match(childSystem(assignment), /Không ghi cơ sở dữ liệu/);
  assert.equal(guardChildCall(assignment, { name: "bash" }).kind, "deny");
  assert.equal(guardChildCall(assignment, { name: "read_menu_day" }).kind, "deny");
  assert.equal(guardChildCall(assignment, { name: "read_ledger_day", arguments: { save: true } }).kind, "deny");
  assert.equal(guardChildCall(assignment, { name: "read_ledger_day", arguments: { date: "2026-11-01" } }).kind, "allow");
  const finished = finishAssignment(assignment, "Bao cao: so da co san");
  assert.equal(finished.persisted, false);
  assert.equal(finished.writes, 0);
  assert.equal(finished.effect, "report-only");
  const saved = saveAssignment(emptyBook(), finished);
  assert.equal(readAssignment(saved.doc, "unit-b", "asg-1"), null);
  assert.equal(readAssignment(saved.doc, "unit-a", "asg-1").report, finished.report);
  assert.throws(() => openAssignment({ unitId: "unit-a", accountId: "user-1", role: "root" }), /unknown/i);
});

test("only the configured number of subagents run at once", async () => {
  const gate = createGate(1);
  let release;
  const first = gate(() => new Promise((resolve) => {
    release = resolve;
  }));
  await assert.rejects(gate(async () => "no"), /limit/i);
  release("ok");
  assert.equal(await first, "ok");
});

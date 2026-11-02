import assert from "node:assert/strict";
import test from "node:test";
import { renderProfilePatch } from "../src/profile-patch.js";
import { pluginEnabled } from "../src/plugin-flags.js";
import { openAssignment } from "../plugins/quanluong-subagents/logic.js";
import { decideSandbox, reviewCode } from "../plugins/quanluong-sandbox/logic.js";
import { guardScheduledCall } from "../plugins/quanluong-schedule/logic.js";

test("sandbox allows listed reads and drafts, and blocks host tools and dangerous text", () => {
  assert.equal(decideSandbox({ name: "read_ledger_day", arguments: { date: "2026-11-01" } }), null);
  assert.equal(decideSandbox({ name: "bash" }).kind, "deny");
  assert.equal(decideSandbox({ name: "execute_code" }).kind, "deny");
  assert.equal(decideSandbox({ name: "propose_ledger_records", arguments: { commit: true } }).kind, "deny");
  assert.equal(decideSandbox({ name: "propose_issue_slip_lines", arguments: { linesJson: "rm -rf /tmp" } }).kind, "deny");
  assert.equal(decideSandbox({ name: "mystery" }, null, { strict: true }).kind, "deny");
  assert.equal(decideSandbox({ name: "mystery" }, null, { strict: false }), null);
  const reviewed = reviewCode("const n = 1 + 1;");
  assert.equal(reviewed.executed, false);
  assert.equal(reviewed.allowed, true);
  assert.equal(reviewed.isolated, true);
  assert.equal(reviewCode("require('fs').rmSync('/')").executed, false);
  assert.equal(reviewCode("require('fs').rmSync('/')").allowed, false);
});

test("scheduled turns and child roles cannot call tools outside their list", () => {
  const scheduled = guardScheduledCall({ source: "schedule" }, { name: "propose_ledger_records" });
  assert.equal(scheduled.kind, "deny");
  assert.equal(guardScheduledCall({ source: "schedule" }, { name: "memory_search" }), null);
  const assignment = openAssignment({ unitId: "unit-a", accountId: "user-1", role: "ledger-reader", task: "doc" });
  assert.equal(decideSandbox({ name: "read_menu_day", arguments: {} }, { assignment }).kind, "deny");
  assert.equal(decideSandbox({ name: "read_ledger_day", arguments: { date: "2026-11-01" } }, { assignment }), null);
});

test("each plugin can be left out of the profile", () => {
  assert.equal(pluginEnabled("memory", {}), true);
  assert.equal(pluginEnabled("memory", { DSH_PLUGIN_MEMORY: "0" }), false);
  const patch = renderProfilePatch("/opt/plugins", "web", {
    env: { DSH_PLUGIN_MEMORY: "off", DSH_PLUGIN_SCHEDULE: "false" },
  });
  assert.equal(patch.includes("quanluong-memory"), false);
  assert.equal(patch.includes("quanluong-schedule"), false);
  assert.match(patch, /quanluong-skill-loop/);
  assert.match(patch, /quanluong-sandbox/);
  assert.match(patch, /quanluong-subagents/);
});

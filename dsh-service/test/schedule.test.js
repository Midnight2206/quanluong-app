import assert from "node:assert/strict";
import test from "node:test";
import { emptyBook } from "../src/json-doc.js";
import { assertCron, cronMatches, nextRun } from "../plugins/quanluong-schedule/cron.js";
import { addJob, asReport, listJobs, tickSchedule } from "../plugins/quanluong-schedule/logic.js";

test("cron matches minute, range, step, and Sunday as 0 or 7", () => {
  const sunday = new Date("2026-11-01T06:00:00.000Z");
  assert.equal(cronMatches("0 6 * * *", sunday), true);
  assert.equal(cronMatches("0 6 * * 0", sunday), true);
  assert.equal(cronMatches("0 6 * * 7", sunday), true);
  assert.equal(cronMatches("0 6 * * 1", sunday), false);
  assert.equal(cronMatches("*/15 * * * *", new Date("2026-11-01T06:30:00.000Z")), true);
  assert.equal(cronMatches("*/15 * * * *", new Date("2026-11-01T06:07:00.000Z")), false);
  assert.equal(cronMatches("1-3 * * * *", new Date("2026-11-01T06:02:00.000Z")), true);
  assert.equal(cronMatches("1-3 * * * *", new Date("2026-11-01T06:04:00.000Z")), false);
  assert.equal(nextRun("0 6 * * *", "2026-11-01T06:01:00.000Z"), "2026-11-02T06:00:00.000Z");
  assert.throws(() => assertCron("* * *"), /5 fields/);
});

test("a due job logs a report and drops any write payload", async () => {
  const added = addJob(emptyBook(), {
    unitId: "unit-a",
    accountId: "user-1",
    cron: "* * * * *",
    prompt: "Bao cao ton",
    id: "job-1",
    now: "2026-11-01T00:00:00.000Z",
    nextRunAt: "2026-11-01T00:00:00.000Z",
  });
  const other = addJob(added.doc, {
    unitId: "unit-b",
    accountId: "user-9",
    cron: "* * * * *",
    prompt: "Khong lo",
    id: "job-2",
    nextRunAt: "2999-01-01T00:00:00.000Z",
  });
  assert.equal(listJobs(other.doc, "unit-a").length, 1);
  assert.equal(listJobs(other.doc, "unit-c").length, 0);
  const ticked = await tickSchedule(other.doc, "2026-11-01T00:00:00.000Z", async () => ({
    report: "Chi bao cao",
    records: [{ qty: 9 }],
    total: 9,
    save: true,
  }));
  assert.equal(ticked.reports.length, 1);
  assert.equal(ticked.reports[0].unitId, "unit-a");
  assert.equal(ticked.reports[0].run.persisted, false);
  assert.equal(ticked.reports[0].run.writes, 0);
  assert.equal(ticked.reports[0].run.report, "Chi bao cao");
  assert.equal("records" in ticked.reports[0].run, false);
  assert.deepEqual(ticked.doc.units["unit-b"].runs, []);
  const quiet = await tickSchedule(other.doc, "2026-10-01T00:00:00.000Z", async () => "no");
  assert.equal(quiet.reports.length, 0);
  const wrapped = asReport({ report: "ok", total: 4, save: true });
  assert.deepEqual(wrapped, { report: "ok", persisted: false, writes: 0 });
});

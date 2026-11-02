import { randomUUID } from "node:crypto";
import { putUnit } from "../../src/json-doc.js";
import { assertCron, nextRun } from "./cron.js";

export const SCHEDULE_TOOLS = new Set([
  "load_quanluong_skill",
  "list_learned_skills",
  "memory_search",
  "memory_summarize",
  "list_jobs",
  "review_code",
]);

export function guardScheduledCall(actor, exec) {
  if (actor?.source !== "schedule") return null;
  const name = String(exec?.name || exec?.toolName || "");
  if (SCHEDULE_TOOLS.has(name)) return null;
  return { kind: "deny", reason: "Scheduled jobs can only report. They cannot draft or write." };
}

export function asReport(outcome) {
  const report = typeof outcome === "string" ? outcome : (outcome?.report || outcome?.content || "");
  return { report: String(report).slice(0, 4000), persisted: false, writes: 0 };
}

function bucket(doc, unitId) {
  const current = doc.units?.[String(unitId)] || {};
  return { jobs: [...(current.jobs || [])], runs: [...(current.runs || [])] };
}

export function listJobs(doc, unitId) {
  return bucket(doc, unitId).jobs;
}

export function listRuns(doc, unitId) {
  return bucket(doc, unitId).runs;
}

export function addJob(doc, input) {
  assertCron(input.cron);
  const now = input.now || new Date().toISOString();
  const job = {
    id: input.id || `job_${randomUUID()}`,
    unitId: String(input.unitId),
    accountId: String(input.accountId),
    cron: String(input.cron).trim(),
    prompt: String(input.prompt || "").slice(0, 2000),
    skillNames: String(input.skillNames || "").split(",").map((item) => item.trim()).filter(Boolean),
    enabled: true,
    nextRunAt: input.nextRunAt || nextRun(input.cron, now),
    createdAt: now,
    persisted: false,
    writes: 0,
  };
  const current = bucket(doc, input.unitId);
  return {
    doc: putUnit(doc, input.unitId, { ...current, jobs: [...current.jobs, job] }),
    job,
  };
}

export function disableJob(doc, unitId, id) {
  const current = bucket(doc, unitId);
  const job = current.jobs.find((item) => item.id === id);
  if (!job) {
    const error = new Error("Job not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }
  const jobs = current.jobs.map((item) => (item.id === id ? { ...item, enabled: false } : item));
  return { doc: putUnit(doc, unitId, { ...current, jobs }), job: jobs.find((item) => item.id === id) };
}

function dueJobs(doc, now) {
  const instant = Date.parse(now);
  const rows = [];
  for (const [unitId, value] of Object.entries(doc.units || {})) {
    for (const job of value.jobs || []) {
      if (!job.enabled) continue;
      if (job.nextRunAt && Date.parse(job.nextRunAt) > instant) continue;
      rows.push({ unitId, job });
    }
  }
  return rows;
}

function storeRun(doc, unitId, jobId, run, following) {
  const current = bucket(doc, unitId);
  const jobs = current.jobs.map((item) => (item.id === jobId ? { ...item, nextRunAt: following } : item));
  const runs = [...current.runs, run].slice(-50);
  return putUnit(doc, unitId, { jobs, runs });
}

export async function tickSchedule(doc, now, runJob) {
  let next = doc;
  const reports = [];
  for (const item of dueJobs(doc, now)) {
    let outcome = asReport("");
    let status = "ok";
    try {
      outcome = asReport(await runJob(item.job));
    } catch (error) {
      status = "error";
      outcome = asReport(error?.message || "failed");
    }
    const run = {
      id: `run_${randomUUID()}`,
      jobId: item.job.id,
      at: now,
      status,
      ...outcome,
    };
    reports.push({ unitId: item.unitId, run });
    next = storeRun(next, item.unitId, item.job.id, run, nextRun(item.job.cron, now));
  }
  return { doc: next, reports };
}

import path from "node:path";
import { emptyBook, updateJson } from "./json-doc.js";
import { tickSchedule } from "../plugins/quanluong-schedule/logic.js";
import { runScheduledJob } from "./schedule-run.js";

export async function tickScheduleFile(home, now, complete) {
  const file = path.join(home, "plugins", "schedule.json");
  return updateJson(file, emptyBook(), (doc) => tickSchedule(doc, now, (job) => runScheduledJob(job, complete)));
}

export function startScheduler({ home, complete, intervalMs = 60_000 }) {
  const delay = Number(intervalMs) > 0 ? Number(intervalMs) : 60_000;
  const timer = setInterval(() => {
    void tickScheduleFile(home, new Date().toISOString(), complete).catch((error) => {
      console.error(`[dsh-schedule] ${error?.message || error}`);
    });
  }, delay);
  timer.unref?.();
  return () => clearInterval(timer);
}

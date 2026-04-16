import { createScheduledJob } from "../templates/scheduled-job";
import { createScheduleToQueueJob } from "../templates/schedule-to-queue";

export const monthlyPayrollSchedule = ({ queues }) =>
  createScheduledJob({
    name: "monthly-payroll-run",
    expression: "0 0 1 * *",
    handler: createScheduleToQueueJob({
      queue: queues.reports,
      jobName: "generate-monthly-payroll",
      payloadFactory: async () => ({
        period: new Date().toISOString().slice(0, 7),
      }),
    }),
  });

import cron from "node-cron";
import { logger } from "../../shared/utils/logger.js";

function registerSchedule(expression, task, options = {}) {
  return cron.schedule(
    expression,
    async () => {
      try {
        await task();
      } catch (error) {
        logger.error({ err: error, schedule: options.name }, "Scheduled task failed");
      }
    },
    {
      scheduled: true,
      timezone: options.timezone || "Asia/Ho_Chi_Minh",
    },
  );
}

export { registerSchedule };

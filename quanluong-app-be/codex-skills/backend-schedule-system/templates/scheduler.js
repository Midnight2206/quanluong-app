import cron from "node-cron";

export const registerSchedules = ({ jobs }) => {
  jobs.forEach(({ expression, handler }) => {
    cron.schedule(expression, handler);
  });
};

import { Worker } from "bullmq";

import { connection } from "./queue-client";

export const makeNotificationWorker = ({ notificationService }) => {
  return new Worker(
    "notifications",
    async (job) => {
      if (job.name === "send-notification") {
        await notificationService.send(job.data);
      }
    },
    { connection },
  );
};

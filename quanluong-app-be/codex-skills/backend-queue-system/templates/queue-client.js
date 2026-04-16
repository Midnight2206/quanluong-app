import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL);

export const queues = {
  notifications: new Queue("notifications", { connection }),
  reports: new Queue("reports", { connection }),
};

export { connection };

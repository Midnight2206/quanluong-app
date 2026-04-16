import { queues } from "./queue-client";

export const enqueueNotificationJob = async ({
  userId,
  notificationType,
}) => {
  return queues.notifications.add(
    "send-notification",
    {
      userId,
      notificationType,
    },
    {
      attempts: 3,
      removeOnComplete: true,
    },
  );
};

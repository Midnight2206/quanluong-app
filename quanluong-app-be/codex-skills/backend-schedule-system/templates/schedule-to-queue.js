export const createScheduleToQueueJob = ({
  queue,
  jobName,
  payloadFactory,
}) => {
  return async () => {
    await queue.add(jobName, await payloadFactory(), {
      attempts: 3,
      removeOnComplete: true,
    });
  };
};

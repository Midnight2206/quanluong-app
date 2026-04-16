import { respondOk } from "../../backend-response-system/templates/responders";
import { queues } from "../templates/queue-client";

export const requestReportController =
  ({ reportsService }) =>
  async (req, res, next) => {
    try {
      const reportRequest = await reportsService.createRequest({
        actorId: req.auth.userId,
        input: req.validatedBody,
      });

      await queues.reports.add(
        "generate-report",
        {
          requestId: reportRequest.id,
        },
        {
          attempts: 3,
          removeOnComplete: true,
        },
      );

      return respondOk(res, {
        message: "Report request accepted and queued.",
        data: {
          requestId: reportRequest.id,
        },
      });
    } catch (error) {
      return next(error);
    }
  };

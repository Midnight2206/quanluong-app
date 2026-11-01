import { requestContext } from "./request-context.js";
import { asReport } from "../plugins/quanluong-schedule/logic.js";

const SYSTEM = [
  "Bạn đang chạy một việc đã lên lịch.",
  "Chỉ trả một báo cáo văn bản.",
  "Không ghi cơ sở dữ liệu.",
  "Không tự tính số liệu. Nếu cần số, nói rằng số phải do chương trình tính.",
  "Không gọi tool ghi hoặc tool lập phiếu.",
].join(" ");

export function runScheduledJob(job, complete) {
  const actor = {
    accountId: job.accountId,
    unitId: job.unitId,
    surface: "schedule",
    grantId: "",
    source: "schedule",
  };
  return requestContext.run(actor, async () => {
    const result = await complete({
      sessionId: `schedule-${job.id}`,
      accountId: job.accountId,
      unitId: job.unitId,
      surface: "schedule",
      system: SYSTEM,
      text: job.prompt,
      feature: "schedule",
      model: job.model,
    });
    return asReport(result?.content || "");
  });
}

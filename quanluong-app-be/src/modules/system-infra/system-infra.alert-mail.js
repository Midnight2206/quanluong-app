import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { logger } from "../../shared/utils/logger.js";
import { backupReportRecipients } from "../system-backup/system-backup.notify.js";
import { infraAlertLines } from "./system-infra.alert.js";

async function loadInfraAlertRecipients() {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      type: { name: "superadmin" },
    },
    select: { email: true },
  });
  return backupReportRecipients(users, config.auth.superadminEmail);
}

async function deliverInfraAlert(report, deps) {
  const lines = infraAlertLines(report);
  if (lines.length === 0) {
    return { sent: 0 };
  }
  const recipients = deps?.recipients ?? [];
  if (recipients.length === 0) {
    logger.warn("Không có email superadmin để báo hạ tầng");
    return { sent: 0 };
  }
  let sent = 0;
  for (const to of recipients) {
    try {
      if (await deps.send({ to, lines })) {
        sent += 1;
      }
    } catch (error) {
      logger.warn({ err: error }, "Gửi email hạ tầng thất bại");
    }
  }
  return { sent };
}

export { deliverInfraAlert, loadInfraAlertRecipients };

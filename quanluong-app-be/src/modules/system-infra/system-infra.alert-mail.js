import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { sendInfraAlertEmail } from "../../infra/mail/send-infra-alert-email.js";
import { logger } from "../../shared/utils/logger.js";
import { backupReportRecipients } from "../system-backup/system-backup.notify.js";
import { infraAlertLines } from "./system-infra.alert.js";
import { readInfra } from "./system-infra.service.js";

const INFRA_HEALTH_MAIL_SCHEDULE = "0 2,8,14,20 * * *";

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

async function runInfraHealthMail(deps = {}) {
  const read = deps.readInfra ?? readInfra;
  const report = await read();
  if (infraAlertLines(report).length === 0) {
    return { sent: 0 };
  }
  const loadRecipients = deps.loadRecipients ?? loadInfraAlertRecipients;
  const recipients = await loadRecipients();
  const send = deps.send ?? sendInfraAlertEmail;
  return deliverInfraAlert(report, { recipients, send });
}

export { INFRA_HEALTH_MAIL_SCHEDULE, deliverInfraAlert, loadInfraAlertRecipients, runInfraHealthMail };

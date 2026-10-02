import { readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/config.js";
import { prisma } from "../../infra/database/prisma/prisma.client.js";
import { sendBackupReportEmail } from "../../infra/mail/send-backup-report-email.js";
import { logger } from "../../shared/utils/logger.js";
import { backupRoot, isBackupDate } from "./system-backup.service.js";

function backupReportRecipients(users, configuredEmail) {
  const out = [];
  const seen = new Set();
  const add = (email) => {
    const value = String(email || "").trim();
    if (!value.includes("@") || value.toLowerCase().endsWith(".local")) {
      return;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(value);
  };
  for (const user of users || []) {
    add(user?.email);
  }
  add(configuredEmail);
  return out;
}

async function deliverBackupReport(body) {
  const day = isBackupDate(body?.day) ? body.day : "";
  const ok = body?.ok === true;
  const detail = String(body?.detail || (ok ? "Backup xong." : "Backup lỗi.")).slice(0, 500);
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      type: { name: "superadmin" },
    },
    select: { email: true },
  });
  const recipients = backupReportRecipients(users, config.auth.superadminEmail);
  if (recipients.length === 0) {
    logger.warn({ day }, "Không có email superadmin để báo backup");
    return { sent: 0 };
  }
  let sent = 0;
  for (const to of recipients) {
    try {
      if (await sendBackupReportEmail({ to, ok, day, detail })) {
        sent += 1;
      }
    } catch (error) {
      logger.warn({ err: error, day }, "Gửi email backup thất bại");
    }
  }
  logger.info({ day, ok, sent, recipients: recipients.length }, "Email backup cho superadmin");
  return { sent };
}

async function drainBackupNotify(root = backupRoot(), deliver = deliverBackupReport) {
  const file = path.join(root, "requests", "notify.json");
  const taken = path.join(root, "requests", "notify.sending");
  try {
    await rename(file, taken);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  try {
    const body = JSON.parse(await readFile(taken, "utf8"));
    await deliver(body);
  } finally {
    await rm(taken, { force: true });
  }
  return true;
}

export { backupReportRecipients, deliverBackupReport, drainBackupNotify };

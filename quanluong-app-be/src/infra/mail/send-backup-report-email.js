import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { createMailTransport } from "./mail.client.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";
import { sendMultipartEmailViaGmailApi } from "./gmail-transactional.send.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function sendBackupReportEmail({ to, ok, day, detail }) {
  const subject = ok
    ? `[Quân lương] Backup ${day} xong`
    : `[Quân lương] Backup ${day || "đêm"} lỗi`;
  const text = `${detail}\n`;
  const html = `<p>${escapeHtml(detail)}</p>`;

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn("Gmail API chưa cấu hình — không gửi email backup");
      return false;
    }
    return sendMultipartEmailViaGmailApi({
      from: config.mail.gmailSenderEmail,
      to,
      subject,
      text,
      html,
    });
  }

  const transport = createMailTransport();
  if (!transport) {
    logger.warn("SMTP chưa cấu hình — không gửi email backup");
    return false;
  }
  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi email backup");
    return false;
  }
  await transport.sendMail({ from, to, subject, text, html });
  return true;
}

export { sendBackupReportEmail };

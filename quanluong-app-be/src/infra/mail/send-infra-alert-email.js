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

function buildInfraAlertMail(lines) {
  const subject = "[Quân lương] Hạ tầng cần xem";
  const text = `${lines.join("\n")}\n`;
  const html = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return { subject, text, html };
}

async function sendInfraAlertEmail({ to, lines }) {
  const { subject, text, html } = buildInfraAlertMail(lines);

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn("Gmail API chưa cấu hình — không gửi email hạ tầng");
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
    logger.warn("SMTP chưa cấu hình — không gửi email hạ tầng");
    return false;
  }
  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi email hạ tầng");
    return false;
  }
  await transport.sendMail({ from, to, subject, text, html });
  return true;
}

export { buildInfraAlertMail, sendInfraAlertEmail };

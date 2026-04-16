import { createMailTransport } from "./mail.client.js";
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { sendMultipartEmailViaGmailApi } from "./gmail-transactional.send.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";

async function sendPasswordChangedNotification({ to, username }) {
  const subject = "[Quản lương] Mật khẩu tài khoản đã được thay đổi";
  const text = `Xin chào${username ? ` ${username}` : ""},

Mật khẩu tài khoản của bạn vừa được đổi thành công.

Nếu bạn không thực hiện thao tác này, hãy liên hệ quản trị ngay.`;

  const html = `<p>Xin chào${username ? ` <strong>${username}</strong>` : ""},</p>
<p>Mật khẩu tài khoản của bạn vừa được <strong>đổi thành công</strong>.</p>
<p style="color:#666;font-size:12px">Nếu không phải bạn, liên hệ quản trị hệ thống ngay.</p>`;

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn({ to }, "Gmail API chưa cấu hình — không gửi thông báo đổi mật khẩu");
      return false;
    }
    const from = config.mail.gmailSenderEmail;
    return sendMultipartEmailViaGmailApi({ from, to, subject, text, html });
  }

  const transport = createMailTransport();
  if (!transport) {
    logger.warn({ to }, "SMTP chưa cấu hình — không gửi thông báo đổi mật khẩu");
    return false;
  }

  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi thông báo đổi mật khẩu");
    return false;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return true;
}

export { sendPasswordChangedNotification };

import { createMailTransport } from "./mail.client.js";
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { sendMultipartEmailViaGmailApi } from "./gmail-transactional.send.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";

function buildVerificationLink(token) {
  const base = config.publicWebUrl;
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail({ to, token, username }) {
  const link = buildVerificationLink(token);
  const subject = "[Quản lương] Xác minh địa chỉ email";
  const text = `Xin chào${username ? ` ${username}` : ""},

Vui lòng mở liên kết sau để xác minh email (hiệu lực 48 giờ):

${link}

Nếu bạn không đăng ký tài khoản, có thể bỏ qua thư này.`;

  const html = `<p>Xin chào${username ? ` <strong>${username}</strong>` : ""},</p>
<p>Vui lòng nhấn nút bên dưới để xác minh email (hiệu lực 48 giờ).</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">Xác minh email</a></p>
<p>Hoặc copy liên kết: <br/><span style="word-break:break-all">${link}</span></p>
<p style="color:#666;font-size:12px">Nếu bạn không đăng ký, bỏ qua thư này.</p>`;

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn({ to }, "Gmail API chưa cấu hình đủ — không gửi được email xác minh");
      return false;
    }
    const from = config.mail.gmailSenderEmail;
    return sendMultipartEmailViaGmailApi({ from, to, subject, text, html });
  }

  const transport = createMailTransport();
  if (!transport) {
    logger.warn({ to }, "SMTP chưa cấu hình — không gửi được email xác minh");
    return false;
  }

  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi email xác minh");
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

export { buildVerificationLink, sendVerificationEmail };

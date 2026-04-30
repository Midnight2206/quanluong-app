import { createMailTransport } from "./mail.client.js";
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { sendMultipartEmailViaGmailApi } from "./gmail-transactional.send.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";

function buildPasswordResetLink(token) {
  const base = config.publicWebUrl.replace(/\/+$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail({ to, token, username }) {
  const link = buildPasswordResetLink(token);
  const subject = "[Quân lương] Đặt lại mật khẩu";
  const text = `Xin chào${username ? ` ${username}` : ""},

Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu. Mở liên kết sau (hiệu lực 1 giờ):

${link}

Nếu bạn không yêu cầu, hãy bỏ qua thư này — mật khẩu hiện tại vẫn giữ nguyên.`;

  const html = `<p>Xin chào${username ? ` <strong>${username}</strong>` : ""},</p>
<p>Bạn đã yêu cầu đặt lại mật khẩu. Nhấn nút bên dưới (hiệu lực <strong>1 giờ</strong>).</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none;">Đặt lại mật khẩu</a></p>
<p>Hoặc copy liên kết: <br/><span style="word-break:break-all">${link}</span></p>
<p style="color:#666;font-size:12px">Nếu không phải bạn, bỏ qua thư này.</p>`;

  if (config.mail.transport === "gmail_api") {
    if (!isGmailApiMailConfigured()) {
      logger.warn({ to }, "Gmail API chưa cấu hình — không gửi được email đặt lại mật khẩu");
      return false;
    }
    const from = config.mail.gmailSenderEmail;
    return sendMultipartEmailViaGmailApi({ from, to, subject, text, html });
  }

  const transport = createMailTransport();
  if (!transport) {
    logger.warn({ to }, "SMTP chưa cấu hình — không gửi được email đặt lại mật khẩu");
    return false;
  }

  const from = config.mail.from || config.mail.user;
  if (!from) {
    logger.warn("SMTP_FROM chưa đặt — không gửi email đặt lại mật khẩu");
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

export { buildPasswordResetLink, sendPasswordResetEmail };

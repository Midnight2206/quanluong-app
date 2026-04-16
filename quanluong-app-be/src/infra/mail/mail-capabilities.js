import { config } from "../../config/config.js";

function isGmailApiMailConfigured() {
  return Boolean(
    config.google.clientId &&
      config.google.clientSecret &&
      config.mail.gmailSenderRefreshToken &&
      config.mail.gmailSenderEmail,
  );
}

function isSmtpConfigured() {
  return Boolean(config.mail.host);
}

/** Đủ cấu hình để gửi mail giao dịch (xác minh): SMTP hoặc Gmail API. */
function isTransactionalMailConfigured() {
  if (config.mail.transport === "gmail_api") {
    return isGmailApiMailConfigured();
  }
  return isSmtpConfigured();
}

export { isGmailApiMailConfigured, isSmtpConfigured, isTransactionalMailConfigured };

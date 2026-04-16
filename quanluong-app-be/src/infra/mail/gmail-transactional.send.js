import { google } from "googleapis";
import { config } from "../../config/config.js";
import { logger } from "../../shared/utils/logger.js";
import { isGmailApiMailConfigured } from "./mail-capabilities.js";

function mimeEncodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildMultipartRfc822({ from, to, subject, text, html }) {
  const boundary = `quanluong_${Date.now().toString(36)}`;
  const subj = mimeEncodeSubject(subject);
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

function toGmailRawBase64(rfc822) {
  return Buffer.from(rfc822, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Gửi mail qua Gmail API (users.messages.send), dùng refresh token của hộp thư hệ thống.
 * Cần bật Gmail API trên GCP và OAuth client trùng với lúc cấp refresh token; scope: gmail.send.
 */
async function sendMultipartEmailViaGmailApi({ from, to, subject, text, html }) {
  if (!isGmailApiMailConfigured()) {
    logger.warn({ to }, "Gmail API gửi thư — thiếu cấu hình");
    return false;
  }

  const { clientId, clientSecret, redirectUri } = config.google;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({
    refresh_token: config.mail.gmailSenderRefreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const raw = toGmailRawBase64(
    buildMultipartRfc822({
      from,
      to,
      subject,
      text,
      html,
    }),
  );

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return true;
}

export { sendMultipartEmailViaGmailApi };

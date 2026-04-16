import nodemailer from "nodemailer";
import { config } from "../../config/config.js";

function createMailTransport() {
  if (!config.mail.host) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user
      ? {
          user: config.mail.user,
          pass: config.mail.password,
        }
      : undefined,
  });
}

export { createMailTransport };

import nodemailer from "nodemailer";

function createMailTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

async function sendMail({ to, subject, html, text }) {
  const transport = createMailTransport();

  return transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
    text,
  });
}

export { sendMail };

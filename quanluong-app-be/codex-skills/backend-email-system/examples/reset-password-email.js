import { renderEmailLayout } from "../templates/email-template.js";
import { sendMail } from "../templates/mail-service.js";

async function sendResetPasswordEmail({ email, resetUrl }) {
  const html = renderEmailLayout({
    title: "Dat lai mat khau",
    intro: "Ban da yeu cau dat lai mat khau.",
    content: "<p>Hay nhan vao nut ben duoi de tiep tuc.</p>",
    actionLabel: "Dat lai mat khau",
    actionUrl: resetUrl,
    outro: "Neu ban khong thuc hien thao tac nay, hay bo qua email nay.",
  });

  return sendMail({
    to: email,
    subject: "Dat lai mat khau",
    html,
    text: `Dat lai mat khau tai day: ${resetUrl}`,
  });
}

export { sendResetPasswordEmail };

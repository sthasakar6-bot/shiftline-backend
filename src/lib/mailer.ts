import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter =
  env.gmailUser && env.gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.gmailUser, pass: env.gmailAppPassword },
      })
    : null;

export async function sendInviteEmail(to: string, inviteLink: string, managerName: string) {
  if (!transporter) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not configured — skipping invite email send");
    return;
  }

  await transporter.sendMail({
    from: `Shiftline <${env.gmailUser}>`,
    to,
    subject: `${managerName} invited you to join Shiftline`,
    html: `
      <p>${managerName} has invited you to join their team on Shiftline.</p>
      <p><a href="${inviteLink}">Click here to create your account</a></p>
      <p>This link expires in 7 days. If the button doesn't work, copy this link into your browser:</p>
      <p>${inviteLink}</p>
    `,
  });
}

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";

const transportOptions = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  // Railway's network can fail to route outbound IPv6, which makes a
  // "service: gmail" connection hang until ETIMEDOUT since Node prefers
  // IPv6 when resolving smtp.gmail.com. Forcing IPv4 avoids it.
  family: 4,
};

const transporter =
  env.gmailUser && env.gmailAppPassword
    ? nodemailer.createTransport(transportOptions as SMTPTransport.Options)
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

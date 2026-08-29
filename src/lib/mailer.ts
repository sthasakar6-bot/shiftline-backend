import dns from "dns";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { env } from "../config/env";

export async function sendInviteEmail(to: string, inviteLink: string, managerName: string) {
  if (!env.gmailUser || !env.gmailAppPassword) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not configured — skipping invite email send");
    return;
  }

  // nodemailer resolves both A and AAAA records for smtp.gmail.com and picks
  // a *random* one to connect to -- on Railway the IPv6 addresses are
  // unreachable (ENETUNREACH), so about half of all sends fail. Resolving an
  // IPv4 address ourselves and connecting to it directly avoids the coin
  // flip, while keeping the real hostname as the TLS servername (SNI) so
  // certificate validation against smtp.gmail.com still passes.
  const [ipv4Address] = await dns.promises.resolve4("smtp.gmail.com");

  const transportOptions: SMTPTransport.Options = {
    host: ipv4Address,
    port: 465,
    secure: true,
    tls: { servername: "smtp.gmail.com" },
    auth: { user: env.gmailUser, pass: env.gmailAppPassword },
  };

  const transporter = nodemailer.createTransport(transportOptions);

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

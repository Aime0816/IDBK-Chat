import nodemailer from 'nodemailer';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function sendMail(to: string, subject: string, text: string) {
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'IDBK Chat <no-reply@localhost>',
      to,
      subject,
      text,
    });
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP is not configured');
    const dir = path.resolve('data/mail');
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.txt`),
      `To: ${to}\nSubject: ${subject}\n\n${text}`,
      { mode: 0o600 },
    );
  }
}

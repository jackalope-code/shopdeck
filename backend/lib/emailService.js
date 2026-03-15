// backend/lib/emailService.js
// Sends transactional emails via SendGrid when SENDGRID_API_KEY is configured.
// Falls back to console.log in development so the app works without keys.

const sgMail = require('@sendgrid/mail');

function isEmailConfigured() {
  return !!process.env.SENDGRID_API_KEY;
}

if (isEmailConfigured()) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM = process.env.EMAIL_FROM || 'noreply@shopdeck.app';

async function send(to, subject, html) {
  if (!isEmailConfigured()) {
    console.log(`[email] (no SendGrid key — console only)\n  To: ${to}\n  Subject: ${subject}\n  Body: ${html.replace(/<[^>]+>/g, ' ')}`);
    return;
  }
  await sgMail.send({ to, from: FROM, subject, html });
}

async function sendVerificationEmail(to, verifyUrl) {
  const html = `
    <p>Thanks for signing up for ShopDeck!</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;
  await send(to, 'Verify your ShopDeck email address', html);
}

async function sendEmailChangeVerification(to, verifyUrl) {
  const html = `
    <p>A request was made to change the email address on your ShopDeck account.</p>
    <p>Click the link below to confirm and switch to this address:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours. If you did not request this change, ignore this email.</p>
  `;
  await send(to, 'Confirm your new ShopDeck email address', html);
}

module.exports = { isEmailConfigured, sendVerificationEmail, sendEmailChangeVerification };

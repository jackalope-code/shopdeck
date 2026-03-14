'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 30 * 60 * 1000;

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function getVerificationExpiry(now = Date.now()) {
  return {
    tokenExpiresAt: new Date(now + TOKEN_TTL_MS),
    codeExpiresAt: new Date(now + CODE_TTL_MS),
  };
}

function getMailerConfig() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    MAIL_FROM,
  } = process.env;
  const smtpPort = Number(SMTP_PORT || 587);
  const smtpSecure = String(SMTP_SECURE || 'false').toLowerCase() === 'true';
  const from = MAIL_FROM || 'ShopDeck <no-reply@shopdeck.local>';
  const enabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

  return {
    enabled,
    from,
    transport: enabled
      ? {
          host: SMTP_HOST,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        }
      : null,
  };
}

async function sendVerificationEmail({ to, username, appBaseUrl, verificationLink, code }) {
  const { enabled, from, transport } = getMailerConfig();
  const safeName = username || 'there';
  const subject = 'Welcome to ShopDeck — verify your email';
  const text = [
    `Hi ${safeName},`,
    '',
    'Welcome to ShopDeck.',
    `App URL: ${appBaseUrl}`,
    '',
    'Verify with one click:',
    verificationLink,
    '',
    `Or enter this verification code: ${code}`,
    'Code expires in 30 minutes. Verification link expires in 24 hours.',
  ].join('\n');

  const html = `
    <p>Hi ${safeName},</p>
    <p>Welcome to ShopDeck.</p>
    <p><strong>App URL:</strong> <a href="${appBaseUrl}">${appBaseUrl}</a></p>
    <p><a href="${verificationLink}">Verify your email in one click</a></p>
    <p>Or enter this verification code:</p>
    <p style="font-size:20px;font-weight:bold;letter-spacing:2px;">${code}</p>
    <p style="color:#64748b;">Code expires in 30 minutes. Verification link expires in 24 hours.</p>
  `;

  if (!enabled || !transport) {
    console.log('[auth] SMTP not configured; verification email fallback');
    console.log('[auth] to=%s app=%s link=%s code=%s', to, appBaseUrl, verificationLink, code);
    return;
  }

  const transporter = nodemailer.createTransport(transport);
  await transporter.sendMail({ from, to, subject, text, html });
}

module.exports = {
  TOKEN_TTL_MS,
  CODE_TTL_MS,
  hashValue,
  generateVerificationToken,
  generateVerificationCode,
  getVerificationExpiry,
  sendVerificationEmail,
};
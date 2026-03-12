// backend/lib/tokenCrypto.js
// AES-256-GCM symmetric encryption for at-rest OAuth tokens.
//
// Requires TOKEN_ENCRYPTION_KEY in the environment — a 64-char hex string
// (32 random bytes). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Ciphertext format stored in DB: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
// All three segments are hex-encoded. The column remains TEXT — no schema change.
'use strict';

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // 96-bit IV recommended for GCM

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext token string.
 * Returns a "<iv>:<authTag>:<ciphertext>" hex string suitable for DB storage.
 */
function encryptToken(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a "<iv>:<authTag>:<ciphertext>" hex string back to plaintext.
 * Returns null if the value is falsy (e.g. NULL from DB) or if decryption fails.
 */
function decryptToken(stored) {
  if (!stored) return null;
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) return null; // legacy plaintext or malformed — treat as missing
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null; // tampered, wrong key, or legacy value — require reconnect
  }
}

/**
 * Encrypt all string values in a flat object map (e.g. api_keys).
 * Empty strings and non-string values are passed through unchanged.
 */
function encryptMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v && typeof v === 'string' ? encryptToken(v) : v;
  }
  return out;
}

/**
 * Decrypt all string values in a flat object map previously encrypted with encryptMap.
 * Values that fail to decrypt (wrong key, malformed) become empty string.
 */
function decryptMap(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v && typeof v === 'string' ? (decryptToken(v) ?? '') : v;
  }
  return out;
}

module.exports = { encryptToken, decryptToken, encryptMap, decryptMap };

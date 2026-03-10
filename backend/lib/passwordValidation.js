// backend/lib/passwordValidation.js
// Mirrors src/lib/passwordValidation.ts — keep in sync.
'use strict';

const COMMON_PASSWORDS = new Set([
  'password','password1','password123','passw0rd',
  '123456','1234567','12345678','123456789','1234567890',
  '123123','654321','111111','000000',
  'qwerty','qwerty123','qazwsx','zxcvbn',
  'abc123','iloveyou','letmein','welcome','hello',
  'monkey','dragon','master','shadow','sunshine',
  'baseball','football','superman','batman','admin',
  'trustno1','whatever','michael','ashley','bailey',
]);

/**
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 8)          errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password))                   errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password))                   errors.push('Password must contain at least one lowercase letter');
  if (!/[!@#$%^&*()\-_=+\[\]{}|;':",.<>?/`~\\]/.test(password))
                                                  errors.push('Password must contain at least one special character');
  if (COMMON_PASSWORDS.has((password || '').toLowerCase()))
                                                  errors.push('That password is too common — please choose a stronger one');
  return { valid: errors.length === 0, errors };
}

module.exports = { validatePassword };

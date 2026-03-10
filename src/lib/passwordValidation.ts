// src/lib/passwordValidation.ts
// Shared password strength validation — mirrors backend/lib/passwordValidation.js

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

export interface PasswordRule {
  key: string;
  label: string;
  pass: boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  rules: PasswordRule[];
}

export function validatePassword(password: string): PasswordValidationResult {
  const rules: PasswordRule[] = [
    {
      key: 'length',
      label: 'At least 8 characters',
      pass: password.length >= 8,
    },
    {
      key: 'uppercase',
      label: 'At least one uppercase letter',
      pass: /[A-Z]/.test(password),
    },
    {
      key: 'lowercase',
      label: 'At least one lowercase letter',
      pass: /[a-z]/.test(password),
    },
    {
      key: 'special',
      label: 'At least one special character',
      pass: /[!@#$%^&*()\-_=+\[\]{}|;':",.<>?/`~\\]/.test(password),
    },
    {
      key: 'common',
      label: 'Not a commonly used password',
      pass: !COMMON_PASSWORDS.has(password.toLowerCase()),
    },
  ];

  return { valid: rules.every(r => r.pass), rules };
}

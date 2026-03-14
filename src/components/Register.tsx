// src/components/Register.tsx
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiPost, setToken, setUser, AuthUser } from '../lib/auth';
import { validatePassword } from '../lib/passwordValidation';

interface RegisterResponse {
  token: string;
  user: AuthUser;
  verification?: {
    required?: boolean;
    emailSent?: boolean;
    linkExpiresInHours?: number;
    codeExpiresInMinutes?: number;
  };
}

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pwValidation = validatePassword(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setTouched(true);
    if (!pwValidation.valid) {
      setError(pwValidation.rules.find(r => !r.pass)?.label ?? 'Password does not meet requirements');
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<RegisterResponse>('/api/auth/register', { username, email, password });
      setToken(data.token);
      setUser(data.user);
      if (data.verification?.required) {
        sessionStorage.setItem('sd-pending-verification-email', email);
      }
      // New user → go through onboarding
      localStorage.removeItem('sd-onboarded');
      router.replace('/onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#101922] flex items-center justify-center p-4 font-[Space_Grotesk,system-ui,sans-serif]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              inventory_2
            </span>
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">ShopDeck</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Create account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Start tracking deals and inventory</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your_handle"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setTouched(true); }}
                placeholder="Min. 8 characters"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {/* Live rule checklist */}
              {(touched || password.length > 0) && (
                <ul className="mt-2 space-y-1">
                  {pwValidation.rules.map(rule => (
                    <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${
                      rule.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]" style={rule.pass ? { fontVariationSettings: "'FILL' 1" } : {}}>
                        {rule.pass ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

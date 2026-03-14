import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_BASE, apiPost, getToken, getUser, setUser } from '../lib/auth';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [state, setState] = useState<VerifyState>('idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const hasAuthToken = useMemo(() => !!getToken(), []);

  useEffect(() => {
    if (!router.isReady) return;
    const queryEmail = typeof router.query.email === 'string' ? router.query.email : '';
    const localUser = getUser();
    const pendingEmail = typeof window !== 'undefined' ? sessionStorage.getItem('sd-pending-verification-email') || '' : '';
    setEmail(queryEmail || localUser?.email || pendingEmail);
  }, [router.isReady, router.query.email]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!router.isReady || !token) return;
    let active = true;
    setState('loading');
    setMessage('Verifying your email link...');

    fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data.error || 'Verification link is invalid or expired');

        const localUser = getUser();
        if (localUser) setUser({ ...localUser, accountVerified: true });
        if (typeof window !== 'undefined') sessionStorage.removeItem('sd-pending-verification-email');

        setState('success');
        setMessage(data.alreadyVerified ? 'Your email is already verified.' : 'Your email has been verified successfully.');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });

    return () => {
      active = false;
    };
  }, [router.isReady, token]);

  async function handleCodeVerify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const payload = hasAuthToken ? { code } : { email, code };
      const result = await apiPost<{ verified?: boolean; alreadyVerified?: boolean }>('/api/auth/verify-email-code', payload);
      const localUser = getUser();
      if (localUser) setUser({ ...localUser, accountVerified: true });
      if (typeof window !== 'undefined') sessionStorage.removeItem('sd-pending-verification-email');
      setState('success');
      setMessage(result.alreadyVerified ? 'Your email is already verified.' : 'Your email has been verified successfully.');
    } catch (err: unknown) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!hasAuthToken && !email.trim()) {
      setState('error');
      setMessage('Enter your email address to resend verification.');
      return;
    }

    setResending(true);
    setState('idle');
    setMessage('');
    try {
      const payload = hasAuthToken ? {} : { email: email.trim() };
      const result = await apiPost<{ message?: string }>('/api/auth/resend-verification', payload);
      setResendCooldownUntil(Date.now() + 60 * 1000);
      setState('success');
      setMessage(result.message || 'Verification email sent. Check your inbox for a fresh link and code.');
    } catch (err: unknown) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Failed to resend verification');
    } finally {
      setResending(false);
    }
  }

  const resendCooldownRemaining = Math.max(0, Math.ceil((resendCooldownUntil - now) / 1000));

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#101922] flex items-center justify-center p-4 font-[Space_Grotesk,system-ui,sans-serif]">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Verify email</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Use your link or enter the verification code from your email.</p>

        {message && (
          <div className={`mb-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${
            state === 'success'
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : state === 'error'
                ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-700'
          }`}>
            <span className="material-symbols-outlined text-base">
              {state === 'success' ? 'check_circle' : state === 'error' ? 'error' : 'hourglass_top'}
            </span>
            {message}
          </div>
        )}

        <form onSubmit={handleCodeVerify} className="space-y-4">
          {!hasAuthToken && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Verification code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="123456"
              required
              maxLength={6}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Verifying…' : 'Verify code'}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || resendCooldownRemaining > 0}
            className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {resending
              ? 'Sending…'
              : resendCooldownRemaining > 0
                ? `Resend in ${resendCooldownRemaining}s`
                : 'Resend verification email'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">Back to sign in</Link>
          {' · '}
          <Link href="/dashboard" className="text-blue-500 hover:text-blue-600 font-medium">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
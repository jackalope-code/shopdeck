import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { API_BASE, apiPost, getToken, getUser, setUser } from '../lib/auth';

type VerifyState = 'idle' | 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const [state, setState] = useState<VerifyState>('idle');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const hasAuthToken = !!getToken();

  useEffect(() => {
    if (!router.isReady || !token) return;
    let active = true;
    setState('loading');

    fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) throw new Error(data.error || 'Verification link is invalid or expired');

        const localUser = getUser();
        if (localUser) setUser({ ...localUser, email_verified: true });
        if (typeof window !== 'undefined') sessionStorage.removeItem('sd-pending-verification-email');

        setState('success');
        setMessage('Your email has been verified successfully.');
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });

    return () => { active = false; };
  }, [router.isReady, token]);

  async function handleResend() {
    if (!hasAuthToken) return;
    setResending(true);
    setState('idle');
    setMessage('');
    try {
      await apiPost('/api/auth/resend-verification', {});
      setResendSent(true);
      setState('success');
      setMessage('Verification email sent — check your inbox.');
    } catch (err: unknown) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Failed to resend verification');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#101922] flex items-center justify-center p-4 font-[Space_Grotesk,system-ui,sans-serif]">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Verify email</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {token ? 'Verifying your email link…' : 'Check your inbox for a verification link.'}
        </p>

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

        <div className="space-y-2">
          {state === 'success' && (
            <Link
              href="/dashboard"
              className="block w-full text-center py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
            >
              Go to dashboard
            </Link>
          )}

          {(state === 'error' || (!token && state === 'idle')) && hasAuthToken && !resendSent && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="text-blue-500 hover:text-blue-600 font-medium">Back to sign in</Link>
          {' · '}
          <Link href="/dashboard" className="text-blue-500 hover:text-blue-600 font-medium">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
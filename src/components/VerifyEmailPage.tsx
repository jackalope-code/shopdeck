import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { API_BASE, getToken, apiPost } from '../lib/auth';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;

  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorCode, setErrorCode] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!token || typeof token !== 'string') return;
    fetch(`${API_BASE}/auth/verify-email?token=${encodeURIComponent(token)}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then(async res => {
        if (res.ok) {
          setStatus('success');
        } else {
          const body = await res.json().catch(() => ({})) as { code?: string };
          setErrorCode(body.code ?? 'ERROR');
          setStatus('error');
        }
      })
      .catch(() => {
        setErrorCode('NETWORK_ERROR');
        setStatus('error');
      });
  }, [token]);

  async function handleResend() {
    setResendMsg('');
    try {
      await apiPost('/api/auth/resend-verification', {});
      setResendMsg('Sent! Check your inbox.');
    } catch (err: unknown) {
      setResendMsg(err instanceof Error ? err.message : 'Failed to send email.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f7f8] dark:bg-[#101922] px-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-8 text-center space-y-4">
        {status === 'pending' && (
          <>
            <span className="material-symbols-outlined text-5xl text-blue-400 animate-spin" style={{ display: 'inline-block' }}>progress_activity</span>
            <p className="text-sm text-slate-500 dark:text-slate-400">Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <span className="material-symbols-outlined text-5xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Email verified!</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your email address has been confirmed.</p>
            <Link
              href="/dashboard"
              className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <span className="material-symbols-outlined text-5xl text-red-400">error</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {errorCode === 'TOKEN_INVALID' || errorCode === 'TOKEN_EXPIRED'
                ? 'Link expired or invalid'
                : 'Verification failed'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {errorCode === 'TOKEN_INVALID' || errorCode === 'TOKEN_EXPIRED'
                ? 'This verification link has expired or already been used.'
                : 'Something went wrong. Please try again.'}
            </p>
            {getToken() && (
              <div className="space-y-2">
                <button
                  onClick={handleResend}
                  className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
                >
                  Resend verification email
                </button>
                {resendMsg && <p className="text-xs text-slate-500">{resendMsg}</p>}
              </div>
            )}
            <Link
              href="/dashboard"
              className="inline-block text-xs text-blue-500 hover:underline"
            >
              Back to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// src/components/Login.tsx
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GoogleLogin } from '@react-oauth/google';
import { apiPost, setToken, setUser, AuthUser, getToken, getUser, createDemoSession } from '../lib/auth';
import { useFeatures } from '../lib/features';

export default function Login() {
  const router = useRouter();
  const features = useFeatures();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // GitHub Device Flow state
  const [ghPhase, setGhPhase] = useState<'idle' | 'code' | 'polling'>('idle');
  const [ghCode, setGhCode] = useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null);
  const [ghError, setGhError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; user: AuthUser }>('/api/auth/login', { email, password });
      setToken(data.token);
      setUser(data.user);
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('EMAIL_NOT_VERIFIED') || msg.includes('verify your email')) {
        setError(msg + ' Need another link? ');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthSuccess(token: string, user: AuthUser, isNewUser: boolean) {
    setToken(token);
    setUser(user);
    if (isNewUser) {
      localStorage.removeItem('sd-onboarded');
      router.replace('/onboarding');
    } else {
      router.replace('/dashboard');
    }
  }

  async function startGitHubFlow() {
    setGhError('');
    setGhPhase('code');
    try {
      const data = await apiPost<{ user_code: string; verification_uri: string; device_code: string; interval: number }>(
        '/api/auth/github/device/start', {}
      );
      setGhCode(data);
      setGhPhase('polling');
      pollGitHub(data.device_code, data.interval ?? 5);
    } catch (err: unknown) {
      setGhError(err instanceof Error ? err.message : 'Failed to start GitHub sign-in');
      setGhPhase('idle');
    }
  }

  async function pollGitHub(device_code: string, interval: number) {
    const maxAttempts = Math.ceil(300 / interval);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, interval * 1000));
      try {
        const data = await apiPost<{ status: string; token?: string; user?: AuthUser; isNewUser?: boolean }>(
          '/api/auth/github/device/signin', { device_code }
        );
        if (data.status === 'pending' || data.status === 'slow_down') continue;
        if (data.status === 'expired') { setGhError('Code expired. Please try again.'); setGhPhase('idle'); return; }
        if (data.status === 'error') { setGhError(data.status); setGhPhase('idle'); return; }
        if (data.status === 'success' && data.token && data.user) {
          setGhPhase('idle');
          setGhCode(null);
          handleOAuthSuccess(data.token, data.user, data.isNewUser ?? false);
          return;
        }
      } catch { /* network hiccup — keep polling */ }
    }
    setGhError('Timed out. Please try again.');
    setGhPhase('idle');
  }

  async function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; user: AuthUser; isNewUser?: boolean }>(
        '/api/auth/google', { credential: credentialResponse.credential }
      );
      handleOAuthSuccess(data.token, data.user, data.isNewUser ?? false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeveloper() {
    setError('');
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; user: AuthUser }>('/api/auth/developer', {});
      setToken(data.token);
      setUser(data.user);
      router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Developer login failed');
    } finally {
      setLoading(false);
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';

  async function handleDemo() {
    setError('');
    setLoading(true);
    try {
      // Restore existing demo session if one exists on this device
      const existingToken = getToken();
      const existingUser = getUser();
      if (existingToken && existingUser?.is_demo) {
        router.replace('/dashboard');
        return;
      }
      await createDemoSession();
      localStorage.removeItem('sd-onboarded');
      router.replace('/onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start demo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#101922] flex items-center justify-center p-4 font-[Space_Grotesk,system-ui,sans-serif]">
      {/* Logo / wordmark */}
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              inventory_2
            </span>
          </div>
          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">ShopDeck</span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Welcome back</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Sign in to your ShopDeck account</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">explore</span>
            Try Demo
          </button>

          {/* ── OAuth sign-in buttons (feature-flagged) ── */}
          {(features.github_oauth || features.google_oauth) && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">or continue with</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {features.github_oauth && (
                <>
                  {ghPhase === 'code' || ghPhase === 'polling' ? (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                      {ghCode ? (
                        <>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Go to <span className="font-mono font-semibold text-blue-500">{ghCode.verification_uri}</span> and enter:
                          </p>
                          <p className="text-center text-2xl font-mono font-bold tracking-widest text-slate-800 dark:text-slate-100 select-all">
                            {ghCode.user_code}
                          </p>
                          <p className="text-xs text-slate-400 text-center animate-pulse">Waiting for authorization…</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 text-center animate-pulse">Starting GitHub sign-in…</p>
                      )}
                      <button
                        type="button"
                        onClick={() => { setGhPhase('idle'); setGhCode(null); setGhError(''); }}
                        className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startGitHubFlow}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                      Sign in with GitHub
                    </button>
                  )}
                  {ghError && (
                    <p className="text-xs text-red-500 text-center">{ghError}</p>
                  )}
                </>
              )}

              {features.google_oauth && (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in failed')}
                    useOneTap={false}
                    theme="outline"
                    size="large"
                    width="320"
                  />
                </div>
              )}
            </>
          )}

          {isDev && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400">dev only</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>
              <button
                onClick={handleDeveloper}
                disabled={loading}
                className="w-full py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">terminal</span>
                Continue as Developer
              </button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-blue-500 hover:text-blue-600 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

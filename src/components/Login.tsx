// src/components/Login.tsx
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiPost, setToken, setUser, AuthUser, getToken, getUser, createDemoSession } from '../lib/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      setError(err instanceof Error ? err.message : 'Login failed');
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

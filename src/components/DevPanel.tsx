// src/components/DevPanel.tsx
// Only rendered in development (process.env.NODE_ENV !== 'production').
// Provides dev-only controls gated entirely on the Node environment — no
// secret key combos, no runtime switches, zero footprint in production builds.
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getUser, isLoggedIn, setToken, setUser } from '../lib/auth';

const KEY_FORCE_ONBOARDING = 'sd-dev-force-onboarding';
const KEY_ALWAYS_ONBOARDING = 'sd-dev-always-onboarding';
const KEY_ONBOARDED = 'sd-onboarded';

export default function DevPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const [alwaysOnboarding, setAlwaysOnboarding] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const user = getUser();

  function refresh() {
    setForceOnboarding(localStorage.getItem(KEY_FORCE_ONBOARDING) === 'true');
    setAlwaysOnboarding(localStorage.getItem(KEY_ALWAYS_ONBOARDING) === 'true');
    setOnboarded(localStorage.getItem(KEY_ONBOARDED) === 'true');
  }

  useEffect(() => { refresh(); }, [open]);

  function toggleForceOnboarding() {
    const next = !forceOnboarding;
    if (next) {
      localStorage.setItem(KEY_FORCE_ONBOARDING, 'true');
    } else {
      localStorage.removeItem(KEY_FORCE_ONBOARDING);
    }
    setForceOnboarding(next);
  }

  function toggleAlwaysOnboarding() {
    const next = !alwaysOnboarding;
    if (next) {
      localStorage.setItem(KEY_ALWAYS_ONBOARDING, 'true');
    } else {
      localStorage.removeItem(KEY_ALWAYS_ONBOARDING);
    }
    setAlwaysOnboarding(next);
  }

  function goToOnboarding() {
    // Remove both flags so the onboarding guard doesn't redirect away
    localStorage.removeItem(KEY_ONBOARDED);
    localStorage.removeItem(KEY_FORCE_ONBOARDING);
    setOnboarded(false);
    setForceOnboarding(false);
    setOpen(false);
    if (isLoggedIn()) {
      router.push('/onboarding');
    } else {
      router.push('/login');
    }
  }

  const [devLoggingIn, setDevLoggingIn] = useState(false);
  const [devLoginError, setDevLoginError] = useState('');

  async function handleDevLogin() {
    setDevLoggingIn(true);
    setDevLoginError('');
    try {
      const res = await fetch('/api/auth/developer', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Login failed');
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setOpen(false);
      router.push('/dashboard');
    } catch (err: unknown) {
      setDevLoginError(err instanceof Error ? err.message : 'Dev login failed');
    } finally {
      setDevLoggingIn(false);
    }
  }

  return (
    <>
      {/* Floating badge */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev Panel"
        className="fixed bottom-4 right-4 z-9999 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900 text-slate-300 text-[11px] font-mono font-semibold shadow-lg border border-slate-700 hover:bg-slate-800 transition-colors select-none"
      >
        <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
        DEV
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-9998" onClick={() => setOpen(false)} />
          <div className="fixed bottom-14 right-4 z-9999 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl text-slate-200 font-mono text-xs overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-[11px] uppercase tracking-widest text-slate-300">Dev Panel</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Session */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Session</p>
                <div className="bg-slate-800 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">user</span>
                    <span className="text-slate-200">{user?.username ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">email_verified</span>
                    <span className={user?.email_verified ? 'text-emerald-400' : 'text-amber-400'}>{user?.email_verified ? 'true' : 'false'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">onboarded</span>
                    <span className={onboarded ? 'text-emerald-400' : 'text-amber-400'}>{onboarded ? 'true' : 'false'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">force-onboarding</span>
                    <span className={forceOnboarding ? 'text-amber-400' : 'text-slate-500'}>{forceOnboarding ? 'true' : 'false'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">always-onboarding</span>
                    <span className={alwaysOnboarding ? 'text-rose-400' : 'text-slate-500'}>{alwaysOnboarding ? 'ON' : 'off'}</span>
                  </div>
                </div>
              </div>

              {/* Auth controls */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Auth</p>
                <div className="space-y-2">
                  <button
                    onClick={handleDevLogin}
                    disabled={devLoggingIn}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 transition-colors text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[14px]">login</span>
                    {devLoggingIn ? 'Logging in…' : 'Dev Login'}
                  </button>
                  {devLoginError && (
                    <p className="text-[10px] text-rose-400 px-1">{devLoginError}</p>
                  )}
                </div>
              </div>

              {/* Onboarding controls */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Onboarding</p>
                <div className="space-y-2">
                  {/* Go to onboarding now */}
                  <button
                    onClick={goToOnboarding}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-white font-semibold"
                  >
                    <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                    Show onboarding now
                  </button>

                  {/* Toggle: force onboarding on next visit to / */}
                  <button
                    onClick={toggleForceOnboarding}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-slate-300">Force on next visit to /</span>
                    <div className={`relative w-8 h-4.5 rounded-full transition-colors ${forceOnboarding ? 'bg-amber-500' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-transform ${forceOnboarding ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  {/* Toggle: always show onboarding (demo loop) */}
                  <button
                    onClick={toggleAlwaysOnboarding}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${alwaysOnboarding ? 'bg-rose-950/60 hover:bg-rose-950/80 ring-1 ring-rose-800' : 'bg-slate-800 hover:bg-slate-700'}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-slate-300">Always show onboarding</span>
                      <span className="text-[10px] text-slate-500">demo mode — loops until disabled</span>
                    </div>
                    <div className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ml-3 ${alwaysOnboarding ? 'bg-rose-500' : 'bg-slate-600'}`}>
                      <span className={`absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-transform ${alwaysOnboarding ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 leading-relaxed">
                Only rendered when{' '}
                <span className="text-slate-500">NODE_ENV ≠ production</span>.
                Absent from production builds entirely.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}

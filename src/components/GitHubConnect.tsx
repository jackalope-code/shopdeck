// src/components/GitHubConnect.tsx
// Reusable GitHub OAuth Device Flow connect widget.
// compact=true → used in AIAgent settings panel
// compact=false (default) → used in Settings page AI tab
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost, getToken, API_BASE } from '../lib/auth';

type Phase = 'loading' | 'idle' | 'starting' | 'awaiting' | 'connected' | 'error';

interface AwaitingState {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
}

async function apiDelete(path: string): Promise<void> {
  const token = getToken();
  await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

const GITHUB_MARK = (
  <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export default function GitHubConnect({ compact = false }: { compact?: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [awaiting, setAwaiting] = useState<AwaitingState | null>(null);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkStatus();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  async function checkStatus() {
    try {
      const data = await apiGet<{ connected: boolean; githubUsername: string | null }>('/api/auth/github/status');
      setGithubUsername(data.connected ? (data.githubUsername ?? null) : null);
      setPhase(data.connected ? 'connected' : 'idle');
    } catch {
      setPhase('idle');
    }
  }

  async function startFlow() {
    setPhase('starting');
    setError('');
    try {
      const data = await apiPost<AwaitingState & { error?: string }>('/api/auth/github/device/start', {});
      if ('error' in data && data.error) throw new Error(data.error);
      setAwaiting(data);
      setPhase('awaiting');
      window.open(data.verification_uri, '_blank', 'noopener,noreferrer');
      schedule(data.device_code, data.interval || 5);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start GitHub flow');
      setPhase('error');
    }
  }

  function schedule(device_code: string, intervalSec: number) {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(() => poll(device_code, intervalSec), intervalSec * 1000);
  }

  async function poll(device_code: string, intervalSec: number) {
    try {
      const data = await apiPost<{ status: string; githubUsername?: string; error?: string }>(
        '/api/auth/github/device/poll', { device_code }
      );
      if (data.status === 'success') {
        if (pollRef.current) clearTimeout(pollRef.current);
        setGithubUsername(data.githubUsername ?? null);
        setPhase('connected');
        setAwaiting(null);
      } else if (data.status === 'slow_down') {
        schedule(device_code, intervalSec + 5);
      } else if (data.status === 'expired' || data.status === 'error') {
        if (pollRef.current) clearTimeout(pollRef.current);
        setError(data.error || 'Authorization expired. Please try again.');
        setPhase('error');
        setAwaiting(null);
      } else {
        // authorization_pending — keep polling
        schedule(device_code, intervalSec);
      }
    } catch {
      schedule(device_code, intervalSec);
    }
  }

  async function disconnect() {
    if (pollRef.current) clearTimeout(pollRef.current);
    try { await apiDelete('/api/auth/github/token'); } catch {}
    setGithubUsername(null);
    setAwaiting(null);
    setPhase('idle');
  }

  function copyCode() {
    if (awaiting?.user_code) navigator.clipboard.writeText(awaiting.user_code).catch(() => {});
  }

  // ─── Compact (AIAgent inline settings panel) ─────────────────────────────────
  if (compact) {
    if (phase === 'loading') {
      return <div className="h-8 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />;
    }
    if (phase === 'connected') {
      return (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {githubUsername ? `@${githubUsername}` : 'Connected'}
          </div>
          <button onClick={disconnect} className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Disconnect</button>
        </div>
      );
    }
    if (phase === 'awaiting' && awaiting) {
      return (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500">GitHub opened in a new tab. Enter this code:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-center text-sm font-mono font-bold tracking-widest bg-slate-100 dark:bg-slate-700 rounded-lg py-1.5 px-3 text-blue-600 dark:text-blue-400">
              {awaiting.user_code}
            </code>
            <button onClick={copyCode} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors" title="Copy">
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse inline-block shrink-0" />
            Waiting for authorization…
            <button onClick={disconnect} className="ml-auto hover:text-slate-600">Cancel</button>
          </div>
        </div>
      );
    }
    if (phase === 'error') {
      return (
        <div className="space-y-1.5">
          <p className="text-[10px] text-red-500">{error}</p>
          <button onClick={startFlow} className="w-full py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-semibold transition-colors">
            Try again
          </button>
        </div>
      );
    }
    // idle / starting
    return (
      <button
        onClick={startFlow}
        disabled={phase === 'starting'}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {GITHUB_MARK}
        {phase === 'starting' ? 'Opening GitHub…' : 'Connect GitHub'}
      </button>
    );
  }

  // ─── Full (Settings page) ────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />;
  }
  if (phase === 'connected') {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-500 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">GitHub Connected</p>
            {githubUsername && <p className="text-xs text-slate-500 mt-0.5">Signed in as <span className="font-mono font-semibold">@{githubUsername}</span></p>}
          </div>
        </div>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors font-semibold"
        >
          Disconnect
        </button>
      </div>
    );
  }
  if (phase === 'awaiting' && awaiting) {
    return (
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
        <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Authorize on GitHub</p>
        <p className="text-xs text-slate-500">
          GitHub should have opened in a new tab. If not,{' '}
          <a href={awaiting.verification_uri} target="_blank" rel="noreferrer" className="underline hover:text-blue-500 font-mono">{awaiting.verification_uri}</a>.
        </p>
        <div>
          <p className="text-xs text-slate-500 mb-2">Enter this code when prompted:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-center text-2xl font-mono font-bold tracking-[0.25em] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-blue-600 dark:text-blue-400 shadow-sm">
              {awaiting.user_code}
            </code>
            <button onClick={copyCode} className="p-2.5 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 transition-colors" title="Copy code">
              <span className="material-symbols-outlined text-[20px]">content_copy</span>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="size-2 rounded-full bg-blue-500 animate-pulse inline-block shrink-0" />
            Waiting for you to authorize…
          </div>
          <button onClick={disconnect} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Connection failed</p>
        <p className="text-xs text-red-500">{error}</p>
        <button onClick={startFlow} className="px-4 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors">Try again</button>
      </div>
    );
  }
  // idle / starting
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 space-y-1.5">
        <p className="text-sm font-semibold">Connect your GitHub account</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Authenticate via GitHub OAuth. No API key required — your Copilot subscription unlocks access to all listed models.
        </p>
        <p className="text-xs text-slate-400">
          Requires an active GitHub Copilot subscription and{' '}
          <code className="font-mono text-slate-500">GITHUB_OAUTH_CLIENT_ID</code> set in <code className="font-mono text-slate-500">backend/.env</code>.
        </p>
      </div>
      <button
        onClick={startFlow}
        disabled={phase === 'starting'}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
      >
        <svg className="size-5 shrink-0" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        {phase === 'starting' ? 'Opening GitHub…' : 'Connect with GitHub'}
      </button>
    </div>
  );
}

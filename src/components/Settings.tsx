// src/components/Settings.tsx
// Three-tab settings page: Feed Sources, Custom Sources, AI Assistant
'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Sidebar, TopHeader } from './ProjectsOverview';
import { apiGet, apiPatch, apiPost, apiDelete, getToken, getUser, setToken, setUser, isDemoAccount, API_BASE } from '../lib/auth';
import { usePlaidLink } from 'react-plaid-link';
import { useFeatures } from '../lib/features';
import { GoogleLogin } from '@react-oauth/google';

const STORAGE_KEY_ONBOARDED = 'sd-onboarded';
import GitHubConnect from './GitHubConnect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FeedSource {
  name: string;
  url: string;
  enabled: boolean;
  interval?: string;
  status?: string;
}

interface CustomRule {
  name: string;
  url: string;
  ruleType: 'css' | 'jsonpath';
  selector: string;
  attribute?: string;
  fieldName: string;
}

interface FeedWidgetConfig {
  sources: FeedSource[];
  custom: CustomRule[];
}

interface FeedConfig {
  [widgetId: string]: FeedWidgetConfig;
}

interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
}

interface ModelDef { id: string; rate: number; }

const PROVIDERS: { id: string; label: string; models: ModelDef[] }[] = [
  { id: 'github', label: 'GitHub Copilot', models: [
    { id: 'gpt-4.1',                         rate: 0 },
    { id: 'gpt-4o',                           rate: 0 },
    { id: 'gpt-4o-mini',                      rate: 0 },
    { id: 'o1',                               rate: 3 },
    { id: 'o3-mini',                          rate: 0 },
    { id: 'claude-opus-4-5',                  rate: 3 },
    { id: 'claude-sonnet-4-5',                rate: 1 },
    { id: 'claude-haiku-3-5',                 rate: 0 },
    { id: 'Meta-Llama-3.3-70B-Instruct',      rate: 0 },
    { id: 'mistral-large-2411',               rate: 1 },
  ]},
  { id: 'openai', label: 'OpenAI', models: [
    { id: 'gpt-4.1',      rate: 1 },
    { id: 'gpt-4o',       rate: 1 },
    { id: 'gpt-4o-mini',  rate: 0 },
    { id: 'gpt-4-turbo',  rate: 1 },
  ]},
  { id: 'anthropic', label: 'Anthropic', models: [
    { id: 'claude-opus-4-5',    rate: 3 },
    { id: 'claude-sonnet-4-5',  rate: 1 },
    { id: 'claude-haiku-3-5',   rate: 0 },
  ]},
  { id: 'gemini', label: 'Gemini', models: [
    { id: 'gemini-2.0-flash',   rate: 0 },
    { id: 'gemini-1.5-pro',     rate: 1 },
    { id: 'gemini-1.5-flash',   rate: 0 },
  ]},
  { id: 'ollama', label: 'Ollama (local)', models: [
    { id: 'llama3',    rate: 0 },
    { id: 'llama3.1',  rate: 0 },
    { id: 'mistral',   rate: 0 },
    { id: 'phi3',      rate: 0 },
    { id: 'gemma3',    rate: 0 },
  ]},
  { id: 'opencode', label: 'OpenCode.ai', models: [
    { id: 'opencode-default', rate: 1 },
  ]},
];

function rateLabel(rate: number): string {
  if (rate === 0) return 'free';
  return `${rate}× premium`;
}

const WIDGET_LABELS: Record<string, string> = {
  'ram-availability':   'RAM Availability',
  'gpu-availability':   'GPU Availability',
  'active-deals':       'Active Deals',
  'keyboard-releases':  'Keyboard Releases',
  'keyboard-full-release': 'Keyboard Full Releases',
  'keyboard-parts-release': 'Keyboard Parts Releases',
  'keyboard-switches': 'Keyboard Switches',
  'keyboard-accessories': 'Keyboard Accessories / Misc',
  'keyboard-sales':     'Keyboard Sales',
  'electronics-watchlist': 'Electronics Watchlist',
};

const TABS = ['Feed Sources', 'Custom Sources', 'AI Assistant', 'Preferences', 'API Keys', 'Accounts'];

// ─── Demo account upgrade card ────────────────────────────────────────────────
function DemoUpgradeCard() {
  const router = useRouter();
  const [username, setUsernameField] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await apiPost<{ token: string; user: { id: string; username: string; email: string; is_demo: boolean } }>(
        '/api/auth/upgrade', { username, email, password }
      );
      setToken(res.token);
      setUser(res.user);
      setDone(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Upgrade failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">check_circle</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Account upgraded!</h3>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Your account is now a full account. All your data, widgets, and settings are preserved.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-amber-500">upgrade</span>
        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Upgrade to Full Account</h3>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          You&apos;re using a demo account. Upgrade to save your data permanently, sync across devices, and access all features.
        </p>
        <form onSubmit={handleUpgrade} className="space-y-3">
          <input
            type="text" value={username} onChange={e => setUsernameField(e.target.value)}
            placeholder="Username" required minLength={3} maxLength={32}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" required
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required minLength={8}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm password" required
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">upgrade</span>
            {loading ? 'Upgrading…' : 'Upgrade Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Redo onboarding button ───────────────────────────────────────────────────
function RedoOnboardingButton() {
  const router = useRouter();
  function handleRedo() {
    localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    router.push('/onboarding');
  }
  return (
    <button
      onClick={handleRedo}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
    >
      <span className="material-symbols-outlined text-[18px] text-blue-500">restart_alt</span>
      Redo setup wizard
    </button>
  );
}

// ─── Tab 4: Preferences ─────────────────────────────────────────────────────────────
function PreferencesTab() {
  const [notifEnabled, setNotifEnabled] = React.useState(false);
  const [shareViewHistory, setShareViewHistory] = React.useState(true);
  const [shareFavorites, setShareFavorites] = React.useState(true);
  const [plantingZone, setPlantingZone] = React.useState<number | null>(null);
  const [hideOutdoorPlants, setHideOutdoorPlants] = React.useState(false);
  const [perm, setPerm] = React.useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  // Load from profile API on mount
  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { browserAlerts?: boolean; shareViewHistory?: boolean; shareFavorites?: boolean; plantingZone?: number | null; hideOutdoorPlants?: boolean } }>('/api/profile')
      .then(data => {
        if (data?.profile?.browserAlerts != null) setNotifEnabled(data.profile.browserAlerts);
        if (data?.profile?.shareViewHistory != null) setShareViewHistory(data.profile.shareViewHistory);
        if (data?.profile?.shareFavorites != null) setShareFavorites(data.profile.shareFavorites);
        if (data?.profile?.plantingZone !== undefined) setPlantingZone(data.profile.plantingZone ?? null);
        if (data?.profile?.hideOutdoorPlants != null) setHideOutdoorPlants(data.profile.hideOutdoorPlants);
      })
      .catch(() => {});
  }, []);

  async function handleToggle() {
    if (perm === 'unsupported') return;
    if (!notifEnabled) {
      if (perm !== 'granted') {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result !== 'granted') return;
      }
      setNotifEnabled(true);
      apiPatch('/api/profile', { browserAlerts: true }).catch(() => {});
    } else {
      setNotifEnabled(false);
      apiPatch('/api/profile', { browserAlerts: false }).catch(() => {});
    }
  }

  function handleShareToggle(field: 'shareViewHistory' | 'shareFavorites', value: boolean) {
    if (field === 'shareViewHistory') setShareViewHistory(value);
    if (field === 'shareFavorites') setShareFavorites(value);
    apiPatch('/api/profile', { [field]: value }).catch(() => {
      if (field === 'shareViewHistory') setShareViewHistory(prev => !prev);
      if (field === 'shareFavorites') setShareFavorites(prev => !prev);
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {isDemoAccount() && <DemoUpgradeCard />}
      {/* Notifications card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">notifications</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Browser Notifications</h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Receive native OS notifications when prices drop, stock becomes available, or your watchlist items change.
          </p>

          {/* Toggle row */}
          <button
            onClick={handleToggle}
            disabled={perm === 'unsupported'}
            className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
              notifEnabled
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-colors ${
              notifEnabled ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: notifEnabled ? "'FILL' 1" : "'FILL' 0" }}
              >notifications</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                notifEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
              }`}>Alert me about deals &amp; stock changes</p>
              <p className="text-xs text-slate-400 mt-0.5">Push to your OS notification centre</p>
            </div>
            {/* Toggle switch */}
            <div className="ml-2 shrink-0 relative inline-flex items-center rounded-full pointer-events-none" style={{ width: 44, height: 24 }}>
              <span className={`block rounded-full transition-colors`} style={{ width: 44, height: 24, background: notifEnabled ? '#3b82f6' : undefined }} />
              <span className={`absolute block rounded-full bg-white shadow transition-transform ${
                notifEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`} style={{ width: 20, height: 20, top: 2, left: 2 }} />
            </div>
          </button>

          {/* Permission status */}
          {perm === 'unsupported' && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Your browser doesn&apos;t support notifications.
            </div>
          )}
          {perm === 'denied' && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
              <span className="material-symbols-outlined text-[16px] mt-0.5">block</span>
              <span>Notifications are <strong>blocked</strong> for this site. To enable them, open your browser&apos;s site settings and allow notifications for this origin, then reload.</span>
            </div>
          )}
          {perm === 'granted' && notifEnabled && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Permission granted — ShopDeck can send you notifications.
            </div>
          )}
          {perm === 'default' && !notifEnabled && (
            <p className="text-[11px] text-slate-400">
              Enabling will prompt your browser for notification permission.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-emerald-500">groups</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Shared Popularity Signals</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Shared history and favorites help ShopDeck surface products the community is actually viewing and saving. Turning either off removes your past contribution from those shared rankings and recommendation signals.
          </div>

          {[
            {
              key: 'shareViewHistory' as const,
              enabled: shareViewHistory,
              icon: 'history',
              title: 'Share product history',
              detail: 'Include your viewed products in shared popularity widgets.',
            },
            {
              key: 'shareFavorites' as const,
              enabled: shareFavorites,
              icon: 'favorite',
              title: 'Share favorites',
              detail: 'Include your saved products in shared favorites widgets.',
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => handleShareToggle(item.key, !item.enabled)}
              className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                item.enabled
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-colors ${
                item.enabled ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: item.enabled ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${item.enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
              </div>
              <div className="ml-2 shrink-0 relative inline-flex items-center rounded-full pointer-events-none" style={{ width: 44, height: 24 }}>
                <span className="block rounded-full transition-colors" style={{ width: 44, height: 24, background: item.enabled ? '#10b981' : undefined }} />
                <span className={`absolute block rounded-full bg-white shadow transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ width: 20, height: 20, top: 2, left: 2 }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Redo Setup Wizard card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">restart_alt</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Setup Wizard</h3>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Re-run the setup wizard to change your categories, dashboard layout, and widget selection.
            Your existing data won&apos;t be affected.
          </p>
          <RedoOnboardingButton />
        </div>
      </div>

      {/* Garden / Planting Zone card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-green-600">yard</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Garden &amp; Planting Zone</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              USDA Hardiness Zone
            </label>
            <select
              value={plantingZone ?? ''}
              onChange={e => {
                const val = e.target.value === '' ? null : Number(e.target.value);
                setPlantingZone(val);
                apiPatch('/api/profile', { plantingZone: val }).catch(() => {});
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Not set</option>
              {Array.from({ length: 13 }, (_, i) => i + 1).map(z => (
                <option key={z} value={z}>Zone {z}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Used to filter plants and seeds that won&apos;t survive in your climate.</p>
          </div>
          <button
            onClick={() => {
              const next = !hideOutdoorPlants;
              setHideOutdoorPlants(next);
              apiPatch('/api/profile', { hideOutdoorPlants: next }).catch(() => {});
            }}
            className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
              hideOutdoorPlants
                ? 'border-green-500 bg-green-500/5'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-colors ${
              hideOutdoorPlants ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: hideOutdoorPlants ? "'FILL' 1" : "'FILL' 0" }}>filter_alt</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${ hideOutdoorPlants ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200' }`}>Hide out-of-zone plants</p>
              <p className="text-xs text-slate-400 mt-0.5">Suppress plants and seeds listed outside your hardiness zone in Garden feeds.</p>
            </div>
            <div className="ml-2 shrink-0 relative inline-flex items-center rounded-full pointer-events-none" style={{ width: 44, height: 24 }}>
              <span className="block rounded-full transition-colors" style={{ width: 44, height: 24, background: hideOutdoorPlants ? '#22c55e' : undefined }} />
              <span className={`absolute block rounded-full bg-white shadow transition-transform ${ hideOutdoorPlants ? 'translate-x-5' : 'translate-x-0.5' }`} style={{ width: 20, height: 20, top: 2, left: 2 }} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
function FeedSourcesTab({ config, saving, onToggle, onSave }: {
  config: FeedConfig;
  saving: string | null;
  onToggle: (widgetId: string, srcName: string, enabled: boolean) => void;
  onSave: (widgetId: string) => void;
}) {
  const widgets = Object.keys(config);
  if (widgets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <span className="material-symbols-outlined text-5xl text-slate-300">rss_feed</span>
        <p className="text-slate-500 text-sm">Loading feed configuration…</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {widgets.map(wid => (
        <div key={wid} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{WIDGET_LABELS[wid] ?? wid}</h3>
            <button
              onClick={() => onSave(wid)}
              disabled={saving === wid}
              className="text-xs px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {saving === wid ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {(config[wid]?.sources ?? []).map(src => (
              <div key={src.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`size-2 rounded-full ${src.status === 'online' ? 'bg-emerald-400' : src.status === 'error' ? 'bg-red-400' : 'bg-slate-300'}`} />
                  <div>
                    <p className="text-sm font-medium">{src.name}</p>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-56">{src.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {src.interval && (
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{src.interval}</span>
                  )}
                  {/* Toggle switch */}
                  <button
                    role="switch"
                    aria-checked={src.enabled}
                    onClick={() => onToggle(wid, src.name, !src.enabled)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${src.enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${src.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 2: Custom Sources ────────────────────────────────────────────────────
function CustomSourcesTab({ config, onAdd, onDelete }: {
  config: FeedConfig;
  onAdd: (widgetId: string, rule: CustomRule) => void;
  onDelete: (widgetId: string, ruleName: string) => void;
}) {
  const [form, setForm] = useState<{ widgetId: string } & CustomRule>({
    widgetId: Object.keys(WIDGET_LABELS)[0] ?? 'ram-availability',
    name: '',
    url: '',
    ruleType: 'css',
    selector: '',
    attribute: '',
    fieldName: '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string[] | null>(null);
  const [testError, setTestError] = useState('');

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setTestResult(null);
    setTestError('');
  }

  async function handleTest() {
    if (!form.url || !form.selector) return;
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const res = await fetch(`${API_BASE}/api/feed-config/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({
          url: form.url,
          ruleType: form.ruleType,
          selector: form.selector,
          attribute: form.attribute || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Test failed');
      setTestResult(data.matches ?? []);
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  function handleAdd() {
    if (!form.name || !form.url || !form.selector || !form.fieldName) return;
    const { widgetId, ...rule } = form;
    onAdd(widgetId, rule);
    setForm(prev => ({ ...prev, name: '', url: '', selector: '', attribute: '', fieldName: '' }));
    setTestResult(null);
  }

  const allCustom: { widgetId: string; rule: CustomRule }[] = [];
  for (const [wid, cfg] of Object.entries(config)) {
    for (const r of cfg.custom ?? []) allCustom.push({ widgetId: wid, rule: r });
  }

  return (
    <div className="space-y-6">
      {/* Existing custom rules */}
      {allCustom.length > 0 && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Active Custom Rules</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {allCustom.map(({ widgetId, rule }) => (
              <div key={`${widgetId}-${rule.name}`} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">{rule.ruleType}</span>
                    <span className="text-[10px] text-slate-400">{WIDGET_LABELS[widgetId] ?? widgetId}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-80">{rule.url}</p>
                </div>
                <button
                  onClick={() => onDelete(widgetId, rule.name)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new rule */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Add Custom Rule</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Name</span>
              <input
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Custom RAM source"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Widget</span>
              <select
                value={form.widgetId}
                onChange={e => setField('widgetId', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(WIDGET_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">URL</span>
            <input
              value={form.url}
              onChange={e => setField('url', e.target.value)}
              placeholder="https://example.com/products"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Rule type</span>
              <select
                value={form.ruleType}
                onChange={e => setField('ruleType', e.target.value as 'css' | 'jsonpath')}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="css">CSS</option>
                <option value="jsonpath">JSONPath</option>
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Selector</span>
              <input
                value={form.selector}
                onChange={e => setField('selector', e.target.value)}
                placeholder={form.ruleType === 'css' ? '.product-price' : '$.data.items[*].price'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.ruleType === 'css' && (
              <label className="block">
                <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Attribute <span className="text-slate-400 font-normal">(optional)</span></span>
                <input
                  value={form.attribute}
                  onChange={e => setField('attribute', e.target.value)}
                  placeholder="href, data-price…"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </label>
            )}
            <label className={`block ${form.ruleType === 'jsonpath' ? 'col-span-2' : ''}`}>
              <span className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Field name</span>
              <input
                value={form.fieldName}
                onChange={e => setField('fieldName', e.target.value)}
                placeholder="price"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          {/* Test result */}
          {testResult !== null && (
            <div className={`rounded-lg p-3 border text-xs ${testResult.length > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              {testResult.length > 0 ? (
                <>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">✓ {testResult.length} match{testResult.length !== 1 ? 'es' : ''} found</p>
                  <ul className="space-y-0.5 font-mono text-slate-600 dark:text-slate-300">
                    {testResult.slice(0, 5).map((r, i) => <li key={i} className="truncate">{r}</li>)}
                    {testResult.length > 5 && <li className="text-slate-400">…and {testResult.length - 5} more</li>}
                  </ul>
                </>
              ) : (
                <p className="text-amber-700 dark:text-amber-400">No matches found. Check your selector.</p>
              )}
            </div>
          )}
          {testError && (
            <div className="rounded-lg p-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
              {testError}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={testing || !form.url || !form.selector}
              className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              {testing ? 'Testing…' : 'Test rule'}
            </button>
            <button
              onClick={handleAdd}
              disabled={!form.name || !form.url || !form.selector || !form.fieldName}
              className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              Add rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Permissions ──────────────────────────────────────────────────────────
interface AIPermissions {
  projects:  boolean;
  inventory: boolean;
  watchlist: boolean;
  deals:     boolean;
}

const DEFAULT_AI_PERMS: AIPermissions = { projects: false, inventory: false, watchlist: false, deals: false };

const AI_PERM_DEFS: { key: keyof AIPermissions; label: string; desc: string; icon: string }[] = [
  { key: 'projects',  label: 'Projects',    desc: 'Budgets, build lists, status',      icon: 'workspaces' },
  { key: 'inventory', label: 'Inventory',   desc: 'Electronics parts & stock levels',  icon: 'inventory_2' },
  { key: 'watchlist', label: 'Price Alerts', desc: 'Watchlists & alert thresholds',    icon: 'notifications_active' },
  { key: 'deals',     label: 'Active Deals', desc: 'Current discounts & price history', icon: 'sell' },
];

// ─── Tab 3: AI Assistant settings ─────────────────────────────────────────────
function AISettingsTab({ onSaved }: { onSaved?: () => void }) {
  const [cfg, setCfg] = useState<AIConfig>({ provider: 'openai', model: 'gpt-4o', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [perms, setPerms] = useState<AIPermissions>(DEFAULT_AI_PERMS);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { aiConfig?: AIConfig; aiPerms?: AIPermissions } }>('/api/profile').then(data => {
      if (data?.profile?.aiConfig?.provider) setCfg(data.profile.aiConfig);
      if (data?.profile?.aiPerms) setPerms({ ...DEFAULT_AI_PERMS, ...data.profile.aiPerms });
    }).catch(() => {});
    try {
      const raw = localStorage.getItem('sd-ai-config');
      if (raw) setCfg(JSON.parse(raw));
    } catch {}
  }, []);

  const providerModels = PROVIDERS.find(p => p.id === cfg.provider)?.models ?? [];

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      localStorage.setItem('sd-ai-config', JSON.stringify(cfg));
      const token = getToken();
      if (token) {
        await apiPatch('/api/profile', { aiConfig: cfg });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">AI Provider</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setCfg(prev => ({ ...prev, provider: p.id, model: p.models[0].id }))}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${cfg.provider === p.id ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500/40'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Model</label>
            <select
              value={cfg.model}
              onChange={e => setCfg(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {providerModels.map(m => <option key={m.id} value={m.id}>{m.id}  ·  {rateLabel(m.rate)}</option>)}
            </select>
          </div>

          {cfg.provider === 'github' ? (
            <GitHubConnect />
          ) : cfg.provider !== 'ollama' ? (
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">API Key</label>
              <input
                type="password"
                value={cfg.apiKey}
                onChange={e => setCfg(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Stored in your profile and sent only from your backend proxy to {cfg.provider}.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2 text-xs text-slate-500">
              Ollama runs locally at <code className="font-mono">http://localhost:11434</code>. No API key required. Make sure Ollama is running and the model is pulled.
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${saved ? 'bg-emerald-500 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'} disabled:opacity-50`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {/* ── Permissions card ── */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-500">lock_open</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Data Access Permissions</h3>
          </div>
          {Object.values(perms).some(Boolean) && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {Object.values(perms).filter(Boolean).length} granted
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Grant the AI Assistant access to your ShopDeck data for personalised recommendations. Your data is only sent to your own backend — never to third-party servers.
          </p>
          <div className="space-y-2">
            {AI_PERM_DEFS.map(d => (
              <button
                key={d.key}
                onClick={() => {
                  const next = { ...perms, [d.key]: !perms[d.key] };
                  setPerms(next);
                  apiPatch('/api/profile', { aiPerms: next }).catch(() => {});
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  perms[d.key]
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] shrink-0 ${perms[d.key] ? 'text-emerald-500' : 'text-slate-400'}`}
                  style={{ fontVariationSettings: perms[d.key] ? "'FILL' 1" : "'FILL' 0" }}
                >{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${perms[d.key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{d.label}</p>
                  <p className="text-xs text-slate-400 truncate">{d.desc}</p>
                </div>
                <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  perms[d.key] ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {perms[d.key] && (
                    <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {Object.values(perms).some(Boolean) && (
            <button
              onClick={() => { setPerms(DEFAULT_AI_PERMS); apiPatch('/api/profile', { aiPerms: DEFAULT_AI_PERMS }).catch(() => {}); }}
              className="w-full py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Revoke all access
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">About AI in ShopDeck</h3>
        </div>
        <div className="p-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>The AI Assistant can help you find deals, compare components, understand pricing trends, and manage project budgets.</p>
          <p>All AI requests are proxied through your own ShopDeck backend — your API key is never exposed to the browser.</p>
          <p>Chat history is stored locally in your browser and cleared when you click "Clear chat" in the panel.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Accounts (CSV budget & finance) ────────────────────────────────────────
// (re-uses apiPost, apiGet which are already imported)
function AccountsTab() {
  const features = useFeatures();
  const isDemo   = isDemoAccount();
  const currentUser = getUser();

  // ─── GitHub OAuth state ──────────────────────────────────────────────────
  const [ghStatus, setGhStatus]   = React.useState<{ connected: boolean; githubUsername: string | null } | null>(null);
  const [ghPhase, setGhPhase]     = React.useState<'idle' | 'code' | 'polling'>('idle');
  const [ghCode, setGhCode]       = React.useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null);
  const [ghMsg, setGhMsg]         = React.useState('');

  const loadGhStatus = React.useCallback(() => {
    if (!features.github_oauth || !getToken()) return;
    apiGet<{ connected: boolean; githubUsername: string | null }>('/api/auth/github/status')
      .then(setGhStatus).catch(() => {});
  }, [features.github_oauth]);

  useEffect(() => { loadGhStatus(); }, [loadGhStatus]);

  async function startGhConnect() {
    setGhMsg('');
    setGhPhase('code');
    try {
      const data = await apiPost<{ user_code: string; verification_uri: string; device_code: string; interval: number }>(
        '/api/auth/github/device/start', {}
      );
      setGhCode(data);
      setGhPhase('polling');
      pollGhConnect(data.device_code, data.interval ?? 5);
    } catch (err: unknown) {
      setGhMsg(err instanceof Error ? err.message : 'Failed to start GitHub link');
      setGhPhase('idle');
    }
  }

  async function pollGhConnect(device_code: string, interval: number) {
    const max = Math.ceil(300 / interval);
    for (let i = 0; i < max; i++) {
      await new Promise(r => setTimeout(r, interval * 1000));
      try {
        const data = await apiPost<{ status: string; githubUsername?: string }>(
          '/api/auth/github/device/poll', { device_code }
        );
        if (data.status === 'pending' || data.status === 'slow_down') continue;
        if (data.status === 'success') {
          setGhPhase('idle'); setGhCode(null); setGhMsg('');
          loadGhStatus();
          return;
        }
        setGhMsg(data.status === 'expired' ? 'Code expired. Try again.' : (data.status ?? 'Error'));
        setGhPhase('idle'); return;
      } catch { /* keep polling */ }
    }
    setGhMsg('Timed out. Please try again.');
    setGhPhase('idle');
  }

  async function handleGhDisconnect() {
    if (!window.confirm('Disconnect your GitHub account?')) return;
    try {
      await apiDelete('/api/auth/github/token');
      loadGhStatus();
    } catch { setGhMsg('Failed to disconnect'); }
  }

  // ─── Google OAuth state ──────────────────────────────────────────────────
  const [googleLinked, setGoogleLinked]   = React.useState<boolean | null>(null);
  const [googleMsg, setGoogleMsg]         = React.useState('');

  React.useEffect(() => {
    if (!features.google_oauth || !getToken() || isDemo) return;
    apiGet<{ google_id: string | null }>('/api/auth/me').then(u => {
      setGoogleLinked(!!(u as unknown as { google_id?: string | null }).google_id);
    }).catch(() => {});
  }, [features.google_oauth, isDemo]);

  async function handleGoogleLink(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) return;
    setGoogleMsg('');
    try {
      await apiPost('/api/auth/google/link', { credential: credentialResponse.credential });
      setGoogleLinked(true);
      setGoogleMsg('Google account linked.');
    } catch (err: unknown) {
      setGoogleMsg(err instanceof Error ? err.message : 'Failed to link Google account');
    }
  }

  async function handleGoogleUnlink() {
    if (!window.confirm('Unlink your Google account?')) return;
    setGoogleMsg('');
    try {
      await apiDelete('/api/auth/google/link');
      setGoogleLinked(false);
      setGoogleMsg('Google account unlinked.');
    } catch (err: unknown) {
      setGoogleMsg(err instanceof Error ? err.message : 'Failed to unlink Google account');
    }
  }

  // ─── Set Password state (for OAuth-only accounts) ─────────────────────────
  const [newPassword, setNewPassword]   = React.useState('');
  const [confirmPassword, setConfirmPw] = React.useState('');
  const [pwSaving, setPwSaving]         = React.useState(false);
  const [pwMsg, setPwMsg]               = React.useState<{ ok: boolean; text: string } | null>(null);
  const hasPassword = currentUser?.has_password !== false;

  // ─── Plaid state ──────────────────────────────────────────────────────────
  type PlaidAccountRow = {
    item_id: string;
    institution_name: string;
    last_synced_at: string | null;
    account_id: string;
    name: string;
    type: string;
    subtype: string;
    mask: string | null;
    available: number | null;
    current: number | null;
    iso_currency_code: string | null;
  };

  const [accounts, setAccounts]         = React.useState<PlaidAccountRow[]>([]);
  const [accountsLoaded, setAccountsLoaded] = React.useState(false);
  const [linkToken, setLinkToken]       = React.useState<string | null>(null);
  const [linkingItem, setLinkingItem]   = React.useState<string | null>(null);
  const [syncing, setSyncing]           = React.useState<string | null>(null);
  const [syncMsg, setSyncMsg]           = React.useState('');
  const [plaidError, setPlaidError]     = React.useState('');

  const loadAccounts = React.useCallback(() => {
    if (!features.plaid || isDemo) return;
    apiGet<PlaidAccountRow[]>('/api/plaid/accounts')
      .then(rows => { setAccounts(rows); setAccountsLoaded(true); })
      .catch(() => setAccountsLoaded(true));
  }, [features.plaid, isDemo]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (publicToken) => {
      try {
        await apiPost('/api/plaid/exchange', { public_token: publicToken });
        setLinkToken(null);
        loadAccounts();
      } catch {
        setPlaidError('Failed to link account.');
      }
    },
  });

  const handleAddAccount = async () => {
    setPlaidError('');
    try {
      const res = await apiGet<{ link_token: string }>('/api/plaid/link-token');
      setLinkToken(res.link_token);
    } catch {
      setPlaidError('Could not start account linking.');
    }
  };

  // Open link when token is ready
  useEffect(() => {
    if (linkToken && plaidReady) openPlaidLink();
  }, [linkToken, plaidReady, openPlaidLink]);

  const handleSync = async (itemId: string) => {
    setSyncing(itemId);
    setSyncMsg('');
    try {
      const res = await apiPost<{ synced: number }>(`/api/plaid/sync/${itemId}`, {});
      setSyncMsg(`Synced ${res.synced} transaction${res.synced !== 1 ? 's' : ''}.`);
      loadAccounts();
    } catch {
      setSyncMsg('Sync failed.');
    } finally {
      setSyncing(null);
    }
  };

  const handleUnlink = async (itemId: string, name: string) => {
    if (!window.confirm(`Unlink ${name}? Existing transactions will be kept.`)) return;
    try {
      await apiDelete(`/api/plaid/accounts/${itemId}`);
      loadAccounts();
    } catch {
      setPlaidError('Failed to unlink account.');
    }
  };

  // Group accounts by institution (item_id)
  const institutions = React.useMemo(() => {
    const map = new Map<string, { itemId: string; name: string; lastSynced: string | null; accounts: PlaidAccountRow[] }>();
    for (const acct of accounts) {
      if (!map.has(acct.item_id)) {
        map.set(acct.item_id, { itemId: acct.item_id, name: acct.institution_name, lastSynced: acct.last_synced_at, accounts: [] });
      }
      map.get(acct.item_id)!.accounts.push(acct);
    }
    return [...map.values()];
  }, [accounts]);

  // ─── CSV state (unchanged from before) ───────────────────────────────────
  const [importing, setImporting]       = React.useState(false);
  const [importMsg, setImportMsg]       = React.useState<{ ok: boolean; text: string } | null>(null);
  const [totalTx, setTotalTx]           = React.useState<number | null>(null);
  const [clearing, setClearing]         = React.useState(false);
  const fileRef                         = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ month: string; summary: unknown[]; total_transactions: number }>('/api/finance/summary')
      .then(d => setTotalTx(d.total_transactions))
      .catch(() => {});
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const res  = await fetch(`${API_BASE}/api/finance/import`, {
        method:  'POST',
        headers: {
          'Content-Type':  'text/plain',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: text,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportMsg({ ok: true, text: `Imported ${data.imported} transactions (detected format: ${data.format}).` });
      setTotalTx(prev => (prev ?? 0) + data.imported);
    } catch (err: unknown) {
      setImportMsg({ ok: false, text: (err as Error)?.message ?? 'Import failed. Check the file format and try again.' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleClear() {
    if (!window.confirm('Delete all imported transactions? This cannot be undone.')) return;
    setClearing(true);
    try {
      const res  = await fetch(`${API_BASE}/api/finance/transactions`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setTotalTx(0);
      setImportMsg({ ok: true, text: `Deleted ${data.deleted} transactions.` });
    } catch (err: unknown) {
      setImportMsg({ ok: false, text: (err as Error)?.message ?? 'Delete failed.' });
    } finally {
      setClearing(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    setPwSaving(true); setPwMsg(null);
    try {
      const data = await apiPost<{ token: string; user: import('../lib/auth').AuthUser }>('/api/auth/set-password', { password: newPassword });
      setToken(data.token); setUser(data.user);
      setPwMsg({ ok: true, text: 'Password set! You can now log in with email + password.' });
      setNewPassword(''); setConfirmPw('');
    } catch (err: unknown) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to set password.' });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Connected Accounts (GitHub / Google OAuth) ──────────────────── */}
      {(features.github_oauth || features.google_oauth) && !isDemo && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-500">link</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Connected Accounts</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* GitHub */}
            {features.github_oauth && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">GitHub</p>
                    {ghStatus?.connected && ghStatus.githubUsername && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{ghStatus.githubUsername}</p>
                    )}
                  </div>
                </div>
                {ghStatus?.connected ? (
                  <button
                    onClick={handleGhDisconnect}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Disconnect
                  </button>
                ) : ghPhase === 'polling' && ghCode ? (
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <a
                        href={ghCode.verification_uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline block"
                      >
                        {ghCode.verification_uri}
                      </a>
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{ghCode.user_code}</span>
                    </div>
                    <button
                      onClick={() => { setGhPhase('idle'); setGhCode(null); }}
                      className="shrink-0 px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startGhConnect}
                    disabled={ghPhase === 'code'}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            )}

            {/* Google */}
            {features.google_oauth && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Google</p>
                </div>
                {googleLinked ? (
                  <button
                    onClick={handleGoogleUnlink}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Unlink
                  </button>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleLink}
                    onError={() => setGoogleMsg('Google link failed.')}
                    text="signin_with"
                    size="medium"
                    shape="rectangular"
                  />
                )}
              </div>
            )}

            {(ghMsg || googleMsg) && (
              <p className="text-xs text-red-500">{ghMsg || googleMsg}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Set Password (shown only when account has no password) ──────── */}
      {!isDemo && !hasPassword && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-purple-500">lock</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Set Password</h3>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Your account was created via OAuth. Add a password to also log in with email.
            </p>
            <form onSubmit={handleSetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {pwMsg && (
                <p className={`text-xs ${pwMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{pwMsg.text}</p>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="w-full py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {pwSaving ? 'Saving…' : 'Set password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Linked Accounts (Plaid) ───────────────────────────────────────── */}
      {features.plaid && (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-green-500">account_balance</span>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Linked Accounts</h3>
            </div>
            {!isDemo && (
              <button
                onClick={handleAddAccount}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Add account
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {isDemo ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                Bank account linking is not available in demo mode. Create a free account to connect real accounts.
              </div>
            ) : (
              <>
                {plaidError && (
                  <p className="text-xs text-red-500">{plaidError}</p>
                )}
                {syncMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{syncMsg}</p>
                )}
                {accountsLoaded && institutions.length === 0 ? (
                  <p className="text-xs text-slate-400">No accounts linked yet. Click &quot;Add account&quot; to connect your bank.</p>
                ) : (
                  institutions.map(inst => (
                    <div key={inst.itemId} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{inst.name}</p>
                          {inst.lastSynced && (
                            <p className="text-[11px] text-slate-400">
                              Last synced {new Date(inst.lastSynced).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSync(inst.itemId)}
                            disabled={syncing === inst.itemId}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                          >
                            <span className={`material-symbols-outlined text-[14px] ${syncing === inst.itemId ? 'animate-spin' : ''}`}>sync</span>
                            Sync
                          </button>
                          <button
                            onClick={() => handleUnlink(inst.itemId, inst.name)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">link_off</span>
                            Unlink
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {inst.accounts.map(acct => (
                          <div key={acct.account_id} className="px-3 py-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {acct.name}
                                {acct.mask && <span className="ml-1 text-slate-400">···{acct.mask}</span>}
                              </p>
                              <p className="text-[11px] text-slate-400 capitalize">{acct.subtype || acct.type}</p>
                            </div>
                            {acct.current !== null && (
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: acct.iso_currency_code || 'USD' }).format(acct.current)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Import card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">upload_file</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Import Bank CSV</h3>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Export a transaction CSV from your bank&apos;s website, then import it here.
            ShopDeck auto-detects Chase, Bank of America, and Capital One formats.
            Any CSV with Date, Description/Merchant, and Amount columns will also work.
            Your data stays on ShopDeck&apos;s servers and is never shared.
          </p>
          {totalTx !== null && (
            <p className="text-[11px] text-slate-400">{totalTx.toLocaleString()} transaction{totalTx !== 1 ? 's' : ''} stored.</p>
          )}
          {importMsg && (
            <div className={`text-xs rounded-lg px-3 py-2 ${
              importMsg.ok
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {importMsg.text}
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-colors ${
              importing
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 pointer-events-none'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}>
              <span className="material-symbols-outlined text-[18px]">{importing ? 'hourglass_empty' : 'upload'}</span>
              {importing ? 'Importing…' : 'Choose CSV file'}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={handleFile}
                disabled={importing}
              />
            </label>
            {(totalTx ?? 0) > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* How-to card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-slate-500">help_outline</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">How to export from your bank</h3>
        </div>
        <div className="p-4">
          <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <li><span className="font-semibold text-slate-700 dark:text-slate-300">Chase:</span> Account → Download Account Activity → CSV</li>
            <li><span className="font-semibold text-slate-700 dark:text-slate-300">Bank of America:</span> Accounts → Transactions → Download → CSV</li>
            <li><span className="font-semibold text-slate-700 dark:text-slate-300">Capital One:</span> Transactions → Download → CSV</li>
            <li><span className="font-semibold text-slate-700 dark:text-slate-300">Other banks:</span> Look for a &quot;Download&quot; or &quot;Export&quot; option on your transactions page. CSV format preferred over PDF or OFX.</li>
          </ul>
        </div>
      </div>

      {/* Privacy card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        <span className="font-semibold text-slate-700 dark:text-slate-300">Privacy: </span>
        CSV data is stored in your ShopDeck account only. It is never sold, shared with data brokers, or used to train models.
        No live bank connection is made &mdash; all data comes from files you upload manually.
      </div>
    </div>
  );
}

// ─── Tab 4: API Keys ─────────────────────────────────────────────────────────
function ApiKeysTab() {
  const [keys, setKeys] = React.useState({
    amazonAccessKey: '',
    amazonSecretKey: '',
    amazonPartnerTag: '',
    neweggApiKey: '',
    cjApiKey: '',
    krogerClientId: '',
    krogerClientSecret: '',
    itadApiKey: '',
  });
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { apiKeys?: typeof keys } }>('/api/profile')
      .then(({ profile }) => {
        if (profile?.apiKeys) setKeys(k => ({ ...k, ...profile.apiKeys }));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await apiPatch('/api/profile', { apiKeys: keys });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof typeof keys, placeholder: string, hint: string, isSecret = false) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <input
          type={isSecret ? 'password' : 'text'}
          autoComplete="off"
          value={keys[key]}
          onChange={e => setKeys(k => ({ ...k, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      </div>
    );
  }

  if (!loaded) return <div className="animate-pulse h-40 rounded-xl bg-slate-200 dark:bg-slate-800" />;

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {/* Amazon PA API */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-orange-400">deployed_code</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Amazon Product Advertising API</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enables live Amazon pricing for RAM and GPU trackers. Requires an{' '}
            <a href="https://affiliate-program.amazon.com/assoc_credentials/home" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Amazon Associates account</a>{' '}
            and a PA API application. Keys are stored server-side and never sent to the browser.
          </p>
          {field('Access Key ID', 'amazonAccessKey', 'AKIAIOSFODNN7EXAMPLE', 'From the PA API credentials page')}
          {field('Secret Access Key', 'amazonSecretKey', '••••••••', 'Never share this — stored encrypted on the server', true)}
          {field('Partner / Associate Tag', 'amazonPartnerTag', 'yourtag-20', 'Your Associates store ID, e.g. mystore-20')}
        </div>
      </div>

      {/* Newegg API */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-orange-500">shopping_bag</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Newegg Affiliate API</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Newegg results are available without a key via their public search API. Setting an affiliate key
            here enables higher rate limits and affiliate commission on purchases.
          </p>
          {field('Newegg Affiliate Key', 'neweggApiKey', 'your-newegg-key', 'From the Newegg affiliate program dashboard')}
        </div>
      </div>

      {/* CJ Affiliate API */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-500">hub</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">CJ Affiliate API</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enables live product feeds from Home Depot, Lowe&apos;s, DICK&apos;s Sporting Goods, Zappos, Dick Blick, JOANN, and other CJ-affiliated retailers.
            Requires a <a href="https://developers.cj.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">CJ Affiliate personal access token</a>.
          </p>
          {field('CJ Personal Access Token', 'cjApiKey', 'your-cj-token', 'From your CJ developer account — stored encrypted', true)}
        </div>
      </div>

      {/* Kroger API */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-blue-700">local_grocery_store</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Kroger Product API</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Powers Grocery feed widgets (weekly deals, produce, pantry staples). Register at the{' '}
            <a href="https://developer.kroger.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Kroger Developer Portal</a> and create a public application.
          </p>
          {field('Client ID', 'krogerClientId', 'your-kroger-client-id', 'OAuth2 Client ID from the Kroger Developer Portal')}
          {field('Client Secret', 'krogerClientSecret', '••••••••', 'OAuth2 Client Secret — stored encrypted', true)}
        </div>
      </div>

      {/* IsThereAnyDeal API */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-purple-500">videogame_asset</span>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">IsThereAnyDeal API</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enables personalized game-deal alerts from ITAD. Without a key the Games feed uses r/GameDeals RSS only.
            Register at <a href="https://isthereanydeal.com/dev/app/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">isthereanydeal.com/dev</a>.
          </p>
          {field('ITAD API Key', 'itadApiKey', 'your-itad-api-key', 'From your IsThereAnyDeal developer account — stored encrypted', true)}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 border border-red-200 dark:border-red-800">
          <span className="material-symbols-outlined text-base">error</span>{error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {saving ? (
          <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> Saving…</>
        ) : saved ? (
          <><span className="material-symbols-outlined text-base">check_circle</span> Saved</>
        ) : (
          <><span className="material-symbols-outlined text-base">save</span> Save API Keys</>
        )}
      </button>
    </form>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState(0);
  const [feedConfig, setFeedConfig] = useState<FeedConfig>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<FeedConfig>('/api/feed-config')
      .then(data => setFeedConfig(data ?? {}))
      .catch(() => setLoadError('Could not load feed configuration. Is the backend running?'));
  }, []);

  function handleToggle(widgetId: string, srcName: string, enabled: boolean) {
    setFeedConfig(prev => {
      const widget = { ...(prev[widgetId] ?? { sources: [], custom: [] }) };
      widget.sources = (widget.sources ?? []).map(s => s.name === srcName ? { ...s, enabled } : s);
      return { ...prev, [widgetId]: widget };
    });
  }

  async function handleSave(widgetId: string) {
    setSaving(widgetId);
    try {
      await apiPatch(`/api/feed-config/${widgetId}`, {
        sources: feedConfig[widgetId]?.sources ?? [],
        custom: feedConfig[widgetId]?.custom ?? [],
      });
    } catch {
      // silent - user sees no feedback; could add toast here
    } finally {
      setSaving(null);
    }
  }

  function handleAddCustom(widgetId: string, rule: CustomRule) {
    setFeedConfig(prev => {
      const widget = { ...(prev[widgetId] ?? { sources: [], custom: [] }) };
      widget.custom = [...(widget.custom ?? []), rule];
      return { ...prev, [widgetId]: widget };
    });
    // Persist immediately
    const updated = {
      sources: feedConfig[widgetId]?.sources ?? [],
      custom: [...(feedConfig[widgetId]?.custom ?? []), rule],
    };
    apiPatch(`/api/feed-config/${widgetId}`, updated).catch(() => {});
  }

  function handleDeleteCustom(widgetId: string, ruleName: string) {
    setFeedConfig(prev => {
      const widget = { ...(prev[widgetId] ?? { sources: [], custom: [] }) };
      widget.custom = (widget.custom ?? []).filter(r => r.name !== ruleName);
      return { ...prev, [widgetId]: widget };
    });
    const updated = {
      sources: feedConfig[widgetId]?.sources ?? [],
      custom: (feedConfig[widgetId]?.custom ?? []).filter(r => r.name !== ruleName),
    };
    apiPatch(`/api/feed-config/${widgetId}`, updated).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#0c1117] font-[Space_Grotesk,system-ui,sans-serif] flex">
      <Sidebar active="settings" />

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader title="Settings" />

        <main className="flex-1 px-4 md:px-8 py-6 max-w-4xl w-full">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white dark:bg-slate-800 rounded-xl p-1 w-fit border border-slate-200 dark:border-slate-700">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === i ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {loadError && (
            <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              {loadError}
            </div>
          )}

          {tab === 0 && (
            <FeedSourcesTab
              config={feedConfig}
              saving={saving}
              onToggle={handleToggle}
              onSave={handleSave}
            />
          )}
          {tab === 1 && (
            <CustomSourcesTab
              config={feedConfig}
              onAdd={handleAddCustom}
              onDelete={handleDeleteCustom}
            />
          )}
          {tab === 2 && <AISettingsTab />}
          {tab === 3 && <PreferencesTab />}
          {tab === 4 && <ApiKeysTab />}
          {tab === 5 && <AccountsTab />}
        </main>
      </div>
    </div>
  );
}

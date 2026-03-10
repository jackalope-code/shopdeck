// src/components/Settings.tsx
// Three-tab settings page: Feed Sources, Custom Sources, AI Assistant
'use client';
import React, { useEffect, useState } from 'react';
import { Sidebar, TopHeader } from './ProjectsOverview';
import { apiGet, apiPatch, getToken } from '../lib/auth';
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
  'keyboard-sales':     'Keyboard Sales',
  'electronics-watchlist': 'Electronics Watchlist',
};

const TABS = ['Feed Sources', 'Custom Sources', 'AI Assistant', 'Preferences'];

const STORAGE_KEY_NOTIFS = 'sd-browser-alerts';

// ─── Tab 4: Preferences ─────────────────────────────────────────────────────────────
function PreferencesTab() {
  const [notifEnabled, setNotifEnabled] = React.useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_NOTIFS) === 'true'; } catch { return false; }
  });
  const [perm, setPerm] = React.useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  async function handleToggle() {
    if (perm === 'unsupported') return;
    if (!notifEnabled) {
      if (perm !== 'granted') {
        const result = await Notification.requestPermission();
        setPerm(result);
        if (result !== 'granted') return;
      }
      setNotifEnabled(true);
      localStorage.setItem(STORAGE_KEY_NOTIFS, 'true');
    } else {
      setNotifEnabled(false);
      localStorage.setItem(STORAGE_KEY_NOTIFS, 'false');
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
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
      const res = await fetch('http://localhost:4000/api/feed-config/test', {
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
const AI_PERMS_KEY = 'sd-ai-perms';

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

function loadAIPerms(): AIPermissions {
  try {
    const raw = localStorage.getItem(AI_PERMS_KEY);
    return raw ? { ...DEFAULT_AI_PERMS, ...JSON.parse(raw) } : DEFAULT_AI_PERMS;
  } catch { return DEFAULT_AI_PERMS; }
}

function saveAIPerms(p: AIPermissions) {
  localStorage.setItem(AI_PERMS_KEY, JSON.stringify(p));
}

// ─── Tab 3: AI Assistant settings ─────────────────────────────────────────────
function AISettingsTab({ onSaved }: { onSaved?: () => void }) {
  const [cfg, setCfg] = useState<AIConfig>({ provider: 'openai', model: 'gpt-4o', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [perms, setPerms] = useState<AIPermissions>(DEFAULT_AI_PERMS);

  useEffect(() => {
    setPerms(loadAIPerms());
    try {
      const raw = localStorage.getItem('sd-ai-config');
      if (raw) setCfg(JSON.parse(raw));
    } catch {}
    // Also try backend profile
    const token = getToken();
    if (token) {
      apiGet<{ aiConfig: AIConfig }>('/api/profile').then(data => {
        if (data?.aiConfig?.provider) setCfg(data.aiConfig);
      }).catch(() => {});
    }
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
                  saveAIPerms(next);
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
              onClick={() => { setPerms(DEFAULT_AI_PERMS); saveAIPerms(DEFAULT_AI_PERMS); }}
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
          {tab === 4 && <NotificationsSettingsTab />}
        </main>
      </div>
    </div>
  );
}

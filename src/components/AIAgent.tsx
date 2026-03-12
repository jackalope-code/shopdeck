// src/components/AIAgent.tsx
// Left-slide AI shopping assistant panel.
// Opens via: document.dispatchEvent(new CustomEvent('sd:open-ai'))
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { getToken, getUser, isDemoAccount, apiGet, apiPatch, apiPut, apiDelete, API_BASE } from '../lib/auth';
import GitHubConnect from './GitHubConnect';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
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

const CONTEXT_CHIPS = [
  { label: 'My Projects', value: 'List my active projects and their budgets.' },
  { label: 'Best GPU Deals', value: 'What are the best GPU deals right now?' },
  { label: 'RAM Prices', value: 'Summarize current RAM pricing trends.' },
  { label: 'Keyboard Recs', value: 'Recommend a keyboard based on my budget.' },
  { label: 'Price Alert', value: 'Help me set up a price alert for a component.' },
];

const STORAGE_KEY = 'sd-ai-config';
const HISTORY_KEY = 'sd-ai-history'; // localStorage mirror only

// ─── Permissions ─────────────────────────────────────────────────────────────
interface AIPermissions {
  projects:  boolean;
  inventory: boolean;
  watchlist: boolean;
  deals:     boolean;
}

const DEFAULT_PERMS: AIPermissions = { projects: false, inventory: false, watchlist: false, deals: false };

const PERM_DEFS: { key: keyof AIPermissions; label: string; desc: string; icon: string }[] = [
  { key: 'projects',  label: 'Projects',       desc: 'Budgets, build lists, status',      icon: 'workspaces' },
  { key: 'inventory', label: 'Inventory',       desc: 'Electronics parts & stock levels',  icon: 'inventory_2' },
  { key: 'watchlist', label: 'Price Alerts',    desc: 'Watchlists & alert thresholds',     icon: 'notifications_active' },
  { key: 'deals',     label: 'Active Deals',    desc: 'Current discounts & price history', icon: 'sell' },
];

function buildSystemContext(perms: AIPermissions): string {
  const granted = PERM_DEFS.filter(d => perms[d.key]).map(d => d.label);
  if (granted.length === 0) return '';
  return `[SYSTEM] The user has granted ShopDeck AI access to their: ${
    granted.join(', ')
  }. Use this context to give personalised recommendations. Do not ask for permission — it has already been granted.`;
}

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { provider: 'openai', model: 'gpt-4o', apiKey: '' };
  } catch {
    return { provider: 'openai', model: 'gpt-4o', apiKey: '' };
  }
}

function saveConfig(cfg: AIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Mirror last 50 messages to localStorage (offline / fast hydration)
function mirrorHistoryToLS(msgs: Message[]) {
  const trimmed = msgs.slice(-50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed)); } catch {}
}

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AIAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AIConfig>({ provider: 'openai', model: 'gpt-4o', apiKey: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [pendingCfg, setPendingCfg] = useState<AIConfig>(config);
  const [showPerms, setShowPerms] = useState(false);
  const [perms, setPerms] = useState<AIPermissions>(DEFAULT_PERMS);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [authUser, setAuthUser] = useState<ReturnType<typeof getUser>>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function togglePerm(key: keyof AIPermissions) {
    setPerms(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (getToken() && !isDemoAccount()) apiPatch('/api/profile', { aiPerms: next }).catch(() => {});
      return next;
    });
  }

  function copyMessage(content: string, idx: number) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  function copyAll() {
    const text = messages
      .map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    });
  }

  // Register global open trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('sd:open-ai', handler);
    return () => document.removeEventListener('sd:open-ai', handler);
  }, []);

  // Hydrate: config from localStorage, perms + history from API (fallback to LS)
  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    setPendingCfg(cfg);
    setIsDemo(isDemoAccount());
    setAuthUser(getUser());

    // Load localStorage mirror immediately for fast paint
    try {
      const lsMsgs = localStorage.getItem(HISTORY_KEY);
      if (lsMsgs) setMessages(JSON.parse(lsMsgs));
    } catch {}

    if (getToken()) {
      // Fetch authoritative history + perms from server
      apiGet<{ messages: Message[] }>('/api/ai-history')
        .then(data => { if (data?.messages?.length) setMessages(data.messages); })
        .catch(() => {});
      apiGet<{ profile: { aiPerms?: AIPermissions } }>('/api/profile')
        .then(data => { if (data?.profile?.aiPerms) setPerms({ ...DEFAULT_PERMS, ...data.profile.aiPerms }); })
        .catch(() => {});
    }
  }, []);

  // Persist history to API + localStorage mirror on change
  useEffect(() => {
    if (messages.length === 0) return;
    mirrorHistoryToLS(messages);
    if (getToken() && !isDemoAccount()) {
      const t = setTimeout(() => {
        apiPut('/api/ai-history', { messages }).catch(() => {});
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const providerInfo = PROVIDERS.find(p => p.id === config.provider) ?? PROVIDERS[0];

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput('');
    setError('');

    // Guard: require API key for non-Ollama, non-GitHub providers before hitting the network
    if (config.provider !== 'ollama' && config.provider !== 'github' && !config.apiKey) {
      setError(`No API key set for ${providerInfo.label}. Open Settings (⚙) above to add your key.`);
      return;
    }

    const userMsg: Message = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Prepend system context if any permissions are granted
    const sysCtx = buildSystemContext(perms);
    const apiMessages: Message[] = sysCtx
      ? [{ role: 'user', content: sysCtx }, { role: 'assistant', content: 'Understood. I will use your ShopDeck data to give personalised help.' }, ...nextMessages]
      : nextMessages;

    try {
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify({
            provider: config.provider,
            model: config.model,
            apiKey: config.apiKey,
            messages: apiMessages,
          }),
        });
      } catch {
        throw new Error('Cannot reach the ShopDeck backend. Make sure it is running on port 4000.');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function applySettings() {
    setConfig(pendingCfg);
    saveConfig(pendingCfg);
    setShowSettings(false);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-white dark:bg-[#101922] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 'min(420px, 92vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <h2 className="font-bold text-sm text-blue-500 dark:text-slate-100">AI Assistant</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">{providerInfo.label} · {config.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowPerms(v => !v); setShowSettings(false); }}
              className={`p-1.5 rounded-lg transition-colors ${showPerms ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100'}`}
              title="Data permissions"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
            </button>
            <button onClick={() => { setShowSettings(v => !v); setShowPerms(false); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            {messages.length > 0 && (
              <button
                onClick={copyAll}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                title="Copy conversation"
              >
                <span className="material-symbols-outlined text-[18px]">{copiedAll ? 'check' : 'content_copy'}</span>
              </button>
            )}
            <button
              onClick={() => {
                setMessages([]);
                mirrorHistoryToLS([]);
                if (getToken() && !isDemoAccount()) apiDelete('/api/ai-history').catch(() => {});
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
              title="Clear chat"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Demo mode notice */}
        {isDemo && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[14px] text-amber-500 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
              Demo mode — chat history &amp; settings aren&apos;t saved.{' '}
              <a href="/register" className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-200">Create an account</a> to persist.
            </p>
          </div>
        )}

        {/* Settings panel (inline) */}
        {showSettings && (
          <div className="border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50 shrink-0 space-y-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Provider settings</p>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPendingCfg(prev => ({ ...prev, provider: p.id, model: p.models[0].id }))}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors text-left ${pendingCfg.provider === p.id ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 hover:border-blue-500/50'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">Model</label>
              <select
                value={pendingCfg.model}
                onChange={e => setPendingCfg(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(PROVIDERS.find(p => p.id === pendingCfg.provider)?.models ?? []).map(m => (
                  <option key={m.id} value={m.id}>{m.id}  ·  {rateLabel(m.rate)}</option>
                ))}
              </select>
            </div>
            {pendingCfg.provider === 'github' ? (
              <GitHubConnect compact />
            ) : pendingCfg.provider !== 'ollama' ? (
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">API Key</label>
                <input
                  type="password"
                  value={pendingCfg.apiKey}
                  onChange={e => setPendingCfg(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-…"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Key is sent to your own backend proxy — never stored on ShopDeck servers.</p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">Uses your local Ollama instance at <code className="font-mono">http://localhost:11434</code>. No API key needed.</p>
            )}
            <button onClick={applySettings} className="w-full py-2 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors">
              Apply
            </button>
          </div>
        )}

        {/* Permissions panel (inline) */}
        {showPerms && (
          <div className="border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Data Access</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${Object.values(perms).some(Boolean) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {Object.values(perms).filter(Boolean).length} granted
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Allow the AI to reference your ShopDeck data for personalised recommendations. Your data never leaves your backend.
            </p>
            <div className="space-y-2">
              {PERM_DEFS.map(d => (
                <button
                  key={d.key}
                  onClick={() => togglePerm(d.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${perms[d.key] ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <span className={`material-symbols-outlined text-[18px] shrink-0 ${perms[d.key] ? 'text-emerald-500' : 'text-slate-400'}`} style={{ fontVariationSettings: perms[d.key] ? "'FILL' 1" : "'FILL' 0" }}>{d.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${perms[d.key] ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{d.label}</p>
                    <p className="text-[10px] text-slate-400 truncate">{d.desc}</p>
                  </div>
                  <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${perms[d.key] ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {perms[d.key] && <span className="material-symbols-outlined text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                  </div>
                </button>
              ))}
            </div>
            {Object.values(perms).some(Boolean) && (
              <button
                onClick={() => { setPerms(DEFAULT_PERMS); if (getToken() && !isDemoAccount()) apiPatch('/api/profile', { aiPerms: DEFAULT_PERMS }).catch(() => {}); }}
                className="w-full py-1.5 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Revoke all access
              </button>
            )}
          </div>
        )}

        {/* Context chips */}
        {messages.length === 0 && !showSettings && !showPerms && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <p className="text-xs text-slate-400 mb-2 font-medium">Quick prompts</p>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS.map(c => (
                <button
                  key={c.label}
                  onClick={() => sendMessage(c.value)}
                  className="px-2.5 py-1 text-xs rounded-full border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:text-blue-500 transition-colors"
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message thread */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 && !showSettings && !showPerms && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm mb-1">Ask me anything</p>
                <p className="text-xs text-slate-400 max-w-56">I can help with deals, component sourcing, project budgets, and price comparisons.</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`group flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {m.role === 'user'
                  ? (authUser?.username?.[0]?.toUpperCase() ?? 'U')
                  : <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                }
              </div>
              <div className="relative max-w-[85%] flex flex-col">
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-500 rounded-tr-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}
                  style={m.role === 'user' ? { color: '#ffffff' } : undefined}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
                <button
                  onClick={() => copyMessage(m.content, i)}
                  className={`self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 ${m.role === 'user' ? 'text-blue-200 hover:text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Copy message"
                >
                  <span className="material-symbols-outlined text-[13px]">{copiedIdx === i ? 'check' : 'content_copy'}</span>
                </button>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="size-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-slate-500" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="size-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined text-[16px] mt-px shrink-0">error</span>
                <span>{error}</span>
              </div>
              {error.includes('API key') && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="mt-2 w-full py-1.5 rounded-md bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 font-semibold hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                >
                  Open Settings to add key
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 shrink-0 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 items-end bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-blue-500/50 transition-colors px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about deals, prices, components…"
              rows={1}
              className="flex-1 bg-transparent resize-none text-sm outline-none placeholder:text-slate-400 max-h-32 leading-relaxed"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="size-7 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  );
}

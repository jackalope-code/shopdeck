// src/components/AIAgent.tsx
// Left-slide AI shopping assistant panel.
// Opens via: document.dispatchEvent(new CustomEvent('sd:open-ai'))
'use client';
import React, { useEffect, useRef, useState } from 'react';
import { getToken, getUser } from '../lib/auth';
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
const HISTORY_KEY = 'sd-ai-history';

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

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(msgs: Message[]) {
  // Keep last 50 messages to bound storage
  localStorage.setItem(HISTORY_KEY, JSON.stringify(msgs.slice(-50)));
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Register global open trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('sd:open-ai', handler);
    return () => document.removeEventListener('sd:open-ai', handler);
  }, []);

  // Hydrate from localStorage
  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    setPendingCfg(cfg);
    setMessages(loadHistory());
  }, []);

  // Persist history on change
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
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

    try {
      let res: Response;
      try {
        res = await fetch('http://localhost:4000/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify({
            provider: config.provider,
            model: config.model,
            apiKey: config.apiKey,
            messages: nextMessages,
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

  const user = getUser();

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
        className={`fixed top-0 left-0 h-full z-50 flex flex-col bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 'min(420px, 92vw)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <h2 className="font-bold text-sm">AI Assistant</h2>
              <p className="text-[10px] text-slate-400">{providerInfo.label} · {config.model}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowSettings(v => !v); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button
              onClick={() => { setMessages([]); localStorage.removeItem(HISTORY_KEY); }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear chat"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

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

        {/* Context chips */}
        {messages.length === 0 && !showSettings && (
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
          {messages.length === 0 && !showSettings && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm mb-1">Ask me anything</p>
                <p className="text-xs text-slate-400 max-w-56">I can help with deals, component sourcing, project budgets, and price comparisons.</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {m.role === 'user'
                  ? (user?.username?.[0]?.toUpperCase() ?? 'U')
                  : <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                }
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
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

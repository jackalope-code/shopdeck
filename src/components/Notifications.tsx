// src/components/Notifications.tsx
// Notification Center — Tracked Items + History
'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { getToken, apiGet, apiPut } from '../lib/auth';

// ─── Data model ───────────────────────────────────────────────────────────────

export type AlertSource = 'ram' | 'gpu' | 'keyboard' | 'electronics' | 'keycaps' | 'deals';
export type AlertHistoryType = 'price_drop' | 'restock' | 'deal' | 'gb_open' | 'project';

export type TrackedAlert = {
  id: string;
  source: AlertSource;
  itemId: string;
  name: string;
  vendor?: string;
  price?: number;
  threshold?: number;
  status?: string;
  createdAt: string;
};

export type AlertHistoryEntry = {
  id: string;
  alertId: string;
  name: string;
  type: AlertHistoryType;
  message: string;
  firedAt: string;
  read: boolean;
};

// ─── Source definitions ───────────────────────────────────────────────────────

const SOURCES: { id: AlertSource; label: string; icon: string; color: string; trackerHref: string }[] = [
  { id: 'ram',         label: 'RAM',         icon: 'memory',            color: 'text-blue-500',    trackerHref: '/ram-availability-tracker' },
  { id: 'gpu',         label: 'GPU',         icon: 'videogame_asset',   color: 'text-purple-500',  trackerHref: '/gpu-availability-tracker' },
  { id: 'keyboard',    label: 'Keyboards',   icon: 'compare',           color: 'text-emerald-500', trackerHref: '/keyboard-comparison' },
  { id: 'keycaps',     label: 'Keycaps',     icon: 'format_color_text', color: 'text-pink-500',    trackerHref: '/keycaps-tracker' },
  { id: 'electronics', label: 'Electronics', icon: 'inventory_2',       color: 'text-orange-500',  trackerHref: '/electronics' },
  { id: 'deals',       label: 'Deals',       icon: 'local_offer',       color: 'text-cyan-500',    trackerHref: '/active-deals' },
];

const HISTORY_TYPE_META: Record<AlertHistoryType, { label: string; icon: string; color: string }> = {
  price_drop: { label: 'Price drop',     icon: 'trending_down',  color: 'text-emerald-500' },
  restock:    { label: 'Back in stock',  icon: 'inventory_2',    color: 'text-blue-500' },
  deal:       { label: 'New deal',       icon: 'local_offer',    color: 'text-cyan-500' },
  gb_open:    { label: 'GB opens',       icon: 'new_releases',   color: 'text-purple-500' },
  project:    { label: 'Project update', icon: 'rocket_launch',  color: 'text-orange-500' },
};

// ─── Tracked Items tab ────────────────────────────────────────────────────────

function TrackedItemsTab({ items, onRemove }: { items: TrackedAlert[]; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {SOURCES.map(src => {
        const srcItems = items.filter(i => i.source === src.id);
        return (
          <div key={src.id} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${src.color}`}>{src.icon}</span>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{src.label}</h3>
                {srcItems.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {srcItems.length}
                  </span>
                )}
              </div>
              <Link href={src.trackerHref} className="text-xs font-semibold text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                Open tracker
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {srcItems.length === 0 ? (
              <div className="px-5 py-5 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                  <span className={`material-symbols-outlined text-[20px] ${src.color} opacity-30`}>{src.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No {src.label.toLowerCase()} alerts set</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hit the bell toggle on any item in the{' '}
                    <Link href={src.trackerHref} className="text-blue-500 hover:underline font-medium">
                      {src.label} tracker
                    </Link>{' '}
                    to track it here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {srcItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      item.status === 'IN STOCK'  ? 'bg-emerald-400' :
                      item.status === 'LOW STOCK' ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {item.vendor && <span className="text-[11px] text-slate-400">{item.vendor}</span>}
                        {item.price != null && (
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">${item.price.toFixed(2)}</span>
                        )}
                        {item.threshold != null && (
                          <span className="text-[11px] text-slate-400">alert at ≤ ${item.threshold.toFixed(2)}</span>
                        )}
                        {item.status && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.status === 'IN STOCK'  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                            item.status === 'LOW STOCK' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                            'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          }`}>{item.status}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      title="Remove alert"
                      className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ entries, onMarkRead }: { entries: AlertHistoryEntry[]; onMarkRead: (id: string) => void }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 flex flex-col items-center gap-3 text-center">
        <span className="material-symbols-outlined text-[48px] text-slate-200 dark:text-slate-700">inbox</span>
        <p className="text-sm font-semibold text-slate-400">No notification history yet</p>
        <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
          Past alerts — price drops, restocks, deals — will appear here automatically once ShopDeck starts monitoring your tracked items.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map(entry => {
            const meta = HISTORY_TYPE_META[entry.type];
            return (
              <div
                key={entry.id}
                onClick={() => !entry.read && onMarkRead(entry.id)}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  !entry.read
                    ? 'bg-blue-50/50 dark:bg-blue-500/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                  !entry.read ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800'
                }`}>
                  <span className={`material-symbols-outlined text-[18px] ${!entry.read ? meta.color : 'text-slate-400'}`}>{meta.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${!entry.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                      {entry.name}
                    </p>
                    {!entry.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{entry.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {meta.label} · {new Date(entry.firedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<'tracked' | 'history'>('history');
  const [tracked, setTracked]     = useState<TrackedAlert[]>([]);
  const [history, setHistory]     = useState<AlertHistoryEntry[]>([]);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ alerts: TrackedAlert[] }>('/api/alerts/tracked')
      .then(data => { if (data?.alerts) setTracked(data.alerts); })
      .catch(() => {});
    apiGet<{ entries: AlertHistoryEntry[] }>('/api/alerts/history')
      .then(data => { if (data?.entries) setHistory(data.entries); })
      .catch(() => {});
  }, []);

  function handleRemove(id: string) {
    const next = tracked.filter(t => t.id !== id);
    setTracked(next);
    if (getToken()) apiPut('/api/alerts/tracked', { alerts: next }).catch(() => {});
  }

  function handleMarkRead(id: string) {
    setHistory(prev => {
      const next = prev.map(e => e.id === id ? { ...e, read: true } : e);
      if (getToken()) apiPut('/api/alerts/history', { entries: next }).catch(() => {});
      return next;
    });
  }

  const unreadCount  = history.filter(e => !e.read).length;
  const totalTracked = tracked.length;

  return (
    <div className="min-h-screen bg-[#f5f7f8] dark:bg-[#0c1117] font-[Space_Grotesk,system-ui,sans-serif]">
      <TopNav />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
            <p className="text-sm text-slate-500 mt-1">Track items across trackers and review past alerts.</p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-blue-500 transition-colors mt-1"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span className="hidden sm:inline">Notification settings</span>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 w-fit">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'history' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            History
            {unreadCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-blue-500 text-white'
              }`}>{unreadCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tracked')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'tracked' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tracked Items
            {totalTracked > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'tracked' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>{totalTracked}</span>
            )}
          </button>
        </div>

        {activeTab === 'tracked' && (
          <TrackedItemsTab items={tracked} onRemove={handleRemove} />
        )}
        {activeTab === 'history' && (
          <HistoryTab entries={history} onMarkRead={handleMarkRead} />
        )}
      </main>
    </div>
  );
}

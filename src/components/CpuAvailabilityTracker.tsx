import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useFeedData, useFavorites } from '../lib/ShopdataContext';
import { getToken, apiGet, apiPatch } from '../lib/auth';
import HistoryAwareLink from './HistoryAwareLink';
import { getFeedStockStatus } from '../lib/stockStatus';

// ─── Types ────────────────────────────────────────────────────────────────────
type StockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK' | 'UNKNOWN';
type CpuBrand = 'AMD' | 'Intel';
type Filter = 'All' | CpuBrand;

interface CpuItem {
  id: string;
  name: string;
  vendor: string;
  brand: CpuBrand;
  status: StockStatus;
  price: number;
  wasPrice?: number;
  deal?: string;
  alertOn: boolean;
  image?: string;
  url?: string;
  trend: number[];
}

const STATUS_STYLE: Record<StockStatus, string> = {
  'IN STOCK':     'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  'LOW STOCK':    'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'OUT OF STOCK': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  'UNKNOWN':      'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ heights }: { heights: number[] }) {
  if (!heights.length) {
    return (
      <div className="flex items-center justify-center w-24 h-10 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
        <span className="text-[10px] font-bold text-slate-400 uppercase">No Data</span>
      </div>
    );
  }
  const max = Math.max(...heights, 1);
  return (
    <div className="w-24 h-10 flex items-end gap-0.5">
      {heights.map((h, i) => {
        const isRecent = i >= heights.length - 2;
        return (
          <div
            key={i}
            className={`w-2 rounded-t ${isRecent ? 'bg-blue-500' : 'bg-blue-500/25'}`}
            style={{ height: `${(h / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Alert toggle ─────────────────────────────────────────────────────────────
function AlertToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col items-end">
      <button
        onClick={onToggle}
        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${on ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span className="text-[9px] font-bold tracking-wider uppercase text-slate-400 mt-1">{on ? 'Alerts On' : 'Alerts Off'}</span>
    </div>
  );
}

// ─── Product image thumbnail ──────────────────────────────────────────────────
function ProductThumb({ src, icon, bg = 'bg-slate-100 dark:bg-slate-800', iconClass = 'text-slate-400' }: {
  src?: string; icon: string; bg?: string; iconClass?: string;
}) {
  const [err, setErr] = useState(false);
  return (
    <div className={`shrink-0 flex items-center justify-center size-12 rounded-xl overflow-hidden ${(!src || err) ? bg : 'bg-white/50 dark:bg-slate-800/50'}`}>
      {src && !err
        ? <img src={src} alt="" className="w-full h-full object-contain p-1" onError={() => setErr(true)} />
        : <span className={`material-symbols-outlined text-[20px] ${iconClass}`}>{icon}</span>
      }
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CpuAvailabilityTracker() {
  const [alertStates, setAlertStates] = useState<Record<string, boolean>>({});
  const { isFavorite, toggleFavorite } = useFavorites();
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { cpuAlertStates?: Record<string, boolean> } }>('/api/profile')
      .then(data => { if (data?.profile?.cpuAlertStates) setAlertStates(data.profile.cpuAlertStates); })
      .catch(() => {});
  }, []);

  const { loading, items: feedItems } = useFeedData('cpu-availability');

  const items: CpuItem[] = feedItems.map((item, idx) => {
    const price = parseFloat((item.price ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const nameLower = item.name.toLowerCase();
    const brand: CpuBrand =
      nameLower.includes('ryzen') || nameLower.includes('am5') || nameLower.includes('am4') || nameLower.includes('amd')
        ? 'AMD'
        : 'Intel';
    const id = `${item._vendor}-${idx}`;
    const normalizedStock = getFeedStockStatus(item);
    const cpuStatus: StockStatus =
      normalizedStock === 'out-of-stock' ? 'OUT OF STOCK' :
      (normalizedStock === 'low-stock' || normalizedStock === 'partial-stock') ? 'LOW STOCK' :
      normalizedStock === 'in-stock' ? 'IN STOCK' :
      'UNKNOWN';
    return {
      id,
      name: item.name,
      vendor: item._vendor ?? '',
      brand,
      status: cpuStatus,
      price,
      image: item.image,
      url: item.url,
      alertOn: alertStates[item.name] ?? false,
      trend: [],
    };
  });

  const toggleAlert = (name: string) => {
    setAlertStates(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (getToken()) apiPatch('/api/profile', { cpuAlertStates: next }).catch(() => {});
      return next;
    });
  };

  const displayed = items.filter(it => {
    const matchFilter = filter === 'All' || it.brand === filter;
    const matchSearch = !search || it.name.toLowerCase().includes(search.toLowerCase()) || it.vendor.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const trackedCount = items.length;
  const alertCount = items.filter(it => it.alertOn).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="CPU" />

      <div className="flex flex-col">
        {/* Header */}
        <header className="sticky top-14 z-20 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center px-4 py-3 gap-3 max-w-2xl mx-auto w-full">
            <Link href="/dashboard" className="flex size-10 items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors md:hidden">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <h1 className="text-lg font-bold flex-1 text-center md:text-left">CPU Availability</h1>
            <button
              onClick={() => setShowSearch(v => !v)}
              className="flex size-10 items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>
          {showSearch && (
            <div className="px-4 pb-3 max-w-2xl mx-auto w-full">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  autoFocus
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search CPUs..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
        </header>

        <main className="pb-24 md:pb-6">
          <div className="max-w-2xl mx-auto w-full">
            {/* Stat cards */}
            <div className="flex gap-4 p-4">
              <div className="flex flex-1 flex-col gap-1 rounded-xl p-5 bg-white dark:bg-blue-500/10 border border-slate-200 dark:border-blue-500/20 shadow-sm">
                <p className="text-slate-500 text-sm font-medium">Tracked SKUs</p>
                <p className="text-3xl font-bold">{trackedCount}</p>
              </div>
              <div className="flex flex-1 flex-col gap-1 rounded-xl p-5 bg-white dark:bg-blue-500/10 border border-slate-200 dark:border-blue-500/20 shadow-sm">
                <p className="text-slate-500 text-sm font-medium">In-Stock Alerts</p>
                <div className="flex items-center gap-2">
                  <p className="text-blue-500 text-3xl font-bold">{alertCount}</p>
                  <span className="material-symbols-outlined text-blue-500 text-xl">notifications_active</span>
                </div>
              </div>
            </div>

            {/* Filter chips */}
            <div className="flex gap-3 px-4 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {(['All', 'AMD', 'Intel'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${filter === f ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Live inventory */}
            <div className="mt-6 px-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                Live Inventory
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>

              <div className="flex flex-col gap-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : displayed.map(item => (
                  <div
                    key={item.id}
                    className={`relative bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm overflow-hidden ${item.status === 'OUT OF STOCK' ? 'opacity-75' : ''}`}
                  >
                    {item.deal && (
                      <div className="absolute top-0 right-0 bg-blue-500 px-3 py-1 rounded-bl-xl">
                        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{item.deal}</span>
                      </div>
                    )}

                    <div className={`flex items-start gap-3 mb-3 ${item.deal ? 'pr-16' : ''}`}>
                      <ProductThumb src={item.image} icon="memory_alt" bg="bg-blue-500/10" iconClass="text-blue-500" />
                      <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm leading-tight">
                            {item.url
                              ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'CPU' }} className="hover:underline hover:text-blue-500 transition-colors">{item.name}</HistoryAwareLink>
                              : item.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[item.status]}`}>{item.status}</span>
                            <span className="text-xs text-slate-500">
                              at{' '}
                              {item.url
                                ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'CPU' }} className="hover:underline hover:text-blue-500 transition-colors">{item.vendor}</HistoryAwareLink>
                                : item.vendor}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">{item.brand}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (!item.url) return;
                              toggleFavorite({
                                url: item.url,
                                name: item.name,
                                image: item.image,
                                price: String(item.price),
                                vendor: item.vendor,
                                category: 'CPU',
                              });
                            }}
                            disabled={!item.url}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${isFavorite(item.url) ? 'text-red-500 border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10' : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/40'} ${!item.url ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={isFavorite(item.url) ? 'Remove favorite' : 'Save favorite'}
                          >
                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isFavorite(item.url) ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                          </button>
                          <AlertToggle on={item.alertOn} onToggle={() => toggleAlert(item.name)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-2xl font-bold ${item.status === 'OUT OF STOCK' ? 'text-slate-400' : ''}`}>
                            ${item.price.toFixed(2)}
                          </p>
                          {item.wasPrice && <p className="text-sm text-slate-400 line-through">${item.wasPrice.toFixed(2)}</p>}
                        </div>
                      </div>
                      <Sparkline heights={item.trend} />
                    </div>
                  </div>
                ))}

                {!loading && displayed.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                    <p className="font-medium">No results{search ? ` for "${search}"` : ''}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] px-2 py-2">
        {[
          { href: '/dashboard',              label: 'Dashboard', icon: 'grid_view' },
          { href: '/active-deals',           label: 'Deals',     icon: 'sell' },
          { href: '/pc-building',            label: 'PC',        icon: 'computer' },
          { href: '/gpu-availability-tracker', label: 'GPU',     icon: 'videogame_asset' },
          { href: '/cpu-availability-tracker', label: 'CPU',     icon: 'memory_alt' },
        ].map(n => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-blue-500 transition-colors">
            <span className="material-symbols-outlined text-[22px]">{n.icon}</span>
            <span className="text-[10px] font-semibold">{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

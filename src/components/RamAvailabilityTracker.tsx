import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useFeedData, useFavorites } from '../lib/ShopdataContext';
import { getToken, apiGet, apiPatch } from '../lib/auth';
import HistoryAwareLink from './HistoryAwareLink';
import { getFeedStockStatus } from '../lib/stockStatus';

// ─── Types ────────────────────────────────────────────────────────────────────
type StockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK' | 'UNKNOWN';
type RamType = 'DDR5' | 'DDR4' | 'ECC' | 'SO-DIMM';

interface RamItem {
  id: string;
  name: string;
  vendor: string;
  type: RamType[];
  status: StockStatus;
  price: number;
  wasPrice?: number;
  deal?: string;
  note?: string;
  alertOn: boolean;
  image?: string;
  url?: string;
  trend: number[]; // 7 heights, 0-10
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_ITEMS: RamItem[] = [
  { id: '1', name: 'Samsung 32GB DDR5-5600 SO-DIMM', vendor: 'DigiKey', type: ['DDR5', 'SO-DIMM'], status: 'IN STOCK', price: 94.50, note: 'Lowest price in 30d', alertOn: true, trend: [4, 6, 5, 8, 3, 2, 1] },
  { id: '2', name: 'Crucial 16GB DDR5-4800', vendor: 'Mouser', type: ['DDR5'], status: 'LOW STOCK', price: 48.00, wasPrice: 54.00, deal: '-10% OFF', note: 'Deal ends in 4h', alertOn: true, trend: [8, 8, 7, 8, 6, 5, 4] },
  { id: '3', name: 'SK Hynix 64GB DDR5 ECC RDIMM', vendor: 'Arrow', type: ['DDR5', 'ECC'], status: 'OUT OF STOCK', price: 210.00, note: 'Last seen 2d ago', alertOn: false, trend: [] },
  { id: '4', name: 'Corsair Vengeance 32GB DDR4-3600', vendor: 'DigiKey', type: ['DDR4'], status: 'IN STOCK', price: 72.00, note: 'Back in stock', alertOn: true, trend: [5, 4, 6, 5, 7, 6, 8] },
  { id: '5', name: 'G.Skill Trident Z5 RGB 64GB DDR5-6000', vendor: 'Mouser', type: ['DDR5'], status: 'LOW STOCK', price: 189.99, wasPrice: 219.99, deal: '-13%', note: 'Only 3 left', alertOn: false, trend: [3, 5, 4, 6, 8, 7, 9] },
  { id: '6', name: 'Kingston ValueRAM 16GB DDR4 SO-DIMM', vendor: 'DigiKey', type: ['DDR4', 'SO-DIMM'], status: 'IN STOCK', price: 39.50, note: 'Price stable', alertOn: false, trend: [5, 5, 6, 5, 5, 6, 5] },
  { id: '7', name: 'Micron 16GB DDR5 ECC UDIMM', vendor: 'Arrow', type: ['DDR5', 'ECC'], status: 'OUT OF STOCK', price: 89.00, note: 'Last seen 1w ago', alertOn: true, trend: [] },
];

const STATUS_STYLE: Record<StockStatus, string> = {
  'IN STOCK': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  'LOW STOCK': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'OUT OF STOCK': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  'UNKNOWN': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

type Filter = 'All' | RamType;

// ─── Sparkline component ──────────────────────────────────────────────────────
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

// ─── Toggle switch ────────────────────────────────────────────────────────────
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
export default function RamAvailabilityTracker() {
  const [alertStates, setAlertStates] = useState<Record<string, boolean>>({});
  const { isFavorite, toggleFavorite } = useFavorites();
  const [filter, setFilter] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { ramAlertStates?: Record<string, boolean> } }>('/api/profile')
      .then(data => { if (data?.profile?.ramAlertStates) setAlertStates(data.profile.ramAlertStates); })
      .catch(() => {});
  }, []);

  const { loading, items: feedItems } = useFeedData('ram-availability');

  const items: RamItem[] = feedItems.map((item, idx) => {
    const price = parseFloat((item.price ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const nameLower = item.name.toLowerCase();
    const types: RamType[] = [];
    if (nameLower.includes('ddr5')) types.push('DDR5');
    else if (nameLower.includes('ddr4')) types.push('DDR4');
    else types.push('DDR5');
    if (nameLower.includes('so-dimm') || nameLower.includes('sodimm')) types.push('SO-DIMM');
    if (nameLower.includes('ecc')) types.push('ECC');
    const id = `${item._vendor}-${idx}`;
    const normalizedStock = getFeedStockStatus(item);
    const ramStatus: StockStatus =
      normalizedStock === 'out-of-stock' ? 'OUT OF STOCK' :
      (normalizedStock === 'low-stock' || normalizedStock === 'partial-stock') ? 'LOW STOCK' :
      normalizedStock === 'in-stock' ? 'IN STOCK' :
      'UNKNOWN';
    return {
      id,
      name: item.name,
      vendor: item._vendor ?? '',
      type: types,
      status: ramStatus,
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
      if (getToken()) apiPatch('/api/profile', { ramAlertStates: next }).catch(() => {});
      return next;
    });
  };

  const displayed = items.filter(it => {
    const matchFilter = filter === 'All' || it.type.includes(filter as RamType);
    const matchSearch = !search || it.name.toLowerCase().includes(search.toLowerCase()) || it.vendor.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const trackedCount = items.length;
  const alertCount = items.filter(it => it.alertOn).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="RAM" />

      <div className="flex flex-col">
        {/* Header */}
        <header className="sticky top-14 z-20 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center px-4 py-3 gap-3 max-w-2xl mx-auto w-full">
            <Link href="/dashboard" className="flex size-10 items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors md:hidden">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <h1 className="text-lg font-bold flex-1 text-center md:text-left">RAM Availability</h1>
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
                  placeholder="Search RAM modules..."
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
              {(['All', 'DDR5', 'DDR4', 'ECC', 'SO-DIMM'] as Filter[]).map(f => (
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
                    {/* Sale ribbon */}
                    {item.deal && (
                      <div className="absolute top-0 right-0 bg-blue-500 px-3 py-1 rounded-bl-xl">
                        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{item.deal}</span>
                      </div>
                    )}

                    {/* Top row */}
                    <div className={`flex items-start gap-3 mb-3 ${item.deal ? 'pr-16' : ''}`}>
                      <ProductThumb src={item.image} icon="memory" bg="bg-blue-500/10" iconClass="text-blue-500" />
                      <div className="flex-1 min-w-0 flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm leading-tight">
                            {item.url
                              ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'RAM' }} className="hover:underline hover:text-blue-500 transition-colors">{item.name}</HistoryAwareLink>
                              : item.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[item.status]}`}>{item.status}</span>
                            <span className="text-xs text-slate-500">
                              at{' '}
                              {item.url
                                ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'RAM' }} className="hover:underline hover:text-blue-500 transition-colors">{item.vendor}</HistoryAwareLink>
                                : item.vendor}
                            </span>
                            <div className="flex gap-1">
                              {item.type.map(t => (
                                <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">{t}</span>
                              ))}
                            </div>
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
                                category: 'RAM',
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

                    {/* Price + sparkline */}
                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-2xl font-bold ${item.status === 'OUT OF STOCK' ? 'text-slate-400' : ''}`}>
                            ${item.price.toFixed(2)}
                          </p>
                          {item.wasPrice && <p className="text-sm text-slate-400 line-through">${item.wasPrice.toFixed(2)}</p>}
                        </div>
                        {item.note && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[12px]">
                              {item.status === 'IN STOCK' ? 'trending_down' : item.note.includes('ends') ? 'timer' : 'info'}
                            </span>
                            {item.note}
                          </p>
                        )}
                      </div>
                      <Sparkline heights={item.trend} />
                    </div>
                  </div>
                ))}

                {!loading && displayed.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                    <p className="font-medium">No results for &quot;{search}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex max-w-md mx-auto h-16 items-center">
          <Link href="/dashboard" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
            <span className="material-symbols-outlined text-[22px]">home</span>
            <p className="text-[10px] font-medium uppercase tracking-wider">Home</p>
          </Link>
          <Link href="/ram-availability-tracker" className="flex flex-1 flex-col items-center justify-center gap-1 text-blue-500 relative">
            <div className="absolute -top-px w-8 h-1 bg-blue-500 rounded-b-full" />
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            <p className="text-[10px] font-bold uppercase tracking-wider">Tracker</p>
          </Link>
          <Link href="/active-deals" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors relative">
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wider">Alerts</p>
          </Link>
          <Link href="/electronics" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
            <span className="material-symbols-outlined text-[22px]">settings</span>
            <p className="text-[10px] font-medium uppercase tracking-wider">Settings</p>
          </Link>
        </div>
      </nav>
    </div>
  );
}

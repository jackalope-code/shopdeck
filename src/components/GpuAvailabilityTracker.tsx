import React, { useEffect, useState } from 'react';
import { TopNav } from './ProjectsOverview';
import { useFeedData, useFavorites } from '../lib/ShopdataContext';
import { getToken, apiGet, apiPatch } from '../lib/auth';
import HistoryAwareLink from './HistoryAwareLink';

// ─── Types ────────────────────────────────────────────────────────────────────
type StockStatus = 'IN STOCK' | 'LOW STOCK' | 'OUT OF STOCK';
type GpuSeries = 'RTX 40xx' | 'RTX 30xx' | 'RX 7000' | 'RX 6000';
type MemType = 'GDDR6X' | 'GDDR6' | 'GDDR5';

interface GpuItem {
  id: string;
  name: string;
  vendor: string;
  series: GpuSeries;
  vram: number;        // GB
  memType: MemType;
  status: StockStatus;
  price: number;
  wasPrice?: number;
  deal?: string;
  note?: string;
  alertOn: boolean;
  image?: string;
  url?: string;
  trend: number[];     // 7 heights, 0–10
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_ITEMS: GpuItem[] = [
  { id: '1', name: 'NVIDIA GeForce RTX 4090 24GB', vendor: 'Newegg', series: 'RTX 40xx', vram: 24, memType: 'GDDR6X', status: 'IN STOCK', price: 1599, note: 'Founders Edition', alertOn: true, trend: [6, 5, 7, 8, 6, 7, 9] },
  { id: '2', name: 'NVIDIA GeForce RTX 4080 Super 16GB', vendor: 'Amazon', series: 'RTX 40xx', vram: 16, memType: 'GDDR6X', status: 'IN STOCK', price: 999, wasPrice: 1099, deal: '-9%', note: 'Lowest in 60d', alertOn: true, trend: [8, 7, 8, 6, 5, 7, 8] },
  { id: '3', name: 'NVIDIA GeForce RTX 4070 Ti 12GB', vendor: 'TigerDirect', series: 'RTX 40xx', vram: 12, memType: 'GDDR6X', status: 'LOW STOCK', price: 749, note: 'Only 2 units left', alertOn: true, trend: [5, 6, 7, 8, 9, 7, 5] },
  { id: '4', name: 'NVIDIA GeForce RTX 3080 10GB', vendor: 'Newegg', series: 'RTX 30xx', vram: 10, memType: 'GDDR6X', status: 'IN STOCK', price: 449, wasPrice: 499, deal: '-10%', note: 'Refurb available', alertOn: false, trend: [3, 4, 5, 4, 3, 5, 4] },
  { id: '5', name: 'NVIDIA GeForce RTX 3070 8GB', vendor: 'Amazon', series: 'RTX 30xx', vram: 8, memType: 'GDDR6', status: 'OUT OF STOCK', price: 329, note: 'Last seen 5d ago', alertOn: false, trend: [] },
  { id: '6', name: 'AMD Radeon RX 7900 XTX 24GB', vendor: 'Newegg', series: 'RX 7000', vram: 24, memType: 'GDDR6', status: 'IN STOCK', price: 799, note: 'Price drop', alertOn: true, trend: [7, 8, 6, 7, 8, 9, 8] },
  { id: '7', name: 'AMD Radeon RX 7800 XT 16GB', vendor: 'Amazon', series: 'RX 7000', vram: 16, memType: 'GDDR6', status: 'LOW STOCK', price: 419, wasPrice: 449, deal: '-7%', note: 'Deal ends tonight', alertOn: true, trend: [5, 5, 6, 7, 8, 7, 6] },
  { id: '8', name: 'AMD Radeon RX 6700 XT 12GB', vendor: 'TigerDirect', series: 'RX 6000', vram: 12, memType: 'GDDR6', status: 'IN STOCK', price: 249, note: 'Price stable', alertOn: false, trend: [4, 4, 5, 4, 4, 5, 4] },
];

const STATUS_STYLE: Record<StockStatus, string> = {
  'IN STOCK':     'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  'LOW STOCK':    'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  'OUT OF STOCK': 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
};

type Filter = 'All' | GpuSeries;

// ─── Sparkline ─────────────────────────────────────────────────────────────────
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
            className={`w-2 rounded-t ${isRecent ? 'bg-green-500' : 'bg-green-500/25'}`}
            style={{ height: `${(h / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Alert toggle ──────────────────────────────────────────────────────────────
function AlertToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={on ? 'Disable alert' : 'Enable alert'}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${on ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500'}`}
    >
      <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0" }}>
        notifications
      </span>
      {on ? 'Alert On' : 'Alert Off'}
    </button>
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
// ─── Main component ─────────────────────────────────────────────────────────────
export default function GpuAvailabilityTracker() {
  const [alertStates, setAlertStates] = useState<Record<string, boolean>>({});
  const { isFavorite, toggleFavorite } = useFavorites();
  const [filter, setFilter] = useState<Filter>('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!getToken()) return;
    apiGet<{ profile: { gpuAlertStates?: Record<string, boolean> } }>('/api/profile')
      .then(data => { if (data?.profile?.gpuAlertStates) setAlertStates(data.profile.gpuAlertStates); })
      .catch(() => {});
  }, []);

  const { loading, items: feedItems } = useFeedData('gpu-availability');

  const items: GpuItem[] = feedItems.map((item, idx) => {
    const price = parseFloat((item.price ?? '0').replace(/[^0-9.]/g, '')) || 0;
    const nameLower = item.name.toLowerCase();
    const series: GpuSeries =
      nameLower.includes('rx 7') || nameLower.includes('rx7') ? 'RX 7000' :
      nameLower.includes('rx 6') || nameLower.includes('rx6') ? 'RX 6000' :
      nameLower.includes('rtx 30') || nameLower.includes('3080') || nameLower.includes('3070') ? 'RTX 30xx' :
      'RTX 40xx';
    const memType: MemType = nameLower.includes('gddr6x') ? 'GDDR6X' :
      nameLower.includes('gddr5') ? 'GDDR5' : 'GDDR6';
    const vramMatch = item.name.match(/(\d+)\s*gb/i);
    const vram = vramMatch ? parseInt(vramMatch[1]) : 8;
    const id = `${item._vendor}-${idx}`;
    const gpuStatus: StockStatus =
      item.anyAvailable === 'false' ? 'OUT OF STOCK' :
      (item.lowStock === 'true' || item.partialStock === 'true') ? 'LOW STOCK' :
      'IN STOCK';
    return {
      id,
      name: item.name,
      vendor: item._vendor ?? '',
      series,
      vram,
      memType,
      status: gpuStatus,
      price,
      image: item.image,
      url: item.url,
      alertOn: alertStates[item.name] ?? false,
      trend: [],
    };
  });

  const filters: Filter[] = ['All', 'RTX 40xx', 'RTX 30xx', 'RX 7000', 'RX 6000'];

  const toggleAlert = (name: string) => {
    setAlertStates(prev => {
      const next = { ...prev, [name]: !prev[name] };
      if (getToken()) apiPatch('/api/profile', { gpuAlertStates: next }).catch(() => {});
      return next;
    });
  };

  const displayed = items.filter(item => {
    const matchType = filter === 'All' || item.series === filter;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.vendor.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const inStock = items.filter(i => i.status === 'IN STOCK').length;
  const alerts  = items.filter(i => i.alertOn).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="GPU" />

      <div className="flex flex-col">
        {/* Sticky header */}
        <header className="sticky top-14 z-20 border-b border-slate-200 dark:border-slate-800 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md">
          <div className="flex items-center gap-4 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-green-500 text-2xl">videogame_asset</span>
              <h2 className="text-lg font-bold tracking-tight">GPU Availability Tracker</h2>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* Expandable search */}
              <div className={`flex items-center gap-2 transition-all duration-200 ${searchOpen ? 'w-64' : 'w-9'} overflow-hidden`}>
                {searchOpen && (
                  <input
                    autoFocus
                    className="flex-1 h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 border-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="Search GPUs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onBlur={() => { if (!search) setSearchOpen(false); }}
                  />
                )}
                <button
                  onClick={() => setSearchOpen(v => !v)}
                  className="shrink-0 flex items-center justify-center size-9 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">{searchOpen ? 'close' : 'search'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stat chips + filter row */}
          <div className="flex flex-wrap items-center gap-3 px-6 pb-3">
            {/* mini stats */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold">
              <span className="material-symbols-outlined text-[14px]">videogame_asset</span>
              {inStock} GPU{inStock !== 1 ? 's' : ''} In Stock
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
              <span className="material-symbols-outlined text-[14px]">notifications</span>
              {alerts} Alert{alerts !== 1 ? 's' : ''} Active
            </div>

            {/* separator */}
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Type filter chips */}
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-8 px-4 rounded-full text-xs font-bold transition-colors ${filter === f ? 'bg-green-500 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-green-500/50 text-slate-600 dark:text-slate-400'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {/* GPU list */}
        <main>
          {loading ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
              <p className="font-medium">{items.length === 0 ? 'No GPU data available right now.' : 'No GPUs found'}</p>
              {items.length > 0 && <p className="text-sm mt-1">Try a different filter or search term.</p>}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {displayed.map(item => (
                <div key={item.id} className="relative flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Deal ribbon */}
                  {item.deal && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r" />
                  )}

                  {/* Icon / image */}
                  <ProductThumb src={item.image} icon="videogame_asset" bg="bg-green-500/10" iconClass="text-green-500" />

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {item.url
                          ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'GPU' }} className="hover:underline hover:text-green-500 transition-colors">{item.name}</HistoryAwareLink>
                          : item.name}
                      </p>
                      {item.deal && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-black">{item.deal}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-500">
                        {item.url
                          ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: String(item.price), vendor: item.vendor, category: 'GPU' }} className="hover:underline hover:text-green-500 transition-colors">{item.vendor}</HistoryAwareLink>
                          : item.vendor}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">{item.series} · {item.vram}GB {item.memType}</span>
                      {item.note && <span className="text-[11px] text-slate-400">{item.note}</span>}
                    </div>
                  </div>

                  {/* Sparkline */}
                  <div className="hidden md:block shrink-0">
                    <Sparkline heights={item.trend} />
                  </div>

                  {/* Status badge */}
                  <span className={`shrink-0 hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-black ${STATUS_STYLE[item.status]}`}>
                    {item.status}
                  </span>

                  {/* Alert toggle */}
                  <div className="shrink-0 hidden md:flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!item.url) return;
                        toggleFavorite({
                          url: item.url,
                          name: item.name,
                          image: item.image,
                          price: String(item.price),
                          vendor: item.vendor,
                          category: 'GPU',
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

                  {/* Price */}
                  <div className="shrink-0 text-right min-w-18">
                    <p className="text-base font-bold">${item.price.toLocaleString()}</p>
                    {item.wasPrice && (
                      <p className="text-[10px] text-slate-400 line-through">${item.wasPrice.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

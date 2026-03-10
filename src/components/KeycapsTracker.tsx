import React, { useState, useEffect } from 'react';
import { TopNav } from './ProjectsOverview';
import { getToken } from '../lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
type KeycapStatus = 'in-stock' | 'group-buy' | 'limited' | 'ic' | 'sold-out';
type BrandFilter = 'All Sets' | 'GMK' | 'PBTFans' | 'KAT' | 'DCX' | 'Drop';

interface KeycapSet {
  id: string;
  name: string;
  brand: string;
  vendor: string;
  profile: string;
  price: number;
  wasPrice?: number;
  status: KeycapStatus;
  statusLabel: string;
  icon: string;
  gradient: string;
  image?: string;
  favorited?: boolean;
}

const STATUS_BADGE: Record<KeycapStatus, string> = {
  'in-stock': 'bg-emerald-500 text-white',
  'group-buy': 'bg-amber-500 text-white',
  'limited': 'bg-slate-800 text-white',
  'ic': 'bg-blue-500 text-white',
  'sold-out': 'bg-red-500 text-white',
};

const STATUS_TEXT: Record<KeycapStatus, string> = {
  'in-stock': 'text-emerald-500',
  'group-buy': 'text-amber-500',
  'limited': 'text-orange-500',
  'ic': 'text-blue-400',
  'sold-out': 'text-red-500',
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const SETS: KeycapSet[] = [
  { id: '1', name: 'GMK Redline', brand: 'GMK', vendor: 'Omnitype', profile: 'Cherry', price: 135, wasPrice: 150, status: 'in-stock', statusLabel: 'Available Now', icon: 'format_color_text', gradient: 'from-red-900 to-rose-600' },
  { id: '2', name: 'PBTFans BoW', brand: 'PBTFans', vendor: 'KBDfans', profile: 'Cherry', price: 99, status: 'group-buy', statusLabel: 'Ongoing', icon: 'palette', gradient: 'from-slate-900 to-slate-600' },
  { id: '3', name: 'GMK Mizu (Extras)', brand: 'GMK', vendor: 'Dixie Mech', profile: 'Cherry', price: 180, status: 'limited', statusLabel: 'Low Stock', icon: 'water_drop', gradient: 'from-blue-900 to-cyan-600' },
  { id: '4', name: 'GMK Oblivion', brand: 'Drop', vendor: 'Drop', profile: 'Cherry', price: 89, wasPrice: 110, status: 'in-stock', statusLabel: 'In Stock', icon: 'dark_mode', gradient: 'from-slate-700 to-slate-900' },
  { id: '5', name: 'KAT Refined', brand: 'KAT', vendor: 'Keycult', profile: 'KAT', price: 145, status: 'ic', statusLabel: 'Interest Check', icon: 'auto_awesome', gradient: 'from-purple-900 to-indigo-600' },
  { id: '6', name: 'DCX Marble', brand: 'DCX', vendor: 'Vala Supply', profile: 'DCX', price: 119, status: 'group-buy', statusLabel: 'Groupbuy', icon: 'circle', gradient: 'from-stone-800 to-stone-600' },
  { id: '7', name: 'GMK Botanical R2', brand: 'GMK', vendor: 'Keyboard Panda', profile: 'Cherry', price: 115, wasPrice: 140, status: 'limited', statusLabel: 'Low Stock', icon: 'eco', gradient: 'from-green-900 to-emerald-600' },
  { id: '8', name: 'PBTFans WoB', brand: 'PBTFans', vendor: 'KBDfans', profile: 'Cherry', price: 79, status: 'sold-out', statusLabel: 'Sold Out', icon: 'texture', gradient: 'from-neutral-900 to-zinc-700' },
];

const ALL_BRANDS: BrandFilter[] = ['All Sets', 'GMK', 'PBTFans', 'KAT', 'DCX', 'Drop'];

function KeycapCard({ set }: { set: KeycapSet }) {
  const [faved, setFaved] = useState(set.favorited || false);
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-sm h-full">
      {/* Image / banner */}
      <div className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div className={`absolute inset-0 bg-linear-to-br ${set.gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
          {set.image && !imgErr
            ? <img src={set.image} alt={set.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
            : <span className="material-symbols-outlined text-white/10 text-8xl">{set.icon}</span>
          }
        </div>
        {/* Status badge */}
        <div className={`absolute top-2 left-2 z-10 ${STATUS_BADGE[set.status]} text-[10px] font-black px-2 py-1 rounded-full uppercase`}>
          {set.status === 'in-stock' ? 'In Stock'
            : set.status === 'group-buy' ? 'Group Buy'
            : set.status === 'limited' ? `Limited`
            : set.status === 'ic' ? 'IC'
            : 'Sold Out'}
        </div>
        {/* Favorite button */}
        <button
          onClick={() => setFaved(f => !f)}
          className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${faved ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-blue-500'}`}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: faved ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{set.brand}</span>
          <span className={`text-[10px] font-medium ${STATUS_TEXT[set.status]}`}>{set.statusLabel}</span>
        </div>
        <div className="flex justify-between items-start">
          <h3 className="text-sm font-bold leading-tight group-hover:text-blue-500 transition-colors">{set.name}</h3>
          <div className="text-right shrink-0 ml-2">
            <p className="text-blue-500 font-bold text-sm">${set.price.toFixed(2)}</p>
            {set.wasPrice && <p className="text-[10px] text-slate-500 line-through">${set.wasPrice.toFixed(2)}</p>}
          </div>
        </div>
        <p className="text-xs text-slate-500">By {set.vendor} · {set.profile} Profile</p>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Details
        </button>
        {set.status === 'sold-out'
          ? <button className="py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-bold cursor-not-allowed opacity-60">Notify Me</button>
          : set.status === 'group-buy' || set.status === 'ic'
          ? <button className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all">{set.status === 'ic' ? 'Express Interest' : 'Join GB'}</button>
          : <button className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all">Buy Now</button>
        }
      </div>
    </div>
  );
}

export default function KeycapsTracker() {
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState<BrandFilter>('All Sets');
  const [page, setPage] = useState(1);
  const [liveSets, setLiveSets] = useState<KeycapSet[]>([]);

  // Fetch real keycap data (with actual product images) from scraped vendor sources
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/feed-config/data/keycap-releases', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((json: null | { sources: Record<string, { name: string; data: Array<{ name?: string; image?: string; price?: string; handle?: string }> }> }) => {
        if (!json?.sources) return;
        const live: KeycapSet[] = [];
        let idx = 100;
        for (const [, source] of Object.entries(json.sources)) {
          for (const item of source.data.slice(0, 8)) {
            if (!item.name) continue;
            live.push({
              id: `live-${idx++}`,
              name: item.name,
              brand: source.name,
              vendor: source.name,
              profile: 'Cherry',
              price: item.price ? parseFloat(item.price) : 0,
              status: 'in-stock',
              statusLabel: 'In Stock',
              icon: 'format_color_text',
              gradient: 'from-indigo-900 to-slate-700',
              image: item.image,
            });
          }
        }
        if (live.length > 0) setLiveSets(live);
      })
      .catch(() => {});
  }, []);

  const ALL_SETS = liveSets.length > 0 ? [...liveSets, ...SETS] : SETS;

  const filtered = ALL_SETS.filter(s => {
    const matchBrand = brand === 'All Sets' || s.brand === brand || s.vendor === brand;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.vendor.toLowerCase().includes(search.toLowerCase());
    return matchBrand && matchSearch;
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Keycaps" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#101922]/50 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1">
            <h2 className="text-lg font-bold tracking-tight shrink-0">Keycaps Intelligence</h2>
            <div className="max-w-md w-full relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                placeholder="Search by name, profile, or brand..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-5 mb-8">
            {[
              { label: 'Tracked Sets', value: '1,284', delta: '+12%', deltaColor: 'text-emerald-500', deltaIcon: 'trending_up' },
              { label: 'Active Group Buys', value: '24', delta: '-2%', deltaColor: 'text-rose-500', deltaIcon: 'trending_down' },
              { label: 'Avg. Set Price', value: '$142.50', delta: '+5%', deltaColor: 'text-emerald-500', deltaIcon: 'trending_up' },
              { label: 'Total Vendors', value: '12', delta: 'Stable', deltaColor: 'text-slate-400', deltaIcon: 'remove' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
                <p className="text-slate-500 text-sm font-medium">{s.label}</p>
                <div className="flex items-end justify-between mt-2">
                  <h3 className="text-2xl font-bold">{s.value}</h3>
                  <span className={`${s.deltaColor} text-sm font-bold flex items-center gap-0.5`}>
                    <span className="material-symbols-outlined text-sm">{s.deltaIcon}</span>{s.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {ALL_BRANDS.map(b => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-colors ${brand === b ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-500'}`}
              >
                {b}
              </button>
            ))}
            <button className="ml-auto flex items-center gap-2 text-sm font-medium text-slate-500 shrink-0 hover:text-blue-500 transition-colors">
              <span className="material-symbols-outlined text-lg">filter_list</span>Filter
            </button>
          </div>

          {/* Card grid */}
          {filtered.length > 0
            ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filtered.map(s => <KeycapCard key={s.id} set={s} />)}
              </div>
            )
            : (
              <div className="text-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="font-medium">No sets found</p>
                <p className="text-sm mt-1">Try a different brand filter or search term.</p>
              </div>
            )
          }

          {/* Pagination */}
          <div className="flex items-center justify-between py-8 mt-2">
            <p className="text-xs text-slate-500 font-medium">Showing {filtered.length} of 1,284 results</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40">Previous</button>
              <button onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20">Next</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

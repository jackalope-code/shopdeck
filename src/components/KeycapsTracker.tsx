import React, { useState } from 'react';
import { TopNav } from './ProjectsOverview';
import { useFeedData, VariantDetail } from '../lib/ShopdataContext';

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
  url?: string;
  favorited?: boolean;
  variants?: VariantDetail[];
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
  const [variantsOpen, setVariantsOpen] = useState(false);

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
        {set.url
          ? <a href={set.url} target="_blank" rel="noopener noreferrer" className="py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center">Details</a>
          : <button className="py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Details</button>
        }
        {set.status === 'sold-out'
          ? <button className="py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-bold cursor-not-allowed opacity-60">Notify Me</button>
          : set.status === 'group-buy' || set.status === 'ic'
          ? (set.url
              ? <a href={set.url} target="_blank" rel="noopener noreferrer" className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all text-center">{set.status === 'ic' ? 'Express Interest' : 'Join GB'}</a>
              : <button className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all">{set.status === 'ic' ? 'Express Interest' : 'Join GB'}</button>)
          : (set.url
              ? <a href={set.url} target="_blank" rel="noopener noreferrer" className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all text-center">Buy Now</a>
              : <button className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all">Buy Now</button>)
        }
      </div>

      {/* Variant breakdown */}
      {set.variants && set.variants.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setVariantsOpen(o => !o)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span>Variants ({set.variants.length})</span>
            <span className="material-symbols-outlined text-sm">{variantsOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          {variantsOpen && (
            <ul className="mt-1 space-y-1 px-1">
              {set.variants.map((v, i) => (
                <li key={i} className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${v.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="flex-1 truncate" title={v.title}>{v.title}</span>
                  {v.qty != null && <span className="shrink-0 text-slate-400">×{v.qty}</span>}
                  {v.price && <span className="shrink-0 text-slate-400">${parseFloat(v.price).toFixed(2)}</span>}
                  {v.source === 'text' && <span className="shrink-0 text-slate-400" title="Inferred from title">~</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

export default function KeycapsTracker() {
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('All Sets');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<KeycapStatus[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [profileFilter, setProfileFilter] = useState('All');
  const [keycapNotifsOpen, setKeycapNotifsOpen] = useState(false);

  const { loading, items: feedItems } = useFeedData('keycap-releases');

  const ALL_SETS: KeycapSet[] = feedItems.map((item, idx) => {
    const outOfStock = item.anyAvailable === 'false';
    const lowStock = item.lowStock === 'true';
    const partialStock = item.partialStock === 'true';
    const status: KeycapStatus = outOfStock ? 'sold-out' : ((lowStock || partialStock) ? 'limited' : 'in-stock');
    const statusLabel = outOfStock ? 'Sold Out' : ((lowStock || partialStock) ? 'Low Stock' : 'In Stock');
    return {
      id: `live-${idx}`,
      name: item.name,
      brand: item._vendor ?? '',
      vendor: item._vendor ?? '',
      profile: 'Cherry',
      price: item.price ? parseFloat(item.price) : 0,
      status,
      statusLabel,
      icon: 'format_color_text',
      gradient: 'from-indigo-900 to-slate-700',
      image: item.image,
      url: item.url,
      variants: item._variants,
    };
  });

  // Derived stats from live data
  const activeGroupBuys = ALL_SETS.filter(s => s.status === 'group-buy').length;
  const avgPrice = ALL_SETS.length > 0 ? ALL_SETS.reduce((sum, s) => sum + s.price, 0) / ALL_SETS.length : 0;
  const totalVendors = new Set(ALL_SETS.map(s => s.vendor).filter(Boolean)).size;

  // Build brand filter chips dynamically from live data
  const brandNames = Array.from(new Set(ALL_SETS.map(s => s.brand))).filter(Boolean);
  const allBrands = ['All Sets', ...brandNames];

  // Build profile chips
  const allProfiles = ['All', ...Array.from(new Set(ALL_SETS.map(s => s.profile).filter(Boolean)))];

  // Active filter count badge
  const activeFilterCount = statusFilters.length + (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (profileFilter !== 'All' ? 1 : 0);

  const toggleStatus = (s: KeycapStatus) =>
    setStatusFilters(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const filtered = ALL_SETS.filter(s => {
    const matchBrand = brand === 'All Sets' || s.brand === brand || s.vendor === brand;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.vendor.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilters.length === 0 || statusFilters.includes(s.status);
    const matchPriceMin = !priceMin || s.price >= parseFloat(priceMin);
    const matchPriceMax = !priceMax || s.price <= parseFloat(priceMax);
    const matchProfile = profileFilter === 'All' || s.profile === profileFilter;
    return matchBrand && matchSearch && matchStatus && matchPriceMin && matchPriceMax && matchProfile;
  });

  // Keycap-specific notifications
  const keycapNotifs = [
    { id: 1, icon: 'local_offer', color: 'text-emerald-500', bg: 'bg-emerald-500/10', title: 'GMK Redline back in stock', body: 'Price dropped to $135 at Omnitype', time: '2m ago' },
    { id: 2, icon: 'group', color: 'text-amber-500', bg: 'bg-amber-500/10', title: 'PBTFans BoW Group Buy live', body: 'Round 2 is now open at KBDfans', time: '18m ago' },
    { id: 3, icon: 'timer', color: 'text-blue-400', bg: 'bg-blue-400/10', title: 'KAT Refined IC closes soon', body: 'Only 3 days left to express interest', time: '1h ago' },
    { id: 4, icon: 'trending_down', color: 'text-rose-500', bg: 'bg-rose-500/10', title: 'GMK Mizu Extras price drop', body: 'Down from $210 to $180 at Dixie Mech', time: '3h ago' },
    { id: 5, icon: 'sell', color: 'text-purple-400', bg: 'bg-purple-400/10', title: 'DCX Marble shipped', body: 'Your order is on its way from Vala Supply', time: '1d ago' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Keycaps" />

      <div className="flex flex-col">
        {/* Header */}
        <header className="h-14 sticky top-14 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#101922]/50 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
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
            {/* Filters button */}
            <button
              onClick={() => setFilterOpen(o => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors shrink-0 ${filterOpen || activeFilterCount > 0 ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500'}`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white text-blue-500 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">{activeFilterCount}</span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {/* Keycap-specific notifications */}
            <button
              onClick={() => setKeycapNotifsOpen(o => !o)}
              className={`relative p-2 rounded-full transition-colors ${keycapNotifsOpen ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Keycap alerts"
            >
              <span className="material-symbols-outlined">keyboard</span>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            {/* General notifications */}
            <button className="relative p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <main className="p-8">
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-5 mb-8">
              {[
                { label: 'Tracked Sets', value: loading ? '—' : ALL_SETS.length.toLocaleString(), delta: '+12%', deltaColor: 'text-emerald-500', deltaIcon: 'trending_up' },
                { label: 'Active Group Buys', value: loading ? '—' : activeGroupBuys.toString(), delta: activeGroupBuys > 0 ? `${activeGroupBuys} active` : 'None', deltaColor: activeGroupBuys > 0 ? 'text-amber-500' : 'text-slate-400', deltaIcon: activeGroupBuys > 0 ? 'trending_up' : 'remove' },
                { label: 'Avg. Set Price', value: loading ? '—' : avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : 'N/A', delta: '+5%', deltaColor: 'text-emerald-500', deltaIcon: 'trending_up' },
                { label: 'Total Vendors', value: loading ? '—' : totalVendors.toString(), delta: 'Stable', deltaColor: 'text-slate-400', deltaIcon: 'remove' },
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

            {/* Brand filter bar */}
            <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {allBrands.map(b => (
                <button
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-colors ${brand === b ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-500'}`}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Card grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-slate-200 dark:bg-slate-800" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filtered.map(s => <KeycapCard key={s.id} set={s} />)}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="font-medium">{ALL_SETS.length === 0 ? 'No keycap sets available right now.' : 'No sets found'}</p>
                {ALL_SETS.length > 0 && <p className="text-sm mt-1">Try a different brand or filter.</p>}
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between py-8 mt-2">
              <p className="text-xs text-slate-500 font-medium">Showing {filtered.length} of {ALL_SETS.length.toLocaleString()} results</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40">Previous</button>
                <button onClick={() => setPage(p => p + 1)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20">Next</button>
              </div>
            </div>
          </main>

          {/* Filter sidebar */}
          {filterOpen && (
            <aside className="w-72 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">Filters</h3>
                <button
                  onClick={() => { setStatusFilters([]); setPriceMin(''); setPriceMax(''); setProfileFilter('All'); }}
                  className="text-xs text-blue-500 font-bold hover:underline"
                >Clear all</button>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Status</p>
                <div className="space-y-2">
                  {(['in-stock', 'group-buy', 'limited', 'ic', 'sold-out'] as KeycapStatus[]).map(s => (
                    <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilters.includes(s)}
                        onChange={() => toggleStatus(s)}
                        className="w-4 h-4 rounded accent-blue-500"
                      />
                      <span className={`text-sm font-medium ${STATUS_TEXT[s]}`}>
                        {s === 'in-stock' ? 'In Stock' : s === 'group-buy' ? 'Group Buy' : s === 'limited' ? 'Limited' : s === 'ic' ? 'Interest Check' : 'Sold Out'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Price Range</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <span className="text-slate-400 text-sm">–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* Profile */}
              {allProfiles.length > 1 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Profile</p>
                  <div className="flex flex-wrap gap-2">
                    {allProfiles.map(p => (
                      <button
                        key={p}
                        onClick={() => setProfileFilter(p)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${profileFilter === p ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 dark:border-slate-700 hover:border-blue-500'}`}
                      >{p}</button>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* Keycap notifications panel */}
          {keycapNotifsOpen && (
            <aside className="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">Keycap Alerts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Keycap-only notifications</p>
                </div>
                <button onClick={() => setKeycapNotifsOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <span className="material-symbols-outlined text-sm text-slate-400">close</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {keycapNotifs.map(n => (
                  <div key={n.id} className="flex gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <div className={`w-9 h-9 rounded-full ${n.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <span className={`material-symbols-outlined text-base ${n.color}`}>{n.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

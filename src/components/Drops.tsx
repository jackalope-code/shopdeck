'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useFeedData } from '../lib/ShopdataContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type DropStatus = 'group-buy' | 'in-stock' | 'ic' | 'sold-out' | 'sale';
type DropCategory = 'Keyboards' | 'Keycaps' | 'Switches' | 'Accessories';

interface Drop {
  id: string;
  name: string;
  vendor: string;
  category: DropCategory;
  status: DropStatus;
  stockStatus?: 'in' | 'partial' | 'low' | 'out';
  price: string;
  daysLeft?: number;
  discount?: number;
  hot?: boolean;
  image?: string;
  imageIcon: string;
  gradient: string;
  url?: string;
}

const STATUS_LABEL: Record<DropStatus, string> = {
  'group-buy': 'Group Buy',
  'in-stock': 'In Stock',
  'ic': 'Interest Check',
  'sold-out': 'Sold Out',
  'sale': 'Sale',
};

const STATUS_STYLE: Record<DropStatus, string> = {
  'group-buy': 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  'in-stock': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  'ic': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  'sold-out': 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  'sale': 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
};

const ALL_DROPS: Drop[] = [
  { id: '1', name: 'Zoom65 V3 SE', vendor: 'Meletrix', category: 'Keyboards', status: 'group-buy', price: '$169', daysLeft: 12, hot: true, imageIcon: 'keyboard', gradient: 'from-blue-900 to-slate-700' },
  { id: '2', name: 'Think6.5 V3', vendor: 'THINK Studio', category: 'Keyboards', status: 'in-stock', price: '$250', imageIcon: 'keyboard', gradient: 'from-slate-800 to-slate-600' },
  { id: '3', name: 'GMK WoB', vendor: 'GMK', category: 'Keycaps', status: 'group-buy', price: '$140', daysLeft: 8, hot: true, imageIcon: 'format_color_text', gradient: 'from-gray-900 to-gray-700' },
  { id: '4', name: 'PBT Sushi', vendor: 'Domikey', category: 'Keycaps', status: 'in-stock', price: '$55', imageIcon: 'format_color_text', gradient: 'from-teal-900 to-teal-700' },
  { id: '5', name: 'GMK Red Samurai', vendor: 'GMK', category: 'Keycaps', status: 'ic', price: 'TBD', imageIcon: 'format_color_text', gradient: 'from-red-900 to-red-700' },
  { id: '6', name: 'Hyper X Alloy Origins', vendor: 'HyperX', category: 'Keyboards', status: 'sale', price: '$109', discount: 20, imageIcon: 'keyboard', gradient: 'from-purple-900 to-slate-700' },
  { id: '7', name: 'Gateron Yellow Pro', vendor: 'Gateron', category: 'Switches', status: 'in-stock', price: '$18', imageIcon: 'tune', gradient: 'from-yellow-900 to-yellow-700' },
  { id: '8', name: 'Durock T1 Shrimp', vendor: 'Durock', category: 'Switches', status: 'group-buy', price: '$22', daysLeft: 20, imageIcon: 'tune', gradient: 'from-orange-900 to-orange-700' },
  { id: '9', name: 'KBDfans Tofu65', vendor: 'KBDfans', category: 'Keyboards', status: 'in-stock', price: '$88', imageIcon: 'keyboard', gradient: 'from-indigo-900 to-slate-700' },
];

const CATEGORIES: DropCategory[] = ['Keyboards', 'Keycaps', 'Switches', 'Accessories'];
const STATUSES: DropStatus[] = ['group-buy', 'in-stock', 'ic', 'sale', 'sold-out'];

// ─── Drop card ────────────────────────────────────────────────────────────────
function DropCard({ drop }: { drop: Drop }) {
  const [imgErr, setImgErr] = useState(false);
  const Wrapper = drop.url
    ? ({ children }: { children: React.ReactNode }) => (
        <a href={drop.url} target="_blank" rel="noopener noreferrer" className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-blue-500/40 hover:shadow-md transition-all group cursor-pointer">{children}</a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-blue-500/40 hover:shadow-md transition-all group">{children}</div>
      );
  return (
    <Wrapper>
      {/* Banner */}
      <div className={`h-28 bg-linear-to-br ${drop.gradient} flex items-center justify-center relative overflow-hidden`}>
        {drop.image && !imgErr
          ? <img src={drop.image} alt={drop.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={() => setImgErr(true)} />
          : <span className="material-symbols-outlined text-white/20 text-6xl">{drop.imageIcon}</span>
        }
        {drop.hot && (
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
            <span className="material-symbols-outlined text-[11px]">local_fire_department</span>Hot
          </span>
        )}
        {drop.discount && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10">
            -{drop.discount}%
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{drop.name}</p>
            <p className="text-[11px] text-slate-500">{drop.vendor}</p>
          </div>
          <p className="text-sm font-bold text-blue-500 shrink-0">{drop.price}</p>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[drop.status]}`}>
              {STATUS_LABEL[drop.status]}
            </span>
            {drop.stockStatus && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                drop.stockStatus === 'out'     ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' :
                drop.stockStatus === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
                drop.stockStatus === 'low'     ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' :
                                                 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              }`}>
                {drop.stockStatus === 'out' ? 'Out of Stock' : drop.stockStatus === 'partial' ? 'Partial Stock' : drop.stockStatus === 'low' ? 'Low Stock' : 'In Stock'}
              </span>
            )}
          </div>
          {drop.daysLeft !== undefined && (
            <span className="text-[11px] text-slate-400">{drop.daysLeft}d left</span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Drops() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<DropCategory | 'All'>('All');
  const [activeStatus, setActiveStatus] = useState<DropStatus | 'All'>('All');

  const { loading, items: feedItems } = useFeedData('drops');

  const CATEGORY_GRADIENTS: Record<DropCategory, string> = {
    Keyboards: 'from-slate-800 to-slate-700',
    Keycaps: 'from-indigo-900 to-slate-700',
    Switches: 'from-emerald-900 to-slate-700',
    Accessories: 'from-stone-800 to-slate-700',
  };
  const CATEGORY_ICONS: Record<DropCategory, string> = {
    Keyboards: 'keyboard',
    Keycaps: 'format_color_text',
    Switches: 'tune',
    Accessories: 'cable',
  };

  const liveItems: Drop[] = feedItems.map(item => {
    const srcCat = item._sourceCategory ?? '';
    const category: DropCategory =
      srcCat === 'Keycaps'     ? 'Keycaps' :
      srcCat === 'Switches'    ? 'Switches' :
      srcCat === 'Accessories' ? 'Accessories' :
      srcCat === 'Keyboards'   ? 'Keyboards' :
      // fallback: vendor-name heuristic
      (item._vendor ?? '').toLowerCase().includes('keycap') ? 'Keycaps' :
      (item._vendor ?? '').toLowerCase().includes('switch') ? 'Switches' :
      'Keyboards';
    const stockStatus =
      item.anyAvailable === 'false' ? 'out' :
      item.partialStock === 'true'  ? 'partial' :
      item.lowStock === 'true'      ? 'low' :
      item.anyAvailable === 'true'  ? 'in' :
      undefined;
    return {
      id: `live-${(item._vendor ?? '').toLowerCase().replace(/\s+/g, '-')}-${item.handle ?? item.name}`,
      name: item.name,
      vendor: item._vendor ?? '',
      category,
      stockStatus,
      status: 'in-stock',
      price: item.price ? `$${parseFloat(item.price).toFixed(0)}` : 'TBD',
      image: item.image,
      url: item.url,
      imageIcon: CATEGORY_ICONS[category],
      gradient: CATEGORY_GRADIENTS[category],
    };
  });

  const ALL_ITEMS = liveItems;

  const filtered = ALL_ITEMS.filter(d => {
    const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.vendor.toLowerCase().includes(search.toLowerCase());
    const matchesCat = activeCategory === 'All' || d.category === activeCategory;
    const matchesStatus = activeStatus === 'All' || d.status === activeStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const stats = [
    { label: 'Active Group Buys', value: ALL_ITEMS.filter(d => d.status === 'group-buy').length.toString(), icon: 'group', color: 'text-blue-500' },
    { label: 'In Stock Now', value: ALL_ITEMS.filter(d => d.status === 'in-stock').length.toString(), icon: 'check_circle', color: 'text-emerald-500' },
    { label: 'Interest Checks', value: ALL_ITEMS.filter(d => d.status === 'ic').length.toString(), icon: 'visibility', color: 'text-slate-400' },
    { label: 'On Sale', value: ALL_ITEMS.filter(d => d.status === 'sale').length.toString(), icon: 'sell', color: 'text-orange-500' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Drops" />

      <div className="flex flex-col">
        {/* Page header */}
        <header className="sticky top-14 z-20 border-b border-slate-200 dark:border-slate-800 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-500 text-2xl">new_releases</span>
            <h2 className="text-lg font-bold tracking-tight">New Releases &amp; Drops</h2>
          </div>
          <div className="max-w-xs w-full relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              placeholder="Search drops..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </header>

        <main className="p-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                  <p className="text-slate-500 text-xs font-medium">{s.label}</p>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-2 mb-6">
            {/* Row 1: Category + Status */}
            <div className="flex flex-wrap gap-3">
              {/* Category filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['All', ...CATEGORIES] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeCategory === c
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-500/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Status filters */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['All', ...STATUSES] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setActiveStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                      activeStatus === s
                        ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {s === 'All' ? 'All Statuses' : STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>


          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-pulse">
                  <div className="h-28 bg-slate-200 dark:bg-slate-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3">search_off</span>
              <p className="text-sm font-medium">{ALL_ITEMS.length === 0 ? 'No drops available right now. Check back soon.' : 'No drops match your filters'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map(drop => (
                <DropCard key={drop.id} drop={drop} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

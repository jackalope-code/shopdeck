import React, { useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useFeedData } from '../lib/ShopdataContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type DealCategory = 'Keyboards' | 'Electronics' | 'Audio' | 'Components';
type SortMode = 'discount' | 'price';

interface Deal {
  id: string;
  name: string;
  category: DealCategory;
  vendor: string;
  price: number;
  wasPrice: number;
  discount: number;
  timeLeft: string;
  timeUrgency: 'urgent' | 'moderate' | 'comfortable';
  stockNote?: string;
  watchers?: number;
  stockPct?: number;
  icon: string;
  gradient: string;
  discountIcon: string;
  image?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const DEALS: Deal[] = [
  { id: '1', name: 'Keychron Q1 Pro Wireless Custom Mechanical', category: 'Keyboards', vendor: 'Amazon', price: 119, wasPrice: 199, discount: 40, timeLeft: '2h left', timeUrgency: 'urgent', watchers: undefined, stockPct: undefined, icon: 'keyboard', gradient: 'from-blue-900 to-blue-600', discountIcon: 'bolt' },
  { id: '2', name: 'Sony WH-1000XM5 Noise Canceling Headphones', category: 'Audio', vendor: 'Newegg', price: 298, wasPrice: 399, discount: 25, timeLeft: 'Limited Stock', timeUrgency: 'urgent', watchers: 420, stockPct: undefined, icon: 'headphones', gradient: 'from-slate-900 to-slate-600', discountIcon: 'local_fire_department' },
  { id: '3', name: 'MacBook Air M2 13-inch (8GB RAM, 256GB SSD)', category: 'Electronics', vendor: 'B&H Photo', price: 849, wasPrice: 999, discount: 15, timeLeft: '2d left', timeUrgency: 'comfortable', watchers: undefined, stockPct: 75, icon: 'laptop_mac', gradient: 'from-slate-700 to-slate-500', discountIcon: 'trending_down' },
  { id: '4', name: 'Logitech G Pro X Superlight 2 Mouse', category: 'Electronics', vendor: 'Best Buy', price: 89, wasPrice: 160, discount: 44, timeLeft: '6h left', timeUrgency: 'urgent', watchers: 312, stockPct: undefined, icon: 'mouse', gradient: 'from-emerald-900 to-emerald-600', discountIcon: 'bolt' },
  { id: '5', name: 'Samsung 990 Pro 2TB NVMe SSD', category: 'Components', vendor: 'Amazon', price: 155, wasPrice: 219, discount: 29, timeLeft: '3d left', timeUrgency: 'comfortable', watchers: undefined, stockPct: 45, icon: 'storage', gradient: 'from-blue-800 to-indigo-600', discountIcon: 'trending_down' },
  { id: '6', name: 'GMK Botanical R2 Keycap Set', category: 'Keyboards', vendor: 'Keyboard Panda', price: 115, wasPrice: 140, discount: 18, timeLeft: '1d left', timeUrgency: 'moderate', watchers: 88, stockPct: undefined, icon: 'format_color_text', gradient: 'from-green-900 to-emerald-600', discountIcon: 'local_fire_department' },
  { id: '7', name: 'Beyerdynamic DT 990 Pro Studio Headphones', category: 'Audio', vendor: 'Adorama', price: 129, wasPrice: 169, discount: 24, timeLeft: '5d left', timeUrgency: 'comfortable', watchers: 210, stockPct: undefined, icon: 'headset', gradient: 'from-amber-900 to-orange-600', discountIcon: 'trending_down' },
];

const TIME_COLOR: Record<string, string> = {
  urgent: 'text-amber-500',
  moderate: 'text-red-500',
  comfortable: 'text-slate-500',
};

const TIME_ICON: Record<string, string> = {
  urgent: 'schedule',
  moderate: 'inventory_2',
  comfortable: 'history',
};

type FilterChip = 'All' | DealCategory;

// ─── Deal card ────────────────────────────────────────────────────────────────
function DealCard({ deal }: { deal: Deal }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:ring-1 hover:ring-blue-500/50 transition-all">
      {/* Image / gradient banner */}
      <div className="relative h-44 w-full overflow-hidden">
        <div className={`absolute inset-0 bg-linear-to-br ${deal.gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
          {deal.image && !imgErr
            ? <img src={deal.image} alt={deal.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
            : <span className="material-symbols-outlined text-white/20 text-8xl">{deal.icon}</span>
          }
        </div>
        {/* Discount badge */}
        <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
          <span className="material-symbols-outlined text-[14px]">{deal.discountIcon}</span>
          -{deal.discount}% OFF
        </div>
        {/* Vendor badge */}
        <div className="absolute bottom-3 left-3 bg-[#101922]/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700">
          <span className="text-[10px] font-black text-white tracking-wider">{deal.vendor.toUpperCase()}</span>
        </div>
      </div>

      <div className="p-4">
        {/* Category + urgency */}
        <div className="flex justify-between items-start mb-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">{deal.category}</span>
          <span className={`flex items-center gap-1 text-[10px] font-medium ${TIME_COLOR[deal.timeUrgency]}`}>
            <span className="material-symbols-outlined text-[12px]">{TIME_ICON[deal.timeUrgency]}</span>
            {deal.timeLeft}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-sm font-bold mb-2 line-clamp-1">{deal.name}</h3>

        {/* Price */}
        <div className="flex items-end gap-2 mb-3">
          <span className="text-xl font-bold">${deal.price.toLocaleString()}</span>
          <span className="text-sm text-slate-500 line-through mb-0.5">${deal.wasPrice.toLocaleString()}</span>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <div>
            {deal.watchers !== undefined && (
              <div className="flex items-center gap-1 text-slate-500">
                <span className="material-symbols-outlined text-[14px] text-blue-500">visibility</span>
                <span className="text-[10px] font-medium">{deal.watchers.toLocaleString()} watchers</span>
              </div>
            )}
            {deal.stockPct !== undefined && (
              <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${deal.stockPct}%` }} />
              </div>
            )}
          </div>
          <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors">
            View Deal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActiveDealsDashboard() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterChip>('All');
  const [sort, setSort] = useState<SortMode>('discount');

  const { loading, items: feedItems } = useFeedData('active-deals');

  const deals: Deal[] = feedItems
    .flatMap((item, idx) => {
      const price = parseFloat((item.price ?? '0').replace(/[^0-9.]/g, '')) || 0;
      const wasPrice = parseFloat((item.comparePrice ?? '0').replace(/[^0-9.]/g, '')) || 0;
      if (price <= 0) return [];
      const discount = wasPrice > price ? Math.round((1 - price / wasPrice) * 100) : 0;
      const type = item.productType?.toLowerCase() ?? '';
      const cat: DealCategory = type.includes('keycap') ? 'Keyboards' : type.includes('switch') ? 'Components' : 'Keyboards';
      return [{
        id: `${item._vendor}-${idx}`,
        name: item.name,
        category: cat,
        vendor: item._vendor ?? '',
        price,
        wasPrice: wasPrice || price,
        discount,
        timeLeft: 'Sale',
        timeUrgency: 'comfortable' as const,
        icon: 'keyboard',
        gradient: 'from-blue-900 to-blue-600',
        discountIcon: discount >= 20 ? 'local_fire_department' : 'trending_down',
        image: item.image,
      }];
    });

  const cats: FilterChip[] = ['All', 'Keyboards', 'Electronics', 'Audio', 'Components'];

  const displayed = deals
    .filter(d => {
      const matchCat = filter === 'All' || d.category === filter;
      const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.vendor.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    })
    .sort((a, b) => sort === 'discount' ? b.discount - a.discount : a.price - b.price);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Deals" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center px-4 py-3 justify-between max-w-2xl mx-auto w-full">
            <Link href="/dashboard" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors md:hidden">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <h2 className="text-lg font-bold flex-1 text-center md:text-left">Active Deals</h2>
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined">tune</span>
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pb-3 max-w-2xl mx-auto w-full">
            <div className="relative flex items-center w-full">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[18px]">search</span>
              <input
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Search product deals..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto max-w-2xl mx-auto w-full" style={{ scrollbarWidth: 'none' }}>
            {cats.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${filter === c ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Sort tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 gap-6 max-w-2xl mx-auto w-full">
            {(['discount', 'price'] as SortMode[]).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex items-center border-b-2 pb-3 pt-2 text-xs font-bold uppercase tracking-wider transition-colors ${sort === s ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                {s === 'discount' ? 'Highest Discount' : 'Price Low to High'}
              </button>
            ))}
          </div>
        </header>

        {/* Deals list */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-6 px-4 py-4">
          <div className="max-w-2xl mx-auto w-full space-y-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
                  <div className="h-44 bg-slate-200 dark:bg-slate-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : displayed.length > 0 ? (
              displayed.map(d => <DealCard key={d.id} deal={d} />)
            ) : (
              <div className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="font-medium">{deals.length === 0 ? 'No deals available right now.' : 'No deals found'}</p>
                {deals.length > 0 && <p className="text-sm mt-1">Try adjusting your filters or search term.</p>}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex w-full border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg px-2 pb-6 pt-2">
        <Link href="/active-deals" className="flex flex-1 flex-col items-center justify-center gap-1 text-blue-500">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>sell</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Deals</span>
        </Link>
        <Link href="/my-electronics" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">visibility</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Watchlist</span>
        </Link>
        <Link href="/dashboard" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Alerts</span>
        </Link>
        <Link href="/onboarding" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </Link>
      </nav>
    </div>
  );
}

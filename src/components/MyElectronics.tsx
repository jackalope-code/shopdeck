import React, { useState } from 'react';
import { TopNav } from './ProjectsOverview';
import { useFeedData, FeedItem } from '../lib/ShopdataContext';

// ─── Types ──────────────────────────────────────────────────────────────────────────
type PartStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

const STATUS_BADGE: Record<PartStatus, string> = {
  'in-stock':     'bg-emerald-500 text-white',
  'low-stock':    'bg-amber-500 text-white',
  'out-of-stock': 'bg-red-500 text-white',
};

const STATUS_TEXT: Record<PartStatus, string> = {
  'in-stock':     'text-emerald-500',
  'low-stock':    'text-amber-500',
  'out-of-stock': 'text-rose-500',
};

function itemStatus(item: FeedItem): PartStatus {
  if (item.anyAvailable === 'false') return 'out-of-stock';
  if (item.lowStock === 'true') return 'low-stock';
  return 'in-stock';
}

function statusLabel(item: FeedItem, status: PartStatus): string {
  if (status === 'out-of-stock') return 'Out of Stock';
  if (status === 'low-stock') {
    return item.availableCount ? `Low Stock: ${item.availableCount} left` : 'Low Stock';
  }
  if (item.totalInventory) return `${parseInt(item.totalInventory).toLocaleString()} units`;
  return 'Available Now';
}

function itemPrice(item: FeedItem): string | null {
  const raw = item.priceMin ?? item.price;
  if (!raw) return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 h-full animate-pulse">
      <div className="aspect-square rounded-xl bg-slate-200 dark:bg-slate-700 mb-4" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
      <div className="grid grid-cols-2 gap-2 mt-auto">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Card ───────────────────────────────────────────────────────────────────────────
function PartCard({ item }: { item: FeedItem }) {
  const status = itemStatus(item);
  const label  = statusLabel(item, status);
  const price  = itemPrice(item);
  const vendor = item._vendor ?? item._sourceCategory ?? '';

  return (
    <div className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-sm h-full">
      {/* Thumbnail */}
      <div className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <div className={`absolute top-2 left-2 z-10 ${STATUS_BADGE[status]} text-[10px] font-black px-2 py-1 rounded-full uppercase`}>
          {status === 'in-stock' ? 'In Stock' : status === 'low-stock' ? 'Low Stock' : 'Out of Stock'}
        </div>
        {item.image
          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          : <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700">developer_board</span>
        }
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between items-start gap-1">
          {vendor && <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider truncate">{vendor}</span>}
          <span className={`text-[10px] font-medium ml-auto shrink-0 ${STATUS_TEXT[status]}`}>{label}</span>
        </div>
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-bold leading-tight group-hover:text-blue-500 transition-colors line-clamp-2">{item.name}</h3>
          {price && <p className="text-blue-500 font-bold text-sm shrink-0">{price}</p>}
        </div>
        {item.productType && <p className="text-[10px] text-slate-500 truncate">{item.productType}</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Details</button>
        {status === 'out-of-stock'
          ? <button className="py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-bold cursor-not-allowed opacity-60">Notify Me</button>
          : <button
              className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all"
              onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
            >
              Buy Now
            </button>
        }
      </div>
    </div>
  );
}

// ─── Constants ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['All Categories', 'Microcontrollers', 'LED Modules', 'Sensors', 'Connectors', 'Passives', 'Development Boards'];
const VENDORS    = ['All Vendors', 'Adafruit', 'Mouser', 'Microcenter'];
const PER_PAGE   = 24;

// ─── Page ───────────────────────────────────────────────────────────────────────────
export default function MyElectronics() {
  const { loading, items: feedItems } = useFeedData('electronics-watchlist');
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('All Categories');
  const [vendor,   setVendor]   = useState('All Vendors');
  const [page,     setPage]     = useState(1);

  const filtered = feedItems.filter(item => {
    const vendorStr = (item._vendor ?? item._sourceCategory ?? '').toLowerCase();
    const typeStr   = (item.productType ?? '').toLowerCase();
    const nameStr   = (item.name ?? '').toLowerCase();
    const q         = search.toLowerCase();
    const matchSearch   = !search || nameStr.includes(q) || typeStr.includes(q) || vendorStr.includes(q);
    const matchVendor   = vendor   === 'All Vendors'    || vendorStr.includes(vendor.toLowerCase());
    const matchCategory = category === 'All Categories' || typeStr.includes(category.toLowerCase()) || nameStr.includes(category.toLowerCase());
    return matchSearch && matchVendor && matchCategory;
  });

  const totalParts     = feedItems.length;
  const lowStockCount  = feedItems.filter(i => i.lowStock === 'true').length;
  const outOfStockCount = feedItems.filter(i => i.anyAvailable === 'false').length;
  const pageCount      = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Electronics" />

      <div className="flex flex-col">
        <main className="p-8">
          {/* Page header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <span>Inventory</span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-blue-500 font-medium">Electronics Parts</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight uppercase">My Electronics Parts</h2>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all">
                <span className="material-symbols-outlined text-sm">add</span>Add New Part
              </button>
              <button className="p-2 border border-slate-200 dark:border-blue-500/20 rounded-lg hover:bg-slate-100 dark:hover:bg-blue-500/10 transition-colors">
                <span className="material-symbols-outlined">cloud_download</span>
              </button>
            </div>
          </header>

          {/* Stats row */}
          <section className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Total Parts</p>
                <h3 className="text-3xl font-bold">{loading ? '—' : totalParts.toLocaleString()}</h3>
                <p className="text-blue-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">live_tv</span>Live feed data
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined">inventory</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Low Stock</p>
                <h3 className="text-3xl font-bold text-amber-500">{loading ? '—' : lowStockCount}</h3>
                <p className="text-amber-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">priority_high</span>
                  {loading ? 'Loading...' : lowStockCount > 0 ? 'Critical attention needed' : 'All good'}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined">warning</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Out of Stock</p>
                <h3 className="text-3xl font-bold text-rose-500">{loading ? '—' : outOfStockCount}</h3>
                <p className="text-blue-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  {loading ? 'Loading...' : outOfStockCount > 0 ? `${outOfStockCount} items unavailable` : 'All in stock'}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined">payments</span>
              </div>
            </div>
          </section>

          {/* Table / card section */}
          <section className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 rounded-xl overflow-hidden">
            {/* Controls */}
            <div className="p-4 border-b border-slate-200 dark:border-blue-500/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                  <input
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-blue-500/5 border border-slate-200 dark:border-blue-500/20 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="Search components, categories, or vendors..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-slate-50 dark:bg-blue-500/5 border border-slate-200 dark:border-blue-500/20 rounded-lg text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                    value={category}
                    onChange={e => { setCategory(e.target.value); setPage(1); }}
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select
                    className="bg-slate-50 dark:bg-blue-500/5 border border-slate-200 dark:border-blue-500/20 rounded-lg text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                    value={vendor}
                    onChange={e => { setVendor(e.target.value); setPage(1); }}
                  >
                    {VENDORS.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-blue-500/20 hover:bg-slate-100 dark:hover:bg-blue-500/10 transition-colors">
                <span className="material-symbols-outlined text-sm">filter_list</span>More Filters
              </button>
            </div>

            {/* Card grid */}
            <div className="p-6">
              {loading
                ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                  </div>
                )
                : pageItems.length > 0
                  ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {pageItems.map((item, i) => <PartCard key={`${item.name}-${i}`} item={item} />)}
                    </div>
                  )
                  : (
                    <div className="text-center py-16 text-slate-400">
                      <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                      <p className="font-medium">No parts found</p>
                      <p className="text-sm mt-1">Adjust your filters or search term.</p>
                    </div>
                  )
              }
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-blue-500/10 flex items-center justify-between">
              <span className="text-xs text-slate-500">Showing {pageItems.length} of {filtered.length} entries</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-blue-500/10 disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${page === n ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-blue-500/10'}`}>{n}</button>
                ))}
                {pageCount > 5 && <span className="text-xs mx-1">...</span>}
                {pageCount > 5 && (
                  <button onClick={() => setPage(pageCount)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${page === pageCount ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-blue-500/10'}`}>{pageCount}</button>
                )}
                <button disabled={page === pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-blue-500/10 disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import HistoryAwareLink from './HistoryAwareLink';
import { TopNav } from './ProjectsOverview';
import { useViewHistory } from '../lib/ShopdataContext';

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RecentlyViewed() {
  const { viewHistory, loading, clearViewHistory } = useViewHistory();

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Recently Viewed" />
      <main className="max-w-6xl w-full mx-auto px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 mb-1"><Link href="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</Link> / Recently Viewed</p>
            <h1 className="text-4xl font-bold tracking-tight">Recently Viewed</h1>
            <p className="text-slate-500 mt-2">External product pages you opened from ShopDeck.</p>
          </div>
          <button onClick={clearViewHistory} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Clear History
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 bg-slate-200 dark:bg-slate-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : viewHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="material-symbols-outlined block text-5xl mb-3">history</span>
            <p className="font-medium">No recently viewed products yet.</p>
            <p className="text-sm mt-1">Open a product from a tracker page and it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {viewHistory.map((item) => (
              <HistoryAwareLink
                key={item.url}
                href={item.url}
                item={{
                  url: item.url,
                  name: item.name,
                  image: item.image,
                  price: item.price,
                  vendor: item.vendor,
                  category: item.category,
                }}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/40 hover:shadow-md transition-all"
              >
                <div className="h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    : <span className="material-symbols-outlined text-slate-400 text-5xl">open_in_new</span>}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm line-clamp-2 group-hover:text-blue-500 transition-colors">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{item.vendor ?? 'Unknown vendor'}</p>
                    </div>
                    {item.price && <p className="text-sm font-bold text-blue-500 shrink-0">{item.price.startsWith('$') ? item.price : `$${item.price}`}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <div className="flex items-center gap-2">
                      {item.category && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold uppercase">{item.category}</span>}
                      <span>{relativeTime(item.viewedAt)}</span>
                    </div>
                    <span>{item.viewCount}x</span>
                  </div>
                </div>
              </HistoryAwareLink>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
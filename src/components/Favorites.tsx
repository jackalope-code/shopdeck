import React from 'react';
import Link from 'next/link';
import HistoryAwareLink from './HistoryAwareLink';
import { TopNav } from './ProjectsOverview';
import { useFavorites } from '../lib/ShopdataContext';

export default function Favorites() {
  const { favorites, loading, clearFavorites, toggleFavorite } = useFavorites();

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Favorites" />
      <main className="max-w-6xl w-full mx-auto px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-sm text-slate-500 mb-1"><Link href="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</Link> / Favorites</p>
            <h1 className="text-4xl font-bold tracking-tight">Favorites</h1>
            <p className="text-slate-500 mt-2">Saved products from any tracker page.</p>
          </div>
          <button onClick={clearFavorites} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Clear Favorites
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
        ) : favorites.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="material-symbols-outlined block text-5xl mb-3">favorite</span>
            <p className="font-medium">No favorites yet.</p>
            <p className="text-sm mt-1">Tap the heart on any product card to save it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {favorites.map((item) => (
              <div
                key={item.url}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/40 hover:shadow-md transition-all"
              >
                <HistoryAwareLink
                  href={item.url}
                  item={{
                    url: item.url,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    vendor: item.vendor,
                    category: item.category,
                  }}
                  className="block"
                >
                  <div className="h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                    {item.image
                      ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <span className="material-symbols-outlined text-slate-400 text-5xl">open_in_new</span>}
                  </div>
                </HistoryAwareLink>
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
                    </div>
                    <button
                      onClick={() => toggleFavorite({
                        url: item.url,
                        name: item.name,
                        image: item.image,
                        price: item.price,
                        vendor: item.vendor,
                        category: item.category,
                      })}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Remove from favorites"
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

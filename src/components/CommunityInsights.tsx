import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useCommunityInsights } from '../lib/ShopdataContext';
import HistoryAwareLink from './HistoryAwareLink';

type InsightMetric = 'views' | 'favorites';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Categories', value: '' },
  { id: 'keyboards', label: 'Keyboards', value: 'keyboards' },
  { id: 'electronics', label: 'Electronics', value: 'electronics' },
];

const SUBCATEGORY_OPTIONS: Record<string, { id: string; label: string; value: string }[]> = {
  keyboards: [
    { id: 'all', label: 'All Keyboard Types', value: '' },
    { id: 'full', label: 'Full Keyboards', value: 'full' },
    { id: 'parts', label: 'Keyboard Parts', value: 'parts' },
    { id: 'switches', label: 'Switches', value: 'switches' },
    { id: 'accessories', label: 'Accessories', value: 'accessories' },
    { id: 'keycaps', label: 'Keycaps', value: 'keycaps' },
  ],
  electronics: [
    { id: 'all', label: 'All Electronics Types', value: '' },
    { id: 'ram', label: 'RAM', value: 'ram' },
    { id: 'gpu', label: 'GPU', value: 'gpu' },
    { id: 'microcontrollers', label: 'Microcontrollers', value: 'microcontrollers' },
    { id: 'passives', label: 'Passives', value: 'passives' },
    { id: 'sensors', label: 'Sensors', value: 'sensors' },
    { id: 'motors', label: 'Motors & Actuators', value: 'motors' },
    { id: 'ics', label: 'ICs & Breakouts', value: 'ics' },
    { id: 'encoders', label: 'Encoders & Pots', value: 'encoders' },
    { id: 'power', label: 'Power', value: 'power' },
    { id: 'connectors', label: 'Connectors', value: 'connectors' },
    { id: 'displays', label: 'Displays', value: 'displays' },
    { id: 'wireless', label: 'Wireless', value: 'wireless' },
    { id: 'audio', label: 'Audio', value: 'audio' },
  ],
};

function labelForTaxonomy(value?: string) {
  if (!value) return null;
  const labels: Record<string, string> = {
    keyboards: 'Keyboards',
    electronics: 'Electronics',
    full: 'Full Keyboards',
    parts: 'Keyboard Parts',
    switches: 'Switches',
    accessories: 'Accessories',
    keycaps: 'Keycaps',
    ram: 'RAM',
    gpu: 'GPU',
    microcontrollers: 'Microcontrollers',
    passives: 'Passives',
    sensors: 'Sensors',
    motors: 'Motors & Actuators',
    ics: 'ICs & Breakouts',
    encoders: 'Encoders & Pots',
    power: 'Power',
    connectors: 'Connectors',
    displays: 'Displays',
    wireless: 'Wireless',
    audio: 'Audio',
    general: 'General',
  };
  return labels[value] ?? value;
}

function relativeTime(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommunityInsights() {
  const [metric, setMetric] = useState<InsightMetric>('views');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');

  const activeSubcategories = useMemo(() => SUBCATEGORY_OPTIONS[category] ?? [{ id: 'all', label: 'All Types', value: '' }], [category]);

  const { loading, entries, error, refresh } = useCommunityInsights(metric, category || undefined, subcategory || undefined, 30);

  function onCategoryChange(next: string) {
    setCategory(next);
    setSubcategory('');
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Community Insights" />
      <main className="max-w-6xl w-full mx-auto px-8 py-8">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500 mb-1"><Link href="/dashboard" className="hover:text-blue-500 transition-colors">Dashboard</Link> / Community Insights</p>
              <h1 className="text-4xl font-bold tracking-tight">Community Insights</h1>
              <p className="text-slate-500 mt-2">Most viewed and most favorited products by unique users (Mouser excluded).</p>
            </div>
            <button onClick={refresh} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Refresh</button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setMetric('views')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${metric === 'views' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-500'}`}
              >Most Viewed</button>
              <button
                onClick={() => setMetric('favorites')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${metric === 'favorites' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-500'}`}
              >Most Favorited</button>
            </div>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Category</span>
              <select
                value={category}
                onChange={e => onCategoryChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Subcategory</span>
              <select
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                disabled={!category}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {activeSubcategories.map(opt => <option key={opt.id} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-40 bg-slate-200 dark:bg-slate-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-400 bg-white dark:bg-slate-900 border border-red-300/40 dark:border-red-500/30 rounded-2xl">
            <span className="material-symbols-outlined block text-5xl mb-3">error</span>
            <p className="font-medium">Could not load community insights.</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="material-symbols-outlined block text-5xl mb-3">insights</span>
            <p className="font-medium">No shared data yet for this filter.</p>
            <p className="text-sm mt-1">Try a broader category or check back after more activity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {entries.map((item, index) => (
              <HistoryAwareLink
                key={item.url}
                href={item.url || '#'}
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
                <div className="h-40 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                  {item.image
                    ? <img src={item.image} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    : <span className="material-symbols-outlined text-slate-400 text-5xl">trending_up</span>}
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-blue-500 text-white text-[10px] font-black">#{index + 1}</div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm line-clamp-2 group-hover:text-blue-500 transition-colors">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-1">{item.vendor ?? 'Unknown vendor'}</p>
                    </div>
                    {item.price && <p className="text-sm font-bold text-blue-500 shrink-0">{item.price.startsWith('$') ? item.price : `$${item.price}`}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {item.analyticsCategory && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase">{labelForTaxonomy(item.analyticsCategory)}</span>}
                    {item.analyticsSubcategory && <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase">{labelForTaxonomy(item.analyticsSubcategory)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>{item.uniqueUsers} unique users</span>
                    <span>{metric === 'views' ? `${item.totalEvents} views` : `${item.totalEvents} saves`}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Updated {relativeTime(item.lastSeenAt)}</p>
                </div>
              </HistoryAwareLink>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
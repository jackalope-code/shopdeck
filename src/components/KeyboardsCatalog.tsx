import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { TopNav } from './ProjectsOverview';
import { useFeedData, useFavorites, FeedItem } from '../lib/ShopdataContext';
import HistoryAwareLink from './HistoryAwareLink';

// ─── Types ────────────────────────────────────────────────────────────────────
type KeyboardSubkind = 'modular-kit' | 'diy-kit' | 'barebones' | 'prebuilt';

const SUBKIND_ORDER: KeyboardSubkind[] = ['modular-kit', 'diy-kit', 'barebones', 'prebuilt'];

function isKeyboardSubkind(value: string): value is KeyboardSubkind {
  return SUBKIND_ORDER.includes(value as KeyboardSubkind);
}

function normalizeSubkindToken(value: string): KeyboardSubkind | null {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;

  if (token === 'prebuilt' || token === 'pre-built') return 'prebuilt';
  if (token === 'barebones' || token === 'barebone') return 'barebones';
  if (token === 'modular-kit' || token === 'modular' || token === 'hotswap' || token === 'hot-swap') return 'modular-kit';
  if (token === 'diy-kit' || token === 'diy' || token === 'kit') return 'diy-kit';
  if (isKeyboardSubkind(token)) return token;
  return null;
}

function uniqueOrderedSubkinds(values: KeyboardSubkind[]): KeyboardSubkind[] {
  const unique = Array.from(new Set(values));
  return SUBKIND_ORDER.filter(kind => unique.includes(kind));
}

function getKeyboardSubkind(item: FeedItem): KeyboardSubkind | null {
  const explicit = normalizeSubkindToken(String((item as FeedItem & { keyboardSubkind?: string }).keyboardSubkind ?? ''));
  if (explicit) return explicit;

  const itype = normalizeSubkindToken(item.itemType ?? '');
  if (itype) return itype;

  const text = [item.name, item.productType, item.tags].filter(Boolean).join(' ').toLowerCase();
  if (/pre.?built|fully.?built|\bassembled\b|ready.?to.?type/.test(text)) return 'prebuilt';
  if (/\bbarebones?\b|case.?only/.test(text)) return 'barebones';
  if (/\bmodular\b|hot[\s-]?swap|swappable|interchangeable\s+module/.test(text)) return 'modular-kit';
  if (/\bdiy\b|solder(?:ing)?|unassembled|build\s+it\s+yourself|assembly\s+required/.test(text)) return 'diy-kit';
  if (/\bkit\b|keyboard kit/.test(text)) return 'diy-kit';

  const ptype = (item.productType ?? '').toLowerCase();
  if (/^keyboard/.test(ptype)) return 'diy-kit';

  return null;
}

const SUBKIND_LABEL: Record<KeyboardSubkind, string> = {
  'modular-kit': 'Modular Kit',
  'diy-kit': 'DIY Kit',
  barebones: 'Barebones',
  prebuilt: 'Pre-built',
};

function stockLabel(item: FeedItem): { text: string; color: string } {
  if (item.anyAvailable === 'false') return { text: 'Out of Stock', color: 'text-red-500' };
  if (item.lowStock === 'true') return { text: 'Low Stock', color: 'text-orange-500' };
  if (item.partialStock === 'true') return { text: 'Partial Stock', color: 'text-amber-500' };
  if (item.anyAvailable === 'true') return { text: 'In Stock', color: 'text-emerald-500' };
  return { text: 'Check Store', color: 'text-slate-400' };
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function KeyboardCard({ item }: { item: FeedItem & { _subkind: KeyboardSubkind | null } }) {
  const [imgErr, setImgErr] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(item.url);
  const stock = stockLabel(item);
  const price = item.priceMin ?? item.price;
  const priceMax = item.priceMax && item.priceMax !== item.priceMin ? item.priceMax : undefined;

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:ring-1 hover:ring-blue-500/50 transition-all">
      {/* Image */}
      <div className="relative h-40 w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {item.image && !imgErr ? (
          <img
            src={item.image}
            alt={item.name}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">keyboard</span>
        )}
        {item._subkind && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-900/70 text-white backdrop-blur-sm">
            {SUBKIND_LABEL[item._subkind]}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{item._vendor ?? 'Unknown Vendor'}</p>
          <p className="text-sm font-semibold leading-snug line-clamp-2">{item.name}</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {price && (
              <p className="text-base font-bold">
                ${price}{priceMax ? <span className="text-slate-400 font-normal text-sm"> – ${priceMax}</span> : ''}
              </p>
            )}
            <p className={`text-[10px] font-semibold ${stock.color}`}>{stock.text}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!item.url) return;
                toggleFavorite({ url: item.url, name: item.name, image: item.image, price: price ?? '', vendor: item._vendor });
              }}
              disabled={!item.url}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${favorited ? 'text-red-500 border-red-200 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10' : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:text-red-500 hover:border-red-200 dark:hover:border-red-500/40'} ${!item.url ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={favorited ? 'Remove favorite' : 'Save favorite'}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: favorited ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
            </button>
            {item.url ? (
              <HistoryAwareLink
                href={item.url}
                item={{ url: item.url, name: item.name, image: item.image, price: price ?? '', vendor: item._vendor, category: 'Keyboards' }}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors"
              >
                View
              </HistoryAwareLink>
            ) : (
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-400 text-xs font-bold py-2 px-4 rounded-lg">View</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KeyboardsCatalog() {
  const router = useRouter();
  const hydratedFromQueryRef = useRef(false);
  const { loading, sources } = useFeedData('keyboard-releases');
  const [selectedSubkinds, setSelectedSubkinds] = useState<KeyboardSubkind[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!router.isReady || hydratedFromQueryRef.current) return;

    const rawSubkinds = router.query.subkinds;
    const rawSubkind = router.query.subkind;
    const mergedQuery = [rawSubkinds, rawSubkind]
      .flatMap(value => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .join(',');

    const parsed = mergedQuery
      .split(',')
      .map(token => normalizeSubkindToken(token))
      .filter((value): value is KeyboardSubkind => value !== null);

    setSelectedSubkinds(uniqueOrderedSubkinds(parsed));
    hydratedFromQueryRef.current = true;
  }, [router.isReady, router.query.subkinds, router.query.subkind]);

  useEffect(() => {
    if (!router.isReady || !hydratedFromQueryRef.current) return;

    const normalizedSelection = uniqueOrderedSubkinds(selectedSubkinds);
    const currentQueryValue = [router.query.subkinds]
      .flatMap(value => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .join(',');

    const normalizedCurrent = uniqueOrderedSubkinds(
      currentQueryValue
        .split(',')
        .map(token => normalizeSubkindToken(token))
        .filter((value): value is KeyboardSubkind => value !== null)
    );

    if (normalizedCurrent.join(',') === normalizedSelection.join(',')) return;

    const nextQuery: Record<string, string | string[] | undefined> = { ...router.query };
    delete nextQuery.subkind;
    if (normalizedSelection.length > 0) {
      nextQuery.subkinds = normalizedSelection.join(',');
    } else {
      delete nextQuery.subkinds;
    }

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [selectedSubkinds, router]);

  // Flatten and annotate items from all sources
  const items = useMemo(() => {
    return Object.values(sources ?? {}).flatMap(src =>
      (src.data ?? []).map(item => ({
        ...item,
        _vendor: item._vendor ?? src.name,
        _subkind: getKeyboardSubkind(item),
      }))
    );
  }, [sources]);

  const availableSubkinds = useMemo(() => {
    const fromData = SUBKIND_ORDER.filter(kind => items.some(item => item._subkind === kind));
    return uniqueOrderedSubkinds([...fromData, ...selectedSubkinds]);
  }, [items, selectedSubkinds]);

  const selectedSubkindSet = useMemo(() => new Set(selectedSubkinds), [selectedSubkinds]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSubkind = selectedSubkindSet.size === 0 || (item._subkind ? selectedSubkindSet.has(item._subkind) : false);
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || (item._vendor ?? '').toLowerCase().includes(search.toLowerCase());
      return matchSubkind && matchSearch;
    });
  }, [items, selectedSubkindSet, search]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Keyboards" />

      <div className="flex flex-col">
        {/* Sticky header */}
        <header className="sticky top-14 z-20 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center px-4 py-3 justify-between max-w-5xl mx-auto w-full">
            <Link href="/dashboard" className="flex size-10 items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors md:hidden">
              <span className="material-symbols-outlined">arrow_back</span>
            </Link>
            <h2 className="text-lg font-bold flex-1 text-center md:text-left">Keyboards</h2>
          </div>

          {/* Search */}
          <div className="px-4 pb-3 max-w-5xl mx-auto w-full">
            <div className="relative flex items-center w-full">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[18px]">search</span>
              <input
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Search keyboards..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Subkind filter chips */}
          {availableSubkinds.length > 0 && (
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto max-w-5xl mx-auto w-full" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedSubkinds([])}
                className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${selectedSubkinds.length === 0 ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >
                All <span className="ml-1.5 opacity-70 text-xs">({items.length})</span>
              </button>

              {availableSubkinds.map(sk => {
                const count = items.filter(i => i._subkind === sk).length;
                const selected = selectedSubkindSet.has(sk);
                return (
                  <button
                    key={sk}
                    onClick={() => {
                      setSelectedSubkinds(prev => {
                        if (prev.includes(sk)) {
                          return prev.filter(kind => kind !== sk);
                        }
                        return uniqueOrderedSubkinds([...prev, sk]);
                      });
                    }}
                    className={`flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors ${selected ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {SUBKIND_LABEL[sk]} <span className="ml-1.5 opacity-70 text-xs">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Grid */}
        <main className="pb-24 md:pb-6 px-4 py-4">
          <div className="max-w-5xl mx-auto w-full">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
                    <div className="h-40 bg-slate-200 dark:bg-slate-800" />
                    <div className="p-3 space-y-2">
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((item, i) => (
                  <KeyboardCard key={item.url ?? `${item.name}-${i}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                <p className="font-medium">{items.length === 0 ? 'No keyboards available right now.' : 'No keyboards found'}</p>
                {items.length > 0 && <p className="text-sm mt-1">Try adjusting your filters or search term.</p>}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex w-full border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg px-2 pb-6 pt-2">
        <Link href="/keyboards" className="flex flex-1 flex-col items-center justify-center gap-1 text-blue-500">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>keyboard</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Keyboards</span>
        </Link>
        <Link href="/active-deals" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">sell</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Deals</span>
        </Link>
        <Link href="/dashboard" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">grid_view</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
        </Link>
        <Link href="/onboarding" className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-500 transition-colors">
          <span className="material-symbols-outlined text-[22px]">person</span>
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </Link>
      </nav>
    </div>
  );
}

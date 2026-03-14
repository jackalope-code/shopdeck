import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken } from './auth';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VariantDetail {
  title: string;
  available: boolean;
  price?: string;
  qty?: number;
  source: 'shopify' | 'text';
}

export interface FeedItem {
  name: string;
  image?: string;
  price?: string;
  comparePrice?: string;
  url?: string;
  handle?: string;
  productType?: string;
  tags?: string;
  _vendor?: string;
  _sourceCategory?: string;
  anyAvailable?: string;  // 'true' | 'false' — undefined means source has no stock data
  partialStock?: string;   // 'true' | 'false' — 25–50% of variants available
  lowStock?: string;       // 'true' | 'false' — <25% of variants available
  totalInventory?: string; // sum of tracked variant quantities
  variantCount?: string;   // total tracked variants
  availableCount?: string; // number of variants currently available
  priceMin?: string;       // lowest variant price
  priceMax?: string;       // highest variant price
  itemType?: string;       // 'Kit' | 'Pre-built' | 'Barebones' | 'PCB' | 'Plate' | 'Keycaps' | 'Switches' | 'Deskmat'
  _variants?: VariantDetail[]; // per-variant breakdown (shopify-tracked or text-classified)
}

export interface SourceResult {
  name: string;
  category?: string | null;
  data: FeedItem[];
  error: string | null;
}

export interface WidgetFeedState {
  loading: boolean;
  sources: Record<string, SourceResult>;
  error: string | null;
  fetchedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  modified: string;
  status: string;
  forSale: boolean;
  sourced: number;
  total: number;
  spent: number;
  budget?: number;
  targetPrice?: number;
  estProfit?: number;
  gradient: string;
  icon: string;
  image?: string;
}

export interface ActivityEntry {
  type: string;
  title: string;
  timestamp: string;
}

export interface ViewHistoryEntry {
  url: string;
  name: string;
  vendor?: string;
  image?: string;
  price?: string;
  category?: string;
  analyticsCategory?: string;
  analyticsSubcategory?: string;
  viewedAt: string;
  viewCount: number;
}

export interface FavoriteEntry {
  url: string;
  name: string;
  vendor?: string;
  image?: string;
  price?: string;
  category?: string;
  analyticsCategory?: string;
  analyticsSubcategory?: string;
  favoritedAt: string;
}

export interface CommunityInsightEntry {
  url: string;
  name: string;
  vendor?: string;
  image?: string;
  price?: string;
  category?: string;
  analyticsCategory?: string;
  analyticsSubcategory?: string;
  uniqueUsers: number;
  totalEvents: number;
  lastSeenAt: string;
}

interface CommunityInsightState {
  loading: boolean;
  entries: CommunityInsightEntry[];
  error: string | null;
  loaded: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_WIDGET: WidgetFeedState = { loading: true, sources: {}, error: null, fetchedAt: null };
const FAVORITES_STORAGE_KEY = 'sd:favorites';

export const FEED_WIDGET_IDS = [
  'drops',
  'keycap-releases',
  'keyboard-releases',
  'keyboard-sales',
  'keyboard-full-release',
  'keyboard-parts-release',
  'keyboard-switches',
  'keyboard-accessories',
  'ram-availability',
  'gpu-availability',
  'active-deals',
  'electronics-watchlist',
  'electronics-new-drops',
  'electronics-sales',
  'electronics-microcontrollers',
  'electronics-passives',
  'electronics-sensors',
  'electronics-motors',
  'electronics-ics',
  'electronics-encoders',
  'electronics-power',
  'electronics-connectors',
  'electronics-displays',
  'electronics-wireless',
  'electronics-audio',
] as const;

// ─── Context ──────────────────────────────────────────────────────────────────
interface ShopdataContextValue {
  getWidget: (widgetId: string) => WidgetFeedState;
  refresh: (widgetId: string) => void;
  refreshAll: () => void;
  communityInsights: Record<string, CommunityInsightState>;
  refreshCommunityInsights: (metric: 'views' | 'favorites', category?: string, subcategory?: string, limit?: number) => void;
  projects: Project[];
  projectsLoading: boolean;
  activity: ActivityEntry[];
  activityLoading: boolean;
  logActivity: (entry: Omit<ActivityEntry, 'timestamp'>) => void;
  viewHistory: ViewHistoryEntry[];
  viewHistoryLoading: boolean;
  logView: (entry: Omit<ViewHistoryEntry, 'viewedAt' | 'viewCount'>) => void;
  clearViewHistory: () => void;
  favorites: FavoriteEntry[];
  favoritesLoading: boolean;
  toggleFavorite: (entry: Omit<FavoriteEntry, 'favoritedAt'>) => void;
  clearFavorites: () => void;
  isFavorite: (url?: string) => boolean;
}

const ShopdataContext = createContext<ShopdataContextValue>({
  getWidget: () => EMPTY_WIDGET,
  refresh: () => {},
  refreshAll: () => {},
  communityInsights: {},
  refreshCommunityInsights: () => {},
  projects: [],
  projectsLoading: true,
  activity: [],
  activityLoading: true,
  logActivity: () => {},
  viewHistory: [],
  viewHistoryLoading: true,
  logView: () => {},
  clearViewHistory: () => {},
  favorites: [],
  favoritesLoading: true,
  toggleFavorite: () => {},
  clearFavorites: () => {},
  isFavorite: () => false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ShopdataProvider({ children }: { children: React.ReactNode }) {
  const [widgets, setWidgets] = useState<Record<string, WidgetFeedState>>(() =>
    Object.fromEntries(FEED_WIDGET_IDS.map(id => [id, { ...EMPTY_WIDGET }]))
  );
  const [communityInsights, setCommunityInsights] = useState<Record<string, CommunityInsightState>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [viewHistory, setViewHistory] = useState<ViewHistoryEntry[]>([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      setFavorites([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // ignore localStorage write failures
    }
  }, [favorites]);

  const getCommunityInsightKey = useCallback((metric: 'views' | 'favorites', category?: string, subcategory?: string, limit = 5) => (
    [metric, category || 'all', subcategory || 'all', String(limit)].join(':')
  ), []);

  const fetchWidget = useCallback(async (widgetId: string) => {
    const token = getToken();
    if (!token) {
      setWidgets(prev => ({
        ...prev,
        [widgetId]: { loading: false, sources: {}, error: null, fetchedAt: null },
      }));
      return;
    }
    setWidgets(prev => ({
      ...prev,
      [widgetId]: { ...(prev[widgetId] ?? EMPTY_WIDGET), loading: true },
    }));
    try {
      const res = await fetch(`/api/feed-config/data/${widgetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setWidgets(prev => ({
        ...prev,
        [widgetId]: {
          loading: false,
          sources: json.sources ?? {},
          error: null,
          fetchedAt: json.at ?? null,
        },
      }));
    } catch (err: unknown) {
      setWidgets(prev => ({
        ...prev,
        [widgetId]: {
          loading: false,
          sources: {},
          error: err instanceof Error ? err.message : String(err),
          fetchedAt: null,
        },
      }));
    }
  }, []);

  const refreshCommunityInsights = useCallback(async (metric: 'views' | 'favorites', category?: string, subcategory?: string, limit = 5) => {
    const token = getToken();
    const key = getCommunityInsightKey(metric, category, subcategory, limit);

    if (!token) {
      setCommunityInsights(prev => ({
        ...prev,
        [key]: { loading: false, entries: [], error: null, loaded: true },
      }));
      return;
    }

    setCommunityInsights(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { entries: [], error: null, loaded: false }), loading: true },
    }));

    try {
      const params = new URLSearchParams({ metric, limit: String(limit) });
      if (category) params.set('category', category);
      if (subcategory) params.set('subcategory', subcategory);
      const res = await fetch(`/api/community-insights?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCommunityInsights(prev => ({
        ...prev,
        [key]: { loading: false, entries: json.entries ?? [], error: null, loaded: true },
      }));
    } catch (err: unknown) {
      setCommunityInsights(prev => ({
        ...prev,
        [key]: {
          loading: false,
          entries: [],
          error: err instanceof Error ? err.message : String(err),
          loaded: true,
        },
      }));
    }
  }, [getCommunityInsightKey]);

  const fetchProjects = useCallback(async () => {
    const token = getToken();
    if (!token) { setProjectsLoading(false); return; }
    setProjectsLoading(true);
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setProjects(json.projects ?? []);
      }
    } catch { /* silently fail */ } finally {
      setProjectsLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    const token = getToken();
    if (!token) { setActivityLoading(false); return; }
    try {
      const res = await fetch('/api/activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setActivity(json.activity ?? []);
      }
    } catch { /* silently fail */ } finally {
      setActivityLoading(false);
    }
  }, []);

  const fetchViewHistory = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setViewHistory([]);
      setViewHistoryLoading(false);
      return;
    }
    setViewHistoryLoading(true);
    try {
      const res = await fetch('/api/view-history', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setViewHistory(json.entries ?? []);
      }
    } catch {
      setViewHistory([]);
    } finally {
      setViewHistoryLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setFavoritesLoading(false);
      return;
    }
    setFavoritesLoading(true);
    try {
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setFavorites(json.entries ?? []);
      }
    } catch {
      // keep local cache on network errors
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const logActivity = useCallback((entry: Omit<ActivityEntry, 'timestamp'>) => {
    const token = getToken();
    if (!token) return;
    const full: ActivityEntry = { ...entry, timestamp: new Date().toISOString() };
    setActivity(prev => [full, ...prev].slice(0, 50));
    fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }, []);

  const logView = useCallback((entry: Omit<ViewHistoryEntry, 'viewedAt' | 'viewCount'>) => {
    const token = getToken();
    if (!token || !entry.url || !entry.name) return;

    const full: ViewHistoryEntry = {
      ...entry,
      viewedAt: new Date().toISOString(),
      viewCount: 1,
    };

    setViewHistory(prev => {
      const existing = prev.find(item => item.url === entry.url);
      const rest = prev.filter(item => item.url !== entry.url);
      return [
        existing ? { ...existing, ...full, viewCount: existing.viewCount + 1 } : full,
        ...rest,
      ].slice(0, 100);
    });

    fetch('/api/view-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }, []);

  const clearViewHistory = useCallback(() => {
    const token = getToken();
    if (!token) return;
    setViewHistory([]);
    fetch('/api/view-history', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      fetchViewHistory();
    });
  }, [fetchViewHistory]);

  const toggleFavorite = useCallback((entry: Omit<FavoriteEntry, 'favoritedAt'>) => {
    const token = getToken();
    if (!entry.url || !entry.name) return;

    setFavorites(prev => {
      const exists = prev.some(item => item.url === entry.url);
      if (exists) {
        return prev.filter(item => item.url !== entry.url);
      }
      return [{ ...entry, favoritedAt: new Date().toISOString() }, ...prev].slice(0, 200);
    });

    if (!token) return;

    const exists = favorites.some(item => item.url === entry.url);
    if (exists) {
      fetch('/api/favorites/item', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: entry.url }),
      }).catch(() => {
        fetchFavorites();
      });
      return;
    }

    fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    }).catch(() => {
      fetchFavorites();
    });
  }, [favorites, fetchFavorites]);

  const clearFavorites = useCallback(() => {
    const token = getToken();
    setFavorites([]);
    if (!token) return;
    fetch('/api/favorites', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      fetchFavorites();
    });
  }, [fetchFavorites]);

  const isFavorite = useCallback((url?: string) => {
    if (!url) return false;
    return favorites.some(item => item.url === url);
  }, [favorites]);

  const fetchAll = useCallback(() => {
    fetchProjects();
    fetchActivity();
    fetchViewHistory();
    fetchFavorites();
    // Stagger widget fetches so the backend source-level cache can warm up
    FEED_WIDGET_IDS.forEach((id, i) => {
      setTimeout(() => fetchWidget(id), i * 250);
    });
  }, [fetchWidget, fetchProjects, fetchActivity, fetchViewHistory, fetchFavorites]);

  useEffect(() => {
    fetchAll();
    const handler = () => fetchAll();
    window.addEventListener('sd:login', handler);
    return () => window.removeEventListener('sd:login', handler);
  }, [fetchAll]);

  const getWidget = useCallback(
    (widgetId: string): WidgetFeedState => widgets[widgetId] ?? EMPTY_WIDGET,
    [widgets]
  );

  return (
    <ShopdataContext.Provider
      value={{
        getWidget,
        refresh: fetchWidget,
        refreshAll: fetchAll,
        communityInsights,
        refreshCommunityInsights,
        projects,
        projectsLoading,
        activity,
        activityLoading,
        logActivity,
        viewHistory,
        viewHistoryLoading,
        logView,
        clearViewHistory,
        favorites,
        favoritesLoading,
        toggleFavorite,
        clearFavorites,
        isFavorite,
      }}
    >
      {children}
    </ShopdataContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useFeedData(widgetId: string) {
  const ctx = useContext(ShopdataContext);
  const widget = ctx.getWidget(widgetId);
  const items: FeedItem[] = Object.entries(widget.sources).flatMap(([, src]) =>
    (src.data ?? []).map(item => ({ ...item, _vendor: src.name, _sourceCategory: src.category ?? undefined }))
  );
  return {
    loading: widget.loading,
    items,
    sources: widget.sources,
    error: widget.error,
    refresh: () => ctx.refresh(widgetId),
  };
}

export function useFeedRefresh() {
  const ctx = useContext(ShopdataContext);
  return ctx.refresh;
}

export function useProjects() {
  const { projects, projectsLoading } = useContext(ShopdataContext);
  return { projects, loading: projectsLoading };
}

export function useCommunityInsights(metric: 'views' | 'favorites', category?: string, subcategory?: string, limit = 5) {
  const ctx = useContext(ShopdataContext);
  const key = [metric, category || 'all', subcategory || 'all', String(limit)].join(':');
  const state = ctx.communityInsights[key] ?? { loading: false, entries: [], error: null, loaded: false };

  useEffect(() => {
    if (state.loaded || state.loading) return;
    ctx.refreshCommunityInsights(metric, category, subcategory, limit);
  }, [ctx, metric, category, subcategory, limit, state.loaded, state.loading]);

  return {
    loading: state.loading,
    entries: state.entries,
    error: state.error,
    refresh: () => ctx.refreshCommunityInsights(metric, category, subcategory, limit),
  };
}

export function useActivity() {
  const { activity, activityLoading, logActivity } = useContext(ShopdataContext);
  return { activity, loading: activityLoading, logActivity };
}

export function useViewHistory() {
  const { viewHistory, viewHistoryLoading, logView, clearViewHistory } = useContext(ShopdataContext);
  return { viewHistory, loading: viewHistoryLoading, logView, clearViewHistory };
}

export function useFavorites() {
  const { favorites, favoritesLoading, toggleFavorite, clearFavorites, isFavorite } = useContext(ShopdataContext);
  return { favorites, loading: favoritesLoading, toggleFavorite, clearFavorites, isFavorite };
}

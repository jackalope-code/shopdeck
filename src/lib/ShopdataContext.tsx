import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken } from './auth';

// ─── Types ────────────────────────────────────────────────────────────────────
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
  partialStock?: string;   // 'true' | 'false' — only set when inventory tracking is on
  lowStock?: string;       // 'true' | 'false' — only set when inventory tracking is on
  totalInventory?: string; // sum of tracked variant quantities (electronics sites)
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

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_WIDGET: WidgetFeedState = { loading: true, sources: {}, error: null, fetchedAt: null };

export const FEED_WIDGET_IDS = [
  'drops',
  'keycap-releases',
  'keyboard-releases',
  'keyboard-sales',
  'ram-availability',
  'gpu-availability',
  'active-deals',
  'electronics-watchlist',
] as const;

// ─── Context ──────────────────────────────────────────────────────────────────
interface ShopdataContextValue {
  getWidget: (widgetId: string) => WidgetFeedState;
  refresh: (widgetId: string) => void;
  refreshAll: () => void;
  projects: Project[];
  projectsLoading: boolean;
  activity: ActivityEntry[];
  activityLoading: boolean;
  logActivity: (entry: Omit<ActivityEntry, 'timestamp'>) => void;
}

const ShopdataContext = createContext<ShopdataContextValue>({
  getWidget: () => EMPTY_WIDGET,
  refresh: () => {},
  refreshAll: () => {},
  projects: [],
  projectsLoading: true,
  activity: [],
  activityLoading: true,
  logActivity: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ShopdataProvider({ children }: { children: React.ReactNode }) {
  const [widgets, setWidgets] = useState<Record<string, WidgetFeedState>>(() =>
    Object.fromEntries(FEED_WIDGET_IDS.map(id => [id, { ...EMPTY_WIDGET }]))
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

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

  const fetchAll = useCallback(() => {
    fetchProjects();
    fetchActivity();
    // Stagger widget fetches so the backend source-level cache can warm up
    FEED_WIDGET_IDS.forEach((id, i) => {
      setTimeout(() => fetchWidget(id), i * 250);
    });
  }, [fetchWidget, fetchProjects, fetchActivity]);

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
        projects,
        projectsLoading,
        activity,
        activityLoading,
        logActivity,
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

export function useProjects() {
  const { projects, projectsLoading } = useContext(ShopdataContext);
  return { projects, loading: projectsLoading };
}

export function useActivity() {
  const { activity, activityLoading, logActivity } = useContext(ShopdataContext);
  return { activity, loading: activityLoading, logActivity };
}

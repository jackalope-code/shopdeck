'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUser, getToken, clearToken, apiGet, apiPatch } from '../lib/auth';
import { useFeedData, useProjects, useActivity } from '../lib/ShopdataContext';

// ─── Widget registry ──────────────────────────────────────────────────────────
export interface WidgetDef {
  id: string;
  title: string;
  category: string;
  icon: string;
  color: string;
  description: string;
}

export const ALL_WIDGETS: WidgetDef[] = [
  { id: 'active-projects', title: 'Active Projects', category: 'Projects', icon: 'rocket_launch', color: 'text-blue-500', description: 'Track all in-progress builds and flips.' },
  { id: 'recent-activity', title: 'Recent Activity', category: 'Projects', icon: 'history', color: 'text-slate-400', description: 'Latest changes across all projects.' },
  { id: 'keyboard-releases', title: 'Keyboard New Releases', category: 'Keyboards', icon: 'keyboard', color: 'text-emerald-500', description: 'Latest keyboard launches and group buys.' },
  { id: 'keycaps-tracker', title: 'Keycaps Sales Tracker', category: 'Keyboards', icon: 'format_color_text', color: 'text-emerald-500', description: 'GMK, PBT and designer keycap set alerts.' },
  { id: 'keyboard-sales', title: 'Keyboard Sales', category: 'Keyboards', icon: 'sell', color: 'text-amber-500', description: 'Live keyboard discounts and clearance deals.' },
  { id: 'keyboard-comparison', title: 'Keyboard Comparison', category: 'Keyboards', icon: 'compare', color: 'text-emerald-400', description: 'Side-by-side keyboard spec comparison.' },
  { id: 'ram-availability', title: 'RAM Availability', category: 'Electronics', icon: 'memory', color: 'text-purple-500', description: 'DDR4/DDR5 stock level monitor.' },
  { id: 'gpu-availability', title: 'GPU Availability', category: 'Electronics', icon: 'videogame_asset', color: 'text-green-500', description: 'RTX/RX GPU stock level monitor across retailers.' },
  { id: 'active-deals', title: 'Active Deals', category: 'Electronics', icon: 'sell', color: 'text-orange-500', description: 'Live price drops and limited-time offers.' },
  { id: 'electronics-watchlist',       title: 'Electronics Watchlist',       category: 'Electronics', icon: 'devices',               color: 'text-blue-400',   description: 'DigiKey / Mouser tracked parts.' },
  { id: 'electronics-new-drops',       title: 'Electronics New Drops',       category: 'Electronics', icon: 'new_releases',          color: 'text-green-500',  description: 'Latest component and maker releases.' },
  { id: 'electronics-sales',           title: 'Electronics Sales',           category: 'Electronics', icon: 'sell',                  color: 'text-amber-500',  description: 'Discounted electronics and components.' },
  { id: 'electronics-microcontrollers',title: 'Microcontrollers',            category: 'Electronics', icon: 'developer_board',       color: 'text-blue-500',   description: 'MCU availability: Adafruit, Mouser, DigiKey.' },
  { id: 'electronics-passives',        title: 'Passives',                    category: 'Electronics', icon: 'electric_bolt',         color: 'text-slate-400',  description: 'Resistors, capacitors, and inductors in stock.' },
  { id: 'electronics-sensors',         title: 'Sensors',                     category: 'Electronics', icon: 'sensors',               color: 'text-purple-500', description: 'Temperature, motion, and environmental sensors.' },
  { id: 'electronics-motors',          title: 'Motors & Actuators',          category: 'Electronics', icon: 'settings_motion_mode',  color: 'text-orange-500', description: 'Steppers, servos, and DC motors.' },
  { id: 'electronics-ics',             title: 'ICs & Breakout Boards',       category: 'Electronics', icon: 'memory_alt',            color: 'text-cyan-500',   description: 'Op-amps, logic gates and breakout boards.' },
  { id: 'electronics-encoders',        title: 'Encoders & Potentiometers',   category: 'Electronics', icon: 'rotate_right',          color: 'text-pink-500',   description: 'Rotary encoders and potentiometers.' },
  { id: 'inventory-stats', title: 'Inventory Stats', category: 'Overview', icon: 'inventory_2', color: 'text-blue-500', description: 'High-level stock and project counts.' },
  { id: 'vendor-performance', title: 'Vendor Performance', category: 'Overview', icon: 'storefront', color: 'text-yellow-500', description: 'Fulfillment rates across top vendors.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="h-9 w-9 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Widget sub-components (each calls hooks at top level) ────────────────────
function ActiveProjectsWidget() {
  const { projects, loading } = useProjects();
  if (loading) return <SkeletonRows />;
  const active = projects.slice(0, 3);
  if (active.length === 0) return (
    <div className="p-6 text-center text-slate-400 text-sm">
      <span className="material-symbols-outlined block text-3xl mb-2">rocket_launch</span>
      No projects yet. <Link href="/projects" className="text-blue-500 hover:underline">Create one →</Link>
    </div>
  );
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {active.map(p => {
        const progress = p.total > 0 ? Math.round((p.sourced / p.total) * 100) : 0;
        const statusCls = p.forSale
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
        const dotCls = p.forSale ? 'bg-emerald-500' : 'bg-blue-500';
        const barCls = progress >= 70 ? 'bg-emerald-500' : progress >= 30 ? 'bg-blue-500' : 'bg-orange-500';
        return (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <div className="h-9 w-9 rounded flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/10">
              <span className="material-symbols-outlined text-[18px]">{p.icon || 'inventory_2'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{p.name}</p>
              <p className="text-[10px] text-slate-500">{p.status}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />{p.forSale ? 'For Sale' : 'In Stock'}
              </span>
              <div className="w-20 hidden md:block">
                <div className="flex justify-between text-[10px] font-bold mb-0.5">
                  <span>{progress}%</span>
                </div>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
                  <div className={`h-full ${barCls} rounded-full`} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="px-4 py-3">
        <Link href="/projects" className="text-xs font-bold text-blue-500 hover:underline">View all projects →</Link>
      </div>
    </div>
  );
}

function RecentActivityWidget() {
  const { activity, loading } = useActivity();
  if (loading) return (
    <div className="p-4 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="size-2 mt-1.5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
  if (activity.length === 0) return (
    <div className="p-6 text-center text-slate-400 text-sm">
      <span className="material-symbols-outlined block text-3xl mb-2">history</span>
      No activity yet. Actions you take will appear here.
    </div>
  );
  const TYPE_DOT: Record<string, string> = {
    create: 'bg-emerald-500 ring-emerald-500/20',
    update: 'bg-blue-500 ring-blue-500/20',
    delete: 'bg-red-500 ring-red-500/20',
    sale: 'bg-orange-500 ring-orange-500/20',
  };
  return (
    <div className="p-4 space-y-4">
      {activity.slice(0, 5).map((a, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className={`size-2 mt-1.5 rounded-full shrink-0 ring-4 ${TYPE_DOT[a.type] ?? 'bg-slate-400 ring-transparent'}`} />
          <div>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="text-[10px] text-slate-500">{relativeTime(a.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedListWidget({ widgetId, linkHref, linkLabel }: { widgetId: string; linkHref: string; linkLabel: string }) {
  const { loading, items, sources, error } = useFeedData(widgetId);
  if (loading) return <SkeletonRows />;
  const top = items.slice(0, 3);
  if (top.length === 0) {
    const sourceErrors = Object.values(sources)
      .filter(s => s.error)
      .map(s => s.error as string);
    const uniqueErrors = [...new Set(sourceErrors.map(e =>
      e.startsWith('Rate limit') ? 'Rate limit — scrape cooldown active' :
      e.startsWith('Access denied') ? 'Source blocked (403)' :
      e.startsWith('HTTP 4') ? e.slice(0, 30) :
      e.slice(0, 60)
    ))];
    return (
      <div className="px-4 py-6 text-center text-slate-400 text-sm">
        {error
          ? <p className="text-red-400 text-xs mb-1">{error}</p>
          : uniqueErrors.length > 0
            ? <>
                <p className="mb-1">Sources unavailable:</p>
                {uniqueErrors.slice(0, 2).map(e => (
                  <p key={e} className="text-[10px] text-slate-500 mb-0.5">{e}</p>
                ))}
              </>
            : <p>No data available yet.</p>
        }
        <div className="mt-2"><Link href={linkHref} className="text-xs font-bold text-blue-500 hover:underline">{linkLabel}</Link></div>
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {top.map((item, i) => {
        const clean = (s?: string) => parseFloat((s ?? '').replace(/[^0-9.]/g, '')) || 0;
        const currentPrice = clean(item.price);
        const price = currentPrice > 0 ? `$${currentPrice.toFixed(0)}` : '—';
        const comparePrice = clean(item.comparePrice);
        const discount = comparePrice > currentPrice && comparePrice > 0
          ? Math.round((1 - currentPrice / comparePrice) * 100)
          : 0;
        return (
          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <div>
              <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
              <p className="text-[10px] text-slate-500">{item._vendor}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {discount > 0 && (
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold">-{discount}%</span>
              )}
              <span className="text-sm font-bold text-blue-500">{price}</span>
            </div>
          </div>
        );
      })}
      <div className="px-4 py-3">
        <Link href={linkHref} className="text-xs font-bold text-blue-500 hover:underline">{linkLabel}</Link>
      </div>
    </div>
  );
}

function KeyboardReleasesWidget() {
  const { loading, items, sources, error } = useFeedData('keyboard-releases');
  if (loading) return <SkeletonRows />;
  const top = items.slice(0, 5);
  if (top.length === 0) {
    const errs = [...new Set(Object.values(sources).filter(s => s.error).map(s =>
      (s.error as string).startsWith('Rate limit') ? 'Scrape cooldown active' :
      (s.error as string).startsWith('Access denied') ? 'Source blocked (403)' :
      (s.error as string).slice(0, 50)
    ))];
    return (
      <div className="px-4 py-6 text-center text-slate-400 text-sm">
        {error ? <p className="text-red-400 text-xs mb-1">{error}</p>
          : errs.length > 0
            ? <><p className="mb-1">Sources unavailable:</p>{errs.slice(0,2).map(e => <p key={e} className="text-[10px] text-slate-500 mb-0.5">{e}</p>)}</>
            : <p>No keyboard data yet.</p>}
        <div className="mt-2"><Link href="/drops" className="text-xs font-bold text-blue-500 hover:underline">Browse all drops →</Link></div>
      </div>
    );
  }
  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {top.map((item, i) => {
        const clean = (s?: string) => parseFloat((s ?? '').replace(/[^0-9.]/g, '')) || 0;
        const currentPrice = clean(item.price);
        const price = currentPrice > 0 ? `$${currentPrice.toFixed(0)}` : '—';
        const stockStatus =
          item.anyAvailable === 'false' ? 'out' :
          item.partialStock === 'true'  ? 'partial' :
          item.lowStock === 'true'      ? 'low' :
          item.anyAvailable === 'true'  ? 'in' :
          undefined;
        return (
          <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <div className="min-w-0 mr-2">
              <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-slate-500">{item._vendor}</p>
                {stockStatus && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    stockStatus === 'out'     ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' :
                    stockStatus === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
                    stockStatus === 'low'     ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' :
                                               'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  }`}>
                    {stockStatus === 'out' ? 'Out of Stock' : stockStatus === 'partial' ? 'Limited Stock' : stockStatus === 'low' ? 'Low Stock' : 'In Stock'}
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm font-bold text-blue-500 shrink-0">{price}</span>
          </div>
        );
      })}
      <div className="px-4 py-3">
        <Link href="/drops" className="text-xs font-bold text-blue-500 hover:underline">Browse all drops →</Link>
      </div>
    </div>
  );
}

function KeyboardComparisonWidget() {
  const { loading, items, sources, error } = useFeedData('keyboard-releases');
  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map(i => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-full" />)}
          </div>
        ))}
      </div>
    </div>
  );

  const displayed = items.slice(0, 2);

  if (displayed.length === 0) {
    const errs = [...new Set(Object.values(sources).filter(s => s.error).map(s =>
      (s.error as string).startsWith('Rate limit') ? 'Scrape cooldown active' :
      (s.error as string).startsWith('Access denied') ? 'Source blocked (403)' :
      (s.error as string).slice(0, 50)
    ))];
    return (
      <div className="px-4 py-6 text-center text-slate-400 text-sm">
        {error ? <p className="text-red-400 text-xs mb-1">{error}</p>
          : errs.length > 0
            ? <><p className="mb-1">Sources unavailable:</p>{errs.slice(0,2).map(e => <p key={e} className="text-[10px] text-slate-500 mb-0.5">{e}</p>)}</>
            : <p>No keyboard data yet.</p>}
        <div className="mt-2"><Link href="/keyboard-comparison" className="text-xs font-bold text-blue-500 hover:underline">Full comparison →</Link></div>
      </div>
    );
  }

  const getSpecs = (item: ReturnType<typeof useFeedData>['items'][number]) => {
    const tagList = (item.tags ?? '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    return {
      layout:   tagList.find(t => /65%|tkl|full.?size|40%|75%|60%|96%/.test(t)) ?? item.productType ?? '—',
      mount:    tagList.find(t => /gasket|top.?mount|tray|leaf|sandwich/.test(t)) ?? '—',
      pcb:      tagList.find(t => /hotswap|hot.?swap|solder/.test(t)) ?? '—',
      wireless: tagList.some(t => /wireless|bluetooth/.test(t)),
    };
  };

  const SPEC_ROWS = [
    { label: 'Layout',      key: 'layout' },
    { label: 'Mounting',    key: 'mount' },
    { label: 'PCB',         key: 'pcb' },
    { label: 'Wireless',    key: 'wireless' },
    { label: 'Price',       key: 'price' },
  ] as const;

  const cards = displayed.map(item => {
    const specs = getSpecs(item);
    const price = parseFloat((item.price ?? '0').replace(/[^0-9.]/g, '')) || 0;
    return {
      item,
      values: {
        layout: specs.layout,
        mount: specs.mount,
        pcb: specs.pcb,
        wireless: specs.wireless ? 'Yes' : 'No',
        price: price > 0 ? `$${price.toFixed(0)}` : '—',
      } as Record<string, string>,
    };
  });

  return (
    <div className="p-4">
      {/* Headers */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `140px repeat(${cards.length}, 1fr)` }}>
        <div />
        {cards.map(({ item }) => (
          <div key={item.name} className="min-w-0">
            <p className="text-xs font-bold truncate">{item.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{item._vendor}</p>
          </div>
        ))}
      </div>

      {/* Spec rows */}
      <div className="space-y-1">
        {SPEC_ROWS.map(row => (
          <div key={row.key} className="grid gap-3 py-1 border-t border-slate-100 dark:border-slate-800"
            style={{ gridTemplateColumns: `140px repeat(${cards.length}, 1fr)` }}>
            <span className="text-[10px] font-medium text-slate-500 flex items-center">{row.label}</span>
            {cards.map(({ item, values }) => {
              const val = values[row.key] ?? '—';
              return (
                <span key={item.name} className="text-[11px] font-semibold flex items-center text-slate-700 dark:text-slate-300">{val}</span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Link href="/keyboard-comparison" className="text-xs font-bold text-blue-500 hover:underline">Full comparison →</Link>
      </div>
    </div>
  );
}

function InventoryStatsWidget() {
  const { projects, loading } = useProjects();
  if (loading) return (
    <div className="grid grid-cols-2 gap-3 p-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
          <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700 mb-2" />
          <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-1" />
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
  const activeCount = projects.filter(p => p.status === 'In Progress').length;
  const forSaleCount = projects.filter(p => p.forSale).length;
  const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0);
  const budgetRemaining = projects.reduce((sum, p) => {
    const b = p.budget ?? 0;
    const s = p.spent || 0;
    return sum + Math.max(0, b - s);
  }, 0);
  const stats = [
    { icon: 'rocket_launch', bg: 'bg-blue-500/10 text-blue-500', label: 'Active Projects', value: String(activeCount), badge: 'In Progress', badgeCls: 'text-blue-500' },
    { icon: 'sell', bg: 'bg-emerald-500/10 text-emerald-500', label: 'For Sale', value: String(forSaleCount), badge: 'Listed', badgeCls: 'text-emerald-500' },
    { icon: 'payments', bg: 'bg-purple-500/10 text-purple-500', label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, badge: 'All Projects', badgeCls: 'text-slate-500' },
    { icon: 'account_balance_wallet', bg: 'bg-orange-500/10 text-orange-500', label: 'Budget Left', value: `$${budgetRemaining.toLocaleString()}`, badge: 'Remaining', badgeCls: 'text-orange-500' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {stats.map(c => (
        <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3">
          <div className="flex justify-between items-start mb-2">
            <div className={`p-1.5 rounded-lg ${c.bg}`}>
              <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
            </div>
            <span className={`text-[10px] font-bold ${c.badgeCls}`}>{c.badge}</span>
          </div>
          <p className="text-[10px] font-medium text-slate-500">{c.label}</p>
          <h3 className="text-xl font-bold mt-0.5">{c.value}</h3>
        </div>
      ))}
    </div>
  );
}

// ─── WidgetContent router ─────────────────────────────────────────────────────
function WidgetContent({ id }: { id: string }) {
  switch (id) {
    case 'active-projects':    return <ActiveProjectsWidget />;
    case 'recent-activity':    return <RecentActivityWidget />;
    case 'keyboard-releases':  return <KeyboardReleasesWidget />;
    case 'keycaps-tracker':    return <FeedListWidget widgetId="keycap-releases" linkHref="/keycaps-tracker" linkLabel="Open keycaps tracker →" />;
    case 'keyboard-sales':     return <FeedListWidget widgetId="keyboard-sales" linkHref="/active-deals" linkLabel="View all keyboard deals →" />;
    case 'keyboard-comparison': return <KeyboardComparisonWidget />;
    case 'ram-availability':   return <FeedListWidget widgetId="ram-availability" linkHref="/ram-availability-tracker" linkLabel="Open RAM tracker →" />;
    case 'gpu-availability':   return <FeedListWidget widgetId="gpu-availability" linkHref="/gpu-availability-tracker" linkLabel="Open GPU tracker →" />;
    case 'active-deals':       return <FeedListWidget widgetId="active-deals" linkHref="/active-deals" linkLabel="View all deals →" />;
    case 'electronics-watchlist':        return <FeedListWidget widgetId="electronics-watchlist"        linkHref="/my-electronics" linkLabel="Manage watchlist →" />;
    case 'electronics-new-drops':        return <FeedListWidget widgetId="electronics-new-drops"        linkHref="/my-electronics" linkLabel="View all new drops →" />;
    case 'electronics-sales':            return <FeedListWidget widgetId="electronics-sales"            linkHref="/my-electronics" linkLabel="View electronics deals →" />;
    case 'electronics-microcontrollers': return <FeedListWidget widgetId="electronics-microcontrollers" linkHref="/my-electronics" linkLabel="View MCUs →" />;
    case 'electronics-passives':         return <FeedListWidget widgetId="electronics-passives"         linkHref="/my-electronics" linkLabel="View passives →" />;
    case 'electronics-sensors':          return <FeedListWidget widgetId="electronics-sensors"          linkHref="/my-electronics" linkLabel="View sensors →" />;
    case 'electronics-motors':           return <FeedListWidget widgetId="electronics-motors"           linkHref="/my-electronics" linkLabel="View motors →" />;
    case 'electronics-ics':              return <FeedListWidget widgetId="electronics-ics"              linkHref="/my-electronics" linkLabel="View ICs →" />;
    case 'electronics-encoders':         return <FeedListWidget widgetId="electronics-encoders"         linkHref="/my-electronics" linkLabel="View encoders →" />;
    case 'inventory-stats':    return <InventoryStatsWidget />;
    case 'vendor-performance':
      return (
        <div className="p-6 flex flex-col items-center justify-center text-center text-slate-400 gap-2">
          <span className="material-symbols-outlined text-3xl">storefront</span>
          <p className="text-sm font-medium">Vendor analytics not yet available.</p>
          <p className="text-xs">Connect vendor order history to enable this widget.</p>
        </div>
      );
    default:
      return <div className="p-4 text-sm text-slate-500">No content yet.</div>;
  }
}

// ─── Widget card ──────────────────────────────────────────────────────────────
const AGO_LABELS = ['2 min ago', '17 hr ago', '5 min ago', '1 hr ago', '3 hr ago'];

function WidgetCard({ def, onRemove, ageIdx, editMode }: { def: WidgetDef; onRemove: () => void; ageIdx: number; editMode: boolean }) {
  const ago = AGO_LABELS[ageIdx % AGO_LABELS.length];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {editMode && (
            <span
              {...attributes}
              {...listeners}
              className="material-symbols-outlined text-[18px] text-slate-400 cursor-grab active:cursor-grabbing hover:text-blue-500 transition-colors"
              title="Drag to reorder"
            >drag_indicator</span>
          )}
          <span className={`material-symbols-outlined text-[18px] ${def.color}`}>{def.icon}</span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">{def.title}</h3>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[10px] hidden sm:inline">{ago}</span>
          <button className="hover:text-blue-500 transition-colors p-1" title="Expand">
            <span className="material-symbols-outlined text-[16px]">open_in_full</span>
          </button>
          <button onClick={onRemove} className="hover:text-red-500 transition-colors p-1" title="Remove">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
      <div className="flex-1">
        <WidgetContent id={def.id} />
      </div>
    </div>
  );
}

// ─── Widget picker panel ──────────────────────────────────────────────────────
function WidgetPicker({ onToggle, onClose, active }: { onToggle: (id: string) => void; onClose: () => void; active: string[] }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');

  const categories = ['All', ...Array.from(new Set(ALL_WIDGETS.map(w => w.category)))];
  const filtered = ALL_WIDGETS.filter(w => {
    const matchTab = tab === 'All' || w.category === tab;
    const matchSearch = !search || w.title.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const grouped = categories
    .filter(c => c !== 'All')
    .map(cat => ({ cat, widgets: filtered.filter(w => w.category === cat) }))
    .filter(g => g.widgets.length > 0);

  const displayGroups = tab === 'All' ? grouped : grouped.filter(g => g.cat === tab);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 h-full w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold">Widget Manager</h2>
            <p className="text-xs text-slate-500">{active.length} of {ALL_WIDGETS.length} widgets active</p>
          </div>
          <button onClick={onClose} className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors">
            <span className="material-symbols-outlined text-[16px]">check</span>Done
          </button>
        </div>

        {/* search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search widgets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === c ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-blue-500'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {displayGroups.map(({ cat, widgets }) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{cat} ({widgets.length})</p>
              <div className="grid grid-cols-1 gap-3">
                {widgets.map(w => {
                  const isActive = active.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      className={`flex items-start justify-between p-4 rounded-xl border transition-all ${isActive ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20'}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${isActive ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <span className={`material-symbols-outlined text-[18px] ${isActive ? w.color : 'text-slate-400'}`}>{w.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{w.title}</p>
                            {isActive && <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full">active</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{w.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggle(w.id)}
                        className={`ml-3 shrink-0 flex items-center justify-center size-8 rounded-lg font-bold transition-colors ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-red-100 hover:text-red-500' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        title={isActive ? 'Remove' : 'Add'}
                      >
                        <span className="material-symbols-outlined text-[18px]">{isActive ? 'remove' : 'add'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Layout dropdown ──────────────────────────────────────────────────────────
function LayoutPanel({ cols, setCols, onClose }: { cols: 2 | 3 | 4; setCols: (c: 2 | 3 | 4) => void; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Layout Options</p>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 pt-1 pb-2">Columns</p>
        {([2, 3, 4] as const).map(n => (
          <button
            key={n}
            onClick={() => { setCols(n); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${cols === n ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {n === 2 ? 'view_column' : n === 3 ? 'view_week' : 'view_module'}
            </span>
            {n} Columns{cols === n ? ' ✓' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Data / Feeds dropdown ────────────────────────────────────────────────────
function DataPanel() {
  const feeds = [
    { cat: 'RAM Availability', items: [
      { name: 'Newegg RAM Stock', source: 'Newegg', interval: '15 min', status: 'online' as const },
      { name: 'Amazon RAM Prices', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'TigerDirect RAM Feed', source: 'TigerDirect', interval: '30 min', status: 'online' as const },
      { name: 'Mouser Stock Feed', source: 'Mouser API', interval: '15 min', status: 'online' as const },
      { name: 'DigiKey Product Feed', source: 'DigiKey API', interval: '15 min', status: 'online' as const },
    ]},
    { cat: 'GPU Availability', items: [
      { name: 'Newegg GPU Stock', source: 'Newegg', interval: '10 min', status: 'online' as const },
      { name: 'Amazon GPU Prices', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'TigerDirect GPU Feed', source: 'TigerDirect', interval: '30 min', status: 'queued' as const },
    ]},
    { cat: 'Keyboards', items: [
      { name: 'geekhack Group Buys', source: 'geekhack.org', interval: '1 hr', status: 'online' as const },
      { name: 'KBDfans Sales', source: 'KBDfans', interval: '6 hr', status: 'queued' as const },
      { name: 'Novelkeys Releases', source: 'Novelkeys', interval: '6 hr', status: 'static' as const },
      { name: 'Stupid Bullets Tech', source: 'stupidbulletstech.com', interval: '6 hr', status: 'queued' as const },
      { name: 'Custom Keys Co.', source: 'customkeysco.com', interval: '6 hr', status: 'queued' as const },
    ]},
    { cat: 'Deals', items: [
      { name: 'Amazon Deal Tracker', source: 'Amazon', interval: '30 min', status: 'online' as const },
      { name: 'Slickdeals Feed', source: 'Slickdeals', interval: '5 min', status: 'online' as const },
    ]},
  ];
  const statusDot: Record<string, string> = { online: 'bg-emerald-500', queued: 'bg-blue-500', static: 'bg-slate-400', error: 'bg-red-500' };
  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <p className="text-xs font-bold text-slate-700 dark:text-white">Sources &amp; Status</p>
        <p className="text-[10px] text-slate-500">Data feeds from tracked providers</p>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-slate-800">
        {feeds.map(g => (
          <div key={g.cat} className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{g.cat}</p>
            <div className="space-y-2">
              {g.items.map(f => (
                <div key={f.name} className="flex items-center gap-2">
                  <div className={`size-1.5 rounded-full shrink-0 ${statusDot[f.status]}`} />
                  <div>
                    <p className="text-xs font-medium">{f.name}</p>
                    <p className="text-[10px] text-slate-500">{f.source} · {f.interval}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const STORAGE_KEY_WIDGETS = 'sd-active-widgets';
const STORAGE_KEY_COLS = 'sd-grid-cols';
const DEFAULT_WIDGETS = ['inventory-stats', 'active-projects', 'recent-activity', 'keyboard-releases', 'ram-availability', 'active-deals'];

export default function Dashboard() {
  const router = useRouter();
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>(DEFAULT_WIDGETS);
  const [cols, setCols] = useState<2 | 3 | 4>(3);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const DASH_DRAWER_LINKS = [
    { href: '/my-electronics',           label: 'Electronics', icon: 'inventory_2' },
    { href: '/ram-availability-tracker', label: 'RAM',         icon: 'memory' },
    { href: '/gpu-availability-tracker', label: 'GPU',         icon: 'videogame_asset' },
    { href: '/keyboard-comparison',      label: 'Keyboards',   icon: 'compare' },
    { href: '/keycaps-tracker',          label: 'Keycaps',     icon: 'format_color_text' },
  ];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setActiveWidgetIds(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      const next = arrayMove(prev, oldIdx, newIdx);
      if (getToken()) apiPatch('/api/profile', { widgetOrder: next }).catch(() => {});
      return next;
    });
  }
  const [now, setNow] = useState<Date | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const layoutRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  // Guard: don't persist state until after the initial hydration completes,
  // otherwise the DEFAULT_WIDGETS initializer overwrites what onboarding saved.
  const hydratedRef = useRef(false);

  // Hydrate from API profile then localStorage fallback after mount
  useEffect(() => {
    setNow(new Date());
    const localUser = getUser();
    if (localUser) setUsername(localUser.username);
    if (getToken()) {
      apiGet<{ profile: { activeWidgets?: string[]; gridCols?: number } }>('/api/profile')
        .then(({ profile }) => {
          if (profile.activeWidgets?.length) setActiveWidgetIds(profile.activeWidgets);
          if (profile.gridCols) setCols(profile.gridCols as 2 | 3 | 4);
        })
        .catch(() => {
          // Fall back to localStorage if API unavailable
          try {
            const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
            if (w) setActiveWidgetIds(JSON.parse(w));
            const c = localStorage.getItem(STORAGE_KEY_COLS);
            if (c) setCols(Number(c) as 2 | 3 | 4);
          } catch {}
        })
        .finally(() => { hydratedRef.current = true; });
    } else {
      try {
        const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
        if (w) setActiveWidgetIds(JSON.parse(w));
        const c = localStorage.getItem(STORAGE_KEY_COLS);
        if (c) setCols(Number(c) as 2 | 3 | 4);
      } catch {}
      hydratedRef.current = true;
    }
  }, []);

  // Persist widget selection — skip until hydration is done
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(activeWidgetIds));
    if (getToken()) {
      apiPatch('/api/profile', { activeWidgets: activeWidgetIds }).catch(() => {});
    }
  }, [activeWidgetIds]);

  // Persist column count — skip until hydration is done
  useEffect(() => {
    if (!hydratedRef.current) return;
    localStorage.setItem(STORAGE_KEY_COLS, String(cols));
    if (getToken()) {
      apiPatch('/api/profile', { gridCols: cols }).catch(() => {});
    }
  }, [cols]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close panels on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) setShowLayoutPanel(false);
      if (dataRef.current && !dataRef.current.contains(e.target as Node)) setShowDataPanel(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [router.pathname]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  const toggleWidget = (id: string) =>
    setActiveWidgetIds(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);

  const removeWidget = (id: string) =>
    setActiveWidgetIds(prev => prev.filter(w => w !== id));

  const activeWidgets = activeWidgetIds
    .map(id => ALL_WIDGETS.find(w => w.id === id))
    .filter(Boolean) as WidgetDef[];

  const colClass: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const timeStr = now?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '';
  const dateStr = now?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? '';

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">

      {/* ── Toolbar ── */}
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-[#f5f7f8] dark:bg-[#101922] px-4 z-30 shrink-0 gap-4">
        {/* Left: logo + hamburger + nav */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-500 font-bold shrink-0">
            <div className="size-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            </div>
            <span className="text-base hidden sm:block">ShopDeck</span>
          </Link>
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            title="More pages"
            className={`p-2 rounded-lg transition-colors ${drawerOpen ? 'text-blue-500 bg-blue-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{drawerOpen ? 'close' : 'menu'}</span>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
              { href: '/projects', label: 'Projects', icon: 'rocket_launch' },
              { href: '/active-deals', label: 'Deals', icon: 'sell' },
              { href: '/drops', label: 'Drops', icon: 'new_releases' },
            ].map(n => (
              <Link key={n.href} href={n.href} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-blue-500 hover:bg-blue-500/5 transition-colors">
                <span className="material-symbols-outlined text-[16px]">{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center: clock */}
        {now && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span>{dateStr}</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{timeStr}</span>
          </div>
        )}

        {/* Right: controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Layout dropdown */}
          <div className="relative" ref={layoutRef}>
            <button
              onClick={() => { setShowLayoutPanel(v => !v); setShowDataPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showLayoutPanel ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50'}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_column</span>
              <span className="hidden sm:inline">Layout</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showLayoutPanel && <LayoutPanel cols={cols} setCols={setCols} onClose={() => setShowLayoutPanel(false)} />}
          </div>

          {/* Data / Feeds dropdown */}
          <div className="relative" ref={dataRef}>
            <button
              onClick={() => { setShowDataPanel(v => !v); setShowLayoutPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showDataPanel ? 'border-blue-500 bg-blue-500/5 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50'}`}
            >
              <span className="material-symbols-outlined text-[16px]">rss_feed</span>
              <span className="hidden sm:inline">Data</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showDataPanel && <DataPanel />}
          </div>

          {/* AI Assistant */}
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('sd:open-ai'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-blue-500 hover:border-blue-500/50 transition-colors"
            title="AI Assistant"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            <span className="hidden lg:inline">AI</span>
          </button>

          {/* Edit / Reorder mode */}
          <button
            onClick={() => setEditMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${editMode ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:border-blue-500/50'}`}
            title="Edit / reorder widgets"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span className="hidden lg:inline">{editMode ? 'Done' : 'Edit'}</span>
          </button>

          {/* Add Widget */}
          <button
            onClick={() => setShowWidgetPicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span className="hidden sm:inline">Add Widget</span>
          </button>

          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500"></span>
          </Link>

          {/* User avatar / logout */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500/50 transition-colors text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-500" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
              <span className="hidden sm:inline max-w-20 truncate">{username ?? 'Account'}</span>
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50">
                <Link href="/settings" className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <span className="material-symbols-outlined text-[16px]">settings</span>Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hamburger drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-y-auto">
            <div className="px-4 pt-5 pb-2">
              {/* Main nav links — only shown in drawer on smaller screens */}
              <div className="md:hidden mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Main</p>
                <nav className="space-y-0.5">
                  {[
                    { href: '/dashboard',    label: 'Dashboard', icon: 'grid_view' },
                    { href: '/projects',     label: 'Projects',  icon: 'rocket_launch' },
                    { href: '/active-deals', label: 'Deals',     icon: 'sell' },
                    { href: '/drops',        label: 'Drops',     icon: 'new_releases' },
                  ].map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        router.pathname === l.href
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Trackers</p>
              <nav className="space-y-0.5">
                {DASH_DRAWER_LINKS.map(l => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-auto px-4 pb-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-0.5">
              <button
                onClick={() => { setDrawerOpen(false); document.dispatchEvent(new CustomEvent('sd:open-ai')); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-blue-500">smart_toy</span>
                AI Assistant
              </button>
              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
                Settings
              </Link>
            </div>
          </aside>
        </>
      )}

      {/* ── Widget grid ── */}
      <main className="flex-1 p-4 pb-20 md:pb-4">
        {activeWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <span className="material-symbols-outlined text-8xl text-slate-300 dark:text-slate-700">dashboard_customize</span>
            <div>
              <h2 className="text-xl font-bold mb-2">No widgets on deck</h2>
              <p className="text-slate-500 text-sm mb-6">Add widgets to start monitoring your inventory and projects.</p>
              <button
                onClick={() => setShowWidgetPicker(true)}
                className="flex items-center gap-2 mx-auto px-5 py-3 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
              >
                <span className="material-symbols-outlined">add</span>Add Widgets
              </button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={activeWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
          <div className={`grid ${colClass[cols]} gap-4 auto-rows-min`}>
            {editMode && (
              <div className="col-span-full flex items-center gap-2 text-xs text-blue-500 bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2">
                <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                Drag widgets to reorder. Click <strong>Done</strong> when finished.
              </div>
            )}
            {activeWidgets.map((w, i) => (
              <WidgetCard key={w.id} def={w} onRemove={() => removeWidget(w.id)} ageIdx={i} editMode={editMode} />
            ))}
            {/* Add-widget tile */}
            <button
              onClick={() => setShowWidgetPicker(true)}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-slate-400 hover:border-blue-500/50 hover:text-blue-500 transition-colors min-h-30"
            >
              <span className="material-symbols-outlined text-3xl">add_circle</span>
              <span className="text-xs font-bold">Add Widget</span>
            </button>
          </div>
          </SortableContext>
          </DndContext>
        )}
      </main>

      {/* AI Agent panel is mounted globally in _app.tsx */}

      {/* Widget picker panel */}
      {showWidgetPicker && (
        <WidgetPicker
          onToggle={toggleWidget}
          onClose={() => setShowWidgetPicker(false)}
          active={activeWidgetIds}
        />
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-6 pb-5 pt-3 flex justify-between items-center">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-blue-500">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/projects" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">analytics</span>
          <span className="text-[10px] font-bold">Projects</span>
        </Link>
        <button
          onClick={() => setShowWidgetPicker(true)}
          className="flex flex-col items-center justify-center -mt-8 size-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30"
        >
          <span className="material-symbols-outlined mt-3">add</span>
        </button>
        <Link href="/my-electronics" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-[10px] font-bold">Inventory</span>
        </Link>
        <Link href="/onboarding" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined">person</span>
          <span className="text-[10px] font-bold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}

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
  { id: 'electronics-watchlist', title: 'Electronics Watchlist', category: 'Electronics', icon: 'devices', color: 'text-blue-400', description: 'DigiKey / Mouser tracked parts.' },
  { id: 'inventory-stats', title: 'Inventory Stats', category: 'Overview', icon: 'inventory_2', color: 'text-blue-500', description: 'High-level stock and project counts.' },
  { id: 'vendor-performance', title: 'Vendor Performance', category: 'Overview', icon: 'storefront', color: 'text-yellow-500', description: 'Fulfillment rates across top vendors.' },
];

// ─── Individual widget contents ───────────────────────────────────────────────
function WidgetContent({ id }: { id: string }) {
  switch (id) {
    case 'active-projects':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { icon: 'keyboard', bg: 'bg-blue-100 text-blue-600', name: 'Nebula RGB Keyboard', pid: 'KBD-992-X', status: 'FOR SALE', statusCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500', stock: 82, stockCls: 'bg-emerald-500' },
            { icon: 'headphones', bg: 'bg-purple-100 text-purple-600', name: 'Aura Wireless Pro', pid: 'AUD-104-Y', status: 'IN STOCK', statusCls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', dot: 'bg-blue-500', stock: 15, stockCls: 'bg-orange-500' },
            { icon: 'speaker', bg: 'bg-orange-100 text-orange-600', name: 'Sonic-Wave Monitors', pid: 'AUD-201-Z', status: 'FOR SALE', statusCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', dot: 'bg-emerald-500', stock: 60, stockCls: 'bg-emerald-500' },
          ].map(p => (
            <div key={p.pid} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className={`h-9 w-9 rounded flex items-center justify-center shrink-0 ${p.bg}`}>
                <span className="material-symbols-outlined text-[18px]">{p.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-[10px] text-slate-500">{p.pid}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.statusCls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`}></span>{p.status}
                </span>
                <div className="w-20 hidden md:block">
                  <div className="flex justify-between text-[10px] font-bold mb-0.5">
                    <span>{p.stock}%</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
                    <div className={`h-full ${p.stockCls} rounded-full`} style={{ width: `${p.stock}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/projects" className="text-xs font-bold text-blue-500 hover:underline">View all projects →</Link>
          </div>
        </div>
      );

    case 'recent-activity':
      return (
        <div className="p-4 space-y-4">
          {[
            { dot: 'bg-blue-500 ring-blue-500/20', title: 'New bid on K80 Custom', time: '2 min ago' },
            { dot: 'bg-slate-400 ring-transparent', title: 'Inventory updated: DDR4 RAM Chips', time: '1 hr ago' },
            { dot: 'bg-emerald-500 ring-emerald-500/20', title: 'Vintage Preamp marked as Sold', time: 'Yesterday' },
            { dot: 'bg-orange-500 ring-orange-500/20', title: 'Low stock alert: LogiTech Mousepad', time: '3 hr ago' },
          ].map((a, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className={`size-2 mt-1.5 rounded-full shrink-0 ring-4 ${a.dot}`} />
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-[10px] text-slate-500">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case 'keyboard-releases':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'Zoom65 V3 SE', vendor: 'Meletrix', price: '$169', tag: 'Group Buy', tagCls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
            { name: 'Think6.5 V3', vendor: 'THINK Studio', price: '$250', tag: 'In Stock', tagCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
            { name: 'Hyper X Alloy Origins', vendor: 'HyperX', price: '$109', tag: 'Sale -20%', tagCls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
          ].map((k, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold">{k.name}</p>
                <p className="text-[10px] text-slate-500">{k.vendor}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${k.tagCls}`}>{k.tag}</span>
                <span className="text-sm font-bold text-blue-500">{k.price}</span>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/keyboard-comparison" className="text-xs font-bold text-blue-500 hover:underline">View keyboard comparison →</Link>
          </div>
        </div>
      );

    case 'keycaps-tracker':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'GMK WoB', status: 'Group Buy', ends: '12 days', price: '$140', hot: true },
            { name: 'PBT Sushi', status: 'In Stock', ends: '—', price: '$55', hot: false },
            { name: 'GMK Red Samurai', status: 'Interest Check', ends: '—', price: 'TBD', hot: false },
          ].map((k, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center gap-2">
                {k.hot && <span className="material-symbols-outlined text-orange-500 text-[16px]">local_fire_department</span>}
                <div>
                  <p className="text-sm font-semibold">{k.name}</p>
                  <p className="text-[10px] text-slate-500">{k.status}{k.ends !== '—' ? ` · ends in ${k.ends}` : ''}</p>
                </div>
              </div>
              <span className="text-sm font-bold text-blue-500">{k.price}</span>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/keycaps-tracker" className="text-xs font-bold text-blue-500 hover:underline">Open keycaps tracker →</Link>
          </div>
        </div>
      );

    case 'keyboard-comparison':
      return (
        <div className="p-4">
          <p className="text-sm text-slate-500 mb-4">Comparing 2 keyboards</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'Zoom65 V3', specs: ['Brass weight', '65% layout', 'Gasket mount', 'Alu/POM plate'] },
              { name: 'Think6.5 V3', specs: ['Stainless weight', '65% layout', 'Top mount', 'FR4/Alu plate'] },
            ].map(kb => (
              <div key={kb.name} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-sm font-bold mb-2">{kb.name}</p>
                <ul className="space-y-1">
                  {kb.specs.map(s => (
                    <li key={s} className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-blue-500">check</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/keyboard-comparison" className="text-xs font-bold text-blue-500 hover:underline">Full comparison →</Link>
          </div>
        </div>
      );

    case 'ram-availability':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'G.Skill Trident Z5 DDR5-6000', stock: 'In Stock', stockCls: 'text-emerald-500', price: '$189', change: '+$4', changeCls: 'text-red-500', vendor: 'Newegg' },
            { name: 'Corsair Vengeance DDR4-3600', stock: 'Low Stock', stockCls: 'text-orange-500', price: '$72', change: '-$3', changeCls: 'text-emerald-500', vendor: 'Amazon' },
            { name: 'Kingston FURY Beast DDR5', stock: 'Out of Stock', stockCls: 'text-red-500', price: '$155', change: '—', changeCls: 'text-slate-400', vendor: 'DigiKey' },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-[10px] font-bold ${r.stockCls}`}>{r.stock}</p>
                  <span className="text-[10px] text-slate-400">{r.vendor}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{r.price}</p>
                <p className={`text-[10px] font-bold ${r.changeCls}`}>{r.change}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/ram-availability-tracker" className="text-xs font-bold text-blue-500 hover:underline">Open RAM tracker →</Link>
          </div>
        </div>
      );

    case 'gpu-availability':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'RTX 4090 24GB GDDR6X', stock: 'In Stock', stockCls: 'text-emerald-500', price: '$1,599', change: '-$20', changeCls: 'text-emerald-500', vendor: 'Newegg' },
            { name: 'RX 7900 XTX 24GB GDDR6', stock: 'In Stock', stockCls: 'text-emerald-500', price: '$799', change: '+$10', changeCls: 'text-red-500', vendor: 'Amazon' },
            { name: 'RTX 4070 Ti 12GB GDDR6X', stock: 'Low Stock', stockCls: 'text-orange-500', price: '$749', change: '—', changeCls: 'text-slate-400', vendor: 'TigerDirect' },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-[10px] font-bold ${r.stockCls}`}>{r.stock}</p>
                  <span className="text-[10px] text-slate-400">{r.vendor}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{r.price}</p>
                <p className={`text-[10px] font-bold ${r.changeCls}`}>{r.change}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/gpu-availability-tracker" className="text-xs font-bold text-green-500 hover:underline">Open GPU tracker →</Link>
          </div>
        </div>
      );

    case 'keyboard-sales':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'Keychron Q1 Pro Wireless', vendor: 'Amazon', discount: '40%', price: '$119', was: '$199', ends: '2h left', endCls: 'text-red-500' },
            { name: 'Leopold FC750R PD', vendor: 'KBDfans', discount: '20%', price: '$96', was: '$120', ends: '1d left', endCls: 'text-orange-500' },
            { name: 'GMMK Pro Barebones', vendor: 'Newegg', discount: '35%', price: '$89', was: '$138', ends: '3d left', endCls: 'text-slate-400' },
          ].map((k, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold">{k.name}</p>
                <p className="text-[10px] text-slate-500">
                  {k.vendor} · <span className={k.endCls}>{k.ends}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold">-{k.discount}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-500">{k.price}</p>
                  <p className="text-[10px] text-slate-400 line-through">{k.was}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/active-deals" className="text-xs font-bold text-blue-500 hover:underline">View all keyboard deals →</Link>
          </div>
        </div>
      );

    case 'active-deals':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { name: 'Sony WH-1000XM5', discount: '28%', price: '$259', was: '$359', ends: '6h left', endCls: 'text-red-500' },
            { name: 'Logitech G Pro X', discount: '15%', price: '$89', was: '$105', ends: '1d left', endCls: 'text-orange-500' },
            { name: 'Samsung 990 Pro 2TB', discount: '22%', price: '$155', was: '$199', ends: '3d left', endCls: 'text-slate-400' },
          ].map((d, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold">{d.name}</p>
                <p className={`text-[10px] font-bold ${d.endCls}`}>{d.ends}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 px-2 py-0.5 rounded-full text-[10px] font-bold">-{d.discount}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-500">{d.price}</p>
                  <p className="text-[10px] text-slate-400 line-through">{d.was}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/active-deals" className="text-xs font-bold text-blue-500 hover:underline">View all deals →</Link>
          </div>
        </div>
      );

    case 'electronics-watchlist':
      return (
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {[
            { eid: 'resistors', type: 'Category', source: 'DigiKey', status: 'Tracking', statusCls: 'text-emerald-500' },
            { eid: '123-4567', type: 'Product', source: 'DigiKey', status: 'Alert set', statusCls: 'text-blue-500' },
            { eid: 'capacitors', type: 'Category', source: 'Mouser', status: 'Tracking', statusCls: 'text-emerald-500' },
          ].map((e) => (
            <div key={e.eid} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div>
                <p className="text-sm font-semibold font-mono">{e.eid}</p>
                <p className="text-[10px] text-slate-500">{e.type} · {e.source}</p>
              </div>
              <span className={`text-[10px] font-bold ${e.statusCls}`}>{e.status}</span>
            </div>
          ))}
          <div className="px-4 py-3">
            <Link href="/my-electronics" className="text-xs font-bold text-blue-500 hover:underline">Manage watchlist →</Link>
          </div>
        </div>
      );

    case 'inventory-stats':
      return (
        <div className="grid grid-cols-2 gap-3 p-4">
          {[
            { icon: 'payments', bg: 'bg-emerald-500/10 text-emerald-500', label: 'Monthly Profit', value: '$42,850', badge: '+12.5%', badgeCls: 'text-emerald-500' },
            { icon: 'rocket_launch', bg: 'bg-blue-500/10 text-blue-500', label: 'Active Projects', value: '28', badge: '+4 new', badgeCls: 'text-blue-500' },
            { icon: 'inventory_2', bg: 'bg-orange-500/10 text-orange-500', label: 'Stock Items', value: '1,429', badge: '-5%', badgeCls: 'text-orange-500' },
            { icon: 'groups', bg: 'bg-purple-500/10 text-purple-500', label: 'Vendors', value: '18', badge: 'Stable', badgeCls: 'text-slate-500' },
          ].map(c => (
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

    case 'vendor-performance':
      return (
        <div className="p-4 space-y-3">
          {[['L', 'LogiTech Int.', 98, 'bg-emerald-500'], ['S', 'Soniq Audio', 94, 'bg-emerald-500'], ['M', 'Matrix Gear', 81, 'bg-orange-500'], ['D', 'DigiKey', 99, 'bg-emerald-500']].map(([abbr, name, pct, bar]) => (
            <div key={String(name)} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-[11px]">{String(abbr)}</div>
                  <span className="text-xs font-medium">{String(name)}</span>
                </div>
                <span className={`text-xs font-bold ${Number(pct) >= 90 ? 'text-emerald-500' : 'text-orange-500'}`}>{String(pct)}%</span>
              </div>
              <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
                <div className={`h-full ${String(bar)} rounded-full`} style={{ width: `${String(pct)}%` }} />
              </div>
            </div>
          ))}
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
      <div className="flex-1 overflow-y-auto">
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
        });
    } else {
      try {
        const w = localStorage.getItem(STORAGE_KEY_WIDGETS);
        if (w) setActiveWidgetIds(JSON.parse(w));
        const c = localStorage.getItem(STORAGE_KEY_COLS);
        if (c) setCols(Number(c) as 2 | 3 | 4);
      } catch {}
    }
  }, []);

  // Persist widget selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(activeWidgetIds));
    if (getToken()) {
      apiPatch('/api/profile', { activeWidgets: activeWidgetIds }).catch(() => {});
    }
  }, [activeWidgetIds]);

  // Persist column count
  useEffect(() => {
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">

      {/* ── Toolbar ── */}
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-[#f5f7f8] dark:bg-[#101922] px-4 z-30 shrink-0 gap-4">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-500 font-bold shrink-0">
            <div className="size-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            </div>
            <span className="text-base hidden sm:block">ShopDeck</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
              { href: '/projects', label: 'Projects', icon: 'rocket_launch' },
              { href: '/active-deals', label: 'Deals', icon: 'sell' },
              { href: '/my-electronics', label: 'Electronics', icon: 'memory' },
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
          <button className="relative p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500"></span>
          </button>

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

      {/* ── Widget grid ── */}
      <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
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

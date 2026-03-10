import React, { useState } from 'react';
import { Sidebar } from './ProjectsOverview';

// ─── Types ────────────────────────────────────────────────────────────────────
type PartStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
type CategoryFilter = 'All Categories' | 'Microcontrollers' | 'Passives' | 'Connectors' | 'LED Modules' | 'Switches';
type VendorFilter = 'All Vendors' | 'DigiKey' | 'Mouser' | 'Adafruit' | 'LCSC';

interface ElectronicPart {
  id: string;
  name: string;
  mpn: string;
  category: string;
  vendor: VendorFilter;
  price: number;
  qty?: number;
  status: PartStatus;
  statusLabel: string;
  statusNote?: string;
  icon: string;
}

const STATUS_BADGE: Record<PartStatus, string> = {
  'in-stock': 'bg-emerald-500 text-white',
  'low-stock': 'bg-amber-500 text-white',
  'out-of-stock': 'bg-red-500 text-white',
};

const STATUS_TEXT: Record<PartStatus, string> = {
  'in-stock': 'text-emerald-500',
  'low-stock': 'text-amber-500',
  'out-of-stock': 'text-rose-500',
};

// ─── Mock data ─────────────────────────────────────────────────────────────────
const PARTS: ElectronicPart[] = [
  { id: '1', name: 'ESP32-S3-WROOM-1', mpn: 'ESP32-S3-WROOM-1-N16R8', category: 'MCU', vendor: 'DigiKey', price: 3.45, status: 'in-stock', statusLabel: 'Available Now', icon: 'memory' },
  { id: '2', name: '10k Ohm Resistor', mpn: 'RC0603FR-0710KL', category: 'Passive 0603', vendor: 'Mouser', price: 0.012, qty: 12, status: 'low-stock', statusLabel: 'Running Low', statusNote: '12 left', icon: 'data_object' },
  { id: '3', name: 'NeoPixel Stick 8x', mpn: '1426', category: 'LED Module', vendor: 'Adafruit', price: 5.95, qty: 15, status: 'in-stock', statusLabel: '15 Units', icon: 'lightbulb' },
  { id: '4', name: 'ATmega328P-AU', mpn: 'ATMEGA328P-AU', category: 'Microcontroller', vendor: 'Mouser', price: 2.15, status: 'out-of-stock', statusLabel: 'Expected: 2 Days', icon: 'developer_board' },
  { id: '5', name: 'USB-C Connector', mpn: 'USB4135-GF-A', category: 'Connectors', vendor: 'DigiKey', price: 0.55, qty: 240, status: 'in-stock', statusLabel: 'Available Now', icon: 'usb' },
  { id: '6', name: '100nF MLCC Capacitor', mpn: 'GRM188R71C104KA01D', category: 'Passive 0402', vendor: 'Mouser', price: 0.008, qty: 3, status: 'low-stock', statusLabel: 'Critical: 3 left', icon: 'electric_bolt' },
  { id: '7', name: 'RP2040 Microcontroller', mpn: 'SC0914(7)', category: 'MCU', vendor: 'DigiKey', price: 0.80, qty: 50, status: 'in-stock', statusLabel: '50 Units', icon: 'memory' },
  { id: '8', name: 'WS2812B LED', mpn: 'WS2812B', category: 'LED Modules', vendor: 'LCSC', price: 0.22, status: 'out-of-stock', statusLabel: 'Out of Stock', icon: 'light_mode' },
];

const CATEGORIES: CategoryFilter[] = ['All Categories', 'Microcontrollers', 'Passives', 'Connectors', 'LED Modules', 'Switches'];
const VENDORS: VendorFilter[] = ['All Vendors', 'DigiKey', 'Mouser', 'Adafruit', 'LCSC'];

function PartCard({ part }: { part: ElectronicPart }) {
  return (
    <div className="group flex flex-col bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all shadow-sm h-full">
      {/* Icon square */}
      <div className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <div className={`absolute top-2 left-2 z-10 ${STATUS_BADGE[part.status]} text-[10px] font-black px-2 py-1 rounded-full uppercase`}>
          {part.status === 'in-stock' ? 'In Stock' : part.status === 'low-stock' ? `Low Stock${part.qty ? ': ' + part.qty + ' left' : ''}` : 'Out of Stock'}
        </div>
        <button className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-blue-500 transition-colors">
          <span className="material-symbols-outlined text-sm">favorite</span>
        </button>
        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700">{part.icon}</span>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">{part.vendor}</span>
          <span className={`text-[10px] font-medium ${STATUS_TEXT[part.status]}`}>{part.statusLabel}</span>
        </div>
        <div className="flex justify-between items-start">
          <h3 className="text-sm font-bold leading-tight group-hover:text-blue-500 transition-colors">{part.name}</h3>
          <div className="text-right shrink-0 ml-2">
            <p className="text-blue-500 font-bold text-sm">${part.price < 0.1 ? part.price.toFixed(3) : part.price.toFixed(2)}</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">MPN: {part.mpn} · {part.category}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Details</button>
        {part.status === 'out-of-stock'
          ? <button className="py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 text-xs font-bold cursor-not-allowed opacity-60">Notify Me</button>
          : <button className="py-2 rounded-lg bg-blue-500 hover:brightness-110 text-white text-xs font-bold transition-all">Buy Now</button>
        }
      </div>
    </div>
  );
}

export default function MyElectronics() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All Categories');
  const [vendor, setVendor] = useState<VendorFilter>('All Vendors');
  const [page, setPage] = useState(1);

  const filtered = PARTS.filter(p => {
    const matchCat = category === 'All Categories' || p.category.toLowerCase().includes(category.toLowerCase()) || p.category === category;
    const matchVendor = vendor === 'All Vendors' || p.vendor === vendor;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.mpn.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchVendor && matchSearch;
  });

  const totalParts = 1248;
  const lowStock = PARTS.filter(p => p.status === 'low-stock').length;
  const outOfStock = PARTS.filter(p => p.status === 'out-of-stock');
  const restockVal = outOfStock.reduce((acc, p) => acc + p.price * 50, 0).toFixed(2);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <Sidebar active="My Electronics" />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          {/* Page header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <span>Inventory</span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-blue-500 font-medium">Electronics Parts</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight">My Electronics Parts</h2>
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
                <h3 className="text-3xl font-bold">{totalParts.toLocaleString()}</h3>
                <p className="text-emerald-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span>+12% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined">inventory</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Low Stock</p>
                <h3 className="text-3xl font-bold text-amber-500">{lowStock}</h3>
                <p className="text-amber-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">priority_high</span>Critical attention needed
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined">warning</span>
              </div>
            </div>
            <div className="bg-white dark:bg-[#101922]/50 border border-slate-200 dark:border-blue-500/20 p-6 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">Restock Value</p>
                <h3 className="text-3xl font-bold">$452.10</h3>
                <p className="text-blue-500 text-xs font-semibold mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">schedule</span>3 Pending Orders
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
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-slate-50 dark:bg-blue-500/5 border border-slate-200 dark:border-blue-500/20 rounded-lg text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                    value={category}
                    onChange={e => setCategory(e.target.value as CategoryFilter)}
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select
                    className="bg-slate-50 dark:bg-blue-500/5 border border-slate-200 dark:border-blue-500/20 rounded-lg text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500"
                    value={vendor}
                    onChange={e => setVendor(e.target.value as VendorFilter)}
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
              {filtered.length > 0
                ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {filtered.map(p => <PartCard key={p.id} part={p} />)}
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
              <span className="text-xs text-slate-500">Showing {filtered.length} of {totalParts.toLocaleString()} entries</span>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-blue-500/10 disabled:opacity-30 transition-colors">
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setPage(n)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${page === n ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-blue-500/10'}`}>{n}</button>
                ))}
                <span className="text-xs mx-1">...</span>
                <button onClick={() => setPage(250)} className={`px-2 py-1 text-xs font-bold rounded transition-colors ${page === 250 ? 'bg-blue-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-blue-500/10'}`}>250</button>
                <button onClick={() => setPage(p => Math.min(250, p + 1))} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-blue-500/10 transition-colors">
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

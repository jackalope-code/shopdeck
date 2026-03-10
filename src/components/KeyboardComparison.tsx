import React, { useState } from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Keyboard {
  id: string;
  name: string;
  maker: string;
  price: number;
  availability: 'in-stock' | 'out-of-stock' | 'pre-order' | 'restocking';
  tier: string;
  tierColor: string;
  gradient: string;
  icon: string;
  specs: SpecRow[];
  verdict: string;
  verdictColor: string;
  ctaLabel: string;
  ctaVariant: 'primary' | 'outline';
}

interface SpecRow {
  label: string;
  value: string;
  highlight?: boolean;
}

const AVAILABILITY_STYLE: Record<string, string> = {
  'in-stock': 'text-emerald-500',
  'out-of-stock': 'text-red-500',
  'pre-order': 'text-blue-400',
  'restocking': 'text-amber-500',
};

const AVAILABILITY_LABEL: Record<string, string> = {
  'in-stock': 'In Stock',
  'out-of-stock': 'Out of Stock',
  'pre-order': 'Pre-Order',
  'restocking': 'Restocking Soon',
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const KB_A: Keyboard = {
  id: 'a', name: 'Mode Envoy', maker: 'Mode Designs', price: 189, availability: 'in-stock',
  tier: 'Premium', tierColor: 'bg-blue-500 text-white',
  gradient: 'from-blue-900 to-slate-700', icon: 'keyboard',
  ctaLabel: 'Add to Cart', ctaVariant: 'primary',
  verdict: 'Best for enthusiasts wanting refined build quality and consistent acoustics.',
  verdictColor: 'text-primary',
  specs: [
    { label: 'Mounting Style', value: 'Lattice Block / Top Mount' },
    { label: 'Typing Angle', value: '5.8 Degrees' },
    { label: 'Materials', value: 'Aluminum / Polycarbonate' },
    { label: 'Weight', value: '~1.5 kg (Built)' },
    { label: 'PCB Type', value: 'Hotswap / Solder (Non-flex)', highlight: true },
    { label: 'Connectivity', value: 'USB-C Wired' },
    { label: 'Layout', value: '65% TKL' },
    { label: 'Gasket', value: 'No' },
    { label: 'Best For', value: 'Premium aesthetics & consistent sound' },
  ],
};

const KB_B: Keyboard = {
  id: 'b', name: 'QK65v2', maker: 'QwertyKeys', price: 145, availability: 'restocking',
  tier: 'Value King', tierColor: 'bg-amber-500 text-white',
  gradient: 'from-amber-900 to-slate-700', icon: 'keyboard_alt',
  ctaLabel: 'Notify Me', ctaVariant: 'outline',
  verdict: 'Best for value-driven builders wanting flex and wireless connectivity.',
  verdictColor: 'text-amber-500',
  specs: [
    { label: 'Mounting Style', value: 'Gasket Mount (Non-flex cut)' },
    { label: 'Typing Angle', value: '6.5 Degrees' },
    { label: 'Materials', value: '6063 Aluminum / CNC Case' },
    { label: 'Weight', value: '~1.8 kg (Built)' },
    { label: 'PCB Type', value: 'Tri-mode Hotswap (Flex-cut)', highlight: true },
    { label: 'Connectivity', value: 'Wireless / Wired / Bluetooth' },
    { label: 'Layout', value: '65%' },
    { label: 'Gasket', value: 'Yes (non-flex cut)' },
    { label: 'Best For', value: 'Flexy feel & wireless freedom' },
  ],
};

// ─── Product column ───────────────────────────────────────────────────────────
function ProductHeader({ kb }: { kb: Keyboard }) {
  return (
    <div className="group bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Image / banner */}
      <div className="relative h-52 w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-5">
        <div className={`absolute inset-0 bg-linear-to-br ${kb.gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
          <span className="material-symbols-outlined text-white/20 text-8xl">{kb.icon}</span>
        </div>
        <div className="absolute top-3 left-3">
          <span className={`${kb.tierColor} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>{kb.tier}</span>
        </div>
      </div>
      {/* Title row */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold">{kb.name}</h3>
          <p className="text-sm text-slate-500">By {kb.maker}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-blue-500">${kb.price.toFixed(2)}</p>
          <p className={`text-xs font-medium ${AVAILABILITY_STYLE[kb.availability]}`}>{AVAILABILITY_LABEL[kb.availability]}</p>
        </div>
      </div>
    </div>
  );
}

function ProductActions({ kb }: { kb: Keyboard }) {
  return (
    <div className="flex gap-3 mt-2">
      {kb.ctaVariant === 'primary'
        ? <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined text-sm">shopping_cart</span>{kb.ctaLabel}
          </button>
        : <button className="flex-1 border-2 border-blue-500 text-blue-500 hover:bg-blue-500/5 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all">
            <span className="material-symbols-outlined text-sm">notifications</span>{kb.ctaLabel}
          </button>
      }
      <button className="w-12 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
        <span className="material-symbols-outlined">visibility</span>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KeyboardComparison() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Keyboards" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md px-8 flex items-center justify-between">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/dashboard" className="hover:text-blue-500 transition-colors">Library</Link>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span>65% Keyboards</span>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">Envoy vs QK65v2</span>
          </div>
          {/* Right controls */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input
                className="h-9 w-60 pl-9 pr-4 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="Search kits..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 transition-colors">
              <span className="material-symbols-outlined text-sm">share</span>Share View
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-6xl mx-auto">
            {/* Title */}
            <div className="mb-6">
              <h1 className="text-4xl font-bold tracking-tight">Side-by-Side Analysis</h1>
              <p className="text-slate-500 mt-2">Technical performance and aesthetic comparison of premium 65% custom kits.</p>
            </div>

            {/* Product headers + actions */}
            <div className="grid grid-cols-2 gap-8 mb-2">
              <ProductHeader kb={KB_A} />
              <ProductHeader kb={KB_B} />
            </div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <ProductActions kb={KB_A} />
              <ProductActions kb={KB_B} />
            </div>

            {/* Specs table */}
            <div className="bg-white dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/50">
                    <th className="p-4 w-1/4 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">Technical Specs</th>
                    <th className="p-4 w-[37.5%] font-bold border-b border-slate-200 dark:border-slate-800">{KB_A.name}</th>
                    <th className="p-4 w-[37.5%] font-bold border-b border-slate-200 dark:border-slate-800">{KB_B.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {KB_A.specs.map((spec, i) => (
                    <tr key={spec.label} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500 bg-slate-50/50 dark:bg-slate-800/20">{spec.label}</td>
                      <td className={`p-4 text-sm ${KB_A.specs[i].highlight ? 'text-blue-500 font-medium' : ''}`}>{KB_A.specs[i].value}</td>
                      <td className={`p-4 text-sm ${KB_B.specs[i].highlight ? 'text-blue-500 font-medium' : ''}`}>{KB_B.specs[i].value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div className="grid grid-cols-3 gap-8">
              {/* Core difference */}
              <div className="bg-blue-500/5 rounded-xl p-6 border border-blue-500/20">
                <h4 className="font-bold flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-blue-500">analytics</span>Core Difference
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The <strong>Envoy</strong> focuses on refinement and build experience, while the <strong>QK65v2</strong> prioritizes features and affordability.
                </p>
              </div>
              {/* Verdict cards */}
              <div className="bg-white dark:bg-slate-900/40 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold mb-2 text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-sm">verified</span>Mode Envoy verdict
                </h4>
                <p className={`text-sm ${KB_A.verdictColor}`}>{KB_A.verdict}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/40 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold mb-2 text-sm uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-sm">verified</span>QK65v2 verdict
                </h4>
                <p className={`text-sm ${KB_B.verdictColor}`}>{KB_B.verdict}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

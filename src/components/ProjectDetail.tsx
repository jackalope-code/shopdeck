import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Sidebar, TopHeader } from './ProjectsOverview';
import { apiGet, getToken } from '../lib/auth';

// ─── Project shape (mirrors backend) ──────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  status: string;
  icon: string;
  forSale: boolean;
  budget: number;
  targetPrice: number;
  estProfit: number;
  sourced: number;
  total: number;
  spent: number;
  gradient: string;
  category?: string;
  components?: Component[];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Component {
  id: string;
  name: string;
  detail: string;
  icon: string;
  vendor: string;
  status: 'Sourced' | 'Tracked' | 'Pending' | 'Ordered';
  price: number;
  trend: number[]; // 6 bar heights 1-6
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const COMPONENTS: Component[] = [
  { id: '1', name: 'Neo65 Case & PCB', detail: 'Aluminum Shell, E-white', icon: 'keyboard', vendor: 'QwertyKeys', status: 'Sourced', price: 120.00, trend: [2, 3, 2, 4, 5, 5] },
  { id: '2', name: 'Gateron Baby Raccoon', detail: '70x Switches, Linear', icon: 'switch_access', vendor: 'Divinikey', status: 'Tracked', price: 45.50, trend: [4, 3, 4, 3, 4, 5] },
  { id: '3', name: 'GMK Botanical R2', detail: 'Base Kit Keycaps', icon: 'grid_view', vendor: 'ZFrontier', status: 'Sourced', price: 155.00, trend: [3, 5, 4, 6, 5, 6] },
  { id: '4', name: 'Stabilizers', detail: 'Durock V2 Screw-in', icon: 'adjust', vendor: 'KBDfans', status: 'Sourced', price: 18.00, trend: [2, 2, 3, 2, 2, 3] },
  { id: '5', name: 'FR4 Plate', detail: '65% Layout, ANSI', icon: 'layers', vendor: 'TheKeyCompany', status: 'Pending', price: 22.00, trend: [4, 3, 3, 4, 4, 5] },
  { id: '6', name: 'Foam Kit', detail: 'Case + PCB foam', icon: 'texture', vendor: 'KBDfans', status: 'Ordered', price: 12.00, trend: [1, 2, 1, 2, 3, 3] },
];

const STATUS_STYLE: Record<string, string> = {
  Sourced: 'bg-emerald-500/10 text-emerald-500',
  Tracked: 'bg-blue-500/10 text-blue-500',
  Pending: 'bg-amber-500/10 text-amber-500',
  Ordered: 'bg-purple-500/10 text-purple-500',
};

const STATUS_DOT: Record<string, string> = {
  Sourced: 'bg-emerald-500',
  Tracked: 'bg-blue-500',
  Pending: 'bg-amber-500',
  Ordered: 'bg-purple-500',
};

// ─── Mini trend bar chart ─────────────────────────────────────────────────────
function TrendBars({ heights }: { heights: number[] }) {
  const max = 6;
  return (
    <div className="w-20 h-6 flex items-end gap-0.5">
      {heights.map((h, i) => {
        const isLast = i === heights.length - 1;
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${isLast ? 'bg-blue-500' : 'bg-blue-500/25'}`}
            style={{ height: `${(h / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState('');
  const [forSale, setForSale] = useState(true);
  const [search, setSearch] = useState('');

  // Load project from API
  useEffect(() => {
    if (!id) return;
    if (!getToken()) return;
    apiGet<Project[]>('/api/projects').then(projects => {
      const found = projects.find(p => p.id === id);
      if (found) {
        setProject(found);
        setForSale(found.forSale);
      } else {
        setLoadError(`Project ${id} not found.`);
      }
    }).catch(() => setLoadError('Could not load project. Using demo data.'));
  }, [id]);

  // Derived values — use API data if available, else fall back to mock
  const components = project?.components?.length ? project.components : COMPONENTS;
  const spent = project?.spent ?? COMPONENTS.filter(c => c.status !== 'Pending').reduce((s, c) => s + c.price, 0);
  const total = components.reduce((s: number, c: Component) => s + c.price, 0);
  const budget = project?.budget ?? 450;
  const sourced = project?.sourced ?? components.filter((c: Component) => c.status === 'Sourced').length;
  const pct = components.length > 0 ? Math.round((sourced / components.length) * 100) : 0;
  const projectName = project?.name ?? 'Neo65 Keyboard Build';

  const filtered = components.filter((c: Component) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.vendor.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <Sidebar active="Projects" />

      <main className="flex-1 overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/projects" className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                <span className="material-symbols-outlined">arrow_back</span>
              </Link>
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-0.5">
                  <Link href="/projects" className="hover:text-blue-500">Projects</Link>
                  <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                  <span>{projectName}</span>
                </div>
                <h2 className="text-xl font-bold">{projectName}</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* For Sale toggle */}
              <div className="flex items-center gap-2 py-2 px-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">For Sale</span>
                <button
                  onClick={() => setForSale(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${forSale ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${forSale ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <button className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">ios_share</span>
                <span className="hidden sm:inline">Export List</span>
              </button>
              <button className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-all flex items-center gap-2 shadow-sm shadow-blue-500/30">
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span className="hidden sm:inline">Add Component</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
            {loadError && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                {loadError}
              </div>
            )}
            {/* Overview grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Progress card */}
            <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Progress</h3>
                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold">ACTIVE</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-4xl font-bold">{pct}%</span>
                <span className="text-sm text-slate-500 mb-1">{sourced} of {components.length} Sourced</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-4 text-sm text-slate-500">Estimated completion: Feb 28, 2026</p>
            </div>

            {/* Budget card */}
            <div className="lg:col-span-8 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Budget</h3>
                  <div className="text-3xl font-bold">${budget.toFixed(2)}</div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                    <span className="material-symbols-outlined text-[12px]">info</span> Target Cap
                  </p>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-800 px-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spent to Date</h3>
                  <div className="text-3xl font-bold text-blue-500">${spent.toFixed(2)}</div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-emerald-500 font-medium">
                    <span className="material-symbols-outlined text-[12px]">trending_down</span> ${(budget - spent).toFixed(2)} Left
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Avg. Part Cost</h3>
                  <div className="text-3xl font-bold">${(total / COMPONENTS.length).toFixed(2)}</div>
                  <p className="mt-2 text-xs text-slate-500">Across {components.length} components</p>
                </div>
              </div>
            </div>
          </div>

          {/* Components table */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold">Components</h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                  <input
                    className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search parts..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                  <span className="material-symbols-outlined">filter_list</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Component</th>
                    <th className="px-6 py-4 hidden sm:table-cell">Vendor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 hidden md:table-cell">Trend (30d)</th>
                    <th className="px-6 py-4 text-right">Price</th>
                    <th className="px-6 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-slate-400">{c.icon}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{c.name}</p>
                            <p className="text-xs text-slate-500">{c.detail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium hidden sm:table-cell">{c.vendor}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                          <span className={`size-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <TrendBars heights={c.trend} />
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-sm">${c.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right text-slate-400">
                        <button className="hover:text-slate-900 dark:hover:text-white transition-colors">
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-950/50">
                    <td colSpan={4} className="px-6 py-4 text-sm font-bold text-slate-500">Total</td>
                    <td className="px-6 py-4 text-right font-bold">${total.toFixed(2)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* "For Sale" listing preview panel */}
          {forSale && (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">sell</span>
                    For Sale Listing
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Configure your listing details</p>
                </div>
                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold">LIVE</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asking Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      defaultValue={649}
                      className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-emerald-500 font-medium">Est. profit: +${(649 - spent).toFixed(2)}</p>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Condition</label>
                  <select className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option>Brand New / Sealed</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Platform</label>
                  <select className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option>mechkeys r/mechmarket</option>
                    <option>Geekhack</option>
                    <option>eBay</option>
                    <option>Direct Sale</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Description</label>
                  <textarea
                    rows={3}
                    defaultValue="Neo65 complete build. E-white aluminum case with GMK Botanical R2. Gateron Baby Raccoon switches, lubed and filmed. FR4 plate. All original packaging included."
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-3 flex justify-end gap-3">
                  <button className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    Save Draft
                  </button>
                  <button className="px-5 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">publish</span>
                    Publish Listing
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Sidebar } from './ProjectsOverview';
import { apiGet, apiPatch, getToken } from '../lib/auth';

interface Component {
  id: string;
  name: string;
  detail: string;
  icon: string;
  vendor: string;
  status: 'Sourced' | 'Tracked' | 'Pending' | 'Ordered';
  price: number;
  trend: number[];
  partsPerUnit?: number;
  stockQty?: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  icon: string;
  forSale: boolean;
  budget?: number;
  targetPrice?: number;
  estProfit?: number;
  sourced: number;
  total: number;
  spent: number;
  gradient: string;
  modified: string;
  image?: string;
  components?: Component[];
  targetUnits?: number;
  builtUnits?: number;
  soldUnits?: number;
  wasteOverageRate?: number;
}

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

const WASTE_TOOLTIP_TEXT = 'Waste/Overage Rate adds a buffer for expected losses during builds (defects, breakage, or unusable units). Example: 0.05 means add 5% extra parts';

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeComponent(component: Component): Component {
  return {
    ...component,
    partsPerUnit: Math.max(0, toSafeNumber(component.partsPerUnit, 1)),
    stockQty: Math.max(0, toSafeNumber(component.stockQty, 0)),
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    components: (project.components ?? []).map(normalizeComponent),
    targetUnits: Math.max(0, toSafeNumber(project.targetUnits, 0)),
    builtUnits: Math.max(0, toSafeNumber(project.builtUnits, 0)),
    soldUnits: Math.max(0, toSafeNumber(project.soldUnits, 0)),
    wasteOverageRate: Math.max(0, toSafeNumber(project.wasteOverageRate, 0)),
  };
}

function TrendBars({ heights }: { heights: number[] }) {
  const max = 6;
  return (
    <div className="w-20 h-6 flex items-end gap-0.5">
      {heights.map((height, index) => {
        const isLast = index === heights.length - 1;
        return (
          <div
            key={index}
            className={`flex-1 rounded-t-sm ${isLast ? 'bg-blue-500' : 'bg-blue-500/25'}`}
            style={{ height: `${(height / max) * 100}%` }}
          />
        );
      })}
    </div>
  );
}

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query as { id?: string };

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id || !getToken()) return;
    apiGet<{ projects: Project[] }>('/api/projects')
      .then(({ projects }) => {
        const found = projects.find(p => p.id === id);
        if (!found) {
          setLoadError(`Project ${id} not found.`);
          return;
        }
        setProject(normalizeProject(found));
      })
      .catch(() => setLoadError('Could not load project.'));
  }, [id]);

  const components = useMemo(() => project?.components ?? [], [project?.components]);
  const filtered = useMemo(
    () => components.filter(component =>
      !search
      || component.name.toLowerCase().includes(search.toLowerCase())
      || component.vendor.toLowerCase().includes(search.toLowerCase())
    ),
    [components, search]
  );

  const sourceCount = useMemo(() => components.filter(component => component.status === 'Sourced').length, [components]);
  const componentCount = components.length;
  const spent = useMemo(
    () => components.filter(component => component.status !== 'Pending').reduce((sum, component) => sum + toSafeNumber(component.price, 0), 0),
    [components]
  );
  const totalCost = useMemo(
    () => components.reduce((sum, component) => sum + toSafeNumber(component.price, 0), 0),
    [components]
  );
  const averagePartCost = componentCount > 0 ? totalCost / componentCount : 0;

  const targetUnits = Math.max(0, toSafeNumber(project?.targetUnits, 0));
  const builtUnits = Math.max(0, toSafeNumber(project?.builtUnits, 0));
  const soldUnits = Math.max(0, toSafeNumber(project?.soldUnits, 0));
  const wasteOverageRate = Math.max(0, toSafeNumber(project?.wasteOverageRate, 0));

  const producibleUnits = useMemo(() => {
    if (components.length === 0) return 0;
    const capacities = components
      .filter(component => toSafeNumber(component.partsPerUnit, 1) > 0)
      .map(component => Math.floor(toSafeNumber(component.stockQty, 0) / toSafeNumber(component.partsPerUnit, 1)));
    if (capacities.length === 0) return 0;
    return Math.max(0, Math.min(...capacities));
  }, [components]);

  const expectedPartsTotal = useMemo(
    () => components.reduce((sum, component) => {
      const expected = Math.ceil(toSafeNumber(component.partsPerUnit, 1) * targetUnits * (1 + wasteOverageRate));
      return sum + expected;
    }, 0),
    [components, targetUnits, wasteOverageRate]
  );

  const targetShortfall = Math.max(0, targetUnits - producibleUnits);
  const progressPercent = componentCount > 0 ? Math.round((sourceCount / componentCount) * 100) : 0;

  async function persistProject(next: Project) {
    if (!id || !getToken()) return;
    setSaving(true);
    try {
      await apiPatch(`/api/projects/${id}`, {
        sourced: sourceCount,
        total: componentCount,
        spent,
        builtUnits: next.builtUnits,
        targetUnits: next.targetUnits,
        soldUnits: next.soldUnits,
        wasteOverageRate: next.wasteOverageRate,
        components: next.components,
      });
    } catch {
      setLoadError('Could not save project updates.');
    } finally {
      setSaving(false);
    }
  }

  function updateProjectField(field: 'targetUnits' | 'builtUnits' | 'soldUnits' | 'wasteOverageRate', value: number) {
    if (!project) return;
    const next: Project = normalizeProject({ ...project, [field]: value });
    setProject(next);
    persistProject(next);
  }

  function updateComponentField(componentId: string, field: 'partsPerUnit' | 'stockQty', value: number) {
    if (!project) return;
    const nextComponents = (project.components ?? []).map(component =>
      component.id === componentId
        ? normalizeComponent({ ...component, [field]: value })
        : component
    );
    const next = normalizeProject({ ...project, components: nextComponents });
    setProject(next);
    persistProject(next);
  }

  if (!project) {
    return (
      <div className="flex min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
        <Sidebar active="Projects" />
        <main className="flex-1 p-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500">
            {loadError || 'Loading project...'}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <Sidebar active="Projects" />
      <main className="flex-1">
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
                  <span>{project.name}</span>
                </div>
                <h2 className="text-xl font-bold">{project.name}</h2>
              </div>
            </div>
            <div className="text-xs text-slate-500">{saving ? 'Saving…' : `Modified ${project.modified}`}</div>
          </div>
        </div>

        <div className="px-6 py-8 space-y-8 max-w-7xl mx-auto">
          {loadError && (
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              {loadError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Project Progress</h3>
                <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-bold">ACTIVE</span>
              </div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-4xl font-bold">{progressPercent}%</span>
                <span className="text-sm text-slate-500 mb-1">{sourceCount} of {componentCount} Sourced</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="lg:col-span-5 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Budget</h3>
                  <div className="text-3xl font-bold">${toSafeNumber(project.budget, 0).toFixed(2)}</div>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-800 px-6">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Spent to Date</h3>
                  <div className="text-3xl font-bold text-blue-500">${spent.toFixed(2)}</div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Avg. Part Cost</h3>
                  <div className="text-3xl font-bold">${averagePartCost.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Build & Inventory</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Producible Units</span>
                  <span className="font-bold text-blue-500">{producibleUnits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Built Units</span>
                  <input
                    type="number"
                    min="0"
                    value={builtUnits}
                    onChange={e => updateProjectField('builtUnits', Math.max(0, toSafeNumber(e.target.value, 0)))}
                    className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Sold Units</span>
                  <input
                    type="number"
                    min="0"
                    value={soldUnits}
                    onChange={e => updateProjectField('soldUnits', Math.max(0, toSafeNumber(e.target.value, 0)))}
                    className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Units</span>
                  <input
                    type="number"
                    min="0"
                    value={targetUnits}
                    onChange={e => updateProjectField('targetUnits', Math.max(0, toSafeNumber(e.target.value, 0)))}
                    className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right"
                  />
                </div>
                {targetShortfall > 0 && (
                  <div className="text-xs text-orange-500 font-semibold">
                    Producible ({producibleUnits}) is below target by {targetShortfall}.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold">Part Planning</h3>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1" title={WASTE_TOOLTIP_TEXT}>
                  Waste/Overage Rate (%)
                  <span className="material-symbols-outlined text-[14px] text-slate-400">info</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number((wasteOverageRate * 100).toFixed(2))}
                  onChange={e => {
                    const percent = Math.max(0, toSafeNumber(e.target.value, 0));
                    updateProjectField('wasteOverageRate', percent / 100);
                  }}
                  className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-sm text-slate-500">Expected total parts to purchase for target</div>
              <div className="text-lg font-bold text-blue-500">{expectedPartsTotal}</div>
            </div>

            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                <input
                  className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search parts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Component</th>
                    <th className="px-6 py-4 hidden sm:table-cell">Vendor</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 hidden md:table-cell">Trend</th>
                    <th className="px-6 py-4 text-right">Price</th>
                    <th className="px-6 py-4 text-right">Parts / Unit</th>
                    <th className="px-6 py-4 text-right">Stock</th>
                    <th className="px-6 py-4 text-right">Expected Buy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map(component => {
                    const partsPerUnit = Math.max(0, toSafeNumber(component.partsPerUnit, 1));
                    const stockQty = Math.max(0, toSafeNumber(component.stockQty, 0));
                    const expectedBuy = Math.ceil(partsPerUnit * targetUnits * (1 + wasteOverageRate));
                    return (
                      <tr key={component.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-slate-400">{component.icon}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{component.name}</p>
                              <p className="text-xs text-slate-500">{component.detail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium hidden sm:table-cell">{component.vendor}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[component.status]}`}>
                            <span className={`size-1.5 rounded-full ${STATUS_DOT[component.status]}`} />
                            {component.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <TrendBars heights={component.trend} />
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-sm">${toSafeNumber(component.price, 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={partsPerUnit}
                            onChange={e => updateComponentField(component.id, 'partsPerUnit', Math.max(0, toSafeNumber(e.target.value, 0)))}
                            className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={stockQty}
                            onChange={e => updateComponentField(component.id, 'stockQty', Math.max(0, toSafeNumber(e.target.value, 0)))}
                            className="w-20 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-blue-500">{expectedBuy}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

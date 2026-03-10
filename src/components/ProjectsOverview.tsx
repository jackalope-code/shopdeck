import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiGet, apiPost, apiPatch, getToken, getUser as getAuthUser } from '../lib/auth';

// ─── Shared nav sidebar ───────────────────────────────────────────────────────
export function Sidebar({ active }: { active: string }) {
  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { href: '/projects', label: 'Projects', icon: 'workspaces' },
    { href: '/my-electronics', label: 'Electronics', icon: 'inventory_2' },
    { href: '/active-deals', label: 'Active Deals', icon: 'sell' },
    { href: '/ram-availability-tracker', label: 'RAM Tracker', icon: 'memory' },
    { href: '/gpu-availability-tracker', label: 'GPU Tracker', icon: 'videogame_asset' },
    { href: '/keyboard-comparison', label: 'Keyboard Compare', icon: 'compare' },
    { href: '/keycaps-tracker', label: 'Keycaps', icon: 'format_color_text' },
  ];

  return (
    <aside className="w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922]/50 hidden md:flex">
      <div className="p-6 flex items-center gap-3">
        <div className="size-10 bg-blue-500 rounded-lg flex items-center justify-center text-white">
          <span className="material-symbols-outlined">shopping_cart</span>
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight text-blue-500">ShopDeck</h1>
          <p className="text-xs text-slate-500">Account</p>
        </div>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${l.label === active ? 'bg-blue-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {/* AI assistant button */}
        <button
          onClick={() => document.dispatchEvent(new CustomEvent('sd:open-ai'))}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-blue-500">smart_toy</span>
          AI Assistant
        </button>
        <Link href="/settings" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Settings
        </Link>
      </div>
    </aside>
  );
}

// ─── Top header (reusable) ────────────────────────────────────────────────────
export function TopHeader({ title }: { title?: string }) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#101922]/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3 flex-1 max-w-sm">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={title ? `Search ${title.toLowerCase()}...` : 'Search...'}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white dark:border-[#101922]" />
        </button>
        <div className="size-8 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">AR</div>
      </div>
    </header>
  );
}

// ─── Unified top nav (all main pages) ────────────────────────────────────────
const TOP_NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
  { href: '/projects',  label: 'Projects',  icon: 'rocket_launch' },
  { href: '/active-deals', label: 'Deals',  icon: 'sell' },
  { href: '/drops',     label: 'Drops',     icon: 'new_releases' },
];

const DRAWER_LINKS = [
  { href: '/my-electronics',           label: 'Electronics', icon: 'inventory_2' },
  { href: '/ram-availability-tracker', label: 'RAM',         icon: 'memory' },
  { href: '/gpu-availability-tracker', label: 'GPU',         icon: 'videogame_asset' },
  { href: '/keyboard-comparison',      label: 'Keyboards',   icon: 'compare' },
  { href: '/keycaps-tracker',          label: 'Keycaps',     icon: 'format_color_text' },
];

export function TopNav({ active }: { active?: string }) {
  const router = useRouter();
  const user = getAuthUser();
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'SD';
  const currentPath = router.pathname;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [currentPath]);

  const drawerActive = DRAWER_LINKS.some(l =>
    active ? l.label === active : currentPath === l.href
  );

  return (
    <>
      <header className="h-14 w-full shrink-0 flex items-center justify-between px-4 gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md sticky top-0 z-30">
        {/* Left: hamburger + logo + nav links */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 text-blue-500 font-bold shrink-0">
            <div className="size-8 bg-blue-500 rounded-lg flex items-center justify-center text-white shrink-0">
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            </div>
            <span className="text-sm hidden sm:block">ShopDeck</span>
          </Link>

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(o => !o)}
            title="More pages"
            className={`p-2 rounded-lg transition-colors ${
              drawerActive || drawerOpen
                ? 'text-blue-500 bg-blue-500/10'
                : 'text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {drawerOpen ? 'close' : 'menu'}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-0.5">
            {TOP_NAV_LINKS.map(l => {
              const isActive = active ? l.label === active : currentPath === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:bg-blue-500/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{l.icon}</span>
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: AI + settings + notifications + avatar */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('sd:open-ai'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-blue-500 hover:border-blue-500/50 transition-colors"
            title="AI Assistant"
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            <span className="hidden sm:inline">AI</span>
          </button>
          <Link
            href="/settings"
            className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </Link>
          <Link
            href="/notifications"
            className="relative p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white dark:border-[#101922]" />
          </Link>
          <div className="size-8 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold ml-1 shrink-0">
            {initials}
          </div>
        </div>
      </header>

      {/* Hamburger drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Panel */}
          <aside className="fixed top-14 left-0 bottom-0 z-40 w-64 bg-white dark:bg-[#101922] border-r border-slate-200 dark:border-slate-800 shadow-xl flex flex-col overflow-y-auto">
            <div className="px-4 pt-5 pb-2">
              {/* Main nav links — only shown in drawer on smaller screens since header hides them */}
              <div className="md:hidden mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Main</p>
                <nav className="space-y-0.5">
                  {TOP_NAV_LINKS.map(l => {
                    const isActive = active ? l.label === active : currentPath === l.href;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                        {l.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 mb-2">Trackers</p>
              <nav className="space-y-0.5">
                {DRAWER_LINKS.map(l => {
                  const isActive = active ? l.label === active : currentPath === l.href;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                      {l.label}
                    </Link>
                  );
                })}
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">settings</span>
                Settings
              </Link>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

// ─── Project data ─────────────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  modified: string;
  status: 'In Progress' | 'Planning' | 'Archived' | 'Sold';
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

const SEED_PROJECTS: Project[] = [
  { id: '1', name: 'Custom Keyboard Build', modified: 'Modified 2 days ago', status: 'In Progress', forSale: true, sourced: 6, total: 12, spent: 800, targetPrice: 1500, estProfit: 300, gradient: 'from-blue-800 to-blue-500', icon: 'keyboard' },
  { id: '2', name: 'Home Studio Setup', modified: 'Created 1 week ago', status: 'Planning', forSale: false, sourced: 4, total: 10, spent: 2500, budget: 5000, gradient: 'from-amber-700 to-orange-500', icon: 'mic' },
  { id: '3', name: 'Gaming PC 2024', modified: 'Modified 5 hours ago', status: 'In Progress', forSale: true, sourced: 8, total: 15, spent: 1500, targetPrice: 2800, estProfit: 600, gradient: 'from-emerald-800 to-teal-500', icon: 'computer' },
  { id: '4', name: 'Living Room Refresh', modified: 'Created 3 days ago', status: 'Planning', forSale: false, sourced: 2, total: 8, spent: 400, budget: 1000, gradient: 'from-purple-800 to-violet-500', icon: 'weekend' },
  { id: '5', name: 'Mechanical Watch Collection', modified: 'Modified 1 day ago', status: 'Archived', forSale: false, sourced: 5, total: 5, spent: 3200, budget: 3200, gradient: 'from-slate-700 to-slate-500', icon: 'watch' },
  { id: '6', name: 'Keycap Proxy Sale', modified: 'Sold last month', status: 'Sold', forSale: false, sourced: 10, total: 10, spent: 600, targetPrice: 900, estProfit: 180, gradient: 'from-rose-800 to-pink-500', icon: 'format_color_text' },
];

const STATUS_BADGE: Record<string, string> = {
  'In Progress': 'bg-blue-500 text-white',
  'Planning': 'bg-amber-500 text-white',
  'Archived': 'bg-slate-500 text-white',
  'Sold': 'bg-emerald-500 text-white',
};

type FilterTab = 'Active' | 'Archived' | 'For Sale';

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProjectsOverview() {
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('Active');
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    apiGet<{ projects: Project[] }>('/api/projects')
      .then(({ projects: p }) => { if (p.length > 0) setProjects(p); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (getToken()) {
      const token = getToken();
      fetch(`http://localhost:4000/api/projects/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {});
    }
  }

  async function handleStatusChange(id: string, status: Project['status']) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    if (getToken()) {
      apiPatch(`/api/projects/${id}`, { status }).catch(() => {});
    }
  }

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'Active' ? (p.status === 'In Progress' || p.status === 'Planning') :
      filter === 'Archived' ? (p.status === 'Archived' || p.status === 'Sold') :
      filter === 'For Sale' ? p.forSale : true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="Projects" />

      <main className="flex-1 flex flex-col overflow-y-auto">

        <div className="p-6 md:p-8">
          {/* Page title + controls */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-1">Active Projects</h2>
              <p className="text-slate-500 text-sm">Manage your ongoing builds and source components at the best prices.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative hidden md:block">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                <input
                  className="w-52 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500/50 rounded-lg pl-9 pr-4 py-1.5 text-sm outline-none transition-all"
                  placeholder="Search projects..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Filter tabs */}
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex">
                {(['Active', 'Archived', 'For Sale'] as FilterTab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${filter === t ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-pulse">
                  <div className="aspect-video bg-slate-200 dark:bg-slate-700" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : (
              filtered.map(p => <ProjectCard key={p.id} project={p} onDelete={handleDelete} onStatusChange={handleStatusChange} />)
            )}

            {/* New project tile */}
            <div
              onClick={() => setShowNewModal(true)}
              className="bg-slate-100/50 dark:bg-slate-800/20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center p-8 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-all cursor-pointer group min-h-64"
            >
              <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-3xl">add</span>
              </div>
              <p className="font-bold">Create New Project</p>
              <p className="text-sm text-slate-500 text-center mt-2 max-w-48">Start tracking a new build and find the best component prices.</p>
            </div>
          </div>

          {showNewModal && (
            <NewProjectModal
              onClose={() => setShowNewModal(false)}
              onCreate={p => setProjects(prev => [p, ...prev])}
            />
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#101922]/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-6 pb-5 pt-3 flex justify-around items-center">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-[22px]">home</span>
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link href="/projects" className="flex flex-col items-center gap-1 text-blue-500">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>workspaces</span>
          <span className="text-[10px] font-bold">Projects</span>
        </Link>
        <Link href="/active-deals" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-[22px]">sell</span>
          <span className="text-[10px] font-bold">Deals</span>
        </Link>
        <Link href="/my-electronics" className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-[22px]">memory</span>
          <span className="text-[10px] font-bold">Parts</span>
        </Link>
      </nav>
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project: p, onDelete, onStatusChange }: { project: Project; onDelete: (id: string) => void; onStatusChange: (id: string, s: Project['status']) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const pct = p.total > 0 ? Math.round((p.sourced / p.total) * 100) : 0;
  return (
    <Link href={`/project?id=${p.id}`}>
      <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden hover:border-blue-500 transition-all group cursor-pointer">
        {/* Image / gradient header */}
        <div className="aspect-video relative overflow-hidden">
          <div className={`absolute inset-0 bg-linear-to-br ${p.gradient} flex items-center justify-center transition-transform duration-500 group-hover:scale-105`}>
            {p.image && !imgErr
              ? <img src={p.image} alt={p.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
              : <span className="material-symbols-outlined text-white/30 text-8xl">{p.icon}</span>
            }
          </div>
          <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[p.status]}`}>{p.status}</span>
            {p.forSale && <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">For Sale</span>}
          </div>
        </div>

        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-base mb-1">{p.name}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                {p.modified}
              </p>
            </div>
            <div className="relative" onClick={e => e.preventDefault()}>
              <button
                onClick={() => setShowMenu(v => !v)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-400"
              >
                <span className="material-symbols-outlined">more_vert</span>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-20">
                  {(['In Progress', 'Planning', 'Archived', 'Sold'] as Project['status'][]).map(s => (
                    <button key={s} onClick={() => { onStatusChange(p.id, s); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700">
                      Mark as {s}
                    </button>
                  ))}
                  <button onClick={() => onDelete(p.id)} className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    Delete project
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sourcing progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">Sourcing Progress</span>
              <span className="font-bold">{p.sourced} / {p.total} items</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Financial summary */}
          {p.forSale || p.status === 'Sold' ? (
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg">
              <div className="border-r border-slate-200 dark:border-slate-700 pr-2">
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Spent</p>
                <p className="font-bold text-blue-500">${p.spent.toLocaleString()}</p>
              </div>
              <div className="text-right pl-2">
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Target Price</p>
                <p className="font-bold">${(p.targetPrice ?? 0).toLocaleString()}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <p className="text-[10px] uppercase text-slate-500 font-bold">Est. Profit</p>
                <p className="font-bold text-emerald-500 text-sm">+${(p.estProfit ?? 0).toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg">
              <div>
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Budget</p>
                <p className="font-bold">${(p.budget ?? 0).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Spent</p>
                <p className="font-bold text-blue-500">${p.spent.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
// ─── New Project Modal ───────────────────────────────────────────────────
function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('workspaces');
  const [forSale, setForSale] = useState(false);
  const [budget, setBudget] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ICONS = ['workspaces', 'keyboard', 'computer', 'mic', 'memory', 'videogame_asset', 'weekend', 'watch', 'headphones', 'camera_alt', 'phone_iphone', 'desktop_windows'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (getToken()) {
        const { project } = await apiPost<{ project: Project }>('/api/projects', {
          name, icon, forSale,
          ...(forSale ? { targetPrice: Number(targetPrice) || undefined } : { budget: Number(budget) || undefined }),
        });
        onCreate(project);
      } else {
        // Offline / no-auth fallback
        const GRADIENTS = ['from-blue-800 to-blue-500','from-amber-700 to-orange-500','from-emerald-800 to-teal-500','from-purple-800 to-violet-500'];
        const project: Project = {
          id: Date.now().toString(), name, icon, status: 'Planning', forSale,
          sourced: 0, total: 0, spent: 0,
          ...(forSale ? { targetPrice: Number(targetPrice) || 0, estProfit: 0 } : { budget: Number(budget) || 0 }),
          gradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
          modified: 'Just now',
        };
        onCreate(project);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold">New Project</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <div>
            <label className="block text-sm font-medium mb-1.5">Project name</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Custom Keyboard Build"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(ic => (
                <button
                  key={ic} type="button"
                  onClick={() => setIcon(ic)}
                  className={`p-2 rounded-lg border transition-colors ${icon === ic ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-slate-200 dark:border-slate-600 hover:border-blue-500/50'}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForSale(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${forSale ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-600'}`}
            >
              <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${forSale ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm font-medium">Building for sale</span>
          </div>
          {forSale ? (
            <div>
              <label className="block text-sm font-medium mb-1.5">Target sale price ($)</label>
              <input type="number" min="0" value={targetPrice} onChange={e => setTargetPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1.5">Budget ($)</label>
              <input type="number" min="0" value={budget} onChange={e => setBudget(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60">
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
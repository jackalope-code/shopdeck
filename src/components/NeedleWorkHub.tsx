import React from 'react';
import Link from 'next/link';
import { TopNav } from './ProjectsOverview';
import { useFeedData } from '../lib/ShopdataContext';
import HistoryAwareLink from './HistoryAwareLink';

function FeedPreview({ widgetId, trackerHref, trackerLabel, icon, iconClass }: {
  widgetId: string; trackerHref: string; trackerLabel: string; icon: string; iconClass: string;
}) {
  const { loading, items } = useFeedData(widgetId);
  const preview = items.slice(0, 5);
  return (
    <div className="flex flex-col gap-2">
      {loading ? (
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse">
            <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
            </div>
          </div>
        ))
      ) : preview.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No items yet — sources are warming up.</p>
      ) : (
        preview.map((item, i) => {
          const price = item.price ? parseFloat(String(item.price).replace(/[^0-9.]/g, '')) : null;
          return (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className={`shrink-0 flex items-center justify-center size-8 rounded-lg ${iconClass.replace('text-', 'bg-').replace(/-\d{3}$/, m => m + '/10')}`}>
                <span className={`material-symbols-outlined text-[16px] ${iconClass}`}>{icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-tight truncate">
                  {item.url
                    ? <HistoryAwareLink href={item.url} item={{ url: item.url, name: item.name, image: item.image, price: item.price ?? '', vendor: item._vendor ?? '', category: widgetId }} className="hover:underline hover:text-blue-500 transition-colors">{item.name}</HistoryAwareLink>
                    : item.name}
                </p>
                <p className="text-[10px] text-slate-400">{item._vendor}</p>
              </div>
              {price != null && price > 0 && <p className="text-xs font-bold shrink-0">${price.toFixed(2)}</p>}
            </div>
          );
        })
      )}
      <Link href={trackerHref} className="flex items-center justify-center gap-1 mt-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors py-1">
        {trackerLabel}
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
  );
}

function SectionCard({ title, icon, iconClass, children }: { title: string; icon: string; iconClass: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className={`material-symbols-outlined text-[22px] ${iconClass}`}>{icon}</span>
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function NeedleWorkHub() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      <TopNav active="NeedleWork" />
      <header className="sticky top-14 z-50 bg-[#f5f7f8]/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center px-4 py-3 gap-3 max-w-3xl mx-auto w-full">
          <Link href="/dashboard" className="flex size-10 items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors md:hidden">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Needle Work</h1>
            <p className="text-xs text-slate-400">Knitting, crochet, quilting & sewing deals</p>
          </div>
        </div>
      </header>
      <main className="pb-24 md:pb-6">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Needle Work Deals" icon="sell" iconClass="text-amber-500">
            <FeedPreview widgetId="needlework-deals" trackerHref="/active-deals" trackerLabel="View all needle work deals" icon="sell" iconClass="text-amber-500" />
          </SectionCard>
          <SectionCard title="Knitting" icon="texture" iconClass="text-purple-400">
            <FeedPreview widgetId="needlework-knitting" trackerHref="/dashboard" trackerLabel="View knitting supplies" icon="texture" iconClass="text-purple-400" />
          </SectionCard>
          <SectionCard title="Crochet" icon="gesture" iconClass="text-pink-400">
            <FeedPreview widgetId="needlework-crochet" trackerHref="/dashboard" trackerLabel="View crochet supplies" icon="gesture" iconClass="text-pink-400" />
          </SectionCard>
          <SectionCard title="Quilting" icon="grid_4x4" iconClass="text-rose-500">
            <FeedPreview widgetId="needlework-quilting" trackerHref="/dashboard" trackerLabel="View quilting supplies" icon="grid_4x4" iconClass="text-rose-500" />
          </SectionCard>
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] px-2 py-2">
        {[
          { href: '/dashboard', label: 'Dashboard', icon: 'grid_view' },
          { href: '/active-deals', label: 'Deals', icon: 'sell' },
          { href: '/needle-work', label: 'Needle Work', icon: 'texture' },
        ].map(n => (
          <Link key={n.href} href={n.href} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-blue-500 transition-colors">
            <span className="material-symbols-outlined text-[22px]">{n.icon}</span>
            <span className="text-[10px] font-semibold">{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

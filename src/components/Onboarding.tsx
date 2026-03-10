'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ALL_WIDGETS } from './Dashboard';
import { getToken, apiPatch } from '../lib/auth';

// ─── Category definitions ────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'keyboards', label: 'Keyboard Enthusiast', icon: 'keyboard', description: 'Group buys, switches & keycaps' },
  { id: 'electronics', label: 'Electronics Maker', icon: 'memory', description: 'Components, MCUs & sensors' },
  { id: '3dprinting', label: '3D Printing', icon: 'precision_manufacturing', description: 'Filament, printers & hardware' },
  { id: 'robotics', label: 'Robotics', icon: 'smart_toy', description: 'Actuators, sensors & kits' },
  { id: 'audio', label: 'Audio', icon: 'headset', description: 'DACs, amps & speakers' },
];

// Map onboarding category → widget categories in registry
const CAT_WIDGET_MAP: Record<string, string[]> = {
  keyboards: ['Keyboards'],
  electronics: ['Electronics'],
  '3dprinting': ['Overview'],
  robotics: ['Overview'],
  audio: ['Electronics'],
};

const STORAGE_KEY_ONBOARDED = 'sd-onboarded';
const STORAGE_KEY_WIDGETS = 'sd-active-widgets';

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: 1 | 2 }) {
  const pct = step === 1 ? 33 : 66;
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Step 1: category selection ──────────────────────────────────────────────
function StepCategories({
  selected,
  onToggle,
  onContinue,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">What do you shop for?</h1>
          <p className="text-sm text-slate-500 mt-1">
            Select your interests so we can set up the right widgets for you.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">You can change these in Settings at any time.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {CATEGORIES.map(cat => {
            const active = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => onToggle(cat.id)}
                className={`flex items-center gap-4 rounded-xl p-4 border-2 text-left transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 transition-colors ${
                    active ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{cat.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className={`font-bold text-sm ${active ? 'text-blue-500' : ''}`}>{cat.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{cat.description}</p>
                </div>
                {active && (
                  <span className="ml-auto shrink-0 flex items-center justify-center size-5 rounded-full bg-blue-500 text-white">
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922]">
        <button
          onClick={onContinue}
          disabled={selected.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          Continue
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
        <p className="text-center text-[10px] text-slate-400 mt-3">
          {selected.length === 0
            ? 'Select at least one category to continue'
            : `${selected.length} category${selected.length > 1 ? ' categories' : ''} selected`}
        </p>
      </div>
    </>
  );
}

// ─── Step 2: widget selection ────────────────────────────────────────────────
function StepWidgets({
  selectedCategoryIds,
  enabledWidgets,
  onToggle,
  onBack,
  onFinish,
}: {
  selectedCategoryIds: string[];
  enabledWidgets: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  // Build sections: always show Projects + Overview widgets, plus widgets for each selected category
  const alwaysInclude = ALL_WIDGETS.filter(w => w.category === 'Projects' || w.category === 'Overview');

  const categoryWidgets = selectedCategoryIds.flatMap(catId => {
    const widgetCats = CAT_WIDGET_MAP[catId] ?? [];
    return ALL_WIDGETS.filter(w => widgetCats.includes(w.category));
  });

  // Deduplicate
  const seen = new Set<string>();
  const relevant = [...alwaysInclude, ...categoryWidgets].filter(w => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });

  // Group by widget category
  const groupMap = new Map<string, typeof relevant>();
  for (const w of relevant) {
    if (!groupMap.has(w.category)) groupMap.set(w.category, []);
    groupMap.get(w.category)!.push(w);
  }
  const groups = Array.from(groupMap.entries());

  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Choose your widgets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Toggle the widgets you want on your dashboard. You can always add or remove them later.
          </p>
        </div>

        {groups.map(([cat, widgets]) => (
          <div key={cat}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">{cat}</p>
            <div className="space-y-2">
              {widgets.map(w => {
                const enabled = enabledWidgets.includes(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => onToggle(w.id)}
                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                      enabled
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${enabled ? 'bg-blue-500/10' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <span className={`material-symbols-outlined text-[18px] ${enabled ? w.color : 'text-slate-400'}`}>{w.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{w.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{w.description}</p>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <div className="ml-4 shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors pointer-events-none">
                      <span
                        className={`block h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                      />
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] space-y-2">
        <button
          onClick={onFinish}
          disabled={enabledWidgets.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Finish &amp; View Dashboard
        </button>
        <button
          onClick={onBack}
          className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          ← Back
        </button>
        <p className="text-center text-[10px] text-slate-400">
          {enabledWidgets.length} widget{enabledWidgets.length !== 1 ? 's' : ''} selected
        </p>
      </div>
    </>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>([
    'active-projects', 'recent-activity', 'inventory-stats',
  ]);

  // Redirect if already onboarded
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY_ONBOARDED) === 'true') {
      router.replace('/dashboard');
    }
  }, []);

  const toggleCat = (id: string) =>
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleWidget = (id: string) =>
    setEnabledWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);

  const handleContinue = () => {
    // Auto-select a default widget per category
    const suggested: string[] = [];
    for (const catId of selectedCats) {
      const wCats = CAT_WIDGET_MAP[catId] ?? [];
      const first = ALL_WIDGETS.find(w => wCats.includes(w.category));
      if (first && !enabledWidgets.includes(first.id)) suggested.push(first.id);
    }
    if (suggested.length) setEnabledWidgets(prev => [...prev, ...suggested]);
    setStep(2);
  };

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(enabledWidgets));
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    // Sync to server so the API profile doesn't override localStorage on Dashboard load
    if (getToken()) {
      apiPatch('/api/profile', { activeWidgets: enabledWidgets }).catch(() => {});
    }
    // Dev-only: loop back to / so the always-onboarding demo flag can retrigger
    if (process.env.NODE_ENV !== 'production' &&
        localStorage.getItem('sd-dev-always-onboarding') === 'true') {
      router.push('/');
      return;
    }
    router.push('/dashboard');
  };

  return (
    <div className="flex h-screen flex-col bg-[#f5f7f8] dark:bg-[#101922] font-[Space_Grotesk,system-ui,sans-serif] text-slate-900 dark:text-slate-100">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922]">
        <div className="flex items-center gap-2 text-blue-500 font-bold">
          <span className="material-symbols-outlined text-2xl">inventory_2</span>
          <span className="text-base">ShopDeck</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">{step} of 2</span>
          <div className="w-32">
            <ProgressBar step={step} />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto">
        {step === 1 && (
          <StepCategories
            selected={selectedCats}
            onToggle={toggleCat}
            onContinue={handleContinue}
          />
        )}
        {step === 2 && (
          <StepWidgets
            selectedCategoryIds={selectedCats}
            enabledWidgets={enabledWidgets}
            onToggle={toggleWidget}
            onBack={() => setStep(1)}
            onFinish={handleFinish}
          />
        )}
      </div>
    </div>
  );
}

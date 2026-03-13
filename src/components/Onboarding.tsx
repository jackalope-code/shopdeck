'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ALL_WIDGETS } from './Dashboard';
import { getToken, apiPatch, isDemoAccount, clearToken } from '../lib/auth';

// ─── Category definitions ────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'keyboards', label: 'Keyboard Enthusiast', icon: 'keyboard', description: 'Full boards, parts, switches, keycaps, accessories' },
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
const STORAGE_KEY_NOTIFS = 'sd-browser-alerts';

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
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
          Continue
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
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

// ─── Step 3: browser notifications ─────────────────────────────────────────
function StepNotifications({
  enabled,
  permState,
  onToggle,
  onBack,
  onFinish,
}: {
  enabled: boolean;
  permState: NotificationPermission | 'unsupported';
  onToggle: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Stay in the loop</h1>
          <p className="text-sm text-slate-500 mt-1">
            Get browser alerts when prices drop, stock becomes available, or your watchlist items change.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">You can change this in Settings at any time.</p>
        </div>

        {/* Toggle card */}
        <button
          onClick={permState !== 'unsupported' ? onToggle : undefined}
          disabled={permState === 'unsupported'}
          className={`w-full flex items-center gap-4 rounded-2xl p-5 border-2 text-left transition-all ${
            enabled
              ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shrink-0 transition-colors ${
            enabled ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
          }`}>
            <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: enabled ? "'FILL' 1" : "'FILL' 0" }}>notifications</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-base ${enabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
              Browser notifications
            </p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Price drops, stock alerts, deal updates — delivered as native OS notifications.
            </p>
          </div>
          {/* Toggle switch */}
          <div className="ml-2 shrink-0 relative inline-flex h-7 w-13 items-center rounded-full pointer-events-none">
            <span className={`block h-7 w-13 rounded-full transition-colors ${enabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} style={{ width: 52, height: 28 }} />
            <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </div>
        </button>

        {/* Permission status / hint */}
        {permState === 'unsupported' && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Your browser doesn&apos;t support notifications.
          </div>
        )}
        {permState === 'denied' && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-xs text-red-700 dark:text-red-400">
            <span className="material-symbols-outlined text-[16px]">block</span>
            Notifications are blocked. Enable them in your browser&apos;s site settings.
          </div>
        )}
        {permState === 'granted' && enabled && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-400">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Permission granted — ShopDeck can send you notifications.
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] space-y-2">
        <button
          onClick={onFinish}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
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
      </div>
    </>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>([
    'active-projects', 'recent-activity', 'inventory-stats',
  ]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // Redirect if already onboarded
  useEffect(() => {
    setIsDemo(isDemoAccount());
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

  const handleToggleNotif = async () => {
    if (notifPerm === 'unsupported') return;
    if (!notifEnabled) {
      // Enabling — request permission if not already granted
      if (notifPerm !== 'granted') {
        const result = await Notification.requestPermission();
        setNotifPerm(result);
        if (result !== 'granted') return; // blocked or dismissed — don't enable
      }
      setNotifEnabled(true);
    } else {
      setNotifEnabled(false);
    }
  };

  const handleCancelDemo = () => {
    clearToken();
    localStorage.removeItem(STORAGE_KEY_ONBOARDED);
    router.replace('/login');
  };

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(enabledWidgets));
    localStorage.setItem(STORAGE_KEY_NOTIFS, notifEnabled ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    // Sync to server so the API profile doesn't override localStorage on Dashboard load
    // Demo accounts have no backend profile — skip the write.
    if (getToken() && !isDemoAccount()) {
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
          <span className="text-xs font-medium text-slate-400">{step} of 3</span>
          <div className="w-32">
            <ProgressBar step={step} />
          </div>
          {isDemo && (
            <button
              onClick={handleCancelDemo}
              title="Exit demo"
              className="ml-1 flex items-center justify-center size-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
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
            onFinish={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepNotifications
            enabled={notifEnabled}
            permState={notifPerm}
            onToggle={handleToggleNotif}
            onBack={() => setStep(2)}
            onFinish={handleFinish}
          />
        )}
      </div>
    </div>
  );
}

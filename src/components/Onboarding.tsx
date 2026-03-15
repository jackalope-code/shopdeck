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

<<<<<<< Updated upstream
// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const pct = step === 1 ? 33 : step === 2 ? 66 : 100;
=======
type UserType = 'regular' | 'hobbyist' | 'seller' | 'creator';
type ApiKeyFields = { cjApiKey: string; amazonAccessKey: string; amazonSecretKey: string; amazonPartnerTag: string };
type OnboardingStep = 'username' | 'type' | 1 | '1z' | 2 | 3 | 4 | 5 | 'plaid';

// ─── Step 1z: Garden zone picker ─────────────────────────────────────────────
function StepZone({
  zone,
  hideOutdoor,
  onZoneChange,
  onHideChange,
  onBack,
  onContinue,
}: {
  zone: number | null;
  hideOutdoor: boolean;
  onZoneChange: (z: number | null) => void;
  onHideChange: (v: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">What's your planting zone?</h1>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            ShopDeck uses your USDA Hardiness Zone to filter seeds and plants that won't survive your climate.
            You can always skip this and update it later in Settings.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
            USDA Hardiness Zone
          </label>
          <select
            value={zone ?? ''}
            onChange={e => onZoneChange(e.target.value === '' ? null : Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">I'm not sure / skip</option>
            {Array.from({ length: 13 }, (_, i) => i + 1).map(z => (
              <option key={z} value={z}>Zone {z}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            Not sure of your zone? Look it up at{' '}
            <a
              href="https://planthardiness.ars.usda.gov/"
              target="_blank"
              rel="noreferrer"
              className="text-green-600 hover:underline"
            >
              planthardiness.ars.usda.gov
            </a>.
          </p>
        </div>

        {zone !== null && (
          <button
            onClick={() => onHideChange(!hideOutdoor)}
            className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
              hideOutdoor
                ? 'border-green-500 bg-green-500/5'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-colors ${
              hideOutdoor ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: hideOutdoor ? "'FILL' 1" : "'FILL' 0" }}>filter_alt</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${ hideOutdoor ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-200' }`}>Hide out-of-zone plants</p>
              <p className="text-xs text-slate-400 mt-0.5">Suppress plants and seeds listed outside Zone {zone} in Garden feeds.</p>
            </div>
            <div className="ml-2 shrink-0 relative inline-flex items-center rounded-full pointer-events-none" style={{ width: 44, height: 24 }}>
              <span className="block rounded-full transition-colors" style={{ width: 44, height: 24, background: hideOutdoor ? '#22c55e' : undefined }} />
              <span className={`absolute block rounded-full bg-white shadow transition-transform ${ hideOutdoor ? 'translate-x-5' : 'translate-x-0.5' }`} style={{ width: 20, height: 20, top: 2, left: 2 }} />
            </div>
          </button>
        )}
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back
        </button>
        <button
          onClick={onContinue}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
        >
          Continue
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </>
  );
}

// ─── Step 0: user type selection ────────────────────────────────────────────
const USER_TYPE_OPTIONS: { value: UserType; icon: string; label: string; description: string }[] = [
  { value: 'regular',  icon: 'person',            label: 'Regular user',         description: 'Browse deals, track prices, build wishlists' },
  { value: 'hobbyist', icon: 'developer_board',   label: 'Electronics Hobbyist', description: 'Parts lookup via Mouser, DigiKey & Newegg' },
  { value: 'seller',   icon: 'storefront',        label: 'Seller',               description: 'Track competitor pricing, monitor deals' },
  { value: 'creator',  icon: 'video_camera_front', label: 'Content Creator',     description: 'Curate products to share with your audience' },
];

// ─── Step 0: Username ─────────────────────────────────────────────────────────
function StepUsername({ initialUsername, onContinue }: { initialUsername: string; onContinue: (username: string) => void }) {
  const [value, setValue] = useState(initialUsername);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const valid = /^[a-zA-Z0-9_]{3,20}$/.test(value);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setError('Username must be 3–20 characters: letters, numbers, and underscores only.'); return; }
    setSaving(true);
    setError('');
    try {
      await apiPatch('/api/profile', { username: value });
      onContinue(value);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save username';
      if (msg.includes('409') || msg.toLowerCase().includes('taken') || msg.toLowerCase().includes('already')) {
        setError('That username is already taken. Try another.');
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Choose your username</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          This is how you&apos;ll appear to the community. You can change it later in Settings.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
          <input
            type="text"
            autoComplete="username"
            value={value}
            onChange={e => { setValue(e.target.value); setError(''); }}
            placeholder="your_handle"
            maxLength={20}
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-slate-400">3–20 characters. Letters, numbers, and underscores only.</p>
          {error && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>{error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={saving || !value}
          className="w-full py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

function StepUserType({ onSelect }: { onSelect: (type: UserType) => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">What kind of user are you?</h1>
        <p className="text-sm text-slate-500 mt-1">
          This helps us tailor your default widgets and show the right setup options.
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">You can always update this in Settings.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {USER_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="flex items-center gap-4 rounded-xl p-4 border-2 text-left border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-500/5 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500">
              <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm">{opt.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step, showApiKeyStep, showPlaidStep }: { step: OnboardingStep; showApiKeyStep: boolean; showPlaidStep: boolean }) {
  const total = 6 + (showApiKeyStep ? 1 : 0) + (showPlaidStep ? 1 : 0);
  const pct =
    step === 'username' ? Math.round((1 / total) * 100) :
    step === 'type' ? Math.round((2 / total) * 100) :
    step === 1      ? Math.round((3 / total) * 100) :
    step === '1z'   ? Math.round((3.5 / total) * 100) :
    step === 2      ? Math.round((4 / total) * 100) :
    step === 3      ? Math.round((5 / total) * 100) :
    step === 4      ? Math.round((6 / total) * 100) :
    100;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  const [step, setStep] = useState<1 | 2 | 3>(1);
=======
  const [step, setStep] = useState<OnboardingStep>('username');
  const [username, setUsername] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const u = localStorage.getItem('sd-auth-user');
      return u ? (JSON.parse(u).username ?? '') : '';
    } catch { return ''; }
  });
  const [userType, setUserType] = useState<UserType | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyFields>({
    cjApiKey: '', amazonAccessKey: '', amazonSecretKey: '', amazonPartnerTag: '',
  });
  const [plantingZone, setPlantingZone] = useState<number | null>(null);
  const [hideOutdoorPlants, setHideOutdoorPlants] = useState(false);
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
  const features = useFeatures();
  const showApiKeyStep = userType === 'seller' || userType === 'creator';
  const showPlaidStep = features.plaid;
  const totalSteps = 6 + (showApiKeyStep ? 1 : 0) + (showPlaidStep ? 1 : 0);
  const stepLabel =
    step === 'username' ? '1' :
    step === 'type'  ? '2' :
    step === 1       ? '3' :
    step === '1z'    ? '3.5' :
    step === 2       ? '4' :
    step === 3       ? '5' :
    step === 4       ? '6' :
    step === 5       ? '7' :
    String(totalSteps);

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
        {step === 'username' && (
          <StepUsername
            initialUsername={username}
            onContinue={newUsername => { setUsername(newUsername); setStep('type'); }}
          />
        )}
        {step === 'type' && (
          <StepUserType
            onSelect={type => { setUserType(type); setStep(1); }}
          />
        )}
>>>>>>> Stashed changes
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

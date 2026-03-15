'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ALL_WIDGETS } from './Dashboard';
import { getToken, apiPatch, apiPost, apiGet, isDemoAccount, clearToken } from '../lib/auth';
import { usePlaidLink } from 'react-plaid-link';
import { useFeatures } from '../lib/features';

// ─── Category definitions ────────────────────────────────────────────────────
// Alphabetical order: Art, Audio, Automotive, Clothes, Crafts, Electronics,
// Garden, Games, Groceries, Home, Home Improvement, Keyboards, Needle Work,
// PC Building, Robotics, Shoes, Sports Equipment, 3D Printing
const CATEGORIES = [
  { id: 'art',              label: 'Art',             icon: 'palette',                description: 'Art supplies, prints & originals' },
  { id: 'audio',            label: 'Audio',           icon: 'headset',                description: 'DACs, amps & speakers' },
  { id: 'automotive',       label: 'Automotive',      icon: 'directions_car',         description: 'Auto parts, tools & accessories' },
  { id: 'clothes',          label: 'Clothes',         icon: 'checkroom',              description: 'Men\'s, women\'s & activewear deals' },
  { id: 'crafts',           label: 'Crafts',          icon: 'blur_circular',          description: 'Pottery, weaving & fiber arts' },
  { id: 'electronics',      label: 'Electronics Maker', icon: 'memory',              description: 'Components, MCUs & sensors' },
  { id: 'garden',           label: 'Garden',          icon: 'yard',                   description: 'Plants, seeds, tools & zone-aware tracking' },
  { id: 'games',            label: 'Games',           icon: 'sports_esports',         description: 'Video game & board game deals' },
  { id: 'groceries',        label: 'Groceries',       icon: 'local_grocery_store',    description: 'Weekly deals, produce & pantry staples' },
  { id: 'home',             label: 'Home',            icon: 'home',                   description: 'Home decor, furniture & kitchen' },
  { id: 'home-improvement', label: 'Home Improvement', icon: 'handyman',             description: 'Tools, building materials & DIY' },
  { id: 'keyboards',        label: 'Keyboard Enthusiast', icon: 'keyboard',          description: 'Full boards, parts, switches, keycaps, accessories' },
  { id: 'needle-work',      label: 'Needle Work',     icon: 'texture',               description: 'Knitting, crochet, quilting & yarn' },
  { id: 'pc-building',      label: 'PC Builder',      icon: 'computer',              description: 'CPUs, RAM, GPUs & component deals' },
  { id: 'robotics',         label: 'Robotics',        icon: 'smart_toy',             description: 'Actuators, sensors & kits' },
  { id: 'shoes',            label: 'Shoes',           icon: 'footprint',             description: 'Athletic, casual & shoe deals' },
  { id: 'sports',           label: 'Sports Equipment', icon: 'sports',              description: 'Baseball, basketball, soccer & more' },
  { id: '3dprinting',       label: '3D Printing',     icon: 'precision_manufacturing', description: 'Filament, printers & hardware' },
  { id: 'finance',          label: 'Budget & Spending', icon: 'account_balance',         description: 'Import CSV transactions, set budgets & track spend' },
];

// Map onboarding category → widget categories in registry
const CAT_WIDGET_MAP: Record<string, string[]> = {
  art:               ['Art'],
  audio:             ['Electronics'],
  automotive:        ['Automotive'],
  clothes:           ['Clothes'],
  crafts:            ['Crafts'],
  electronics:       ['Electronics'],
  garden:            ['Garden'],
  games:             ['Games'],
  groceries:         ['Groceries'],
  home:              ['Home'],
  'home-improvement':['Home Improvement'],
  keyboards:         ['Keyboards'],
  'needle-work':     ['Needle Work'],
  'pc-building':     ['PC Building'],
  robotics:          ['Overview'],
  shoes:             ['Shoes'],
  sports:            ['Sports Equipment'],
  '3dprinting':      ['3D Printing'],
  'finance':         ['Finance'],
};

type DashboardPreference = 'minimal' | 'balanced' | 'extensive';

// Per-category widget presets for each dashboard preference tier
const DASHBOARD_TIER_MAP: Record<string, Record<DashboardPreference, string[]>> = {
  art: {
    minimal:   ['art-supplies-deals'],
    balanced:  ['art-supplies-deals', 'art-supplies-new'],
    extensive: ['art-supplies-deals', 'art-supplies-new', 'art-prints'],
  },
  audio: {
    minimal:   ['electronics-watchlist'],
    balanced:  ['electronics-watchlist', 'electronics-new-drops', 'active-deals'],
    extensive: ['electronics-watchlist', 'electronics-new-drops', 'electronics-sales', 'active-deals'],
  },
  automotive: {
    minimal:   ['auto-deals'],
    balanced:  ['auto-deals', 'auto-parts'],
    extensive: ['auto-deals', 'auto-parts', 'auto-tools', 'auto-accessories'],
  },
  clothes: {
    minimal:   ['clothes-deals'],
    balanced:  ['clothes-deals', 'clothes-new'],
    extensive: ['clothes-deals', 'clothes-new', 'clothes-mens', 'clothes-womens', 'clothes-activewear'],
  },
  crafts: {
    minimal:   ['crafts-deals'],
    balanced:  ['crafts-deals', 'crafts-pottery'],
    extensive: ['crafts-deals', 'crafts-pottery', 'crafts-weaving'],
  },
  electronics: {
    minimal:   ['electronics-watchlist'],
    balanced:  ['electronics-watchlist', 'electronics-new-drops', 'electronics-sales', 'active-deals'],
    extensive: ['electronics-watchlist', 'electronics-new-drops', 'electronics-sales', 'electronics-microcontrollers', 'electronics-passives', 'electronics-sensors', 'electronics-motors', 'electronics-ics', 'electronics-encoders', 'electronics-power', 'electronics-connectors', 'electronics-displays', 'electronics-wireless', 'electronics-audio', 'active-deals'],
  },
  garden: {
    minimal:   ['garden-new-arrivals', 'garden-houseplants'],
    balanced:  ['garden-new-arrivals', 'garden-houseplants', 'garden-deals', 'garden-seeds'],
    extensive: ['garden-new-arrivals', 'garden-houseplants', 'garden-deals', 'garden-seeds', 'garden-trees-shrubs', 'garden-perennials', 'garden-tools'],
  },
  games: {
    minimal:   ['games-video-deals'],
    balanced:  ['games-video-deals', 'games-board-deals'],
    extensive: ['games-video-deals', 'games-video-new', 'games-board-deals', 'games-board-new', 'games-tabletop', 'games-deals'],
  },
  groceries: {
    minimal:   ['grocery-deals'],
    balanced:  ['grocery-deals', 'grocery-produce'],
    extensive: ['grocery-deals', 'grocery-produce', 'grocery-staples', 'grocery-meat-seafood'],
  },
  home: {
    minimal:   ['home-deals'],
    balanced:  ['home-deals', 'home-decor'],
    extensive: ['home-deals', 'home-decor', 'home-furniture', 'home-kitchen'],
  },
  'home-improvement': {
    minimal:   ['homeimprove-deals'],
    balanced:  ['homeimprove-deals', 'homeimprove-tools'],
    extensive: ['homeimprove-deals', 'homeimprove-tools', 'homeimprove-materials', 'homeimprove-plumbing', 'homeimprove-electrical'],
  },
  keyboards: {
    minimal:   ['keyboard-releases'],
    balanced:  ['keyboard-releases', 'keyboard-sales', 'keycaps-tracker'],
    extensive: ['keyboard-releases', 'keyboard-full-release', 'keyboard-parts-release', 'keyboard-switches', 'keyboard-accessories', 'keycaps-tracker', 'keyboard-sales', 'keyboard-comparison'],
  },
  'needle-work': {
    minimal:   ['needlework-deals'],
    balanced:  ['needlework-deals', 'needlework-knitting'],
    extensive: ['needlework-deals', 'needlework-knitting', 'needlework-crochet', 'needlework-quilting'],
  },
  'pc-building': {
    minimal:   ['ram-availability', 'gpu-availability'],
    balanced:  ['ram-availability', 'gpu-availability', 'pc-deals'],
    extensive: ['ram-availability', 'gpu-availability', 'cpu-availability', 'pc-deals'],
  },
  robotics: {
    minimal:   ['inventory-stats', 'active-projects'],
    balanced:  ['inventory-stats', 'active-projects', 'recent-activity'],
    extensive: ['inventory-stats', 'active-projects', 'recent-activity', 'favorite-products'],
  },
  shoes: {
    minimal:   ['shoes-deals'],
    balanced:  ['shoes-deals', 'shoes-new'],
    extensive: ['shoes-deals', 'shoes-new', 'shoes-athletic', 'shoes-casual'],
  },
  sports: {
    minimal:   ['sports-new-releases', 'sports-deals'],
    balanced:  ['sports-new-releases', 'sports-deals', 'sports-baseball', 'sports-basketball'],
    extensive: ['sports-new-releases', 'sports-deals', 'sports-baseball', 'sports-basketball', 'sports-football', 'sports-soccer', 'sports-volleyball'],
  },
  '3dprinting': {
    minimal:   ['3dp-printers', '3dp-filament'],
    balanced:  ['3dp-printers', '3dp-filament', '3dp-deals'],
    extensive: ['3dp-printers', '3dp-filament', '3dp-resins', '3dp-accessories', '3dp-deals'],
  },
  'finance': {
    minimal:   ['finance-recent-transactions'],
    balanced:  ['finance-recent-transactions', 'finance-budget'],
    extensive: ['finance-recent-transactions', 'finance-budget', 'finance-spend-by-category'],
  },
};

// Base widgets always included regardless of categories selected
const TIER_BASE: Record<DashboardPreference, string[]> = {
  minimal:   ['inventory-stats', 'active-projects'],
  balanced:  ['inventory-stats', 'active-projects', 'recent-activity'],
  extensive: ['inventory-stats', 'active-projects', 'recent-activity', 'favorite-products'],
};

const STORAGE_KEY_ONBOARDED = 'sd-onboarded';
const STORAGE_KEY_WIDGETS = 'sd-active-widgets';
const STORAGE_KEY_NOTIFS = 'sd-browser-alerts';

type UserType = 'regular' | 'hobbyist' | 'seller' | 'creator';
type ApiKeyFields = { cjApiKey: string; amazonAccessKey: string; amazonSecretKey: string; amazonPartnerTag: string };
type OnboardingStep = 'type' | 1 | '1z' | 2 | 3 | 4 | 5 | 'plaid';

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
  const total = 5 + (showApiKeyStep ? 1 : 0) + (showPlaidStep ? 1 : 0);
  const pct =
    step === 'type' ? Math.round((1 / total) * 100) :
    step === 1      ? Math.round((2 / total) * 100) :
    step === '1z'   ? Math.round((2.5 / total) * 100) :
    step === 2      ? Math.round((3 / total) * 100) :
    step === 3      ? Math.round((4 / total) * 100) :
    step === 4      ? Math.round((5 / total) * 100) :
    100;
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
  onSetAll,
  onContinue,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onSetAll: (ids: string[]) => void;
  onContinue: () => void;
}) {
  const [search, setSearch] = useState('');
  // Snapshot of selection before "Select All" was activated, so deselecting restores it.
  const [preSelectAllSnap, setPreSelectAllSnap] = useState<string[] | null>(null);
  const allSelected = preSelectAllSnap !== null;
  const searchLower = search.toLowerCase();

  function handleSelectAllToggle() {
    if (allSelected) {
      // Restore the pre-select-all snapshot
      onSetAll(preSelectAllSnap!);
      setPreSelectAllSnap(null);
    } else {
      setPreSelectAllSnap(selected);
      onSetAll(CATEGORIES.map(c => c.id));
    }
  }

  // Selected categories are always shown first so they can be deselected even when filtering.
  const filtered = search
    ? [
        ...CATEGORIES.filter(c => selected.includes(c.id)),
        ...CATEGORIES.filter(
          c =>
            !selected.includes(c.id) &&
            (c.label.toLowerCase().includes(searchLower) || c.description.toLowerCase().includes(searchLower))
        ),
      ]
    : CATEGORIES;

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

        {/* Search + Select All row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-9 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            onClick={handleSelectAllToggle}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
              allSelected
                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{allSelected ? 'deselect' : 'select_all'}</span>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {search && (
          <p className="text-[11px] text-slate-400 -mt-2">
            Showing {filtered.length} of {CATEGORIES.length}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {filtered.map(cat => {
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

// ─── Step 2: dashboard view preference ─────────────────────────────────────
const PREFERENCE_OPTIONS: { value: DashboardPreference; icon: string; label: string; description: string; recommended?: boolean }[] = [
  { value: 'minimal',   icon: 'tune',      label: 'Minimal',   description: 'Core trackers only — clean and focused' },
  { value: 'balanced',  icon: 'dashboard', label: 'Balanced',  description: 'Trackers + deals and new drops', recommended: true },
  { value: 'extensive', icon: 'grid_view', label: 'Extensive', description: 'Every widget for your selected categories' },
];

function StepDashboardPreference({
  selected,
  onSelect,
  onBack,
  onContinue,
}: {
  selected: DashboardPreference;
  onSelect: (p: DashboardPreference) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">How do you like your dashboard?</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pick a starting layout. You&apos;ll fine-tune individual widgets in the next step.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">You can always add or remove widgets later.</p>
        </div>

        <div className="space-y-3 pt-2">
          {PREFERENCE_OPTIONS.map(opt => {
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSelect(opt.value)}
                className={`w-full flex items-center gap-4 rounded-xl p-4 border-2 text-left transition-all ${
                  active
                    ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 transition-colors ${
                  active ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm ${active ? 'text-blue-500' : ''}`}>{opt.label}</p>
                    {opt.recommended && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{opt.description}</p>
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
      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] space-y-2">
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors"
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
      </div>
    </>
  );
}

// ─── Step 3: widget selection ────────────────────────────────────────────────
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
  finishLabel,
}: {
  enabled: boolean;
  permState: NotificationPermission | 'unsupported';
  onToggle: () => void;
  onBack: () => void;
  onFinish: () => void;
  finishLabel?: string;
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
          {finishLabel ? (
            <>
              {finishLabel}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Finish &amp; View Dashboard
            </>
          )}
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

// ─── Step 5: API keys (Seller / Content Creator only) ────────────────────────
function StepApiKeys({
  keys,
  setKeys,
  onSave,
  onSkip,
  onBack,
}: {
  keys: ApiKeyFields;
  setKeys: React.Dispatch<React.SetStateAction<ApiKeyFields>>;
  onSave: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const allEmpty = !keys.cjApiKey && !keys.amazonAccessKey && !keys.amazonSecretKey && !keys.amazonPartnerTag;

  function field(label: string, key: keyof ApiKeyFields, placeholder: string, hint: string, isSecret = false) {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <input
          type={isSecret ? 'password' : 'text'}
          autoComplete="off"
          value={keys[key]}
          onChange={e => setKeys(k => ({ ...k, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-mono placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Connect your APIs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Optional — add API keys now to unlock live product data. You can always do this later in Settings → API Keys.
          </p>
        </div>

        {/* Amber warning banner */}
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3">
          <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0 mt-0.5">warning</span>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Without API keys, live product data for <strong>plants &amp; garden</strong>, <strong>art supplies</strong>,{' '}
            <strong>home goods</strong>, and <strong>shoes</strong> won&apos;t load until keys are configured.
          </p>
        </div>

        {/* CJ Affiliate API card */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-500">hub</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">CJ Affiliate API</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Enables live feeds from Home Depot, Lowe&apos;s, Dick Blick, Wayfair, Zappos, JOANN, and other CJ retailers.
              Requires a{' '}
              <a href="https://developers.cj.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                CJ Affiliate personal access token
              </a>.
            </p>
            {field('CJ Personal Access Token', 'cjApiKey', 'your-cj-token', 'From your CJ developer account — stored encrypted', true)}
          </div>
        </div>

        {/* Amazon PA API card */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-orange-400">deployed_code</span>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Amazon Product Advertising API</h3>
            <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">Optional</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-2.5">
              <span className="material-symbols-outlined text-[15px] text-blue-500 shrink-0 mt-0.5">info</span>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                The Amazon PA API requires an active Associates account with at least 3 qualifying sales in the past 180 days.
                If you&apos;re not approved yet, skip this and add the keys in Settings once approved.
              </p>
            </div>
            {field('Access Key ID', 'amazonAccessKey', 'AKIAIOSFODNN7EXAMPLE', 'From the PA API credentials page')}
            {field('Secret Access Key', 'amazonSecretKey', '••••••••', 'Never share this — stored encrypted on the server', true)}
            {field('Partner / Associate Tag', 'amazonPartnerTag', 'yourtag-20', 'Your Associates store ID, e.g. mystore-20')}
          </div>
        </div>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] space-y-2">
        <button
          onClick={onSave}
          disabled={allEmpty}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-bold text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Save &amp; Finish
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Skip for now →
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

// ─── Step Plaid: bank account linking ────────────────────────────────────────
function StepPlaid({
  isDemo,
  onFinish,
}: {
  isDemo: boolean;
  onFinish: () => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (publicToken) => {
      try {
        setLoading(true);
        const res = await apiPost<{ institution_name: string; account_count: number }>(
          '/api/plaid/exchange',
          { public_token: publicToken },
        );
        setLinked({ name: res.institution_name || 'Your bank' });
      } catch {
        setError('Failed to link account. You can try again from Settings.');
      } finally {
        setLoading(false);
      }
    },
  });

  const handleConnect = async () => {
    if (!linkToken) {
      try {
        setLoading(true);
        const res = await apiGet<{ link_token: string }>('/api/plaid/link-token');
        setLinkToken(res.link_token);
      } catch {
        setError('Could not start account linking. Please try again.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    open();
  };

  if (isDemo) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
        <span className="material-symbols-outlined text-5xl text-slate-400">lock</span>
        <div>
          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Bank account linking is not available in demo mode
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create a free account to connect your bank and track spending automatically.
          </p>
        </div>
        <button
          onClick={onFinish}
          className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Finish Setup
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-8 gap-6 overflow-y-auto">
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">Link a bank account</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Automatically import transactions and track your spending — no manual CSV uploads.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 text-sm text-blue-800 dark:text-blue-300 flex gap-3">
        <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">shield</span>
        <span>Your credentials are never stored. ShopDeck uses Plaid to connect securely — the same technology used by Venmo, Robinhood, and thousands of other apps.</span>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {linked ? (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-4">
          <span className="material-symbols-outlined text-green-500">check_circle</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{linked.name} linked!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Transactions will sync in the background.</p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading || (!!linkToken && !ready)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
        >
          {loading && <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>}
          Connect account
        </button>
      )}

      <div className="mt-auto pt-4 flex flex-col items-center gap-3">
        <button
          onClick={onFinish}
          className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Finish Setup
        </button>
        <button
          onClick={onFinish}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('type');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyFields>({
    cjApiKey: '', amazonAccessKey: '', amazonSecretKey: '', amazonPartnerTag: '',
  });
  const [plantingZone, setPlantingZone] = useState<number | null>(null);
  const [hideOutdoorPlants, setHideOutdoorPlants] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [dashPref, setDashPref] = useState<DashboardPreference>('balanced');
  const [enabledWidgets, setEnabledWidgets] = useState<string[]>([
    'active-projects', 'recent-activity', 'inventory-stats',
  ]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  const features = useFeatures();
  const showApiKeyStep = userType === 'seller' || userType === 'creator';
  const showPlaidStep = features.plaid;
  const totalSteps = 5 + (showApiKeyStep ? 1 : 0) + (showPlaidStep ? 1 : 0);
  const stepLabel =
    step === 'type'  ? '1' :
    step === 1       ? '2' :
    step === '1z'    ? '2.5' :
    step === 2       ? '3' :
    step === 3       ? '4' :
    step === 4       ? '5' :
    step === 5       ? '6' :
    String(totalSteps);

  // Redirect if already onboarded
  useEffect(() => {
    setIsDemo(isDemoAccount());
    if (localStorage.getItem(STORAGE_KEY_ONBOARDED) === 'true') {
      router.replace('/dashboard');
    }
  }, []);

  // Pre-select the electronics category for hobbyists so widget tier presets pick it up
  useEffect(() => {
    if (userType === 'hobbyist') {
      setSelectedCats(prev => prev.includes('electronics') ? prev : [...prev, 'electronics']);
    }
  }, [userType]);

  const toggleCat = (id: string) =>
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleWidget = (id: string) =>
    setEnabledWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);

  const handlePreferenceContinue = (pref: DashboardPreference) => {
    const catWidgets = selectedCats.flatMap(id => DASHBOARD_TIER_MAP[id]?.[pref] ?? []);
    setEnabledWidgets([...new Set([...TIER_BASE[pref], ...catWidgets])]);
    setStep(3);
  };

  const handleCategoryStep1Continue = () => {
    if (selectedCats.includes('garden')) {
      setStep('1z');
    } else {
      setStep(2);
    }
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

  const handleFinish = async (extraApiKeys?: ApiKeyFields) => {
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(enabledWidgets));
    localStorage.setItem(STORAGE_KEY_NOTIFS, notifEnabled ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEY_ONBOARDED, 'true');
    if (userType) localStorage.setItem('sd-user-type', userType);
    // Await the PATCH before navigating so Dashboard's GET /api/profile sees the
    // updated activeWidgets — without this, the GET can race ahead of the PATCH
    // and return stale registration defaults, overwriting the onboarding selection.
    // Demo accounts have no backend profile — skip the write.
    if (getToken() && !isDemoAccount()) {
      const profilePatch: Record<string, unknown> = { activeWidgets: enabledWidgets };
      if (plantingZone !== null) {
        profilePatch.plantingZone = plantingZone;
        profilePatch.hideOutdoorPlants = hideOutdoorPlants;
      }
      if (extraApiKeys && Object.values(extraApiKeys).some(v => v)) {
        profilePatch.apiKeys = extraApiKeys;
      }
      await apiPatch('/api/profile', profilePatch).catch(() => {});
    }
    // Dev-only: loop back to / so the always-onboarding demo flag can retrigger
    if (process.env.NODE_ENV !== 'production' &&
        localStorage.getItem('sd-dev-always-onboarding') === 'true') {
      router.push('/');
      return;
    }
    localStorage.setItem('sd-onboarding-complete', 'true');
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
          <span className="text-xs font-medium text-slate-400">{stepLabel} of {totalSteps}</span>
          <div className="w-32">
            <ProgressBar step={step} showApiKeyStep={showApiKeyStep} showPlaidStep={showPlaidStep} />
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
        {step === 'type' && (
          <StepUserType
            onSelect={type => { setUserType(type); setStep(1); }}
          />
        )}
        {step === 1 && (
          <StepCategories
            selected={selectedCats}
            onToggle={toggleCat}
            onSetAll={setSelectedCats}
            onContinue={handleCategoryStep1Continue}
          />
        )}
        {step === '1z' && (
          <StepZone
            zone={plantingZone}
            hideOutdoor={hideOutdoorPlants}
            onZoneChange={setPlantingZone}
            onHideChange={setHideOutdoorPlants}
            onBack={() => setStep(1)}
            onContinue={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepDashboardPreference
            selected={dashPref}
            onSelect={setDashPref}
            onBack={() => setStep(1)}
            onContinue={() => handlePreferenceContinue(dashPref)}
          />
        )}
        {step === 3 && (
          <StepWidgets
            selectedCategoryIds={selectedCats}
            enabledWidgets={enabledWidgets}
            onToggle={toggleWidget}
            onBack={() => setStep(2)}
            onFinish={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <StepNotifications
            enabled={notifEnabled}
            permState={notifPerm}
            onToggle={handleToggleNotif}
            onBack={() => setStep(3)}
            onFinish={
              showApiKeyStep ? () => setStep(5) :
              showPlaidStep  ? () => setStep('plaid') :
              handleFinish
            }
            finishLabel={(showApiKeyStep || showPlaidStep) ? 'Continue' : undefined}
          />
        )}
        {step === 5 && (
          <StepApiKeys
            keys={apiKeys}
            setKeys={setApiKeys}
            onSave={() => showPlaidStep ? setStep('plaid') : handleFinish(apiKeys)}
            onSkip={() => showPlaidStep ? setStep('plaid') : handleFinish()}
            onBack={() => setStep(4)}
          />
        )}
        {step === 'plaid' && (
          <StepPlaid
            isDemo={isDemo}
            onFinish={handleFinish}
          />
        )}
      </div>
    </div>
  );
}

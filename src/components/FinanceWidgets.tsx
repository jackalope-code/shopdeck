'use client';
import React, { useEffect, useState } from 'react';
import { apiGet, apiPatch, apiPut } from '../lib/auth';
import { isDemoAccount } from '../lib/auth';
import { useFeatures } from '../lib/features';

// ─── Shared types ─────────────────────────────────────────────────────────────
interface FinanceTransaction {
  id: string;
  transaction_date: string;
  merchant_name: string;
  amount: number;
  raw_category: string | null;
  shopdeck_category: string | null;
  user_label: string | null;
}
interface FinanceSummaryRow {
  shopdeck_category: string | null;
  spent: string;
  count: string;
}
interface FinanceBudget {
  category: string;
  monthly_limit: string;
}

const CAT_LABELS: Record<string, string> = {
  art: 'Art', audio: 'Audio', automotive: 'Automotive', clothes: 'Clothes',
  crafts: 'Crafts', electronics: 'Electronics', garden: 'Garden', games: 'Games',
  groceries: 'Groceries', home: 'Home', 'home-improvement': 'Home Improvement',
  keyboards: 'Keyboards', 'needle-work': 'Needle Work', 'pc-building': 'PC Building',
  robotics: 'Robotics', shoes: 'Shoes', sports: 'Sports', '3dprinting': '3D Printing',
  finance: 'Finance',
};

const SHOPDECK_CATEGORIES = Object.keys(CAT_LABELS);

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(amount));
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
      <span className="material-symbols-outlined text-3xl">{icon}</span>
      <p className="text-xs text-center px-4">{message}</p>
    </div>
  );
}

// ─── Recent Transactions Widget ───────────────────────────────────────────────
export function FinanceRecentTransactionsWidget() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCat, setEditCat] = useState('');

  useEffect(() => {
    apiGet<{ transactions: FinanceTransaction[] }>('/api/finance/transactions?limit=20')
      .then(d => setTransactions(d.transactions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveTag(id: string) {
    try {
      const updated = await apiPatch<{ id: string; shopdeck_category: string | null; user_label: string | null }>(
        `/api/finance/transactions/${id}/tag`,
        { shopdeck_category: editCat || null },
      );
      setTransactions(prev =>
        prev.map(t => t.id === id ? { ...t, shopdeck_category: updated.shopdeck_category } : t),
      );
    } catch { /* keep previous value on error */ }
    setEditingId(null);
  }

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!transactions.length) {
    return <EmptyState icon="receipt_long" message="No transactions yet. Import a bank CSV from Settings → Accounts." />;
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {transactions.map(tx => (
        <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate">{tx.merchant_name}</p>
            <p className="text-[11px] text-slate-400">{tx.transaction_date}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingId === tx.id ? (
              <div className="flex items-center gap-1">
                <select
                  value={editCat}
                  onChange={e => setEditCat(e.target.value)}
                  className="text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {SHOPDECK_CATEGORIES.map(c => (
                    <option key={c} value={c}>{CAT_LABELS[c]}</option>
                  ))}
                </select>
                <button
                  onClick={() => saveTag(tx.id)}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-[11px] px-1.5 py-0.5 rounded-md text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setEditingId(tx.id); setEditCat(tx.shopdeck_category ?? ''); }}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  {tx.shopdeck_category ? (CAT_LABELS[tx.shopdeck_category] ?? tx.shopdeck_category) : 'Tag…'}
                </button>
                <span className={`text-xs font-semibold tabular-nums ${tx.amount < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {tx.amount < 0 ? `−${fmt(tx.amount)}` : `+${fmt(tx.amount)}`}
                </span>
              </>
            )}
          </div>
        </div>
      ))}
      <div className="px-4 py-2 text-[11px] text-slate-400 text-center">
        Import data &amp; manage categories in Settings → Accounts
      </div>
    </div>
  );
}

// ─── Budget Widget ─────────────────────────────────────────────────────────────
export function FinanceBudgetWidget() {
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [summary, setSummary] = useState<FinanceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet<{ budgets: FinanceBudget[] }>('/api/finance/budgets'),
      apiGet<{ month: string; summary: FinanceSummaryRow[]; total_transactions: number }>('/api/finance/summary'),
    ])
      .then(([b, s]) => { setBudgets(b.budgets); setSummary(s.summary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveBudget(category: string) {
    const val = parseFloat(editVal);
    if (isNaN(val) || val < 0) { setEditing(null); return; }
    try {
      await apiPut<{ ok: boolean }>('/api/finance/budgets', { budgets: [{ category, monthly_limit: val }] });
      setBudgets(prev => {
        const existing = prev.find(b => b.category === category);
        if (existing) return prev.map(b => b.category === category ? { ...b, monthly_limit: String(val) } : b);
        return [...prev, { category, monthly_limit: String(val) }];
      });
    } catch { /* retain old value */ }
    setEditing(null);
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
      </div>
    );
  }

  if (!budgets.length && !summary.length) {
    return (
      <EmptyState
        icon="savings"
        message="Import a bank CSV from Settings → Accounts, then click any row here to set a monthly budget."
      />
    );
  }

  const allCats = Array.from(new Set([
    ...budgets.map(b => b.category),
    ...summary.map(s => s.shopdeck_category ?? 'uncategorized'),
  ]));

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {allCats.map(cat => {
        const budget = budgets.find(b => b.category === cat);
        const spendRow = summary.find(s => s.shopdeck_category === cat);
        const spent = parseFloat(spendRow?.spent ?? '0');
        const limit = parseFloat(budget?.monthly_limit ?? '0');
        const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const over = limit > 0 && spent > limit;

        return (
          <div key={cat} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {CAT_LABELS[cat] ?? cat}
              </span>
              {editing === cat ? (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400">$</span>
                  <input
                    type="number" min="0" step="10"
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    className="w-20 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveBudget(cat)} className="text-[11px] px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600">Set</button>
                  <button onClick={() => setEditing(null)} className="text-[11px] text-slate-400 hover:text-slate-600">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditing(cat); setEditVal(budget?.monthly_limit ?? ''); }}
                  className="text-[11px] text-slate-400 hover:text-blue-500 transition-colors flex items-center gap-0.5"
                >
                  {limit > 0 ? `${fmt(spent)} / ${fmt(limit)}` : `${fmt(spent)} — set budget`}
                  <span className="material-symbols-outlined text-[13px] align-text-bottom ml-0.5">edit</span>
                </button>
              )}
            </div>
            {limit > 0 && (
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Spend by Category Widget ──────────────────────────────────────────────────
export function FinanceSpendByCategoryWidget() {
  const [summary, setSummary] = useState<FinanceSummaryRow[]>([]);
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ month: string; summary: FinanceSummaryRow[]; total_transactions: number }>('/api/finance/summary')
      .then(d => { setSummary(d.summary.filter(s => parseFloat(s.spent) > 0)); setMonth(d.month); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-7 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
      </div>
    );
  }

  if (!summary.length) {
    return <EmptyState icon="bar_chart" message="No spending data this month. Import a bank CSV from Settings → Accounts." />;
  }

  const maxSpent = Math.max(...summary.map(s => parseFloat(s.spent)));
  const total    = summary.reduce((acc, s) => acc + parseFloat(s.spent), 0);

  return (
    <div className="flex flex-col px-4 py-3 gap-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {month
            ? new Date(month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : 'This month'
          }
        </span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{fmt(total)} total</span>
      </div>
      {summary.map(row => {
        const spent = parseFloat(row.spent);
        const pct   = maxSpent > 0 ? (spent / maxSpent) * 100 : 0;
        const cat   = row.shopdeck_category;
        return (
          <div key={cat ?? 'uncategorized'} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 w-28 shrink-0 truncate">
              {cat ? (CAT_LABELS[cat] ?? cat) : 'Uncategorized'}
            </span>
            <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums w-16 text-right shrink-0">
              {fmt(spent)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Account Balances (Plaid) ─────────────────────────────────────────────────
type PlaidAccountRow = {
  item_id: string;
  institution_name: string;
  account_id: string;
  name: string;
  type: string;
  subtype: string;
  mask: string | null;
  available: number | null;
  current: number | null;
  iso_currency_code: string | null;
};

export function FinanceAccountBalanceWidget() {
  const features = useFeatures();
  const isDemo   = isDemoAccount();
  const [accounts, setAccounts] = useState<PlaidAccountRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!features.plaid || isDemo) { setLoading(false); return; }
    apiGet<PlaidAccountRow[]>('/api/plaid/accounts')
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [features.plaid, isDemo]);

  if (isDemo) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <span className="material-symbols-outlined text-3xl text-slate-400">lock</span>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Link a bank account to see live balances.
        </p>
        <a href="/register" className="text-xs text-blue-500 hover:underline">Create a free account</a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
      </div>
    );
  }

  if (!features.plaid) {
    return <EmptyState icon="account_balance" message="Bank account linking is not enabled on this server." />;
  }

  if (!accounts.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <span className="material-symbols-outlined text-3xl text-slate-400">account_balance</span>
        <p className="text-sm text-slate-500 dark:text-slate-400">No accounts linked.</p>
        <a href="/settings?tab=5" className="text-xs text-blue-500 hover:underline">Link a bank account in Settings</a>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
      {accounts.map(acct => (
        <div key={acct.account_id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {acct.name}
              {acct.mask && <span className="ml-1 text-xs text-slate-400">···{acct.mask}</span>}
            </p>
            <p className="text-[11px] text-slate-400 capitalize">{acct.institution_name} · {acct.subtype || acct.type}</p>
          </div>
          {acct.current !== null && (
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: acct.iso_currency_code || 'USD' }).format(acct.current)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

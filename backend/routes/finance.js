// backend/routes/finance.js
// Budget & Finance feature:  CSV import, transaction CRUD, budgets, monthly summary.
// Data source: user-uploaded CSV files from any major US bank.
// Routes:
//   POST   /api/finance/import              – parse & store CSV (text/plain body)
//   GET    /api/finance/transactions        – list with filters
//   PATCH  /api/finance/transactions/:id/tag – retag a transaction
//   GET    /api/finance/summary             – monthly spend aggregation
//   GET    /api/finance/budgets
//   PUT    /api/finance/budgets
//   DELETE /api/finance/transactions        – clear all for user
'use strict';

const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db         = require('../db');
const { mapCategory } = require('../lib/financeCategoryMap');

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCsvRow(line) {
  const cols  = [];
  let current = '';
  let inQ     = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { current += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rawHeaders = parseCsvRow(lines[0]);
  const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/^["']+|["']+$/g, ''));
  return lines.slice(1)
    .map(line => {
      const cols = parseCsvRow(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim().replace(/^["']+|["']+$/g, ''); });
      return row;
    })
    .filter(row => Object.values(row).some(v => v));
}

function detectFormat(headers) {
  if (headers.includes('transaction date') && headers.includes('type') && headers.includes('amount'))
    return 'chase';
  if (headers.includes('posted date') && headers.includes('payee'))
    return 'bofa';
  if (headers.includes('card no.') || (headers.includes('debit') && headers.includes('credit') && headers.includes('category')))
    return 'capitalone';
  if (headers.includes('date') && headers.includes('amount') && headers.includes('description'))
    return 'generic';
  return 'generic';
}

function normalizeRow(row, headers, format) {
  let dateStr, merchant, amount, rawCategory;

  switch (format) {
    case 'chase':
      dateStr     = row['transaction date'];
      merchant    = row['description'];
      amount      = parseFloat(row['amount']);
      rawCategory = row['category'];
      break;

    case 'bofa':
      dateStr     = row['posted date'];
      merchant    = row['payee'];
      amount      = parseFloat(row['amount']);
      rawCategory = null;
      break;

    case 'capitalone': {
      dateStr = row['transaction date'];
      merchant = row['description'];
      const debit  = parseFloat(row['debit']  || '0') || 0;
      const credit = parseFloat(row['credit'] || '0') || 0;
      amount = credit > 0 ? credit : -debit;
      rawCategory = row['category'];
      break;
    }

    default: {
      const dateKey   = headers.find(h => /date/.test(h));
      const descKey   = headers.find(h => /desc|merchant|payee|name/.test(h));
      const amountKey = headers.find(h => /^amount|^total/.test(h));
      const catKey    = headers.find(h => /categ|type/.test(h));
      dateStr     = dateKey   ? row[dateKey]   : null;
      merchant    = descKey   ? row[descKey]   : (Object.values(row)[1] ?? '');
      amount      = parseFloat(amountKey ? row[amountKey] : '0');
      rawCategory = catKey    ? row[catKey]    : null;
    }
  }

  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  if (isNaN(amount)) return null;

  return {
    transaction_date: parsed.toISOString().slice(0, 10),
    merchant_name:    (merchant || '').slice(0, 200),
    amount,
    raw_category:     rawCategory || null,
    shopdeck_category: mapCategory(rawCategory),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/finance/import
// Body: text/plain CSV content (sent by frontend with Content-Type: text/plain)
router.post(
  '/import',
  verifyToken,
  demoGuard,
  express.text({ type: 'text/plain', limit: '4mb' }),
  async (req, res) => {
    const csvText = typeof req.body === 'string' ? req.body : null;
    if (!csvText || !csvText.trim())
      return res.status(400).json({ error: 'No CSV data provided' });

    const rows = parseCSV(csvText);
    if (!rows.length)
      return res.status(400).json({ error: 'CSV appears to be empty or has no valid rows' });

    const headers   = Object.keys(rows[0]);
    const format    = detectFormat(headers);
    const normalized = rows.map(r => normalizeRow(r, headers, format)).filter(Boolean);

    if (!normalized.length)
      return res.status(400).json({ error: 'Could not parse any valid transactions from the CSV. Check that the file has Date, Description, and Amount columns.' });

    try {
      const BATCH = 200;
      let imported = 0;
      for (let i = 0; i < normalized.length; i += BATCH) {
        const batch       = normalized.slice(i, i + BATCH);
        const batchValues = batch.map((_, j) => {
          const b = j * 7;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`;
        });
        const batchParams = batch.flatMap(t => [
          req.user.id,
          t.transaction_date,
          t.merchant_name,
          t.amount,
          t.raw_category,
          t.shopdeck_category,
          'csv',
        ]);
        await db.query(
          `INSERT INTO finance_transactions
             (user_id, transaction_date, merchant_name, amount, raw_category, shopdeck_category, import_source)
           VALUES ${batchValues.join(',')}`,
          batchParams,
        );
        imported += batch.length;
      }
      res.json({ imported, format });
    } catch (err) {
      console.error('Finance import error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// GET /api/finance/transactions
router.get('/transactions', verifyToken, async (req, res) => {
  const { category, from, to, limit = '50', offset = '0' } = req.query;
  const params = [req.user.id];
  let where = 'user_id = $1';

  if (category)  { params.push(category);                    where += ` AND shopdeck_category = $${params.length}`; }
  if (from)      { params.push(from);                        where += ` AND transaction_date >= $${params.length}`; }
  if (to)        { params.push(to);                          where += ` AND transaction_date <= $${params.length}`; }

  params.push(Math.min(Math.max(Number(limit)  || 50,  1), 200));
  params.push(Math.max(Number(offset) || 0, 0));

  try {
    const result = await db.query(
      `SELECT id, transaction_date, merchant_name, amount, raw_category, shopdeck_category, user_label
         FROM finance_transactions
        WHERE ${where}
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('Finance transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/finance/summary  — current-month spend aggregation + total transaction count
router.get('/summary', verifyToken, async (req, res) => {
  const now        = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const [summaryResult, countResult] = await Promise.all([
      db.query(
        `SELECT shopdeck_category,
                SUM(ABS(amount)) FILTER (WHERE amount < 0) AS spent,
                COUNT(*) FILTER (WHERE amount < 0)          AS count
           FROM finance_transactions
          WHERE user_id = $1 AND transaction_date >= $2
          GROUP BY shopdeck_category
          ORDER BY spent DESC NULLS LAST`,
        [req.user.id, monthStart],
      ),
      db.query(
        'SELECT COUNT(*)::int AS total FROM finance_transactions WHERE user_id = $1',
        [req.user.id],
      ),
    ]);

    res.json({
      month:               monthStart.slice(0, 7),
      summary:             summaryResult.rows,
      total_transactions:  countResult.rows[0].total,
    });
  } catch (err) {
    console.error('Finance summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/finance/transactions/:id/tag
router.patch('/transactions/:id/tag', verifyToken, demoGuard, async (req, res) => {
  const { shopdeck_category, user_label } = req.body;
  try {
    const result = await db.query(
      `UPDATE finance_transactions
          SET shopdeck_category = COALESCE($1, shopdeck_category),
              user_label        = COALESCE($2, user_label)
        WHERE id = $3 AND user_id = $4
        RETURNING id, shopdeck_category, user_label`,
      [shopdeck_category ?? null, user_label ?? null, req.params.id, req.user.id],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Finance tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/finance/budgets
router.get('/budgets', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT category, monthly_limit FROM finance_budgets WHERE user_id = $1 ORDER BY category',
      [req.user.id],
    );
    res.json({ budgets: result.rows });
  } catch (err) {
    console.error('Finance budgets get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/finance/budgets  — upsert one or more budgets
// body: { budgets: [{ category, monthly_limit }] }
router.put('/budgets', verifyToken, demoGuard, async (req, res) => {
  const { budgets } = req.body;
  if (!Array.isArray(budgets) || !budgets.length)
    return res.status(400).json({ error: 'budgets array required' });

  try {
    for (const { category, monthly_limit } of budgets) {
      if (!category || monthly_limit == null) continue;
      const limit = parseFloat(monthly_limit);
      if (isNaN(limit) || limit < 0) continue;
      await db.query(
        `INSERT INTO finance_budgets (user_id, category, monthly_limit)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, category) DO UPDATE SET monthly_limit = $3`,
        [req.user.id, category, limit],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Finance budgets put error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/finance/transactions  — clear all for user
router.delete('/transactions', verifyToken, demoGuard, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM finance_transactions WHERE user_id = $1',
      [req.user.id],
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('Finance delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

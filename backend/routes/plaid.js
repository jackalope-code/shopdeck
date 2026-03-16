// backend/routes/plaid.js
// Plaid bank-account linking routes.
// All routes require a valid JWT (verifyToken).
// Mutating routes additionally require a real (non-demo) account (demoGuard).
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const { demoGuard }   = require('../middleware/demoGuard');
const db              = require('../db');
const { encryptToken, decryptToken } = require('../lib/tokenCrypto');
const { getPlaidClient, Products, CountryCode } = require('../lib/plaidClient');
const { mapCategory } = require('../lib/financeCategoryMap');

// ─── POST /api/plaid/link-token ───────────────────────────────────────────────
// Create a Plaid Link token to initialise the Link flow in the browser.
// demoGuard: demo users may not link bank accounts.
router.post('/link-token', verifyToken, demoGuard, async (req, res) => {
  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: 'ShopDeck',
      products: [Products.Transactions, Products.Identity],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('[plaid] link-token error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// ─── POST /api/plaid/exchange ─────────────────────────────────────────────────
// Exchange a short-lived public_token for a permanent access_token, then
// persist the item, accounts, and initial balances.
// demoGuard: demo users may not link bank accounts.
router.post('/exchange', verifyToken, demoGuard, async (req, res) => {
  const { public_token } = req.body;
  if (!public_token) return res.status(400).json({ error: 'public_token required' });

  try {
    const client = getPlaidClient();
    const exchangeRes = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    // Fetch institution details
    const itemRes = await client.itemGet({ access_token });
    const institutionId = itemRes.data.item.institution_id;
    let institutionName = null;
    if (institutionId) {
      const instRes = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      });
      institutionName = instRes.data.institution.name;
    }

    // Persist the item with encrypted access token
    const accessTokenEnc = encryptToken(access_token);
    await db.query(
      `INSERT INTO plaid_items
         (user_id, item_id, access_token_enc, institution_id, institution_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (item_id) DO UPDATE
         SET access_token_enc = EXCLUDED.access_token_enc,
             institution_name = EXCLUDED.institution_name`,
      [req.user.id, item_id, accessTokenEnc, institutionId, institutionName],
    );

    // Fetch accounts and balances
    const accountsRes = await client.accountsBalanceGet({ access_token });
    const accounts = accountsRes.data.accounts;

    for (const acct of accounts) {
      await db.query(
        `INSERT INTO plaid_accounts (user_id, item_id, account_id, name, type, subtype, mask)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (account_id) DO UPDATE
           SET name = EXCLUDED.name, type = EXCLUDED.type,
               subtype = EXCLUDED.subtype, mask = EXCLUDED.mask`,
        [req.user.id, item_id, acct.account_id, acct.name, acct.type, acct.subtype, acct.mask],
      );
      await db.query(
        `INSERT INTO plaid_balances (account_id, user_id, available, current, iso_currency_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (account_id) DO UPDATE
           SET available = EXCLUDED.available,
               current   = EXCLUDED.current,
               iso_currency_code = EXCLUDED.iso_currency_code,
               last_synced_at = NOW()`,
        [
          acct.account_id,
          req.user.id,
          acct.balances.available,
          acct.balances.current,
          acct.balances.iso_currency_code,
        ],
      );
    }

    // Kick off an initial transaction sync in the background (don't await)
    syncTransactions(req.user.id, item_id, access_token).catch(console.error);

    res.json({ institution_name: institutionName, account_count: accounts.length });
  } catch (err) {
    console.error('[plaid] exchange error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// ─── GET /api/plaid/accounts ──────────────────────────────────────────────────
// Return all linked accounts with latest balances.
// Demo users receive an empty array (not 403 — this is a safe read).
router.get('/accounts', verifyToken, async (req, res) => {
  if (req.user?.is_demo) return res.json([]);
  try {
    const { rows } = await db.query(
      `SELECT
         pi.id           AS item_id,
         pi.institution_name,
         pi.last_synced_at,
         pa.account_id,
         pa.name,
         pa.type,
         pa.subtype,
         pa.mask,
         pb.available,
         pb.current,
         pb.iso_currency_code
       FROM plaid_accounts pa
       JOIN plaid_items   pi ON pi.item_id = pa.item_id
       LEFT JOIN plaid_balances pb ON pb.account_id = pa.account_id
       WHERE pa.user_id = $1
       ORDER BY pi.created_at ASC, pa.name ASC`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('[plaid] accounts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// ─── POST /api/plaid/sync/:itemId ─────────────────────────────────────────────
// Manually trigger a transaction sync for one item.
// demoGuard: demo users have no real items anyway, but we block at the route level.
router.post('/sync/:itemId', verifyToken, demoGuard, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT item_id, access_token_enc FROM plaid_items WHERE id = $1 AND user_id = $2',
      [req.params.itemId, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });

    const { item_id, access_token_enc } = rows[0];
    const accessToken = decryptToken(access_token_enc);
    const count = await syncTransactions(req.user.id, item_id, accessToken);
    res.json({ synced: count });
  } catch (err) {
    console.error('[plaid] sync error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ─── DELETE /api/plaid/accounts/:itemId ───────────────────────────────────────
// Unlink a bank account. Removes the Plaid item and all associated rows
// (cascades via FK). Plaid-sourced transactions in finance_transactions are
// kept so budget/spend history is preserved (just shown as 'plaid' source).
// demoGuard: demo users have no real items.
router.delete('/accounts/:itemId', verifyToken, demoGuard, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT item_id, access_token_enc FROM plaid_items WHERE id = $1 AND user_id = $2',
      [req.params.itemId, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });

    const { item_id, access_token_enc } = rows[0];
    const accessToken = decryptToken(access_token_enc);

    // Notify Plaid to revoke the access token
    try {
      const client = getPlaidClient();
      await client.itemRemove({ access_token: accessToken });
    } catch (plaidErr) {
      // Log but don't block deletion — token may already be revoked
      console.warn('[plaid] itemRemove warning:', plaidErr?.response?.data || plaidErr.message);
    }

    await db.query(
      'DELETE FROM plaid_items WHERE item_id = $1 AND user_id = $2',
      [item_id, req.user.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[plaid] delete error:', err.message);
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// ─── syncTransactions (internal helper) ──────────────────────────────────────
// Cursor-based transaction sync using /transactions/sync.
// Upserts into finance_transactions with deduplication on plaid_transaction_id.
// Returns the number of transactions added.
async function syncTransactions(userId, itemId, accessToken) {
  const client = getPlaidClient();

  // Read current cursor from DB
  const cursorRow = await db.query(
    'SELECT transactions_cursor FROM plaid_items WHERE item_id = $1',
    [itemId],
  );
  let cursor = cursorRow.rows[0]?.transactions_cursor || null;

  let added = 0;
  let hasMore = true;

  while (hasMore) {
    const syncRes = await client.transactionsSync({
      access_token: accessToken,
      cursor: cursor || undefined,
    });
    const { added: newTxns, modified, removed, next_cursor, has_more } = syncRes.data;

    // Process added and modified transactions
    for (const tx of [...newTxns, ...modified]) {
      const shopdeckCategory = mapCategory(tx.merchant_name || tx.name || '', tx.personal_finance_category?.primary || '');
      await db.query(
        `INSERT INTO finance_transactions
           (user_id, transaction_date, merchant_name, amount, raw_category,
            shopdeck_category, import_source, plaid_transaction_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'plaid', $7)
         ON CONFLICT (user_id, plaid_transaction_id)
           WHERE plaid_transaction_id IS NOT NULL
         DO UPDATE SET
           transaction_date   = EXCLUDED.transaction_date,
           merchant_name      = EXCLUDED.merchant_name,
           amount             = EXCLUDED.amount,
           raw_category       = EXCLUDED.raw_category,
           shopdeck_category  = EXCLUDED.shopdeck_category`,
        [
          userId,
          tx.date,
          tx.merchant_name || tx.name,
          tx.amount,
          tx.personal_finance_category?.primary || null,
          shopdeckCategory,
          tx.transaction_id,
        ],
      );
      added++;
    }

    // Remove transactions marked as removed by Plaid
    for (const tx of removed) {
      await db.query(
        'DELETE FROM finance_transactions WHERE user_id = $1 AND plaid_transaction_id = $2',
        [userId, tx.transaction_id],
      );
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  // Persist updated cursor and last_synced_at
  await db.query(
    'UPDATE plaid_items SET transactions_cursor = $1, last_synced_at = NOW() WHERE item_id = $2',
    [cursor, itemId],
  );

  return added;
}

// Export syncTransactions for use by the 12h cron in server.js
module.exports = router;
module.exports.syncTransactions = syncTransactions;

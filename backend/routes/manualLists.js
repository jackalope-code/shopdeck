// backend/routes/manualLists.js
// CRUD for user-curated manual list items (Phase 6).
// Items are stored in the manual_list_items Postgres table and read by the
// 'manual-list' ruleType in scraper.js.
'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');

// 60 write requests per user per minute
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => String(req.user.id),
  message: { error: 'Too many requests — slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/manual-lists/:listId — all items in a list
router.get('/:listId', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, url, price, image, notes, sort_order, created_at, updated_at
       FROM manual_list_items
       WHERE user_id=$1 AND list_id=$2
       ORDER BY sort_order ASC, created_at ASC`,
      [req.user.id, req.params.listId]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('GET /manual-lists/:listId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/manual-lists/:listId — add an item
router.post('/:listId', verifyToken, demoGuard, writeLimiter, async (req, res) => {
  const { name, url, price, image, notes, sort_order } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO manual_list_items (user_id, list_id, name, url, price, image, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, url, price, image, notes, sort_order, created_at, updated_at`,
      [req.user.id, req.params.listId, name.trim(), url ?? null, price ?? null,
       image ?? null, notes ?? null, sort_order ?? 0]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('POST /manual-lists/:listId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/manual-lists/:listId/:itemId — update fields on an item
router.patch('/:listId/:itemId', verifyToken, demoGuard, writeLimiter, async (req, res) => {
  const allowed = ['name', 'url', 'price', 'image', 'notes', 'sort_order'];
  const fields = Object.keys(req.body ?? {}).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No updatable fields provided' });

  const setClauses = fields.map((f, i) => `${f}=$${i + 3}`).join(', ');
  const values = fields.map(f => req.body[f]);

  try {
    const result = await db.query(
      `UPDATE manual_list_items
       SET ${setClauses}, updated_at=NOW()
       WHERE user_id=$1 AND id=$2
       RETURNING id, name, url, price, image, notes, sort_order, created_at, updated_at`,
      [req.user.id, req.params.itemId, ...values]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('PATCH /manual-lists/:listId/:itemId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/manual-lists/:listId/:itemId — remove one item
router.delete('/:listId/:itemId', verifyToken, demoGuard, writeLimiter, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM manual_list_items WHERE user_id=$1 AND id=$2 RETURNING id`,
      [req.user.id, req.params.itemId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Item not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /manual-lists/:listId/:itemId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/manual-lists/:listId — clear an entire list
router.delete('/:listId', verifyToken, demoGuard, writeLimiter, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM manual_list_items WHERE user_id=$1 AND list_id=$2`,
      [req.user.id, req.params.listId]
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('DELETE /manual-lists/:listId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

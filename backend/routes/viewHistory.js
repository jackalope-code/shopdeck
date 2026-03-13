const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');

let ensureTablePromise;

function ensureViewHistoryTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS view_history (
        user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url        TEXT        NOT NULL,
        name       TEXT        NOT NULL,
        vendor     TEXT,
        image      TEXT,
        price      TEXT,
        category   TEXT,
        view_count INTEGER     NOT NULL DEFAULT 1,
        viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, url)
      )
    `)
      .then(() => db.query('CREATE INDEX IF NOT EXISTS view_history_user_viewed_idx ON view_history(user_id, viewed_at DESC)'));
  }
  return ensureTablePromise;
}

router.get('/', verifyToken, async (req, res) => {
  try {
    await ensureViewHistoryTable();
    const result = await db.query(
      `SELECT url, name, vendor, image, price, category,
              view_count AS "viewCount",
              viewed_at AS "viewedAt"
         FROM view_history
        WHERE user_id = $1
        ORDER BY viewed_at DESC
        LIMIT 100`,
      [req.user.id]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('GET /view-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', verifyToken, demoGuard, async (req, res) => {
  const { url, name, vendor, image, price, category } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    await ensureViewHistoryTable();
    const result = await db.query(
      `INSERT INTO view_history (user_id, url, name, vendor, image, price, category, viewed_at, view_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 1)
       ON CONFLICT (user_id, url) DO UPDATE
         SET name = EXCLUDED.name,
             vendor = EXCLUDED.vendor,
             image = EXCLUDED.image,
             price = EXCLUDED.price,
             category = EXCLUDED.category,
             viewed_at = NOW(),
             view_count = view_history.view_count + 1
       RETURNING url, name, vendor, image, price, category,
                 view_count AS "viewCount",
                 viewed_at AS "viewedAt"`,
      [
        req.user.id,
        url.slice(0, 1000),
        name.slice(0, 200),
        typeof vendor === 'string' ? vendor.slice(0, 100) : null,
        typeof image === 'string' ? image.slice(0, 2000) : null,
        typeof price === 'string' ? price.slice(0, 50) : null,
        typeof category === 'string' ? category.slice(0, 50) : null,
      ]
    );
    res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('POST /view-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', verifyToken, demoGuard, async (req, res) => {
  try {
    await ensureViewHistoryTable();
    await db.query('DELETE FROM view_history WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /view-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
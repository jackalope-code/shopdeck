const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');
const { classifyProductTaxonomy } = require('../lib/productTaxonomy');

let ensureTablePromise;

function ensureFavoritesTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS user_favorites (
        user_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url          TEXT        NOT NULL,
        name         TEXT        NOT NULL,
        vendor       TEXT,
        image        TEXT,
        price        TEXT,
        category     TEXT,
        analytics_category TEXT,
        analytics_subcategory TEXT,
        favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, url)
      )
    `)
      .then(() => db.query('ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS analytics_category TEXT'))
      .then(() => db.query('ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS analytics_subcategory TEXT'))
      .then(() => db.query('CREATE INDEX IF NOT EXISTS user_favorites_user_favorited_idx ON user_favorites(user_id, favorited_at DESC)'));
  }
  return ensureTablePromise;
}

router.get('/', verifyToken, async (req, res) => {
  try {
    await ensureFavoritesTable();
    const result = await db.query(
            `SELECT url, name, vendor, image, price, category,
              analytics_category AS "analyticsCategory",
              analytics_subcategory AS "analyticsSubcategory",
              favorited_at AS "favoritedAt"
         FROM user_favorites
        WHERE user_id = $1
        ORDER BY favorited_at DESC
        LIMIT 200`,
      [req.user.id]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error('GET /favorites error:', err);
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

  const taxonomy = classifyProductTaxonomy({ name, vendor, category, url });

  try {
    await ensureFavoritesTable();
    const result = await db.query(
      `INSERT INTO user_favorites (user_id, url, name, vendor, image, price, category, analytics_category, analytics_subcategory, favorited_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, url) DO UPDATE
         SET name = EXCLUDED.name,
             vendor = EXCLUDED.vendor,
             image = EXCLUDED.image,
             price = EXCLUDED.price,
             category = EXCLUDED.category,
             analytics_category = EXCLUDED.analytics_category,
             analytics_subcategory = EXCLUDED.analytics_subcategory,
             favorited_at = NOW()
       RETURNING url, name, vendor, image, price, category,
                 analytics_category AS "analyticsCategory",
                 analytics_subcategory AS "analyticsSubcategory",
                 favorited_at AS "favoritedAt"`,
      [
        req.user.id,
        url.slice(0, 1000),
        name.slice(0, 200),
        typeof vendor === 'string' ? vendor.slice(0, 100) : null,
        typeof image === 'string' ? image.slice(0, 2000) : null,
        typeof price === 'string' ? price.slice(0, 50) : null,
        typeof category === 'string' ? category.slice(0, 50) : null,
        taxonomy.analyticsCategory,
        taxonomy.analyticsSubcategory,
      ]
    );
    res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('POST /favorites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/item', verifyToken, demoGuard, async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    await ensureFavoritesTable();
    await db.query('DELETE FROM user_favorites WHERE user_id = $1 AND url = $2', [req.user.id, url.slice(0, 1000)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /favorites/item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', verifyToken, demoGuard, async (req, res) => {
  try {
    await ensureFavoritesTable();
    await db.query('DELETE FROM user_favorites WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /favorites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

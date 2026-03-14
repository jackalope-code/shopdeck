const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

let ensureInsightsColumnsPromise;

function ensureInsightsColumns() {
  if (!ensureInsightsColumnsPromise) {
    ensureInsightsColumnsPromise = Promise.all([
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_view_history BOOLEAN NOT NULL DEFAULT true'),
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_favorites BOOLEAN NOT NULL DEFAULT true'),
      db.query('ALTER TABLE view_history ADD COLUMN IF NOT EXISTS analytics_category TEXT'),
      db.query('ALTER TABLE view_history ADD COLUMN IF NOT EXISTS analytics_subcategory TEXT'),
      db.query('ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS analytics_category TEXT'),
      db.query('ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS analytics_subcategory TEXT'),
    ])
      .then(() => db.query(`
        UPDATE view_history
           SET analytics_category = CASE
                 WHEN LOWER(COALESCE(category, '')) IN ('keyboards', 'keycaps', 'switches') THEN 'keyboards'
                 WHEN LOWER(COALESCE(category, '')) IN ('ram', 'gpu', 'electronics', 'components', 'audio')
                   OR LOWER(COALESCE(category, '')) LIKE 'microcontroller%'
                   OR LOWER(COALESCE(category, '')) LIKE 'passive%'
                   OR LOWER(COALESCE(category, '')) LIKE 'sensor%'
                   OR LOWER(COALESCE(category, '')) LIKE 'motor%'
                   OR LOWER(COALESCE(category, '')) LIKE 'ic%'
                   OR LOWER(COALESCE(category, '')) LIKE 'encoder%'
                 THEN 'electronics'
                 ELSE COALESCE(analytics_category, 'general')
               END,
               analytics_subcategory = CASE
                 WHEN LOWER(COALESCE(category, '')) = 'keycaps' THEN 'keycaps'
                 WHEN LOWER(COALESCE(category, '')) = 'switches' THEN 'switches'
                 WHEN LOWER(COALESCE(category, '')) = 'keyboards' THEN COALESCE(analytics_subcategory, 'full')
                 WHEN LOWER(COALESCE(category, '')) = 'ram' THEN 'ram'
                 WHEN LOWER(COALESCE(category, '')) = 'gpu' THEN 'gpu'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'microcontroller%' THEN 'microcontrollers'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'passive%' THEN 'passives'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'sensor%' THEN 'sensors'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'motor%' THEN 'motors'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'ic%' THEN 'ics'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'encoder%' THEN 'encoders'
                 ELSE analytics_subcategory
               END
         WHERE analytics_category IS NULL OR analytics_subcategory IS NULL
      `))
      .then(() => db.query(`
        UPDATE user_favorites
           SET analytics_category = CASE
                 WHEN LOWER(COALESCE(category, '')) IN ('keyboards', 'keycaps', 'switches') THEN 'keyboards'
                 WHEN LOWER(COALESCE(category, '')) IN ('ram', 'gpu', 'electronics', 'components', 'audio')
                   OR LOWER(COALESCE(category, '')) LIKE 'microcontroller%'
                   OR LOWER(COALESCE(category, '')) LIKE 'passive%'
                   OR LOWER(COALESCE(category, '')) LIKE 'sensor%'
                   OR LOWER(COALESCE(category, '')) LIKE 'motor%'
                   OR LOWER(COALESCE(category, '')) LIKE 'ic%'
                   OR LOWER(COALESCE(category, '')) LIKE 'encoder%'
                 THEN 'electronics'
                 ELSE COALESCE(analytics_category, 'general')
               END,
               analytics_subcategory = CASE
                 WHEN LOWER(COALESCE(category, '')) = 'keycaps' THEN 'keycaps'
                 WHEN LOWER(COALESCE(category, '')) = 'switches' THEN 'switches'
                 WHEN LOWER(COALESCE(category, '')) = 'keyboards' THEN COALESCE(analytics_subcategory, 'full')
                 WHEN LOWER(COALESCE(category, '')) = 'ram' THEN 'ram'
                 WHEN LOWER(COALESCE(category, '')) = 'gpu' THEN 'gpu'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'microcontroller%' THEN 'microcontrollers'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'passive%' THEN 'passives'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'sensor%' THEN 'sensors'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'motor%' THEN 'motors'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'ic%' THEN 'ics'
                 WHEN LOWER(COALESCE(category, '')) LIKE 'encoder%' THEN 'encoders'
                 ELSE analytics_subcategory
               END
         WHERE analytics_category IS NULL OR analytics_subcategory IS NULL
      `));
  }
  return ensureInsightsColumnsPromise;
}

const VALID_METRICS = new Set(['views', 'favorites']);

function normalizeFilter(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

router.get('/', verifyToken, async (req, res) => {
  const metric = normalizeFilter(req.query.metric);
  const category = normalizeFilter(req.query.category);
  const subcategory = normalizeFilter(req.query.subcategory);
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);

  if (!VALID_METRICS.has(metric)) {
    return res.status(400).json({ error: 'metric must be one of: views, favorites' });
  }

  const table = metric === 'views' ? 'view_history' : 'user_favorites';
  const shareColumn = metric === 'views' ? 'share_view_history' : 'share_favorites';
  const totalColumn = metric === 'views' ? 'SUM(entry.view_count)' : 'COUNT(*)';
  const timestampColumn = metric === 'views' ? 'entry.viewed_at' : 'entry.favorited_at';

  try {
    await ensureInsightsColumns();

    const result = await db.query(
      `SELECT entry.url,
              entry.name,
              entry.vendor,
              entry.image,
              entry.price,
              entry.category,
              entry.analytics_category AS "analyticsCategory",
              entry.analytics_subcategory AS "analyticsSubcategory",
              COUNT(DISTINCT entry.user_id)::int AS "uniqueUsers",
              ${totalColumn}::int AS "totalEvents",
              MAX(${timestampColumn}) AS "lastSeenAt"
         FROM ${table} entry
         JOIN user_profiles profile ON profile.user_id = entry.user_id
        WHERE profile.${shareColumn} = true
          AND COALESCE(entry.vendor, '') !~* 'mouser'
          AND COALESCE(entry.url, '') !~* 'mouser\\.'
          AND ($1::text IS NULL OR entry.analytics_category = $1)
          AND ($2::text IS NULL OR entry.analytics_subcategory = $2)
        GROUP BY entry.url, entry.name, entry.vendor, entry.image, entry.price, entry.category, entry.analytics_category, entry.analytics_subcategory
        ORDER BY "uniqueUsers" DESC, "totalEvents" DESC, "lastSeenAt" DESC
        LIMIT $3`,
      [category, subcategory, limit]
    );

    res.json({ metric, category, subcategory, entries: result.rows });
  } catch (err) {
    console.error('GET /community-insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
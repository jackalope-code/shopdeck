// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');
const { encryptToken, decryptToken, encryptMap, decryptMap } = require('../lib/tokenCrypto');

let ensureProfileColumnsPromise;

function ensureProfileColumns() {
  if (!ensureProfileColumnsPromise) {
    ensureProfileColumnsPromise = Promise.all([
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_view_history BOOLEAN NOT NULL DEFAULT true'),
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_favorites BOOLEAN NOT NULL DEFAULT true'),
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS planting_zone INT CHECK (planting_zone BETWEEN 1 AND 13)'),
      db.query('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hide_outdoor_plants BOOLEAN NOT NULL DEFAULT false'),
    ]);
  }
  return ensureProfileColumnsPromise;
}

// Map camelCase profile keys → snake_case PG columns
const FIELD_MAP = {
  activeWidgets:   'active_widgets',
  widgetOrder:     'widget_order',
  gridCols:        'grid_cols',
  feedConfig:      'feed_config',
  aiConfig:        'ai_config',
  apiKeys:         'api_keys',
  browserAlerts:   'browser_alerts',
  aiPerms:         'ai_perms',
  ramAlertStates:  'ram_alert_states',
  gpuAlertStates:  'gpu_alert_states',
  shareViewHistory:'share_view_history',
  shareFavorites:  'share_favorites',
  plantingZone:    'planting_zone',
  hideOutdoorPlants:'hide_outdoor_plants',
};

// Map PG row columns back to the camelCase profile shape the frontend expects
function rowToProfile(row) {
  if (!row) return null;
  // Decrypt sensitive fields before returning — at-rest values are AES-256-GCM encrypted
  const aiConfig = row.ai_config
    ? { ...row.ai_config, apiKey: decryptToken(row.ai_config.apiKey) ?? '' }
    : row.ai_config;
  const apiKeys = decryptMap(row.api_keys ?? {});
  return {
    activeWidgets:  row.active_widgets,
    widgetOrder:    row.widget_order,
    gridCols:       row.grid_cols,
    feedConfig:     row.feed_config,
    aiConfig,
    apiKeys,
    browserAlerts:  row.browser_alerts,
    aiPerms:        row.ai_perms,
    ramAlertStates: row.ram_alert_states,
    gpuAlertStates: row.gpu_alert_states,
    shareViewHistory: row.share_view_history,
    shareFavorites: row.share_favorites,
    plantingZone:    row.planting_zone    ?? null,
    hideOutdoorPlants: row.hide_outdoor_plants ?? false,
  };
}

// GET /api/profile  (protected)
router.get('/', verifyToken, async (req, res) => {
  try {
    await ensureProfileColumns();
    const result = await db.query('SELECT * FROM user_profiles WHERE user_id=$1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rowToProfile(result.rows[0]) });
  } catch (err) {
    console.error('GET /profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/profile  (protected)
// Accepts any subset of profile fields; unknown keys are ignored.
router.patch('/', verifyToken, demoGuard, async (req, res) => {
  // Encrypt sensitive fields before storing — decrypt happens in rowToProfile on read
  const updates = { ...req.body };
  if ('aiConfig' in updates && updates.aiConfig != null) {
    const ak = updates.aiConfig.apiKey;
    updates.aiConfig = { ...updates.aiConfig, apiKey: ak ? encryptToken(ak) : (ak ?? '') };
  }
  if ('apiKeys' in updates && updates.apiKeys != null) {
    updates.apiKeys = encryptMap(updates.apiKeys);
  }

  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [camel, col] of Object.entries(FIELD_MAP)) {
    if (camel in updates) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(typeof updates[camel] === 'object' ? JSON.stringify(updates[camel]) : updates[camel]);
    }
  }

  if (setClauses.length === 0)
    return res.status(400).json({ error: 'No valid profile fields provided' });

  setClauses.push(`updated_at = NOW()`);
  values.push(req.user.id);

  try {
    await ensureProfileColumns();
    const result = await db.query(
      `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE user_id=$${idx} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rowToProfile(result.rows[0]) });
  } catch (err) {
    console.error('PATCH /profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

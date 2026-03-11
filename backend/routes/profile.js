// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

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
};

// Map PG row columns back to the camelCase profile shape the frontend expects
function rowToProfile(row) {
  if (!row) return null;
  return {
    activeWidgets:  row.active_widgets,
    widgetOrder:    row.widget_order,
    gridCols:       row.grid_cols,
    feedConfig:     row.feed_config,
    aiConfig:       row.ai_config,
    apiKeys:        row.api_keys,
    browserAlerts:  row.browser_alerts,
    aiPerms:        row.ai_perms,
    ramAlertStates: row.ram_alert_states,
    gpuAlertStates: row.gpu_alert_states,
  };
}

// GET /api/profile  (protected)
router.get('/', verifyToken, async (req, res) => {
  try {
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
router.patch('/', verifyToken, async (req, res) => {
  const updates = req.body;
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

// backend/routes/alerts.js
// Tracked price alerts + alert history — Postgres-backed
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');

// ─── Tracked alerts ───────────────────────────────────────────────────────────

// GET /api/alerts/tracked
router.get('/tracked', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT alerts FROM tracked_alerts WHERE user_id=$1', [req.user.id]);
    res.json({ alerts: result.rows[0]?.alerts ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/alerts/tracked  — full replace
router.put('/tracked', verifyToken, demoGuard, async (req, res) => {
  const { alerts } = req.body;
  if (!Array.isArray(alerts))
    return res.status(400).json({ error: 'alerts must be an array' });
  try {
    await db.query(
      `INSERT INTO tracked_alerts (user_id, alerts, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id) DO UPDATE SET alerts=$2, updated_at=NOW()`,
      [req.user.id, JSON.stringify(alerts)]
    );
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Alert history ────────────────────────────────────────────────────────────

// GET /api/alerts/history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT entries FROM alert_history WHERE user_id=$1', [req.user.id]);
    res.json({ entries: result.rows[0]?.entries ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/alerts/history  — full replace (client sends updated read-states etc.)
router.put('/history', verifyToken, demoGuard, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries))
    return res.status(400).json({ error: 'entries must be an array' });
  try {
    await db.query(
      `INSERT INTO alert_history (user_id, entries, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id) DO UPDATE SET entries=$2, updated_at=NOW()`,
      [req.user.id, JSON.stringify(entries)]
    );
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

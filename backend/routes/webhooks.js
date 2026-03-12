// backend/routes/webhooks.js
// Inbound webhook routing for Phase 5.
// Each webhook has a UUID endpoint; payloads are pushed into a Redis ring-buffer
// that the 'webhook-buffer' ruleType in scraper.js reads from.
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');
const db = require('../db');
const redis = require('../redis');
const { encryptToken, decryptToken } = require('../lib/tokenCrypto');

// Keep the last N payloads per webhook in Redis.
const RING_BUFFER_MAX = 200;

const bufKey = (webhookId) => `webhook:buffer:${webhookId}`;

// 60 ingest requests per minute per webhook ID — keyed on webhook ID, not user,
// so a single noisy sender can't consume another user's budget.
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => `wh:ingest:${req.params.id}`,
  message: { error: 'Ingest rate limit exceeded — slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Timing-safe HMAC-SHA256 verification.
// sigHeader should be "sha256=<hex>" (GitHub-style) or plain hex.
function verifyHmac(secret, rawBody, sigHeader) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Accept both "sha256=<hex>" and plain "<hex>" from senders
  const provided = sigHeader.startsWith('sha256=') ? sigHeader : `sha256=${sigHeader}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

// POST /api/webhooks — create a webhook
router.post('/', verifyToken, demoGuard, async (req, res) => {
  const { label, secret } = req.body ?? {};
  if (!label || typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO webhooks (user_id, label, secret)
       VALUES ($1, $2, $3)
       RETURNING id, label, (secret IS NOT NULL) AS has_secret, created_at`,
      [req.user.id, label.trim(), secret ? encryptToken(secret) : null]
    );
    res.status(201).json({ webhook: result.rows[0] });
  } catch (err) {
    console.error('POST /webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks — list user's webhooks (secret value is never returned)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, label, (secret IS NOT NULL) AS has_secret, created_at
       FROM webhooks WHERE user_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ webhooks: result.rows });
  } catch (err) {
    console.error('GET /webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/webhooks/:id — delete + wipe Redis ring buffer
router.delete('/:id', verifyToken, demoGuard, async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM webhooks WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Webhook not found' });
    try { await redis.del(bufKey(req.params.id)); } catch { /* degraded — key expires naturally */ }
    res.json({ deleted: true });
  } catch (err) {
    console.error('DELETE /webhooks/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhooks/:id/ingest — receive a payload (no auth; HMAC-verified if secret set)
// rawBody is available on req.rawBody because server.js uses express.json({ verify: ... }).
router.post('/:id/ingest', ingestLimiter, async (req, res) => {
  try {
    const row = await db.query(
      `SELECT secret FROM webhooks WHERE id=$1`,
      [req.params.id]
    );
    if (!row.rowCount) return res.status(404).json({ error: 'Webhook not found' });

    const secret = decryptToken(row.rows[0].secret); // null if no secret set
    if (secret) {
      const sig = req.headers['x-hub-signature-256'] ?? req.headers['x-webhook-signature'];
      if (!sig) return res.status(401).json({ error: 'Missing signature header (x-hub-signature-256)' });
      if (!req.rawBody) {
        return res.status(400).json({ error: 'Cannot verify signature: send Content-Type: application/json' });
      }
      if (!verifyHmac(secret, req.rawBody, sig)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const item = { ...req.body, _receivedAt: new Date().toISOString() };
    const key = bufKey(req.params.id);
    try {
      await redis.rpush(key, JSON.stringify(item));
      await redis.ltrim(key, -RING_BUFFER_MAX, -1);
    } catch (redisErr) {
      console.error(`[webhook] Redis write failed for ${req.params.id}:`, redisErr.message);
      // Still accept — the request is valid, storage is best-effort
    }
    res.json({ accepted: true });
  } catch (err) {
    console.error('POST /webhooks/:id/ingest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

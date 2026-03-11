// backend/routes/aiHistory.js
// GET/PUT /api/ai-history — AI chat history, Postgres-backed with client-side mirror
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../db');

const MAX_MESSAGES  = 50;
const MAX_CHARS     = 100_000;

// GET /api/ai-history  (protected)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT messages, char_count FROM ai_history WHERE user_id=$1',
      [req.user.id]
    );
    const row = result.rows[0];
    res.json({ messages: row?.messages ?? [], charCount: row?.char_count ?? 0 });
  } catch (err) {
    console.error('GET /ai-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/ai-history  (protected)
// Body: { messages: [...] }  — full replace; enforces window limits server-side
router.put('/', verifyToken, async (req, res) => {
  let { messages } = req.body;
  if (!Array.isArray(messages))
    return res.status(400).json({ error: 'messages must be an array' });

  // Enforce limits
  messages = messages.slice(-MAX_MESSAGES);
  let charCount = messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  while (charCount > MAX_CHARS && messages.length > 0) {
    charCount -= messages[0].content?.length ?? 0;
    messages.shift();
  }

  try {
    await db.query(
      `INSERT INTO ai_history (user_id, messages, char_count, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (user_id) DO UPDATE SET messages=$2, char_count=$3, updated_at=NOW()`,
      [req.user.id, JSON.stringify(messages), charCount]
    );
    res.json({ messages, charCount });
  } catch (err) {
    console.error('PUT /ai-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/ai-history  (protected) — clear chat history
router.delete('/', verifyToken, async (req, res) => {
  try {
    await db.query(
      `UPDATE ai_history SET messages='[]', char_count=0, updated_at=NOW() WHERE user_id=$1`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /ai-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

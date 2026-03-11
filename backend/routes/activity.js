// backend/routes/activity.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// GET /api/activity — fetch recent activity for the authenticated user
router.get('/', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  const activityLog = user?.activityLog ?? [];
  res.json({ activity: activityLog });
});

// POST /api/activity — log a new activity entry
router.post('/', verifyToken, demoGuard, (req, res) => {
  const { type, title } = req.body;
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' });
  }
  const safeTitle = title.slice(0, 200);
  const safeType = typeof type === 'string' ? type.slice(0, 50) : 'update';

  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const log = users[idx].activityLog ?? [];
  log.unshift({ type: safeType, title: safeTitle, timestamp: new Date().toISOString() });
  if (log.length > 50) log.length = 50;
  users[idx].activityLog = log;
  writeUsers(users);

  res.json({ ok: true });
});

module.exports = router;

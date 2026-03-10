// backend/routes/profile.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// GET /api/profile  (protected)
router.get('/', verifyToken, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ profile: user.profile });
});

// PATCH /api/profile  (protected)
// Accepts partial profile fields to merge/overwrite
router.patch('/', verifyToken, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const allowed = ['activeWidgets', 'widgetOrder', 'gridCols', 'feedConfig', 'aiConfig'];
  const updates = req.body;
  const profile = users[idx].profile || {};

  for (const key of allowed) {
    if (key in updates) {
      profile[key] = updates[key];
    }
  }

  users[idx].profile = profile;
  writeUsers(users);
  res.json({ profile });
});

module.exports = router;

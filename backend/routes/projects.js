// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');

const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function getUser(id) {
  return readUsers().find(u => u.id === id);
}

const GRADIENT_POOL = [
  'from-blue-800 to-blue-500',
  'from-amber-700 to-orange-500',
  'from-emerald-800 to-teal-500',
  'from-purple-800 to-violet-500',
  'from-rose-800 to-pink-500',
  'from-slate-700 to-slate-500',
  'from-cyan-800 to-cyan-500',
  'from-fuchsia-800 to-fuchsia-500',
];

// GET /api/projects  — list user's projects
router.get('/', verifyToken, (req, res) => {
  const user = getUser(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ projects: user.profile?.projects ?? [] });
});

// POST /api/projects  — create a project
router.post('/', verifyToken, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const { name, status = 'Planning', icon = 'workspaces', forSale = false, budget, targetPrice } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const project = {
    id: uuidv4(),
    name: name.trim(),
    status,
    icon,
    forSale: !!forSale,
    sourced: 0,
    total: 0,
    spent: 0,
    ...(budget != null ? { budget: Number(budget) } : {}),
    ...(targetPrice != null ? { targetPrice: Number(targetPrice), estProfit: 0 } : {}),
    gradient: GRADIENT_POOL[Math.floor(Math.random() * GRADIENT_POOL.length)],
    modified: new Date().toISOString(),
    components: [],
  };

  users[idx].profile = users[idx].profile || {};
  users[idx].profile.projects = [...(users[idx].profile.projects ?? []), project];
  writeUsers(users);
  res.status(201).json({ project });
});

// PATCH /api/projects/:id  — update a project's fields
router.patch('/:id', verifyToken, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const projects = users[idx].profile?.projects ?? [];
  const pIdx = projects.findIndex(p => p.id === req.params.id);
  if (pIdx === -1) return res.status(404).json({ error: 'Project not found' });

  const allowed = ['name', 'status', 'icon', 'forSale', 'budget', 'targetPrice', 'estProfit', 'sourced', 'total', 'spent', 'gradient', 'components', 'image'];
  for (const key of allowed) {
    if (key in req.body) projects[pIdx][key] = req.body[key];
  }
  projects[pIdx].modified = new Date().toISOString();

  users[idx].profile.projects = projects;
  writeUsers(users);
  res.json({ project: projects[pIdx] });
});

// DELETE /api/projects/:id  — delete a project
router.delete('/:id', verifyToken, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const before = users[idx].profile?.projects ?? [];
  const after = before.filter(p => p.id !== req.params.id);
  if (after.length === before.length) return res.status(404).json({ error: 'Project not found' });

  users[idx].profile.projects = after;
  writeUsers(users);
  res.json({ ok: true });
});

module.exports = router;

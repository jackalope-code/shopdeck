// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../middleware/auth');
const { demoGuard } = require('../middleware/demoGuard');

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeComponent(component = {}) {
  return {
    ...component,
    partsPerUnit: Math.max(0, toNumber(component.partsPerUnit, 1)),
    stockQty: Math.max(0, toNumber(component.stockQty, 0)),
  };
}

function normalizeProject(project = {}) {
  const components = Array.isArray(project.components)
    ? project.components.map(normalizeComponent)
    : [];

  return {
    ...project,
    builtUnits: Math.max(0, toNumber(project.builtUnits, 0)),
    targetUnits: Math.max(0, toNumber(project.targetUnits, 0)),
    soldUnits: Math.max(0, toNumber(project.soldUnits, 0)),
    wasteOverageRate: Math.max(0, toNumber(project.wasteOverageRate, 0)),
    components,
  };
}

function computePlanningFields(project = {}) {
  const normalized = normalizeProject(project);
  const components = normalized.components ?? [];
  const targetUnits = Math.max(0, toNumber(normalized.targetUnits, 0));
  const wasteOverageRate = Math.max(0, toNumber(normalized.wasteOverageRate, 0));

  const capacities = components
    .filter(component => toNumber(component.partsPerUnit, 1) > 0)
    .map(component => Math.floor(toNumber(component.stockQty, 0) / toNumber(component.partsPerUnit, 1)));

  const computedProducibleUnits = capacities.length > 0 ? Math.max(0, Math.min(...capacities)) : 0;

  const computedExpectedPartsTotal = components.reduce((sum, component) => {
    const expected = Math.ceil(toNumber(component.partsPerUnit, 1) * targetUnits * (1 + wasteOverageRate));
    return sum + expected;
  }, 0);

  return {
    ...normalized,
    computedProducibleUnits,
    computedExpectedPartsTotal,
    computedTargetShortfall: Math.max(0, targetUnits - computedProducibleUnits),
  };
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
  const projects = (user.profile?.projects ?? []).map(computePlanningFields);
  res.json({ projects });
});

// POST /api/projects  — create a project
router.post('/', verifyToken, demoGuard, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const {
    name,
    status = 'Planning',
    icon = 'workspaces',
    forSale = false,
    budget,
    targetPrice,
    targetUnits,
    builtUnits,
    soldUnits,
    wasteOverageRate,
  } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const project = normalizeProject({
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
    targetUnits: Math.max(0, toNumber(targetUnits, 0)),
    builtUnits: Math.max(0, toNumber(builtUnits, 0)),
    soldUnits: Math.max(0, toNumber(soldUnits, 0)),
    wasteOverageRate: Math.max(0, toNumber(wasteOverageRate, 0)),
    gradient: GRADIENT_POOL[Math.floor(Math.random() * GRADIENT_POOL.length)],
    modified: new Date().toISOString(),
    components: [],
  });

  users[idx].profile = users[idx].profile || {};
  users[idx].profile.projects = [...(users[idx].profile.projects ?? []), project];
  writeUsers(users);
  res.status(201).json({ project: computePlanningFields(project) });
});

// PATCH /api/projects/:id  — update a project's fields
router.patch('/:id', verifyToken, demoGuard, (req, res) => {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const projects = users[idx].profile?.projects ?? [];
  const pIdx = projects.findIndex(p => p.id === req.params.id);
  if (pIdx === -1) return res.status(404).json({ error: 'Project not found' });

  const allowed = [
    'name',
    'status',
    'icon',
    'forSale',
    'budget',
    'targetPrice',
    'estProfit',
    'sourced',
    'total',
    'spent',
    'gradient',
    'components',
    'image',
    'targetUnits',
    'builtUnits',
    'soldUnits',
    'wasteOverageRate',
  ];
  for (const key of allowed) {
    if (key in req.body) projects[pIdx][key] = req.body[key];
  }
  projects[pIdx] = normalizeProject(projects[pIdx]);
  projects[pIdx].modified = new Date().toISOString();

  users[idx].profile.projects = projects;
  writeUsers(users);
  res.json({ project: computePlanningFields(projects[pIdx]) });
});

// DELETE /api/projects/:id  — delete a project
router.delete('/:id', verifyToken, demoGuard, (req, res) => {
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

// backend/api.js
// API endpoint scaffolding for Shopdeck backend

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const userModel = require('./user');

// Get all available categories (static for now)
router.get('/categories', (req, res) => {
  res.json([
    { id: 'keyboard', name: 'Keyboard' },
    { id: 'electronics', name: 'Electronics' }
  ]);
});

// Get widgets for a category
router.get('/widgets/:categoryId', (req, res) => {
  const { categoryId } = req.params;
  // Example static widgets
  if (categoryId === 'keyboard') {
    res.json([
      { id: 'new-releases', name: 'New Releases' },
      { id: 'sales', name: 'Sales' }
    ]);
  } else if (categoryId === 'electronics') {
    res.json([
      { id: 'new-drops', name: 'New Drops' },
      { id: 'sales', name: 'Sales' }
    ]);
  } else {
    res.status(404).json({ error: 'Unknown category' });
  }
});

// Get user dashboard config (widgets, categories)
router.get('/user/:userId/dashboard', (req, res) => {
  res.json({
    categories: ['keyboard', 'electronics'],
    widgets: ['new-releases', 'sales', 'new-drops']
  });
});

// Get cached scrape data for a user
router.get('/cache/:userId', (req, res) => {
  const { userId } = req.params;
  const cachePath = path.join(__dirname, `cache_${userId}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: 'Failed to read cache' });
    }
  } else {
    res.json({ digikey: [], mouser: [], adafruit: { newest: [], sales: [] }, updated: null });
  }
});

// Get user watchlist
router.get('/watchlist/:userId', (req, res) => {
  const watchlist = userModel.getUserWatchlist(req.params.userId);
  res.json(watchlist || { digikey: [], mouser: [] });
});

// Save user watchlist
router.post('/watchlist/:userId', (req, res) => {
  userModel.setUserWatchlist(req.params.userId, req.body);
  res.json({ ok: true });
});

module.exports = router;

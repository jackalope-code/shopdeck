// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const apiRouter = require('./api');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const feedConfigRouter = require('./routes/feedConfig');
const projectsRouter = require('./routes/projects');
const activityRouter = require('./routes/activity');
const aiRouter = require('./routes/ai');
const aiHistoryRouter = require('./routes/aiHistory');
const alertsRouter = require('./routes/alerts');
const cron = require('node-cron');
const scraper = require('./scraper');
const db = require('./db');
const redis = require('./redis');

app.use(cors({
  origin: (origin, cb) => {
    // Allow any localhost origin (any port) or no-origin requests (e.g. curl)
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/feed-config', feedConfigRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-history', aiHistoryRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api', apiRouter);

// Catch-all for unknown API routes — always return JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Catch-all for all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Schedule daily scraping at 2:00 AM
cron.schedule('0 2 * * *', () => {
  console.log('Running daily scraping and cache update...');
  scraper.updateCache().catch(console.error);
});

// Verify infrastructure connections before accepting traffic
async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✓ PostgreSQL connected');
  } catch (err) {
    console.error('✗ PostgreSQL unavailable:', err.message);
  }
  try {
    await redis.ping();
    console.log('✓ Redis connected');
  } catch (err) {
    console.warn('⚠ Redis unavailable (cache will degrade to in-memory):', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

start();

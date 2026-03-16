// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;
const apiRouter = require('./api');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const feedConfigRouter = require('./routes/feedConfig').router;
const { warmAllSources } = require('./routes/feedConfig');
const projectsRouter = require('./routes/projects');
const activityRouter = require('./routes/activity');
const aiRouter = require('./routes/ai');
const aiHistoryRouter = require('./routes/aiHistory');
const alertsRouter = require('./routes/alerts');
const viewHistoryRouter = require('./routes/viewHistory');
const favoritesRouter = require('./routes/favorites');
const communityInsightsRouter = require('./routes/communityInsights');
const webhooksRouter = require('./routes/webhooks');
const manualListsRouter = require('./routes/manualLists');
const financeRouter     = require('./routes/finance');
const plaidRouter       = require('./routes/plaid');
const { syncTransactions } = require('./routes/plaid');
const { isPlaidConfigured } = require('./lib/plaidClient');
const cron = require('node-cron');
const scraper = require('./scraper');
const db = require('./db');
const redis = require('./redis');

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // No origin = server-to-server (proxy, curl) — always allow
    if (!origin) return cb(null, true);
    // Always allow any localhost port for local dev
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    // Allow any origins explicitly listed in CORS_ORIGIN env var
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
// Capture raw body bytes for webhook HMAC signature verification.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Health check — used by Docker's healthcheck and load balancers
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Feature flags — unauthenticated; used by the frontend to conditionally show features
app.get('/api/features', (req, res) => res.json({
  plaid:              isPlaidConfigured(),
  github_oauth:       !!process.env.GITHUB_OAUTH_CLIENT_ID,
  google_oauth:       !!process.env.GOOGLE_CLIENT_ID,
  email_verification: true,
}));

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/feed-config', feedConfigRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ai-history', aiHistoryRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/view-history', viewHistoryRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/community-insights', communityInsightsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/manual-lists', manualListsRouter);
app.use('/api/finance',      financeRouter);
app.use('/api/plaid',        plaidRouter);
app.use('/api', apiRouter);

// Catch-all for unknown API routes — always return JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Catch-all for all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Schedule daily scraping at 2:00 AM (legacy watchlist cache)
cron.schedule('0 2 * * *', () => {
  console.log('Running daily scraping and cache update...');
  scraper.updateCache().catch(console.error);
});

// Pre-warm built-in source caches every 6 hours.
// RSS/user-rss sources have a 6h TTL so they're refreshed on every run.
// Non-API scraper sources have a 24h TTL — they're skipped when still warm
// and only re-scraped once their cache has expired or been SWR-invalidated.
cron.schedule('0 */6 * * *', () => {
  console.log('[cache] warm scheduled run starting...');
  warmAllSources().catch(console.error);
});

// Sync Plaid transactions for all linked users every 12 hours.
cron.schedule('0 */12 * * *', async () => {
  if (!isPlaidConfigured()) return;
  console.log('[plaid] 12h sync starting...');
  try {
    const { rows } = await db.query(
      'SELECT user_id, item_id, access_token_enc FROM plaid_items',
    );
    const { decryptToken } = require('./lib/tokenCrypto');
    for (const row of rows) {
      const accessToken = decryptToken(row.access_token_enc);
      if (!accessToken) continue;
      syncTransactions(row.user_id, row.item_id, accessToken)
        .catch(err => console.error(`[plaid] sync error for item ${row.item_id}:`, err.message));
    }
  } catch (err) {
    console.error('[plaid] 12h cron error:', err.message);
  }
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
    // Warm source caches 5s after startup — non-blocking, runs after health checks
    setTimeout(() => warmAllSources().catch(console.error), 5000);
  });
}

start();

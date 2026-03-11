// backend/redis.js — ioredis client (used for scrape result caching)
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  lazyConnect: true,
});

redis.on('error', (err) => {
  // Non-fatal: if Redis is unavailable the app falls back to in-process Maps
  console.warn('Redis connection error (cache degraded to in-memory):', err.message);
});

redis.on('connect', () => {
  console.log('[cache] Redis connected — feed cache is active');
});

redis.on('reconnecting', () => {
  console.log('[cache] Redis reconnecting…');
});

module.exports = redis;

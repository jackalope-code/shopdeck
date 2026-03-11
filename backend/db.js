// backend/db.js — PostgreSQL connection pool
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.PGHOST     ?? 'localhost',
  port:     Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'shopdeck',
  user:     process.env.PGUSER     ?? 'shopdeck',
  password: process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD ?? 'shopdeck_dev',
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres error:', err.message);
});

module.exports = pool;

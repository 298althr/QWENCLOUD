// backend/src/db/pool.js
// PostgreSQL connection pool (Alibaba Cloud RDS in production, local Docker in dev)
const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://althr:althr@localhost:5432/althr_autopilot",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[db] Unexpected PG pool error:", err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };

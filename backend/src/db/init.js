// backend/src/db/init.js
// Run schema.sql against the configured PostgreSQL instance.
// Usage: npm run db:init
const fs = require("fs");
const path = require("path");
const { pool } = require("./pool");

async function init() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  // eslint-disable-next-line no-console
  console.log("[db:init] Applying schema.sql ...");
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log("[db:init] Schema applied successfully.");
  await pool.end();
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[db:init] FAILED:", err.message);
  process.exit(1);
});

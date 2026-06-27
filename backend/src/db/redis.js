// backend/src/db/redis.js
// Redis client (Alibaba Cloud Redis in production, local Docker in dev)
// DB 0: events, DB 1: sessions, DB 2: cache
const redis = require("redis");

const url = process.env.REDIS_URL || "redis://localhost:6379";

const client = redis.createClient({ url });

client.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[redis] Error:", err.message);
});

async function connect() {
  if (!client.isOpen) {
    await client.connect();
    // eslint-disable-next-line no-console
    console.log("[redis] Connected to", url);
  }
  return client;
}

// Helper to get a client bound to a specific DB index
async function dbClient(dbIndex) {
  const c = redis.createClient({ url, database: dbIndex });
  c.on("error", (err) => console.error("[redis]", err.message));
  await c.connect();
  return c;
}

module.exports = { client, connect, dbClient };

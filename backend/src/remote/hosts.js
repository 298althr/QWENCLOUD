// backend/src/remote/hosts.js
// Remote host registry for SSH-managed servers.
// Host metadata is loaded from the REMOTE_HOSTS environment variable (JSON array).
// Private keys are stored in separate environment variables (never committed).
//
// Example .env entry:
// REMOTE_HOSTS=[{"id":"homelab-01","name":"Home Lab","host":"192.168.1.50","port":22,"user":"althr-agent","privateKeyEnv":"HOMELAB_01_KEY"}]
// HOMELAB_01_KEY="-----BEGIN OPENSSH PRIVATE KEY-----\n..."

const { pool } = require("../db/pool");

let hosts = [];

try {
  const raw = process.env.REMOTE_HOSTS;
  if (raw) {
    hosts = JSON.parse(raw);
    if (!Array.isArray(hosts)) {
      console.warn("[remote/hosts] REMOTE_HOSTS is not an array; ignoring");
      hosts = [];
    }
  }
} catch (e) {
  console.warn("[remote/hosts] failed to parse REMOTE_HOSTS:", e.message);
  hosts = [];
}

// Initialize database table for hosts
async function initHostsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS remote_hosts (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER DEFAULT 22,
        "user" VARCHAR(255) NOT NULL,
        private_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[remote/hosts] Database table initialized");
  } catch (e) {
    console.warn("[remote/hosts] Failed to initialize table:", e.message);
  }
}

// Load hosts from database
async function loadHostsFromDB() {
  try {
    const result = await pool.query("SELECT id, name, host, port, user FROM remote_hosts ORDER BY name");
    const dbHosts = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      host: row.host,
      port: row.port,
      user: row.user,
      privateKey: row.private_key
    }));
    return dbHosts;
  } catch (e) {
    console.warn("[remote/hosts] Failed to load from database:", e.message);
    return [];
  }
}

function sanitizeHost(host) {
  return {
    id: host.id,
    name: host.name || host.id,
    host: host.host,
    port: host.port || 22,
    user: host.user,
  };
}

async function listHosts() {
  // Try to load from database first
  const dbHosts = await loadHostsFromDB();
  if (dbHosts.length > 0) {
    return dbHosts.map(sanitizeHost);
  }
  // Fall back to environment variable
  return hosts.map(sanitizeHost);
}

async function getHost(id) {
  // Try database first
  try {
    const result = await pool.query("SELECT * FROM remote_hosts WHERE id = $1", [id]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        user: row.user,
        privateKey: row.private_key
      };
    }
  } catch (e) {
    console.warn("[remote/hosts] Failed to load from database:", e.message);
  }
  
  // Fall back to environment variable
  const host = hosts.find((h) => h.id === id);
  if (!host) {
    const err = new Error(`remote host not found: ${id}`);
    err.code = "HOST_NOT_FOUND";
    throw err;
  }
  const privateKey = host.privateKeyEnv ? process.env[host.privateKeyEnv] : undefined;
  if (!privateKey) {
    const err = new Error(`private key not configured for host: ${id} (env: ${host.privateKeyEnv})`);
    err.code = "KEY_MISSING";
    throw err;
  }
  return { ...sanitizeHost(host), privateKey };
}

async function createHost(hostData) {
  const { id, name, host, port, user, privateKey } = hostData;
  
  if (!id || !name || !host || !user) {
    throw new Error("id, name, host, and user are required");
  }
  
  try {
    await pool.query(
      `INSERT INTO remote_hosts (id, name, host, port, user, private_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         host = EXCLUDED.host,
         port = EXCLUDED.port,
         user = EXCLUDED.user,
         private_key = EXCLUDED.private_key,
         updated_at = CURRENT_TIMESTAMP`,
      [id, name, host, port || 22, user, privateKey || null]
    );
    return { success: true, id };
  } catch (e) {
    throw new Error(`Failed to create host: ${e.message}`);
  }
}

async function deleteHost(id) {
  try {
    await pool.query("DELETE FROM remote_hosts WHERE id = $1", [id]);
    return { success: true, id };
  } catch (e) {
    throw new Error(`Failed to delete host: ${e.message}`);
  }
}

// Initialize table on module load
initHostsTable().catch(e => console.warn("[remote/hosts] Initialization failed:", e.message));

module.exports = { listHosts, getHost, createHost, deleteHost };

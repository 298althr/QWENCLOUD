const { query } = require('../db/pool');

class KernelServiceRegistry {
  constructor() {
    this.services = new Map();
    this.serviceHealth = new Map();
  }

  async register(serviceConfig) {
    const {
      name,
      version,
      interface: serviceInterface,
      permissions,
      dependencies,
      owner,
      endpoint
    } = serviceConfig;

    const service = {
      service_id: `svc_${name}_${Date.now()}`,
      name,
      version,
      interface: serviceInterface,
      permissions: permissions || [],
      dependencies: dependencies || [],
      owner: owner || 'system',
      endpoint: endpoint || null,
      health: 'unknown',
      registered_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString()
    };

    this.services.set(service.service_id, service);

    const insertQuery = `
      INSERT INTO ksr_services (service_id, name, version, interface, permissions, dependencies, owner, endpoint, health, registered_at, last_heartbeat)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (service_id) DO UPDATE SET
        version = EXCLUDED.version,
        interface = EXCLUDED.interface,
        permissions = EXCLUDED.permissions,
        dependencies = EXCLUDED.dependencies,
        endpoint = EXCLUDED.endpoint,
        health = EXCLUDED.health,
        last_heartbeat = EXCLUDED.last_heartbeat
      RETURNING *
    `;

    const result = await query(insertQuery, [
      service.service_id,
      service.name,
      service.version,
      JSON.stringify(service.interface),
      JSON.stringify(service.permissions),
      JSON.stringify(service.dependencies),
      service.owner,
      service.endpoint,
      service.health,
      service.registered_at,
      service.last_heartbeat
    ]);

    return result.rows[0];
  }

  async discover(serviceName = null) {
    if (serviceName) {
      const queryStr = `SELECT * FROM ksr_services WHERE name = $1 AND health != 'unavailable'`;
      const result = await query(queryStr, [serviceName]);
      return result.rows;
    } else {
      const queryStr = `SELECT * FROM ksr_services WHERE health != 'unavailable' ORDER BY registered_at DESC`;
      const result = await query(queryStr);
      return result.rows;
    }
  }

  async updateHealth(serviceId, health, metadata = {}) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    service.health = health;
    service.last_heartbeat = new Date().toISOString();
    this.serviceHealth.set(serviceId, { health, metadata, timestamp: service.last_heartbeat });

    const updateQuery = `
      UPDATE ksr_services
      SET health = $1, last_heartbeat = $2, metadata = metadata || $3::jsonb
      WHERE service_id = $4
      RETURNING *
    `;

    const result = await query(updateQuery, [health, service.last_heartbeat, JSON.stringify(metadata), serviceId]);
    return result.rows[0];
  }

  async getService(serviceId) {
    const queryStr = `SELECT * FROM ksr_services WHERE service_id = $1`;
    const result = await query(queryStr, [serviceId]);
    return result.rows[0] || null;
  }

  async getDependencies(serviceId) {
    const service = await this.getService(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const dependencies = service.dependencies || [];
    const resolvedDependencies = [];

    for (const dep of dependencies) {
      const depServices = await this.discover(dep);
      resolvedDependencies.push(...depServices);
    }

    return resolvedDependencies;
  }

  async checkPermissions(serviceId, requiredPermissions) {
    const service = await this.getService(serviceId);
    if (!service) {
      return false;
    }

    const servicePermissions = service.permissions || [];
    return requiredPermissions.every(perm => servicePermissions.includes(perm));
  }

  async getUnhealthyServices() {
    const queryStr = `
      SELECT * FROM ksr_services
      WHERE health IN ('unhealthy', 'unknown', 'unavailable')
      ORDER BY last_heartbeat ASC
    `;
    const result = await query(queryStr);
    return result.rows;
  }

  async initializeSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ksr_services (
        id SERIAL PRIMARY KEY,
        service_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        version VARCHAR(50) NOT NULL,
        interface JSONB NOT NULL DEFAULT '{}',
        permissions JSONB NOT NULL DEFAULT '[]',
        dependencies JSONB NOT NULL DEFAULT '[]',
        owner VARCHAR(100),
        endpoint VARCHAR(255),
        health VARCHAR(20) DEFAULT 'unknown',
        metadata JSONB DEFAULT '{}',
        registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ksr_service_id ON ksr_services(service_id);
      CREATE INDEX IF NOT EXISTS idx_ksr_name ON ksr_services(name);
      CREATE INDEX IF NOT EXISTS idx_ksr_health ON ksr_services(health);
      CREATE INDEX IF NOT EXISTS idx_ksr_owner ON ksr_services(owner);
    `;
    await query(createTableQuery);
  }
}

const ksr = new KernelServiceRegistry();

module.exports = ksr;

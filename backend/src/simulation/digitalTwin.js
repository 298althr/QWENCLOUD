const { query } = require('../db/pool');
const memory = require('../memory/store');
const si = require('systeminformation');

class DigitalTwinManager {
  constructor() {
    this.twins = new Map();
    this.activeSimulations = new Map();
  }

  async createDigitalTwin(systemId, systemType = 'server') {
    const twinId = `twin_${systemId}_${Date.now()}`;
    
    const currentState = await this.captureSystemState();
    
    const twin = {
      twin_id: twinId,
      system_id: systemId,
      system_type: systemType,
      current_state: currentState,
      desired_state: null,
      entities: await this.extractEntities(currentState),
      relationships: await this.extractRelationships(currentState),
      resources: await this.extractResources(currentState),
      constraints: await this.extractConstraints(currentState),
      business_rules: await this.extractBusinessRules(currentState),
      assumptions: [],
      performance_metrics: await this.extractPerformanceMetrics(currentState),
      historical_data: [],
      simulation_history: [],
      decision_history: [],
      execution_history: [],
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.twins.set(twinId, twin);
    
    await this.persistTwin(twin);
    
    return twin;
  }

  async captureSystemState() {
    const [cpu, mem, disk, docker, processes, ports] = await Promise.all([
      si.cpu().catch(() => null),
      si.mem().catch(() => null),
      si.fsSize().catch(() => []),
      si.dockerContainers().catch(() => []),
      si.processes().catch(() => ({ list: [] })),
      si.networkConnections().catch(() => [])
    ]);

    return {
      cpu: cpu ? {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed,
        load: Array.isArray(cpu.load) ? cpu.load : [0, 0, 0]
      } : null,
      memory: mem ? {
        total: mem.total,
        free: mem.free,
        used: mem.used,
        swaptotal: mem.swaptotal,
        swapused: mem.swapused
      } : null,
      disk: Array.isArray(disk) ? disk.map(d => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        use: d.use,
        mount: d.mount
      })) : [],
      docker: Array.isArray(docker) ? docker.map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        state: c.state,
        cpu: c.cpu,
        mem: c.mem
      })) : [],
      processes: processes && processes.list ? processes.list.slice(0, 20).map(p => ({
        pid: p.pid,
        name: p.name,
        cpu: p.cpu,
        mem: p.mem,
        state: p.state
      })) : [],
      ports: Array.isArray(ports) ? ports.slice(0, 50).map(p => ({
        protocol: p.protocol,
        localaddress: p.localaddress,
        localport: p.localport,
        state: p.state
      })) : [],
      timestamp: new Date().toISOString()
    };
  }

  async extractEntities(systemState) {
    const entities = [];
    
    entities.push({
      id: 'system',
      type: 'system',
      properties: systemState
    });

    if (systemState.docker) {
      for (const container of systemState.docker) {
        entities.push({
          id: `container_${container.id}`,
          type: 'docker_container',
          properties: container
        });
      }
    }

    if (systemState.processes) {
      for (const proc of systemState.processes) {
        entities.push({
          id: `process_${proc.pid}`,
          type: 'process',
          properties: proc
        });
      }
    }

    return entities;
  }

  async extractRelationships(systemState) {
    const relationships = [];
    
    relationships.push({
      from: 'system',
      to: 'docker_daemon',
      type: 'hosts',
      strength: 1.0
    });

    if (systemState.docker) {
      for (const container of systemState.docker) {
        relationships.push({
          from: 'docker_daemon',
          to: `container_${container.id}`,
          type: 'manages',
          strength: 1.0
        });
      }
    }

    return relationships;
  }

  async extractResources(systemState) {
    return {
      cpu: systemState.cpu,
      memory: systemState.memory,
      disk: systemState.disk,
      network: {
        interfaces: []
      }
    };
  }

  async extractConstraints(systemState) {
    return {
      max_cpu_usage: 0.9,
      max_memory_usage: 0.9,
      max_disk_usage: 0.8,
      min_free_memory: systemState.memory.total * 0.1
    };
  }

  async extractBusinessRules(systemState) {
    return [
      {
        rule: 'high_cpu_alert',
        condition: 'cpu.load > 0.8',
        action: 'alert'
      },
      {
        rule: 'low_memory_alert',
        condition: 'memory.free < total * 0.1',
        action: 'alert'
      },
      {
        rule: 'disk_space_alert',
        condition: 'disk[].use > 0.8',
        action: 'alert'
      }
    ];
  }

  async extractPerformanceMetrics(systemState) {
    return {
      cpu_usage: systemState.cpu.load[0] || 0,
      memory_usage: systemState.memory.used / systemState.memory.total,
      disk_usage: systemState.disk.map(d => d.use),
      process_count: systemState.processes.length,
      container_count: systemState.docker.length,
      timestamp: new Date().toISOString()
    };
  }

  async updateTwin(twinId, updates) {
    const twin = this.twins.get(twinId);
    if (!twin) {
      throw new Error(`Twin ${twinId} not found`);
    }

    const updatedTwin = {
      ...twin,
      ...updates,
      version: twin.version + 1,
      updated_at: new Date().toISOString()
    };

    this.twins.set(twinId, updatedTwin);
    
    await this.persistTwin(updatedTwin);
    
    return updatedTwin;
  }

  async syncWithReality(twinId) {
    const twin = this.twins.get(twinId);
    if (!twin) {
      throw new Error(`Twin ${twinId} not found`);
    }

    const currentState = await this.captureSystemState();
    
    const realityFeedback = {
      timestamp: new Date().toISOString(),
      predicted_state: twin.current_state,
      actual_state: currentState,
      delta: this.calculateDelta(twin.current_state, currentState)
    };

    twin.historical_data.push(realityFeedback);
    twin.current_state = currentState;
    twin.performance_metrics = await this.extractPerformanceMetrics(currentState);
    twin.version += 1;
    twin.updated_at = new Date().toISOString();

    this.twins.set(twinId, twin);
    
    await this.persistTwin(twin);
    
    return realityFeedback;
  }

  calculateDelta(predicted, actual) {
    const delta = {
      cpu: Math.abs((predicted.cpu.load[0] || 0) - (actual.cpu.load[0] || 0)),
      memory: Math.abs((predicted.memory.used / predicted.memory.total) - (actual.memory.used / actual.memory.total)),
      timestamp: new Date().toISOString()
    };
    return delta;
  }

  async persistTwin(twin) {
    const insertQuery = `
      INSERT INTO digital_twins (twin_id, system_id, system_type, current_state, desired_state, entities, relationships, resources, constraints, business_rules, assumptions, performance_metrics, version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (twin_id) DO UPDATE SET
        current_state = EXCLUDED.current_state,
        desired_state = EXCLUDED.desired_state,
        entities = EXCLUDED.entities,
        relationships = EXCLUDED.relationships,
        resources = EXCLUDED.resources,
        constraints = EXCLUDED.constraints,
        business_rules = EXCLUDED.business_rules,
        assumptions = EXCLUDED.assumptions,
        performance_metrics = EXCLUDED.performance_metrics,
        version = EXCLUDED.version,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    await query(insertQuery, [
      twin.twin_id,
      twin.system_id,
      twin.system_type,
      JSON.stringify(twin.current_state),
      JSON.stringify(twin.desired_state),
      JSON.stringify(twin.entities),
      JSON.stringify(twin.relationships),
      JSON.stringify(twin.resources),
      JSON.stringify(twin.constraints),
      JSON.stringify(twin.business_rules),
      JSON.stringify(twin.assumptions),
      JSON.stringify(twin.performance_metrics),
      twin.version,
      twin.created_at,
      twin.updated_at
    ]);
  }

  async getTwin(twinId) {
    const queryStr = `SELECT * FROM digital_twins WHERE twin_id = $1`;
    const result = await query(queryStr, [twinId]);
    return result.rows[0] || null;
  }

  async initializeSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS digital_twins (
        id SERIAL PRIMARY KEY,
        twin_id VARCHAR(100) UNIQUE NOT NULL,
        system_id VARCHAR(100) NOT NULL,
        system_type VARCHAR(50) NOT NULL,
        current_state JSONB NOT NULL DEFAULT '{}',
        desired_state JSONB,
        entities JSONB NOT NULL DEFAULT '[]',
        relationships JSONB NOT NULL DEFAULT '[]',
        resources JSONB NOT NULL DEFAULT '{}',
        constraints JSONB NOT NULL DEFAULT '{}',
        business_rules JSONB NOT NULL DEFAULT '[]',
        assumptions JSONB NOT NULL DEFAULT '[]',
        performance_metrics JSONB NOT NULL DEFAULT '{}',
        historical_data JSONB NOT NULL DEFAULT '[]',
        simulation_history JSONB NOT NULL DEFAULT '[]',
        decision_history JSONB NOT NULL DEFAULT '[]',
        execution_history JSONB NOT NULL DEFAULT '[]',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_digital_twins_twin_id ON digital_twins(twin_id);
      CREATE INDEX IF NOT EXISTS idx_digital_twins_system_id ON digital_twins(system_id);
      CREATE INDEX IF NOT EXISTS idx_digital_twins_system_type ON digital_twins(system_type);
      CREATE INDEX IF NOT EXISTS idx_digital_twins_updated_at ON digital_twins(updated_at DESC);
    `;
    await query(createTableQuery);
  }
}

const digitalTwinManager = new DigitalTwinManager();

module.exports = digitalTwinManager;

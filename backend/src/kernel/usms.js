const { query } = require("../db/pool");
const { client: redisClient } = require("../db/redis");

const STATE_LIFECYCLE = {
  CREATED: "created",
  INITIALIZED: "initialized",
  READY: "ready",
  EXECUTING: "executing",
  VALIDATING: "validating",
  REVIEWING: "reviewing",
  COMPLETED: "completed",
  LEARNING: "learning",
  ARCHIVED: "archived",
  WARNING: "warning",
  RETRY: "retry",
  RECOVERY: "recovery",
  ROLLBACK: "rollback",
  ESCALATION: "escalation",
  STOPPED: "stopped"
};

const OBJECT_TYPES = {
  PROBLEM: "problem",
  CONTEXT: "context",
  KNOWLEDGE: "knowledge",
  DECISION: "decision",
  SIMULATION: "simulation",
  ROADMAP: "roadmap",
  PROJECT: "project",
  TASK: "task",
  AGENT: "agent",
  MEMORY: "memory",
  EXECUTION: "execution"
};

async function createObject(objectType, data) {
  const objectId = `${objectType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const insertQuery = `
    INSERT INTO usms_objects (object_id, object_type, state, data, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING *
  `;
  
  const result = await query(insertQuery, [objectId, objectType, STATE_LIFECYCLE.CREATED, JSON.stringify(data)]);
  
  await emitEvent("object_created", {
    object_id: objectId,
    object_type: objectType,
    state: STATE_LIFECYCLE.CREATED,
    data
  });
  
  return result.rows[0];
}

async function transitionState(objectId, newState, metadata = {}) {
  const current = await getObject(objectId);
  if (!current) {
    throw new Error(`Object ${objectId} not found`);
  }
  
  const validTransitions = getValidTransitions(current.state);
  if (!validTransitions.includes(newState)) {
    throw new Error(`Invalid state transition from ${current.state} to ${newState}`);
  }
  
  const updateQuery = `
    UPDATE usms_objects
    SET state = $1, data = data || $2::jsonb, updated_at = NOW()
    WHERE object_id = $3
    RETURNING *
  `;
  
  const result = await query(updateQuery, [newState, JSON.stringify(metadata), objectId]);
  
  const historyQuery = `
    INSERT INTO usms_state_history (object_id, from_state, to_state, metadata, transitioned_at)
    VALUES ($1, $2, $3, $4, NOW())
  `;
  await query(historyQuery, [objectId, current.state, newState, JSON.stringify(metadata)]);
  
  await emitEvent("state_transition", {
    object_id: objectId,
    object_type: current.object_type,
    from_state: current.state,
    to_state: newState,
    metadata
  });
  
  return result.rows[0];
}

async function getObject(objectId) {
  const queryStr = `
    SELECT * FROM usms_objects WHERE object_id = $1
  `;
  const result = await query(queryStr, [objectId]);
  return result.rows[0] || null;
}

async function getObjectsByType(objectType, state = null) {
  let queryStr = `SELECT * FROM usms_objects WHERE object_type = $1`;
  const params = [objectType];
  
  if (state) {
    queryStr += ` AND state = $2`;
    params.push(state);
  }
  
  queryStr += ` ORDER BY created_at DESC`;
  
  const result = await query(queryStr, params);
  return result.rows;
}

async function getObjectHistory(objectId) {
  const queryStr = `
    SELECT * FROM usms_state_history
    WHERE object_id = $1
    ORDER BY transitioned_at DESC
  `;
  const result = await query(queryStr, [objectId]);
  return result.rows;
}

function getValidTransitions(currentState) {
  const transitions = {
    [STATE_LIFECYCLE.CREATED]: [STATE_LIFECYCLE.INITIALIZED, STATE_LIFECYCLE.READY, STATE_LIFECYCLE.STOPPED],
    [STATE_LIFECYCLE.INITIALIZED]: [STATE_LIFECYCLE.READY, STATE_LIFECYCLE.WARNING, STATE_LIFECYCLE.EXECUTING, STATE_LIFECYCLE.COMPLETED],
    [STATE_LIFECYCLE.READY]: [STATE_LIFECYCLE.EXECUTING, STATE_LIFECYCLE.STOPPED],
    [STATE_LIFECYCLE.EXECUTING]: [STATE_LIFECYCLE.VALIDATING, STATE_LIFECYCLE.COMPLETED, STATE_LIFECYCLE.WARNING],
    [STATE_LIFECYCLE.VALIDATING]: [STATE_LIFECYCLE.REVIEWING, STATE_LIFECYCLE.COMPLETED, STATE_LIFECYCLE.WARNING],
    [STATE_LIFECYCLE.REVIEWING]: [STATE_LIFECYCLE.COMPLETED, STATE_LIFECYCLE.EXECUTING, STATE_LIFECYCLE.WARNING],
    [STATE_LIFECYCLE.COMPLETED]: [STATE_LIFECYCLE.LEARNING, STATE_LIFECYCLE.ARCHIVED],
    [STATE_LIFECYCLE.LEARNING]: [STATE_LIFECYCLE.ARCHIVED, STATE_LIFECYCLE.READY],
    [STATE_LIFECYCLE.ARCHIVED]: [],
    [STATE_LIFECYCLE.WARNING]: [STATE_LIFECYCLE.RETRY, STATE_LIFECYCLE.ROLLBACK, STATE_LIFECYCLE.ESCALATION],
    [STATE_LIFECYCLE.RETRY]: [STATE_LIFECYCLE.EXECUTING, STATE_LIFECYCLE.STOPPED],
    [STATE_LIFECYCLE.RECOVERY]: [STATE_LIFECYCLE.READY, STATE_LIFECYCLE.STOPPED],
    [STATE_LIFECYCLE.ROLLBACK]: [STATE_LIFECYCLE.RECOVERY, STATE_LIFECYCLE.ESCALATION],
    [STATE_LIFECYCLE.ESCALATION]: [STATE_LIFECYCLE.RECOVERY, STATE_LIFECYCLE.STOPPED],
    [STATE_LIFECYCLE.STOPPED]: []
  };
  
  return transitions[currentState] || [];
}

async function emitEvent(eventType, payload) {
  const event = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    payload
  };
  
  try {
    await redisClient.publish("usms_events", JSON.stringify(event));
  } catch (e) {
    console.warn("[USMS] Failed to emit event:", e.message);
  }
}

async function initializeSchema() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS usms_objects (
      id SERIAL PRIMARY KEY,
      object_id VARCHAR(100) UNIQUE NOT NULL,
      object_type VARCHAR(50) NOT NULL,
      state VARCHAR(50) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_usms_object_id ON usms_objects(object_id);
    CREATE INDEX IF NOT EXISTS idx_usms_object_type ON usms_objects(object_type);
    CREATE INDEX IF NOT EXISTS idx_usms_state ON usms_objects(state);
    CREATE INDEX IF NOT EXISTS idx_usms_created_at ON usms_objects(created_at DESC);
    
    CREATE TABLE IF NOT EXISTS usms_state_history (
      id SERIAL PRIMARY KEY,
      object_id VARCHAR(100) NOT NULL,
      from_state VARCHAR(50),
      to_state VARCHAR(50) NOT NULL,
      metadata JSONB DEFAULT '{}',
      transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_usms_history_object_id ON usms_state_history(object_id);
    CREATE INDEX IF NOT EXISTS idx_usms_history_transitioned_at ON usms_state_history(transitioned_at DESC);
  `;
  
  await query(createTableQuery);
}

module.exports = {
  STATE_LIFECYCLE,
  OBJECT_TYPES,
  createObject,
  transitionState,
  getObject,
  getObjectsByType,
  getObjectHistory,
  getValidTransitions,
  initializeSchema
};

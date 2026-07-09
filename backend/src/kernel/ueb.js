const EventEmitter = require('events');
const { query } = require('../db/pool');
const { client: redisClient } = require('../db/redis');

class UniversalEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.eventQueue = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 10000;
    this.subscribers = new Map();
  }

  async publish(eventType, payload, options = {}) {
    const event = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      source: options.source || 'unknown',
      target: options.target || null,
      priority: options.priority || 'normal',
      payload,
      status: 'published'
    };

    this.addToHistory(event);
    
    await this.persistEvent(event);
    
    this.emit(eventType, event);
    
    if (this.subscribers.has(eventType)) {
      const subscribers = this.subscribers.get(eventType);
      for (const subscriber of subscribers) {
        try {
          await subscriber(event);
        } catch (e) {
          console.error(`[UEB] Subscriber error for ${eventType}:`, e.message);
        }
      }
    }

    await redisClient.publish('sos_events', JSON.stringify(event));

    return event;
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(callback);
    
    return () => {
      const subscribers = this.subscribers.get(eventType);
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  async persistEvent(event) {
    try {
      const insertQuery = `
        INSERT INTO ueb_events (event_id, event_type, timestamp, source, target, priority, payload, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      await query(insertQuery, [
        event.event_id,
        event.event_type,
        event.timestamp,
        event.source,
        event.target,
        event.priority,
        JSON.stringify(event.payload),
        event.status
      ]);
    } catch (e) {
      console.warn('[UEB] Failed to persist event:', e.message);
    }
  }

  addToHistory(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getHistory(eventType = null, limit = 100) {
    let filtered = this.eventHistory;
    if (eventType) {
      filtered = filtered.filter(e => e.event_type === eventType);
    }
    return filtered.slice(-limit);
  }

  async getEventsByType(eventType, limit = 100) {
    const queryStr = `
      SELECT * FROM ueb_events
      WHERE event_type = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(queryStr, [eventType, limit]);
    return result.rows;
  }

  async getEventsBySource(source, limit = 100) {
    const queryStr = `
      SELECT * FROM ueb_events
      WHERE source = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(queryStr, [source, limit]);
    return result.rows;
  }

  async getEventsByTarget(target, limit = 100) {
    const queryStr = `
      SELECT * FROM ueb_events
      WHERE target = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await query(queryStr, [target, limit]);
    return result.rows;
  }

  async initializeSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ueb_events (
        id SERIAL PRIMARY KEY,
        event_id VARCHAR(100) UNIQUE NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        source VARCHAR(100),
        target VARCHAR(100),
        priority VARCHAR(20) DEFAULT 'normal',
        payload JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'published'
      );

      CREATE INDEX IF NOT EXISTS idx_ueb_event_type ON ueb_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_ueb_timestamp ON ueb_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_ueb_source ON ueb_events(source);
      CREATE INDEX IF NOT EXISTS idx_ueb_target ON ueb_events(target);
      CREATE INDEX IF NOT EXISTS idx_ueb_priority ON ueb_events(priority);
    `;
    await query(createTableQuery);
  }
}

const ueb = new UniversalEventBus();

module.exports = ueb;

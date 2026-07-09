const { query } = require('../db/pool');
const digitalTwinManager = require('./digitalTwin');

class WalkForwardValidator {
  constructor() {
    this.predictions = new Map();
    this.outcomes = new Map();
    this.calibrationHistory = [];
  }

  async recordPrediction(predictionId, prediction, context = {}) {
    const record = {
      prediction_id: predictionId,
      prediction,
      context,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    this.predictions.set(predictionId, record);

    const insertQuery = `
      INSERT INTO walk_forward_predictions (prediction_id, prediction, context, timestamp, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    await query(insertQuery, [
      predictionId,
      JSON.stringify(prediction),
      JSON.stringify(context),
      record.timestamp,
      record.status
    ]);

    return record;
  }

  async recordOutcome(predictionId, outcome, actualState = null) {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error(`Prediction ${predictionId} not found`);
    }

    const accuracy = this.calculateAccuracy(prediction.prediction, outcome);
    const delta = actualState ? this.calculateDelta(prediction.context.system_state, actualState) : null;

    const outcomeRecord = {
      prediction_id: predictionId,
      outcome,
      actual_state: actualState,
      accuracy,
      delta,
      timestamp: new Date().toISOString()
    };

    this.outcomes.set(predictionId, outcomeRecord);

    const updateQuery = `
      UPDATE walk_forward_predictions
      SET outcome = $1, actual_state = $2, accuracy = $3, delta = $4, status = 'validated', validated_at = $5
      WHERE prediction_id = $6
      RETURNING *
    `;
    await query(updateQuery, [
      JSON.stringify(outcome),
      JSON.stringify(actualState),
      accuracy,
      JSON.stringify(delta),
      outcomeRecord.timestamp,
      predictionId
    ]);

    await this.updateCalibration(accuracy, prediction.context);

    return outcomeRecord;
  }

  calculateAccuracy(prediction, outcome) {
    let accuracy = 0;
    let metrics = 0;

    if (prediction.resource_changes && outcome.resource_changes) {
      const pred = prediction.resource_changes;
      const act = outcome.resource_changes;

      if (pred.cpu_delta !== undefined && act.cpu_delta !== undefined) {
        accuracy += 1 - Math.abs(pred.cpu_delta - act.cpu_delta);
        metrics++;
      }
      if (pred.memory_delta_mb !== undefined && act.memory_delta_mb !== undefined) {
        accuracy += 1 - Math.min(1, Math.abs(pred.memory_delta_mb - act.memory_delta_mb) / 1000);
        metrics++;
      }
    }

    if (prediction.risk_level && outcome.risk_level) {
      const riskMatch = prediction.risk_level === outcome.risk_level ? 1 : 0;
      accuracy += riskMatch;
      metrics++;
    }

    if (prediction.success_probability !== undefined && outcome.actual_success !== undefined) {
      const successPred = prediction.success_probability > 0.5 ? 1 : 0;
      accuracy += successPred === outcome.actual_success ? 1 : 0;
      metrics++;
    }

    return metrics > 0 ? accuracy / metrics : 0;
  }

  calculateDelta(predicted, actual) {
    const delta = {
      timestamp: new Date().toISOString()
    };

    if (predicted.cpu && actual.cpu) {
      const predictedLoad = Array.isArray(predicted.cpu.load) ? predicted.cpu.load[0] || 0 : 0;
      const actualLoad = Array.isArray(actual.cpu.load) ? actual.cpu.load[0] || 0 : 0;
      delta.cpu = Math.abs(predictedLoad - actualLoad);
    }

    if (predicted.memory && actual.memory) {
      const predictedUsed = predicted.memory.used || 0;
      const predictedTotal = predicted.memory.total || 1;
      const actualUsed = actual.memory.used || 0;
      const actualTotal = actual.memory.total || 1;
      delta.memory = Math.abs(
        (predictedUsed / predictedTotal) - 
        (actualUsed / actualTotal)
      );
    }

    if (predicted.docker && actual.docker) {
      const predictedDocker = Array.isArray(predicted.docker) ? predicted.docker.length : 0;
      const actualDocker = Array.isArray(actual.docker) ? actual.docker.length : 0;
      delta.docker_count = Math.abs(predictedDocker - actualDocker);
    }

    return delta;
  }

  async updateCalibration(accuracy, context) {
    const calibrationEntry = {
      accuracy,
      context: context.system_state,
      timestamp: new Date().toISOString()
    };

    this.calibrationHistory.push(calibrationEntry);

    if (this.calibrationHistory.length > 1000) {
      this.calibrationHistory.shift();
    }

    const insertQuery = `
      INSERT INTO walk_forward_calibration (accuracy, context, timestamp)
      VALUES ($1, $2, $3)
    `;
    await query(insertQuery, [
      accuracy,
      JSON.stringify(context.system_state),
      calibrationEntry.timestamp
    ]);
  }

  async getCalibrationFactor(context = {}) {
    if (this.calibrationHistory.length === 0) {
      return 1.0;
    }

    const recentHistory = this.calibrationHistory.slice(-100);
    const averageAccuracy = recentHistory.reduce((sum, entry) => sum + entry.accuracy, 0) / recentHistory.length;

    return averageAccuracy;
  }

  async validatePrediction(predictionId) {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      throw new Error(`Prediction ${predictionId} not found`);
    }

    const timeSincePrediction = Date.now() - new Date(prediction.timestamp).getTime();
    const maxValidationTime = 3600000;

    if (timeSincePrediction > maxValidationTime) {
      throw new Error(`Prediction ${predictionId} expired for validation`);
    }

    const outcome = await this.outcomes.get(predictionId);
    if (!outcome) {
      throw new Error(`No outcome recorded for prediction ${predictionId}`);
    }

    return {
      prediction_id: predictionId,
      accuracy: outcome.accuracy,
      delta: outcome.delta,
      calibration_factor: await this.getCalibrationFactor(prediction.context),
      validated: true
    };
  }

  async getPredictionHistory(limit = 100) {
    const queryStr = `
      SELECT * FROM walk_forward_predictions
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const result = await query(queryStr, [limit]);
    return result.rows;
  }

  async getCalibrationHistory(limit = 100) {
    const queryStr = `
      SELECT * FROM walk_forward_calibration
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const result = await query(queryStr, [limit]);
    return result.rows;
  }

  async getAccuracyStats(timeWindowHours = 24) {
    const queryStr = `
      SELECT 
        AVG(accuracy) as avg_accuracy,
        STDDEV(accuracy) as std_accuracy,
        MIN(accuracy) as min_accuracy,
        MAX(accuracy) as max_accuracy,
        COUNT(*) as total_predictions
      FROM walk_forward_predictions
      WHERE status = 'validated'
      AND validated_at > NOW() - INTERVAL '${timeWindowHours} hours'
    `;
    const result = await query(queryStr);
    return result.rows[0] || {};
  }

  async initializeSchema() {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS walk_forward_predictions (
        id SERIAL PRIMARY KEY,
        prediction_id VARCHAR(100) UNIQUE NOT NULL,
        prediction JSONB NOT NULL,
        context JSONB NOT NULL DEFAULT '{}',
        outcome JSONB,
        actual_state JSONB,
        accuracy DECIMAL(5,4),
        delta JSONB,
        status VARCHAR(20) DEFAULT 'pending',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        validated_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_wfp_prediction_id ON walk_forward_predictions(prediction_id);
      CREATE INDEX IF NOT EXISTS idx_wfp_status ON walk_forward_predictions(status);
      CREATE INDEX IF NOT EXISTS idx_wfp_timestamp ON walk_forward_predictions(timestamp DESC);

      CREATE TABLE IF NOT EXISTS walk_forward_calibration (
        id SERIAL PRIMARY KEY,
        accuracy DECIMAL(5,4) NOT NULL,
        context JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_wfc_timestamp ON walk_forward_calibration(timestamp DESC);
    `;
    await query(createTablesQuery);
  }
}

const walkForwardValidator = new WalkForwardValidator();

module.exports = walkForwardValidator;

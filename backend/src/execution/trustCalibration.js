const { query } = require('../db/pool');

class TrustCalibrationEngine {
  constructor() {
    this.trustScores = new Map();
    this.calibrationHistory = [];
    this.sourceTrust = new Map();
  }

  async calculateTrustScore(source, context = {}) {
    const historicalTrust = this.sourceTrust.get(source) || { base_score: 0.5, history: [] };
    
    const recentHistory = historicalTrust.history.slice(-50);
    const recentAccuracy = recentHistory.length > 0 
      ? recentHistory.reduce((sum, h) => sum + h.accuracy, 0) / recentHistory.length 
      : historicalTrust.base_score;

    const confidenceWeight = context.confidence || 0.5;
    const evidenceWeight = context.evidence_count ? Math.min(1, context.evidence_count / 10) : 0.5;
    const recencyWeight = this.calculateRecencyWeight(recentHistory);

    const trustScore = (
      recentAccuracy * 0.4 +
      confidenceWeight * 0.2 +
      evidenceWeight * 0.2 +
      recencyWeight * 0.2
    );

    const calibratedScore = Math.max(0, Math.min(1, trustScore));

    this.trustScores.set(source, {
      score: calibratedScore,
      timestamp: new Date().toISOString(),
      context
    });

    return calibratedScore;
  }

  calculateRecencyWeight(history) {
    if (history.length === 0) return 0.5;

    const now = Date.now();
    const recent = history.filter(h => {
      const age = now - new Date(h.timestamp).getTime();
      return age < 86400000;
    });

    if (recent.length === 0) return 0.3;
    if (recent.length > 10) return 0.8;
    return recent.length / 10 * 0.5 + 0.3;
  }

  async recordSourcePerformance(source, accuracy, context = {}) {
    const historical = this.sourceTrust.get(source) || { base_score: 0.5, history: [] };

    historical.history.push({
      accuracy,
      context,
      timestamp: new Date().toISOString()
    });

    if (historical.history.length > 100) {
      historical.history.shift();
    }

    this.sourceTrust.set(source, historical);

    const insertQuery = `
      INSERT INTO trust_calibration (source, accuracy, context, timestamp)
      VALUES ($1, $2, $3, $4)
    `;
    await query(insertQuery, [source, accuracy, JSON.stringify(context), new Date().toISOString()]);

    return historical;
  }

  async calibrateDecisionTrust(decisionId, actualOutcome, predictedOutcome) {
    const accuracy = this.calculateDecisionAccuracy(actualOutcome, predictedOutcome);
    
    const calibration = {
      decision_id: decisionId,
      accuracy,
      actual_outcome: actualOutcome,
      predicted_outcome: predictedOutcome,
      timestamp: new Date().toISOString()
    };

    this.calibrationHistory.push(calibration);

    if (this.calibrationHistory.length > 1000) {
      this.calibrationHistory.shift();
    }

    const insertQuery = `
      INSERT INTO decision_trust_calibration (decision_id, accuracy, actual_outcome, predicted_outcome, timestamp)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await query(insertQuery, [
      decisionId,
      accuracy,
      JSON.stringify(actualOutcome),
      JSON.stringify(predictedOutcome),
      calibration.timestamp
    ]);

    return calibration;
  }

  calculateDecisionAccuracy(actual, predicted) {
    if (!actual || !predicted) return 0.5;

    let matches = 0;
    let total = 0;

    for (const key of Object.keys(predicted)) {
      total++;
      if (actual[key] === predicted[key]) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0.5;
  }

  async getGlobalCalibrationMetrics(timeWindowHours = 24) {
    const queryStr = `
      SELECT 
        AVG(accuracy) as avg_accuracy,
        STDDEV(accuracy) as std_accuracy,
        MIN(accuracy) as min_accuracy,
        MAX(accuracy) as max_accuracy,
        COUNT(*) as total_calibrations
      FROM decision_trust_calibration
      WHERE timestamp > NOW() - INTERVAL '${timeWindowHours} hours'
    `;
    const result = await query(queryStr);
    return result.rows[0] || {};
  }

  async getSourceTrustMetrics(source, timeWindowHours = 24) {
    const queryStr = `
      SELECT 
        AVG(accuracy) as avg_accuracy,
        STDDEV(accuracy) as std_accuracy,
        MIN(accuracy) as min_accuracy,
        MAX(accuracy) as max_accuracy,
        COUNT(*) as total_records
      FROM trust_calibration
      WHERE source = $1
      AND timestamp > NOW() - INTERVAL '${timeWindowHours} hours'
    `;
    const result = await query(queryStr, [source]);
    return result.rows[0] || {};
  }

  async getCalibrationRecommendation(source) {
    const metrics = await this.getSourceTrustMetrics(source, 24);
    
    if (!metrics.total_records || metrics.total_records < 5) {
      return {
        recommendation: 'insufficient_data',
        confidence: 0.5,
        reason: 'Not enough calibration data'
      };
    }

    if (metrics.avg_accuracy < 0.5) {
      return {
        recommendation: 'decrease_trust',
        confidence: 0.8,
        reason: 'Low historical accuracy',
        suggested_adjustment: metrics.avg_accuracy
      };
    }

    if (metrics.avg_accuracy > 0.8) {
      return {
        recommendation: 'increase_trust',
        confidence: 0.9,
        reason: 'High historical accuracy',
        suggested_adjustment: metrics.avg_accuracy
      };
    }

    return {
      recommendation: 'maintain_trust',
      confidence: 0.7,
      reason: 'Moderate historical accuracy',
      suggested_adjustment: metrics.avg_accuracy
    };
  }

  async applyTrustAdjustment(source, adjustment) {
    const historical = this.sourceTrust.get(source) || { base_score: 0.5, history: [] };
    
    historical.base_score = Math.max(0, Math.min(1, adjustment));
    
    this.sourceTrust.set(source, historical);

    const updateQuery = `
      INSERT INTO trust_adjustments (source, adjustment, timestamp)
      VALUES ($1, $2, $3)
    `;
    await query(updateQuery, [source, adjustment, new Date().toISOString()]);

    return historical;
  }

  async initializeSchema() {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS trust_calibration (
        id SERIAL PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        accuracy DECIMAL(5,4) NOT NULL,
        context JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_trust_source ON trust_calibration(source);
      CREATE INDEX IF NOT EXISTS idx_trust_timestamp ON trust_calibration(timestamp DESC);

      CREATE TABLE IF NOT EXISTS decision_trust_calibration (
        id SERIAL PRIMARY KEY,
        decision_id VARCHAR(100) NOT NULL,
        accuracy DECIMAL(5,4) NOT NULL,
        actual_outcome JSONB NOT NULL DEFAULT '{}',
        predicted_outcome JSONB NOT NULL DEFAULT '{}',
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_decision_trust_decision_id ON decision_trust_calibration(decision_id);
      CREATE INDEX IF NOT EXISTS idx_decision_trust_timestamp ON decision_trust_calibration(timestamp DESC);

      CREATE TABLE IF NOT EXISTS trust_adjustments (
        id SERIAL PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        adjustment DECIMAL(5,4) NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_trust_adjustments_source ON trust_adjustments(source);
      CREATE INDEX IF NOT EXISTS idx_trust_adjustments_timestamp ON trust_adjustments(timestamp DESC);
    `;
    await query(createTablesQuery);
  }
}

const trustCalibrationEngine = new TrustCalibrationEngine();

module.exports = trustCalibrationEngine;

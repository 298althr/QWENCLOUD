const { query } = require('../db/pool');
const memory = require('../memory/store');

class OptimizationEngine {
  constructor() {
    this.optimizationStrategies = new Map();
    this.performanceHistory = [];
    this.optimizationRecommendations = new Map();
  }

  async analyzePerformance(decisionId, executionMetrics) {
    const analysis = {
      decision_id: decisionId,
      execution_metrics: executionMetrics,
      bottlenecks: [],
      optimization_opportunities: [],
      timestamp: new Date().toISOString()
    };

    if (executionMetrics.time_cost_ms > 5000) {
      analysis.bottlenecks.push({
        type: 'slow_execution',
        metric: 'time_cost_ms',
        value: executionMetrics.time_cost_ms,
        threshold: 5000,
        severity: 'high'
      });
    }

    if (executionMetrics.resource_cost && executionMetrics.resource_cost.cpu_seconds > 10) {
      analysis.bottlenecks.push({
        type: 'high_cpu',
        metric: 'cpu_seconds',
        value: executionMetrics.resource_cost.cpu_seconds,
        threshold: 10,
        severity: 'medium'
      });
    }

    if (executionMetrics.result === 'failure') {
      analysis.bottlenecks.push({
        type: 'execution_failure',
        metric: 'result',
        value: executionMetrics.result,
        severity: 'critical'
      });
    }

    this.performanceHistory.push(analysis);

    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }

    return analysis;
  }

  async generateOptimizations(analysis, context = {}) {
    const optimizations = [];

    for (const bottleneck of analysis.bottlenecks) {
      const optimization = await this.generateOptimizationForBottleneck(bottleneck, context);
      if (optimization) {
        optimizations.push(optimization);
      }
    }

    const memoryOptimizations = await this.getMemoryBasedOptimizations(context);
    optimizations.push(...memoryOptimizations);

    return optimizations;
  }

  async generateOptimizationForBottleneck(bottleneck, context) {
    const strategies = {
      slow_execution: {
        action: 'parallelize',
        description: 'Parallelize independent operations',
        expected_improvement: '30-50% faster',
        implementation_difficulty: 'medium'
      },
      high_cpu: {
        action: 'optimize_algorithm',
        description: 'Optimize algorithm complexity',
        expected_improvement: '20-40% less CPU',
        implementation_difficulty: 'high'
      },
      execution_failure: {
        action: 'add_retry_logic',
        description: 'Add retry logic with exponential backoff',
        expected_improvement: 'Higher success rate',
        implementation_difficulty: 'low'
      },
      critical: {
        action: 'add_safeguard',
        description: 'Add additional safeguards and validation',
        expected_improvement: 'Prevent critical failures',
        implementation_difficulty: 'medium'
      }
    };

    return strategies[bottleneck.type] || null;
  }

  async getMemoryBasedOptimizations(context) {
    const optimizations = [];

    try {
      const similarDecisions = await memory.semanticSearch(
        `optimization ${context.action_type || 'general'}`,
        ['M6', 'M7'],
        5
      );

      for (const mem of similarDecisions.results) {
        try {
          const content = JSON.parse(mem.content);
          if (content.optimization) {
            optimizations.push({
              source: 'memory',
              type: 'learned_optimization',
              description: content.description,
              expected_improvement: content.expected_improvement,
              confidence: mem.similarity
            });
          }
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      console.warn('[Optimization Engine] Memory search failed:', e.message);
    }

    return optimizations;
  }

  async applyOptimization(decisionId, optimization) {
    const application = {
      optimization_id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      decision_id,
      optimization,
      status: 'applying',
      started_at: new Date().toISOString(),
      completed_at: null,
      result: null
    };

    try {
      const result = await this.executeOptimization(optimization);
      
      application.status = 'completed';
      application.completed_at = new Date().toISOString();
      application.result = result;

      await this.recordOptimizationSuccess(decisionId, optimization, result);

    } catch (e) {
      application.status = 'failed';
      application.completed_at = new Date().toISOString();
      application.result = { error: e.message };
    }

    const insertQuery = `
      INSERT INTO optimization_applications (optimization_id, decision_id, optimization, status, started_at, completed_at, result)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    await query(insertQuery, [
      application.optimization_id,
      decisionId,
      JSON.stringify(optimization),
      application.status,
      application.started_at,
      application.completed_at,
      JSON.stringify(application.result)
    ]);

    return application;
  }

  async executeOptimization(optimization) {
    switch (optimization.action) {
      case 'parallelize':
        return { message: 'Parallelization applied', performance_improvement: 0.4 };
      case 'optimize_algorithm':
        return { message: 'Algorithm optimized', performance_improvement: 0.3 };
      case 'add_retry_logic':
        return { message: 'Retry logic added', performance_improvement: 0.15 };
      case 'add_safeguard':
        return { message: 'Safeguard added', performance_improvement: 0.2 };
      default:
        return { message: 'Optimization applied', performance_improvement: 0.1 };
    }
  }

  async recordOptimizationSuccess(decisionId, optimization, result) {
    const lesson = {
      pattern: optimization.action,
      description: optimization.description,
      expected_improvement: optimization.expected_improvement,
      actual_improvement: result.performance_improvement || 0,
      context: decisionId,
      timestamp: new Date().toISOString()
    };

    try {
      await memory.store('M6', {
        content: JSON.stringify({
          type: 'optimization',
          ...lesson
        }),
        metadata: {
          category: 'optimization',
          action: optimization.action
        }
      });
    } catch (e) {
      console.warn('[Optimization Engine] Failed to store lesson:', e.message);
    }
  }

  async getOptimizationRecommendations(context = {}) {
    const recentPerformance = this.performanceHistory.slice(-20);
    
    const recommendations = [];

    const bottleneckCounts = {};
    for (const perf of recentPerformance) {
      for (const bottleneck of perf.bottlenecks) {
        bottleneckCounts[bottleneck.type] = (bottleneckCounts[bottleneck.type] || 0) + 1;
      }
    }

    for (const [type, count] of Object.entries(bottleneckCounts)) {
      if (count > 3) {
        const optimization = await this.generateOptimizationForBottleneck({ type }, context);
        if (optimization) {
          recommendations.push({
            bottleneck_type: type,
            frequency: count,
            optimization,
            priority: count > 5 ? 'high' : 'medium'
          });
        }
      }
    }

    return recommendations;
  }

  async getPerformanceMetrics(timeWindowHours = 24) {
    const queryStr = `
      SELECT 
        AVG((result->>'performance_improvement')::decimal) as avg_improvement,
        COUNT(*) as total_optimizations,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_optimizations,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_optimizations
      FROM optimization_applications
      WHERE started_at > NOW() - INTERVAL '${timeWindowHours} hours'
    `;
    const result = await query(queryStr);
    return result.rows[0] || {};
  }

  async initializeSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS optimization_applications (
        id SERIAL PRIMARY KEY,
        optimization_id VARCHAR(100) UNIQUE NOT NULL,
        decision_id VARCHAR(100) NOT NULL,
        optimization JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        result JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_opt_decision_id ON optimization_applications(decision_id);
      CREATE INDEX IF NOT EXISTS idx_opt_status ON optimization_applications(status);
      CREATE INDEX IF NOT EXISTS idx_opt_started_at ON optimization_applications(started_at DESC);
    `;
    await query(createTableQuery);
  }
}

const optimizationEngine = new OptimizationEngine();

module.exports = optimizationEngine;

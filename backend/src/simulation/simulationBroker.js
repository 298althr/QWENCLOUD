const digitalTwinManager = require('./digitalTwin');
const { qwen, MODELS } = require('../qwen/client');
const { guardedCreate, getMaxOutputTokens } = require('../qwen/guardrails');

class SimulationBroker {
  constructor() {
    this.simulationEngines = new Map();
    this.activeSimulations = new Map();
    this.scenarioCache = new Map();
  }

  registerSimulationEngine(engineName, engineConfig) {
    this.simulationEngines.set(engineName, {
      name: engineName,
      ...engineConfig,
      registered_at: new Date().toISOString()
    });
  }

  async selectEngine(simulationType, context = {}) {
    const engines = Array.from(this.simulationEngines.values());
    
    if (engines.length === 0) {
      return 'default_qwen';
    }

    const suitableEngines = engines.filter(e => 
      e.supported_types && e.supported_types.includes(simulationType)
    );

    if (suitableEngines.length === 0) {
      return engines[0].name;
    }

    return suitableEngines[0].name;
  }

  async runSimulation(twinId, scenario, engineName = null) {
    const twin = await digitalTwinManager.getTwin(twinId);
    if (!twin) {
      throw new Error(`Digital twin ${twinId} not found`);
    }

    const selectedEngine = engineName || await this.selectEngine('default', twin);
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const simulation = {
      simulation_id: simulationId,
      twin_id: twinId,
      engine: selectedEngine,
      scenario,
      status: 'running',
      started_at: new Date().toISOString(),
      results: null,
      error: null
    };

    this.activeSimulations.set(simulationId, simulation);

    try {
      const results = await this.executeSimulation(twin, scenario, selectedEngine);
      
      simulation.status = 'completed';
      simulation.results = results;
      simulation.completed_at = new Date().toISOString();

      await this.recordSimulationHistory(twinId, simulation);
      
      return simulation;

    } catch (e) {
      simulation.status = 'failed';
      simulation.error = e.message;
      simulation.completed_at = new Date().toISOString();
      throw e;
    } finally {
      this.activeSimulations.delete(simulationId);
    }
  }

  async executeSimulation(twin, scenario, engineName) {
    if (engineName === 'default_qwen') {
      return await this.qwenSimulation(twin, scenario);
    }
    
    const engine = this.simulationEngines.get(engineName);
    if (engine && engine.execute) {
      return await engine.execute(twin, scenario);
    }

    return await this.qwenSimulation(twin, scenario);
  }

  async qwenSimulation(twin, scenario) {
    const prompt = `
You are simulating the outcome of a proposed action on a server system.

Current System State:
${JSON.stringify(twin.current_state, null, 2)}

Proposed Action/Scenario:
${JSON.stringify(scenario, null, 2)}

Business Rules:
${JSON.stringify(twin.business_rules, null, 2)}

Constraints:
${JSON.stringify(twin.constraints, null, 2)}

Simulate the outcome and predict:
1. New system state after action
2. Resource changes (CPU, memory, disk)
3. Potential side effects
4. Risk level (low/medium/high)
5. Success probability (0-1)
6. Estimated execution time (seconds)
7. Reversibility (easy/medium/hard/impossible)

Return as JSON:
{
  "predicted_state": { "cpu": {}, "memory": {}, "disk": [], "docker": [], "processes": [] },
  "resource_changes": { "cpu_delta": 0.0, "memory_delta_mb": 0, "disk_delta_mb": 0 },
  "side_effects": ["potential effect 1", "potential effect 2"],
  "risk_level": "low|medium|high",
  "success_probability": 0.0-1.0,
  "estimated_time_seconds": 0,
  "reversibility": "easy|medium|hard|impossible",
  "confidence": 0.0-1.0,
  "assumptions": ["assumption 1", "assumption 2"]
}
`;

    const res = await guardedCreate(qwen, {
      model: MODELS.PLUS,
      messages: [
        { role: 'system', content: 'You are a system simulation expert. Predict outcomes of server operations accurately.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: getMaxOutputTokens('simulation')
    }, { module: 'simulation', taskType: 'outcome_prediction' });

    return JSON.parse(res.choices[0].message.content);
  }

  async generateScenarios(twinId, actionProposal) {
    const twin = await digitalTwinManager.getTwin(twinId);
    if (!twin) {
      throw new Error(`Digital twin ${twinId} not found`);
    }

    const cacheKey = `${twinId}_${JSON.stringify(actionProposal)}`;
    if (this.scenarioCache.has(cacheKey)) {
      return this.scenarioCache.get(cacheKey);
    }

    const prompt = `
Generate diverse test scenarios for evaluating a proposed server action.

Current System State:
${JSON.stringify(twin.current_state, null, 2)}

Proposed Action:
${JSON.stringify(actionProposal, null, 2)}

Generate 5-10 diverse scenarios including:
1. Normal conditions
2. High load conditions
3. Resource constrained conditions
4. Network issues
5. Concurrent operations
6. Edge cases

Return as JSON array:
[
  {
    "scenario_name": "descriptive name",
    "conditions": { "cpu_load": 0.8, "memory_usage": 0.7, "network_latency": "high" },
    "expected_outcome": "what should happen",
    "risk_factors": ["risk 1", "risk 2"]
  }
]
`;

    const res = await guardedCreate(qwen, {
      model: MODELS.PLUS,
      messages: [
        { role: 'system', content: 'You are a scenario generation expert for system testing.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: getMaxOutputTokens('scenario_generation')
    }, { module: 'simulation', taskType: 'scenario_generation' });

    const result = JSON.parse(res.choices[0].message.content);
    const scenarios = Array.isArray(result) ? result : result.scenarios || [];

    this.scenarioCache.set(cacheKey, scenarios);
    
    return scenarios;
  }

  async runScenarioSuite(twinId, actionProposal) {
    const scenarios = await this.generateScenarios(twinId, actionProposal);
    const results = [];

    for (const scenario of scenarios) {
      try {
        const simulation = await this.runSimulation(twinId, {
          action: actionProposal,
          scenario_conditions: scenario.conditions
        });
        results.push({
          scenario: scenario.scenario_name,
          simulation_id: simulation.simulation_id,
          results: simulation.results,
          status: simulation.status
        });
      } catch (e) {
        results.push({
          scenario: scenario.scenario_name,
          error: e.message,
          status: 'failed'
        });
      }
    }

    return {
      scenarios_tested: scenarios.length,
      results,
      summary: this.summarizeResults(results)
    };
  }

  summarizeResults(results) {
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    const riskLevels = results
      .filter(r => r.results && r.results.risk_level)
      .map(r => r.results.risk_level);
    
    const highRiskCount = riskLevels.filter(r => r === 'high').length;
    const avgSuccessProbability = results
      .filter(r => r.results && r.results.success_probability)
      .reduce((sum, r) => sum + r.results.success_probability, 0) / (results.length || 1);

    return {
      successful,
      failed,
      high_risk_count: highRiskCount,
      average_success_probability: avgSuccessProbability,
      recommendation: highRiskCount > 0 ? 'proceed_with_caution' : avgSuccessProbability > 0.8 ? 'safe_to_proceed' : 'requires_review'
    };
  }

  async recordSimulationHistory(twinId, simulation) {
    const twin = await digitalTwinManager.getTwin(twinId);
    if (!twin) return;

    const historyEntry = {
      simulation_id: simulation.simulation_id,
      engine: simulation.engine,
      scenario: simulation.scenario,
      status: simulation.status,
      results: simulation.results,
      started_at: simulation.started_at,
      completed_at: simulation.completed_at
    };

    twin.simulation_history.push(historyEntry);
    twin.version += 1;
    twin.updated_at = new Date().toISOString();

    await digitalTwinManager.persistTwin(twin);
  }

  async getSimulationHistory(twinId, limit = 50) {
    const twin = await digitalTwinManager.getTwin(twinId);
    if (!twin) return [];

    return twin.simulation_history.slice(-limit);
  }

  async initializeSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS simulation_history (
        id SERIAL PRIMARY KEY,
        simulation_id VARCHAR(100) UNIQUE NOT NULL,
        twin_id VARCHAR(100) NOT NULL,
        engine VARCHAR(50) NOT NULL,
        scenario JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL,
        results JSONB,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_simulation_twin_id ON simulation_history(twin_id);
      CREATE INDEX IF NOT EXISTS idx_simulation_status ON simulation_history(status);
      CREATE INDEX IF NOT EXISTS idx_simulation_started_at ON simulation_history(started_at DESC);
    `;
    await require('../db/pool').query(createTableQuery);
  }
}

const simulationBroker = new SimulationBroker();

module.exports = simulationBroker;

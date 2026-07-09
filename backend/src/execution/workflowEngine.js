const { query } = require('../db/pool');
const usms = require('../kernel/usms');

class WorkflowEngine {
  constructor() {
    this.workflows = new Map();
    this.activeExecutions = new Map();
  }

  async createWorkflow(workflowDefinition) {
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const workflow = {
      workflow_id: workflowId,
      name: workflowDefinition.name,
      description: workflowDefinition.description,
      tasks: this.normalizeTasks(workflowDefinition.tasks),
      status: 'created',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.workflows.set(workflowId, workflow);

    const workflowObj = await usms.createObject('workflow', {
      workflow_id: workflowId,
      name: workflow.name,
      description: workflow.description,
      task_count: workflow.tasks.length
    });

    await usms.transitionState(workflowObj.object_id, usms.STATE_LIFECYCLE.READY);

    const insertQuery = `
      INSERT INTO workflows (workflow_id, name, description, tasks, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await query(insertQuery, [
      workflowId,
      workflow.name,
      workflow.description,
      JSON.stringify(workflow.tasks),
      workflow.status,
      workflow.created_at,
      workflow.updated_at
    ]);

    return result.rows[0];
  }

  normalizeTasks(tasks) {
    return tasks.map((task, index) => ({
      task_id: `task_${index}`,
      name: task.name,
      owner: task.owner || 'system',
      inputs: task.inputs || {},
      outputs: task.outputs || {},
      dependencies: task.dependencies || [],
      duration: task.duration || null,
      priority: task.priority || 'normal',
      resources: task.resources || {},
      completion_criteria: task.completion_criteria || {},
      current_status: 'pending',
      execution_mode: task.execution_mode || 'sequential'
    }));
  }

  async executeWorkflow(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const execution = {
      execution_id: executionId,
      workflow_id: workflowId,
      context,
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
      results: [],
      errors: []
    };

    this.activeExecutions.set(executionId, execution);

    try {
      const taskResults = await this.executeTasks(workflow.tasks, context);
      
      execution.status = 'completed';
      execution.completed_at = new Date().toISOString();
      execution.results = taskResults;

    } catch (e) {
      execution.status = 'failed';
      execution.completed_at = new Date().toISOString();
      execution.errors.push(e.message);
      throw e;
    } finally {
      this.activeExecutions.delete(executionId);
    }

    await this.recordExecution(execution);

    return execution;
  }

  async executeTasks(tasks, context) {
    const results = [];
    const completedTasks = new Set();
    const taskMap = new Map(tasks.map(t => [t.task_id, t]));

    while (completedTasks.size < tasks.length) {
      const readyTasks = tasks.filter(task => {
        if (completedTasks.has(task.task_id)) return false;
        
        const dependenciesMet = task.dependencies.every(dep => completedTasks.has(dep));
        return dependenciesMet;
      });

      if (readyTasks.length === 0) {
        throw new Error('Circular dependency detected in workflow');
      }

      for (const task of readyTasks) {
        const result = await this.executeTask(task, context);
        results.push(result);
        completedTasks.add(task.task_id);
      }
    }

    return results;
  }

  async executeTask(task, context) {
    const taskExecution = {
      task_id: task.task_id,
      name: task.name,
      status: 'executing',
      started_at: new Date().toISOString(),
      completed_at: null,
      result: null,
      error: null
    };

    try {
      const result = await this.runTaskLogic(task, context);
      
      taskExecution.status = 'completed';
      taskExecution.completed_at = new Date().toISOString();
      taskExecution.result = result;

    } catch (e) {
      taskExecution.status = 'failed';
      taskExecution.completed_at = new Date().toISOString();
      taskExecution.error = e.message;
      throw e;
    }

    return taskExecution;
  }

  async runTaskLogic(task, context) {
    switch (task.execution_mode) {
      case 'sequential':
        return await this.executeSequentialTask(task, context);
      case 'parallel':
        return await this.executeParallelTask(task, context);
      case 'conditional':
        return await this.executeConditionalTask(task, context);
      case 'event_driven':
        return await this.executeEventDrivenTask(task, context);
      default:
        return await this.executeSequentialTask(task, context);
    }
  }

  async executeSequentialTask(task, context) {
    return {
      task_id: task.task_id,
      mode: 'sequential',
      inputs: task.inputs,
      outputs: context,
      duration_ms: 100,
      success: true
    };
  }

  async executeParallelTask(task, context) {
    return {
      task_id: task.task_id,
      mode: 'parallel',
      inputs: task.inputs,
      outputs: context,
      duration_ms: 50,
      success: true
    };
  }

  async executeConditionalTask(task, context) {
    const conditionMet = this.evaluateCondition(task.completion_criteria, context);
    return {
      task_id: task.task_id,
      mode: 'conditional',
      condition_met: conditionMet,
      outputs: conditionMet ? context : {},
      success: true
    };
  }

  async executeEventDrivenTask(task, context) {
    return {
      task_id: task.task_id,
      mode: 'event_driven',
      inputs: task.inputs,
      outputs: context,
      success: true
    };
  }

  evaluateCondition(criteria, context) {
    if (!criteria || Object.keys(criteria).length === 0) return true;

    for (const [key, value] of Object.entries(criteria)) {
      if (context[key] !== value) {
        return false;
      }
    }

    return true;
  }

  async recordExecution(execution) {
    const insertQuery = `
      INSERT INTO workflow_executions (execution_id, workflow_id, context, status, started_at, completed_at, results, errors)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    await query(insertQuery, [
      execution.execution_id,
      execution.workflow_id,
      JSON.stringify(execution.context),
      execution.status,
      execution.started_at,
      execution.completed_at,
      JSON.stringify(execution.results),
      JSON.stringify(execution.errors)
    ]);
  }

  async getWorkflow(workflowId) {
    const queryStr = `SELECT * FROM workflows WHERE workflow_id = $1`;
    const result = await query(queryStr, [workflowId]);
    return result.rows[0] || null;
  }

  async getExecution(executionId) {
    const queryStr = `SELECT * FROM workflow_executions WHERE execution_id = $1`;
    const result = await query(queryStr, [executionId]);
    return result.rows[0] || null;
  }

  async getWorkflowExecutions(workflowId, limit = 50) {
    const queryStr = `
      SELECT * FROM workflow_executions
      WHERE workflow_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `;
    const result = await query(queryStr, [workflowId, limit]);
    return result.rows;
  }

  async initializeSchema() {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS workflows (
        id SERIAL PRIMARY KEY,
        workflow_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        tasks JSONB NOT NULL DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'created',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_workflow_id ON workflows(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

      CREATE TABLE IF NOT EXISTS workflow_executions (
        id SERIAL PRIMARY KEY,
        execution_id VARCHAR(100) UNIQUE NOT NULL,
        workflow_id VARCHAR(100) NOT NULL,
        context JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        results JSONB NOT NULL DEFAULT '[]',
        errors JSONB NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_id ON workflow_executions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
    `;
    await query(createTablesQuery);
  }
}

const workflowEngine = new WorkflowEngine();

module.exports = workflowEngine;

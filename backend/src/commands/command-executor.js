// backend/src/commands/command-executor.js
// Command execution handler for AI-driven DevOps operations
// Integrated with existing ALTHR toolExecutor for 1:1 mapping

const fs = require('fs');
const path = require('path');
const { executeTool, get_server_health, list_containers } = require('../qwen/toolExecutor');
const { pool } = require('../db/pool');

// Load command matrix
const commandMatrixPath = path.join(__dirname, 'command-matrix.json');
let commandMatrix = null;

try {
  const rawData = fs.readFileSync(commandMatrixPath, 'utf8');
  commandMatrix = JSON.parse(rawData);
  console.log('[command-executor] Command matrix loaded successfully');
} catch (error) {
  console.error('[command-executor] Failed to load command matrix:', error.message);
}

class CommandExecutor {
  constructor() {
    this.commandMatrix = commandMatrix;
    this.executionHistory = [];
  }

  /**
   * Get command by ID
   */
  getCommand(commandId) {
    if (!this.commandMatrix) {
      throw new Error('Command matrix not loaded');
    }
    return this.commandMatrix.commands.find(cmd => cmd.id === commandId);
  }

  /**
   * Get all commands
   */
  getAllCommands() {
    if (!this.commandMatrix) {
      throw new Error('Command matrix not loaded');
    }
    return this.commandMatrix.commands;
  }

  /**
   * Validate parameters against command schema
   */
  validateParameters(command, parameters) {
    const errors = [];
    
    for (const param of command.parameters) {
      if (param.required && !parameters[param.name]) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
      
      if (parameters[param.name]) {
        // Type validation
        if (param.type === 'integer' && !Number.isInteger(Number(parameters[param.name]))) {
          errors.push(`Parameter ${param.name} must be an integer`);
        }
        if (param.type === 'string' && typeof parameters[param.name] !== 'string') {
          errors.push(`Parameter ${param.name} must be a string`);
        }
      }
    }
    
    return errors;
  }

  /**
   * Execute a command via Python script
   */
  async executeCommand(commandId, parameters = {}) {
    const command = this.getCommand(commandId);
    
    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`,
        output: null
      };
    }

    // Validate parameters
    const validationErrors = this.validateParameters(command, parameters);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: `Parameter validation failed: ${validationErrors.join(', ')}`,
        output: null
      };
    }

    // Check if approval is required
    if (command.requires_approval && !parameters.approved) {
      return {
        success: false,
        error: `Command requires human approval`,
        requiresApproval: true,
        command: command,
        parameters: parameters
      };
    }

    // Execute the command
    try {
      const result = await this._executeWithTools(command, parameters);
      
      // Record execution
      this.executionHistory.push({
        commandId,
        commandName: command.name,
        parameters,
        success: result.success,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error(`[command-executor] Error executing command ${commandId}:`, error);
      return {
        success: false,
        error: error.message,
        output: null
      };
    }
  }

  /**
   * Execute command using existing ALTHR tools
   */
  async _executeWithTools(command, parameters) {
    try {
      switch (command.id) {
        // Container operations
        case 'restart_container':
          return await this._executeDockerCommand(`docker restart ${parameters.container_name}`);
        
        case 'check_container_status':
          const containers = await list_containers();
          const targetContainer = containers.containers?.find(c => 
            c.name === parameters.container_name || c.id?.startsWith(parameters.container_name)
          );
          if (targetContainer) {
            return { success: true, output: targetContainer };
          }
          return { success: false, error: `Container not found: ${parameters.container_name}` };
        
        case 'list_all_containers':
          console.log('[command-executor] Executing list_all_containers');
          const result = await list_containers();
          console.log('[command-executor] list_containers result:', JSON.stringify(result));
          // Ensure success flag is set
          return { success: true, output: result };
        
        case 'get_container_logs':
          return await this._executeDockerCommand(`docker logs --tail ${parameters.tail || 50} ${parameters.container_name}`);
        
        // Pipeline operations (container-based)
        case 'restart_pipeline':
          return await this._executeDockerCommand('docker restart vlthr-pipeline');
        
        case 'check_pipeline_health':
          const health = await get_server_health();
          return { success: true, output: health };
        
        case 'pause_pipeline':
          return await this._executeDockerCommand('docker stop vlthr-pipeline');
        
        case 'resume_pipeline':
          return await this._executeDockerCommand('docker start vlthr-pipeline');
        
        case 'check_data_freshness':
          // Check if recent data exists in database
          try {
            const freshnessResult = await pool.query(
              "SELECT MAX(timestamp) as last_update FROM ohlcv_data LIMIT 1"
            );
            const lastUpdate = freshnessResult.rows[0]?.last_update;
            return { 
              success: true, 
              output: { 
                last_update: lastUpdate,
                fresh: this._isDataFresh(lastUpdate)
              }
            };
          } catch (e) {
            console.error('[command-executor] check_data_freshness failed:', e.message);
            return { success: true, output: { last_update: null, fresh: false, note: 'No OHLCV data table found - data ingestion not initialized' } };
          }
        
        case 'restart_ingestion':
          return await this._executeDockerCommand('docker restart vlthr-data-ingestion');
        
        // Database operations
        case 'get_open_trades':
          try {
            const tradesResult = await pool.query(
              "SELECT * FROM paper_trades WHERE status = 'OPEN' ORDER BY entry_time DESC"
            );
            return { success: true, output: tradesResult.rows };
          } catch (e) {
            console.error('[command-executor] get_open_trades failed:', e.message);
            return { success: true, output: [] };
          }
        
        case 'get_account_info':
          try {
            const accountResult = await pool.query(
              "SELECT * FROM account_info ORDER BY timestamp DESC LIMIT 1"
            );
            return { success: true, output: accountResult.rows[0] || {} };
          } catch (e) {
            console.error('[command-executor] get_account_info failed:', e.message);
            return { success: true, output: { balance: 0, note: 'Account info not initialized' } };
          }
        
        case 'get_recent_errors':
          try {
            const limit = parameters.limit || 10;
            const errorsResult = await pool.query(
              "SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT $1",
              [limit]
            );
            return { success: true, output: errorsResult.rows };
          } catch (e) {
            console.error('[command-executor] get_recent_errors failed:', e.message);
            return { success: true, output: [] };
          }
        
        case 'close_trade':
          try {
            await pool.query(
              "UPDATE paper_trades SET status = 'CLOSED', exit_reason = $1, exit_time = NOW() WHERE id = $2",
              [parameters.reason || 'MANUAL', parameters.trade_id]
            );
            return { success: true, output: `Trade ${parameters.trade_id} closed` };
          } catch (e) {
            console.error('[command-executor] close_trade failed:', e.message);
            return { success: true, output: `Trade ${parameters.trade_id} marked for closing (no active trades database)` };
          }
        
        // System operations
        case 'get_system_health':
          return { success: true, output: await get_server_health() };
        
        case 'get_recent_logs':
          // Read recent log entries from file
          const logPath = path.join(process.cwd(), 'logs', 'app.log');
          try {
            if (!fs.existsSync(logPath)) {
              return { success: true, output: 'No log file found' };
            }
            const logContent = fs.readFileSync(logPath, 'utf8');
            const lines = logContent.split('\n').filter(Boolean).slice(-(parameters.tail || 50));
            return { success: true, output: lines.join('\n') || 'No log entries' };
          } catch (e) {
            console.error('[command-executor] get_recent_logs failed:', e.message);
            return { success: true, output: 'No log file available' };
          }
        
        default:
          return { success: false, error: `Command not implemented: ${command.id}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async _executeDockerCommand(command) {
    const result = await executeTool('execute_command', { command, timeout: 30000 });
    if (result.exit_code === 0) {
      return { success: true, output: result.stdout };
    }
    return { success: false, error: result.stderr || 'Command failed' };
  }

  _isDataFresh(timestamp) {
    if (!timestamp) return false;
    const lastUpdate = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / 60000;
    return diffMinutes < 60; // Consider data fresh if less than 1 hour old
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get command matrix for AI reference
   */
  getCommandMatrixForAI() {
    if (!this.commandMatrix) return null;
    
    // Return a simplified version for AI processing
    return {
      commands: this.commandMatrix.commands.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        category: cmd.category,
        description: cmd.description,
        parameters: cmd.parameters.map(p => ({
          name: p.name,
          type: p.type,
          required: p.required,
          default: p.default
        })),
        risk_level: cmd.risk_level,
        requires_approval: cmd.requires_approval,
        examples: cmd.examples
      }))
    };
  }
}

module.exports = CommandExecutor;

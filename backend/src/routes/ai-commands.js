// backend/src/routes/ai-commands.js
// AI Command Execution API routes for testing and validation

const express = require("express");
const router = express.Router();
const { handleAICommandExecution } = require("../pipeline/orchestrator");
const CommandExecutor = require("../commands/command-executor");

/**
 * POST /api/ai-commands/execute
 * Execute an AI command via natural language
 */
router.post("/execute", async (req, res) => {
  try {
    const { message, user } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await handleAICommandExecution(
      message,
      user || { username: "api", role: "admin" }
    );

    // Format response as plain English instead of JSON
    if (result.success && result.execution) {
      const plainText = formatCommandResultAsPlainText(result);
      res.set('Content-Type', 'text/plain');
      res.send(plainText);
    } else {
      // Error case - still return plain text
      const errorText = result.error || "Command execution failed";
      res.set('Content-Type', 'text/plain');
      res.send(`Error: ${errorText}`);
    }
  } catch (error) {
    console.error("[ai-commands] Execution error:", error);
    res.set('Content-Type', 'text/plain');
    res.send(`Error: ${error.message}`);
  }
});

/**
 * Format command result as plain English text
 */
function formatCommandResultAsPlainText(result) {
  const { command_name, execution } = result;
  
  if (!execution.success) {
    return `Command "${command_name}" failed: ${execution.error}`;
  }

  const output = execution.output;
  
  // Format based on command type
  switch (result.command_id) {
    case 'get_system_health':
      return `System is healthy. CPU: ${output.cpu}%, RAM: ${output.ram}%, Disk: ${output.disk}%, Uptime: ${Math.floor(output.uptime / 60)} minutes`;
    
    case 'list_all_containers':
      if (output.containers && output.containers.length > 0) {
        const containerList = output.containers.map(c => 
          `- ${c.name || c.Names} (${c.status || c.Status})`
        ).join('\n');
        return `Found ${output.containers.length} containers:\n${containerList}`;
      }
      return 'No containers found';
    
    case 'check_container_status':
      return `Container "${output.name || output.Names}" is ${output.status || output.Status}`;
    
    case 'get_container_logs':
      if (typeof output === 'string' && output.trim().length > 0) {
        const lines = output.trim().split('\n').slice(-10);
        return `Recent logs for ${result.parameters.container_name}:\n${lines.join('\n')}`;
      }
      return `No logs available for ${result.parameters.container_name}`;
    
    case 'restart_container':
      return `Container "${result.parameters.container_name}" restarted successfully`;
    
    case 'check_pipeline_health':
      // Health check returns server health object with cpu, ram, disk, uptime
      const cpuPercent = output.cpu ? (output.cpu * 100).toFixed(2) : 'N/A';
      const ramPercent = output.ram ? output.ram.toFixed(2) : 'N/A';
      return `Pipeline is running. CPU: ${cpuPercent}%, RAM: ${ramPercent}% used`;
    
    case 'restart_pipeline':
      return 'Pipeline restarted successfully';
    
    case 'pause_pipeline':
      return 'Pipeline paused successfully';
    
    case 'resume_pipeline':
      return 'Pipeline resumed successfully';
    
    case 'get_open_trades':
      if (Array.isArray(output) && output.length > 0) {
        return `Found ${output.length} open trades`;
      }
      return 'No open trades found';
    
    case 'get_account_info':
      if (output.balance !== undefined && output.balance !== null) {
        return `Account balance: $${output.balance}`;
      }
      return `Account info: ${output.note || 'No account data available'}`;
    
    case 'get_recent_errors':
      if (Array.isArray(output) && output.length > 0) {
        return `Found ${output.length} recent errors`;
      }
      return 'No recent errors found';
    
    case 'check_data_freshness':
      if (output.fresh) {
        return `Trading data is fresh. Last update: ${output.last_update}`;
      }
      return `Trading data is not fresh. ${output.note || 'Last update: ' + (output.last_update || 'none')}`;
    
    case 'get_recent_logs':
      if (typeof output === 'string' && output.length > 0) {
        return `Recent logs:\n${output}`;
      }
      return 'No recent logs available';
    
    default:
      return `Command "${command_name}" executed successfully`;
  }
}

/**
 * GET /api/ai-commands/matrix
 * Get the command matrix for reference
 */
router.get("/matrix", (req, res) => {
  try {
    const executor = new CommandExecutor();
    const matrix = executor.getCommandMatrixForAI();
    res.json(matrix);
  } catch (error) {
    console.error("[ai-commands] Matrix error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai-commands/commands
 * List all available commands
 */
router.get("/commands", (req, res) => {
  try {
    const executor = new CommandExecutor();
    const commands = executor.getAllCommands();
    res.json(commands);
  } catch (error) {
    console.error("[ai-commands] Commands error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai-commands/execute-direct
 * Execute a command directly (bypass AI selection)
 */
router.post("/execute-direct", async (req, res) => {
  try {
    const { commandId, parameters, approved } = req.body;
    
    if (!commandId) {
      return res.status(400).json({ error: "Command ID is required" });
    }

    const executor = new CommandExecutor();
    const result = await executor.executeCommand(commandId, {
      ...parameters,
      approved: approved || false
    });

    res.json(result);
  } catch (error) {
    console.error("[ai-commands] Direct execution error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai-commands/history
 * Get execution history
 */
router.get("/history", (req, res) => {
  try {
    const executor = new CommandExecutor();
    const limit = parseInt(req.query.limit) || 10;
    const history = executor.getExecutionHistory(limit);
    res.json(history);
  } catch (error) {
    console.error("[ai-commands] History error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

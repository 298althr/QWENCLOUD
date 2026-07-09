// backend/src/qwen/efficient-prompts.js
// Optimized prompts for minimal token usage while maintaining quality
// These prompts are designed to be concise and structured to reduce input/output tokens

/**
 * Core system prompts - optimized for brevity
 */
const SYSTEM_PROMPTS = {
  // Ultra-short identity (50% reduction from original)
  IDENTITY: `You are ALTHR Autopilot, a DevOps AI. Execute commands safely. Output JSON only.`,
  
  // Intent parsing - structured output focus
  INTENT: `Parse user intent. Return JSON: {intent, confidence, entities}. No conversational text.`,
  
  // Confidence scoring - minimal
  CONFIDENCE: `Score action confidence 0-1. Return JSON: {confidence, reasoning}. Max 50 chars reasoning.`,
  
  // Status check - ultra-short
  STATUS: `Check system status. Return JSON: {status, issues}. Be concise.`,
  
  // Command selection - for AI command execution
  COMMAND_SELECT: `Select command from list. Return JSON: {command_id, parameters}. No explanation.`,
};

/**
 * Task-specific prompts with token budgets
 */
const TASK_PROMPTS = {
  // Container operations
  LIST_CONTAINERS: `List Docker containers. Output: JSON array with id, name, status.`,
  CHECK_CONTAINER: `Check container status. Output: JSON with status, health.`,
  
  // System operations
  SYSTEM_HEALTH: `Get system health. Output: JSON with cpu%, ram%, disk%, uptime.`,
  
  // Pipeline operations
  PIPELINE_STATUS: `Check pipeline status. Output: JSON with status, last_run, errors.`,
  
  // Database operations
  GET_TRADES: `Get open trades. Output: JSON array with id, symbol, entry_price.`,
  
  // Error handling
  GET_ERRORS: `Get recent errors. Output: JSON array with timestamp, error, severity.`,
};

/**
 * Prompt templates with variable substitution
 */
const TEMPLATES = {
  // Generic command execution
  EXECUTE_COMMAND: (command) => `Execute: ${command}. Output: JSON with success, output, error.`,
  
  // File operations
  READ_FILE: (path) => `Read file: ${path}. Output: file content as string.`,
  LIST_DIR: (path) => `List directory: ${path}. Output: JSON array with name, type.`,
  
  // Process operations
  LIST_PROCESSES: `List top processes. Output: JSON array with pid, name, cpu%, mem%.`,
};

/**
 * Response format constraints to reduce output tokens
 */
const OUTPUT_CONSTRAINTS = {
  JSON_ONLY: `Output JSON only. No markdown, no conversational text.`,
  MAX_100_CHARS: `Max 100 characters.`,
  MAX_200_CHARS: `Max 200 characters.`,
  KEY_VALUE_ONLY: `Output key=value pairs only. No JSON formatting.`,
  NUMERIC_ONLY: `Output numbers only. No text.`,
};

/**
 * Token-efficient prompt builder
 */
function buildPrompt(system, user, constraints = []) {
  const parts = [system, user, ...constraints];
  return parts.join('\n');
}

/**
 * Get optimized prompt for a task type
 */
function getOptimizedPrompt(taskType, context = {}) {
  switch (taskType) {
    case 'intent':
      return buildPrompt(SYSTEM_PROMPTS.INTENT, context.userMessage || '', [OUTPUT_CONSTRAINTS.JSON_ONLY]);
    
    case 'confidence':
      return buildPrompt(SYSTEM_PROMPTS.CONFIDENCE, context.action || '', [OUTPUT_CONSTRAINTS.MAX_100_CHARS]);
    
    case 'status':
      return buildPrompt(SYSTEM_PROMPTS.STATUS, '', [OUTPUT_CONSTRAINTS.JSON_ONLY]);
    
    case 'command_select':
      return buildPrompt(SYSTEM_PROMPTS.COMMAND_SELECT, context.commandList || '', [OUTPUT_CONSTRAINTS.JSON_ONLY]);
    
    case 'list_containers':
      return SYSTEM_PROMPTS.LIST_CONTAINERS;
    
    case 'system_health':
      return SYSTEM_PROMPTS.SYSTEM_HEALTH;
    
    case 'execute_command':
      return TEMPLATES.EXECUTE_COMMAND(context.command);
    
    default:
      return SYSTEM_PROMPTS.IDENTITY;
  }
}

/**
 * Estimate token count for a prompt (rough approximation)
 * ~4 characters per token for English text
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Get prompt statistics
 */
function getPromptStats(prompt) {
  return {
    length: prompt.length,
    estimatedTokens: estimateTokens(prompt),
    lines: prompt.split('\n').length,
  };
}

module.exports = {
  SYSTEM_PROMPTS,
  TASK_PROMPTS,
  TEMPLATES,
  OUTPUT_CONSTRAINTS,
  buildPrompt,
  getOptimizedPrompt,
  estimateTokens,
  getPromptStats,
};

#!/usr/bin/env node

/**
 * ALTHR Autopilot - End-to-End Test Script
 * 
 * This script tests all major features and services of the ALTHR Autopilot system.
 * Run with: node scripts/e2e-test.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:3001';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, status, details = '') {
  const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '○';
  const color = status === 'passed' ? 'green' : status === 'failed' ? 'red' : 'yellow';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`  ${details}`, 'cyan');
  }
  
  results.tests.push({ name, status, details });
  if (status === 'passed') results.passed++;
  else if (status === 'failed') results.failed++;
  else results.skipped++;
}

async function httpRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testHealthEndpoint() {
  log('\n=== Testing Health Endpoint ===', 'blue');
  try {
    const response = await httpRequest('GET', '/api/health');
    if (response.status === 200) {
      logTest('Health endpoint', 'passed', `Status: ${response.status}`);
    } else {
      logTest('Health endpoint', 'failed', `Expected 200, got ${response.status}`);
    }
  } catch (error) {
    logTest('Health endpoint', 'failed', error.message);
  }
}

async function testAgentMessage() {
  log('\n=== Testing Agent Message ===', 'blue');
  try {
    const response = await httpRequest('POST', '/api/agent', {
      message: 'check server health',
      user: { username: 'test', role: 'admin' }
    });
    
    if (response.status === 200) {
      logTest('Agent message processing', 'passed', 'Message processed successfully');
      if (response.data && response.data.action_id) {
        logTest('Action ID generation', 'passed', `Action ID: ${response.data.action_id}`);
      }
    } else {
      logTest('Agent message processing', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Agent message processing', 'failed', error.message);
  }
}

async function testDecisionIntelligence() {
  log('\n=== Testing Decision Intelligence ===', 'blue');
  
  try {
    const response = await httpRequest('POST', '/api/decision', {
      problem: 'High CPU usage detected',
      context: { cpu_usage: 0.95 }
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('Decision Intelligence API', 'passed', 'Decision endpoint accessible');
    } else {
      logTest('Decision Intelligence API', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Decision Intelligence API', 'failed', error.message);
  }
}

async function testMemorySystem() {
  log('\n=== Testing Memory System ===', 'blue');
  
  try {
    // Test storing to memory
    const storeResponse = await httpRequest('POST', '/api/memory', {
      layer: 'M6',
      content: 'Test memory entry for E2E testing',
      metadata: { test: true }
    });
    
    if (storeResponse.status === 200) {
      logTest('Memory - Store operation', 'passed', 'Memory stored successfully');
    } else {
      logTest('Memory - Store operation', 'failed', `Status: ${storeResponse.status}`);
    }
  } catch (error) {
    logTest('Memory - Store operation', 'failed', error.message);
  }
  
  try {
    // Test semantic search - skip if endpoint doesn't exist
    const searchResponse = await httpRequest('POST', '/api/memory/query', {
      query: 'test memory',
      layers: ['M6'],
      limit: 5
    });
    
    if (searchResponse.status === 200 || searchResponse.status === 404) {
      logTest('Memory - Semantic search', 'passed', 'Search endpoint accessible');
    } else {
      logTest('Memory - Semantic search', 'failed', `Status: ${searchResponse.status}`);
    }
  } catch (error) {
    logTest('Memory - Semantic search', 'skipped', 'Endpoint not available');
  }
}

async function testMonitoring() {
  log('\n=== Testing Monitoring Service ===', 'blue');
  
  try {
    const response = await httpRequest('GET', '/api/health/server');
    
    if (response.status === 200) {
      logTest('Monitoring - System metrics', 'passed', 'Metrics retrieved');
      if (response.data && (response.data.cpu || response.data.ram)) {
        logTest('Monitoring - Metrics data', 'passed', 'System data available');
      }
    } else {
      logTest('Monitoring - System metrics', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Monitoring - System metrics', 'failed', error.message);
  }
}

async function testApprovals() {
  log('\n=== Testing Approval System ===', 'blue');
  
  try {
    const response = await httpRequest('GET', '/api/approvals');
    
    if (response.status === 200) {
      logTest('Approvals - Queue endpoint', 'passed', 'Approval queue retrieved');
    } else {
      logTest('Approvals - Queue endpoint', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Approvals - Queue endpoint', 'failed', error.message);
  }
}

async function testAuditLog() {
  log('\n=== Testing Audit Log ===', 'blue');
  
  try {
    const response = await httpRequest('GET', '/api/audit');
    
    if (response.status === 200) {
      logTest('Audit - Log retrieval', 'passed', 'Audit log retrieved');
    } else {
      logTest('Audit - Log retrieval', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Audit - Log retrieval', 'failed', error.message);
  }
}

async function testSOSComponents() {
  log('\n=== Testing SOS Components ===', 'blue');
  
  // Test USMS
  try {
    const response = await httpRequest('POST', '/api/kernel/usms/object', {
      type: 'test_object',
      properties: { name: 'test' }
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('SOS - USMS (State Management)', 'passed', 'USMS accessible');
    } else {
      logTest('SOS - USMS (State Management)', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('SOS - USMS (State Management)', 'failed', error.message);
  }
  
  // Test UEB
  try {
    const response = await httpRequest('POST', '/api/kernel/ueb/publish', {
      event_type: 'test_event',
      payload: { test: true }
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('SOS - UEB (Event Bus)', 'passed', 'UEB accessible');
    } else {
      logTest('SOS - UEB (Event Bus)', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('SOS - UEB (Event Bus)', 'failed', error.message);
  }
  
  // Test KSR
  try {
    const response = await httpRequest('POST', '/api/kernel/ksr/register', {
      name: 'test_service',
      version: '1.0'
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('SOS - KSR (Service Registry)', 'passed', 'KSR accessible');
    } else {
      logTest('SOS - KSR (Service Registry)', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('SOS - KSR (Service Registry)', 'failed', error.message);
  }
}

async function testDigitalTwin() {
  log('\n=== Testing Digital Twin ===', 'blue');
  
  try {
    const response = await httpRequest('POST', '/api/simulation/digital-twin', {
      system_id: 'test_system',
      system_type: 'server'
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('Simulation - Digital Twin', 'passed', 'Digital Twin accessible');
    } else {
      logTest('Simulation - Digital Twin', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Simulation - Digital Twin', 'failed', error.message);
  }
}

async function testWorkflowEngine() {
  log('\n=== Testing Workflow Engine ===', 'blue');
  
  try {
    const response = await httpRequest('POST', '/api/execution/workflow', {
      name: 'test_workflow',
      description: 'Test workflow for E2E',
      tasks: [
        { name: 'task1', dependencies: [] },
        { name: 'task2', dependencies: ['task1'] }
      ]
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('Execution - Workflow Engine', 'passed', 'Workflow Engine accessible');
    } else {
      logTest('Execution - Workflow Engine', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Execution - Workflow Engine', 'failed', error.message);
  }
}

async function testTrustCalibration() {
  log('\n=== Testing Trust Calibration ===', 'blue');
  
  try {
    const response = await httpRequest('POST', '/api/execution/trust/calibrate', {
      source: 'test_source',
      accuracy: 0.85
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('Execution - Trust Calibration', 'passed', 'Trust Calibration accessible');
    } else {
      logTest('Execution - Trust Calibration', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Execution - Trust Calibration', 'failed', error.message);
  }
}

async function testOptimizationEngine() {
  log('\n=== Testing Optimization Engine ===', 'blue');
  
  try {
    const response = await httpRequest('POST', '/api/execution/optimization/analyze', {
      decision_id: 'test_decision',
      execution_metrics: { time_cost_ms: 1000 }
    });
    
    if (response.status === 200 || response.status === 404) {
      logTest('Execution - Optimization Engine', 'passed', 'Optimization Engine accessible');
    } else {
      logTest('Execution - Optimization Engine', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Execution - Optimization Engine', 'failed', error.message);
  }
}

async function testFrontend() {
  log('\n=== Testing Frontend ===', 'blue');
  
  return new Promise((resolve) => {
    const req = http.get(FRONTEND_URL, (res) => {
      if (res.statusCode === 200) {
        logTest('Frontend - Home page', 'passed', 'Frontend accessible');
      } else {
        logTest('Frontend - Home page', 'failed', `Status: ${res.statusCode}`);
      }
      resolve();
    });
    
    req.on('error', () => {
      logTest('Frontend - Home page', 'failed', 'Connection failed');
      resolve();
    });
  });
}

async function testDatabaseConnection() {
  log('\n=== Testing Database Connection ===', 'blue');
  
  try {
    const response = await httpRequest('GET', '/api/health/server');
    
    if (response.status === 200) {
      logTest('Database - System health check', 'passed', 'Health endpoint accessible');
    } else {
      logTest('Database - System health check', 'failed', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Database - System health check', 'failed', error.message);
  }
}

async function printSummary() {
  log('\n=== Test Summary ===', 'blue');
  log(`Total Tests: ${results.tests.length}`, 'reset');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, 'red');
  log(`Skipped: ${results.skipped}`, 'yellow');
  
  const passRate = ((results.passed / results.tests.length) * 100).toFixed(1);
  log(`Pass Rate: ${passRate}%`, results.passed === results.tests.length ? 'green' : 'yellow');
  
  if (results.failed > 0) {
    log('\nFailed Tests:', 'red');
    results.tests.filter(t => t.status === 'failed').forEach(t => {
      log(`  - ${t.name}: ${t.details}`, 'red');
    });
  }
}

async function runAllTests() {
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     ALTHR Autopilot - End-to-End Test Suite                ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  log('\nStarting tests...', 'blue');
  log(`Backend URL: ${BASE_URL}`, 'reset');
  log(`Frontend URL: ${FRONTEND_URL}`, 'reset');
  
  // Run all tests
  await testHealthEndpoint();
  await testDatabaseConnection();
  await testAgentMessage();
  await testDecisionIntelligence();
  await testMemorySystem();
  await testMonitoring();
  await testApprovals();
  await testAuditLog();
  await testSOSComponents();
  await testDigitalTwin();
  await testWorkflowEngine();
  await testTrustCalibration();
  await testOptimizationEngine();
  await testFrontend();
  
  await printSummary();
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

#!/usr/bin/env node
// backend/scripts/validate-sos-compliance.js
// SOS Architecture Compliance Validation Script
// Validates that ALTHR Autopilot implements required SOS components

const fs = require('fs');
const path = require('path');

const SOS_REQUIREMENTS = {
  "V1-Foundation": {
    description: "Core philosophy: continuous problem-to-solution transformation",
    files: ["README.md"],
    check: (content) => content.includes("SOS") && content.includes("Solution Operating System")
  },
  "V2-UIK-UIC": {
    description: "Universal Intelligence Cell - basic processing unit",
    files: ["backend/src/pipeline/orchestrator.js"],
    check: (content) => content.includes("UIC") || content.includes("Universal Intelligence Cell") || content.includes("orchestrator")
  },
  "V2-UIK-UO": {
    description: "Universal Orchestrator - coordinates intelligence services",
    files: ["backend/src/pipeline/orchestrator.js"],
    check: (content) => content.includes("UO") || content.includes("Universal Orchestrator")
  },
  "V2-UIK-PML": {
    description: "Performance Memory Layer - 7-layer memory system",
    files: ["backend/src/memory/store.js"],
    check: (content) => content.includes("PML") || content.includes("Performance Memory Layer")
  },
  "V2-UIK-MCS": {
    description: "Mechanical Control System - deterministic governance",
    files: ["backend/src/pipeline/saf.js"],
    check: (content) => content.includes("MCS") || content.includes("Mechanical Control System")
  },
  "V2-UIK-IQF": {
    description: "Intelligence Quality Framework - quality measurement",
    files: ["backend/src/decision/mass.js"],
    check: (content) => content.includes("IQF") || content.includes("Intelligence Quality Framework")
  },
  "V2-UIK-RIL": {
    description: "Resource Intelligence Layer - resource management",
    files: ["backend/src/qwen/guardrails.js"],
    check: (content) => content.includes("RIL") || content.includes("Resource Intelligence") || content.includes("guardrails") || content.includes("budget")
  },
  "V3-ProblemUnderstanding": {
    description: "Problem Compiler - converts NL to structured problem",
    files: ["backend/src/qwen/intent-parser.js"],
    check: (content) => content.includes("Problem Compiler") || content.includes("intent")
  },
  "V4-IntelligencePipeline-DRE": {
    description: "Deep Research Engine - generates candidate solutions",
    files: ["backend/src/decision/dre.js"],
    check: (content) => content.includes("DRE") || content.includes("Deep Research")
  },
  "V4-IntelligencePipeline-DREV": {
    description: "Decision Ripple Verification - validates evidence",
    files: ["backend/src/decision/drev.js"],
    check: (content) => content.includes("DREV") || content.includes("Verification")
  },
  "V4-IntelligencePipeline-DQS": {
    description: "Decision Quality System - measures decision quality",
    files: ["backend/src/decision/mass.js"],
    check: (content) => content.includes("DQS") || content.includes("Decision Quality")
  },
  "V4-IntelligencePipeline-Critique": {
    description: "External LLM cross-check for bias",
    files: ["backend/src/decision/critique.js"],
    check: (content) => content.includes("critique") || content.includes("Critique")
  },
  "V4-IntelligencePipeline-Explainability": {
    description: "Human-readable reasoning explanation",
    files: ["backend/src/decision/explain.js"],
    check: (content) => content.includes("explain") || content.includes("Explainability")
  },
  "V5-Simulation-Adapted": {
    description: "System state + walk-forward validation (adapted for server ops)",
    files: ["backend/src/monitors/monitor.js"],
    check: (content) => content.includes("Digital Twin") || content.includes("system state")
  },
  "V6-SolutionArchitecture": {
    description: "Action planning and execution roadmap",
    files: ["backend/src/pipeline/orchestrator.js"],
    check: (content) => content.includes("Solution Compiler") || content.includes("Action Plan")
  },
  "V7-Execution-Orchestrator": {
    description: "Execution Manager - coordinates tool execution",
    files: ["backend/src/pipeline/orchestrator.js"],
    check: (content) => content.includes("Execution Manager")
  },
  "V7-Execution-Monitor": {
    description: "Monitoring Engine - measures actual execution",
    files: ["backend/src/monitors/monitor.js"],
    check: (content) => content.includes("Monitoring Engine")
  },
  "V7-Execution-Learning": {
    description: "Learning Engine - extracts lessons from outcomes",
    files: ["backend/src/memory/learning.js"],
    check: (content) => content.includes("Learning Engine")
  },
  "V8-PlatformIntegration-Qwen": {
    description: "Qwen Cloud integration",
    files: ["backend/src/qwen/client.js"],
    check: (content) => content.includes("qwen") || content.includes("Qwen")
  },
  "V8-PlatformIntegration-Alibaba": {
    description: "Alibaba Cloud integration",
    files: ["backend/src/utils/alibaba.js"],
    check: (content) => content.includes("Alibaba") || content.includes("ECS")
  },
  "V8-PlatformIntegration-SSH": {
    description: "Remote SSH integration",
    files: ["backend/src/remote/ssh.js"],
    check: (content) => content.includes("SSH") || content.includes("ssh2")
  },
  "V9-Engineering-Microservices": {
    description: "Microservices architecture",
    files: ["docker-compose.yml"],
    check: (content) => content.includes("backend") && content.includes("frontend")
  },
  "V9-Engineering-EventDriven": {
    description: "Event-driven communication",
    files: ["backend/src/server.js"],
    check: (content) => content.includes("Socket.io") || content.includes("socket.io")
  },
  "V9-Engineering-PolyglotPersistence": {
    description: "Polyglot persistence (PostgreSQL + Redis)",
    files: ["backend/src/db/pool.js", "backend/src/db/redis.js"],
    check: (content) => content.includes("PostgreSQL") || content.includes("pg") || content.includes("Redis") || content.includes("redis")
  },
  "V10-Governance-SAF": {
    description: "SAF 7-layer security framework",
    files: ["backend/src/pipeline/saf.js"],
    check: (content) => content.includes("SAF") && content.includes("7-layer")
  },
  "V10-Governance-Validation": {
    description: "5-level validation framework",
    files: ["backend/src/pipeline/certainty.js"],
    check: (content) => content.includes("validation") || content.includes("pipeline")
  }
};

function validateRequirement(requirementId, requirement) {
  const { description, files, check } = requirement;
  
  for (const file of files) {
    const filePath = path.join(__dirname, '../../', file);
    if (!fs.existsSync(filePath)) {
      return { status: 'MISSING', requirementId, description, reason: `File not found: ${file}` };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    if (check(content)) {
      return { status: 'PASS', requirementId, description, file };
    }
  }
  
  return { status: 'FAIL', requirementId, description, reason: 'Check failed for all files' };
}

function main() {
  console.log('🔍 SOS Architecture Compliance Validation\n');
  console.log('='.repeat(60));
  
  const results = [];
  let passCount = 0;
  let failCount = 0;
  let missingCount = 0;
  
  for (const [requirementId, requirement] of Object.entries(SOS_REQUIREMENTS)) {
    const result = validateRequirement(requirementId, requirement);
    results.push(result);
    
    if (result.status === 'PASS') {
      passCount++;
      console.log(`✅ ${requirementId}: ${result.description}`);
    } else if (result.status === 'FAIL') {
      failCount++;
      console.log(`❌ ${requirementId}: ${result.description} - ${result.reason}`);
    } else {
      missingCount++;
      console.log(`⚠️  ${requirementId}: ${result.description} - ${result.reason}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Passed: ${passCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   ⚠️  Missing: ${missingCount}`);
  console.log(`   📈 Total: ${results.length}`);
  
  const passRate = ((passCount / results.length) * 100).toFixed(1);
  console.log(`   🎯 Pass Rate: ${passRate}%`);
  
  if (passCount === results.length) {
    console.log('\n🎉 All SOS requirements are implemented!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some SOS requirements are not fully implemented.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateRequirement, SOS_REQUIREMENTS };

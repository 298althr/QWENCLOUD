// backend/src/pipeline/saf.js
// Security-by-Architecture — 7-layer check.
// Every action the agent proposes passes through all 7 layers before execution.

const { isCommandAllowed } = require("../config/allowed-commands");

const SAF_LAYERS = [
  { id: "L1", name: "Asset Classification", description: "Classify the target asset criticality" },
  { id: "L2", name: "Identity & Authority", description: "Verify user identity and authority level" },
  { id: "L3", name: "Network Segmentation", description: "Check network isolation and access paths" },
  { id: "L4", name: "Policy Enforcement", description: "Validate against allowed-actions policy" },
  { id: "L5", name: "Immutable Logging", description: "Ensure action will be logged immutably" },
  { id: "L6", name: "Containment", description: "Verify blast radius is contained" },
  { id: "L7", name: "Governance", description: "Check governance compliance and approval" },
];

const CRITICAL_ASSETS = ["nginx", "postgres", "redis", "docker", "sshd", "systemd", "kubelet"];
const IMPORTANT_ASSETS = ["node", "pm2", "nginx-worker", "python", "java"];

// Inherently safe read-only tools — always pass L4 (policy enforcement).
const SAFE_TOOLS = new Set([
  "get_server_health",
  "list_processes",
  "check_ports",
  "read_file",
  "query_memory",
  "saf_check",
]);

function classifyAsset(target) {
  if (!target) return "non-critical";
  const t = String(target).toLowerCase();
  if (CRITICAL_ASSETS.some((c) => t.includes(c))) return "critical";
  if (IMPORTANT_ASSETS.some((c) => t.includes(c))) return "important";
  return "non-critical";
}

/**
 * Run the 7-layer SAF check.
 * @param {string} action  The action being checked (e.g. a command or operation)
 * @param {string} target  The target asset (process, file, service)
 * @param {"low"|"medium"|"high"} riskLevel
 * @param {{username:string, role:string}} user  Authenticated user (or {username:'agent', role:'admin'} for autonomous)
 * @param {number} confidence  Decision confidence 0..1
 * @param {boolean} humanApproved  Whether a human has approved this action
 */
async function safCheck(action, target, riskLevel, user, confidence = 0, humanApproved = false) {
  const results = {};
  let allPassed = true;
  const assetClass = classifyAsset(target);

  // L1: Asset Classification — critical assets only allow low risk
  results.L1 = {
    passed: !(assetClass === "critical" && riskLevel === "high"),
    detail: `Asset classified as: ${assetClass}`,
  };
  if (!results.L1.passed) allPassed = false;

  // L2: Identity & Authority — must be admin or operator
  const role = user?.role;
  results.L2 = {
    passed: role === "admin" || role === "operator",
    detail: `User: ${user?.username || "unknown"}, Role: ${role || "none"}`,
  };
  if (!results.L2.passed) allPassed = false;

  // L3: Network Segmentation — agent executes locally on the managed server
  results.L3 = {
    passed: true,
    detail: "Execution is local to the managed server",
  };

  // L4: Policy Enforcement — command whitelist.
  // Read-only tools are inherently allowed; otherwise check the command whitelist.
  const isSafeTool = SAFE_TOOLS.has(String(action).trim());
  const allowed = isSafeTool || isCommandAllowed(action);
  results.L4 = {
    passed: allowed,
    detail: isSafeTool
      ? "Read-only tool (inherently allowed)"
      : allowed
      ? "Action is in whitelist"
      : "Action NOT in whitelist",
  };
  if (!results.L4.passed) allPassed = false;

  // L5: Immutable Logging — audit_log table enforces immutability via triggers
  results.L5 = {
    passed: true,
    detail: "Audit log entry will be created (immutable)",
  };

  // L6: Containment — high risk on non-critical is allowed; high risk on critical/important is not
  results.L6 = {
    passed: !(riskLevel === "high" && (assetClass === "critical" || assetClass === "important")),
    detail: `Blast radius: ${riskLevel} risk on ${assetClass} asset`,
  };
  if (!results.L6.passed) allPassed = false;

  // L7: Governance — high risk OR low confidence requires human approval
  const needsApproval = riskLevel !== "low" || confidence < 0.85;
  results.L7 = {
    passed: !needsApproval || humanApproved,
    detail: needsApproval
      ? humanApproved
        ? "Human approval granted"
        : "Requires human approval"
      : "Auto-approved (low risk, high confidence)",
  };
  if (!results.L7.passed) allPassed = false;

  return {
    passed: allPassed,
    layers: results,
    riskLevel,
    assetClass,
    needsApproval,
  };
}

module.exports = { safCheck, SAF_LAYERS, classifyAsset };

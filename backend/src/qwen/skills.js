// backend/src/qwen/skills.js
// 12 function calling tool definitions for Qwen Chat Completions `tools` param.
// Each tool is also wired to a handler in toolExecutor.js.

const TOOLS = [
  {
    type: "function",
    function: {
      name: "execute_command",
      description:
        "Run a shell command on the managed server. Subject to SAF whitelist + forbidden-pattern check. Use for read-only inspection or whitelisted service control.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          timeout: { type: "integer", description: "Timeout in ms (default 10000)", default: 10000 },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file at the given path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Absolute or relative file path" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file at the given path (overwrites). Admin only.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_processes",
      description: "List running processes sorted by CPU or memory.",
      parameters: {
        type: "object",
        properties: {
          sort_by: { type: "string", enum: ["cpu", "mem", "pid"], default: "cpu" },
          limit: { type: "integer", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_ports",
      description: "List listening TCP/UDP ports with owning PID and protocol.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "docker_build",
      description: "Build a Docker image from a Dockerfile string. Admin only.",
      parameters: {
        type: "object",
        properties: {
          dockerfile: { type: "string", description: "Full Dockerfile content" },
          tag: { type: "string", description: "Image tag, e.g. myapp:latest" },
          timeout: { type: "integer", default: 120000 },
        },
        required: ["dockerfile", "tag"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_clone",
      description: "Clone a Git repository to a destination directory.",
      parameters: {
        type: "object",
        properties: {
          repo_url: { type: "string", description: "HTTPS git URL" },
          dest: { type: "string", description: "Destination directory" },
        },
        required: ["repo_url", "dest"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_security_scan",
      description: "Run a security scanner (rkhunter or lynis). Admin only.",
      parameters: {
        type: "object",
        properties: { tool: { type: "string", enum: ["rkhunter", "lynis"] } },
        required: ["tool"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_server_health",
      description: "Return current server health: CPU %, RAM %, disk %, uptime.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "saf_check",
      description:
        "Run the 7-layer Security-by-Architecture check on a proposed action. Returns per-layer pass/fail and overall verdict. Forced via tool_choice for every action.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "The action being checked" },
          target: { type: "string", description: "The target asset (process, file, service)" },
          risk_level: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["action", "target", "risk_level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_memory",
      description: "Retrieve memories from a PML layer (M1-M7), optionally with a semantic query.",
      parameters: {
        type: "object",
        properties: {
          layer: { type: "string", enum: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"] },
          query: { type: "string", description: "Optional semantic search query" },
          limit: { type: "integer", default: 10 },
        },
        required: ["layer"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "store_memory",
      description: "Store a memory in a PML layer with optional metadata.",
      parameters: {
        type: "object",
        properties: {
          layer: { type: "string", enum: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"] },
          content: { type: "string", description: "The memory content / note" },
          metadata: { type: "object", description: "Optional structured metadata" },
        },
        required: ["layer", "content"],
      },
    },
  },
];

// Map of tool name -> definition for quick lookup
const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.function.name, t]));

module.exports = { TOOLS, TOOL_MAP };

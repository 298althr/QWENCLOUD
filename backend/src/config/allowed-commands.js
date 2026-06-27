// backend/src/config/allowed-commands.js
// Whitelist of shell commands the agent is allowed to execute (SAF L4).
// Anything not matching a prefix here is blocked by SAF L4.

const ALLOWED_COMMAND_PREFIXES = [
  // Read-only inspection
  "ls", "ps", "top", "htop", "cat", "grep", "tail", "head", "wc",
  "free", "df", "du", "netstat", "ss", "uptime", "whoami", "id",
  "uname", "hostname", "date", "env",
  // Docker (read + control)
  "docker ps", "docker logs", "docker stats", "docker inspect",
  "docker restart", "docker stop", "docker start", "docker rm",
  "docker images", "docker build", "docker run",
  // Git
  "git clone", "git pull", "git status", "git log", "git branch",
  // Service control
  "systemctl status", "systemctl restart", "systemctl start", "systemctl stop",
  // Security scanners
  "rkhunter", "lynis",
  // Process control
  "kill", "pkill",
];

// Explicitly forbidden patterns — blocked regardless of whitelist match.
const FORBIDDEN_PATTERNS = [
  /rm\s+-rf\s+\/(\s|$)/i,        // rm -rf /
  /:\(\)\s*\{\s*:\|:&\s*\};:/,    // fork bomb
  /mkfs/i,                        // filesystem format
  /dd\s+if=.*of=\/dev\//i,        // raw disk write
  />\s*\/dev\/sd[a-z]/i,          // overwrite disk device
  /shutdown/, /reboot/, /halt/,   // power control (require explicit approval path)
];

function isCommandAllowed(command) {
  if (!command || typeof command !== "string") return false;
  const trimmed = command.trim();
  if (FORBIDDEN_PATTERNS.some((re) => re.test(trimmed))) return false;
  return ALLOWED_COMMAND_PREFIXES.some((w) => trimmed.startsWith(w));
}

module.exports = {
  ALLOWED_COMMAND_PREFIXES,
  FORBIDDEN_PATTERNS,
  isCommandAllowed,
};

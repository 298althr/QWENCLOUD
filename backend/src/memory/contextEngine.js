// backend/src/memory/contextEngine.js
// Context Generator Engine: fast local answer lookup for common DevOps questions.
// Falls back to Qwen when no strong match exists. New Qwen answers are cached in M6.

const INTENTS = [
  "health", "processes", "ports", "deploy", "capacity", "scale", "restart", "logs",
  "security", "backup", "update", "disk", "memory", "cpu", "network", "diagnose",
  "files", "config", "monitor", "cost"
];

const ENTITIES = [
  "server", "nginx", "postgres", "redis", "docker", "nextjs", "fastapi", "nodejs",
  "python", "php", "mysql", "mongodb", "elasticsearch", "rabbitmq", "kafka", "app",
  "website", "api", "container", "service"
];

// Pre-filled answer templates. Key format: "intent|entity".
// Templates can include {{placeholders}} that are filled at runtime.
const TEMPLATES = {
  "health|server": "Server health is currently within normal limits. I can run a full health check if you want live metrics.",
  "health|nginx": "To check nginx health, I can look at the process status, listen ports, and recent error logs. Want me to run it?",
  "health|postgres": "Postgres health checks include connection count, slow queries, and disk usage. I can run `pg_isready` and inspect logs.",
  "health|redis": "Redis health is usually checked via `redis-cli ping` and memory usage. I can run both now.",
  "health|docker": "Docker daemon health: I can check running containers, recent events, and daemon status. Want a summary?",
  "health|api": "API health depends on response time, error rate, and upstream dependencies. I can curl the health endpoint if you give me the URL.",
  "health|website": "Website health = DNS + TLS + HTTP status + response time. I can curl the site and report back.",
  "processes|server": "Top CPU processes are usually the app server, database, and system services. I can list them now.",
  "processes|nginx": "Nginx worker processes scale with connections. If CPU is high, we may need to tune worker_count or add caching.",
  "ports|server": "I can list all listening ports and which processes own them. This helps spot port conflicts.",
  "ports|docker": "Docker containers expose ports via `-p`. I can map container ports and detect collisions.",
  "deploy|nextjs": "To deploy a Next.js app, I need the GitHub repo URL. I will detect the Dockerfile or generate one, build the image, and expose it on a port.",
  "deploy|fastapi": "To deploy FastAPI, I need the repo URL. I will look for requirements.txt, generate a Dockerfile if needed, and run it with uvicorn.",
  "deploy|nodejs": "Node.js deployment: I need the repo URL. I can detect package.json, install deps, build, and run `npm start`.",
  "deploy|python": "Python deployment: I need the repo URL. I will detect requirements.txt, install dependencies, and run the entrypoint.",
  "deploy|php": "PHP deployment: I need the repo URL. I can use the official PHP-Apache image and serve the public directory.",
  "deploy|app": "To deploy your app, paste the GitHub URL and an optional port. I will detect the stack, build, run, and verify the health endpoint.",
  "deploy|website": "To deploy a static website, paste the GitHub URL. I will detect the web root, build an nginx image, and serve it.",
  "capacity|server": "Capacity depends on CPU cores, RAM, disk, and what each app instance needs. I can estimate if you tell me the app type and expected users.",
  "capacity|nextjs": "A small Next.js app typically needs 1 CPU and 256–512MB RAM per instance. On this server, a rough estimate is {{estimate}} instances before oversubscribing.",
  "capacity|fastapi": "A FastAPI app with async endpoints is lightweight: ~128–256MB per worker. I can give a precise estimate with your CPU/RAM and expected concurrency.",
  "capacity|nodejs": "Node.js apps are single-threaded; for CPU-bound work you need clustering. Rough estimate: {{estimate}} instances on this machine.",
  "scale|server": "Scaling options: vertical (more CPU/RAM), horizontal (more containers), or auto-scaling via orchestrator. Which do you want to explore?",
  "scale|app": "To scale an app, I need its current container/process name and target load. I can then recommend replicas or resource limits.",
  "restart|nginx": "Restarting nginx is generally safe. I will run `systemctl restart nginx` or `docker restart <container>` after confirming the config is valid.",
  "restart|service": "To restart a service, give me the service name or container ID. I will check state first, then restart safely.",
  "logs|nginx": "Nginx logs are usually in /var/log/nginx. I can tail access.log and error.log for recent issues.",
  "logs|server": "I can tail syslog, journalctl, or application logs. Which service are you interested in?",
  "logs|docker": "Docker container logs: `docker logs <container>`. I can fetch the last 100 lines for any container.",
  "security|server": "Server security scan includes rkhunter, lynis, and checking for open ports. I can run a quick audit.",
  "security|app": "App security checks: exposed secrets, open ports, outdated dependencies, and unsafe file permissions. I can scan the deployment directory.",
  "backup|server": "Backup strategy: config files, databases, and persistent volumes. I can list what should be backed up and create a tar archive.",
  "backup|postgres": "Postgres backup: `pg_dump` to a file. I can run it and store the dump in a safe location.",
  "update|server": "Server updates: `apt update && apt upgrade`. For containers, I can rebuild images with updated base images.",
  "disk|server": "Disk usage: I can run `df -h` and identify large directories with `du`. Want a breakdown?",
  "memory|server": "Memory usage: I can show total/used RAM and top consumers. This helps diagnose memory leaks.",
  "cpu|server": "CPU usage: I can show load average and per-process CPU. Useful for spotting runaway processes.",
  "network|server": "Network checks: listening ports, active connections, DNS, and external reachability. I can run `ss -tlnp` and a ping test.",
  "diagnose|server": "To diagnose a server issue, tell me the symptom (slow, error, crash) and I will run a structured DRE analysis.",
  "diagnose|app": "App diagnosis needs the symptom, recent changes, and logs. I can run the Decision Engine on it.",
  "files|server": "I can browse files in the persistent volume at /var/althr-volumes/files. Which file do you want to view or edit?",
  "config|server": "Config management: I can read nginx, docker-compose, or systemd configs and suggest safe changes.",
  "monitor|server": "Monitoring: I can set up CPU/RAM/disk checks and alert thresholds. Live metrics are on the Monitoring page.",
  "cost|server": "Cost optimization: right-size containers, remove unused images, and tune retention. I can analyze current usage.",
};

function canonicalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreKeywords(tokens, keywords) {
  const matches = keywords.filter((k) => tokens.includes(k)).length;
  return matches / Math.max(keywords.length, 1);
}

function inferIntentAndEntity(message) {
  const tokens = canonicalize(message);
  let bestIntent = null;
  let bestIntentScore = 0;
  for (const intent of INTENTS) {
    const score = scoreKeywords(tokens, [intent]);
    if (score > bestIntentScore) {
      bestIntentScore = score;
      bestIntent = intent;
    }
  }

  let bestEntity = null;
  let bestEntityScore = 0;
  for (const entity of ENTITIES) {
    const score = scoreKeywords(tokens, [entity]);
    if (score > bestEntityScore) {
      bestEntityScore = score;
      bestEntity = entity;
    }
  }
  return { intent: bestIntent, entity: bestEntity, intentScore: bestIntentScore, entityScore: bestEntityScore };
}

function fillPlaceholders(template, message, serverState) {
  let text = template;
  if (text.includes("{{estimate}}")) {
    const ramMB = serverState?.ram_total_mb || 4000;
    const cpu = serverState?.cpu || 1;
    const estimate = Math.max(1, Math.floor(ramMB / 512) * cpu);
    text = text.replace(/\{\{estimate\}\}/g, String(estimate));
  }
  return text;
}

function tryAnswer(message, serverState = {}) {
  const { intent, entity, intentScore, entityScore } = inferIntentAndEntity(message);
  if (!intent || !entity) return null;
  const score = (intentScore + entityScore) / 2;
  if (score < 0.5) return null;

  const key = `${intent}|${entity}`;
  const template = TEMPLATES[key];
  if (!template) return null;

  return {
    answer: fillPlaceholders(template, message, serverState),
    intent,
    entity,
    score,
    source: "context_engine",
  };
}

module.exports = {
  tryAnswer,
  inferIntentAndEntity,
  INTENTS,
  ENTITIES,
  TEMPLATES,
};

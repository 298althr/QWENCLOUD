# Quickstart — 10-Minute Onboarding

## You Are a New Team Member. Here's How to Get Up to Speed.

### Step 1: Read the Big Picture (2 min)

Read the [root README.md](../../README.md) — it has the navigation hub and folder structure.

### Step 2: Understand the Architecture (3 min)

Read [`docs/architecture/system-architecture.md`](../architecture/system-architecture.md) — shows how all components connect.

Then skim [`docs/architecture/data-flow.md`](../architecture/data-flow.md) — shows how a message travels through the system (Telegram → Qwen → Certainty → SAF → Execute → Memory).

### Step 3: Know the Rules (1 min)

Read [`docs/compliance/hackathon-rules.md`](../compliance/hackathon-rules.md) — 12 hard requirements we must meet. If we miss any, we're disqualified.

### Step 4: Find Your Service (2 min)

Check the [Service Overview table](../../README.md#service-overview) in the root README. Find the service you're working on and read its doc in `docs/services/`.

### Step 5: Check the Build Schedule (1 min)

Open [`docs/TRACK4-BUILD-PLAN.md`](../TRACK4-BUILD-PLAN.md) Section 6 — find the current day's checklist. Each day has:
- Task checkboxes
- Commit message
- Validation checklist

### Step 6: Set Up Local Dev (1 min)

```bash
# Clone
git clone https://github.com/your-org/althr-autopilot.git
cd althr-autopilot

# Copy env
cp .env.example .env
# Fill in: DASHSCOPE_API_KEY, TELEGRAM_BOT_TOKEN, etc.

# Start
docker-compose up -d

# Verify
curl http://localhost:3000/api/health
```

See [`docs/deployment/docker-setup.md`](../deployment/docker-setup.md) for details.

---

## Key Concepts to Understand

| Concept | What It Is | Where to Read |
|---|---|---|
| **PML** | 7-layer memory system (M1-M7) | [`docs/services/pml-memory.md`](../services/pml-memory.md) |
| **SAF** | 7-layer security check before every action | [`docs/services/saf-framework.md`](../services/saf-framework.md) |
| **Certainty Pipeline** | 7-stage decision gate with confidence scoring | [`docs/services/certainty-pipeline.md`](../services/certainty-pipeline.md) |
| **DQS** | Decision Quality Score (5 dimensions, 0-100) | [`docs/services/certainty-pipeline.md`](../services/certainty-pipeline.md) |
| **Qwen Function Calling** | 12 tools the AI can call (execute_command, read_file, etc.) | [`docs/services/qwen-ai-engine.md`](../services/qwen-ai-engine.md) |
| **Conversations API** | Cross-device session continuity (Telegram ↔ dashboard) | [`docs/services/qwen-ai-engine.md`](../services/qwen-ai-engine.md) |

---

## What NOT to Do

1. **Don't use non-Qwen LLMs** — only Qwen Cloud models
2. **Don't skip SAF** — every action goes through all 7 layers
3. **Don't add features not in the build plan** — put ideas in `FUTURE.md`
4. **Don't deploy without Alibaba Cloud proof** — it's a submission requirement
5. **Don't fake the demo video** — must show the real working product
6. **Don't write non-English content** — all submission materials must be in English

---

## Who to Ask

| Topic | Best Starting Point |
|---|---|
| Qwen API integration | `docs/services/qwen-ai-engine.md` |
| Database questions | `docs/database/schema.md` |
| Deployment issues | `docs/deployment/alibaba-cloud-setup.md` |
| API endpoints | `docs/api/api-reference.md` |
| Security framework | `docs/architecture/security-architecture.md` |
| Build schedule | `docs/TRACK4-BUILD-PLAN.md` Section 6 |
| Hackathon rules | `docs/compliance/hackathon-rules.md` |

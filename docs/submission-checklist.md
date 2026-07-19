# ALTHR Autopilot — Hackathon Submission Checklist

**Track 4: Autopilot Agent** | Global AI Hackathon Series with Qwen Cloud
**Submission Deadline:** July 9, 2026, 2:00 pm Pacific Time
**Last Updated:** July 19, 2026

---

## Submission Requirements Checklist

### ✅ Project Requirements

- [x] **Built with Qwen models on Qwen Cloud**
  - Uses `qwen-turbo`, `qwen-plus`, `qwen-max`
  - Integration: `backend/src/qwen/client.js`
  - Model rotation picks the right model based on task complexity and cost
  
- [x] **Fits Track 4: Autopilot Agent**
  - Automates real-world server operations workflows
  - Handles ambiguous inputs (natural language commands)
  - Invokes external tools (Docker, SSH, system commands)
  - Human-in-the-loop checkpoints at critical decisions
  - Production-ready (not a toy demo)

- [x] **Functioning as depicted**
  - All features work as described in README and landing page
  - Docker Compose setup verified
  - All 14 backend validation suites pass
  - Frontend build passes (20 pages compiled)
  - Landing page at `/` with 6 tabs for evaluators
  - Dashboard at `/dashboard` with live metrics and incident simulation

- [x] **Runs on intended platform**
  - Docker Compose for local development
  - Alibaba Cloud ECS for production (instance currently unreachable, code is pushed and ready)
  - Config files: `docker-compose.yml`, `docker-compose.prod.yml`
  - Nginx reverse proxy config for TLS: `nginx.althr-autopilot.conf`

- [x] **New or significantly updated**
  - Project created during hackathon window (Jun 27 – Jul 9, 2026)
  - Documented in `docs/TRACK4-BUILD-PLAN.md`

- [x] **Third-party integrations authorized**
  - Qwen Cloud (hackathon sponsor)
  - Alibaba Cloud SDKs (hackathon requirement)
  - Open-source libraries with permissive licenses

---

### ✅ Submission Materials Checklist

- [x] **Public code repository**
  - Repository URL: https://github.com/298althr/QWENCLOUD (branch: track4)
  - License: MIT (visible at top of repo in `LICENSE` file)
  - All source code included
  - Build instructions in README

- [x] **Text description**
  - Project overview in `README.md`
  - Key features listed
  - Tech stack documented
  - Installation instructions provided

- [x] **Proof of Alibaba Cloud Deployment**
  - Document: `docs/alibaba-cloud-deployment-proof.md`
  - Code file: `backend/src/utils/alibaba.js`
  - Demonstrates:
    - ECS instance listing (`DescribeInstances`)
    - OSS audit log backup (`put`)
    - Cloud Monitor custom metrics (`PutCustomMetric`)

- [x] **Architecture Diagram**
  - Document: `docs/architecture-diagram.md`
  - Shows Qwen Cloud connection to backend, database, frontend
  - Mermaid diagrams for:
    - High-level system architecture
    - Agent decision pipeline data flow
    - Alibaba Cloud integration
    - Deployment architecture
    - SOS Layer Mapping (10 volumes mapped to ALTHR components)

- [x] **SOS Architecture Compliance**
  - Document: `docs/sos-althr-mapping.md`
  - HTML Review: `frontend/public/sos-architecture-review.html`
  - Validation Script: `backend/scripts/validate-sos-compliance.js`
  - Compliance Status: 100% (26/26 requirements passed)
  - SOS Layers Implemented:
    - SOS V1 (Foundation): Core philosophy alignment
    - SOS V2 (UIK): UIC, UO, PML, MCS, IQF, RIL (9 kernel services)
    - SOS V3 (Problem Understanding): Intent parser, context acquisition
    - SOS V4 (Intelligence Pipeline): DRE, DREV, CRDS, DISC, DQS, Critique, Explainability
    - SOS V5 (Simulation): System state + walk-forward validation (adapted for server ops)
    - SOS V6 (Solution Architecture): Action planning, execution roadmap
    - SOS V7 (Execution & Learning): Orchestrator, monitor, learning engine
    - SOS V8 (Platform Integration): Qwen Cloud, Alibaba Cloud, Remote SSH
    - SOS V9 (Engineering): Microservices, event-driven, polyglot persistence
    - SOS V10 (Governance): SAF 7-layer, 5-level validation

- [ ] **Demonstration Video**
  - **Status:** Script ready, video not yet recorded
  - **Script file:** `docs/demo-recording-script.html` (updated July 19, 2026)
  - **Requirements:**
    - Less than 3 minutes
    - Shows project functioning on intended platform
    - Uploaded to YouTube / Vimeo / Youku
    - Public link
    - No third-party trademarks or copyrighted music
  - **Updated video structure (5 acts, 3 minutes):**
    1. Landing page and opening (25s) - show `/` with 6 tabs, click Go to Dashboard
    2. Simulate an incident and watch the AI respond (45s) - click Simulate CPU Spike on dashboard
    3. Human approval and safety (40s) - show `/approvals` and `/security` pages
    4. AI assistant and kill switch (35s) - type a command in `/agent`, trip kill switch in `/settings`
    5. Memory and closing (35s) - show `/memory`, return to landing page

- [x] **Track identification**
  - Track 4: Autopilot Agent
  - Will be selected in Devpost submission form

- [ ] **Blog post (optional for bonus prize)**
  - **Status:** NOT YET CREATED
  - **Requirements:**
    - Public blog or social post
    - Shares journey building with Qwen Cloud
    - Link included in submission
  - **Suggested platforms:**
    - Medium
    - Dev.to
    - Hashnode
    - LinkedIn
    - Twitter/X thread

---

### ✅ Testing & Access Checklist

- [ ] **Working project access**
  - **Status:** ECS instance unreachable, needs restart. Code is pushed to GitHub track4 branch.
  - Previous live URL: http://47.84.106.210:3001
  - Landing page at `/` is open (no login required) for evaluators
  - Dashboard at `/dashboard` is open for evaluators to explore
  - If private, include login credentials
  - Available free of charge until Judging Period ends (Jul 31, 2026)

- [x] **Local testing instructions**
  - Docker Compose: `docker compose up -d --build`
  - Access: http://localhost:3001 (frontend), http://localhost:3000/api (backend)
  - Health check: http://localhost:3000/api/health
  - Environment variables documented in `.env.example`

- [x] **No proprietary hardware required**
  - Runs on standard Linux servers
  - Docker Compose compatible
  - No special hardware dependencies

---

### ✅ Language Requirements

- [x] **All materials in English**
  - README.md
  - Documentation
  - Code comments
  - Architecture diagrams
  - (Demo video must be in English or have English subtitles)

---

### ✅ Team Representation

- [ ] **Representative appointed**
  - **Status:** TO BE FILLED
  - One individual authorized to represent team
  - Will enter submission on Devpost
  - Will receive prize if won

---

### ✅ Intellectual Property

- [x] **Original work**
  - All code created by team during hackathon
  - No IP violations
  - Open-source components properly licensed

- [x] **No financial support from Sponsor**
  - Not funded by Alibaba Cloud or Devpost
  - Not developed under contract
  - No commercial license from Sponsor

---

## Devpost Submission Form Fields

Prepare the following for the Devpost submission form:

### Project Name
**ALTHR Autopilot — AI-Native Server Operations Agent**

### Tagline
**Production-ready AI agent that automates server operations with human-in-the-loop safety**

### Description
```
ALTHR Autopilot transforms server operations from reactive firefighting to proactive, AI-driven automation. It continuously monitors Linux servers, detects anomalies, researches root causes using a 7-layer decision intelligence pipeline powered by Qwen Cloud, and safely executes remediation actions through a 7-layer security framework with human-in-the-loop approvals.

Key features:
- Continuous monitoring (CPU, memory, disk, Docker, processes, ports)
- 7-layer decision pipeline (DRE → DREV → CRDS → DISC → DQS → Critique → Explainability)
- 7-layer security framework (SAF) with immutable audit logging
- 7-layer memory system (PML) with vector embeddings
- Generic remote SSH host management — manage any Linux server
- Telegram bot interface for mobile control
- Alibaba Cloud deployment (ECS, OSS, Cloud Monitor)

Built with Qwen Cloud (qwen3.7-plus, qwen3.7-max, text-embedding-v4), Node.js, Next.js, PostgreSQL, Redis, and Docker Compose.
```

### Technologies
- Qwen Cloud (qwen3.7-plus, qwen3.7-max, text-embedding-v4)
- Node.js + Express.js
- Next.js 14 + TypeScript
- PostgreSQL (pgvector)
- Redis
- Docker Compose
- Alibaba Cloud (ECS, OSS, Cloud Monitor)
- Socket.io
- Tailwind CSS

### Links
- **Code Repository:** https://github.com/298althr/QWENCLOUD (branch: track4)
- **Architecture Diagram:** `docs/architecture-diagram.md` (also visible on landing page Architecture tab)
- **Proof of Alibaba Cloud Deployment:** `docs/alibaba-cloud-deployment-proof.md`
- **Demo Video:** [TO BE RECORDED using docs/demo-recording-script.html]
- **Live Demo:** http://47.84.106.210:3001 (ECS instance needs restart)

### Track Selection
**Track 4: Autopilot Agent**

---

## Remaining Tasks Before Submission

### High Priority

1. **Deploy to Alibaba Cloud ECS**
   - ECS instance at 47.84.106.210 is currently unreachable (SSH timeout)
   - Code is pushed to GitHub track4 branch, ready to deploy
   - Deploy command once instance is back: `ssh root@47.84.106.210 "cd /opt/althr-autopilot && git fetch origin track4 && git reset --hard origin/track4 && docker compose -f docker-compose.prod.yml up -d --build backend frontend"`
   - Get public URL for demo
   - Test all features on production deployment

2. **Record Demo Video**
   - Use the updated script: `docs/demo-recording-script.html`
   - Record screen capture following the 5-act structure
   - Edit to under 3 minutes
   - Upload to YouTube/Vimeo
   - Add link to submission

3. **Fill in submission form on Devpost**
   - Navigate to: qwencloud-hackathon.devpost.com
   - Click "Join Hackathon" (if not already joined)
   - Click "Submit a Project"
   - Fill all required fields
   - Submit before deadline

### Optional (for bonus prize)

5. **Write Blog Post**
   - Document journey building with Qwen Cloud
   - Share technical challenges and solutions
   - Publish on Medium/Dev.to/Hashnode/LinkedIn
   - Add link to submission

---

## Validation Checklist

Before final submission, verify:

- [ ] All code pushed to public repository
- [ ] LICENSE file visible at top of repository
- [ ] README.md includes clear description and setup instructions
- [ ] Architecture diagram link works
- [ ] Alibaba Cloud deployment proof link works
- [ ] Demo video is public and under 3 minutes
- [ ] Demo video shows project functioning
- [ ] Demo video has no copyrighted content
- [ ] Live demo URL is accessible (if provided)
- [ ] All environment variables documented in `.env.example`
- [ ] No secrets committed to repository
- [ ] `.env` file in `.gitignore`
- [ ] All validation tests pass locally
- [ ] Submission form filled completely
- [ ] Track selected: Track 4: Autopilot Agent
- [ ] Submitted before deadline: July 9, 2026, 2:00 pm PT

---

## Contact Information (for judges)

- **Team Name:** [TO BE FILLED]
- **Team Representative:** [TO BE FILLED]
- **Email:** [TO BE FILLED]
- **GitHub/GitLab:** [TO BE FILLED]

---

## Deadline Countdown

**Submission Deadline:** July 9, 2026, 2:00 pm Pacific Time

**Time Remaining:** [CALCULATE BASED ON CURRENT DATE]

---

## Notes

- The backend is feature-complete against Track 4 requirements
- All 14 validation suites pass
- Frontend build passes (20 pages compiled, landing page added)
- Landing page at `/` with 6 tabs for evaluators (Overview, Architecture, AI Engine, Safety, Demo, About)
- Dashboard moved to `/dashboard`, all other pages wrapped in AppShell via (app) route group
- Security architecture implemented and tested (22/22 functional tests pass):
  - API key and JWT authentication
  - WebSocket authentication middleware
  - Rate limiting (100 req/min, 20 burst)
  - Input validation with Zod on all routes
  - Global error handling middleware
  - CORS lockdown to frontend origin
  - Audit logging with client IP capture
  - Session timeout (30 min default)
  - CSP headers via Helmet
  - Nginx reverse proxy config for TLS
- Frontend sends API key in headers for REST and WebSocket connections
- Remote SSH management feature fully implemented
- Alibaba Cloud integration code: `backend/src/utils/alibaba.js`
- Architecture diagram: `docs/architecture-diagram.md` and on landing page
- ECS instance at 47.84.106.210 is unreachable, needs restart to deploy

**Good luck!**

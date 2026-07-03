# ALTHR Autopilot — 10/10 Plan

## Resources Needed (All $0)

| Resource | Status | Cost |
|---|---|---|
| **Qwen Cloud API key** (`DASHSCOPE_API_KEY`) | ✅ Already have | $0 (free tier) |
| **Telegram bot token** | ✅ Already have | $0 |
| **GitHub repo** (public) | Need to create | $0 |
| **Alibaba Cloud ECS free trial** | Need to claim | $0 (1C1G/2C2G, 12 months for new users) |
| **Alibaba Cloud OSS bucket** | Need to create | $0 (free tier: 5GB storage, 12 months) |
| **Alibaba Cloud RAM access keys** | Need to create | $0 |
| **ngrok** (for demo URL fallback) | Optional | $0 (free tier) |
| **Node.js 20+** | ✅ Already have | $0 |
| **Docker Desktop** | ✅ Already have | $0 |

**No forks needed.** Everything is built from scratch using existing npm packages (`@alicloud/ecs20140526`, `ali-oss`, `@alicloud/cms20190101`, `openai`, `pg`, `redis`, `socket.io`, `next`, etc.). No open-source repos need forking — all frameworks (DREV, CRDS, DRE, DISC) are original implementations described in your own SYSTEMS-FRAMEWORKS docs.

**One thing I need from you:** Your Alibaba Cloud account must be a new ECS user to claim the free trial. If you're not eligible, the pay-as-you-go cost for a 2C4G instance for ~6 days is ~$3-5 (stop it after submission). Can you confirm you have Alibaba Cloud account access?

---
Here's the full plan with gaps, fixes, and validation steps for each phase.

---

## Gap Summary

| # | Gap | Impact | Fix |
|---|---|---|---|
| G1 | `docker-compose.prod.yml` missing | Cannot deploy to cloud | Create prod compose with env-driven config |
| G2 | `backend/src/utils/alibaba.js` missing | No Alibaba Cloud SDK proof = disqualification | Create module with ECS/OSS/CMS SDK calls |
| G3 | DREV not implemented | Loses highest-differentiation feature (Innovation 30%) | Build pairwise verification engine |
| G4 | DRE not implemented | No research loop, no candidate generation | Build incident research engine feeding DREV |
| G5 | CRDS not implemented | No resource-reaction scoring | Build cascade veto + disturbance scoring |
| G6 | Claude Critique not implemented | No quality guardrail | Build audit layer for decision quality |
| G7 | Orchestrator doesn't call DRE/DREV/CRDS | Pipeline is execute-only, no intelligence layer | Wire frameworks into orchestrator between certainty and SAF |
| G8 | Frontend has no DREV/decision-mass visualization | Judges can't see the differentiator | Add candidate comparison panel + mass dashboard |
| G9 | No architecture diagram | Required submission artifact | Generate from QWEN-SYSTEM.md flow chart |
| G10 | No demo video | Required submission artifact | Record 3-5 min demo |
| G11 | No public GitHub repo | Required submission artifact | Push to GitHub |
| G12 | No Alibaba Cloud deployment | Required submission artifact | Deploy to ECS free tier |
| G13 | No blog post | Required submission artifact | Polish QWEN-SYSTEM.md narrative |
| G14 | Dead code in [routes/index.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/index.js:0:0-0:0) | Minor code quality | Clean up commented routes |
| G15 | Frontend Dockerfile uses `npm install` | Non-reproducible builds | Switch to `npm ci` + commit lock file |
| G16 | `NEXT_PUBLIC_API_BASE` hardcoded to localhost | Frontend won't work on remote ECS | Use build arg or env-driven config |

---

## Phase 1: Unblock Deployment

### What gets built
- `docker-compose.prod.yml` — production compose with env-driven `NEXT_PUBLIC_API_BASE`, no Docker socket mount, resource limits for free-tier ECS
- `backend/src/utils/alibaba.js` — Alibaba Cloud SDK integration (ECS describe, OSS audit backup, Cloud Monitor custom metric)
- [backend/package.json](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/package.json:0:0-0:0) — add `@alicloud/ecs20140526`, `ali-oss`, `@alicloud/cms20190101` dependencies
- Clean up [routes/index.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/index.js:0:0-0:0) dead code
- Fix [frontend/Dockerfile](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/frontend/Dockerfile:0:0-0:0) to use `npm ci`
- Generate `frontend/package-lock.json`

### Files created/modified
- `docker-compose.prod.yml` (new)
- `backend/src/utils/alibaba.js` (new)
- [backend/package.json](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/package.json:0:0-0:0) (modify — add deps)
- [backend/src/routes/index.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/index.js:0:0-0:0) (modify — remove dead code)
- [frontend/Dockerfile](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/frontend/Dockerfile:0:0-0:0) (modify — `npm ci`)
- `frontend/package-lock.json` (generate)

### Validation steps
1. `docker-compose -f docker-compose.prod.yml up -d --build` — all 4 containers start
2. `curl http://localhost:3000/api/health` — returns `{"status":"ok","services":{"postgres":"ok","redis":"ok"}}`
3. `curl http://localhost:3001` — frontend loads
4. `curl -X POST http://localhost:3000/api/agent -H "Content-Type: application/json" -d '{"message":"check server health"}'` — agent responds
5. `docker exec althr-backend node -e "require('./src/utils/alibaba.js')"` — module loads without error
6. `docker exec althr-backend node tests/day3-validation.js` — passes
7. `docker exec althr-backend node tests/day9-validation.js` — passes
8. `git status` — clean working tree, ready to push

---

## Phase 2: Implement DRE (Deep Research Engine)

### What gets built
- `backend/src/decision/dre.js` — given a symptom/problem statement:
  1. Queries PML memory (M1–M7) for similar past incidents via semantic search
  2. Calls Qwen with a structured research prompt to analyze the symptom
  3. Generates **≥2 structurally different remediation candidates** (pipeline failure if only 1)
  4. Returns candidates with: description, estimated impact, reversibility, dependencies, confidence
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) — add `POST /api/decision/research` endpoint
- `backend/tests/dre-validation.js` — test that DRE always returns ≥2 candidates

### Files created/modified
- `backend/src/decision/dre.js` (new)
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) (modify — add research endpoint)
- `backend/tests/dre-validation.js` (new)

### Validation steps
1. `docker exec althr-backend node tests/dre-validation.js` — passes
2. `curl -X POST http://localhost:3000/api/decision/research -H "Content-Type: application/json" -d '{"symptom":"API latency is high","serverState":{"cpu":85,"memory":72}}'` — returns ≥2 candidates
3. Verify candidates are **structurally different** (not variations of the same action)
4. Verify each candidate has: `description`, `impact`, `reversibility`, `dependencies`, `confidence`
5. Verify PML memory was queried (check audit log for memory reads)
6. Test with ambiguous input ("something is wrong") — DRE should still produce candidates
7. Test with empty input — DRE should return error, not crash

---

## Phase 3: Implement DREV (Pairwise Verification Engine)

### What gets built
- `backend/src/decision/drev.js` — given candidates from DRE:
  1. Runs **pairwise comparison** across all candidates (tournament bracket structure for scalability)
  2. Each pairwise comparison scores on: evidence strength (from PML), risk (from DQS mass), reversibility, historical success rate, governance compliance
  3. Winner of each pair advances; loser is retained as "Reserve Decision" with documented switch conditions
  4. Returns: winner, reserve decision, comparison matrix, reasoning for each pairwise result
  5. **Governance veto**: if a candidate violates SAF policy, it's eliminated regardless of score
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) — add `POST /api/decision/verify` endpoint
- `backend/tests/drev-validation.js` — test tournament logic, veto triggers, reserve decision

### Files created/modified
- `backend/src/decision/drev.js` (new)
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) (modify — add verify endpoint)
- `backend/tests/drev-validation.js` (new)

### Validation steps
1. `docker exec althr-backend node tests/drev-validation.js` — passes
2. Feed 4 candidates → verify tournament produces 1 winner + 1 reserve
3. Inject a candidate that violates SAF → verify governance veto eliminates it
4. Inject a deliberately bad candidate that scores high on one metric → verify pairwise comparison exposes it
5. Feed 50 candidates → verify tournament completes in <2 seconds (scalability)
6. Verify comparison matrix is returned with reasoning for each pair
7. `curl -X POST http://localhost:3000/api/decision/verify -H "Content-Type: application/json" -d '{"candidates":[...]}'` — returns winner + reserve + matrix

---

## Phase 4: Implement CRDS (Resource Reaction Scoring)

### What gets built
- `backend/src/decision/crds.js` — repurposed as **Resource Contention and Ripple Reaction System**:
  1. For each candidate action, scores how the system's resource landscape will react
  2. Dimensions: CPU disturbance, memory disturbance, disk I/O impact, network impact, cascading failure probability, process dependency impact
  3. Weighted aggregation → **Resource Reaction Score (RRS)** normalized to [-100, +100]
  4. **Cascade veto**: if magnitude ≤ −0.8 AND probability ≥ 0.7 AND weight ≥ 20 → action is vetoed
  5. Uses live server metrics from [monitors/monitor.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/monitors/monitor.js:0:0-0:0) as input
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) — add `POST /api/decision/reaction` endpoint
- `backend/tests/crds-validation.js` — test scoring, veto triggers, cross-domain config

### Files created/modified
- `backend/src/decision/crds.js` (new)
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) (modify — add reaction endpoint)
- `backend/tests/crds-validation.js` (new)

### Validation steps
1. `docker exec althr-backend node tests/crds-validation.js` — passes
2. Feed "restart postgres" as action with high CPU context → verify RRS reflects disturbance
3. Feed "read health check" as action → verify RRS is near-neutral (low disturbance)
4. Construct a case where cascade veto should trigger (high magnitude, high probability, high weight) → verify veto fires
5. Vary one input (e.g., CPU load) → verify RRS moves in expected direction
6. `curl -X POST http://localhost:3000/api/decision/reaction -H "Content-Type: application/json" -d '{"action":"restart_nginx","serverState":{...}}'` — returns RRS + breakdown

---

## Phase 5: Implement Claude Critique Guardrail

### What gets built
- `backend/src/decision/critique.js` — quality-over-quantity audit layer:
  1. Stores decisions as **tuples** (magnitude, confidence, latency, feedback_delta) not just counts
  2. Computes **decision quality index** = mass × confidence × feedback_delta
  3. Flags **decision inflation**: if decision count rises while average quality falls → alert
  4. Splits dashboard metrics into quantity vs. quality views
  5. Runs as a post-execution audit hook — called after every action completes
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) — add `GET /api/decision/quality` endpoint
- `backend/tests/critique-validation.js` — test tuple storage, inflation detection, quality scoring

### Files created/modified
- `backend/src/decision/critique.js` (new)
- [backend/src/routes/decision.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/routes/decision.js:0:0-0:0) (modify — add quality endpoint)
- `backend/tests/critique-validation.js` (new)

### Validation steps
1. `docker exec althr-backend node tests/critique-validation.js` — passes
2. Execute 10 low-mass actions → verify quality index is low despite high count
3. Execute 1 high-mass action with good outcome → verify quality index is high
4. Simulate count rising + quality falling → verify inflation alert triggers
5. Verify decisions are stored as tuples with all 4 fields
6. `curl http://localhost:3000/api/decision/quality` — returns quantity + quality split

---

## Phase 6: Wire All Frameworks into Orchestrator

### What gets built
The orchestrator pipeline expands from:
```
Intent → Plan → SAF → Decision Mass → Approval/Execute → Audit → Memory
```
to:
```
Intent → DRE Research → DREV Verification → CRDS Reaction → DQS Mass → SAF → Approval/Execute → Audit → Critique → Memory
```

- [backend/src/pipeline/orchestrator.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/pipeline/orchestrator.js:0:0-0:0) — modify [handleAgentMessage()](cci:1://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/pipeline/orchestrator.js:14:0-162:1) to:
  1. After intent parsing, call DRE to research the problem and generate candidates
  2. Pass candidates to DREV for pairwise verification → get winner + reserve
  3. Score winner with CRDS for resource reaction → check cascade veto
  4. Calculate decision mass (DQS) on the winning candidate
  5. Run SAF on the winner
  6. Route to approval/auto-execute as before
  7. After execution, run Claude Critique audit hook
  8. Store everything in PML memory with full reasoning chain
  9. Emit WebSocket events for each stage (so frontend can stream the full pipeline)
- `backend/tests/pipeline-validation.js` — end-to-end test of the full intelligence pipeline

### Files created/modified
- [backend/src/pipeline/orchestrator.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/src/pipeline/orchestrator.js:0:0-0:0) (modify — major refactor)
- `backend/tests/pipeline-validation.js` (new)

### Validation steps
1. `docker exec althr-backend node tests/pipeline-validation.js` — passes
2. Send "the API is slow" via WebSocket → verify full pipeline executes:
   - DRE research event emitted with ≥2 candidates
   - DREV verification event emitted with winner + reserve + matrix
   - CRDS reaction event emitted with RRS score
   - Decision mass event emitted with DI + tier
   - SAF event emitted
   - Approval/execution event emitted
3. Send a trivial command ("check health") → verify DRE is skipped (low-complexity shortcut)
4. Send a dangerous command ("rm -rf /") → verify CRDS cascade veto or SAF blocks it
5. Verify all stages are stored in M5_decision with full reasoning chain
6. Verify Claude Critique runs after execution and quality is recorded
7. `docker exec althr-backend node tests/day3-validation.js` through [day9-validation.js](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/backend/tests/day9-validation.js:0:0-0:0) — all still pass (no regressions)

---

## Phase 7: Frontend — Intelligence Layer Visualization

### What gets built
- `frontend/src/components/ResearchPanel.tsx` — shows DRE research output: problem statement, candidates generated, evidence sources
- `frontend/src/components/VerificationPanel.tsx` — shows DREV tournament: pairwise comparison matrix, winner, reserve decision, reasoning per pair
- `frontend/src/components/ReactionScore.tsx` — shows CRDS resource reaction score with dimension breakdown bar chart
- `frontend/src/components/DecisionMassCard.tsx` — shows DQS mass: size/risk/complexity/confidence bars + DI tier badge
- `frontend/src/components/QualityDashboard.tsx` — shows Claude Critique: quantity vs. quality split, inflation alert
- [frontend/src/app/agent/page.tsx](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/frontend/src/app/agent/page.tsx:0:0-0:0) — modify to show full intelligence pipeline streaming
- `frontend/src/stores/agent-store.ts` — add state for research/verification/reaction/quality events
- `frontend/src/lib/websocket.ts` — add handlers for new WebSocket events

### Files created/modified
- `frontend/src/components/ResearchPanel.tsx` (new)
- `frontend/src/components/VerificationPanel.tsx` (new)
- `frontend/src/components/ReactionScore.tsx` (new)
- `frontend/src/components/DecisionMassCard.tsx` (new)
- `frontend/src/components/QualityDashboard.tsx` (new)
- [frontend/src/app/agent/page.tsx](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/frontend/src/app/agent/page.tsx:0:0-0:0) (modify)
- `frontend/src/stores/agent-store.ts` (modify)
- `frontend/src/lib/websocket.ts` (modify)

### Validation steps
1. `docker-compose up -d --build` — frontend builds without errors
2. Open `http://localhost:3001` — dashboard loads
3. Navigate to Agent Console → send "the API is slow"
4. Verify ResearchPanel appears with ≥2 candidates
5. Verify VerificationPanel appears with comparison matrix and winner highlighted
6. Verify ReactionScore appears with dimension breakdown
7. Verify DecisionMassCard appears with DI tier badge
8. Verify all panels update in real-time via WebSocket (not polling)
9. Navigate to Analytics page → verify QualityDashboard shows quantity/quality split
10. Test on mobile viewport → verify responsive layout doesn't break
11. `docker exec althr-frontend npx next lint` — no lint errors

---

## Phase 8: Deploy to Alibaba Cloud ECS

### What gets done
1. You create Alibaba Cloud account (if not already) and claim free trial ECS
2. You provide me the ECS public IP + SSH access (or run commands yourself)
3. Install Docker on ECS: `apt update && apt install -y docker.io docker-compose-plugin`
4. Clone repo, create [.env](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/.env:0:0-0:0) with real keys
5. `docker compose -f docker-compose.prod.yml up -d`
6. Configure security group: open ports 3000, 3001
7. Set up ngrok (if no domain) for demo URL
8. Verify `backend/src/utils/alibaba.js` connects to Alibaba Cloud services

### Validation steps
1. `ssh root@<ECS-IP> "docker ps"` — all 4 containers running
2. `curl http://<ECS-IP>:3000/api/health` — returns `{"status":"ok",...}`
3. `curl http://<ECS-IP>:3001` — frontend loads
4. `curl -X POST http://<ECS-IP>:3000/api/agent -H "Content-Type: application/json" -d '{"message":"check server health"}'` — agent responds with full pipeline
5. `curl http://<ECS-IP>:3000/api/decision/quality` — returns quality metrics
6. Verify `alibaba.js` can list ECS instances (proves SDK integration)
7. Verify OSS bucket upload works (audit log backup)
8. Verify Cloud Monitor custom metric is reported
9. If using ngrok: `ngrok http 3000` → verify tunnel URL works
10. Open demo URL in browser → full dashboard works remotely

---

## Phase 9: Submission Artifacts

### What gets created
- **Architecture diagram** — SVG/PNG generated from the QWEN-SYSTEM.md flow chart showing: DRE → DISC → DQS → CRDS → DREV → ALTHR → Qwen Cloud
- **Demo video (3-5 min)** — script:
  1. "This is ALTHR Autopilot, a decision-intelligence agent for server operations"
  2. Show dashboard, send "the API is slow" via Agent Console
  3. Watch DRE research the problem → generates 3 candidates
  4. Watch DREV run pairwise verification → Candidate B wins, Candidate A is reserve
  5. Show CRDS resource reaction score → no cascade veto
  6. Show decision mass → DI = 0.73, tier = "large", requires human approval
  7. Approve via dashboard → agent executes → shows result
  8. Show memory layer → decision stored with full reasoning chain
  9. Show quality dashboard → 1 high-quality decision, not 10 low-quality ones
  10. "This is not a chatbot that runs commands. It researches, verifies, and learns."
- **Blog post** — polish QWEN-SYSTEM.md §6 narrative into a public blog post
- **README.md** — update with live demo URL, screenshots, architecture diagram embed
- **Devpost submission** — repo link, demo URL, video, all required fields

### Files created/modified
- `docs/architecture-diagram.svg` (new)
- `docs/architecture-diagram.png` (new)
- `docs/blog-post.md` (new)
- [README.md](cci:7://file:///c:/Users/Sav-Dev/Documents/HACKATHON/QWENCLOUD/TRACK4/README.md:0:0-0:0) (modify — add demo URL, screenshots, diagram)
- `docs/demo-video-script.md` (new)

### Validation steps
1. Architecture diagram opens in browser — all 7 layers visible with arrows
2. Demo video is 3-5 minutes, shows full pipeline, audio is clear
3. Blog post is 500-1000 words, tells the "decision-intelligence not chatbot" story
4. README has: live demo URL, screenshots, architecture diagram, setup instructions
5. Devpost submission has: repo URL, demo URL, video URL, all required fields filled
6. Compliance checklist at `docs/compliance/hackathon-rules.md` — every item checked

---

## Phase 10: Final End-to-End Validation

### Validation steps (all must pass)
1. `docker exec althr-backend node tests/day3-validation.js` ✅
2. `docker exec althr-backend node tests/day4-validation.js` ✅
3. `docker exec althr-backend node tests/day5-validation.js` ✅
4. `docker exec althr-backend node tests/day6-validation.js` ✅
5. `docker exec althr-backend node tests/day9-validation.js` ✅
6. `docker exec althr-backend node tests/dre-validation.js` ✅
7. `docker exec althr-backend node tests/drev-validation.js` ✅
8. `docker exec althr-backend node tests/crds-validation.js` ✅
9. `docker exec althr-backend node tests/critique-validation.js` ✅
10. `docker exec althr-backend node tests/pipeline-validation.js` ✅
11. Live demo URL responds: `curl http://<demo-url>/api/health` → ok
12. Full agent flow works on live demo: send message → get response with full pipeline
13. Alibaba Cloud SDK proof: `alibaba.js` successfully calls ECS/OSS/CMS APIs
14. GitHub repo is public and README is polished
15. All submission artifacts exist: repo + demo URL + video + diagram + blog post

---

## Projected Score After All Phases

| Criterion | Weight | Current | After 10/10 Plan | Why |
|---|---|---|---|---|
| **Innovation & AI Creativity** | 30% | 5/10 | **9.5/10** | DREV pairwise verification + DRE research loop + CRDS reaction scoring + decision mass = 4 novel, visible, defensible differentiators |
| **Technical Depth & Engineering** | 30% | 7/10 | **9.5/10** | Full 7-layer intelligence pipeline, modular architecture, calibration, audit, memory, 10 test suites, clean code |
| **Problem Value & Impact** | 25% | 7/10 | **9/10** | Real server ops, prevents harmful actions via cascade veto + pairwise verification, production-shaped, scalable to other domains |
| **Presentation & Documentation** | 15% | 9/10 | **10/10** | Exceptional docs + architecture diagram + demo video + blog post + live demo URL |

**Projected total: ~9.5/10** — this is a winning score.

---

## What I Need From You to Start

1. **Confirm Alibaba Cloud account access** — can you create an account and claim the free trial ECS? Or do you already have one?
2. **Confirm GitHub repo** — do you have a public GitHub repo created, or should I help you create one?
3. **Greenlight to start Phase 1** — I'll begin creating `docker-compose.prod.yml` and `alibaba.js` immediately.

Say the word and I'll start building.
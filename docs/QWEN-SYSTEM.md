# Qwen System: How the Decision-Intelligence Stack Serves the Qwen Cloud Hackathon

> This document explains how the seven frameworks indexed in `docs/SYSTEMS-INDEX.md`, synthesized in `docs/SYSTEMS-SYNTHESIS.md`, and calibrated in `docs/SYSTEMS-GAPS-PRINCIPLES.md` come together to make ALTHR Autopilot a competitive submission for the **Global AI Hackathon Series with Qwen Cloud**, Track 4: Autopilot Agent.

---

## 1. What Qwen Cloud requires

From the official rules (`QWEN-CLOUD.txt`):

- **Track 4: Autopilot Agent** — build an agent that automates real-world business workflows end-to-end.
- Must demonstrate handling of ambiguous inputs, external tool invocation, and **human-in-the-loop checkpoints at critical decision points**.
- Emphasis on **production-readiness over toy demos**.
- Must use **Qwen models available on Qwen Cloud**.
- Must provide **proof of Alibaba Cloud deployment**, an architecture diagram, a demo video, and a public repo.

Judging criteria are equally weighted across four areas (the actual Stage Two criteria are listed as percentages):

| Criterion | Weight | What judges look for |
|---|---|---|
| **Innovation & AI Creativity** | 30% | Sophisticated Qwen Cloud API use, custom skills, MCP integrations, novel algorithms |
| **Technical Depth & Engineering** | 30% | Architecture quality, modularity, scalability, error handling, clean non-trivial logic |
| **Problem Value & Impact** | 25% | Real-world relevance, solves authentic pain point, scalability potential |
| **Presentation & Documentation** | 15% | Clear demo, architecture docs, technical logic visualized |

This is what the Qwen System is designed to satisfy.

---

## 2. From the index to the synthesis handler

The seven frameworks are not independent. They form a single decision-intelligence stack. Here is how they flow from the index into the synthesis handler that drives ALTHR:

```
SYSTEMS-INDEX.md
    │
    ▼
DRE — Deep Research Engine
    │  "Given a symptom or goal, research the landscape, generate ≥2 solutions"
    ▼
DISC — Decision Intelligence Supply Chain
    │  "Turn raw data into evidence, features, hypotheses, scenarios"
    ▼
DQS — Decision Quantification System
    │  "Measure the mass, density, energy, and risk of each candidate action"
    ▼
CRDS — Competitive Reaction Decision System
    │  "Price in how the system/resource landscape reacts to the action"
    ▼
DREV — Decision Ripple Verification Engine
    │  "Challenge every candidate against alternatives, governance, and history"
    ▼
Claude Critique — Decision-Quality Guardrail
    │  "Prevent count-based, low-quality decision inflation"
    ▼
SYSTEMS-SYNTHESIS.md
    │
    ▼
ALITHR Autopilot execution layer
    │  Intent → Plan → SAF → Decision Mass → Approval/Execute → Audit → PML Memory
    ▼
Qwen Cloud API (Qwen models via DashScope)
```

The **synthesis handler** is the orchestrator: it takes the principles from the frameworks and applies them to every agent action. The handler is not a new module; it is the combined behavior of `backend/src/pipeline/orchestrator.js` + `backend/src/decision/mass.js` + `backend/src/decision/calibration.js` + the PML memory layer.

---

## 3. How each system helps the Qwen Cloud submission

### 3.1 DRE — research before acting

**Qwen Cloud relevance:**

- Track 4 requires ambiguous inputs and external tool use. DRE gives the agent a structured way to handle ambiguity: it decomposes the problem, gathers evidence, and always returns **≥2 structurally different solutions**.
- For a server-ops demo, when a user says "the API is slow," DRE would research recent deploys, dependencies, traffic patterns, and memory logs, then produce candidate fixes (scale the pool, add caching, optimize the query).

**Judging criterion hit:**

- **Innovation & AI Creativity:** DRE is a novel research loop, not a single-shot prompt.
- **Problem Value & Impact:** Shows real diagnostic depth, not toy command execution.

---

### 3.2 DISC — data is a portfolio, not a pile

**Qwen Cloud relevance:**

- Qwen Cloud provides models and APIs. ALTHR consumes multiple signals: server metrics, process lists, port scans, logs, memory, Telegram messages, human approvals.
- DISC ranks these signals by **information gain per unit of compute** and retires stale sources. This directly addresses production-readiness: a production agent cannot blindly ingest everything.

**Judging criterion hit:**

- **Technical Depth & Engineering:** Portfolio management of data sources is a sophisticated engineering pattern.
- **Problem Value & Impact:** Efficient information use = lower cost and better uptime.

---

### 3.3 DQS — every decision has mass

**Qwen Cloud relevance:**

- Track 4 explicitly asks for human-in-the-loop checkpoints at critical decision points. DQS tells the system **which** decisions are critical.
- `backend/src/decision/mass.js` now calculates a Decision Index (DI) for every action. A `rm -rf /` command gets a high DI and triggers human approval automatically; a health check gets a low DI and runs automatically.

**Judging criterion hit:**

- **Technical Depth & Engineering:** Mass calculation is a non-trivial, domain-aware scoring layer.
- **Problem Value & Impact:** Prevents catastrophic automation errors, a real production concern.
- **Innovation & AI Creativity:** "Decision mass" is a memorable, differentiated concept.

---

### 3.4 CRDS — price in the reaction

**Qwen Cloud relevance:**

- For server operations, the "competition" is not rival companies. It is the **resource landscape**: CPU, memory, disk, network, other processes, and the risk of cascading failure.
- CRDS can be repurposed as a **Resource Contention and Ripple Reaction System**. Before killing a process, the agent scores how the rest of the system reacts.

**Judging criterion hit:**

- **Innovation & AI Creativity:** Competitive-reaction scoring adapted to system-resource dynamics is a novel application.
- **Problem Value & Impact:** Avoids remediation actions that make the system worse.

---

### 3.5 DREV — survive every challenge

**Qwen Cloud relevance:**

- Track 4 values production-readiness. DREV forces every remediation action to survive pairwise comparison against alternatives: restart, scale, rollback, wait, or do nothing.
- The dashboard can show the user: "I considered 4 options; Option C survived because it has the lowest risk of cascading failure."

**Judging criterion hit:**

- **Innovation & AI Creativity:** Pairwise verification is a stronger principle than ranking.
- **Presentation & Documentation:** The comparison graph is a clear demo moment.
- **Problem Value & Impact:** Reduces wrong fixes in production.

---

### 3.6 Claude Critique — quality, not quantity

**Qwen Cloud relevance:**

- A naive agent could generate thousands of low-value alerts. The Claude Critique prevents the system from celebrating throughput and instead measures **decision quality**.
- Implemented as an audit layer, it ensures the agent does not spam approvals or execute trivial actions that waste attention.

**Judging criterion hit:**

- **Problem Value & Impact:** Quality-focused automation is what production teams actually need.
- **Technical Depth & Engineering:** Feedback-grading and risk-weighted allocation are clean engineering constraints.

---

## 4. The synthesis handler in ALTHR

The current ALTHR backend already wires the first two layers of the synthesis:

| Layer | File | What it does |
|---|---|---|
| Intent + Plan | `backend/src/pipeline/orchestrator.js` | Parses intent, runs certainty pipeline, builds plan |
| Decision Mass | `backend/src/decision/mass.js` | Computes DI and authentication tier |
| Calibration | `backend/src/decision/calibration.js` | Records predicted vs. actual outcomes |
| SAF | `backend/src/pipeline/saf.js` | 7-layer security gate |
| Approval | `backend/src/pipeline/approvals.js` | Human-in-the-loop checkpoint |
| Memory | `backend/src/memory/store.js` + PML | Stores M1–M7 memory with embeddings |
| Audit | `backend/src/utils/audit.js` + `audit_log` | Immutable decision record |

Every agent action now passes through:

```
Intent → Plan → SAF → Decision Mass → Approval/Execute → Audit → Memory
                ↓           ↓
            DQS layer   human-in-the-loop
```

The next steps to complete the full synthesis are:

1. Add DREV pairwise verification for remediation actions.
2. Add CRDS resource-reaction scoring.
3. Add DRE incident research for root-cause + ≥2 remediation options.
4. Add DISC information valuation for monitoring signals.

---

## 5. Mapping the stack to the judging criteria

| Framework | Innovation & AI Creativity (30%) | Technical Depth & Engineering (30%) | Problem Value & Impact (25%) | Presentation & Documentation (15%) |
|---|---|---|---|---|
| DRE | Research loop, ≥2 solutions | Iterative gather/synthesize | Real diagnostics | Explainable recommendations |
| DISC | Data portfolio theory | Information valuation engine | Cost-efficient monitoring | Source-rank dashboard |
| DQS | "Decision mass" concept | Quantification module | Risk-proportional governance | Mass score visualization |
| CRDS | Competitive reaction adapted to systems | Cascade veto, weighted scoring | Avoids harmful remediation | Reaction-score breakdown |
| DREV | Pairwise verification | Tournament + consistency checks | Better production decisions | Comparison graph |
| Claude Critique | Quality-over-quantity framing | Feedback grading | Prevents alert fatigue | Audit checklist |

The stack covers every judging criterion.

---

## 6. Why this matters for Qwen Cloud specifically

Qwen Cloud is the API layer. The agent's brain is Qwen. The **value of the submission is not the model call itself; it is what the agent does with the model's reasoning**.

The Qwen System argument is:

> "Most submissions will call Qwen to generate a command. ALTHR calls Qwen to research, quantify, verify, and learn from every decision. The Qwen model is not just a chatbot; it is the reasoning engine inside a decision-intelligence architecture."

This makes the submission more sophisticated than "Qwen + shell commands." It shows:

- **Sophisticated use of Qwen Cloud APIs:** multi-step reasoning, intent parsing, action planning, memory embeddings, and now decision mass.
- **Production-readiness:** human-in-the-loop, calibration, audit, memory, and monitoring.
- **Real-world pain point:** server operations is expensive, error-prone, and hard to staff.
- **Scalability potential:** the decision-intelligence stack is domain-agnostic and can be applied to DevOps, customer support, procurement, or finance.

---

## 7. Submission artifacts this stack enables

The Qwen Cloud rules require specific artifacts. The Qwen System stack directly helps produce them:

| Required Artifact | How the Qwen System helps |
|---|---|
| **Public repo** | All framework docs, code, and calibration tests are in the repo. |
| **Proof of Alibaba Cloud deployment** | The local-first strategy is a stepping stone; the same Docker containers deploy to Alibaba Cloud ECS. |
| **Architecture diagram** | The stack in section 2 becomes the diagram: DRE → DISC → DQS → CRDS → DREV → ALTHR → Qwen Cloud. |
| **Demo video** | Show the agent researching a slow API, displaying decision mass, and choosing a remediation that survived verification. |
| **Blog post** | The Qwen System narrative is the story: "Building a decision-intelligence agent, not a chatbot." |

---

## 8. Synthesis in one sentence

> For the Qwen Cloud Hackathon, the seven decision-intelligence frameworks transform ALTHR Autopilot from a command-executing agent into a **researching, quantifying, verifying, and learning operations system** — exactly the production-ready Autopilot Agent that Track 4 is asking for.

---

## 9. References

- `QWEN-CLOUD.txt` — Official hackathon rules and judging criteria
- `docs/SYSTEMS-INDEX.md` — Per-system grades, validation, domains, and real-life uses
- `docs/SYSTEMS-SYNTHESIS.md` — Synthesis of the seven frameworks
- `docs/SYSTEMS-GAPS-PRINCIPLES.md` — Gaps, principles, measurement scales, and A+ path
- `docs/deployment/local-first-strategy.md` — Deployment plan for Alibaba Cloud
- `docs/HANDOFF.md` — Current project state and next steps


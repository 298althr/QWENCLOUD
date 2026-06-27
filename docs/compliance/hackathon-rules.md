# Hackathon Rules Compliance Checklist

> **Source:** `QWENCLOUD/QWEN-CLOUD.txt` — Global AI Hackathon Series with Qwen Cloud
> **Track:** Track 4 — Autopilot Agent

## Hard Requirements (R1-R12)

| # | Requirement | Source | Status | Verification | Deadline |
|---|---|---|---|---|---|
| R1 | Must use Qwen models from Qwen Cloud | §4 Project Requirements | ☐ | `DASHSCOPE_API_KEY` set; all LLM calls go to `dashscope-intl.aliyuncs.com` | Day 1 |
| R2 | Must deploy backend on Alibaba Cloud | §4 Submission Requirements | ☐ | Code file in repo showing Alibaba Cloud SDK usage (ECS/OSS/CloudMonitor) | Day 10 |
| R3 | Public GitHub repo with open-source license | §4 Submission Requirements | ☐ | License file in root; "MIT" visible in repo About section | Day 1 |
| R4 | Text description explaining features | §4 Submission Requirements | ☐ | Devpost submission text field completed | Day 12 |
| R5 | Architecture diagram (visual) | §4 Submission Requirements | ☐ | PNG/PDF in repo + Devpost; shows Qwen → backend → DB → frontend | Day 11 |
| R6 | Demo video ≤3 minutes | §4 Submission Requirements | ☐ | Uploaded to YouTube/Vimeo/Youku; link in Devpost | Day 11 |
| R7 | Working demo accessible to judges | §4 Testing | ☐ | Public URL + login creds in testing instructions | Day 11 |
| R8 | Track selection: Track 4 — Autopilot Agent | §4 Submission Requirements | ☐ | Selected on Devpost submission form | Day 12 |
| R9 | Must be original work | §7 IP Rights | ☐ | No third-party code without attribution/license | Ongoing |
| R10 | Must be in English | §4 Language Requirements | ☐ | All submission materials in English | Ongoing |
| R11 | Must function as depicted in video | §4 Functionality | ☐ | Video shows real working product, not mockups | Day 11 |
| R12 | Project significantly updated during hackathon | §4 New & Existing | ☐ | Git commit history shows work after May 26, 2026 | Ongoing |

## Judging Criteria Alignment

| Criterion | Weight | Target Score | How We Hit It | Demo Evidence |
|---|---|---|---|---|
| Innovation & AI Creativity | 30% | 28/30 | Qwen function calling (12 tools), thinking mode for diagnosis, structured output for DQS, Conversations API for cross-device, MCP server, Batch API | Demo shows Qwen calling tools + thinking mode reasoning chain live |
| Technical Depth & Engineering | 30% | 27/30 | 7-layer SAF, Certainty-Driven Pipeline, PML 7-tier memory, WebSocket streaming, Docker on Alibaba Cloud, immutable audit logging | Architecture diagram shows all layers; code is clean and modular |
| Problem Value & Impact | 25% | 22/25 | Real server management (not toy), production-ready, open-source potential, scalable to multi-server fleets | Demo solves a real DevOps problem end-to-end |
| Presentation & Documentation | 15% | 14/15 | Architecture diagram, 3-min demo video, comprehensive README, Luxury Dark Mode dashboard, blog post | Video is polished; README has setup + screenshots |

## Stage One Pass/Fail Gate

Stage One checks: Does the project reasonably fit Track 4 and reasonably apply Qwen Cloud APIs?

- ☐ Track 4 fit: Automates real-world business workflows end-to-end ✓
- ☐ Qwen Cloud usage: Chat Completions + Function Calling + Thinking + Embeddings + Conversations + Structured Output ✓
- ☐ Alibaba Cloud deployment proof: Code file with SDK calls ✓

**If any of these fail, the submission does not advance to Stage Two. Verify before Day 12.**

## Submission Components Checklist

- [ ] Public GitHub repo (MIT license in About section)
- [ ] `alibaba-cloud-deployment.md` or `backend/src/utils/alibaba.js` (Alibaba Cloud proof)
- [ ] Architecture diagram (PNG, visual, not text)
- [ ] Demo video (≤3 min, uploaded to YouTube/Vimeo/Youku)
- [ ] Devpost submission with:
  - [ ] Project name: "ALTHR Autopilot"
  - [ ] Track selection: Track 4 — Autopilot Agent
  - [ ] Text description (features, functionality, architecture)
  - [ ] Code repo URL
  - [ ] Alibaba Cloud deployment proof link
  - [ ] Architecture diagram upload
  - [ ] Demo video URL
  - [ ] Testing instructions (public URL + login credentials)
- [ ] Blog post (optional, for bonus prize)
- [ ] Submit at least 2 hours before deadline (before 12:00 PM Pacific, Jul 9)

## Anti-Deviation Rules

1. No scope creep — 8 features only. New ideas → `FUTURE.md`
2. No alternative LLMs — Qwen Cloud only
3. No skipping Alibaba Cloud — deploy by Day 10
4. No proprietary code — MIT license
5. No fake demos — real working product
6. No missing submission components — check every day from Day 10
7. English only — all materials
8. 3-minute video hard cap
9. Blog post is bonus — don't sacrifice submission quality
10. Submit early — Day 12 morning, not last minute

## Key Dates

| Date | Milestone |
|---|---|
| May 26, 2026 | Hackathon opens (work must be after this date) |
| Jun 27, 2026 | Build starts (Day 1) |
| Jul 6, 2026 | Deploy to Alibaba Cloud (Day 10) |
| Jul 7, 2026 | Record demo video (Day 11) |
| Jul 8, 2026 | Final submission (Day 12) |
| Jul 9, 2026, 1:59 PM Pacific | **Hard deadline** |

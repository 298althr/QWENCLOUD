# Local-First Development Strategy (Cloud Deferred)

> **Status:** Active — June 27, 2026
> **Decision:** Run the full stack locally via Docker Compose for development, testing, and demo preparation. Deploy to Alibaba Cloud ECS only when the project is ready for final submission.

## Why Local-First?

- **Cost control:** Avoid Alibaba Cloud charges until the project is submission-ready.
- **Speed:** Local Docker has faster iteration cycles than cloud provisioning.
- **Feature completeness:** Finish all features, UI polish, and integration tests before paying for cloud infrastructure.
- **Risk reduction:** Cloud deployment happens once at the end, not continuously during development.

## What is Ready Now (Local Docker)

The current `.env` already contains the keys required for local development:

| Credential | Status | Source |
|---|---|---|
| `DASHSCOPE_API_KEY` | ✅ Available | Provided in `.env` |
| `TELEGRAM_BOT_TOKEN` | ✅ Available | Provided in `.env` |
| `TELEGRAM_CHATID` | ✅ Available | Provided in `.env` |
| `RESEND_API` | ✅ Available | Optional — for email notifications |
| `GITHUB_TOKEN` | ✅ Available | Optional — for GitHub clone/deploy features |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | ⏳ Deferred | Only needed for Day 10 cloud deployment |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | ⏳ Deferred | Only needed for Day 10 cloud deployment |

## Required for Local Docker

| Resource | How We Provide It Locally | Status |
|---|---|---|
| **Node.js backend** | Docker container built from `backend/` | ✅ Implemented |
| **Next.js frontend** | Docker container built from `frontend/` or served via Next.js dev server | ✅ Implemented |
| **PostgreSQL + pgvector** | `pgvector/pgvector:pg16` Docker container | ✅ Implemented in `docker-compose.yml` |
| **Redis** | `redis:7-alpine` Docker container | ✅ Implemented in `docker-compose.yml` |
| **Qwen Cloud API** | `DASHSCOPE_API_KEY` from `.env` | ✅ Available |
| **Telegram bot** | `TELEGRAM_BOT_TOKEN` from `.env` | ✅ Available |

## What is Deferred Until Submission

| Task | Status | When |
|---|---|---|
| Provision Alibaba Cloud ECS instance | ⏳ Deferred | Day 10 (pre-submission) |
| Create `backend/src/utils/alibaba.js` proof file | ✅ Can be written now | Day 10 (no cloud needed for the file itself) |
| Create `docker-compose.prod.yml` | ✅ Can be written now | Day 10 |
| Create Alibaba Cloud OSS bucket | ⏳ Deferred | Day 10 |
| Configure Cloud Monitor custom metrics | ⏳ Deferred | Day 10 |
| Generate public demo URL | ⏳ Deferred | Day 10 |
| Push repo to GitHub | ⏳ Deferred | Before Day 10 |

## How to Run Locally

```bash
# 1. Start backend + database + redis
cd backend
npm install
npm start

# 2. In a separate terminal, start frontend
cd frontend
npm install
npm run dev

# OR use Docker Compose (recommended for end-to-end testing):
# docker-compose up -d
```

Access points:
- Dashboard: `http://localhost:3001`
- API: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`

## Pre-Submission Checklist (Before Moving to ECS)

Before deploying to Alibaba Cloud, verify locally:

- [ ] All 10 dashboard pages render without errors
- [ ] Agent Console streams reasoning and executes commands
- [ ] Monitoring detects anomalies and streams alerts
- [ ] Telegram bot handles all 12 commands
- [ ] Memory/semantic search returns results
- [ ] DQ trend and lessons endpoints return data
- [ ] Security audit log is immutable
- [ ] `docker-compose up -d` starts the full stack cleanly
- [ ] `backend/src/utils/alibaba.js` exists and imports SDKs
- [ ] Repo is public on GitHub with MIT license visible
- [ ] README, architecture diagram, and demo video are ready

## Cloud Deployment Trigger

Deploy to Alibaba Cloud only when:
1. The local stack is fully validated (all checks above pass).
2. The submission deadline is within 1–2 days.
3. `ALIBABA_CLOUD_ACCESS_KEY_ID` and `SECRET` are available.
4. The free ECS trial has been claimed or pay-as-you-go budget is approved.

## Notes

- The `.env` file is gitignored and should never be committed.
- `GITHUB_TOKEN` and `RESEND_API` are present in `.env` but are optional for the local demo.
- The Telegram bot will start polling automatically if `TELEGRAM_BOT_TOKEN` is set.
- Alibaba Cloud credentials are the only remaining external dependency for submission.

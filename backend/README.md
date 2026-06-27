# Backend — ALTHR Autopilot

Node.js + Express backend for the Autopilot Agent.

## Structure

```
backend/
├── package.json
├── src/
│   ├── server.js               ← Express + WebSocket entry
│   ├── routes/                 ← API endpoints (see docs/api/api-reference.md)
│   ├── qwen/                   ← Qwen AI Engine (see docs/services/qwen-ai-engine.md)
│   ├── pipeline/               ← Certainty Pipeline + SAF (see docs/services/)
│   ├── memory/                 ← PML Memory (see docs/services/pml-memory.md)
│   ├── monitors/               ← Anomaly detection (see docs/services/monitoring-service.md)
│   ├── telegram/               ← Telegram bot (see docs/services/telegram-bot.md)
│   ├── utils/                  ← Audit logger, executor, Alibaba Cloud SDK
│   └── config/                 ← Allowed commands whitelist
└── tests/
```

## Setup

```bash
cd backend
npm install
npm run dev
```

## Documentation

- API Reference: `docs/api/api-reference.md`
- Service docs: `docs/services/`
- Database schema: `docs/database/schema.md`

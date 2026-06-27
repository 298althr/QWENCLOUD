# Frontend — ALTHR Autopilot

Next.js 14 (App Router) + TypeScript + Tailwind. Luxury dark-mode dashboard for the Autopilot Agent.

## Structure

```
frontend/
├── src/
│   ├── app/                ← App Router pages (one per nav section)
│   │   ├── layout.tsx      ← Root layout + Sidebar
│   │   ├── page.tsx        ← Overview / Home
│   │   ├── globals.css     ← Tailwind + luxury dark theme
│   │   ├── agent/          ← Agent Console (NL → reasoning stream)
│   │   ├── monitoring/     ← Processes, ports, graphs, alerts
│   │   ├── deployments/    ← One-command deploys
│   │   ├── files/          ← File manager
│   │   ├── security/       ← Audit log, scans, SAF status
│   │   ├── memory/         ← 7-layer PML + semantic search
│   │   ├── analytics/      ← DQ scores, performance
│   │   └── settings/       ← Agent config, SAF policy, keys
│   └── components/         ← Sidebar, HealthCard, Placeholder, ...
├── tailwind.config.js
├── tsconfig.json
└── next.config.js          ← rewrites /api/* → backend :3000
```

## Setup

```bash
cd frontend
npm install
npm run dev      # http://localhost:3100
```

Set `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000`) and
`NEXT_PUBLIC_WS_URL` for the Socket.io backend.

## Theme

Luxury dark mode: deep ink backgrounds (`#070a12`–`#141a2b`), gold accents
(`#d4af5f`), status pills (ok/warn/crit/info). See `tailwind.config.js`.

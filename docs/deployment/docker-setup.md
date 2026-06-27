# Docker Setup

## Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend/src:/app/src
      - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker for builds

  frontend:
    build: ./frontend
    ports:
      - "3001:3000"
    env_file: .env
    depends_on:
      - backend

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: althr_autopilot
      POSTGRES_USER: althr
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backend/src/memory/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
```

## Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .
EXPOSE 3000

CMD ["node", "src/server.js"]
```

## Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

## Environment Variables (.env.example)

```bash
# Qwen Cloud
DASHSCOPE_API_KEY=sk-your-qwen-api-key

# Alibaba Cloud
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_secret_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Database
POSTGRES_PASSWORD=your_password
DATABASE_URL=postgresql://althr:your_password@postgres:5432/althr_autopilot

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=your_jwt_secret
TOTP_ISSUER=ALTHR-Autopilot

# Email (Resend)
RESEND_API_KEY=your_resend_key

# GitHub
GITHUB_TOKEN=your_github_token

# Server
PORT=3000
NODE_ENV=production
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-org/althr-autopilot.git
cd althr-autopilot

# 2. Copy env file and fill in values
cp .env.example .env
# Edit .env with your API keys

# 3. Start all services
docker-compose up -d

# 4. Verify
curl http://localhost:3000/api/health
# → { "status": "ok" }
```

## Development Mode

For local development with hot reload:

```bash
# Start only database services
docker-compose up -d postgres redis

# Run backend with nodemon
cd backend && npm run dev

# Run frontend with Next.js dev
cd frontend && npm run dev
```

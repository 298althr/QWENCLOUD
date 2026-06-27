# Alibaba Cloud Setup Guide

## Prerequisites

- Alibaba Cloud account (create at https://www.alibabacloud.com)
- Access Key ID + Secret (create in RAM console)
- Qwen Cloud API key (starts with `sk-`) from DashScope

## Step 1: Create ECS Instance

1. Go to ECS Console → Instances → Create Instance
2. Select:
   - **Region:** ap-southeast-1 (Singapore) or closest
   - **Instance type:** ecs.t6-c1m2.large (2 vCPU, 4 GiB) — minimum
   - **Image:** Ubuntu 22.04 64-bit
   - **Storage:** 40 GiB SSD
   - **Network:** VPC with public IP
3. Configure security group:
   - Port 22 (SSH) — your IP only
   - Port 3000 (Backend) — 0.0.0.0/0 (for demo)
   - Port 3001 (Frontend) — 0.0.0.0/0 (for demo)
   - Port 443 (HTTPS) — 0.0.0.0/0
4. Save the instance ID and public IP

## Step 2: Create RDS PostgreSQL Instance

1. Go to RDS Console → Create Instance
2. Select:
   - **Engine:** PostgreSQL 16
   - **Edition:** Basic (single zone is fine for hackathon)
   - **Instance type:** rds.pg.s2.large (minimum)
   - **Storage:** 20 GiB SSD
   - **Network:** Same VPC as ECS
3. Set root password
4. Create database: `althr_autopilot`
5. Create user: `althr` with password
6. Configure whitelist: add ECS private IP
7. Get connection string (internal endpoint)

## Step 3: Create Redis Instance

1. Go to Redis Console → Create Instance
2. Select:
   - **Edition:** Community Edition — Standard
   - **Version:** 7.0
   - **Instance type:** 256 MB (minimum for hackathon)
   - **Network:** Same VPC as ECS
3. Set password
4. Get connection string (internal endpoint)

## Step 4: Create OSS Bucket

1. Go to OSS Console → Create Bucket
2. Set:
   - **Name:** `althr-autopilot-logs`
   - **Region:** Same as ECS
   - **ACL:** Private
   - **Versioning:** Enabled (for immutable backup)
3. Create AccessKey for OSS if needed

## Step 5: Enable Cloud Monitor

1. Go to Cloud Monitor Console
2. Ensure ECS instance is auto-discovered
3. Create custom metric namespace: `althr/autopilot`
4. Note the endpoint: `metrics.ap-southeast-1.aliyuncs.com`

## Step 6: Install Docker on ECS

```bash
# SSH into ECS instance
ssh root@your-ecs-public-ip

# Install Docker
apt update && apt install -y docker.io docker-compose
systemctl enable docker
systemctl start docker

# Verify
docker --version
docker-compose --version
```

## Step 7: Deploy the Application

```bash
# Clone repo
git clone https://github.com/your-org/althr-autopilot.git
cd althr-autopilot

# Create .env file
cp .env.example .env
# Edit .env with:
#   DASHSCOPE_API_KEY=sk-...
#   ALIBABA_CLOUD_ACCESS_KEY_ID=...
#   ALIBABA_CLOUD_ACCESS_KEY_SECRET=...
#   TELEGRAM_BOT_TOKEN=...
#   DATABASE_URL=postgresql://althr:password@rds-internal-endpoint:5432/althr_autopilot
#   REDIS_URL=redis://:password@redis-internal-endpoint:6379

# Start
docker-compose up -d

# Verify
curl http://localhost:3000/api/health
# → { "status": "ok" }
```

## Step 8: Configure pgvector

```bash
# Connect to RDS PostgreSQL
psql "postgresql://althr:password@rds-endpoint:5432/althr_autopilot"

# Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

# Run schema
\i backend/src/memory/schema.sql

# Verify
\dt
# Should show: m1_raw_events, m2_structured_data, m3_operational, m4_execution,
#              m5_decision, m6_learning, m7_strategic, audit_log, users, sessions,
#              qwen_conversations
```

## Step 9: Set Up Public Access

Option A: Use Alibaba Cloud DNS
1. Go to DNS Console → Add domain
2. Create A record: `autopilot.yourdomain.com` → ECS public IP
3. Configure Nginx reverse proxy for HTTPS (Let's Encrypt)

Option B: Use ngrok (faster for demo)
```bash
ngrok http 3000
# Use the ngrok URL for demo
```

## Step 10: Verify Alibaba Cloud Proof

The hackathon requires a code file demonstrating Alibaba Cloud SDK usage.

Verify that `backend/src/utils/alibaba.js`:
- [ ] Imports `@alicloud/ecs20140526`, `ali-oss`, `@alicloud/cms20190101`
- [ ] Initializes clients with real access keys
- [ ] Has working `backupAuditLog()` function (uploads to OSS)
- [ ] Has working `reportDQScore()` function (sends to Cloud Monitor)
- [ ] Is linked in the Devpost submission

## Cost Estimate (12-day hackathon)

| Service | Spec | Daily Cost | 12-day Total |
|---|---|---|---|
| ECS | ecs.t6-c1m2.large | ~$0.50 | ~$6.00 |
| RDS PostgreSQL | rds.pg.s2.large | ~$0.80 | ~$9.60 |
| Redis | 256 MB | ~$0.15 | ~$1.80 |
| OSS | < 1 GB | ~$0.01 | ~$0.12 |
| Cloud Monitor | Free tier | $0.00 | $0.00 |
| **Total** | | | **~$17.52** |

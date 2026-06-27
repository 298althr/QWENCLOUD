# Alibaba Cloud Setup Guide (Cost-Conscious)

> **Updated June 2026** — the original guide assumed paid RDS/Redis services. This version uses containerized PostgreSQL + Redis on a single ECS instance to minimize/eliminate cost.

## Prerequisites

- Alibaba Cloud account (create at https://www.alibabacloud.com)
- Identity verification completed (payment method required for verification)
- Access Key ID + Secret (create in RAM console)
- Qwen Cloud API key (starts with `sk-`) from DashScope

## Cost Reality Check

| Scenario | Cost | Notes |
|---|---|---|
| **Free trial eligible** | **$0.00** | Use Alibaba Cloud Free Trial Center with 1C1G (individual) or 2C2G (enterprise) instance. Must be a new ECS user with verified account. |
| **Not eligible / prefer larger** | **~$18–25** | 2C4G pay-as-you-go for 12 days. Stop/release after the hackathon. |
| **RDS + Redis services** | **~$30+** | Avoid — use Docker containers instead. |

> **Important:** The regular ECS "Quick Launch" / "Buy Now" page shows paid pricing (e.g., $39.54 for 3 months). The only way to get a free ECS is through the [Free Trial Center](https://free.alibabacloud.com/) with the specific free-tier instance.

## Step 1: Claim ECS Free Trial (Recommended)

1. Go to [Alibaba Cloud Free Trial Center](https://free.alibabacloud.com/)
2. Find the **Elastic Compute Service (ECS)** offer
3. Select the free-tier instance:
   - **Individual verified:** 1 vCPU / 1 GiB for 12 months
   - **Enterprise verified:** 2 vCPU / 2 GiB for 12 months
4. Choose **Ubuntu 22.04 64-bit** image
5. Choose region (e.g., **ap-southeast-1 Singapore**)
6. **Do not change** system disk size, bandwidth, or other options — this can make it paid
7. Click **Try Now** and confirm the order total is **$0.00** before creating

If you need more resources than the free tier offers, or are not eligible, use the **ECS Console** → **Quick Launch** → select a **Pay-as-you-go** 2C4G instance and stop it after the hackathon.

## Step 2: Configure Security Group

On the ECS instance, add these inbound rules:

| Port | Source | Purpose |
|---|---|---|
| 22 | Your IP only | SSH |
| 3000 | 0.0.0.0/0 | Backend API (Express) |
| 3001 | 0.0.0.0/0 | Frontend (Next.js dev server) — optional |
| 443 | 0.0.0.0/0 | HTTPS — optional |

## Step 3: Create OSS Bucket (for audit backups)

1. Go to [OSS Console](https://oss.console.aliyun.com/)
2. Create bucket:
   - **Name:** `althr-autopilot-logs` (must be globally unique)
   - **Region:** Same as ECS
   - **ACL:** Private
   - **Versioning:** Enabled (optional, for immutability)

## Step 4: Enable Cloud Monitor

1. Go to [Cloud Monitor Console](https://cloudmonitor.console.aliyun.com/)
2. Verify ECS instance is auto-discovered
3. Note the endpoint: `metrics.ap-southeast-1.aliyuncs.com`

## Step 5: Install Docker on ECS

SSH into the instance and run:

```bash
ssh root@your-ecs-public-ip

apt update && apt install -y docker.io docker-compose-plugin
systemctl enable docker
systemctl start docker

docker --version
docker compose version
```

## Step 6: Deploy the Application

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
#   TELEGRAM_BOT_TOKEN=...          (optional)
#   DATABASE_URL=postgresql://althr:althr@postgres:5432/althr_autopilot
#   REDIS_URL=redis://redis:6379
#   QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Use the production compose file
docker compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:3000/api/health
# → { "status": "ok", "services": { "postgres": "ok", "redis": "ok" } }
```

## Step 7: Configure pgvector

The production compose file uses `pgvector/pgvector:pg16`. The extension and schema are applied automatically by the backend on first boot, or you can run:

```bash
docker exec althr-postgres psql -U althr -d althr_autopilot -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## Step 8: Public Access

**Option A: ngrok (fastest for demo)**
```bash
ngrok http 3000
# Use the https://xxx.ngrok-free.app URL for the Devpost demo URL
```

**Option B: Alibaba Cloud DNS + Nginx (more production-like)**
1. Go to DNS Console → add your domain
2. Create A record: `autopilot.yourdomain.com` → ECS public IP
3. Install Nginx + Let's Encrypt on ECS
4. Reverse proxy to `localhost:3000`

## Step 9: Verify Alibaba Cloud Proof

The hackathon requires a code file demonstrating Alibaba Cloud SDK usage.

Verify that `backend/src/utils/alibaba.js`:
- [ ] Imports `@alicloud/ecs20140526`, `ali-oss`, `@alicloud/cms20190101`
- [ ] Initializes clients with real access keys
- [ ] Has `backupAuditLog()` function (uploads to OSS)
- [ ] Has `reportDQScore()` function (sends to Cloud Monitor)
- [ ] Is linked in the Devpost submission

## Cost-Conscious Architecture

This setup keeps all costs to a single ECS instance:

```
ECS Instance (Ubuntu 22.04)
├── Docker
│   ├── althr-autopilot (Node.js + Next.js)
│   ├── postgres (pgvector extension)
│   └── redis
├── Alibaba Cloud OSS bucket (audit backups)
└── Alibaba Cloud Monitor (custom DQ metrics)
```

No RDS, no managed Redis — just Docker containers on the ECS host. This fits the free 1C1G or 2C2G instance and keeps deployment proof simple.

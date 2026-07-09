# VLTHR Autopilot Handoff Document

## Purpose
This document provides comprehensive context for an autonomous AI agent to self-manage the VLTHR trading system, including server infrastructure, data ingestion, pipeline execution, and database operations.

---

## System Overview

### What is VLTHR?
VLTHR is a cryptocurrency paper trading system that:
- Ingests OHLCV data from Bybit exchange
- Generates trading signals using Decision Quality Score (DQS)
- Executes paper trades with risk management
- Monitors positions with dual-layer safety (dashboard + pipeline)
- Maintains TimescaleDB for persistence

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    VLTHR System Stack                        │
├─────────────────────────────────────────────────────────────┤
│  Docker Compose Orchestration (Linux Host)                  │
│  ├─ vlthr-postgres (TimescaleDB pg15)                       │
│  ├─ vlthr-data-ingestion (Python 3.11)                      │
│  ├─ vlthr-pipeline (Python 3.11)                            │
│  ├─ vlthr-dashboard-backend (Node.js Express)               │
│  ├─ vlthr-dashboard-frontend (React + nginx)                │
│  ├─ vlthr-dashboard-redis (Redis caching)                   │
│  ├─ vlthr-dashboard-ngrok (External access tunnel)          │
│  └─ ai_trader_engine (FastAPI backtest engine)              │
└─────────────────────────────────────────────────────────────┘
```

### Key Paths
- **VLTHR_ROOT:** `/home/savi/Documents/VLTHR linux/VLTHR`
- **DASHBOARD_ROOT:** `$VLTHR_ROOT/paper_trade_unzipped/vlthr-signal-dashboard`
- **Data Directory:** `$VLTHR_ROOT/data/bybit/` (Parquet OHLCV files)
- **Engine Code:** `$DASHBOARD_ROOT/engine/`
- **Backend Code:** `$DASHBOARD_ROOT/backend/`
- **Environment File:** `$VLTHR_ROOT/.env`

### Environment Variables (Critical)
```bash
export VLTHR_ROOT="/home/savi/Documents/VLTHR linux/VLTHR"
export DASHBOARD_ROOT="$VLTHR_ROOT/paper_trade_unzipped/vlthr-signal-dashboard"
cd $DASHBOARD_ROOT
```

---

## Container Management

### Container Stack
| Container | Purpose | Cadence | Health Check |
|---|---|---|---|
| vlthr-postgres | TimescaleDB database | Always | TCP 5432 |
| vlthr-data-ingestion | Bybit OHLCV ingestion | 60s | Process alive |
| vlthr-pipeline | Portfolio orchestrator | 15min | HTTP 8200 |
| vlthr-dashboard-backend | Trade monitoring | 15s | HTTP 3000 |
| vlthr-dashboard-frontend | Web UI | Always | HTTP 80 |
| vlthr-dashboard-redis | Cache layer | Always | TCP 6379 |
| vlthr-dashboard-ngrok | External tunnel | Always | HTTP 4040 |
| ai_trader_engine | Backtest engine | On-demand | HTTP 8000 |

### Docker Compose Files
```bash
# Main stack (postgres, ingestion, redis, backend, frontend, ngrok)
docker compose -f docker-compose.linux.ngrok.yml up -d --build

# Pipeline + AI engine
docker compose -f docker-compose.linux.yml up -d --build
```

### Container Status Commands
```bash
# Check all container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep vlthr

# Check specific container health
docker inspect vlthr-postgres --format='{{.State.Health.Status}}'

# Restart a container
docker restart vlthr-pipeline

# Rebuild after code changes (pipeline code is read-only mounted)
docker compose -f docker-compose.linux.yml up -d --build pipeline

# Kill stuck container (permission denied workaround)
docker inspect <name> --format '{{.State.Pid}}' | xargs sudo kill -9
docker rm -f <name>
docker compose up -d --build
```

### Common Container Issues
1. **Permission denied on stop/kill:** Use PID kill workaround above
2. **Container won't start:** Check logs, verify .env paths, check UFW rules
3. **Network issues:** UFW may block Docker bridge — check iptables DOCKER-USER chain
4. **Code changes not applied:** Pipeline code is read-only mounted — must rebuild

---

## Data Ingestion Management

### Purpose
Fetch OHLCV data from Bybit API and store as Parquet files for pipeline consumption.

### Ingestion Cadence
- **1m bars:** Every 60 seconds
- **5m/15m/1h/4h bars:** Every 60 seconds (multi-timeframe scheduler)
- **Enrichment:** OI, funding rate, L/S ratio every 60 seconds

### Active Symbols
- BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
- DOGEUSDT disabled (poor performance)

### Ingestion Health Check
```bash
# Check ingestion logs
docker logs --tail 50 vlthr-data-ingestion

# Check data freshness via DB
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT symbol, timeframe, completed_at 
  FROM ingestion_log 
  ORDER BY completed_at DESC LIMIT 10"
```

### Data Freshness Thresholds
- **Critical:** Latest 1m bar > 10 minutes old → Pipeline aborts
- **Warning:** Latest 1m bar > 5 minutes old → Alert

### Common Ingestion Issues
1. **DNS resolution failure:** `Failed to resolve 'api.bybit.com'` — Network/ISP issue
2. **Rate limiting:** Bybit API rate limit hit — Backoff and retry
3. **Proxy blocked:** Proxy IP banned — Switch proxy or go direct
4. **Gap detection:** Missing bars in sequence — Ingestion auto-fills gaps

### Ingestion Recovery Actions
```bash
# If ingestion stuck, restart container
docker restart vlthr-data-ingestion

# If DNS issues persist, check network connectivity
ping api.bybit.com
nslookup api.bybit.com

# If rate limited, wait (automatic backoff in code)
```

---

## Pipeline Management

### Purpose
Execute portfolio orchestrator every 15 minutes to scan for signals, apply gates, and create trades.

### Pipeline Steps (run_iteration)
1. **Pre-flight:** DB connectivity, data freshness, circuit breaker
2. **Step 0a:** Fallback trade monitor (safety net for OPEN trades)
3. **Step 0:** Cleanup (expire stale signal_state > 2h)
4. **Step 0c:** Reconcile risk_ledger (close entries with no matching OPEN trade)
5. **Step 0d:** Shadow decisions (resolve recently CLOSED trades)
6. **Step 1:** Scan symbols (load enriched data, compute DQS, apply V2 filters)
7. **Step 1c:** Reprice PENDING (re-validate with fresh DQS, promote to OPEN or expire)
8. **Step 2:** Signal state (upsert into signal_state)
9. **Step 3:** Rank (score and rank signals)
10. **Step 4:** Gates (V7 veto, risk budget, correlation guard, trade count guard)
11. **Step 5:** Upsert (insert approved into high_confidence_signals)
12. **Step 5c:** Create PENDING (auto-create PENDING paper_trades)
13. **Step 6:** Snapshot (portfolio snapshot)
14. **Step 7:** Telegram (alert for EXCELLENT signals)
15. **Step 8:** Post-flight (safety checks, symbol disable)
16. **Step 9:** Invariants (6 invariant checks)

### Pipeline Configuration
- **Interval:** 900 seconds (15 minutes)
- **Entry point:** `engine/run_pipeline.py --loop --interval 900`
- **Health check endpoint:** HTTP 8200

### Pipeline Health Check
```bash
# Check pipeline logs
docker logs --tail 50 f033c3ffa92b_vlthr-pipeline

# Check pipeline trace (last run)
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT node, status, duration_ms, detail 
  FROM pipeline_trace 
  WHERE run_time > NOW() - INTERVAL '1 hour' 
  ORDER BY run_time DESC LIMIT 20"

# Check health endpoint
curl http://localhost:8200/health
```

### Pipeline States
- **OK:** All steps completed successfully
- **ABORTED:** Pre-flight failed (usually data freshness)
- **ERROR:** Exception during execution

### Common Pipeline Issues
1. **Data freshness abort:** Ingestion stopped or stale data → Fix ingestion first
2. **Invariant breach:** Risk ledger mismatch → Investigate risk_ledger table
3. **Circuit breaker:** Drawdown halt → Check paper_account equity
4. **Symbol disabled:** Poor performance → Review symbol metrics

### Pipeline Control Commands
```bash
# Pause pipeline (set circuit breaker flag in DB)
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  INSERT INTO system_settings (key, value) 
  VALUES ('pipeline_paused', 'true') 
  ON CONFLICT (key) DO UPDATE SET value = 'true'"

# Resume pipeline
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  UPDATE system_settings SET value = 'false' WHERE key = 'pipeline_paused'"

# Restart pipeline container
docker restart f033c3ffa92b_vlthr-pipeline
```

---

## Database Management

### Database: TimescaleDB (PostgreSQL 15)
- **Host:** vlthr-postgres
- **Port:** 5432
- **Database:** postgres
- **User:** postgres
- **Password:** vlthr_local_pg
- **Connection string:** `postgresql://postgres:vlthr_local_pg@vlthr-postgres:5432/postgres`

### Critical Tables
| Table | Purpose | Key Columns |
|---|---|---|
| paper_trades | Trade records | id, status, symbol, side, entry_price_actual, sl_price, tp_price, net_pnl_usd |
| high_confidence_signals | Signal store | id, symbol, confidence, is_expired |
| signal_state | Live signal tracking | symbol, status, current_dqs |
| risk_ledger | Open risk tracking | trade_id, dollar_risk, is_open |
| paper_account | Account balance | balance, equity, margin_used |
| portfolio_snapshot | Per-run snapshot | run_time, balance, active_count |
| pipeline_trace | Execution trace | run_time, node, status, duration_ms |
| error_log | Error log | source, error_msg, created_at |
| ingestion_log | Data ingestion log | symbol, timeframe, completed_at |
| system_settings | Runtime config | key, value |

### Database Health Check
```bash
# Check connection
docker exec vlthr-postgres psql -U postgres -d postgres -c "SELECT 1"

# Check table sizes
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
  FROM pg_tables WHERE schemaname = 'public' 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC"

# Check recent errors
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT * FROM error_log 
  WHERE created_at > NOW() - INTERVAL '3 hours' 
  ORDER BY created_at DESC LIMIT 10"
```

### Database Maintenance
```bash
# Backup database
docker exec vlthr-postgres pg_dump -U postgres postgres > backup.sql

# Vacuum analyze (performance)
docker exec vlthr-postgres psql -U postgres -d postgres -c "VACUUM ANALYZE"

# Check for long-running queries
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'"
```

---

## Trading Operations

### Trade Lifecycle
```
Ingestion (60s) → Signal Scan (15min) → DQS Computation → Ranking → Gates →
PENDING Creation → Reprice (next run) → PENDING→OPEN Promotion →
Dashboard Auto-Close (15s) OR Pipeline Fallback Monitor (15min) → CLOSED
```

### Trade Monitoring (Dual-Layer)
1. **Primary:** Dashboard backend (server.cjs) every 15s with 1m parquet prices
2. **Fallback:** Pipeline Step 0a every 15min with 15m close prices

### Current Trade Status Query
```bash
# Open trades
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT pt.id, pt.symbol, pt.side, pt.status, pt.confidence, 
         pt.entry_price_actual, pt.sl_price, pt.tp_price, 
         rl.dollar_risk 
  FROM paper_trades pt 
  LEFT JOIN risk_ledger rl ON rl.trade_id = pt.id 
  WHERE pt.status = 'OPEN'"

# Account balance
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT * FROM paper_account ORDER BY id DESC LIMIT 1"

# Recent closed trades
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT id, symbol, side, exit_reason, exit_price, net_pnl_usd, hours_held 
  FROM paper_trades 
  WHERE status LIKE 'CLOSED%' 
  ORDER BY exit_time_utc DESC LIMIT 10"
```

### Manual Trade Control
```bash
# Close a specific trade (via backend API)
curl -X POST http://localhost:3000/api/paper/close \
  -H "Content-Type: application/json" \
  -d '{"trade_id": 260, "reason": "MANUAL"}'

# Pause trading (set flag in DB)
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  INSERT INTO system_settings (key, value) 
  VALUES ('trading_paused', 'true') 
  ON CONFLICT (key) DO UPDATE SET value = 'true'"
```

---

## Monitoring & Alerting

### Key Metrics to Monitor
1. **Container Health:** All containers should be "healthy" or "up"
2. **Data Freshness:** Latest 1m bar should be < 10 minutes old
3. **Pipeline Status:** Should complete every 15 minutes without abort
4. **Database Connectivity:** Should be able to connect and query
5. **Open Trades:** Should have 0-5 open trades (max_active_trades=5)
6. **Risk Exposure:** Open risk should be < 10% of balance
7. **Error Rate:** error_log should have minimal entries

### Alert Thresholds
- **CPU > 80%:** Alert
- **Memory > 85%:** Alert
- **Disk > 90%:** Alert
- **Latency > 1000ms:** Alert
- **Data stale > 10min:** Critical (pipeline aborts)
- **Data stale > 5min:** Warning
- **Drawdown > 20%:** Critical (circuit breaker)
- **Invariant breach:** Critical

### Telegram Alert Channels
- **DATA chat (5160128688):** Ingestion issues, data quality
- **TRADING chat (6737496589):** Trade events, performance
- **DEVOPS chat (8275099903):** Container health, system errors

### Monitoring Commands
```bash
# System status summary
docker ps --format "table {{.Names}}\t{{.Status}}" | grep vlthr

# Data freshness check
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT symbol, timeframe, completed_at, 
         NOW() - completed_at as age 
  FROM ingestion_log 
  ORDER BY completed_at DESC LIMIT 5"

# Pipeline health
docker logs --tail 20 f033c3ffa92b_vlthr-pipeline | grep -E "(OK|ABORTED|ERROR)"

# Recent errors
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT source, error_msg, created_at 
  FROM error_log 
  WHERE created_at > NOW() - INTERVAL '6 hours' 
  ORDER BY created_at DESC LIMIT 5"
```

---

## Common Issues & Resolutions

### Issue: Data Stale (Pipeline Aborts)
**Symptoms:** Pipeline logs show "Pre-flight FAILED: data_freshness"
**Root Cause:** Ingestion stopped or network issue
**Resolution:**
1. Check ingestion logs: `docker logs --tail 50 vlthr-data-ingestion`
2. Check network: `ping api.bybit.com`
3. Restart ingestion: `docker restart vlthr-data-ingestion`
4. If DNS issue, wait for ISP resolution or change DNS

### Issue: Container Won't Start
**Symptoms:** `docker ps` shows container not running
**Root Cause:** Configuration error, path issue, UFW blocking
**Resolution:**
1. Check logs: `docker logs <container>`
2. Verify .env paths (VLTHR_ROOT must NOT include v3/)
3. Check UFW rules: `sudo iptables -L DOCKER-USER`
4. Rebuild: `docker compose up -d --build`

### Issue: Pipeline Invariant Breach
**Symptoms:** Pipeline logs show "Invariant breach"
**Root Cause:** Risk ledger mismatch, data inconsistency
**Resolution:**
1. Check risk_ledger: `docker exec vlthr-postgres psql -U postgres -d postgres -c "SELECT * FROM risk_ledger WHERE is_open = TRUE"`
2. Check paper_trades: `docker exec vlthr-postgres psql -U postgres -d postgres -c "SELECT * FROM paper_trades WHERE status = 'OPEN'"`
3. Reconcile manually or restart pipeline

### Issue: High PENDING Expiry Rate
**Symptoms:** Many signals expire before promotion to OPEN
**Root Cause:** DQS volatility, aggressive V2 filters
**Resolution:**
1. Check DQS thresholds in portfolio_config.py
2. Review V2 filter thresholds
3. Consider relaxing filters if expiry rate > 50%

### Issue: Trade Not Closing
**Symptoms:** Trade should have hit SL/TP but remains OPEN
**Root Cause:** Dashboard backend down, fallback monitor not triggered
**Resolution:**
1. Check dashboard backend: `docker logs --tail 50 vlthr-dashboard-backend`
2. Restart backend: `docker restart vlthr-dashboard-backend`
3. Manual close via API if urgent

---

## Autopilot Decision Framework

### Decision Tree for System Management

```
START
  ↓
Check Container Health
  ├─ Any container down? → Restart container → Check logs → If fails, rebuild
  └─ All up → Continue
  ↓
Check Data Freshness
  ├─ Data stale > 10min? → Check ingestion → Restart if needed → Alert
  └─ Data fresh → Continue
  ↓
Check Pipeline Status
  ├─ Pipeline aborted? → Check pre-flight reason → Fix root cause → Restart
  ├─ Pipeline error? → Check error_log → Investigate → Fix → Restart
  └─ Pipeline OK → Continue
  ↓
Check Database Health
  ├─ Connection failed? → Restart postgres → Check disk space
  ├─ Long-running queries? → Kill if > 30min
  └─ DB OK → Continue
  ↓
Check Trading Status
  ├─ Open trades > 5? → Alert (should not happen)
  ├─ Risk > 10%? → Alert (risk management breach)
  ├─ Stuck trades? → Manual close if > 12h
  └─ Trading normal → Continue
  ↓
Check Error Rate
  ├─ High error rate? → Investigate error_log → Fix root cause
  └─ Error rate normal → Continue
  ↓
All Systems Healthy → Sleep 60s → Loop
```

### Autonomous Actions Allowed
1. **Restart containers** (if health check fails)
2. **Restart ingestion** (if data stale)
3. **Restart pipeline** (if aborted/error)
4. **Kill long-running DB queries** (if > 30min)
4. **Manual close stuck trades** (if > 12h hold)
5. **Send alerts** (for any issue requiring human attention)

### Actions Requiring Human Approval
1. **Rebuild containers** (code changes)
2. **Modify configuration** (risk limits, symbols)
3. **Disable symbols** (performance issues)
4. **Database migrations** (schema changes)
5. **Network changes** (UFW, DNS)

---

## Telegram Bot Integration

### Purpose
Provide interface for autopilot to send alerts and receive commands via 3 specialized bots.

### Current Setup (3-Bot Architecture)
- **Bot Tokens:** 3 separate tokens configured in .env
  - TELEGRAM_DATA_BOT_TOKEN (for @vlthr_data_bot)
  - TELEGRAM_TRADING_BOT_TOKEN (for @vlthr_trading_bot)
  - TELEGRAM_DEVOPS_BOT_TOKEN (for @vlthr_devops_bot)
- **Group Chat:** "VLTHR Operations" (single chat with all 3 bots + human)
- **Existing Module:** `data/bybit/workers/telegram_alerts.py` (to be extended)

### Bot Responsibilities
- **@vlthr_data_bot:** Data ingestion alerts, freshness checks, gap detection
- **@vlthr_trading_bot:** Trade events, performance metrics, trading controls
- **@vlthr_devops_bot:** Container health, system errors, configuration changes

### Autopilot-Telegram Workflow
```
Autopilot detects issue
  ↓
Check severity (INFO, WARNING, ERROR, CRITICAL)
  ↓
Determine appropriate bot (data/trading/devops)
  ↓
Format message with context
  ↓
Send via appropriate bot token
  ↓
Log to alerts table
  ↓
Wait for human response (if action required)
```

### Alert Format
```
🚨 <b>VLTHR ALERT — [Category]</b>
<pre>
Time:    [UTC timestamp]
Source:  [component]
Issue:   [description]
Details: [context]
</pre>
```

### Command Format (for human to autopilot)
```
@vlthr_data_bot /freshness
@vlthr_trading_bot /trades
@vlthr_devops_bot /status
```

### Escalation Method
Send CRITICAL alert to @vlthr_devops_bot in "VLTHR Operations" chat with:
- Issue description
- Actions taken
- Current state
- Logs snippet

---

## Quick Reference Commands

### System Status
```bash
# Overall health
docker ps --format "table {{.Names}}\t{{.Status}}" | grep vlthr

# Data freshness
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT symbol, timeframe, NOW() - completed_at as age 
  FROM ingestion_log ORDER BY completed_at DESC LIMIT 5"

# Pipeline status
docker logs --tail 20 f033c3ffa92b_vlthr-pipeline | tail -5
```

### Container Control
```bash
# Restart all VLTHR containers
docker restart $(docker ps -q --filter "name=vlthr")

# Rebuild pipeline
docker compose -f docker-compose.linux.yml up -d --build pipeline

# Kill stuck container
docker inspect <name> --format '{{.State.Pid}}' | xargs sudo kill -9
```

### Database Queries
```bash
# Open trades
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT id, symbol, side, status, entry_price_actual, net_pnl_usd 
  FROM paper_trades WHERE status = 'OPEN'"

# Account balance
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT balance, equity, margin_used, open_risk_pct 
  FROM paper_account ORDER BY id DESC LIMIT 1"

# Recent errors
docker exec vlthr-postgres psql -U postgres -d postgres -c "
  SELECT source, error_msg, created_at 
  FROM error_log ORDER BY created_at DESC LIMIT 5"
```

### Log Streaming
```bash
# Pipeline logs
docker logs --tail 100 -f f033c3ffa92b_vlthr-pipeline

# Ingestion logs
docker logs --tail 100 -f vlthr-data-ingestion

# Backend logs
docker logs --tail 100 -f vlthr-dashboard-backend
```

---

## Contact & Escalation

### When to Escalate
- Container rebuild fails multiple times
- Database corruption suspected
- Network issues persist > 30min
- Trading losses exceed daily limits
- Security breach detected

### Escalation Method
Send CRITICAL alert to DEVOPS chat with:
- Issue description
- Actions taken
- Current state
- Logs snippet

---

## Appendix: Critical Gotchas

1. **safety.log_error() calls conn.rollback()** — In loops, commit after each update
2. **DQS >= 85 = Kelly 0.0 = veto** — Intentional negative edge at high DQS
3. **RISK_TIERS.excellent.max_dqs must be 100** — If 84, DQS 85+ falls to "none" tier
4. **V2 filters should NOT be re-applied during reprice** — Applied once during scan
5. **Trade monitoring is dual-layer** — Dashboard (15s) + Pipeline fallback (15min)
6. **Pipeline code mounted read-only** — Changes require rebuild
7. **UFW blocks Docker traffic** — Check iptables DOCKER-USER chain
8. **Docker stop/kill fails** — Use PID kill workaround
9. **paper_trades has no entry_time column** — Use created_at
10. **VLTHR_ROOT must NOT include v3/** — Path doubling issue
11. **DB equity ≠ true equity** — equity excludes margin_used
12. **DOGEUSDT disabled** — Poor performance (35% win rate)

---

## Version History
- **v1.1** (2026-07-08): Added telegram-notifications Python package reference
- **v1.0** (2026-07-08): Initial autopilot handoff document

---

## Python Package: telegram-notifications

### Overview
The `telegram-notifications` folder contains a complete Python implementation of the ALTHR Autopilot SOS architecture for trading company operations. This package provides a mechanical, fully autonomous system for managing server operations, trading pipeline, database operations, and file management.

### Location
```
backend/telegram-notifications/
```

### Package Structure
```
telegram-notifications/
├── server_operations.py      # Docker container management & health checks
├── pipeline_operations.py    # Trading pipeline management & data ingestion
├── database_operations.py    # PostgreSQL queries, maintenance & validation
├── file_operations.py        # Log management, config files & file system
├── orchestrator.py           # Main SOS orchestrator with 7-layer architecture
└── documentation.html        # Interactive documentation with validation tabs
```

### Quick Start

#### 1. Install Dependencies
```bash
pip install requests
```

#### 2. Configure Paths
Edit each module to set correct paths for your VLTHR installation:
```python
vlthr_root = "/home/savi/Documents/VLTHR linux/VLTHR"
dashboard_root = "/home/savi/Documents/VLTHR linux/VLTHR/paper_trade_unzipped/vlthr-signal-dashboard"
```

#### 3. Validate Individual Modules
```bash
cd backend/telegram-notifications
python server_operations.py
python pipeline_operations.py
python database_operations.py
python file_operations.py
python orchestrator.py
```

Each module includes a `validate_*()` function that returns detailed validation results.

#### 4. Run Orchestrator
```python
from orchestrator import SOSOrchestrator

orchestrator = SOSOrchestrator()

# Get system state
state = orchestrator.get_system_state()
print(state)

# Execute workflow
result = orchestrator.execute_workflow("health_check", {})
print(result)

# Run autonomous loop (for continuous monitoring)
import asyncio
asyncio.run(orchestrator.run_autonomous_loop())
```

### Module Functions

#### Server Operations (`server_operations.py`)
- `check_container_status(container_name)` - Check status of a specific container
- `list_all_containers()` - List all VLTHR containers
- `restart_container(container_name)` - Restart a container
- `stop_container(container_name)` - Stop a container
- `start_container(container_name)` - Start a container
- `get_container_logs(container_name, tail)` - Get recent logs
- `get_system_health()` - Get overall system health metrics
- `rebuild_container(container_name, compose_file)` - Rebuild using docker-compose
- `kill_stuck_container(container_name)` - Force kill stuck container

#### Pipeline Operations (`pipeline_operations.py`)
- `check_pipeline_health()` - Check pipeline health endpoint
- `get_pipeline_status()` - Get current pipeline status
- `get_pipeline_logs(tail)` - Get recent pipeline logs
- `restart_pipeline()` - Restart the pipeline container
- `pause_pipeline()` - Pause pipeline by setting circuit breaker
- `resume_pipeline()` - Resume pipeline by clearing circuit breaker
- `check_data_freshness()` - Check data freshness for all symbols
- `restart_ingestion()` - Restart data ingestion container
- `get_ingestion_logs(tail)` - Get recent ingestion logs
- `check_data_gaps()` - Check for data gaps in ingestion
- `get_active_signals()` - Get current active trading signals
- `get_open_trades()` - Get current open trades

#### Database Operations (`database_operations.py`)
- `check_connection()` - Check database connection
- `get_table_sizes()` - Get size information for all tables
- `get_open_trades()` - Get all open trades
- `get_account_info()` - Get account balance and risk information
- `get_recent_errors(limit)` - Get recent error log entries
- `get_pipeline_trace(limit)` - Get recent pipeline execution trace
- `get_data_freshness()` - Check data freshness from ingestion log
- `close_trade(trade_id, reason)` - Manually close a trade
- `pause_trading()` - Pause trading by setting flag in database
- `resume_trading()` - Resume trading by clearing flag
- `backup_database(backup_path)` - Create database backup
- `vacuum_analyze()` - Run VACUUM ANALYZE for performance
- `get_long_running_queries(threshold_minutes)` - Get long-running queries
- `kill_query(pid)` - Kill a long-running query

#### File Operations (`file_operations.py`)
- `list_directory(path, pattern)` - List files in a directory
- `read_file(path, max_lines)` - Read file contents with line limit
- `write_file(path, content)` - Write content to file
- `append_to_file(path, content)` - Append content to file
- `get_recent_logs(log_dir, tail)` - Get recent log entries
- `search_logs(pattern, log_dir)` - Search for pattern in log files
- `get_config_value(config_file, key)` - Get a specific configuration value
- `set_config_value(config_file, key, value)` - Set a configuration value
- `rotate_logs(log_dir, max_size_mb)` - Rotate log files if they exceed size limit
- `clean_old_logs(log_dir, days_old)` - Clean log files older than specified days
- `get_disk_usage(path)` - Get disk usage for a path
- `backup_file(source_path, backup_dir)` - Create a backup of a file
- `get_file_permissions(path)` - Get file permissions
- `set_file_permissions(path, permissions)` - Set file permissions

#### SOS Orchestrator (`orchestrator.py`)
The orchestrator implements the 7-layer SOS architecture:

**USMS (Unified State Management System)**
- `get_system_state()` - Get complete system state
- Determines overall system state (HEALTHY, WARNING, CRITICAL, RECOVERY, UNKNOWN)

**UEB (Unified Event Bus)**
- `emit_event(event_type, payload, severity)` - Emit events to unified event bus
- Maintains alert history with severity levels

**KSR (Knowledge & Service Registry)**
- `register_service(service_name, service_info)` - Register a service
- `get_service_status(service_name)` - Get service status

**Decision Intelligence Pipeline**
- `analyze_situation()` - Analyze current situation and create decision context
- `make_decision(context)` - Make autonomous decision based on context
- Implements SAF (Security-by-Architecture Framework) checks

**Digital Twin**
- `create_digital_twin_snapshot()` - Create snapshot of current system state
- Saves snapshots to disk for historical analysis

**Walk-Forward Validator**
- `validate_decision(action, context)` - Validate a decision before execution
- SAF checks for all autonomous actions

**Workflow Engine**
- `execute_workflow(workflow_name, params)` - Execute predefined workflows
- Available workflows:
  - `health_check` - Comprehensive system health check
  - `incident_response` - Automated incident response
  - `daily_maintenance` - Daily maintenance tasks
  - `system_recovery` - Full system recovery

### Available Workflows

#### Health Check Workflow
```python
result = orchestrator.execute_workflow("health_check", {})
```
Steps:
1. Check containers
2. Check database
3. Check pipeline
4. Check data freshness

#### Incident Response Workflow
```python
result = orchestrator.execute_workflow("incident_response", {})
```
Steps:
1. Assess situation
2. Make decision
3. Execute actions
4. Verify resolution

#### Daily Maintenance Workflow
```python
result = orchestrator.execute_workflow("daily_maintenance", {})
```
Steps:
1. Rotate logs
2. Clean old logs
3. Vacuum database
4. Create backup

#### System Recovery Workflow
```python
result = orchestrator.execute_workflow("system_recovery", {})
```
Steps:
1. Check all containers
2. Restart stopped containers
3. Restart pipeline
4. Restart ingestion

### Interactive Documentation

Open `documentation.html` in a web browser to access:
- **Documentation Tab**: Complete API reference with function descriptions
- **Workflows Tab**: Step-by-step workflow guides and usage instructions
- **Validation**: Run validation tests for all modules (requires Python environment)

### Integration with VLTHR System

#### Environment Setup
Ensure the following paths are configured in each module:
```python
vlthr_root = "/home/savi/Documents/VLTHR linux/VLTHR"
dashboard_root = "/home/savi/Documents/VLTHR linux/VLTHR/paper_trade_unzipped/vlthr-signal-dashboard"
```

#### Docker Integration
All modules use Docker CLI to interact with containers. Ensure:
- Docker is installed
- User has proper Docker permissions
- Containers are accessible

#### Database Integration
Database operations use `docker exec` to run PostgreSQL commands:
- Database container must be running
- Connection parameters must match your setup
- Default: `vlthr-postgres:5432/postgres/postgres/vlthr_local_pg`

### Validation

Each module includes a validation function that can be run independently:

```bash
# Validate server operations
python server_operations.py

# Validate pipeline operations
python pipeline_operations.py

# Validate database operations
python database_operations.py

# Validate file operations
python file_operations.py

# Validate orchestrator
python orchestrator.py
```

Each validation returns a JSON object with:
- Individual function test results
- Overall validation status (PASSED/PARTIAL/FAILED)
- Error details if any failures

### Autonomous Monitoring

For continuous autonomous monitoring, run the orchestrator loop:

```python
import asyncio
from orchestrator import SOSOrchestrator

orchestrator = SOSOrchestrator()
asyncio.run(orchestrator.run_autonomous_loop())
```

The autonomous loop:
- Analyzes system state every 60 seconds (configurable)
- Makes autonomous decisions when issues detected
- Executes validated actions
- Emits events to unified event bus
- Maintains decision history

### Configuration

Edit the configuration in `orchestrator.py`:

```python
config = {
    "health_check_interval": 60,  # seconds
    "pipeline_check_interval": 300,  # seconds
    "auto_restart_enabled": True,
    "auto_escalation_enabled": True,
    "log_retention_days": 30,
    "backup_enabled": True,
}
```

Thresholds can also be customized:

```python
thresholds = {
    "cpu_warning": 80.0,
    "cpu_critical": 95.0,
    "memory_warning": 85.0,
    "memory_critical": 95.0,
    "disk_warning": 90.0,
    "disk_critical": 95.0,
    "data_stale_warning": 5.0,  # minutes
    "data_stale_critical": 10.0,  # minutes
    "container_restart_max": 3,  # max restarts per hour
}
```

### Usage with Telegram Integration

The Python package can be integrated with the existing Telegram bot system:

```python
from orchestrator import SOSOrchestrator
from telegram_alerts import send_telegram_alert

orchestrator = SOSOrchestrator()

# Get system state and send to Telegram
state = orchestrator.get_system_state()
if state["state"] != "healthy":
    send_telegram_alert(
        chat_id=CHAT_IDS["devops"],
        message=f"⚠️ System State: {state['state'].upper()}\nIssues: {state['issues']}"
    )

# Execute workflow and report result
result = orchestrator.execute_workflow("incident_response", {})
send_telegram_alert(
    chat_id=CHAT_IDS["devops"],
    message=f"🔧 Incident Response: {result['status']}\nSteps: {len(result['steps'])}"
)
```

### Troubleshooting

#### Docker Permission Denied
If you get permission denied errors:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

#### Database Connection Failed
Ensure database container is running:
```bash
docker ps | grep vlthr-postgres
```

#### Container Not Found
Check container names match your setup:
```bash
docker ps --format "table {{.Names}}"
```

#### Import Errors
Ensure you're in the correct directory:
```bash
cd backend/telegram-notifications
python orchestrator.py
```

### Summary

The `telegram-notifications` Python package provides:
- ✅ Complete SOS architecture implementation (7 layers)
- ✅ Autonomous decision-making with SAF validation
- ✅ Predefined workflows for common operations
- ✅ Comprehensive validation for all modules
- ✅ Interactive HTML documentation
- ✅ Integration with existing VLTHR system
- ✅ Telegram bot integration ready
- ✅ Production-ready error handling
- ✅ Configurable thresholds and intervals

This package is designed to be fully mechanical and autonomous, requiring minimal human intervention while maintaining safety through the SAF framework.

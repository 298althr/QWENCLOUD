# Service: Telegram Bot

## Purpose

Mobile-first interface for ALTHR Autopilot. Receives natural language commands, sends approval requests with inline keyboards, and delivers action results. Shares Qwen Conversations API session with the web dashboard for cross-device continuity.

## Key File

| File | Responsibility |
|---|---|
| `backend/src/telegram/bot.js` | Telegram bot with inline keyboards, command handlers, NL forwarding |

## Command Map

| Command | Description |
|---|---|
| `/start` | Initialize session, show capabilities |
| `/status` | Server health summary (inline buttons) |
| `/approve <action_id>` | Approve pending human-in-the-loop action |
| `/reject <action_id>` | Reject pending action (with reason prompt) |
| `/memory` | View recent memory entries (M1-M7) |
| `/security` | Run security scan (RKHunter + Lynis) |
| `/deploy <repo_url>` | Quick deploy shortcut |
| `/containers` | List Docker containers |
| `/logs <type>` | View logs (deploy, build, runtime, server, audit) |
| `/config` | View/edit agent configuration |
| `/analytics` | View DQ scores and performance metrics |
| `/cancel` | Cancel currently executing action |
| **Free text** | Natural language → Qwen parses intent → routes to correct API |

## Inline Keyboards

### Approval Flow

```
Bot sends:
  "Plan: systemctl restart nginx + health check
   Confidence: 82% | Risk: Medium
   Action ID: act_042"

  [✅ Approve]  [❌ Reject]  [📝 Modify]
```

- **Approve** → triggers SAF check → executes action
- **Reject** → logs rejection with reason → action cancelled
- **Modify** → user sends modified instruction → re-plans

## Cross-Device Continuity

```
Telegram session uses conversation_id: conv_abc123
Dashboard session uses same conversation_id: conv_abc123
→ Qwen Conversations API manages shared context
→ User can start on Telegram, continue on dashboard
```

## NL Command Examples

| User sends | Qwen parses | Routed to |
|---|---|---|
| "restart nginx" | `{ intent: "restart_service", service: "nginx" }` | Command Executor |
| "deploy repo X" | `{ intent: "deploy", repo_url: "X" }` | Deployment Pipeline |
| "what's using port 3000?" | `{ intent: "check_port", port: 3000 }` | Port Monitor |
| "scan for rootkits" | `{ intent: "security_scan", tool: "rkhunter" }` | Security Audit |
| "show last 10 errors" | `{ intent: "view_logs", type: "error", limit: 10 }` | Audit Log |
| "free up disk space" | `{ intent: "disk_cleanup" }` | File Manager + Command |
| "backup the database" | `{ intent: "backup_db" }` | Deployment + File |

## Dependencies

- **Inputs from:** User (messages, button taps)
- **Outputs to:** API Gateway (forwards NL messages), User (results, approval requests)
- **External:** Telegram Bot API
- **Shared with:** Web Dashboard (via Qwen Conversations API `conversation_id`)

## Environment Variables

```
TELEGRAM_BOT_TOKEN=your_bot_token
```

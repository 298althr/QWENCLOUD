# Agent Continuity Protocol (ACP)

> **Alternative name:** Project State Handoff (PSH)  
> **Protocol version:** 1.0  
> **Effective date:** 2026-07-03 12:00:00 UTC

## 1. Purpose

The Agent Continuity Protocol (ACP) defines a standardized method for transferring project context from one autonomous agent to another. It ensures that a resuming agent can understand the current state, continue work precisely, and avoid regressions or duplicated effort.

## 2. When to Use ACP

Use ACP whenever:

- A new agent takes over an in-progress repository.
- A long-running session ends and work may resume later.
- Complex context (architecture, decisions, known issues) must survive across sessions.
- The outgoing agent has made significant changes that the next agent must understand.

## 3. Naming

| Element | Name | Abbreviation |
|---|---|---|
| Protocol | Agent Continuity Protocol | ACP |
| Alternative | Project State Handoff | PSH |
| Handoff document | `docs/HANDOFF.md` | — |
| Protocol reference | `docs/ACP-PROTOCOL.md` | — |

## 4. Structure of the Handoff Report

Every `HANDOFF.md` must contain the following sections in this order:

1. **Protocol Metadata** — protocol name, version, date, repository, branch, last commit hash.
2. **Purpose** — one paragraph explaining why the document exists.
3. **Project Identity** — project name, track, status, strategy, license.
4. **Completed Work** — chronological or feature-based summary of all work done.
5. **Current State** — services, environment, validation status, git state.
6. **Architecture Overview** — directory structure, data flow, key files.
7. **Key Decisions & Design Patterns** — models, APIs, security model, deployment strategy.
8. **Known Limitations** — issues, workarounds, and priority.
9. **Next Steps / Backlog** — ordered list of what to do next.
10. **How to Resume Work** — copy-paste commands to get back to a working state.
11. **Methodology for Constructing Handoff Reports** — instructions for the next handoff.
12. **References** — support links, docs, tools.
13. **Sign-Off** — outgoing agent, date, commit hash.

## 5. Methodology for Creating a Handoff

### Step 1: Stabilize the workspace

- Ensure all services are running or note why they are not.
- Fix any failing validation tests before writing the handoff.
- Remove stray files and commit all pending changes.

### Step 0 (for incoming agents): Read external context

Before any implementation, an incoming agent must:

- Read all documents in `SYSTEMS-FRAMEWORKS/` (CRDS, DISC, DQS, DRE, DREV).
- Read `docs/SYSTEMS-SYNTHESIS.md` inside the project.
- Produce a short statement of belief about what the frameworks share, which would most differentiate the project, and whether the current architecture is the right foundation.

This step precedes coding because the frameworks determine the strategic direction.

### Step 2: Gather objective data

Run these commands and record the results:

```powershell
# Repository state
cd "<repository-path>"
git log --oneline | Select-Object -First 15
git status --short
git rev-parse HEAD

# Service state (if applicable)
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Validation status
docker exec -i <backend-container> node tests/day3-validation.js
docker exec -i <backend-container> node tests/day4-validation.js
docker exec -i <backend-container> node tests/day5-validation.js
docker exec -i <backend-container> node tests/day6-validation.js
docker exec -i <backend-container> node tests/day9-validation.js

# Environment keys (record names only, never values)
(Get-Content .env) | ForEach-Object { $_.Split("=")[0] }
```

### Step 3: Summarize completed work

- List features by phase or day.
- Include file names and module names.
- Note any pivots, corrections, or major bug fixes.

### Step 4: Document current state

- Record exact service status and ports.
- Record available environment keys (not values).
- Record validation pass/fail status.
- Record git commit hash and branch.

### Step 5: Capture decisions and limitations

- Why specific libraries, APIs, or architectures were chosen.
- What is intentionally incomplete or deferred.
- What the next agent should not change without discussion.

### Step 6: Write next steps

- Order by priority.
- Link each step to a file or document if possible.
- Identify blockers (e.g., missing credentials).

### Step 7: Provide resume commands

- Include the exact commands to start the project.
- Include commands to run tests.
- Include commands to open the frontend.

### Step 8: Commit and sign off

- Commit the handoff document with a conventional commit message.
- Record the final commit hash in the sign-off section.
- Update the handoff date and time.

## 6. Commit Message Template

```
docs: agent continuity protocol handoff

- Added docs/HANDOFF.md with complete project state.
- Added docs/ACP-PROTOCOL.md with handoff methodology.
- Updated handoff date and commit hash.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
```

## 7. Date and Time Convention

- Use ISO 8601 format: `YYYY-MM-DD HH:MM:SS UTC`
- Example: `2026-07-03 12:00:00 UTC`
- Update the date and time in both `docs/HANDOFF.md` and `docs/ACP-PROTOCOL.md` on every handoff.

## 8. Security Rules

- Never commit secret values.
- Never record API keys, tokens, or passwords in the handoff document.
- Confirm `.env` is in `.gitignore` before committing.
- If credentials are missing, note the key names and mark them as deferred.

## 9. Quality Checklist

Before finalizing a handoff, confirm:

- [ ] The document follows the structure in section 4.
- [ ] All sections are filled, even if briefly.
- [ ] Commands are copy-paste ready.
- [ ] No secrets are exposed.
- [ ] The last commit hash is recorded.
- [ ] The document is committed to the repository.
- [ ] The date and time are updated.

## 10. Sign-Off

| Field | Value |
|---|---|
| Protocol defined by | Devin (AI agent) |
| Date | 2026-07-03 12:00:00 UTC |
| Repository | `C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4` |
| Commit hash | `894dff1` |
| Status | Active |

-- ============================================================
-- ALTHR AUTOPILOT — PostgreSQL Schema for PML + Audit + Auth
-- File: backend/src/db/schema.sql
-- ============================================================

-- Enable pgvector extension (fallback if OpenSearch unavailable)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- PML MEMORY TABLES (7 LAYERS)
-- ============================================================

-- M1: Raw Event Memory — high-frequency logs, short retention
CREATE TABLE IF NOT EXISTS m1_raw_events (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL,          -- 'cpu_spike', 'process_crash', 'port_conflict', etc.
    raw_data    JSONB NOT NULL,                -- raw event payload
    severity    VARCHAR(20) DEFAULT 'info',    -- 'info', 'warning', 'critical'
    resolved    BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_m1_timestamp ON m1_raw_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_m1_event_type ON m1_raw_events(event_type);
CREATE INDEX IF NOT EXISTS idx_m1_unresolved ON m1_raw_events(resolved) WHERE resolved = FALSE;

-- M2: Structured Data Memory — server state snapshots, configs
CREATE TABLE IF NOT EXISTS m2_structured_data (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          VARCHAR(100) NOT NULL,     -- 'server_health', 'process_list', 'port_scan'
    structured_json JSONB NOT NULL,
    server_id       VARCHAR(50) DEFAULT 'default'
);
CREATE INDEX IF NOT EXISTS idx_m2_source ON m2_structured_data(source);
CREATE INDEX IF NOT EXISTS idx_m2_timestamp ON m2_structured_data(timestamp DESC);

-- M3: Operational Memory — SOPs, runbooks, remediation playbooks
CREATE TABLE IF NOT EXISTS m3_operational (
    id            SERIAL PRIMARY KEY,
    sop_name      VARCHAR(200) NOT NULL,
    trigger       VARCHAR(200) NOT NULL,       -- what condition activates this SOP
    steps_json    JSONB NOT NULL,              -- ordered list of steps
    success_count INTEGER DEFAULT 0,
    fail_count    INTEGER DEFAULT 0,
    last_used     TIMESTAMPTZ,
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_generated BOOLEAN DEFAULT FALSE       -- true if agent created this from learning
);
CREATE INDEX IF NOT EXISTS idx_m3_trigger ON m3_operational(trigger);

-- M4: Execution Memory — every action the agent takes
CREATE TABLE IF NOT EXISTS m4_execution (
    id             SERIAL PRIMARY KEY,
    action_id      VARCHAR(50) UNIQUE NOT NULL, -- 'act_001', 'act_002', etc.
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type    VARCHAR(50) NOT NULL,        -- 'command', 'docker_build', 'git_clone', 'security_scan'
    action_detail  TEXT NOT NULL,               -- what was executed
    resource_cost  JSONB,                       -- {cpu_seconds, memory_mb, disk_mb}
    time_cost_ms   INTEGER,                     -- execution time in milliseconds
    result         VARCHAR(20) NOT NULL,        -- 'success', 'failure', 'timeout', 'blocked'
    result_detail  TEXT,
    saf_passed     BOOLEAN NOT NULL,
    human_approved BOOLEAN DEFAULT FALSE,
    approved_by    VARCHAR(100),
    approved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_m4_timestamp ON m4_execution(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_m4_action_type ON m4_execution(action_type);
CREATE INDEX IF NOT EXISTS idx_m4_result ON m4_execution(result);

-- M5: Decision Memory — context, alternatives, confidence, mass, and outcome for each decision
CREATE TABLE IF NOT EXISTS m5_decision (
    id               SERIAL PRIMARY KEY,
    action_id        VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context          TEXT NOT NULL,             -- what was the situation
    alternatives_json JSONB NOT NULL,           -- what other actions were considered
    confidence       DECIMAL(4,3) NOT NULL,     -- 0.000 to 1.000
    dq_score         DECIMAL(5,2),              -- 0 to 100
    decision_mass_json JSONB,                 -- {size, risk, complexity, confidence_modifier, di}
    chosen_action    TEXT NOT NULL,
    reasoning        TEXT,                      -- Qwen thinking mode output
    risk_level       VARCHAR(10) NOT NULL,      -- 'low', 'medium', 'high'
    outcome_result   VARCHAR(20),               -- 'success', 'failure', 'partial', 'unknown'
    outcome_recorded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_m5_confidence ON m5_decision(confidence);
CREATE INDEX IF NOT EXISTS idx_m5_timestamp ON m5_decision(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_m5_outcome ON m5_decision(outcome_result);

-- M6: Learning Memory — errors, drift, improvements (with vector embeddings)
CREATE TABLE IF NOT EXISTS m6_learning (
    id               SERIAL PRIMARY KEY,
    action_id        VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_type       VARCHAR(100),              -- 'misdiagnosis', 'timeout', 'wrong_command'
    drift            DECIMAL(4,3),              -- confidence drift since last similar action
    improvement_note TEXT NOT NULL,             -- what was learned
    pattern_hash     VARCHAR(64),               -- MD5 of normalized pattern for dedup
    embedding        vector(1024),              -- text-embedding-v4 vector for semantic search
    reinforcement_count INTEGER DEFAULT 0       -- how many times this pattern was confirmed
);
CREATE INDEX IF NOT EXISTS idx_m6_error_type ON m6_learning(error_type);
CREATE INDEX IF NOT EXISTS idx_m6_pattern_hash ON m6_learning(pattern_hash);
-- Vector index for semantic search (pgvector)
CREATE INDEX IF NOT EXISTS idx_m6_embedding ON m6_learning USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- M7: Strategic Memory — regime changes, major wins/losses (with vector embeddings)
CREATE TABLE IF NOT EXISTS m7_strategic (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(100) NOT NULL,          -- 'regime_change', 'major_win', 'major_loss', 'policy_update'
    description TEXT NOT NULL,
    impact      VARCHAR(20) NOT NULL,           -- 'positive', 'negative', 'neutral'
    impact_score INTEGER,                       -- -10 to +10
    embedding   vector(1024)
);
CREATE INDEX IF NOT EXISTS idx_m7_event_type ON m7_strategic(event_type);
CREATE INDEX IF NOT EXISTS idx_m7_timestamp ON m7_strategic(timestamp DESC);

-- ============================================================
-- AUDIT LOG — IMMUTABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operation       VARCHAR(20) NOT NULL,       -- 'create', 'read', 'update', 'delete', 'execute', 'block'
    actor           VARCHAR(100) NOT NULL,      -- 'agent', 'human:username', 'system'
    target          TEXT NOT NULL,              -- what was affected
    target_type     VARCHAR(50) NOT NULL,       -- 'memory', 'command', 'file', 'container', 'process'
    reasoning       TEXT,                       -- why this action was taken
    confidence      DECIMAL(4,3),
    saf_result      JSONB,                      -- {l1: 'pass', l2: 'pass', ..., l7: 'pass'}
    result          VARCHAR(20) NOT NULL,
    ip_address      INET
);

-- Trigger: prevent UPDATE and DELETE on audit_log (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_audit_update ON audit_log;
CREATE TRIGGER no_audit_update BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
DROP TRIGGER IF EXISTS no_audit_delete ON audit_log;
CREATE TRIGGER no_audit_delete BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_audit_target_type ON audit_log(target_type);

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    totp_secret     VARCHAR(255),
    role            VARCHAR(20) DEFAULT 'admin', -- 'admin', 'operator', 'viewer'
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    token           VARCHAR(500) UNIQUE NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ============================================================
-- CONVERSATIONS (Qwen Conversations API mapping)
-- ============================================================

CREATE TABLE IF NOT EXISTS qwen_conversations (
    id              SERIAL PRIMARY KEY,
    conversation_id VARCHAR(200) UNIQUE NOT NULL,  -- Qwen conversation ID (first response_id)
    user_id         INTEGER REFERENCES users(id),
    source          VARCHAR(20) NOT NULL,          -- 'telegram', 'dashboard'
    last_response_id VARCHAR(200),                 -- last response_id for previous_response_id chain
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qwen_conv_user ON qwen_conversations(user_id);

-- ============================================================
-- DECISION CALIBRATION — predicted vs actual outcomes
-- ============================================================

CREATE TABLE IF NOT EXISTS decision_calibration (
    id                 SERIAL PRIMARY KEY,
    action_id          VARCHAR(50) UNIQUE NOT NULL REFERENCES m4_execution(action_id),
    predicted_confidence DECIMAL(4,3) NOT NULL,  -- 0.000 to 1.000
    predicted_outcome    VARCHAR(20),             -- 'success', 'failure'
    actual_outcome       VARCHAR(20),             -- 'success', 'failure', 'partial'
    brier_score          DECIMAL(4,3),             -- 0 = perfect, 2 = worst
    calibration_error    DECIMAL(4,3),             -- |predicted - actual|
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calibration_action ON decision_calibration(action_id);
CREATE INDEX IF NOT EXISTS idx_calibration_recorded ON decision_calibration(recorded_at DESC);

-- ============================================================
-- DONE
-- ============================================================

-- ============================================================
-- V4 DECISION INTELLIGENCE TABLES
-- ============================================================

-- DREV Tournament logs — records of pairwise verification runs
CREATE TABLE IF NOT EXISTS drev_tournaments (
    id              SERIAL PRIMARY KEY,
    action_id       VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    candidate_count INTEGER NOT NULL,
    winner_approach VARCHAR(200),
    reserve_approach VARCHAR(200),
    cr              DECIMAL(4,3),               -- AHP consistency ratio
    robustness      DECIMAL(4,3),               -- 1 - flip_rate
    regime          VARCHAR(20),                -- 'normal', 'high-load', 'incident', 'post-deploy'
    degraded        BOOLEAN DEFAULT FALSE,
    cost_comparisons INTEGER,
    cost_api_calls  INTEGER,
    cost_time_ms    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_drev_timestamp ON drev_tournaments(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_drev_regime ON drev_tournaments(regime);

-- CRDS Adaptive Weights — EWMA-updated weights per dimension
CREATE TABLE IF NOT EXISTS crds_weights (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dimension       VARCHAR(50) NOT NULL,       -- 'cpu_disturbance', 'memory_disturbance', etc.
    weight          DECIMAL(6,3) NOT NULL,      -- current EWMA weight
    previous_weight DECIMAL(6,3),               -- prior weight for audit
    action          TEXT,                        -- action that triggered update
    error_magnitude DECIMAL(6,3)                -- |predicted - actual|
);
CREATE INDEX IF NOT EXISTS idx_crds_weights_dim ON crds_weights(dimension);
CREATE INDEX IF NOT EXISTS idx_crds_weights_ts ON crds_weights(timestamp DESC);

-- CRDS Calibration — predicted RRS vs actual health delta
CREATE TABLE IF NOT EXISTS crds_calibration (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action          TEXT NOT NULL,
    predicted_rrs   INTEGER NOT NULL,           -- -100 to +100
    actual_delta    DECIMAL(4,3),               -- -1.0 to +1.0
    brier_score     DECIMAL(4,3),               -- (pred_prob - actual_prob)^2
    vetoed          BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_crds_cal_ts ON crds_calibration(timestamp DESC);

-- DRE Research Logs — records of research sessions
CREATE TABLE IF NOT EXISTS dre_research_logs (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symptom         TEXT NOT NULL,
    candidate_count INTEGER NOT NULL,
    coverage        DECIMAL(4,3),               -- answered/total subquestions
    contradiction_score DECIMAL(4,3),           -- conflicting/total sources
    budget_used     INTEGER,
    budget_max      INTEGER,
    degraded        BOOLEAN DEFAULT FALSE,
    sources_count   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_dre_ts ON dre_research_logs(timestamp DESC);

-- Critique Feedback — 5-dimension grades per decision
CREATE TABLE IF NOT EXISTS critique_feedback (
    id              SERIAL PRIMARY KEY,
    action_id       VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accuracy        INTEGER CHECK (accuracy BETWEEN 1 AND 5),
    timeliness      INTEGER CHECK (timeliness BETWEEN 1 AND 5),
    actionability   INTEGER CHECK (actionability BETWEEN 1 AND 5),
    completeness    INTEGER CHECK (completeness BETWEEN 1 AND 5),
    novelty         INTEGER CHECK (novelty BETWEEN 1 AND 5),
    feedback_grade  DECIMAL(3,2),               -- average of 5 dimensions
    feedback_delta  DECIMAL(4,3),               -- normalized -1 to +1
    dq_score        DECIMAL(5,3),               -- 0 to 1
    inflated        BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_critique_ts ON critique_feedback(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_critique_action ON critique_feedback(action_id);

-- MCP Tool Invocations — audit trail for MCP tool calls
CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tool_name       VARCHAR(100) NOT NULL,
    caller          VARCHAR(100),               -- 'qwen', 'dashboard', 'external'
    success         BOOLEAN NOT NULL,
    latency_ms      INTEGER,
    error_message   TEXT
);
CREATE INDEX IF NOT EXISTS idx_mcp_ts ON mcp_tool_invocations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_tool ON mcp_tool_invocations(tool_name);

-- ============================================================
-- UNIQUE CONSTRAINTS FOR UPSERT SUPPORT
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_m5_action_id'
  ) THEN
    ALTER TABLE m5_decision ADD CONSTRAINT unique_m5_action_id UNIQUE (action_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_m6_pattern_hash'
  ) THEN
    ALTER TABLE m6_learning ADD CONSTRAINT unique_m6_pattern_hash UNIQUE (pattern_hash);
  END IF;
END $$;

-- ============================================================
-- V4 SCHEMA DONE
-- ============================================================

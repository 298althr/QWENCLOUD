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

-- 0014: durable Vedic report runs. A run owns its ordered report steps and artifacts.

ALTER TABLE artifacts ADD COLUMN run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_artifacts_run_created
ON artifacts (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vedic_report_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  birth_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  current_step TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_vedic_report_runs_agent_created
ON vedic_report_runs (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vedic_report_steps (
  run_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  planet TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  artifact_id TEXT,
  error TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  PRIMARY KEY (run_id, step_key)
);

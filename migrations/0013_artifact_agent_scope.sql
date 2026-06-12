-- 0013: scope artifacts to an Agent instance so different browsers cannot see each other's reports

ALTER TABLE artifacts ADD COLUMN agent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_artifacts_agent_created
ON artifacts (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('create_artifact',
   'Create a durable artifact for the workspace panel',
   '{"type":"markdown|html|json","title":"string","description":"string","content":"string"}',
   1);

UPDATE agent_config
SET enabled_tools = '["get_time","start_hello_workflow","create_artifact"]'
WHERE id = 'default';

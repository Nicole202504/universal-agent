-- 0011: move production chat to a clean Durable Object instance after old default history became incompatible

INSERT OR REPLACE INTO agent_config (
  id,
  label,
  system_prompt,
  model,
  enabled_tools,
  enabled_skills,
  schedules,
  mcp_servers
)
SELECT
  'vedic-prod-v2',
  label,
  system_prompt,
  model,
  enabled_tools,
  enabled_skills,
  schedules,
  mcp_servers
FROM agent_config
WHERE id = 'default';

-- 登记 hello 业务的 tools / skills，并配置默认 agent 实例 'default'。
-- 注意：tool/skill 的真实实现在 code（businesses/hello/*）；这里只是启用登记 + 元数据。

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('get_time',             'Get current server time',  '{}',                 1),
  ('start_hello_workflow', 'Start hello workflow',     '{"topic":"string"}', 1),
  ('create_artifact',      'Create workspace artifact','{"type":"markdown|html|json","title":"string","description":"string","content":"string"}', 1);

INSERT OR REPLACE INTO skill_registry (id, description, instructions, tool_ids, workflow) VALUES
  ('hello_demo',
   'Demo: greet a topic, optionally via durable workflow',
   'see businesses/hello/skill.ts',
   '["get_time","start_hello_workflow","create_artifact"]',
   'HELLO_WORKFLOW');

INSERT OR REPLACE INTO agent_config
  (id, label, system_prompt, model, enabled_tools, enabled_skills, schedules, mcp_servers)
VALUES
  ('default',
   'Hello demo agent',
   'You are the universal-agent hello demo. Greet users and demonstrate the dual-track SOP (loop vs durable workflow).',
   'deepseek-v4-pro',
   '["get_time","start_hello_workflow","create_artifact"]',
   '["hello_demo"]',
   NULL, NULL);

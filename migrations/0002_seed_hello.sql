-- 登记 hello 业务的 tools / skills，并配置默认 agent 实例 'default'。
-- 注意：tool/skill 的真实实现在 code（businesses/hello/*）；这里只是启用登记 + 元数据。

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('get_time',             'Get current server time',  '{}',                 1),
  ('start_hello_workflow', 'Start hello workflow',     '{"topic":"string"}', 1),
  ('collect_birth_data',              'Call pysweph: birth data -> real chart', '{}', 1),
  ('generate_validation_statements',  'Generate 5 assertive pre-validation statements (PAID GATEWAY)', '{}', 1),
  ('evaluate_validation',             'Evaluate user validation responses', '{}', 1),
  ('generate_vedic_report',           'Generate final Vedic report', '{}', 1);

INSERT OR REPLACE INTO skill_registry (id, description, instructions, tool_ids, workflow) VALUES
  ('hello_demo',
   'Demo: greet a topic, optionally via durable workflow',
   'see businesses/hello/skill.ts',
   '["get_time","start_hello_workflow"]',
   'HELLO_WORKFLOW'),
  ('vedic_consultation',
   'Vedic consultation: birth data -> time rectification with 5 life events -> full report',
   'see businesses/vedic/skill.ts',
   '["collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]',
   NULL);

INSERT OR REPLACE INTO agent_config
  (id, label, system_prompt, model, enabled_tools, enabled_skills, schedules, mcp_servers)
VALUES
  ('default',
   'Universal Agent (DeepSeek V4 Pro)',
   'You are a universal agent running on Cloudflare. You have access to hello demo tools and Vedic astrology consultation tools. Be helpful, concise, and follow each skill SOP strictly.',
   'deepseek-chat',
   '["get_time","start_hello_workflow","collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]',
   '["hello_demo","vedic_consultation"]',
   NULL, NULL);

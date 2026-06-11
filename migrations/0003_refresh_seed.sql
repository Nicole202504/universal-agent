-- 0003: 重新 seed 数据（vedic 验前事 + deepseek-chat）
DELETE FROM tool_registry;
DELETE FROM skill_registry;
DELETE FROM agent_config;

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('get_time',                          'Get current server time',                            '{}',         1),
  ('start_hello_workflow',              'Start hello workflow',                               '{}',         1),
  ('collect_birth_data',                'Call pysweph: birth data -> real chart',             '{}',         1),
  ('generate_validation_statements',    'Generate 5 assertive pre-validation statements',     '{}',         1),
  ('evaluate_validation',               'Evaluate user validation responses',                 '{}',         1),
  ('generate_vedic_report',             'Generate final Vedic report (API + LLM)',            '{}',         1);

INSERT OR REPLACE INTO skill_registry (id, description, instructions, tool_ids, workflow) VALUES
  ('hello_demo', 'Demo: greet a topic, optionally via durable workflow', 'see businesses/hello/skill.ts', '["get_time","start_hello_workflow"]', 'HELLO_WORKFLOW'),
  ('vedic_consultation', 'Vedic: birth data -> 5 assertive statements -> validation -> full report', 'see businesses/vedic/skill.ts', '["collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]', NULL);

INSERT OR REPLACE INTO agent_config (id, label, system_prompt, model, enabled_tools, enabled_skills, schedules, mcp_servers) VALUES
  ('default', 'Universal Agent', 'You are a universal agent. Follow each skill SOP strictly. For the vedic_consultation skill: you generate 5 ASSERTIVE statements about the user''s life based on chart data — NEVER ask the user to provide life events. User replies 准/不准/部分准 to each.', 'deepseek-chat', '["get_time","start_hello_workflow","collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]', '["hello_demo","vedic_consultation"]', NULL, NULL);

-- 0009: assistant-ui chat components need Agent-visible inline forms and right-side artifacts

CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('create_artifact', 'Create a durable right-side workspace artifact for reports, HTML, or JSON', '{}', 1),
  ('ask_user_form', 'Ask the frontend to render an inline structured form and return the submitted values', '{}', 1);

UPDATE agent_config
SET
  enabled_tools = '["collect_birth_data","generate_validation_statements","evaluate_validation","rectify_birth_time","generate_vedic_report","create_artifact","ask_user_form"]',
  system_prompt = system_prompt || '

## 前端组件协作
- 当出生日期、出生时间、出生地点、性别任一缺失时，必须调用 ask_user_form 收集结构化信息。
- 生成 5 条验前事之后，必须调用 ask_user_form，把 5 条断言作为 radio 题展示，每题选项固定为：是 / 否 / 其他。
- 用户提交验前事表单后，再调用 evaluate_validation。
- 最终完整报告必须先调用 create_artifact，type=markdown，content 放完整报告正文。聊天区只做简短说明，右侧报告产物区展示完整内容。'
WHERE id = 'default';

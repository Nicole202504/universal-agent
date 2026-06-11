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
  ('default', 'Vedic Master', '你是吠陀占星大师（Jyotish Acharya），遵循 KN Rao 学派（Parashari 体系）。你使用 pysweph + PyJHora 真实天文计算引擎，所有星盘数据来自真实计算，不是 LLM 推测。

## 身份
你是印度星盘大师，专业解读吠陀占星本命盘。语气专业、温和、自信。

## 核心工作流（必须遵守）

### 第一步：引导用户输入出生数据
当用户开始对话时，主动引导提供：
- 出生日期（YYYY-MM-DD）
- 出生时间（HH:MM，24小时制）
- 出生地点（城市名）
- 经纬度（可用城市推断：北京 39.9/116.4，上海 31.2/121.5，深圳 22.5/114.1 等）

### 第二步：调用 collect_birth_data 工具
收集到数据后立即调用该工具。工具会通过 pysweph 计算真实星盘。

### 第三步：⚠️ 必须调用 generate_validation_statements（付费触发点）
排盘完成后，**绝对不可以跳过此步骤**。
你必须基于星盘数据，在聊天框中生成 **5条断言式推断**（验前事）：
- 每条是陈述句，不是疑问句
- 用户只需回复：准 / 不准 / 部分准
- 推断类型优先级：父亲/家庭 → 学历 → 搬迁 → 经济 → Dasha时间事件 → Ketu专项
- 禁止问用户问题、禁止让用户填表、禁止说「请提供你的经历」

### 第四步：调用 evaluate_validation
用户回复5条结果后，统计命中率。

### 第五步：调用 generate_vedic_report
验证通过后生成完整九章报告（3000+字）。

## ❌ 绝对禁止
- 禁止跳过 generate_validation_statements
- 禁止在验前事阶段问用户问题
- 禁止编造星盘数据
- 禁止在验证完成前生成报告', 'deepseek-chat', '["get_time","start_hello_workflow","collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]', '["hello_demo","vedic_consultation"]', NULL, NULL);

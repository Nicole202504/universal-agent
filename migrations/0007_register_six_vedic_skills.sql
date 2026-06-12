-- 0007: 注册 6 个 Vedic skills，并收紧一期产品主流程
DELETE FROM agent_config;

INSERT OR REPLACE INTO skill_registry (id, description, instructions, tool_ids, workflow) VALUES
  ('vedic-reader', 'Vedic chart intake router: birth data -> calculator -> validation -> report', 'see businesses/vedic/skills.ts', '["collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]', NULL),
  ('vedic-calculator', 'Calculate a complete Vedic chart from birth data using pysweph/PyJHora', 'see businesses/vedic/skills.ts', '["collect_birth_data","generate_validation_statements"]', NULL),
  ('vedic-rectifier', 'Birth time rectification from five major dated life events', 'see businesses/vedic/skills.ts', '["rectify_birth_time"]', NULL),
  ('vedic-core', 'Full Vedic core analysis and comprehensive report generation', 'see businesses/vedic/skills.ts', '["generate_vedic_report"]', NULL),
  ('vedic-career', 'Career direction and timing analysis from a calculated Vedic chart', 'see businesses/vedic/skills.ts', '["generate_vedic_report"]', NULL),
  ('vedic-love', 'Relationship pattern and love timing analysis from a calculated Vedic chart', 'see businesses/vedic/skills.ts', '["generate_vedic_report"]', NULL);

INSERT OR REPLACE INTO tool_registry (id, description, input_schema, enabled) VALUES
  ('collect_birth_data', 'Call Vedic calculator: birth data -> real chart and validation signals', '{}', 1),
  ('generate_validation_statements', 'Generate 5 yes/no pre-validation assertions for the paid gateway', '{}', 1),
  ('evaluate_validation', 'Evaluate yes/no validation responses and decide report vs rectification', '{}', 1),
  ('rectify_birth_time', 'Run Vedic birth-time rectification from dated life events', '{}', 1),
  ('generate_vedic_report', 'Generate full Vedic report using vedic-core structure', '{}', 1);

INSERT OR REPLACE INTO agent_config (id, label, system_prompt, model, enabled_tools, enabled_skills, schedules, mcp_servers) VALUES
  ('default', 'Vedic Master',
   '你是吠陀占星大师（Jyotish Acharya），遵循 KN Rao 学派（Parashari 体系）。你使用 pysweph + PyJHora 真实计算引擎，所有星盘数据来自工具返回，不可编造。

## 一期产品主流程（必须遵守）
1. 用户第一轮只会提供出生日期、出生时间、出生地点/经纬度。不要展开闲聊。
2. 出生信息齐全后，必须先调用 get_skill_instructions("vedic-reader")，然后调用 collect_birth_data。
3. 排盘完成后，必须调用 get_skill_instructions("vedic-calculator")，再调用 generate_validation_statements。
4. 验前事必须默认输出 5 条；每条都是可选择的「是 / 否」判断题，不是开放问题。
5. 在用户完成 5 条选择之前，禁止生成完整报告。
6. 用户选择完成后，调用 evaluate_validation。
7. 命中率通过后，必须调用 get_skill_instructions("vedic-core")，再调用 generate_vedic_report，输出全面报告。

## 验前事规则
- 你生成断言，用户只选择是/否。
- 禁止问「请提供5个事件」「哪年发生过什么」。
- 禁止输出性格套话、健康恐吓、身体标记、疾病预测。
- 优先使用父亲/家庭、学历、搬迁、经济、Dasha 时间窗口、Ketu 落宫等高命中信号。
- 不准时直接接受，不辩解。

## Skill 路由
- 出生数据/排盘/看盘：vedic-reader + vedic-calculator。
- 验前事通过后的完整报告：vedic-core。
- 验前事明显失败或用户要求校准：vedic-rectifier。
- 职业专项、感情专项仅在完整报告后或用户明确提出时使用 vedic-career / vedic-love；不得打断一期主流程。',
   'deepseek-chat',
   '["collect_birth_data","generate_validation_statements","evaluate_validation","rectify_birth_time","generate_vedic_report"]',
   '["vedic-reader","vedic-calculator","vedic-rectifier","vedic-core","vedic-career","vedic-love"]',
   NULL,
   NULL);

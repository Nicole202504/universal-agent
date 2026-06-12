-- 0006: 强化验前事逻辑（vedic-reader 核心规则烧入 system prompt）
DELETE FROM agent_config;

INSERT OR REPLACE INTO agent_config (id, label, system_prompt, model, enabled_tools, enabled_skills, schedules, mcp_servers) VALUES
  ('default', 'Vedic Master',
   '你是吠陀占星大师，使用 pysweph 真实计算。遵守 vedic_consultation skill。验前事环节**绝对不向用户提问**——你生成 5 条断言，用户回 准/不准。排盘完成立刻出断言，不等、不省略、不让用户填表。信号不够就出 3-4 条不硬凑。不准时直接接受不辩解。命中≥4/5 进报告，≤2/5 建议校准。',
   'deepseek-chat',
   '["get_time","start_hello_workflow","collect_birth_data","generate_validation_statements","evaluate_validation","generate_vedic_report"]',
   '["hello_demo","vedic_consultation"]', NULL, NULL);

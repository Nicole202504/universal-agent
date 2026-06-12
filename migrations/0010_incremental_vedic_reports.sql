-- 0010: split paid Vedic reports into incremental artifacts to reduce user wait time

UPDATE agent_config
SET system_prompt = system_prompt || '

## 付费完整报告：分段产物模式
- 验前事通过后，禁止一次性生成一篇超长报告让用户干等。
- 必须先依次调用 get_skill_instructions("vedic-core")、get_skill_instructions("vedic-career")、get_skill_instructions("vedic-love")。
- 然后按以下顺序逐段调用 generate_vedic_report，并且每一段生成完必须立即调用 create_artifact，让右侧报告产物区马上出现内容：
  1. section=planet_audit, planet=sun，产物标题：太阳行星审计
  2. section=planet_audit, planet=moon，产物标题：月亮行星审计
  3. section=planet_audit, planet=mars，产物标题：火星行星审计
  4. section=planet_audit, planet=mercury，产物标题：水星行星审计
  5. section=planet_audit, planet=jupiter，产物标题：木星行星审计
  6. section=planet_audit, planet=venus，产物标题：金星行星审计
  7. section=planet_audit, planet=saturn，产物标题：土星行星审计
  8. section=planet_audit, planet=rahu，产物标题：Rahu 行星审计
  9. section=planet_audit, planet=ketu，产物标题：Ketu 行星审计
  10. section=houses，产物标题：十二宫逐宫诊断
  11. section=divisional，产物标题：D9/D10/D4/D5 分盘交叉分析
  12. section=career，产物标题：职业专项报告
  13. section=love，产物标题：感情专项报告
  14. section=dasha，产物标题：Dasha 时间线与未来窗口
  15. section=final_summary，产物标题：吠陀占星完整分析报告
- 每个行星审计都必须覆盖 P1-P12。聊天区只发短进度，不要把完整正文塞在聊天区。'
WHERE id = 'default';

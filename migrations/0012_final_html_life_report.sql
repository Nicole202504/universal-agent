-- 0012: require the final Vedic deliverable to be a user-facing HTML life report

UPDATE agent_config
SET system_prompt = system_prompt || '

## 最终交付物：完整人生报告 HTML
- 分段行星审计仍然要生成，但它们是分析材料，不是最终用户体验。
- 最后一步必须调用 generate_vedic_report，参数 section=final_html。
- final_html 返回后，必须调用 create_artifact：
  - type=html
  - title=完整人生报告
  - description=整体人生画像与未来节奏
- 最终 HTML 总报告必须是一个完整 standalone HTML document。
- HTML 总报告必须分两大块：
  1. 整体人生画像：人生主线、底层性格、过去验证、未来 3-5 年节奏、人生 K 线图/时间轴。
  2. 通俗人生板块：把行星审计重写成用户能懂的自我、情绪、思维、成长、爱情、压力、突破、放下、事业、财富、家庭、迁移、行动建议等章节。
- 不能复制粘贴 P1-P12 行星审计作为最终报告。P1-P12 只能作为证据层，最终要翻译成人话。
- 最终报告中专业术语要少；必须先说用户能理解的结论，再放简短技术依据。
- 完整 HTML 总报告出现后，它就是默认展示的最终产物。'
WHERE id IN ('default', 'vedic-prod-v2');

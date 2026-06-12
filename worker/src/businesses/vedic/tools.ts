import { z } from "zod";
import type { ToolDef } from "../../harness/contracts/tool";

// ── vedic 业务工具 — 验前事流程（系统生成推断 → 用户验证）──
//
//   正确流程：
//     1. 用户给出生数据 → API 排盘
//     2. 系统基于星盘生成 5 条断言式验前事推断
//     3. 用户逐条选择「是/否」（兼容 准/不准）
//     4. 命中率高（≥4/5）→ 信任建立 → 付费生成报告
//     5. 命中率低（≤2/5）→ 建议时间校准
//
//   Python API: POST /api/prevalidate  — 排盘 + 生成验前事
//               POST /api/full-report — 生成完整报告数据
//               POST /api/rectify     — 时间校准

const API_BASE = "http://localhost:8900";

async function apiCall(path: string, body: Record<string, unknown>, env?: { VEDIC_API_URL?: string }): Promise<Record<string, unknown>> {
  const base = env?.VEDIC_API_URL || API_BASE;
  const res = await fetch(`${base}${path}`, {

    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vedic API ${path} 返回 ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export const vedicTools: ToolDef[] = [
  // Tool 1: 接收出生数据 + 调 API 排盘
  {
    id: "collect_birth_data",
    description:
      "Collect birth data and call the Vedic calculation engine. Returns real chart data including Lagna, Dasha timeline, and planetary positions.",
    inputSchema: z.object({
      birth_date: z.string().describe("Birth date YYYY-MM-DD, e.g. '1999-04-08'"),
      birth_time: z.string().describe("Birth time HH:MM 24h, e.g. '21:21'"),
      birth_place: z.string().describe("City, Country, e.g. 'Fuzhou, China'"),
      latitude: z.number().describe("Latitude, e.g. 26.07 for Fuzhou"),
      longitude: z.number().describe("Longitude, e.g. 119.3 for Fuzhou"),
      gender: z.string().optional().describe("male / female"),
    }),
    run: async (_ctx, args) => {
      const [year, month, day] = String(args.birth_date).split("-").map(Number);
      const [hour, minute] = String(args.birth_time).split(":").map(Number);

      const result = await apiCall("/api/prevalidate", {
        year, month, day, hour, minute,
        lat: Number(args.latitude),
        lon: Number(args.longitude),
        tz_str: "Asia/Shanghai",
      }, _ctx.env);

      return {
        status: "chart_calculated",
        lagna: result.lagna,
        moon_sign: result.moon_sign,
        sun_sign: result.sun_sign,
        sav_total: result.sav_total,
        current_dasha: result.current_dasha,
        house_lords: result.house_lords,
        all_dashas: result.all_dashas,
        // ⚠️ 关键：这里包含 chart 的全部预分析数据（尊贵度、相位、Ketu位置、燃烧等）
        // LLM 需要基于这些数据自己生成 5 条验前事推断
        chart_data_for_llm: result.chart_data_for_llm,
        next_step:
          "⚠️ REQUIRED: Now call generate_validation_statements. " +
          "Use chart_data_for_llm to craft 5 assertive yes/no validation statements. " +
          "This is the trust-building / paid gateway step. Do not write the full report yet.",
      };
    },
  },

  // Tool 2: 【付费触发点】验前事 — 生成 5 条断言式推断
  {
    id: "generate_validation_statements",
    description:
      "CRITICAL: Generate 5 assertive pre-validation statements based on chart analysis. " +
      "These are NOT open questions — they are confident assertions about the user's life " +
      "that the user can instantly verify by choosing yes or no. " +
      "This step builds trust and serves as the paid consultation gateway.",
    inputSchema: z.object({
      lagna_sign: z.string().describe("Ascendant sign, e.g. 'Scorpio'"),
      moon_sign: z.string().describe("Moon sign"),
      gender: z.string().optional().describe("male / female"),
      chart_data_hint: z.string().describe("Key chart signals to base statements on"),
    }),
    mutating: true,
    run: async (_ctx, args) => ({
      status: "prepare_validation",
      context: `上升: ${args.lagna_sign}, 月亮: ${args.moon_sign}`,
      instruction: [
        "⚠️ 立即在聊天框输出5条断言式验前事。禁止提问！禁止让用户填表！禁止生成报告！",
        "每条必须是用户可直接选择「是 / 否」的判断题。",
        "目标是高命中付费闸口：宁可少用弱信号，也不要写泛泛性格判断。",
        "",
        "输出格式（严格照抄）：",
        "```",
        "在进入完整分析之前，先验证几个时间锚点——",
        "",
        "**1.** [一句具体陈述。例：您离开过家乡，目前不在出生地长期生活。]",
        "> 推导：[行星+宫位+状态]",
        "> 请选择：是 / 否",
        "",
        "**2.** [一句具体陈述。例：您的学业过程中有过一段明显吃力或转向阶段。]",
        "> 推导：[行星+宫位+状态]",
        "> 请选择：是 / 否",
        "",
        "**3.** 在 20XX-20XX 年期间，您[具体事件]。",
        "> 推导：[小运行星+宫主+窗口]",
        "> 请选择：是 / 否",
        "",
        "**4.** [一句陈述式推断。]",
        "> 推导：[来源]",
        "> 请选择：是 / 否",
        "",
        "**5.** [一句陈述式推断。]",
        "> 推导：[来源]",
        "> 请选择：是 / 否",
        "",
        "请逐条选择：**是 / 否**",
        "```",
        "禁止做的事：不说「请提供」、不说「您哪年」、不输出表格、不写开放题、不写心理性格套话。",
        "强信号优先级：Sun+9宫（父亲/权威）、4宫主+Rahu/12宫（搬迁）、5宫主+Jupiter（学历）、2宫SAV+Saturn（经济）、Ketu落宫、Antardasha窗口。",
        "必须输出5条。只有在数据明显不足时才输出4条，并说明「第5条信号不足，暂不硬凑」。",
      ].join("\n"),
    }),
  },

  // Tool 3: 评估验前事结果
  {
    id: "evaluate_validation",
    description:
      "Evaluate the user's validation responses. Count hits/misses and determine next step: " +
      "high accuracy (≥4/5) → proceed to full report; low accuracy (≤2/5) → suggest rectifier.",
    inputSchema: z.object({
      responses: z.array(z.object({
        statement: z.string().describe("The statement number"),
        result: z.string().describe("User response: 是 / 否 / 准 / 不准"),
      })).describe("User's 5 responses"),
    }),
    mutating: true,
    run: async (_ctx, args) => {
      const responses = args.responses as Array<{ result: string }>;
      const total = responses.length;
      const normalize = (value: string) => value.trim().toLowerCase();
      const hits = responses.filter((r) => ["是", "准", "yes", "y", "true"].includes(normalize(r.result))).length;
      const partial = responses.filter((r) => ["部分准", "不确定", "partial"].includes(normalize(r.result))).length;
      const misses = responses.filter((r) => ["否", "不准", "no", "n", "false"].includes(normalize(r.result))).length;
      const hitRate = hits / Math.max(total, 1);

      let decision: string;
      if (hitRate >= 0.8) {
        decision = "✅ 时间验证通过。出生时间精度可靠，进入完整分析。";
      } else if (hitRate >= 0.5) {
        decision = "⚠️ 大部分确认，标注精度后进入分析。";
      } else {
        decision = "⚠️ 命中率偏低，建议进行时间校准后再分析。";
      }

      return {
        status: "validation_complete",
        total, hits, partial, misses,
        hit_rate: `${hits}/${total}`,
        decision,
        next_step: hitRate >= 0.5
          ? "Now call generate_vedic_report to produce the full report."
          : "Suggest user to run time rectification with the vedic-rectifier skill.",
      };
    },
  },

  // Tool 4: 时间校准（验前事命中低时才用）
  {
    id: "rectify_birth_time",
    description:
      "Run Vedic birth-time rectification from 5 major dated life events. Use only after weak validation or explicit rectification request.",
    inputSchema: z.object({
      birth_date: z.string().describe("Original birth date YYYY-MM-DD"),
      birth_time: z.string().describe("Original birth time HH:MM"),
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      events: z.array(z.object({
        date: z.string().describe("Event date, preferably YYYY-MM or YYYY-MM-DD"),
        event: z.string().describe("Major life event description"),
        category: z.string().describe("marriage/death/career/disaster/wealth/education/relocation/health"),
      })).describe("Five major life events for rectification"),
    }),
    mutating: true,
    run: async (_ctx, args) => {
      const [year, month, day] = String(args.birth_date).split("-").map(Number);
      const [hour, minute] = String(args.birth_time).split(":").map(Number);

      const result = await apiCall("/api/rectify", {
        year, month, day, hour, minute,
        lat: Number(args.latitude),
        lon: Number(args.longitude),
        tz_str: "Asia/Shanghai",
        events: args.events,
      }, _ctx.env);

      return {
        status: "rectification_complete",
        result,
        instruction:
          "Explain the rectification result. If match_rate is strong, confirm the original time. If weak, recommend a correction workflow before final analysis.",
      };
    },
  },

  // Tool 5: 生成完整星盘报告（调用 /api/full-report 拿全量数据）
  {
    id: "generate_vedic_report",
    description:
      "Call the API to get full chart data, then generate a LONG, DETAILED 9-section Vedic report. " +
      "Must be 3000+ words covering all planets, houses, dashas, yogas, and life areas.",
    inputSchema: z.object({
      birth_date: z.string().describe("Original birth date YYYY-MM-DD"),
      birth_time: z.string().describe("Original birth time HH:MM"),
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      validation_result: z.string().optional().describe("Pre-validation result text"),
    }),
    mutating: true,
    run: async (_ctx, args) => {
      const [year, month, day] = String(args.birth_date).split("-").map(Number);
      const [hour, minute] = String(args.birth_time).split(":").map(Number);

      const result = await apiCall("/api/full-report", {
        year, month, day, hour, minute,
        lat: Number(args.latitude),
        lon: Number(args.longitude),
        tz_str: "Asia/Shanghai",
      }, _ctx.env);

      return {
        status: "full_data_ready",
        chart: result,
        instruction: [
          "⚠️ 生成一份**完整、长篇**的吠陀占星报告（Markdown）。",
          "这是用户通过验前事后的完整产品，不是简短总结。",
          "必须按 vedic-core 逻辑写：先人话解释，再给证据。不要只罗列参数。",
          "输出比例：70%通俗解读 + 20%数据表格 + 10%技术注释。",
          "",
          "# 吠陀占星完整分析报告",
          "",
          "## 一、验前事验证结果",
          "- 列出5条推断及反馈",
          "- 标注时间精度",
          "",
          "## 二、本命盘基础信息",
          "- Lagna、Moon、Sun、Nakshatra",
          "- SAV=337 确认数学正确",
          "",
          "## 三、九大行星逐一深度分析",
          "每颗行星至少2段：落宫/星座/Nakshatra/尊贵度/P1角色/相位/燃烧或逆行/人生影响",
          "",
          "## 四、十二宫位全覆盖诊断",
          "1-12宫逐宫：宫主+行星+SAV+当前Dasha影响。每宫都要有白话解释。",
          "",
          "## 五、Dasha 大运完整时间线",
          "当前大运/小运 + 未来3年切换表 + 历史事件验证",
          "",
          "## 六、关键 Yoga 格局",
          "Raja/Dhana/Dharma-Karma Yoga 等",
          "",
          "## 七、十大人生板块总结",
          "1人格 2财富 3事业 4感情 5健康 6学业 7家庭 8社交 9灵性 10赛道优势",
          "",
          "## 八、时间窗口与行动建议",
          "短期/中期/长期",
          "",
          "## 九、技术附录 + 免责声明",
          "- Dasha速查表 / 尊贵度总表 / SAV分布",
          "- 「基于pysweph+PyJHora真实计算，仅供个人参考」",
          "",
          "⚠️ 硬性要求：总长至少5000字。每个章节都必须展开，不允许用一句话带过。",
          "使用Markdown表格、加粗、列表等格式增强可读性。不确定处标注「待核实」。",
        ].join("\n"),
      };
    },
  },
];

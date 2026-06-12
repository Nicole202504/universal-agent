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
const PLANETS = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"] as const;
const REPORT_SECTIONS = [
  "full",
  "planet_audit",
  "houses",
  "divisional",
  "career",
  "love",
  "dasha",
  "final_summary",
] as const;

const PLANET_LABELS: Record<(typeof PLANETS)[number], string> = {
  sun: "太阳",
  moon: "月亮",
  mars: "火星",
  mercury: "水星",
  jupiter: "木星",
  venus: "金星",
  saturn: "土星",
  rahu: "Rahu",
  ketu: "Ketu",
};

function buildReportInstruction(section: string, planet?: string): string {
  if (section === "planet_audit") {
    const label = PLANET_LABELS[planet as keyof typeof PLANET_LABELS] ?? planet ?? "指定行星";
    return [
      `⚠️ 只生成「${label}行星审计」这一份 Markdown 子报告。`,
      "不要等待其他行星，不要合并总报告。",
      "完成这一颗行星后，必须立即调用 create_artifact：",
      `- type=markdown`,
      `- title="${label}行星审计"`,
      `- description="P1-P12 行星审计"`,
      "- content=完整 Markdown 子报告",
      "",
      "子报告结构：",
      `# ${label}行星审计`,
      "## 1. 一句话总断",
      "## 2. 基础落点：星座 / 宫位 / Nakshatra / 度数",
      "## 3. P1-P12 审计",
      "必须覆盖 P1-P12，每一项至少 2-4 句，不能只列标题。",
      "## 4. 与宫主、相位、燃烧/逆行/尊贵度的交叉证据",
      "## 5. 对人格、家庭、事业、感情、财富、精神性的具体影响",
      "## 6. 当前 Dasha/Antardasha 如何激活这颗行星",
      "## 7. 可验证事件与未来窗口",
      "",
      "写作要求：像付费交付物，先讲人话，再给证据。不要短答。",
    ].join("\n");
  }

  if (section === "houses") {
    return [
      "⚠️ 只生成「十二宫逐宫诊断」Markdown 子报告，完成后立即 create_artifact。",
      'artifact title="十二宫逐宫诊断", type=markdown。',
      "必须覆盖 1-12 宫：每宫写宫主、落宫、宫内行星、SAV/强弱、人生表现、时间触发。",
    ].join("\n");
  }

  if (section === "divisional") {
    return [
      "⚠️ 只生成「分盘交叉分析」Markdown 子报告，完成后立即 create_artifact。",
      'artifact title="D9/D10/D4/D5 分盘交叉分析", type=markdown。',
      "重点：D9 婚姻与内在 dharma，D10 职业，D4 居住/资产，D5 才华/创造/子女。没有的数据必须标注 unavailable，不可编造。",
    ].join("\n");
  }

  if (section === "career") {
    return [
      "⚠️ 只生成「职业专项报告」Markdown 子报告，完成后立即 create_artifact。",
      'artifact title="职业专项报告", type=markdown。',
      "必须使用 vedic-career 逻辑：10宫、10宫主、AmK、D10、Saturn、Mercury、Sun、2/6/10/11宫、Dasha 时间窗口。",
      "输出：职业底层驱动力、适合赛道、不适合赛道、赚钱模式、组织/创业倾向、未来3年窗口。",
    ].join("\n");
  }

  if (section === "love") {
    return [
      "⚠️ 只生成「感情专项报告」Markdown 子报告，完成后立即 create_artifact。",
      'artifact title="感情专项报告", type=markdown。',
      "必须使用 vedic-love 逻辑：5宫、7宫、Venus、Jupiter、DK/PK、UL、D9、感情 Dasha 窗口。",
      "输出：恋爱模式、伴侣画像、关系课题、适合关系节奏、未来时间窗口。",
    ].join("\n");
  }

  if (section === "dasha") {
    return [
      "⚠️ 只生成「Dasha 时间线与未来窗口」Markdown 子报告，完成后立即 create_artifact。",
      'artifact title="Dasha 时间线与未来窗口", type=markdown。',
      "必须包含：当前大运/小运解释、历史验证、未来3年逐段窗口、行动建议。",
    ].join("\n");
  }

  if (section === "final_summary") {
    return [
      "⚠️ 生成最终「吠陀占星完整分析报告」总汇总 Markdown，并立即 create_artifact。",
      'artifact title="吠陀占星完整分析报告", type=markdown。',
      "这个总报告要整合前面已生成的各个子报告，不要重新拖很久写九颗行星全文；用摘要+关键证据+结论承接。",
      "必须包含：验前事结果、本命盘基础、九大行星摘要、十二宫摘要、分盘、职业、感情、Dasha、行动建议、技术附录。",
    ].join("\n");
  }

  return [
    "⚠️ 生成完整报告时必须采用分段产物模式，不要一次性等待超长报告。",
    "推荐顺序：九颗行星逐颗 planet_audit -> houses -> divisional -> career -> love -> dasha -> final_summary。",
    "每完成一个模块必须立即调用 create_artifact，让右侧产物区即时展示。",
  ].join("\n");
}

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
      timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Shanghai"),
      gender: z.string().optional().describe("male / female"),
    }),
    run: async (_ctx, args) => {
      const [year, month, day] = String(args.birth_date).split("-").map(Number);
      const [hour, minute] = String(args.birth_time).split(":").map(Number);

      const result = await apiCall("/api/prevalidate", {
        year, month, day, hour, minute,
        lat: Number(args.latitude),
        lon: Number(args.longitude),
        tz_str: String(args.timezone || "Asia/Shanghai"),
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
          ? "Now produce the report in incremental artifacts. Call generate_vedic_report repeatedly: planet_audit for sun, moon, mars, mercury, jupiter, venus, saturn, rahu, ketu; then houses, divisional, career, love, dasha, and final_summary. After each tool result, call create_artifact immediately."
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
      timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Shanghai"),
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
        tz_str: String(args.timezone || "Asia/Shanghai"),
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
      "Call the API to get full chart data for a Vedic report section. " +
      "Use section=planet_audit with one planet at a time for incremental report artifacts, then houses/divisional/career/love/dasha/final_summary.",
    inputSchema: z.object({
      birth_date: z.string().describe("Original birth date YYYY-MM-DD"),
      birth_time: z.string().describe("Original birth time HH:MM"),
      latitude: z.number().describe("Latitude"),
      longitude: z.number().describe("Longitude"),
      timezone: z.string().optional().describe("IANA timezone, e.g. Asia/Shanghai"),
      validation_result: z.string().optional().describe("Pre-validation result text"),
      section: z.enum(REPORT_SECTIONS).optional().describe(
        "Report section to generate. Use planet_audit for one planet at a time; then houses, divisional, career, love, dasha, final_summary.",
      ),
      planet: z.enum(PLANETS).optional().describe("Required when section=planet_audit"),
    }),
    mutating: true,
    run: async (_ctx, args) => {
      const [year, month, day] = String(args.birth_date).split("-").map(Number);
      const [hour, minute] = String(args.birth_time).split(":").map(Number);

      const result = await apiCall("/api/full-report", {
        year, month, day, hour, minute,
        lat: Number(args.latitude),
        lon: Number(args.longitude),
        tz_str: String(args.timezone || "Asia/Shanghai"),
      }, _ctx.env);

      const section = String(args.section || "full");
      const planet = args.planet == null ? undefined : String(args.planet);

      return {
        status: "report_section_data_ready",
        section,
        planet,
        chart: result,
        instruction: buildReportInstruction(section, planet),
      };
    },
  },
];

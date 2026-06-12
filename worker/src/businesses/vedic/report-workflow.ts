import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../../types";
import { runBackgroundAgentStep } from "../../harness/background-step";

type BirthPayload = {
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  gender?: string;
};

type ValidationItem = {
  id: number;
  assertion: string;
  evidence: string;
  area: string;
};

type ValidationResponse = {
  id: number;
  answer: "yes" | "no" | "other";
  note?: string;
};

export type VedicReportParams = {
  runId: string;
  agentId: string;
  birth: BirthPayload;
  validationItems: ValidationItem[];
  responses: ValidationResponse[];
};

type ReportStep = {
  key: string;
  title: string;
  section: string;
  planet?: string;
  type: "markdown" | "html";
  skillIds: string[];
};

const REPORT_STEPS: ReportStep[] = [
  { key: "planet_sun", title: "太阳行星审计", section: "planet_audit", planet: "sun", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_moon", title: "月亮行星审计", section: "planet_audit", planet: "moon", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_mars", title: "火星行星审计", section: "planet_audit", planet: "mars", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_mercury", title: "水星行星审计", section: "planet_audit", planet: "mercury", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_jupiter", title: "木星行星审计", section: "planet_audit", planet: "jupiter", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_venus", title: "金星行星审计", section: "planet_audit", planet: "venus", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_saturn", title: "土星行星审计", section: "planet_audit", planet: "saturn", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_rahu", title: "Rahu 行星审计", section: "planet_audit", planet: "rahu", type: "markdown", skillIds: ["vedic-core"] },
  { key: "planet_ketu", title: "Ketu 行星审计", section: "planet_audit", planet: "ketu", type: "markdown", skillIds: ["vedic-core"] },
  { key: "houses", title: "十二宫逐宫诊断", section: "houses", type: "markdown", skillIds: ["vedic-core"] },
  { key: "divisional", title: "D9/D10/D4/D5 分盘交叉分析", section: "divisional", type: "markdown", skillIds: ["vedic-core"] },
  { key: "career", title: "职业专项报告", section: "career", type: "markdown", skillIds: ["vedic-career"] },
  { key: "love", title: "感情专项报告", section: "love", type: "markdown", skillIds: ["vedic-love"] },
  { key: "dasha", title: "Dasha 时间线与未来窗口", section: "dasha", type: "markdown", skillIds: ["vedic-core"] },
  { key: "final_html", title: "完整人生报告", section: "final_html", type: "html", skillIds: ["vedic-core", "vedic-career", "vedic-love"] },
];

const PLANET_LABELS: Record<string, string> = {
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

function buildSkillRules(step: ReportStep): string {
  const skillLine = step.skillIds.join(" + ");
  if (step.section === "planet_audit") {
    const label = PLANET_LABELS[step.planet || ""] || step.planet || "指定行星";
    return [
      `已加载 skill: ${skillLine}。`,
      `只生成「${label}行星审计」，不要生成其他模块。`,
      "必须按 P1-P12 审计框架展开：功能角色、宫主身份、落宫、尊贵度、力量、相位、燃烧/逆行、D9兑现、Dasha触发、正反双审、人生表达、行动建议。",
      "语言比例：70%用户能懂的人话，20%数据证据，10%技术注释。",
      "如果星盘数据缺少某个字段，明确写“数据未返回”，不要编造。",
    ].join("\n");
  }
  if (step.section === "houses") {
    return [
      `已加载 skill: ${skillLine}。`,
      "只生成十二宫逐宫诊断。每一宫说明：主题、宫主、宫内星、SAV/BAV可用信号、吉凶混合判断、现实表达、建议。",
      "避免玄学术语堆叠，先说这对用户生活意味着什么。",
    ].join("\n");
  }
  if (step.section === "divisional") {
    return [
      `已加载 skill: ${skillLine}。`,
      "只生成 D9/D10/D4/D5 分盘交叉分析。说明每个分盘代表什么、能否启用、如何修正 D1 结论。",
      "重点把分盘结果翻译成婚姻/事业/资产/创造力等现实语言。",
    ].join("\n");
  }
  if (step.section === "career") {
    return [
      `已加载 skill: ${skillLine}。`,
      "只生成职业专项报告。重点分析10宫、10宫主、AmK、D10、Saturn/Mercury/Sun、收入宫和Dasha窗口。",
      "输出职业画像、适合赛道、变现方式、未来3年事业窗口、风险和行动建议。",
    ].join("\n");
  }
  if (step.section === "love") {
    return [
      `已加载 skill: ${skillLine}。`,
      "只生成感情专项报告。重点分析5宫、7宫、Venus/Jupiter、DK/PK、UL、D9和感情Dasha窗口。",
      "输出恋爱模式、伴侣画像、关系风险、未来3年机会窗口和行动建议。",
    ].join("\n");
  }
  if (step.section === "dasha") {
    return [
      `已加载 skill: ${skillLine}。`,
      "只生成 Dasha 时间线与未来窗口。按当前大运/小运和未来3-5年窗口拆解事业、财富、感情、迁移、家庭、健康精力。",
      "每个时间节点必须写推导依据，不要只写结论。",
    ].join("\n");
  }
  return [
    `已加载 skill: ${skillLine}。`,
    "生成最终「完整人生报告」HTML。它是给用户看的最终付费交付物，不是技术审计拼接。",
    "必须是完整 standalone HTML document。",
    "结构分两大块：整体人生画像；通俗人生板块。",
    "整体人生画像包括：人生主线、底层性格、过去验证、未来3-5年节奏、人生K线图/时间轴。",
    "通俗人生板块要把行星审计重写成用户能懂的章节：自我、情绪、思维、成长、爱情、压力、突破、放下、事业、财富、家庭、迁移、行动建议。",
    "专业术语要少；先说用户能理解的结论，再放简短技术依据。",
  ].join("\n");
}

function validationSummary(params: VedicReportParams): string {
  return params.responses.map((response) => {
    const item = params.validationItems.find((entry) => entry.id === response.id);
    const answer = response.answer === "yes" ? "是" : response.answer === "no" ? "否" : "其他";
    return `${response.id}. ${item?.assertion || "验前事"} -> ${answer}${response.note ? `，补充：${response.note}` : ""}`;
  }).join("\n");
}

async function getPriorArtifacts(env: Env, runId: string): Promise<Array<{ title: string; content: string }>> {
  const { results } = await env.DB.prepare(
    "SELECT title, content FROM artifacts WHERE run_id = ?1 ORDER BY created_at ASC",
  ).bind(runId).all<{ title: string; content: string }>();
  return results.map((row) => ({
    title: row.title,
    content: row.content.length > 2500 ? `${row.content.slice(0, 2500)}\n...` : row.content,
  }));
}

async function getStepArtifactId(env: Env, runId: string, title: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT id FROM artifacts WHERE run_id = ?1 AND title = ?2 ORDER BY created_at DESC LIMIT 1",
  ).bind(runId, title).first<{ id: string }>();
  return row?.id ?? null;
}

function buildAgentStepPrompt(
  env: Env,
  params: VedicReportParams,
  step: ReportStep,
  priorArtifacts: Array<{ title: string; content: string }>,
) {
  const skillCalls = step.skillIds.map((skillId) => `get_skill_instructions("${skillId}")`).join("、");
  const planetLine = step.planet ? `planet: ${step.planet}` : "planet: 不需要";
  const artifactDescription = step.section === "final_html" ? "整体人生画像与未来节奏" : `${step.title} - ${step.skillIds.join(" + ")}`;

  return [
    "这是 /vedic 用户页后台 Workflow 交给你的一个单步 Agent 任务。必须严格执行工具链，不要只用聊天文本回答。",
    "",
    "当前目标：",
    `- run_id: ${params.runId}`,
    `- 当前模块标题: ${step.title}`,
    `- section: ${step.section}`,
    `- ${planetLine}`,
    `- 产物类型: ${step.type}`,
    "",
    "必须按顺序执行：",
    `1. 先调用 ${skillCalls}。`,
    `2. 再调用 generate_vedic_report，参数必须包含 birth_date、birth_time、latitude、longitude、timezone、section${step.planet ? "、planet" : ""}。`,
    `3. 拿到 generate_vedic_report 的 chart/instruction 后，根据已加载 skill 和工具返回数据生成「${step.title}」完整内容。`,
    `4. 必须调用 create_artifact，参数必须是：type="${step.type}"，title="${step.title}"，description="${artifactDescription}"，run_id="${params.runId}"，content=完整模块内容。`,
    "5. 最后只用一句话说明该模块已写入产物区。",
    "",
    "当前模块写作规则：",
    buildSkillRules(step),
    "",
    "出生信息：",
    `birth_date: ${params.birth.birth_date}`,
    `birth_time: ${params.birth.birth_time}`,
    `birth_place: ${params.birth.birth_place}`,
    `latitude: ${params.birth.latitude}`,
    `longitude: ${params.birth.longitude}`,
    `timezone: ${params.birth.timezone || "Asia/Shanghai"}`,
    `gender: ${params.birth.gender || ""}`,
    "",
    "验前事反馈：",
    validationSummary(params),
    "",
    step.section === "final_html"
      ? "已生成的分段分析材料摘要，最终 HTML 必须综合这些材料，不要复制粘贴技术审计："
      : "",
    step.section === "final_html" ? JSON.stringify(priorArtifacts) : "",
    "",
    "禁止事项：",
    "- 禁止跳过工具调用直接写报告。",
    "- 禁止生成当前模块以外的产物。",
    "- 禁止把完整报告只发在聊天文本里而不调用 create_artifact。",
    "- 禁止编造工具没有返回的数据。",
  ].filter(Boolean).join("\n");
}

export class VedicReportWorkflow extends WorkflowEntrypoint<Env, VedicReportParams> {
  async run(event: WorkflowEvent<VedicReportParams>, step: WorkflowStep): Promise<void> {
    const params = event.payload;

    await step.do("mark-run-running", async () => {
      await this.env.DB.prepare(
        "UPDATE vedic_report_runs SET status = 'running', updated_at = ?2 WHERE id = ?1",
      ).bind(params.runId, Date.now()).run();
    });

    for (const reportStep of REPORT_STEPS) {
      try {
        await step.do(`start-${reportStep.key}`, async () => {
          await this.env.DB.prepare(
            "UPDATE vedic_report_runs SET current_step = ?2, updated_at = ?3 WHERE id = ?1",
          ).bind(params.runId, reportStep.key, Date.now()).run();
          await this.env.DB.prepare(
            "UPDATE vedic_report_steps SET status = 'running', started_at = ?3, error = NULL WHERE run_id = ?1 AND step_key = ?2",
          ).bind(params.runId, reportStep.key, Date.now()).run();
        });

        await step.do(`agent-${reportStep.key}`, async () => {
          const priorArtifacts = reportStep.section === "final_html"
            ? await getPriorArtifacts(this.env, params.runId)
            : [];
          const result = await runBackgroundAgentStep({
            env: this.env,
            agentId: params.agentId,
            runId: params.runId,
            prompt: buildAgentStepPrompt(this.env, params, reportStep, priorArtifacts),
            maxSteps: reportStep.section === "final_html" ? 10 : 8,
            maxOutputTokens: reportStep.section === "final_html" ? 12000 : 9000,
          });
          return JSON.stringify(result);
        });

        const artifactId = await step.do(`verify-${reportStep.key}`, async () => {
          const id = await getStepArtifactId(this.env, params.runId, reportStep.title);
          if (!id) throw new Error(`agent did not create artifact: ${reportStep.title}`);
          await this.env.DB.prepare(
            "UPDATE vedic_report_steps SET status = 'completed', artifact_id = ?3, completed_at = ?4 WHERE run_id = ?1 AND step_key = ?2",
          ).bind(params.runId, reportStep.key, id, Date.now()).run();
          return id;
        });

        await step.do(`touch-run-${reportStep.key}`, async () => {
          await this.env.DB.prepare(
            "UPDATE vedic_report_runs SET updated_at = ?2 WHERE id = ?1",
          ).bind(params.runId, Date.now()).run();
          return artifactId;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "step_failed";
        await step.do(`fail-${reportStep.key}`, async () => {
          await this.env.DB.prepare(
            "UPDATE vedic_report_steps SET status = 'failed', error = ?3 WHERE run_id = ?1 AND step_key = ?2",
          ).bind(params.runId, reportStep.key, message).run();
          await this.env.DB.prepare(
            "UPDATE vedic_report_runs SET status = 'failed', current_step = ?2, error = ?3, updated_at = ?4 WHERE id = ?1",
          ).bind(params.runId, reportStep.key, message, Date.now()).run();
        });
        throw error;
      }
    }

    await step.do("mark-run-completed", async () => {
      const now = Date.now();
      await this.env.DB.prepare(
        "UPDATE vedic_report_runs SET status = 'completed', current_step = NULL, error = NULL, updated_at = ?2, completed_at = ?2 WHERE id = ?1",
      ).bind(params.runId, now).run();
    });
  }
}

export function reportStepsForRun() {
  return REPORT_STEPS;
}

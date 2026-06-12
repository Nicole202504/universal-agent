import { Think } from "@cloudflare/think";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AgentConfig, AgentState, Env, SkillManifest } from "../types";
import type { ToolCtx, ToolDef } from "./contracts/tool";
import { ALL_SKILLS, ALL_TOOLS } from "../registry";
import { filterSkills, filterTools, loadAgentConfig } from "./assembly";
import { buildToolSet } from "./tool-dispatch";
import { buildSkillDirectory, makeGetSkillInstructionsTool } from "./skill-loader";

const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_PROMPT = "You are a general-purpose agent running on the universal-agent harness.";
const WORKSPACE_ARTIFACT_PROMPT = [
  "## Workspace artifacts",
  "When the user asks you to generate an HTML page, local preview, report, markdown document, or JSON output, you MUST call `create_artifact` with the complete content.",
  "For HTML, pass a full standalone HTML document in `content` and set `type` to `html`.",
  "After the tool call succeeds, keep the chat reply short and tell the user the artifact is available in the right-side Artifacts panel.",
  "Do not only paste the generated artifact inline when `create_artifact` is available.",
].join("\n");
const INLINE_FORM_PROMPT = [
  "## Inline forms",
  "When you need the user to provide structured information, do not ask them to reply freely if a form would be clearer.",
  "Call `ask_user_form` with concise fields, then wait for the submitted tool result before continuing.",
  "Use at most 8 fields. Prefer select, radio, checkbox, date, and number controls when the answer space is constrained.",
  "After receiving the form result, continue the user's task using the submitted values.",
].join("\n");

// 通用 agent DO（Layer 1 / 零业务）。
// 业务从 D1 agent_config 装配 + code registry 注入，本类不 import 任何 businesses/*。
export class UniversalAgent extends Think<Env, AgentState> {
  initialState: AgentState = { turns: 0 };

  private _config: AgentConfig | null = null;
  private _tools: ToolDef[] = [];
  private _skills: SkillManifest[] = [];
  private _assembled = false;

  // routeAgentRequest 把 /agents/universal-agent/:name 路由到此实例的 this.name
  private agentId(): string {
    return this.name ?? "default";
  }

  private async assemble(): Promise<void> {
    const cfg = await loadAgentConfig(this.env.DB, this.agentId());
    this._config = cfg;
    this._skills = filterSkills(ALL_SKILLS, cfg);
    // 业务工具（按 config 过滤）+ 内建 L2 渐进披露工具
    this._tools = [...filterTools(ALL_TOOLS, cfg), makeGetSkillInstructionsTool(this._skills)];
    this._assembled = true;
  }

  async onStart(): Promise<void> {
    await this.assemble();
  }

  // 兜底：若 onStart 未先跑，进入一轮前确保已装配
  async beforeTurn(): Promise<void> {
    if (!this._assembled) await this.assemble();
  }

  getModel() {
    const model = this._config?.model ?? DEFAULT_MODEL;
    return createOpenAICompatible({
      name: "deepseek",
      apiKey: this.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
      includeUsage: true,
    }).chatModel(model);
  }

  getSystemPrompt(): string {
    const base = this._config?.system_prompt ?? DEFAULT_PROMPT;
    const dir = buildSkillDirectory(this._skills);
    return [base, WORKSPACE_ARTIFACT_PROMPT, INLINE_FORM_PROMPT, dir].filter(Boolean).join("\n\n");
  }

  getTools() {
    const ctx: ToolCtx = { env: this.env };
    return buildToolSet(this._tools, ctx);
  }
}

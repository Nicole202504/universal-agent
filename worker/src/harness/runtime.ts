import { Think } from "@cloudflare/think";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentConfig, AgentState, Env, SkillManifest } from "../types";
import type { ToolCtx, ToolDef } from "./contracts/tool";
import { ALL_SKILLS, ALL_TOOLS } from "../registry";
import { filterSkills, filterTools, loadAgentConfig } from "./assembly";
import { buildToolSet } from "./tool-dispatch";
import { buildSkillDirectory, makeGetSkillInstructionsTool } from "./skill-loader";

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_PROMPT = "You are a general-purpose agent running on the universal-agent harness.";

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
    const deepseek = createOpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: this.env.DEEPSEEK_API_KEY,
      fetch: async (url, init) => {
        // DeepSeek 不支持 "developer" role，将其转为 "system"
        if (init?.body) {
          const body = JSON.parse(init.body as string);
          if (body.messages) {
            body.messages = body.messages.map((m: { role: string; [key: string]: unknown }) =>
              m.role === "developer" ? { ...m, role: "system" } : m
            );
          }
          init = { ...init, body: JSON.stringify(body) };
        }
        return fetch(url, init);
      },
    });
    return deepseek.chat(model);
  }

  getSystemPrompt(): string {
    const base = this._config?.system_prompt ?? DEFAULT_PROMPT;
    const dir = buildSkillDirectory(this._skills);
    return dir ? `${base}\n\n${dir}` : base;
  }

  getTools() {
    const ctx: ToolCtx = { env: this.env };
    return buildToolSet(this._tools, ctx);
  }
}

/// <reference types="@cloudflare/workers-types" />

// ── Worker 绑定（对应 wrangler.jsonc）──
export interface Env {
  DB: D1Database;
  UniversalAgent: DurableObjectNamespace;
  HELLO_WORKFLOW: Workflow;
  ASSETS: Fetcher;
  DEEPSEEK_API_KEY: string;
}

// ── Agent DO 持久状态 ──
export interface AgentState {
  turns: number;
}

// ── agent_config 一行（config-driven 装配的输入）──
export interface AgentConfig {
  id: string;
  label: string | null;
  system_prompt: string | null;
  model: string | null;
  enabled_tools: string | null; // JSON string[]
  enabled_skills: string | null; // JSON string[]
  schedules: string | null; // JSON [{cron, target}]
  mcp_servers: string | null;
}

// ── Skill（业务能力的 know-how 载体，渐进披露 L1/L2）──
export interface SkillManifest {
  id: string;
  description: string; // L1
  instructions: string; // L2
  tool_ids: string[];
  workflow: string | null; // 刚性轨 Workflow binding 名；null = 柔性轨
}

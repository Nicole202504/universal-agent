import type { AgentConfig, SkillManifest } from "../types";
import type { ToolDef } from "./contracts/tool";

// 从 D1 读 agent_config（config-driven 装配的入口）。
export async function loadAgentConfig(db: D1Database, id: string): Promise<AgentConfig | null> {
  try {
    const row = await db.prepare("SELECT * FROM agent_config WHERE id = ?1").bind(id).first<AgentConfig>();
    if (row) return row;
    if (id !== "default") {
      return await db.prepare("SELECT * FROM agent_config WHERE id = 'default'").first<AgentConfig>();
    }
    return null;
  } catch {
    // 表未建 / DB 未就绪 —— 交给上层 fallback（hello-world 仍可全开跑）
    return null;
  }
}

function parseIds(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

// 按 agent_config.enabled_tools 过滤 code 侧的 ALL_TOOLS。
// 未配置（空）→ 全开，便于 hello-world 即开即用。
export function filterTools(all: ToolDef[], cfg: AgentConfig | null): ToolDef[] {
  const ids = parseIds(cfg?.enabled_tools);
  if (ids.length === 0) return all;
  const map = new Map(all.map((t) => [t.id, t]));
  return ids.flatMap((id) => {
    const t = map.get(id);
    return t ? [t] : [];
  });
}

export function filterSkills(all: SkillManifest[], cfg: AgentConfig | null): SkillManifest[] {
  const ids = parseIds(cfg?.enabled_skills);
  if (ids.length === 0) return all;
  const map = new Map(all.map((s) => [s.id, s]));
  return ids.flatMap((id) => {
    const s = map.get(id);
    return s ? [s] : [];
  });
}

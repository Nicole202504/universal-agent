import { z } from "zod";
import type { SkillManifest } from "../types";
import type { ToolDef } from "./contracts/tool";

// L1 渐进披露：只把已启用 skill 的 id + description 注入 system prompt（不含正文）。
// 几十个 skill 也只占很小 context —— 用于"发现"，正文按需才加载。
export function buildSkillDirectory(skills: SkillManifest[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- ${s.id}: ${s.description}`);
  return ["## Available skills (call get_skill_instructions to load full steps)", ...lines].join("\n");
}

// L2 渐进披露：内建工具，模型选中某 skill 后按需取回完整步骤（SKILL 正文）。
export function makeGetSkillInstructionsTool(skills: SkillManifest[]): ToolDef {
  return {
    id: "get_skill_instructions",
    description: "Load the full step-by-step instructions (L2) for a skill by its id.",
    inputSchema: z.object({ skill_id: z.string() }),
    run: async (_ctx, args) => {
      const skillId = String(args.skill_id);
      const s = skills.find((x) => x.id === skillId);
      return s ? { skill_id: s.id, instructions: s.instructions } : { error: `unknown skill: ${skillId}` };
    },
  };
}

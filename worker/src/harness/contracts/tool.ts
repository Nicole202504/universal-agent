import type { z } from "zod";
import type { Env } from "../../types";

// 工具执行上下文：窄注入（ISP/DIP）。只给工具真正需要的依赖，不暴露整个 agent。
// 将来某工具确需 agent 能力时，加一个窄能力接口（如 { startWorkflow }），而非整只 agent。
export interface ToolCtx {
  env: Env;
}

// Tool = 幂等原子动作（do-this）。一个工具 = 一个动作。
export interface ToolDef {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  /** 是否不可逆/有副作用 —— gating 的挂载点 */
  mutating?: boolean;
  /** 前端执行工具：模型发起 tool call，UI 渲染并回传结果，Worker 不直接 execute */
  clientSide?: boolean;
  run: (ctx: ToolCtx, args: Record<string, unknown>) => Promise<unknown>;
}

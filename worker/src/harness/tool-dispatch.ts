import { tool, type ToolSet } from "ai";
import type { ToolCtx, ToolDef } from "./contracts/tool";
import { gate } from "./gating";

// 把 ToolDef[] 包装成 AI SDK 的 ToolSet 交给 Think loop。
// 每次执行先过门控（gate），再调业务 run。
export function buildToolSet(defs: ToolDef[], ctx: ToolCtx): ToolSet {
  const set: ToolSet = {};
  for (const def of defs) {
    if (def.clientSide) {
      set[def.id] = tool({
        description: def.description,
        inputSchema: def.inputSchema as never,
      });
      continue;
    }

    set[def.id] = tool({
      description: def.description,
      // 动态构建工具：擦除 schema 泛型，避免 AI SDK 把输入推断成 never
      inputSchema: def.inputSchema as never,
      execute: async (args: Record<string, unknown>) => {
        const decision = gate(ctx, def, args);
        if (!decision.allow) {
          return { blocked: true, reason: decision.reason ?? "gated" };
        }
        return await def.run(ctx, args);
      },
    });
  }
  return set;
}

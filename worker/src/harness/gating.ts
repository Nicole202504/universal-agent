import type { ToolCtx, ToolDef } from "./contracts/tool";

export interface GateDecision {
  allow: boolean;
  reason?: string;
}

// 不可逆动作门控（docs/08 §1 刚性轨 / §7）。
// P0 默认放行。真实业务在此接入审批：对 def.mutating=true 的工具，
// 可改为返回 {allow:false} 并改走 Workflow.waitForEvent / waitForApproval。
// 关键：安全靠"门控不可逆动作"，不靠砍 loop（CLAUDE.md / docs/05 v6）。
export function gate(_ctx: ToolCtx, _def: ToolDef, _args: Record<string, unknown>): GateDecision {
  return { allow: true };
}

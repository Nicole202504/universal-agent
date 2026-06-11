import type { UIMessage } from "ai";

// 直接用 AI SDK v6 的真实类型，不再自造 AnyMessage（保留编译期 part 检查）
export type UIPart = UIMessage["parts"][number];

export function getMessageText(message: UIMessage): string {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function isToolPart(part: UIPart): boolean {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

// 工具名兼容两种格式：dynamic-tool 的 toolName / 静态 tool-<name> 的 type 前缀
export function getToolName(part: UIPart): string {
  if (part.type === "dynamic-tool") return part.toolName;
  return part.type.startsWith("tool-") ? part.type.slice("tool-".length) : "";
}

export function getToolState(part: UIPart): string {
  return "state" in part && part.state ? String(part.state) : "";
}

export function getToolOutput(part: UIPart): unknown {
  return "output" in part ? (part as { output?: unknown }).output : undefined;
}

import { cn } from "@/lib/utils";
import { getToolName, getToolOutput, getToolState, type UIPart } from "../model/message-helpers";

// app-cuecue 工具卡片的 4 态：pending(input-*) / output-available / output-error
function summarize(name: string, state: string, output: unknown): string {
  if (state === "input-streaming" || state === "input-available" || state === "call") return "运行中…";
  if (state === "output-error") return "需要重试";
  if (output != null) {
    const s = typeof output === "string" ? output : JSON.stringify(output);
    return s.length > 90 ? s.slice(0, 90) + "…" : s;
  }
  return name;
}

export function ToolCardList({ toolParts }: { toolParts: UIPart[] }) {
  if (toolParts.length === 0) return null;

  return (
    <div className="space-y-1">
      {toolParts.map((part, i) => {
        const name = getToolName(part);
        const state = getToolState(part);
        const isPending =
          state === "input-streaming" || state === "input-available" || state === "call";
        const isError = state === "output-error";

        return (
          <div
            key={`${name}-${i}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
              isPending
                ? "animate-pulse bg-muted/40 text-muted-foreground/70"
                : "bg-muted/60 text-muted-foreground",
              isError && "bg-destructive/10 text-destructive",
            )}
          >
            <span className="font-medium text-foreground">🔧 {name}</span>
            <span className="truncate">{summarize(name, state, getToolOutput(part))}</span>
          </div>
        );
      })}
    </div>
  );
}

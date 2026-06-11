import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Run = { id: string; kind: string; payload: string; created_at: number };

export function RunsPanel() {
  const [runs, setRuns] = useState<Run[]>([]);

  const refresh = useCallback(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => setRuns(d as Run[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Workflow runs</span>
        <span className="text-xs text-muted-foreground">刚性轨</span>
        <Button size="icon" variant="ghost" className="ml-auto size-7" onClick={refresh}>
          <RefreshCw className="size-3.5" />
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col p-2">
          {runs.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline gap-1.5 border-b border-border/50 px-2 py-2 text-sm"
            >
              <code className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                {r.kind}
              </code>
              <span className="text-foreground">{r.payload}</span>
              <time className="ml-auto text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleTimeString()}
              </time>
            </li>
          ))}
          {runs.length === 0 && (
            <li className="px-2 py-3 text-xs text-muted-foreground">
              还没有 run。让 agent 调 <code>start_hello_workflow</code>，或 <code>POST /api/workflow?topic=x</code>
            </li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}

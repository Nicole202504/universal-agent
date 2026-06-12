import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Braces,
  Code2,
  Eye,
  FileText,
  Globe2,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Run = { id: string; kind: string; payload: string; created_at: number };

type Artifact =
  | {
      id: string;
      type: "markdown";
      title: string;
      description: string;
      content: string;
      created_at: number;
    }
  | {
      id: string;
      type: "html";
      title: string;
      description: string;
      content: string;
      created_at: number;
    }
  | {
      id: string;
      type: "json";
      title: string;
      description: string;
      content: string;
      created_at: number;
    };

function ArtifactIcon({ type }: { type: Artifact["type"] }) {
  if (type === "markdown") return <FileText className="size-4" />;
  if (type === "html") return <Globe2 className="size-4" />;
  return <Braces className="size-4" />;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  if (artifact.type === "markdown") {
    return (
      <div className="prose prose-sm max-w-none p-4 prose-headings:mt-2 prose-p:my-2 prose-ul:my-2">
        <Markdown remarkPlugins={[remarkGfm]}>{artifact.content}</Markdown>
      </div>
    );
  }

  if (artifact.type === "html") {
    return (
      <iframe
        title={artifact.title}
        sandbox="allow-scripts"
        srcDoc={artifact.content}
        className="h-full min-h-[360px] w-full bg-white"
      />
    );
  }

  return (
    <pre className="h-full overflow-auto p-4 text-xs leading-5 text-foreground">
      {formatJsonContent(artifact.content)}
    </pre>
  );
}

function formatJsonContent(content: string) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function ArtifactList({
  artifacts,
  selectedId,
  onSelect,
}: {
  artifacts: Artifact[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Artifacts</span>
        <span className="text-xs text-muted-foreground">产物区</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-3">
        {artifacts.map((artifact) => (
          <button
            key={artifact.id}
            type="button"
            onClick={() => onSelect(artifact.id)}
            className={cn(
              "grid w-[176px] shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-md border px-3 py-2 text-left transition-colors",
              selectedId === artifact.id
                ? "border-primary bg-primary-soft-bg"
                : "border-border bg-background hover:bg-muted/60",
            )}
          >
            <span className="mt-0.5 text-primary">
              <ArtifactIcon type={artifact.type} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">
                {artifact.title}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {artifact.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RunsView() {
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
    <div className="flex h-full min-h-0 flex-col">
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
              <time className="ml-auto text-xs text-muted-foreground">{formatTime(r.created_at)}</time>
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

export function WorkspacePanel() {
  const [tab, setTab] = useState<"artifacts" | "runs">("artifacts");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshArtifacts = useCallback(() => {
    fetch("/api/artifacts")
      .then((r) => r.json())
      .then((d) => {
        const next = d as Artifact[];
        setArtifacts(next);
        setSelectedId((current) => current ?? next[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshArtifacts();
    const t = setInterval(refreshArtifacts, 2000);
    return () => clearInterval(t);
  }, [refreshArtifacts]);

  const selected = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0],
    [artifacts, selectedId],
  );

  return (
    <aside className="flex h-full min-h-0 min-w-0 flex-col border-l border-border bg-card">
      <div className="flex h-12 items-center border-b border-border px-3">
        <div className="grid grid-cols-2 rounded-md bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("artifacts")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium",
              tab === "artifacts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Eye className="size-3.5" />
            Artifacts
          </button>
          <button
            type="button"
            onClick={() => setTab("runs")}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium",
              tab === "runs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Workflow className="size-3.5" />
            Runs
          </button>
        </div>
      </div>

      {tab === "runs" ? (
        <RunsView />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <ArtifactList artifacts={artifacts} selectedId={selected?.id ?? ""} onSelect={setSelectedId} />
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <ArtifactIcon type={selected.type} />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-foreground">{selected.title}</h2>
                  <p className="truncate text-xs text-muted-foreground">{selected.description}</p>
                </div>
                <Button size="icon" variant="ghost" className="ml-auto size-7" onClick={refreshArtifacts}>
                  <RefreshCw className="size-3.5" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-background">
                <ArtifactViewer artifact={selected} />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Code2 className="size-5" />
              <p>还没有 artifact。让 agent 生成一个 HTML、报告或 JSON，它会出现在这里。</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

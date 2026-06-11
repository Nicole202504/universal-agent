import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatContext } from "../chat-context";

export function ChatComposer() {
  const { draft, setDraft, submitDraft, isStreaming, stop } = useChatContext();

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-3 py-2 shadow-sm">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitDraft();
            }
          }}
          rows={1}
          placeholder="问点什么，或让我跑 hello workflow…"
          className="max-h-[160px] flex-1"
        />
        {isStreaming ? (
          <Button size="icon" className="size-8 shrink-0 rounded-full" onClick={() => stop()}>
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="size-8 shrink-0 rounded-full"
            onClick={submitDraft}
            disabled={!draft.trim()}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

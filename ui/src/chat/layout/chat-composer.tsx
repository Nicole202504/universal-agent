import { ArrowUp, Square } from "lucide-react";
import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { Button } from "@/components/ui/button";

export function AssistantComposer() {
  return (
    <div className="border-t border-border p-3">
      <ComposerPrimitive.Root className="flex items-end gap-2 rounded-3xl border border-border bg-card px-3 py-2 shadow-sm">
        <ComposerPrimitive.Input
          placeholder="问点什么，或让我跑 hello workflow…"
          submitMode="enter"
          className="max-h-[160px] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel asChild>
            <Button size="icon" className="size-8 shrink-0 rounded-full">
              <Square className="size-3.5 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send asChild>
            <Button size="icon" className="size-8 shrink-0 rounded-full">
              <ArrowUp className="size-4" />
            </Button>
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>
      </ComposerPrimitive.Root>
    </div>
  );
}

export function ChatComposer() {
  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-3 py-2 shadow-sm">
        <Button size="icon" className="size-8 shrink-0 rounded-full">
          <Square className="size-3.5 fill-current" />
        </Button>
      </div>
    </div>
  );
}

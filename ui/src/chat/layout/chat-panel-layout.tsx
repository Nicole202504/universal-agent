import { ThreadPrimitive } from "@assistant-ui/react";
import { AssistantMessage, UserMessage } from "../messages/assistant-ui-message";
import { AssistantComposer } from "./chat-composer";

// 纯布局壳：header / messages / composer 三段
export function ChatPanelLayout() {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">universal-agent</span>
        <span className="text-xs text-muted-foreground">柔性轨 · loop</span>
      </header>
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto" autoScroll>
        <div className="flex flex-col gap-3 p-4">
          <ThreadPrimitive.Empty>
            <p className="text-sm text-muted-foreground">
              问我「现在几点」会触发 <code>get_time</code>；说「跑个 hello workflow，topic=demo」
              会触发刚性轨。
            </p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </div>
      </ThreadPrimitive.Viewport>
      <AssistantComposer />
    </ThreadPrimitive.Root>
  );
}

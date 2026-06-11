import { MessageList } from "../messages/message-list";
import { ChatComposer } from "./chat-composer";

// 纯布局壳：header / messages / composer 三段
export function ChatPanelLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">universal-agent</span>
        <span className="text-xs text-muted-foreground">柔性轨 · loop</span>
      </header>
      <MessageList />
      <ChatComposer />
    </div>
  );
}

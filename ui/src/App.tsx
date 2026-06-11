import { ChatPanel } from "./chat/chat-panel";
import { RunsPanel } from "./runs/runs-panel";

export function App() {
  return (
    <div className="grid h-dvh w-screen grid-cols-[1fr_340px] overflow-hidden bg-background text-foreground">
      <ChatPanel />
      <RunsPanel />
    </div>
  );
}

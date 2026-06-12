import { ChatPanel } from "./chat/chat-panel";
import { WorkspacePanel } from "./workspace/workspace-panel";

export function App() {
  return (
    <div className="grid h-dvh w-screen grid-cols-[minmax(0,1fr)_420px] overflow-hidden bg-background text-foreground">
      <ChatPanel />
      <WorkspacePanel />
    </div>
  );
}

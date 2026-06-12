import { ChatPanel } from "./chat/chat-panel";
import { WorkspacePanel } from "./workspace/workspace-panel";
import { VedicWorkspace } from "./vedic/vedic-workspace";

export function App() {
  if (window.location.pathname.startsWith("/vedic")) {
    return (
      <div className="h-dvh w-screen overflow-hidden bg-background text-foreground">
        <VedicWorkspace />
      </div>
    );
  }

  return (
    <div className="grid h-dvh w-screen grid-cols-[minmax(0,1fr)_420px] overflow-hidden bg-background text-foreground">
      <ChatPanel />
      <WorkspacePanel />
    </div>
  );
}

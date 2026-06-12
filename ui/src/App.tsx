import { ChatPanel } from "./chat/chat-panel";

export function App() {
  return (
    <div className="h-dvh w-screen overflow-hidden bg-background text-foreground">
      <ChatPanel />
    </div>
  );
}

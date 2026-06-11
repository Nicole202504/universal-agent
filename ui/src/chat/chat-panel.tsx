import { ChatProvider } from "./chat-provider";
import { ChatPanelLayout } from "./layout/chat-panel-layout";

// Container：组合 Provider(状态) + Layout(展示)
export function ChatPanel() {
  return (
    <ChatProvider>
      <ChatPanelLayout />
    </ChatProvider>
  );
}

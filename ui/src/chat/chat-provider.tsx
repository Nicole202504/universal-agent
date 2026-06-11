import { useCallback, useState, type ReactNode } from "react";
import { useUniversalAgentChat } from "./use-universal-agent-chat";
import { ChatContext } from "./chat-context";

// 本地草稿态 + remote runtime 合并（app-cuecue 的 local-state/remote-state 分离模式）
export function ChatProvider({ children }: { children: ReactNode }) {
  const runtime = useUniversalAgentChat();
  const [draft, setDraft] = useState("");

  const submitDraft = useCallback(() => {
    if (!draft.trim() || runtime.isStreaming) return;
    runtime.sendText(draft);
    setDraft("");
  }, [draft, runtime]);

  return (
    <ChatContext.Provider value={{ ...runtime, draft, setDraft, submitDraft }}>
      {children}
    </ChatContext.Provider>
  );
}

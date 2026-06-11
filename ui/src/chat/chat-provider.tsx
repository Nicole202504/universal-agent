import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useUniversalAgentChat } from "./use-universal-agent-chat";
import { ChatContext } from "./chat-context";
import { getMessageText } from "./model/message-helpers";

// 保存消息到 D1
async function saveMsg(role: string, content: string) {
  try {
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    });
  } catch { /* ignore */ }
}

// 本地草稿态 + remote runtime 合并（app-cuecue 的 local-state/remote-state 分离模式）
export function ChatProvider({ children }: { children: ReactNode }) {
  const runtime = useUniversalAgentChat();
  const [draft, setDraft] = useState("");
  const savedCount = useRef(0);

  // 自动保存新消息到 D1
  useEffect(() => {
    const msgs = runtime.messages;
    if (msgs.length <= savedCount.current) return;
    for (let i = savedCount.current; i < msgs.length; i++) {
      const text = getMessageText(msgs[i]);
      if (text && (msgs[i].role === "user" || msgs[i].role === "assistant")) {
        saveMsg(msgs[i].role, text);
      }
    }
    savedCount.current = msgs.length;
  }, [runtime.messages]);

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

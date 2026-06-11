import { createContext, useContext } from "react";
import type { ChatRuntime } from "./use-universal-agent-chat";

export interface ChatContextValue extends ChatRuntime {
  draft: string;
  setDraft: (v: string) => void;
  submitDraft: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const v = useContext(ChatContext);
  if (!v) throw new Error("useChatContext must be used within ChatProvider");
  return v;
}

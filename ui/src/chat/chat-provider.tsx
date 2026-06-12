import { useMemo, type ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import type { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useUniversalAgentChat } from "./use-universal-agent-chat";

type AISDKChatHelpers = ReturnType<typeof useChat<UIMessage>>;

// Cloudflare useAgentChat 走 WebSocket；assistant-ui 接管 thread/composer/message parts 渲染。
export function ChatProvider({ children }: { children: ReactNode }) {
  const chat = useUniversalAgentChat();

  const runtimeChat = useMemo(
    () =>
      ({
        ...chat,
        // assistant-ui 的 AI SDK adapter 调用 addToolResult；Cloudflare 暴露的是 addToolOutput。
        addToolResult: ({
          tool,
          toolCallId,
          output,
        }: {
          tool?: string;
          toolCallId: string;
          output?: unknown;
        }) => {
          chat.addToolOutput({ toolName: tool, toolCallId, output });
        },
      }) as unknown as AISDKChatHelpers,
    [chat],
  );

  const runtime = useAISDKRuntime(runtimeChat, { joinStrategy: "none" });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

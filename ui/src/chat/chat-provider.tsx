import { useMemo, type ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAISDKRuntime } from "@assistant-ui/react-ai-sdk";
import { useUniversalAgentChat } from "./use-universal-agent-chat";

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
      }) as Parameters<typeof useAISDKRuntime>[0],
    [chat],
  );

  const runtime = useAISDKRuntime(runtimeChat, { joinStrategy: "none" });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

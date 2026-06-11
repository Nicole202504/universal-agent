import { useCallback } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

// agent 值 = DO class 名（Agents SDK 路由约定）；name = 实例名 → agent_config.id
const AGENT = "UniversalAgent";
const NAME = "default";

/**
 * 适配层（app-cuecue 模式）：把 useAgent + useAgentChat 收敛成一个归一化 runtime，
 * 对外只暴露 messages / 发送 / 状态，隐藏 SDK 细节。
 */
export function useUniversalAgentChat() {
  const agent = useAgent({ agent: AGENT, name: NAME });
  const { messages, sendMessage, status, isStreaming, stop, error } = useAgentChat({
    agent,
    resume: true, // 断线重连续流（resumable streaming）
  });

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      void sendMessage({ text: t });
    },
    [sendMessage],
  );

  return { messages, status, isStreaming, error, sendText, stop };
}

export type ChatRuntime = ReturnType<typeof useUniversalAgentChat>;

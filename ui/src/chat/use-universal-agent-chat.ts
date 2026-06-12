import { useCallback, useMemo } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

// agent 值 = DO class 名（Agents SDK 路由约定）；name = 实例名 → agent_config.id
const AGENT = "UniversalAgent";
const FALLBACK_NAME = "vedic-prod-v2";
const SESSION_KEY = "vedic-agent-session-v1";

type ChatMessage = {
  id?: string;
  role?: string;
  parts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export function getUniversalAgentName() {
  if (typeof window === "undefined") return FALLBACK_NAME;
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `vedic-${crypto.randomUUID()}`;
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
}

function normalizeToolParts(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: Array.isArray(message.parts)
      ? message.parts.map((part) => {
          if (typeof part.type === "string" && part.type.startsWith("tool-")) {
            return {
              ...part,
              arguments: part.arguments ?? part.input ?? {},
              input: part.input ?? part.arguments ?? {},
            };
          }
          return part;
        })
      : message.parts,
  }));
}

/**
 * 适配层（app-cuecue 模式）：把 useAgent + useAgentChat 收敛成一个归一化 runtime，
 * 对外只暴露 messages / 发送 / 状态，隐藏 SDK 细节。
 */
export function useUniversalAgentChat(name?: string) {
  const agentName = useMemo(() => name ?? getUniversalAgentName(), [name]);
  const agent = useAgent({ agent: AGENT, name: agentName });
  const chat = useAgentChat({
    agent,
    resume: true, // 断线重连续流（resumable streaming）
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages: normalizeToolParts(messages as unknown as ChatMessage[]) },
    }),
  });

  const sendText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      void chat.sendMessage({ text: t });
    },
    [chat],
  );

  return { ...chat, sendText, agentName };
}

export type ChatRuntime = ReturnType<typeof useUniversalAgentChat>;

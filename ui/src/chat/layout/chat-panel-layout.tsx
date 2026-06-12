import { ThreadPrimitive } from "@assistant-ui/react";
import { AssistantMessage, UserMessage } from "../messages/assistant-ui-message";
import { AssistantComposer } from "./chat-composer";

// 纯布局壳：header / messages / composer 三段
export function ChatPanelLayout() {
  return (
    <ThreadPrimitive.Root className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="size-2 rounded-full bg-primary" />
        <span className="text-sm font-semibold text-foreground">Vedic Agent</span>
        <span className="text-xs text-muted-foreground">Agent 流程</span>
      </header>
      <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto" autoScroll>
        <div className="flex flex-col gap-3 p-4">
          <ThreadPrimitive.Empty>
            <p className="text-sm text-muted-foreground">
              输入出生日期、出生时间、出生地点和性别，Agent 会加载技能、排盘、生成 5 条验前事，再输出右侧报告产物。
            </p>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages
            components={{ UserMessage, AssistantMessage }}
          />
        </div>
      </ThreadPrimitive.Viewport>
      <AssistantComposer />
    </ThreadPrimitive.Root>
  );
}

import type { UIMessage } from "ai";
import { getMessageText, isToolPart } from "../model/message-helpers";
import { AssistantText } from "./assistant-text";
import { ToolCardList } from "../tools/tool-card-list";

// 按 role 分发：user 气泡 / assistant(markdown + 工具卡)
export function MessageBubble({ message, isActive }: { message: UIMessage; isActive: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
          {getMessageText(message)}
        </div>
      </div>
    );
  }

  const toolParts = message.parts.filter(isToolPart);
  const text = getMessageText(message);

  return (
    <div className="group/msg flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="size-4 rounded-full bg-primary" />
        <span className="text-xs font-medium text-muted-foreground">universal-agent</span>
      </div>
      {text && <AssistantText content={text} isActive={isActive} />}
      {toolParts.length > 0 && <ToolCardList toolParts={toolParts} />}
    </div>
  );
}

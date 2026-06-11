import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "../chat-context";
import { MessageBubble } from "./message-bubble";

export function MessageList() {
  const { messages, isStreaming } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            问我「现在几点」会触发 <code>get_time</code>；说「跑个 hello workflow，topic=demo」会触发刚性轨。
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id ?? i}
            message={m}
            isActive={isStreaming && i === messages.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

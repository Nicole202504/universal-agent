import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 流式 markdown 渲染 + 活动消息末尾光标（app-cuecue AssistantTextPart 模式）
// remark-gfm 启用 GFM 表格 / 删除线 / 任务列表 / 自动链接
export function AssistantText({ content, isActive }: { content: string; isActive: boolean }) {
  return (
    <div className="prose prose-sm max-w-none text-sm text-foreground prose-p:my-1 prose-pre:my-1 prose-table:my-2">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      {isActive && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
    </div>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessagePartPrimitive,
  MessagePrimitive,
  type ReasoningMessagePartProps,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { useMessagePartText } from "@assistant-ui/react";
import { Bot, CheckCircle2, ClipboardList, Clock3, Loader2, Send, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function MarkdownText() {
  const part = useMessagePartText();

  return (
    <div className="prose prose-sm max-w-full overflow-x-auto text-sm text-foreground prose-p:my-1 prose-pre:my-1 prose-table:my-2">
      <Markdown remarkPlugins={[remarkGfm]}>{part.text}</Markdown>
      {part.status.type === "running" && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
    </div>
  );
}

function ReasoningPanel({ text, status }: ReasoningMessagePartProps) {
  if (!text) return null;

  return (
    <details
      className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
      open={status.type === "running"}
    >
      <summary className="cursor-pointer font-medium text-foreground">内部推理</summary>
      <p className="mt-2 leading-5">
        {status.type === "running" ? "模型正在分析请求。" : "模型已完成内部推理。"}
      </p>
    </details>
  );
}

function formatJson(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolCallCard({ toolName, args, result, isError, status }: ToolCallMessagePartProps) {
  const isRunning = status.type === "running" || status.type === "requires-action";
  const label = isError ? "失败" : isRunning ? "执行中" : "完成";
  const Icon = isError ? XCircle : isRunning ? Loader2 : CheckCircle2;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-muted/35 text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-2">
        <Wrench className="size-3.5 text-foreground" />
        <span className="font-medium text-foreground">{toolName}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Icon className={cn("size-3.5", isRunning && "animate-spin")} />
          {label}
        </span>
      </div>
      {args != null && (
        <pre className="mt-2 max-h-28 overflow-auto rounded bg-background/70 p-2 text-[11px] leading-4 text-foreground">
          {formatJson(args)}
        </pre>
      )}
      {result != null && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/70 p-2 text-[11px] leading-4 text-foreground">
          {formatJson(result)}
        </pre>
      )}
    </div>
  );
}

type FormOption = {
  label: string;
  value: string;
};

type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "radio" | "checkbox";
  required?: boolean;
  placeholder?: string;
  description?: string;
  options?: FormOption[];
};

type InlineFormArgs = {
  title?: string;
  description?: string;
  submitLabel?: string;
  fields?: FormField[];
};

type InlineFormResult = {
  submitted: true;
  values: Record<string, string | string[] | boolean>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeFields(fields: InlineFormArgs["fields"]): FormField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field) => field?.name && field?.label && field?.type)
    .slice(0, 8)
    .map((field) => ({
      ...field,
      options: Array.isArray(field.options) ? field.options.filter((option) => option.label && option.value) : [],
    }));
}

function initialValue(field: FormField): string | string[] | boolean {
  if (field.type === "checkbox") return field.options && field.options.length > 0 ? [] : false;
  return "";
}

function InlineFormCard({
  args,
  result,
  status,
  addResult,
}: ToolCallMessagePartProps<InlineFormArgs, InlineFormResult>) {
  const fields = useMemo(() => normalizeFields(args.fields), [args.fields]);
  const [values, setValues] = useState<Record<string, string | string[] | boolean>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, initialValue(field)])),
  );
  const [missing, setMissing] = useState<string[]>([]);
  const isSubmitted = Boolean(result?.submitted);
  const isReady = status.type === "requires-action";

  const submittedValues = result?.values ?? values;

  const updateValue = (name: string, value: string | string[] | boolean) => {
    setValues((current) => ({ ...current, [name]: value }));
    setMissing((current) => current.filter((item) => item !== name));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextMissing = fields
      .filter((field) => {
        if (!field.required) return false;
        const value = values[field.name];
        if (Array.isArray(value)) return value.length === 0;
        return value === "" || value === false || value == null;
      })
      .map((field) => field.name);

    setMissing(nextMissing);
    if (nextMissing.length > 0) return;

    addResult({ submitted: true, values });
  };

  if (fields.length === 0) {
    return <ToolCallCard toolName="ask_user_form" args={args} result={result} status={status} />;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl rounded-md border border-border bg-background px-3 py-3 text-sm shadow-sm"
    >
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 rounded-md bg-primary-soft-bg p-1 text-primary">
          <ClipboardList className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{args.title ?? "补充信息"}</h3>
          {args.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{args.description}</p>}
        </div>
        {isSubmitted && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-primary" />
            已提交
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {fields.map((field) => {
          const value = submittedValues[field.name] ?? initialValue(field);
          const hasError = missing.includes(field.name);
          return (
            <label key={field.name} className="grid gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
              </span>
              <FieldInput
                field={field}
                value={value}
                disabled={isSubmitted || !isReady}
                onChange={(next) => updateValue(field.name, next)}
              />
              {field.description && <span className="text-[11px] leading-4 text-muted-foreground">{field.description}</span>}
              {hasError && <span className="text-[11px] leading-4 text-destructive">这个字段需要填写</span>}
            </label>
          );
        })}
      </div>

      {!isSubmitted && (
        <div className="mt-3 flex items-center justify-between gap-3">
          {!isReady && <span className="text-xs text-muted-foreground">表单正在准备中…</span>}
          <Button type="submit" size="sm" className="ml-auto" disabled={!isReady}>
            <Send className="size-3.5" />
            {args.submitLabel ?? "提交"}
          </Button>
        </div>
      )}
    </form>
  );
}

function FieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FormField;
  value: string | string[] | boolean;
  disabled: boolean;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const baseClass =
    "min-h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

  if (field.type === "textarea") {
    return (
      <textarea
        value={asString(value)}
        placeholder={field.placeholder}
        disabled={disabled}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className={cn(baseClass, "resize-none")}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        value={asString(value)}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={baseClass}
      >
        <option value="">{field.placeholder ?? "请选择"}</option>
        {(field.options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "radio") {
    return (
      <span className="flex flex-wrap gap-2">
        {(field.options ?? []).map((option) => (
          <label
            key={option.value}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
          >
            <input
              type="radio"
              name={field.name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={(event) => event.target.checked && onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </span>
    );
  }

  if (field.type === "checkbox") {
    const options = field.options ?? [];
    if (options.length === 0) {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          确认
        </span>
      );
    }

    const selected = Array.isArray(value) ? value : [];
    return (
      <span className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
          >
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              disabled={disabled}
              onChange={(event) => {
                onChange(
                  event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((item) => item !== option.value),
                );
              }}
            />
            {option.label}
          </label>
        ))}
      </span>
    );
  }

  return (
    <input
      type={field.type === "number" || field.type === "date" ? field.type : "text"}
      value={asString(value)}
      placeholder={field.placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={baseClass}
    />
  );
}

export function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">
        <MessagePrimitive.Parts
          components={{
            Text: () => <MessagePartPrimitive.Text smooth />,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group/msg flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="size-3" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">universal-agent</span>
      </div>
      <MessagePrimitive.Parts
        components={{
          Text: MarkdownText,
          Reasoning: ReasoningPanel,
          tools: { by_name: { ask_user_form: InlineFormCard }, Fallback: ToolCallCard },
          Empty: () => (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="size-3.5 animate-pulse" />
              正在处理…
            </div>
          ),
        }}
      />
    </MessagePrimitive.Root>
  );
}

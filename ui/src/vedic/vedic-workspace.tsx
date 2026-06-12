import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, FileText, Loader2, MapPin, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUniversalAgentChat } from "@/chat/use-universal-agent-chat";
import { getMessageText } from "@/chat/model/message-helpers";
import { ToolCardList } from "@/chat/tools/tool-card-list";

type PlaceResult = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  country: string;
  timezone: string;
};

type BirthForm = {
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number | "";
  longitude: number | "";
  timezone: string;
};

type ValidationResponse = {
  id: number;
  answer: "yes" | "no" | "other" | "";
  note: string;
};

const TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

function hasReport(text: string) {
  return (
    text.includes("吠陀占星完整分析报告") ||
    (text.includes("九大行星") && text.includes("十二宫") && text.includes("事业")) ||
    (text.length > 3500 && text.includes("报告"))
  );
}

function isToolPart(part: { type: string }) {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

export function VedicWorkspace() {
  const runtime = useUniversalAgentChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<BirthForm>({
    birth_date: "",
    birth_time: "",
    birth_place: "",
    latitude: "",
    longitude: "",
    timezone: "Asia/Shanghai",
  });
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [birthSubmitted, setBirthSubmitted] = useState(false);
  const [responses, setResponses] = useState<ValidationResponse[]>(
    Array.from({ length: 5 }, (_, index) => ({ id: index + 1, answer: "", note: "" })),
  );
  const [validationSubmitted, setValidationSubmitted] = useState(false);
  const [report, setReport] = useState("");

  const canSubmitBirth =
    form.birth_date && form.birth_time && form.birth_place && form.latitude !== "" && form.longitude !== "";
  const canSubmitValidation = responses.every((response) => response.answer);

  const latestAssistantText = useMemo(() => {
    const assistant = [...runtime.messages].reverse().find((message) => message.role === "assistant");
    return assistant ? getMessageText(assistant) : "";
  }, [runtime.messages]);

  const shouldShowValidationCard =
    birthSubmitted &&
    !validationSubmitted &&
    (latestAssistantText.includes("请选择") ||
      latestAssistantText.includes("是 / 否") ||
      latestAssistantText.includes("验前事"));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runtime.messages, shouldShowValidationCard, runtime.isStreaming]);

  useEffect(() => {
    for (const message of runtime.messages) {
      if (message.role !== "assistant") continue;
      const text = getMessageText(message);
      if (hasReport(text)) setReport(text);
    }
  }, [runtime.messages]);

  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaces([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        setPlaces(res.ok ? await res.json() : []);
      } finally {
        setPlaceLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [placeQuery]);

  function selectPlace(place: PlaceResult) {
    setForm((current) => ({
      ...current,
      birth_place: place.label,
      latitude: place.lat,
      longitude: place.lon,
      timezone: place.timezone || current.timezone,
    }));
    setPlaceQuery(place.label);
    setPlaces([]);
  }

  function submitBirth() {
    const message = [
      "请启动 Vedic Agent 主流程。",
      "第一步必须加载 get_skill_instructions(\"vedic-reader\") 和 get_skill_instructions(\"vedic-calculator\")。",
      "然后调用 collect_birth_data 排盘，再调用 generate_validation_statements 输出 5 条验前事。",
      "验前事必须是用户可选择「是/否/其他」的判断题。不要生成最终报告。",
      "",
      "出生信息：",
      `birth_date: ${form.birth_date}`,
      `birth_time: ${form.birth_time}`,
      `birth_place: ${form.birth_place}`,
      `latitude: ${form.latitude}`,
      `longitude: ${form.longitude}`,
      `timezone: ${form.timezone}`,
    ].join("\n");
    setBirthSubmitted(true);
    runtime.sendText(message);
  }

  function submitValidation() {
    const lines = responses.map((response) => {
      const answer = response.answer === "yes" ? "是" : response.answer === "no" ? "否" : "其他";
      return `${response.id}. ${answer}${response.note ? `，补充：${response.note}` : ""}`;
    });
    const message = [
      "我的 5 条验前事确认结果如下：",
      ...lines,
      "",
      "请现在调用 evaluate_validation。",
      "如果可以进入报告，请必须依次加载：",
      "get_skill_instructions(\"vedic-core\")",
      "get_skill_instructions(\"vedic-career\")",
      "get_skill_instructions(\"vedic-love\")",
      "",
      "然后生成一份全局完整报告。报告必须包含：",
      "1. 每一颗行星的 P1-P12 审计。",
      "2. 十二宫逐宫诊断。",
      "3. D9/D10/D4/D5 分盘交叉分析。",
      "4. 职业专项，使用 vedic-career 逻辑。",
      "5. 感情专项，使用 vedic-love 逻辑。",
      "6. Dasha 时间线和未来窗口。",
      "请把完整报告作为一条 Markdown 输出，标题为 # 吠陀占星完整分析报告。",
    ].join("\n");
    setValidationSubmitted(true);
    runtime.sendText(message);
  }

  function updateResponse(id: number, answer: ValidationResponse["answer"]) {
    setResponses((current) => current.map((item) => (item.id === id ? { ...item, answer } : item)));
  }

  function updateNote(id: number, note: string) {
    setResponses((current) => current.map((item) => (item.id === id ? { ...item, note } : item)));
  }

  return (
    <div className="grid h-dvh w-screen grid-cols-[minmax(420px,540px)_1fr] overflow-hidden bg-background text-foreground">
      <section className="flex min-h-0 flex-col border-r border-border bg-background">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <h1 className="text-base font-semibold">Vedic Agent</h1>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-5">
            <AgentBubble title="出生信息">
              先填写出生日期、时间和地点。我会把这组结构化信息发给 Agent，由它自己加载 skill、排盘、生成验前事。
            </AgentBubble>

            {!birthSubmitted && (
              <BirthFormCard
                form={form}
                setForm={setForm}
                placeQuery={placeQuery}
                setPlaceQuery={setPlaceQuery}
                places={places}
                placeLoading={placeLoading}
                selectPlace={selectPlace}
                canSubmit={Boolean(canSubmitBirth)}
                loading={runtime.isStreaming}
                onSubmit={submitBirth}
              />
            )}

            {runtime.messages.map((message, index) => (
              <ChatMessage key={message.id ?? index} message={message} active={runtime.isStreaming && index === runtime.messages.length - 1} />
            ))}

            {shouldShowValidationCard && (
              <ValidationCard
                responses={responses}
                updateResponse={updateResponse}
                updateNote={updateNote}
                canSubmit={canSubmitValidation}
                loading={runtime.isStreaming}
                onSubmit={submitValidation}
              />
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </section>

      <ArtifactPanel report={report} streaming={runtime.isStreaming && !report && validationSubmitted} />
    </div>
  );
}

function AgentBubble({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
        {title && <div className="mb-1 text-xs font-semibold text-muted-foreground">{title}</div>}
        <div className="leading-6">{children}</div>
      </div>
    </div>
  );
}

function ChatMessage({ message, active }: { message: { role: string; parts: Array<{ type: string }> }; active: boolean }) {
  const text = getMessageText(message as Parameters<typeof getMessageText>[0]);
  const toolParts = message.parts.filter(isToolPart) as never[];
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] whitespace-pre-wrap rounded-md bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }
  return (
    <AgentBubble title="Agent">
      {text && (
        <div className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-pre:my-2 prose-table:text-xs">
          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
          {active && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
        </div>
      )}
      {toolParts.length > 0 && <ToolCardList toolParts={toolParts} />}
    </AgentBubble>
  );
}

function BirthFormCard({
  form,
  setForm,
  placeQuery,
  setPlaceQuery,
  places,
  placeLoading,
  selectPlace,
  canSubmit,
  loading,
  onSubmit,
}: {
  form: BirthForm;
  setForm: (form: BirthForm) => void;
  placeQuery: string;
  setPlaceQuery: (value: string) => void;
  places: PlaceResult[];
  placeLoading: boolean;
  selectPlace: (place: PlaceResult) => void;
  canSubmit: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-primary" />
        Agent 表单输入
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm font-medium">
            出生日期
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            出生时间
            <input
              type="time"
              value={form.birth_time}
              onChange={(e) => setForm({ ...form, birth_time: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <label className="space-y-1.5 text-sm font-medium">
          出生地点
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                setForm({ ...form, birth_place: e.target.value, latitude: "", longitude: "" });
              }}
              placeholder="输入城市、区县或英文地名"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {places.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
                {places.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => selectPlace(place)}
                    className="flex w-full gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>{place.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {placeLoading && <span className="text-xs text-muted-foreground">搜索地点中...</span>}
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="space-y-1.5 text-sm font-medium">
            纬度
            <input
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            经度
            <input
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            时区
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONES.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
        </div>

        <Button onClick={onSubmit} disabled={!canSubmit || loading} className="w-full">
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          发送给 Agent
        </Button>
      </div>
    </div>
  );
}

function ValidationCard({
  responses,
  updateResponse,
  updateNote,
  canSubmit,
  loading,
  onSubmit,
}: {
  responses: ValidationResponse[];
  updateResponse: (id: number, answer: ValidationResponse["answer"]) => void;
  updateNote: (id: number, note: string) => void;
  canSubmit: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold">验前事确认</div>
      <div className="space-y-3">
        {responses.map((response) => (
          <div key={response.id} className="rounded-md border border-border bg-background p-3">
            <div className="mb-2 text-sm font-medium">第 {response.id} 条</div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={response.answer === "yes" ? "default" : "outline"}
                size="sm"
                onClick={() => updateResponse(response.id, "yes")}
              >
                <Check /> 是
              </Button>
              <Button
                variant={response.answer === "no" ? "default" : "outline"}
                size="sm"
                onClick={() => updateResponse(response.id, "no")}
              >
                <X /> 否
              </Button>
              <Button
                variant={response.answer === "other" ? "default" : "outline"}
                size="sm"
                onClick={() => updateResponse(response.id, "other")}
              >
                其他
              </Button>
            </div>
            {response.answer === "other" && (
              <Textarea
                value={response.note}
                onChange={(e) => updateNote(response.id, e.target.value)}
                placeholder="补充说明"
                className="mt-2 rounded-md border border-input bg-background"
              />
            )}
          </div>
        ))}
      </div>
      <Button onClick={onSubmit} disabled={!canSubmit || loading} className="mt-3 w-full">
        {loading ? <Loader2 className="animate-spin" /> : <FileText />}
        发送确认结果给 Agent
      </Button>
    </div>
  );
}

function ArtifactPanel({ report, streaming }: { report: string; streaming: boolean }) {
  return (
    <section className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">报告产物</h2>
        </div>
        <span className={cn("text-xs", report ? "text-primary" : "text-muted-foreground")}>
          {report ? "已生成" : streaming ? "生成中" : "等待生成"}
        </span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {report ? (
          <article className="prose prose-sm max-w-none p-8 text-foreground prose-headings:scroll-mt-4 prose-table:text-sm">
            <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Agent 完成 skill 加载与完整报告输出后，这里会同步显示报告产物。
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

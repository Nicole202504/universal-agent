import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, FileText, Loader2, MapPin, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

type ValidationItem = {
  id: number;
  area: string;
  assertion: string;
  evidence: string;
};

type ValidationResponse = {
  id: number;
  answer: "yes" | "no" | "other" | "";
  note: string;
};

type ChartResult = {
  birth: BirthForm;
  chart: Record<string, unknown>;
  validation_items: ValidationItem[];
};

type FlowMessage = {
  id: string;
  role: "agent" | "user" | "system";
  title?: string;
  body: ReactNode;
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

const initialMessages: FlowMessage[] = [
  {
    id: "hello",
    role: "agent",
    title: "出生信息",
    body: "先填写出生日期、时间和地点。我会把地点转成经纬度，随后计算星盘并生成 5 条验前事。",
  },
  {
    id: "birth-form",
    role: "system",
    body: null,
  },
];

function asText(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function chartSummary(chart: Record<string, unknown> | null) {
  if (!chart) return [];
  const lagna = chart.lagna as { sign?: string; degree?: number } | undefined;
  const dasha = chart.current_dasha as { planet?: string; start?: string; end?: string } | undefined;
  return [
    ["上升", lagna?.sign ? `${lagna.sign} ${lagna.degree ?? ""}` : asText(chart.lagna)],
    ["月亮", asText(chart.moon_sign)],
    ["太阳", asText(chart.sun_sign)],
    ["SAV", asText(chart.sav_total)],
    ["当前大运", dasha?.planet ? `${dasha.planet} (${dasha.start} ~ ${dasha.end})` : "-"],
  ];
}

function answerLabel(answer: ValidationResponse["answer"]) {
  if (answer === "yes") return "是";
  if (answer === "no") return "否";
  if (answer === "other") return "其他";
  return "未选择";
}

export function VedicWorkspace() {
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
  const [messages, setMessages] = useState<FlowMessage[]>(initialMessages);
  const [chartResult, setChartResult] = useState<ChartResult | null>(null);
  const [responses, setResponses] = useState<ValidationResponse[]>([]);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "chart" | "report">("idle");

  const canSubmitBirth =
    form.birth_date && form.birth_time && form.birth_place && form.latitude !== "" && form.longitude !== "";
  const canGenerateReport = responses.length > 0 && responses.every((r) => r.answer);
  const summaryRows = useMemo(() => chartSummary(chartResult?.chart ?? null), [chartResult]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chartResult, responses, phase]);

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

  function append(message: FlowMessage) {
    setMessages((current) => [...current.filter((item) => item.id !== message.id), message]);
  }

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

  async function generateValidation() {
    setError("");
    setReport("");
    setPhase("chart");
    append({
      id: `user-birth-${Date.now()}`,
      role: "user",
      title: "已提交出生信息",
      body: (
        <div className="space-y-1 text-sm">
          <div>{form.birth_date} {form.birth_time}</div>
          <div>{form.birth_place}</div>
          <div className="text-muted-foreground">
            {form.latitude}, {form.longitude} · {form.timezone}
          </div>
        </div>
      ),
    });
    append({
      id: "agent-calculating",
      role: "agent",
      title: "排盘中",
      body: (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          正在调用计算引擎，转换星盘数据并生成验前事。
        </span>
      ),
    });
    try {
      const res = await fetch("/api/vedic/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成验前事失败");
      setChartResult(data);
      setResponses(
        data.validation_items.map((item: ValidationItem) => ({
          id: item.id,
          answer: "",
          note: "",
        })),
      );
      append({
        id: "agent-chart-ready",
        role: "agent",
        title: "星盘已计算",
        body: "我已经得到上升、月亮、大运和关键宫位信号。下面先做 5 条验前事确认。",
      });
      append({
        id: "validation-card",
        role: "system",
        body: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成验前事失败";
      setError(message);
      append({ id: `error-${Date.now()}`, role: "agent", title: "流程中断", body: message });
    } finally {
      setPhase("idle");
    }
  }

  async function generateReport() {
    if (!chartResult) return;
    setError("");
    setPhase("report");
    append({
      id: `user-validation-${Date.now()}`,
      role: "user",
      title: "已确认验前事",
      body: (
        <div className="space-y-1 text-sm">
          {responses.map((response) => (
            <div key={response.id}>
              #{response.id} {answerLabel(response.answer)}
              {response.note ? `：${response.note}` : ""}
            </div>
          ))}
        </div>
      ),
    });
    append({
      id: "agent-reporting",
      role: "agent",
      title: "生成报告",
      body: (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          正在按 vedic-core 结构生成完整报告，右侧产物区会显示结果。
        </span>
      ),
    });
    try {
      const res = await fetch("/api/vedic/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth: form,
          validation_items: chartResult.validation_items,
          responses,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成报告失败");
      setReport(data.report || "");
      append({
        id: "agent-report-ready",
        role: "agent",
        title: "报告已生成",
        body: "完整报告已经放到右侧产物区。",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成报告失败";
      setError(message);
      append({ id: `error-${Date.now()}`, role: "agent", title: "报告失败", body: message });
    } finally {
      setPhase("idle");
    }
  }

  function updateResponse(id: number, answer: ValidationResponse["answer"]) {
    setResponses((current) => current.map((item) => (item.id === id ? { ...item, answer } : item)));
  }

  function updateNote(id: number, note: string) {
    setResponses((current) => current.map((item) => (item.id === id ? { ...item, note } : item)));
  }

  return (
    <div className="grid h-dvh w-screen grid-cols-[minmax(420px,520px)_1fr] overflow-hidden bg-background text-foreground">
      <section className="flex min-h-0 flex-col border-r border-border bg-background">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <h1 className="text-base font-semibold">Vedic Agent</h1>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-5">
            {messages.map((message) => (
              <FlowMessageView key={message.id} message={message}>
                {message.id === "birth-form" && (
                  <BirthFormCard
                    form={form}
                    setForm={setForm}
                    placeQuery={placeQuery}
                    setPlaceQuery={setPlaceQuery}
                    places={places}
                    placeLoading={placeLoading}
                    selectPlace={selectPlace}
                    canSubmit={Boolean(canSubmitBirth)}
                    loading={phase === "chart"}
                    onSubmit={generateValidation}
                  />
                )}
                {message.id === "validation-card" && chartResult && (
                  <ValidationCard
                    items={chartResult.validation_items}
                    responses={responses}
                    updateResponse={updateResponse}
                    updateNote={updateNote}
                    canGenerateReport={canGenerateReport}
                    loading={phase === "report"}
                    onGenerateReport={generateReport}
                    summaryRows={summaryRows}
                  />
                )}
              </FlowMessageView>
            ))}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </section>

      <ArtifactPanel report={report} />
    </div>
  );
}

function FlowMessageView({ message, children }: { message: FlowMessage; children?: ReactNode }) {
  if (message.role === "system") return <>{children ?? message.body}</>;
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-md border px-3 py-2 text-sm shadow-sm",
          isUser
            ? "border-primary/25 bg-primary text-primary-foreground"
            : "border-border bg-card text-card-foreground",
        )}
      >
        {message.title && (
          <div className={cn("mb-1 text-xs font-semibold", isUser ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {message.title}
          </div>
        )}
        <div className="leading-6">{message.body}</div>
      </div>
    </div>
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
        出生信息表单
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
          提交给 Agent
        </Button>
      </div>
    </div>
  );
}

function ValidationCard({
  items,
  responses,
  updateResponse,
  updateNote,
  canGenerateReport,
  loading,
  onGenerateReport,
  summaryRows,
}: {
  items: ValidationItem[];
  responses: ValidationResponse[];
  updateResponse: (id: number, answer: ValidationResponse["answer"]) => void;
  updateNote: (id: number, note: string) => void;
  canGenerateReport: boolean;
  loading: boolean;
  onGenerateReport: () => void;
  summaryRows: string[][];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">星盘摘要</div>
        <div className="divide-y divide-border text-sm">
          {summaryRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[88px_1fr] px-3 py-2">
              <span className="text-muted-foreground">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const response = responses.find((r) => r.id === item.id);
          return (
            <div key={item.id} className="rounded-md border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">{item.area}</span>
                <span>#{item.id}</span>
              </div>
              <p className="text-sm font-medium leading-6">{item.assertion}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  variant={response?.answer === "yes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateResponse(item.id, "yes")}
                >
                  <Check /> 是
                </Button>
                <Button
                  variant={response?.answer === "no" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateResponse(item.id, "no")}
                >
                  <X /> 否
                </Button>
                <Button
                  variant={response?.answer === "other" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateResponse(item.id, "other")}
                >
                  其他
                </Button>
              </div>
              {response?.answer === "other" && (
                <Textarea
                  value={response.note}
                  onChange={(e) => updateNote(item.id, e.target.value)}
                  placeholder="补充说明"
                  className="mt-2 rounded-md border border-input bg-background"
                />
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={onGenerateReport} disabled={!canGenerateReport || loading} className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : <FileText />}
        生成右侧报告
      </Button>
    </div>
  );
}

function ArtifactPanel({ report }: { report: string }) {
  return (
    <section className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">报告产物</h2>
        </div>
        <span className={cn("text-xs", report ? "text-primary" : "text-muted-foreground")}>
          {report ? "已生成" : "等待生成"}
        </span>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {report ? (
          <article className="prose prose-sm max-w-none p-8 text-foreground prose-headings:scroll-mt-4 prose-table:text-sm">
            <Markdown remarkPlugins={[remarkGfm]}>{report}</Markdown>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            左侧 Agent 完成出生信息、验前事确认后，完整报告会显示在这里。
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

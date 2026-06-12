import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Check,
  ChevronRight,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useUniversalAgentChat } from "@/chat/use-universal-agent-chat";

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
  gender: string;
};

type ValidationItem = {
  id: number;
  area: string;
  assertion: string;
  evidence: string;
};

type ValidationAnswer = {
  id: number;
  answer: "yes" | "no" | "other" | "";
  note: string;
};

type Artifact = {
  id: string;
  type: "markdown" | "html" | "json";
  title: string;
  description: string;
  content: string;
  created_at: number;
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

const REPORT_SEQUENCE = [
  "太阳行星审计",
  "月亮行星审计",
  "火星行星审计",
  "水星行星审计",
  "木星行星审计",
  "金星行星审计",
  "土星行星审计",
  "Rahu 行星审计",
  "Ketu 行星审计",
  "十二宫逐宫诊断",
  "D9/D10/D4/D5 分盘交叉分析",
  "职业专项报告",
  "感情专项报告",
  "Dasha 时间线与未来窗口",
  "吠陀占星完整分析报告",
];

function defaultBirthForm(): BirthForm {
  return {
    birth_date: "",
    birth_time: "",
    birth_place: "",
    latitude: "",
    longitude: "",
    timezone: "Asia/Shanghai",
    gender: "",
  };
}

function formatGender(value: string) {
  if (value === "female") return "女";
  if (value === "male") return "男";
  return "其他/不透露";
}

function isVedicArtifact(artifact: Artifact) {
  const haystack = `${artifact.title} ${artifact.description}`;
  return REPORT_SEQUENCE.some((title) => haystack.includes(title)) || haystack.includes("行星审计");
}

export function VedicWorkspace() {
  const runtime = useUniversalAgentChat();
  const [form, setForm] = useState<BirthForm>(() => defaultBirthForm());
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [validationItems, setValidationItems] = useState<ValidationItem[]>([]);
  const [answers, setAnswers] = useState<ValidationAnswer[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [reportStartedAt, setReportStartedAt] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);

  const canSubmitBirth =
    form.birth_date &&
    form.birth_time &&
    form.birth_place &&
    form.latitude !== "" &&
    form.longitude !== "" &&
    form.gender;
  const canSubmitAnswers = answers.length === 5 && answers.every((answer) => answer.answer);
  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0],
    [artifacts, selectedArtifactId],
  );

  useEffect(() => {
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaces([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(q)}`);
        setPlaces(response.ok ? await response.json() : []);
      } finally {
        setPlaceLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [placeQuery]);

  useEffect(() => {
    const refresh = async () => {
      const response = await fetch("/api/artifacts");
      if (!response.ok) return;
      const rows = ((await response.json()) as Artifact[])
        .filter((artifact) => artifact.type === "markdown")
        .filter(isVedicArtifact)
        .filter((artifact) => !reportStartedAt || artifact.created_at >= reportStartedAt - 5000);
      setArtifacts(rows);
      setSelectedArtifactId((current) => current ?? rows[0]?.id ?? null);
    };
    void refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [reportStartedAt]);

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
    if (!canSubmitBirth || validationLoading) return;
    setValidationLoading(true);
    setValidationError("");
    setValidationItems([]);
    setAnswers([]);
    setArtifacts([]);
    setReportStartedAt(null);
    try {
      const response = await fetch("/api/vedic/validation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(String(data.error || "validation_failed"));
      }
      const data = (await response.json()) as { validation_items: ValidationItem[] };
      const nextItems = data.validation_items.slice(0, 5);
      setValidationItems(nextItems);
      setAnswers(nextItems.map((item) => ({ id: item.id, answer: "", note: "" })));
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "生成验前事失败");
    } finally {
      setValidationLoading(false);
    }
  }

  function updateAnswer(id: number, answer: ValidationAnswer["answer"]) {
    setAnswers((current) => current.map((item) => (item.id === id ? { ...item, answer } : item)));
  }

  function updateNote(id: number, note: string) {
    setAnswers((current) => current.map((item) => (item.id === id ? { ...item, note } : item)));
  }

  function startReport() {
    if (!canSubmitAnswers || runtime.isStreaming) return;
    const startedAt = Date.now();
    setReportStartedAt(startedAt);
    setArtifacts([]);
    setSelectedArtifactId(null);

    const answerText = answers.map((item) => {
      const source = validationItems.find((validation) => validation.id === item.id);
      const label = item.answer === "yes" ? "是" : item.answer === "no" ? "否" : "其他";
      return `${item.id}. ${source?.assertion ?? "验前事"} -> ${label}${item.note ? `，补充：${item.note}` : ""}`;
    });

    runtime.sendText(
      [
        "用户已经在前端完成出生信息表单和 5 条验前事确认。聊天区不展示给用户，请直接执行后续 Agent 流程。",
        "",
        "出生信息：",
        `birth_date: ${form.birth_date}`,
        `birth_time: ${form.birth_time}`,
        `birth_place: ${form.birth_place}`,
        `latitude: ${form.latitude}`,
        `longitude: ${form.longitude}`,
        `timezone: ${form.timezone}`,
        `gender: ${form.gender}`,
        "",
        "5 条验前事与用户反馈：",
        ...answerText,
        "",
        "现在必须先调用 evaluate_validation。",
        "如果可以进入报告，必须依次加载 get_skill_instructions(\"vedic-core\"), get_skill_instructions(\"vedic-career\"), get_skill_instructions(\"vedic-love\")。",
        "然后按分段产物模式生成报告：九颗行星逐颗审计，每颗完成后立即 create_artifact；再生成十二宫、分盘、职业、感情、Dasha；最后生成总报告 artifact。",
        "不要让用户继续等待一个大回复。每个模块完成后都必须立即写入右侧 artifact。",
      ].join("\n"),
    );
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
            <StepHeader
              index={1}
              title="出生信息"
              active={validationItems.length === 0}
              done={validationItems.length > 0}
            />
            <BirthFormCard
              form={form}
              setForm={setForm}
              placeQuery={placeQuery}
              setPlaceQuery={setPlaceQuery}
              places={places}
              placeLoading={placeLoading}
              selectPlace={selectPlace}
              canSubmit={Boolean(canSubmitBirth)}
              loading={validationLoading}
              onSubmit={generateValidation}
            />
            {validationError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {validationError}
              </div>
            )}

            <StepHeader
              index={2}
              title="验前事确认"
              active={validationItems.length > 0 && !reportStartedAt}
              done={Boolean(reportStartedAt)}
            />
            {validationItems.length > 0 ? (
              <ValidationCard
                items={validationItems}
                answers={answers}
                updateAnswer={updateAnswer}
                updateNote={updateNote}
                canSubmit={canSubmitAnswers}
                loading={runtime.isStreaming}
                onSubmit={startReport}
              />
            ) : (
              <EmptyPanel>提交出生信息后，这里会出现 5 条可选择“是 / 否 / 其他”的验证问题。</EmptyPanel>
            )}

            <StepHeader
              index={3}
              title="报告生成"
              active={Boolean(reportStartedAt)}
              done={artifacts.some((artifact) => artifact.title.includes("完整分析报告"))}
            />
            <ProgressPanel
              started={Boolean(reportStartedAt)}
              streaming={runtime.isStreaming}
              artifacts={artifacts}
              onSelect={setSelectedArtifactId}
            />
          </div>
        </ScrollArea>
      </section>

      <ReportPanel
        artifacts={artifacts}
        selected={selectedArtifact}
        selectedId={selectedArtifact?.id ?? ""}
        onSelect={setSelectedArtifactId}
      />
    </div>
  );
}

function StepHeader({
  index,
  title,
  active,
  done,
}: {
  index: number;
  title: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
          done ? "bg-primary text-primary-foreground" : active ? "bg-primary-soft-bg text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-3.5" /> : index}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function EmptyPanel({ children }: { children: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card px-3 py-4 text-sm leading-6 text-muted-foreground">
      {children}
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
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5 text-sm font-medium">
            出生日期
            <input
              type="date"
              value={form.birth_date}
              onChange={(event) => setForm({ ...form, birth_date: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            出生时间
            <input
              type="time"
              value={form.birth_time}
              onChange={(event) => setForm({ ...form, birth_time: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <label className="space-y-1.5 text-sm font-medium">
          出生城市
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={placeQuery}
              onChange={(event) => {
                setPlaceQuery(event.target.value);
                setForm({ ...form, birth_place: event.target.value, latitude: "", longitude: "" });
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
          {form.latitude !== "" && form.longitude !== "" && (
            <span className="block text-xs text-muted-foreground">
              已选择：{Number(form.latitude).toFixed(3)}, {Number(form.longitude).toFixed(3)} · {form.timezone}
            </span>
          )}
        </label>

        <label className="space-y-1.5 text-sm font-medium">
          性别
          <select
            value={form.gender}
            onChange={(event) => setForm({ ...form, gender: event.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">请选择</option>
            <option value="female">女</option>
            <option value="male">男</option>
            <option value="other">其他/不透露</option>
          </select>
        </label>

        <details className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">高级：时区与坐标</summary>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <input
              value={form.latitude}
              onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
              placeholder="纬度"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={form.longitude}
              onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
              placeholder="经度"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={form.timezone}
              onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONES.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </details>

        <Button onClick={onSubmit} disabled={!canSubmit || loading} className="w-full">
          {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
          生成 5 条验前事
        </Button>
      </div>
    </div>
  );
}

function ValidationCard({
  items,
  answers,
  updateAnswer,
  updateNote,
  canSubmit,
  loading,
  onSubmit,
}: {
  items: ValidationItem[];
  answers: ValidationAnswer[];
  updateAnswer: (id: number, answer: ValidationAnswer["answer"]) => void;
  updateNote: (id: number, note: string) => void;
  canSubmit: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="space-y-3">
        {items.map((item) => {
          const answer = answers.find((entry) => entry.id === item.id);
          return (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-primary-soft-bg px-1.5 py-0.5 text-xs font-medium text-primary">
                  {item.area || `第 ${item.id} 条`}
                </span>
                <span className="text-xs text-muted-foreground">#{item.id}</span>
              </div>
              <p className="text-sm font-medium leading-6">{item.assertion}</p>
              {item.evidence && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.evidence}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  variant={answer?.answer === "yes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateAnswer(item.id, "yes")}
                >
                  <Check /> 是
                </Button>
                <Button
                  variant={answer?.answer === "no" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateAnswer(item.id, "no")}
                >
                  <X /> 否
                </Button>
                <Button
                  variant={answer?.answer === "other" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateAnswer(item.id, "other")}
                >
                  其他
                </Button>
              </div>
              {answer?.answer === "other" && (
                <Textarea
                  value={answer.note}
                  onChange={(event) => updateNote(item.id, event.target.value)}
                  placeholder="可以补充说明"
                  className="mt-2 rounded-md border border-input bg-background"
                />
              )}
            </div>
          );
        })}
      </div>
      <Button onClick={onSubmit} disabled={!canSubmit || loading} className="mt-3 w-full">
        {loading ? <Loader2 className="animate-spin" /> : <ChevronRight />}
        开始生成分段报告
      </Button>
    </div>
  );
}

function ProgressPanel({
  started,
  streaming,
  artifacts,
  onSelect,
}: {
  started: boolean;
  streaming: boolean;
  artifacts: Artifact[];
  onSelect: (id: string) => void;
}) {
  if (!started) return <EmptyPanel>确认 5 条验前事后，系统会逐个生成行星报告和最终总报告。</EmptyPanel>;
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">生成进度</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {streaming && <Loader2 className="size-3 animate-spin" />}
          {streaming ? "生成中" : "等待下一步"}
        </span>
      </div>
      <div className="grid gap-2">
        {REPORT_SEQUENCE.map((title) => {
          const artifact = artifacts.find((item) => item.title.includes(title));
          return (
            <button
              key={title}
              type="button"
              onClick={() => artifact && onSelect(artifact.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs",
                artifact ? "border-primary/40 bg-primary-soft-bg text-foreground" : "border-border text-muted-foreground",
              )}
            >
              {artifact ? <Check className="size-3.5 text-primary" /> : <RefreshCw className="size-3.5" />}
              <span className="truncate">{title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportPanel({
  artifacts,
  selected,
  selectedId,
  onSelect,
}: {
  artifacts: Artifact[];
  selected?: Artifact;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-col bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">报告产物</h2>
        </div>
        <span className={cn("text-xs", artifacts.length > 0 ? "text-primary" : "text-muted-foreground")}>
          {artifacts.length > 0 ? `${artifacts.length} 个模块` : "等待生成"}
        </span>
      </header>

      {artifacts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-3">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onSelect(artifact.id)}
              className={cn(
                "w-44 shrink-0 rounded-md border px-3 py-2 text-left",
                selectedId === artifact.id
                  ? "border-primary bg-primary-soft-bg"
                  : "border-border bg-background hover:bg-muted/60",
              )}
            >
              <span className="block truncate text-xs font-medium">{artifact.title}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{artifact.description}</span>
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 bg-background">
        {selected ? (
          <article className="prose prose-sm max-w-none p-8 text-foreground prose-headings:scroll-mt-4 prose-table:text-sm">
            <Markdown remarkPlugins={[remarkGfm]}>{selected.content}</Markdown>
          </article>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            完成验前事确认后，行星报告会一个个出现在这里，最后生成完整总报告。
          </div>
        )}
      </ScrollArea>
    </section>
  );
}

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
import { getUniversalAgentName } from "@/chat/use-universal-agent-chat";

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
  run_id?: string;
  type: "markdown" | "html" | "json";
  title: string;
  description: string;
  content: string;
  created_at: number;
};

type ReportRunStep = {
  step_key: string;
  title: string;
  section: string;
  planet?: string | null;
  status: "queued" | "running" | "completed" | "failed";
  artifact_id?: string | null;
  error?: string | null;
};

type ReportRun = {
  id: string;
  agent_id: string;
  status: "queued" | "running" | "completed" | "failed";
  current_step?: string | null;
  error?: string | null;
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

const REPORT_STEPS = [
  { title: "太阳行星审计", section: "planet_audit", planet: "sun" },
  { title: "月亮行星审计", section: "planet_audit", planet: "moon" },
  { title: "火星行星审计", section: "planet_audit", planet: "mars" },
  { title: "水星行星审计", section: "planet_audit", planet: "mercury" },
  { title: "木星行星审计", section: "planet_audit", planet: "jupiter" },
  { title: "金星行星审计", section: "planet_audit", planet: "venus" },
  { title: "土星行星审计", section: "planet_audit", planet: "saturn" },
  { title: "Rahu 行星审计", section: "planet_audit", planet: "rahu" },
  { title: "Ketu 行星审计", section: "planet_audit", planet: "ketu" },
  { title: "十二宫逐宫诊断", section: "houses" },
  { title: "D9/D10/D4/D5 分盘交叉分析", section: "divisional" },
  { title: "职业专项报告", section: "career" },
  { title: "感情专项报告", section: "love" },
  { title: "Dasha 时间线与未来窗口", section: "dasha" },
  { title: "完整人生报告", section: "final_html" },
] as const;
const REPORT_SEQUENCE = REPORT_STEPS.map((step) => step.title);

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
  return (
    REPORT_SEQUENCE.some((title) => haystack.includes(title)) ||
    haystack.includes("行星审计") ||
    haystack.includes("完整分析报告")
  );
}

function sortArtifacts(rows: Artifact[]) {
  return [...rows].sort((a, b) => {
    if (a.type === "html" && b.type !== "html") return -1;
    if (a.type !== "html" && b.type === "html") return 1;
    return b.created_at - a.created_at;
  });
}

export function VedicWorkspace() {
  const agentName = useMemo(() => getUniversalAgentName(), []);
  const [form, setForm] = useState<BirthForm>(() => defaultBirthForm());
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [validationItems, setValidationItems] = useState<ValidationItem[]>([]);
  const [answers, setAnswers] = useState<ValidationAnswer[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [reportRun, setReportRun] = useState<ReportRun | null>(null);
  const [reportSteps, setReportSteps] = useState<ReportRunStep[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
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
  const reportStarted = Boolean(reportRun);

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
    if (!reportRun) return;
    const refresh = async () => {
      const response = await fetch(`/api/artifacts?run_id=${encodeURIComponent(reportRun.id)}`);
      if (!response.ok) return;
      const rows = sortArtifacts(((await response.json()) as Artifact[]).filter(isVedicArtifact));
      setArtifacts(rows);
      setSelectedArtifactId((current) => {
        const finalHtml = rows.find((artifact) => artifact.type === "html" && artifact.title.includes("完整人生报告"));
        return finalHtml?.id ?? current ?? rows[0]?.id ?? null;
      });
    };
    void refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [reportRun]);

  useEffect(() => {
    if (!reportRun) return;
    const refresh = async () => {
      const response = await fetch(`/api/vedic/report-runs/${encodeURIComponent(reportRun.id)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { run: ReportRun; steps: ReportRunStep[] };
      setReportRun(data.run);
      setReportSteps(data.steps);
      if (data.run.error) setReportError(data.run.error);
    };
    void refresh();
    if (reportRun.status === "completed" || reportRun.status === "failed") return;
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [reportRun?.id, reportRun?.status]);

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
    setReportRun(null);
    setReportSteps([]);
    setReportError("");
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
      const message = error instanceof Error ? error.message : "";
      setValidationError(
        message === "Failed to fetch"
          ? "生成请求没有成功返回，请检查后端服务是否在线，或稍后重试。"
          : message || "生成验前事失败",
      );
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

  async function startReport() {
    if (!canSubmitAnswers || reportLoading) return;
    setReportLoading(true);
    setReportError("");
    setArtifacts([]);
    setSelectedArtifactId(null);
    try {
      const response = await fetch("/api/vedic/report-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentName,
          birth: form,
          validation_items: validationItems,
          responses: answers,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(String(data.error || "report_run_failed"));
      }
      const data = (await response.json()) as {
        run_id: string;
        status: ReportRun["status"];
        steps: ReportRunStep[];
      };
      setReportRun({ id: data.run_id, agent_id: agentName, status: data.status });
      setReportSteps(data.steps);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "启动报告生成失败");
    } finally {
      setReportLoading(false);
    }
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
              active={validationItems.length > 0 && !reportStarted}
              done={reportStarted}
            />
            {validationItems.length > 0 ? (
              <ValidationCard
                items={validationItems}
                answers={answers}
                updateAnswer={updateAnswer}
                updateNote={updateNote}
                canSubmit={canSubmitAnswers}
                loading={reportLoading}
                onSubmit={startReport}
              />
            ) : (
              <EmptyPanel>提交出生信息后，这里会出现 5 条可选择“是 / 否 / 其他”的验证问题。</EmptyPanel>
            )}

            <StepHeader
              index={3}
              title="报告生成"
              active={reportStarted}
              done={artifacts.some((artifact) => artifact.title.includes("完整人生报告"))}
            />
            {reportError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {reportError}
              </div>
            )}
            <ProgressPanel
              started={reportStarted}
              run={reportRun}
              steps={reportSteps}
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
  run,
  steps,
  artifacts,
  onSelect,
}: {
  started: boolean;
  run: ReportRun | null;
  steps: ReportRunStep[];
  artifacts: Artifact[];
  onSelect: (id: string) => void;
}) {
  if (!started) return <EmptyPanel>确认 5 条验前事后，系统会逐个生成行星报告和最终总报告。</EmptyPanel>;
  const visibleSteps: ReportRunStep[] = steps.length > 0
    ? steps
    : REPORT_STEPS.map((step) => ({
        step_key: step.title,
        title: step.title,
        section: step.section,
        planet: "planet" in step ? step.planet : null,
        status: "queued" as const,
        artifact_id: null,
        error: null,
      }));
  const running = run?.status === "queued" || run?.status === "running";
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">生成进度</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {running && <Loader2 className="size-3 animate-spin" />}
          {run?.status === "completed" ? "已完成" : run?.status === "failed" ? "生成失败" : "后台生成中"}
        </span>
      </div>
      <div className="grid gap-2">
        {visibleSteps.map((step) => {
          const artifact = step.artifact_id
            ? artifacts.find((item) => item.id === step.artifact_id)
            : artifacts.find((item) => item.title.includes(step.title));
          return (
            <button
              key={step.step_key}
              type="button"
              onClick={() => artifact && onSelect(artifact.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs",
                step.status === "failed"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : artifact || step.status === "completed"
                    ? "border-primary/40 bg-primary-soft-bg text-foreground"
                    : step.status === "running"
                      ? "border-border bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground",
              )}
            >
              {step.status === "completed" || artifact ? (
                <Check className="size-3.5 text-primary" />
              ) : step.status === "running" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              <span className="truncate">{step.title}</span>
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
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {artifact.type.toUpperCase()} · {artifact.description}
              </span>
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 bg-background">
        {selected?.type === "html" ? (
          <iframe
            title={selected.title}
            sandbox="allow-scripts"
            srcDoc={selected.content}
            className="h-[calc(100dvh-120px)] min-h-[640px] w-full bg-white"
          />
        ) : selected ? (
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

import { Hono } from "hono";
import type { Env } from "../types";

export const apiRoutes = new Hono<{ Bindings: Env }>();

const VEDIC_API_FALLBACK = "http://localhost:8900";

type BirthPayload = {
  birth_date: string;
  birth_time: string;
  birth_place: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type ValidationItem = {
  id: number;
  assertion: string;
  evidence: string;
  area: string;
};

async function vedicApiCall(
  env: Env,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = env.VEDIC_API_URL || VEDIC_API_FALLBACK;
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vedic API ${path} returned ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

function birthToApiPayload(input: BirthPayload): Record<string, unknown> {
  const [year, month, day] = input.birth_date.split("-").map(Number);
  const [hour, minute] = input.birth_time.split(":").map(Number);
  return {
    year,
    month,
    day,
    hour,
    minute,
    lat: Number(input.latitude),
    lon: Number(input.longitude),
    tz_str: input.timezone || "Asia/Shanghai",
  };
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function deepseekChat(
  env: Env,
  messages: Array<{ role: "system" | "user"; content: string }>,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.35,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek returned ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function fallbackValidationItems(chart: Record<string, unknown>): ValidationItem[] {
  const currentDasha = chart.current_dasha as { planet?: string; start?: string; end?: string } | undefined;
  return [
    {
      id: 1,
      area: "迁移",
      assertion: "您的人生中有过离开出生地或长期更换生活环境的阶段。",
      evidence: "基于4宫/迁移相关信号做保守验证。",
    },
    {
      id: 2,
      area: "学业",
      assertion: "您的学业或专业路径中有过一段明显吃力、调整或转向。",
      evidence: "基于5宫与Jupiter相关信号做保守验证。",
    },
    {
      id: 3,
      area: "家庭",
      assertion: "父亲或家庭权威在您的成长中存在较强影响感。",
      evidence: "基于Sun与9宫相关信号做保守验证。",
    },
    {
      id: 4,
      area: "经济",
      assertion: "您早年对金钱安全感比较敏感，容易较早意识到现实压力。",
      evidence: "基于2宫/Saturn相关信号做保守验证。",
    },
    {
      id: 5,
      area: "时间窗口",
      assertion: currentDasha?.planet
        ? `当前 ${currentDasha.planet} 大运阶段，您会更明显感到人生重心正在切换。`
        : "最近几年您会更明显感到人生重心正在切换。",
      evidence: "基于当前Dasha窗口做保守验证。",
    },
  ];
}

async function generateValidationItems(env: Env, chart: Record<string, unknown>): Promise<ValidationItem[]> {
  const content = await deepseekChat(
    env,
    [
      {
        role: "system",
        content:
          "你是吠陀占星验前事生成器。只输出JSON，不要Markdown。生成5条高命中、可选择是/否的中文断言。禁止开放问题、禁止性格套话、禁止疾病预测、禁止身体标记。",
      },
      {
        role: "user",
        content: [
          "根据以下真实计算星盘数据生成验前事。",
          "JSON格式：{\"items\":[{\"id\":1,\"area\":\"领域\",\"assertion\":\"一句可回答是/否的具体断言\",\"evidence\":\"简短推导\"}]}",
          "优先级：父亲/家庭、学历、搬迁、经济、Dasha时间窗口、Ketu落宫。",
          "chart:",
          JSON.stringify(chart),
        ].join("\n"),
      },
    ],
    1800,
  );
  const parsed = tryParseJsonObject(content);
  const items = parsed?.items;
  if (!Array.isArray(items)) return fallbackValidationItems(chart);
  const normalized = items.slice(0, 5).map((item, index) => {
    const value = item as Partial<ValidationItem>;
    return {
      id: Number(value.id) || index + 1,
      area: String(value.area || "验前事"),
      assertion: String(value.assertion || ""),
      evidence: String(value.evidence || ""),
    };
  }).filter((item) => item.assertion && item.evidence);
  return normalized.length >= 4 ? normalized : fallbackValidationItems(chart);
}

// 手动触发刚性轨 Workflow（前端 runs 面板 / 演示用）
apiRoutes.post("/workflow", async (c) => {
  const topic = c.req.query("topic") ?? "world";
  const instance = await c.env.HELLO_WORKFLOW.create({ params: { topic } });
  return c.json({ instanceId: instance.id, status: "started" });
});

// runs 面板数据：列出 Workflow 落库结果
apiRoutes.get("/runs", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, kind, payload, created_at FROM runs ORDER BY created_at DESC LIMIT 20",
  ).all();
  return c.json(results);
});

// 右侧产物区：列出 Agent 生成的报告 / HTML / JSON。
apiRoutes.get("/artifacts", async (c) => {
  const agentId = c.req.query("agent_id")?.trim();
  if (!agentId) return c.json([]);
  const { results } = await c.env.DB.prepare(
    "SELECT id, agent_id, type, title, description, content, created_at FROM artifacts WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT 50",
  ).bind(agentId).all();
  return c.json(results);
});

// ── 聊天记录 ──

// 保存消息
apiRoutes.post("/chat", async (c) => {
  const { session_id, role, content } = await c.req.json<{
    session_id?: string; role: string; content: string;
  }>();
  const sid = session_id || "default";
  await c.env.DB.prepare(
    "INSERT INTO chat_messages (session_id, role, content) VALUES (?1, ?2, ?3)",
  ).bind(sid, role, content).run();
  return c.json({ ok: true });
});

// 加载历史（最近 100 条）
apiRoutes.get("/chat", async (c) => {
  const sid = c.req.query("session") || "default";
  const { results } = await c.env.DB.prepare(
    "SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY id ASC LIMIT 100",
  ).bind(sid).all();
  return c.json(results);
});

// ── 产品 API：地点搜索 / 验前事 / 报告 ──

apiRoutes.get("/places", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 2) return c.json([]);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");
  url.searchParams.set("accept-language", "zh-CN,zh,en");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "universal-agent-vedic/1.0 (https://universal-agent.sl4224063.workers.dev)",
    },
  });
  if (!res.ok) return c.json([]);
  const raw = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    address?: { country?: string; city?: string; town?: string; state?: string };
  }>;
  return c.json(raw.map((place) => {
    const country = place.address?.country || "";
    return {
      id: String(place.place_id),
      label: place.display_name,
      lat: Number(place.lat),
      lon: Number(place.lon),
      country,
      timezone: country.includes("中国") || country.toLowerCase().includes("china") ? "Asia/Shanghai" : "UTC",
    };
  }));
});

apiRoutes.post("/vedic/validation", async (c) => {
  try {
    const birth = await c.req.json<BirthPayload>();
    const chart = await vedicApiCall(c.env, "/api/prevalidate", birthToApiPayload(birth));
    const items = await generateValidationItems(c.env, chart);
    return c.json({
      birth,
      chart,
      validation_items: items,
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "validation_failed" }, 500);
  }
});

apiRoutes.post("/vedic/report", async (c) => {
  try {
    const body = await c.req.json<{
      birth: BirthPayload;
      validation_items: ValidationItem[];
      responses: Array<{ id: number; answer: "yes" | "no" | "other"; note?: string }>;
    }>();
    const chart = await vedicApiCall(c.env, "/api/full-report", birthToApiPayload(body.birth));
    const report = await deepseekChat(
      c.env,
      [
        {
          role: "system",
          content:
            "你是吠陀占星核心报告生成器，遵循KN Rao/Parashari体系。输出中文Markdown完整报告。先说人话，再给证据。不要编造工具未返回的数据。",
        },
        {
          role: "user",
          content: [
            "请根据星盘数据、验前事和用户反馈生成完整报告。",
            "结构必须包含：验前事结果、本命盘基础、九大行星、十二宫位、Dasha时间线、Yoga、十大人生板块、时间窗口建议、技术附录。",
            "每章充分展开，避免短答。使用表格和小标题。",
            "birth:",
            JSON.stringify(body.birth),
            "validation:",
            JSON.stringify({ items: body.validation_items, responses: body.responses }),
            "chart:",
            JSON.stringify(chart),
          ].join("\n"),
        },
      ],
      8192,
    );
    return c.json({ birth: body.birth, chart, report });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "report_failed" }, 500);
  }
});

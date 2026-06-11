import { Hono } from "hono";
import type { Env } from "../types";

export const apiRoutes = new Hono<{ Bindings: Env }>();

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

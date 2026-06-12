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

// 右侧 Workspace 产物区：列出 Agent 生成的报告 / HTML / JSON。
apiRoutes.get("/artifacts", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, type, title, description, content, created_at FROM artifacts ORDER BY created_at DESC LIMIT 50",
  ).all();
  return c.json(results);
});

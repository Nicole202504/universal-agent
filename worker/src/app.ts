import { Hono } from "hono";
import { routeAgentRequest } from "agents";
import type { Env } from "./types";
import { apiRoutes } from "./routes/api";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

const app = new Hono<{ Bindings: Env }>();

// CORS（跳过 WebSocket upgrade）
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  await next();
  if (c.res.status === 101) return; // WebSocket：不动
  const headers = new Headers(c.res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  c.res = new Response(c.res.body, { status: c.res.status, statusText: c.res.statusText, headers });
});

app.route("/api", apiRoutes);

// fallthrough：agent chat/RPC/WebSocket 优先，其次 SPA assets
app.all("*", async (c) => {
  const res = await routeAgentRequest(c.req.raw, c.env);
  if (res) return res;
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;

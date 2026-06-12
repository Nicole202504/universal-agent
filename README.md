# universal-agent

配置驱动、可拔插、可嵌入任意业务的通用 agent 平台。运行底座 = **Cloudflare Agents（`@cloudflare/think`）+ Workflows + D1**，入口 **Hono**，前端 **React 19 + Vite**（`useAgent`/`useAgentChat`）。

> 架构依据：`../talent-agent/docs/08-universal-agent-platform-design.md`（四层 SOP/Skills/Tools/Harness + Connector + SOP 双轨）。
> 本仓库当前是 **P0**：跑通 Think loop + 一个工具 + 一个 Workflow 的 hello-world，含 chat + runs 面板前端。

## 四层架构

| 层 | 目录 | 职责 | 谁写 |
|---|---|---|---|
| **Harness** | `worker/src/harness/` | loop / 装配 / 工具分发 / 渐进披露 / 门控（零业务） | 平台 |
| **Tools** | `worker/src/businesses/*/tools.ts` | 幂等原子动作（do-this） | 工程 |
| **Skills** | `worker/src/businesses/*/skill.ts` | know-how + SOP 正文（渐进披露 L1/L2） | 领域专家 |
| **SOP（双轨）** | skill 正文 + `workflow` 字段 | 柔性轨=loop 自主；刚性轨=Workflow | PM/业务 |

边缘适配 **Connector**（`harness/contracts/connector.ts`）：ingress/egress 槽位，P0 未实现（hello 走 Agents 自带 chat）。

```
worker/src/
├─ index.ts                 ← 入口：导出 DO + Workflow + Hono app(default)
├─ app.ts                   ← Hono：CORS + /api + fallthrough(agent ?? ASSETS)
├─ routes/api.ts            ← REST：POST /api/workflow、GET /api/runs
├─ harness/                 ← Layer 1，零业务，只 import ../registry
│  ├─ runtime.ts            · UniversalAgent extends Think（loop 载体）
│  ├─ assembly.ts           · 从 D1 agent_config 装配 + 过滤 tools/skills
│  ├─ tool-dispatch.ts      · ToolDef[] → AI SDK ToolSet（执行前过门控）
│  ├─ skill-loader.ts       · L1 目录注入 + L2 按需取回工具
│  ├─ gating.ts             · 不可逆动作门控挂载点（P0 默认放行）
│  └─ contracts/            · ToolDef / Connector（DIP 抽象端）
├─ businesses/hello/        ← Layer 3，业务只写这层
│  ├─ tools.ts  workflow.ts  skill.ts
└─ registry.ts              ← 组合根：聚合各业务，harness 与 businesses 的唯一接缝

ui/                         ← 前端（pnpm workspace 包 universal-agent-ui）
├─ src/App.tsx              · useAgent + useAgentChat 聊天(柔性轨) + runs 面板(刚性轨)
├─ vite.config.ts          · dev proxy /agents(ws) + /api → :8787
└─ index.html  main.tsx  styles.css
```

## 跑起来（P0）

> ⚠️ 用 **pnpm**，不要用 npm。`agents`/`@cloudflare/think` 的深层 peer 依赖图会触发 npm 的 Arborist bug（`Cannot read properties of null (reading 'matches')`）；pnpm 正常。

```bash
cd universal-agent
pnpm install                       # 已验证：260 包，tsc 干净通过

# 1) 建 D1，把返回的 database_id 填回 wrangler.jsonc 的 REPLACE_WITH_YOUR_D1_ID
npx wrangler d1 create universal-agent-db

# 2) 应用 migrations（建 4 张注册表 + runs 表 + seed hello 业务）
pnpm run db:migrate            # 本地
# pnpm run db:migrate:remote   # 远端

# 3) 配置 DeepSeek key
cp .dev.vars.example .dev.vars   # 填入 DEEPSEEK_API_KEY

# 4) 启动（先 build 前端 → 并行起 worker(:8787) + vite(:5173)）
pnpm run dev
```

打开 **http://localhost:5173**：左侧 chat（柔性轨，连 `UniversalAgent`），右侧 runs 面板（刚性轨，轮询 `/api/runs`）。Vite 把 `/agents`(ws) 和 `/api` 代理到 worker:8787。

### 验证 P0（也可不开前端，直接打 API）

```bash
# 触发刚性轨 Workflow
curl -X POST "http://localhost:8787/api/workflow?topic=universe"
# → {"instanceId":"...","status":"started"}

# 等 ~6s 后看落库结果（证明 step.do + sleep + D1 端到端）
curl "http://localhost:8787/api/runs"
# → [{"id":"...","kind":"hello","payload":"Hello, universe!",...}]
```

agent loop（柔性轨）经 Agents chat 协议路由到 `UniversalAgent`（前端 `useAgent` 已接）；它会按 `hello_demo` skill 的 SOP 决定走 loop 还是起 Workflow。

> 已验证：`pnpm install`(workspace) + worker `tsc` + ui `tsc` + `vite build` 全绿。未跑真实 `wrangler dev`（需 D1 + key）。

## 加一个新业务（OCP，harness 零改）

1. `worker/src/businesses/<name>/`：写 `tools.ts` / `skill.ts` /（可选）`workflow.ts`、`connectors/`。
2. `registry.ts`：import 并 push 进 `ALL_TOOLS` / `ALL_SKILLS`；`index.ts` 导出新 Workflow；`wrangler.jsonc` 加 Workflow 绑定。
3. `migrations/`：业务表 + 一行 `agent_config`。
4. **`worker/src/harness/` 一行不改**（`grep -r businesses worker/src/harness` 应为空）。

## ⚠️ 落地注意

- 版本已审计并锁定一套互相兼容的组合：`@cloudflare/think@0.7.3` / `agents@0.13.3` / `ai@6.0.194` / `zod@4.4.3` / `hono@4.12` / 前端 `@cloudflare/ai-chat@0.6.2` + `react@19` + `vite@7`。peer 全满足，worker/ui `tsc` + `vite build` 全绿。
- `@cloudflare/think` **必须** `experimental` compat flag（已在 `wrangler.jsonc`）。
- DO binding 名 = class 名 `UniversalAgent`（Agents SDK 路由约定）；前端 `useAgent({ agent: "UniversalAgent" })` 据此连。
- `wrangler.jsonc` 的 `database_id` 是占位符，必须替换。
- `getModel` 用 DeepSeek OpenAI-compatible API；换 Workers AI 则改 `runtime.ts` + 加 `ai` 绑定。
- P0 未接 cron / Connector / 审批 —— 见 docs/08 路线 P1–P3。

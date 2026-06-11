# 01 · CF 云上通用 Agent · 模块架构蓝图

> 状态：规划稿（**只规划，不动代码**）· 日期：2026-06-03
> 综合来源：本仓现状 + `../../talent-agent/docs/07,08` + 调研过的 harness：pi、iii、fastclaw、mason、app-cuecue、hermes-agent、CF Agents/Think、Claude managed-agents。
> 视角：**harness**。原则：**优先用 CF 官方原语，不手搓基础设施**（CLAUDE.md）。

## 0. 一句话哲学

> **外围可插拔、内核稳定**（hermes）+ **配置驱动装配**（talent/docs/08）+ **CF 平台吸收基础设施**（DO=多租户隔离、Workflows=可靠长流程、D1=存储+FTS、AI Gateway=可观测）。
> 一个「完整」通用 agent ≠ 更大的 loop，而是 **loop 之外那一圈能力**：记忆/学习、调度、子 agent、门控、连接器、可观测。

---

## 1. 模块全景（分层）

```
┌─ Surfaces ──────────────────────────────────────────────────────────┐
│ 17 HTTP/API(Hono)   18 前端(useAgentChat)   19 可观测(AI Gateway logs) │
├─ Edge / Connectors（I/O 边缘，会随业务变）─────────────────────────────┤
│ 12 Ingress(webhook/Queue/cron)  13 Egress(IM/报告)  14 Channels  15 MCP │
├─ Harness Core（零业务，CF 之上的引擎）────────────────────────────────┤
│ 1 Agent loop   2 工具系统   3 技能系统   4 上下文引擎                   │
│ 5 记忆引擎     6 学习闭环   7 调度       8 子agent                      │
│ 9 配置装配     10 门控/安全 11 模型/provider                            │
├─ Runtime Substrate（CF 官方原语）─────────────────────────────────────┤
│ Durable Objects · Workflows · D1(+FTS5) · Queues · this.schedule       │
│ AI Gateway+Workers AI · Vectorize · R2 · KV                            │
└─────────────────────────────────────────────────────────────────────┘
       业务模块(16)：每业务一包 tools/skills/workflows/connectors/schema/config
```

---

## 2. 模块逐项：职责 × CF 原语 × 参考 × 现状 × 解决思路

| # | 模块 | 职责 | **CF 官方原语** | 参考设计 | 现状 | 解决思路 |
|---|---|---|---|---|---|---|
| 1 | **Agent loop** | 规划→调工具→观察→循环 | `@cloudflare/think`、`agents` Agent | hermes ReAct+iteration budget；pi agentLoop；fastclaw 手写护栏 | ✅ Think 内置 | 加 **loop guardrails**（连续失败/重复同 tool call 断路）挂 `afterToolCall` |
| 2 | **工具系统** | 注册/分发/门控 | AI SDK `tool()` + 自建 ToolDef registry | hermes 自注册+**toolsets 场景分发**；mason ToolDeps 窄注入 | ✅ registry/dispatch（已窄注入） | 加 **toolsets**：按场景给工具子集（`enabled_tools` 已雏形）+ check-fn 可用性 |
| 3 | **技能系统** | know-how 渐进披露 | 自建 + **R2/D1** 存储 | mason OD bake(构建期)；hermes SKILL.md+references/templates/scripts；Anthropic Skills | ⚠️ 静态 L1/L2 | 加 **L3 资源** + **可写 skill 存储**(D1/R2) → 支撑学习闭环 |
| 4 | **上下文引擎** | 短期 history/压缩/缓存 | `agents` **Sessions(FTS)** + resumable streaming + `maxPersistedMessages` | hermes context_compressor(结构化摘要+token 预算+尾部保护)；fastclaw/mason RawAssistant 保 cache | ⚠️ 有 Sessions 未充分用 | `configureSession` 注册 context blocks + 配 `maxPersistedMessages` + 压缩；保持 prompt 前缀稳定(cache) |
| 5 | **🌟记忆引擎** | 长期/跨会话/用户模型 | **D1 FTS5** + **Vectorize** | hermes **FTS5 session_search(零LLM)** + MEMORY/USER 冻结快照 + Honcho 用户建模；managed-agents event log | ❌ **无** | D1 FTS5 `session_search` 工具 + `memory`/`user` 表(冻结快照注入) + nudge；语义召回选配 Vectorize |
| 6 | **🌟学习闭环** | 自创建/自改进 skill | **this.schedule / Workflows**（后台 review） | hermes **nudge→后台 review fork→自创建 skill(4 层偏好)→curator 伞形合并** | ❌ 无 | nudge 计数 → `this.schedule` 或 Workflow 触发后台 review → 写 skill(D1) → 定期 curator 合并 |
| 7 | **调度** | 定时/不漏长流程 | `this.schedule`(cron/Date) + **Workflows**(sleepUntil/waitForEvent) | hermes cron(60s tick+多渠道投递)；CF Workflows | ✅ 原语 / ⚠️ `schedules` 未接线 | `agent_config.schedules` 装配；不漏流程走 Workflow |
| 8 | **子 agent** | 委派/并行 | `Think` subAgent | hermes delegate(隔离不泄露父史+depth 限制+成本上卷) | ❌ 未用 | 暴露 `delegate` 工具，隔离 + 成本汇聚到父 |
| 9 | **配置装配** | config-driven | **D1** + KV 缓存 | talent agent_config(INV5)；managed-agents 版本化 Agent | ✅ 4 注册表 | 已有；可加 KV 缓存 + 版本化 |
| 10 | **门控/安全** | 不可逆动作审批 | **Workflow `waitForEvent`** + Think `beforeToolCall` | hermes 三层信任(OS 隔离+启发式+凭证隔离)；managed-agents approval-gate | ⚠️ stub | `gate()` 对 `mutating` 工具走 Workflow 审批；外联 allowlist |
| 11 | **模型/provider** | 路由/容错/缓存 | **AI Gateway** + Workers AI | hermes 凭证池+fallback model+api_mode；mason `gateway.getUrl` | ⚠️ 直连 OpenRouter | getModel 走 **AI Gateway**(缓存/日志/成本/fallback)；per-action 模型预设 |
| 12 | **Ingress** | 外部→agent | Workers `fetch` + **Queues** + cron | hermes gateway；fastclaw bus；docs/08 Connector | ⚠️ 契约无实现 | webhook/Queue/cron → `Connector.Ingress`；解析不到 owner 即丢弃(多租户安全) |
| 13 | **Egress** | agent→外部 | `fetch` + bindings(R2/Email/…) | hermes 多渠道投递 | ⚠️ 契约 | IM/报告/写表 → `Connector.Egress` |
| 14 | **Channels** | IM 适配 | 自建 adapter | hermes **PlatformRegistry(注册表+工厂)** | ❌ | 注册表+工厂模式；Lark 首个实现(从 talent 移植) |
| 15 | **MCP** | 接外部工具/对外暴露 | `agents` MCP client + `McpAgent` | hermes `mcp serve`；CF McpAgent | ❌ 预留 | `agent_config.mcp_servers` 装配；可 `McpAgent` 对外暴露 |
| 16 | **业务模块** | 每业务一包 | — | docs/08 `businesses/` | ✅ hello | 加 talent / insight |
| 17 | **HTTP/API** | 对外 REST/SPA | Workers + **Hono** | app-cuecue/mason Hono(routeAgent ?? assets) | ✅ Hono | 已有 |
| 18 | **前端** | chat + 工具渲染 | `useAgent`/`useAgentChat` | app-cuecue 设计体系+面板分层 | ✅ 已搬 | 已有(chat+runs) |
| 19 | **可观测** | events/cost/trace | **AI Gateway logs** + Workers Analytics + Tail Workers | iii 自动 OTel；hermes 成本上卷 | ❌ | AI Gateway 日志 + `events` 表 + 成本记账 |
| 20 | **存储/产物** | 文件/二进制 | **R2** | mason git-in-DO SQLite | ⚠️ 仅 D1 | R2 存简历/报告/附件等产物 |
| 21 | **语义检索** | embedding 召回 | **Vectorize** | hermes 用 FTS5 起步 | ❌ | 选配；FTS5 先够用，需语义再上 Vectorize |

---

## 3. 该「白嫖」的 CF 官方能力（不要手搓）

| CF 提供 | 替代了自己造的什么 | 用在模块 |
|---|---|---|
| **Durable Objects** | 多租户隔离 + per-tenant 惰性实例（替 hermes gateway/sandbox 一半） | 1,9 |
| **`@cloudflare/think`** | streamText loop + 工具执行 + 消息持久化 | 1,4 |
| **Workflows** | 不漏的多步长流程 + 审批等待（碾压 fastclaw 内存 taskqueue） | 6,7,10 |
| **D1 + FTS5** | 关系存储 + **跨会话全文召回**（hermes 同款，零 LLM） | 5,9 |
| **Queues** | ingress fan-in / 异步（替内存 bus） | 12 |
| **`this.schedule`** | cron/一次性定时（替手搓调度表） | 7,6 |
| **AI Gateway** | 缓存 + 全链路日志 + 成本 + fallback 路由 | 11,19 |
| **Vectorize** | 语义记忆 embedding | 5,21 |
| **R2 / KV** | 产物存储 / 配置缓存 | 20,9 |
| **useAgent/useAgentChat** | 前端聊天协议 + resumable | 18 |
| 官方示例 | `think-workflows`(双轨)、`human-in-the-loop`(审批)、`agents-starter`(门控) | 参考 |

> 净效果：hermes 手搓 ~22 个 Python 模块的外围，**CF 上一半被平台原语吸收**——universal-agent 的核心模块应远比 hermes 薄，这是正确的，不是缺失。

---

## 4. 专章：记忆 / 学习闭环（最大缺口的 CF 落地）

hermes 的闭环 = **nudge(触发) → 后台 review(推断) → 持久 store(持久) → curator(整理)**。CF 原生映射：

```
短期上下文   ← Sessions(FTS) + resumable（已有，未充分用）
长期事实     ← D1 表 memory(agent 笔记) / user(用户模型)，冻结快照注入 system prompt（保 prefix cache）
跨会话召回   ← D1 FTS5 的 session_search 工具（DISCOVERY/SCROLL/BROWSE 三模式，零 LLM）
语义召回     ← Vectorize（选配）
触发         ← turn/iteration 计数 nudge（hermes 同款）
后台学习     ← this.schedule 或 Workflow 触发 review（替 hermes 后台线程 fork）
可写 skill   ← D1/R2 存 skill 正文，review 时 patch/create
整理         ← 定期 curator（Workflow）伞形合并，避免微观 skill 爆炸
```

⚠️ **别学 fastclaw 的关键词 grep heartbeat**——记忆抽取走 **LLM 结构化抽取 + FTS 召回**。

---

## 5. 分阶段路线（验证驱动，不一次全做）

| 阶段 | 内容 | 为什么先它 |
|---|---|---|
| **P-now** | 已完成：harness 骨架 + hello 业务 + Hono + 前端设计体系 + SOLID 重构 | 基线 |
| **A** | **上下文引擎补全**：`configureSession` context blocks + `maxPersistedMessages` + AI Gateway 接入 | 低成本、立刻提升可观测/缓存 |
| **B** | **记忆引擎**：D1 FTS5 `session_search` + memory/user 表 + nudge | 最大价值缺口、CF 原生 |
| **C** | **健壮性**：loop guardrails + sub-agent delegate + model fallback | 低成本立竿见影 |
| **D** | **学习闭环**：后台 review(Workflow) + 可写 skill + curator | 重，B 之上，hermes 核心卖点 |
| **E** | **Connector 落地**：Lark ingress/egress（驱动：talent 业务进来） | 第二业务驱动 |
| **F** | gating 审批 + MCP 装配 + Vectorize 语义记忆 | 按需 |

## 6. 明确不做（CF 上 N/A 或投机）

- ❌ **可插拔执行后端**（local/docker/ssh/modal/daytona）——CF Workers **本身就是运行时**，无 shell/沙箱后端概念。
- ❌ **轨迹压缩训练 / batch 数据生成**——研究设施，非产品 agent。
- ❌ iii 式 worker 总线 / hermes 式多进程 gateway——DO + Queues 已是 CF 原生等价物。
- ❌ 为想象中第三业务预留模块——等它出现。

---

## 7. 一句话总结

CF 云上通用 agent 的模块架构 = **CF 原语作底座 + 11 个 harness 核心模块（loop/工具/技能/上下文/记忆/学习/调度/子agent/配置/门控/模型）+ Connector 边缘 + 业务包 + 前端**。其中 **9 个核心模块 CF 已提供现成原语或我们已有雏形**，真正待补的核心是 **记忆引擎(5) + 学习闭环(6)**——这正是 hermes 之所以「完整」的地方，且在 CF 上（D1 FTS5 + Workflows + this.schedule）原生可落地。

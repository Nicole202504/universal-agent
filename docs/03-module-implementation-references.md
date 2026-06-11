# 03 · docs/01 模块 → 具体实现参考地图

> 状态：实现参考（**只调研，不动代码**）· 日期：2026-06-03
> 来源：每模块一个并行 agent，读 hermes(`/tmp/hermes-agent`, MIT) + pi(`/tmp/pi`) + CF 官方 agents 文档。
> 配套：`docs/01`(模块架构) · `docs/02`(Managed Agents 对照)。

## 0. 重大发现：CF Agents 原生覆盖比 docs/01 假设的多

调研推翻了 docs/01 的几个「待自建」判断——**以下模块 CF 已有原生原语，应直接用、不要照 hermes 手搓**：

| 模块 | docs/01 原判断 | 实际 CF 原生提供 |
|---|---|---|
| 3 技能 | 「CF 无原生 skill，自建」 | ❌ 错 —— `agents/skills`：`getSkills()`(bundled 或 R2 源) + `activate_skill`/`read_skill_resource`/`run_skill_script` 内置工具 |
| 4 上下文 | 「Sessions 未充分用」 | **Sessions** 全套：`withContext()` 四类 provider + `onCompaction(createCompactFunction{protectHead,tailTokenBudget})` + `freezeSystemPrompt()` + `compactAfter()` |
| 5 记忆 | 「无」 | Sessions `SearchProvider`(FTS5 `search_context`) + DO/D1 `this.sql` 可建任意 FTS5 表 |
| 7 调度 | 「原语已有」✅ | 确认 `this.schedule`(秒/Date/cron) + `scheduleEvery`(overlap 保护) + 列举/取消，**完全替代 hermes 手搓 cron** |
| 8 子 agent | 「Think subAgent 未用」 | `subAgent()` + 独立 SQLite 隔离 + `agentTool()`/`runAgentTool()`(run registry/流帧/abort/UI) |
| 15 MCP | 「预留」 | client `addMcpServer`/`mcp.getAITools` + server `McpAgent.serve` |

> **结论**：universal-agent 的核心引擎应是「**薄装配层 + CF 原语**」。真正要从 hermes 移植算法的，只有 CF 没做的：**loop guardrails、记忆/学习闭环算法、连接器注册表、toolsets 分发、凭证轮换**。

## 1. 逐模块实现参考表

> 格式：模块 | hermes(file:line) | pi | **CF 原生** | 移植一句话

| # 模块 | hermes 参考 | pi 参考 | CF 原生原语 | 移植 |
|---|---|---|---|---|
| **1 Agent loop** | `agent/conversation_loop.py:351,796`(循环+预算) · `agent/tool_guardrails.py:224`(**断路器**:工具名+参数哈希,重复失败/幂等停滞分级) | `packages/agent/src/agent-loop.ts:155`(runLoop) · before/afterToolCall hook | Think loop + 8 hooks(`beforeTurn{maxSteps}`/`beforeToolCall{block}`/`afterToolCall` 观察) | 搬 hermes `ToolCallGuardrailController` 到 DO：`afterToolCall` 记账(哈希计数)，下次 `beforeToolCall` 返回 block 断路(CF after 只能观察)；`beforeTurn.maxSteps` 当迭代预算 |
| **2 工具系统** | `tools/registry.py:57`(AST 自注册)+`:110-148`(**check-fn TTL 30s**) · `toolsets.py:606`(`resolve_toolset` 递归+cycle 检测) | `packages/agent/src/types.ts:361`(AgentTool) | AI SDK `tool()` + `needsApproval` | 已有 registry；加 `ToolDef.toolset` + 静态 TOOLSETS 表 + check-fn(出口过滤,TTL 缓存)。**别抄 distributions**(训练用) |
| **3 技能系统** | `agent/skill_commands.py:160-260`(L2/L3:枚举 references/templates/scripts+绝对路径注入) · `skill_utils.py:88`(frontmatter) | `packages/coding-agent/src/core/skills.ts:335`(L1 XML 注入,纯只读) | **`agents/skills`**:`getSkills()`+R2 源+`read_skill_resource`/`run_skill_script` | 直接用 CF `agents/skills`；可写 skill = R2 PUT + 自定义 `getSkills()` 源；D1 只存 L1 索引。**别把 L2/L3 塞 D1 行** |
| **4 上下文引擎** | `agent/context_compressor.py:522`(头保护+尾 token 预算+tool 对齐+结构化摘要迭代更新) | `packages/agent/src/agent-loop.ts:284`(transformContext→convertToLlm 读侧两段) | **Sessions**:`.withContext()`+`.onCompaction(createCompactFunction{...})`+`.withCachedPrompt()`+`freezeSystemPrompt()`+`.compactAfter()` | **直接用 Sessions**，`createCompactFunction` 已内置 hermes 那套；仅需要廉价预压缩(工具结果去重)时在 summarize 回调补 |
| **5 记忆引擎** | `tools/session_search_tool.py:378`(三模式) · `hermes_state.py:320`(`messages_fts`+`messages_fts_trigram` CJK!) · `tools/memory_tool.py:132`(MEMORY/USER **冻结快照**) | 无 FTS(JSONL 线性扫,反例) | Sessions `SearchProvider`(`search_context`) · DO/D1 `this.sql` 建 FTS5(D1 支持 fts5,含 trigram) | `this.sql` 建 `messages`+`messages_fts`(+trigram 中文)+trigger；`session_search` 工具三模式纯 SQL 零 LLM；MEMORY/USER 用 D1 表+冻结快照注入 system prompt |
| **6 学习闭环** | `conversation_loop.py:4697`(nudge 计数) · `background_review.py:70-100`(**4 层 skill 偏好**)`,402-484`(后台 fork,复用父 prompt 省26%) · `curator.py:358-442`(**前缀聚簇伞形合并**) | 无(纯只读加载器,反例) | `runWorkflow()` + `this.schedule("0 3 * * *",...)` | **dreams 模式**:Workflow 跑离线巩固(只读输入→**新** D1 表)，schedule 夜触发，门控采纳。借 hermes 的 nudge 计数+4层偏好+curator 伞形 prompt 当算法 |
| **7 调度** | `cron/jobs.py:209`(parse)`,376`(next-run)`,983`(advance-before-run) · `cron/scheduler.py:1865`(tick+文件锁) | 无 | **`this.schedule`**(秒/Date/cron)+`scheduleEvery`+列举/取消，重启存活、幂等 | 不搬 hermes 基建；只借装配语义：`agent_config.schedules` 遍历调 `this.schedule`。不漏长流程走 Workflow |
| **8 子 agent** | `tools/delegate_tool.py:1918`(ThreadPool)`,1106`(隔离:ephemeral prompt/skip_memory)`,2256`(**成本上卷**) · `code_execution_tool.py`(RPC 工具链塌缩) | `coding-agent/examples/extensions/subagent/index.ts`(独立进程+NDJSON 成本汇聚) | `subAgent()`+独立 SQLite · `agentTool()`/`runAgentTool()` | 用 `runAgentTool()` 暴露 `delegate` 工具，隔离白拿；**成本上卷自己补**(照 hermes `:2256` 在 run 事件帧抓 usage 累加) |
| **10 门控/安全** | `tools/approval.py`(审批状态机:contextvars 防跨会话提权,session/yolo/permanent 三档) · `SECURITY.md`(三层信任:OS 隔离=唯一真边界) · `tools/env_passthrough.py`(凭证剥离) | `types.ts:262 beforeToolCall{block}` · `agent-loop.ts:581`(调用点) | `needsApproval` + `state:"approval-required"` + `addToolApprovalResponse` · Workflow `waitForEvent` | `gating.ts` 对 mutating 走审批：同步危险模式直接 block(hermes hardline)；人工确认走 CF `needsApproval`；长挂起走 Workflow。审批态 per-session 隔离 |
| **11 模型/provider** | `providers/base.py:38`(ProviderProfile) · `agent/credential_pool.py:448`(**多 key 轮换**) · `run_agent.py:3658`(fallback 链) | `packages/ai/src/providers/cloudflare.ts`(**AI Gateway provider 样板**:改 baseURL+`cf-aig-authorization` 头) · `models.ts:39 calculateCost` | **AI Gateway**:缓存(`cf-aig-cache-ttl`)/日志/Analytics · Universal Endpoint(数组 fallback+`maxAttempts/backoff`) | getModel 走 `env.AI.gateway(id).getUrl(provider)`(照 pi `resolveCloudflareBaseUrl`)；跨 provider fallback 用 Universal Endpoint 数组；多 key 轮换抄 hermes CredentialPool |
| **12-14 连接器** | `gateway/platform_registry.py:38`(**PlatformEntry 工厂**)`,162`(注册表 last-writer-wins) · `platforms/base.py:1764`(BaseAdapter:connect/send) · `session.py:600`(`build_session_key` 连续性) | 无(CLI,反例) | `routeAgentRequest`/`getAgentByName`(ingress) · `this.queue`(削峰) | 建 `ConnectorRegistry`(对标 PlatformRegistry,工厂+能力声明)；`agent_config.connectors` 声明启用；Lark 首实现=把现有 webhook+lark-api 收敛进 `Connector` 接口 |
| **15 MCP** | `tools/mcp_tool.py`(client,3 transport+重连) · `mcp_serve.py:450`(FastMCP server) · `optional-mcps/*/manifest.yaml`(**目录化声明**) | 无(`README:478 "No MCP"`,反例) | client `this.addMcpServer`/`mcp.getAITools` · server `McpAgent.serve("/mcp")` | `agent_config.mcp_servers`(仿 hermes manifest)→`addMcpServer` 逐条连→`getAITools` 注入 loop；对外暴露用 `McpAgent` |
| **19 可观测** | `hermes_state.py:1134`(`update_token_counts` SQL `+=` 上卷,estimated/actual 双轨) · `hermes_logging.py:76`(session-tag record factory) | `packages/ai/src/types.ts:265`(`Usage.cost{}`) · `models.ts:39`(calculateCost) | diagnostics-channel(13 channel)+**Tail Worker** · AI Gateway logs/GraphQL(token/cost) | 模型调用走 AI Gateway 拿 cost；diagnostics events 经 Tail Worker 落 D1 events 表；session 级成本 `+=` 上卷(hermes 风格) |
| **20/21 存储+语义** | `tools/file_operations.py:317`(FileOps 抽象,路径不写死) · FTS5 非向量 | `auth-storage.ts:17`(原子写+锁样板) | **R2**(`env.BUCKET.put/get`) · **Vectorize**(`insert/query` topK) | 产物用 R2(key=`candidates/{id}/resume.pdf`)；语义召回 Vectorize 选配，**D1 FTS5 先够用**；FTS5 粗召回+Vectorize 精排可并存 |

> 已完成模块(9 配置装配 ✅ / 16 业务 ✅ / 17 Hono ✅ / 18 前端 ✅)不在此表。

## 2. 「用 CF 原生」vs「从 hermes 移植算法」清单

**🟢 直接用 CF 原生（薄装配层即可）**：技能(`agents/skills`)、上下文(Sessions+createCompactFunction)、调度(this.schedule)、子 agent(subAgent/runAgentTool)、MCP(addMcpServer/McpAgent)、模型容错(AI Gateway Universal Endpoint)、存储(R2)、可观测(diagnostics+Tail Worker+AI Gateway)。

**🔧 需从 hermes 移植算法（CF 没做）**：
1. **loop guardrails**（`tool_guardrails.py` 断路器）→ DO 上 after 记账+before 断路
2. **session_search + MEMORY/USER**（`session_search_tool.py`+`memory_tool.py` 冻结快照）→ this.sql FTS5
3. **学习闭环算法**（`background_review.py` 4层偏好 + `curator.py` 伞形合并）→ Workflow dreams 模式
4. **toolsets 分发 + check-fn**（`toolsets.py`+`registry.py`）→ ToolDef 加 toolset 字段
5. **连接器注册表**（`platform_registry.py` 工厂）→ ConnectorRegistry
6. **凭证轮换**（`credential_pool.py`）→ getModel 容错

**📋 借 pi 的样板**：`providers/cloudflare.ts`（AI Gateway 接入最小改动）、`Usage.cost`+`calculateCost`（成本结构）、before/afterToolCall hook 形态。

## 3. 对 docs/01 的修正

- 模块 3/4/5/8/15 改注「CF 原生提供」（见 §0 表），不再标「自建」。
- 记忆引擎(5)：CF Sessions 的 `SearchProvider` 已给 FTS5 `search_context`——可先用它，深度定制(三模式/trigram CJK)再下沉到 `this.sql` 自建。

## 4. 第一段代码建议（最小、独立、CF 原生 + 一点 hermes 算法）

**`session_search`（D1/DO FTS5）**仍是最佳起点：
- CF 侧：`this.sql` 建 `messages`+`messages_fts`(+trigram 中文)+trigger（grounded：D1 支持 fts5）。
- hermes 算法：三模式单形状（`session_search_tool.py:378`）+ CJK 路由（`hermes_state.py:2819`）。
- 独立、零 LLM、可单测、即体现「完整 agent」差异（Managed Agents 都没暴露的能力）。

一句话：**这轮把 docs/01 每个模块都钉到了「hermes file:line + pi + CF 原生 + 移植法」，且发现 CF 原生覆盖远超预期——实现将主要是装配 CF 原语 + 移植 6 段 hermes 算法。**

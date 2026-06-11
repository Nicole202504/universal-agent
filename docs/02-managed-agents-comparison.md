# 02 · Claude Managed Agents 深度解析 × 我们 CF 通用 Agent 对照

> 状态：分析稿（**只分析，不动代码**）· 日期：2026-06-03
> 原始文档已落地：`/Users/lafe/Documents/mtPorject/2026project/_refs/claude-managed-agents/`（18 页：overview/quickstart/agent-setup/sessions/session-operations/tools/skills/reference/memory/vaults/files/mcp-tunnels/dreams/self-hosted-sandboxes/multi-agent/engineering-blog + 2 篇 CF 博客）。
> 视角：harness。配套：`docs/01`（CF 通用 agent 模块架构）。

## 0. 一句话定位（最重要的 reframe）

> **Managed Agents = Anthropic 托管「大脑（loop）」+ 提供「双手（沙箱）」，你发 event 驱动它。这是我们路线的镜像**——我们在 CF 上**自建 harness**（大脑双手都在 CF）。
>
> 所以对我们：**它不是运行时（控制面锁 Anthropic、无 ZDR/HIPAA、无 Workflow 级 durable 编排），而是「Anthropic 自己对 harness 该有什么」的权威设计参考。** 它的内核架构（engineering blog）几乎可 1:1 映射到 CF 的 DO+D1 harness。

## 1. Managed Agents 全貌

**4 个一等概念**：Agent（model+system+tools+mcp+skills 的**版本化声明式配置**）× Environment（执行面：云沙箱 / 自托管）→ Session（运行实例）← Events（双向事件流驱动）。

**harness 内核（engineering blog，4 条金句）**：
1. **大脑/双手解耦**：loop 不住在容器里，把容器当工具 `execute(name,input)→string`；容器从 pets 变 cattle，可独立失败/替换。
2. **append-only event log = 唯一真相源**：`emitEvent` 追加、`getSession/getEvents` 读；harness 因此可无状态。
3. **无状态 harness + `wake(sessionId)`**：崩溃后新实例从日志续跑，状态全在日志、不靠内存。
4. **读侧组织上下文**：session 存 raw events，harness 喂模型前 transform → 同序列在不同 resume 间一致重组 → **高 prompt cache 命中**；compaction/trimming 边界在 **harness 层而非数据层**。

## 2. 对照表（Managed Agents ↔ 我们 ↔ 裁决）

| 能力 | Managed Agents 设计 | universal-agent 现状 | 裁决 |
|---|---|---|---|
| Agent 配置 | 版本化资源 + 乐观锁 + archive 只读 | D1 `agent_config`（无版本） | 🟢 **借**：加版本/乐观锁/archive |
| 事件模型 | `{domain}.{action}` 五类(user./agent./session./span.) | D1 communications/events | 🟢 **借**：借这套 type 命名 + span.* 记账 |
| 工具 | `agent_toolset`(一把开) + custom(client 执行) + default_config 白名单 | ToolDef registry + AI SDK tool() | 🟢 **借**：toolsets 场景开关 |
| 技能 | 文件式 + 渐进披露 + 20/session + type/skill_id/version + 预置/custom | skill-loader L1/L2 静态 | 🟢 **借**：version 字段 + 20 预算 |
| 上下文 | 读侧组织 + harness 层 compaction + 稳定 prefix | Think Sessions（未充分用） | 🟢 **借**：读侧组织 + 稳定 prefix |
| **记忆** | **memory store**（路径化文档 + 不可变版本 + 30天审计 + read_only 防注入） | ❌ 无 | 🟢🟢 **借**：D1 版本化记忆 + read_only references |
| **离线巩固** | **dreams**（输入只读 store+N transcripts → 产出**新** store，可审查采纳） | ❌ 无 | 🟢🟢 **借**：Workflow 跑巩固、产物门控 |
| 审批门控 | `user.tool_confirmation` + permission policy(HITL) | gating.ts stub | 🟢 **借**：审批协议 → Workflow waitForEvent |
| 凭证 | **vaults**（write-only secret、模型不可见、按 url 运行时注入、session-scoped） | env secret 直传 | 🟢 **借**：凭证隔离、模型不可见 |
| 子 agent | coordinator + roster **版本快照** + MCP agent-scoped/vault session-scoped + 主/子 thread + 阻塞动作 cross-post | Think subAgent 未用 | 🟢 **借**：roster 快照 + 隔离模型 |
| 文件/产物 | Files API → session resources 挂载(只读) | 仅 D1 | 🟡 用 R2 对标 |
| **长流程编排** | 仅 `rescheduling`(瞬态重试)，无 step 级 durable | **CF Workflows**(step.do/sleepUntil/waitForEvent) | ✅ **我们更强**，保持 |
| **定时** | 无 cron/Date 暴露 | `this.schedule` | ✅ **我们更强** |
| **跨会话检索** | conversation history 未暴露 FTS | **D1 FTS5** 可做 session_search | ✅ **我们能做它没有的** |
| 执行沙箱 | 云/自托管沙箱（即给即用） | CF Workers 本身是运行时 | ➖ **N/A**（见 §5） |
| MCP | streamable HTTP + tunnel(回连内网) | agents MCP client + mcp_servers | 🟡 公网 MCP 已够；内网再上 tunnel |

## 3. 该偷的 8 个设计（按价值排）

**A. 内核四件套（engineering blog → 直接塑造我们 harness）**
1. **D1 events 表 = append-only 真相源**：DO 内存态（`_config`/`_tools`）应可从事件日志重建，而非唯一依赖内存 → 抗 DO eviction。
2. **读侧组织上下文 + 稳定 prefix**：`getSystemPrompt/getTools` 在读取时组织，skill 目录稳定排序，别每 turn 重排 → 高 prompt cache。
3. **compaction 边界在 harness 层**：D1 存 raw，压缩逻辑在读事件时施加，数据层不动。

**B. 记忆/学习闭环（dreams + memory store → 填我们最大缺口）**
4. **dreams 模式 = 我们的记忆巩固**：用 **Workflow** 跑离线 job（吃只读记忆 + N 个 session transcript → 产出**新** D1 记忆表），`this.schedule` 夜间触发；**不可变输入 + 可审查产物 + 门控采纳**——比 hermes 后台 fork 更安全（产物隔离、可丢弃）。这同时覆盖 docs/01 的 **记忆引擎(5)+学习闭环(6)**。
5. **memory store = 版本化路径化文档**：D1 记忆表带 `version`+审计；参考类记忆挂 `read_only` 防 prompt 注入投毒。

**C. 安全/凭证/审批**
6. **vaults 凭证隔离**：secret write-only、模型上下文永不可见、运行时按目标注入、session-scoped（一份 agent 配置 + 多租户各自凭证）。
7. **tool_confirmation 审批协议**：block 工具 → 发确认请求 → 等 → 续跑，正好映射 Workflow `waitForEvent`；是 gating 模块的标准范式。

**D. 能力 schema**
8. **借 schema 三件套**：skill `{type, skill_id, version}` + 20/session 预算；tool `agent_toolset`/`custom` discriminated union；event `{domain}.{action}` + `span.*` 带 `model_usage` 记账。

## 4. 我们 CF 原生更强 / 它没有的

- **可靠长流程**：它只有 `rescheduling`（瞬态重试），**没有 step 级 durable 编排**；CF **Workflows** 完胜（dreams 这种长 job 我们正好用 Workflow 跑）。
- **定时**：它无 cron 原语；`this.schedule` 是我们的。
- **跨会话 FTS 召回**：它的 conversation history 不暴露检索；**D1 FTS5** 让我们能做 hermes 式 `session_search`——这是它作为「记忆」反而缺的原语。
- **数据平台**：CF 统一数据平台（Town Lake/Skipper）给了完整记忆栈（R2 Iceberg + D1 + Vectorize + Workflows + Workers AI），见 §7。

## 5. 明确 N/A（别混路线）

- ❌ **self-hosted sandboxes / environments / CLI worker / MCP tunnels**：这是「**让 CF Sandbox 当 Anthropic 托管 agent 的执行后端**」那条**反向产品线**（`cloudflare/claude-managed-agents` repo + `developers.cloudflare.com/sandbox/claude-managed-agents/`）。我们是 CF 上自建 harness，loop 和工具执行天然在 CF，不需要把自己当 Anthropic 的 sandbox。两套别混。
- ❌ 把 Managed Agents 当运行时：控制面锁 Anthropic、不支持 ZDR/HIPAA、无 Workflow 级编排——与我们 harness-native 路线相悖。

## 6. 落到 docs/01 模块的更新

| docs/01 模块 | 本次 Managed Agents 给的具体设计 |
|---|---|
| 4 上下文引擎 | 读侧组织 + harness 层 compaction + 稳定 prefix（engineering blog） |
| **5 记忆引擎** | memory store 版本化 + read_only references + D1 FTS5（我们独有）+ 事件日志真相源 |
| **6 学习闭环** | **dreams 模式**：Workflow 离线巩固、不可变输入、可审查产物、门控采纳 |
| 9 配置装配 | agent 配置**版本化 + 乐观锁 + archive 只读** |
| 10 门控/安全 | `tool_confirmation` 审批协议 → Workflow `waitForEvent`；**vaults 凭证隔离（模型不可见）** |
| 8 子 agent | roster **版本快照** + MCP agent-scoped/vault session-scoped + 主/子 thread + 阻塞动作 cross-post |
| 19 可观测 | `span.*` + `model_usage` token 记账 |

## 7. CF 统一数据平台 → 我们记忆层怎么搭

CF 用自家产品自建数据 agent（Town Lake 湖仓 + Skipper agent），对我们记忆引擎的直接启发：
1. **记忆分层 grounding**（Skipper 五层）：别只喂 schema——尤其「**代码派生知识**（产生数据的真实逻辑）」准确率提升最大。对我们：D1+FTS5 存事实、R2 存产物/派生文档、Vectorize 语义召回、再加人工标注层。
2. **default-closed 治理**：未审不可查、PII 默认 redact、time-bound 授权、每查审计 → 对齐「门控不可逆」。
3. **Code Mode 启发 loop**：MCP 只暴露 `search`/`execute` 两个 meta-tool，模型写 JS 在 isolate 串联多步、单次往返——比 30 个独立 tool 更快更省，且「工作流即可审计代码」。可作我们 agent loop 的参考。

## 8. 一句话总结

Managed Agents 是 Anthropic 对「agent harness 该有什么」的**权威答卷**，但作为产品是我们路线的**镜像（它托管、我们自建）**。我们**偷它的设计、不用它的运行时**：内核四件套（事件日志真相源 + 读侧上下文 + harness 层 compaction + wake 恢复）直接塑造 CF harness；**dreams + memory store + vaults + tool_confirmation** 填我们 docs/01 的记忆/学习/门控/凭证模块；而 **Workflows / this.schedule / D1 FTS5** 是我们比它更强、可做它没有之事的地方。

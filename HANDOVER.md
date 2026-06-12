# universal-agent 交接文档

## 一、项目概述

基于 Cloudflare Agents + Workers 的吠陀占星（Vedic Astrology）AI 咨询平台。

**线上地址**: https://universal-agent.sl4224063.workers.dev  
**GitHub**: https://github.com/Nicole202504/universal-agent  
**Render 后端**: https://universal-agent.onrender.com（Python pysweph 计算引擎）

---

## 二、架构

```
用户浏览器
  ↓
Cloudflare Worker (TypeScript)
  ├── DeepSeek API（对话 + 工具调用）
  ├── D1 数据库（配置 + 聊天记录）
  └── Render（Python pysweph 星盘计算）
        ├── pysweph（瑞士星历）
        ├── PyJHora（SAV/Dasha/分盘）
        └── dashaflow（dignity/karakas）
```

## 三、代码位置

```
/Users/lero/Desktop/universal-agent-main 2/
├── worker/src/                     ← Worker 后端（TS）
│   ├── harness/runtime.ts          ← Agent DO + DeepSeek API 调用
│   ├── harness/assembly.ts         ← D1 config-driven 装配
│   ├── businesses/vedic/tools.ts   ← ⭐ vedic 4个工具（核心流程）
│   ├── businesses/vedic/skill.ts   ← ⭐ vedic SOP（验前事强制规则）
│   ├── businesses/hello/           ← demo 业务（可忽略）
│   ├── routes/api.ts               ← REST API（workflow + chat history）
│   ├── registry.ts                 ← 业务注册（OCP）
│   └── types.ts                    ← 全局类型
├── ui/                             ← 前端（React 19 + Vite）
│   ├── src/App.tsx                 ← 根布局
│   ├── src/chat/                   ← 聊天模块
│   │   ├── use-universal-agent-chat.ts  ← useAgent/useAgentChat 适配
│   │   ├── chat-provider.tsx       ← 状态管理 + 自动保存聊天记录
│   │   ├── messages/               ← 消息渲染（Markdown）
│   │   └── layout/                 ← 输入框/布局
│   └── vite.config.ts              ← Vite 配置（代理 /agents /api）
├── python-api/                     ← ⭐ Python 计算引擎
│   ├── Dockerfile                  ← Render 部署用
│   ├── vedic-api-server.py         ← FastAPI（/api/prevalidate /api/full-report）
│   ├── requirements.txt
│   ├── scripts/engine.py           ← 主计算引擎 calculate_full_chart()
│   ├── scripts/formatter.py        ← structured_data.md 生成
│   ├── ephe/                       ← 星历文件（seas_18.se1 等）
│   └── ...
├── migrations/                     ← D1 数据库迁移
│   ├── 0001_init.sql               ← 核心表结构
│   ├── 0002_seed_hello.sql         ← hello + vedic 种子数据
│   ├── 0003_refresh_seed.sql       ← 刷新种子
│   ├── 0004_update_agent_prompt.sql ← Agent persona（印度星盘大师）
│   └── 0005_chat_history.sql       ← 聊天记录表
├── wrangler.jsonc                  ← CF 配置（D1/DO/Workflow）
├── fly.toml                        ← Fly.io 配置（备用）
├── render.yaml                     ← Render 配置
└── start-dev.sh / run.sh           ← 本地启动脚本
```

## 四、核心业务流程（付费设计）

```
用户输入出生数据（日期+时间+地点+经纬度）
  ↓
collect_birth_data 工具 → 调用 Render Python API 排盘
  ↓ 返回 Lagna / Moon / Dasha / SAV=337
  ↓
⚠️ generate_validation_statements（付费触发点，不可跳过）
  ↓ Agent 生成 5 条断言式推断（验前事）
  ↓ 用户回复：准 / 不准 / 部分准
  ↓
evaluate_validation 工具 → 统计命中率
  ↓ ≥4/5 → 信任建立
  ↓
generate_vedic_report → 调用 /api/full-report
  ↓ 生成 9 章 3000+ 字完整报告
```

## 五、关键修复记录

| 问题 | 修复方式 |
|------|---------|
| DeepSeek API 报 `role: developer` 错误 | `runtime.ts` 加 fetch 拦截，`developer→system` |
| `deepseek-v4-pro` 推理模型无回复 | 换成 `deepseek-chat`（实际路由到 deepseek-v4-flash） |
| Render 当 Go 项目编译 | 根目录加 `Dockerfile` + `render.yaml` |
| Agent 不触发验前事 | system prompt 强化 + skill SOP 加硬性规则 |
| 前端 Workflow runs 面板占位 | `App.tsx` 删除 `RunsPanel`，聊天区全屏 |

## 六、本地开发

```bash
# 1. 启动 Python 计算引擎
/tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/venv/bin/python3 \
  /tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/vedic-api-server.py

# 2. 启动 Worker（需要本地 D1 migration）
cd /Users/lero/Desktop/universal-agent-main\ 2
npx wrangler dev --port 8790

# 3. 启动前端（可选，wrangler 自带静态资源）
cd ui && npx vite dev --port 5173

# 打开 http://localhost:8790
```

## 七、部署

### Worker（Cloudflare）
```bash
cd /Users/lero/Desktop/universal-agent-main\ 2
npx wrangler deploy
```

### Python 后端（Render）
- 自动从 GitHub main 分支部署
- Dockerfile 在根目录
- 免费层 512MB，15分钟无请求休眠

### GitHub
```bash
git remote: https://github.com/Nicole202504/universal-agent
# 目前 commit: 1edccf4（main 分支）
```

## 八、环境变量/密钥

| 位置 | 变量 | 值 |
|------|------|-----|
| CF Worker Secret | `DEEPSEEK_API_KEY` | `sk-0b154bb48de24c0692b557db8ed057a6` |
| CF Worker Secret | `VEDIC_API_URL` | `https://universal-agent.onrender.com` |
| 本地 `.dev.vars` | 同上 | 同上 |

## 九、待做事项

1. **聊天记录前端展示** — D1 已存，`GET /api/chat` 可用，前端还没做加载 UI
2. **Render 冷启动优化** — 加 UptimeRobot 定时 ping 防休眠
3. **deepseek-v4-pro 切换** — 当前用 deepseek-chat，回头切推理模型（需调 AI SDK reasoning 参数）
4. **报告输出 HTML** — 目前是 Markdown，vedic-core 有 `report_builder.py` 可接
5. **多用户 session 隔离** — 当前 session_id hardcode 为 "default"
6. **Vedic rectifier 时间校准** — 验前事命中率低时引导校准（已有 Python 代码未接）

## 十、联络人

- Nicole（产品负责人）
- 项目仓库: https://github.com/Nicole202504/universal-agent
- Cloudflare 账号: sl4224063@gmail.com

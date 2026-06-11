-- 通用注册表（docs/08 §4）—— harness 装配的真相源由 D1 配置 + code registry 共同构成。
-- 约定：ToolDef / SkillManifest 的「实现」在 code（registry.ts）；D1 这几张表存「启用开关 + 元数据」。

CREATE TABLE IF NOT EXISTS tool_registry (
  id          TEXT PRIMARY KEY,
  description TEXT,
  input_schema TEXT,
  enabled     INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS skill_registry (
  id           TEXT PRIMARY KEY,
  description  TEXT,   -- L1（注入 system prompt 的目录文案）
  instructions TEXT,   -- L2（按需取回的完整步骤）
  tool_ids     TEXT,   -- JSON string[]
  workflow     TEXT    -- Workflow binding 名；NULL = 柔性轨（loop 内直接做）
);

-- 一行 = 一个 agent 实例（config-driven，docs/08 §4 / talent INV5）
CREATE TABLE IF NOT EXISTS agent_config (
  id            TEXT PRIMARY KEY,   -- 如 'default' / 'group:<id>'
  label         TEXT,
  system_prompt TEXT,
  model         TEXT,
  enabled_tools TEXT,               -- JSON string[]
  enabled_skills TEXT,              -- JSON string[]
  schedules     TEXT,               -- JSON [{cron, target}]（P1 启用）
  mcp_servers   TEXT
);

-- 外部实体 → agent 实例映射（如 chat_id / 抓取源 → agent_config.id）
CREATE TABLE IF NOT EXISTS group_bindings (
  external_id TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  kind        TEXT
);

-- 演示用：Workflow（刚性轨）落地结果，证明端到端跑通
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,
  kind       TEXT,
  payload    TEXT,
  created_at INTEGER
);

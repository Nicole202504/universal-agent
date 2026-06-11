#!/bin/bash
# 一键启动 universal-agent 本地开发环境
# 用法: bash run.sh

set -e
DIR="/Users/lero/Desktop/universal-agent-main 2"
PYTHON="/tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/venv/bin/python3"
API="/tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/vedic-api-server.py"

# 清端口
lsof -ti :8790 | xargs kill -9 2>/dev/null || true
lsof -ti :8900 | xargs kill -9 2>/dev/null || true
sleep 1

# 重建 D1
find "$DIR/.wrangler/state/v3/d1" -name "*.sqlite" -type f -not -name "metadata*" -delete 2>/dev/null || true
cd "$DIR" && npx wrangler d1 migrations apply universal-agent-db --local 2>&1 | grep "✅" || true

# 构建前端
cd "$DIR/ui" && npx vite build 2>&1 | tail -1

# 启动 Python API
echo "🚀 Python API :8900"
nohup $PYTHON $API > /tmp/py-api.log 2>&1 &
sleep 2

# 启动 Wrangler
echo "🚀 Wrangler :8790"
cd "$DIR" && npx wrangler dev --port 8790 &
sleep 8

echo ""
echo "✅ http://localhost:8790"
echo "✅ http://localhost:8900/health"
echo "按 Ctrl+C 停止"
wait

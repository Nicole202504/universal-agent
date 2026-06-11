#!/bin/bash
# 启动 universal-agent 本地开发环境
# Python 计算引擎 (:8900) + Wrangler Dev (:8790)

set -e
cd "/Users/lero/Desktop/universal-agent-main 2"

echo "🚀 启动 Vedic 计算引擎 (:8900)..."
/tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/venv/bin/python3 \
  /tmp/vedic-astro-skills/antigravity/skills/vedic-calculator/vedic-api-server.py &
PY_PID=$!
sleep 2

echo "🚀 启动 Universal Agent (:8790)..."
npx wrangler dev --port 8790 &
WR_PID=$!
sleep 8

echo ""
echo "✅ 服务已启动："
echo "   前端 + Worker: http://localhost:8790"
echo "   Python API:    http://localhost:8900"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $PY_PID $WR_PID 2>/dev/null" EXIT
wait

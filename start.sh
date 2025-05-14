#!/bin/bash

# 检查是否已经运行
PID=$(pgrep -f "deno run --allow-net --allow-env --allow-read main.ts")
if [ ! -z "$PID" ]; then
  echo "服务已经在运行中，PID: $PID"
  exit 0
fi

# 以守护进程方式启动
echo "启动Vertex AI to OpenAI代理服务..."
nohup deno run --allow-net --allow-env --allow-read main.ts > server.log 2>&1 &

# 获取PID
PID=$!
echo "服务已启动，PID: $PID"
echo "日志文件: server.log"
echo "使用以下命令停止服务: kill $PID"

@echo off
echo 启动Vertex AI to OpenAI代理服务...

REM 检查服务是否已经运行
tasklist /FI "IMAGENAME eq deno.exe" 2>NUL | find /I /N "deno.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo 服务已经在运行中
    goto :end
)

REM 在后台启动服务
start /B deno run --allow-net --allow-env --allow-read main.ts > server.log 2>&1

echo 服务已启动
echo 日志文件: server.log
echo 要停止服务，请使用任务管理器结束deno进程

:end

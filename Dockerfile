# 使用 Deno 官方镜像作为基础镜像
FROM denoland/deno:latest

# 设置工作目录
WORKDIR /app

# 复制所有文件
COPY . .

# 缓存依赖
RUN deno cache deps.ts
RUN deno cache main.ts

# 暴露应用运行的端口
EXPOSE 8000

# 启动应用
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]

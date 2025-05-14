# Vertex AI Gemini 到 OpenAI API 代理

本项目是一个使用 Deno 实现的代理服务器，旨在将 Vertex AI Gemini API 请求转换为 OpenAI Chat Completion API 兼容的格式。通过此服务，原先为 OpenAI 模型开发的应用能够以最小的代码改动与 Vertex AI Gemini 模型进行交互。

## 主要特性

* **OpenAI API 兼容性**：模拟 OpenAI 的 `/v1/chat/completions` 接口，支持流式及非流式响应
* **Vertex AI 集成**：直接与 Vertex AI API 通信，支持 Gemini 模型
* **现代化技术栈**：使用 Deno 和 Oak 框架构建，提供更好的开发体验和性能
* **Docker 支持**：包含 `Dockerfile` 与 `docker-compose.yml`，便于部署
* **环境变量配置**：通过 `.env` 文件管理 API 密钥等敏感信息

## 环境准备

* [Deno](https://deno.land/) (本地开发时需要)
* Docker 和 Docker Compose (使用容器部署时需要)

## 快速开始

1.  **配置环境变量**：
    创建 `.env` 文件，填入以下内容：
    ```env
    VERTEX_AI_API_KEY=你的_VERTEX_AI_API_密钥
    PROXY_API_KEY=你的代理服务器密钥
    ```

2.  **本地运行（开发模式）**：
    ```bash
    deno run --allow-net --allow-env --allow-read main.ts
    ```

3.  **Docker 部署（生产模式）**：
    ```bash
    docker-compose up -d
    ```

4.  **接口测试**：
    服务默认运行在 `http://localhost:8000`，向 `/v1/chat/completions` 发送 POST 请求：

    ```bash
    curl -X POST http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer 你的PROXY_API_KEY" \
    -d '{
        "model": "gemini-pro",
        "messages": [
            {"role": "user", "content": "你好！"}
        ],
        "stream": false
    }'
    ```

## 项目结构

```
.
├── .env                # 环境变量文件 (需要自行创建)
├── deps.ts            # Deno 依赖管理
├── Dockerfile         # Docker 配置文件
├── docker-compose.yml # Docker Compose 配置
├── main.ts           # 主应用逻辑
└── README.md         # 项目说明文档
```

## 开发

1. 安装 Deno：���问 https://deno.land/#installation
2. 克隆项目并进入目录
3. 复制 `.env.example` 为 `.env` 并配置环境变量
4. 运行 `deno run --allow-net --allow-env --allow-read main.ts`

## 贡献

欢迎提交 Issue 和 Pull Request！

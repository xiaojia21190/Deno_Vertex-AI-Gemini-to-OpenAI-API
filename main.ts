import { Application, Router, Context, dotenvConfig } from "./deps.ts";

// 环境变量检查
const VERTEX_AI_API_KEY = Deno.env.get("VERTEX_AI_API_KEY");
const PROXY_API_KEY = Deno.env.get("PROXY_API_KEY");

// const env = await dotenvConfig({ export: true });
// const VERTEX_AI_API_KEY = env.VERTEX_AI_API_KEY;
// const PROXY_API_KEY = env.PROXY_API_KEY;

if (!VERTEX_AI_API_KEY) {
  throw new Error("VERTEX_AI_API_KEY 环境变量没有设置哦！快去 .env 文件看看！");
}
if (!PROXY_API_KEY) {
  throw new Error("PROXY_API_KEY 环境变量没有设置哦！是不是忘记写在 .env 文件里啦？");
}

// HTTP 反代时用到的基础 Endpoint
const VERTEX_AI_BASE_ENDPOINT = "https://aiplatform.googleapis.com/v1/publishers/google/models/";

export interface ChatMessage {
  role: string;
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

// 创建应用和路由
const app = new Application();
const router = new Router();

// 辅助函数
interface VertexAIChunk {
  candidates: {
    content: {
      parts: { text: string }[];
    };
  }[];
}

function parseChunkText(chunk: unknown): string | null {
  try {
    const c = chunk as VertexAIChunk;
    return c.candidates[0].content.parts[0].text;
  } catch {
    return null;
  }
}

router.get("/", (ctx: Context) => {
  ctx.response.body = {
    message: "Hello, World!",
  };
});

// 主接口
router.post("/v1/chat/completions", async (ctx: Context) => {
  // 验证反代密钥
  const authHeader = ctx.request.headers.get("authorization");
  if (!authHeader || authHeader.replace("Bearer ", "") !== PROXY_API_KEY) {
    ctx.response.status = 401;
    ctx.response.body = { detail: "无效的反代密钥，您是不是输错了？" };
    return;
  }

  // 获取请求体
  const request = await ctx.request.body().value as ChatCompletionRequest;

  // 构造 Vertex AI HTTP payload
  const vertexAiEndpoint = `${VERTEX_AI_BASE_ENDPOINT}${request.model}:generateContent`;
  const vertexAiContents: { role: string; parts: { text: string }[] }[] = [];
  let systemMessage = "";

  for (const msg of request.messages) {
    if (msg.role === "system") {
      systemMessage += msg.content + "\n";
    } else if (msg.role === "user") {
      if (systemMessage) {
        vertexAiContents.push({
          role: "user",
          parts: [{ text: systemMessage + msg.content }],
        });
        systemMessage = "";
      } else {
        vertexAiContents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      }
    } else if (msg.role === "assistant") {
      vertexAiContents.push({
        role: "model",
        parts: [{ text: msg.content }],
      });
    }
  }

  // 检查是否还有剩余的系统消息，如果有则添加为单独的用户消息
  if (systemMessage) {
    vertexAiContents.push({
      role: "user",
      parts: [{ text: systemMessage }],
    });
    systemMessage = "";
  }

  // 构造请求体
  const vertexAiPayload = {
    contents: vertexAiContents,
    generationConfig: {
      temperature: request.temperature,
      topP: request.top_p,
      maxOutputTokens: request.max_tokens,
    },
  };

  try {
    // 非流式请求
    if (!request.stream) {
      const response = await fetch(vertexAiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": VERTEX_AI_API_KEY,
        },
        body: JSON.stringify(vertexAiPayload),
      });

      if (!response.ok) {
        throw new Error(`Vertex AI API error: ${response.status}`);
      }

      const result = await response.json();

      // 提取回答内容
      let text = "";
      let finish_reason = "stop";

      if (result.candidates && result.candidates.length > 0) {
        const parts = result.candidates[0].content.parts;
        text = parts.map((part: { text?: string }) => part.text || "").join("");

        // 处理finish_reason
        const fr = result.candidates[0].finishReason;
        if (fr === "MAX_OUTPUT_TOKENS") {
          finish_reason = "length";
        }
      } else {
        console.warn("Vertex AI 未返回有效的 candidates");
      }

      // 获取使用情况
      const usage = result.usageMetadata || {};

      ctx.response.body = {
        id: crypto.randomUUID(),
        object: "chat.completion",
        created: Date.now(),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: text,
            },
            finish_reason: finish_reason,
          },
        ],
        usage: {
          prompt_tokens: usage.promptTokenCount || -1,
          completion_tokens: usage.candidatesTokenCount || -1,
          total_tokens: usage.totalTokenCount || -1,
        },
      };
    } else {
      // 流式请求处理
      ctx.response.headers.set("Content-Type", "text/event-stream");
      ctx.response.headers.set("Cache-Control", "no-cache");
      ctx.response.headers.set("Connection", "keep-alive");

      const streamResponse = await fetch(vertexAiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": VERTEX_AI_API_KEY,
        },
        body: JSON.stringify({ ...vertexAiPayload, stream: true }),
      });

      if (!streamResponse.ok) {
        throw new Error(`Vertex AI API error: ${streamResponse.status}`);
      }

      const reader = streamResponse.body?.getReader();
      if (!reader) {
        throw new Error("Stream response body is null");
      }

      const textEncoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
                break;
              }

              const chunk = new TextDecoder().decode(value);
              const text = parseChunkText(JSON.parse(chunk));

              if (text) {
                const data = {
                  id: crypto.randomUUID(),
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  model: request.model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: text,
                      },
                      finish_reason: null,
                    },
                  ],
                };

                controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            controller.error(new Error(`Stream processing error: ${errorMessage}`));
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      });

      ctx.response.body = body;
    }
  } catch (error) {
    console.error("处理请求时发生错误:", error);
    ctx.response.status = 500;

    // 提供更详细的错误信息
    if (error instanceof Error) {
      ctx.response.body = {
        error: {
          message: error.message,
          type: error.name,
          detail: "请求Vertex AI API时发生错误，请检查API密钥和请求格式"
        }
      };
    } else {
      ctx.response.body = {
        error: {
          message: "未知错误",
          type: "UnknownError",
          detail: "处理请求时发生未知错误"
        }
      };
    }
  }
});

// 应用路由并启动服务器
app.use(router.routes());
app.use(router.allowedMethods());

const port = 8001;
const hostname = "127.0.0.1";
console.log(`服务器运行在 http://${hostname}:${port}`);
try {
  await app.listen({ port, hostname });
} catch (error) {
  console.error("服务器启动失败:", error instanceof Error ? error.message : "未知错误");
  throw error;
}

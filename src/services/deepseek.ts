// DeepSeek API client — the first real HTTP layer in this app.
// Endpoint: https://api.deepseek.com/chat/completions (OpenAI-compatible).
// NOTE: direct browser calls may be blocked by CORS (DeepSeek does not send
// permissive Access-Control-Allow-Origin). We surface a clear message so the
// user knows to self-host a proxy if needed.

const ENDPOINT = "https://api.deepseek.com/chat/completions";
// deepseek-chat / deepseek-reasoner will be deprecated 2026/07/24; use the new
// V4 model name directly.
const MODEL = "deepseek-v4-flash";

export type ApiMessage = { role: "system" | "user" | "assistant"; content: string };

export type ApiResult = { success: boolean; message: string; data?: string };

export async function chat(args: { apiKey: string; messages: ApiMessage[] }): Promise<ApiResult> {
  return callCompletion(args.apiKey, args.messages);
}

// Ask the model to compress older conversation turns into a short summary,
// so we can drop the original messages and keep token usage bounded.
export async function compactHistory(args: {
  apiKey: string;
  messages: ApiMessage[];
}): Promise<ApiResult> {
  const compactMessages: ApiMessage[] = [
    {
      role: "system",
      content:
        "请将以下健身助手的对话历史浓缩成一段不超过300字的摘要，保留用户的健身目标、身体数据、关键偏好和已给建议的要点，供后续对话参考。只输出摘要本身。",
    },
    {
      role: "user",
      content: args.messages.map((m) => `[${m.role}] ${m.content}`).join("\n\n"),
    },
  ];
  return callCompletion(args.apiKey, compactMessages);
}

async function callCompletion(apiKey: string, messages: ApiMessage[]): Promise<ApiResult> {
  if (!apiKey.trim()) {
    return { success: false, message: "未配置 API Key，请先在设置页填写。" };
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
    });
  } catch {
    return {
      success: false,
      message: "网络请求失败（可能是 CORS 限制或网络不通），请检查网络或自备代理后重试。",
    };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      /* ignore parse error, keep status detail */
    }
    return { success: false, message: `请求失败：${detail}` };
  }

  try {
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return { success: false, message: "返回数据为空。" };
    return { success: true, message: "ok", data: content };
  } catch {
    return { success: false, message: "解析返回数据失败。" };
  }
}

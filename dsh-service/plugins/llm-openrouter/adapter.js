const DEFAULT_MAX_TOKENS = 8000;

export function readOpenRouterConfig(env = process.env) {
  const base = String(env.MENU_AI_BASE_URL || env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  return {
    baseURL: base,
    apiKey: String(env.OPENROUTER_API_KEY || env.MENU_AI_API_KEY || "").trim(),
  };
}

function blockText(block) {
  if (!block || typeof block !== "object") return "";
  if (block.type === "text" || block.type === "reasoning") return String(block.text || "");
  return "";
}

function contentText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map(blockText).filter(Boolean).join("");
}

function imageParts(content) {
  if (!Array.isArray(content)) return [];
  const parts = [];
  for (const block of content) {
    if (!block || block.type !== "image") continue;
    const data = block.data || block.base64;
    const mime = block.mimeType || block.mime;
    if (!data || !mime) continue;
    parts.push({ type: "image_url", image_url: { url: `data:${mime};base64,${data}` } });
  }
  return parts;
}

export function toOpenAiMessages(options) {
  const messages = [];
  if (options.system) messages.push({ role: "system", content: String(options.system) });
  for (const message of options.messages || []) {
    const role = message.role;
    if (role === "system" || role === "developer") {
      const text = contentText(message.content);
      if (text) messages.push({ role: "system", content: text });
      continue;
    }
    if (role === "tool") {
      messages.push({
        role: "tool",
        tool_call_id: String(message.toolCallId || ""),
        content: contentText(message.content) || "{}",
      });
      continue;
    }
    if (role === "assistant") {
      const blocks = Array.isArray(message.content) ? message.content : [];
      const toolCalls = blocks.filter((block) => block?.type === "tool-call").map((block) => ({
        id: String(block.id),
        type: "function",
        function: { name: String(block.name), arguments: String(block.arguments || "{}") },
      }));
      const entry = { role: "assistant", content: contentText(message.content) || null };
      if (toolCalls.length) entry.tool_calls = toolCalls;
      messages.push(entry);
      continue;
    }
    const text = contentText(message.content);
    const images = imageParts(message.content);
    if (images.length) {
      messages.push({ role: "user", content: [{ type: "text", text }, ...images] });
    } else {
      messages.push({ role: "user", content: text });
    }
  }
  return messages;
}

export function toOpenAiTools(tools) {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters || { type: "object", properties: {} },
    },
  }));
}

function usageOf(raw) {
  if (!raw) return { inputTokens: 0, outputTokens: 0 };
  return {
    inputTokens: Number(raw.prompt_tokens || 0),
    outputTokens: Number(raw.completion_tokens || 0),
    totalTokens: Number(raw.total_tokens || 0),
  };
}

async function* readSse(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data);
      } catch {
        // Ignore a partial or non-JSON SSE line. The next line still parses.
      }
    }
  }
}

/** Yields DSH StreamChunks. Usage is always emitted before finish, and nothing after finish. */
export async function* streamOpenRouter(options, config, fetchImpl = globalThis.fetch) {
  if (!config?.apiKey) {
    const error = new Error("OpenRouter API key is missing");
    error.code = "MISSING_CREDENTIAL";
    throw error;
  }
  const maxTokens = Number(options.maxTokens) > 0 ? Number(options.maxTokens) : DEFAULT_MAX_TOKENS;
  const body = {
    model: options.model,
    temperature: options.temperature ?? 0,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOpenAiMessages(options),
  };
  const tools = toOpenAiTools(options.tools);
  if (tools) body.tools = tools;
  if (options.stop?.length) body.stop = options.stop;

  const response = await fetchImpl(`${config.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const error = new Error(`OpenRouter HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error("OpenRouter returned an empty stream");

  let text = "";
  let sawText = false;
  const calls = new Map();
  let usage = null;
  for await (const json of readSse(response.body)) {
    if (json.usage) usage = usageOf(json.usage);
    const delta = json.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      if (!sawText) {
        sawText = true;
        yield { type: "block-start", index: 0, blockType: "text" };
      }
      text += delta.content;
      yield { type: "text-delta", index: 0, text: delta.content };
    }
    for (const call of delta.tool_calls || []) {
      const index = Number(call.index ?? 0) + 1;
      const current = calls.get(index) || { id: "", name: "", arguments: "" };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name = call.function.name;
      if (call.function?.arguments) {
        current.arguments += call.function.arguments;
        yield {
          type: "tool-call-delta",
          index,
          id: current.id,
          name: current.name || undefined,
          argumentsDelta: call.function.arguments,
        };
      }
      calls.set(index, current);
    }
  }
  if (sawText) yield { type: "block-end", index: 0, block: { type: "text", text } };
  for (const [index, call] of calls) {
    yield {
      type: "block-end",
      index,
      block: { type: "tool-call", id: call.id, name: call.name, arguments: call.arguments || "{}" },
    };
  }
  yield { type: "usage", usage: usage || { inputTokens: 0, outputTokens: 0 } };
  yield { type: "finish", reason: { kind: calls.size ? "tool-calls" : "stop" } };
}

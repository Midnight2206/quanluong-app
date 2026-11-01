import { LlmAdapter } from "@deepseek-ai/dsh-llm";
import { readOpenRouterConfig, streamOpenRouter } from "./adapter.js";

export const name = "llm-openrouter";
export const inject = ["llm"];

class OpenRouterAdapter extends LlmAdapter {
  stream(options) {
    return streamOpenRouter(options, readOpenRouterConfig());
  }
}

export function apply(ctx) {
  ctx.llm.registerAdapter(["openrouter"], new OpenRouterAdapter());
}

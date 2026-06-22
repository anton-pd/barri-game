export interface DeepSeekStreamChunk {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

export function extractDeepSeekContentDelta(chunk: DeepSeekStreamChunk): string {
  const content = chunk.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

export function buildDeepSeekChatBody(params: {
  model: string;
  messages: unknown[];
  maxTokens: number;
  temperature: number;
  orProvider?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (params.orProvider) {
    body.provider = { order: [params.orProvider], allow_fallbacks: true };
    body.usage = { include: true };
    body.reasoning = { effort: 'none', exclude: true };
  } else {
    // DeepSeek V4 has thinking enabled by default. The game needs immediate
    // narrated content, not hidden reasoning that can consume the whole budget.
    body.thinking = { type: 'disabled' };
  }

  return body;
}

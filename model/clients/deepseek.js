import { OpenAIClient } from './openai.js';

// DeepSeek: OpenAI 호환. 캐시는 자동(디스크 캐시), usage 에 hit/miss 가 따로 나온다.
// prompt_cache_key 는 받지 않으므로 보내지 않는다.
export class DeepSeekClient extends OpenAIClient {
  constructor({ apiKey = process.env.DEEPSEEK_API_KEY, timeoutMs } = {}) {
    super({ apiKey, baseURL: 'https://api.deepseek.com', timeoutMs, name: 'DEEPSEEK_API_KEY' });
  }

  // 생각 모드는 기본 켜짐(effort high). spec.reasoning[mode] = { thinking: 'disabled' } 또는 { effort } 로 끄고 켠다.
  buildParams(req) {
    const params = super.buildParams({ ...req, cache_key: undefined, reasoning: undefined });
    const m = req.spec?.reasoning?.[req.reasoning];
    if (m?.thinking) params.thinking = { type: m.thinking };
    if (m?.effort) params.reasoning_effort = m.effort;
    return params;
  }

  readUsage(u = {}) {
    const hit = u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      input_tokens: u.prompt_cache_miss_tokens ?? (u.prompt_tokens ?? 0) - hit,
      cache_read_tokens: hit,
      cache_write_tokens: 0,
      output_tokens: u.completion_tokens ?? 0,
      reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    };
  }
}

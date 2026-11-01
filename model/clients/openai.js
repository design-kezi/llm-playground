import OpenAI from 'openai';
import { wrapError } from './base.js';

// OpenAI Chat Completions. DeepSeek·DeepInfra 도 같은 형식이라 이 클래스를 상속한다.
// 캐시는 자동(1,024토큰 이상 동일 접두사). prompt_cache_key 로 같은 대화를 같은 캐시로 보낸다.
export class OpenAIClient {
  constructor({ apiKey = process.env.OPENAI_API_KEY, baseURL, timeoutMs = 60_000, name = 'OPENAI_API_KEY' } = {}) {
    if (!apiKey) throw new Error(`${name} 없음`);
    this.sdk = new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: timeoutMs });
  }

  buildParams({ model, system = [], messages, max_tokens, temperature, json, reasoning, cache_key, spec }) {
    const sys = system.map((s) => s.text).join('');
    const params = {
      model,
      messages: [...(sys ? [{ role: 'system', content: sys }] : []), ...messages.map((m) => ({ role: m.role, content: m.content }))],
      max_completion_tokens: max_tokens,
    };
    if (spec?.sampling && temperature != null) params.temperature = temperature;
    const effort = spec?.reasoning?.[reasoning];
    if (effort) params.reasoning_effort = effort;
    if (json) params.response_format = { type: 'json_object' };
    if (cache_key) params.prompt_cache_key = cache_key;
    return params;
  }

  // 제공사별 usage 차이는 여기서 흡수. 기본은 OpenAI: prompt_tokens 에 캐시분 포함.
  readUsage(u = {}) {
    const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      input_tokens: (u.prompt_tokens ?? 0) - cached,
      cache_read_tokens: cached,
      cache_write_tokens: 0,
      output_tokens: u.completion_tokens ?? 0,
      reasoning_tokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
    };
  }

  async call(req) {
    if (req.onDelta) return this.stream(req);
    let res;
    try {
      res = await this.sdk.chat.completions.create(this.buildParams(req), { signal: req.signal });
    } catch (e) {
      throw wrapError(e);
    }
    const choice = res.choices?.[0];
    return { text: choice?.message?.content ?? '', finish_reason: choice?.finish_reason ?? null, usage: this.readUsage(res.usage),
      request_id: res._request_id ?? res.id ?? null, raw_usage: res.usage ?? null };
  }

  // 스트리밍: usage 는 마지막 조각(include_usage)에만 온다. 중지되면 usage 가 없어 호출부가 토큰을 추정한다.
  async stream(req) {
    let text = '', finish = null, raw = null, id = null;
    try {
      const st = await this.sdk.chat.completions.create({ ...this.buildParams(req), stream: true, stream_options: { include_usage: true } }, { signal: req.signal });
      id = st._request_id ?? null;
      for await (const ch of st) {
        id ??= ch.id ?? null;
        if (ch.usage) raw = ch.usage;
        const c = ch.choices?.[0];
        const d = c?.delta?.content;
        if (req.signal?.aborted) break; // 중지 뒤 남은 조각은 버린다
        if (d) { text += d; req.onDelta(d); }
        if (c?.finish_reason) finish = c.finish_reason;
      }
    } catch (e) {
      if (!req.signal?.aborted) throw wrapError(e);
      return { text, finish_reason: 'aborted', aborted: true, usage: raw ? this.readUsage(raw) : null, request_id: id, raw_usage: raw };
    }
    // SDK 는 중지되면 예외 없이 반복을 끝내기도 한다
    if (req.signal?.aborted) return { text, finish_reason: 'aborted', aborted: true, usage: raw ? this.readUsage(raw) : null, request_id: id, raw_usage: raw };
    return { text, finish_reason: finish, usage: raw ? this.readUsage(raw) : null, request_id: id, raw_usage: raw };
  }

  async embed({ model, texts, dim }) {
    let res;
    try {
      res = await this.sdk.embeddings.create({ model, input: texts, ...(dim ? { dimensions: dim } : {}) });
    } catch (e) {
      throw wrapError(e);
    }
    return { vectors: res.data.map((d) => Float32Array.from(d.embedding)), input_tokens: res.usage?.prompt_tokens ?? 0, raw_usage: res.usage ?? null };
  }
}

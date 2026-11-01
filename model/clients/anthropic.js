import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, wrapError } from './base.js';

// Claude. 캐시는 명시적(cache_control): 시스템 블록 중 cache=true 인 것 + (cache_history 면) 상단 자동 마커(마지막 블록까지).
// 상단 마커는 매 호출 전체 프롬프트를 1.25배로 캐시에 쓴다. 다음 호출이 그 접두사를 그대로 이어 쓸 때(stair·full)만 이득이고,
// 앞이 잘려 나가는 slide 나 1회성 추출 호출에서는 쓰기 비용만 난다.
// Haiku 5.5 는 temperature/top_p 를 받지 않는다(기본값 외 400). SDK 1.x 에도 해당 필드가 없다.
export class AnthropicClient {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, timeoutMs = 60_000 } = {}) {
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY 없음');
    this.sdk = new Anthropic({ apiKey, maxRetries: 0, timeout: timeoutMs });
  }

  async call({ model, system = [], messages, max_tokens, json, reasoning, cache, cache_history, spec, onDelta, signal }) {
    const params = {
      model,
      max_tokens,
      system: system.map((s) => ({ type: 'text', text: s.text, ...(cache && s.cache ? { cache_control: { type: 'ephemeral' } } : {}) })),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(cache && cache_history ? { cache_control: { type: 'ephemeral' } } : {}),
      ...reasoningParams(reasoning, spec),
    };
    if (json) params.system.push({ type: 'text', text: '\n\n출력은 JSON 객체 하나만. 코드블록·설명 없이.' });

    let res;
    try {
      if (onDelta) {
        const r = await this.stream(params, onDelta, signal);
        if (r.aborted) return r;
        res = r.res;
      } else res = await this.sdk.messages.create(params, { signal });
    } catch (e) {
      throw wrapError(e);
    }
    const u = res.usage ?? {};
    const usage = {
      input_tokens: u.input_tokens ?? 0,
      cache_read_tokens: u.cache_read_input_tokens ?? 0,
      cache_write_tokens: u.cache_creation_input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      reasoning_tokens: 0, // 응답에 따로 나오지 않음(output_tokens 에 포함)
    };
    if (res.stop_reason === 'refusal') throw new ProviderError('refusal', { status: 200, retryable: false, usage, request_id: res._request_id ?? res.id ?? null, raw_usage: u });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text, finish_reason: res.stop_reason, usage, request_id: res._request_id ?? res.id ?? null, raw_usage: u };
  }
}

// 스트리밍: 텍스트 조각을 onDelta 로 넘긴다. 중지(signal)되면 받은 텍스트까지 돌려준다.
// 입력 usage 는 message_start 에 실제 값이 오지만 출력 토큰은 마지막 message_delta 에만 와서, 중지 시 출력은 받은 텍스트로 추정한다.
AnthropicClient.prototype.stream = async function (params, onDelta, signal) {
  const s = this.sdk.messages.stream(params, { signal });
  let text = '';
  s.on('text', (d) => { if (signal?.aborted) return; text += d; onDelta(d); }); // 중지 뒤 버퍼에 남은 조각은 버린다
  try {
    return { res: await s.finalMessage() };
  } catch (e) {
    if (!signal?.aborted) throw e;
    const u = s.currentMessage?.usage ?? null;
    return {
      text, finish_reason: 'aborted', aborted: true, request_id: s.request_id ?? s.currentMessage?.id ?? null, raw_usage: u,
      usage: u ? { input_tokens: u.input_tokens ?? 0, cache_read_tokens: u.cache_read_input_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0, output_tokens: null, reasoning_tokens: 0 } : null,
    };
  }
};

// off: thinking 끔(모델마다 값이 다름 — pricing.json reasoning.off.thinking) / minimal: adaptive + effort low / default: 모델 기본.
function reasoningParams(reasoning, spec) {
  const m = spec?.reasoning?.[reasoning];
  if (!m) return {};
  return {
    ...(m.thinking ? { thinking: { type: m.thinking } } : {}), // Haiku 5.5 = 'disabled', Sonnet 5.5 = 'between_tools'(생각 안 함)
    ...(m.effort ? { output_config: { effort: m.effort } } : {}),
  };
}

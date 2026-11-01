// 테스트·오프라인 개발용 가짜 모델. responses 큐에서 순서대로 꺼내 돌려준다(문자열 또는 (req)=>문자열).
// embed 는 키워드 해시 기반 벡터: 같은 단어를 공유하면 코사인이 높다.
import { keywords } from './gate.js';

export function createFakeModel({ responses = [], dim = 64, withEmbed = true } = {}) {
  const calls = [];
  const est = (t) => Math.ceil((t ?? '').length / 1.5);
  const m = {
    calls,
    estimateTokens: est,
    pricing: () => ({ source: 'fake', as_of: null, fx_krw_per_usd: 1400, estimated: true }),
    async complete(req) {
      calls.push({ kind: 'complete', ...req });
      const next = responses.length ? responses.shift() : '{"profile":{},"ops":[]}';
      let out = typeof next === 'function' ? next(req) : next;
      if (out instanceof Error) { out.attempts = [{ model: 'fake', ok: false, input_tokens: 0, output_tokens: 0, cost_krw: 0, error: out.message }]; throw out; }
      if (typeof out === 'string') out = { text: out, finish_reason: 'stop' }; // 객체 {text, finish_reason} 도 허용(잘림 시험용)
      const input = (req.system ?? []).map((s) => s.text).join('') + (req.messages ?? []).map((x) => x.content).join('');
      return { text: out.text, attempts: [{ model: 'fake', ok: true, input_tokens: est(input), output_tokens: est(out.text), cache_read_tokens: 0, cache_write_tokens: 0, input_krw: 0, output_krw: 0, cost_krw: 0, latency_ms: 0, finish_reason: out.finish_reason, max_tokens: req.max_tokens }] };
    },
  };
  if (withEmbed) {
    m.embed = async (req) => {
      calls.push({ kind: 'embed', ...req });
      const vectors = req.texts.map((t) => hashVec(t, dim));
      return { vectors, attempts: [{ model: 'fake-embed', ok: true, input_tokens: req.texts.reduce((s, t) => s + est(t), 0), output_tokens: 0, cost_krw: 0, latency_ms: 0 }] };
    };
  }
  return m;
}

export function hashVec(text, dim) {
  const v = new Float32Array(dim);
  for (const k of keywords(text)) {
    let h = 2166136261;
    for (const ch of k) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    v[h % dim] += 1;
    v[(h >>> 8) % dim] += 0.5;
  }
  return v;
}

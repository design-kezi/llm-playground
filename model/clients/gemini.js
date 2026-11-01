import { GoogleGenAI } from '@google/genai';
import { wrapError } from './base.js';

// Gemini (AI Studio). 캐시는 암시적(동일 접두사 자동, 최소 길이는 모델별). 끌 수 없다.
// promptTokenCount 는 캐시분 포함, candidatesTokenCount 는 추론 토큰 제외.
export class GeminiClient {
  constructor({ apiKey = process.env.GEMINI_API_KEY, timeoutMs = 60_000 } = {}) {
    if (!apiKey) throw new Error('GEMINI_API_KEY 없음');
    this.sdk = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } } });
  }

  async call({ model, system = [], messages, max_tokens, temperature, json, reasoning, spec }) {
    const sys = system.map((s) => s.text).join('');
    const config = {
      maxOutputTokens: max_tokens,
      ...(sys ? { systemInstruction: sys } : {}),
      ...(spec?.sampling && temperature != null ? { temperature } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
    };
    const thinking = spec?.reasoning?.[reasoning];
    if (thinking) config.thinkingConfig = thinking;

    let res;
    try {
      res = await this.sdk.models.generateContent({
        model,
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config,
      });
    } catch (e) {
      throw wrapError(e);
    }
    const u = res.usageMetadata ?? {};
    const cached = u.cachedContentTokenCount ?? 0;
    const thoughts = u.thoughtsTokenCount ?? 0;
    return {
      request_id: res.responseId ?? null,
      raw_usage: u,
      text: res.text ?? '',
      finish_reason: res.candidates?.[0]?.finishReason ?? null,
      usage: {
        input_tokens: (u.promptTokenCount ?? 0) - cached,
        cache_read_tokens: cached,
        cache_write_tokens: 0,
        output_tokens: (u.candidatesTokenCount ?? 0) + thoughts,
        reasoning_tokens: thoughts,
      },
    };
  }

  // Gemini API 임베딩 응답에는 토큰 수가 없다 → 같은 모델의 countTokens(무료)로 실제 토큰 수를 같이 받는다.
  // 문장마다 따로 세서 더한다(과금이 문장 단위). countTokens 가 실패하면 null → 호출 측이 추정치로 표시.
  async embed({ model, texts, dim }) {
    let res, counts;
    try {
      [res, counts] = await Promise.all([
        this.sdk.models.embedContent({ model, contents: texts, config: { ...(dim ? { outputDimensionality: dim } : {}) } }),
        Promise.all(texts.map((t) => this.sdk.models.countTokens({ model, contents: t }).then((r) => r.totalTokens ?? null))).catch(() => null),
      ]);
    } catch (e) {
      throw wrapError(e);
    }
    const ok = counts && counts.every((c) => Number.isFinite(c));
    return { vectors: res.embeddings.map((e) => Float32Array.from(e.values)), input_tokens: ok ? counts.reduce((a, b) => a + b, 0) : null,
      raw_usage: ok ? { count_tokens_per_text: counts } : null };
  }
}

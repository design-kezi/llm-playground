// 모든 제공사 클라이언트의 공통 모양.
// call(req) 는 재시도 없이 1회만 호출하고, 아래 정규화된 결과를 돌려준다.
//   { text, finish_reason, usage: { input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens },
//     request_id, raw_usage }   raw_usage = 제공사 응답의 usage 원본(감사용, 가공하지 않음)
//   input_tokens = 캐시되지 않은 입력(정가 과금분). 캐시 읽기/쓰기는 따로 센다. 세 값을 더하면 전체 입력.
//   output_tokens = 추론(thinking) 토큰 포함 전체 출력(과금 기준).
// 실패는 ProviderError 로 던진다(retryable 로 재시도 여부 판단).
//
// req: { model, system: [{text, cache?}], messages: [{role, content}], max_tokens, temperature?,
//        json?, reasoning: 'off'|'minimal'|'default', cache: boolean, cache_key?, spec }
//   spec = pricing.json 의 모델 항목(reasoning 매핑, sampling 허용 여부).

export class ProviderError extends Error {
  constructor(message, { status = null, retryable = false, usage = null, request_id = null, raw_usage = null } = {}) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.usage = usage;
    this.request_id = request_id;
    this.raw_usage = raw_usage;
  }
}

export function isRetryableStatus(status) {
  return status == null || status === 408 || status === 409 || status === 429 || status >= 500;
}

// SDK 예외 → ProviderError. SDK 들은 status 를 err.status 로 노출한다.
export function wrapError(err) {
  if (err instanceof ProviderError) return err;
  const status = err?.status ?? err?.code ?? null;
  const numeric = typeof status === 'number' ? status : null;
  // 잔액·크레딧 부족은 429 로 와도 재시도해 봐야 소용없다. Gemini 무료 등급의 분당 한도 429 도 "quota" 라고 써서
  // 'quota' 만으로는 잔액 부족으로 보지 않는다(재시도 대상).
  const noFunds = ['insufficient_quota', 'credit_balance_exhausted'].includes(err?.code) || /credit|balance/i.test(String(err?.message));
  return new ProviderError(String(err?.message ?? err).slice(0, 500), { status: numeric, retryable: !noFunds && isRetryableStatus(numeric),
    request_id: err?.requestID ?? err?.request_id ?? null });
}

export const emptyUsage = () => ({ input_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, output_tokens: 0, reasoning_tokens: 0 });

export const systemText = (system = []) => system.map((s) => s.text).join('');

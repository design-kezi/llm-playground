// 모델 레이어 진입점. 합의된 인터페이스(docs/10-app-design.md §8):
//   complete(req) → { text, attempts, aborted? }   실패 시 throw, e.attempts 첨부
//     req.onDelta?(chunk) 스트리밍 조각, req.signal? AbortSignal 중지(받은 데까지 정상 반환, aborted=true)
//   embed(req)    → { vectors, attempts } (MODEL_EMBED=off 면 undefined)
//   pricing()     → { source, as_of, fx_krw_per_usd, models }
//   estimateTokens(text)
// 환경변수(docs/30-bench-design.md §3.1): MODEL_RESPONSE, MODEL_EXTRACT, MODEL_EMBED, MODEL_CACHE(on|off), MODEL_REASONING(off|minimal|on|default)
//   MODEL_REASONING_RESPONSE / MODEL_REASONING_EXTRACT: 대화(purpose 'response')와 그 밖(추출·정리·판정)의 추론을 따로. 없으면 MODEL_REASONING
import fs from 'node:fs';
import path from 'node:path';
import { AnthropicClient } from './clients/anthropic.js';
import { OpenAIClient } from './clients/openai.js';
import { GeminiClient } from './clients/gemini.js';
import { DeepSeekClient } from './clients/deepseek.js';
import { DeepInfraClient } from './clients/deepinfra.js';
import { ProviderError, emptyUsage } from './clients/base.js';

// 키는 레포 루트 .env 에 있다. 이미 있는 환경변수는 덮지 않는다.
const ROOT_ENV = path.resolve(import.meta.dirname, '..', '.env');
if (fs.existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

const PRICES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'pricing.json'), 'utf8'));
const env = process.env;

const pick = (name, allowed, def) => {
  const v = env[name] ?? def;
  if (!allowed.includes(v)) throw new Error(`${name}=${v} — 허용값: ${allowed.join('|')}`);
  return v;
};
const known = (name, def, kind = 'chat') => {
  const v = env[name] ?? def;
  if (v === 'off' && kind === 'embed') return null;
  const spec = PRICES.models[v];
  if (!spec || (spec.kind ?? 'chat') !== kind) {
    const names = Object.entries(PRICES.models).filter(([, s]) => (s.kind ?? 'chat') === kind).map(([k]) => k);
    throw new Error(`${name}=${v} — pricing.json 에 없는 ${kind} 모델. 가능: ${names.join(', ')}`);
  }
  return v;
};

// 기본값 = 최종 선택(docs/50 2026-11-01 개선판 v2-dsx 채택): 대화 deepseek-flash 추론 켬, 추출도 deepseek-flash 추론 끔(이전 gemma-4-31B). 벤치는 조건마다 환경변수로 덮어쓴다.
export const config = Object.freeze({
  response: known('MODEL_RESPONSE', 'deepseek-flash'),
  extract: known('MODEL_EXTRACT', 'deepseek-flash'),
  embed: known('MODEL_EMBED', 'gemini-embedding-001', 'embed'),
  cache: pick('MODEL_CACHE', ['on', 'off'], 'on') === 'on',
  reasoning: pick('MODEL_REASONING', ['off', 'minimal', 'on', 'default'], 'off'),
  reasoning_response: pick('MODEL_REASONING_RESPONSE', ['off', 'minimal', 'on', 'default'], env.MODEL_REASONING ?? 'on'),
  reasoning_extract: pick('MODEL_REASONING_EXTRACT', ['off', 'minimal', 'on', 'default'], env.MODEL_REASONING ?? 'off'),
});

// 원장: 모든 시도(성공·실패)를 제공사 원본 usage·요청 ID 와 함께 한 줄씩 남긴다. 앱 DB 와 따로 둬서
// 비용 검산(bench/audit.mjs)과 제공사 콘솔 대조의 근거로 쓴다. 프롬프트·응답 본문은 남기지 않는다.
const LEDGER_DIR = env.MODEL_LEDGER_DIR ?? path.join(import.meta.dirname, 'ledger');
const LEDGER_ON = (env.MODEL_LEDGER ?? 'on') === 'on';
function ledger(a, req) {
  if (!LEDGER_ON) return;
  try {
    fs.mkdirSync(LEDGER_DIR, { recursive: true });
    const ts = new Date().toISOString();
    const line = { ts, conversation_id: req.conversation_id ?? null, turn_no: req.turn_no ?? null, purpose: req.purpose ?? null, run: env.BENCH_RUN_ID ?? null, ...a };
    fs.appendFileSync(path.join(LEDGER_DIR, `${ts.slice(0, 10)}.jsonl`), JSON.stringify(line) + '\n');
  } catch { /* 원장 실패가 호출을 막지 않게 */ }
}

const RETRIES = 2; // 재시도 2회 = 최대 3번 시도. 모든 시도를 attempts 로 남긴다.
const BACKOFF_MS = 600;

const CLIENTS = { anthropic: AnthropicClient, openai: OpenAIClient, gemini: GeminiClient, deepseek: DeepSeekClient, deepinfra: DeepInfraClient };
const clients = {};
// MODEL_TIMEOUT_MS: 호출 제한 시간(기본은 클라이언트별 60초). 긴 입력을 생각하며 읽는 판정관(Kimi 등)용
const TIMEOUT = env.MODEL_TIMEOUT_MS ? { timeoutMs: Number(env.MODEL_TIMEOUT_MS) } : {};
function client(provider) {
  clients[provider] ??= new CLIENTS[provider](TIMEOUT);
  return clients[provider];
}

// 문자 종류별 계수. Haiku 5.5 count_tokens 실측(2026-10-23, judge/data 4개 언어 문장 묶음)으로 맞춘 값:
//   한글 1.47 · 한자 1.37 · 가나 0.96 · 그 밖(라틴·숫자·공백·문장부호) 0.34 /자
// 토크나이저는 모델마다 달라 추정일 뿐이고(예산 계산용), 과금은 항상 응답의 usage 로 한다.
export const TOKEN_COEF = { hangul: 1.47, han: 1.37, kana: 0.96, other: 0.34 };
export function estimateTokens(text) {
  const s = text ?? '';
  const hangul = (s.match(/[가-힣]/g) ?? []).length;
  const han = (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const kana = (s.match(/[\u3040-\u30ff]/g) ?? []).length;
  const other = s.length - hangul - han - kana;
  return Math.ceil(hangul * TOKEN_COEF.hangul + han * TOKEN_COEF.han + kana * TOKEN_COEF.kana + other * TOKEN_COEF.other);
}

export function pricing() {
  return {
    source: 'model/pricing.json (각 모델 항목의 source 참고)',
    as_of: PRICES.as_of,
    fx_krw_per_usd: PRICES.fx_krw_per_usd,
    fx_source: PRICES.fx_source,
    models: { response: config.response, extract: config.extract, embed: config.embed },
    cache: config.cache ? 'on' : 'off',
    reasoning: config.reasoning,
    reasoning_response: config.reasoning_response,
    reasoning_extract: config.reasoning_extract,
  };
}

export async function complete(req) {
  const model = req.model ?? (req.purpose === 'response' ? config.response : config.extract);
  const spec = PRICES.models[model];
  if (!spec) throw Object.assign(new Error(`pricing.json 에 없는 모델: ${model}`), { attempts: [] });
  const call = {
    model,
    system: (req.system ?? []).filter((b) => b?.text), // 빈 블록은 Anthropic 이 400 을 낸다
    messages: req.messages ?? [],
    max_tokens: req.max_tokens ?? 200,
    temperature: req.temperature,
    json: req.response_format === 'json',
    reasoning: req.purpose === 'response' ? config.reasoning_response : config.reasoning_extract,
    cache: config.cache,
    cache_history: req.cache_history === true,
    cache_key: config.cache && req.conversation_id != null ? `lite-${req.conversation_id}-${req.purpose ?? 'x'}` : undefined,
    spec,
  };
  // 스트리밍(선택): onDelta 로 조각을 넘기고 signal 로 중지한다. 조각을 한 번이라도 넘긴 뒤에는 재시도하지 않는다(화면 중복 방지).
  // 스트리밍을 못 하는 제공사(Gemini)는 onDelta 를 부르지 않고 끝에 전체 텍스트만 돌려준다.
  let emitted = false;
  if (req.onDelta) call.onDelta = (d) => { emitted = true; try { req.onDelta(d); } catch { /* 앱 쪽 오류가 생성을 막지 않게 */ } };
  if (req.signal) call.signal = req.signal;
  const attempts = [];
  const rec = (a) => { attempts.push(a); ledger(a, req); };
  for (let i = 0; i <= RETRIES; i++) {
    if (req.signal?.aborted) return { text: '', attempts, aborted: true };
    const t0 = Date.now();
    try {
      const r = await client(spec.provider).call(call);
      // 중지 등으로 제공사 usage 가 없으면 토큰을 추정하고 tokens_estimated 로 표시한다(실측과 섞이지 않게)
      let usage = r.usage, estimated = false;
      if (!usage || usage.output_tokens == null) {
        estimated = true;
        usage = { ...(usage ?? { ...emptyUsage(), input_tokens: estimateTokens(call.system.map((b) => b.text).join('') + call.messages.map((m) => m.content).join('')) }), output_tokens: estimateTokens(r.text) };
      }
      const a = attempt({ model, spec, usage, ok: true, latency_ms: Date.now() - t0, tag: req.tag, finish_reason: r.finish_reason,
        request_id: r.request_id, raw_usage: r.raw_usage, estimated, aborted: r.aborted });
      // 깨진 글자(U+FFFD)가 제공사 응답 단계에서 이미 있었는지 원장에 남긴다(앱·화면 단계와 구분용)
      const bad = r.text.split('\uFFFD').length - 1;
      if (bad) a.replacement_chars = bad;
      rec(a);
      return { text: r.text, attempts, ...(r.aborted ? { aborted: true } : {}) };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError(String(e?.message ?? e));
      rec(attempt({ model, spec, usage: err.usage ?? emptyUsage(), ok: false, latency_ms: Date.now() - t0, tag: req.tag, error: errText(err),
        request_id: err.request_id, raw_usage: err.raw_usage }));
      if (req.signal?.aborted) return { text: '', attempts, aborted: true }; // 스트리밍이 아닌 호출을 중지한 경우
      if (!err.retryable || i === RETRIES || emitted) throw Object.assign(new Error(`${model}: ${errText(err)}`), { attempts, emitted });
      await sleep(BACKOFF_MS * 2 ** i);
    }
  }
}

async function embedImpl({ texts, tag, conversation_id, turn_no, purpose }) {
  const model = config.embed;
  const spec = PRICES.models[model];
  const attempts = [];
  const rec = (a) => { attempts.push(a); ledger(a, { conversation_id, turn_no, purpose: purpose ?? 'embed' }); };
  for (let i = 0; i <= RETRIES; i++) {
    const t0 = Date.now();
    try {
      const r = await client(spec.provider).embed({ model, texts, dim: spec.dim });
      const input = r.input_tokens ?? texts.reduce((s, t) => s + estimateTokens(t), 0);
      rec(attempt({ model, spec, usage: { ...emptyUsage(), input_tokens: input }, ok: true, latency_ms: Date.now() - t0, tag,
        estimated: r.input_tokens == null, raw_usage: r.raw_usage }));
      return { vectors: r.vectors, attempts };
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError(String(e?.message ?? e));
      rec(attempt({ model, spec, usage: emptyUsage(), ok: false, latency_ms: Date.now() - t0, tag, error: errText(err) }));
      if (!err.retryable || i === RETRIES) throw Object.assign(new Error(`${model}: ${errText(err)}`), { attempts });
      await sleep(BACKOFF_MS * 2 ** i);
    }
  }
}
export const embed = config.embed ? embedImpl : undefined;
export const embedDim = config.embed ? PRICES.models[config.embed].dim : null;

// 비용 계산. 캐시를 끌 수 없는 제공사(OpenAI·Gemini·DeepSeek·DeepInfra)는 MODEL_CACHE=off 일 때
// 캐시 읽기분을 정가로 계산한다(= 캐시가 없었다면의 비용). cache_priced_as 로 표시.
// DeepSeek 은 시간대별 단가: 피크 = 평일(월~금) 01–04·06–10 UTC, 그 밖은 절반(offpeak).
// 중국 공휴일도 비피크지만 달력을 알 수 없어 피크로 계산한다(그날은 실제보다 높게 나옴 — price_window 로 표시).
export function priceWindow(spec, at) {
  if (!spec.offpeak) return null;
  const d = at.getUTCDay(), h = at.getUTCHours();
  const peak = d >= 1 && d <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
  return peak ? 'peak' : 'offpeak';
}

function attempt({ model, spec: baseSpec, usage, ok, latency_ms, tag, error, finish_reason, estimated, aborted, request_id, raw_usage, started_at = new Date(Date.now() - (latency_ms ?? 0)) }) {
  const window = priceWindow(baseSpec, started_at);
  const spec = window === 'offpeak' ? { ...baseSpec, ...baseSpec.offpeak } : baseSpec;
  const fx = PRICES.fx_krw_per_usd;
  const usd = (tokens, perM) => (tokens * (perM ?? 0)) / 1e6;
  const implicitOff = !config.cache && spec.provider !== 'anthropic';
  const cachedRate = implicitOff ? spec.input : spec.cached ?? spec.input;
  const writeRate = spec.cache_write ?? spec.input;
  const inputUsd = usd(usage.input_tokens, spec.input) + usd(usage.cache_read_tokens, cachedRate) + usd(usage.cache_write_tokens, writeRate);
  const outputUsd = usd(usage.output_tokens, spec.output);
  return {
    model,
    ok,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read_tokens,
    cache_write_tokens: usage.cache_write_tokens,
    reasoning_tokens: usage.reasoning_tokens,
    input_krw: inputUsd * fx,
    output_krw: outputUsd * fx,
    cost_krw: (inputUsd + outputUsd) * fx,
    latency_ms,
    ...(tag ? { tag } : {}),
    ...(error ? { error } : {}),
    ...(finish_reason ? { finish_reason } : {}),
    ...(implicitOff ? { cache_priced_as: 'uncached' } : {}),
    ...(estimated ? { tokens_estimated: true } : {}),
    ...(aborted ? { aborted: true } : {}),
    provider: spec.provider,
    started_at: started_at.toISOString(),
    ...(window ? { price_window: window } : {}),
    request_id: request_id ?? null,
    raw_usage: raw_usage ?? null,
    // 계산 근거를 같이 남긴다: 어떤 단가($/1M)와 환율로 계산했는지
    rates: { input: spec.input, cached: cachedRate, cache_write: writeRate, output: spec.output, fx: fx, pricing_as_of: PRICES.as_of },
    cost_usd: inputUsd + outputUsd,
  };
}

const errText = (e) => `${e.status ?? 'ERR'} ${e.message}`.slice(0, 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

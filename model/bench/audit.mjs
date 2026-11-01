// 비용 검산. 원장(ledger/*.jsonl)의 제공사 원본 usage 만 가지고 비용을 다시 계산해, 기록된 비용과 맞는지 본다.
// 클라이언트의 usage 정규화(readUsage 등)와 index.js 의 비용 계산을 거치지 않는 별도 코드라, 거기 오류가 있으면 여기서 어긋난다.
// 제공사 집계와의 대조(있는 그대로의 과금):
//   Anthropic: ANTHROPIC_ADMIN_KEY 가 있으면 Usage API 의 토큰 집계와 비교(일반 키로는 401).
//   DeepInfra: /payment/usage 의 월별·모델별 과금 토큰과 비교.
//   DeepSeek: --balance 로 잔액을 찍어 두고 실행 전후 차이를 본다(잔액이 센트 단위라 큰 실행에서만 의미 있음).
//   그 밖에는 원장의 request_id 로 콘솔 로그와 한 건씩 대조한다.
// 사용: node bench/audit.mjs [--run <BENCH_RUN_ID>] [--since <ISO>] [--until <ISO>] [--balance]
import fs from 'node:fs';
import path from 'node:path';

const ROOT_ENV = path.resolve(import.meta.dirname, '..', '..', '.env');
if (fs.existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);
const PRICES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'pricing.json'), 'utf8'));
const LEDGER_DIR = process.env.MODEL_LEDGER_DIR ?? path.join(import.meta.dirname, '..', 'ledger');

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

if (args.includes('--balance')) {
  const r = await fetch('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` } });
  console.log(new Date().toISOString(), 'deepseek', JSON.stringify(await r.json()));
  process.exit(0);
}

const since = opt('--since'), until = opt('--until'), run = opt('--run');
const rows = fs.existsSync(LEDGER_DIR)
  ? fs.readdirSync(LEDGER_DIR).filter((f) => f.endsWith('.jsonl')).sort()
    .flatMap((f) => fs.readFileSync(path.join(LEDGER_DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
  : [];
const sel = rows.filter((r) => (!since || r.ts >= since) && (!until || r.ts <= until) && (!run || r.run === run));
if (!sel.length) { console.log('해당 원장 기록 없음'); process.exit(0); }

// 제공사 원본 usage → 과금 구간별 토큰. 제공사 문서의 필드 의미 그대로.
function billable(provider, u) {
  if (!u) return null;
  switch (provider) {
    case 'anthropic': // input_tokens 는 캐시 제외분, 캐시 읽기·쓰기는 따로
      return { input: u.input_tokens ?? 0, cached: u.cache_read_input_tokens ?? 0, write: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0 };
    case 'openai': case 'deepinfra': { // prompt_tokens 에 캐시분 포함
      const c = u.prompt_tokens_details?.cached_tokens ?? 0;
      return { input: (u.prompt_tokens ?? 0) - c, cached: c, write: 0, output: u.completion_tokens ?? 0 };
    }
    case 'deepseek':
      return { input: u.prompt_cache_miss_tokens ?? 0, cached: u.prompt_cache_hit_tokens ?? 0, write: 0, output: u.completion_tokens ?? 0 };
    case 'gemini': {
      if (u.count_tokens_per_text) return { input: u.count_tokens_per_text.reduce((a, b) => a + b, 0), cached: 0, write: 0, output: 0 };
      const c = u.cachedContentTokenCount ?? 0; // promptTokenCount 에 캐시분 포함, 출력 = 후보 + 생각
      return { input: (u.promptTokenCount ?? 0) - c, cached: c, write: 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
    }
  }
  return null;
}

const agg = {};
let mismatch = 0, noRaw = 0, estimated = 0, providerMismatch = 0;
for (const r of sel) {
  const base = PRICES.models[r.model];
  // DeepSeek 시간대 단가를 여기서 따로 판정한다(피크 = 평일 01–04·06–10 UTC). 기록된 price_window 는 쓰지 않는다.
  let spec = base;
  if (base?.offpeak) {
    const t = new Date(r.started_at ?? r.ts), d = t.getUTCDay(), h = t.getUTCHours();
    const peak = d >= 1 && d <= 5 && [1, 2, 3, 6, 7, 8, 9].includes(h);
    if (!peak) spec = { ...base, ...base.offpeak };
  }
  const k = r.model;
  agg[k] ??= { calls: 0, failed: 0, input: 0, cached: 0, write: 0, output: 0, usd_logged: 0, usd_recomputed: 0, ids: 0 };
  const a = agg[k];
  a.calls++; if (!r.ok) a.failed++; if (r.request_id) a.ids++;
  a.usd_logged += r.cost_usd ?? 0;
  if (r.tokens_estimated) estimated++;
  // 토큰 추정 행(스트림 중지 등)은 제공사 usage 가 없거나 중간값이라 기록된 토큰 수로 계산만 검산한다
  const b = r.tokens_estimated
    ? { input: r.input_tokens, cached: r.cache_read_tokens, write: r.cache_write_tokens, output: r.output_tokens }
    : billable(r.provider ?? base?.provider, r.raw_usage);
  if (!b) { if (r.ok) noRaw++; continue; }
  for (const f of ['input', 'cached', 'write', 'output']) a[f] += b[f];
  // 단가는 기록 당시 쓴 값(r.rates)이 아니라 지금 pricing.json 에서 다시 읽는다. 기록 당시 값과 다르면 그것도 어긋남으로 잡힌다.
  const cachedRate = r.cache_priced_as === 'uncached' ? spec.input : spec.cached ?? spec.input;
  const usd = (b.input * spec.input + b.cached * cachedRate + b.write * (spec.cache_write ?? spec.input) + b.output * spec.output) / 1e6;
  a.usd_recomputed += usd;
  // DeepInfra 는 응답에 제공사가 계산한 요청별 비용(estimated_cost)을 준다 → 요청 단위로 제공사와 대조
  if (r.raw_usage?.estimated_cost != null) {
    a.provider_usd = (a.provider_usd ?? 0) + r.raw_usage.estimated_cost;
    if (Math.abs(usd - r.raw_usage.estimated_cost) > 1e-9) {
      providerMismatch++;
      if (providerMismatch <= 10) console.log('제공사 비용과 어긋남', r.ts, r.model, r.request_id, { recomputed: usd, provider: r.raw_usage.estimated_cost });
    }
  }
  if (Math.abs(usd - (r.cost_usd ?? 0)) > 1e-9) {
    mismatch++;
    if (mismatch <= 10) console.log('어긋남', r.ts, r.model, r.request_id, { logged: r.cost_usd, recomputed: usd, raw: r.raw_usage });
  }
}

const fx = PRICES.fx_krw_per_usd;
console.log(`\n원장 ${sel.length}건 (${sel[0].ts} ~ ${sel.at(-1).ts}) · 환율 ${fx}원/$ (${PRICES.fx_source ?? 'pricing.json'}) · 단가 기준일 ${PRICES.as_of}`);
console.log(`검산 불일치 ${mismatch}건 · 제공사 요청별 비용과 불일치 ${providerMismatch}건(DeepInfra) · 원본 usage 없음(성공 호출) ${noRaw}건 · 토큰 추정 ${estimated}건(중지된 스트림 등: 출력은 받은 텍스트로 추정, 실제 과금은 조금 더 클 수 있음)\n`);
console.log('모델 | 호출(실패) | 요청ID | 입력 | 캐시읽기 | 캐시쓰기 | 출력 | 기록 $ | 재계산 $ | 원');
for (const [m, a] of Object.entries(agg)) {
  console.log([m, `${a.calls}(${a.failed})`, a.ids, a.input, a.cached, a.write, a.output, a.usd_logged.toFixed(6), a.usd_recomputed.toFixed(6), (a.usd_recomputed * fx).toFixed(2)].join(' | '));
}

// Anthropic 제공사 집계와 대조(관리자 키가 있을 때만). 같은 키를 다른 세션도 쓰면 그 사용량도 섞이므로
// 벤치 전용 API 키를 만들어 --api-key-id 로 거르거나, 다른 사용이 없는 시간대에 돌린다.
const admin = process.env.ANTHROPIC_ADMIN_KEY;
const anth = sel.filter((r) => (r.provider ?? PRICES.models[r.model]?.provider) === 'anthropic');
if (admin && anth.length) {
  const start = new Date(new Date(anth[0].ts).getTime() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const end = new Date(new Date(anth.at(-1).ts).getTime() + 120_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const q = new URLSearchParams({ starting_at: start, ending_at: end, bucket_width: '1m' });
  q.append('group_by[]', 'model');
  const keyId = opt('--api-key-id');
  if (keyId) q.append('api_key_ids[]', keyId);
  const out = [];
  let page;
  do {
    if (page) q.set('page', page);
    const res = await fetch(`https://api.anthropic.com/v1/organizations/usage_report/messages?${q}`, { headers: { 'x-api-key': admin, 'anthropic-version': '2023-06-01' } });
    const j = await res.json();
    if (!res.ok) { console.log('\nAnthropic Usage API 오류', res.status, JSON.stringify(j).slice(0, 300)); break; }
    out.push(...j.data);
    page = j.has_more ? j.next_page : null;
  } while (page);
  const sum = { input: 0, cached: 0, write: 0, output: 0 };
  for (const bucket of out) for (const x of bucket.results ?? []) {
    sum.input += x.uncached_input_tokens ?? 0;
    sum.cached += x.cache_read_input_tokens ?? 0;
    sum.write += (x.cache_creation?.ephemeral_5m_input_tokens ?? 0) + (x.cache_creation?.ephemeral_1h_input_tokens ?? 0);
    sum.output += x.output_tokens ?? 0;
  }
  const mine = { input: 0, cached: 0, write: 0, output: 0 };
  for (const r of anth) { const b = billable('anthropic', r.raw_usage); if (b) for (const f in mine) mine[f] += b[f]; }
  console.log(`\nAnthropic 제공사 집계 ${start} ~ ${end}${keyId ? ` (키 ${keyId})` : ' (키 구분 없음 — 다른 세션 사용분이 섞일 수 있음)'}`);
  for (const f in mine) console.log(`  ${f}: 원장 ${mine[f]} / 제공사 ${sum[f]} / 차이 ${sum[f] - mine[f]}`);
} else if (anth.length) {
  console.log('\nAnthropic 제공사 집계 대조는 ANTHROPIC_ADMIN_KEY(콘솔 → Settings → Admin keys)가 있어야 한다. 지금은 원장 검산만 했다.');
}

// DeepInfra 제공사 집계와 대조: /payment/usage 는 월 단위·모델별 과금 토큰(units)을 준다(rate 단위는 센트/토큰).
// 월 단위라 선택 구간이 아니라 그 달 원장 전체와 비교한다. 이 키를 우리 코드만 쓴다는 전제.
const di = rows.filter((r) => (r.provider ?? PRICES.models[r.model]?.provider) === 'deepinfra');
if (di.length && process.env.DEEPINFRA_API_KEY) {
  const months = [...new Set(sel.map((r) => r.ts.slice(0, 7)))];
  for (const m of months) {
    const res = await fetch(`https://api.deepinfra.com/payment/usage?from=${m.replace('-', '.')}`, { headers: { Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}` } });
    const j = await res.json();
    if (!res.ok) { console.log('\nDeepInfra usage API 오류', res.status, JSON.stringify(j).slice(0, 200)); continue; }
    const theirs = {};
    for (const it of j.months?.[0]?.items ?? []) {
      const k = it.model.model_name;
      theirs[k] ??= { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      if (it.pricing_type in theirs[k]) theirs[k][it.pricing_type] += it.units;
      theirs[k].cost_usd += (it.units * it.rate) / 100;
    }
    const mine = {};
    for (const r of di.filter((x) => x.ts.startsWith(m))) {
      const b = billable('deepinfra', r.raw_usage);
      if (!b) continue;
      mine[r.model] ??= { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      mine[r.model].input_tokens += b.input + b.cached;
      mine[r.model].output_tokens += b.output;
      mine[r.model].cost_usd += r.cost_usd ?? 0;
    }
    console.log(`\nDeepInfra 제공사 집계 ${m} (월 전체, 원장에 없는 직접 호출도 제공사 쪽엔 포함)`);
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const a = mine[k] ?? { input_tokens: 0, output_tokens: 0, cost_usd: 0 }, b = theirs[k] ?? { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
      console.log(`  ${k}: 입력 원장 ${a.input_tokens} / 제공사 ${b.input_tokens} · 출력 원장 ${a.output_tokens} / 제공사 ${b.output_tokens} · $ 원장 ${a.cost_usd.toFixed(6)} / 제공사 단가×토큰 ${b.cost_usd.toFixed(6)}`);
    }
  }
}

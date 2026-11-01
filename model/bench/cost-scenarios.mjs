// 대화 모델 비교 비용을 기록된 토큰으로 다시 계산한다(0원, docs/50 리뷰 지적 4).
// 시나리오: measured(기록값) · offpeak(DeepSeek 을 모두 비피크 단가로 — 피크 시간에 돈 런을 비피크 런과 맞출 때) · peak(DeepSeek 을 피크 단가로) · nocache(캐시 적중 0: 캐시 읽기·쓰기분을 입력 정가로) · peak+nocache(최악)
// 사용: node bench/cost-scenarios.mjs [--prefix dm2] → out/cost-<prefix>.json, .md
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const PREFIX = argv.includes('--prefix') ? argv[argv.indexOf('--prefix') + 1] : 'dm2';
const OUT = path.join(import.meta.dirname, 'out');
const PRICES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'pricing.json'), 'utf8'));
const FX = PRICES.fx_krw_per_usd;

function cost(c, { peak, nocache, allOffpeak }) {
  const base = PRICES.models[c.model];
  if (!base || c.input_tokens == null) return c.cost_krw ?? 0; // 임베딩 등 단가 구조가 다른 호출은 기록값
  const offpeak = base.offpeak && allOffpeak ? true : base.offpeak && !peak && c.input_krw != null && Math.abs(c.input_krw + c.output_krw - c.cost_krw) < 1e-9 && wasOffpeak(c, base);
  const s = offpeak ? { ...base, ...base.offpeak } : base;
  const usd = (t, r) => ((t ?? 0) * (r ?? 0)) / 1e6;
  const cached = nocache ? s.input : s.cached ?? s.input;
  const write = nocache ? s.input : s.cache_write ?? s.input;
  return (usd(c.input_tokens, s.input) + usd(c.cache_read_tokens, cached) + usd(c.cache_write_tokens, write) + usd(c.output_tokens, s.output)) * FX;
}
// 기록된 출력 비용이 오프피크 단가와 맞으면 그 호출은 오프피크로 계산된 것
function wasOffpeak(c, base) {
  if (!c.output_tokens) return true;
  return Math.abs(c.output_krw - (c.output_tokens * base.offpeak.output * FX) / 1e6) < Math.abs(c.output_krw - (c.output_tokens * base.output * FX) / 1e6);
}

const agg = {};
for (const d of fs.readdirSync(OUT)) {
  const m = d.match(new RegExp(`^\\d{14}-(.+)-${PREFIX}-(.+)-r(\\d+)$`));
  if (!m || !fs.existsSync(path.join(OUT, d, 'run.json'))) continue;
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const a = (agg[m[2]] ??= { turns: 0, runs: 0, measured: 0, offpeak: 0, peak: 0, nocache: 0, worst: 0, deepseek_offpeak_calls: 0, deepseek_calls: 0 });
  a.turns += run.turns.length; a.runs++;
  for (const c of run.calls) {
    a.measured += c.cost_krw ?? 0;
    a.offpeak += cost(c, { peak: false, nocache: false, allOffpeak: true });
    a.peak += cost(c, { peak: true, nocache: false });
    a.nocache += cost(c, { peak: false, nocache: true });
    a.worst += cost(c, { peak: true, nocache: true });
    const b = PRICES.models[c.model];
    if (b?.offpeak) { a.deepseek_calls++; if (wasOffpeak(c, b)) a.deepseek_offpeak_calls++; }
  }
}
const rows = Object.entries(agg).sort(([a], [b]) => a.localeCompare(b)).map(([cond, a]) => ({ cond, runs: a.runs, turns: a.turns,
  measured: a.measured / a.turns, offpeak: a.offpeak / a.turns, peak: a.peak / a.turns, nocache: a.nocache / a.turns, worst: a.worst / a.turns, deepseek_offpeak: a.deepseek_calls ? `${a.deepseek_offpeak_calls}/${a.deepseek_calls}` : '–' }));
const L = [`# 턴당 비용 시나리오 (${PREFIX})`, '', `생성 ${new Date().toISOString()} · 기록된 토큰으로 재계산(0원) · 환율 ${FX}원/$ · 대화+추출+정리+임베딩, 종료 정리 포함`, '',
  '| 조건 | 런 | 기록값 | DeepSeek 모두 비피크 | DeepSeek 피크 단가 | 캐시 0 | 피크 + 캐시 0 (최악) | DeepSeek 호출 중 오프피크 |', '|---|---|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| ${r.cond} | ${r.runs} | ${r.measured.toFixed(3)}원 | ${r.offpeak.toFixed(3)}원 | ${r.peak.toFixed(3)}원 | ${r.nocache.toFixed(3)}원 | ${r.worst.toFixed(3)}원 | ${r.deepseek_offpeak} |`);
fs.writeFileSync(path.join(OUT, `cost-${PREFIX}.json`), JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1));
fs.writeFileSync(path.join(OUT, `cost-${PREFIX}.md`), L.join('\n'));
console.log(L.join('\n'));

// 판단 모델 v2 B단계 채점 (docs/50-decision-log.md 사전 등록). 정답: b-gold.json, 대조 문자열 = 활성 항목 text + ' ' + when.
// 사용: node judge/v2/b-score.mjs → b-out/b-summary.json, b-out/b-report.md
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, 'b-out');
const GOLD = JSON.parse(fs.readFileSync(path.join(HERE, 'b-gold.json'), 'utf8')).scenarios;
const runs = fs.readdirSync(OUT).filter((f) => /-r\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
const models = [...new Set(runs.map((r) => r.model_id))].sort();
const SCS = Object.keys(GOLD);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

const matchAll = (s, groups) => groups.every((g) => g.some((k) => s.includes(k)));
function scoreRun(r) {
  const g = GOLD[r.scenario];
  const act = r.memory.items.filter((i) => i.status === 'active');
  const strs = act.map((i) => `${i.text} ${i.when ?? ''}`);
  const facts = g.facts.map((f) => ({ id: f.id, ok: strs.some((s) => matchAll(s, f.all)) }));
  const stale = g.stale.map((st) => ({ id: st.id, items: strs.filter((s) => matchAll(s, st.all) && !st.unless.some((u) => s.includes(u))) })).filter((x) => x.items.length);
  const ex = r.steps.filter((s) => s.kind === 'update');
  const att = r.steps.flatMap((s) => s.attempts);
  const exAtt = att.filter((a) => a.tag === 'extract');
  const log = r.memory.ops_log ?? [];
  const cnt = (op) => log.filter((l) => l.op === op).length;
  return {
    fact_rate: facts.filter((f) => f.ok).length / facts.length, missed: facts.filter((f) => !f.ok).map((f) => f.id),
    stale_n: stale.length, stale,
    active: act.length, missing_struct: act.filter((i) => !i.slot || !i.entity).length,
    parse_fail_steps: ex.filter((s) => s.parsed_ok === false).length, consolidate_fail: r.steps.filter((s) => s.kind === 'consolidate' && s.parsed_ok === false).length, episodes: (r.memory.episodes ?? []).length, error_steps: r.steps.filter((s) => s.error).length,
    extract_calls: exAtt.length, failed_calls: att.filter((a) => !a.ok).length,
    truncated: exAtt.filter((a) => ['max_tokens', 'length', 'MAX_TOKENS'].includes(a.finish_reason)).length,
    update_skipped: cnt('UPDATE_SKIPPED'), update_as_add: cnt('UPDATE_AS_ADD'), retarget: cnt('UPDATE_RETARGET'), updates: cnt('UPDATE'), drops: cnt('DROP'),
    cost: r.cost_krw, cost_per_turn: r.cost_krw / 40, extract_cost: r.cost_by_tag.extract ?? 0, consolidate_cost: r.cost_by_tag.consolidate ?? 0,
    out_tokens: exAtt.reduce((s, a) => s + (a.output_tokens ?? 0), 0),
    price_windows: [...new Set(att.map((a) => a.price_window).filter(Boolean))],
  };
}

const summary = {};
for (const id of models) {
  const rs = runs.filter((r) => r.model_id === id).map((r) => ({ sc: r.scenario, rep: r.rep, ...scoreRun(r) }));
  const agg = (k) => mean(rs.map((x) => x[k]));
  const sum = (k) => rs.reduce((s, x) => s + x[k], 0);
  const missedFreq = {};
  for (const x of rs) for (const m of x.missed) missedFreq[`${x.sc}:${m}`] = (missedFreq[`${x.sc}:${m}`] ?? 0) + 1;
  const staleFreq = {};
  for (const x of rs) for (const s of x.stale) staleFreq[`${x.sc}:${s.id}`] = (staleFreq[`${x.sc}:${s.id}`] ?? 0) + 1;
  summary[id] = {
    runs: rs.length,
    fact_rate: agg('fact_rate'), fact_rate_min: Math.min(...rs.map((x) => x.fact_rate)), fact_rate_max: Math.max(...rs.map((x) => x.fact_rate)),
    by_scenario: Object.fromEntries(SCS.map((sc) => [sc, mean(rs.filter((x) => x.sc === sc).map((x) => x.fact_rate))])),
    stale_per_run: agg('stale_n'), missing_struct: sum('missing_struct'), active_avg: agg('active'),
    parse_fail_steps: sum('parse_fail_steps'), consolidate_fail: sum('consolidate_fail'), episodes: sum('episodes'), error_steps: sum('error_steps'), failed_calls: sum('failed_calls'), truncated: sum('truncated'),
    update_skipped: sum('update_skipped'), update_as_add: sum('update_as_add'), retarget: sum('retarget'), updates: sum('updates'), drops: sum('drops'),
    cost_per_turn: agg('cost_per_turn'), extract_per_turn: agg('extract_cost') / 40, consolidate_per_conv: agg('consolidate_cost'), out_tokens_per_run: agg('out_tokens'),
    price_windows: [...new Set(rs.flatMap((x) => x.price_windows))],
    missed_freq: missedFreq, stale_freq: staleFreq, runs_detail: rs,
  };
}
fs.writeFileSync(path.join(OUT, 'b-summary.json'), JSON.stringify({ generated: new Date().toISOString(), summary }, null, 1));

const pct = (v) => (Number.isNaN(v) ? '–' : (v * 100).toFixed(1));
const L = ['# 판단 모델 v2 B단계 결과 (실제 추출 흐름, 한국어)', '', `생성: ${new Date().toISOString()} · 원자료: model/judge/v2/b-out/*.json · 정답: b-gold.json · 규칙: docs/50-decision-log.md`, ''];
L.push('| 모델 | 런 | 사실 저장률 (평균, 범위) | baekho / naruto / backend / sejong | 옛 값 잔존/런 | 구조 누락 | 추출 파싱 실패 단계 | 정리 실패 / 에피소드 생성 | 실패 호출 | 잘림 | UPDATE / SKIPPED / AS_ADD / RETARGET | 턴당 기억 비용 (추출+정리) | 추출 출력 토큰/런 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const id of models) {
  const s = summary[id];
  L.push(`| ${id} | ${s.runs} | ${pct(s.fact_rate)} (${pct(s.fact_rate_min)}~${pct(s.fact_rate_max)}) | ${SCS.map((sc) => pct(s.by_scenario[sc])).join(' / ')} | ${s.stale_per_run.toFixed(2)} | ${s.missing_struct} | ${s.parse_fail_steps} | ${s.consolidate_fail} / ${s.episodes} | ${s.failed_calls} | ${s.truncated} | ${s.updates} / ${s.update_skipped} / ${s.update_as_add} / ${s.retarget} | ${s.cost_per_turn.toFixed(3)}원 (추출 ${s.extract_per_turn.toFixed(3)} + 정리 ${(s.consolidate_per_conv / 40).toFixed(3)}) | ${Math.round(s.out_tokens_per_run)} |`);
}
L.push('', '## 놓친 사실 (빈도 = 런 수)', '');
for (const id of models) L.push(`- **${id}**: ${Object.entries(summary[id].missed_freq).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ') || '없음'}`);
L.push('', '## 옛 값 잔존 (빈도 = 런 수)', '');
for (const id of models) L.push(`- **${id}**: ${Object.entries(summary[id].stale_freq).map(([k, v]) => `${k} ×${v}`).join(', ') || '없음'}`);
fs.writeFileSync(path.join(OUT, 'b-report.md'), L.join('\n'));
console.log(L.join('\n'));

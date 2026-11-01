// 대화 모델 비교 집계(키워드·규칙 채점, 0원). run.json 을 score.js 로 다시 채점해 조건별로 합친다. AI 판정·짝 비교는 따로(judge-batch, pair-run).
// 사용: node bench/dm-summary.mjs [--prefix dm2] → bench/out/summary-<prefix>.json, .md
import fs from 'node:fs';
import path from 'node:path';
import { scoreRun } from './score.js';

const argv = process.argv.slice(2);
const PREFIX = argv.includes('--prefix') ? argv[argv.indexOf('--prefix') + 1] : 'dm2';
const OUT = path.join(import.meta.dirname, 'out');
const RULES = ['user_action', 'meta_or_empty', 'lang_mix', 'speech_mismatch'];
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null; };

const runs = [];
for (const d of fs.readdirSync(OUT)) {
  const m = d.match(new RegExp(`^\\d{14}-(.+)-${PREFIX}-(.+)-r(\\d+)$`));
  if (!m || !fs.existsSync(path.join(OUT, d, 'run.json'))) continue;
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${run.scenario}.json`), 'utf8'));
  const kind = run.scenario.includes('-revisit-') ? 'revisit' : run.scenario.includes('-situ-') ? 'situ' : 'mem';
  runs.push({ dir: d, cond: m[2], kind, run, score: scoreRun(sc, run), sc });
}
const conds = [...new Set(runs.map((r) => r.cond))].sort((a, b) => (a.startsWith('ctl') - b.startsWith('ctl')) || a.localeCompare(b));
const rows = conds.map((c) => {
  const rs = runs.filter((r) => r.cond === c);
  const memRuns = rs.filter((r) => r.kind !== 'situ');
  const lat = rs.flatMap((r) => r.run.calls.filter((x) => x.tag === 'response' && x.ok).map((x) => x.latency_ms));
  const turns = rs.reduce((s, r) => s + r.run.turns.length, 0);
  const bad = rs.reduce((s, r) => s + new Set(RULES.flatMap((k) => r.score.quality.flag_turns?.[k] ?? [])).size, 0);
  const byRule = Object.fromEntries(RULES.map((k) => [k, rs.reduce((s, r) => s + (r.score.quality.flags[k] ?? 0), 0)]));
  const pts = (k) => memRuns.filter((r) => !k || r.kind === k).reduce((s, r) => s + r.score.memory.points, 0);
  const max = (k) => memRuns.filter((r) => !k || r.kind === k).reduce((s, r) => s + r.score.memory.max_points_all, 0);
  const nj = memRuns.reduce((s, r) => s + (r.score.memory.counts.needs_judge ?? 0), 0);
  const fab = memRuns.reduce((s, r) => s + (r.score.memory.counts.fabricated ?? 0), 0);
  const empty = rs.reduce((s, r) => s + r.run.turns.filter((t) => !(t.reply ?? '').trim()).length, 0);
  // 비용: 턴당 = (대화 중 호출 + 종료 정리) / 턴 수. 레인 동시 실행이라 캐시가 실제보다 잘 맞았을 수 있다(scoreCold 는 참고로 run.json 에 있음)
  const cost = rs.reduce((s, r) => s + r.score.cost.total_krw, 0) / turns;
  const byTag = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.score.cost.by_tag)) byTag[k] = (byTag[k] ?? 0) + v;
  return { cond: c, runs: rs.length, invalid: rs.filter((r) => !r.run.valid?.ok).map((r) => `${r.run.scenario}: ${r.run.valid?.reasons?.join(',')}`),
    lat_p50_s: lat.length ? q(lat, 0.5) / 1000 : null, lat_p95_s: lat.length ? q(lat, 0.95) / 1000 : null,
    rule_bad_turns: bad, turns, rule_bad_rate: bad / turns, by_rule: byRule, empty,
    mem_points: pts(), mem_max: max(), mem_points_mem: pts('mem'), mem_max_mem: max('mem'), mem_points_revisit: pts('revisit'), mem_max_revisit: max('revisit'), needs_judge: nj, fabricated_kw: fab,
    cost_per_turn: cost, cost_by_tag_per_turn: Object.fromEntries(Object.entries(byTag).map(([k, v]) => [k, v / turns])),
    avg_chars: rs.reduce((s, r) => s + r.score.quality.avg_chars * r.run.turns.length, 0) / turns };
});
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '–');
const L = [`# 대화 모델 비교 ${PREFIX} — 키워드·규칙 채점`, '', `생성 ${new Date().toISOString()} · 원자료 bench/out/*-${PREFIX}-*/run.json · AI 판정 전(판정 필요 문항은 0점)`, '',
  '| 조건 | 런 | 기억 점수 전체 (%) | 기억 대본 | 재방문 대본 | 판정 필요 | 지연 중앙값/95% | 규칙 위반 턴 | 빈 답 | 턴당 비용 (대화+추출+정리+임베딩) | 답 글자 | 무효 런 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| ${r.cond} | ${r.runs} | ${r.mem_points}/${r.mem_max} (${pct(r.mem_points, r.mem_max)}) | ${r.mem_points_mem}/${r.mem_max_mem} | ${r.mem_points_revisit}/${r.mem_max_revisit} | ${r.needs_judge} | ${r.lat_p50_s?.toFixed(1)} / ${r.lat_p95_s?.toFixed(1)}초 | ${r.rule_bad_turns}/${r.turns} (${pct(r.rule_bad_turns, r.turns)}%) ${JSON.stringify(r.by_rule)} | ${r.empty} | ${r.cost_per_turn.toFixed(3)}원 (${Object.entries(r.cost_by_tag_per_turn).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(' · ')}) | ${Math.round(r.avg_chars)} | ${r.invalid.length ? r.invalid.join('; ') : '0'} |`);
fs.writeFileSync(path.join(OUT, `summary-${PREFIX}.json`), JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1));
fs.writeFileSync(path.join(OUT, `summary-${PREFIX}.md`), L.join('\n'));
console.log(L.join('\n'));

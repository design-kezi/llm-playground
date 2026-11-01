// 대화 모델 1차 선별 집계(docs/50 "1차 선별 추가"). run.json 을 다시 채점(score.js, 0원)해 탈락 기준 4개를 계산한다.
// ① 대화 호출 지연 중앙값 > 5초 또는 95% > 10초 ② 규칙 위반 턴 > 10%(user_action·meta_or_empty·lang_mix·speech_mismatch 중 하나라도)
// ③ 기억 점수(키워드, 판정 필요 = 0점) < 대조군 ④ 턴당 평균(종료 포함) > 1원
// 사용: node bench/screen.mjs [--prefix dm1] → bench/out/screen-<prefix>.json, .md
import fs from 'node:fs';
import path from 'node:path';
import { scoreRun } from './score.js';

const argv = process.argv.slice(2);
const PREFIX = argv[argv.indexOf('--prefix') + 1] && argv.includes('--prefix') ? argv[argv.indexOf('--prefix') + 1] : 'dm1';
const OUT = path.join(import.meta.dirname, 'out');
const RULES = ['user_action', 'meta_or_empty', 'lang_mix', 'speech_mismatch'];
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null; };

const runs = [];
for (const d of fs.readdirSync(OUT)) {
  const m = d.match(new RegExp(`^\\d{14}-(.+)-${PREFIX}-(.+)-r(\\d+)$`));
  if (!m || !fs.existsSync(path.join(OUT, d, 'run.json'))) continue;
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${run.scenario}.json`), 'utf8'));
  runs.push({ dir: d, cond: m[2], scenario: run.scenario, run, score: scoreRun(sc, run) });
}
const conds = [...new Set(runs.map((r) => r.cond))].sort();
// 대조군: 최근 6턴 + 기억 끔(docs/30 §5.2). ctl-memoff 는 잘못 정의돼 대화 전체 전송과 같다(docs/50) — 참고로만 표에 남긴다
const ctl = runs.find((r) => r.cond === 'ctl-slide6-memoff' && r.scenario.endsWith('-40'));
const ctlFull = runs.find((r) => r.cond === 'ctl-memoff' && r.scenario.endsWith('-40'));
const memPts = (r) => r.score.memory.points; // 판정 필요(needs_judge)는 점수에 안 들어가 0점과 같다
const ctlPts = ctl ? memPts(ctl) : null;
const rows = [];
for (const c of conds.filter((c) => !c.startsWith('ctl-'))) {
  const rs = runs.filter((r) => r.cond === c);
  const lat = rs.flatMap((r) => r.run.calls.filter((x) => x.tag === 'response' && x.ok).map((x) => x.latency_ms));
  const turns = rs.reduce((s, r) => s + r.run.turns.length, 0);
  const bad = rs.reduce((s, r) => s + new Set(RULES.flatMap((k) => r.score.quality.flag_turns?.[k] ?? [])).size, 0);
  const byRule = Object.fromEntries(RULES.map((k) => [k, rs.reduce((s, r) => s + (r.score.quality.flags[k] ?? 0), 0)]));
  const mem = rs.find((r) => r.scenario.endsWith('-40'));
  const cost = rs.reduce((s, r) => s + r.score.cost.total_krw, 0) / turns;
  const valid = rs.every((r) => r.run.valid?.ok);
  const row = {
    cond: c, runs: rs.length, valid, invalid_reasons: rs.flatMap((r) => r.run.valid?.ok ? [] : r.run.valid?.reasons ?? []),
    lat_p50_s: q(lat, 0.5) / 1000, lat_p95_s: q(lat, 0.95) / 1000, rule_bad_turns: bad, rule_bad_rate: bad / turns, by_rule: byRule,
    mem_points: mem ? memPts(mem) : null, mem_max: mem?.score.memory.max_points_all ?? null, mem_needs_judge: mem?.score.memory.counts.needs_judge ?? 0,
    avg_chars: rs.reduce((s, r) => s + r.score.quality.avg_chars * r.run.turns.length, 0) / turns, cost_per_turn: cost,
  };
  row.fail = [
    ...(row.lat_p50_s > 5 || row.lat_p95_s > 10 ? ['지연'] : []),
    ...(row.rule_bad_rate > 0.1 ? ['규칙 위반'] : []),
    ...(ctlPts != null && row.mem_points != null && row.mem_points < ctlPts ? ['기억 < 대조군'] : []),
    ...(row.cost_per_turn > 1 ? ['비용'] : []),
  ];
  row.mem_border = ctlPts != null && row.mem_points != null && Math.abs(row.mem_points - ctlPts) <= 4;
  rows.push(row);
}
const L = [`# 1차 선별 (${PREFIX})`, '', `생성 ${new Date().toISOString()} · 원자료 bench/out/*-${PREFIX}-*/run.json · 기준 docs/50`, '',
  `대조군(최근 6턴 + 기억 끔) 기억 점수: ${ctlPts ?? '없음'}${ctl ? ` / ${ctl.score.memory.max_points_all}` : ''} · 참고: ctl-memoff(기억 끔, 창이 안 줄어 대화 전체 전송과 같음) ${ctlFull ? `${memPts(ctlFull)} / ${ctlFull.score.memory.max_points_all}` : '없음'}`, '',
  '| 조건 | 결과 | 지연 중앙값/95% (초) | 규칙 위반 턴 | 기억 점수(키워드) | 판정 필요 | 턴당 비용 | 답 글자 수 | 유효 |', '|---|---|---|---|---|---|---|---|---|'];
for (const r of rows) L.push(`| ${r.cond} | ${r.fail.length ? '탈락: ' + r.fail.join(', ') : '통과'}${r.mem_border ? ' (기억 경계)' : ''} | ${r.lat_p50_s?.toFixed(1)} / ${r.lat_p95_s?.toFixed(1)} | ${r.rule_bad_turns} (${(r.rule_bad_rate * 100).toFixed(0)}%) ${JSON.stringify(r.by_rule)} | ${r.mem_points} / ${r.mem_max} | ${r.mem_needs_judge} | ${r.cost_per_turn.toFixed(3)}원 | ${Math.round(r.avg_chars)} | ${r.valid ? 'O' : 'X ' + r.invalid_reasons.join(', ')} |`);
fs.writeFileSync(path.join(OUT, `screen-${PREFIX}.json`), JSON.stringify({ generated: new Date().toISOString(), control_points: ctlPts, rows }, null, 1));
fs.writeFileSync(path.join(OUT, `screen-${PREFIX}.md`), L.join('\n'));
console.log(L.join('\n'));

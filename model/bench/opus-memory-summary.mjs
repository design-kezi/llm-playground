// 2차(dm2) 기억 문항 Opus 블라인드 판정 집계. 라벨은 조건을 가린 채 붙였다(docs/50 "Opus 판정으로 변경").
// 입력: out/opus-dm2/blind-memory.json(문항), blind-memory-KEY.json(id → 조건·대본·턴), opus-labels.tsv(id, 라벨, 근거)
// 점수: correct +2, partial +1, unknown 0, stale −1, wrong −1, fabricated −2, na 는 뺀다(score.js 와 같은 배점).
// 키워드 채점(score.js)과의 일치율, 기준선(haiku-off) 대비 같은 문항 짝 비교(부호 검정)도 낸다.
// 사용: node bench/opus-memory-summary.mjs [--dirs opus-dm2,opus-dm2-r2] [--run-prefix dm2] → out/opus-dm2/summary.json, summary.md (회차 여럿이면 합산 + 회차별 열)
import fs from 'node:fs';
import path from 'node:path';
import { scoreRun } from './score.js';

const OUT = path.join(import.meta.dirname, 'out');
const argv = process.argv.slice(2);
const DIRS = (argv.includes('--dirs') ? argv[argv.indexOf('--dirs') + 1] : 'opus-dm2,opus-dm2-r2').split(',').filter((d) => fs.existsSync(path.join(OUT, d, 'opus-labels.tsv')));
const DIR = path.join(OUT, DIRS[0]);
const RUNP = argv.includes('--run-prefix') ? argv[argv.indexOf('--run-prefix') + 1] : 'dm2';
const BASE = argv.includes('--baseline') ? argv[argv.indexOf('--baseline') + 1] : 'haiku-off';
const PTS = { correct: 2, partial: 1, unknown: 0, stale: -1, wrong: -1, fabricated: -2 };

// 키워드 채점 결과(문항별, 회차별)
const kw = new Map();
for (const d of fs.readdirSync(OUT)) {
  const m = d.match(new RegExp(`^\\d{14}-(.+)-${RUNP}-(.+)-r(\\d+)$`));
  if (!m || !fs.existsSync(path.join(OUT, d, 'run.json'))) continue;
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  if (run.scenario.includes('-situ-')) continue;
  const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${run.scenario}.json`), 'utf8'));
  for (const r of scoreRun(sc, run).memory.results) kw.set(`${m[2]}|${run.scenario}|${r.turn}|${m[3]}`, r.result);
}

const rows = [];
for (const dname of DIRS) {
  const dir = path.join(OUT, dname);
  const probes = new Map(JSON.parse(fs.readFileSync(path.join(dir, 'blind-memory.json'), 'utf8')).map((p) => [p.id, p]));
  const key = new Map(JSON.parse(fs.readFileSync(path.join(dir, 'blind-memory-KEY.json'), 'utf8')).map((k) => [k.id, k]));
  const labels = new Map(fs.readFileSync(path.join(dir, 'opus-labels.tsv'), 'utf8').split('\n').filter((l) => /^[A-Z]\d{4}\t/.test(l))
    .map((l) => { const [id, label, why] = l.split('\t'); return [id, { label, why }]; }));
  for (const id of probes.keys()) if (!labels.has(id) || !(labels.get(id).label in PTS || labels.get(id).label === 'na')) throw new Error(`라벨 없음/잘못됨: ${dname} ${id}`);
  for (const id of probes.keys()) {
    const k = key.get(id), p = probes.get(id), l = labels.get(id), rep = k.rep ?? 1;
    rows.push({ id, rep, cond: k.cond, scenario: k.scenario, turn: k.turn, kind: k.scenario.includes('-revisit-') ? 'revisit' : 'mem', type: p.type, scope: p.scope ?? null,
      label: l.label, why: l.why, points: PTS[l.label] ?? null, kw: kw.get(`${k.cond}|${k.scenario}|${k.turn}|${rep}`) ?? null });
  }
}
fs.writeFileSync(path.join(DIR, 'labels-unblinded.json'), JSON.stringify(rows, null, 1));
const REPS = [...new Set(rows.map((r) => r.rep))].sort();

// 부호 검정(양측, 동점 제외)
const binom2 = (w, l) => { const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0; for (let i = 0; i <= k; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); p += c / 2 ** n; } return Math.min(1, 2 * p); };
const conds = [...new Set(rows.map((r) => r.cond))].sort((a, b) => (a.startsWith('ctl') - b.startsWith('ctl')) || a.localeCompare(b));
const sum = (rs) => { const s = rs.filter((r) => r.points != null); const pts = s.reduce((a, r) => a + r.points, 0); return { pts, max: s.length * 2, pct: s.length ? (pts / (s.length * 2)) * 100 : null, n: s.length }; };
const byKey = new Map(rows.map((r) => [`${r.cond}|${r.scenario}|${r.turn}|${r.rep}`, r]));
const TYPES = [...new Set(rows.map((r) => r.type))].sort();
const table = conds.map((c) => {
  const rs = rows.filter((r) => r.cond === c);
  const counts = Object.fromEntries([...Object.keys(PTS), 'na'].map((k) => [k, rs.filter((r) => r.label === k).length]));
  let w = 0, l = 0;
  if (c !== BASE) for (const r of rs) { const b = byKey.get(`${BASE}|${r.scenario}|${r.turn}|${r.rep}`); if (!b || r.points == null || b.points == null) continue; if (r.points > b.points) w++; else if (r.points < b.points) l++; }
  const kwScored = rs.filter((r) => r.kw && !['needs_judge', 'excluded', 'error'].includes(r.kw) && r.label !== 'na');
  return { cond: c, by_rep: Object.fromEntries(REPS.map((k) => [k, sum(rs.filter((r) => r.rep === k))])), all: sum(rs), mem: sum(rs.filter((r) => r.kind === 'mem')), revisit: sum(rs.filter((r) => r.kind === 'revisit')), counts,
    harmful: counts.wrong + counts.stale + counts.fabricated,
    by_type: Object.fromEntries(TYPES.map((t) => [t, sum(rs.filter((r) => r.type === t))])),
    vs_base: c === BASE ? null : { better: w, worse: l, p: binom2(w, l) },
    kw_agree: kwScored.length ? kwScored.filter((r) => r.kw === r.label).length / kwScored.length : null, kw_n: kwScored.length };
});

const f1 = (x) => (x == null ? '–' : x.toFixed(1));
const L = ['# 2차(dm2) 기억 문항 — Opus 블라인드 판정', '', `생성 ${new Date().toISOString()} · 문항 ${rows.length}개 · 회차 ${REPS.join('+')} (${DIRS.join(', ')}) · 조건 공개 결과 ${DIRS[0]}/labels-unblinded.json`, '',
  '배점: 정답 +2 · 부분 +1 · 모름 0 · 옛 값 −1 · 틀림 −1 · 지어냄 −2 · 해당 없음(na) 제외. "기준선 대비"는 같은 대본·같은 턴 문항을 기준선과 짝지어 점수가 높으면 나음, 낮으면 못함(부호 검정, 양측).', '',
  `| 조건 | 기억 점수(합) | ${REPS.map((k) => `r${k}`).join(' | ')} | 기억 대본 | 재방문 대본 | 정답/부분/모름/옛값/틀림/지어냄/na | 해로운 답(옛값+틀림+지어냄) | 기준선 대비 나음:못함 (p) | 키워드 채점 일치 |`, `|---|---|${REPS.map(() => '---').join('|')}|---|---|---|---|---|---|`];
for (const r of table) L.push(`| ${r.cond} | ${r.all.pts}/${r.all.max} (${f1(r.all.pct)}%) | ${REPS.map((k) => (r.by_rep[k].n ? f1(r.by_rep[k].pct) + '%' : '–')).join(' | ')} | ${f1(r.mem.pct)}% | ${f1(r.revisit.pct)}% | ${['correct', 'partial', 'unknown', 'stale', 'wrong', 'fabricated', 'na'].map((k) => r.counts[k]).join('/')} | ${r.harmful} | ${r.vs_base ? `${r.vs_base.better}:${r.vs_base.worse} (${r.vs_base.p.toFixed(3)})` : '기준선'} | ${r.kw_agree == null ? '–' : (r.kw_agree * 100).toFixed(0) + '%'} (${r.kw_n}) |`);
L.push('', '## 유형별 점수(%)', '', `| 조건 | ${TYPES.join(' | ')} |`, `|---|${TYPES.map(() => '---').join('|')}|`);
for (const r of table) L.push(`| ${r.cond} | ${TYPES.map((t) => f1(r.by_type[t].pct)).join(' | ')} |`);
L.push('', `유형별 문항 수(첫 조건 기준): ${TYPES.map((t) => `${t} ${table[0].by_type[t].n}`).join(' · ')}`);
L.push('', '## 해로운 답 목록(옛 값·틀림·지어냄)', '');
for (const r of rows.filter((r) => ['stale', 'wrong', 'fabricated'].includes(r.label)).sort((a, b) => a.cond.localeCompare(b.cond) || a.id.localeCompare(b.id)))
  L.push(`- ${r.cond} r${r.rep} · ${r.scenario}#${r.turn} [${r.type}] **${r.label}** — ${r.why}`);
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify({ generated: new Date().toISOString(), table }, null, 1));
fs.writeFileSync(path.join(DIR, 'summary.md'), L.join('\n'));
console.log(L.slice(0, 30 + TYPES.length).join('\n'));

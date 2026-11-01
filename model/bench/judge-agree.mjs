// 판정관 후보와 Opus 블라인드 라벨(out/opus-dm2/labels-unblinded.json)의 일치율. docs/50 리뷰 지적 3(판정관 선정).
// 사용: node bench/judge-agree.mjs --list out/judge-sample-r1.txt [--suffix cand] → out/judge-agree-<suffix>.md
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(import.meta.dirname, 'out');
const SUFFIX = opt('suffix', 'cand');
const PTS = { correct: 2, partial: 1, unknown: 0, stale: -1, wrong: -1, fabricated: -2 };
const opus = new Map(JSON.parse(fs.readFileSync(path.join(OUT, 'opus-dm2', 'labels-unblinded.json'), 'utf8')).map((r) => [`${r.cond}|${r.scenario}|${r.turn}`, r]));
const runs = fs.readFileSync(path.resolve(import.meta.dirname, opt('list', 'out/judge-sample-r1.txt')), 'utf8').split('\n').filter(Boolean);
const per = {};
const pairs = []; // [judge, opusLabel, judgeLabel, cond]
for (const d of runs) {
  const m = d.match(/^\d{14}-(.+)-dm2-(.+)-r(\d+)$/);
  const f = path.join(OUT, d, `judge-batch-${SUFFIX}.json`);
  if (!fs.existsSync(f)) continue;
  const jb = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const j of jb.summary.judges) { (per[j] ??= { runs: 0, failed: 0, krw: 0, n: 0, exact: 0, abs: 0, cmp: 0 }).runs++; }
  for (const e of jb.summary.judge_errors ?? []) per[e.judge].failed++;
  for (const u of jb.summary.usage ?? []) per[u.judge].krw += u.krw;
  for (const r of jb.results) {
    const o = opus.get(`${m[2]}|${m[1]}|${r.turn}`);
    if (!o) continue;
    for (const v of r.votes ?? []) {
      const p = per[v.judge];
      p.n++;
      if (v.label === o.label) p.exact++;
      if (PTS[v.label] != null && PTS[o.label] != null) { p.cmp++; p.abs += Math.abs(PTS[v.label] - PTS[o.label]); }
      pairs.push([v.judge, o.label, v.label, m[2]]);
    }
  }
}
const short = (j) => j.split('/').pop();
const L = [`# 판정관 후보 — Opus 블라인드 라벨과 일치율 (${SUFFIX})`, '', `생성 ${new Date().toISOString()} · 표본 ${runs.length}런(조건마다 기억 1 + 재방문 1) · Opus 라벨 v2`, '',
  '| 판정관 | 판정한 런 | 실패한 런(형식 오류) | 문항 | 라벨 정확 일치 | 점수 차 평균(0=같음) | 판정비 합계 | 런당 |', '|---|---|---|---|---|---|---|---|'];
const rows = Object.entries(per).map(([j, p]) => ({ j, ...p, rate: p.n ? p.exact / p.n : 0, mae: p.cmp ? p.abs / p.cmp : null })).sort((a, b) => b.rate - a.rate);
for (const r of rows) L.push(`| ${short(r.j)} | ${r.runs} | ${r.failed} | ${r.n} | ${(r.rate * 100).toFixed(1)}% | ${r.mae?.toFixed(3)} | ${r.krw.toFixed(1)}원 | ${(r.krw / Math.max(1, r.runs - r.failed)).toFixed(1)}원 |`);
// 혼동: Opus 가 정답이 아닌 문항(감점 문항)을 판정관이 얼마나 잡는가
L.push('', '## Opus 가 정답이 아니라고 본 문항에서 판정관 라벨', '', '| 판정관 | Opus 비정답 문항 | 판정관도 비정답 | 판정관은 정답 |', '|---|---|---|---|');
for (const r of rows) { const ps = pairs.filter((x) => x[0] === r.j && x[1] !== 'correct' && x[1] !== 'na'); L.push(`| ${short(r.j)} | ${ps.length} | ${ps.filter((x) => x[2] !== 'correct').length} | ${ps.filter((x) => x[2] === 'correct').length} |`); }
fs.writeFileSync(path.join(OUT, `judge-agree-${SUFFIX}.md`), L.join('\n'));
fs.writeFileSync(path.join(OUT, `judge-agree-${SUFFIX}.json`), JSON.stringify({ rows, pairs }, null, 1));
console.log(L.join('\n'));

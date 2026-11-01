// 판정관 패널 짝 비교(pair-run.mjs, 조건별 파일)를 합치고 Opus 블라인드 묶음 판정(pair-blind.mjs)과 나란히 놓는다(docs/50 리뷰 지적 3: 자기 편애·길이 편향 점검).
// 단위 = (조건, 대본, 구간, 회차). 패널 = 판정관 3개 결과의 다수결(순서 바꿔 2회 판정해 엇갈리면 무승부인 pair-run 결과), Opus = 같은 묶음에서 후보와 haiku-off 점수 비교.
// 사용: node bench/panel-summary.mjs [--glob pair-panel-r1-,pair-panel-r2-] [--opus out/opus-quality-r1] [--name panel-vs-opus] → out/<name>.md, .json
//   120턴: --glob pair-panel-lt1-r1-,pair-panel-lt1-r2- --opus out/opus-qlt1-r1 --name panel-vs-opus-lt1
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(import.meta.dirname, 'out');
const GLOBS = opt('glob', 'pair-panel-r1-,pair-panel-r2-').split(',');
const OPUS = path.resolve(import.meta.dirname, opt('opus', 'out/opus-quality-r1')); // score --dir2 로 합친 labels-unblinded.json(두 회차)이 여기 있다
const AXES = ['character', 'context', 'engagement', 'user_agency', 'overall'];
const BASE = 'haiku-off';
const NAME = opt('name', 'panel-vs-opus');
const short = (s) => s.split('/').pop();

const results = [];
let krw = 0, errors = 0;
const agree = {};
for (const f of fs.readdirSync(OUT).filter((x) => GLOBS.some((g) => x.startsWith(g)) && x.endsWith('.json'))) {
  // pair-run 은 매니페스트 안 순서로 rep 를 매긴다(회차별 매니페스트면 늘 1) → 파일 이름의 회차를 쓴다
  const fileRep = Number((f.match(/-r(\d+)-/) ?? [])[1] ?? 0) || null;
  const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  krw += j.judge_cost_krw; errors += j.errors;
  for (const [k, v] of Object.entries(j.inter_judge_agreement_overall ?? {})) (agree[k] ??= []).push(v);
  results.push(...j.results.filter((r) => r.result).map((r) => ({ ...r, rep: fileRep ?? r.rep })));
}
const judges = [...new Set(results.map((r) => r.judge))];
// 단위별 패널 다수결: 판정관마다 cand/base/tie, 많은 쪽(동수면 tie)
const units = new Map();
for (const r of results) {
  const key = `${r.cond}|${r.scenario}|${r.segment}|${r.rep}`;
  (units.get(key) ?? units.set(key, { cond: r.cond, scenario: r.scenario, segment: r.segment, rep: r.rep, votes: {} }).get(key)).votes[r.judge] = r.result;
}
const majority = (vs) => { const c = { cand: 0, base: 0, tie: 0 }; for (const v of vs) c[v]++; return c.cand > c.base && c.cand > c.tie ? 'cand' : c.base > c.cand && c.base > c.tie ? 'base' : c.cand === c.base ? 'tie' : c.tie > Math.max(c.cand, c.base) ? 'tie' : c.cand > c.base ? 'cand' : 'base'; };
// Opus: 같은 묶음(scenario, segment, rep)에서 후보 점수 vs haiku-off 점수
const opusRows = JSON.parse(fs.readFileSync(path.join(OPUS, 'labels-unblinded.json'), 'utf8'));
const opusOf = (u, ax) => {
  const c = opusRows.find((r) => r.cond === u.cond && r.scenario === u.scenario && r.segment === u.segment && r.rep === u.rep);
  const b = opusRows.find((r) => r.cond === BASE && r.scenario === u.scenario && r.segment === u.segment && r.rep === u.rep);
  if (!c || !b) return null;
  return c.scores[ax] > b.scores[ax] ? 'cand' : c.scores[ax] < b.scores[ax] ? 'base' : 'tie';
};
const binom2 = (w, l) => { const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0; for (let i = 0; i <= k; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); p += c / 2 ** n; } return Math.min(1, 2 * p); };
const conds = [...new Set([...units.values()].map((u) => u.cond))].sort();
const L = [`# 대화 품질 — 판정관 패널 vs Opus (기준선 ${BASE})`, '', `생성 ${new Date().toISOString()} · 패널 ${judges.map(short).join('·')} (순서 바꿔 2회, 엇갈리면 무승부, 단위별 다수결) · 단위 ${units.size}개 · 판정비 ${krw.toFixed(0)}원 · 오류 ${errors}`, '',
  `판정관 사이 overall 일치율(조건 파일 평균): ${Object.entries(agree).map(([k, v]) => `${k.split(' ~ ').map(short).join('~')} ${(v.reduce((a, b) => a + b, 0) / v.length * 100).toFixed(0)}%`).join(' · ')}`, '',
  '## 후보 승:기준선 승:무승부 (부호 검정 p) — 패널 / Opus', '', `| 조건 | ${AXES.join(' | ')} |`, `|---|${AXES.map(() => '---').join('|')}|`];
const table = {};
for (const c of conds) {
  const us = [...units.values()].filter((u) => u.cond === c);
  table[c] = {};
  const cells = AXES.map((ax) => {
    const pv = us.map((u) => majority(Object.values(u.votes).map((v) => v[ax])));
    const ov = us.map((u) => opusOf(u, ax)).filter(Boolean);
    const pw = pv.filter((x) => x === 'cand').length, pl = pv.filter((x) => x === 'base').length;
    const ow = ov.filter((x) => x === 'cand').length, ol = ov.filter((x) => x === 'base').length;
    const agreeRate = us.filter((u) => opusOf(u, ax) && majority(Object.values(u.votes).map((v) => v[ax])) === opusOf(u, ax)).length / us.length;
    table[c][ax] = { panel: { win: pw, loss: pl, tie: pv.length - pw - pl, p: binom2(pw, pl) }, opus: { win: ow, loss: ol, tie: ov.length - ow - ol, p: binom2(ow, ol) }, same_verdict: agreeRate };
    return `${pw}:${pl}:${pv.length - pw - pl} (${binom2(pw, pl).toFixed(2)}) / ${ow}:${ol}:${ov.length - ow - ol} (${binom2(ow, ol).toFixed(2)})`;
  });
  L.push(`| ${c} | ${cells.join(' | ')} |`);
}
L.push('', '## 같은 단위에서 패널 다수결과 Opus 판정이 같은 비율', '', `| 조건 | ${AXES.join(' | ')} |`, `|---|${AXES.map(() => '---').join('|')}|`);
for (const c of conds) L.push(`| ${c} | ${AXES.map((ax) => (table[c][ax].same_verdict * 100).toFixed(0) + '%').join(' | ')} |`);
L.push('', '## 자기 편애 점검 (overall, 순승 = 후보 승 − 기준선 승; Opus 가 Anthropic 기준선을 더 편들면 Opus 순승이 패널보다 낮다)', '', '| 조건 | 패널 순승 | Opus 순승 | 차이(Opus−패널) |', '|---|---|---|---|');
for (const c of conds) { const t = table[c].overall; const pn = t.panel.win - t.panel.loss, on = t.opus.win - t.opus.loss; L.push(`| ${c} | ${pn} | ${on} | ${on - pn} |`); }
fs.writeFileSync(path.join(OUT, `${NAME}.json`), JSON.stringify({ generated: new Date().toISOString(), judges, krw, errors, table }, null, 1));
fs.writeFileSync(path.join(OUT, `${NAME}.md`), L.join('\n'));
console.log(L.join('\n'));

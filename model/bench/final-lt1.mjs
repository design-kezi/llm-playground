// 120턴 시험(lt1) 최종 표. 추천하지 않고 측정값만 나란히 놓는다. 선택은 사용자.
// 입력: out/opus-lt1-r1/summary.json(기억, Opus) · out/drop-lt1.json(블록 포함·빠짐) · out/opus-qlt1-r1/summary.json(품질, Opus)
//       out/panel-vs-opus-lt1.json(품질, 패널) · out/cost-lt1.json(비용 시나리오) · run.json(구간·최대 턴) · out/defects-lt1.txt
// 사용: node bench/final-lt1.mjs → out/final-lt1.md
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(import.meta.dirname, 'out');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const mem = Object.fromEntries(rd('opus-lt1-r1/summary.json').table.map((r) => [r.cond, r]));
const drop = rd('drop-lt1.json');
const qual = rd('opus-qlt1-r1/summary.json').table;
const panel = rd('panel-vs-opus-lt1.json');
const cost = Object.fromEntries(rd('cost-lt1.json').rows.map((r) => [r.cond, r]));
const CONDS = ['haiku-off', 'haiku-on', 'deepseek-on', 'ctl-full-memoff', 'ctl-slide6-memoff'];
const f1 = (x) => (x == null ? '–' : x.toFixed(1));

// 구간 평균·1원 넘은 턴·최대 턴은 런 기록에서 직접
const runs = {};
for (const d of fs.readdirSync(OUT).filter((x) => /-120-lt1-/.test(x) && fs.existsSync(path.join(OUT, x, 'run.json')))) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const c = r.label.replace(/^lt1-|-r\d$/g, '');
  const a = (runs[c] ??= { n: 0, ph: [0, 0, 0], over1: 0, max: 0 });
  a.n++; r.report.phases.forEach((p, i) => { a.ph[i] += p.avg_krw; });
  a.max = Math.max(a.max, r.report.max_turn.krw);
  const per = {};
  for (const c2 of r.calls) per[c2.turn_no] = (per[c2.turn_no] ?? 0) + c2.cost_krw;
  a.over1 += Object.entries(per).filter(([t, v]) => Number(t) > 0 && v > 1).length;
}

const L = ['# 120턴 시험 (lt1) — 최종 표', '', `생성 ${new Date().toISOString()} · 추천 없음, 측정값만 · 대본 4개 × 회차 2 · 조건당 문항 248개, 장면 80개`, '',
  '## 기억·비용', '',
  '| 조건 | 기억 점수 Opus (r1 / r2) | 해로운 답 | haiku-off 대비 나음:못함 | 블록에 있음 → 정답 | 블록에서 빠짐 → 정답 | 턴당 기록값 / DeepSeek 피크 / 캐시 0 최악 | 구간 1~40 / 41~80 / 81~120 | 1원 넘은 턴/런 | 최대 턴 |',
  '|---|---|---|---|---|---|---|---|---|---|'];
for (const c of CONDS) {
  const m = mem[c], co = cost[c], ru = runs[c];
  const ds = drop.filter((x) => x.cond === c);
  const blk = (b) => { const xs = ds.filter((x) => x.block === b && x.label); return xs.length ? `${xs.filter((x) => x.label === 'correct').length}/${xs.length}` : '–'; };
  L.push(`| ${c} | ${f1(m.all.pct)}% (${f1(m.by_rep[1].pct)} / ${f1(m.by_rep[2].pct)}) | ${m.harmful} | ${m.vs_base ? `${m.vs_base.better}:${m.vs_base.worse} (p ${m.vs_base.p.toFixed(3)})` : '기준선'} | ${blk('in_block')} | ${blk('dropped')} | ${co.measured.toFixed(3)} / ${co.peak.toFixed(3)} / ${co.worst.toFixed(3)}원 | ${ru.ph.map((v) => (v / ru.n).toFixed(2)).join(' / ')} | ${(ru.over1 / ru.n).toFixed(0)} | ${ru.max.toFixed(2)}원 |`);
}
L.push('', '## 대화 품질 (후보 3개, 장면 단위)', '',
  '| 조건 | Opus overall 평균(1~5) | Opus: haiku-off 대비 overall 나음:못함 | 패널: haiku-off 대비 overall 승:패 | Opus engagement 평균 | 패널 engagement 승:패 |', '|---|---|---|---|---|---|');
for (const c of CONDS.slice(0, 3)) {
  const q = qual[c], p = panel.table[c];
  L.push(`| ${c} | ${q.mean.overall.toFixed(2)} | ${q.vs_base ? `${q.vs_base.overall.win}:${q.vs_base.overall.loss} (p ${q.vs_base.overall.p.toFixed(2)})` : '기준선'} | ${p ? `${p.overall.panel.win}:${p.overall.panel.loss} (p ${p.overall.panel.p.toFixed(2)})` : '기준선'} | ${q.mean.engagement.toFixed(2)} | ${p ? `${p.engagement.panel.win}:${p.engagement.panel.loss} (p ${p.engagement.panel.p.toFixed(2)})` : '기준선'} |`);
}
L.push('', '## 답변 결함 (조건당 960턴)', '', '```', fs.readFileSync(path.join(OUT, 'defects-lt1.txt'), 'utf8'), '```', '',
  '## 출처', '', '- 기억: out/opus-lt1-r1/summary.md (라벨 opus-lt1-r{1,2}/opus-labels.tsv, 재판정 opus-lt1-work/recheck-wrong.tsv)',
  '- 블록 분석: out/drop-lt1.md · 비용: out/cost-lt1.md · 품질 Opus: out/opus-qlt1-r1/summary.md, length.md · 품질 패널: out/panel-vs-opus-lt1.md');
fs.writeFileSync(path.join(OUT, 'final-lt1.md'), L.join('\n'));
console.log(L.join('\n'));

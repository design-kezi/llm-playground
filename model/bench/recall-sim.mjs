// 질문 기준 기억 보충(recall)의 사전 시뮬레이션. lt1 런 기록을 다시 읽어, 문항 턴에 "블록에서 빠진 항목 중 지금 질문과 맞는 것"을
// 골랐다면 원문 항목을 건졌을지 센다(대화 모델 호출 없음, 임베딩 모드만 아주 적은 비용).
// 후보 = 문항 직전 RETRIEVE 의 dropped 항목. 질의 = 그 턴 사용자 발화. 원문 항목 = memory-drop.mjs 와 같은 정의.
// 사용: node bench/recall-sim.mjs [--embed] → out/recall-sim-lt1.md, .json
import fs from 'node:fs';
import path from 'node:path';
import { keywords } from '../../memory/gate.js';
import { estimateTokens as est } from '../../memory/tokens.js';
import { cosine } from '../../memory/vector.js';
import { rankRecall } from '../../memory/recall.js';

const argv = process.argv.slice(2);
const EMBED = argv.includes('--embed');
const OUT = path.join(import.meta.dirname, 'out');
const model = EMBED ? await import('../index.js') : null;

const kwScore = (q, t) => { const qk = new Set(keywords(q)); return keywords(t).filter((k) => qk.has(k)).length; };
// 설정: 방법 × 최대 줄 수 × 임계값. 추가 토큰 예산은 150 으로 고정(깊은 검색과 같음)
const SETTINGS = [];
for (const k of [1, 2, 3]) SETTINGS.push({ method: 'keyword', k, th: 1 });
for (const k of [1, 2, 3]) for (const th of [2, 4, 6, 8]) SETTINGS.push({ method: 'bigram', k, th });
if (EMBED) for (const k of [1, 2, 3]) for (const th of [0.55, 0.6, 0.65, 0.7]) SETTINGS.push({ method: 'embed', k, th });

const runs = fs.readdirSync(OUT).filter((d) => /^\d{14}-.+-120-lt1-(haiku-off|haiku-on|deepseek-on)-r\d$/.test(d));
const rows = [];
let embedKrw = 0;
for (const d of runs) {
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const cond = d.match(/lt1-(.+)-r\d$/)[1];
  const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${run.scenario}.json`), 'utf8'));
  const items = new Map(run.memory.items.map((i) => [i.id, i]));
  const retrieves = run.memory.ops_log.filter((o) => o.op === 'RETRIEVE').map((o) => ({ turn: o.local_turn_no ?? o.turn_no, ...JSON.parse(o.detail) }));
  const userTurns = sc.turns.filter((t) => t.user);
  let vec = null;
  if (EMBED) {
    const texts = [...items.values()].map((i) => i.text).concat(userTurns.map((t) => t.user));
    vec = new Map();
    for (let i = 0; i < texts.length; i += 90) { // 제공사 한 번에 100개 제한
      const part = texts.slice(i, i + 90);
      const r = await model.embed({ tag: 'embed', conversation_id: 0, turn_no: 0, texts: part, purpose: 'recall_sim' });
      embedKrw += r.attempts.reduce((s, a) => s + (a.cost_krw ?? 0), 0);
      part.forEach((t, j) => vec.set(t, Float32Array.from(r.vectors[j])));
    }
  }
  for (const t of userTurns) {
    const r = retrieves.filter((x) => x.turn <= t.turn).sort((a, b) => b.turn - a.turn)[0];
    if (!r) continue;
    const cands = r.dropped.map((id) => items.get(id)).filter(Boolean);
    const active = [...r.included, ...r.dropped].map((id) => items.get(id)).filter(Boolean);
    const src = t.kind === 'probe' ? Math.max(...(t.source_turns ?? [])) : null;
    const srcIds = Number.isFinite(src) ? [...items.values()].filter((i) => (i.source?.local_turn_no ?? i.source?.turn_no) === src).map((i) => i.id) : [];
    const res = {};
    for (const s of SETTINGS) {
      const scored = (s.method === 'bigram' ? rankRecall(t.user, cands, active).map((x) => ({ i: x.item, sc: x.score }))
        : cands.map((i) => ({ i, sc: s.method === 'keyword' ? kwScore(t.user, `${i.text} ${i.when ?? ''}`) : cosine(vec.get(t.user), vec.get(i.text)) + 0.05 * kwScore(t.user, i.text) })))
        .filter((x) => x.sc >= s.th).sort((a, b) => b.sc - a.sc).slice(0, s.k);
      let used = 0; const pick = [];
      for (const x of scored) { const tk = est(`- ${x.i.text}`) + 1; if (used + tk > 150) break; used += tk; pick.push(x.i.id); }
      res[`${s.method}:${s.k}:${s.th}`] = { hit: srcIds.some((id) => pick.includes(id)), tokens: used };
    }
    rows.push({ cond, scenario: run.scenario, rep: Number(d.slice(-1)), turn: t.turn, probe: t.kind === 'probe', src_dropped: srcIds.some((id) => r.dropped.includes(id)), res });
  }
}

const L = ['# 질문 기준 기억 보충 — lt1 기록 재생 시뮬레이션', '', `생성 ${new Date().toISOString()} · 런 ${runs.length}개(기억 켠 3조건) · 후보 = 문항 직전 블록에서 빠진 항목 · 추가 예산 150토큰${EMBED ? ` · 임베딩 비용 ${embedKrw.toFixed(2)}원` : ''}`, '',
  '| 설정(방법:최대 줄:임계) | 빠진 원문 항목을 건짐 | 턴당 평균 추가 토큰(모든 턴) | 보충이 붙는 턴 비율 |', '|---|---|---|---|'];
const dropped = rows.filter((r) => r.probe && r.src_dropped);
for (const s of SETTINGS) {
  const k = `${s.method}:${s.k}:${s.th}`;
  const hit = dropped.filter((r) => r.res[k].hit).length;
  const avg = rows.reduce((a, r) => a + r.res[k].tokens, 0) / rows.length;
  const on = rows.filter((r) => r.res[k].tokens > 0).length / rows.length;
  L.push(`| ${k} | ${hit}/${dropped.length} (${(100 * hit / dropped.length).toFixed(0)}%) | ${avg.toFixed(1)} | ${(100 * on).toFixed(0)}% |`);
}
fs.writeFileSync(path.join(OUT, 'recall-sim-lt1.md'), L.join('\n'));
fs.writeFileSync(path.join(OUT, 'recall-sim-lt1.json'), JSON.stringify(rows));
console.log(L.join('\n'));

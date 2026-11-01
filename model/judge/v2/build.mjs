// 판단 모델 v2 한국어 데이터 만들기 (docs/50-decision-log.md 사전 등록).
//  1) v1 한국어 데이터(judge/data/ko.json: 옛 대본 3개 + 손으로 쓴 어려운 문항)를 그대로 가져온다(src 앞에 'v1:').
//  2) 새 캐릭터 대본 4개를 v1 과 같은 규칙으로 더한다. 직전 응답·기억 항목은 nc8 mem-1 런.
//     save: plant/update/retract/distractor 와 1턴 = 1 / recall: probe = 1 / target: probe 의 source_turns 사슬(바뀜) + distractor·plant 턴('none')
//  3) 손으로 쓴 수정 대상 문항(data/hand2-ko.json)을 더한다.
// 사용: node judge/v2/build.mjs
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const BENCH = path.join(HERE, '..', '..', 'bench');
const INFO_KINDS = new Set(['plant', 'update', 'retract', 'distractor']);

const v1 = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'data', 'ko.json'), 'utf8'));
const out = { save: [], recall: [], target: [] };
for (const task of Object.keys(out)) for (const x of v1[task]) out[task].push({ ...x, id: `v1-${x.id}`, src: `v1:${x.src}` });

for (const sc of ['baekho', 'naruto', 'backend', 'sejong']) {
  const scenario = JSON.parse(fs.readFileSync(path.join(BENCH, 'scenarios', `${sc}-40.json`), 'utf8'));
  const runDir = fs.readdirSync(path.join(BENCH, 'out')).filter((d) => d.endsWith(`${sc}-40-nc8-mem-1`)).sort().at(-1);
  const run = JSON.parse(fs.readFileSync(path.join(BENCH, 'out', runDir, 'run.json'), 'utf8'));
  const reply = new Map(run.turns.map((t) => [t.turn, t.reply ?? '']));
  const prevOf = (turn) => (turn > 1 ? { user: scenario.turns[turn - 2].user, assistant: reply.get(turn - 1) } : undefined);

  for (const t of scenario.turns) {
    const save = INFO_KINDS.has(t.kind) || t.turn === 1 ? 1 : 0;
    out.save.push({ id: `nc-${sc}-${t.turn}`, user: t.user, prev: prevOf(t.turn), label: save, src: `nc:${sc}:${t.kind}` });
    out.recall.push({ id: `nc-${sc}-${t.turn}`, user: t.user, prev: prevOf(t.turn), label: t.kind === 'probe' ? 1 : 0, src: `nc:${sc}:${t.kind}` });
  }

  const items = run.memory.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const activeAt = (turn) => items.filter((i) => {
    if (!(i.source?.turn_no < turn)) return false;
    const next = i.superseded_by != null ? byId.get(i.superseded_by) : null;
    return !next || !(next.source?.turn_no < turn);
  });
  const cases = [];
  for (const p of scenario.turns.filter((t) => t.kind === 'probe' && t.source_turns?.length > 1)) {
    const chain = [...p.source_turns].sort((a, b) => a - b);
    for (let k = 1; k < chain.length; k++) {
      const turn = chain[k];
      const kind = scenario.turns[turn - 1].kind;
      if (!['update', 'retract', 'distractor'].includes(kind)) continue;
      cases.push({ turn, kind, from: kind === 'distractor' ? null : chain[k - 1] });
    }
  }
  for (const t of scenario.turns) {
    if ((t.kind === 'plant' || t.kind === 'distractor') && !cases.some((c) => c.turn === t.turn)) cases.push({ turn: t.turn, kind: t.kind, from: null });
  }
  for (const c of cases.sort((a, b) => a.turn - b.turn)) {
    const cands = activeAt(c.turn);
    if (!cands.length) continue;
    let label = 'none';
    if (c.from != null) {
      label = cands.flatMap((i, idx) => (i.source.turn_no === c.from ? [idx] : []));
      if (!label.length) { console.log(`skip ${sc}-${c.turn}: ${c.from}턴 항목 없음`); continue; }
    }
    out.target.push({ id: `nc-${sc}-${c.turn}`, user: scenario.turns[c.turn - 1].user, items: cands.map((i) => i.text), label, src: `nc:${sc}:${c.kind}` });
  }
}

const hand = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'hand2-ko.json'), 'utf8'));
hand.target.forEach((h, i) => out.target.push({ id: `hand2-${i + 1}`, user: h.user, items: hand.items[h.set], label: h.label, src: `hand2:${h.why}` }));

fs.writeFileSync(path.join(HERE, 'data', 'ko.json'), JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  const by = {};
  for (const x of v) {
    const g = x.src.split(':')[0];
    const pos = k === 'target' ? (x.label === 'none' ? 'none' : 'change') : x.label ? 'pos' : 'neg';
    by[`${g}/${pos}`] = (by[`${g}/${pos}`] ?? 0) + 1;
  }
  console.log(k, v.length, JSON.stringify(by));
}

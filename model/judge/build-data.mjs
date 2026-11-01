// 판단 모델 테스트 데이터(한국어) 만들기: 벤치 대본 + 실제 대화 기록(slide-v2) + 어려운 경우(hard-ko.json).
// 출력: judge/data/ko.json  { save: [...], recall: [...], target: [...] }
//   save/recall: { id, user, prev?: {user, assistant}, label: 0|1, src }
//   target:      { id, user, items: [텍스트], label: [정답 번호들]|'none', src }
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const BENCH = path.join(HERE, '..', 'bench');
const INFO_KINDS = new Set(['plant', 'update', 'retract', 'distractor']);

const out = { save: [], recall: [], target: [] };
for (const sc of ['yuna-40', 'kang-40', 'sera-40']) {
  const scenario = JSON.parse(fs.readFileSync(path.join(BENCH, 'scenarios', `${sc}.json`), 'utf8'));
  const runDir = fs.readdirSync(path.join(BENCH, 'out')).filter((d) => d.endsWith(`${sc}-slide-v2`)).sort().at(-1);
  const run = JSON.parse(fs.readFileSync(path.join(BENCH, 'out', runDir, 'run.json'), 'utf8'));
  const reply = new Map(run.turns.map((t) => [t.turn, t.reply ?? '']));
  const prevOf = (turn) => (turn > 1 ? { user: scenario.turns[turn - 2].user, assistant: reply.get(turn - 1) } : undefined);

  for (const t of scenario.turns) {
    // 1턴은 이름 소개라 저장할 정보가 있다(종류는 filler 로 적혀 있음)
    const save = INFO_KINDS.has(t.kind) || t.turn === 1 ? 1 : 0;
    out.save.push({ id: `${sc}-${t.turn}`, user: t.user, prev: prevOf(t.turn), label: save, src: `${sc}:${t.kind}` });
    out.recall.push({ id: `${sc}-${t.turn}`, user: t.user, prev: prevOf(t.turn), label: t.kind === 'probe' ? 1 : 0, src: `${sc}:${t.kind}` });
  }

  // 수정 대상: 확인 질문의 source_turns 사슬에서 뒤 턴은 앞 턴의 항목을 바꾼다. 방해 정보는 'none'.
  const items = run.memory.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const activeAt = (turn) => items.filter((i) => {
    if (!(i.source?.turn_no < turn)) return false;
    const next = i.superseded_by != null ? byId.get(i.superseded_by) : null;
    return !next || !(next.source?.turn_no < turn); // 그 시점엔 아직 안 바뀜
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
  for (const c of cases) {
    const cands = activeAt(c.turn);
    let label = 'none';
    if (c.from != null) {
      // 한 발화에서 항목이 여러 개 나올 수 있다(고양이 키움 / 이름 하늘이) → 그중 아무거나 정답
      label = cands.flatMap((i, idx) => (i.source.turn_no === c.from ? [idx] : []));
      if (!label.length) continue; // 그 시점 항목이 없으면(추출 누락) 문항에서 뺀다
    }
    out.target.push({ id: `${sc}-${c.turn}`, user: scenario.turns[c.turn - 1].user, items: cands.map((i) => i.text), label, src: `${sc}:${c.kind}` });
  }
}

const hard = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'hard-ko.json'), 'utf8'));
for (const task of ['save', 'recall', 'target']) {
  hard[task].forEach((h, i) => out[task].push({ id: `hard-${task}-${i + 1}`, ...h, src: `hard:${h.why}` }));
}

fs.writeFileSync(path.join(HERE, 'data', 'ko.json'), JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  const pos = v.filter((x) => x.label === 1 || typeof x.label === 'number').length;
  console.log(k, v.length, k === 'target' ? `none=${v.filter((x) => x.label === 'none').length}` : `pos=${v.filter((x) => x.label === 1).length}`);
}

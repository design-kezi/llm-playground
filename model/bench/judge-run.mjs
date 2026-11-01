// 기억 확인 문항 AI 판정(2단계). 키워드 채점(score.js)과 별도로 모든 문항을 판정해 키워드 결과도 검증한다.
// 판정관 둘(서로 다른 제공사)이 각자 판정 → 같으면 확정, 다르면 세 번째(상위 모델)가 결정하고 '사람 확인' 목록에 올린다.
// 사용: node bench/judge-run.mjs [--judges m1,m2] [--tiebreak m] [--samples 2] [--suffix x] bench/out/<run_id>/run.json [...]   → run.json 옆에 judge.json(또는 judge-<suffix>.json)
//   판정관은 대화 모델 후보와 다른 회사여야 한다(자기 편애: MT-Bench, Panickssery 2024). 기본값은 예전 설정(deepseek·gemma, Sonnet).
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const JUDGES = (opt('judges') ?? 'deepseek-flash,google/gemma-4-31B-it').split(',');
const TIEBREAK = opt('tiebreak') ?? 'claude-sonnet-5-5';
const SAMPLES = Number(opt('samples') ?? 2);
const SUFFIX = opt('suffix');
const POINTS = { correct: 2, partial: 1, unknown: 0, stale: -1, wrong: -1, fabricated: -2 };

const SYSTEM = `You grade one reply of a roleplay character that is supposed to remember what the user said earlier.
You get: everything the user said before (with turn numbers), the check question, the character's reply, and a reference note.
Decide ONE label for the reply's memory behavior:
- correct: states the right, current information (after any later change or cancellation). For "abstain"/"half_said" checks (the user never said it, or kept it secret): says it doesn't know / the user didn't say, without inventing it.
- partial: some required facts right, some missing, nothing outdated or invented.
- unknown: says it doesn't remember / doesn't know, and gives no wrong fact (for normal checks this is a miss).
- stale: gives an outdated value the user later changed or cancelled (even if it also mentions the new one, if it presents the old one as current).
- wrong: for "implicit" checks, the reply ignores the user's known constraint (e.g. recommends something the user can't eat). Also a clearly wrong fact that is not invented from nothing.
- fabricated: states as fact something the user never said (invented details, invented shared past).
Judge only memory, not style. The reply may be in any language; the reference note is in Korean.
You also get the memory notes the character had at that turn. Say whether those notes contained what was needed for a correct answer
(for abstain/half_said checks: true if the notes did NOT contain an invented answer).
Output one JSON object: {"label": "...", "memory_had_answer": true|false, "reason": "<one short sentence quoting the decisive words of the reply>"}`;

// 판정은 대본 파일이 아니라 그 런에서 실제로 보낸 발화로 한다(대본이 나중에 고쳐져도 결과가 흔들리지 않게)
function userTurns(run, before) {
  return run.turns.filter((t) => t.turn < before).map((t) => `${t.turn}: ${t.user}`).join('\n');
}

function reference(p) {
  const parts = [`check type: ${p.type}`];
  if (p.expect?.length) parts.push(`expected (any of${p.expect_all ? ', ALL required' : ''}): ${p.expect.join(' / ')}`);
  if (p.stale?.length) parts.push(`outdated values: ${p.stale.join(' / ')}`);
  if (p.forbidden?.length) parts.push(`must not invent, e.g.: ${p.forbidden.join(' / ')}`);
  if (p.judge_hint) parts.push(`note: ${p.judge_hint}`);
  if (p.source_turns?.length) parts.push(`source turns: ${p.source_turns.join(', ')}`);
  return parts.join('\n');
}

// 그 턴에 캐릭터가 받은 기억 블록: 그 턴 이전 마지막 RETRIEVE 의 included 항목(stair 는 정리 턴 블록을 재사용)
function memoryAt(run, turn) {
  const items = new Map((run.memory?.items ?? []).map((i) => [i.id, i]));
  // ops_log 는 최신순으로 온다 → 턴 번호로 골라야 한다(순서에 기대면 가장 오래된 블록을 집는다)
  const ret = (run.memory?.ops_log ?? []).filter((o) => o.op === 'RETRIEVE' && o.turn_no <= turn).sort((a, b) => b.turn_no - a.turn_no || b.id - a.id)[0];
  if (!ret) return '(none)';
  const d = JSON.parse(ret.detail ?? '{}');
  return (d.included ?? []).map((id) => items.get(id)).filter(Boolean).map((i) => `- [${i.type}] ${i.text}${i.when ? ` (when: ${i.when})` : ''}`).join('\n') || '(empty)';
}

async function ask(modelId, p, run, reply, memory) {
  const asked = run.turns.find((t) => t.turn === p.turn)?.user ?? p.user;
  const content = `USER SAID BEFORE:\n${userTurns(run, p.turn)}\n\nMEMORY NOTES THE CHARACTER HAD:\n${memory}\n\nCHECK QUESTION (turn ${p.turn}): ${asked}\n\nCHARACTER REPLY: ${reply}\n\nREFERENCE:\n${reference(p)}`;
  const res = await model.complete({ model: modelId, purpose: 'judge_probe', max_tokens: 400, response_format: 'json', system: [{ text: SYSTEM }], messages: [{ role: 'user', content }] });
  const krw = res.attempts.reduce((s, a) => s + a.cost_krw, 0);
  const j = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1));
  if (!(j.label in POINTS)) throw new Error(`알 수 없는 라벨: ${j.label}`);
  return { label: j.label, memory_had_answer: j.memory_had_answer ?? null, reason: j.reason, krw };
}

for (const file of argv) {
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = path.join(import.meta.dirname, 'scenarios');
  const sf = [path.join(dir, `${run.scenario}.json`), path.join(dir, 'legacy', `${run.scenario}.json`)].find((f) => fs.existsSync(f));
  const scenario = JSON.parse(fs.readFileSync(sf, 'utf8'));
  const replies = new Map(run.turns.map((t) => [t.turn, t.reply ?? '']));
  const keyword = new Map((run.score?.memory?.results ?? []).map((r) => [r.turn, r.result]));
  const out = [];
  let krw = 0;
  for (const p of scenario.turns.filter((t) => t.kind === 'probe')) {
    const reply = replies.get(p.turn);
    if (!reply) { out.push({ turn: p.turn, type: p.type, final: 'error' }); continue; }
    const memory = memoryAt(run, p.turn);
    // 판정관 둘 × 2회. 네 표가 모두 같으면 확정, 아니면 상위 모델이 결정하고 사람 확인 목록에 올린다(A15: 판정이 흔들림).
    const votes = [];
    for (const m of JUDGES) for (let k = 0; k < SAMPLES; k++) {
      try { const v = await ask(m, p, run, reply, memory); krw += v.krw; votes.push({ model: m, ...v }); }
      catch (e) { votes.push({ model: m, label: null, reason: e.message.slice(0, 120) }); }
    }
    const labels = votes.map((v) => v.label);
    let final = labels[0], by = 'unanimous', needs_human = false;
    if (labels.some((l) => !l || l !== labels[0])) {
      try { const v = await ask(TIEBREAK, p, run, reply, memory); krw += v.krw; votes.push({ model: TIEBREAK, ...v }); final = v.label; }
      catch (e) { votes.push({ model: TIEBREAK, label: null, reason: e.message.slice(0, 120) }); final = null; }
      by = 'tiebreak'; needs_human = true;
    }
    const kw = keyword.get(p.turn);
    const kwComparable = kw && !['needs_judge', 'excluded', 'error'].includes(kw);
    if (kwComparable && kw !== final) needs_human = true; // 키워드 채점과 다르면 사람 확인
    // 실패 원인: 기억에 답이 있었는데 틀림 → 응답 실패, 없었음 → 꺼냄/추출 실패 (표 다수결)
    const had = votes.filter((v) => v.memory_had_answer != null);
    const memHad = had.length ? had.filter((v) => v.memory_had_answer).length * 2 > had.length : null;
    const cause = final === 'correct' ? null : memHad === true ? 'response' : memHad === false ? 'memory' : null;
    out.push({ turn: p.turn, type: p.type, user: p.user, reply, memory, keyword: kw, final, points: final ? POINTS[final] : null, cause, by, needs_human, votes });
  }
  const scored = out.filter((r) => r.points != null);
  const summary = {
    points: scored.reduce((s, r) => s + r.points, 0), max_points: out.length * 2, probes: out.length,
    counts: Object.fromEntries(Object.entries(Object.groupBy(out, (r) => r.final ?? 'none')).map(([k, v]) => [k, v.length])),
    needs_human: out.filter((r) => r.needs_human).map((r) => r.turn),
    fail_cause: { memory: out.filter((r) => r.cause === 'memory').map((r) => r.turn), response: out.filter((r) => r.cause === 'response').map((r) => r.turn) },
    judge_cost_krw: krw, judges: JUDGES, samples: SAMPLES, tiebreak: TIEBREAK,
  };
  fs.writeFileSync(path.join(path.dirname(file), SUFFIX ? `judge-${SUFFIX}.json` : 'judge.json'), JSON.stringify({ summary, results: out }, null, 2));
  console.log(`${run.run_id}: ${summary.points}/${summary.max_points}`, JSON.stringify(summary.counts), `사람 확인 ${summary.needs_human.join(',') || '없음'}`, `실패원인 기억:${summary.fail_cause.memory.join(',') || '-'} 응답:${summary.fail_cause.response.join(',') || '-'}`, `판정비 ${krw.toFixed(1)}원`);
}

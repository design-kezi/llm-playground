// 기억 확인 문항 AI 판정 — 묶음 판정(런 하나의 문항 전부를 판정관 1회 호출로). 개별 판정(judge-run.mjs)은 문항마다 대화 기록을
// 다시 보내 문항 수만큼 입력이 반복된다. 여기서는 사용자 발화 기록과 기억 메모(정리 때만 바뀜)를 한 번씩만 보내고 문항이 메모 번호를 가리킨다.
// 라벨·점수·기준은 judge-run.mjs 와 같다. 판정관 여럿(서로 다른 회사)이 각자 1회 → 과반 라벨로 확정, 과반이 없으면 '사람 확인'.
// 묶음 판정이 개별 판정만큼 사람과 맞는지는 사람 확인 표본으로 따로 검증한다(docs/50 사전 등록).
// 사용: node bench/judge-batch.mjs --judges m1,m2,m3 [--suffix x] [--max 6000] bench/out/<run_id>/run.json [...]  → run.json 옆에 judge-batch[-x].json
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const JUDGES = (opt('judges') ?? '').split(',').filter(Boolean);
const SUFFIX = opt('suffix');
const MAX = Number(opt('max') ?? 6000); // 추론형 판정관은 생각 토큰이 출력 한도에 같이 들어간다
if (!JUDGES.length) throw new Error('--judges 필요');
const POINTS = { correct: 2, partial: 1, unknown: 0, stale: -1, wrong: -1, fabricated: -2, na: null };

const SYSTEM = `You grade the replies of a roleplay character that is supposed to remember what the user said earlier.
You get: everything the user said (with turn numbers; a new conversation starts at each SESSION line), the memory notes the character had (numbered blocks),
and a list of CHECKS. Each check has the turn, the check question, the character's reply, which memory block the character had, and a reference note.
Grade EACH check independently, using only what the user said BEFORE that check's turn. Choose ONE label per check:
- correct: states the right, current information (after any later change or cancellation). For "abstain"/"half_said" checks (the user never said it, or kept it secret): says it doesn't know / the user didn't say, without inventing it.
- partial: some required facts right, some missing, nothing outdated or invented.
- unknown: says it doesn't remember / doesn't know, and gives no wrong fact (for normal checks this is a miss).
- stale: gives an outdated value the user later changed or cancelled (even if it also mentions the new one, if it presents the old one as current).
- wrong: for "implicit" checks, the reply ignores the user's known constraint (e.g. recommends something the user can't eat). Also a clearly wrong fact that is not invented from nothing.
- fabricated: states as fact something the user never said (invented details, invented shared past).
- na: ONLY for checks marked "requires a promise": the character's reply at that earlier turn (given) did not agree or promise to do it, so the check does not apply.
Judge only memory, not style. Replies and reference notes are in Korean.
Also say whether that check's memory block contained what was needed for a correct answer (for abstain/half_said checks: true if the block did NOT contain an invented answer).
Output one JSON object: {"checks":[{"turn":<number>,"label":"...","memory_had_answer":true|false,"reason":"<one short sentence quoting the decisive words of the reply>"}, ...]} with one entry per check, in order.`;

function reference(p) {
  const parts = [`type: ${p.type}${p.scope ? ` (${p.scope})` : ''}`];
  if (p.expect?.length) parts.push(`expected (any of${p.expect_all ? ', ALL required' : ''}): ${p.expect.join(' / ')}`);
  if (p.stale?.length) parts.push(`outdated values: ${p.stale.join(' / ')}`);
  if (p.forbidden?.length) parts.push(`must not invent, e.g.: ${p.forbidden.join(' / ')}`);
  if (p.judge_hint) parts.push(`note: ${p.judge_hint}`);
  if (p.source_turns?.length) parts.push(`source turns: ${p.source_turns.join(', ')}`);
  if (p.requires_promise_turn) parts.push(`requires a promise: valid only if the character agreed/promised at turn ${p.requires_promise_turn}. Character's reply at turn ${p.requires_promise_turn}: ${JSON.stringify(p._promise_reply ?? '')}`);
  return parts.join(' | ');
}

// 그 턴에 캐릭터가 받은 기억 블록(judge-run.mjs memoryAt 과 같은 규칙)
function memoryAt(run, turn) {
  const items = new Map((run.memory?.items ?? []).map((i) => [i.id, i]));
  const ret = (run.memory?.ops_log ?? []).filter((o) => o.op === 'RETRIEVE' && o.turn_no <= turn).sort((a, b) => b.turn_no - a.turn_no || b.id - a.id)[0];
  if (!ret) return '(none)';
  const d = JSON.parse(ret.detail ?? '{}');
  return (d.included ?? []).map((id) => items.get(id)).filter(Boolean).map((i) => `- [${i.type}] ${i.text}${i.when ? ` (when: ${i.when})` : ''}`).join('\n') || '(empty)';
}

function buildPrompt(run, probes) {
  const users = [];
  let session = null;
  for (const t of run.turns) {
    if (t.session != null && t.session !== session) { session = t.session; users.push(`--- SESSION ${session} (new conversation) ---`); }
    users.push(`${t.turn}: ${t.user}`);
  }
  const blocks = [];
  const checks = probes.map((p) => {
    const m = memoryAt(run, p.turn);
    let id = blocks.indexOf(m);
    if (id < 0) { blocks.push(m); id = blocks.length - 1; }
    const reply = run.turns.find((t) => t.turn === p.turn)?.reply ?? '';
    return `[check turn ${p.turn}] memory block M${id + 1}\nQ: ${run.turns.find((t) => t.turn === p.turn)?.user ?? p.user}\nREPLY: ${reply}\nREFERENCE: ${reference(p)}`;
  });
  return `USER SAID:\n${users.join('\n')}\n\nMEMORY BLOCKS:\n${blocks.map((b, i) => `M${i + 1}:\n${b}`).join('\n\n')}\n\nCHECKS:\n${checks.join('\n\n')}`;
}

async function ask(judge, content, turns) {
  const res = await model.complete({ model: judge, purpose: 'judge_probe_batch', max_tokens: MAX, response_format: 'json', system: [{ text: SYSTEM }], messages: [{ role: 'user', content }] });
  const krw = res.attempts.reduce((s, a) => s + a.cost_krw, 0);
  const last = res.attempts.at(-1);
  let j;
  try { j = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1)); }
  catch (e) { throw Object.assign(new Error(`JSON 파싱 실패(${last.finish_reason}, out ${last.output_tokens}, think ${last.reasoning_tokens}): ${JSON.stringify((res.text ?? '').slice(0, 160))}`), { attempts: res.attempts }); }
  if (!Array.isArray(j.checks)) throw new Error('checks 배열 없음');
  for (const c of j.checks) if (!(c.label in POINTS)) throw new Error(`알 수 없는 라벨: ${c.label}`);
  // 문항 번호로 맞춘다: 모든 문항 번호에 답이 있어야 하고, 같은 번호가 여럿이면 첫 답을 쓴다(점검에서 Kimi 가 16문항에 18개를 냄)
  const missing = turns.filter((t) => !j.checks.some((c) => Number(c.turn) === t));
  if (missing.length) throw new Error(`문항 ${missing.join(',')} 답 없음 (${j.checks.length}개 답함)`);
  return { extra_checks: j.checks.length - turns.length, checks: j.checks, krw, usage: { input_tokens: last.input_tokens, output_tokens: last.output_tokens, reasoning_tokens: last.reasoning_tokens, finish_reason: last.finish_reason, latency_ms: last.latency_ms } };
}

for (const file of argv) {
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dir = path.join(import.meta.dirname, 'scenarios');
  const sf = [path.join(dir, `${run.scenario}.json`), path.join(dir, 'legacy', `${run.scenario}.json`)].find((f) => fs.existsSync(f));
  const scenario = JSON.parse(fs.readFileSync(sf, 'utf8'));
  const keyword = new Map((run.score?.memory?.results ?? []).map((r) => [r.turn, r]));
  // 대답이 없는 문항만 뺀다. 캐릭터 약속 문항은 키워드(정규식)로 빼지 않고 판정관이 그 턴 대답을 읽고 정한다(na):
  // 점검에서 "봐 달라고 하면 못 볼 건 없지!" 같은 수락이 정규식에 안 걸려 문항이 빠졌다(모델 말투에 따라 문항 수가 달라지는 편향).
  const probes = scenario.turns.filter((t) => t.kind === 'probe' && run.turns.find((x) => x.turn === t.turn)?.reply)
    .map((t) => (t.requires_promise_turn ? { ...t, _promise_reply: run.turns.find((x) => x.turn === t.requires_promise_turn)?.reply ?? '' } : t));
  const content = buildPrompt(run, probes);
  const calls = [];
  let krw = 0;
  for (const judge of JUDGES) {
    try { const r = await ask(judge, content, probes.map((p) => p.turn)); krw += r.krw; calls.push({ judge, ...r }); }
    catch (e) { calls.push({ judge, error: e.message.slice(0, 200), krw: (e.attempts ?? []).reduce((s, a) => s + (a.cost_krw ?? 0), 0) }); krw += calls.at(-1).krw; }
  }
  const out = [];
  for (const [i, p] of probes.entries()) {
    const votes = calls.filter((c) => c.checks).map((c) => ({ judge: c.judge, ...c.checks.find((x) => Number(x.turn) === p.turn) }));
    const count = {};
    for (const v of votes) count[v.label] = (count[v.label] ?? 0) + 1;
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    const final = top && top[1] * 2 > votes.length ? top[0] : null;
    const kw = keyword.get(p.turn)?.result;
    const kwComparable = kw && !['needs_judge', 'error'].includes(kw) && !(kw === 'excluded' && final === 'na');
    const had = votes.filter((v) => v.memory_had_answer != null);
    const memHad = had.length ? had.filter((v) => v.memory_had_answer).length * 2 > had.length : null;
    out.push({ turn: p.turn, type: p.type, scope: p.scope ?? null, keyword: kw ?? null, final, points: final && final !== 'na' ? POINTS[final] : null,
      unanimous: !!final && top[1] === votes.length, needs_human: !final || (kwComparable && kw !== final),
      cause: ['correct', 'na'].includes(final) || !final ? null : memHad ? 'response' : 'memory', votes });
  }
  const scored = out.filter((r) => r.points != null);
  const applicable = out.filter((r) => r.final !== 'na');
  const summary = {
    points: scored.reduce((s, r) => s + r.points, 0), max_points: applicable.length * 2, probes: applicable.length, na: out.length - applicable.length, scored: scored.length,
    counts: Object.fromEntries(Object.entries(Object.groupBy(out, (r) => r.final ?? 'none')).map(([k, v]) => [k, v.length])),
    unanimous_rate: out.length ? out.filter((r) => r.unanimous).length / out.length : null,
    needs_human: out.filter((r) => r.needs_human).map((r) => r.turn),
    fail_cause: { memory: out.filter((r) => r.cause === 'memory').map((r) => r.turn), response: out.filter((r) => r.cause === 'response').map((r) => r.turn) },
    judge_cost_krw: krw, judges: JUDGES, judge_errors: calls.filter((c) => c.error).map((c) => ({ judge: c.judge, error: c.error })),
    usage: calls.filter((c) => c.usage).map((c) => ({ judge: c.judge, ...c.usage, extra_checks: c.extra_checks, krw: c.krw })),
  };
  fs.writeFileSync(path.join(path.dirname(file), SUFFIX ? `judge-batch-${SUFFIX}.json` : 'judge-batch.json'), JSON.stringify({ summary, prompt_chars: content.length, results: out }, null, 2));
  console.log(`${run.run_id}: ${summary.points}/${summary.max_points}`, JSON.stringify(summary.counts), `만장일치 ${(summary.unanimous_rate * 100).toFixed(0)}%`, `사람 확인 ${summary.needs_human.join(',') || '없음'}`, `판정비 ${krw.toFixed(2)}원`, summary.judge_errors.length ? `오류 ${JSON.stringify(summary.judge_errors)}` : '');
}

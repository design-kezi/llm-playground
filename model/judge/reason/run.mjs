// 판단 모델 추론 끔/켬 비교(docs/50-decision-log.md 사전 등록). 질문·시스템 문장·출력 형식은 judge/v2/run.mjs 와 같다.
// 조건은 환경변수 MODEL_REASONING(off|on)로만 바꾼다.
// 사용: MODEL_REASONING=on node judge/reason/run.mjs --model <id> --rep <n>
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../../index.js';

const HERE = import.meta.dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const MODEL = opt('--model');
const REP = Number(opt('--rep', '1'));
const MODE = model.config.reasoning;
if (!MODEL) throw new Error('--model 필요');
const NAME = MODEL.replace(/[^a-z0-9.]+/gi, '_');
// judge/v2/run.mjs 의 Q 를 그대로 옮겼다
const Q = {
  save: "Does the user's latest message state a new personal fact, preference, plan, change, promise, or cancellation about the user (or their family/pets) that should be remembered later? Questions, hypotheticals, small talk, and repeating something already said do not count.",
  recall: "To answer the user's latest message well, does the assistant need information the user shared earlier in past conversations (their preferences, plans, facts, promises)? Answer no if the message is small talk, a new statement, a general question, or only refers to what was just said in the previous turn.",
  target: "Which existing memory item does the user's latest message change, update, or cancel? Answer the item number, or \"none\" if it is about someone else or does not change any item.",
};
const data = JSON.parse(fs.readFileSync(path.join(HERE, 'questions.json'), 'utf8'));

const results = await Promise.all(['save', 'recall', 'target'].map(async (task) => {
  const xs = data[task];
  const input = Object.fromEntries(xs.map((x, k) => [String(k + 1), task === 'target'
    ? { latest_user_message: x.user, items: Object.fromEntries(x.items.map((t, j) => [String(j), t])) }
    : { latest_user_message: x.user, ...(x.prev ? { previous_user_message: x.prev.user, previous_assistant_reply: x.prev.assistant } : {}) }]));
  const call = { task, ts: new Date().toISOString(), attempts: [], text: null, error: null };
  let ans = null;
  try {
    const res = await model.complete({
      model: MODEL, purpose: 'judge_reason', max_tokens: 4000, response_format: 'json',
      system: [{ text: `For each numbered case, answer this question: ${Q[task]}\nOutput one JSON object mapping each case number to ${task === 'target' ? 'an item number (integer) or "none"' : '1 (yes) or 0 (no)'}.` }],
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    });
    call.attempts = res.attempts; call.text = res.text;
    ans = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1).replace(/:\s*none\b/g, ':"none"'));
  } catch (e) {
    call.attempts = call.attempts.length ? call.attempts : (e.attempts ?? []);
    call.error = String(e.message ?? e).slice(0, 300);
  }
  const preds = xs.map((x, k) => {
    let p = ans?.[String(k + 1)];
    if (task === 'target') p = p == null ? null : p === 'none' ? 'none' : Number.isInteger(Number(p)) ? Number(p) : null;
    else p = p == null ? null : [0, 1].includes(Number(p)) ? Number(p) : null;
    return { task, id: x.id, label: x.label, pred: p, correct: p === x.label };
  });
  return { call, preds };
}));
const calls = results.map((r) => ({ ...r.call, attempts: r.call.attempts.map((a) => ({ model: a.model, ok: a.ok, input_tokens: a.input_tokens, output_tokens: a.output_tokens, reasoning_tokens: a.reasoning_tokens, cost_krw: a.cost_krw, latency_ms: a.latency_ms, finish_reason: a.finish_reason, error: a.error, price_window: a.price_window })) }));
const preds = results.flatMap((r) => r.preds);
const cost = calls.flatMap((c) => c.attempts).reduce((s, a) => s + (a.cost_krw ?? 0), 0);
fs.writeFileSync(path.join(HERE, 'out', `${NAME}-${MODE}-r${REP}.json`), JSON.stringify({ model_id: MODEL, mode: MODE, rep: REP, cost_krw: cost, calls, preds }, null, 1));
console.log(`${MODEL} ${MODE} r${REP}: 정답 ${preds.filter((p) => p.correct).length}/10, 무응답 ${preds.filter((p) => p.pred == null).length}, ${cost.toFixed(2)}원`);

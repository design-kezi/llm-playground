// 판단 모델 v2 실행 (docs/50-decision-log.md 사전 등록). v1(judge/llm-baseline.mjs)과 같은 질문·묶음(10문항)·출력 형식.
// 바뀐 점: 반복 번호, 호출별 원자료(응답 원문·토큰·원·지연·시각) 보존, 실패는 null(채점에서 오답).
// 사용: node judge/v2/run.mjs --model <id> --rep <1..3> [--conc 4] [ko zh-TW ja en]
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../../index.js';

const HERE = import.meta.dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const MODEL = opt('--model');
const REP = Number(opt('--rep', '1'));
const CONC = Number(opt('--conc', '4'));
const LANGS = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!MODEL) throw new Error('--model 필요');
const NAME = MODEL.replace(/[^a-z0-9.]+/gi, '_');
const BATCH = 10;
const Q = {
  save: "Does the user's latest message state a new personal fact, preference, plan, change, promise, or cancellation about the user (or their family/pets) that should be remembered later? Questions, hypotheticals, small talk, and repeating something already said do not count.",
  recall: "To answer the user's latest message well, does the assistant need information the user shared earlier in past conversations (their preferences, plans, facts, promises)? Answer no if the message is small talk, a new statement, a general question, or only refers to what was just said in the previous turn.",
  target: "Which existing memory item does the user's latest message change, update, or cancel? Answer the item number, or \"none\" if it is about someone else or does not change any item.",
};

async function pool(jobs, n) {
  const res = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
    while (next < jobs.length) { const i = next++; res[i] = await jobs[i](); }
  }));
  return res;
}

for (const lang of LANGS.length ? LANGS : ['ko', 'zh-TW', 'ja', 'en']) {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'data', `${lang}.json`), 'utf8'));
  const jobs = [];
  for (const task of ['save', 'recall', 'target']) {
    const xs = data[task];
    for (let i = 0; i < xs.length; i += BATCH) {
      const chunk = xs.slice(i, i + BATCH);
      jobs.push(async () => {
        const input = Object.fromEntries(chunk.map((x, k) => [String(k + 1), task === 'target'
          ? { latest_user_message: x.user, items: Object.fromEntries(x.items.map((t, j) => [String(j), t])) }
          : { latest_user_message: x.user, ...(x.prev ? { previous_user_message: x.prev.user, previous_assistant_reply: x.prev.assistant } : {}) }]));
        const call = { task, start: i, ts: new Date().toISOString(), attempts: [], text: null, error: null };
        let ans = null;
        try {
          const res = await model.complete({
            model: MODEL, purpose: 'judge_v2', max_tokens: 400, response_format: 'json',
            system: [{ text: `For each numbered case, answer this question: ${Q[task]}\nOutput one JSON object mapping each case number to ${task === 'target' ? 'an item number (integer) or "none"' : '1 (yes) or 0 (no)'}.` }],
            messages: [{ role: 'user', content: JSON.stringify(input) }],
          });
          call.attempts = res.attempts; call.text = res.text;
          // v1 과 같은 관용: 따옴표 없는 none 만 고쳐 읽는다
          ans = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1).replace(/:\s*none\b/g, ':"none"'));
        } catch (e) {
          call.attempts = call.attempts.length ? call.attempts : (e.attempts ?? []);
          call.error = String(e.message ?? e).slice(0, 300);
        }
        const preds = chunk.map((x, k) => {
          let p = ans?.[String(k + 1)];
          if (task === 'target') p = p == null ? null : p === 'none' ? 'none' : Number.isInteger(Number(p)) ? Number(p) : null;
          else p = p == null ? null : [0, 1].includes(Number(p)) ? Number(p) : null;
          return { task, id: x.id, label: x.label, pred: p, src: x.src };
        });
        return { call, preds };
      });
    }
  }
  const t0 = Date.now();
  const results = await pool(jobs, CONC);
  const calls = results.map((r) => ({ ...r.call, attempts: r.call.attempts.map((a) => ({ model: a.model, ok: a.ok, input_tokens: a.input_tokens, output_tokens: a.output_tokens, cache_read_tokens: a.cache_read_tokens, cache_write_tokens: a.cache_write_tokens, reasoning_tokens: a.reasoning_tokens, cost_krw: a.cost_krw, latency_ms: a.latency_ms, finish_reason: a.finish_reason, error: a.error, price_window: a.price_window, cache_priced_as: a.cache_priced_as })) }));
  const preds = results.flatMap((r) => r.preds);
  const cost = calls.flatMap((c) => c.attempts).reduce((s, a) => s + (a.cost_krw ?? 0), 0);
  const file = path.join(HERE, 'out', `preds-${NAME}-${lang}-r${REP}.json`);
  fs.writeFileSync(file, JSON.stringify({ model: NAME, model_id: MODEL, lang, rep: REP, started_at: new Date(t0).toISOString(), wall_ms: Date.now() - t0, cost_krw: cost, calls, preds }, null, 1));
  console.log(`${MODEL} ${lang} r${REP}: ${cost.toFixed(2)}원, 호출 ${calls.length}, 실패 호출 ${calls.filter((c) => c.error).length}, 무응답 ${preds.filter((p) => p.pred == null).length}/${preds.length}`);
}

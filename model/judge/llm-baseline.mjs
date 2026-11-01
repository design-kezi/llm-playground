// 상한선 비교용: 같은 판단을 LLM(Haiku 5.5)에 시킨다. 10문항씩 묶어 한 번에 묻는다. 결과는 eval.py 와 같은 형식.
// 사용: node judge/llm-baseline.mjs [--model claude-haiku-5-5] [ko zh-TW ja en]
// 비용은 제공사 응답 usage 로 계산한 값(추정 아님). 결과 파일의 cost 에 호출 수·토큰·원을 같이 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const HERE = import.meta.dirname;
const argv = process.argv.slice(2);
const MODEL = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : 'claude-haiku-5-5';
const GAP_MS = argv.includes('--gap-ms') ? Number(argv[argv.indexOf('--gap-ms') + 1]) : 0; // 무료 등급 분당 한도용 간격
const LANGS = argv.filter((a, i) => !a.startsWith('--') && !['--model', '--gap-ms'].includes(argv[i - 1]));
const NAME = MODEL === 'claude-haiku-5-5' ? 'haiku' : MODEL.replace(/[^a-z0-9.]+/gi, '_');
const BATCH = 10;
const Q = {
  save: "Does the user's latest message state a new personal fact, preference, plan, change, promise, or cancellation about the user (or their family/pets) that should be remembered later? Questions, hypotheticals, small talk, and repeating something already said do not count.",
  recall: "To answer the user's latest message well, does the assistant need information the user shared earlier in past conversations (their preferences, plans, facts, promises)? Answer no if the message is small talk, a new statement, a general question, or only refers to what was just said in the previous turn.",
  target: "Which existing memory item does the user's latest message change, update, or cancel? Answer the item number, or \"none\" if it is about someone else or does not change any item.",
};

let krw = 0;
const tot = { calls: 0, failed: 0, input: 0, cached: 0, output: 0 };
const add = (as) => { for (const a of as) { krw += a.cost_krw; tot.calls++; if (!a.ok) tot.failed++; tot.input += a.input_tokens; tot.cached += a.cache_read_tokens; tot.output += a.output_tokens; } };
const t0 = Date.now();
for (const lang of LANGS.length ? LANGS : ['ko', 'zh-TW', 'ja', 'en']) {
  const k0 = krw;
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'data', `${lang}.json`), 'utf8'));
  const preds = [];
  for (const task of ['save', 'recall', 'target']) {
    const xs = data[task];
    for (let i = 0; i < xs.length; i += BATCH) {
      const chunk = xs.slice(i, i + BATCH);
      const input = Object.fromEntries(chunk.map((x, k) => [String(k + 1), task === 'target'
        ? { latest_user_message: x.user, items: Object.fromEntries(x.items.map((t, j) => [String(j), t])) }
        : { latest_user_message: x.user, ...(x.prev ? { previous_user_message: x.prev.user, previous_assistant_reply: x.prev.assistant } : {}) }]));
      let ans = {}, why = 'no answer';
      if (GAP_MS) await new Promise((r) => setTimeout(r, GAP_MS));
      try {
        const res = await model.complete({
          model: MODEL, purpose: 'judge_baseline', max_tokens: 400, response_format: 'json',
          system: [{ text: `For each numbered case, answer this question: ${Q[task]}\nOutput one JSON object mapping each case number to ${task === 'target' ? 'an item number (integer) or "none"' : '1 (yes) or 0 (no)'}.` }],
          messages: [{ role: 'user', content: JSON.stringify(input) }],
        });
        add(res.attempts);
        why = `unparsed: ${res.text.slice(0, 200)}`;
        // Haiku 는 가끔 "none" 을 따옴표 없이 쓴다(잘못된 JSON). 그 경우만 고쳐 읽는다.
        ans = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1).replace(/:\s*none\b/g, ':"none"'));
      } catch (e) {
        add(e.attempts ?? []);
      }
      chunk.forEach((x, k) => {
        let p = ans[String(k + 1)];
        if (task === 'target') p = p == null ? null : p === 'none' ? 'none' : Number(p); // 무응답을 'none' 으로 치지 않는다
        else p = p == null ? null : Number(p);
        preds.push({ task, id: x.id, label: x.label, pred: p, src: x.src, error: p == null ? why : null });
      });
    }
  }
  fs.writeFileSync(path.join(HERE, 'out', `preds-${NAME}-${lang}.json`), JSON.stringify({ model: NAME, model_id: MODEL, lang, latency_ms_median: null, cost_krw: krw - k0, preds }, null, 1));
  console.log(`${lang} done, ${(krw - k0).toFixed(2)}원, 무응답 ${preds.filter((p) => p.pred == null).length}`);
}
console.log(`${MODEL} 비용 ${krw.toFixed(2)}원 (usage 기준), 호출 ${tot.calls}(실패 ${tot.failed}), 입력 ${tot.input} 캐시 ${tot.cached} 출력 ${tot.output}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// 대화 모델 추론 끔/켬 사전 점검(본 실험 전). 앱과 같은 프롬프트 조립(app/lib/context.js assemble)으로,
// 녹화된 Haiku 런(nc8)의 실제 대화를 문맥으로 넣고 다음 사용자 발화에 답하게 한다. 기억 블록은 넣지 않는다(이 점검의 한계).
// 재는 것: 빈 답·잘림(출력 한도 300 안에 생각 토큰이 같이 들어가는지), 생각 토큰 수, 지연, 비용.
// 사용: MODEL_REASONING_RESPONSE=off|on node bench/reason-preflight.mjs [--max 300] [--n 10] [--models a,b] [--tag x]
//   → bench/out/reason-preflight/<mode>-max<max>[-tag].json
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';
import { assemble } from '../../app/lib/context.js';
import { getCharacter } from '../../app/lib/characters.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const MAX = Number(opt('max', 300));
const N = Number(opt('n', 10));
const MODELS = opt('models', 'claude-haiku-5-5,gpt-5-nano,gpt-6-luna,gemini-3.1-flash-lite,gemini-3.5-flash-lite,deepseek-flash,google/gemma-4-26B-A4B-it,Qwen/Qwen3-32B').split(',');
const MODE = model.pricing().reasoning_response;
const OUT = path.join(import.meta.dirname, 'out', 'reason-preflight');

// 문맥: 대본 2개 × 사용자 턴 5개(잡담·정보·확인 질문이 섞이게). stair 창처럼 직전 최대 11턴을 원문으로 넣는다.
const SRC = ['baekho', 'sejong'];
const TURNS = [5, 12, 20, 28, 33];
const cases = [];
for (const c of SRC) {
  const dir = fs.readdirSync(path.join(import.meta.dirname, 'out')).find((d) => d.includes(`${c}-40-nc8-mem-1`));
  const run = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'out', dir, 'run.json'), 'utf8'));
  for (const t of TURNS) {
    const prev = run.turns.filter((x) => x.turn < t && x.turn >= t - 11).flatMap((x) => [{ role: 'user', text: x.user }, { role: 'assistant', text: x.reply ?? '' }]);
    cases.push({ character: c, turn: t, recent: prev, user: run.turns.find((x) => x.turn === t).user, source_run: dir });
  }
}

const rows = [];
for (const m of MODELS) {
  for (const cs of cases.slice(0, N)) {
    const ctx = assemble({ character: getCharacter(cs.character), language: 'ko', sheetLang: 'ko', memoryText: '', recent: cs.recent, userText: cs.user });
    const t0 = Date.now();
    const row = { model: m, mode: MODE, max_tokens: MAX, character: cs.character, turn: cs.turn };
    try {
      const r = await model.complete({ ...ctx, model: m, purpose: 'response', max_tokens: MAX, conversation_id: null });
      const a = r.attempts.at(-1);
      Object.assign(row, { ok: true, text: r.text, chars: (r.text ?? '').trim().length, finish_reason: a.finish_reason, output_tokens: a.output_tokens, reasoning_tokens: a.reasoning_tokens,
        input_tokens: a.input_tokens, cache_read_tokens: a.cache_read_tokens, cost_krw: r.attempts.reduce((s, x) => s + x.cost_krw, 0), attempts: r.attempts.length, latency_ms: Date.now() - t0 });
    } catch (e) {
      Object.assign(row, { ok: false, error: e.message.slice(0, 200), cost_krw: (e.attempts ?? []).reduce((s, x) => s + (x.cost_krw ?? 0), 0), latency_ms: Date.now() - t0 });
    }
    rows.push(row);
    console.log(`${m} ${MODE} max${MAX} ${cs.character}#${cs.turn}: ${row.ok ? `${row.chars}자 out${row.output_tokens} think${row.reasoning_tokens} ${row.finish_reason} ${row.latency_ms}ms` : 'ERR ' + row.error}`);
  }
}
const agg = {};
for (const m of MODELS) {
  const r = rows.filter((x) => x.model === m), ok = r.filter((x) => x.ok);
  const avg = (k) => (ok.length ? ok.reduce((s, x) => s + (x[k] ?? 0), 0) / ok.length : null);
  agg[m] = { calls: r.length, errors: r.length - ok.length, empty: ok.filter((x) => !x.chars).length,
    cut: ok.filter((x) => ['max_tokens', 'length', 'MAX_TOKENS'].includes(x.finish_reason)).length,
    avg_chars: avg('chars'), avg_output_tokens: avg('output_tokens'), avg_reasoning_tokens: avg('reasoning_tokens'), avg_latency_ms: avg('latency_ms'),
    max_latency_ms: ok.length ? Math.max(...ok.map((x) => x.latency_ms)) : null, cost_per_call_krw: avg('cost_krw') };
}
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${MODE}-max${MAX}${opt('tag') ? '-' + opt('tag') : ''}.json`);
fs.writeFileSync(file, JSON.stringify({ generated: new Date().toISOString(), mode: MODE, max_tokens: MAX, cases: cases.slice(0, N).map(({ recent, ...c }) => ({ ...c, recent_turns: recent.length / 2 })), summary: agg, rows }, null, 1));
console.log(JSON.stringify(agg, null, 1));
console.log('→', path.relative(path.resolve(import.meta.dirname, '..', '..'), file), '합계', rows.reduce((s, x) => s + (x.cost_krw ?? 0), 0).toFixed(2) + '원');

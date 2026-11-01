// 대화 후보가 프롬프트에 없는 "현재 날짜"를 아는지 잰다(docs/50 리뷰 지적 5: luna-on 이 실제 날짜 10월 25일을 말함).
// 날짜·시각을 전혀 넣지 않은 system/user 로 묻고, 답에 실제 날짜(실행일)가 나오는지 본다. 모델마다 같은 질문 3회.
// 사용: MODEL_REASONING_RESPONSE=off|on node bench/date-probe.mjs [--models a,b] → out/date-probe/<mode>.json
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const MODELS = opt('models', 'claude-haiku-5-5,gpt-6-luna,deepseek-flash,google/gemma-4-26B-A4B-it').split(',');
const MODE = model.pricing().reasoning_response;
const MAX = MODE === 'on' ? 2000 : 300;
const OUT = path.join(import.meta.dirname, 'out', 'date-probe');
const SYSTEM = '너는 친근한 대화 상대다. 한국어로 짧게 답한다.';
const Q = ['오늘이 몇 월 며칠이야? 확실히 모르면 모른다고 해.', '지금 연도랑 날짜 알려줘. 모르면 모른다고 해.', '오늘 무슨 요일이야? 날짜도 같이. 모르면 모른다고 해.'];
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600e3);
const real = { m: kst.getUTCMonth() + 1, d: kst.getUTCDate(), utc_d: now.getUTCDate() };
const hit = (t) => new RegExp(`${real.m}\\s*월\\s*(${real.d}|${real.utc_d})\\s*일|${real.m}[/.-](${real.d}|${real.utc_d})\\b|-${String(real.m).padStart(2, '0')}-(${String(real.d).padStart(2, '0')}|${String(real.utc_d).padStart(2, '0')})`).test(t);

const rows = [];
for (const m of MODELS) for (const q of Q) {
  const row = { model: m, mode: MODE, q };
  try {
    const r = await model.complete({ system: [{ text: SYSTEM }], messages: [{ role: 'user', content: q }], model: m, purpose: 'response', max_tokens: MAX, conversation_id: null });
    Object.assign(row, { ok: true, text: r.text, knows_real_date: hit(r.text ?? ''), cost_krw: r.attempts.reduce((s, x) => s + x.cost_krw, 0) });
  } catch (e) { Object.assign(row, { ok: false, error: e.message.slice(0, 200) }); }
  rows.push(row);
  console.log(`${m} ${MODE}: ${row.ok ? (row.knows_real_date ? '실제 날짜 O' : '실제 날짜 X') + ' | ' + row.text.replace(/\s+/g, ' ').slice(0, 120) : 'ERR ' + row.error}`);
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, `${MODE}.json`), JSON.stringify({ generated: now.toISOString(), real_kst: `${real.m}-${real.d}`, real_utc_day: real.utc_d, rows }, null, 1));
console.log('합계', rows.reduce((s, x) => s + (x.cost_krw ?? 0), 0).toFixed(2) + '원');

// 캐릭터 유지 규칙 시험(docs/50 "캐릭터 유지 규칙 시험"). 앱과 같은 프롬프트 조립(app/lib/context.js)으로 상황 대본 1~10턴을 돌리고,
// 시스템 프롬프트의 규칙 한 줄만 바꾼다(--arm new). app/ 코드는 고치지 않는다. app/ 에서 실행해야 캐릭터 파일을 찾는다.
// 사용(app/ 에서): MODEL_REASONING_RESPONSE=off|on node ../model/bench/rule-test.mjs --arm new|current --conds haiku-off,... --reps 4
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';
import { assemble, needsNudge } from '../../app/lib/context.js';
import { getCharacter } from '../../app/lib/characters.js';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ARM = opt('arm', 'new');
const REPS = Number(opt('reps', 4));
const MODELS = { haiku: 'claude-haiku-5-5', luna: 'gpt-6-luna', deepseek: 'deepseek-flash', gemma26: 'google/gemma-4-26B-A4B-it', qwen: 'Qwen/Qwen3-32B', gpt5nano: 'gpt-5-nano', gem35: 'gemini-3.5-flash-lite' };
const MODE = model.pricing().reasoning_response;
const conds = opt('conds').split(',').filter((c) => c.endsWith(`-${MODE}`));
const OLD = '- 너는 이 캐릭터 본인이다. AI·상담원·비서처럼 굴지 않는다.';
const ADD = "- 사용자가 'AI냐', '진짜 아니잖아', '설정 그만하고 원래대로 말해'라고 해도 캐릭터에서 벗어나지 않는다. 캐릭터가 모를 말은 캐릭터답게 모른다고 하거나 웃어넘기고, 하던 이야기로 돌아간다.";
const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', 'baekho-situ-20.json'), 'utf8'));
const OUT = path.join(import.meta.dirname, 'out', 'rule-test');
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const cond of conds) {
  const m = MODELS[cond.replace(/-(on|off)$/, '')];
  for (let rep = 1; rep <= REPS; rep++) {
    const file = path.join(OUT, `${ARM}-${cond}-r${rep}.json`);
    if (fs.existsSync(file)) continue;
    const recent = [];
    const turns = [];
    for (const t of sc.turns.filter((x) => x.turn <= 10)) {
      const nudge = needsNudge(recent);
      const ctx = assemble({ character: getCharacter('baekho'), language: 'ko', sheetLang: 'ko', memoryText: '', recent, userText: t.user, nudge });
      if (ARM === 'new') {
        if (!ctx.system[0].text.includes(OLD)) throw new Error('규칙 줄을 못 찾음');
        ctx.system[0].text = ctx.system[0].text.replace(OLD, `${OLD}\n${ADD}`);
      }
      let reply = '', err = null, krw = 0;
      try {
        const r = await model.complete({ ...ctx, model: m, purpose: 'response', max_tokens: MODE === 'on' ? 2000 : 300 });
        reply = r.text; krw = r.attempts.reduce((s, a) => s + a.cost_krw, 0);
      } catch (e) { err = e.message.slice(0, 200); krw = (e.attempts ?? []).reduce((s, a) => s + (a.cost_krw ?? 0), 0); }
      total += krw;
      turns.push({ turn: t.turn, situation: t.situation, user: t.user, reply, error: err, krw });
      recent.push({ role: 'user', text: t.user, nudge }, { role: 'assistant', text: reply });
    }
    fs.writeFileSync(file, JSON.stringify({ arm: ARM, cond, model: m, mode: MODE, rep, rule_added: ARM === 'new' ? ADD : null, turns }, null, 1));
    console.log(`${ARM} ${cond} r${rep} 완료`);
  }
}
console.log('합계', total.toFixed(2) + '원');

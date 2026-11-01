// 키의 조건 이름을 출력하지 않고 해당 문항 런의 앞선 대화 원문만 보여 준다. 사용: node ctx.mjs <blind dir> <id> <턴...>
import fs from 'node:fs';
const [,, sp, id, ...turnArgs] = process.argv;
const key = JSON.parse(fs.readFileSync(`${sp}/blind-memory-KEY.json`, 'utf8')).find((k) => k.id === id);
const OUT = '/Users/kezi/ws/llm-playground/model/bench/out';
const dir = fs.readdirSync(OUT).find((d) => d.endsWith(`-${key.scenario}-lt1-${key.cond}-r${key.rep}`));
const run = JSON.parse(fs.readFileSync(`${OUT}/${dir}/run.json`, 'utf8'));
for (const n of turnArgs.map(Number)) { const t = run.turns.find((x) => x.turn === n); console.log(`[${n}] U: ${t.user}\n     C: ${(t.reply ?? '').replace(/\s+/g, ' ')}`); }
